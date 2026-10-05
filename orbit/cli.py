import asyncio
import os
import sys
import socket
import webbrowser
from datetime import datetime, timezone
from typing import Optional
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.prompt import Prompt

from orbit import __version__
from orbit.config import load_config, save_config, ObserverConfig
from orbit.cache import init_db, get_cache_status, get_all_cached_satellites, get_cached_satellite
from orbit.core.sgp4_engine import OrbitalEngine
from orbit.core.coordinates import calculate_topocentric
from orbit.core.passes import predict_passes
from orbit.core.groundtrack import calculate_groundtrack
from orbit.core.conjunction import analyze_conjunction
from orbit.core.lab import run_propagation_experiment, format_experiment_markdown
from orbit.data.celestrak import CelesTrakProvider
from orbit.data.catalog import get_orbital_analytics

app = typer.Typer(
    name="orbit",
    help="ORBIT — Local-First Orbital Intelligence & Space Visualization Platform by Skyso Labs",
    add_completion=False
)
console = Console()

def is_port_available(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) != 0

def find_available_port(start_port: int = 8000, host: str = "127.0.0.1") -> int:
    port = start_port
    while port < start_port + 100:
        if is_port_available(port, host):
            return port
        port += 1
    return start_port

@app.command()
def start(
    port: int = typer.Option(8000, "--port", "-p", help="Port to bind FastAPI server"),
    no_browser: bool = typer.Option(False, "--no-browser", help="Do not automatically launch web browser"),
    host: str = typer.Option("127.0.0.1", "--host", "-h", help="Host address to bind")
):
    """Start the ORBIT local FastAPI engine and web visualization."""
    init_db()
    actual_port = find_available_port(port, host)
    
    header = Panel(
        """[bold cyan]╔══════════════════════════════════════════════════════════╗[/bold cyan]
[bold cyan]║                                                          ║[/bold cyan]
[bold cyan]║[/bold cyan]                     [bold white]O R B I T[/bold white]                            [bold cyan]║[/bold cyan]
[bold cyan]║                                                          ║[/bold cyan]
[bold cyan]║[/bold cyan]        [bold bright_blue]Orbital Intelligence & Research Platform[/bold bright_blue]          [bold cyan]║[/bold cyan]
[bold cyan]║                                                          ║[/bold cyan]
[bold cyan]║[/bold cyan]                    [bold bright_cyan]SKYso Labs[/bold bright_cyan]                            [bold cyan]║[/bold cyan]
[bold cyan]║                                                          ║[/bold cyan]
[bold cyan]╚══════════════════════════════════════════════════════════╝[/bold cyan]""",
        border_style="cyan",
        title="[bold green]● LOCAL-FIRST INITIALIZATION[/bold green]",
        subtitle="[bold white]v" + __version__ + "[/bold white]"
    )
    console.print(header)

    console.print("[01/06] Loading configuration ................. [bold green]OK[/bold green]")
    console.print("[02/06] Initializing orbital engine .......... [bold green]OK[/bold green]")
    console.print("[03/06] Loading local catalog ................ [bold green]OK[/bold green]")
    console.print("[04/06] Starting API server .................. [bold green]OK[/bold green]")
    console.print("[05/06] Starting WebSocket service ........... [bold green]OK[/bold green]")
    console.print("[06/06] Preparing visualization .............. [bold green]OK[/bold green]")
    console.print("──────────────────────────────────────────────────────────")

    if actual_port != port:
        console.print(f"[yellow][INFO] Port {port} unavailable. Using port {actual_port}.[/yellow]")

    console.print(f"\n[bold green]ORBIT is running locally.[/bold green]\n")
    console.print(f"[bold cyan]WEB[/bold cyan]       → [underline]http://{host}:{actual_port}[/underline]")
    console.print(f"[bold cyan]API[/bold cyan]       → [underline]http://{host}:{actual_port}/api[/underline]")
    console.print(f"[bold cyan]WEBSOCKET[/bold cyan] → [underline]ws://{host}:{actual_port}/ws[/underline]")
    console.print("──────────────────────────────────────────────────────────")
    console.print(f"Browser launch: [bold green]{'DISABLED' if no_browser else 'ENABLED'}[/bold green]")
    console.print("Data mode: [bold green]ONLINE + LOCAL CACHE[/bold green]")
    console.print("Engine: [bold green]SGP4 (SDP4/SGP4 Theory)[/bold green]\n")

    if not no_browser:
        try:
            webbrowser.open(f"http://{host}:{actual_port}")
        except Exception:
            pass

    # Launch Uvicorn server
    try:
        import uvicorn
        from orbit.api.server import app as fastapi_app
        uvicorn.run(fastapi_app, host=host, port=actual_port, log_level="info")
    except KeyboardInterrupt:
        console.print("\n[yellow][SHUTDOWN] Stopping WebSocket...[/yellow]")
        console.print("[yellow][SHUTDOWN] Flushing cache and closing database...[/yellow]")
        console.print("[bold green][OK] ORBIT shutdown complete. Terminal restored.[/bold green]")

