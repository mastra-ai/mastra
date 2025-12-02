/**
 * HMAC: RFC2104 message authentication code.
 * @module
 */
import { type CHash, type Hash } from './utils.ts';
/** Internal class for HMAC. */
export declare class _HMAC<T extends Hash<T>> implements Hash<_HMAC<T>> {
    oHash: T;
    iHash: T;
    blockLen: number;
    outputLen: number;
    private finished;
    private destroyed;
    constructor(hash: CHash, key: Uint8Array);
    update(buf: Uint8Array): this;
    digestInto(out: Uint8Array): void;
    digest(): Uint8Array;
    _cloneInto(to?: _HMAC<T>): _HMAC<T>;
    clone(): _HMAC<T>;
    destroy(): void;
}
/**
 * HMAC: RFC2104 message authentication code.
 * @param hash - function that would be used e.g. sha256
 * @param key - message key
 * @param message - message data
 * @example
 * import { hmac } from '@noble/hashes/hmac';
 * import { sha256 } from '@noble/hashes/sha2';
 * const mac1 = hmac(sha256, 'key', 'message');
 */
export declare const hmac: {
    (hash: CHash, key: Uint8Array, message: Uint8Array): Uint8Array;
    create(hash: CHash, key: Uint8Array): _HMAC<any>;
};
//# sourceMappingURL=hmac.d.ts.map