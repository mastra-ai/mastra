import { describe, expect, it, vi } from 'vitest';
import { PlanRejectionAbortProcessor } from '../plan-rejection-abort.js';

type AnyMessage = Record<string, unknown>;

function assistantWithToolResult(opts: {
  toolName: string;
  state?: string;
  result: { content?: string } | string;
  legacy?: boolean;
}): AnyMessage {
  const inv = {
    state: opts.state ?? 'result',
    toolName: opts.toolName,
    result: opts.result,
  };
  if (opts.legacy) {
    return { role: 'assistant', content: { toolInvocations: [inv] } };
  }
  return {
    role: 'assistant',
    content: { parts: [{ type: 'tool-invocation', toolInvocation: inv }] },
  };
}

async function run(messages: AnyMessage[], stepNumber: number) {
  const processor = new PlanRejectionAbortProcessor();
  const abort = vi.fn();
  await processor.processInputStep({ messages, stepNumber, abort } as any);
  return abort;
}

describe('PlanRejectionAbortProcessor', () => {
  it('aborts when the last submit_plan result is a rejection (parts format)', async () => {
    const messages = [
      assistantWithToolResult({
        toolName: 'submit_plan',
        result: { content: 'Plan was not approved. The user will send revision instructions in their next message.' },
      }),
    ];
    const abort = await run(messages, 1);
    expect(abort).toHaveBeenCalledOnce();
  });

  it('aborts when the rejection is in a harness tool_result part', async () => {
    const messages = [
      {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool_result',
              name: 'submit_plan',
              result: {
                content: 'Plan was not approved. The user will send revision instructions in their next message.',
              },
            },
          ],
        },
      },
    ];
    const abort = await run(messages, 1);
    expect(abort).toHaveBeenCalledOnce();
  });

  it('aborts when the rejection is in a harness content array', async () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_result',
            name: 'submit_plan',
            result: 'Plan was not approved. The user will send revision instructions in their next message.',
          },
        ],
      },
    ];
    const abort = await run(messages, 1);
    expect(abort).toHaveBeenCalledOnce();
  });

  it('aborts when the rejection includes inline feedback', async () => {
    const messages = [
      assistantWithToolResult({
        toolName: 'submit_plan',
        result: { content: 'Plan was not approved. The user wants revisions.\n\nUser feedback: fix step 3' },
      }),
    ];
    const abort = await run(messages, 1);
    expect(abort).toHaveBeenCalledOnce();
  });

  it('aborts when the result is a bare string', async () => {
    const messages = [
      assistantWithToolResult({
        toolName: 'submit_plan',
        result: 'Plan was not approved. Stop now.',
      }),
    ];
    const abort = await run(messages, 1);
    expect(abort).toHaveBeenCalledOnce();
  });

  it('aborts when the rejection is in the legacy toolInvocations array', async () => {
    const messages = [
      assistantWithToolResult({
        toolName: 'submit_plan',
        result: { content: 'Plan was not approved. Stop now.' },
        legacy: true,
      }),
    ];
    const abort = await run(messages, 1);
    expect(abort).toHaveBeenCalledOnce();
  });

  it('does NOT abort on an approval result', async () => {
    const messages = [
      assistantWithToolResult({
        toolName: 'submit_plan',
        result: { content: 'Plan approved. Proceed with implementation following the approved plan.' },
      }),
    ];
    const abort = await run(messages, 1);
    expect(abort).not.toHaveBeenCalled();
  });

  it('does NOT abort at step 0', async () => {
    const messages = [
      assistantWithToolResult({
        toolName: 'submit_plan',
        result: { content: 'Plan was not approved. Stop now.' },
      }),
    ];
    const abort = await run(messages, 0);
    expect(abort).not.toHaveBeenCalled();
  });

  it('does NOT abort for a different tool', async () => {
    const messages = [
      assistantWithToolResult({
        toolName: 'write_file',
        result: { content: 'Plan was not approved. Stop now.' },
      }),
    ];
    const abort = await run(messages, 1);
    expect(abort).not.toHaveBeenCalled();
  });

  it('does NOT abort when the invocation is not yet a result', async () => {
    const messages = [
      assistantWithToolResult({
        toolName: 'submit_plan',
        state: 'call',
        result: { content: 'Plan was not approved. Stop now.' },
      }),
    ];
    const abort = await run(messages, 1);
    expect(abort).not.toHaveBeenCalled();
  });

  it('only inspects the most recent assistant message', async () => {
    const messages = [
      assistantWithToolResult({
        toolName: 'submit_plan',
        result: { content: 'Plan was not approved. Stop now.' },
      }),
      { role: 'user', content: { parts: [{ type: 'text', text: 'go ahead' }] } },
      assistantWithToolResult({
        toolName: 'submit_plan',
        result: { content: 'Plan approved. Proceed with implementation.' },
      }),
    ];
    const abort = await run(messages, 1);
    expect(abort).not.toHaveBeenCalled();
  });
});
