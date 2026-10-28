import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it } from 'vitest';
import { Observability } from '../../../../../../../observability/mastra/src/default';
import { Memory } from '../../../../../../../packages/memory/src';
import type { TracingEvent } from '../../../../observability';
import { SpanType, TracingEventType } from '../../../../observability';
import { InMemoryStore } from '../../../../storage';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describeForAllEngines('observer execution outcomes (OBS-724)', engine => {
  const getMock = useLoopScenarioAimock();

  it.each(
    (['abort', 'continue'] as const).flatMap(failurePolicy =>
      (['context_length_exceeded', 'content_filter', 'provider_failure'] as const).map(code => ({
        failurePolicy,
        code,
      })),
    ),
  )('preserves observer $code with failurePolicy=$failurePolicy', async ({ failurePolicy, code }) => {
    const cause =
      code === 'context_length_exceeded'
        ? {
            outcome: 'limit',
            stopReason: 'context_window_exceeded',
            stopReasonContext: { errorCode: code },
          }
        : code === 'content_filter'
          ? {
              outcome: 'blocked',
              stopReason: 'content_filter',
              stopReasonContext: { message: 'Provider rejected observer input' },
            }
          : {
              outcome: 'error',
              stopReason: 'model_error',
              stopReasonContext: { message: 'Provider rejected observer input' },
            };
    const llm = getMock();
    const events: TracingEvent[] = [];
    const observability = new Observability({
      configs: {
        default: {
          name: 'observer-outcomes',
          serviceName: 'test',
          exporters: [
            {
              name: 'capture',
              exportTracingEvent: async event => void events.push(event),
              flush: async () => {},
              shutdown: async () => {},
            },
          ],
        },
      },
    });
    const observerModel = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` }).chat('observer-model');
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: {
        observationalMemory: {
          enabled: true,
          observation: { model: observerModel, messageTokens: 20, bufferTokens: false, maxRetries: 0, failurePolicy },
          reflection: { model: observerModel, observationTokens: 50000 },
        },
      },
    });
    const { output, requests } = await runLoopScenario({
      engine,
      llm,
      observability,
      afterStream: async () => {
        await expect
          .poll(
            () =>
              events.filter(
                event =>
                  event.type === TracingEventType.SPAN_ENDED &&
                  event.exportedSpan.type === SpanType.AGENT_RUN &&
                  event.exportedSpan.entityId !== 'observational-memory-observer',
              ).length,
          )
          .toBeGreaterThan(0);
      },
      memory,
      threadId: `observer-${engine}`,
      resourceId: 'customer',
      prompt: 'Please remember these details about my order. '.repeat(40),
      fixtures: mock => {
        mock.on(
          { endpoint: 'chat', model: 'observer-model' },
          {
            error: {
              message: 'Provider rejected observer input',
              type: 'invalid_request_error',
              code,
            },
            status: 400,
          },
        );
        mock.on({ endpoint: 'chat', model: 'gpt-4o-mini' }, { content: 'Primary response.' });
      },
    });
    expect(requests.some(request => request.body.model === 'observer-model')).toBe(true);
    expect(await output.text).toBe(failurePolicy === 'abort' ? '' : 'Primary response.');
    const ended = events
      .filter(event => event.type === TracingEventType.SPAN_ENDED && event.exportedSpan.type === SpanType.AGENT_RUN)
      .map(event => event.exportedSpan);
    expect(ended.find(span => span.entityId === 'observational-memory-observer')).toMatchObject(cause);
    const primary = ended.findLast(span => span.entityId !== 'observational-memory-observer');
    if (primary?.stopReasonContext) expect(primary.stopReasonContext).not.toHaveProperty('reason');
    expect(JSON.parse(JSON.stringify(primary))).toMatchObject(
      failurePolicy === 'abort'
        ? {
            outcome: 'interrupted',
            stopReason: 'observer_failed',
            stopReasonContext: {
              cause,
              tripwire: { reason: expect.any(String), metadata: { observerFailure: { cause } } },
            },
          }
        : { outcome: 'success', stopReason: null },
    );
  });
});
