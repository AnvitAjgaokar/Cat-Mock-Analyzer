// §3 Calculations — pure functions, no side-effects.
import type { Q, QA_Q, Set, VAType, Mock, AppSettings } from './types';

// ── Marking ───────────────────────────────────────────────────────────────────

export interface Marking {
  correct: number;   // default +3
  wrong: number;     // default -1 (for MCQ only)
  skip: number;      // default 0
}

const DEFAULT_MARKING: Marking = { correct: 3, wrong: -1, skip: 0 };

/** Marks for a single question. TITA wrong = 0, TITA skip = 0. */
export function qMarks(q: Q, m: Marking = DEFAULT_MARKING): number {
  if (q.res === 'C') return m.correct;
  if (q.res === 'W') return q.fmt === 'MCQ' ? m.wrong : 0;
  return 0; // S or ''
}

/** Marks for a list of questions. */
export function listMarks(qs: Q[], m: Marking = DEFAULT_MARKING): number {
  return qs.reduce((sum, q) => sum + qMarks(q, m), 0);
}

// ── Attempts & Accuracy ───────────────────────────────────────────────────────

export function attempts(qs: Q[]): number {
  return qs.filter((q) => q.res === 'C' || q.res === 'W').length;
}

export function corrects(qs: Q[]): number {
  return qs.filter((q) => q.res === 'C').length;
}

/** accuracy = C / attempts; 0 if none attempted. */
export function accuracy(qs: Q[]): number {
  const att = attempts(qs);
  return att === 0 ? 0 : corrects(qs) / att;
}

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Sum of q.t values (0 for undefined). */
export function sumQTime(qs: Q[]): number {
  return qs.reduce((s, q) => s + (q.t ?? 0), 0);
}

/** reading/setup time = set.t − Σqs.t; can be negative (soft warn). */
export function readingTime(set: Set): number {
  return set.t - sumQTime(set.qs);
}

/** VA type time = Σqs.t */
export function vaTypeTime(va: VAType): number {
  return sumQTime(va.qs);
}

/** Total seconds for VARC: RC + VA totals. tOverride wins. */
export function varcTime(mock: Mock): number {
  if (mock.varc?.tOverride != null) return mock.varc.tOverride;
  const rcTotal = mock.varc?.rc?.reduce((s, p) => s + p.t, 0) ?? 0;
  const vaTotal = mock.varc?.va?.reduce((s, v) => s + vaTypeTime(v), 0) ?? 0;
  return rcTotal + vaTotal;
}

/** Total seconds for DILR. tOverride wins. */
export function dilrTime(mock: Mock): number {
  if (mock.dilr?.tOverride != null) return mock.dilr.tOverride;
  return mock.dilr?.sets?.reduce((s, set) => s + set.t, 0) ?? 0;
}

/** Total seconds for QA. tOverride wins. */
export function qaTime(mock: Mock): number {
  if (mock.qa?.tOverride != null) return mock.qa.tOverride;
  return sumQTime(mock.qa?.qs ?? []);
}

// ── Section scores ────────────────────────────────────────────────────────────

/** All questions from RC sets (flattened). */
function rcQs(mock: Mock): Q[] {
  // Set-skipped passages: all their qs count as S
  return (mock.varc?.rc ?? []).flatMap((p) =>
    p.attempted ? p.qs : p.qs.map((q) => ({ ...q, res: 'S' as const })),
  );
}

function vaQs(mock: Mock): Q[] {
  return (mock.varc?.va ?? []).flatMap((v) => v.qs);
}

function allVarcQs(mock: Mock): Q[] {
  return [...rcQs(mock), ...vaQs(mock)];
}

function dilrQs(mock: Mock): Q[] {
  return (mock.dilr?.sets ?? []).flatMap((s) =>
    s.attempted ? s.qs : s.qs.map((q) => ({ ...q, res: 'S' as const })),
  );
}

/** Calculated VARC score. */
export function calcVarcScore(mock: Mock, m: Marking = DEFAULT_MARKING): number {
  return listMarks(allVarcQs(mock), m);
}

/** Calculated DILR score. */
export function calcDilrScore(mock: Mock, m: Marking = DEFAULT_MARKING): number {
  return listMarks(dilrQs(mock), m);
}

/** Calculated QA score. */
export function calcQaScore(mock: Mock, m: Marking = DEFAULT_MARKING): number {
  return listMarks(mock.qa?.qs ?? [], m);
}

/** Effective VARC score (official overrides calculated). */
export function varcScore(mock: Mock, m: Marking = DEFAULT_MARKING): number {
  return mock.varc?.score ?? calcVarcScore(mock, m);
}

