import { Integration } from '../';
import { ToolApi } from './types';

// TODO: Passing the In/out generics works but seems to break on plugin to mastra, fix.
export function createTool<
  TIntegrations extends Integration[] | undefined = undefined,
  IN extends Record<string, any> = Record<string, any>,
  OUT extends Record<string, any> = Record<string, any>
>(opts: ToolApi<TIntegrations, IN, OUT>): ToolApi<TIntegrations> {
  return opts as ToolApi<TIntegrations>;
}
