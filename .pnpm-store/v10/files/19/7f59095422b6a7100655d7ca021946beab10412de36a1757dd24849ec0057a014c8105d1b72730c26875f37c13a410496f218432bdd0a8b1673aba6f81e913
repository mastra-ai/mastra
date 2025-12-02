# Installation
> `npm install --save @types/pumpify`

# Summary
This package contains type definitions for pumpify (https://github.com/mafintosh/pumpify).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/pumpify.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/pumpify/index.d.ts)
````ts
/// <reference types="node" />

import * as duplexify from "duplexify";
import { Duplex, Readable, Stream, Writable } from "stream";

declare class Pumpify extends Duplex implements duplexify.Duplexify {
    constructor(...streams: Stream[]);
    constructor(streams: Stream[]);
    setPipeline(...streams: Stream[]): void;
    setPipeline(streams: Stream[]): void;

    // Duplexify members
    setWritable(writable: Writable): void;
    setReadable(readable: Readable): void;
}

interface PumpifyFactoryOptions {
    autoDestroy: boolean;
    destroy: boolean;
    objectMode: boolean;
    highWaterMark: number;
}

declare namespace Pumpify {
    let obj: typeof Pumpify;
    function ctor(opts: PumpifyFactoryOptions): typeof Pumpify;
}

export = Pumpify;

````

### Additional Details
 * Last updated: Tue, 07 Nov 2023 09:09:39 GMT
 * Dependencies: [@types/duplexify](https://npmjs.com/package/@types/duplexify), [@types/node](https://npmjs.com/package/@types/node)

# Credits
These definitions were written by [Justin Beckwith](https://github.com/JustinBeckwith), and [Ankur Oberoi](https://github.com/aoberoi).
