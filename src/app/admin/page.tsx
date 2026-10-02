import { getAllGroups, getAllLinks, getAllWidgets, getSettings } from "@/lib/db";
import { AdminClient } from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <AdminClient
      initialLinks={getAllLinks()}
      initialWidgets={getAllWidgets()}
      initialGroups={getAllGroups()}
      initialSettings={getSettings()}
    />
  );
}
