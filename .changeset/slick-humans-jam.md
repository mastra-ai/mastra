---
'@mastra/core': patch
---

Fixed device file access in both native sandbox backends of `LocalSandbox`, which made `git`, `ssh`, and shell redirections fail inside an isolated sandbox.

**Linux (`isolation: 'bwrap'`)**

The bubblewrap namespace was built with `/proc` and a tmpfs at `/tmp` but no `/dev`, so `/dev/null` did not exist and `git` failed with `No such file or directory`. It is now mounted as a minimal device filesystem.

Adding `/dev` or `/dev/null` to `readOnlyPaths` was not a workaround. bwrap marks every bind mount `nodev`, and opening a character device on a `nodev` mount fails with `Permission denied` on any open, so that route produced nodes that looked correct but could not be used at all. Devices beyond the standard set still need `--dev-bind` passed through `bwrapArgs`.

**macOS (`isolation: 'seatbelt'`)**

The generated profile allowed `file-ioctl` on `/dev/null` and friends but never `file-write-data`, and its `file-write*` rules are scoped to the workspace. Opening a device for reading and writing was therefore denied, so `git` failed with `fatal: could not open '/dev/null' for reading and writing`. Writes to `/dev/null`, `/dev/zero`, `/dev/random`, `/dev/urandom`, and `/dev/tty` are now allowed. Unlinking and chmod on those nodes stay denied.

Passing `nativeSandbox.bwrapArgs` still replaces the default arguments entirely, so include `--dev /dev` yourself when you override them.
