# @poppinss/exception

> Create custom exceptions with error code, status, and the help description.

<br />

[![gh-workflow-image]][gh-workflow-url] [![npm-image]][npm-url] ![][typescript-image] [![license-image]][license-url]

## Introduction

The `@poppinss/exception` package provides with a base `Exception` class that can be used to create custom errors with support for defining the **error status**, **error code**, and **help description**.

```ts
import { Exception } from '@poppinss/exception'

class ResourceNotFound extends Exception {
  static code = 'E_RESOURCE_NOT_FOUND'
  static status = 404
  static message = 'Unable to find resource'
}

throw new ResourceNotFound()
```

### Anonymous error classes

You can also create an anonymous exception class using the `createError` method. The return value is a class constructor that accepts an array of values to use for message interpolation.

The interpolation of error message is performed using the [`util.format`](https://nodejs.org/api/util.html#utilformatformat-args) method.

```ts
import { createError } from '@poppinss/exception'

const E_RESOURCE_NOT_FOUND = createError<[number]>(
  'Unable to find resource with id %d',
  'E_RESOURCE_NOT_FOUND'
)

const id = 1
throw new E_RESOURCE_NOT_FOUND([id])
```

## Contributing

One of the primary goals of poppinss is to have a vibrant community of users and contributors who believes in the principles of the framework.

We encourage you to read the [contribution guide](https://github.com/poppinss/.github/blob/main/docs/CONTRIBUTING.md) before contributing to the framework.

## Code of Conduct

In order to ensure that the poppinss community is welcoming to all, please review and abide by the [Code of Conduct](https://github.com/poppinss/.github/blob/main/docs/CODE_OF_CONDUCT.md).

## License

Poppinss exception is open-sourced software licensed under the [MIT license](LICENSE.md).

[gh-workflow-image]: https://img.shields.io/github/actions/workflow/status/poppinss/exception/checks.yml?style=for-the-badge
[gh-workflow-url]: https://github.com/poppinss/exception/actions/workflows/checks.yml 'Github action'
[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[npm-image]: https://img.shields.io/npm/v/@poppinss/exception.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/@poppinss/exception 'npm'
[license-image]: https://img.shields.io/npm/l/@poppinss/exception?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md 'license'
