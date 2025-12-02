/// <reference types="node" />
import * as stream from "stream";
export declare const pipeline: typeof stream.pipeline.__promisify__;
export declare function arrayify<T>(value: T | Array<T> | Readonly<T> | ReadonlyArray<T> | undefined | null): Array<T>;
export interface ParsedLocation {
    url: string;
    isRelative: boolean;
}
export declare function parseLocation(location: string | Array<string> | undefined, origin: string): null | ParsedLocation;
export declare const isRedirectStatus: {
    [status: string]: boolean;
};
export declare function makeOkError(err: Error): Error;
export declare function parseInput(url: string): {
    hostname: string;
    origin: string;
    port: string;
    protocol: string;
    url: string;
};
export declare const identity: <T>(t: T) => T;
export declare function uniq<T>(arr: ReadonlyArray<T>): Array<T>;
export declare function uniq<T, U>(arr: ReadonlyArray<T>, pred: (t: T) => U): Array<T>;
export declare function hasBuiltinBrotli(): boolean;
