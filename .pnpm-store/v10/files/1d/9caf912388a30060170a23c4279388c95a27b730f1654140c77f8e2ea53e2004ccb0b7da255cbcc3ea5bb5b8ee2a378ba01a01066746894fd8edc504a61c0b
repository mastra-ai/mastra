/**
 * Salsa20 stream cipher, released in 2005.
 * Salsa's goal was to implement AES replacement that does not rely on S-Boxes,
 * which are hard to implement in a constant-time manner.
 * Salsa20 is usually faster than AES, a big deal on slow, budget mobile phones.
 *
 * - [XSalsa20](https://cr.yp.to/snuffle/xsalsa-20110204.pdf), extended-nonce
 *   variant was released in 2008. It switched nonces from 96-bit to 192-bit,
 *   and became safe to be picked at random.
 * - Nacl / Libsodium popularized term "secretbox", - which is just xsalsa20poly1305.
 *   We provide the alias and corresponding seal / open methods.
 *   "crypto_box" and "sealedbox" are available in package [noble-sodium](https://github.com/serenity-kit/noble-sodium).
 * - Check out [PDF](https://cr.yp.to/snuffle/salsafamily-20071225.pdf)
 *   and [website](https://cr.yp.to/snuffle.html).
 * @module
 */
import { createCipher, rotl } from "./_arx.js";
import { poly1305 } from "./_poly1305.js";
import { abytes, clean, equalBytes, getOutput, wrapCipher, } from "./utils.js";
/**
 * Salsa20 core function. It is implemented twice:
 * 1. Simple loop (salsaCore_small, hsalsa_small)
 * 2. Unrolled loop (salsaCore, hsalsa) - 4x faster, but larger & harder to read
 * The specific implementation is selected in `createCipher` below.
 * Performance numbers for 1MB inputs:
 * * default x 779 ops/sec @ 1ms/op
 * * if salsa+hsalsa are merged x 459 ops/sec @ 2ms/op
 * * small x 132 ops/sec @ 7ms/op
 */
