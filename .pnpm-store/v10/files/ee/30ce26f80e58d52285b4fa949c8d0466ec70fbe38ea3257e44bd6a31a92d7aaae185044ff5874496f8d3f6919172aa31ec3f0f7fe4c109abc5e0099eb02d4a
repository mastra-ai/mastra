# Installation
> `npm install --save @types/duplexify`

# Summary
This package contains type definitions for duplexify (https://github.com/mafintosh/duplexify).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/duplexify.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/duplexify/index.d.ts)
````ts
/// <reference types="node" />

import * as stream from "stream";

export = duplexify;

interface DuplexifyConstructor {
    (writable?: stream.Writable, readable?: stream.Readable, streamOptions?: stream.DuplexOptions): duplexify.Duplexify;
    new(
        writable?: stream.Writable,
        readable?: stream.Readable,
        streamOptions?: stream.DuplexOptions,
    ): duplexify.Duplexify;

    obj(
        writable?: stream.Writable,
        readable?: stream.Readable,
        streamOptions?: stream.DuplexOptions,
    ): duplexify.Duplexify;
}
declare var duplexify: DuplexifyConstructor;
declare namespace duplexify {
    interface Duplexify extends stream.Duplex {
        cork(): void;
        uncork(): void;
        setWritable(writable: stream.Writable): void;
        setReadable(readable: stream.Readable): void;
    }
}

````

### Additional Details
 * Last updated: Mon, 06 Nov 2023 22:41:05 GMT
 * Dependencies: [@types/node](https://npmjs.com/package/@types/node)

# Credits
These definitions were written by [Sami Kukkonen](https://github.com/strax).
