import type { ParserConfig, TokensMap } from '../../src/types.js';
import { type ConsoleFormatter } from './formatter.js';
/**
 * Styles to use for pretty printing parser tokens. The token
 * printer receives a string value and must return back
 * a styled string value.
 *
 * @example
 * ```ts
 * {
 *   braces: (value) => chalk.yellow(value)
 * }
 * ```
 */
export type ConsolePrinterStyles = {
    braces: (value: string) => string;
    brackets: (value: string) => string;
    string: (value: string) => string;
    number: (value: string) => string;
    boolean: (value: string) => string;
    bigInt: (value: string) => string;
    undefined: (value: string) => string;
    null: (value: string) => string;
    symbol: (value: string) => string;
    regex: (value: string) => string;
    date: (value: string) => string;
    buffer: (value: string) => string;
    /**
     * Styles for displaying the function value with
     * its name
     */
    functionLabel: (value: string) => string;
    /**
     * Styles for displaying the class value with
     * its name
     */
    classLabel: (value: string) => string;
    /**
     * Styles for the Object label. Use braces setting to define
     * the braces color
     */
    objectLabel: (value: string) => string;
    /**
     * Styles for the Object key name
     */
    objectKey: (value: string) => string;
    /**
     * Styles for the Object key prefix name.
     */
    objectKeyPrefix: (value: string) => string;
    /**
     * Styles for the Array label. Use brackets setting to define
     * the brackets color
     */
    arrayLabel: (value: string) => string;
    /**
     * Styles for the Map label. Use brackets setting to define
     * the brackets color
     */
    mapLabel: (value: string) => string;
    /**
     * Styles for the Set label. Use brackets setting to define
     * the brackets color
     */
    setLabel: (value: string) => string;
    collapseLabel: (value: string) => string;
    circularLabel: (value: string) => string;
    getterLabel: (value: string) => string;
    weakSetLabel: (value: string) => string;
    weakRefLabel: (value: string) => string;
    weakMapLabel: (value: string) => string;
    observableLabel: (value: string) => string;
    promiseLabel: (value: string) => string;
    generatorLabel: (value: string) => string;
    prototypeLabel: (value: string) => string;
    /**
     * Styles for displaying Blob keyword label. The blob
     * properties like the type and size are styled as
     * an object
     */
    blobLabel: (value: string) => string;
    /**
     * Styles for displaying values not parsed by the
     * parser as first-class citizen but still printed
     * by casting them to String
     */
    unknownLabel: (value: string) => string;
};
/**
 * Printers collection that are used to print parser
 * tokens to ANSI output (one at a time)
 */
export type TokenPrinters = {
    [K in keyof TokensMap]: (
    /**
     * Value of the token
     */
    token: TokensMap[K], 
    /**
     * Formatter reference
     */
    formatter: ConsoleFormatter) => string;
};
/**
 * Config accepted by the Console Formatter
 */
export type ConsoleFormatterConfig = {
    styles?: Partial<ConsolePrinterStyles>;
};
/**
 * Configuration accepted by the "dump" method exported
 * by the cli sub-module.
 */
export type ConsoleDumpConfig = ParserConfig & ConsoleFormatterConfig;