/** quarter-round */
function salsaQR(x, a, b, c, d) {
    x[b] ^= rotl((x[a] + x[d]) | 0, 7);
    x[c] ^= rotl((x[b] + x[a]) | 0, 9);
    x[d] ^= rotl((x[c] + x[b]) | 0, 13);
    x[a] ^= rotl((x[d] + x[c]) | 0, 18);
}
function salsaRound(x, rounds = 20) {
    for (let r = 0; r < rounds; r += 2) {
        salsaQR(x, 0, 4, 8, 12);
        salsaQR(x, 5, 9, 13, 1);
        salsaQR(x, 10, 14, 2, 6);
        salsaQR(x, 15, 3, 7, 11);
        salsaQR(x, 0, 1, 2, 3);
        salsaQR(x, 5, 6, 7, 4);
        salsaQR(x, 10, 11, 8, 9);
        salsaQR(x, 15, 12, 13, 14);
    }
}
const stmp = /* @__PURE__ */ new Uint32Array(16);
/** Small version of salsa without loop unrolling. Unused, provided for auditability. */
// prettier-ignore
function salsa(s, k, i, out, isHSalsa = true, rounds = 20) {
    // Create initial array using common pattern
    const y = Uint32Array.from([
        s[0], k[0], k[1], k[2], // "expa" Key     Key     Key
        k[3], s[1], i[0], i[1], // Key    "nd 3"  Nonce   Nonce
        i[2], i[3], s[2], k[4], // Pos.   Pos.    "2-by"  Key
        k[5], k[6], k[7], s[3], // Key    Key     Key     "te k"
    ]);
    const x = stmp;
    x.set(y);
    // const x = y.slice();
    salsaRound(x, rounds);
    // hsalsa extracts 8 specific bytes, salsa adds orig to result
    if (isHSalsa) {
        const xindexes = [0, 5, 10, 15, 6, 7, 8, 9];
        for (let i = 0; i < 8; i++)
            out[i] = x[xindexes[i]];
    }
    else {
        for (let i = 0; i < 16; i++)
            out[i] = (y[i] + x[i]) | 0;
    }
}
/** Identical to `salsaCore`. Unused. */
// @ts-ignore
const salsaCore_small = (s, k, n, out, cnt, rounds) => salsa(s, k, Uint32Array.from([n[0], n[1], cnt, 0]), out, false, rounds);
/** Identical to `hsalsa`. Unused. */
// @ts-ignore
const hsalsa_small = salsa;
/** Identical to `salsaCore_small` */
// prettier-ignore
function salsaCore(s, k, n, out, cnt, rounds = 20) {
    // Based on https://cr.yp.to/salsa20.html
    let y00 = s[0], y01 = k[0], y02 = k[1], y03 = k[2], // "expa" Key     Key     Key
    y04 = k[3], y05 = s[1], y06 = n[0], y07 = n[1], // Key    "nd 3"  Nonce   Nonce
    y08 = cnt, y09 = 0, y10 = s[2], y11 = k[4], // Pos.   Pos.    "2-by"	Key
    y12 = k[5], y13 = k[6], y14 = k[7], y15 = s[3]; // Key    Key     Key     "te k"
    // Save state to temporary variables
    let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
    for (let r = 0; r < rounds; r += 2) {
        x04 ^= rotl(x00 + x12 | 0, 7);
        x08 ^= rotl(x04 + x00 | 0, 9);
        x12 ^= rotl(x08 + x04 | 0, 13);
        x00 ^= rotl(x12 + x08 | 0, 18);
        x09 ^= rotl(x05 + x01 | 0, 7);
        x13 ^= rotl(x09 + x05 | 0, 9);
        x01 ^= rotl(x13 + x09 | 0, 13);
        x05 ^= rotl(x01 + x13 | 0, 18);
        x14 ^= rotl(x10 + x06 | 0, 7);
        x02 ^= rotl(x14 + x10 | 0, 9);
        x06 ^= rotl(x02 + x14 | 0, 13);
        x10 ^= rotl(x06 + x02 | 0, 18);
        x03 ^= rotl(x15 + x11 | 0, 7);
        x07 ^= rotl(x03 + x15 | 0, 9);
        x11 ^= rotl(x07 + x03 | 0, 13);
        x15 ^= rotl(x11 + x07 | 0, 18);
        x01 ^= rotl(x00 + x03 | 0, 7);
        x02 ^= rotl(x01 + x00 | 0, 9);
        x03 ^= rotl(x02 + x01 | 0, 13);
        x00 ^= rotl(x03 + x02 | 0, 18);
        x06 ^= rotl(x05 + x04 | 0, 7);
        x07 ^= rotl(x06 + x05 | 0, 9);
        x04 ^= rotl(x07 + x06 | 0, 13);
        x05 ^= rotl(x04 + x07 | 0, 18);
        x11 ^= rotl(x10 + x09 | 0, 7);
        x08 ^= rotl(x11 + x10 | 0, 9);
        x09 ^= rotl(x08 + x11 | 0, 13);
        x10 ^= rotl(x09 + x08 | 0, 18);
        x12 ^= rotl(x15 + x14 | 0, 7);
        x13 ^= rotl(x12 + x15 | 0, 9);
        x14 ^= rotl(x13 + x12 | 0, 13);
        x15 ^= rotl(x14 + x13 | 0, 18);
    }
    // Write output
    let oi = 0;
    out[oi++] = (y00 + x00) | 0;
    out[oi++] = (y01 + x01) | 0;
    out[oi++] = (y02 + x02) | 0;
    out[oi++] = (y03 + x03) | 0;
    out[oi++] = (y04 + x04) | 0;
    out[oi++] = (y05 + x05) | 0;
    out[oi++] = (y06 + x06) | 0;
    out[oi++] = (y07 + x07) | 0;
    out[oi++] = (y08 + x08) | 0;
    out[oi++] = (y09 + x09) | 0;
    out[oi++] = (y10 + x10) | 0;
    out[oi++] = (y11 + x11) | 0;
    out[oi++] = (y12 + x12) | 0;
    out[oi++] = (y13 + x13) | 0;
    out[oi++] = (y14 + x14) | 0;
    out[oi++] = (y15 + x15) | 0;
}
/**
 * hsalsa hashes key and nonce into key' and nonce' for salsa20.
 * Identical to `hsalsa_small`.
 * Need to find a way to merge it with `salsaCore` without 25% performance hit.
 */
