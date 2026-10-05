from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from orbit.core.sgp4_engine import OrbitalEngine
from orbit.core.coordinates import calculate_topocentric

def predict_passes(
    line1: str,
    line2: str,
    obs_lat_deg: float,
    obs_lon_deg: float,
    obs_alt_m: float = 0.0,
    start_time: Optional[datetime] = None,
    duration_hours: float = 24.0,
    step_seconds: int = 30,
    min_elevation_deg: float = 10.0,
    limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Predict satellite passes over an observer ground station within a given time horizon.
    """
    if start_time is None:
        start_time = datetime.now(timezone.utc)
    elif start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)

    end_time = start_time + timedelta(hours=duration_hours)
    current_time = start_time
    
    passes = []
    in_pass = False
    current_pass: Dict[str, Any] = {}

    while current_time < end_time and len(passes) < limit:
        try:
            prop = OrbitalEngine.propagate_tle(line1, line2, current_time)
            sat_ecef = (prop["ecef"]["x_km"], prop["ecef"]["y_km"], prop["ecef"]["z_km"])
            topo = calculate_topocentric(sat_ecef, obs_lat_deg, obs_lon_deg, obs_alt_m)
            el = topo["elevation_deg"]
            az = topo["azimuth_deg"]

            if el >= min_elevation_deg:
                if not in_pass:
                    # AOS
                    in_pass = True
                    current_pass = {
                        "rise_time": current_time.isoformat(),
                        "rise_azimuth_deg": az,
                        "max_elevation_deg": el,
                        "max_elevation_time": current_time.isoformat(),
                        "set_time": current_time.isoformat(),
                        "set_azimuth_deg": az,
                        "duration_sec": 0
                    }
                else:
                    if el > current_pass["max_elevation_deg"]:
                        current_pass["max_elevation_deg"] = round(el, 1)
                        current_pass["max_elevation_time"] = current_time.isoformat()
            else:
                if in_pass:
                    # LOS
                    in_pass = False
                    current_pass["set_time"] = current_time.isoformat()
                    current_pass["set_azimuth_deg"] = az
                    
                    t_rise = datetime.fromisoformat(current_pass["rise_time"])
                    t_set = current_time
                    dur_sec = int((t_set - t_rise).total_seconds())
                    current_pass["duration_sec"] = dur_sec
                    
                    mins = dur_sec // 60
                    secs = dur_sec % 60
                    current_pass["duration_formatted"] = f"{mins:02d}:{secs:02d}"

                    max_el = current_pass["max_elevation_deg"]
                    if max_el >= 60:
                        rating = "Excellent"
                    elif max_el >= 30:
                        rating = "Good"
                    elif max_el >= 15:
                        rating = "Fair"
                    else:
                        rating = "Low"
                    current_pass["visibility"] = rating
                    passes.append(current_pass)
        except Exception:
            pass

        current_time += timedelta(seconds=step_seconds)

    return passes
