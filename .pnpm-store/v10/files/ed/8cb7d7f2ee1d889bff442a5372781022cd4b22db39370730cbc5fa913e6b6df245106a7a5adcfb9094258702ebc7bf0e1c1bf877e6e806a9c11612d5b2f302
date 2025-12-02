# exit-hook

> Run some code when the process exits

The `process.on('exit')` event doesn't catch all the ways a process can exit.

This package is useful for cleaning up before exiting.

## Install

```
$ npm install exit-hook
```

## Usage

```js
const exitHook = require('exit-hook');

exitHook(() => {
	console.log('Exiting');
});

// You can add multiple hooks, even across files
exitHook(() => {
	console.log('Exiting 2');
});

throw new Error('🦄');

//=> 'Exiting'
//=> 'Exiting 2'
```

Removing an exit hook:

```js
const exitHook = require('exit-hook');

const unsubscribe = exitHook(() => {});

unsubscribe();
```

## API

### exitHook(callback)

Returns a function that removes the hook when called.

#### callback

Type: `Function`

The callback to execute when the process exits.

---

<div align="center">
	<b>
		<a href="https://tidelift.com/subscription/pkg/npm-exit-hook?utm_source=npm-exit-hook&utm_medium=referral&utm_campaign=readme">Get professional support for this package with a Tidelift subscription</a>
	</b>
	<br>
	<sub>
		Tidelift helps make open source sustainable for maintainers while giving companies<br>assurances about security, maintenance, and licensing for their dependencies.
	</sub>
</div>
