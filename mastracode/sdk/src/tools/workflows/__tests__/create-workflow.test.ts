import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi } from 'vitest';
import { createWorkflowTool } from '../create-workflow';

type StreamEvent = {
  type: string;
  payload?: { toolName?: string; result?: unknown; error?: unknown; args?: unknown };
};

function makeStreamingAgent(events: StreamEvent[], finalText: string) {
  return {
    stream: async () => ({
      fullStream: new ReadableStream<StreamEvent>({
        start(controller) {
          for (const e of events) controller.enqueue(e);
          controller.close();
        },
      }),
      text: Promise.resolve(finalText),
    }),
  };
}

function makeMastraStub(agent: unknown) {
  return {
    getAgent: (id: string) => (id === 'workflow-builder' ? agent : undefined),
  };
}

async function invoke(mastra: unknown, requestContext?: RequestContext) {
  // `execute` is a function on the tool — call it directly to avoid the
  // input-validation wrapper and get raw throw semantics.
  return await (createWorkflowTool as any).execute({ request: 'do a thing' }, { mastra, requestContext });
}

describe('create-workflow tool surfaces sub-agent failures', () => {
  it('returns summary + workflowId when save-workflow returns ok', async () => {
    const agent = makeStreamingAgent(
      [
        { type: 'tool-call', payload: { toolName: 'save-workflow' } },
        { type: 'tool-result', payload: { toolName: 'save-workflow', result: { ok: true, id: 'my-wf' } } },
      ],
      'Built the workflow.',
    );
    const result = await invoke(makeMastraStub(agent));
    expect(result).toEqual({ summary: 'Built the workflow.', workflowId: 'my-wf' });
  });

  it('forwards the caller requestContext to the workflow-builder agent', async () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', { session: { modelId: 'mock-model' } });
    const stream = vi.fn().mockResolvedValue(makeStreamingAgent([], '').stream());

    await expect(invoke(makeMastraStub({ stream }), requestContext)).rejects.toThrow(/never called save-workflow/);

    expect(stream).toHaveBeenCalledWith('do a thing', { requestContext });
  });

  it('cancels and releases the stream reader when reading fails', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const releaseLock = vi.fn();
    const reader = {
      read: vi.fn().mockRejectedValue(new Error('stream failed')),
      cancel,
      releaseLock,
    };
    const agent = {
      stream: vi.fn().mockResolvedValue({
        fullStream: { getReader: () => reader },
        text: Promise.resolve(''),
      }),
    };

    await expect(invoke(makeMastraStub(agent))).rejects.toThrow('stream failed');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it('throws when the sub-agent never calls save-workflow (hallucinated success)', async () => {
    const agent = makeStreamingAgent(
      [{ type: 'tool-call', payload: { toolName: 'list-available-agents' } }],
      'All done, workflow is ready!',
    );
    await expect(invoke(makeMastraStub(agent))).rejects.toThrow(
      /never called save-workflow.*No workflow was persisted/s,
    );
  });

  it('throws with the sub-agent tool error when save-workflow itself errored', async () => {
    const agent = makeStreamingAgent(
      [
        { type: 'tool-call', payload: { toolName: 'save-workflow' } },
        {
          type: 'tool-error',
          payload: {
            toolName: 'save-workflow',
            error: new Error('save-workflow refused: unresolved reference to agent "nope"'),
          },
        },
      ],
      'Created workflow!',
    );
    await expect(invoke(makeMastraStub(agent))).rejects.toThrow(/unresolved reference to agent "nope"/);
  });

  it('throws when save-workflow was called but never returned { ok: true }', async () => {
    const agent = makeStreamingAgent(
      [{ type: 'tool-call', payload: { toolName: 'save-workflow' } }],
      'Sub-agent claimed success.',
    );
    await expect(invoke(makeMastraStub(agent))).rejects.toThrow(/save-workflow was called but did not return/);
  });

  it('includes other sub-agent tool errors in the failure message', async () => {
    const agent = makeStreamingAgent(
      [
        {
          type: 'tool-error',
          payload: { toolName: 'list-available-tools', error: 'registry offline' },
        },
      ],
      'gave up',
    );
    await expect(invoke(makeMastraStub(agent))).rejects.toThrow(/list-available-tools: registry offline/);
  });

  it('coerces non-Error thrown values to a readable string', async () => {
    const agent = makeStreamingAgent(
      [
        { type: 'tool-call', payload: { toolName: 'save-workflow' } },
        {
          type: 'tool-error',
          payload: { toolName: 'save-workflow', error: { code: 'BOOM', detail: 'graph invalid' } },
        },
      ],
      'irrelevant',
    );
    await expect(invoke(makeMastraStub(agent))).rejects.toThrow(/BOOM/);
  });
});
