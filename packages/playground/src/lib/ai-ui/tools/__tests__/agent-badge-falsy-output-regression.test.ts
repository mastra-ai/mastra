import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(resolve(import.meta.dirname, relativePath), 'utf-8');

describe('agent badge falsy output regression', () => {
  it('counts falsy tool outputs as complete in AgentBadge', () => {
    const source = readSource('../badges/agent-badge.tsx');

    expect(source).toContain('return message.toolOutput !== undefined;');
  });
});
