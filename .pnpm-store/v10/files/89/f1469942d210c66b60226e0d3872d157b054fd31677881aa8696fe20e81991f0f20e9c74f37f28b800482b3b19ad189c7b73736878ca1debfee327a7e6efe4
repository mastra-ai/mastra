/*!
 * node-progress
 * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */
/// <reference types="node" />
/**
 * These are keys in the options object you can pass to the progress bar along with total as seen in the example above.
 */
export interface ProgressBarOptions {
    /**
     * Total number of ticks to complete.
     */
    total: number;
    /**
     * current completed index
     */
    curr?: number | undefined;
    /**
     * head character defaulting to complete character
     */
    head?: string | undefined;
    /**
     * The displayed width of the progress bar defaulting to total.
     */
    width?: number | undefined;
    /**
     * minimum time between updates in milliseconds defaulting to 16
     */
    renderThrottle?: number | undefined;
    /**
     * The output stream defaulting to stderr.
     */
    stream?: NodeJS.WritableStream | undefined;
    /**
     * Completion character defaulting to "=".
     */
    complete?: string | undefined;
    /**
     * Incomplete character defaulting to "-".
     */
    incomplete?: string | undefined;
    /**
     * Option to clear the bar on completion defaulting to false.
     */
    clear?: boolean | undefined;
    /**
     * Optional function to call when the progress bar completes.
     */
    callback?: Function | undefined;
}
export interface ProgressBarInstance {
    stream: NodeJS.WritableStream;
    fmt: string;
    curr: number;
    total: number;
    width: number;
    clear: boolean;
    chars: {
        complete: string;
        incomplete: string;
        head: string;
    };
    renderThrottle: number;
    lastRender: number;
    callback: Function;
    tokens: {
        [key: string]: any;
    };
    lastDraw: string;
    complete: boolean;
    start?: Date;
    tick(tokens?: any): void;
    tick(count?: number, tokens?: any): void;
    render(tokens?: any, force?: boolean): void;
    update(ratio: number, tokens?: any): void;
    interrupt(message: string): void;
    terminate(): void;
}
interface ProgressBarConstructor {
    new (format: string, total: number): ProgressBarInstance;
    new (format: string, options: ProgressBarOptions): ProgressBarInstance;
    prototype: ProgressBarInstance;
}
/**
 * Initialize a `ProgressBar` with the given `fmt` string and `options` or
 * `total`.
 *
 * Options:
 *
 *   - `curr` current completed index
 *   - `total` total number of ticks to complete
 *   - `width` the displayed width of the progress bar defaulting to total
 *   - `stream` the output stream defaulting to stderr
 *   - `head` head character defaulting to complete character
 *   - `complete` completion character defaulting to "="
 *   - `incomplete` incomplete character defaulting to "-"
 *   - `renderThrottle` minimum time between updates in milliseconds defaulting to 16
 *   - `callback` optional function to call when the progress bar completes
 *   - `clear` will clear the progress bar upon termination
 *
 * Tokens:
 *
 *   - `:bar` the progress bar itself
 *   - `:current` current tick number
 *   - `:total` total ticks
 *   - `:elapsed` time elapsed in seconds
 *   - `:percent` completion percentage
 *   - `:eta` eta in seconds
 *   - `:rate` rate of ticks per second
 *
 * @param {string} fmt
 * @param {object|number} options or total
 * @api public
 */
declare const ProgressBar: ProgressBarConstructor;
export default ProgressBar;
//# sourceMappingURL=index.d.ts.map