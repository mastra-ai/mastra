import { describe, expect, it } from 'vitest';
import { TOOL_MOCK_NOT_DECLARED } from '../../tool-mocks';
import { EXPERIMENT_PATHS, recordingTool, runToolMockScenario, scriptedModel } from './scenario-helpers';

const outputText = (output: unknown) => (output as { text?: string } | null)?.text;

/**
 * BDD scenario: run options behave the same whichever path runs the item.
 *
 * Given an experiment run with `agentModel`, `unmockedToolPolicy`, `maxRetries`
 * or `itemTimeout`
 * When the item runs in process (`runExperiment`) or caller-driven (`runExperimentItem`)
 * Then the option takes effect identically and the persisted row reflects it.
 */
describe.each(EXPERIMENT_PATHS)('Experiment scenario: run options (%s)', path => {
  it('runs the agent on the agentModel override', async () => {
    const { summary, item } = await runToolMockScenario({
      path,
      tools: {},
      turns: [{ text: 'from the agent model' }],
      agentModel: scriptedModel([{ text: 'from the override' }]),
    });

    expect(summary.succeededCount).toBe(1);
    expect(outputText(item.output)).toBe('from the override');
  });

  it('applies the run-level unmockedToolPolicy to undeclared tool calls', async () => {
    const liveLog: string[] = [];

    const { summary, item } = await runToolMockScenario({
      path,
      tools: { sendEmail: recordingTool('sendEmail', liveLog) },
      turns: [{ toolCalls: [{ id: 'c1', toolName: 'sendEmail', args: { to: 'yj' } }] }, { text: 'sent' }],
      unmockedToolPolicy: 'deny',
    });

    expect(summary.failedCount).toBe(1);
    expect(item.error?.code).toBe(TOOL_MOCK_NOT_DECLARED);
    expect(liveLog).toEqual([]);
  });

  it('lets the item-level unmockedToolPolicy override the run level', async () => {
    const liveLog: string[] = [];

    const { item } = await runToolMockScenario({
      path,
      tools: { sendEmail: recordingTool('sendEmail', liveLog) },
      turns: [{ toolCalls: [{ id: 'c1', toolName: 'sendEmail', args: { to: 'yj' } }] }, { text: 'sent' }],
      unmockedToolPolicy: 'deny',
      itemUnmockedToolPolicy: 'allow',
    });

    expect(item.error).toBeNull();
    expect(liveLog).toEqual(['sendEmail']);
  });

  it('retries a failed item and records the retry count', async () => {
    const { summary, item } = await runToolMockScenario({
      path,
      tools: {},
      turns: [{ throws: 'provider overloaded' }, { text: 'recovered' }],
      maxRetries: 1,
    });

    expect(summary.succeededCount).toBe(1);
    expect(item.error).toBeNull();
    expect(outputText(item.output)).toBe('recovered');
    expect(item.retryCount).toBe(1);
  });

  it('fails an item that exceeds itemTimeout and does not retry it', async () => {
    const { summary, item } = await runToolMockScenario({
      path,
      tools: {},
      turns: [{ text: 'too late', delayMs: 2_000 }],
      itemTimeout: 50,
      maxRetries: 1,
    });

    expect(summary.failedCount).toBe(1);
    expect(item.error?.message).toMatch(/timeout/i);
    expect(item.retryCount).toBe(0);
  });

  it('stops waiting to retry once itemTimeout expires', async () => {
    const startedAt = Date.now();
    const { summary, item } = await runToolMockScenario({
      path,
      tools: {},
      turns: [{ throws: 'provider overloaded' }, { text: 'too late' }],
      itemTimeout: 50,
      maxRetries: 1,
    });

    expect(Date.now() - startedAt).toBeLessThan(800);
    expect(summary.failedCount).toBe(1);
    expect(item.error?.message).toMatch(/timeout/i);
    expect(item.retryCount).toBe(0);
  });
});