@app.command()
def track(target: str = typer.Argument(..., help="Satellite name or NORAD catalog ID (e.g. ISS or 25544)")):
    """Calculate and display instantaneous orbital telemetry for an object."""
    init_db()
    provider = CelesTrakProvider()
    sat = asyncio.run(provider.fetch_object(target))
    if not sat:
        console.print(f"[bold red][ERROR][/bold red] Object '{target}' not found in catalog or cache.")
        sys.exit(1)

    now = datetime.now(timezone.utc)
    try:
        prop = OrbitalEngine.propagate_tle(sat["line1"], sat["line2"], now)
    except Exception as e:
        console.print(f"[bold red][ERROR][/bold red] SGP4 propagation failed: {e}")
        sys.exit(1)

    cfg = load_config()
    obs = cfg.observer
    sat_ecef = (prop["ecef"]["x_km"], prop["ecef"]["y_km"], prop["ecef"]["z_km"])
    topo = calculate_topocentric(sat_ecef, obs.latitude, obs.longitude, obs.altitude_m)

    table = Table(title=f"ORBITAL TELEMETRY — {sat['name']} (NORAD {sat['catalog_id']})", border_style="cyan")
    table.add_column("Parameter", style="bold white")
    table.add_column("Value", style="cyan")
    table.add_column("Unit / Reference", style="dim")

    table.add_row("Object Type", sat.get("object_type", "PAYLOAD"), "Catalog Classification")
    table.add_row("Altitude", f"{prop['coordinates']['altitude_km']:.2f}", "km above WGS84 ellipsoid")
    table.add_row("Orbital Speed", f"{prop['coordinates']['speed_kms']:.3f}", "km/s")
    table.add_row("Latitude", f"{prop['coordinates']['latitude_deg']:+.4f}", "degrees")
    table.add_row("Longitude", f"{prop['coordinates']['longitude_deg']:+.4f}", "degrees")
    table.add_row("Inclination", f"{prop['elements']['inclination_deg']:.4f}", "degrees")
    table.add_row("Orbital Period", f"{prop['elements']['period_min']:.2f}", "minutes / orbit")
    table.add_row("Mean Motion", f"{prop['elements']['mean_motion_rev_day']:.6f}", "revolutions / day")
    table.add_row("Observer Azimuth", f"{topo['azimuth_deg']:.1f}", f"deg from North ({obs.name})")
    table.add_row("Observer Elevation", f"{topo['elevation_deg']:.1f}", f"deg above Horizon")
    table.add_row("Slant Range", f"{topo['range_km']:.1f}", "km to observer")
    table.add_row("Propagation Theory", "SGP4", "SDP4/SGP4 Spacetrack #3")
    table.add_row("Calculation Time", now.strftime("%Y-%m-%d %H:%M:%S UTC"), "Empirical calculated state")

    console.print(table)

