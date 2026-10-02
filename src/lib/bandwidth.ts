import { addBandwidthSample, getBandwidthSamples, getSettings } from "./db";
import type { ConnectionSummary } from "./types";

export function getConnectionSummary(): ConnectionSummary {
  const settings = getSettings();
  const limit = Math.max(1, Number(settings.bandwidth_avg_samples) || 10);
  const samples = getBandwidthSamples(limit);

  if (samples.length === 0) {
    return {
      avgDownMbps: null,
      lastDownMbps: null,
      lastRttMs: null,
      sampleCount: 0,
      lastMeasuredAt: null,
    };
  }

  const avgDownMbps =
    samples.reduce((sum, s) => sum + s.down_mbps, 0) / samples.length;
  const last = samples[0];

  return {
    avgDownMbps: Math.round(avgDownMbps * 100) / 100,
    lastDownMbps: Math.round(last.down_mbps * 100) / 100,
    lastRttMs: last.rtt_ms != null ? Math.round(last.rtt_ms) : null,
    sampleCount: samples.length,
    lastMeasuredAt: last.measured_at,
  };
}

export function recordBandwidth(downMbps: number, rttMs: number | null) {
  return addBandwidthSample(downMbps, rttMs);
}

export function getPayloadSizeBytes(): number {
  const kb = Math.max(64, Number(getSettings().bandwidth_payload_kb) || 512);
  return kb * 1024;
}
