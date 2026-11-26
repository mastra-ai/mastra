import { describe, expect, it } from 'vitest';
import { findKnowledgeMentions } from './knowledge-mentions';

describe('findKnowledgeMentions', () => {
  it('links resolved page names and leaves unresolved names in the text', () => {
    const text = 'Raised to $150, see [[Escalation Process]] and [[Old Runbook]].';
    expect(findKnowledgeMentions(text)).toEqual([
      {
        index: text.indexOf('[[Escalation Process]]'),
        ref: 'Escalation Process',
        length: '[[Escalation Process]]'.length,
      },
      { index: text.indexOf('[[Old Runbook]]'), ref: 'Old Runbook', length: '[[Old Runbook]]'.length },
    ]);
  });

  it('keeps scope paths, brackets inside a name, and a literal constructor ref', () => {
    expect(findKnowledgeMentions('[[site:mastra#customers/salesforce]]').map(mention => mention.ref)).toEqual([
      'site:mastra#customers/salesforce',
    ]);
    expect(findKnowledgeMentions('[[[Page]]]')).toEqual([{ index: 0, ref: '[Page', length: '[[[Page]]'.length }]);
    expect(findKnowledgeMentions('See [[constructor]].')[0]?.ref).toBe('constructor');
  });

  it('skips an opener that never closes and still finds the next mention', () => {
    expect(findKnowledgeMentions('[[a][[b]]').map(mention => mention.ref)).toEqual(['b']);
    expect(findKnowledgeMentions('[[]]')).toEqual([]);
    expect(findKnowledgeMentions('[[foo]bar]]')).toEqual([]);
    expect(findKnowledgeMentions('[[ ]]')[0]?.ref).toBe(' ');
  });

  it('finishes a long unclosed mention without stalling', () => {
    const text = `[[${'[[\\'.repeat(50_000)}`;
    const started = Date.now();
    expect(findKnowledgeMentions(text)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
