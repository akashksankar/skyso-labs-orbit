import math
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from orbit.core.sgp4_engine import OrbitalEngine

def analyze_conjunction(
    sat_a: Dict[str, Any],
    sat_b: Dict[str, Any],
    start_time: Optional[datetime] = None,
    duration_hours: float = 24.0,
    coarse_step_sec: int = 60,
    fine_step_sec: int = 5
) -> Dict[str, Any]:
    """
    Experimental conjunction assessment between two orbital objects.
    Finds estimated minimum separation, TCA, and relative velocity.
    """
    if start_time is None:
        start_time = datetime.now(timezone.utc)
    elif start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)

    line1_a, line2_a = sat_a["line1"], sat_a["line2"]
    line1_b, line2_b = sat_b["line1"], sat_b["line2"]

    end_time = start_time + timedelta(hours=duration_hours)
    curr = start_time

    min_dist_km = float("inf")
    tca_time = start_time
    rel_vel_kms = 0.0

    # Coarse search pass
    while curr <= end_time:
        try:
            prop_a = OrbitalEngine.propagate_tle(line1_a, line2_a, curr)
            prop_b = OrbitalEngine.propagate_tle(line1_b, line2_b, curr)

            dx = prop_a["eci"]["x_km"] - prop_b["eci"]["x_km"]
            dy = prop_a["eci"]["y_km"] - prop_b["eci"]["y_km"]
            dz = prop_a["eci"]["z_km"] - prop_b["eci"]["z_km"]
            dist = math.sqrt(dx**2 + dy**2 + dz**2)

            if dist < min_dist_km:
                min_dist_km = dist
                tca_time = curr
        except Exception:
            pass
        curr += timedelta(seconds=coarse_step_sec)

    # Fine search pass around coarse TCA (+/- 3 minutes)
    fine_start = max(start_time, tca_time - timedelta(minutes=3))
    fine_end = min(end_time, tca_time + timedelta(minutes=3))
    curr = fine_start

    while curr <= fine_end:
        try:
            prop_a = OrbitalEngine.propagate_tle(line1_a, line2_a, curr)
            prop_b = OrbitalEngine.propagate_tle(line1_b, line2_b, curr)

            dx = prop_a["eci"]["x_km"] - prop_b["eci"]["x_km"]
            dy = prop_a["eci"]["y_km"] - prop_b["eci"]["y_km"]
            dz = prop_a["eci"]["z_km"] - prop_b["eci"]["z_km"]
            dist = math.sqrt(dx**2 + dy**2 + dz**2)

            if dist < min_dist_km:
                min_dist_km = dist
                tca_time = curr
                dvx = prop_a["eci"]["vx_kms"] - prop_b["eci"]["vx_kms"]
                dvy = prop_a["eci"]["vy_kms"] - prop_b["eci"]["vy_kms"]
                dvz = prop_a["eci"]["vz_kms"] - prop_b["eci"]["vz_kms"]
                rel_vel_kms = math.sqrt(dvx**2 + dvy**2 + dvz**2)
        except Exception:
            pass
        curr += timedelta(seconds=fine_step_sec)

    # Risk level classification
    if min_dist_km < 5.0:
        risk_level = "ELEVATED"
    elif min_dist_km < 25.0:
        risk_level = "MODERATE"
    elif min_dist_km < 100.0:
        risk_level = "LOW"
    else:
        risk_level = "NOMINAL_SEPARATION"

    return {
        "disclaimer": "NON-OPERATIONAL RESEARCH ESTIMATE",
        "confidence": "RESEARCH ESTIMATE",
        "object_a": {
            "catalog_id": sat_a.get("catalog_id"),
            "name": sat_a.get("name"),
            "object_type": sat_a.get("object_type")
        },
        "object_b": {
            "catalog_id": sat_b.get("catalog_id"),
            "name": sat_b.get("name"),
            "object_type": sat_b.get("object_type")
        },
        "time_of_closest_approach_utc": tca_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "minimum_separation_km": round(min_dist_km, 2),
        "relative_velocity_kms": round(rel_vel_kms, 3),
        "risk_level": risk_level,
        "analysis_window_hours": duration_hours,
        "calculation_timestamp": datetime.now(timezone.utc).isoformat()
    }
