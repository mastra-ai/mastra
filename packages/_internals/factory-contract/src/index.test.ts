import { describe, expect, it } from 'vitest';

// @ts-expect-error -- plain .mjs script shared with the CLI
import { closure } from '../scripts/contract-graph.mjs';

interface Reach {
  spec: string;
  via: string[];
}

describe('@internal/factory-contract', () => {
  it('reaches nothing a browser cannot load', () => {
    const { bad } = closure(['index']) as { bad: Reach[] };
    expect(bad.map(b => `${b.spec} <- ${b.via.join(' > ')}`)).toEqual([]);
  });

  it('only type-imports @mastra/core, which the build erases', () => {
    const { bad } = closure(['index'], { types: true }) as { bad: Reach[] };
    const leaks = bad.filter(b => !b.spec.startsWith('@mastra/core/'));
    expect(leaks.map(b => `${b.spec} <- ${b.via.join(' > ')}`)).toEqual([]);
  });
});
