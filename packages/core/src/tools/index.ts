import { Integration } from '../';
import { ToolApi } from './types';

// TODO: Passing the In/out generics works but seems to break on plugin to mastra, fix.
export function createTool<
  IN extends Record<string, any> = Record<string, any>,
  OUT extends Record<string, any> = Record<string, any>,
>(opts: ToolApi<IN, OUT>): ToolApi<IN, OUT> {
  return opts as ToolApi<IN, OUT>;
}
