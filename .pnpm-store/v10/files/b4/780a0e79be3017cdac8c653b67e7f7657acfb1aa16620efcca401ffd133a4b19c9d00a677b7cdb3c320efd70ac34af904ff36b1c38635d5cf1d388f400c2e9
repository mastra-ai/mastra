import type { Parser, SourceLoader, Transformer } from 'youch-core/types';
import { Metadata } from './metadata.js';
import { Templates } from './templates.js';
import { type YouchANSIOptions, type YouchHTMLOptions, type YouchJSONOptions } from './types.js';
/**
 * Youch exposes the API to render errors to HTML output
 */
export declare class Youch {
    #private;
    /**
     * Manage templates used for converting error to the HTML
     * output
     */
    templates: Templates;
    /**
     * Define metadata to be displayed alongside the error output
     */
    metadata: Metadata;
    /**
     * Define custom implementation for loading the source code
     * of a stack frame.
     */
    defineSourceLoader(loader: SourceLoader): this;
    /**
     * Define a custom parser. Parsers are executed before the
     * error gets parsed and provides you with an option to
     * modify the error
     */
    useParser(parser: Parser): this;
    /**
     * Define a custom transformer. Transformers are executed
     * after the error has been parsed and can mutate the
     * properties of the parsed error.
     */
    useTransformer(transformer: Transformer): this;
    /**
     * Parses error to JSON
     */
    toJSON(error: unknown, options?: YouchJSONOptions): Promise<import("youch-core/types").ParsedError>;
    /**
     * Render error to HTML
     */
    toHTML(error: unknown, options?: YouchHTMLOptions): Promise<string>;
    /**
     * Render error to ANSI output
     */
    toANSI(error: unknown, options?: YouchANSIOptions): Promise<string>;
}
