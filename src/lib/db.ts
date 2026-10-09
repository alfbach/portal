import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { normalizeHttpUrl } from "./auth";
import type { BandwidthSample, HealthStatus, Link, LinkGroup, SettingsMap, Widget } from "./types";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "portal.db");

let dbInstance: Database.Database | null = null;

function ensureDataDir() {
  if (!fs.existsSync(/*turbopackIgnore: true*/ DATA_DIR)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ DATA_DIR, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;
  ensureDataDir();
  dbInstance = new Database(DB_PATH);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  migrate(dbInstance);
  seedIfEmpty(dbInstance);
  return dbInstance;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS link_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      icon_url TEXT,
      preview_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      health_check_url TEXT,
      group_id INTEGER REFERENCES link_groups(id) ON DELETE SET NULL,
      last_status TEXT NOT NULL DEFAULT 'unknown',
      last_latency_ms INTEGER,
      last_checked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS widgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER REFERENCES links(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bandwidth_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      down_mbps REAL NOT NULL,
      rtt_ms REAL,
      measured_at TEXT NOT NULL
    );
  `);

  // Upgrade existing DBs created before groups existed
  const linkCols = db.prepare("PRAGMA table_info(links)").all() as { name: string }[];
  if (!linkCols.some((c) => c.name === "group_id")) {
    db.exec(
      `ALTER TABLE links ADD COLUMN group_id INTEGER REFERENCES link_groups(id) ON DELETE SET NULL`
    );
  }
  if (!linkCols.some((c) => c.name === "auth_username")) {
    db.exec(`ALTER TABLE links ADD COLUMN auth_username TEXT`);
  }
  if (!linkCols.some((c) => c.name === "auth_password")) {
    db.exec(`ALTER TABLE links ADD COLUMN auth_password TEXT`);
  }
}

const DEFAULT_SETTINGS: SettingsMap = {
  portal_title: "OPS PORTAL",
  theme_accent: "#c9190b",
  health_interval_sec: "60",
  bandwidth_payload_kb: "512",
  bandwidth_avg_samples: "10",
};

function seedIfEmpty(db: Database.Database) {
  const groupCount = db.prepare("SELECT COUNT(*) as c FROM link_groups").get() as { c: number };
  if (groupCount.c === 0) {
    const insertGroup = db.prepare(
      `INSERT INTO link_groups (name, sort_order, enabled) VALUES (?, ?, 1)`
    );
    insertGroup.run("Development", 0);
    insertGroup.run("Monitoring", 1);
    insertGroup.run("Reference", 2);
  }

  const linkCount = db.prepare("SELECT COUNT(*) as c FROM links").get() as { c: number };
  if (linkCount.c === 0) {
    const groups = db
      .prepare("SELECT id, name FROM link_groups ORDER BY sort_order ASC")
      .all() as { id: number; name: string }[];
    const byName = Object.fromEntries(groups.map((g) => [g.name, g.id]));

    const insertLink = db.prepare(`
      INSERT INTO links (title, url, description, icon_url, preview_url, sort_order, enabled, health_check_url, group_id)
      VALUES (@title, @url, @description, @icon_url, @preview_url, @sort_order, 1, @health_check_url, @group_id)
    `);

    const seeds = [
      {
        title: "GitHub",
        url: "https://github.com",
        description: "Code & collaboration",
        icon_url: "https://github.githubassets.com/favicons/favicon.svg",
        preview_url: null,
        sort_order: 0,
        health_check_url: "https://github.com",
        group_id: byName.Development ?? null,
      },
      {
        title: "Grafana Demo",
        url: "https://play.grafana.org",
        description: "Observability playground",
        icon_url: "https://grafana.com/static/img/menu/grafana2.svg",
        preview_url: null,
        sort_order: 1,
        health_check_url: "https://play.grafana.org",
        group_id: byName.Monitoring ?? null,
      },
      {
        title: "Wikipedia",
        url: "https://www.wikipedia.org",
        description: "Knowledge base",
        icon_url: "https://www.wikipedia.org/static/favicon/wikipedia.ico",
        preview_url: null,
        sort_order: 2,
        health_check_url: "https://www.wikipedia.org",
        group_id: byName.Reference ?? null,
      },
    ];

    const tx = db.transaction(() => {
      for (const s of seeds) insertLink.run(s);
    });
    tx();

    const insertWidget = db.prepare(`
      INSERT INTO widgets (link_id, type, title, config_json, sort_order, enabled)
      VALUES (@link_id, @type, @title, @config_json, @sort_order, 1)
    `);

    insertWidget.run({
      link_id: null,
      type: "gauge",
      title: "Demo CPU Load",
      config_json: JSON.stringify({
        url: "https://httpbin.org/json",
        jsonPath: "slideshow.author",
        unit: "",
        min: 0,
        max: 100,
        demoValue: 42,
      }),
      sort_order: 0,
    });

    insertWidget.run({
      link_id: 2,
      type: "iframe",
      title: "Grafana Embed",
      config_json: JSON.stringify({
        url: "https://play.grafana.org/d-solo/000000012/grafana-play-home?orgId=1&panelId=2",
        height: 220,
      }),
      sort_order: 1,
    });

    insertWidget.run({
      link_id: null,
      type: "metric_text",
      title: "External Status",
      config_json: JSON.stringify({
        url: "https://httpbin.org/uuid",
        jsonPath: "uuid",
        prefix: "ID ",
        suffix: "",
      }),
      sort_order: 2,
    });

    insertWidget.run({
      link_id: null,
      type: "html_fragment",
      title: "Ops Note",
      config_json: JSON.stringify({
        html: "<p style='margin:0'>All systems nominal · local seed data</p>",
      }),
      sort_order: 3,
    });
  }

  const settingCount = db.prepare("SELECT COUNT(*) as c FROM settings").get() as { c: number };
  if (settingCount.c === 0) {
    const insert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    const tx = db.transaction(() => {
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        insert.run(key, value);
      }
    });
    tx();
  }
}

export function getAllLinks(enabledOnly = false): Link[] {
  const db = getDb();
  if (enabledOnly) {
    return db
      .prepare("SELECT * FROM links WHERE enabled = 1 ORDER BY sort_order ASC, id ASC")
      .all() as Link[];
  }
  return db.prepare("SELECT * FROM links ORDER BY sort_order ASC, id ASC").all() as Link[];
}

export function getAllGroups(enabledOnly = false): LinkGroup[] {
  const db = getDb();
  if (enabledOnly) {
    return db
      .prepare("SELECT * FROM link_groups WHERE enabled = 1 ORDER BY sort_order ASC, id ASC")
      .all() as LinkGroup[];
  }
  return db
    .prepare("SELECT * FROM link_groups ORDER BY sort_order ASC, id ASC")
    .all() as LinkGroup[];
}

export function getGroup(id: number): LinkGroup | undefined {
  return getDb().prepare("SELECT * FROM link_groups WHERE id = ?").get(id) as
    | LinkGroup
    | undefined;
}

export function createGroup(data: {
  name: string;
  sort_order?: number;
  enabled?: boolean;
}): LinkGroup {
  const result = getDb()
    .prepare(
      `INSERT INTO link_groups (name, sort_order, enabled) VALUES (?, ?, ?)`
    )
    .run(data.name, data.sort_order ?? 0, data.enabled === false ? 0 : 1);
  return getGroup(Number(result.lastInsertRowid))!;
}

export function updateGroup(
  id: number,
  data: Partial<{ name: string; sort_order: number; enabled: boolean }>
): LinkGroup | undefined {
  const existing = getGroup(id);
  if (!existing) return undefined;
  getDb()
    .prepare(
      `UPDATE link_groups SET name = ?, sort_order = ?, enabled = ? WHERE id = ?`
    )
    .run(
      data.name ?? existing.name,
      data.sort_order ?? existing.sort_order,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : existing.enabled,
      id
    );
  return getGroup(id);
}

export function deleteGroup(id: number): boolean {
  getDb().prepare("UPDATE links SET group_id = NULL WHERE group_id = ?").run(id);
  const result = getDb().prepare("DELETE FROM link_groups WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getLink(id: number): Link | undefined {
  return getDb().prepare("SELECT * FROM links WHERE id = ?").get(id) as Link | undefined;
}

export function createLink(data: {
  title: string;
  url: string;
  description?: string | null;
  icon_url?: string | null;
  preview_url?: string | null;
  sort_order?: number;
  enabled?: boolean;
  health_check_url?: string | null;
  group_id?: number | null;
  auth_username?: string | null;
  auth_password?: string | null;
}): Link {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO links (title, url, description, icon_url, preview_url, sort_order, enabled, health_check_url, group_id, auth_username, auth_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.title,
      normalizeHttpUrl(data.url),
      data.description ?? null,
      data.icon_url ?? null,
      data.preview_url ?? null,
      data.sort_order ?? 0,
      data.enabled === false ? 0 : 1,
      data.health_check_url ? normalizeHttpUrl(data.health_check_url) : null,
      data.group_id ?? null,
      data.auth_username ?? null,
      data.auth_password ?? null
    );
  return getLink(Number(result.lastInsertRowid))!;
}

export function updateLink(
  id: number,
  data: Partial<{
    title: string;
    url: string;
    description: string | null;
    icon_url: string | null;
    preview_url: string | null;
    sort_order: number;
    enabled: boolean;
    health_check_url: string | null;
    group_id: number | null;
    auth_username: string | null;
    auth_password: string | null;
  }>
): Link | undefined {
  const existing = getLink(id);
  if (!existing) return undefined;
  getDb()
    .prepare(
      `UPDATE links SET
        title = ?, url = ?, description = ?, icon_url = ?, preview_url = ?,
        sort_order = ?, enabled = ?, health_check_url = ?, group_id = ?,
        auth_username = ?, auth_password = ?
       WHERE id = ?`
    )
    .run(
      data.title ?? existing.title,
      data.url !== undefined ? normalizeHttpUrl(data.url) : existing.url,
      data.description !== undefined ? data.description : existing.description,
      data.icon_url !== undefined ? data.icon_url : existing.icon_url,
      data.preview_url !== undefined ? data.preview_url : existing.preview_url,
      data.sort_order ?? existing.sort_order,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : existing.enabled,
      data.health_check_url !== undefined
        ? data.health_check_url
          ? normalizeHttpUrl(data.health_check_url)
          : null
        : existing.health_check_url,
      data.group_id !== undefined ? data.group_id : existing.group_id,
      data.auth_username !== undefined ? data.auth_username : existing.auth_username,
      data.auth_password !== undefined ? data.auth_password : existing.auth_password,
      id
    );
  return getLink(id);
}

export function deleteLink(id: number): boolean {
  const result = getDb().prepare("DELETE FROM links WHERE id = ?").run(id);
  return result.changes > 0;
}

export function updateLinkHealth(
  id: number,
  status: HealthStatus,
  latencyMs: number | null
) {
  getDb()
    .prepare(
      `UPDATE links SET last_status = ?, last_latency_ms = ?, last_checked_at = ? WHERE id = ?`
    )
    .run(status, latencyMs, new Date().toISOString(), id);
}

export function getAllWidgets(enabledOnly = false): Widget[] {
  const db = getDb();
  if (enabledOnly) {
    return db
      .prepare("SELECT * FROM widgets WHERE enabled = 1 ORDER BY sort_order ASC, id ASC")
      .all() as Widget[];
  }
  return db.prepare("SELECT * FROM widgets ORDER BY sort_order ASC, id ASC").all() as Widget[];
}

export function getWidget(id: number): Widget | undefined {
  return getDb().prepare("SELECT * FROM widgets WHERE id = ?").get(id) as Widget | undefined;
}

export function createWidget(data: {
  link_id?: number | null;
  type: string;
  title: string;
  config_json?: string;
  sort_order?: number;
  enabled?: boolean;
}): Widget {
  const result = getDb()
    .prepare(
      `INSERT INTO widgets (link_id, type, title, config_json, sort_order, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.link_id ?? null,
      data.type,
      data.title,
      data.config_json ?? "{}",
      data.sort_order ?? 0,
      data.enabled === false ? 0 : 1
    );
  return getWidget(Number(result.lastInsertRowid))!;
}

export function updateWidget(
  id: number,
  data: Partial<{
    link_id: number | null;
    type: string;
    title: string;
    config_json: string;
    sort_order: number;
    enabled: boolean;
  }>
): Widget | undefined {
  const existing = getWidget(id);
  if (!existing) return undefined;
  getDb()
    .prepare(
      `UPDATE widgets SET
        link_id = ?, type = ?, title = ?, config_json = ?, sort_order = ?, enabled = ?
       WHERE id = ?`
    )
    .run(
      data.link_id !== undefined ? data.link_id : existing.link_id,
      data.type ?? existing.type,
      data.title ?? existing.title,
      data.config_json ?? existing.config_json,
      data.sort_order ?? existing.sort_order,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : existing.enabled,
      id
    );
  return getWidget(id);
}

export function deleteWidget(id: number): boolean {
  const result = getDb().prepare("DELETE FROM widgets WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getSettings(): SettingsMap {
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const map = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    (map as Record<string, string>)[row.key] = row.value;
  }
  return map;
}

export function updateSettings(partial: Partial<SettingsMap>): SettingsMap {
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(partial)) {
      if (value !== undefined) upsert.run(key, value);
    }
  });
  tx();
  return getSettings();
}

export function addBandwidthSample(downMbps: number, rttMs: number | null): BandwidthSample {
  const db = getDb();
  const measuredAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO bandwidth_samples (down_mbps, rtt_ms, measured_at) VALUES (?, ?, ?)`
    )
    .run(downMbps, rttMs, measuredAt);

  const maxSamples = Number(getSettings().bandwidth_avg_samples) || 10;
  db.prepare(
    `DELETE FROM bandwidth_samples WHERE id NOT IN (
      SELECT id FROM bandwidth_samples ORDER BY id DESC LIMIT ?
    )`
  ).run(maxSamples * 3);

  return {
    id: Number(result.lastInsertRowid),
    down_mbps: downMbps,
    rtt_ms: rttMs,
    measured_at: measuredAt,
  };
}

export function getBandwidthSamples(limit = 10): BandwidthSample[] {
  return getDb()
    .prepare(
      `SELECT * FROM bandwidth_samples ORDER BY id DESC LIMIT ?`
    )
    .all(limit) as BandwidthSample[];
}
