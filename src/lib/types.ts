export type HealthStatus = "ok" | "degraded" | "down" | "unknown";

export type WidgetType = "iframe" | "gauge" | "metric_text" | "html_fragment";

export interface Link {
  id: number;
  title: string;
  url: string;
  description: string | null;
  icon_url: string | null;
  preview_url: string | null;
  sort_order: number;
  enabled: number;
  health_check_url: string | null;
  group_id: number | null;
  auth_username: string | null;
  auth_password: string | null;
  last_status: HealthStatus;
  last_latency_ms: number | null;
  last_checked_at: string | null;
}

export interface LinkGroup {
  id: number;
  name: string;
  sort_order: number;
  enabled: number;
}

export interface Widget {
  id: number;
  link_id: number | null;
  type: WidgetType;
  title: string;
  config_json: string;
  sort_order: number;
  enabled: number;
}

export interface GaugeConfig {
  url: string;
  jsonPath: string;
  unit?: string;
  min?: number;
  max?: number;
}

export interface IframeConfig {
  url: string;
  height?: number;
}

export interface MetricTextConfig {
  url: string;
  jsonPath: string;
  prefix?: string;
  suffix?: string;
}

export interface HtmlFragmentConfig {
  html: string;
}

export interface SettingsMap {
  portal_title: string;
  theme_accent: string;
  health_interval_sec: string;
  bandwidth_payload_kb: string;
  bandwidth_avg_samples: string;
}

export interface BandwidthSample {
  id: number;
  down_mbps: number;
  rtt_ms: number | null;
  measured_at: string;
}

export interface ConnectionSummary {
  avgDownMbps: number | null;
  lastDownMbps: number | null;
  lastRttMs: number | null;
  sampleCount: number;
  lastMeasuredAt: string | null;
}
