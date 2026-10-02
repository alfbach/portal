import { NextRequest, NextResponse } from "next/server";
import { getWidget } from "@/lib/db";
import { fetchMetricValue, toNumber } from "@/lib/metrics";
import { jsonError } from "@/lib/api";
import type { GaugeConfig, MetricTextConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const widgetId = Number(req.nextUrl.searchParams.get("widgetId"));
  if (!Number.isFinite(widgetId)) {
    return jsonError("widgetId is required");
  }

  const widget = getWidget(widgetId);
  if (!widget || !widget.enabled) {
    return jsonError("Widget not found", 404);
  }

  if (widget.type !== "gauge" && widget.type !== "metric_text") {
    return jsonError("Widget type does not support metrics");
  }

  let config: GaugeConfig & MetricTextConfig & { demoValue?: number };
  try {
    config = JSON.parse(widget.config_json);
  } catch {
    return jsonError("Invalid widget config");
  }

  if (typeof config.demoValue === "number") {
    return NextResponse.json({
      value: config.demoValue,
      display: String(config.demoValue),
      unit: config.unit ?? "",
      min: config.min ?? 0,
      max: config.max ?? 100,
      demo: true,
    });
  }

  if (!config.url) {
    return jsonError("Widget config missing url");
  }

  const result = await fetchMetricValue(config.url, config.jsonPath || ".");
  if (result.error) {
    return NextResponse.json(
      { value: null, error: result.error, unit: config.unit ?? "" },
      { status: 502 }
    );
  }

  const numeric = toNumber(result.value);
  const display =
    widget.type === "metric_text"
      ? `${config.prefix ?? ""}${String(result.value ?? "")}${config.suffix ?? ""}`
      : String(result.value ?? "");

  return NextResponse.json({
    value: numeric ?? result.value,
    display,
    unit: config.unit ?? "",
    min: config.min ?? 0,
    max: config.max ?? 100,
  });
}
