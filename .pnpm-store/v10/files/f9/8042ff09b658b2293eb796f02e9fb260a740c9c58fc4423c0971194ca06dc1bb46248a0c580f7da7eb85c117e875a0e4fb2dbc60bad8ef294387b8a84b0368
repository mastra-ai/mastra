# Installation
> `npm install --save @types/keygrip`

# Summary
This package contains type definitions for keygrip (https://github.com/crypto-utils/keygrip).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/keygrip.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/keygrip/index.d.ts)
````ts
interface Keygrip {
    sign(data: any): string;
    verify(data: any, digest: string): boolean;
    index(data: any, digest: string): number;
}

interface KeygripFunction {
    new(keys: readonly string[], algorithm?: string, encoding?: string): Keygrip;
    (keys: readonly string[], algorithm?: string, encoding?: string): Keygrip;
}

declare const Keygrip: KeygripFunction;

export = Keygrip;

````

### Additional Details
 * Last updated: Mon, 20 Nov 2023 23:36:24 GMT
 * Dependencies: none

# Credits
These definitions were written by [jKey Lu](https://github.com/jkeylu).