// prettier-ignore
export function hsalsa(s, k, i, out) {
    let x00 = s[0], x01 = k[0], x02 = k[1], x03 = k[2], x04 = k[3], x05 = s[1], x06 = i[0], x07 = i[1], x08 = i[2], x09 = i[3], x10 = s[2], x11 = k[4], x12 = k[5], x13 = k[6], x14 = k[7], x15 = s[3];
    for (let r = 0; r < 20; r += 2) {
        x04 ^= rotl(x00 + x12 | 0, 7);
        x08 ^= rotl(x04 + x00 | 0, 9);
        x12 ^= rotl(x08 + x04 | 0, 13);
        x00 ^= rotl(x12 + x08 | 0, 18);
        x09 ^= rotl(x05 + x01 | 0, 7);
        x13 ^= rotl(x09 + x05 | 0, 9);
        x01 ^= rotl(x13 + x09 | 0, 13);
        x05 ^= rotl(x01 + x13 | 0, 18);
        x14 ^= rotl(x10 + x06 | 0, 7);
        x02 ^= rotl(x14 + x10 | 0, 9);
        x06 ^= rotl(x02 + x14 | 0, 13);
        x10 ^= rotl(x06 + x02 | 0, 18);
        x03 ^= rotl(x15 + x11 | 0, 7);
        x07 ^= rotl(x03 + x15 | 0, 9);
        x11 ^= rotl(x07 + x03 | 0, 13);
        x15 ^= rotl(x11 + x07 | 0, 18);
        x01 ^= rotl(x00 + x03 | 0, 7);
        x02 ^= rotl(x01 + x00 | 0, 9);
        x03 ^= rotl(x02 + x01 | 0, 13);
        x00 ^= rotl(x03 + x02 | 0, 18);
        x06 ^= rotl(x05 + x04 | 0, 7);
        x07 ^= rotl(x06 + x05 | 0, 9);
        x04 ^= rotl(x07 + x06 | 0, 13);
        x05 ^= rotl(x04 + x07 | 0, 18);
        x11 ^= rotl(x10 + x09 | 0, 7);
        x08 ^= rotl(x11 + x10 | 0, 9);
        x09 ^= rotl(x08 + x11 | 0, 13);
        x10 ^= rotl(x09 + x08 | 0, 18);
        x12 ^= rotl(x15 + x14 | 0, 7);
        x13 ^= rotl(x12 + x15 | 0, 9);
        x14 ^= rotl(x13 + x12 | 0, 13);
        x15 ^= rotl(x14 + x13 | 0, 18);
    }
    let oi = 0;
    out[oi++] = x00;
    out[oi++] = x05;
    out[oi++] = x10;
    out[oi++] = x15;
    out[oi++] = x06;
    out[oi++] = x07;
    out[oi++] = x08;
    out[oi++] = x09;
}
/**
 * Salsa20 from original paper. 12-byte nonce.
 * With smaller nonce, it's not safe to make it random (CSPRNG), due to collision chance.
 */
export const salsa20 = /* @__PURE__ */ createCipher(salsaCore, {
    allowShortKeys: true,
    counterRight: true,
});
/** xsalsa20 eXtended-nonce salsa. With 24-byte nonce, it's safe to make it random (CSPRNG). */
export const xsalsa20 = /* @__PURE__ */ createCipher(salsaCore, {
    counterRight: true,
    extendNonceFn: hsalsa,
});
/**
 * xsalsa20-poly1305 eXtended-nonce (24 bytes) salsa.
 * With 24-byte nonce, it's safe to make it random (CSPRNG).
 * Also known as `secretbox` from libsodium / nacl.
 */
export const xsalsa20poly1305 = /* @__PURE__ */ wrapCipher({ blockSize: 64, nonceLength: 24, tagLength: 16 }, (key, nonce) => {
    return {
        encrypt(plaintext, output) {
            // xsalsa20poly1305 optimizes by calculating auth key during the same call as encryption.
            // Unfortunately, makes it hard to separate tag calculation & encryption itself,
            // because 32 bytes is half-block of 64-byte salsa.
            output = getOutput(plaintext.length + 32, output, false); // need 32 additional bytes, see above
            const authKey = output.subarray(0, 32); // output[0..32] = poly1305 auth key
            const ciphPlaintext = output.subarray(32); // output[32..] = plaintext, then ciphertext
            output.set(plaintext, 32);
            clean(authKey); // authKey is produced by xoring with zeros
            xsalsa20(key, nonce, output, output); // output = stream ^ output; authKey = stream ^ zeros(32)
            const tag = poly1305(ciphPlaintext, authKey); // calculate tag over ciphertext
            output.set(tag, 16); // output[16..32] = tag
            clean(output.subarray(0, 16), tag); // clean-up authKey remnants & copy of tag
            return output.subarray(16); // return output[16..]
        },
        decrypt(ciphertext, output) {
            // tmp part     passed tag    ciphertext
            // [0..32]      [32..48]      [48..]
            abytes(ciphertext);
            output = getOutput(ciphertext.length + 32, output, false);
            const tmp = output.subarray(0, 32); // output[0..32] is used to calc authKey
            const passedTag = output.subarray(32, 48); // output[32..48] = passed tag
            const ciphPlaintext = output.subarray(48); // output[48..] = ciphertext, then plaintext
            output.set(ciphertext, 32); // copy ciphertext into output
            clean(tmp); // authKey is produced by xoring with zeros
            const authKey = xsalsa20(key, nonce, tmp, tmp); // authKey = stream ^ zeros(32)
            const tag = poly1305(ciphPlaintext, authKey); // calculate tag over ciphertext
            if (!equalBytes(passedTag, tag))
                throw new Error('invalid tag');
            xsalsa20(key, nonce, output.subarray(16), output.subarray(16)); // output = stream ^ output[16..]
            clean(tmp, passedTag, tag);
            return ciphPlaintext; // return output[48..], skipping zeroized output[0..48]
        },
    };
});
/**
 * Alias to `xsalsa20poly1305`, for compatibility with libsodium / nacl.
 * Check out [noble-sodium](https://github.com/serenity-kit/noble-sodium)
 * for `crypto_box`.
 */
export function secretbox(key, nonce) {
    const xs = xsalsa20poly1305(key, nonce);
    return { seal: xs.encrypt, open: xs.decrypt };
}
//# sourceMappingURL=salsa.js.map