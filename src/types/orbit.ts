export interface Satellite {
  catalog_id: string;
  name: string;
  intl_desig?: string;
  object_type: 'PAYLOAD' | 'ROCKET BODY' | 'DEBRIS' | 'UNKNOWN';
  category: string;
  epoch: string;
  line1: string;
  line2: string;
  inclination: number;
  eccentricity: number;
  mean_motion: number;
  period_min: number;
  altitude_km: number;
  source: string;
  description?: string;
}

export interface TelemetryCoordinates {
  latitude_deg: number;
  longitude_deg: number;
  altitude_km: number;
  speed_kms: number;
}

export interface ObserverView {
  azimuth_deg: number;
  elevation_deg: number;
  range_km: number;
  is_visible: boolean;
}

export interface LiveTelemetry {
  timestamp: string;
  propagation_method: string;
  coordinates: TelemetryCoordinates;
  eci: {
    x_km: number;
    y_km: number;
    z_km: number;
  };
  observer_view: ObserverView;
  elements: {
    inclination_deg: number;
    eccentricity: number;
    mean_motion_rev_day: number;
    period_min: number;
  };
}

export interface ObserverConfig {
  name: string;
  latitude: number;
  longitude: number;
  altitude_m: number;
  min_elevation_deg: number;
}

export interface PassItem {
  rise_time: string;
  rise_azimuth_deg: number;
  max_elevation_deg: number;
  max_elevation_time: string;
  set_time: string;
  set_azimuth_deg: number;
  duration_sec: number;
  duration_formatted: string;
  visibility: string;
}

export interface GroundTrackPoint {
  timestamp: string;
  lat: number;
  lon: number;
  alt_km: number;
}

export interface GroundTrackData {
  period_min: number;
  current: GroundTrackPoint & { speed_kms: number };
  past: GroundTrackPoint[];
  future: GroundTrackPoint[];
}

export interface ConjunctionResult {
  disclaimer: string;
  confidence: string;
  object_a: { catalog_id: string; name: string; object_type: string };
  object_b: { catalog_id: string; name: string; object_type: string };
  time_of_closest_approach_utc: string;
  minimum_separation_km: number;
  relative_velocity_kms: number;
  risk_level: string;
  analysis_window_hours: number;
}

export interface PropagationHorizon {
  horizon_hours: number;
  target_time: string;
  sgp4_altitude_km: number;
  sgp4_speed_kms: number;
  estimated_j2_perturbation_drift_km: number;
  semi_major_axis_km: number;
}

export interface PropagationExperimentResult {
  experiment_name: string;
  satellite: { name: string; catalog_id: string; object_type: string };
  engine: string;
  reference_epoch: string;
  initial_altitude_km: number;
  horizons_analyzed: number[];
  results: PropagationHorizon[];
}

export interface AnalyticsData {
  total_tracked: number;
  regimes: { LEO: number; MEO: number; GEO: number; HEO: number };
  object_types: { PAYLOAD: number; ROCKET_BODY: number; DEBRIS: number; UNKNOWN: number };
  categories: Record<string, number>;
  altitude_distribution: { range: string; count: number }[];
  inclination_distribution: { range: string; count: number }[];
}

export interface SystemStatusData {
  local: string;
  data: string;
  engine: string;
  cache: {
    source: string;
    updated: string;
    age: string;
    status: string;
    count: number;
  };
  observer: ObserverConfig;
  active_clients: number;
  timestamp: string;
}
