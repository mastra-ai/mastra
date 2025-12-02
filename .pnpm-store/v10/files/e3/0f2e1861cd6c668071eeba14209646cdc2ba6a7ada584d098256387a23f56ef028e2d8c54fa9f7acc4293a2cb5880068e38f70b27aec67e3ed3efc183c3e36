# noble-ciphers

Audited & minimal JS implementation of Salsa20, ChaCha and AES.

- 🔒 [**Audited**](#security) by an independent security firm
- 🔻 Tree-shakeable: unused code is excluded from your builds
- 🏎 Fast: hand-optimized for caveats of JS engines
- 🔍 Reliable: property-based / cross-library / wycheproof tests ensure correctness
- 💼 AES: ECB, CBC, CTR, CFB, GCM, SIV (nonce misuse-resistant), AESKW, AESKWP
- 💃 Salsa20, ChaCha, XSalsa20, XChaCha, ChaCha8, ChaCha12, Poly1305
- 🥈 Two AES implementations: pure JS or friendly WebCrypto wrapper
- 🪶 11KB (gzipped) for everything, 3KB for ChaCha-only build

Check out [Upgrading](#upgrading) for information about upgrading from previous versions.
Take a glance at [GitHub Discussions](https://github.com/paulmillr/noble-ciphers/discussions) for questions and support.

### This library belongs to _noble_ cryptography

> **noble cryptography** — high-security, easily auditable set of contained cryptographic libraries and tools.

- Zero or minimal dependencies
- Highly readable TypeScript / JS code
- PGP-signed releases and transparent NPM builds
- All libraries:
  [ciphers](https://github.com/paulmillr/noble-ciphers),
  [curves](https://github.com/paulmillr/noble-curves),
  [hashes](https://github.com/paulmillr/noble-hashes),
  [post-quantum](https://github.com/paulmillr/noble-post-quantum),
  5kb [secp256k1](https://github.com/paulmillr/noble-secp256k1) /
  [ed25519](https://github.com/paulmillr/noble-ed25519)
- [Check out homepage](https://paulmillr.com/noble/)
  for reading resources, documentation and apps built with noble

## Usage

> `npm install @noble/ciphers`

> `deno add jsr:@noble/ciphers`

We support all major platforms and runtimes.
For React Native, you may need a
[polyfill for getRandomValues](https://github.com/LinusU/react-native-get-random-values).
A standalone file
[noble-ciphers.js](https://github.com/paulmillr/noble-ciphers/releases) is also available.

```ts
// import * from '@noble/ciphers'; // Error: use sub-imports, to ensure small app size
import { gcm, gcmsiv } from '@noble/ciphers/aes.js';
import { chacha20poly1305, xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { xsalsa20poly1305 } from '@noble/ciphers/salsa.js';

// Unauthenticated encryption: make sure to use HMAC or similar
import { ctr, cfb, cbc, ecb } from '@noble/ciphers/aes.js';
import { salsa20, xsalsa20 } from '@noble/ciphers/salsa.js';
import { chacha20, xchacha20, chacha8, chacha12 } from '@noble/ciphers/chacha.js';
import { aeskw, aeskwp } from '@noble/ciphers/aes.js'; // KW
import { bytesToHex, hexToBytes, managedNonce, randomBytes } from '@noble/ciphers/utils.js';
```

- [Examples](#examples)
  - [XChaCha20-Poly1305 encryption](#xchacha20-poly1305-encryption)
  - [AES-256-GCM encryption](#aes-256-gcm-encryption)
  - [managedNonce: automatic nonce handling](#managednonce-automatic-nonce-handling)
  - [AES: gcm, siv, ctr, cfb, cbc, ecb, aeskw](#aes-gcm-siv-ctr-cfb-cbc-ecb-aeskw)
  - [AES: friendly WebCrypto wrapper](#aes-friendly-webcrypto-wrapper)
  - [Reuse array for input and output](#reuse-array-for-input-and-output)
  - [Use password for encryption](#use-password-for-encryption)
- [Internals](#internals)
  - [Picking a cipher](#picking-a-cipher)
  - [How to encrypt properly](#how-to-encrypt-properly)
  - [Nonces](#nonces)
  - [Encryption limits](#encryption-limits)
  - [AES block modes](#aes-block-modes)
  - [Implemented primitives](#implemented-primitives)
- [Security](#security)
- [Speed](#speed)
- [Upgrading](#upgrading)
- [Contributing & testing](#contributing--testing)
- [License](#license)

## Examples

> [!NOTE]
> Use different nonce every time `encrypt()` is done.

#### XChaCha20-Poly1305 encryption

```js
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/ciphers/utils.js';
const key = randomBytes(32); // random key
// const key = new Uint8Array([ // existing key
//   169, 88, 160, 139, 168, 29, 147, 196, 14, 88, 237, 76, 243, 177, 109, 140,
//   195, 140, 80, 10, 216, 134, 215, 71, 191, 48, 20, 104, 189, 37, 38, 55,
// ]);
// import { hexToBytes } from '@noble/ciphers/utils.js'; // hex key
// const key = hexToBytes('4b7f89bac90a1086fef73f5da2cbe93b2fae9dfbf7678ae1f3e75fd118ddf999');
const nonce = randomBytes(24);
const chacha = xchacha20poly1305(key, nonce);
const data = new TextEncoder().encode('hello noble');
const ciphertext = chacha.encrypt(data);
const data_ = chacha.decrypt(ciphertext); // new TextDecoder().decode(data_) === data
```

#### AES-256-GCM encryption

```js
import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';
const key = randomBytes(32);
const nonce = randomBytes(24);
const data = new TextEncoder().encode('hello noble');
const aes = gcm(key, nonce);
const ciphertext = aes.encrypt(data);
const data_ = aes.decrypt(ciphertext); // new TextDecoder().decode(data_) === data
```

#### managedNonce: automatic nonce handling

We provide API that manages nonce internally instead of exposing them to library's user.

For `encrypt`: a `nonceBytes`-length buffer is fetched from CSPRNG and prenended to encrypted ciphertext.

For `decrypt`: first `nonceBytes` of ciphertext are treated as nonce.

> [!NOTE]
> AES-GCM & ChaCha (NOT XChaCha) [limit amount of messages](#encryption-limits)
> encryptable under the same key.

```js
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hexToBytes, managedNonce } from '@noble/ciphers/utils.js';
const key = hexToBytes('fa686bfdffd3758f6377abbc23bf3d9bdc1a0dda4a6e7f8dbdd579fa1ff6d7e1');
const chacha = managedNonce(xchacha20poly1305)(key); // manages nonces for you
const data = new TextEncoder().encode('hello noble');
const ciphertext = chacha.encrypt(data);
const data_ = chacha.decrypt(ciphertext);
```

#### AES: gcm, siv, ctr, cfb, cbc, ecb, aeskw

```js
import { gcm, gcmsiv, ctr, cfb, cbc, ecb } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/ciphers/utils.js';
const plaintext = new Uint8Array(32).fill(16);
for (let cipher of [gcm, gcmsiv]) {
  const key = randomBytes(32); // 24 for AES-192, 16 for AES-128
  const nonce = randomBytes(12);
  const ciphertext_ = cipher(key, nonce).encrypt(plaintext);
  const plaintext_ = cipher(key, nonce).decrypt(ciphertext_);
}
for (const cipher of [ctr, cbc, cfb]) {
  const key = randomBytes(32); // 24 for AES-192, 16 for AES-128
  const nonce = randomBytes(16);
  const ciphertext_ = cipher(key, nonce).encrypt(plaintext);
  const plaintext_ = cipher(key, nonce).decrypt(ciphertext_);
}
for (const cipher of [ecb]) {
  const key = randomBytes(32); // 24 for AES-192, 16 for AES-128
  const ciphertext_ = cipher(key).encrypt(plaintext);
  const plaintext_ = cipher(key).decrypt(ciphertext_);
}

// AESKW, AESKWP
import { aeskw, aeskwp } from '@noble/ciphers/aes.js';
import { hexToBytes } from '@noble/ciphers/utils.js';

const kek = hexToBytes('000102030405060708090A0B0C0D0E0F');
const keyData = hexToBytes('00112233445566778899AABBCCDDEEFF');
const ciphertext = aeskw(kek).encrypt(keyData);
```

#### AES: friendly WebCrypto wrapper

Noble implements AES. Sometimes people want to use built-in `crypto.subtle` instead. However, it has terrible API. We simplify access to built-ins.

> [!NOTE]
> Webcrypto methods are always async.

```js
import { gcm, ctr, cbc, randomBytes } from '@noble/ciphers/utils.js';
const plaintext = new Uint8Array(32).fill(16);
const key = randomBytes(32);
for (const cipher of [gcm]) {
  const nonce = randomBytes(12);
  const ciphertext_ = await cipher(key, nonce).encrypt(plaintext);
  const plaintext_ = await cipher(key, nonce).decrypt(ciphertext_);
}
for (const cipher of [ctr, cbc]) {
  const nonce = randomBytes(16);
  const ciphertext_ = await cipher(key, nonce).encrypt(plaintext);
  const plaintext_ = await cipher(key, nonce).decrypt(ciphertext_);
}
```

#### Reuse array for input and output

To avoid additional allocations, Uint8Array can be reused
between encryption and decryption calls.

> [!NOTE]
> Some ciphers don't support unaligned (`byteOffset % 4 !== 0`) Uint8Array as
> destination. It can decrease performance, making the optimization pointless.

```js
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/ciphers/utils.js';

const key = randomBytes(32);
const nonce = randomBytes(12);
const chacha = chacha20poly1305(key, nonce);

const input = new TextEncoder().encode('hello noble'); // length == 12
const inputLength = input.length;
const tagLength = 16;

const buf = new Uint8Array(inputLength + tagLength);
const start = buf.subarray(0, inputLength);
start.set(input); // copy input to buf

chacha.encrypt(start, buf); // encrypt into `buf`
chacha.decrypt(buf, start); // decrypt into `start`
```

xsalsa20poly1305 also supports this, but requires 32 additional bytes for encryption / decryption,
due to its inner workings.

#### Randomness generation

We provide userspace CSPRNG (cryptographically secure pseudorandom number generator).
It's best to limit their usage to non-production, non-critical cases: for example, test-only usage.
ChaCha-based CSPRNG does not have a specification as per 2025, which makes it less secure.

```js
import { randomBytes } from '@noble/ciphers/utils.js';
import { rngAesCtrDrbg256 } from '@noble/ciphers/aes.js';
import { rngChacha8, rngChacha20 } from '@noble/ciphers/chacha.js';

// 1. Best: WebCrypto
const rnd1 = randomBytes(32);
// 2. AES-CTR DRBG
const rnd2 = rngAesCtrDrbg256(randomBytes(32)).randomBytes(1024);
// 3. ChaCha8 CSPRNG
const rnd3 = rngChacha8(randomBytes(32)).randomBytes(1024);
```

#### Use password for encryption

It is not safe to convert password into Uint8Array.
Instead, KDF stretching function like PBKDF2 / Scrypt / Argon2id
should be applied to convert password to AES key.
Make sure to use salt (app-specific secret) in addition to password.

```js
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { managedNonce } from '@noble/ciphers/utils.js';
import { scrypt } from '@noble/hashes/scrypt.js';

// Convert password into 32-byte key using scrypt
const PASSWORD = 'correct-horse-battery-staple';
const APP_SPECIFIC_SECRET = 'salt-12345678-secret';
const SECURITY_LEVEL = 2 ** 20; // requires 1GB of RAM to calculate
// sync, but scryptAsync is also available
const key = scrypt(PASSWORD, APP_SPECIFIC_SECRET, { N: SECURITY_LEVEL, r: 8, p: 1, dkLen: 32 });

// Use random, managed nonce
const chacha = managedNonce(xchacha20poly1305)(key);

const data = new TextEncoder().encode('hello noble');
const ciphertext = chacha.encrypt(data);
const data_ = chacha.decrypt(ciphertext);
```

## Internals

### Picking a cipher

We suggest to use **XChaCha20-Poly1305** because it's very fast and allows random keys.
**AES-GCM-SIV** is also a good idea, because it provides resistance against nonce reuse.
**AES-GCM** is a good option when those two are not available.

### How to encrypt properly

- Use unpredictable key with enough entropy
  - Random key must be using cryptographically secure random number generator (CSPRNG), not `Math.random` etc.
  - Non-random key generated from KDF is fine
  - Re-using key is fine, but be aware of rules for cryptographic key wear-out and [encryption limits](#encryption-limits)
- Use new nonce every time and [don't repeat it](#nonces)
  - chacha and salsa20 are fine for sequential counters that _never_ repeat: `01, 02...`
  - xchacha and xsalsa20 can use random nonces instead
  - AES-GCM should use 12-byte nonces: smaller nonces are security risk
- Prefer authenticated encryption (AEAD)
  - Good: chacha20poly1305, GCM, GCM-SIV, ChaCha+HMAC, CTR+HMAC, CBC+HMAC
  - Bad: chacha20, raw CTR, raw CBC
  - Flipping bits or ciphertext substitution won't be detected in unauthenticated ciphers
  - Polynomial MACs are not perfect for every situation:
    they lack Random Key Robustness: the MAC can be forged, and can't
    be used in PAKE schemes. See
    [invisible salamanders attack](https://keymaterial.net/2020/09/07/invisible-salamanders-in-aes-gcm-siv/).
    To combat salamanders, `hash(key)` can be included in ciphertext,
    however, this would violate ciphertext indistinguishability:
    an attacker would know which key was used - so `HKDF(key, i)`
    could be used instead.
- Don't re-use keys between different protocols
  - For example, using ECDH key in AES can be bad
  - Use hkdf or, at least, a hash function to create sub-key instead

### Nonces

Most ciphers need a key and a nonce (aka initialization vector / IV) to encrypt a data.
Repeating (key, nonce) pair with different plaintexts would allow an attacker to decrypt it.

    ciphertext_a = encrypt(plaintext_a, key, nonce)
    ciphertext_b = encrypt(plaintext_b, key, nonce)
    stream_diff = xor(ciphertext_a, ciphertext_b)    # Break encryption

One way of not repeating nonces is using counters:

    for i in 0..:
        ciphertext[i] = encrypt(plaintexts[i], key, i)

Another is generating random nonce every time:

    for i in 0..:
        rand_nonces[i] = random()
        ciphertext[i] = encrypt(plaintexts[i], key, rand_nonces[i])

- Counters are OK, but it's not always possible to store current counter value:
  e.g. in decentralized, unsyncable systems.
- Randomness is OK, but there's a catch:
  ChaCha20 and AES-GCM use 96-bit / 12-byte nonces, which implies higher chance of collision.
  In the example above, `random()` can collide and produce repeating nonce.
  Chance is even higher for 64-bit nonces, which GCM allows - don't use them.
- To safely use random nonces, utilize XSalsa20 or XChaCha:
  they increased nonce length to 192-bit, minimizing a chance of collision.
  AES-SIV is also fine. In situations where you can't use eXtended-nonce
  algorithms, key rotation is advised. hkdf would work great for this case.

### Encryption limits

A "protected message" would mean a probability of `2**-50` that a passive attacker
successfully distinguishes the ciphertext outputs of the AEAD scheme from the outputs
of a random function.

- Max message size:
  - AES-GCM: ~68GB, `2**36-256`
  - Salsa, ChaCha, XSalsa, XChaCha: ~256GB, `2**38-64`
- Max amount of protected messages, under same key:
  - AES-GCM: `2**32.5`
  - Salsa, ChaCha: `2**46`, but only integrity (MAC) is affected, not confidentiality (encryption)
  - XSalsa, XChaCha: `2**72`
- Max amount of protected messages, across all keys:
  - AES-GCM: `2**69/B` where B is max blocks encrypted by a key. Meaning
    `2**59` for 1KB, `2**49` for 1MB, `2**39` for 1GB
  - Salsa, ChaCha, XSalsa, XChaCha: `2**100`
- Max amount of protected messages, under same key, using **random nonce**:
  - Relevant for 12-byte nonces with `managedNonce`: AES-GCM, ChaCha
  - `2**23` (8M) messages for `2**-50` chance, `2**32.5` (4B) for `2**-32.5` chance

Check out [draft-irtf-cfrg-aead-limits](https://datatracker.ietf.org/doc/draft-irtf-cfrg-aead-limits/) for details.

### Implemented primitives

- Salsa20 stream cipher, released in 2005.
  Salsa's goal was to implement AES replacement that does not rely on S-Boxes,
  which are hard to implement in a constant-time manner.
  Salsa20 is usually faster than AES, a big deal on slow, budget mobile phones.
  - [XSalsa20](https://cr.yp.to/snuffle/xsalsa-20110204.pdf), extended-nonce
    variant was released in 2008. It switched nonces from 96-bit to 192-bit,
    and became safe to be picked at random.
  - Nacl / Libsodium popularized term "secretbox", - which is just xsalsa20poly1305.
    We provide the alias and corresponding seal / open methods.
    "crypto_box" and "sealedbox" are available in package [noble-sodium](https://github.com/serenity-kit/noble-sodium).
  - Check out [PDF](https://cr.yp.to/snuffle/salsafamily-20071225.pdf)
    and [website](https://cr.yp.to/snuffle.html).
- ChaCha20 stream cipher, released in 2008. Developed after Salsa20,
  ChaCha aims to increase diffusion per round.
  - [XChaCha20](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha)
    extended-nonce variant is also provided. Similar to XSalsa, it's safe to use with
    randomly-generated nonces.
  - Check out
    [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439),
    [PDF](http://cr.yp.to/chacha/chacha-20080128.pdf) and
    [website](https://cr.yp.to/chacha.html).
- AES is a variant of Rijndael block cipher, standardized by NIST in 2001.
  We provide the fastest available pure JS implementation.
  - We support AES-128, AES-192 and AES-256: the mode is selected dynamically,
    based on key length (16, 24, 32).
  - AES-GCM-SIV nonce-misuse-resistant mode is also provided. Our implementation of SIV
    has the same speed as GCM: there is no performance hit.
    The mode is described in [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452).
  - We also have AESKW and AESKWP from
    [RFC 3394](https://www.rfc-editor.org/rfc/rfc3394) & [RFC 5649](https://www.rfc-editor.org/rfc/rfc5649)
  - Format-preserving encryption algorithm (FPE-FF1) specified in
    [NIST SP 800-38G](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf).
  - Check out [AES block modes](#aes-block-modes),
    [FIPS 197](https://csrc.nist.gov/files/pubs/fips/197/final/docs/fips-197.pdf) and
    [original proposal](https://csrc.nist.gov/csrc/media/projects/cryptographic-standards-and-guidelines/documents/aes-development/rijndael-ammended.pdf).
- Polynomial-evaluation MACs are available: Poly1305, AES-GCM's GHash and AES-SIV's Polyval.
  - Poly1305 ([PDF](https://cr.yp.to/mac/poly1305-20050329.pdf),
    [website](https://cr.yp.to/mac.html))
    is a fast and parallel secret-key message-authentication code suitable for
    a wide variety of applications. It was standardized in
    [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439) and is now used in TLS 1.3.
  - Ghash is used in AES-GCM: see NIST SP 800-38G
  - Polyval is used in AES-GCM-SIV: see [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452)

##### AES block modes

For non-deterministic (not ECB) schemes, initialization vector (IV) is mixed to block/key;
and each new round either depends on previous block's key, or on some counter.

- **ECB** (Electronic Codebook): Deterministic encryption; identical plaintext blocks yield identical ciphertexts. Not secure due to pattern leakage. due to pattern leakage.
  See [AES Penguin](https://words.filippo.io/the-ecb-penguin/)
- **CBC** (Cipher Block Chaining): Each plaintext block is XORed with the previous block of ciphertext
  before encryption. Hard to use: requires proper padding and an IV. Unauthenticated: needs MAC.
- **CTR** (Counter Mode): Turns a block cipher into a stream cipher using a counter and IV (nonce).
  Efficient and parallelizable. Requires a unique nonce per encryption. Unauthenticated: needs MAC.
- **GCM** (Galois/Counter Mode): Combines CTR mode with polynomial MAC. Efficient and widely used. Not perfect:
  a) conservative key wear-out is `2**32` (4B) msgs.
  b) key wear-out under random nonces is even smaller: `2**23` (8M) messages for `2**-50` chance.
  c) MAC can be forged: see Poly1305 documentation.
- **SIV** (Synthetic IV): GCM with nonce-misuse resistance; repeating nonces reveal only the fact plaintexts
  are identical. Also suffers from GCM issues: key wear-out limits & MAC forging.
- **XTS**: Designed for disk encryption.
  Similar to ECB (deterministic), but has `[i][j]` tweak arguments corresponding to
  sector i and 16-byte block (part of sector) j. Lacks MAC.

## Security

The library has been independently audited:

- at version 1.0.0, in Sep 2024, by [cure53](https://cure53.de)
  - PDFs: [website](https://cure53.de/audit-report_noble-crypto-libs.pdf), [in-repo](./audit/2024-09-cure53-audit-nbl4.pdf)
  - [Changes since audit](https://github.com/paulmillr/noble-ciphers/compare/1.0.0..main)
  - Scope: everything
  - The audit has been funded by [OpenSats](https://opensats.org)

It is tested against property-based, cross-library and Wycheproof vectors,
and is being fuzzed in [the separate repo](https://github.com/paulmillr/fuzzing).

If you see anything unusual: investigate and report.

### Constant-timeness

We're targetting algorithmic constant time. _JIT-compiler_ and _Garbage Collector_ make "constant time"
extremely hard to achieve [timing attack](https://en.wikipedia.org/wiki/Timing_attack) resistance
in a scripting language. Which means _any other JS library can't have
constant-timeness_. Even statically typed Rust, a language without GC,
[makes it harder to achieve constant-time](https://www.chosenplaintext.ca/open-source/rust-timing-shield/security)
for some cases. If your goal is absolute security, don't use any JS lib — including bindings to native ones.
Use low-level libraries & languages.

The library uses T-tables for AES, which
[leak access timings](https://cr.yp.to/antiforgery/cachetiming-20050414.pdf).
This is also done in [OpenSSL](https://github.com/openssl/openssl/blob/2f33265039cdbd0e4589c80970e02e208f3f94d2/crypto/aes/aes_core.c#L706) and
[Go stdlib](https://cs.opensource.google/go/go/+/refs/tags/go1.22.6:src/crypto/aes/const.go;l=90) for performance reasons.
The analysis was mentioned in [hal-04652991](https://hal.science/hal-04652991/document).

### Supply chain security

- **Commits** are signed with PGP keys, to prevent forgery. Make sure to verify commit signatures
- **Releases** are transparent and built on GitHub CI.
  Check out [attested checksums of single-file builds](https://github.com/paulmillr/noble-ciphers/attestations)
  and [provenance logs](https://github.com/paulmillr/noble-ciphers/actions/workflows/release.yml)
- **Rare releasing** is followed to ensure less re-audit need for end-users
- **Dependencies** are minimized and locked-down: any dependency could get hacked and users will be downloading malware with every install.
  - We make sure to use as few dependencies as possible
  - Automatic dep updates are prevented by locking-down version ranges; diffs are checked with `npm-diff`
- **Dev Dependencies** are disabled for end-users; they are only used to develop / build the source code

For this package, there are 0 dependencies; and a few dev dependencies:

- micro-bmark, micro-should and jsbt are used for benchmarking / testing / build tooling and developed by the same author
- prettier, fast-check and typescript are used for code quality / test generation / ts compilation. It's hard to audit their source code thoroughly and fully because of their size

### Randomness

We're deferring to built-in
[crypto.getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
which is considered cryptographically secure (CSPRNG).

In the past, browsers had bugs that made it weak: it may happen again.
Implementing a userspace CSPRNG to get resilient to the weakness
is even worse: there is no reliable userspace source of quality entropy.

### Quantum computers

Cryptographically relevant quantum computer, if built, will allow to
utilize Grover's algorithm to break ciphers in 2^n/2 operations, instead of 2^n.

This means AES128 should be replaced with AES256. Salsa and ChaCha are already safe.

Australian ASD prohibits AES128 [after 2030](https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/ism/cyber-security-guidelines/guidelines-cryptography).

## Speed

```sh
npm run bench
```

To summarize, noble is the fastest JS implementation of Salsa, ChaCha and AES.
You can gain additional speed-up and
avoid memory allocations by passing `output`
uint8array into encrypt / decrypt methods.

Benchmarks measured on Apple M4:

```
64B
xsalsa20poly1305 x 735,835 ops/sec @ 1μs/op
chacha20poly1305 x 581,395 ops/sec @ 1μs/op
xchacha20poly1305 x 468,384 ops/sec @ 2μs/op
aes-256-gcm x 201,126 ops/sec @ 4μs/op
aes-256-gcm-siv x 162,284 ops/sec @ 6μs/op
# Unauthenticated encryption
salsa20 x 1,655,629 ops/sec @ 604ns/op
xsalsa20 x 1,400,560 ops/sec @ 714ns/op
chacha20 x 1,996,007 ops/sec @ 501ns/op
xchacha20 x 1,404,494 ops/sec @ 712ns/op
chacha8 x 2,145,922 ops/sec @ 466ns/op
chacha12 x 2,036,659 ops/sec @ 491ns/op
aes-ecb-256 x 1,019,367 ops/sec @ 981ns/op
aes-cbc-256 x 931,966 ops/sec @ 1μs/op
aes-ctr-256 x 954,198 ops/sec @ 1μs/op

1MB
xsalsa20poly1305 x 334 ops/sec @ 2ms/op
chacha20poly1305 x 333 ops/sec @ 2ms/op
xchacha20poly1305 x 334 ops/sec @ 2ms/op
aes-256-gcm x 94 ops/sec @ 10ms/op
aes-256-gcm-siv x 90 ops/sec @ 11ms/op
# Unauthenticated encryption
salsa20 x 831 ops/sec @ 1ms/op
xsalsa20 x 830 ops/sec @ 1ms/op
chacha20 x 804 ops/sec @ 1ms/op
xchacha20 x 797 ops/sec @ 1ms/op
chacha8 x 1,495 ops/sec @ 668μs/op
chacha12 x 1,148 ops/sec @ 871μs/op
aes-ecb-256 x 289 ops/sec @ 3ms/op
aes-cbc-256 x 114 ops/sec @ 8ms/op
aes-ctr-256 x 127 ops/sec @ 7ms/op
# Wrapper over built-in webcrypto
webcrypto ctr-256 x 6,508 ops/sec @ 153μs/op
webcrypto cbc-256 x 1,820 ops/sec @ 549μs/op
webcrypto gcm-256 x 5,106 ops/sec @ 195μs/op
```

Compare to other implementations:

```
xsalsa20poly1305 (encrypt, 1MB)
├─tweetnacl x 196 ops/sec
└─noble x 305 ops/sec

chacha20poly1305 (encrypt, 1MB)
├─node x 1,668 ops/sec
├─stablelib x 202 ops/sec
└─noble x 319 ops/sec

aes-ctr-256 (encrypt, 1MB)
├─stablelib x 123 ops/sec
├─aesjs x 42 ops/sec
├─noble-webcrypto x 5,965 ops/sec
└─noble x 124 ops/sec
```

## Upgrading

Supported node.js versions:

- v2: v20.19+ (ESM-only)
- v1: v14.21+ (ESM & CJS)

Changelog of v2, when upgrading from ciphers v1:

- The package is now ESM-only. ESM can finally be loaded from common.js on node v20.19+
- `.js` extension must be used for all modules
    - Old: `@noble/ciphers/aes`
    - New: `@noble/ciphers/aes.js`
    - This simplifies working in browsers natively without transpilers
- webcrypto: move `randomBytes` and `managedNonce` to `utils.js`
- ghash, poly1305, polyval: only allow Uint8Array as hash inputs, prohibit `string`
- utils: new abytes; remove ahash, toBytes
- Remove modules `_assert` (use `utils`), `_micro` and `crypto` (use `webcrypto`)
- Bump TS compilation target from es2020 to es2022
- Massively improve error messages, make them more descriptive

## Contributing & testing

- `npm install && npm run build && npm test` will build the code and run tests.
- `npm run lint` / `npm run format` will run linter / fix linter issues.
- `npm run bench` will run benchmarks
- `npm run build:release` will build single file

See [paulmillr.com/noble](https://paulmillr.com/noble/)
for useful resources, articles, documentation and demos
related to the library.

## License

The MIT License (MIT)

Copyright (c) 2023 Paul Miller [(https://paulmillr.com)](https://paulmillr.com)
Copyright (c) 2016 Thomas Pornin <pornin@bolet.org>

See LICENSE file.
