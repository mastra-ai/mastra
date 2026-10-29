import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `getAgentFromSystem` only enforces stored-agent visibility when it's given the caller's `requestContext`; without it
 * there is no caller to check, so a private stored agent resolves for anyone. Every server handler must pass it.
 */
describe('getAgentFromSystem callers', () => {
  it('pass requestContext in every server handler', () => {
    const dir = __dirname;
    const missing: string[] = [];
    let calls = 0;

    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const source = readFileSync(join(dir, file), 'utf8');
      const pattern = /getAgentFromSystem\(\{/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source))) {
        // Skip the definition itself.
        if (source.slice(Math.max(0, match.index - 'function '.length), match.index) === 'function ') continue;
        let depth = 0;
        let end = match.index + 'getAgentFromSystem('.length;
        for (; end < source.length; end++) {
          if (source[end] === '{') depth++;
          else if (source[end] === '}' && --depth === 0) break;
        }
        calls++;
        const args = source.slice(match.index, end + 1);
        if (!/\brequestContext\b/.test(args)) {
          missing.push(`${file}:${source.slice(0, match.index).split('\n').length}`);
        }
      }
    }

    expect(calls).toBeGreaterThan(30);
    expect(missing).toEqual([]);
  });

  /**
   * Looking an agent up directly skips the stored-agent visibility check: hydrated stored agents are registered on
   * Mastra, so `mastra.getAgentById` returns them too. Handlers should resolve agents through `getAgentFromSystem`.
   * Each remaining direct lookup is listed here with why it's safe; a new one fails until it's reviewed.
   */
  it('only look agents up directly where the stored-agent check is applied', () => {
    const allowed: Record<string, { count: number; reason: string }> = {
      'agents.ts': { count: 3, reason: 'getAgentFromSystem itself (checked) + GET /agents (author-filtered first)' },
      'memory.ts': { count: 4, reason: 'memory resolvers call assertStoredAgentAccess on the resolved agent' },
      'schedules.ts': { count: 1, reason: 'assertStoredAgentAccess(execute) before scheduling' },
      'scores.ts': { count: 1, reason: 'scorer listing is author-filtered before hydration' },
      'channels.ts': { count: 1, reason: 'stored agents are write-checked against storage first; code agents only' },
      'agent-versions.ts': { count: 1, reason: '/stored/agents versions existence check; no agent is resolved' },
    };
    const found: Record<string, number> = {};

    for (const file of readdirSync(__dirname)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const source = readFileSync(join(__dirname, file), 'utf8');
      const count = (source.match(/\.getAgentById\(|\bagent\??\.getById\(/g) ?? []).length;
      if (count) found[file] = count;
    }

    expect(found).toEqual(Object.fromEntries(Object.entries(allowed).map(([file, { count }]) => [file, count])));
  });
});
