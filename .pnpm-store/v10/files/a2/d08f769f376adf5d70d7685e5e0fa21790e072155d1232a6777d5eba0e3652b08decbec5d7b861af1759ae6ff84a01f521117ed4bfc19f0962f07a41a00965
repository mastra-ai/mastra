[![npm version][npm-image]][npm-url]
[![downloads][downloads-image]][npm-url]
[![build status][travis-image]][travis-url]
[![coverage status][coverage-image]][coverage-url]

# Your callback exception guard

## Rationale

When using API's with callback support, the 3rd party module will call your function. Most of Node.js' asynchronous functions work like this. If you unintentionally throw an exception there, you won't know what happens - what is that module supposed to do?

Promises are a solution to this, as they propagate the error back to you transparently through the *promise chain*, but arbitrary callbacks lack this defined flow.

There are other situations where callbacks are used, and where promises won't automatically solve the handling of exceptions.

To ensure you don't throw back in a callback, guard your callback function with either `syncGuard` or `asyncGuard`.


# Usage


## Import

```ts
import { syncGuard, asyncGuard } from 'callguard'
// or
const { syncGuard, asyncGuard } = require( 'callguard' );
```


## API

`callguard` exports two functions, `syncGuard` and `asyncGuard`. The former **guards** against synchronous exceptions (but can catch asynchronous too), while the latter **guard** against both.

For callbacks that either expect no particular return value, or a synchronous value, use `syncGuard` (optionally enable `catchAsync`), and for callbacks that are allowed (and expected) to returned synchronously **or** asynchronously (through promises), use `asyncGuard`.

Create the guards using these functions and provide an error handler (and optionally options).

```ts
const sGuard = syncGuard( errorHandler[, options ] ); // synchronous guard
const aGuard = asyncGuard( errorHandler[, options ] ); // asynchronous guard
```

The returned values are function wrappers that takes a function as input, and returns a new one as output. The returned functions are safe in that they will not throw. Asynchronously guarded functions will not returned rejected promises either. The guards can be re-used as many times as necessary, both the wrapped functions, as well as the wrapper generators (`sGuard` and `aGuard` in this example). They are all stateless.

```ts
fs.open( 'file', 'r', sGuard( myCallback ) );
// and for asynchronous calls:
translateThing( thing, aGuard( myAsyncTranslator ) );
```

By default, the value returned from guarded functions when an error was detected, is `null`. This can be altered using the `defaultReturn` option.

When debugging an unwanted exception (caught by these guards), it may be hard to know where it came from. To get longer stack traces from the guards construction, usage and call, enable `longStackTraces`. This has a severe performance impact (even in success-flow where no exceptions are thrown!), so you probably only want this when debugging.

These are the function signatures and the default options:

```ts
syncGuard(
    errorHandler,
    {
        defaultReturn: null,
        longStackTraces: false,
        catchAsync: false,
    }
);

asyncGuard(
    errorHandler,
    {
        defaultReturn: null,
        longStackTraces: false,
    }
);
```


## Example

Consider the following unsafe code. What if `doSomethingWithFd` throws? Maybe this logic is within another module we don't have control over...

```ts
fs.open( 'my-file', 'r', ( err, fd ) =>
{
    // We REALLY don't want to throw here
    doSomethingWithFd( fd ); // Please don't throw!
});
```

Turn it into:

```ts
// Create a synchronous guard, forward exceptions to console.error.
// This is just an example, you might want other logic.
const guard = syncGuard( console.error.bind( console ) );

fs.open( 'my-file', 'r', guard( ( err, fd ) =>
{
    // We really shouldn't throw here, it is not logically sound
    doSomethingWithFd( fd ); // But it's guarded anyway, so we're safe
} ) );
```

Now, if `doSomethingWithFd` would throw, this wouldn't propagate to the `fs.open` function, but instead be printed to the console.


## Promisification

One typical example is when using promises in a codebase, but needing to react to callbacks. In this case, it would often be a bug to throw in the callback, and if this is wrapped in a `new Promise( )` function body, the promise can easily be canceled while the callback remains exception safe.

NOTE; It will probably be expected that the promise can be rejected, but only because `otherLib` fails/throws, not that the logic *here* throws (that's a handling error). `callguard` will not *fix* such bugs in your code, but **it will** ensure you can **safely handle it** in the promise chain.

```ts
const p = new Promise( ( resolve, reject ) =>
{
    // Map mistakes in throwing back at <otherLib> to this promise rejection
    const guard = syncGuard( reject );

    otherLib.on( 'data', guard( data =>
    {
        // We can handle data here, and if we throw, it will reject <p>
        doStuffWithData( data ); // This is safe
    } ) );

    otherLib.on( 'end', guard( ( ) =>
    {
        // Also safe callback, also guarded.
        // If assembleData throws, the promise will be rejected.
        resolve( assembleData( ) ); // This is safe
    } ) );

    otherLib.on( 'error', reject ); // Not everything must be guarded
} );
```

[npm-image]: https://img.shields.io/npm/v/callguard.svg
[npm-url]: https://npmjs.org/package/callguard
[downloads-image]: https://img.shields.io/npm/dm/callguard.svg
[travis-image]: https://img.shields.io/travis/grantila/callguard.svg
[travis-url]: https://travis-ci.org/grantila/callguard
[coverage-image]: https://coveralls.io/repos/github/grantila/callguard/badge.svg?branch=master
[coverage-url]: https://coveralls.io/github/grantila/callguard?branch=master
