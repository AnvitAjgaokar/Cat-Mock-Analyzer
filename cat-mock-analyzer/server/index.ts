import express from 'express';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'cat.db');

// ── Ensure directories exist ──────────────────────────────────────────────────
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

// ── Backup on start: keep last 14 daily copies ───────────────────────────────
if (fs.existsSync(DB_PATH)) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dest = path.join(BACKUP_DIR, `cat-${stamp}.db`);
  if (!fs.existsSync(dest)) fs.copyFileSync(DB_PATH, dest);

  // Trim to last 14 backups
  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('cat-') && f.endsWith('.db'))
    .sort();
  while (backups.length > 14) {
    fs.unlinkSync(path.join(BACKUP_DIR, backups.shift()!));
  }
}

// ── Open DB ───────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS mocks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','complete')),
    data JSON NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSON NOT NULL DEFAULT 'null'
  );
`);

// ── Seed default settings ─────────────────────────────────────────────────────
const defaultSettings: Record<string, unknown> = {
  targetPercentile: 99,
  marking: { correct: 3, wrong: -1, skip: 0 },
  sectionMinutes: { varc: 40, dilr: 40, qa: 40 },
  scorePercentileTable: [
    { score: 35, percentile: 80 },
    { score: 45, percentile: 85 },
    { score: 50, percentile: 90 },
    { score: 60, percentile: 95 },
    { score: 65, percentile: 96 },
    { score: 75, percentile: 98 },
    { score: 80, percentile: 99 },
    { score: 100, percentile: 99.5 },
  ],
  theme: 'dark',
};

const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings(key, value) VALUES(?, ?)',
);
for (const [k, v] of Object.entries(defaultSettings)) {
  insertSetting.run(k, JSON.stringify(v));
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10mb' }));

// ── Mocks API ─────────────────────────────────────────────────────────────────
app.get('/api/mocks', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM mocks ORDER BY date DESC, created_at DESC')
    .all() as any[];
  res.json(
    rows.map((r) => ({ ...r, data: JSON.parse(r.data as string) })),
  );
});

app.post('/api/mocks', (req, res) => {
  const { id, name, date, status = 'draft', data = {} } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  db.prepare(
    'INSERT INTO mocks(id,name,date,status,data) VALUES(?,?,?,?,?)',
  ).run(id, name ?? '', date ?? '', status, JSON.stringify(data));
  res.status(201).json({ id });
});

app.get('/api/mocks/:id', (req, res) => {
  const row = db
    .prepare('SELECT * FROM mocks WHERE id=?')
    .get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...row, data: JSON.parse(row.data as string) });
});

app.put('/api/mocks/:id', (req, res) => {
  const { name, date, status, data } = req.body;
  const result = db
    .prepare(
      `UPDATE mocks SET
        name=COALESCE(?,name),
        date=COALESCE(?,date),
        status=COALESCE(?,status),
        data=COALESCE(?,data),
        updated_at=datetime('now')
      WHERE id=?`,
    )
    .run(
      name ?? null,
      date ?? null,
      status ?? null,
      data !== undefined ? JSON.stringify(data) : null,
      req.params.id,
    );
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.delete('/api/mocks/:id', (req, res) => {
  db.prepare('DELETE FROM mocks WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Settings API ──────────────────────────────────────────────────────────────
app.get('/api/settings', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as any[];
  const settings: Record<string, unknown> = {};
  for (const r of rows) settings[r.key] = JSON.parse(r.value as string);
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const upsert = db.prepare(
    'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  );
  const tx = db.transaction((pairs: [string, unknown][]) => {
    for (const [k, v] of pairs) upsert.run(k, JSON.stringify(v));
  });
  tx(Object.entries(req.body));
  res.json({ ok: true });
});

// ── Export / Import ───────────────────────────────────────────────────────────
app.get('/api/export', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM mocks ORDER BY date DESC')
    .all() as any[];
  const mocks = rows.map((r) => ({ ...r, data: JSON.parse(r.data as string) }));
  res.setHeader('Content-Disposition', 'attachment; filename="cat-mocks.json"');
  res.json({ version: 1, exportedAt: new Date().toISOString(), mocks });
});

app.post('/api/import', (req, res) => {
  const { mocks = [] } = req.body as { mocks: any[] };
  const upsert = db.prepare(
    `INSERT INTO mocks(id,name,date,status,data,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, date=excluded.date, status=excluded.status,
       data=excluded.data, updated_at=excluded.updated_at`,
  );
  const tx = db.transaction((items: any[]) => {
    for (const m of items) {
      upsert.run(
        m.id,
        m.name ?? '',
        m.date ?? '',
        m.status ?? 'draft',
        JSON.stringify(m.data ?? {}),
        m.created_at ?? new Date().toISOString(),
        m.updated_at ?? new Date().toISOString(),
      );
    }
  });
  tx(mocks);
  res.json({ imported: mocks.length });
});

// ── Serve built frontend (production) ────────────────────────────────────────
const distDir = path.join(ROOT, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = 4173;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[server] http://127.0.0.1:${PORT}`);
});
