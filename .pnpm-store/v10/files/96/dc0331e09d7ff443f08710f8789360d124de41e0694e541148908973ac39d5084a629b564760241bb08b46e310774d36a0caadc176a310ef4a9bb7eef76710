# youch-core

> Error parser to parse an error instance into a collection of frames

<br />

[![gh-workflow-image]][gh-workflow-url] [![npm-image]][npm-url] ![][typescript-image] [![license-image]][license-url]

## Introduction

The `youch-core` package contains the Error parser used by [youch](https://github.com/poppinss/youch) to pretty print Errors on the Web and the terminal.

It is a low-level package and you will only use it if you want to create your own Error printer while re-using the core Error parsing logic.

## Installation

Install the package from the npm registry as follows.

```sh
npm i @poppinss/dumper
```

```sh
yarn add @poppinss/dumper
```

```sh
pnpm add @poppinss/dumper
```

## Usage

You may parse an error using the `ErrorParser.parse` method. The `parse` method accepts the erorr object and returns back a Promise with [ParsedError](https://github.com/poppinss/youch-core/blob/0.x/src/types.ts#L21).

```ts
import { ErrorParser } from 'youch-core'

/**
 * Error object to parse
 */
const error = new Error('Something went wrong')

/**
 * Create parser instance and parse the error
 */
const parser = new ErrorParser()
const parsedError = await parser.parse(error)
```

The `parsedError.frames` property is an array of stack frames with the **filename**, **line number** and the **source code snippet** for the given frame in the stack.

```ts
parsedError.frames.forEach((frame) => {
  console.log(`${frame.type}: ${frame.fileName}:${frame.lineNumber}`)
})
```

### Using a custom source code loader

The `ErrorParser` reads the source code of files within the stack trace using the Node.js `fs` module. However, you can override this default and provide a custom source loader using the `parser.defineSourceLoader` method.

> [!NOTE]
> The `defineSourceLoader` method is called for every frame within the stack traces. Therefore, you must perform the necessary checks before attempting to read the source code of a file.
> For example, you must not attempt to read the source code for fileNames pointing to native code.

```ts
const parser = new ErrorParser()

parser.defineSourceLoader(async (stackFrame) => {
  if (stackFrame.type !== 'native') {
    stackFrame.source = await someFunctionToGetFileSource(stackFrame.fileName)
  }
})
```

## Contributing

One of the primary goals of Poppinss is to have a vibrant community of users and contributors who believes in the principles of the framework.

We encourage you to read the [contribution guide](https://github.com/poppinss/.github/blob/main/docs/CONTRIBUTING.md) before contributing to the framework.

## Code of Conduct

In order to ensure that the Poppinss community is welcoming to all, please review and abide by the [Code of Conduct](https://github.com/poppinss/.github/blob/main/docs/CODE_OF_CONDUCT.md).

## License

The `youch-core` package is open-sourced software licensed under the [MIT license](LICENSE.md).

[gh-workflow-image]: https://img.shields.io/github/actions/workflow/status/poppinss/youch-core/checks.yml?style=for-the-badge
[gh-workflow-url]: https://github.com/poppinss/youch-core/actions/workflows/checks.yml 'Github action'
[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[npm-image]: https://img.shields.io/npm/v/youch-core.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/youch-core 'npm'
[license-image]: https://img.shields.io/npm/l/youch-core?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md 'license'
