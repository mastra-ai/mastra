import { describe, expect, it } from 'vitest';

import type { FactoryMentionMember } from '../../services/members';
import { findMentionQuery, matchMembers, mentionLabel, resolveMentions } from './mentions';

const ada: FactoryMentionMember = { id: 'user-ada', name: 'Ada' };
const alan: FactoryMentionMember = { id: 'user-alan', name: 'Alan' };
const anonymous: FactoryMentionMember = { id: 'user-raw' };

describe('findMentionQuery', () => {
  it('finds the @query the caret sits in', () => {
    expect(findMentionQuery('hey @Ad', 7)).toEqual({ atIndex: 4, query: 'Ad' });
  });

  it('triggers at the start of the text', () => {
    expect(findMentionQuery('@A', 2)).toEqual({ atIndex: 0, query: 'A' });
  });

  it('ignores an @ glued to a word (emails)', () => {
    expect(findMentionQuery('mail damien@mas', 15)).toBeUndefined();
  });

  it('stops at whitespace between @ and caret', () => {
    expect(findMentionQuery('@Ada thanks', 11)).toBeUndefined();
  });

  it('rejects a query longer than 32 chars', () => {
    expect(findMentionQuery(`@${'a'.repeat(33)}`, 34)).toBeUndefined();
  });

  it('only looks left of the caret', () => {
    expect(findMentionQuery('hi @Ada', 2)).toBeUndefined();
  });
});

describe('matchMembers', () => {
  it('prefix-matches case-insensitively', () => {
    expect(matchMembers([ada, alan], 'al')).toEqual([alan]);
    expect(matchMembers([ada, alan], 'A')).toEqual([ada, alan]);
  });

  it('falls back to the id when the member has no name', () => {
    expect(mentionLabel(anonymous)).toBe('user-raw');
    expect(matchMembers([anonymous], 'user')).toEqual([anonymous]);
  });

  it('caps matches at 8', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `u${i}`, name: `Ann${i}` }));
    expect(matchMembers(many, 'ann')).toHaveLength(8);
  });
});

describe('resolveMentions', () => {
  it('keeps only members whose @Name survives in the body, in appearance order', () => {
    expect(resolveMentions('@Alan then @Ada', [ada, alan])).toEqual([
      { kind: 'user', id: 'user-alan' },
      { kind: 'user', id: 'user-ada' },
    ]);
  });

  it('drops a mention whose name was deleted from the text', () => {
    expect(resolveMentions('thanks Ada', [ada])).toEqual([]);
  });

  it('dedupes a member mentioned twice', () => {
    expect(resolveMentions('@Ada and @Ada again', [ada])).toEqual([{ kind: 'user', id: 'user-ada' }]);
  });

  it('never matches a name inside a longer name', () => {
    const ana: FactoryMentionMember = { id: 'user-ana', name: 'Ana' };
    const anastasia: FactoryMentionMember = { id: 'user-anastasia', name: 'Anastasia' };
    expect(resolveMentions('ping @Anastasia', [ana, anastasia])).toEqual([{ kind: 'user', id: 'user-anastasia' }]);
    expect(resolveMentions('@Anastasia then @Ana', [ana, anastasia])).toEqual([
      { kind: 'user', id: 'user-anastasia' },
      { kind: 'user', id: 'user-ana' },
    ]);
    expect(resolveMentions('@Ana, hi', [ana])).toEqual([{ kind: 'user', id: 'user-ana' }]);
  });

  it('takes the longest name at one @, not every name that starts it', () => {
    const ana: FactoryMentionMember = { id: 'user-ana', name: 'Ana' };
    const anaMaria: FactoryMentionMember = { id: 'user-ana-maria', name: 'Ana Maria' };
    expect(resolveMentions('hi @Ana Maria', [ana, anaMaria])).toEqual([{ kind: 'user', id: 'user-ana-maria' }]);
  });

  it('caps at 20 mentions', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `u${i}`, name: `M${i}x` }));
    const body = many.map(member => `@${member.name}`).join(' ');
    expect(resolveMentions(body, many)).toHaveLength(20);
  });
});
