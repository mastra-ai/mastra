import pMapModule from 'p-map';
import { interopDefault } from './interop';

export { pMapSkip } from 'p-map';

/**
 * `p-map` is ESM-only. Import pMap from here, not from the package, so that the
 * CommonJS build gets the function instead of the module namespace. See
 * {@link interopDefault}.
 */
export const pMap = interopDefault(pMapModule);
