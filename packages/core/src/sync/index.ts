import { MastraEngine } from '../engine';

import { syncApi } from './types';

export function createSync<
  In extends Record<string, unknown> = Record<string, unknown>,
  Out extends Record<string, unknown> = Record<string, unknown>,
>(opts: syncApi<In, Out>) {
  return opts as syncApi<In, Out>;
}
