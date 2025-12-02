/**
 * The base64url helper was extracted from the rfc4648 package
 * in order to resolve CSJ/ESM interoperability issues
 *
 * https://github.com/swansontec/rfc4648.js
 *
 * For more context please refer to:
 * - https://github.com/evanw/esbuild/issues/1719
 * - https://github.com/evanw/esbuild/issues/532
 * - https://github.com/swansontec/rollup-plugin-mjs-entry
 */
export declare const base64url: {
    parse(string: string, opts?: ParseOptions): Uint8Array;
    stringify(data: ArrayLike<number>, opts?: StringifyOptions): string;
};
interface ParseOptions {
    loose?: boolean;
    out?: new (size: number) => {
        [index: number]: number;
    };
}
interface StringifyOptions {
    pad?: boolean;
}
export {};
//# sourceMappingURL=rfc4648.d.ts.map