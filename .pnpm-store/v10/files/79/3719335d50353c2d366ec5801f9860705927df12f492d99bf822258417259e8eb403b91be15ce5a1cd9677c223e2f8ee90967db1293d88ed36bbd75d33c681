# Atomically

Read and write files atomically and reliably.

## Features

- Overview:
  - This library is a rewrite of [`write-file-atomic`](https://github.com/npm/write-file-atomic), with some important enhancements on top, you can largely use this as a drop-in replacement.
  - This library is written in TypeScript, so types aren't an afterthought but come with library.
  - This library is slightly faster than [`write-file-atomic`](https://github.com/npm/write-file-atomic), and it can be 10x faster, while being essentially just as safe, by using the `fsyncWait` option.
  - This library has 0 third-party dependencies, so there's less code to vet and the entire thing is roughly 20% smaller than [`write-file-atomic`](https://github.com/npm/write-file-atomic).
  - This library tries harder to write files on disk than [`write-file-atomic`](https://github.com/npm/write-file-atomic) does, by default retrying some failed operations and handling some more errors.
- Reliability:
  - Reads are retried, when appropriate, until they succeed or the timeout is reached.
  - Writes are atomic, meaning that first a temporary file containing the new content is written, then this file is renamed to the final path, this way it's impossible to get a corrupt/partially-written file.
  - Writes happening to the same path are queued, ensuring they don't interfere with each other.
  - Temporary files can be configured to not be purged from disk if the write operation fails, which is useful for when keeping the temporary file is better than just losing data.
  - Any needed missing parent folder will be created automatically.
  - Symlinks are resolved automatically.
  - `ENOSYS` errors on `chmod`/`chown` operations are ignored.
  - `EINVAL`/`EPERM` errors on `chmod`/`chown` operations, in POSIX systems where the user is not root, are ignored.
  - `EMFILE`/`ENFILE`/`EAGAIN`/`EBUSY`/`EACCESS`/`EACCES`/`EACCS`/`EPERM` errors happening during necessary operations are caught and the operations are retried until they succeed or the timeout is reached.
  - `ENAMETOOLONG` errors, both appening because of the final path or the temporary path, are attempted to be worked around by smartly truncating paths.
- Temporary files:
  - By default they are purged automatically once the write operation is completed or if the process exits (cleanly or not).
  - By default they are created by appending a `.tmp-[timestamp][randomness]` suffix to destination paths:
    - The `tmp-` part gives users a hint about the nature of these files, if they happen to see them.
    - The `[timestamp]` part consists of the 10 least significant digits of a milliseconds-precise timestamp, making it likely that if more than one of these files are kept on disk the user will see them in chronological order.
    - The `[randomness]` part consists of 6 random hex characters.
    - If by any chance a collision is found then another suffix is generated.
- Custom options:
  - `chown`: it allows you to specify custom group and user ids:
    - by default the old file's ids are copied over.
    - if custom ids are provided they will be used.
    - if `false` the default ids are used.
  - `encoding`: it allows you to specify the encoding of the file content:
    - by default when reading no encoding is specified and a raw buffer is returned.
    - by default when writing `utf8` is used when.
  - `fsync`: it allows you to control whether the `fsync` syscall is triggered right after writing the file or not:
    - by default the syscall is triggered immediately after writing the file, increasing the chances that the file will actually be written to disk in case of imminent catastrophic failures, like power outages.
    - if `false` the syscall won't be triggered.
  - `fsyncWait`: it allows you to control whether the triggered `fsync` is waited or not:
    - by default the syscall is waited.
    - if `false` the syscall will still be triggered but not be waited.
      - this increases performance 10x in some cases, and at the end of the day often there's no plan B if `fsync` fails anyway.
  - `mode`: it allows you to specify the mode for the file:
    - by default the old file's mode is copied over.
    - if `false` then `0o666` is used.
  - `schedule`: it's a function that returns a promise that resolves to a disposer function, basically it allows you to provide some custom queueing logic for the writing operation, allowing you to perhaps wire `atomically` with your app's main filesystem job scheduler:
    - even when a custom `schedule` function is provided write operations will still be queued internally by the library too.
  - `timeout`: it allows you to specify the amount of maximum milliseconds within which the library will retry some failed operations:
    - when writing asynchronously by default it will keep retrying for 7500 milliseconds.
    - when writing synchronously by default it will keep retrying for 1000 milliseconds.
    - if `0` or `-1` no failed operations will be retried.
    - if another number is provided that will be the timeout interval.
  - `tmpCreate`: it's a function that will be used to create the custom temporary file path in place of the default one:
    - even when a custom function is provided the final temporary path will still be truncated if the library thinks that it may lead to `ENAMETOOLONG` errors.
    - paths by default are truncated in a way that preserves an eventual existing leading dot and trailing extension.
  - `tmpCreated`: it's a function that will be called with the newly created temporary file path.
  - `tmpPurge`: it allows you to control whether the temporary file will be purged from the filesystem or not if the write fails:
    - by default it will be purged.
    - if `false` it will be kept on disk.

## Install

```sh
npm install --save atomically
```

## Usage

This is the shape of the optional options object:

```ts
type Disposer = () => void;

type ReadOptions = string | {
  encoding?: string | null,
  mode?: string | number | false,
  timeout?: number
};

type WriteOptions = string | {
  chown?: { gid: number, uid: number } | false,
  encoding?: string | null,
  fsync?: boolean,
  fsyncWait?: boolean,
  mode?: string | number | false,
  schedule?: ( filePath: string ) => Promise<Disposer>,
  timeout?: number,
  tmpCreate?: ( filePath: string ) => string,
  tmpCreated?: ( filePath: string ) => any,
  tmpPurge?: boolean
};
```

This is the shape of the provided functions:

```ts
function readFile ( filePath: string, options?: ReadOptions ): Promise<Buffer | string>;
function readFileSync ( filePath: string, options?: ReadOptions ): Buffer | string;
function writeFile ( filePath: string, data: Buffer | string | undefined, options?: WriteOptions ): Promise<void>;
function writeFileSync ( filePath: string, data: Buffer | string | undefined, options?: WriteOptions ): void;
```

This is how to use the library:

```ts
import {readFile, readFileSync, writeFile, writeFileSync} from 'atomically';

// Asynchronous read with default option
const buffer = await readFile ( '/foo.txt' );

// Synchronous read assuming the encoding is "utf8"
const string = readFileSync ( '/foo.txt', 'utf8' );

// Asynchronous write with default options
await writeFile ( '/foo.txt', 'my_data' );

// Asynchronous write that doesn't prod the old file for a stat object at all
await writeFile ( '/foo.txt', 'my_data', { chown: false, mode: false } );

// 10x faster asynchronous write that's less resilient against imminent catastrophies
await writeFile ( '/foo.txt', 'my_data', { fsync: false } );

// 10x faster asynchronous write that's essentially still as resilient against imminent catastrophies
await writeFile ( '/foo.txt', 'my_data', { fsyncWait: false } );

// Asynchronous write with a custom schedule function
await writeFile ( '/foo.txt', 'my_data', {
  schedule: filePath => {
    return new Promise ( resolve => { // When this returned promise will resolve the write operation will begin
      MyScheduler.schedule ( filePath, () => { // Hypothetical scheduler function that will eventually tell us to go on with this write operation
        const disposer = () => {}; // Hypothetical function that contains eventual clean-up logic, it will be called after the write operation has been completed (successfully or not)
        resolve ( disposer ); // Resolving the promise with a disposer, beginning the write operation
      })
    });
  }
});

// Synchronous write with default options
writeFileSync ( '/foo.txt', 'my_data' );
```

## License

MIT © Fabio Spampinato
