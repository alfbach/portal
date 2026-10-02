"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardTitle,
  CardBody,
  CardHeader,
  Button,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Content,
  Flex,
  FlexItem,
} from "@patternfly/react-core";
import { SyncAltIcon } from "@patternfly/react-icons";
import type { ConnectionSummary } from "@/lib/types";

type NavConnection = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
};

export function ConnectionPanel() {
  const [summary, setSummary] = useState<ConnectionSummary | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [nav, setNav] = useState<NavConnection | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/connection");
    if (res.ok) setSummary(await res.json());
  }, []);

  const measure = useCallback(async () => {
    setMeasuring(true);
    setLastError(null);
    try {
      const rttStart = performance.now();
      await fetch("/api/connection", { cache: "no-store" });
      const rttMs = performance.now() - rttStart;

      const start = performance.now();
      const res = await fetch(`/api/bandwidth/payload?t=${Date.now()}`, {
        cache: "no-store",
      });
      const buf = await res.arrayBuffer();
      const elapsedSec = (performance.now() - start) / 1000;
      const bits = buf.byteLength * 8;
      const downMbps = bits / elapsedSec / 1_000_000;

      await fetch("/api/bandwidth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downMbps, rttMs }),
      });
      await refresh();
    } catch {
      setLastError("Measurement failed");
    } finally {
      setMeasuring(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const conn = (navigator as Navigator & { connection?: NavConnection }).connection;
    if (conn) {
      setNav({
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData,
      });
    }
    const t = setTimeout(() => void measure(), 800);
    return () => clearTimeout(t);
  }, [measure, refresh]);

  return (
    <Card isFullHeight>
      <CardHeader
        actions={{
          actions: (
            <Button
              variant="link"
              icon={<SyncAltIcon />}
              onClick={() => void measure()}
              isDisabled={measuring}
              isInline
            >
              {measuring ? "Measuring…" : "Retest"}
            </Button>
          ),
        }}
      >
        <CardTitle>Uplink</CardTitle>
      </CardHeader>
      <CardBody>
        <DescriptionList isCompact isHorizontal horizontalTermWidthModifier={{ default: "mod-110" }}>
          <DescriptionListGroup>
            <DescriptionListTerm>Avg down</DescriptionListTerm>
            <DescriptionListDescription>
              <strong>
                {summary?.avgDownMbps != null ? summary.avgDownMbps : "—"}
              </strong>{" "}
              Mbit/s
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Last</DescriptionListTerm>
            <DescriptionListDescription>
              <strong>
                {summary?.lastDownMbps != null ? summary.lastDownMbps : "—"}
              </strong>{" "}
              Mbit/s
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>RTT</DescriptionListTerm>
            <DescriptionListDescription>
              <strong>{summary?.lastRttMs != null ? summary.lastRttMs : "—"}</strong> ms
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Samples</DescriptionListTerm>
            <DescriptionListDescription>
              {summary?.sampleCount ?? 0}
            </DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>

        <Flex direction={{ default: "column" }} className="pf-v6-u-mt-md">
          {nav && (
            <FlexItem>
              <Content component="small">
                Browser: {nav.effectiveType || "n/a"}
                {nav.downlink != null ? ` · est ${nav.downlink} Mbit/s` : ""}
                {nav.rtt != null ? ` · rtt ${nav.rtt}ms` : ""}
                {nav.saveData ? " · save-data" : ""}
              </Content>
            </FlexItem>
          )}
          {summary?.lastMeasuredAt && (
            <FlexItem>
              <Content component="small">
                Last measure {new Date(summary.lastMeasuredAt).toLocaleTimeString()}
              </Content>
            </FlexItem>
          )}
          {lastError && (
            <FlexItem>
              <Content component="small">
                <span style={{ color: "var(--pf-t--global--color--status--danger--default)" }}>
                  {lastError}
                </span>
              </Content>
            </FlexItem>
          )}
        </Flex>
      </CardBody>
    </Card>
  );
}