/** Effective DILR score. */
export function dilrScore(mock: Mock, m: Marking = DEFAULT_MARKING): number {
  return mock.dilr?.score ?? calcDilrScore(mock, m);
}

/** Effective QA score. */
export function qaScore(mock: Mock, m: Marking = DEFAULT_MARKING): number {
  return mock.qa?.score ?? calcQaScore(mock, m);
}

/** Effective total score. */
export function totalScore(mock: Mock, m: Marking = DEFAULT_MARKING): number {
  return (mock.overall?.score ?? (varcScore(mock, m) + dilrScore(mock, m) + qaScore(mock, m)));
}

// ── Percentile estimation ─────────────────────────────────────────────────────

export interface ScorePctRow { score: number; percentile: number }

/**
 * Linear interpolation from the score→percentile table.
 * Clamps to table min/max.
 */
export function estimatePercentile(score: number, table: ScorePctRow[]): number {
  if (table.length === 0) return 0;
  const sorted = [...table].sort((a, b) => a.score - b.score);
  if (score <= sorted[0].score) return sorted[0].percentile;
  if (score >= sorted[sorted.length - 1].score) return sorted[sorted.length - 1].percentile;
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (score >= lo.score && score <= hi.score) {
      const t = (score - lo.score) / (hi.score - lo.score);
      return lo.percentile + t * (hi.percentile - lo.percentile);
    }
  }
  return 0;
}

// ── Derived metrics ───────────────────────────────────────────────────────────

/** Questions that were easy AND wrong/skipped. */
export function easyMissed(qs: Q[]): Q[] {
  return qs.filter((q) => q.lvl === 'E' && (q.res === 'W' || q.res === 'S'));
}

/** Avg time per question (excludes undefined times). */
export function avgTimePerQ(qs: Q[]): number {
  const timed = qs.filter((q) => q.t != null);
  if (timed.length === 0) return 0;
  return timed.reduce((s, q) => s + (q.t ?? 0), 0) / timed.length;
}

/** Avg time per correct answer. */
export function avgTimePerCorrect(qs: Q[]): number {
  const correct = qs.filter((q) => q.res === 'C' && q.t != null);
  if (correct.length === 0) return 0;
  return correct.reduce((s, q) => s + (q.t ?? 0), 0) / correct.length;
}

/** Avg time per wrong answer. */
export function avgTimePerWrong(qs: Q[]): number {
  const wrong = qs.filter((q) => q.res === 'W' && q.t != null);
  if (wrong.length === 0) return 0;
  return wrong.reduce((s, q) => s + (q.t ?? 0), 0) / wrong.length;
}

/** Error-category counts from reason options. */
export function errorCategoryCounts(qs: Q[], reasonMap: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of qs) {
    if ((q.res === 'W' || q.res === 'S') && q.reason) {
      const cat = reasonMap[q.reason] ?? 'Other';
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
  }
  return counts;
}

/** Slowest N questions (by q.t descending). */
export function slowestQs(qs: Q[], n = 5): Q[] {
  return [...qs]
    .filter((q) => q.t != null)
    .sort((a, b) => (b.t ?? 0) - (a.t ?? 0))
    .slice(0, n);
}

/** Unused time in seconds for a section. Positive = time left. */
export function unusedTime(usedSecs: number, limitMins: number): number {
  return limitMins * 60 - usedSecs;
}

// ── QA per-subject/topic stats ────────────────────────────────────────────────
export interface SubjectStats {
  subj: string;
  total: number;
  correct: number;
  attempted: number;
  accuracy: number;
}

export function qaSubjectStats(qs: QA_Q[]): SubjectStats[] {
  const map: Record<string, { total: number; correct: number; attempted: number }> = {};
  for (const q of qs) {
    if (!map[q.subj]) map[q.subj] = { total: 0, correct: 0, attempted: 0 };
    map[q.subj].total++;
    if (q.res === 'C' || q.res === 'W') map[q.subj].attempted++;
    if (q.res === 'C') map[q.subj].correct++;
  }
  return Object.entries(map).map(([subj, s]) => ({
    subj,
    ...s,
    accuracy: s.attempted === 0 ? 0 : s.correct / s.attempted,
  }));
}

// ── Format helpers (not "calculations" per se, but keep co-located) ───────────
export function fmtSecs(s: number): string {
  const neg = s < 0;
  const abs = Math.abs(Math.round(s));
  const mm = Math.floor(abs / 60).toString().padStart(2, '0');
  const ss = (abs % 60).toString().padStart(2, '0');
  return (neg ? '-' : '') + `${mm}:${ss}`;
}

