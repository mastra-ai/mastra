# Installation
> `npm install --save @types/shimmer`

# Summary
This package contains type definitions for shimmer (https://github.com/othiym23/shimmer).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/shimmer.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/shimmer/index.d.ts)
````ts
declare const shimmer: {
    (options: { logger?(msg: string): void }): void;
    wrap<Nodule extends object, FieldName extends keyof Nodule>(
        nodule: Nodule,
        name: FieldName,
        wrapper: (original: Nodule[FieldName]) => Nodule[FieldName],
    ): void;
    massWrap<Nodule extends object, FieldName extends keyof Nodule>(
        nodules: Nodule[],
        names: FieldName[],
        wrapper: (original: Nodule[FieldName]) => Nodule[FieldName],
    ): void;
    unwrap<Nodule extends object>(
        nodule: Nodule,
        name: keyof Nodule,
    ): void;
    massUnwrap<Nodule extends object>(
        nodules: Nodule[],
        names: Array<keyof Nodule>,
    ): void;
};

export = shimmer;

````

### Additional Details
 * Last updated: Mon, 08 Jul 2024 08:09:26 GMT
 * Dependencies: none

# Credits
These definitions were written by [Kelvin Jin](https://github.com/kjin).
