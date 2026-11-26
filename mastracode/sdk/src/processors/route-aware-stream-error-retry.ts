import { classifyProviderError } from '@mastra/core/error';
import { StreamErrorRetryProcessor } from '@mastra/core/processors';
import type {
  ProcessAPIErrorArgs,
  ProcessAPIErrorResult,
  StreamErrorRetryProcessorOptions,
} from '@mastra/core/processors';

import { resolveCredentialStore } from '../agents/credential-resolver.js';
import { requestRouteHasNextModel } from '../agents/model.js';
import { requestHasUntriedAccount } from '../auth/account-rotation-processor.js';
import type { RoutingControllerContext } from '../auth/account-rotation-processor.js';
import type { CredentialStore } from '../auth/types.js';

/**
 * Leaves a rate limit to account rotation whenever the request can move on:
 * to another subscription of the provider, or to the route's next model.
 * Only with nowhere left to go does it wait out `Retry-After` and retry.
 */
export class RouteAwareStreamErrorRetryProcessor extends StreamErrorRetryProcessor {
  readonly #credentialStore: CredentialStore;

  constructor(options: StreamErrorRetryProcessorOptions & { credentialStore: CredentialStore }) {
    super(options);
    this.#credentialStore = options.credentialStore;
  }

  override async processAPIError(args: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    if (classifyProviderError(args.error) === 'rate_limited') {
      const store = resolveCredentialStore(args.requestContext) ?? this.#credentialStore;
      if (requestHasUntriedAccount(args, store) || routeCanHop(args)) return;
    }
    return super.processAPIError(args);
  }
}

function routeCanHop({ requestContext }: ProcessAPIErrorArgs): boolean {
  const controller = requestContext?.get('controller') as RoutingControllerContext | undefined;
  return requestRouteHasNextModel(requestContext, controller);
}
