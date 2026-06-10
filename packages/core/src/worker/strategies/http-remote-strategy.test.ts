import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpRemoteStrategy } from './http-remote-strategy';

describe('HttpRemoteStrategy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards isResuming and falsy resume data in the step execution body', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: 'success', output: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const strategy = new HttpRemoteStrategy({ serverUrl: 'http://localhost:4111/api' });
    await strategy.executeStep({
      workflowId: 'wf',
      runId: 'run-1',
      stepId: 'step-1',
      executionPath: [0],
      stepResults: {},
      state: {},
      requestContext: {},
      resumeData: false,
      isResuming: true,
    } as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    // Resuming with explicit falsy resume data must survive the wire format —
    // the server distinguishes "resume with `false`" from "not resuming" via
    // these two fields.
    expect(body.isResuming).toBe(true);
    expect(body.resumeData).toBe(false);
  });
});
