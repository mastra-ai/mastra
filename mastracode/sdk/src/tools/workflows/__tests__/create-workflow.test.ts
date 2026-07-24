import { describe, it, expect } from 'vitest';
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

async function invoke(mastra: unknown) {
  // `execute` is a function on the tool — call it directly to avoid the
  // input-validation wrapper and get raw throw semantics.
  return await (createWorkflowTool as any).execute({ request: 'do a thing' }, { mastra, requestContext: undefined });
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
