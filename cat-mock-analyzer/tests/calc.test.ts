import { describe, it, expect } from 'vitest';
import {
  qMarks, listMarks, attempts, corrects, accuracy, sumQTime,
  readingTime, estimatePercentile, easyMissed, avgTimePerQ,
  avgTimePerCorrect, avgTimePerWrong, unusedTime, fmtSecs,
  calcVarcScore, calcDilrScore, calcQaScore,
} from '../src/calc';
import type { Q, Set, Mock } from '../src/types';

const M = { correct: 3, wrong: -1, skip: 0 };

// ── qMarks ────────────────────────────────────────────────────────────────────
describe('qMarks', () => {
  it('correct MCQ → +3', () => expect(qMarks({ res: 'C', fmt: 'MCQ' }, M)).toBe(3));
  it('wrong MCQ → -1',   () => expect(qMarks({ res: 'W', fmt: 'MCQ' }, M)).toBe(-1));
  it('wrong TITA → 0',   () => expect(qMarks({ res: 'W', fmt: 'TITA' }, M)).toBe(0));
  it('skip MCQ → 0',     () => expect(qMarks({ res: 'S', fmt: 'MCQ' }, M)).toBe(0));
  it('skip TITA → 0',    () => expect(qMarks({ res: 'S', fmt: 'TITA' }, M)).toBe(0));
  it('correct TITA → +3',() => expect(qMarks({ res: 'C', fmt: 'TITA' }, M)).toBe(3));
});

// ── listMarks ─────────────────────────────────────────────────────────────────
describe('listMarks', () => {
  it('mixed set', () => {
    const qs: Q[] = [
      { res: 'C', fmt: 'MCQ' },
      { res: 'W', fmt: 'MCQ' },
      { res: 'S', fmt: 'MCQ' },
    ];
    expect(listMarks(qs, M)).toBe(3 - 1 + 0); // 2
  });
  it('empty list → 0', () => expect(listMarks([], M)).toBe(0));
});

// ── attempts & accuracy ───────────────────────────────────────────────────────
describe('attempts / corrects / accuracy', () => {
  const qs: Q[] = [
    { res: 'C', fmt: 'MCQ' },
    { res: 'W', fmt: 'MCQ' },
    { res: 'S', fmt: 'MCQ' },
    { res: '',  fmt: 'MCQ' },
  ];
  it('attempts = C + W', () => expect(attempts(qs)).toBe(2));
  it('corrects = C only', () => expect(corrects(qs)).toBe(1));
  it('accuracy = 0.5',    () => expect(accuracy(qs)).toBeCloseTo(0.5));
  it('accuracy = 0 when none attempted', () => expect(accuracy([{ res: 'S', fmt: 'MCQ' }])).toBe(0));
});

// ── sumQTime ──────────────────────────────────────────────────────────────────
describe('sumQTime', () => {
  it('sums t values, skipping undefined', () => {
    const qs: Q[] = [{ res: 'C', fmt: 'MCQ', t: 30 }, { res: 'W', fmt: 'MCQ' }, { res: 'S', fmt: 'MCQ', t: 60 }];
    expect(sumQTime(qs)).toBe(90);
  });
});

// ── readingTime ───────────────────────────────────────────────────────────────
describe('readingTime', () => {
  const set: Set = {
    kind: 'RC', type: 'Philosophy', attempted: true,
    t: 300, qs: [{ res: 'C', fmt: 'MCQ', t: 60 }, { res: 'W', fmt: 'MCQ', t: 90 }],
  };
  it('reading time = set.t - Σqs.t', () => expect(readingTime(set)).toBe(150));
  it('can be negative', () => {
    const s2 = { ...set, t: 100 };
    expect(readingTime(s2)).toBe(-50);
  });
});

