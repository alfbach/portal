"use client";

import { useEffect, useState } from "react";

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
  const angle = -90 + (pct / 100) * 180;

  return (
    <div className="widget-card gauge-widget">
      <div className="widget-card__head">
        <h3>{title}</h3>
        <span className="widget-type">gauge</span>
      </div>
      <div className="gauge">
        <svg viewBox="0 0 120 70" className="gauge__svg">
          <path
            d="M10 60 A50 50 0 0 1 110 60"
            fill="none"
            stroke="rgba(61,255,154,0.15)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M10 60 A50 50 0 0 1 110 60"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 157} 157`}
            className="gauge__arc"
          />
          <line
            x1="60"
            y1="60"
            x2="60"
            y2="22"
            stroke="var(--fg)"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${angle} 60 60)`}
            className="gauge__needle"
          />
          <circle cx="60" cy="60" r="4" fill="var(--accent)" />
        </svg>
        <div className="gauge__value">
          {error ? (
            <span className="gauge__error">{error}</span>
          ) : value == null ? (
            <span className="gauge__loading">…</span>
          ) : (
            <>
              <strong>{Math.round(value * 10) / 10}</strong>
              <span>{unit || ""}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
