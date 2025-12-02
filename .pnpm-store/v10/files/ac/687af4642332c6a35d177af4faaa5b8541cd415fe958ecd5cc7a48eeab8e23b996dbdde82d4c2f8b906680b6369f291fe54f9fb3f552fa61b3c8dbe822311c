/**
 * SHA3 (keccak) addons.
 *
 * * cSHAKE, KMAC, TupleHash, ParallelHash + XOF variants from
 *   [NIST SP 800-185](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf)
 * * KangarooTwelve 🦘 and TurboSHAKE - reduced-round keccak from
 *   [k12-draft-17](https://datatracker.ietf.org/doc/draft-irtf-cfrg-kangarootwelve/17/)
 * * KeccakPRG: Pseudo-random generator based on Keccak [(pdf)](https://keccak.team/files/CSF-0.1.pdf)
 * @module
 */
import { Keccak } from "./sha3.js";
import { abytes, anumber, createHasher, kdfInputToBytes, u32, } from "./utils.js";
// cSHAKE && KMAC (NIST SP800-185)
const _8n = /* @__PURE__ */ BigInt(8);
const _ffn = /* @__PURE__ */ BigInt(0xff);
// It is safe to use bigints here, since they used only for length encoding (not actual data).
// We use bigints in sha256 for lengths too.
function leftEncode(n) {
    n = BigInt(n);
    const res = [Number(n & _ffn)];
    n >>= _8n;
    for (; n > 0; n >>= _8n)
        res.unshift(Number(n & _ffn));
    res.unshift(res.length);
    return new Uint8Array(res);
}
function rightEncode(n) {
    n = BigInt(n);
    const res = [Number(n & _ffn)];
    n >>= _8n;
    for (; n > 0; n >>= _8n)
        res.unshift(Number(n & _ffn));
    res.push(res.length);
    return new Uint8Array(res);
}
function chooseLen(opts, outputLen) {
    return opts.dkLen === undefined ? outputLen : opts.dkLen;
}
const abytesOrZero = (buf, title = '') => {
    if (buf === undefined)
        return EMPTY_BUFFER;
    abytes(buf, undefined, title);
    return buf;
};
// NOTE: second modulo is necessary since we don't need to add padding if current element takes whole block
const getPadding = (len, block) => new Uint8Array((block - (len % block)) % block);
// Personalization
function cshakePers(hash, opts = {}) {
    if (!opts || (opts.personalization === undefined && opts.NISTfn === undefined))
        return hash;
    // Encode and pad inplace to avoid unneccesary memory copies/slices (so we don't need to zero them later)
    // bytepad(encode_string(N) || encode_string(S), 168)
    const blockLenBytes = leftEncode(hash.blockLen);
    const fn = opts.NISTfn === undefined ? EMPTY_BUFFER : kdfInputToBytes(opts.NISTfn);
    const fnLen = leftEncode(_8n * BigInt(fn.length)); // length in bits
    const pers = abytesOrZero(opts.personalization, 'personalization');
    const persLen = leftEncode(_8n * BigInt(pers.length)); // length in bits
    if (!fn.length && !pers.length)
        return hash;
    hash.suffix = 0x04;
    hash.update(blockLenBytes).update(fnLen).update(fn).update(persLen).update(pers);
    let totalLen = blockLenBytes.length + fnLen.length + fn.length + persLen.length + pers.length;
    hash.update(getPadding(totalLen, hash.blockLen));
    return hash;
}
const gencShake = (suffix, blockLen, outputLen) => createHasher((opts = {}) => cshakePers(new Keccak(blockLen, suffix, chooseLen(opts, outputLen), true), opts));
/** 128-bit NIST cSHAKE XOF. */
export const cshake128 = /* @__PURE__ */ gencShake(0x1f, 168, 16);
/** 256-bit NIST cSHAKE XOF. */
export const cshake256 = /* @__PURE__ */ gencShake(0x1f, 136, 32);
/** Internal KMAC mac class. */
export class _KMAC extends Keccak {
    constructor(blockLen, outputLen, enableXOF, key, opts = {}) {
        super(blockLen, 0x1f, outputLen, enableXOF);
        cshakePers(this, { NISTfn: 'KMAC', personalization: opts.personalization });
        abytes(key, undefined, 'key');
        // 1. newX = bytepad(encode_string(K), 168) || X || right_encode(L).
        const blockLenBytes = leftEncode(this.blockLen);
        const keyLen = leftEncode(_8n * BigInt(key.length));
        this.update(blockLenBytes).update(keyLen).update(key);
        const totalLen = blockLenBytes.length + keyLen.length + key.length;
        this.update(getPadding(totalLen, this.blockLen));
    }
    finish() {
        if (!this.finished)
            this.update(rightEncode(this.enableXOF ? 0 : _8n * BigInt(this.outputLen))); // outputLen in bits
        super.finish();
    }
    _cloneInto(to) {
        // Create new instance without calling constructor since key already in state and we don't know it.
        // Force "to" to be instance of KMAC instead of Sha3.
        if (!to) {
            to = Object.create(Object.getPrototypeOf(this), {});
            to.state = this.state.slice();
            to.blockLen = this.blockLen;
            to.state32 = u32(to.state);
        }
        return super._cloneInto(to);
    }
    clone() {
        return this._cloneInto();
    }
}
function genKmac(blockLen, outputLen, xof = false) {
    const kmac = (key, message, opts) => kmac.create(key, opts).update(message).digest();
    kmac.create = (key, opts = {}) => new _KMAC(blockLen, chooseLen(opts, outputLen), xof, key, opts);
    return kmac;
}
/** 128-bit Keccak MAC. */
export const kmac128 = /* @__PURE__ */ genKmac(168, 16);
/** 256-bit Keccak MAC. */
export const kmac256 = /* @__PURE__ */ genKmac(136, 32);
/** 128-bit Keccak-MAC XOF. */
export const kmac128xof = /* @__PURE__ */ genKmac(168, 16, true);
/** 256-bit Keccak-MAC XOF. */
export const kmac256xof = /* @__PURE__ */ genKmac(136, 32, true);
/** Internal TupleHash class. */
export class _TupleHash extends Keccak {
    constructor(blockLen, outputLen, enableXOF, opts = {}) {
        super(blockLen, 0x1f, outputLen, enableXOF);
        cshakePers(this, { NISTfn: 'TupleHash', personalization: opts.personalization });
        // Change update after cshake processed
        this.update = (data) => {
            abytes(data);
            super.update(leftEncode(_8n * BigInt(data.length)));
            super.update(data);
            return this;
        };
    }
    finish() {
        if (!this.finished)
            super.update(rightEncode(this.enableXOF ? 0 : _8n * BigInt(this.outputLen))); // outputLen in bits
        super.finish();
    }
    _cloneInto(to) {
        to ||= new _TupleHash(this.blockLen, this.outputLen, this.enableXOF);
        return super._cloneInto(to);
    }
    clone() {
        return this._cloneInto();
    }
}
function genTuple(blockLen, outputLen, xof = false) {
    const tuple = (messages, opts) => {
        const h = tuple.create(opts);
        if (!Array.isArray(messages))
            throw new Error('expected array of messages');
        for (const msg of messages)
            h.update(msg);
        return h.digest();
    };
    tuple.create = (opts = {}) => new _TupleHash(blockLen, chooseLen(opts, outputLen), xof, opts);
    return tuple;
}
/** 128-bit TupleHASH. tuple(['ab', 'cd']) != tuple(['a', 'bcd']) */
export const tuplehash128 = /* @__PURE__ */ genTuple(168, 16);
/** 256-bit TupleHASH. tuple(['ab', 'cd']) != tuple(['a', 'bcd']) */
export const tuplehash256 = /* @__PURE__ */ genTuple(136, 32);
/** 128-bit TupleHASH XOF. */
export const tuplehash128xof = /* @__PURE__ */ genTuple(168, 16, true);
/** 256-bit TupleHASH XOF. */
export const tuplehash256xof = /* @__PURE__ */ genTuple(136, 32, true);
/** Internal Parallel Keccak Hash class. */
export class _ParallelHash extends Keccak {
    leafHash;
    leafCons;
    chunkPos = 0; // Position of current block in chunk
    chunksDone = 0; // How many chunks we already have
    chunkLen;
    constructor(blockLen, outputLen, leafCons, enableXOF, opts = {}) {
        super(blockLen, 0x1f, outputLen, enableXOF);
        cshakePers(this, { NISTfn: 'ParallelHash', personalization: opts.personalization });
        this.leafCons = leafCons;
        let { blockLen: B = 8 } = opts;
        anumber(B);
        this.chunkLen = B;
        super.update(leftEncode(B));
        // Change update after cshake processed
        this.update = (data) => {
            abytes(data);
            const { chunkLen, leafCons } = this;
            for (let pos = 0, len = data.length; pos < len;) {
                if (this.chunkPos == chunkLen || !this.leafHash) {
                    if (this.leafHash) {
                        super.update(this.leafHash.digest());
                        this.chunksDone++;
                    }
                    this.leafHash = leafCons();
                    this.chunkPos = 0;
                }
                const take = Math.min(chunkLen - this.chunkPos, len - pos);
                this.leafHash.update(data.subarray(pos, pos + take));
                this.chunkPos += take;
                pos += take;
            }
            return this;
        };
    }
    finish() {
        if (this.finished)
            return;
        if (this.leafHash) {
            super.update(this.leafHash.digest());
            this.chunksDone++;
        }
        super.update(rightEncode(this.chunksDone));
        super.update(rightEncode(this.enableXOF ? 0 : _8n * BigInt(this.outputLen))); // outputLen in bits
        super.finish();
    }
    _cloneInto(to) {
        to ||= new _ParallelHash(this.blockLen, this.outputLen, this.leafCons, this.enableXOF);
        if (this.leafHash)
            to.leafHash = this.leafHash._cloneInto(to.leafHash);
        to.chunkPos = this.chunkPos;
        to.chunkLen = this.chunkLen;
        to.chunksDone = this.chunksDone;
        return super._cloneInto(to);
    }
    destroy() {
        super.destroy.call(this);
        if (this.leafHash)
            this.leafHash.destroy();
    }
    clone() {
        return this._cloneInto();
    }
}
function genPrl(blockLen, outputLen, leaf, xof = false) {
    const parallel = (message, opts) => parallel.create(opts).update(message).digest();
    parallel.create = (opts = {}) => new _ParallelHash(blockLen, chooseLen(opts, outputLen), () => leaf.create({ dkLen: 2 * outputLen }), xof, opts);
    parallel.outputLen = outputLen;
    parallel.blockLen = blockLen;
    return parallel;
}
/** 128-bit ParallelHash. In JS, it is not parallel. */
export const parallelhash128 = /* @__PURE__ */ genPrl(168, 16, cshake128);
/** 256-bit ParallelHash. In JS, it is not parallel. */
export const parallelhash256 = /* @__PURE__ */ genPrl(136, 32, cshake256);
/** 128-bit ParallelHash XOF. In JS, it is not parallel. */
export const parallelhash128xof = /* @__PURE__ */ genPrl(168, 16, cshake128, true);
/** 256-bit ParallelHash. In JS, it is not parallel. */
export const parallelhash256xof = /* @__PURE__ */ genPrl(136, 32, cshake256, true);
const genTurbo = (blockLen, outputLen) => createHasher((opts = {}) => {
    const D = opts.D === undefined ? 0x1f : opts.D;
    // Section 2.1 of https://datatracker.ietf.org/doc/draft-irtf-cfrg-kangarootwelve/17/
    if (!Number.isSafeInteger(D) || D < 0x01 || D > 0x7f)
        throw new Error('"D" (domain separation byte) must be 0x01..0x7f, got: ' + D);
    return new Keccak(blockLen, D, opts.dkLen === undefined ? outputLen : opts.dkLen, true, 12);
});
/**
 * TurboSHAKE 128-bit: reduced 12-round keccak.
 * Should've been a simple "shake with 12 rounds", but we got a whole new spec about Turbo SHAKE Pro MAX.
 */
