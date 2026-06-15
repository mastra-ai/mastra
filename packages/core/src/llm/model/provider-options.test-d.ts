import { describe, expectTypeOf, it } from 'vitest';
import type { ProviderOptions } from './provider-options';

describe('ProviderOptions type tests', () => {
  it('accepts Azure Responses WebSocket options with Responses continuation options', () => {
    const options: ProviderOptions = {
      azure: {
        transport: 'websocket',
        websocket: {
          url: 'wss://example-resource.openai.azure.com/openai/v1/responses',
          headers: { 'x-ms-client-request-id': 'request-1' },
          closeOnFinish: false,
        },
        store: false,
        previousResponseId: 'resp_123',
      },
    };

    expectTypeOf(options.azure?.transport).toEqualTypeOf<'auto' | 'websocket' | 'fetch' | undefined>();
    expectTypeOf(options.azure?.websocket?.closeOnFinish).toEqualTypeOf<boolean | undefined>();
    expectTypeOf(options.azure?.previousResponseId).toEqualTypeOf<string | null | undefined>();
  });
});
