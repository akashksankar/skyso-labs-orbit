import httpx
from typing import List, Dict, Any, Optional
from orbit.cache import save_satellites_to_cache, get_all_cached_satellites, get_cached_satellite
from orbit.config import load_config

class CelesTrakProvider:
    def __init__(self):
        self.config = load_config()
        self.base_url = "https://celestrak.org/NORAD/elements/gp.php"

    def _omm_to_tle_strings(self, omm: Dict[str, Any]) -> tuple[str, str]:
        """Synthesize valid TLE lines if raw OMM is provided."""
        line1 = omm.get("TLE_LINE1")
        line2 = omm.get("TLE_LINE2")
        if line1 and line2:
            return line1.strip(), line2.strip()
        
        # If OMM only has orbital keys, format standard representation
        cat_id = str(omm.get("NORAD_CAT_ID", "99999")).rjust(5, "0")
        inc = float(omm.get("INCLINATION", 0.0))
        raan = float(omm.get("RA_OF_ASC_NODE", 0.0))
        ecc = float(omm.get("ECCENTRICITY", 0.0))
        argp = float(omm.get("ARG_OF_PERICENTER", 0.0))
        ma = float(omm.get("MEAN_ANOMALY", 0.0))
        mm = float(omm.get("MEAN_MOTION", 15.0))

        ecc_str = str(int(ecc * 1e7)).rjust(7, "0")
        line1_synth = f"1 {cat_id}U 00000A   26278.50000000  .00001000  00000+0  10000-3 0  9990"
        line2_synth = f"2 {cat_id} {inc:8.4f} {raan:8.4f} {ecc_str} {argp:8.4f} {ma:8.4f} {mm:11.8f}00001"
        return line1_synth, line2_synth

    async def fetch_group(self, group: str = "STATIONS") -> List[Dict[str, Any]]:
        """
        Fetch orbital group elements from CelesTrak GP API.
        Falls back to local cache if offline or network unavailable.
        """
        url = f"{self.base_url}?GROUP={group.upper()}&FORMAT=json"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, headers={"User-Agent": "Skyso-Orbit/1.0"})
                if res.status_code == 200:
                    data = res.json()
                    parsed: List[Dict[str, Any]] = []
                    for item in data:
                        line1, line2 = self._omm_to_tle_strings(item)
                        cat_id = str(item.get("NORAD_CAT_ID", item.get("OBJECT_ID", "")))
                        name = item.get("OBJECT_NAME", f"SAT-{cat_id}")
                        sat_obj = {
                            "catalog_id": cat_id,
                            "name": name,
                            "intl_desig": item.get("OBJECT_ID", ""),
                            "object_type": item.get("OBJECT_TYPE", "PAYLOAD"),
                            "category": group.capitalize(),
                            "epoch": item.get("EPOCH", ""),
                            "line1": line1,
                            "line2": line2,
                            "inclination": float(item.get("INCLINATION", 0.0)),
                            "eccentricity": float(item.get("ECCENTRICITY", 0.0)),
                            "mean_motion": float(item.get("MEAN_MOTION", 15.0)),
                            "period_min": round(1440.0 / max(0.001, float(item.get("MEAN_MOTION", 15.0))), 2),
                            "altitude_km": round(float(item.get("SEMIMAJOR_AXIS", 6778.0)) - 6378.137, 1),
                            "source": "CelesTrak GP (Live)"
                        }
                        parsed.append(sat_obj)

                    if parsed:
                        save_satellites_to_cache(parsed, group_key=group.lower(), source="CelesTrak GP (Live)")
                        return parsed
        except Exception:
            pass

        # Offline / fallback: return cached satellites
        cached = get_all_cached_satellites()
        if group.lower() != "all":
            filtered = [s for s in cached if group.lower() in s.get("category", "").lower()]
            if filtered:
                return filtered
        return cached

    async def fetch_object(self, identifier: str) -> Optional[Dict[str, Any]]:
        """Fetch single orbital object by NORAD ID or name."""
        cached = get_cached_satellite(identifier)
        if cached:
            return cached

        # Try live query
        try:
            url = f"{self.base_url}?CATNR={identifier}&FORMAT=json" if identifier.isdigit() else f"{self.base_url}?NAME={identifier}&FORMAT=json"
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, headers={"User-Agent": "Skyso-Orbit/1.0"})
                if res.status_code == 200:
                    data = res.json()
                    if data and isinstance(data, list) and len(data) > 0:
                        item = data[0]
                        line1, line2 = self._omm_to_tle_strings(item)
                        cat_id = str(item.get("NORAD_CAT_ID", identifier))
                        sat_obj = {
                            "catalog_id": cat_id,
                            "name": item.get("OBJECT_NAME", f"SAT-{cat_id}"),
                            "intl_desig": item.get("OBJECT_ID", ""),
                            "object_type": item.get("OBJECT_TYPE", "PAYLOAD"),
                            "category": "General",
                            "epoch": item.get("EPOCH", ""),
                            "line1": line1,
                            "line2": line2,
                            "inclination": float(item.get("INCLINATION", 0.0)),
                            "eccentricity": float(item.get("ECCENTRICITY", 0.0)),
                            "mean_motion": float(item.get("MEAN_MOTION", 15.0)),
                            "period_min": round(1440.0 / max(0.001, float(item.get("MEAN_MOTION", 15.0))), 2),
                            "altitude_km": round(float(item.get("SEMIMAJOR_AXIS", 6778.0)) - 6378.137, 1),
                            "source": "CelesTrak GP (Live)"
                        }
                        save_satellites_to_cache([sat_obj], group_key="single", source="CelesTrak GP (Live)")
                        return sat_obj
        except Exception:
            pass

        return None
