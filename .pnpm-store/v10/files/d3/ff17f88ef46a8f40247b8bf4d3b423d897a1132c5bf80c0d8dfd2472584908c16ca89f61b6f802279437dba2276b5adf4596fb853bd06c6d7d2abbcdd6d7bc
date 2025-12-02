# Stubborn FS

Stubborn versions of Node's `fs` functions that try really hard to do their job.

## Install

```sh
npm install --save stubborn-fs
```

## Usage

The following functions are currently provided, if you need others please open an issue.

- `attempt` functions swallow some errors that may occur.
- `retry` functions are executed in a loop until they succeed or the timeout is reached, in which case an error is thrown.

```ts
import fs from 'stubborn-fs';

// Attempt functions (async)

fs.attempt.chmod;
fs.attempt.chown;
fs.attempt.close;
fs.attempt.fsync;
fs.attempt.mkdir;
fs.attempt.realpath;
fs.attempt.stat;
fs.attempt.unlink;

// Attempt functions (sync)

fs.attempt.chmodSync;
fs.attempt.chownSync;
fs.attempt.closeSync;
fs.attempt.existsSync;
fs.attempt.fsyncSync;
fs.attempt.mkdirSync;
fs.attempt.realpathSync;
fs.attempt.statSync;
fs.attempt.unlinkSync;

// Retry functions (async)

fs.retry.close;
fs.retry.fsync;
fs.retry.open;
fs.retry.readFile;
fs.retry.rename;
fs.retry.stat;
fs.retry.write;
fs.retry.writeFile;

// Retry functions (sync)

fs.retry.closeSync;
fs.retry.fsyncSync;
fs.retry.openSync;
fs.retry.readFileSync;
fs.retry.renameSync;
fs.retry.statSync;
fs.retry.writeSync;
fs.retry.writeFileSync;
```

## License

MIT © Fabio Spampinato
