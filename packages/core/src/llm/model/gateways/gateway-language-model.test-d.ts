import type { LanguageModelV4, LanguageModelV4StreamPart } from '@ai-sdk/provider-v7';
import { describe, expectTypeOf, it } from 'vitest';
import type { MastraModelConfig } from '../shared.types';
import type { GatewayLanguageModel } from './base';

/**
 * `@ai-sdk/provider` 4.0.36 added the opt-in `{ type: 'ping' }` stream part. `@mastra/core` vendors
 * its `@ai-sdk/provider-v7` copy into the published declarations, so a model built on a provider
 * package newer than that copy only resolves against `GatewayLanguageModel` / `MastraModelConfig`
 * while the vendored copy is at least that new. These assertions fail as soon as the pin drops
 * below a provider version that has the part, which is what regressed in #30454.
 */
type PingStreamPart = { type: 'ping' };
type ModelOnNewerProvider = Omit<LanguageModelV4, 'doStream'> & {
  doStream: (
    options: Parameters<LanguageModelV4['doStream']>[0],
  ) => PromiseLike<{ stream: ReadableStream<LanguageModelV4StreamPart | PingStreamPart> }>;
};

describe('GatewayLanguageModel provider compatibility', () => {
  it('accepts a model whose stream may include the ping part added in @ai-sdk/provider 4.0.36', () => {
    expectTypeOf<ModelOnNewerProvider>().toExtend<GatewayLanguageModel>();
    expectTypeOf<ModelOnNewerProvider>().toExtend<MastraModelConfig>();
  });
});
