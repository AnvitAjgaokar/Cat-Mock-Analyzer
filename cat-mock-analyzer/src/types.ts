// §2 Data model

export type Sec = number;                        // seconds everywhere
export type Res = '' | 'C' | 'W' | 'S';         // unset | Correct | Wrong | Skipped
export type Fmt = 'MCQ' | 'TITA';
export type Lvl = '' | 'E' | 'M' | 'H';         // perceived difficulty

export interface Q {
  res: Res;
  reason?: string;
  reasonOther?: string;
  t?: Sec;
  fmt: Fmt;
  lvl?: Lvl;
  qtype?: string;
}

export interface QA_Q extends Q {
  subj: string;
  topic: string;
}

export interface Set {
  kind: 'RC' | 'DI' | 'LR';
  type: string;                   // genre (RC) or set type (DI/LR)
  lvl?: Lvl;
  attempted: boolean;
  skipReason?: string;            // only if !attempted
  t: Sec;                         // total time on set (manual)
  qs: Q[];                        // length = chosen question count
}

/** VA card: Para Jumble | Odd Sentence | Para Completion | Para Summary */
export interface VAType {
  type: 'PJ' | 'OS' | 'PC' | 'PS';
  qs: Q[];  // always 2
}

export interface SectionMeta {
  score?: number;     // official, overrides calc
  pct?: number;       // percentile
  tOverride?: Sec;    // override total time
  notes?: string;
}

export interface Mock {
  id: string;
  name: string;
  date: string;
  source?: string;
  demo?: boolean;
  varc: SectionMeta & { rc: Set[]; va: VAType[] };
  dilr: SectionMeta & { sets: Set[] };
  qa: SectionMeta & { qs: QA_Q[] };
  overall: {
    score?: number;
    pct?: number;
    rank?: number;
    takers?: number;
    learnings?: string;
    actions?: string;
  };
}

// Settings stored in DB
export interface AppSettings {
  targetPercentile: number;
  marking: { correct: number; wrong: number; skip: number };
  sectionMinutes: { varc: number; dilr: number; qa: number };
  scorePercentileTable: Array<{ score: number; percentile: number }>;
  theme: 'light' | 'dark';
}
