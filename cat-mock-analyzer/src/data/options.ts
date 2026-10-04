// §4 Dropdown options — plain constants, easy to edit.
// Every reason option carries a `cat` for analytics bucketing.

export type ReasonCat = 'Concept' | 'Calculation' | 'Time' | 'Strategy' | 'Comprehension';

export interface ReasonOption {
  label: string;
  value: string;
  cat: ReasonCat;
}

// ── Wrong reasons (common) ────────────────────────────────────────────────────
export const WRONG_REASONS_COMMON: ReasonOption[] = [
  { label: 'Concept gap',               value: 'concept_gap',           cat: 'Concept' },
  { label: 'Forgot formula',            value: 'forgot_formula',        cat: 'Concept' },
  { label: 'Wrong approach',            value: 'wrong_approach',        cat: 'Concept' },
  { label: 'Calculation error',         value: 'calc_error',            cat: 'Calculation' },
  { label: 'Silly mistake',             value: 'silly_mistake',         cat: 'Calculation' },
  { label: 'Misread question',          value: 'misread_question',      cat: 'Comprehension' },
  { label: 'Rushed / time pressure',    value: 'time_pressure',         cat: 'Time' },
  { label: 'Blind guess',               value: 'blind_guess',           cat: 'Strategy' },
  { label: 'Overthought',               value: 'overthought',           cat: 'Strategy' },
  { label: 'Two options left, picked wrong', value: 'two_options',     cat: 'Strategy' },
  { label: 'Other…',                    value: 'other',                 cat: 'Strategy' },
];

// ── Wrong reasons (RC) ────────────────────────────────────────────────────────
export const WRONG_REASONS_RC: ReasonOption[] = [
  { label: 'Misread passage',           value: 'misread_passage',       cat: 'Comprehension' },
  { label: 'Extreme-option trap',       value: 'extreme_option',        cat: 'Comprehension' },
  { label: 'Out-of-scope inference',    value: 'out_of_scope',          cat: 'Comprehension' },
  { label: 'Tone / author-view mismatch', value: 'tone_mismatch',      cat: 'Comprehension' },
  { label: 'Two options confused',      value: 'two_options_rc',        cat: 'Comprehension' },
  { label: 'Did not understand passage', value: 'not_understood',       cat: 'Comprehension' },
  { label: 'Other…',                    value: 'other',                 cat: 'Comprehension' },
];

// ── Wrong reasons (VA) ────────────────────────────────────────────────────────
export const WRONG_REASONS_VA: ReasonOption[] = [
  { label: 'Missed opening/closing sentence', value: 'opening_closing', cat: 'Comprehension' },
  { label: 'Missed connector / pronoun link', value: 'connector',       cat: 'Comprehension' },
  { label: 'Theme mismatch',            value: 'theme_mismatch',        cat: 'Comprehension' },
  { label: 'Grammar cue ignored',       value: 'grammar_cue',           cat: 'Comprehension' },
  { label: 'Weak vocabulary',           value: 'weak_vocab',            cat: 'Concept' },
  { label: 'Other…',                    value: 'other',                 cat: 'Comprehension' },
];

// ── Wrong reasons (DILR) ─────────────────────────────────────────────────────
export const WRONG_REASONS_DILR: ReasonOption[] = [
  { label: 'Misread a condition',       value: 'misread_condition',     cat: 'Comprehension' },
  { label: 'Wrong set-up / table',      value: 'wrong_setup',           cat: 'Concept' },
  { label: 'Case-work error',           value: 'casework_error',        cat: 'Calculation' },
  { label: 'Missed a constraint',       value: 'missed_constraint',     cat: 'Comprehension' },
  { label: 'Calculation slip',          value: 'calc_slip',             cat: 'Calculation' },
  { label: 'Data interpretation error', value: 'di_error',              cat: 'Comprehension' },
  { label: 'Other…',                    value: 'other',                 cat: 'Calculation' },
];

// ── Skip reasons (question) ───────────────────────────────────────────────────
export const SKIP_REASONS_Q: ReasonOption[] = [
  { label: 'Too long',                  value: 'too_long',              cat: 'Time' },
  { label: 'Too difficult / no idea',   value: 'too_difficult',         cat: 'Concept' },
  { label: 'Ran out of time',           value: 'ran_out_of_time',       cat: 'Time' },
  { label: 'Strategic skip',            value: 'strategic_skip',        cat: 'Strategy' },
  { label: 'Low confidence (fear of negative)', value: 'low_confidence', cat: 'Strategy' },
  { label: 'Did not reach it',          value: 'did_not_reach',         cat: 'Time' },
  { label: 'Concept not covered',       value: 'concept_not_covered',   cat: 'Concept' },
  { label: 'Other…',                    value: 'other',                 cat: 'Strategy' },
];

