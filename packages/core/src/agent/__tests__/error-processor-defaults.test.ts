import { describe, expect, it } from 'vitest';
import type { Processor } from '../../processors/index';
import { PrefillErrorHandler } from '../../processors/prefill-error-handler';
import { ProviderHistoryCompat } from '../../processors/provider-history-compat';
import { StreamErrorRetryProcessor } from '../../processors/stream-error-retry-processor';
import { UnsupportedFileHandler } from '../../processors/unsupported-file-handler';
import { Agent } from '../index';

/**
 * Story: every agent gets the shared stability error processors unless the caller opts out with
 * `errorProcessorDefaults: false`. Caller processors run first, defaults fill in canonical order,
 * and repair processors always stay ahead of retry processors, because error processors stop at
 * the first `{ retry: true }`. These checks only list processors, so the model is never resolved.
 */

const DEFAULT_ERROR_PROCESSOR_IDS = [
  'provider-history-compat',
  'prefill-error-handler',
  'unsupported-file-handler',
  'stream-error-retry-processor',
] as const;

const bareAgent = (config: Record<string, unknown> = {}) =>
  new Agent({
    id: 'stability-defaults-agent',
    name: 'Stability Defaults Agent',
    instructions: 'test',
    model: 'openai/gpt-4o-mini',
    ...config,
  });

const customProcessor = (): Processor => ({
  id: 'custom-error-processor',
  processAPIError: async () => ({ retry: true }),
});

const ids = async (agent: Agent) => (await agent.listErrorProcessors()).map(processor => processor.id);

describe('error processors — shared stability defaults', () => {
  it('resolves the defaults, in order, for a bare agent', async () => {
    expect(await ids(bareAgent())).toEqual([...DEFAULT_ERROR_PROCESSOR_IDS]);
  });

  it('keeps the caller list first and adds only the defaults it does not carry', async () => {
    const custom = customProcessor();
    const resolved = await bareAgent({ errorProcessors: [custom] }).listErrorProcessors();

    expect(resolved.map(p => p.id)).toEqual(['custom-error-processor', ...DEFAULT_ERROR_PROCESSOR_IDS]);
    expect(resolved[0]).toBe(custom);
  });

  it('does not duplicate a caller processor whose id matches a default', async () => {
    const customCompat = new ProviderHistoryCompat();
    const resolved = await bareAgent({ errorProcessors: [customCompat] }).listErrorProcessors();

    expect(resolved.map(p => p.id)).toEqual([...DEFAULT_ERROR_PROCESSOR_IDS]);
    expect(resolved.filter(p => p.id === 'provider-history-compat')).toEqual([customCompat]);
    expect(resolved[0]).toBe(customCompat);
  });

  it('leaves a caller list that already names every default untouched', async () => {
    const customRetry = new StreamErrorRetryProcessor({ maxRetries: 5 });
    const resolved = await bareAgent({
      errorProcessors: [
        new ProviderHistoryCompat(),
        customRetry,
        new PrefillErrorHandler(),
        new UnsupportedFileHandler(),
      ],
    }).listErrorProcessors();

    expect(resolved.map(p => p.id)).toEqual([
      'provider-history-compat',
      'stream-error-retry-processor',
      'prefill-error-handler',
      'unsupported-file-handler',
    ]);
    expect(resolved[1]).toBe(customRetry);
  });

  it('merges the defaults into an explicitly empty caller list', async () => {
    expect(await ids(bareAgent({ errorProcessors: [] }))).toEqual([...DEFAULT_ERROR_PROCESSOR_IDS]);
  });

  it('resolves a function-form errorProcessors list before deduping', async () => {
    const customCompat = new ProviderHistoryCompat();
    const resolved = await bareAgent({
      errorProcessors: () => [customCompat, customProcessor()],
    }).listErrorProcessors();

    expect(resolved.map(p => p.id)).toEqual([
      'provider-history-compat',
      'custom-error-processor',
      'prefill-error-handler',
      'unsupported-file-handler',
      'stream-error-retry-processor',
    ]);
    expect(resolved[0]).toBe(customCompat);
  });

  it('inserts the added repair processors ahead of a caller retry processor', async () => {
    const customRetry = new StreamErrorRetryProcessor({ maxRetries: 5 });
    const resolved = await bareAgent({ errorProcessors: [customRetry] }).listErrorProcessors();

    expect(resolved.map(p => p.id)).toEqual([...DEFAULT_ERROR_PROCESSOR_IDS]);
    expect(resolved[3]).toBe(customRetry);
  });

  it('inserts added defaults in canonical order around a caller processor', async () => {
    const customPrefill = new PrefillErrorHandler();
    const resolved = await bareAgent({ errorProcessors: [customPrefill] }).listErrorProcessors();

    expect(resolved.map(p => p.id)).toEqual([...DEFAULT_ERROR_PROCESSOR_IDS]);
    expect(resolved[1]).toBe(customPrefill);
  });

  it('does not reorder caller processors that carry no default id', async () => {
    const customRetry = new StreamErrorRetryProcessor({ maxRetries: 5 });
    const custom = customProcessor();
    const resolved = await bareAgent({ errorProcessors: [customRetry, custom] }).listErrorProcessors();

    expect(resolved.map(p => p.id)).toEqual([...DEFAULT_ERROR_PROCESSOR_IDS, 'custom-error-processor']);
    expect(resolved[1]).toBeInstanceOf(PrefillErrorHandler);
    expect(resolved[2]).toBeInstanceOf(UnsupportedFileHandler);
    expect(resolved[3]).toBe(customRetry);
    expect(resolved[4]).toBe(custom);
  });

  it('reports only caller-configured ids from getConfiguredProcessorIds', async () => {
    expect((await bareAgent().getConfiguredProcessorIds()).errorProcessorIds).toEqual([]);
    expect(
      (await bareAgent({ errorProcessors: [customProcessor()] }).getConfiguredProcessorIds()).errorProcessorIds,
    ).toEqual(['custom-error-processor']);
  });

  it('runs only the caller list when errorProcessorDefaults is false', async () => {
    const custom = customProcessor();
    expect(await bareAgent({ errorProcessors: [custom], errorProcessorDefaults: false }).listErrorProcessors()).toEqual(
      [custom],
    );
  });

  it('resolves no error processors for a bare agent when errorProcessorDefaults is false', async () => {
    expect(await bareAgent({ errorProcessorDefaults: false }).listErrorProcessors()).toEqual([]);
  });
});
