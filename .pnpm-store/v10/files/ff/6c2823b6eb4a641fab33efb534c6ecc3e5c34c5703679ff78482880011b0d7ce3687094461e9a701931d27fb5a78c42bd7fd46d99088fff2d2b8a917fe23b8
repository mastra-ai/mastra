<h1 align="center" title="yocto-spinner">
	<img src="media/logo.jpg" alt="yocto-spinner logo">
</h1>

[![Install size](https://packagephobia.com/badge?p=yocto-spinner)](https://packagephobia.com/result?p=yocto-spinner)
![npm package minzipped size](https://img.shields.io/bundlejs/size/yocto-spinner)
<!-- [![Downloads](https://img.shields.io/npm/dm/yocto-spinner.svg)](https://npmjs.com/yocto-spinner) -->
<!-- ![Dependents](https://img.shields.io/librariesio/dependents/npm/yocto-spinner) -->

> Tiny terminal spinner

## Features

- Tiny and fast
- Customizable text and color options
- Customizable spinner animations
- Only one tiny dependency
- Supports both Unicode and non-Unicode environments
- Gracefully handles process signals (e.g., `SIGINT`, `SIGTERM`)
- Can display different status symbols (info, success, warning, error)
- Works well in CI environments

*Check out [`ora`](https://github.com/sindresorhus/ora) for more features.*

<br>
<p align="center">
	<br>
	<img src="https://raw.githubusercontent.com/sindresorhus/ora/3c63d5e8569d94564b5280525350724817e9ac26/screenshot.svg" width="500">
	<br>
</p>
<br>

## Install

```sh
npm install yocto-spinner
```

## Usage

```js
import yoctoSpinner from 'yocto-spinner';

const spinner = yoctoSpinner({text: 'Loading…'}).start();

setTimeout(() => {
	spinner.success('Success!');
}, 2000);
```

## API

### yoctoSpinner(options?)

Creates a new spinner instance.

#### options

Type: `object`

##### text

Type: `string`\
Default: `''`

The text to display next to the spinner.

##### spinner

Type: `object`\
Default: <img src="https://github.com/sindresorhus/ora/blob/main/screenshot-spinner.gif?raw=true" width="14">

Customize the spinner animation with a custom set of frames and interval.

```js
{
	frames: ['-', '\\', '|', '/'],
	interval: 100,
}
```

Pass in any spinner from [`cli-spinners`](https://github.com/sindresorhus/cli-spinners).

##### color

Type: `string`\
Default: `'cyan'`\
Values: `'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray'`

The color of the spinner.

##### stream

Type: `stream.Writable`\
Default: `process.stderr`

The stream to which the spinner is written.

### Instance methods

#### .start(text?)

Starts the spinner.

Returns the instance.

Optionally, updates the text:

```js
spinner.start('Loading…');
```

#### .stop(finalText?)

Stops the spinner.

Returns the instance.

Optionally displays a final message.

```js
spinner.stop('Stopped.');
```

#### .success(text?)

Stops the spinner and displays a success symbol with the message.

Returns the instance.

```js
spinner.success('Success!');
```

#### .error(text?)

Stops the spinner and displays an error symbol with the message.

Returns the instance.

```js
spinner.error('Error!');
```

#### .warning(text?)

Stops the spinner and displays a warning symbol with the message.

Returns the instance.

```js
spinner.warning('Warning!');
```

#### .clear()

Clears the spinner.

Returns the instance.

#### .info(text?)

Stops the spinner and displays an info symbol with the message.

Returns the instance.

```js
spinner.info('Info.');
```

#### .text <sup>get/set</sup>

Change the text displayed next to the spinner.

```js
spinner.text = 'New text';
```

#### .color <sup>get/set</sup>

Change the spinner color.

#### .isSpinning <sup>get</sup>

Returns whether the spinner is currently spinning.

## FAQ

### How do I change the color of the text?

Use [`yoctocolors`](https://github.com/sindresorhus/yoctocolors):

```js
import yoctoSpinner from 'yocto-spinner';
import {red} from 'yoctocolors';

const spinner = yoctoSpinner({text: `Loading ${red('unicorns')}`}).start();
```

### Why does the spinner freeze?

JavaScript is single-threaded, so any synchronous operations will block the spinner's animation. To avoid this, prefer using asynchronous operations.

## Comparison with [`ora`](https://github.com/sindresorhus/ora)

Ora offers more options, greater customizability, [promise handling](https://github.com/sindresorhus/ora?tab=readme-ov-file#orapromiseaction-options), and better Unicode detection. It’s a more mature and feature-rich package that handles more edge cases but comes with additional dependencies and a larger size. In contrast, this package is smaller, simpler, and optimized for minimal overhead, making it ideal for lightweight projects where dependency size is important. However, Ora is generally the better choice for most use cases.

## Related

- [ora](https://github.com/sindresorhus/ora) - Comprehensive terminal spinner
- [yoctocolors](https://github.com/sindresorhus/yoctocolors) - Tiny terminal coloring
- [nano-spawn](https://github.com/sindresorhus/nano-spawn) - Tiny process execution for humans
