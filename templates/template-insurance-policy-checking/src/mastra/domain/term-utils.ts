import type { Term } from './reconciliation-contracts.js';

export const normalizeText = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

/** Category and key remain exact; scope formatting does not create another term. */
export function termKey(term: Pick<Term, 'category' | 'key' | 'scope'>): string {
  return JSON.stringify([term.category, term.key, normalizeText(term.scope)]);
}

export const sameTerm = (
  left: Pick<Term, 'category' | 'key' | 'scope'>,
  right: Pick<Term, 'category' | 'key' | 'scope'>,
) => termKey(left) === termKey(right);
