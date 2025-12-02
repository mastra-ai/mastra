# WhenExit

Execute a function right before the process, or the browser's tab, is about to exit.

## Install

```sh
npm install when-exit
```

## Usage

```ts
import whenExit from 'when-exit';

// Registering multiple callbacks

onExit ( () => {
  console.log ( 'Callback 1' );
});

onExit ( () => {
  console.log ( 'Callback 2' );
});

// Registering and disposing a callback

const disposer = onExit ( () => {
  console.log ( 'Callback 3' );
});

disposer ();

// Triggering the process to exit

process.exit (); // Callback 1 and 2 are called before exiting
```

## License

MIT © Fabio Spampinato
