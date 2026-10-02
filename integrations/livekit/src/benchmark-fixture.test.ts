import { llm } from '@livekit/agents';
import { afterEach, expect, it, vi } from 'vitest';
import { runVoiceBenchmarks, voiceBenchmarkScenarios } from './benchmark';
import { createVoiceBenchmarkReplyGenerator } from './benchmark-fixture';
import { instrumentVoiceReply } from './bridge';
import { VOICE_TEXT_FLUSH } from './turn-metrics';
import type { VoiceTurnMetrics } from './turn-metrics';

afterEach(() => vi.useRealTimers());
const context = () => ({
  messages: [{ id: 'u', role: 'user' as const, content: 'lookup' }],
  chatCtx: llm.ChatContext.empty(),
  memory: false as const,
});

it('provides a controlled slow tool with a flush before the delay and no lingering timers on interruption', async () => {
  vi.useFakeTimers();
  const hook = vi.fn();
  const generator = createVoiceBenchmarkReplyGenerator({
    id: 'slow',
    utterances: ['lookup'],
    expectedTools: ['lookup'],
    expectedText: '42',
    toolDelayMs: 1000,
  });
  const { reply } = await instrumentVoiceReply(generator, context(), hook);
  const reader = reply!.getReader();
  expect((await reader.read()).value).toBe('One moment. ');
  expect((await reader.read()).value).toEqual(VOICE_TEXT_FLUSH);
  await vi.advanceTimersByTimeAsync(100);
  await reader.cancel();
  await vi.advanceTimersByTimeAsync(0);
  expect(hook).toHaveBeenCalledOnce();
  expect(hook.mock.calls[0]![0]).toMatchObject({ outcome: 'interrupted', tools: [{ toolName: 'lookup' }] });
  expect(vi.getTimerCount()).toBe(0);
});

it('reports injected failures through the ordinary generation failure path', async () => {
  const hook = vi.fn();
  const { reply } = await instrumentVoiceReply(
    createVoiceBenchmarkReplyGenerator({ id: 'fail', utterances: ['hello'], injectFailure: true }),
    context(),
    hook,
  );
  await expect(reply!.getReader().read()).rejects.toThrow('Injected voice benchmark failure');
  await vi.waitFor(() => expect(hook).toHaveBeenCalledOnce());
  expect(hook.mock.calls[0]![0].outcome).toBe('failed');
});

it.each([
  { cancelAtInterruption: true, outcome: 'interrupted', success: true },
  { cancelAtInterruption: false, outcome: 'completed', success: false },
])(
  'scores the interruption fixture as $outcome when adapter cancellation is $cancelAtInterruption',
  async ({ cancelAtInterruption, outcome, success }) => {
    vi.useFakeTimers();
    const scenario = voiceBenchmarkScenarios.find(scenario => scenario.id === 'interruption')!;
    let outputStarted!: () => void;
    const started = new Promise<void>(resolve => {
      outputStarted = resolve;
    });
    let finishMetrics!: (metrics: VoiceTurnMetrics) => void;
    const metrics = new Promise<VoiceTurnMetrics>(resolve => {
      finishMetrics = resolve;
    });
    const onMetrics = vi.fn(finishMetrics);
    const trial = runVoiceBenchmarks({
      scenarios: [scenario],
      mode: 'ci',
      measurement: 'simulation',
      startup: 'warm',
      versions: { fixture: '1' },
      run: async (scenario, { signal }) => {
        const { reply } = await instrumentVoiceReply(
          createVoiceBenchmarkReplyGenerator(scenario),
          context(),
          onMetrics,
        );
        const reader = reply!.getReader();
        const cancel = () => {
          void reader.cancel();
        };
        let timer: ReturnType<typeof setTimeout> | undefined;
        signal.addEventListener('abort', cancel, { once: true });
        try {
          const first = await reader.read();
          expect(first.value).toBe('This is a deliberately unfinished answer. ');
          expect((await reader.read()).value).toEqual(VOICE_TEXT_FLUSH);
          let generatedText = typeof first.value === 'string' ? first.value : '';
          if (cancelAtInterruption) timer = setTimeout(cancel, scenario.interruptAfterMs);
          outputStarted();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (typeof value === 'string') generatedText += value;
          }
          return { outcome: (await metrics).outcome, measurement: 'simulation', generatedText };
        } finally {
          clearTimeout(timer);
          signal.removeEventListener('abort', cancel);
          reader.releaseLock();
        }
      },
    });
    await started;
    await vi.advanceTimersByTimeAsync(scenario.interruptAfterMs! - 1);
    expect(onMetrics).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    if (!cancelAtInterruption) {
      expect(onMetrics).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(999);
      expect(onMetrics).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
    }
    const [result] = await trial;
    expect(result).toMatchObject({ outcome, success });
    expect(result!.observation!.generatedText).toBe(
      'This is a deliberately unfinished answer. ' + (cancelAtInterruption ? '' : 'Done.'),
    );
    expect(onMetrics).toHaveBeenCalledOnce();
    expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({ outcome }));
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(onMetrics).toHaveBeenCalledOnce();
  },
);
