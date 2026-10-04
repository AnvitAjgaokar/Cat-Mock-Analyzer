import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'cat.db');
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS mocks (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )
`);

const insertMock = db.prepare(`
  INSERT OR REPLACE INTO mocks (id, data) VALUES (@id, @data)
`);

function r(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randRes() {
  const roll = Math.random();
  if (roll < 0.6) return 'C';
  if (roll < 0.85) return 'W';
  return 'S';
}

function randReason() {
  const reasons = ['concept_gap', 'calc_error', 'silly_mistake', 'time_pressure', 'misread_question', 'other'];
  return reasons[r(0, reasons.length - 1)];
}

console.log('Seeding database with 3 dummy mocks...');

const sources = ['TIME', 'IMS', 'Cracku'];

for (let i = 0; i < 3; i++) {
  const id = randomUUID();
  const date = new Date(Date.now() - (3 - i) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const mock = {
    id,
    name: `Seed Mock ${i + 1}`,
    date,
    source: sources[i],
    status: 'complete',
    varc: {
      rc: Array(4).fill(null).map((_, idx) => ({
        kind: 'RC',
        type: ['Philosophy', 'Science & Tech', 'Literature & Arts', 'Business'][idx],
        attempted: true,
        t: r(300, 480), // 5-8 mins
        qs: Array(4).fill(null).map(() => {
          const res = randRes();
          return { res, fmt: 'MCQ', t: r(30, 90), reason: res === 'W' ? randReason() : undefined }
        })
      })),
      va: [
        { type: 'PJ', qs: Array(2).fill(null).map(() => { const res = randRes(); return { res, fmt: 'TITA', t: r(60, 120), reason: res === 'W' ? randReason() : undefined } }) },
        { type: 'OS', qs: Array(2).fill(null).map(() => { const res = randRes(); return { res, fmt: 'TITA', t: r(60, 120), reason: res === 'W' ? randReason() : undefined } }) },
        { type: 'PC', qs: Array(2).fill(null).map(() => { const res = randRes(); return { res, fmt: 'MCQ', t: r(60, 120), reason: res === 'W' ? randReason() : undefined } }) },
        { type: 'PS', qs: Array(2).fill(null).map(() => { const res = randRes(); return { res, fmt: 'MCQ', t: r(60, 120), reason: res === 'W' ? randReason() : undefined } }) }
      ]
    },
    dilr: {
      sets: Array(4).fill(null).map((_, idx) => ({
        type: ['Table', 'Line graph', 'Linear arrangement', 'Matrix puzzle'][idx],
        attempted: true,
        t: r(400, 600),
        qs: Array(5).fill(null).map(() => { const res = randRes(); return { res, fmt: 'MCQ', t: r(45, 120), reason: res === 'W' ? randReason() : undefined } })
      }))
    },
    qa: {
      qs: Array(22).fill(null).map((_, idx) => {
        const res = randRes();
        return {
          res,
          fmt: 'MCQ',
          t: r(60, 180),
          subj: ['Arithmetic', 'Algebra', 'Geometry', 'Modern Math', 'Number Systems'][idx % 5],
          topic: 'Other',
          reason: res === 'W' ? randReason() : undefined
        }
      })
    },
    overall: {
      pct: r(85, 99)
    }
  };

  insertMock.run({
    id,
    data: JSON.stringify(mock)
  });
}

console.log('Done! Run `npm run dev` to view them.');
