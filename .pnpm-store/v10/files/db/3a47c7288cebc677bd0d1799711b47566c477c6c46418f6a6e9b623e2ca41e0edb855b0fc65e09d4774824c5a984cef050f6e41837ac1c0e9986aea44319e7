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
import { Keccak, type ShakeOpts } from './sha3.ts';
import {
  abytes,
  anumber,
  type CHash,
  type CHashXOF,
  createHasher,
  type Hash,
  type HashXOF,
  type KDFInput,
  kdfInputToBytes,
  type PRG,
  u32,
} from './utils.ts';

// cSHAKE && KMAC (NIST SP800-185)
const _8n = /* @__PURE__ */ BigInt(8);
const _ffn = /* @__PURE__ */ BigInt(0xff);

// It is safe to use bigints here, since they used only for length encoding (not actual data).
// We use bigints in sha256 for lengths too.
function leftEncode(n: number | bigint): Uint8Array {
  n = BigInt(n);
  const res = [Number(n & _ffn)];
  n >>= _8n;
  for (; n > 0; n >>= _8n) res.unshift(Number(n & _ffn));
  res.unshift(res.length);
  return new Uint8Array(res);
}

function rightEncode(n: number | bigint): Uint8Array {
  n = BigInt(n);
  const res = [Number(n & _ffn)];
  n >>= _8n;
  for (; n > 0; n >>= _8n) res.unshift(Number(n & _ffn));
  res.push(res.length);
  return new Uint8Array(res);
}

function chooseLen(opts: ShakeOpts, outputLen: number): number {
  return opts.dkLen === undefined ? outputLen : opts.dkLen;
}

const abytesOrZero = (buf?: Uint8Array, title = '') => {
  if (buf === undefined) return EMPTY_BUFFER;
  abytes(buf, undefined, title);
  return buf;
};
// NOTE: second modulo is necessary since we don't need to add padding if current element takes whole block
const getPadding = (len: number, block: number) => new Uint8Array((block - (len % block)) % block);
export type cShakeOpts = ShakeOpts & { personalization?: Uint8Array; NISTfn?: KDFInput };

// Personalization
function cshakePers(hash: Keccak, opts: cShakeOpts = {}): Keccak {
  if (!opts || (opts.personalization === undefined && opts.NISTfn === undefined)) return hash;
  // Encode and pad inplace to avoid unneccesary memory copies/slices (so we don't need to zero them later)
  // bytepad(encode_string(N) || encode_string(S), 168)
  const blockLenBytes = leftEncode(hash.blockLen);
  const fn = opts.NISTfn === undefined ? EMPTY_BUFFER : kdfInputToBytes(opts.NISTfn);
  const fnLen = leftEncode(_8n * BigInt(fn.length)); // length in bits
  const pers = abytesOrZero(opts.personalization, 'personalization');
  const persLen = leftEncode(_8n * BigInt(pers.length)); // length in bits
  if (!fn.length && !pers.length) return hash;
  hash.suffix = 0x04;
  hash.update(blockLenBytes).update(fnLen).update(fn).update(persLen).update(pers);
  let totalLen = blockLenBytes.length + fnLen.length + fn.length + persLen.length + pers.length;
  hash.update(getPadding(totalLen, hash.blockLen));
  return hash;
}

const gencShake = (suffix: number, blockLen: number, outputLen: number) =>
  createHasher<Keccak, cShakeOpts>((opts: cShakeOpts = {}) =>
    cshakePers(new Keccak(blockLen, suffix, chooseLen(opts, outputLen), true), opts)
  );

export type ITupleHash = {
  (messages: Uint8Array[], opts?: cShakeOpts): Uint8Array;
  create(opts?: cShakeOpts): _TupleHash;
};
/** 128-bit NIST cSHAKE XOF. */
export const cshake128: CHashXOF<Keccak, cShakeOpts> = /* @__PURE__ */ gencShake(0x1f, 168, 16);
/** 256-bit NIST cSHAKE XOF. */
export const cshake256: CHashXOF<Keccak, cShakeOpts> = /* @__PURE__ */ gencShake(0x1f, 136, 32);

