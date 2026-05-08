import type { ClientOptions, GetProcessorProviderResponse } from '../types';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific processor provider
 */
export class ProcessorProvider extends BaseResource {
  constructor(
    options: ClientOptions,
    private providerId: string,
  ) {
    super(options);
  }

  /**
   * Gets details about this processor provider and its available processors
   * @returns Promise containing provider info and processor list
   */
  details(): Promise<GetProcessorProviderResponse> {
    return this.request(`/processor-providers/${encodeURIComponent(this.providerId)}`);
  }
}
