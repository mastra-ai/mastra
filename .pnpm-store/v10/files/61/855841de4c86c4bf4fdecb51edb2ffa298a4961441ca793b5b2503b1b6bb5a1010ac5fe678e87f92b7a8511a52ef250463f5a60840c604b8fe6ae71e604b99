# Installation
> `npm install --save @types/shell-quote`

# Summary
This package contains type definitions for shell-quote (https://github.com/substack/node-shell-quote).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/shell-quote.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/shell-quote/index.d.ts)
````ts
export type ControlOperator = "||" | "&&" | ";;" | "|&" | "<(" | ">>" | ">&" | "&" | ";" | "(" | ")" | "|" | "<" | ">";

export type ParseEntry =
    | string
    | { op: ControlOperator }
    | { op: "glob"; pattern: string }
    | { comment: string };

export interface ParseOptions {
    /**
     * Custom escape character, default value is `\`
     */
    escape?: string | undefined;
}

/**
 * Return a quoted string for the array `args` suitable for using in shell commands.
 */
export function quote(args: readonly string[]): string;

/**
 * Return an array of arguments from the quoted string `cmd`.
 *
 * Interpolate embedded bash-style `$VARNAME` and `${VARNAME}` variables with the `env` object which like bash will replace undefined variables with `""`.
 */
export function parse(
    cmd: string,
    env?: { readonly [key: string]: string | undefined },
    opts?: ParseOptions,
): ParseEntry[];

/**
 * Return an array of arguments from the quoted string `cmd`.
 *
 * Interpolate embedded bash-style `$VARNAME` and `${VARNAME}` variables
 * with the `env` object which like bash will replace undefined variables with `""`.
 *
 * @param env
 *   A function to perform lookups.
 *   When env(key) returns a string, its result will be output just like env[key] would.
 *   When env(key) returns an object, it will be inserted into the result array like the operator objects.
 */
export function parse<T extends object | string>(
    cmd: string,
    env: (key: string) => T | undefined,
    opts?: ParseOptions,
): Array<ParseEntry | T>;

````

### Additional Details
 * Last updated: Mon, 20 Nov 2023 23:36:24 GMT
 * Dependencies: none

# Credits
These definitions were written by [Jason Cheatham](https://github.com/jason0x43), [Cameron Diver](https://github.com/CameronDiver), and [Opportunity Liu](https://github.com/OpportunityLiu).
