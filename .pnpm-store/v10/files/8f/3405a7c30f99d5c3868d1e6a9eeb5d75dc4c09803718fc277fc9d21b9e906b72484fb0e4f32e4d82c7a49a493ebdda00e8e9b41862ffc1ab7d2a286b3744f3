# slash

> Convert Windows backslash paths to slash paths: `foo\\bar` ➔ `foo/bar`

[Forward-slash paths can be used in Windows](http://superuser.com/a/176395/6877) as long as they're not extended-length paths.

This was created since the `path` methods in Node.js outputs `\\` paths on Windows.

## Install

```sh
npm install slash
```

## Usage

```js
import path from 'node:path';
import slash from 'slash';

const string = path.join('foo', 'bar');
// Unix    => foo/bar
// Windows => foo\\bar

slash(string);
// Unix    => foo/bar
// Windows => foo/bar
```

## API

### slash(path)

Type: `string`

Accepts a Windows backslash path and returns a path with forward slashes.