/** Internal KMAC mac class. */
export class _KMAC extends Keccak implements HashXOF<_KMAC> {
  constructor(
    blockLen: number,
    outputLen: number,
    enableXOF: boolean,
    key: Uint8Array,
    opts: cShakeOpts = {}
  ) {
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
  protected finish(): void {
    if (!this.finished) this.update(rightEncode(this.enableXOF ? 0 : _8n * BigInt(this.outputLen))); // outputLen in bits
    super.finish();
  }
  _cloneInto(to?: _KMAC): _KMAC {
    // Create new instance without calling constructor since key already in state and we don't know it.
    // Force "to" to be instance of KMAC instead of Sha3.
    if (!to) {
      to = Object.create(Object.getPrototypeOf(this), {}) as _KMAC;
      to.state = this.state.slice();
      to.blockLen = this.blockLen;
      to.state32 = u32(to.state);
    }
    return super._cloneInto(to) as _KMAC;
  }
  clone(): _KMAC {
    return this._cloneInto();
  }
}

function genKmac(blockLen: number, outputLen: number, xof = false) {
  const kmac = (key: Uint8Array, message: Uint8Array, opts?: cShakeOpts): Uint8Array =>
    kmac.create(key, opts).update(message).digest();
  kmac.create = (key: Uint8Array, opts: cShakeOpts = {}) =>
    new _KMAC(blockLen, chooseLen(opts, outputLen), xof, key, opts);
  return kmac;
}

export type IKMAC = {
  (key: Uint8Array, message: Uint8Array, opts?: KangarooOpts): Uint8Array;
  create(key: Uint8Array, opts?: cShakeOpts): _KMAC;
};
/** 128-bit Keccak MAC. */
export const kmac128: IKMAC = /* @__PURE__ */ genKmac(168, 16);
/** 256-bit Keccak MAC. */
export const kmac256: IKMAC = /* @__PURE__ */ genKmac(136, 32);
/** 128-bit Keccak-MAC XOF. */
export const kmac128xof: IKMAC = /* @__PURE__ */ genKmac(168, 16, true);
/** 256-bit Keccak-MAC XOF. */
export const kmac256xof: IKMAC = /* @__PURE__ */ genKmac(136, 32, true);

/** Internal TupleHash class. */
export class _TupleHash extends Keccak implements HashXOF<_TupleHash> {
  constructor(blockLen: number, outputLen: number, enableXOF: boolean, opts: cShakeOpts = {}) {
    super(blockLen, 0x1f, outputLen, enableXOF);
    cshakePers(this, { NISTfn: 'TupleHash', personalization: opts.personalization });
    // Change update after cshake processed
    this.update = (data: Uint8Array) => {
      abytes(data);
      super.update(leftEncode(_8n * BigInt(data.length)));
      super.update(data);
      return this;
    };
  }
  protected finish(): void {
    if (!this.finished)
      super.update(rightEncode(this.enableXOF ? 0 : _8n * BigInt(this.outputLen))); // outputLen in bits
    super.finish();
  }
  _cloneInto(to?: _TupleHash): _TupleHash {
    to ||= new _TupleHash(this.blockLen, this.outputLen, this.enableXOF);
    return super._cloneInto(to) as _TupleHash;
  }
  clone(): _TupleHash {
    return this._cloneInto();
  }
}

function genTuple(blockLen: number, outputLen: number, xof = false) {
  const tuple = (messages: Uint8Array[], opts?: cShakeOpts): Uint8Array => {
    const h = tuple.create(opts);
    if (!Array.isArray(messages)) throw new Error('expected array of messages');
    for (const msg of messages) h.update(msg);
    return h.digest();
  };
  tuple.create = (opts: cShakeOpts = {}) =>
    new _TupleHash(blockLen, chooseLen(opts, outputLen), xof, opts);
  return tuple;
}

/** 128-bit TupleHASH. tuple(['ab', 'cd']) != tuple(['a', 'bcd']) */
export const tuplehash128: ITupleHash = /* @__PURE__ */ genTuple(168, 16);
/** 256-bit TupleHASH. tuple(['ab', 'cd']) != tuple(['a', 'bcd']) */
export const tuplehash256: ITupleHash = /* @__PURE__ */ genTuple(136, 32);
/** 128-bit TupleHASH XOF. */
export const tuplehash128xof: ITupleHash = /* @__PURE__ */ genTuple(168, 16, true);
/** 256-bit TupleHASH XOF. */
export const tuplehash256xof: ITupleHash = /* @__PURE__ */ genTuple(136, 32, true);

// Same as K12/M14, but without speedup for inputs less 8kb,
// reduced number of rounds and simpler.
type ParallelOpts = KangarooOpts & { blockLen?: number };

/** Internal Parallel Keccak Hash class. */
export class _ParallelHash extends Keccak implements HashXOF<_ParallelHash> {
  private leafHash?: Hash<Keccak>;
  protected leafCons: () => Hash<Keccak>;
  private chunkPos = 0; // Position of current block in chunk
  private chunksDone = 0; // How many chunks we already have
  private chunkLen: number;
  constructor(
    blockLen: number,
    outputLen: number,
    leafCons: () => Hash<Keccak>,
    enableXOF: boolean,
    opts: ParallelOpts = {}
  ) {
    super(blockLen, 0x1f, outputLen, enableXOF);
    cshakePers(this, { NISTfn: 'ParallelHash', personalization: opts.personalization });
    this.leafCons = leafCons;
    let { blockLen: B = 8 } = opts;
    anumber(B);
    this.chunkLen = B;
    super.update(leftEncode(B));
    // Change update after cshake processed
    this.update = (data: Uint8Array) => {
      abytes(data);
      const { chunkLen, leafCons } = this;
      for (let pos = 0, len = data.length; pos < len; ) {
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
  protected finish(): void {
    if (this.finished) return;
    if (this.leafHash) {
      super.update(this.leafHash.digest());
      this.chunksDone++;
    }
    super.update(rightEncode(this.chunksDone));
    super.update(rightEncode(this.enableXOF ? 0 : _8n * BigInt(this.outputLen))); // outputLen in bits
    super.finish();
  }
  _cloneInto(to?: _ParallelHash): _ParallelHash {
    to ||= new _ParallelHash(this.blockLen, this.outputLen, this.leafCons, this.enableXOF);
    if (this.leafHash) to.leafHash = this.leafHash._cloneInto(to.leafHash as Keccak);
    to.chunkPos = this.chunkPos;
    to.chunkLen = this.chunkLen;
    to.chunksDone = this.chunksDone;
    return super._cloneInto(to) as _ParallelHash;
  }
  destroy(): void {
    super.destroy.call(this);
    if (this.leafHash) this.leafHash.destroy();
  }
  clone(): _ParallelHash {
    return this._cloneInto();
  }
}

function genPrl(
  blockLen: number,
  outputLen: number,
  leaf: ReturnType<typeof gencShake>,
  xof = false
) {
  const parallel = (message: Uint8Array, opts?: ParallelOpts): Uint8Array =>
    parallel.create(opts).update(message).digest();
  parallel.create = (opts: ParallelOpts = {}) =>
    new _ParallelHash(
      blockLen,
      chooseLen(opts, outputLen),
      () => leaf.create({ dkLen: 2 * outputLen }),
      xof,
      opts
    );
  parallel.outputLen = outputLen;
  parallel.blockLen = blockLen;
  return parallel;
}

/** 128-bit ParallelHash. In JS, it is not parallel. */
export const parallelhash128: CHash<Keccak, ParallelOpts> = /* @__PURE__ */ genPrl(
  168,
  16,
  cshake128
);
/** 256-bit ParallelHash. In JS, it is not parallel. */
export const parallelhash256: CHash<Keccak, ParallelOpts> = /* @__PURE__ */ genPrl(
  136,
  32,
  cshake256
);
/** 128-bit ParallelHash XOF. In JS, it is not parallel. */
export const parallelhash128xof: CHashXOF<Keccak, ParallelOpts> = /* @__PURE__ */ genPrl(
  168,
  16,
  cshake128,
  true
);
/** 256-bit ParallelHash. In JS, it is not parallel. */
export const parallelhash256xof: CHashXOF<Keccak, ParallelOpts> = /* @__PURE__ */ genPrl(
  136,
  32,
  cshake256,
  true
);

/** D means Domain separation byte */
export type TurboshakeOpts = ShakeOpts & {
  D?: number;
};

const genTurbo = (blockLen: number, outputLen: number) =>
  createHasher<Keccak, TurboshakeOpts>((opts: TurboshakeOpts = {}) => {
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
export const turboshake128: CHashXOF<Keccak, TurboshakeOpts> = /* @__PURE__ */ genTurbo(168, 32);
/** TurboSHAKE 256-bit: reduced 12-round keccak. */
export const turboshake256: CHashXOF<Keccak, TurboshakeOpts> = /* @__PURE__ */ genTurbo(136, 64);

// Same as NIST rightEncode, but returns [0] for zero string
function rightEncodeK12(n: number | bigint): Uint8Array {
  n = BigInt(n);
  const res: number[] = [];
  for (; n > 0; n >>= _8n) res.unshift(Number(n & _ffn));
  res.push(res.length);
  return Uint8Array.from(res);
}

/** K12 options. */
export type KangarooOpts = { dkLen?: number; personalization?: Uint8Array };
const EMPTY_BUFFER = /* @__PURE__ */ Uint8Array.of();

/** Internal K12 hash class. */
export class _KangarooTwelve extends Keccak implements HashXOF<_KangarooTwelve> {
  readonly chunkLen = 8192;
  private leafHash?: Keccak;
  protected leafLen: number;
  private personalization: Uint8Array;
  private chunkPos = 0; // Position of current block in chunk
  private chunksDone = 0; // How many chunks we already have
  constructor(
    blockLen: number,
    leafLen: number,
    outputLen: number,
    rounds: number,
    opts: KangarooOpts
  ) {
    super(blockLen, 0x07, outputLen, true, rounds);
    this.leafLen = leafLen;
    this.personalization = abytesOrZero(opts.personalization, 'personalization');
  }
  update(data: Uint8Array): this {
    abytes(data);
    const { chunkLen, blockLen, leafLen, rounds } = this;
    for (let pos = 0, len = data.length; pos < len; ) {
      if (this.chunkPos == chunkLen) {
        if (this.leafHash) super.update(this.leafHash.digest());
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
      if (this.leafHash) this.leafHash.update(chunk);
      else super.update(chunk);
      this.chunkPos += take;
      pos += take;
    }
    return this;
  }
  protected finish(): void {
    if (this.finished) return;
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
  destroy(): void {
    super.destroy.call(this);
    if (this.leafHash) this.leafHash.destroy();
    // We cannot zero personalization buffer since it is user provided and we don't want to mutate user input
    this.personalization = EMPTY_BUFFER;
  }
  _cloneInto(to?: _KangarooTwelve): _KangarooTwelve {
    const { blockLen, leafLen, leafHash, outputLen, rounds } = this;
    to ||= new _KangarooTwelve(blockLen, leafLen, outputLen, rounds, {});
    super._cloneInto(to);
    if (leafHash) to.leafHash = leafHash._cloneInto(to.leafHash);
    to.personalization.set(this.personalization);
    to.leafLen = this.leafLen;
    to.chunkPos = this.chunkPos;
    to.chunksDone = this.chunksDone;
    return to;
  }
  clone(): _KangarooTwelve {
    return this._cloneInto();
  }
}

/** 128-bit KangarooTwelve (k12): reduced 12-round keccak. */
export const kt128: CHash<_KangarooTwelve, KangarooOpts> = /* @__PURE__ */ createHasher(
  (opts: KangarooOpts = {}) => new _KangarooTwelve(168, 32, chooseLen(opts, 32), 12, opts)
);
/** 256-bit KangarooTwelve (k12): reduced 12-round keccak. */
export const kt256: CHash<_KangarooTwelve, KangarooOpts> = /* @__PURE__ */ createHasher(
  (opts: KangarooOpts = {}) => new _KangarooTwelve(136, 64, chooseLen(opts, 64), 12, opts)
);

// MarsupilamiFourteen (14-rounds) can be defined as:
// `new KangarooTwelve(136, 64, chooseLen(opts, 64), 14, opts)`

/** KangarooTwelve-based MAC options. */
export type HopMAC = (
  key: Uint8Array,
  message: Uint8Array,
  personalization: Uint8Array,
  dkLen?: number
) => Uint8Array;
const genHopMAC =
  (hash: CHash<_KangarooTwelve, KangarooOpts>) =>
  (key: Uint8Array, message: Uint8Array, personalization: Uint8Array, dkLen?: number): Uint8Array =>
    hash(key, { personalization: hash(message, { personalization }), dkLen });

/**
 * 128-bit KangarooTwelve-based MAC.
 *
 * These untested (there is no test vectors or implementation available). Use at your own risk.
 * HopMAC128(Key, M, C, L) = KT128(Key, KT128(M, C, 32), L)
 * HopMAC256(Key, M, C, L) = KT256(Key, KT256(M, C, 64), L)
 */
export const HopMAC128: HopMAC = /* @__PURE__ */ genHopMAC(kt128);
/** 256-bit KangarooTwelve-based MAC. */
export const HopMAC256: HopMAC = /* @__PURE__ */ genHopMAC(kt256);

/**
 * More at https://github.com/XKCP/XKCP/tree/master/lib/high/Keccak/PRG.
 */
export class _KeccakPRG extends Keccak implements PRG {
  protected rate: number;
  constructor(capacity: number) {
    anumber(capacity);
    const rate = 1600 - capacity;
    const rho = rate - 2;
    // Rho must be full bytes
    if (capacity < 0 || capacity > 1600 - 10 || rho % 8) throw new Error('invalid capacity');
    // blockLen = rho in bytes
    super(rho / 8, 0, 0, true);
    this.rate = rate;
    this.posOut = Math.floor((rate + 7) / 8);
  }
  protected keccak(): void {
    // Duplex padding
    this.state[this.pos] ^= 0x01;
    this.state[this.blockLen] ^= 0x02; // Rho is full bytes
    super.keccak();
    this.pos = 0;
    this.posOut = 0;
  }
  update(data: Uint8Array): this {
    super.update(data);
    this.posOut = this.blockLen;
    return this;
  }
  protected finish(): void {}
  digestInto(_out: Uint8Array): Uint8Array {
    throw new Error('digest is not allowed, use .fetch instead');
  }
  addEntropy(seed: Uint8Array): void {
    this.update(seed);
  }
  randomBytes(length: number): Uint8Array {
    return this.xof(length);
  }
  clean(): void {
    if (this.rate < 1600 / 2 + 1) throw new Error('rate is too low to use .forget()');
    this.keccak();
    for (let i = 0; i < this.blockLen; i++) this.state[i] = 0;
    this.pos = this.blockLen;
    this.keccak();
    this.posOut = this.blockLen;
  }
  _cloneInto(to?: _KeccakPRG): _KeccakPRG {
    const { rate } = this;
    to ||= new _KeccakPRG(1600 - rate);
    super._cloneInto(to);
    to.rate = rate;
    return to;
  }
  clone(): _KeccakPRG {
    return this._cloneInto();
  }
}

/** KeccakPRG: Pseudo-random generator based on Keccak. https://keccak.team/files/CSF-0.1.pdf */
export const keccakprg = (capacity = 254): _KeccakPRG => new _KeccakPRG(capacity);
