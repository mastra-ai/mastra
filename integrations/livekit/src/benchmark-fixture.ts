import { ReadableStream } from 'node:stream/web';
import { voiceBenchmarkScenarioSchema } from './benchmark';
import type { RunVoiceBenchmarksOptions } from './benchmark';
import type { VoiceReplyGenerator } from './bridge';
import { VOICE_TEXT_FLUSH } from './turn-metrics';
import type { VoiceReplyChunk } from './turn-metrics';

/**
 * Controlled reply source for CI audio-pipeline tests. No model or provider is called.
 * Pair with MastraVoiceAgent and a fake TTS/output, or use real providers separately.
 * The fixture does not measure model quality; real-audio benchmarks should run the application agent.
 */
export function createVoiceBenchmarkReplyGenerator(
  scenario: RunVoiceBenchmarksOptions['scenarios'][number],
): VoiceReplyGenerator {
  const fixture = voiceBenchmarkScenarioSchema.parse(scenario);
  return ctx => {
    const abort = new AbortController();
    let cancelled = false;
    const delay = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const finish = () => {
          abort.signal.removeEventListener('abort', onAbort);
          resolve();
        };
        const timer = setTimeout(finish, ms);
        const onAbort = () => {
          clearTimeout(timer);
          reject(new DOMException('Interrupted', 'AbortError'));
        };
        abort.signal.addEventListener('abort', onAbort, { once: true });
        if (abort.signal.aborted) onAbort();
      });
    return new ReadableStream<VoiceReplyChunk>({
      async start(controller) {
        try {
          if (fixture.injectFailure) throw new Error('Injected voice benchmark failure');
          for (const toolName of fixture.expectedTools) {
            const toolCallId = crypto.randomUUID();
            ctx.metrics?.toolStart({ toolCallId, toolName });
            controller.enqueue('One moment. ');
            controller.enqueue(VOICE_TEXT_FLUSH);
            await delay(fixture.toolDelayMs);
            ctx.metrics?.toolEnd(toolCallId);
          }
          if (fixture.interruptAfterMs !== undefined) {
            controller.enqueue('This is a deliberately unfinished answer. ');
            controller.enqueue(VOICE_TEXT_FLUSH);
            await delay(fixture.interruptAfterMs + 1000);
          }
          if (!cancelled) {
            controller.enqueue(fixture.expectedText ?? 'Done.');
            controller.close();
          }
        } catch (error) {
          if (!cancelled) controller.error(error);
        }
      },
      cancel() {
        cancelled = true;
        abort.abort();
      },
    });
  };
}
