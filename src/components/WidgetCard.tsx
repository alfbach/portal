"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardTitle,
  CardBody,
  CardHeader,
  Label,
  Content,
  Button,
  Progress,
  ProgressSize,
  Flex,
  FlexItem,
} from "@patternfly/react-core";
import type { Widget } from "@/lib/types";

export function GaugeWidget({
  widgetId,
  title,
  unit,
  min = 0,
  max = 100,
}: {
  widgetId: number;
  title: string;
  unit?: string;
  min?: number;
  max?: number;
}) {
  const [value, setValue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/proxy-metric?widgetId=${widgetId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "error");
          return;
        }
        const n = typeof data.value === "number" ? data.value : Number(data.value);
        setValue(Number.isFinite(n) ? n : null);
        setError(null);
      } catch {
        if (!cancelled) setError("fetch failed");
      }
    }
    load();
    const t = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [widgetId]);

  const clamped = value == null ? 0 : Math.min(max, Math.max(min, value));
  const pct = ((clamped - min) / (max - min || 1)) * 100;

  return (
    <Card isFullHeight>
      <CardHeader
        actions={{
          actions: (
            <Label isCompact color="red">
              gauge
            </Label>
          ),
        }}
      >
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        {error ? (
          <Content>{error}</Content>
        ) : (
          <Flex direction={{ default: "column" }} spaceItems={{ default: "spaceItemsMd" }}>
            <FlexItem>
              <div className="portal-gauge-value">
                {value == null ? "…" : `${Math.round(value * 10) / 10}${unit || ""}`}
              </div>
            </FlexItem>
            <FlexItem>
              <Progress
                value={pct}
                title={`${title} utilization`}
                size={ProgressSize.lg}
                measureLocation="outside"
                label={`${Math.round(pct)}%`}
              />
            </FlexItem>
          </Flex>
        )}
      </CardBody>
    </Card>
  );
}

function MetricTextWidget({ widget }: { widget: Widget }) {
  const [display, setDisplay] = useState<string>("…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/proxy-metric?widgetId=${widget.id}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "error");
          return;
        }
        setDisplay(data.display ?? String(data.value ?? ""));
        setError(null);
      } catch {
        if (!cancelled) setError("fetch failed");
      }
    }
    load();
    const t = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [widget.id]);

  return (
    <Card isFullHeight>
      <CardHeader
        actions={{
          actions: <Label isCompact>metric</Label>,
        }}
      >
        <CardTitle>{widget.title}</CardTitle>
      </CardHeader>
      <CardBody>
        <Content>
          <strong style={{ color: "var(--pf-t--global--color--brand--default)" }}>
            {error ? error : display}
          </strong>
        </Content>
      </CardBody>
    </Card>
  );
}

function IframeWidget({ widget }: { widget: Widget }) {
  let url = "";
  let height = 220;
  try {
    const cfg = JSON.parse(widget.config_json);
    url = cfg.url || "";
    height = cfg.height || 220;
  } catch {
    /* ignore */
  }

  return (
    <Card isFullHeight>
      <CardHeader
        actions={{
          actions: <Label isCompact>iframe</Label>,
        }}
      >
        <CardTitle>{widget.title}</CardTitle>
      </CardHeader>
      <CardBody>
        {url ? (
          <div className="portal-iframe-wrap" style={{ height }}>
            <iframe
              src={url}
              title={widget.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{ height: "calc(100% - 36px)" }}
            />
            <Button
              variant="link"
              component="a"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              isInline
              className="pf-v6-u-m-sm"
            >
              Open in new tab
            </Button>
          </div>
        ) : (
          <Content>No URL configured</Content>
        )}
      </CardBody>
    </Card>
  );
}

function HtmlWidget({ widget }: { widget: Widget }) {
  let html = "";
  try {
    html = JSON.parse(widget.config_json).html || "";
  } catch {
    /* ignore */
  }
  const safe = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");

  return (
    <Card isFullHeight>
      <CardHeader
        actions={{
          actions: <Label isCompact>html</Label>,
        }}
      >
        <CardTitle>{widget.title}</CardTitle>
      </CardHeader>
      <CardBody>
        <div dangerouslySetInnerHTML={{ __html: safe }} />
      </CardBody>
    </Card>
  );
}

export function WidgetCard({ widget }: { widget: Widget; index?: number }) {
  let gaugeUnit = "";
  let gaugeMin = 0;
  let gaugeMax = 100;
  if (widget.type === "gauge") {
    try {
      const cfg = JSON.parse(widget.config_json);
      gaugeUnit = cfg.unit || "";
      gaugeMin = cfg.min ?? 0;
      gaugeMax = cfg.max ?? 100;
    } catch {
      /* ignore */
    }
  }

  if (widget.type === "gauge") {
    return (
      <GaugeWidget
        widgetId={widget.id}
        title={widget.title}
        unit={gaugeUnit}
        min={gaugeMin}
        max={gaugeMax}
      />
    );
  }
  if (widget.type === "metric_text") return <MetricTextWidget widget={widget} />;
  if (widget.type === "iframe") return <IframeWidget widget={widget} />;
  if (widget.type === "html_fragment") return <HtmlWidget widget={widget} />;
  return null;
}
