import math
from typing import Tuple, Dict, Any

WGS84_A = 6378.137  # Earth radius km
WGS84_F = 1.0 / 298.257223563
WGS84_E2 = 2 * WGS84_F - WGS84_F**2

def observer_geodetic_to_ecef(lat_deg: float, lon_deg: float, alt_m: float) -> Tuple[float, float, float]:
    """Convert observer lat, lon (deg) and altitude (m) to ECEF coordinates (km)."""
    lat_rad = math.radians(lat_deg)
    lon_rad = math.radians(lon_deg)
    alt_km = alt_m / 1000.0

    sin_lat = math.sin(lat_rad)
    cos_lat = math.cos(lat_rad)
    sin_lon = math.sin(lon_rad)
    cos_lon = math.cos(lon_rad)

    N = WGS84_A / math.sqrt(1.0 - WGS84_E2 * sin_lat**2)

    x = (N + alt_km) * cos_lat * cos_lon
    y = (N + alt_km) * cos_lat * sin_lon
    z = (N * (1.0 - WGS84_E2) + alt_km) * sin_lat

    return x, y, z

def calculate_topocentric(
    sat_ecef: Tuple[float, float, float],
    obs_lat_deg: float,
    obs_lon_deg: float,
    obs_alt_m: float = 0.0
) -> Dict[str, float]:
    """
    Calculate topocentric coordinates (Azimuth, Elevation, Range) from Observer station to Satellite.
    """
    obs_x, obs_y, obs_z = observer_geodetic_to_ecef(obs_lat_deg, obs_lon_deg, obs_alt_m)

    # Vector from observer to satellite in ECEF (km)
    dx = sat_ecef[0] - obs_x
    dy = sat_ecef[1] - obs_y
    dz = sat_ecef[2] - obs_z

    range_km = math.sqrt(dx**2 + dy**2 + dz**2)

    lat_rad = math.radians(obs_lat_deg)
    lon_rad = math.radians(obs_lon_deg)

    sin_lat = math.sin(lat_rad)
    cos_lat = math.cos(lat_rad)
    sin_lon = math.sin(lon_rad)
    cos_lon = math.cos(lon_rad)

    # Rotate ECEF delta to Topocentric Horizon frame (South, East, Zenith)
    # or (North, East, Up)
    north = -sin_lat * cos_lon * dx - sin_lat * sin_lon * dy + cos_lat * dz
    east = -sin_lon * dx + cos_lon * dy
    up = cos_lat * cos_lon * dx + cos_lat * sin_lon * dy + sin_lat * dz

    # Elevation angle
    elevation_rad = math.asin(max(-1.0, min(1.0, up / range_km)))
    elevation_deg = math.degrees(elevation_rad)

    # Azimuth angle clockwise from North
    azimuth_rad = math.atan2(east, north)
    azimuth_deg = (math.degrees(azimuth_rad) + 360.0) % 360.0

    return {
        "azimuth_deg": round(azimuth_deg, 2),
        "elevation_deg": round(elevation_deg, 2),
        "range_km": round(range_km, 2),
        "is_visible": elevation_deg > 0.0
    }
