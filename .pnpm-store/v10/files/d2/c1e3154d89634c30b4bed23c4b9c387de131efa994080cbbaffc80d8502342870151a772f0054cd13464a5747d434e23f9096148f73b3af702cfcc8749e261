import type { Parser, Transformer, ParsedError, SourceLoader, YouchParserOptions } from './types.js';
/**
 * ErrorParser exposes the API to parse an thrown value and extract
 * the frames along with their location from it.
 */
export declare class ErrorParser {
    #private;
    /**
     * FS source loader reads the file contents from the filesystem
     * for all non-native frames
     */
    static fsSourceLoader: SourceLoader;
    constructor(options?: YouchParserOptions);
    /**
     * Register a parser. Parsers are synchronous functions
     * that can be used to pre-process the source value
     * before it get parsed.
     *
     * @example
     * ```ts
     * sourceFile.useParser((source) => {
     *   if (valueCanBeParsed) {
     *     return newValue
     *   }
     *   return source
     * })
     * ```
     */
    useParser(parser: Parser): this;
    /**
     * Register a transformer. Transformers can be async functions
     * to post-process the parsed error value.
     *
     * @example
     * ```ts
     * sourceFile.useTransformer((error, source) => {
     *   // mutate "error" properties
     * })
     * ```
     */
    useTransformer(transformer: Transformer): this;
    /**
     * Define a custom source loader to load the contents of the
     * source file within the error stack.
     *
     * For example: You might want to register a custom source loader
     * that makes an fetch call to the server to read the source of
     * the file within the error stack.
     */
    defineSourceLoader(loader: SourceLoader): this;
    /**
     * Parse an unknown value into a parsed error object.
     */
    parse(source: unknown): Promise<ParsedError>;
}