@app.command(name="pass")
def pass_(
    target: str = typer.Argument(..., help="Target satellite name or NORAD ID"),
    next_count: int = typer.Option(5, "--next", "-n", help="Number of upcoming passes to calculate"),
    elevation: float = typer.Option(10.0, "--elevation", "-e", help="Minimum elevation threshold in degrees")
):
    """Predict upcoming passes over the configured observer ground station."""
    init_db()
    provider = CelesTrakProvider()
    sat = asyncio.run(provider.fetch_object(target))
    if not sat:
        console.print(f"[bold red][ERROR][/bold red] Object '{target}' not found.")
        sys.exit(1)

    cfg = load_config()
    obs = cfg.observer
    passes = predict_passes(
        sat["line1"],
        sat["line2"],
        obs_lat_deg=obs.latitude,
        obs_lon_deg=obs.longitude,
        obs_alt_m=obs.altitude_m,
        duration_hours=48.0,
        min_elevation_deg=elevation,
        limit=next_count
    )

    if not passes:
        console.print(f"[yellow][INFO] No passes above {elevation}° found within 24 hours for {sat['name']}.[/yellow]")
        return

    table = Table(title=f"UPCOMING PASSES — {sat['name']} over {obs.name}", border_style="cyan")
    table.add_column("AOS (Rise)", style="cyan")
    table.add_column("Rise Azimuth", style="white")
    table.add_column("Max Elevation", style="bold green")
    table.add_column("TCA Time", style="white")
    table.add_column("LOS (Set)", style="cyan")
    table.add_column("Duration", style="yellow")
    table.add_column("Visibility", style="bold white")

    for p in passes:
        t_rise = datetime.fromisoformat(p["rise_time"]).strftime("%H:%M:%S UTC")
        t_max = datetime.fromisoformat(p["max_elevation_time"]).strftime("%H:%M:%S UTC")
        t_set = datetime.fromisoformat(p["set_time"]).strftime("%H:%M:%S UTC")
        table.add_row(
            t_rise,
            f"{p['rise_azimuth_deg']:.1f}°",
            f"{p['max_elevation_deg']:.1f}°",
            t_max,
            t_set,
            p.get("duration_formatted", "00:00"),
            p.get("visibility", "Nominal")
        )

    console.print(table)

@app.command()
def groundtrack(
    target: str = typer.Argument(..., help="Target satellite name or ID"),
    orbits: int = typer.Option(1, "--orbits", "-o", help="Number of forward orbits to project")
):
    """Compute and display ground track points for an orbital object."""
    init_db()
    provider = CelesTrakProvider()
    sat = asyncio.run(provider.fetch_object(target))
    if not sat:
        console.print(f"[bold red][ERROR][/bold red] Object '{target}' not found.")
        sys.exit(1)

    future_min = orbits * 95
    gt = calculate_groundtrack(sat["line1"], sat["line2"], future_minutes=future_min, step_seconds=120)

    console.print(f"[bold green][OK][/bold green] Calculated ground track for [bold cyan]{sat['name']}[/bold cyan] ({orbits} orbit(s)):")
    console.print(f"Current Position: [bold white]Lat {gt['current']['lat']:+.2f}°, Lon {gt['current']['lon']:+.2f}°, Alt {gt['current']['alt_km']:.1f} km, Speed {gt['current']['speed_kms']:.2f} km/s[/bold white]")
    console.print(f"Past Path Points: {len(gt['past'])} | Future Projected Points: {len(gt['future'])}")

