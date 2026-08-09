import { describe, expectTypeOf, it } from 'vitest';
import type { ModelForProvider, ModelRouterModelId, Provider } from '../index.js';

// Custom gateways register their providers by augmenting the package entry point.
// This mirrors the documented pattern for custom gateways, where users write
// `declare module '@mastra/core/llm'`.
declare module '../index.js' {
  interface ProviderModelsMap {
    'augmentation-test-provider': readonly ['model-1', 'model-2'];
  }
}

// `ModelRouterModelId` ends in a `(string & {})` arm so arbitrary strings stay
// assignable, which makes a plain `toExtend<ModelRouterModelId>` check vacuous.
// Drop that arm so the assertions below test the generated/augmented paths.
type KnownModelRouterModelId<T = ModelRouterModelId> = T extends string ? (string extends T ? never : T) : never;

describe('ProviderModelsMap augmentation', () => {
  it('adds the augmented provider to Provider', () => {
    expectTypeOf<'augmentation-test-provider'>().toExtend<Provider>();
  });

  it('resolves the augmented provider models through ModelForProvider', () => {
    expectTypeOf<ModelForProvider<'augmentation-test-provider'>>().toEqualTypeOf<'model-1' | 'model-2'>();
  });

  it('includes augmented provider/model paths in ModelRouterModelId', () => {
    expectTypeOf<'augmentation-test-provider/model-1'>().toExtend<KnownModelRouterModelId>();
    expectTypeOf<'augmentation-test-provider/model-2'>().toExtend<KnownModelRouterModelId>();
    expectTypeOf<'augmentation-test-provider/not-a-model'>().not.toExtend<KnownModelRouterModelId>();
  });

  it('keeps generated providers intact', () => {
    expectTypeOf<'openai'>().toExtend<Provider>();
    expectTypeOf<ModelForProvider<'openai'>>().not.toBeNever();
    expectTypeOf<'not-a-real-provider'>().not.toExtend<Provider>();
  });
});
