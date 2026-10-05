from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from orbit.core.sgp4_engine import OrbitalEngine

def calculate_groundtrack(
    line1: str,
    line2: str,
    reference_time: Optional[datetime] = None,
    past_minutes: int = 45,
    future_minutes: int = 180,
    step_seconds: int = 60
) -> Dict[str, Any]:
    """
    Calculate high-resolution ground track coordinates (past, current, and future) for an orbital object.
    """
    if reference_time is None:
        reference_time = datetime.now(timezone.utc)
    elif reference_time.tzinfo is None:
        reference_time = reference_time.replace(tzinfo=timezone.utc)

    # Current telemetry
    current_prop = OrbitalEngine.propagate_tle(line1, line2, reference_time)
    current_point = {
        "timestamp": reference_time.isoformat(),
        "lat": current_prop["coordinates"]["latitude_deg"],
        "lon": current_prop["coordinates"]["longitude_deg"],
        "alt_km": current_prop["coordinates"]["altitude_km"],
        "speed_kms": current_prop["coordinates"]["speed_kms"]
    }

    # Past track
    past_points: List[Dict[str, Any]] = []
    past_start = reference_time - timedelta(minutes=past_minutes)
    curr = past_start
    while curr < reference_time:
        try:
            prop = OrbitalEngine.propagate_tle(line1, line2, curr)
            past_points.append({
                "timestamp": curr.isoformat(),
                "lat": prop["coordinates"]["latitude_deg"],
                "lon": prop["coordinates"]["longitude_deg"],
                "alt_km": prop["coordinates"]["altitude_km"]
            })
        except Exception:
            pass
        curr += timedelta(seconds=step_seconds)

    # Future track
    future_points: List[Dict[str, Any]] = []
    future_end = reference_time + timedelta(minutes=future_minutes)
    curr = reference_time + timedelta(seconds=step_seconds)
    while curr <= future_end:
        try:
            prop = OrbitalEngine.propagate_tle(line1, line2, curr)
            future_points.append({
                "timestamp": curr.isoformat(),
                "lat": prop["coordinates"]["latitude_deg"],
                "lon": prop["coordinates"]["longitude_deg"],
                "alt_km": prop["coordinates"]["altitude_km"]
            })
        except Exception:
            pass
        curr += timedelta(seconds=step_seconds)

    return {
        "object_tle_epoch": current_prop.get("timestamp"),
        "period_min": current_prop["elements"]["period_min"],
        "current": current_point,
        "past": past_points,
        "future": future_points,
        "parameters": {
            "past_minutes": past_minutes,
            "future_minutes": future_minutes,
            "step_seconds": step_seconds
        }
    }
