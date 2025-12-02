import { ParseOptions, StackFrame } from './lite.cjs';
export { StackFrameLite, extractLocation } from './lite.cjs';

/**
 * Port from https://github.com/stacktracejs/error-stack-parser
 */

/**
 * Given an Error object, extract the most information from it.
 *
 * @param {Error} error object
 * @return {Array} of StackFrames
 */
declare function parse(error: Error, options?: ParseOptions): StackFrame[];
declare function parseV8OrIE(error: Error): StackFrame[];
declare function parseFFOrSafari(error: Error): StackFrame[];
declare function parseOpera(e: Error): StackFrame[];
declare function parseOpera9(e: Error): StackFrame[];
declare function parseOpera10(e: Error): StackFrame[];
declare function parseOpera11(error: Error): StackFrame[];

export { ParseOptions, StackFrame, parse, parseFFOrSafari, parseOpera, parseOpera10, parseOpera11, parseOpera9, parseV8OrIE };