// ── Skip reasons (set/passage) ────────────────────────────────────────────────
export const SKIP_REASONS_SET: ReasonOption[] = [
  { label: 'Unfamiliar / dense topic',  value: 'unfamiliar',            cat: 'Concept' },
  { label: 'Looked too long',           value: 'too_long_set',          cat: 'Time' },
  { label: 'Tried and abandoned',       value: 'abandoned',             cat: 'Strategy' },
  { label: 'Ran out of time',           value: 'ran_out_of_time',       cat: 'Time' },
  { label: 'Wrong set selection',       value: 'wrong_selection',       cat: 'Strategy' },
  { label: 'Other…',                    value: 'other',                 cat: 'Strategy' },
];

// ── RC genre ──────────────────────────────────────────────────────────────────
export const RC_GENRES = [
  'Philosophy', 'Sociology', 'Economics', 'History', 'Science & Tech',
  'Literature & Arts', 'Politics & Law', 'Psychology', 'Environment',
  'Business', 'Other',
];

// ── RC question type ──────────────────────────────────────────────────────────
export const RC_Q_TYPES = [
  'Main idea', 'Inference', 'Factual detail', 'Tone / attitude',
  'Vocabulary in context', 'Application', 'Except / NOT', 'Structure / purpose',
];

// ── VA types (with default fmt) ───────────────────────────────────────────────
export const VA_TYPES = [
  { value: 'PJ', label: 'Para Jumble',    defaultFmt: 'TITA' },
  { value: 'OS', label: 'Odd Sentence',   defaultFmt: 'TITA' },
  { value: 'PC', label: 'Para Completion', defaultFmt: 'MCQ' },
  { value: 'PS', label: 'Para Summary',   defaultFmt: 'MCQ' },
] as const;

// ── DI set types ──────────────────────────────────────────────────────────────
export const DI_TYPES = [
  'Table', 'Bar graph', 'Line graph', 'Pie chart', 'Caselet',
  'Mixed graphs', 'Venn / Sets', 'Network / Flow', 'Other',
];

// ── LR set types ──────────────────────────────────────────────────────────────
export const LR_TYPES = [
  'Linear arrangement', 'Circular arrangement', 'Selection / Grouping',
  'Games & Tournaments', 'Scheduling / Timetable', 'Network / Routes',
  'Matrix puzzle', 'Truth–Lie / Binary logic', 'Other',
];

// ── Perceived level ───────────────────────────────────────────────────────────
export const LEVELS = [
  { value: 'E', label: 'Easy' },
  { value: 'M', label: 'Medium' },
  { value: 'H', label: 'Hard' },
];

// ── Mock sources ──────────────────────────────────────────────────────────────
export const SOURCES = ['Cracku', 'iQuanta', 'MBA Karo', 'TIME', 'IMS', 'CL', 'Other'];

// ── QA taxonomy ──────────────────────────────────────────────────────────────
export const QA_SUBJECTS = ['Arithmetic', 'Algebra', 'Geometry', 'Modern Math', 'Number Systems'] as const;
export type QASubject = (typeof QA_SUBJECTS)[number];

export const QA_TOPICS: Record<QASubject, string[]> = {
  Arithmetic: [
    'Percentages', 'Profit & Loss', 'Discount', 'Ratio & Proportion', 'Averages',
    'Mixtures & Alligation', 'Partnership', 'SI & CI', 'Time-Speed-Distance',
    'Time & Work', 'Pipes & Cisterns', 'Boats & Streams', 'Races', 'Variation', 'Other',
  ],
  Algebra: [
    'Linear Equations', 'Quadratic Equations', 'Inequalities', 'Polynomials & Roots',
    'Functions & Graphs', 'Logarithms', 'Surds & Indices', 'Modulus', 'Maxima & Minima',
    'Progressions (AP/GP/HP)', 'Other',
  ],
  Geometry: [
    'Lines & Angles', 'Triangles', 'Circles', 'Quadrilaterals & Polygons', 'Mensuration',
    'Coordinate Geometry', 'Trigonometry', 'Heights & Distances', 'Other',
  ],
  'Modern Math': [
    'Permutation & Combination', 'Probability', 'Set Theory / Venn', 'Binomial Theorem', 'Other',
  ],
  'Number Systems': [
    'Divisibility & Factors', 'HCF & LCM', 'Remainders', 'Base Systems',
    'Unit Digit & Cyclicity', 'Factorials / Highest Power', 'Number of Zeros', 'Primes', 'Other',
  ],
};
