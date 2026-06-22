import { describe, it, expect } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: onError callback', () => {
  const getMock = useLoopScenarioAimock();

  it('fires onError callback when API returns an error', async () => {
    let onErrorFired = false;
    let errorMessage = '';

    await runLoopScenario({
      llm: getMock(),
      prompt: 'Trigger an API error',
      onError: async ({ error }) => {
        onErrorFired = true;
        errorMessage = typeof error === 'string' ? error : error.message;
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          {
            error: { message: 'Rate limit exceeded', type: 'rate_limit_error', code: 'rate_limit_exceeded' },
            status: 429,
          },
        );
      },
    });

    expect(onErrorFired).toBe(true);
    expect(errorMessage).toContain('Rate limit exceeded');
  });

  it('onError and errorProcessors both fire for API errors', async () => {
    let onErrorFired = false;
    let errorProcessorFired = false;

    const processor = {
      processAPIError: async () => {
        errorProcessorFired = true;
        return { retry: false };
      },
    };

    await runLoopScenario({
      llm: getMock(),
      prompt: 'Trigger an API error',
      errorProcessors: [processor],
      onError: async () => {
        onErrorFired = true;
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          {
            error: { message: 'Bad request', type: 'invalid_request_error', code: 'bad_request' },
            status: 400,
          },
        );
      },
    });

    // Both should fire: errorProcessor first (can modify/retry), then onError (observes final state)
    expect(errorProcessorFired).toBe(true);
    expect(onErrorFired).toBe(true);
  });

  it('onError does not fire for tool execution errors (those are sent back to model)', async () => {
    let onErrorFired = false;
    const { createTool } = await import('../../../../tools');

    const failingTool = createTool({
      id: 'failing-tool',
      description: 'A tool that always fails',
      inputSchema: { type: 'object', properties: {}, required: [] },
      execute: async () => {
        throw new Error('Tool failure');
      },
    });

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Use the failing tool',
      tools: { failingTool },
      onError: async () => {
        onErrorFired = true;
      },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call_fail', name: 'failing-tool', arguments: {} }],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Handled tool error' });
      },
    });

    // Tool errors are NOT surfaced via onError - they're sent back to the model as tool-result messages
    // so the model can self-correct. Only API errors trigger onError.
    expect(onErrorFired).toBe(false);
    expect(await output.text).toContain('Handled tool error');
  });
});
