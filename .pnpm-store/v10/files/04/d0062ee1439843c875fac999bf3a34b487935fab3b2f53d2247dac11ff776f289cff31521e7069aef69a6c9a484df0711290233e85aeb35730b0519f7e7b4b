# @poppinss/colors
> Wrapper over [kleur](https://www.npmjs.com/package/kleur) with better support for testing

[![gh-workflow-image]][gh-workflow-url] [![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

## Why this package exists?
This package is a wrapper over [kleur](https://www.npmjs.com/package/kleur) with additional implementations to make testing easier and work seamlessly with terminals/stdout streams that do not support colors.

## Usage
Install the package from the npm registry as follows.

```sh
npm i @poppinss/colors
```

And use it as follows. The `ansi` method returns an instance of the [kleur](https://www.npmjs.com/package/kleur) package.

```ts
import useColors from '@poppinss/colors'
const colors = useColors.ansi()

console.log(colors.red('this is an error'))
console.log(colors.cyan('hello world'))
```

Chaining methods

```ts
const colors = useColors.ansi()
console.log(colors.red().bgBlack('this is an error'))
```

### Raw implementation
The raw implementation is ideal for testing. Instead of outputting ANSI escape codes, we wrap the string with transformation names. For example:

```ts
import useColors from '@poppinss/colors'
const colors = useColors.raw()

console.log(colors.red('hello world'))
// OUTPUT: red(hello world)

console.log(colors.bgBlack().red('hello world'))
// OUTPUT: bgBlack(red(hello world))
```

As you can notice, the output is a plain text value, so it is easier to write assertions against it.

```ts
assert.equal(colors.red('hello world'), 'red(hello world)')
```

### Silent output
The silent mode does not perform any transformations on the string and returns the value. This is helpful when the output terminal or stdout stream does not support colors.

```ts
import useColors from '@poppinss/colors'
const colors = useColors.silent()

console.log(colors.red('hello world'))
// OUTPUT: hello world

console.log(colors.bgBlack().red('hello world'))
// OUTPUT: hello world
```

## Pick based on the runtime environment
Ideally, you will use one of the available implementations based on some runtime environment. For example:

```ts
import useColors from '@poppinss/colors'
import supportsColor from 'supports-color'

const isTestEnv = process.env.NODE_ENV === 'test'

const colors = isTestEnv
  ? useColors.raw() // use raw in test environment
  : supportsColor.stdout
    ? useColors.ansi() // use kleur when stdout has colors
    : useColors.silent() // use silent mode 

export default colors
```

[gh-workflow-image]: https://img.shields.io/github/actions/workflow/status/poppinss/colors/checks.yml?style=for-the-badge
[gh-workflow-url]: https://github.com/poppinss/colors/actions/workflows/checks.yml "Github action"

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"

[npm-image]: https://img.shields.io/npm/v/@poppinss/colors.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/@poppinss/colors 'npm'

[license-image]: https://img.shields.io/npm/l/@poppinss/colors?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md 'license'
