import jscodeshift from 'jscodeshift';
import { describe, expect, it, vi } from 'vitest';
import transformer from '../codemods/v1/agent-abort-signal';
import { testTransform } from './test-utils';

function runWithReports(source: string): string[] {
  const j = jscodeshift.withParser('tsx');
  const report = vi.fn();
  transformer({ path: 'test.tsx', source }, { j, jscodeshift: j, stats: () => {}, report }, {});
  return report.mock.calls.map(([message]) => message);
}

const setup = `
import { Agent } from '@mastra/core/agent';
const agent = new Agent({ name: 'a', instructions: 'i', model: 'm' });
`;

describe('agent-abort-signal', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'agent-abort-signal');
  });

  it('does not report a conflict for calls already migrated', () => {
    const messages = runWithReports(
      `${setup}await agent.generate('hi', { abortSignal: signal, modelSettings: { temperature: 1 } });`,
    );
    expect(messages.some(message => message.startsWith('Skipped'))).toBe(false);
  });

  it('reports a conflict when abortSignal is set at both levels', () => {
    const messages = runWithReports(
      `${setup}await agent.generate('hi', { "abortSignal": a, modelSettings: { abortSignal: b } });`,
    );
    expect(messages).toContain(
      'Skipped 1 agent call(s) that set abortSignal both at the top level and in modelSettings; remove one manually',
    );
  });
});
