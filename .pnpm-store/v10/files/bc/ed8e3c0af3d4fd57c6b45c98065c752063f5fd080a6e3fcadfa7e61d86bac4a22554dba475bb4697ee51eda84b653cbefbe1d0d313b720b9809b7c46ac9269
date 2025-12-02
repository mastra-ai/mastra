# Installation
> `npm install --save @types/http-assert`

# Summary
This package contains type definitions for http-assert (https://github.com/jshttp/http-assert).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/http-assert.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/http-assert/index.d.ts)
````ts
/**
 * @param status the status code
 * @param msg the message of the error, defaulting to node's text for that status code
 * @param opts custom properties to attach to the error object
 */
declare function assert(value: any, status?: number, msg?: string, opts?: Record<string, any>): asserts value;
declare function assert(value: any, status?: number, opts?: Record<string, any>): asserts value;

declare namespace assert {
    /**
     * @param status the status code
     * @param msg the message of the error, defaulting to node's text for that status code
     * @param opts custom properties to attach to the error object
     */
    type Assert = <T>(a: T, b: T, status?: number, msg?: string, opts?: Record<string, any>) => void;

    /**
     * @param status the status code
     * @param msg the message of the error, defaulting to node's text for that status code
     * @param opts custom properties to attach to the error object
     */
    type AssertOK = (a: any, status?: number, msg?: string, opts?: Record<string, any>) => asserts a;

    /**
     * @param status the status code
     * @param msg the message of the error, defaulting to node's text for that status code
     * @param opts custom properties to attach to the error object
     */
    type AssertFail = (status?: number, msg?: string, opts?: Record<string, any>) => void;

    /**
     * @param status the status code
     * @param msg the message of the error, defaulting to node's text for that status code
     * @param opts custom properties to attach to the error object
     */
    type AssertEqual = (a: any, b: any, status?: number, msg?: string, opts?: Record<string, any>) => void;

    const equal: Assert;
    const notEqual: Assert;
    const ok: AssertOK;
    const strictEqual: AssertEqual;
    const notStrictEqual: AssertEqual;
    const deepEqual: AssertEqual;
    const notDeepEqual: AssertEqual;
    const fail: AssertFail;
}

export = assert;

````

### Additional Details
 * Last updated: Thu, 24 Oct 2024 14:35:39 GMT
 * Dependencies: none

# Credits
These definitions were written by [jKey Lu](https://github.com/jkeylu), [Peter Squicciarini](https://github.com/stripedpajamas), and [Alex Bulanov](https://github.com/sapfear).
