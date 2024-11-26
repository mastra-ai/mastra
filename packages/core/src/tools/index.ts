import { Integration } from '../';
import { ToolApi } from './types';

export function createTool<
  IN extends Record<string, any> = Record<string, any>,
  OUT extends Record<string, any> = Record<string, any>,
>(opts: ToolApi<IN, OUT>): ToolApi<IN, OUT> {
  return opts;
}