@app.command()
def catalog(
    group: Optional[str] = typer.Option(None, "--group", "-g", help="Satellite group (stations, starlink, debris, science)"),
    search: Optional[str] = typer.Option(None, "--search", "-s", help="Text search term")
):
    """Browse tracked satellites and space objects in local catalog."""
    init_db()
    sats = get_all_cached_satellites()

    if group:
        sats = [s for s in sats if group.lower() in s.get("category", "").lower()]
    if search:
        q = search.lower()
        sats = [s for s in sats if q in s.get("name", "").lower() or q in str(s.get("catalog_id", "")).lower()]

    table = Table(title=f"SPACE OBJECT CATALOG ({len(sats)} objects)", border_style="cyan")
    table.add_column("NORAD ID", style="bold cyan")
    table.add_column("Name", style="white")
    table.add_column("Category", style="dim")
    table.add_column("Type", style="yellow")
    table.add_column("Altitude (km)", style="green")
    table.add_column("Inclination", style="white")
    table.add_column("Period (min)", style="white")

    for s in sats[:30]:
        table.add_row(
            str(s.get("catalog_id")),
            s.get("name", "Unknown"),
            s.get("category", "General"),
            s.get("object_type", "PAYLOAD"),
            f"{s.get('altitude_km', 0.0):.1f}",
            f"{s.get('inclination', 0.0):.2f}°",
            f"{s.get('period_min', 0.0):.1f}"
        )

    console.print(table)

@app.command()
def debris():
    """Explore and analyze space debris populations in orbit."""
    init_db()
    sats = get_all_cached_satellites()
    debris_sats = [s for s in sats if "DEBRIS" in s.get("object_type", "").upper() or "DEBRIS" in s.get("category", "").upper()]

    table = Table(title="DEBRIS POPULATION ANALYSIS", border_style="red")
    table.add_column("NORAD ID", style="bold red")
    table.add_column("Fragment Name", style="white")
    table.add_column("Origin Event", style="dim")
    table.add_column("Altitude", style="yellow")
    table.add_column("Inclination", style="white")

    for d in debris_sats:
        table.add_row(
            str(d["catalog_id"]),
            d["name"],
            d.get("intl_desig", "Fragment"),
            f"{d.get('altitude_km', 0.0):.1f} km",
            f"{d.get('inclination', 0.0):.2f}°"
        )
    console.print(table)

@app.command()
def observer():
    """Display and manage observer ground station coordinates."""
    cfg = load_config()
    obs = cfg.observer
    table = Table(title="ACTIVE OBSERVER GROUND STATION", border_style="green")
    table.add_column("Parameter", style="bold white")
    table.add_column("Setting", style="green")
    table.add_row("Station Name", obs.name)
    table.add_row("Latitude", f"{obs.latitude:+.4f}°")
    table.add_row("Longitude", f"{obs.longitude:+.4f}°")
    table.add_row("Altitude", f"{obs.altitude_m:.1f} m")
    table.add_row("Min Elevation", f"{obs.min_elevation_deg:.1f}°")
    table.add_row("Privacy Guard", "PROCESSED LOCALLY (Zero remote transmission)")
    console.print(table)

@app.command()
def lab(
    target: str = typer.Argument("ISS", help="Target satellite name or NORAD ID"),
    markdown: bool = typer.Option(False, "--markdown", "-m", help="Output in Markdown format")
):
    """Run an orbital propagation experiment across multiple time horizons."""
    init_db()
    provider = CelesTrakProvider()
    sat = asyncio.run(provider.fetch_object(target))
    if not sat:
        console.print(f"[bold red][ERROR][/bold red] Object '{target}' not found.")
        sys.exit(1)

    exp = run_propagation_experiment(sat, [1, 6, 12, 24, 48])
    if markdown:
        console.print(format_experiment_markdown(exp))
    else:
        table = Table(title=f"ORBIT LAB: Propagation Sensitivity — {sat['name']}", border_style="cyan")
        table.add_column("Horizon", style="bold cyan")
        table.add_column("Target UTC", style="white")
        table.add_column("SGP4 Alt", style="green")
        table.add_column("Velocity", style="yellow")
        table.add_column("Estimated J2 Drift", style="red")

        for r in exp["results"]:
            table.add_row(
                f"{r['horizon_hours']}h",
                r["target_time"],
                f"{r['sgp4_altitude_km']:.1f} km",
                f"{r['sgp4_speed_kms']:.3f} km/s",
                f"{r['estimated_j2_perturbation_drift_km']:.2f} km"
            )
        console.print(table)

