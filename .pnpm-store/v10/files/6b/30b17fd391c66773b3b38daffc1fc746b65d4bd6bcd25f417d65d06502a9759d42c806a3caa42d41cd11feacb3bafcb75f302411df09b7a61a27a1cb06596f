/**
 * ChaCha stream cipher, released
 * in 2008. Developed after Salsa20, ChaCha aims to increase diffusion per round.
 * It was standardized in [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439) and
 * is now used in TLS 1.3.
 *
 * [XChaCha20](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha)
 * extended-nonce variant is also provided. Similar to XSalsa, it's safe to use with
 * randomly-generated nonces.
 *
 * Check out [PDF](http://cr.yp.to/chacha/chacha-20080128.pdf) and
 * [wiki](https://en.wikipedia.org/wiki/Salsa20) and
 * [website](https://cr.yp.to/chacha.html).
 *
 * @module
 */
import { type XorPRG } from './_arx.ts';
import { type ARXCipher, type CipherWithOutput, type XorStream } from './utils.ts';
/**
 * hchacha hashes key and nonce into key' and nonce' for xchacha20.
 * Identical to `hchacha_small`.
 * Need to find a way to merge it with `chachaCore` without 25% performance hit.
 */
export declare function hchacha(s: Uint32Array, k: Uint32Array, i: Uint32Array, out: Uint32Array): void;
/** Original, non-RFC chacha20 from DJB. 8-byte nonce, 8-byte counter. */
export declare const chacha20orig: XorStream;
/**
 * ChaCha stream cipher. Conforms to RFC 8439 (IETF, TLS). 12-byte nonce, 4-byte counter.
 * With smaller nonce, it's not safe to make it random (CSPRNG), due to collision chance.
 */
export declare const chacha20: XorStream;
/**
 * XChaCha eXtended-nonce ChaCha. With 24-byte nonce, it's safe to make it random (CSPRNG).
 * See [IRTF draft](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha).
 */
export declare const xchacha20: XorStream;
/** Reduced 8-round chacha, described in original paper. */
export declare const chacha8: XorStream;
/** Reduced 12-round chacha, described in original paper. */
export declare const chacha12: XorStream;
/**
 * AEAD algorithm from RFC 8439.
 * Salsa20 and chacha (RFC 8439) use poly1305 differently.
 * We could have composed them, but it's hard because of authKey:
 * In salsa20, authKey changes position in salsa stream.
 * In chacha, authKey can't be computed inside computeTag, it modifies the counter.
 */
export declare const _poly1305_aead: (xorStream: XorStream) => (key: Uint8Array, nonce: Uint8Array, AAD?: Uint8Array) => CipherWithOutput;
/**
 * ChaCha20-Poly1305 from RFC 8439.
 *
 * Unsafe to use random nonces under the same key, due to collision chance.
 * Prefer XChaCha instead.
 */
export declare const chacha20poly1305: ARXCipher;
/**
 * XChaCha20-Poly1305 extended-nonce chacha.
 *
 * Can be safely used with random nonces (CSPRNG).
 * See [IRTF draft](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha).
 */
export declare const xchacha20poly1305: ARXCipher;
/**
 * Chacha20 CSPRNG (cryptographically secure pseudorandom number generator).
 * It's best to limit usage to non-production, non-critical cases: for example, test-only.
 * Compatible with libtomcrypt. It does not have a specification, so unclear how secure it is.
 */
export declare const rngChacha20: XorPRG;
/**
 * Chacha20/8 CSPRNG (cryptographically secure pseudorandom number generator).
 * It's best to limit usage to non-production, non-critical cases: for example, test-only.
 * Faster than `rngChacha20`.
 */
export declare const rngChacha8: XorPRG;
//# sourceMappingURL=chacha.d.ts.map