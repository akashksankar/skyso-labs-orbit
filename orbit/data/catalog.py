from typing import List, Dict, Any, Optional
from orbit.cache import get_all_cached_satellites, get_cached_satellite

def get_catalog_satellites(
    query: Optional[str] = None,
    regime: Optional[str] = None,
    object_type: Optional[str] = None,
    category: Optional[str] = None,
    sort_by: str = "name",
    limit: int = 100,
    offset: int = 0
) -> Dict[str, Any]:
    """Search, filter, and paginate catalog satellites."""
    all_sats = get_all_cached_satellites()

    filtered = []
    for sat in all_sats:
        # Search query
        if query:
            q = query.lower()
            name_match = q in sat.get("name", "").lower()
            id_match = q in str(sat.get("catalog_id", "")).lower()
            desig_match = q in str(sat.get("intl_desig", "")).lower()
            if not (name_match or id_match or desig_match):
                continue

        # Regime filter
        alt = sat.get("altitude_km", 400.0)
        if regime:
            reg = regime.upper()
            if reg == "LEO" and alt >= 2000:
                continue
            elif reg == "MEO" and (alt < 2000 or alt > 35000):
                continue
            elif reg == "GEO" and (alt < 35000 or alt > 36500):
                continue
            elif reg == "HEO" and alt <= 36500:
                continue

        # Object type
        if object_type and object_type.upper() != "ALL":
            if sat.get("object_type", "").upper() != object_type.upper():
                continue

        # Category
        if category and category.lower() != "all":
            if category.lower() not in sat.get("category", "").lower():
                continue

        filtered.append(sat)

    # Sort
    if sort_by == "altitude":
        filtered.sort(key=lambda s: s.get("altitude_km", 0.0))
    elif sort_by == "inclination":
        filtered.sort(key=lambda s: s.get("inclination", 0.0))
    elif sort_by == "id":
        filtered.sort(key=lambda s: int(s.get("catalog_id", 0)) if str(s.get("catalog_id", "0")).isdigit() else 0)
    else:
        filtered.sort(key=lambda s: s.get("name", "").lower())

    total = len(filtered)
    paged = filtered[offset : offset + limit]

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "satellites": paged
    }

def get_orbital_analytics() -> Dict[str, Any]:
    """Compute orbital analytics: altitude distributions, inclination bins, object types, and regime counts."""
    all_sats = get_all_cached_satellites()

    regimes = {"LEO": 0, "MEO": 0, "GEO": 0, "HEO": 0}
    categories: Dict[str, int] = {}
    types = {"PAYLOAD": 0, "ROCKET BODY": 0, "DEBRIS": 0, "UNKNOWN": 0}

    # Altitude distribution: 0-400km, 400-600km, 600-800km, 800-1200km, 1200-2000km, 2000-20000km, >20000km
    altitude_bins = {
        "200-400 km": 0,
        "400-600 km": 0,
        "600-800 km": 0,
        "800-1200 km": 0,
        "1200-2000 km": 0,
        "MEO (2k-35k km)": 0,
        "GEO (35k+ km)": 0
    }

    # Inclination distribution: Equatorial (0-20°), Mid (20-60°), High/Polar (60-90°), Retrograde (>90°)
    inclination_bins = {
        "Equatorial (0-20°)": 0,
        "Mid-Inclination (20-60°)": 0,
        "Polar / SSO (60-100°)": 0,
        "Retrograde (>100°)": 0
    }

    for sat in all_sats:
        alt = sat.get("altitude_km", 400.0)
        inc = sat.get("inclination", 0.0)
        obj_type = sat.get("object_type", "PAYLOAD").upper()
        cat = sat.get("category", "General")

        # Regime
        if alt < 2000:
            regimes["LEO"] += 1
        elif alt <= 35000:
            regimes["MEO"] += 1
        elif alt <= 36500:
            regimes["GEO"] += 1
        else:
            regimes["HEO"] += 1

        # Type
        if obj_type in types:
            types[obj_type] += 1
        else:
            types["UNKNOWN"] += 1

        # Category
        categories[cat] = categories.get(cat, 0) + 1

        # Altitude bins
        if alt < 400:
            altitude_bins["200-400 km"] += 1
        elif alt < 600:
            altitude_bins["400-600 km"] += 1
        elif alt < 800:
            altitude_bins["600-800 km"] += 1
        elif alt < 1200:
            altitude_bins["800-1200 km"] += 1
        elif alt < 2000:
            altitude_bins["1200-2000 km"] += 1
        elif alt <= 35000:
            altitude_bins["MEO (2k-35k km)"] += 1
        else:
            altitude_bins["GEO (35k+ km)"] += 1

        # Inclination bins
        if inc < 20:
            inclination_bins["Equatorial (0-20°)"] += 1
        elif inc <= 60:
            inclination_bins["Mid-Inclination (20-60°)"] += 1
        elif inc <= 100:
            inclination_bins["Polar / SSO (60-100°)"] += 1
        else:
            inclination_bins["Retrograde (>100°)"] += 1

    return {
        "total_tracked": len(all_sats),
        "regimes": regimes,
        "object_types": types,
        "categories": categories,
        "altitude_distribution": [{"range": k, "count": v} for k, v in altitude_bins.items()],
        "inclination_distribution": [{"range": k, "count": v} for k, v in inclination_bins.items()]
    }
