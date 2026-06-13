import { describe, expect, it } from 'vitest';
import { DefaultExecutionEngine } from './default';

describe('DefaultExecutionEngine sleep + cancel (#17908)', () => {
  it('executeSleepDuration resolves immediately when its abort signal fires', async () => {
    const engine = new DefaultExecutionEngine({ mastra: undefined });
    const abortController = new AbortController();

    const startedAt = Date.now();
    const sleeping = engine.executeSleepDuration(60_000, 'sleep-1', 'wf', abortController.signal);

    setTimeout(() => abortController.abort(), 50);

    await sleeping;

    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeLessThan(1_000);
  });

  it('executeSleepDuration resolves immediately when its signal is already aborted', async () => {
    const engine = new DefaultExecutionEngine({ mastra: undefined });
    const abortController = new AbortController();
    abortController.abort();

    const startedAt = Date.now();
    await engine.executeSleepDuration(60_000, 'sleep-1', 'wf', abortController.signal);
    expect(Date.now() - startedAt).toBeLessThan(50);
  });

  it('executeSleepUntilDate resolves immediately when its abort signal fires', async () => {
    const engine = new DefaultExecutionEngine({ mastra: undefined });
    const abortController = new AbortController();
    const target = new Date(Date.now() + 60_000);

    const startedAt = Date.now();
    const sleeping = engine.executeSleepUntilDate(target, 'sleepUntil-1', 'wf', abortController.signal);

    setTimeout(() => abortController.abort(), 50);

    await sleeping;

    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  it('executeSleepDuration still completes its full duration without a signal', async () => {
    const engine = new DefaultExecutionEngine({ mastra: undefined });

    const startedAt = Date.now();
    await engine.executeSleepDuration(150, 'sleep-1', 'wf');
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(140);
  });
});
