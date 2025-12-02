interface StackFrame {
    args?: any[];
    columnNumber?: number;
    lineNumber?: number;
    fileName?: string;
    functionName?: string;
    source?: string;
}
/**
 * Simplified representation of a stack frame.
 */
interface StackFrameLite {
    function?: string;
    args?: any[];
    file?: string;
    col?: number;
    line?: number;
    raw?: string;
}
interface ParseOptions {
    /**
     * Slice the stack from the given index.
     * This could save some computation to avoid parsing unneeded stack frames.
     */
    slice?: number | [number, number];
    /**
     * Whether to return empty stack or throw an error when `stack` not found.
     *
     * By default, `parse` will throw an error when `stack` not found.
     *
     * @default false
     */
    allowEmpty?: boolean;
}

/**
 * Port from https://github.com/stacktracejs/error-stack-parser
 */

/**
 * Given an Error object, extract the most information from it.
 *
 * @param {Error} error object
 * @param {ParseOptions} options
 * @return {Array} of StackFrames
 */
declare function parse(error: Error, options?: ParseOptions): StackFrameLite[];
/**
 * Parse stack string from V8, Firefox, or IE into an array of StackFrames.
 */
declare function parseStack(stackString: string, options?: ParseOptions): StackFrameLite[];
/**
 * Separate line and column numbers from a string of the form: (URI:Line:Column)
 */
declare function extractLocation(urlLike: string): [string, string | undefined, string | undefined];
declare function parseV8OrIE(error: Error, options?: ParseOptions): StackFrameLite[];
declare function parseV8OrIeString(stack: string, options?: ParseOptions): StackFrameLite[];
declare function parseFFOrSafari(error: Error, options?: ParseOptions): StackFrameLite[];
declare function parseFFOrSafariString(stack: string, options?: ParseOptions): StackFrameLite[];
declare function parseOpera(e: Error, options?: ParseOptions): StackFrameLite[];
declare function parseOpera9(e: Error, options?: ParseOptions): StackFrameLite[];
declare function parseOpera10(e: Error, options?: ParseOptions): StackFrameLite[];
declare function parseOpera11(error: Error, options?: ParseOptions): StackFrameLite[];

export { type ParseOptions, type StackFrame, type StackFrameLite, extractLocation, parse, parseFFOrSafari, parseFFOrSafariString, parseOpera, parseOpera10, parseOpera11, parseOpera9, parseStack, parseV8OrIE, parseV8OrIeString };
