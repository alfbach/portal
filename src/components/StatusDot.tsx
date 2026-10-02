"use client";

import { Label } from "@patternfly/react-core";
import type { HealthStatus } from "@/lib/types";

const STATUS_COLOR: Record<
  HealthStatus,
  "green" | "orange" | "red" | "grey"
> = {
  ok: "green",
  degraded: "orange",
  down: "red",
  unknown: "grey",
};

export function StatusDot({
  status,
  latencyMs,
}: {
  status: HealthStatus;
  latencyMs?: number | null;
}) {
  const label =
    latencyMs != null ? `${status} · ${latencyMs}ms` : status;

  return (
    <Label color={STATUS_COLOR[status] || "grey"} isCompact>
      {label}
    </Label>
  );
}
