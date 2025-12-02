# debounce-fn

> [Debounce](https://davidwalsh.name/javascript-debounce-function) a function

## Install

```sh
npm install debounce-fn
```

## Usage

```js
import debounceFunction from 'debounce-fn';

window.onresize = debounceFunction(() => {
	// Do something on window resize
}, {wait: 100});
```

## API

### debounceFunction(input, options?)

Returns a debounced function that delays calling the `input` function until after `wait` milliseconds have elapsed since the last time the debounced function was called.

It comes with a `.cancel()` method to cancel any scheduled `input` function calls.

#### input

Type: `Function`

Function to debounce.

#### options

Type: `object`

##### wait

Type: `number`\
Default: `0`

Time in milliseconds to wait until the `input` function is called.

##### maxWait

Type: `number`\
Default: `Infinity`

The maximum time the `input` function is allowed to be delayed before it's invoked.

This can be used to limit the number of calls handled in a constant stream. For example, a media player sending updates every few milliseconds but wants to be handled only once a second.

##### before

Type: `boolean`\
Default: `false`

Trigger the function on the leading edge of the `wait` interval.

For example, can be useful for preventing accidental double-clicks on a "submit" button from firing a second time.

##### after

Type: `boolean`\
Default: `true`

Trigger the function on the trailing edge of the `wait` interval.

## Related

- [p-debounce](https://github.com/sindresorhus/p-debounce) - Debounce promise-returning & async functions
