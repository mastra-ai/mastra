/**
 * Poly1305 ([PDF](https://cr.yp.to/mac/poly1305-20050329.pdf),
 * [wiki](https://en.wikipedia.org/wiki/Poly1305))
 * is a fast and parallel secret-key message-authentication code suitable for
 * a wide variety of applications. It was standardized in
 * [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439) and is now used in TLS 1.3.
 *
 * Polynomial MACs are not perfect for every situation:
 * they lack Random Key Robustness: the MAC can be forged, and can't be used in PAKE schemes.
 * See [invisible salamanders attack](https://keymaterial.net/2020/09/07/invisible-salamanders-in-aes-gcm-siv/).
 * To combat invisible salamanders, `hash(key)` can be included in ciphertext,
 * however, this would violate ciphertext indistinguishability:
 * an attacker would know which key was used - so `HKDF(key, i)`
 * could be used instead.
 *
 * Check out [original website](https://cr.yp.to/mac.html).
 * Based on Public Domain [poly1305-donna](https://github.com/floodyberry/poly1305-donna).
 * @module
 */
import { type IHash2 } from './utils.ts';
/** Poly1305 class. Prefer poly1305() function instead. */
export declare class Poly1305 implements IHash2 {
    readonly blockLen = 16;
    readonly outputLen = 16;
    private buffer;
    private r;
    private h;
    private pad;
    private pos;
    protected finished: boolean;
    constructor(key: Uint8Array);
    private process;
    private finalize;
    update(data: Uint8Array): this;
    destroy(): void;
    digestInto(out: Uint8Array): Uint8Array;
    digest(): Uint8Array;
}
export type CHash = ReturnType<typeof wrapConstructorWithKey>;
export declare function wrapConstructorWithKey<H extends IHash2>(hashCons: (key: Uint8Array) => H): {
    (msg: Uint8Array, key: Uint8Array): Uint8Array;
    outputLen: number;
    blockLen: number;
    create(key: Uint8Array): H;
};
/** Poly1305 MAC from RFC 8439. */
export declare const poly1305: CHash;
//# sourceMappingURL=_poly1305.d.ts.map