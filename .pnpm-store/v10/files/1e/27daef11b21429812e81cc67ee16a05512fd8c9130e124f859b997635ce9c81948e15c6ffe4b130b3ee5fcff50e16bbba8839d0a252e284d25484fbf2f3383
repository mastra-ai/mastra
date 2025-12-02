# error-stack-parser-es

[![NPM version](https://img.shields.io/npm/v/error-stack-parser-es?color=a1b858&label=)](https://www.npmjs.com/package/error-stack-parser-es)

A port of [stacktracejs/error-stack-parser](https://github.com/stacktracejs/error-stack-parser), rewrite with TypeScript and ES Modules.

## Usage

```ts
import { parse } from 'error-stack-parser-es'

const stacktrace = parse(new Error('BOOM!'))
```

Refer to [stacktracejs/error-stack-parser](https://github.com/stacktracejs/error-stack-parser) for more details.

### Lite API

Additionally, this fork added a lite version of the API representation for the stack frames. You can import it from `error-stack-parser-es/lite`. For example, `line` and `col` instead of `lineNumber` and `columnNumber`.

```ts
import { parse } from 'error-stack-parser-es/lite'

const stacktrace = parse(new Error('BOOM!'))
// [{ file: 'file.js', name: 'method', line: 1, col: 2}]
```

It also allows you to parse directly from a stacktrace string (which does not support Opera stacktrace format).

```ts
import { parseStack } from 'error-stack-parser-es/lite'

const stacktrace = parseStack('Error\n    at method (file.js:1:2)')
// [{ file: 'file.js', name: 'method', line: 1, col: 2}]
```

## License

[MIT](./LICENSE) License © 2023-PRESENT [Anthony Fu](https://github.com/antfu)
[MIT](./LICENSE) License © 2017 [Eric Wendelin](https://github.com/eriwen)
