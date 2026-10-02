import { getAllGroups, getAllLinks, getAllWidgets, getSettings } from "@/lib/db";
import { PortalClient } from "@/components/PortalClient";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const settings = getSettings();
  const links = getAllLinks(true);
  const widgets = getAllWidgets(true);
  const groups = getAllGroups(true);

  return (
    <PortalClient
      initialLinks={links}
      initialWidgets={widgets}
      initialGroups={groups}
      portalTitle={settings.portal_title}
      accent={settings.theme_accent}
    />
  );
}
