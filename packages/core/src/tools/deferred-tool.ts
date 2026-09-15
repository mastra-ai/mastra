import type { RequestContext } from '../request-context';
import type { Tool } from './tool';

/** Search metadata whose executable schema is resolved only on activation. */
export interface DeferredTool {
  id: string;
  description: string;
  /** Stable execution target, such as a provider account pin. Never sent to the model. */
  binding?: string;
  /** Resolve against this invocation's identity; never reuse another request's tool. */
  resolve: (args: { requestContext?: RequestContext }) => Promise<Tool<any, any>>;
}

export function isDeferredTool(tool: Tool<any, any> | DeferredTool): tool is DeferredTool {
  return 'resolve' in tool && typeof tool.resolve === 'function';
}
