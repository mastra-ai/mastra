import type { ParsedError, StackFrame } from 'youch-core/types';
import type { Metadata } from './metadata.js';
import type { BaseComponent } from './component.js';
export * from 'youch-core/types';
/**
 * Props accepted by the Layout component
 */
export type LayoutProps = ComponentSharedProps & {
    title: string;
    children: () => string | Promise<string>;
};
/**
 * Props accepted by the Error stack source component
 */
export type ErrorStackSourceProps = ComponentSharedProps & {
    error: ParsedError;
    frame: StackFrame;
};
/**
 * Props accepted by the Error stack component
 */
export type ErrorStackProps = ComponentSharedProps & {
    error: ParsedError;
    ide: string;
    sourceCodeRenderer: (error: ParsedError, frame: StackFrame) => Promise<string>;
};
/**
 * Props accepted by the Error info component
 */
export type ErrorInfoProps = ComponentSharedProps & {
    title: string;
    error: ParsedError;
};
/**
 * Props accepted by the Error cause component
 */
export type ErrorCauseProps = ComponentSharedProps & {
    error: ParsedError;
};
/**
 * Props accepted by the Error metadata component
 */
export type ErrorMetadataProps = ComponentSharedProps & {
    metadata: Metadata;
};
/**
 * Error metadata row represents a key-value pair
 */
export type ErrorMetadataRow = {
    key: string;
    dump?: boolean;
    value: any;
};
/**
 * Representation of Error metadata groups. Each group is
 * a collection of named sections
 */
export type ErrorMetadataGroups = {
    [group: string]: {
        [section: string]: ErrorMetadataRow | ErrorMetadataRow[];
    };
};
/**
 * Props shared with all the components
 */
export type ComponentSharedProps = {
    ide?: string;
    cspNonce?: string;
};
/**
 * Collection of known templates. Only these templates can be
 * rendered using the Templates collection
 */
export type YouchTemplates = {
    header: BaseComponent<ComponentSharedProps>;
    layout: BaseComponent<LayoutProps>;
    errorInfo: BaseComponent<ErrorInfoProps>;
    errorStack: BaseComponent<ErrorStackProps>;
    errorStackSource: BaseComponent<ErrorStackSourceProps>;
    errorCause: BaseComponent<ErrorCauseProps>;
    errorMetadata: BaseComponent<ErrorMetadataProps>;
};
/**
 * Set of options accepted by Youch when rendering error
 * to HTML
 */
export type YouchHTMLOptions = {
    /**
     * Define the offset to skip certain stack frames from
     * the top
     */
    offset?: number;
    /**
     * Number of lines of code to display for the error stack frame.
     * For example: If you set the frameSourceBuffer=7, then 3 lines
     * above the error line and 3 lines after the error line will
     * be displayed.
     */
    frameSourceBuffer?: number;
    /**
     * Define the error title. It could be the HTTP status
     * text
     */
    title?: string;
    /**
     * Define the name of the IDE in which to open the files when
     * the filename anchor tag is clicked.
     *
     * Following is the list of supported editors
     *
     * - textmate
     * - macvim
     * - emacs
     * - sublime
     * - phpstorm
     * - atom
     * - vscode
     *
     * You can also specify the URL for the editor via the `ide` property. Make
     * sure to specify the placeholders for the filename and the line number
     * as follows.
     *
     * someprotocol://file/%f:%l
     *
     * - %f is the filename placeholder
     * - %l is the line number placeholder
     */
    ide?: string;
    /**
     * CSP nonce to define on inline style and script tags
     */
    cspNonce?: string;
    /**
     * Specify the HTTP request properties to be printed as
     * metadata under the "Request" group
     */
    request?: {
        url?: string;
        method?: string;
        headers?: Record<string, string | string[] | undefined>;
    };
};
/**
 * Set of options accepted by Youch when rendering error
 * to ANSI output
 */
export type YouchANSIOptions = {
    /**
     * Define the offset to skip certain stack frames from
     * the top
     */
    offset?: number;
    /**
     * Number of lines of code to display for the error stack frame.
     * For example: If you set the frameSourceBuffer=7, then 3 lines
     * above the error line and 3 lines after the error line will
     * be displayed.
     */
    frameSourceBuffer?: number;
};
/**
 * Set of options accepted by Youch when rendering error
 * to JSON output
 */
export type YouchJSONOptions = {
    /**
     * Define the offset to skip certain stack frames from
     * the top
     */
    offset?: number;
    /**
     * Number of lines of code to display for the error stack frame.
     * For example: If you set the frameSourceBuffer=7, then 3 lines
     * above the error line and 3 lines after the error line will
     * be displayed.
     */
    frameSourceBuffer?: number;
};
