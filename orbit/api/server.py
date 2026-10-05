import asyncio
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from orbit.cache import init_db, get_cached_satellite, get_cache_status, get_all_cached_satellites
from orbit.config import load_config, save_config, ObserverConfig
from orbit.core.sgp4_engine import OrbitalEngine
from orbit.core.coordinates import calculate_topocentric
from orbit.core.passes import predict_passes
from orbit.core.groundtrack import calculate_groundtrack
from orbit.core.conjunction import analyze_conjunction
from orbit.core.lab import run_propagation_experiment
from orbit.data.celestrak import CelesTrakProvider
from orbit.data.catalog import get_catalog_satellites, get_orbital_analytics

app = FastAPI(
    title="ORBIT Engine API",
    description="Scientific local-first orbital mechanics and space intelligence API by Skyso Labs",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for conn in list(self.active_connections):
            try:
                await conn.send_json(message)
            except Exception:
                self.disconnect(conn)

manager = ConnectionManager()
celestrak = CelesTrakProvider()

@app.on_event("startup")
async def startup_event():
    init_db()

# --- Health & Status ---
@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "service": "ORBIT Orbital Engine",
        "organization": "Skyso Labs",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/api/status")
async def system_status():
    cache_meta = get_cache_status()
    cfg = load_config()
    return {
        "local": "READY",
        "data": cache_meta["status"],
        "cache": cache_meta,
        "engine": "SGP4",
        "observer": cfg.observer.model_dump(),
        "active_clients": len(manager.active_connections),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# --- Catalog ---
@app.get("/api/catalog")
async def list_catalog(
    query: Optional[str] = None,
    regime: Optional[str] = None,
    object_type: Optional[str] = None,
    category: Optional[str] = None,
    sort_by: str = "name",
    limit: int = 100,
    offset: int = 0
):
    return get_catalog_satellites(
        query=query,
        regime=regime,
        object_type=object_type,
        category=category,
        sort_by=sort_by,
        limit=limit,
        offset=offset
    )

@app.get("/api/catalog/search")
async def search_catalog(q: str):
    return get_catalog_satellites(query=q, limit=25)

@app.get("/api/catalog/{sat_id}")
async def get_satellite_details(sat_id: str):
    sat = await celestrak.fetch_object(sat_id)
    if not sat:
        raise HTTPException(status_code=404, detail=f"Satellite {sat_id} not found in catalog")
    return sat

# --- Telemetry & Tracking ---
@app.get("/api/objects/{sat_id}/position")
async def get_position(sat_id: str):
    sat = await celestrak.fetch_object(sat_id)
    if not sat:
        raise HTTPException(status_code=404, detail="Satellite not found")
    
    now = datetime.now(timezone.utc)
    telemetry = OrbitalEngine.propagate_tle(sat["line1"], sat["line2"], now)

    # Observer topocentric coordinates
    cfg = load_config()
    obs = cfg.observer
    sat_ecef = (telemetry["ecef"]["x_km"], telemetry["ecef"]["y_km"], telemetry["ecef"]["z_km"])
    topo = calculate_topocentric(sat_ecef, obs.latitude, obs.longitude, obs.altitude_m)

    return {
        "satellite": {
            "catalog_id": sat["catalog_id"],
            "name": sat["name"],
            "intl_desig": sat.get("intl_desig"),
            "object_type": sat.get("object_type"),
            "category": sat.get("category"),
            "source": sat.get("source")
        },
        "telemetry": telemetry,
        "observer_view": topo
    }

@app.get("/api/objects/{sat_id}/groundtrack")
async def get_groundtrack(
    sat_id: str,
    past_minutes: int = Query(45, ge=5, le=360),
    future_minutes: int = Query(180, ge=10, le=1440),
    step_seconds: int = Query(60, ge=10, le=300)
):
    sat = await celestrak.fetch_object(sat_id)
    if not sat:
        raise HTTPException(status_code=404, detail="Satellite not found")
    
    gt = calculate_groundtrack(
        sat["line1"],
        sat["line2"],
        past_minutes=past_minutes,
        future_minutes=future_minutes,
        step_seconds=step_seconds
    )
    return {
        "satellite": {"catalog_id": sat["catalog_id"], "name": sat["name"]},
        "groundtrack": gt
    }

@app.get("/api/objects/{sat_id}/passes")
async def get_passes(
    sat_id: str,
    days: float = Query(2.0, ge=0.5, le=7.0),
    min_elevation: float = Query(10.0, ge=0.0, le=80.0),
    limit: int = Query(5, ge=1, le=20)
):
    sat = await celestrak.fetch_object(sat_id)
    if not sat:
        raise HTTPException(status_code=404, detail="Satellite not found")

    cfg = load_config()
    obs = cfg.observer
    passes = predict_passes(
        sat["line1"],
        sat["line2"],
        obs_lat_deg=obs.latitude,
        obs_lon_deg=obs.longitude,
        obs_alt_m=obs.altitude_m,
        duration_hours=days * 24.0,
        min_elevation_deg=min_elevation,
        limit=limit
    )

    return {
        "satellite": {"catalog_id": sat["catalog_id"], "name": sat["name"]},
        "observer": obs.model_dump(),
        "passes": passes
    }

# --- Observer ---
class ObserverUpdateRequest(BaseModel):
    name: Optional[str] = "Primary Ground Station"
    latitude: float
    longitude: float
    altitude_m: Optional[float] = 10.0
    min_elevation_deg: Optional[float] = 10.0

@app.post("/api/observer")
async def update_observer(req: ObserverUpdateRequest):
    cfg = load_config()
    cfg.observer.name = req.name or cfg.observer.name
    cfg.observer.latitude = req.latitude
    cfg.observer.longitude = req.longitude
    if req.altitude_m is not None:
        cfg.observer.altitude_m = req.altitude_m
    if req.min_elevation_deg is not None:
        cfg.observer.min_elevation_deg = req.min_elevation_deg
    save_config(cfg)

    await manager.broadcast({
        "type": "OBSERVER_UPDATED",
        "payload": cfg.observer.model_dump()
    })
    return {"status": "updated", "observer": cfg.observer.model_dump()}

# --- Conjunction Analysis ---
class ConjunctionRequest(BaseModel):
    sat_id_a: str
    sat_id_b: str
    duration_hours: Optional[float] = 24.0

@app.post("/api/analysis/conjunction")
async def run_conjunction(req: ConjunctionRequest):
    sat_a = await celestrak.fetch_object(req.sat_id_a)
    sat_b = await celestrak.fetch_object(req.sat_id_b)
    if not sat_a or not sat_b:
        raise HTTPException(status_code=404, detail="One or both satellites could not be found")
    
    result = analyze_conjunction(sat_a, sat_b, duration_hours=req.duration_hours or 24.0)
    await manager.broadcast({
        "type": "ANALYSIS_COMPLETED",
        "payload": {"analysis_type": "CONJUNCTION", "result": result}
    })
    return result

# --- Propagation Lab Experiment ---
class ExperimentRequest(BaseModel):
    sat_id: str
    horizons: Optional[List[int]] = [1, 6, 12, 24, 48]

@app.post("/api/analysis/propagation")
async def run_propagation(req: ExperimentRequest):
    sat = await celestrak.fetch_object(req.sat_id)
    if not sat:
        raise HTTPException(status_code=404, detail="Satellite not found")
    
    res = run_propagation_experiment(sat, req.horizons or [1, 6, 12, 24, 48])
    await manager.broadcast({
        "type": "ANALYSIS_COMPLETED",
        "payload": {"analysis_type": "PROPAGATION_EXPERIMENT", "result": res}
    })
    return res

# --- Analytics ---
@app.get("/api/analytics/population")
async def get_population_stats():
    return get_orbital_analytics()

# --- WebSocket ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    # Send initial SERVER_READY
    await websocket.send_json({
        "type": "SERVER_READY",
        "payload": {
            "status": "READY",
            "server": "ORBIT Local-First Engine",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    })
    try:
        while True:
            data = await websocket.receive_text()
            try:
                event = json.loads(data)
                event_type = event.get("type")
                payload = event.get("payload", {})

                # Echo/broadcast event to other clients
                await manager.broadcast(event)
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
