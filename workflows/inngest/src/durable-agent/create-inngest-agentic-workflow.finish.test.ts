import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(fileURLToPath(new URL('./create-inngest-agentic-workflow.ts', import.meta.url)), 'utf8');

function mapFinalOutputBody(source: string): string {
  const marker = "id: 'map-final-output'";
  const end = source.indexOf(marker);
  if (end < 0) {
    throw new Error('map-final-output mapping not found');
  }
  const start = source.lastIndexOf('.map(', end);
  return source.slice(start, end);
}

describe('map-final-output finish side effects (#23815)', () => {
  it('calls runDurableFinishSideEffects without nesting engine.step.run', () => {
    const body = mapFinalOutputBody(SOURCE);
    expect(body).toContain('runDurableFinishSideEffects(');
    expect(body).not.toMatch(/engine\.step\.run\s*\(/);
  });
});