// ── Validation & Normalisation ────────────────────────────────────────────────
export function normaliseMock(m: Mock): Mock {
  m.varc?.rc?.forEach(p => {
    // Pad or trim to exactly 4
    while (p.qs.length < 4) {
      p.qs.push({ res: '', fmt: 'MCQ' });
    }
    while (p.qs.length > 4) {
      const last = p.qs[p.qs.length - 1];
      if (last.res === '' && (last.t === undefined || last.t === 0)) {
        p.qs.pop();
      } else {
        break; // Stop if we hit a filled extra question
      }
    }
    // Lock format to MCQ
    p.qs.forEach(q => q.fmt = 'MCQ');
  });

  m.varc?.va?.forEach(v => {
    v.qs.forEach(q => {
      q.fmt = (v.type === 'PJ' || v.type === 'OS') ? 'TITA' : 'MCQ';
    });
  });
  return m;
}

export interface MissingField {
  section: string;
  label: string;
}

export function getMissingFields(mock: Mock): MissingField[] {
  const missing: MissingField[] = [];
  if (!mock.name) missing.push({ section: 'info', label: 'Name is required' });
  if (!mock.date) missing.push({ section: 'info', label: 'Date is required' });

  // VARC
  mock.varc?.rc?.forEach((p, i) => {
    if (!p.type) missing.push({ section: 'varc', label: `Passage ${i+1} Genre` });
    if (p.t === undefined || p.t === 0) missing.push({ section: 'varc', label: `Passage ${i+1} Time` });
    if (!p.attempted && !p.skipReason) missing.push({ section: 'varc', label: `Passage ${i+1} Skip Reason` });
    if (p.attempted) {
      p.qs.forEach((q, qIdx) => {
        if (!q.res) missing.push({ section: 'varc', label: `Passage ${i+1} Q${qIdx+1} Result` });
        if (q.t === undefined) missing.push({ section: 'varc', label: `Passage ${i+1} Q${qIdx+1} Time` });
        if ((q.res === 'W' || q.res === 'S') && !q.reason) missing.push({ section: 'varc', label: `Passage ${i+1} Q${qIdx+1} Reason` });
      });
    }
  });
  
  mock.varc?.va?.forEach((v, i) => {
    v.qs.forEach((q, qIdx) => {
      if (!q.res) missing.push({ section: 'varc', label: `${v.type} Q${qIdx+1} Result` });
      if (q.t === undefined) missing.push({ section: 'varc', label: `${v.type} Q${qIdx+1} Time` });
      if ((q.res === 'W' || q.res === 'S') && !q.reason) missing.push({ section: 'varc', label: `${v.type} Q${qIdx+1} Reason` });
    });
  });

  // DILR
  if (!mock.dilr?.sets || mock.dilr.sets.length === 0) {
    missing.push({ section: 'dilr', label: 'At least 1 DILR set is required' });
  }
  mock.dilr?.sets?.forEach((s, i) => {
    if (!s.type) missing.push({ section: 'dilr', label: `Set ${i+1} Type` });
    if (s.t === undefined || s.t === 0) missing.push({ section: 'dilr', label: `Set ${i+1} Time` });
    if (!s.attempted && !s.skipReason) missing.push({ section: 'dilr', label: `Set ${i+1} Skip Reason` });
    if (s.attempted) {
      s.qs.forEach((q, qIdx) => {
        if (!q.res) missing.push({ section: 'dilr', label: `Set ${i+1} Q${qIdx+1} Result` });
        if (q.t === undefined) missing.push({ section: 'dilr', label: `Set ${i+1} Q${qIdx+1} Time` });
        if ((q.res === 'W' || q.res === 'S') && !q.reason) missing.push({ section: 'dilr', label: `Set ${i+1} Q${qIdx+1} Reason` });
      });
    }
  });

  // QA
  if (!mock.qa?.qs || mock.qa.qs.length === 0) {
    missing.push({ section: 'qa', label: 'At least 1 QA question is required' });
  }
  mock.qa?.qs?.forEach((q, qIdx) => {
    if (!q.res) missing.push({ section: 'qa', label: `Q${qIdx+1} Result` });
    if (q.t === undefined) missing.push({ section: 'qa', label: `Q${qIdx+1} Time` });
    if ((q.res === 'W' || q.res === 'S') && !q.reason) missing.push({ section: 'qa', label: `Q${qIdx+1} Reason` });
    if (!q.subj) missing.push({ section: 'qa', label: `Q${qIdx+1} Subject` });
    if (!q.topic) missing.push({ section: 'qa', label: `Q${qIdx+1} Topic` });
  });

  return missing;
}
