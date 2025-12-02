# `@napi-rs/simple-git`

![https://github.com/Brooooooklyn/simple-git/actions](https://github.com/Brooooooklyn/simple-git/workflows/CI/badge.svg)
![](https://img.shields.io/npm/dm/@napi-rs/simple-git.svg?sanitize=true)
[![Install size](https://packagephobia.com/badge?p=@napi-rs/simple-git)](https://packagephobia.com/result?p=@napi-rs/simple-git)

## `Repository`

### Usage

```ts
import { Repository } from '@napi-rs/simple-git'

Repository.init('/path/to/repo') // init a git repository

const repo = new Repository('/path/to/repo') // Open an existed repo

const timestamp = new Date(repo.getFileLatestModifiedDate('build.rs')) // get the latest modified timestamp of a `build.rs`
console.log(timestamp) // 2022-03-13T12:47:47.920Z

const timestampFromAsync = new Date(await repo.getFileLatestModifiedDateAsync('build.rs')) // Async version of `getFileLatestModifiedDate`

console.log(timestamp) // 2022-03-13T12:47:47.920Z
```

### API

```ts
export class Repository {
  static init(p: string): Repository
  constructor(gitDir: string)
  /** Retrieve and resolve the reference pointed at by HEAD. */
  head(): Reference
  getFileLatestModifiedDate(filepath: string): number
  getFileLatestModifiedDateAsync(filepath: string, signal?: AbortSignal | undefined | null): Promise<unknown>
}
```

## `Reference`

### Usage

```ts
import { Repository } from '@napi-rs/simple-git'

const repo = new Repository('/path/to/repo') // Open an existed repo

const headReference = repo.head()

headReference.shorthand() // 'main'
headReference.name() // 'refs/heads/main'
headReference.target() // 7a1256e2f847f395219980bc06c6dadf0148f18d
```

### API

```ts
/** An enumeration of all possible kinds of references. */
export const enum ReferenceType {
  /** A reference which points at an object id. */
  Direct = 0,
  /** A reference which points at another reference. */
  Symbolic = 1,
  Unknown = 2
}
export class Reference {
  /**
   * Ensure the reference name is well-formed.
   *
   * Validation is performed as if [`ReferenceFormat::ALLOW_ONELEVEL`]
   * was given to [`Reference.normalize_name`]. No normalization is
   * performed, however.
   *
   * ```ts
   * import { Reference } from '@napi-rs/simple-git'
   *
   * console.assert(Reference.is_valid_name("HEAD"));
   * console.assert(Reference.is_valid_name("refs/heads/main"));
   *
   * // But:
   * console.assert(!Reference.is_valid_name("main"));
   * console.assert(!Reference.is_valid_name("refs/heads/*"));
   * console.assert(!Reference.is_valid_name("foo//bar"));
   * ```
   */
  static isValidName(name: string): boolean
  /** Check if a reference is a local branch. */
  isBranch(): boolean
  /** Check if a reference is a note. */
  isNote(): boolean
  /** Check if a reference is a remote tracking branch */
  isRemote(): boolean
  /** Check if a reference is a tag */
  isTag(): boolean
  kind(): ReferenceType
  /**
   * Get the full name of a reference.
   *
   * Returns `None` if the name is not valid utf-8.
   */
  name(): string | undefined | null
  /**
   * Get the full shorthand of a reference.
   *
   * This will transform the reference name into a name "human-readable"
   * version. If no shortname is appropriate, it will return the full name.
   *
   * Returns `None` if the shorthand is not valid utf-8.
   */
  shorthand(): string | undefined | null
  /**
   * Get the OID pointed to by a direct reference.
   *
   * Only available if the reference is direct (i.e. an object id reference,
   * not a symbolic one).
   */
  target(): string | undefined | null
  /**
   * Return the peeled OID target of this reference.
   *
   * This peeled OID only applies to direct references that point to a hard
   * Tag object: it is the result of peeling such Tag.
   */
  targetPeel(): string | undefined | null
  /**
   * Get full name to the reference pointed to by a symbolic reference.
   *
   * May return `None` if the reference is either not symbolic or not a
   * valid utf-8 string.
   */
  symbolicTarget(): string | undefined | null
}
```

## Performance

Compared with the `exec` function, which gets the file's latest modified date by spawning a child process. Getting the latest modified date from the file 1000 times:

```
Child process took 1.9s
@napi-rs/simple-git took 65ms
```
