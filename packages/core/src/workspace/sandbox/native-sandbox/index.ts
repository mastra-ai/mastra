/**
 * Native Sandbox
 *
 * Platform detection and command wrapping for OS-native sandboxing.
 */

export * from './types';
export {
  detectIsolation,
  isIsolationAvailable,
  getRecommendedIsolation,
  isSeatbeltAvailable,
  isBwrapAvailable,
} from './detect';
export { generateSeatbeltProfile, buildSeatbeltCommand } from './seatbelt';
export { buildBwrapCommand } from './bubblewrap';
export { wrapCommand, type WrappedCommand, type WrapCommandOptions } from './wrapper';