// ── estimatePercentile ────────────────────────────────────────────────────────
describe('estimatePercentile', () => {
  const table = [
    { score: 35, percentile: 80 },
    { score: 45, percentile: 85 },
    { score: 60, percentile: 95 },
    { score: 80, percentile: 99 },
  ];
  it('clamp below min', () => expect(estimatePercentile(20, table)).toBe(80));
  it('clamp above max', () => expect(estimatePercentile(100, table)).toBe(99));
  it('exact match', ()   => expect(estimatePercentile(45, table)).toBe(85));
  it('linear interp between 35-45', () => {
    // midpoint should be 82.5
    expect(estimatePercentile(40, table)).toBeCloseTo(82.5);
  });
  it('linear interp between 45-60', () => {
    // at 52.5 → 85 + (52.5-45)/(60-45) * (95-85) = 85 + 0.5 * 10 = 90
    expect(estimatePercentile(52.5, table)).toBeCloseTo(90);
  });
  it('empty table → 0', () => expect(estimatePercentile(50, [])).toBe(0));
});

// ── easyMissed ────────────────────────────────────────────────────────────────
describe('easyMissed', () => {
  const qs: Q[] = [
    { res: 'C', fmt: 'MCQ', lvl: 'E' },
    { res: 'W', fmt: 'MCQ', lvl: 'E' },
    { res: 'S', fmt: 'MCQ', lvl: 'E' },
    { res: 'W', fmt: 'MCQ', lvl: 'M' },
  ];
  it('returns only easy W/S', () => expect(easyMissed(qs)).toHaveLength(2));
});

// ── time per correct/wrong ────────────────────────────────────────────────────
describe('avgTimePerCorrect / avgTimePerWrong', () => {
  const qs: Q[] = [
    { res: 'C', fmt: 'MCQ', t: 60 },
    { res: 'C', fmt: 'MCQ', t: 120 },
    { res: 'W', fmt: 'MCQ', t: 30 },
  ];
  it('avgTimePerCorrect = (60+120)/2 = 90', () => expect(avgTimePerCorrect(qs)).toBeCloseTo(90));
  it('avgTimePerWrong   = 30',              () => expect(avgTimePerWrong(qs)).toBeCloseTo(30));
  it('avgTimePerQ       = (60+120+30)/3',   () => expect(avgTimePerQ(qs)).toBeCloseTo(70));
});

// ── unusedTime ────────────────────────────────────────────────────────────────
describe('unusedTime', () => {
  it('positive when under limit',  () => expect(unusedTime(1800, 40)).toBe(600));
  it('zero when exact',            () => expect(unusedTime(2400, 40)).toBe(0));
  it('negative when over limit',   () => expect(unusedTime(2500, 40)).toBe(-100));
});

// ── fmtSecs ───────────────────────────────────────────────────────────────────
describe('fmtSecs', () => {
  it('formats 90s → 01:30', () => expect(fmtSecs(90)).toBe('01:30'));
  it('formats 0  → 00:00', () => expect(fmtSecs(0)).toBe('00:00'));
  it('formats negative',    () => expect(fmtSecs(-65)).toBe('-01:05'));
  it('formats 3600 → 60:00', () => expect(fmtSecs(3600)).toBe('60:00'));
});

// ── section score with skipped sets ──────────────────────────────────────────
describe('calcVarcScore with skipped passage', () => {
  const mockBase: Mock = {
    id: 'test', name: 'T', date: '2024-01-01',
    varc: {
      rc: [
        {
          kind: 'RC', type: 'Philosophy', attempted: false,
          t: 0, qs: [{ res: 'C', fmt: 'MCQ' }, { res: 'C', fmt: 'MCQ' }],
        },
      ],
      va: [],
    },
    dilr: { sets: [] },
    qa: { qs: [] },
    overall: {},
  };
  it('skipped passage Qs count as S (0 marks)', () => {
    expect(calcVarcScore(mockBase, M)).toBe(0);
  });
});

describe('calcDilrScore with attempted sets', () => {
  const mock: Mock = {
    id: 'd1', name: 'D', date: '2024-01-01',
    varc: { rc: [], va: [] },
    dilr: {
      sets: [{
        kind: 'DI', type: 'Table', attempted: true,
        t: 300, qs: [{ res: 'C', fmt: 'MCQ' }, { res: 'W', fmt: 'MCQ' }],
      }],
    },
    qa: { qs: [] },
    overall: {},
  };
  it('3C + (-1)W = 2 marks', () => expect(calcDilrScore(mock, M)).toBe(2));
});
