"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Grid,
  GridItem,
  Title,
  Content,
  Flex,
  FlexItem,
  Divider,
  EmptyState,
  EmptyStateBody,
} from "@patternfly/react-core";
import type { Link, LinkGroup, Widget } from "@/lib/types";
import { LinkCard } from "./LinkCard";
import { WidgetCard } from "./WidgetCard";
import { ConnectionPanel } from "./ConnectionPanel";
import { AppShell, SectionHeader, type MenuSelection } from "./AppShell";

export function PortalClient({
  initialLinks,
  initialWidgets,
  initialGroups,
  portalTitle,
}: {
  initialLinks: Link[];
  initialWidgets: Widget[];
  initialGroups: LinkGroup[];
  portalTitle: string;
  accent?: string;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [groups, setGroups] = useState(initialGroups);
  const [widgets] = useState(initialWidgets);
  const [activeMenu, setActiveMenu] = useState<MenuSelection>("all");

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const [linksRes, groupsRes] = await Promise.all([
          fetch("/api/links"),
          fetch("/api/groups"),
        ]);
        if (linksRes.ok) {
          const all = (await linksRes.json()) as Link[];
          setLinks(all.filter((l) => l.enabled));
        }
        if (groupsRes.ok) {
          const allGroups = (await groupsRes.json()) as LinkGroup[];
          setGroups(allGroups.filter((g) => g.enabled));
        }
      } catch {
        /* ignore */
      }
    }, 15000);
    return () => clearInterval(t);
  }, []);

  const filteredLinks = useMemo(() => {
    if (activeMenu === "all") return links;
    if (activeMenu === "ungrouped") return links.filter((l) => l.group_id == null);
    return links.filter((l) => l.group_id === activeMenu);
  }, [links, activeMenu]);

  const sectionTitle =
    activeMenu === "all"
      ? "All links"
      : activeMenu === "ungrouped"
        ? "Ungrouped"
        : groups.find((g) => g.id === activeMenu)?.name || "Links";

  return (
    <AppShell
      title={portalTitle}
      groups={groups}
      activeMenu={activeMenu}
      onMenuSelect={setActiveMenu}
    >
      <Grid hasGutter className="pf-v6-u-mb-xl">
        <GridItem md={7}>
          <Content component="small">Homelab · ops surface</Content>
          <Title headingLevel="h2" size="3xl" className="pf-v6-u-mt-sm">
            {portalTitle}
          </Title>
          <Content className="pf-v6-u-mt-sm">
            Live link grid with health probes, embeds and uplink telemetry.
          </Content>
        </GridItem>
        <GridItem md={5}>
          <ConnectionPanel />
        </GridItem>
      </Grid>

      <SectionHeader
        title={sectionTitle}
        meta={`${filteredLinks.length} endpoints`}
      />
      {filteredLinks.length === 0 ? (
        <EmptyState
          titleText="No links in this group"
          headingLevel="h3"
          className="pf-v6-u-mb-xl"
        >
          <EmptyStateBody>
            Assign links to this group in Admin, or choose another menu item.
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Grid hasGutter className="pf-v6-u-mb-xl">
          {filteredLinks.map((link) => (
            <GridItem key={link.id} md={6} lg={4}>
              <LinkCard link={link} />
            </GridItem>
          ))}
        </Grid>
      )}

      {activeMenu === "all" && widgets.length > 0 && (
        <>
          <SectionHeader title="Special Content" meta={`${widgets.length} widgets`} />
          <Grid hasGutter className="pf-v6-u-mb-xl">
            {widgets.map((w) => (
              <GridItem key={w.id} md={6}>
                <WidgetCard widget={w} />
              </GridItem>
            ))}
          </Grid>
        </>
      )}

      <Divider className="pf-v6-u-mb-md" />
      <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
        <FlexItem>
          <Content component="small">docker · sqlite · health worker</Content>
        </FlexItem>
        <FlexItem>
          <Content component="small">PatternFly 6 · red brand</Content>
        </FlexItem>
      </Flex>
    </AppShell>
  );
}
