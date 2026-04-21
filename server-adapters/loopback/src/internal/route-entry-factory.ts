import type { Context } from '@loopback/core';
import { RestBindings } from '@loopback/rest';
import type { OperationObject, Request, Response, RouteEntry } from '@loopback/rest';

export interface LoopbackRouteInvocationContext {
  requestContext: Context;
  req: Request;
  res: Response;
  startedAt: number;
  abortController: AbortController;
}

export function createLoopbackRouteEntry(input: {
  verb: string;
  path: string;
  spec: OperationObject;
  handle: (context: LoopbackRouteInvocationContext) => Promise<Response>;
}): RouteEntry {
  return {
    verb: input.verb.toLowerCase(),
    path: input.path,
    spec: input.spec,
    updateBindings: requestContext => {
      requestContext.bind(RestBindings.OPERATION_SPEC_CURRENT).to(input.spec);
    },
    invokeHandler: async (requestContext, _args) => {
      const req = await requestContext.get(RestBindings.Http.REQUEST);
      const res = await requestContext.get(RestBindings.Http.RESPONSE);
      const startedAt = Date.now();
      const abortController = new AbortController();
      const abortRequest = () => {
        if (!abortController.signal.aborted) {
          abortController.abort();
        }
      };

      req.once('aborted', abortRequest);
      req.once('close', abortRequest);
      res.once('close', abortRequest);
      res.once('finish', abortRequest);

      try {
        return await input.handle({
          requestContext,
          req,
          res,
          startedAt,
          abortController,
        });
      } finally {
        req.removeListener('aborted', abortRequest);
        req.removeListener('close', abortRequest);
        res.removeListener('close', abortRequest);
        res.removeListener('finish', abortRequest);
      }
    },
    describe: () => `${input.verb.toUpperCase()} ${input.path}`,
  };
}
