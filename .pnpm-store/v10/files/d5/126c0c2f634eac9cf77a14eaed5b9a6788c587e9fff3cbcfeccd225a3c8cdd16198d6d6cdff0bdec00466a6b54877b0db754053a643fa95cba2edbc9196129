import type { Token } from '../../src/types.js';
import type { ConsoleFormatterConfig, ConsolePrinterStyles } from './types.js';
/**
 * ConsoleFormatter is used to format a collection of parser
 * tokens to CLI output.
 *
 * @example
 * ```ts
 * const parser = new Parser()
 * parser.parse(value)
 *
 * const tokens = parser.flush()
 *
 * const formatter = new ConsoleFormatter()
 * const output = formatter.format(tokens)
 * ```
 */
export declare class ConsoleFormatter {
    /**
     * Styles for output elements
     */
    readonly styles: ConsolePrinterStyles;
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
    constructor(config?: ConsoleFormatterConfig, context?: Record<string, any>);
    /**
     * Format a collection of tokens to ANSI output
     */
    format(tokens: Token[]): string;
}
