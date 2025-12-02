# spawndamnit

> Take care of your `spawn()`

## Features

- Returns an `await`-able promise
- Collects `stdout` and `stderr` buffers
- Emits events "stdout" and "stderr"
- Automatically kills all spawn processes when parent process dies

## Installation

```sh
yarn add spawndamnit
```

## Usage

**Basic:**

```js
const spawn = require('spawndamnit');

async function main() {
  let child = spawn('npm', ['star', 'spawndamnit']);

  child.on('stdout', data => console.log(data.toString()));
  child.on('stderr', data => console.error(data.toString()));

  let { code, stdout, stderr } = await child;

  console.log(code === 0 ? 'success' : 'error');
}
```
