# unplugin-utils [![npm](https://img.shields.io/npm/v/unplugin-utils.svg)](https://npmjs.com/package/unplugin-utils) [![codecov](https://codecov.io/gh/sxzz/unplugin-utils/graph/badge.svg?token=MHTCPNMZAK)](https://codecov.io/gh/sxzz/unplugin-utils)

[![Unit Test](https://github.com/sxzz/unplugin-utils/actions/workflows/unit-test.yml/badge.svg)](https://github.com/sxzz/unplugin-utils/actions/workflows/unit-test.yml)

A set of utility functions commonly used by unplugins.

Thanks to [@rollup/pluginutils](https://github.com/rollup/plugins/tree/master/packages/pluginutils). This projects is heavily copied from it.

## Why Fork?

- 🌍 Platform agnostic, supports running in the browser, Node.js...
- ✂️ Subset, smaller bundle size.
- **💯 Coverage**: 100% test coverage.

## Install

```bash
npm i unplugin-utils
```

## Usage

### createFilter

```ts
export default function myPlugin(options = {}) {
  const filter = createFilter(options.include, options.exclude)

  return {
    transform(code, id) {
      if (!filter(id)) return

      // proceed with the transformation...
    },
  }
}
```

### normalizePath

```ts
import { normalizePath } from 'unplugin-utils'

normalizePath(String.raw`foo\bar`) // 'foo/bar'
normalizePath('foo/bar') // 'foo/bar'
```

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/sxzz/sponsors/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/sxzz/sponsors/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2025 [三咲智子 Kevin Deng](https://github.com/sxzz)

[MIT](./LICENSE) Copyright (c) 2019 RollupJS Plugin Contributors (https://github.com/rollup/plugins/graphs/contributors)
