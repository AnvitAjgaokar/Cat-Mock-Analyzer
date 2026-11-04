import type { Mock, AppSettings } from './types';
import { varcTime, dilrTime, qaTime, accuracy, attempts, varcScore, dilrScore, qaScore } from './calc';
import { WRONG_REASONS_COMMON, WRONG_REASONS_RC, WRONG_REASONS_VA, WRONG_REASONS_DILR } from './data/options';

const VA_LABEL: Record<string, string> = { PJ: 'Para Jumble', OS: 'Odd Sentence', PC: 'Para Completion', PS: 'Para Summary' };

export function generateInsights(mocks: Mock[], settings: AppSettings): string[] {
  if (mocks.length === 0) return [];

  const insights: string[] = [];

  // Sort chronologically
  const sorted = [...mocks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const last5 = sorted.slice(-5);
  const limits = settings.sectionMinutes;
  const mScheme = settings.marking;

  // Build reason→cat map
  const rMap = Object.fromEntries(
    [...WRONG_REASONS_COMMON, ...WRONG_REASONS_RC, ...WRONG_REASONS_VA, ...WRONG_REASONS_DILR]
      .map(r => [r.value, r.cat])
  );

  // ── 1. Time Management: unused time per section ──
  const avgUnused = (secFn: (m: Mock) => number, limitKey: keyof typeof limits) => {
    const vals = last5.map(m => Math.max(0, limits[limitKey] * 60 - secFn(m)));
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const dilrUnused = avgUnused(dilrTime, 'dilr');
  const varcUnused = avgUnused(varcTime, 'varc');
  const qaUnused   = avgUnused(qaTime, 'qa');

  if (dilrUnused > 360) {
    insights.push(`DILR unused time averages ${Math.round(dilrUnused / 60)} min — you may be leaving sets too early or running short on sets.`);
  }
  if (varcUnused > 300) {
    insights.push(`VARC unused time averages ${Math.round(varcUnused / 60)} min — consider attempting more RC passages or slowing down on VA.`);
  }
  if (qaUnused > 300) {
    insights.push(`QA unused time averages ${Math.round(qaUnused / 60)} min — there's room to attempt more questions.`);
  }

  // ── 2. Calculation/Silly Errors ──
  const countCalcErrors = (ms: Mock[]) => {
    let total = 0, count = 0;
    ms.forEach(m => {
      const qs = [
        ...(m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []),
        ...(m.varc?.va ?? []).flatMap(v => v.qs),
        ...(m.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : []),
        ...(m.qa?.qs ?? []),
      ];
      qs.forEach(q => {
        if (q.res === 'W' && q.reason && rMap[q.reason] === 'Calculation') count++;
      });
      total++;
    });
    return total > 0 ? count / total : 0;
  };

  if (last5.length >= 2) {
    const recent = countCalcErrors(last5.slice(-2));
    const older  = countCalcErrors(last5.slice(0, Math.max(1, last5.length - 2)));
    if (recent > older * 1.3 && recent > 1.5) {
      insights.push(`Calculation errors trending UP (avg ${recent.toFixed(1)}/mock recently). Double-check arithmetic and scratchpad hygiene.`);
    }
  }

  // ── 3. QA subject accuracy ──
  const subjStats: Record<string, { att: number; cor: number }> = {};
  last5.forEach(m => {
    (m.qa?.qs ?? []).forEach(q => {
      if (!q.subj) return;
      if (!subjStats[q.subj]) subjStats[q.subj] = { att: 0, cor: 0 };
      if (q.res === 'C' || q.res === 'W') subjStats[q.subj].att++;
      if (q.res === 'C') subjStats[q.subj].cor++;
    });
  });

  let worstSubj = '';
  let worstAcc = 1;
  Object.entries(subjStats).forEach(([subj, s]) => {
    if (s.att >= 5) {
      const acc = s.cor / s.att;
      if (acc < worstAcc) { worstAcc = acc; worstSubj = subj; }
      if (acc > 0.85) {
        insights.push(`${subj} is a strength — ${Math.round(acc * 100)}% accuracy. Keep it steady.`);
      }
    }
  });
  if (worstSubj && worstAcc < 0.5) {
    insights.push(`${worstSubj} accuracy is only ${Math.round(worstAcc * 100)}% across recent mocks. This is your highest-priority revision area.`);
  }

  // ── 4. Time per correct vs wrong ──
  let cT = 0, cN = 0, wT = 0, wN = 0;
  last5.forEach(m => {
    const qs = [
      ...(m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []),
      ...(m.varc?.va ?? []).flatMap(v => v.qs),
      ...(m.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : []),
      ...(m.qa?.qs ?? []),
    ];
    qs.forEach(q => {
      if ((q.t ?? 0) > 0) {
        if (q.res === 'C') { cT += q.t!; cN++; }
        if (q.res === 'W') { wT += q.t!; wN++; }
      }
    });
  });
  if (cN > 0 && wN > 0) {
    const avgC = cT / cN, avgW = wT / wN;
    if (avgW > avgC * 1.6 && avgW > 100) {
      insights.push(`You spend ${Math.round(avgW)}s on wrong answers vs ${Math.round(avgC)}s on correct ones. Learn to let go faster when stuck.`);
    }
  }

  // ── 5. RC vs VA gap ──
  let rcC = 0, rcA = 0, vaC = 0, vaA = 0;
  last5.forEach(m => {
    const rcQs = (m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []);
    const vaQs = (m.varc?.va ?? []).flatMap(v => v.qs);
    rcA += rcQs.filter(q => q.res === 'C' || q.res === 'W').length;
    rcC += rcQs.filter(q => q.res === 'C').length;
    vaA += vaQs.filter(q => q.res === 'C' || q.res === 'W').length;
    vaC += vaQs.filter(q => q.res === 'C').length;
  });
  if (rcA >= 5 && vaA >= 3) {
    const rcAcc = rcC / rcA, vaAcc = vaC / vaA;
    if (rcAcc - vaAcc > 0.25) {
      insights.push(`RC accuracy (${Math.round(rcAcc * 100)}%) is significantly better than VA (${Math.round(vaAcc * 100)}%). Focus VA practice.`);
    } else if (vaAcc - rcAcc > 0.25) {
      insights.push(`VA accuracy (${Math.round(vaAcc * 100)}%) is leading RC (${Math.round(rcAcc * 100)}%). Focus on RC reading speed.`);
    }
  }

  // ── 6. DILR — accuracy of attempted sets ──
  let dilrSetAtt = 0, dilrSetCor = 0;
  last5.forEach(m => {
    (m.dilr?.sets ?? []).filter(s => s.attempted).forEach(s => {
      s.qs.forEach(q => {
        if (q.res === 'C' || q.res === 'W') dilrSetAtt++;
        if (q.res === 'C') dilrSetCor++;
      });
    });
  });
  if (dilrSetAtt >= 10) {
    const dilrAcc = dilrSetCor / dilrSetAtt;
    if (dilrAcc < 0.5) {
      insights.push(`DILR accuracy on attempted sets is low (${Math.round(dilrAcc * 100)}%). Consider being more selective — prioritise sets you can solve fully.`);
    } else if (dilrAcc > 0.80) {
      insights.push(`Strong DILR accuracy (${Math.round(dilrAcc * 100)}%) on attempted sets. Try attempting one more set per mock.`);
    }
  }

  // ── 7. Easy questions missed ──
  let easyMissed = 0;
  last5.forEach(m => {
    const all = [
      ...(m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []),
      ...(m.varc?.va ?? []).flatMap(v => v.qs),
      ...(m.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : []),
      ...(m.qa?.qs ?? []),
    ];
    easyMissed += all.filter(q => q.lvl === 'E' && (q.res === 'W' || q.res === 'S')).length;
  });
  const avgEasyMissed = easyMissed / last5.length;
  if (avgEasyMissed >= 2) {
    insights.push(`Averaging ${avgEasyMissed.toFixed(1)} easy questions missed/skipped per mock — these are free marks. Review the Missed Opportunities section.`);
  }

  // Fallback
  if (insights.length === 0) {
    insights.push('Good data logged. Check the section charts for detailed patterns.');
  }

  return insights.slice(0, 5);
}
