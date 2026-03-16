import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(resolve(import.meta.dirname, relativePath), 'utf-8');

describe('agent badge regressions', () => {
  it('treats empty childMessages arrays as missing in AgentBadgeWrapper', () => {
    const source = readSource('../badges/agent-badge-wrapper.tsx');

    expect(source).toContain('let childMessages = result?.childMessages?.length ? result.childMessages : undefined;');
  });
});
