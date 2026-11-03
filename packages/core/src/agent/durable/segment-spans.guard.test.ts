/**
 * Span identity of a durable execution has one resolver, `currentSegment()`. A step that reads
 * `agentSpanData` / `modelSpanData` directly ends the run's first pair even after a resume opened
 * the next one, which is the cross-process double end this module removes. Only the sites that
 * seed or forward the first pair may touch those fields.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(__dirname);
const ALLOWED = new Set([
  'segment-spans.ts',
  'preparation.ts',
  'durable-agent.ts',
  'utils/serialize-state.ts',
  'workflows/durable-loop-builder.ts',
  'workflows/shared/iteration-state.ts',
]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return name === '__tests__' ? [] : sources(file);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [file] : [];
  });
}

describe('durable span identity', () => {
  it('is read only through currentSegment() outside the sites that seed or forward the first pair', () => {
    const readers = sources(ROOT)
      .filter(file => /(?<!\bsegment)\.(agentSpanData|modelSpanData)\b/.test(readFileSync(file, 'utf8')))
      .map(file => path.relative(ROOT, file))
      .filter(file => !ALLOWED.has(file));
    expect(readers).toEqual([]);
  });
});
