import { llm } from '@livekit/agents';
import { afterEach, expect, it, vi } from 'vitest';
import { createVoiceBenchmarkReplyGenerator } from './benchmark-fixture';
import { instrumentVoiceReply } from './bridge';
import { VOICE_TEXT_FLUSH } from './turn-metrics';

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
