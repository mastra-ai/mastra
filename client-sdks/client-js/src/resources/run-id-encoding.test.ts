import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientOptions } from '../types';
import { Run } from './run';
import { Workflow } from './workflow';

const RUN_ID = 'order+42&x#y/z';
const ENCODED = 'order%2B42%26x%23y%2Fz';

describe('workflow runId URL encoding', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const options = { baseUrl: 'http://localhost', retries: 0 } as ClientOptions;
  const lastUrl = () => String(fetchMock.mock.calls.at(-1)![0]);

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    globalThis.fetch = fetchMock as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const run = () => new Run(options, 'wf-1', RUN_ID);

  it.each([
    ['start', '/start', () => run().start({ inputData: {} })],
    ['startAsync', '/start-async', () => run().startAsync({ inputData: {} })],
    ['resume', '/resume', () => run().resume({ step: 's', resumeData: {} } as any)],
    ['resumeAsync', '/resume-async', () => run().resumeAsync({ step: 's', resumeData: {} } as any)],
    ['resumeNoWait', '/resume-no-wait', () => run().resumeNoWait({ step: 's', resumeData: {} } as any)],
    ['restart', '/restart', () => run().restart({} as any)],
    ['restartAsync', '/restart-async', () => run().restartAsync({} as any)],
    ['timeTravel', '/time-travel', () => run().timeTravel({ step: 's' } as any)],
    ['timeTravelAsync', '/time-travel-async', () => run().timeTravelAsync({ step: 's' } as any)],
    ['timeTravelStream', '/time-travel-stream', () => run().timeTravelStream({ step: 's' } as any)],
  ])('%s encodes runId in the query string', async (_name, path, call) => {
    await call();
    expect(lastUrl()).toContain(`/api/workflows/wf-1${path}?runId=${ENCODED}`);
  });

  it.each([
    ['cancel', () => run().cancel()],
    ['cancelRun', () => (run() as any).cancelRun()],
  ])('%s encodes runId in the path', async (_name, call) => {
    await call();
    expect(lastUrl()).toBe(`http://localhost/api/workflows/wf-1/runs/${ENCODED}/cancel`);
  });

  it('Workflow.runById and deleteRunById encode runId in the path', async () => {
    const wf = new Workflow(options, 'wf-1');
    await wf.runById(RUN_ID);
    expect(lastUrl()).toBe(`http://localhost/api/workflows/wf-1/runs/${ENCODED}`);
    await wf.deleteRunById(RUN_ID);
    expect(lastUrl()).toBe(`http://localhost/api/workflows/wf-1/runs/${ENCODED}`);
  });
});
