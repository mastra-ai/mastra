import type { ParserConfig, Token } from './types.js';
/**
 * Parser is used to parse a JavaScript value into a set
 * of tokens that can be used to pretty-print the same
 * value.
 *
 * @example
 * ```ts
 * import { Parser } from '@poppinss/dumper'
 *
 * const parser = new Parser()
 * const value = {
 *   id: 1,
 *   username: 'foo',
 * }
 *
 * parser.parse(value)
 * parser.flush() // Token[]
 * ```
 */
export declare class Parser {
    #private;
    /**
     * Config shared with tokenizers
     */
    config: Readonly<Required<ParserConfig>>;
    /**
     * Context maintained through out the parsing phase.
     * Each instance of Parser has its own context
     * that gets mutated internally.
     */
    context: Record<string, any>;
    constructor(config?: ParserConfig, context?: Record<string, any>);
    /**
     * Collect a token inside the list of tokens. The order
     * of tokens matter during printing therefore you must
     * collect tokens in the right order.
     */
    collect(token: Token): void;
    /**
     * Parses a value using the tokenizers. Under the hood the
     * tokenizers will call "parser.collect" to collect
     * tokens inside an array.
     *
     * You can use "parser.flush" method to get the list of
     * tokens.
     */
    parse(value: unknown): void;
    /**
     * Returns collected tokens and resets the internal state.
     */
    flush(): Token[];
}