export const turboshake128 = /* @__PURE__ */ genTurbo(168, 32);
/** TurboSHAKE 256-bit: reduced 12-round keccak. */
export const turboshake256 = /* @__PURE__ */ genTurbo(136, 64);
// Same as NIST rightEncode, but returns [0] for zero string
function rightEncodeK12(n) {
    n = BigInt(n);
    const res = [];
    for (; n > 0; n >>= _8n)
        res.unshift(Number(n & _ffn));
    res.push(res.length);
    return Uint8Array.from(res);
}
const EMPTY_BUFFER = /* @__PURE__ */ Uint8Array.of();
/** Internal K12 hash class. */
export class _KangarooTwelve extends Keccak {
    chunkLen = 8192;
    leafHash;
    leafLen;
    personalization;
    chunkPos = 0; // Position of current block in chunk
    chunksDone = 0; // How many chunks we already have
    constructor(blockLen, leafLen, outputLen, rounds, opts) {
        super(blockLen, 0x07, outputLen, true, rounds);
        this.leafLen = leafLen;
        this.personalization = abytesOrZero(opts.personalization, 'personalization');
    }
    update(data) {
        abytes(data);
        const { chunkLen, blockLen, leafLen, rounds } = this;
        for (let pos = 0, len = data.length; pos < len;) {
            if (this.chunkPos == chunkLen) {
                if (this.leafHash)
                    super.update(this.leafHash.digest());
                else {
                    this.suffix = 0x06; // Its safe to change suffix here since its used only in digest()
                    super.update(Uint8Array.from([3, 0, 0, 0, 0, 0, 0, 0]));
                }
                this.leafHash = new Keccak(blockLen, 0x0b, leafLen, false, rounds);
                this.chunksDone++;
                this.chunkPos = 0;
            }
            const take = Math.min(chunkLen - this.chunkPos, len - pos);
            const chunk = data.subarray(pos, pos + take);
            if (this.leafHash)
                this.leafHash.update(chunk);
            else
                super.update(chunk);
            this.chunkPos += take;
            pos += take;
        }
        return this;
    }
    finish() {
        if (this.finished)
            return;
        const { personalization } = this;
        this.update(personalization).update(rightEncodeK12(personalization.length));
        // Leaf hash
        if (this.leafHash) {
            super.update(this.leafHash.digest());
            super.update(rightEncodeK12(this.chunksDone));
            super.update(Uint8Array.from([0xff, 0xff]));
        }
        super.finish.call(this);
    }
    destroy() {
        super.destroy.call(this);
        if (this.leafHash)
            this.leafHash.destroy();
        // We cannot zero personalization buffer since it is user provided and we don't want to mutate user input
        this.personalization = EMPTY_BUFFER;
    }
    _cloneInto(to) {
        const { blockLen, leafLen, leafHash, outputLen, rounds } = this;
        to ||= new _KangarooTwelve(blockLen, leafLen, outputLen, rounds, {});
        super._cloneInto(to);
        if (leafHash)
            to.leafHash = leafHash._cloneInto(to.leafHash);
        to.personalization.set(this.personalization);
        to.leafLen = this.leafLen;
        to.chunkPos = this.chunkPos;
        to.chunksDone = this.chunksDone;
        return to;
    }
    clone() {
        return this._cloneInto();
    }
}
/** 128-bit KangarooTwelve (k12): reduced 12-round keccak. */
export const kt128 = /* @__PURE__ */ createHasher((opts = {}) => new _KangarooTwelve(168, 32, chooseLen(opts, 32), 12, opts));
/** 256-bit KangarooTwelve (k12): reduced 12-round keccak. */
export const kt256 = /* @__PURE__ */ createHasher((opts = {}) => new _KangarooTwelve(136, 64, chooseLen(opts, 64), 12, opts));
const genHopMAC = (hash) => (key, message, personalization, dkLen) => hash(key, { personalization: hash(message, { personalization }), dkLen });
/**
 * 128-bit KangarooTwelve-based MAC.
 *
 * These untested (there is no test vectors or implementation available). Use at your own risk.
 * HopMAC128(Key, M, C, L) = KT128(Key, KT128(M, C, 32), L)
 * HopMAC256(Key, M, C, L) = KT256(Key, KT256(M, C, 64), L)
 */
