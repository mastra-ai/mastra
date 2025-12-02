# @fastify/error

[![CI](https://github.com/fastify/fastify-error/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/fastify/fastify-error/actions/workflows/ci.yml)
[![NPM version](https://img.shields.io/npm/v/@fastify/error.svg?style=flat)](https://www.npmjs.com/package/@fastify/error)
[![neostandard javascript style](https://img.shields.io/badge/code_style-neostandard-brightgreen?style=flat)](https://github.com/neostandard/neostandard)

A small utility, used by Fastify itself, for generating consistent error objects across your codebase and plugins.

### Install
```
npm i @fastify/error
```

### Usage

The module exports a function that you can use for consistent error objects, it takes 4 parameters:

```js
createError(code, message [, statusCode [, Base [, captureStackTrace]]])
```

- `code` (`string`, required) - The error code, you can access it later with `error.code`. For consistency, we recommend prefixing plugin error codes with `FST_`
- `message` (`string`, required) - The error message. You can also use interpolated strings for formatting the message.
- `statusCode` (`number`, optional) - The status code that Fastify will use if the error is sent via HTTP.
- `Base` (`ErrorConstructor`, optional) - The base error object that will be used. (eg `TypeError`, `RangeError`)
- `captureStackTrace` (`boolean`, optional) - Whether to capture the stack trace or not.

```js
const createError = require('@fastify/error')
const CustomError = createError('ERROR_CODE', 'Hello')
console.log(new CustomError()) // error.message => 'Hello'
```

How to use an interpolated string:
```js
const createError = require('@fastify/error')
const CustomError = createError('ERROR_CODE', 'Hello %s')
console.log(new CustomError('world')) // error.message => 'Hello world'
```

How to add cause:
```js
const createError = require('@fastify/error')
const CustomError = createError('ERROR_CODE', 'Hello %s')
console.log(new CustomError('world', {cause: new Error('cause')}))
// error.message => 'Hello world'
// error.cause => Error('cause')
```

### TypeScript

It is possible to limit your error constructor with a generic type using TypeScript:

```ts
const CustomError = createError<[string]>('ERROR_CODE', 'Hello %s')
new CustomError('world')
//@ts-expect-error
new CustomError(1)
```

### instanceof

All errors created with `createError` will be instances of the base error constructor you provided, or `Error` if none was provided.

```js
const createError = require('@fastify/error')
const CustomError = createError('ERROR_CODE', 'Hello %s', 500, TypeError)
const customError = new CustomError('world')

console.log(customError instanceof CustomError) // true
console.log(customError instanceof TypeError) // true
console.log(customError instanceof Error) // true
```

All instantiated errors are instances of the `FastifyError` class, which can be required directly from the module.

```js
const { createError, FastifyError } = require('@fastify/error')
const CustomError = createError('ERROR_CODE', 'Hello %s', 500, TypeError)
const customError = new CustomError('world')

console.log(customError instanceof FastifyError) // true
```

A `FastifyError` created by `createError` can extend another `FastifyError` while maintaining correct `instanceof` behavior.

```js
const { createError, FastifyError } = require('@fastify/error')

const CustomError = createError('ERROR_CODE', 'Hello %s', 500, TypeError)
const ChildCustomError = createError('CHILD_ERROR_CODE', 'Hello %s', 500, CustomError)

const customError = new ChildCustomError('world')

console.log(customError instanceof ChildCustomError) // true
console.log(customError instanceof CustomError) // true
console.log(customError instanceof FastifyError) // true
console.log(customError instanceof TypeError) // true
console.log(customError instanceof Error) // true
```

If `fastify-error` is installed multiple times directly or as a transitive dependency, `instanceof` checks for errors created by `createError` will still work correctly across these installations, as long as their error codes (e.g., `FST_ERR_CUSTOM_ERROR`) are identical.

```js
const { createError, FastifyError } = require('@fastify/error')

// CustomError from `@fastify/some-plugin` is created with `createError` and
// has its own `@fastify/error` installation as dependency. CustomError has
// FST_ERR_CUSTOM_ERROR as code.
const { CustomError: CustomErrorFromPlugin } = require('@fastify/some-plugin')

const CustomError = createError('FST_ERR_CUSTOM_ERROR', 'Hello %s', 500)

const customError = new CustomError('world')
const customErrorFromPlugin = new CustomErrorFromPlugin('world')

console.log(customError instanceof CustomError) // true
console.log(customError instanceof CustomErrorFromPlugin) // true
console.log(customErrorFromPlugin instanceof CustomError) // true
console.log(customErrorFromPlugin instanceof CustomErrorFromPlugin) // true
```

Changing the code of an instantiated Error will not change the result of the `instanceof` operator.

```js
const { createError, FastifyError } = require('@fastify/error')

const CustomError = createError('ERROR_CODE', 'Hello %s', 500, TypeError)
const AnotherCustomError = createError('ANOTHER_ERROR_CODE', 'Hello %s', 500, CustomError)

const customError = new CustomError('world')
customError.code = 'ANOTHER_ERROR_CODE'

console.log(customError instanceof CustomError) // true
console.log(customError instanceof AnotherCustomError) // false
```

## License

Licensed under [MIT](./LICENSE).
