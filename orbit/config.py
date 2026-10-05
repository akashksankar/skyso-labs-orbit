import os
from pathlib import Path
from pydantic import BaseModel, Field

DEFAULT_ORBIT_DIR = Path.home() / ".orbit"
CONFIG_PATH = DEFAULT_ORBIT_DIR / "config.json"
CACHE_DIR = DEFAULT_ORBIT_DIR / "cache"
DB_PATH = DEFAULT_ORBIT_DIR / "orbit.db"

class ObserverConfig(BaseModel):
    name: str = "Primary Ground Station"
    latitude: float = 28.5721  # Cape Canaveral / Kennedy Space Center default
    longitude: float = -80.6480
    altitude_m: float = 10.0
    min_elevation_deg: float = 10.0

class OrbitConfig(BaseModel):
    version: str = "1.0.0"
    host: str = "127.0.0.1"
    port: int = 8000
    cache_ttl_hours: int = 24
    celestrak_base_url: str = "https://celestrak.org/NORAD/elements/gp.php"
    observer: ObserverConfig = Field(default_factory=ObserverConfig)
    auto_browser: bool = True
    offline_mode: bool = False

def ensure_orbit_dirs():
    """Ensure ~/.orbit and cache directories exist."""
    DEFAULT_ORBIT_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (DEFAULT_ORBIT_DIR / "logs").mkdir(parents=True, exist_ok=True)
    (DEFAULT_ORBIT_DIR / "exports").mkdir(parents=True, exist_ok=True)

def load_config() -> OrbitConfig:
    """Load configuration from ~/.orbit/config.json or create default."""
    ensure_orbit_dirs()
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return OrbitConfig.model_validate_json(f.read())
        except Exception:
            pass
    config = OrbitConfig()
    save_config(config)
    return config

def save_config(config: OrbitConfig):
    """Save configuration to ~/.orbit/config.json."""
    ensure_orbit_dirs()
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        f.write(config.model_dump_json(indent=2))
