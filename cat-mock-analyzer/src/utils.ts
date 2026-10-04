import type { Mock, Set as SetType, QA_Q, VAType } from './types';
import { VA_TYPES } from './data/options';

function emptyRcSet(): SetType {
  return {
    kind: 'RC', type: '', attempted: true, t: 0,
    qs: Array(4).fill(null).map(() => ({ res: '', fmt: 'MCQ' }))
  };
}

function emptyVaType(type: 'PJ' | 'OS' | 'PC' | 'PS'): VAType {
  const defaultFmt = VA_TYPES.find(t => t.value === type)?.defaultFmt ?? 'TITA';
  return {
    type,
    qs: Array(2).fill(null).map(() => ({ res: '', fmt: defaultFmt as 'TITA' | 'MCQ' }))
  };
}

export function createEmptyMock(id: string, name: string = '', date: string = ''): Mock {
  return {
    id,
    name,
    date,
    varc: {
      rc: Array(4).fill(null).map(() => emptyRcSet()),
      va: [
        emptyVaType('PJ'),
        emptyVaType('OS'),
        emptyVaType('PC'),
        emptyVaType('PS')
      ]
    },
    dilr: {
      sets: []
    },
    qa: {
      qs: Array(22).fill(null).map(() => ({ res: '', fmt: 'MCQ', subj: '', topic: '' }))
    },
    overall: {}
  };
}
