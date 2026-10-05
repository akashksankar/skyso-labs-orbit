import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, List
from orbit.config import ensure_orbit_dirs, DB_PATH, load_config
from orbit.data.seed_data import SEED_SATELLITES

def get_db():
    ensure_orbit_dirs()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize local SQLite database with satellite and cache tables."""
    conn = get_db()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS satellites (
                catalog_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                intl_desig TEXT,
                object_type TEXT,
                category TEXT,
                epoch TEXT,
                line1 TEXT NOT NULL,
                line2 TEXT NOT NULL,
                inclination REAL,
                eccentricity REAL,
                mean_motion REAL,
                period_min REAL,
                altitude_km REAL,
                source TEXT,
                updated_at REAL,
                raw_json TEXT
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS cache_meta (
                key TEXT PRIMARY KEY,
                updated_at REAL,
                source TEXT,
                item_count INTEGER,
                status TEXT
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS experiments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                experiment_type TEXT,
                target_id TEXT,
                created_at TEXT,
                results_json TEXT
            );
        """)

    # Seed initial satellites if table is empty
    count = conn.execute("SELECT COUNT(*) FROM satellites").fetchone()[0]
    if count == 0:
        seed_cache(conn)
    conn.close()

def seed_cache(conn: sqlite3.Connection):
    """Seed database with high-precision offline catalog."""
    now = time.time()
    for sat in SEED_SATELLITES:
        conn.execute("""
            INSERT OR REPLACE INTO satellites 
            (catalog_id, name, intl_desig, object_type, category, epoch, line1, line2, inclination, eccentricity, mean_motion, period_min, altitude_km, source, updated_at, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            sat["catalog_id"],
            sat["name"],
            sat.get("intl_desig", ""),
            sat.get("object_type", "PAYLOAD"),
            sat.get("category", "General"),
            sat.get("epoch", ""),
            sat["line1"],
            sat["line2"],
            sat.get("inclination", 0.0),
            sat.get("eccentricity", 0.0),
            sat.get("mean_motion", 0.0),
            sat.get("period_min", 90.0),
            sat.get("altitude_km", 400.0),
            sat.get("source", "CelesTrak (Offline Seed)"),
            now,
            json.dumps(sat)
        ))
    conn.execute("""
        INSERT OR REPLACE INTO cache_meta (key, updated_at, source, item_count, status)
        VALUES ('stations', ?, 'CelesTrak Offline Seed', ?, 'CURRENT')
    """, (now, len(SEED_SATELLITES)))

def get_all_cached_satellites() -> List[Dict[str, Any]]:
    conn = get_db()
    rows = conn.execute("SELECT * FROM satellites ORDER BY name ASC").fetchall()
    result = [dict(r) for r in rows]
    conn.close()
    return result

def get_cached_satellite(catalog_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    c_up = catalog_id.upper()
    row = conn.execute("""
        SELECT * FROM satellites 
        WHERE catalog_id = ? OR UPPER(name) LIKE ? OR UPPER(name) LIKE ?
        ORDER BY 
            CASE 
                WHEN catalog_id = ? THEN 1
                WHEN UPPER(name) = ? THEN 2
                WHEN UPPER(name) LIKE ? THEN 3
                ELSE 4
            END
        LIMIT 1
    """, (catalog_id, f"{c_up}%", f"%{c_up}%", catalog_id, c_up, f"{c_up}%")).fetchone()
    conn.close()
    return dict(row) if row else None

def save_satellites_to_cache(satellites: List[Dict[str, Any]], group_key: str = "general", source: str = "CelesTrak"):
    conn = get_db()
    now = time.time()
    with conn:
        for sat in satellites:
            conn.execute("""
                INSERT OR REPLACE INTO satellites 
                (catalog_id, name, intl_desig, object_type, category, epoch, line1, line2, inclination, eccentricity, mean_motion, period_min, altitude_km, source, updated_at, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(sat["catalog_id"]),
                sat["name"],
                sat.get("intl_desig", ""),
                sat.get("object_type", "PAYLOAD"),
                sat.get("category", "General"),
                sat.get("epoch", ""),
                sat["line1"],
                sat["line2"],
                sat.get("inclination", 0.0),
                sat.get("eccentricity", 0.0),
                sat.get("mean_motion", 0.0),
                sat.get("period_min", 90.0),
                sat.get("altitude_km", 400.0),
                source,
                now,
                json.dumps(sat)
            ))
        conn.execute("""
            INSERT OR REPLACE INTO cache_meta (key, updated_at, source, item_count, status)
            VALUES (?, ?, ?, ?, 'CURRENT')
        """, (group_key, now, source, len(satellites)))
    conn.close()

def get_cache_status() -> Dict[str, Any]:
    conn = get_db()
    row = conn.execute("SELECT * FROM cache_meta ORDER BY updated_at DESC LIMIT 1").fetchone()
    total_sats = conn.execute("SELECT COUNT(*) FROM satellites").fetchone()[0]
    conn.close()
    
    if not row:
        return {
            "source": "None",
            "updated": "Never",
            "age": "N/A",
            "status": "EMPTY",
            "count": total_sats
        }
    
    updated_ts = row["updated_at"]
    age_seconds = time.time() - updated_ts
    hours = int(age_seconds // 3600)
    minutes = int((age_seconds % 3600) // 60)
    age_str = f"{hours}h {minutes}m"
    
    dt = datetime.fromtimestamp(updated_ts, tz=timezone.utc)
    updated_str = dt.strftime("%Y-%m-%d %H:%M UTC")
    
    status = "CURRENT" if hours < 24 else "STALE"
    return {
        "source": row["source"],
        "updated": updated_str,
        "age": age_str,
        "status": status,
        "count": total_sats
    }
