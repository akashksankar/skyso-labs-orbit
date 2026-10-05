import math
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
import numpy as np
from sgp4.api import Satrec, WGS84

WGS84_A = 6378.137  # Earth equatorial radius in km
WGS84_F = 1.0 / 298.257223563  # Earth flattening factor
WGS84_B = WGS84_A * (1.0 - WGS84_F)
WGS84_E2 = (WGS84_A**2 - WGS84_B**2) / (WGS84_A**2)

def datetime_to_jd_fr(dt: datetime) -> Tuple[int, float]:
    """Convert UTC datetime to Julian Date (integer day + fraction)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
        
    year = dt.year
    month = dt.month
    day = dt.day
    hour = dt.hour
    minute = dt.minute
    second = dt.second + dt.microsecond / 1e6

    if month <= 2:
        year -= 1
        month += 12

    A = math.floor(year / 100)
    B = 2 - A + math.floor(A / 4)

    jd_day = math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day + B - 1524.5
    jd_fr = (hour + minute / 60.0 + second / 3600.0) / 24.0
    return int(jd_day), jd_fr

def gmst_from_jd(jd: float) -> float:
    """Calculate Greenwich Mean Sidereal Time in radians from Julian Date."""
    T = (jd - 2451545.0) / 36525.0
    # GMST in seconds of time
    gmst_sec = 67310.54841 + (876600.0 * 3600.0 + 8640184.812866) * T + 0.093104 * (T**2) - 6.2e-6 * (T**3)
    gmst_rad = (gmst_sec % 86400.0) / 240.0 * (math.pi / 180.0)
    return (gmst_rad + 2 * math.pi) % (2 * math.pi)

def teme_to_ecef(r_teme: Tuple[float, float, float], v_teme: Tuple[float, float, float], gmst: float):
    """Rotate TEME vector to ECEF frame using GMST angle."""
    cos_g = math.cos(gmst)
    sin_g = math.sin(gmst)

    # Position
    x_ecef = r_teme[0] * cos_g + r_teme[1] * sin_g
    y_ecef = -r_teme[0] * sin_g + r_teme[1] * cos_g
    z_ecef = r_teme[2]

    # Velocity: includes omega_earth x r
    omega_e = 7.292115e-5  # rad/s
    vx_ecef = (v_teme[0] * cos_g + v_teme[1] * sin_g) + omega_e * y_ecef
    vy_ecef = (-v_teme[0] * sin_g + v_teme[1] * cos_g) - omega_e * x_ecef
    vz_ecef = v_teme[2]

    return (x_ecef, y_ecef, z_ecef), (vx_ecef, vy_ecef, vz_ecef)

def ecef_to_geodetic(x: float, y: float, z: float) -> Tuple[float, float, float]:
    """Convert ECEF Cartesian coordinates (km) to Geodetic lat, lon (deg), and altitude (km) using Bowring's method."""
    lon = math.atan2(y, x)
    p = math.sqrt(x**2 + y**2)
    if p < 1e-6:
        lat = math.pi / 2.0 if z > 0 else -math.pi / 2.0
        alt = abs(z) - WGS84_B
        return math.degrees(lat), math.degrees(lon), alt

    theta = math.atan2(z * WGS84_A, p * WGS84_B)
    e_prime_2 = (WGS84_A**2 - WGS84_B**2) / (WGS84_B**2)
    lat = math.atan2(
        z + e_prime_2 * WGS84_B * (math.sin(theta)**3),
        p - WGS84_E2 * WGS84_A * (math.cos(theta)**3)
    )
    
    sin_lat = math.sin(lat)
    N = WGS84_A / math.sqrt(1.0 - WGS84_E2 * sin_lat**2)
    alt = p / math.cos(lat) - N

    lat_deg = math.degrees(lat)
    lon_deg = math.degrees(lon)
    # Normalize longitude to -180 to 180
    lon_deg = (lon_deg + 180.0) % 360.0 - 180.0
    return lat_deg, lon_deg, alt

class OrbitalEngine:
    @staticmethod
    def propagate_tle(line1: str, line2: str, target_time: datetime = None) -> Dict[str, Any]:
        """
        Propagate satellite orbit from Two-Line Element (TLE) to target UTC time using SGP4.
        Returns position (ECI, ECEF, Geodetic), velocity, and telemetry metadata.
        """
        if target_time is None:
            target_time = datetime.now(timezone.utc)
        elif target_time.tzinfo is None:
            target_time = target_time.replace(tzinfo=timezone.utc)

        sat = Satrec.twoline2rv(line1, line2)
        jd_day, jd_fr = datetime_to_jd_fr(target_time)
        
        error_code, r_teme, v_teme = sat.sgp4(jd_day, jd_fr)
        if error_code != 0:
            raise RuntimeError(f"SGP4 propagation error code {error_code}")

        jd_total = jd_day + jd_fr
        gmst = gmst_from_jd(jd_total)
        r_ecef, v_ecef = teme_to_ecef(r_teme, v_teme, gmst)
        lat, lon, alt = ecef_to_geodetic(r_ecef[0], r_ecef[1], r_ecef[2])

        speed = math.sqrt(v_teme[0]**2 + v_teme[1]**2 + v_teme[2]**2)

        return {
            "timestamp": target_time.isoformat(),
            "propagation_method": "SGP4",
            "coordinates": {
                "latitude_deg": round(lat, 4),
                "longitude_deg": round(lon, 4),
                "altitude_km": round(alt, 2),
                "speed_kms": round(speed, 3),
            },
            "eci": {
                "x_km": round(r_teme[0], 2),
                "y_km": round(r_teme[1], 2),
                "z_km": round(r_teme[2], 2),
                "vx_kms": round(v_teme[0], 4),
                "vy_kms": round(v_teme[1], 4),
                "vz_kms": round(v_teme[2], 4),
            },
            "ecef": {
                "x_km": round(r_ecef[0], 2),
                "y_km": round(r_ecef[1], 2),
                "z_km": round(r_ecef[2], 2),
            },
            "elements": {
                "inclination_deg": round(math.degrees(sat.inclo), 4),
                "eccentricity": round(sat.ecco, 7),
                "raan_deg": round(math.degrees(sat.nodeo), 4),
                "arg_perigee_deg": round(math.degrees(sat.argpo), 4),
                "mean_motion_rev_day": round(sat.no_kozai * 1440.0 / (2.0 * math.pi), 8),
                "period_min": round(2.0 * math.pi / sat.no_kozai, 2),
            }
        }
