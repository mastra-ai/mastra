import type { ScreencastOptions } from './types.js';

/**
 * Default screencast options.
 * Optimized for balance between quality and bandwidth.
 */
export const SCREENCAST_DEFAULTS: Required<ScreencastOptions> = {
  format: 'jpeg',
  quality: 70,
  maxWidth: 1280,
  maxHeight: 720,
  everyNthFrame: 2,
};

/**
 * Maximum number of reconnection attempts before giving up.
 */
export const MAX_RETRIES = 3;

/**
 * Delay between retry attempts in milliseconds.
 * Exponential backoff: 1s, 2s, 4s
 */
export const RETRY_DELAYS = [1000, 2000, 4000];
