import { describe, expect, it } from 'vitest';

import { countMatches, needlesFrom } from './leak-check';

const sidecar = (literals: Record<string, string>) => ({ version: 1 as const, projects: { abcd1234: literals } });

describe('sidecar literal needles', () => {
  it('skips public Mastra vocabulary but keeps customer words', () => {
    const needles = needlesFrom(undefined, undefined, [
      sidecar({ metadataValue: 'agent_run', entityName: 'acme-bot', tag: 'Agent' }),
    ]);
    expect(needles).toEqual([{ kind: 'literal', value: 'acme-bot' }]);
  });

  it('matches literals as whole tokens, credentials anywhere', () => {
    const needles = [
      { kind: 'literal' as const, value: 'zork' },
      { kind: 'credential' as const, value: 's3cr3t' },
    ];
    expect(countMatches('zorkingFn(); my_zork_id; xs3cr3tx', needles)).toEqual({ credential: 1 });
    expect(countMatches('top value: zork.', needles)).toEqual({ literal: 1 });
    expect(countMatches('"zork", zork-2', needles)).toEqual({ literal: 2 });
  });
});