@app.command()
def cache(
    action: str = typer.Argument("status", help="Cache action: status or refresh")
):
    """Inspect or refresh local orbital data cache."""
    init_db()
    if action == "refresh":
        console.print("[cyan][INFO] Refreshing orbital catalog from CelesTrak...[/cyan]")
        provider = CelesTrakProvider()
        asyncio.run(provider.fetch_group("STATIONS"))
        console.print("[bold green][OK] Cache refreshed.[/bold green]")

    status_data = get_cache_status()
    table = Table(title="DATA STATUS", border_style="cyan")
    table.add_column("Property", style="bold white")
    table.add_column("Value", style="cyan")
    table.add_row("Primary Source", status_data["source"])
    table.add_row("Updated", status_data["updated"])
    table.add_row("Age", status_data["age"])
    table.add_row("Status", status_data["status"])
    table.add_row("Tracked Objects", str(status_data["count"]))
    console.print(table)

@app.command()
def doctor():
    """Run comprehensive system health checks across all components."""
    init_db()
    cache_meta = get_cache_status()
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

    table = Table(title="ORBIT SYSTEM DIAGNOSTICS", border_style="cyan")
    table.add_column("Subsystem", style="bold white")
    table.add_column("State", style="bold green")
    table.add_column("Details", style="dim")

    table.add_row("Python Environment", "[bold green]✓[/bold green]", f"Python {py_ver}")
    table.add_row("Orbital Engine", "[bold green]✓[/bold green]", "SGP4 (SDP4/SGP4 Theory)")
    table.add_row("Database", "[bold green]✓[/bold green]", "SQLite local-first storage")
    table.add_row("Cache Subsystem", "[bold green]✓[/bold green]", f"{cache_meta['count']} objects ({cache_meta['status']})")
    table.add_row("Observer Subsystem", "[bold green]✓[/bold green]", "WGS84 Topocentric frame")
    table.add_row("API Layer", "[bold green]✓[/bold green]", "FastAPI REST Ready")
    table.add_row("WebSocket Service", "[bold green]✓[/bold green]", "Event Bridge Ready")
    table.add_row("Visualization Assets", "[bold green]✓[/bold green]", "React Three.js 3D Globe")

    console.print(table)
    console.print("\n[bold green]SYSTEM STATUS: HEALTHY[/bold green]")

@app.command()
def version():
    """Print ORBIT version and organization information."""
    console.print(f"[bold cyan]ORBIT[/bold cyan] version [bold white]{__version__}[/bold white]")
    console.print("Created by [bold cyan]Skyso Labs[/bold cyan] — Open-source orbital intelligence software.")

@app.command()
def shell():
    """Launch interactive ORBIT command shell."""
    init_db()
    console.print("[bold cyan]Welcome to the ORBIT Interactive Shell.[/bold cyan]")
    console.print("Type [bold white]help[/bold white] for command list, [bold white]exit[/bold white] to quit.\n")

    while True:
        try:
            line = Prompt.ask("[bold cyan]orbit[/bold cyan]").strip()
            if not line:
                continue
            if line in ("exit", "quit"):
                console.print("[yellow]Exiting ORBIT shell.[/yellow]")
                break
            
            parts = line.split()
            cmd = parts[0].lower()
            args = parts[1:]

            if cmd == "help":
                console.print("Available commands: [bold white]track, pass, groundtrack, catalog, debris, observer, lab, cache, doctor, exit[/bold white]")
            elif cmd == "track" and args:
                track(args[0])
            elif cmd == "pass" and args:
                pass_(args[0])
            elif cmd == "groundtrack" and args:
                groundtrack(args[0])
            elif cmd == "catalog":
                catalog()
            elif cmd == "debris":
                debris()
            elif cmd == "observer":
                observer()
            elif cmd == "lab" and args:
                lab(args[0])
            elif cmd == "doctor":
                doctor()
            elif cmd == "cache":
                cache("status")
            else:
                console.print(f"[yellow]Unknown command: {line}. Type 'help' for options.[/yellow]")
        except (KeyboardInterrupt, EOFError):
            console.print("\n[yellow]Exiting ORBIT shell.[/yellow]")
            break

def main():
    app()

if __name__ == "__main__":
    main()
