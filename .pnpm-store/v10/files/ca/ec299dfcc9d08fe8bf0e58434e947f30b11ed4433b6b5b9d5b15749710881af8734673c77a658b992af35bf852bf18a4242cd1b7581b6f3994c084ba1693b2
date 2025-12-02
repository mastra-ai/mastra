/**
 * Represents a debug message the user might want to print out for logging
 * while debugging or whatnot. These will always come by way of the 'error'
 * channel on streams or other event emitters. It's completely fine to
 * ignore them, as some will just be verbose logging info, but they may
 * help figure out what's going wrong. Support may also ask you to catch
 * these channels, which you can do like so:
 *
 * ```
 * subscription.on('debug', msg => console.log(msg.message));
 * ```
 *
 * These values are _not_ guaranteed to remain stable, even within a major
 * version, so don't depend on them for your program logic. Debug outputs
 * may be added or removed at any time, without warning.
 */
export declare class DebugMessage {
    message: string;
    error?: Error | undefined;
    constructor(message: string, error?: Error | undefined);
}