export const HopMAC128 = /* @__PURE__ */ genHopMAC(kt128);
/** 256-bit KangarooTwelve-based MAC. */
export const HopMAC256 = /* @__PURE__ */ genHopMAC(kt256);
/**
 * More at https://github.com/XKCP/XKCP/tree/master/lib/high/Keccak/PRG.
 */
export class _KeccakPRG extends Keccak {
    rate;
    constructor(capacity) {
        anumber(capacity);
        const rate = 1600 - capacity;
        const rho = rate - 2;
        // Rho must be full bytes
        if (capacity < 0 || capacity > 1600 - 10 || rho % 8)
            throw new Error('invalid capacity');
        // blockLen = rho in bytes
        super(rho / 8, 0, 0, true);
        this.rate = rate;
        this.posOut = Math.floor((rate + 7) / 8);
    }
    keccak() {
        // Duplex padding
        this.state[this.pos] ^= 0x01;
        this.state[this.blockLen] ^= 0x02; // Rho is full bytes
        super.keccak();
        this.pos = 0;
        this.posOut = 0;
    }
    update(data) {
        super.update(data);
        this.posOut = this.blockLen;
        return this;
    }
    finish() { }
    digestInto(_out) {
        throw new Error('digest is not allowed, use .fetch instead');
    }
    addEntropy(seed) {
        this.update(seed);
    }
    randomBytes(length) {
        return this.xof(length);
    }
    clean() {
        if (this.rate < 1600 / 2 + 1)
            throw new Error('rate is too low to use .forget()');
        this.keccak();
        for (let i = 0; i < this.blockLen; i++)
            this.state[i] = 0;
        this.pos = this.blockLen;
        this.keccak();
        this.posOut = this.blockLen;
    }
    _cloneInto(to) {
        const { rate } = this;
        to ||= new _KeccakPRG(1600 - rate);
        super._cloneInto(to);
        to.rate = rate;
        return to;
    }
    clone() {
        return this._cloneInto();
    }
}
/** KeccakPRG: Pseudo-random generator based on Keccak. https://keccak.team/files/CSF-0.1.pdf */
export const keccakprg = (capacity = 254) => new _KeccakPRG(capacity);
//# sourceMappingURL=sha3-addons.js.map