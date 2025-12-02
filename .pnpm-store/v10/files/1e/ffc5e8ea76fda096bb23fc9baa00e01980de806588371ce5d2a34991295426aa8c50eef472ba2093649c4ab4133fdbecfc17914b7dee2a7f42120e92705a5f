import type { Token } from '../../src/types.js';
import type { HTMLFormatterConfig, HTMLPrinterStyles } from './types.js';
export declare let nanoid: (length?: number) => string;
/**
 * HTMLFormatter is used to format a collection of parser
 * tokens into HTML output containing pre-tags.
 *
 * @example
 * ```ts
 * const parser = new Parser()
 * parser.parse(value)
 *
 * const tokens = parser.flush()
 *
 * const formatter = new HTMLFormatter()
 * const html = formatter.format(tokens)
 * ```
 */
export declare class HTMLFormatter {
    #private;
    /**
     * Styles for output elements
     */
    readonly styles: HTMLPrinterStyles;
    /**
     * Context maintained through out the printing
     * phase. Each instance has its own context
     * that gets mutated internally.
     */
    context: Record<string, any>;
    /**
     * Value for the newline character
     */
    readonly newLine = "\n";
    /**
     * Utility to manage indentation
     */
    readonly indentation: {
        counter: number;
        /**
         * Increment the identation by 1 step
         */
        increment(): void;
        /**
         * Decrement the identation by 1 step
         */
        decrement(): void;
        /**
         * Get the identation spaces as per the current
         * identation level
         */
        getSpaces(): string;
    };
    constructor(config?: HTMLFormatterConfig, context?: Record<string, any>);
    /**
     * Format a collection of tokens to HTML output wrapped
     * inside the `pre` tag.
     */
    format(tokens: Token[]): string;
}
