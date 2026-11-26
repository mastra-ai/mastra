import { classifyProviderError } from '@mastra/core/error';
import { StreamErrorRetryProcessor } from '@mastra/core/processors';
import type { ProcessAPIErrorArgs, ProcessAPIErrorResult } from '@mastra/core/processors';

import { requestRouteHasNextModel } from '../agents/model.js';
import type { RoutingControllerContext } from '../auth/account-rotation-processor.js';

export class RouteAwareStreamErrorRetryProcessor extends StreamErrorRetryProcessor {
  override async processAPIError(args: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    if (classifyProviderError(args.error) === 'rate_limited' && routeCanHop(args)) return;
    return super.processAPIError(args);
  }
}

function routeCanHop({ requestContext }: ProcessAPIErrorArgs): boolean {
  const controller = requestContext?.get('controller') as RoutingControllerContext | undefined;
  return requestRouteHasNextModel(requestContext, controller);
}
