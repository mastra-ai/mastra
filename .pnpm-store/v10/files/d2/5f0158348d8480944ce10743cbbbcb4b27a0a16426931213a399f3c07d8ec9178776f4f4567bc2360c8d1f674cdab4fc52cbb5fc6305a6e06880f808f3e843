# Installation
> `npm install --save @types/pdf-parse`

# Summary
This package contains type definitions for pdf-parse (https://gitlab.com/autokent/pdf-parse).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/pdf-parse.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/pdf-parse/index.d.ts)
````ts
/// <reference types="node" />

export = PdfParse;

declare function PdfParse(dataBuffer: Buffer, options?: PdfParse.Options): Promise<PdfParse.Result>;

declare namespace PdfParse {
    type Version = "default" | "v1.9.426" | "v1.10.100" | "v1.10.88" | "v2.0.550";
    interface Result {
        numpages: number;
        numrender: number;
        info: any;
        metadata: any;
        version: Version;
        text: string;
    }
    interface Options {
        pagerender?: ((pageData: any) => string | Promise<string>) | undefined;
        max?: number | undefined;
        version?: Version | undefined;
    }
}

````

### Additional Details
 * Last updated: Wed, 02 Apr 2025 02:10:34 GMT
 * Dependencies: [@types/node](https://npmjs.com/package/@types/node)

# Credits
These definitions were written by [Philipp Katz](https://github.com/qqilihq).
