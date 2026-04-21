import { inject } from '@loopback/core';
import type { Provider } from '@loopback/core';
import type { RequestContext } from '@mastra/core/request-context';

import { MastraLoopbackBindings } from '../bindings.js';

export class CurrentLoopbackMastraRequestContextProvider implements Provider<RequestContext | undefined> {
  constructor(
    @inject(MastraLoopbackBindings.REQUEST_CONTEXT_VALUE, { optional: true })
    private readonly requestContext?: RequestContext,
  ) {}

  value(): RequestContext | undefined {
    return this.requestContext;
  }
}
