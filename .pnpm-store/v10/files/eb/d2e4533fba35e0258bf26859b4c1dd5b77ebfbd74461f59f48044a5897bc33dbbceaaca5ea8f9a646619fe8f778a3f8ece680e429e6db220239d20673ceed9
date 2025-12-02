import type { HTMLDumpConfig } from './types.js';
export * from './head.js';
export { themes } from './themes.js';
export { HTMLFormatter } from './formatter.js';
export { HTMLPrinters } from './printers/main.js';
/**
 * Generate pretty printed HTML output for the provided value. You can
 * specify the parser and the formatter options as the 2nd argument.
 *
 * @example
 * ```ts
 * const html = dump(someValue)
 *
 * // With Parser options
 * const html = dump(someValue, {
 *   inspectObjectPrototype: true,
 *   depth: 10,
 *   showHidden: true,
 * })
 *
 * // With Formatter options
 * const html = dump(someValue, {
 *   styles: {
 *     number: 'color: yellow; font-weight: bold;'
 *   }
 * })
 * ```
 */
export declare function dump(value: any, config?: HTMLDumpConfig): string;
