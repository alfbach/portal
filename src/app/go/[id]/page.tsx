"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Bullseye,
  EmptyState,
  EmptyStateBody,
  Spinner,
  Button,
} from "@patternfly/react-core";

type LaunchInfo = {
  title: string;
  url: string;
  targetUrl: string;
  hasAuth: boolean;
  username: string | null;
};

export default function GoPage() {
  const params = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<LaunchInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`/api/links/${params.id}/launch`);
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data.error || "Launch failed");
          return;
        }
        if (cancelled) return;
        setInfo(data);

        // Open destination in this window (already a separate tab via window.open)
        // Prefer credentialed URL when basic auth is configured.
        window.location.replace(data.targetUrl);

        // Some browsers strip userinfo from URLs; fall back to plain URL shortly after.
        if (data.hasAuth) {
          window.setTimeout(() => {
            if (document.visibilityState !== "hidden") {
              window.location.replace(data.url);
            }
          }, 1200);
        }
      } catch {
        if (!cancelled) setError("Could not open link");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (error) {
    return (
      <Bullseye style={{ minHeight: "60vh" }}>
        <EmptyState titleText="Unable to open link" headingLevel="h2">
          <EmptyStateBody>{error}</EmptyStateBody>
          <Button variant="primary" component="a" href="/">
            Back to portal
          </Button>
        </EmptyState>
      </Bullseye>
    );
  }

  return (
    <Bullseye style={{ minHeight: "60vh" }}>
      <EmptyState
        titleText={info ? `Opening ${info.title}…` : "Opening link…"}
        headingLevel="h2"
        icon={Spinner}
      >
        <EmptyStateBody>
          {info?.hasAuth
            ? "Sending stored credentials and opening in this window."
            : "Redirecting to the target page."}
        </EmptyStateBody>
      </EmptyState>
    </Bullseye>
  );
}
