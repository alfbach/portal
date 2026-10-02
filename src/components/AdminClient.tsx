"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Alert,
  AlertActionCloseButton,
  Button,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  TextArea,
  TextInput,
  Title,
  Content,
} from "@patternfly/react-core";
import { ArrowLeftIcon, SyncAltIcon, OutlinedArrowAltCircleRightIcon } from "@patternfly/react-icons";
import type { Link, LinkGroup, SettingsMap, Widget, WidgetType } from "@/lib/types";
import { AppShell, SectionHeader } from "./AppShell";

const emptyLink = {
  title: "",
  url: "",
  description: "",
  icon_url: "",
  preview_url: "",
  health_check_url: "",
  sort_order: 0,
  enabled: true,
  group_id: "" as string | number,
  auth_username: "",
  auth_password: "",
};

const emptyGroup = {
  name: "",
  sort_order: 0,
  enabled: true,
};

const emptyWidget = {
  title: "",
  type: "gauge" as WidgetType,
  link_id: "" as string | number,
  sort_order: 0,
  enabled: true,
  configText: JSON.stringify(
    { url: "", jsonPath: ".", unit: "", min: 0, max: 100 },
    null,
    2
  ),
};

export function AdminClient({
  initialLinks,
  initialWidgets,
  initialGroups,
  initialSettings,
}: {
  initialLinks: Link[];
  initialWidgets: Widget[];
  initialGroups: LinkGroup[];
  initialSettings: SettingsMap;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [widgets, setWidgets] = useState(initialWidgets);
  const [groups, setGroups] = useState(initialGroups);
  const [settings, setSettings] = useState(initialSettings);
  const [linkForm, setLinkForm] = useState({ ...emptyLink });
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
  const [groupForm, setGroupForm] = useState({ ...emptyGroup });
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [widgetForm, setWidgetForm] = useState({ ...emptyWidget });
  const [editingWidgetId, setEditingWidgetId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [adminToken, setAdminToken] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("portal_admin_token");
    if (saved) setAdminToken(saved);
  }, []);

  function headers(): HeadersInit {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (adminToken) h["x-admin-token"] = adminToken;
    return h;
  }

  function flash(msg: string) {
    setMessage(msg);
  }

  function groupName(id: number | null | undefined) {
    if (id == null) return "—";
    return groups.find((g) => g.id === id)?.name ?? `#${id}`;
  }

  async function refresh() {
    const [l, w, g, s] = await Promise.all([
      fetch("/api/links").then((r) => r.json()),
      fetch("/api/widgets").then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setLinks(l);
    setWidgets(w);
    setGroups(g);
    setSettings(s);
  }

  async function saveLink(e: FormEvent) {
    e.preventDefault();
    localStorage.setItem("portal_admin_token", adminToken);
    const payload = {
      title: linkForm.title,
      url: linkForm.url,
      description: linkForm.description || null,
      icon_url: linkForm.icon_url || null,
      preview_url: linkForm.preview_url || null,
      health_check_url: linkForm.health_check_url || null,
      sort_order: Number(linkForm.sort_order) || 0,
      enabled: linkForm.enabled,
      group_id: linkForm.group_id === "" ? null : Number(linkForm.group_id),
      auth_username: linkForm.auth_username || null,
      auth_password: linkForm.auth_password || null,
    };
    const res = await fetch(
      editingLinkId ? `/api/links/${editingLinkId}` : "/api/links",
      {
        method: editingLinkId ? "PUT" : "POST",
        headers: headers(),
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      flash(`Link error: ${(await res.json()).error || res.status}`);
      return;
    }
    setLinkForm({ ...emptyLink });
    setEditingLinkId(null);
    await refresh();
    flash(editingLinkId ? "Link updated" : "Link created");
  }

  function editLink(link: Link) {
    setEditingLinkId(link.id);
    setTestResult(null);
    setLinkForm({
      title: link.title,
      url: link.url,
      description: link.description || "",
      icon_url: link.icon_url || "",
      preview_url: link.preview_url || "",
      health_check_url: link.health_check_url || "",
      sort_order: link.sort_order,
      enabled: !!link.enabled,
      group_id: link.group_id ?? "",
      auth_username: link.auth_username || "",
      auth_password: link.auth_password || "",
    });
  }

  async function testLinkConnection() {
    if (!linkForm.url && !linkForm.health_check_url) {
      setTestResult("Enter a URL first");
      return;
    }
    setTesting(true);
    setTestResult(null);
    localStorage.setItem("portal_admin_token", adminToken);
    try {
      const res = await fetch("/api/links/test", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          id: editingLinkId ?? undefined,
          url: linkForm.url,
          health_check_url: linkForm.health_check_url || undefined,
          auth_username: linkForm.auth_username || null,
          auth_password: linkForm.auth_password || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult(`Test error: ${data.error || res.status}`);
        return;
      }
      setTestResult(
        `${data.ok ? "OK" : "FAIL"} · ${data.status} · ${data.latencyMs}ms · ${data.message}`
      );
    } catch {
      setTestResult("Test request failed");
    } finally {
      setTesting(false);
    }
  }

  async function removeLink(id: number) {
    if (!confirm("Delete this link?")) return;
    const res = await fetch(`/api/links/${id}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      flash("Delete failed");
      return;
    }
    await refresh();
    flash("Link deleted");
  }

  async function saveGroup(e: FormEvent) {
    e.preventDefault();
    localStorage.setItem("portal_admin_token", adminToken);
    const payload = {
      name: groupForm.name,
      sort_order: Number(groupForm.sort_order) || 0,
      enabled: groupForm.enabled,
    };
    const res = await fetch(
      editingGroupId ? `/api/groups/${editingGroupId}` : "/api/groups",
      {
        method: editingGroupId ? "PUT" : "POST",
        headers: headers(),
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      flash(`Group error: ${(await res.json()).error || res.status}`);
      return;
    }
    setGroupForm({ ...emptyGroup });
    setEditingGroupId(null);
    await refresh();
    flash(editingGroupId ? "Group updated" : "Group created");
  }

  function editGroup(group: LinkGroup) {
    setEditingGroupId(group.id);
    setGroupForm({
      name: group.name,
      sort_order: group.sort_order,
      enabled: !!group.enabled,
    });
  }

  async function removeGroup(id: number) {
    if (!confirm("Delete this group? Links will become ungrouped.")) return;
    const res = await fetch(`/api/groups/${id}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      flash("Delete failed");
      return;
    }
    await refresh();
    flash("Group deleted");
  }

  async function saveWidget(e: FormEvent) {
    e.preventDefault();
    localStorage.setItem("portal_admin_token", adminToken);
    let config: unknown;
    try {
      config = JSON.parse(widgetForm.configText);
    } catch {
      flash("Invalid JSON config");
      return;
    }
    const payload = {
      title: widgetForm.title,
      type: widgetForm.type,
      link_id: widgetForm.link_id === "" ? null : Number(widgetForm.link_id),
      sort_order: Number(widgetForm.sort_order) || 0,
      enabled: widgetForm.enabled,
      config,
      config_json: JSON.stringify(config),
    };
    const res = await fetch(
      editingWidgetId ? `/api/widgets/${editingWidgetId}` : "/api/widgets",
      {
        method: editingWidgetId ? "PUT" : "POST",
        headers: headers(),
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      flash(`Widget error: ${(await res.json()).error || res.status}`);
      return;
    }
    setWidgetForm({ ...emptyWidget });
    setEditingWidgetId(null);
    await refresh();
    flash(editingWidgetId ? "Widget updated" : "Widget created");
  }

  function editWidget(widget: Widget) {
    setEditingWidgetId(widget.id);
    let pretty = widget.config_json;
    try {
      pretty = JSON.stringify(JSON.parse(widget.config_json), null, 2);
    } catch {
      /* keep */
    }
    setWidgetForm({
      title: widget.title,
      type: widget.type,
      link_id: widget.link_id ?? "",
      sort_order: widget.sort_order,
      enabled: !!widget.enabled,
      configText: pretty,
    });
  }

  async function removeWidget(id: number) {
    if (!confirm("Delete this widget?")) return;
    const res = await fetch(`/api/widgets/${id}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      flash("Delete failed");
      return;
    }
    await refresh();
    flash("Widget deleted");
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    localStorage.setItem("portal_admin_token", adminToken);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      flash("Settings save failed");
      return;
    }
    setSettings(await res.json());
    flash("Settings saved");
  }

  async function runHealthCheck() {
    const res = await fetch("/api/health/check", {
      method: "POST",
      headers: headers(),
    });
    if (!res.ok) {
      flash("Health check failed");
      return;
    }
    await refresh();
    flash("Health checks completed");
  }

  function onTypeChange(type: WidgetType) {
    const templates: Record<WidgetType, object> = {
      gauge: { url: "", jsonPath: ".", unit: "", min: 0, max: 100, demoValue: 42 },
      iframe: { url: "", height: 220 },
      metric_text: { url: "", jsonPath: ".", prefix: "", suffix: "" },
      html_fragment: { html: "<p>Note</p>" },
    };
    setWidgetForm((f) => ({
      ...f,
      type,
      configText: JSON.stringify(templates[type], null, 2),
    }));
  }

  return (
    <AppShell title="Portal Admin" showAdminLink={false} showGroupNav={false}>
      <Flex
        justifyContent={{ default: "justifyContentSpaceBetween" }}
        alignItems={{ default: "alignItemsCenter" }}
        className="pf-v6-u-mb-lg"
      >
        <FlexItem>
          <Content component="small">Configuration</Content>
          <Title headingLevel="h2" size="2xl">
            Portal Admin
          </Title>
          <Content>Add, modify or delete links and special content.</Content>
        </FlexItem>
        <FlexItem>
          <Flex spaceItems={{ default: "spaceItemsSm" }}>
            <FlexItem>
              <Button variant="secondary" component="a" href="/" icon={<ArrowLeftIcon />}>
                Portal
              </Button>
            </FlexItem>
            <FlexItem>
              <Button
                variant="primary"
                icon={<SyncAltIcon />}
                onClick={() => void runHealthCheck()}
              >
                Run health checks
              </Button>
            </FlexItem>
          </Flex>
        </FlexItem>
      </Flex>

      {message && (
        <Alert
          variant="success"
          title={message}
          className="pf-v6-u-mb-md"
          actionClose={
            <AlertActionCloseButton onClose={() => setMessage(null)} />
          }
        />
      )}

      <Grid hasGutter>
        <GridItem span={12}>
          <Card>
            <CardTitle>Access token</CardTitle>
            <CardBody>
              <Content className="pf-v6-u-mb-md">
                Optional. Only needed if <code>ADMIN_TOKEN</code> is set in the container.
              </Content>
              <TextInput
                type="password"
                value={adminToken}
                onChange={(_e, v) => setAdminToken(v)}
                aria-label="Admin token"
                placeholder="x-admin-token"
              />
            </CardBody>
          </Card>
        </GridItem>

        <GridItem span={12}>
          <Card>
            <CardTitle>Settings</CardTitle>
            <CardBody>
              <Form onSubmit={(e) => void saveSettings(e)}>
                <Grid hasGutter>
                  <GridItem md={6}>
                    <FormGroup label="Portal title" fieldId="portal-title">
                      <TextInput
                        id="portal-title"
                        value={settings.portal_title}
                        onChange={(_e, v) =>
                          setSettings({ ...settings, portal_title: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={6}>
                    <FormGroup label="Theme accent (legacy)" fieldId="theme-accent">
                      <TextInput
                        id="theme-accent"
                        value={settings.theme_accent}
                        onChange={(_e, v) =>
                          setSettings({ ...settings, theme_accent: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={4}>
                    <FormGroup label="Health interval (sec)" fieldId="health-interval">
                      <TextInput
                        id="health-interval"
                        value={settings.health_interval_sec}
                        onChange={(_e, v) =>
                          setSettings({ ...settings, health_interval_sec: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={4}>
                    <FormGroup label="Bandwidth payload (KB)" fieldId="bw-payload">
                      <TextInput
                        id="bw-payload"
                        value={settings.bandwidth_payload_kb}
                        onChange={(_e, v) =>
                          setSettings({ ...settings, bandwidth_payload_kb: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={4}>
                    <FormGroup label="Avg samples" fieldId="bw-samples">
                      <TextInput
                        id="bw-samples"
                        value={settings.bandwidth_avg_samples}
                        onChange={(_e, v) =>
                          setSettings({ ...settings, bandwidth_avg_samples: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                </Grid>
                <Button type="submit" variant="primary" className="pf-v6-u-mt-md">
                  Save settings
                </Button>
              </Form>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem span={12}>
          <Card>
            <CardTitle>
              {editingGroupId ? `Edit group #${editingGroupId}` : "Add link group"}
            </CardTitle>
            <CardBody>
              <Content className="pf-v6-u-mb-md">
                Groups appear as items in the left portal menu.
              </Content>
              <Form onSubmit={(e) => void saveGroup(e)}>
                <Grid hasGutter>
                  <GridItem md={6}>
                    <FormGroup label="Name" isRequired fieldId="group-name">
                      <TextInput
                        id="group-name"
                        isRequired
                        value={groupForm.name}
                        onChange={(_e, v) =>
                          setGroupForm({ ...groupForm, name: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={3}>
                    <FormGroup label="Sort order" fieldId="group-sort">
                      <TextInput
                        id="group-sort"
                        type="number"
                        value={String(groupForm.sort_order)}
                        onChange={(_e, v) =>
                          setGroupForm({
                            ...groupForm,
                            sort_order: Number(v),
                          })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={3}>
                    <FormGroup label="Enabled" fieldId="group-enabled">
                      <Checkbox
                        id="group-enabled"
                        label="Enabled"
                        isChecked={groupForm.enabled}
                        onChange={(_e, checked) =>
                          setGroupForm({ ...groupForm, enabled: checked })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                </Grid>
                <Flex spaceItems={{ default: "spaceItemsSm" }} className="pf-v6-u-mt-md">
                  <FlexItem>
                    <Button type="submit" variant="primary">
                      {editingGroupId ? "Update group" : "Create group"}
                    </Button>
                  </FlexItem>
                  {editingGroupId && (
                    <FlexItem>
                      <Button
                        variant="link"
                        onClick={() => {
                          setEditingGroupId(null);
                          setGroupForm({ ...emptyGroup });
                        }}
                      >
                        Cancel
                      </Button>
                    </FlexItem>
                  )}
                </Flex>
              </Form>

              <SectionHeader title="Existing groups" />
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Order</th>
                    <th>Enabled</th>
                    <th>Links</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.id}>
                      <td>
                        <strong>{group.name}</strong>
                      </td>
                      <td>{group.sort_order}</td>
                      <td>{group.enabled ? "yes" : "no"}</td>
                      <td>
                        {links.filter((l) => l.group_id === group.id).length}
                      </td>
                      <td>
                        <Flex spaceItems={{ default: "spaceItemsSm" }}>
                          <FlexItem>
                            <Button
                              variant="secondary"
                              onClick={() => editGroup(group)}
                            >
                              Edit
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button
                              variant="danger"
                              onClick={() => void removeGroup(group.id)}
                            >
                              Delete
                            </Button>
                          </FlexItem>
                        </Flex>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem span={12}>
          <Card>
            <CardTitle>
              {editingLinkId ? `Edit link #${editingLinkId}` : "Add link"}
            </CardTitle>
            <CardBody>
              <Form onSubmit={(e) => void saveLink(e)}>
                <Grid hasGutter>
                  <GridItem md={6}>
                    <FormGroup label="Title" isRequired fieldId="link-title">
                      <TextInput
                        id="link-title"
                        isRequired
                        value={linkForm.title}
                        onChange={(_e, v) => setLinkForm({ ...linkForm, title: v })}
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={6}>
                    <FormGroup label="URL" isRequired fieldId="link-url">
                      <TextInput
                        id="link-url"
                        isRequired
                        value={linkForm.url}
                        onChange={(_e, v) => setLinkForm({ ...linkForm, url: v })}
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={6}>
                    <FormGroup label="Description" fieldId="link-desc">
                      <TextInput
                        id="link-desc"
                        value={linkForm.description}
                        onChange={(_e, v) =>
                          setLinkForm({ ...linkForm, description: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={6}>
                    <FormGroup label="Icon URL" fieldId="link-icon">
                      <TextInput
                        id="link-icon"
                        value={linkForm.icon_url}
                        onChange={(_e, v) =>
                          setLinkForm({ ...linkForm, icon_url: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={6}>
                    <FormGroup label="Preview URL" fieldId="link-preview">
                      <TextInput
                        id="link-preview"
                        value={linkForm.preview_url}
                        onChange={(_e, v) =>
                          setLinkForm({ ...linkForm, preview_url: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={6}>
                    <FormGroup label="Health check URL" fieldId="link-health">
                      <TextInput
                        id="link-health"
                        value={linkForm.health_check_url}
                        onChange={(_e, v) =>
                          setLinkForm({ ...linkForm, health_check_url: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={6}>
                    <FormGroup label="Auth username (optional)" fieldId="link-user">
                      <TextInput
                        id="link-user"
                        autoComplete="off"
                        value={linkForm.auth_username}
                        onChange={(_e, v) =>
                          setLinkForm({ ...linkForm, auth_username: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={6}>
                    <FormGroup label="Auth password (optional)" fieldId="link-pass">
                      <TextInput
                        id="link-pass"
                        type="password"
                        autoComplete="new-password"
                        value={linkForm.auth_password}
                        onChange={(_e, v) =>
                          setLinkForm({ ...linkForm, auth_password: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem span={12}>
                    <Content component="small" className="pf-v6-u-mb-sm">
                      Optional HTTP Basic Auth. Credentials are sent when testing,
                      for health checks, and when opening the link in a new window.
                    </Content>
                    <Flex spaceItems={{ default: "spaceItemsSm" }} alignItems={{ default: "alignItemsCenter" }}>
                      <FlexItem>
                        <Button
                          type="button"
                          variant="secondary"
                          icon={<OutlinedArrowAltCircleRightIcon />}
                          isLoading={testing}
                          onClick={() => void testLinkConnection()}
                        >
                          Test connection
                        </Button>
                      </FlexItem>
                      {editingLinkId && (
                        <FlexItem>
                          <Button
                            type="button"
                            variant="link"
                            onClick={() =>
                              window.open(
                                `/go/${editingLinkId}`,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            Open in new window
                          </Button>
                        </FlexItem>
                      )}
                    </Flex>
                    {testResult && (
                      <Content className="pf-v6-u-mt-sm">
                        <strong>Test:</strong> {testResult}
                      </Content>
                    )}
                  </GridItem>
                  <GridItem md={4}>
                    <FormGroup label="Group" fieldId="link-group">
                      <FormSelect
                        id="link-group"
                        value={String(linkForm.group_id)}
                        onChange={(_e, v) =>
                          setLinkForm({ ...linkForm, group_id: v })
                        }
                        aria-label="Link group"
                      >
                        <FormSelectOption value="" label="Ungrouped" />
                        {groups.map((g) => (
                          <FormSelectOption
                            key={g.id}
                            value={String(g.id)}
                            label={g.name}
                          />
                        ))}
                      </FormSelect>
                    </FormGroup>
                  </GridItem>
                  <GridItem md={4}>
                    <FormGroup label="Sort order" fieldId="link-sort">
                      <TextInput
                        id="link-sort"
                        type="number"
                        value={String(linkForm.sort_order)}
                        onChange={(_e, v) =>
                          setLinkForm({ ...linkForm, sort_order: Number(v) })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={4}>
                    <FormGroup label="Enabled" fieldId="link-enabled">
                      <Checkbox
                        id="link-enabled"
                        label="Enabled"
                        isChecked={linkForm.enabled}
                        onChange={(_e, checked) =>
                          setLinkForm({ ...linkForm, enabled: checked })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                </Grid>
                <Flex spaceItems={{ default: "spaceItemsSm" }} className="pf-v6-u-mt-md">
                  <FlexItem>
                    <Button type="submit" variant="primary">
                      {editingLinkId ? "Update link" : "Create link"}
                    </Button>
                  </FlexItem>
                  {editingLinkId && (
                    <FlexItem>
                      <Button
                        variant="link"
                        onClick={() => {
                          setEditingLinkId(null);
                          setLinkForm({ ...emptyLink });
                        }}
                      >
                        Cancel
                      </Button>
                    </FlexItem>
                  )}
                </Flex>
              </Form>

              <SectionHeader title="Existing links" />
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Group</th>
                    <th>Status</th>
                    <th>Order</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.id}>
                      <td>
                        <strong>{link.title}</strong>
                        <div>
                          <Content component="small">{link.url}</Content>
                        </div>
                      </td>
                      <td>{groupName(link.group_id)}</td>
                      <td>
                        {link.last_status}
                        {link.last_latency_ms != null
                          ? ` · ${link.last_latency_ms}ms`
                          : ""}
                      </td>
                      <td>{link.sort_order}</td>
                      <td>
                        <Flex spaceItems={{ default: "spaceItemsSm" }}>
                          <FlexItem>
                            <Button variant="secondary" onClick={() => editLink(link)}>
                              Edit
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button
                              variant="danger"
                              onClick={() => void removeLink(link.id)}
                            >
                              Delete
                            </Button>
                          </FlexItem>
                        </Flex>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </GridItem>

        <GridItem span={12}>
          <Card>
            <CardTitle>
              {editingWidgetId
                ? `Edit widget #${editingWidgetId}`
                : "Add special content"}
            </CardTitle>
            <CardBody>
              <Form onSubmit={(e) => void saveWidget(e)}>
                <Grid hasGutter>
                  <GridItem md={6}>
                    <FormGroup label="Title" isRequired fieldId="widget-title">
                      <TextInput
                        id="widget-title"
                        isRequired
                        value={widgetForm.title}
                        onChange={(_e, v) =>
                          setWidgetForm({ ...widgetForm, title: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={6}>
                    <FormGroup label="Type" fieldId="widget-type">
                      <FormSelect
                        id="widget-type"
                        value={widgetForm.type}
                        onChange={(_e, v) => onTypeChange(v as WidgetType)}
                        aria-label="Widget type"
                      >
                        <FormSelectOption value="gauge" label="gauge" />
                        <FormSelectOption value="iframe" label="iframe" />
                        <FormSelectOption value="metric_text" label="metric_text" />
                        <FormSelectOption
                          value="html_fragment"
                          label="html_fragment"
                        />
                      </FormSelect>
                    </FormGroup>
                  </GridItem>
                  <GridItem md={4}>
                    <FormGroup label="Linked link id" fieldId="widget-link">
                      <TextInput
                        id="widget-link"
                        value={String(widgetForm.link_id)}
                        onChange={(_e, v) =>
                          setWidgetForm({ ...widgetForm, link_id: v })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={4}>
                    <FormGroup label="Sort order" fieldId="widget-sort">
                      <TextInput
                        id="widget-sort"
                        type="number"
                        value={String(widgetForm.sort_order)}
                        onChange={(_e, v) =>
                          setWidgetForm({
                            ...widgetForm,
                            sort_order: Number(v),
                          })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem md={4}>
                    <FormGroup label="Enabled" fieldId="widget-enabled">
                      <Checkbox
                        id="widget-enabled"
                        label="Enabled"
                        isChecked={widgetForm.enabled}
                        onChange={(_e, checked) =>
                          setWidgetForm({ ...widgetForm, enabled: checked })
                        }
                      />
                    </FormGroup>
                  </GridItem>
                  <GridItem span={12}>
                    <FormGroup label="Config JSON" fieldId="widget-config">
                      <TextArea
                        id="widget-config"
                        value={widgetForm.configText}
                        onChange={(_e, v) =>
                          setWidgetForm({ ...widgetForm, configText: v })
                        }
                        rows={8}
                        resizeOrientation="vertical"
                      />
                    </FormGroup>
                  </GridItem>
                </Grid>
                <Flex spaceItems={{ default: "spaceItemsSm" }} className="pf-v6-u-mt-md">
                  <FlexItem>
                    <Button type="submit" variant="primary">
                      {editingWidgetId ? "Update widget" : "Create widget"}
                    </Button>
                  </FlexItem>
                  {editingWidgetId && (
                    <FlexItem>
                      <Button
                        variant="link"
                        onClick={() => {
                          setEditingWidgetId(null);
                          setWidgetForm({ ...emptyWidget });
                        }}
                      >
                        Cancel
                      </Button>
                    </FlexItem>
                  )}
                </Flex>
              </Form>

              <SectionHeader title="Existing widgets" />
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Order</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {widgets.map((widget) => (
                    <tr key={widget.id}>
                      <td>
                        <strong>{widget.title}</strong>
                      </td>
                      <td>{widget.type}</td>
                      <td>{widget.sort_order}</td>
                      <td>
                        <Flex spaceItems={{ default: "spaceItemsSm" }}>
                          <FlexItem>
                            <Button
                              variant="secondary"
                              onClick={() => editWidget(widget)}
                            >
                              Edit
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button
                              variant="danger"
                              onClick={() => void removeWidget(widget.id)}
                            >
                              Delete
                            </Button>
                          </FlexItem>
                        </Flex>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </AppShell>
  );
}
