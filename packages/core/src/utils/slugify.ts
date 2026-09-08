import slugifyModule from '@sindresorhus/slugify';
import { interopDefault } from './interop';

/**
 * `@sindresorhus/slugify` is ESM-only. Import slugify from here, not from the
 * package, so that the CommonJS build gets the function instead of the module
 * namespace. See {@link interopDefault}.
 */
export const slugify = interopDefault(slugifyModule);
