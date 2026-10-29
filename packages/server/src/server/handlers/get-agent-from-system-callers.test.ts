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
});
