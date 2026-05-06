import { describe, expectTypeOf, it } from 'vitest';
import type { ProviderOptions } from './provider-options';

describe('ProviderOptions type tests', () => {
  it('accepts Azure Responses continuation options', () => {
    const options: ProviderOptions = {
      azure: {
        store: false,
        previousResponseId: 'resp_123',
      },
    };

    expectTypeOf(options.azure?.previousResponseId).toEqualTypeOf<string | null | undefined>();
  });
});
