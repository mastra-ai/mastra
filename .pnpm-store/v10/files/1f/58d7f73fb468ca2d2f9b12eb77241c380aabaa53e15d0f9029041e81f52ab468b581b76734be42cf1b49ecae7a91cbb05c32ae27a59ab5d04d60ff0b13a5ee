# `@node-rs/xxhash`

![](https://github.com/napi-rs/node-rs/workflows/CI/badge.svg)
![](https://img.shields.io/npm/dm/@node-rs/xxhash.svg?sanitize=true)
[![Install size](https://packagephobia.com/badge?p=@node-rs/xxhash)](https://packagephobia.com/result?p=@node-rs/xxhash)

> 🚀 Help me to become a full-time open-source developer by [sponsoring me on Github](https://github.com/sponsors/Brooooooklyn)

[`xxhash-rust`](https://github.com/DoumanAsh/xxhash-rust) binding for Node.js.

## Install this package

```
yarn add @node-rs/xxhash
pnpm add @node-rs/xxhash
npm install @node-rs/xxhash
```

## API

```ts
export type BufferLike =
  | Buffer
  | string
  | Uint8Array
  | ArrayBuffer
  | SharedArrayBuffer
  | ReadonlyArray<number>
  | number[]

export function xxh32(input: BufferLike, seed?: number): number
export function xxh64(input: BufferLike, seed?: BigInt): BigInt

export class Xxh32 {
  constructor(seed?: number)
  update(input: BufferLike): this
  digest(): number
  reset(): void
}

export class Xxh64 {
  constructor(seed?: BigInt)
  update(input: BufferLike): this
  digest(): BigInt
  reset(): void
}

export class Xxh3 {
  static withSeed(seed?: BigInt): Xxh3
  static withSecret(secret: BufferLike): Xxh3
  private constructor() {}
  update(input: BufferLike): this
  digest(): BigInt
  reset(): void
}

export const xxh3: {
  xxh64: (input: BufferLike, seed?: BigInt) => BigInt
  xxh64WithSecret: (input: BufferLike, secret: BufferLike) => BigInt
  xxh128: (input: BufferLike, seed?: BigInt) => BigInt
  xxh128WithSecret: (input: BufferLike, secret: BufferLike) => BigInt
  Xxh3: typeof Xxh3
}
```

## Performance

### Hardware

```
                  ,MMMM.           Host        -  xxxxxxxxxxxxxxxxxxxxxxx
                .MMMMMM            Machine     -  Mac15,9
                MMMMM,             Kernel      -  24.0.0
      .;MMMMM:' MMMMMMMMMM;.       OS          -  macOS 15.0.1 Sequoia
    MMMMMMMMMMMMNWMMMMMMMMMMM:     DE          -  Aqua
  .MMMMMMMMMMMMMMMMMMMMMMMMWM.     WM          -  Quartz Compositor
  MMMMMMMMMMMMMMMMMMMMMMMMM.       Packages    -  194 (Homebrew), 32 (cargo)
 ;MMMMMMMMMMMMMMMMMMMMMMMM:        Shell       -  zsh
 :MMMMMMMMMMMMMMMMMMMMMMMM:        Terminal    -  warpterminal (Version v0.2024.10.23.14.49.stable_00)
 .MMMMMMMMMMMMMMMMMMMMMMMMM.       Resolution  -  5120x2880@160fps (as 2560x1440)
  MMMMMMMMMMMMMMMMMMMMMMMMMMM.                    2992x1934@120fps (as 1496x967)
   .MMMMMMMMMMMMMMMMMMMMMMMMMM.                   2232x1512@60fps (as 1116x756)
     MMMMMMMMMMMMMMMMMMMMMMMM      Uptime      -  1d 2h 32m
      ;MMMMMMMMMMMMMMMMMMMM.       CPU         -  Apple M3 Max (16)
        .MMMM,.    .MMMM,.         CPU Load    -  16%
                                   Memory      -  50.1 GB / 134.2 GB
                                   Battery     -  78% & Discharging
                                   Disk Space  -  624.0 GB / 994.7 GB
```

### Result

```
❯ yarn workspace @node-rs/xxhash bench
xxh32 without initial seed
┌─────────┬───────────────────────┬──────────┬───────────────────┬──────────┬─────────┐
│ (index) │ Task Name             │ ops/sec  │ Average Time (ns) │ Margin   │ Samples │
├─────────┼───────────────────────┼──────────┼───────────────────┼──────────┼─────────┤
│ 0       │ '@node-rs/xxhash h32' │ '20,146' │ 49637.20101250711 │ '±0.20%' │ 10074   │
│ 1       │ 'xxhash c++'          │ '17,348' │ 57642.4387319887  │ '±0.19%' │ 8675    │
│ 2       │ 'xxhashjs h32'        │ '2,697'  │ 370657.902149741  │ '±0.24%' │ 1349    │
└─────────┴───────────────────────┴──────────┴───────────────────┴──────────┴─────────┘
xxh32 without initial seed multi step
┌─────────┬───────────────────────┬──────────┬────────────────────┬──────────┬─────────┐
│ (index) │ Task Name             │ ops/sec  │ Average Time (ns)  │ Margin   │ Samples │
├─────────┼───────────────────────┼──────────┼────────────────────┼──────────┼─────────┤
│ 0       │ '@node-rs/xxhash h32' │ '17,111' │ 58440.61746142987  │ '±0.20%' │ 8556    │
│ 1       │ 'xxhashjs h32'        │ '2,738'  │ 365160.82262773765 │ '±0.19%' │ 1370    │
└─────────┴───────────────────────┴──────────┴────────────────────┴──────────┴─────────┘
xxh64 without initial seed
┌─────────┬──────────────────────┬──────────┬────────────────────┬──────────┬─────────┐
│ (index) │ Task Name            │ ops/sec  │ Average Time (ns)  │ Margin   │ Samples │
├─────────┼──────────────────────┼──────────┼────────────────────┼──────────┼─────────┤
│ 0       │ '@node-rs/xxhash 64' │ '50,159' │ 19936.33995215147  │ '±0.11%' │ 25080   │
│ 1       │ 'xxhash C++'         │ '47,980' │ 20841.790588135264 │ '±0.17%' │ 23991   │
│ 2       │ 'wasm'               │ '33,916' │ 29484.03756117805  │ '±0.21%' │ 16959   │
│ 3       │ 'xxhashjs h64'       │ '95'     │ 10431058.97916674  │ '±0.57%' │ 48      │
└─────────┴──────────────────────┴──────────┴────────────────────┴──────────┴─────────┘
xxh64 without initial seed multi step
┌─────────┬──────────────────────┬──────────┬────────────────────┬──────────┬─────────┐
│ (index) │ Task Name            │ ops/sec  │ Average Time (ns)  │ Margin   │ Samples │
├─────────┼──────────────────────┼──────────┼────────────────────┼──────────┼─────────┤
│ 0       │ '@node-rs/xxhash 64' │ '46,603' │ 21457.79825765685  │ '±0.20%' │ 23302   │
│ 1       │ 'wasm'               │ '34,681' │ 28834.205985814675 │ '±0.19%' │ 17341   │
│ 2       │ 'xxhashjs h64'       │ '96'     │ 10411336.75510195  │ '±0.73%' │ 49      │
└─────────┴──────────────────────┴──────────┴────────────────────┴──────────┴─────────┘
```
