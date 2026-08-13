import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkflowClient, MastraWorkflowClient, Run, Workflow } from './index';

describe('workflow-only client', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('creates the native workflow and run resources without the root client barrel', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ runId: 'run-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createWorkflowClient({
      baseUrl: 'https://mastra.example',
      fetch: fetchMock,
      retries: 0,
    });
    const workflow = client.getWorkflow('campaign');
    const run = await workflow.createRun();

    expect(client).toBeInstanceOf(MastraWorkflowClient);
    expect(workflow).toBeInstanceOf(Workflow);
    expect(run).toBeInstanceOf(Run);
    expect(run.runId).toBe('run-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://mastra.example/api/workflows/campaign/create-run?',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('passes a platform fetch implementation through to the native stream lifecycle', async () => {
    const body = Workflow.createRecordStream([{ type: 'workflow-start', payload: {}, runId: 'run-1' }]);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'run-1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(body, { status: 200 }));

    const client = new MastraWorkflowClient({
      baseUrl: 'https://mastra.example',
      fetch: fetchMock,
      retries: 0,
    });
    const workflow = client.getWorkflow('campaign');
    const run = await workflow.createRun();
    const stream = await run.stream({ inputData: { image: 'data:image/png;base64,AA==' } });

    await expect(stream.getReader().read()).resolves.toMatchObject({
      done: false,
      value: { type: 'workflow-start', runId: 'run-1' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
