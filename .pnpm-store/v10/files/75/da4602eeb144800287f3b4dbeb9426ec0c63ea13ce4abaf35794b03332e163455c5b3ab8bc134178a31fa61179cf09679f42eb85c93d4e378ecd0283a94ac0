[![npm version][npm-image]][npm-url]
[![downloads][downloads-image]][npm-url]
[![build status][build-image]][build-url]
[![coverage status][coverage-image]][coverage-url]
[![greenkeeper badge][greenkeeper-image]][greenkeeper-url]
[![Language grade: JavaScript][lgtm-image]][lgtm-url]

# Already

`already` is a set of promise helper functions which many of them are also found in libraries such as Bluebird.

The functions are standalone and depends on no particular Promise implementation and therefore works well for JavaScript's built-in Promise.

The library is written in TypeScript, so typings are provided. Apart from being exported as JavaScript (ES2019), it's also exported as an *ES module*, if imported in platforms (and bundlers) supporting this.


# Versions

 * Since version 2, `Finally` and `Try` are removed. They should be replaced with `Promise.prototype.finally` and async functions.


# Types
  * [PromiseOf\<P\>](#PromiseOf)
  * [PromiseElement\<P\>](#PromiseElement)
  * [EnsurePromise\<P\>](#EnsurePromise)
  * [EnsureNotPromise\<P\>](#EnsureNotPromise)
  * [IfPromise\<P, T, U\>](#IfPromise)
  * [IfNotPromise\<P, T, U\>](#IfNotPromise)

# Functions

  * [concurrent](#concurrent)
      <br>&emsp;Run a function with certain concurrency
  * [delay](#delay)
      <br>&emsp;Create a promise which resolved after a certain time
  * [tap](#tap)
      <br>&emsp;_"Listen"_ to a promise version in a `.then`-chain without modifying the value
  * [props](#props)
      <br>&emsp;`Promise.all` but for objects/properties
  * [filter](#filter)
      <br>&emsp;Asynchronuos version of `Array.prototype.filter`
  * [map](#map)
      <br>&emsp;Asynchronuos version of `Array.prototype.map`
  * [reduce](#reduce)
      <br>&emsp;Asynchronuos version of `Array.prototype.reduce`
  * [each](#each)
      <br>&emsp;Asynchronuos version of `Array.prototype.forEach`
  * [some](#some)
      <br>&emsp;Asynchronuos version of `Array.prototype.some`
  * [once](#once)
      <br>&emsp;Wrap a function and ensure it only runs once (with asynchrony)
  * [retry](#retry)
      <br>&emsp;Asynchronously retry a function call
  * [defer](#defer)
      <br>&emsp;Create a promise and extract its `resolve`/`reject` functions
  * [deferSet](#deferset)
      <br>&emsp;Create a set of deferred promises
  * [reflect](#reflect)
      <br>&emsp;Get a promise's resolved value or rejected error in a success flow
  * [inspect](#inspect)
      <br>&emsp;Inspect a promise. Is it pending? Is it rejected?
  * [specific](#specific)
      <br>&emsp;Catch _specific_ types, like many languages have error type matching in subsequent `catch` statements
  * [rethrow](#rethrow)
      <br>&emsp;Ensure a callback re-throws (to not silently swallow errors)
  * [wrapFunction](#wrapfunction)
      <br>&emsp;Wrap a function with a potentially asynchronous prolog and/or epilog (e.g. init/cleanup)
  * [funnel](#funnel)
      <br>&emsp;Ensure certain parts of a function is executed without concurrency (think asynchrony _barrier_)

---

# Types

## PromiseOf

`PromiseOf< P >` returns the Promise wrapped value of `P`, unless it's already a promise, where the promise itself is returned instead.

  * For `P` (being `Promise< E >`), it returns `P`
    * E.g. `Promise< string >` ⇒ `Promise< string >`
  * For non-promise `E`, it returns `Promise< E >`
    * E.g. `string` ⇒ `Promise< string >`


## PromiseElement

`PromiseElement< P >` returns the element type of a promise, or the type itself if it isn't wrapped in a promise.

  * For `P` (being `Promise< E >`), it returns `E`
    * E.g. `Promise< string >` ⇒ `string`
  * For non-promise `E`, it returns `E`
    * E.g. `string` ⇒ `string`

## EnsurePromise

`EnsurePromise< P >` returns `P` if it is a promise. Otherwise the type is `never`.


## EnsureNotPromise

`EnsureNotPromise< T >` returns `T` if it is **not** a promise. Otherwise the type is `never`.


## IfPromise

`IfPromise< P, T[, U = never] >` returns `T` if `P` is a promise, otherwise returns `U`.


## IfNotPromise

`IfNotPromise< P, T[, U = never] >` returns `U` if `P` is a promise, otherwise returns `T`.


# Functions

## concurrent

Since version 2 of this package, the dependency on `throat` was removed. This function works like throat; it wraps a function with concurrency, returning a new function that can be called repeatedly, but will only call the underlying function with the provided concurrency.

The function takes a concurrency option, and optionally the function to be wrapped. If the second argument isn't passed, the returned function takes a function as first argument. This allows you to run separate functions, yet guarantee a maximum concurrency.

```ts
import { concurrent } from 'already'

// function readSomethingFromDb(): Promise<any>;

const concurrently = concurrent( 3, readSomethingFromDb );

// This will ensure <readSomethingFromDb> isn't called more than 3 times concurrently
const results = await Promise.all(
    listOfIds.map( id => concurrently( id ) )
);
```

or without specifying the function, so that different functions can share concurrency:

```ts
import { concurrent } from 'already'

const concurrently = concurrent( 3 );

const results = await Promise.all(
    listOfThings.map( thing =>
        typeof thing === 'string'
        ? concurrently( readSomethingElse, thing )
        : concurrently( readSomethingFromDb, thing )
    )
);
```


## delay

The standalone `delay` function takes a milliseconds argument and returns a promise which is resolved after that time. An optional value can be given too, resolving in a promise with this future value.

```ts
import { delay } from 'already'

delay( 100 ).then( ( ) => console.log( "100ms has passed" ) )
// or
delay( 100, "foo" ).then( val => console.log( val ) )
```

It can also be used to delay a promise chain **if it is resolved**, using `delayChain`. The delay will be ignored if the upstream promise contains an error.

```ts
import { delayChain } from 'already'

somePromise
.then( delayChain( 100 ) )
```

To always delay a chain, regardless of whether it was resolved or rejected, use `finallyDelay`. **Note the triple dots**, and read more about `Finally` below...

```ts
import { finallyDelay } from 'already'

somePromise
.then( ...finallyDelay( 100 ) )
```


## tap

A similar function to `then` is `tap` which is called only on resolved promises. The callback cannot alter the value flow of the promise, i.e. it cannot have a return value. This is useful for logging/debugging, etc. If it returns a promise, it will be awaited before letting the flow continue down the promise chain.

Note; If the `tap` callback either throws an error, or returns a promise which is rejected, **the flow will continue with this error** and not the upstream value.

```ts
import { tap } from 'already'

somePromise
.then( tap( value => { /* tap handler where the value is available */ } ) )
```

## props

As an alternative to `Promise.all( )` which awaits all promises in an array, `props( )` awaits all properties in an object.

The properties are enumerated and awaited as `Promise.all( )`, so if any of the promises are rejected, the same flow will happen as when calling `Promise.all( )` (i.e. the returned promise will contain the error/errors).

```ts
import { props } from 'already'

props( { a: someValue, b: somePromise } )
.then( ( { a, b } ) => { /* a and b are now values (not promises) */ } )
```

Obviously, `props` can be used in a promise chain, by just refering to the function rather than calling it.

```ts
import { props } from 'already'

Promise.resolve( { a: someValue, b: somePromise } )
.then( props )
.then( ( { a, b } ) => { /* a and b are now values (not promises) */ } )
```


## filter

The `filter` helper can operate on arrays of promises, and will do the same as waiting for all promises in the array and then applying `array.filter( )` on the result. If the filter callback returns a promise, it will be awaited (and expected to eventually become a `boolean`). This eventual value will determine whether to include the value or not in the resulting array.

```ts
import { filter } from 'already'

somePromiseToAnArrayOfPromisesAndValues
.then( filter( item => item.shouldBeIncluded ) )
```

### filter concurrency

By default, the values will be filtered as fast as possible, but sometimes it is preferable to only spawn *n* number of filter callback calls concurrently, e.g. if they perform network/database requests. This can be done by providing an optional object with the `concurrency` property set. This will include awaiting both the upstream values (if the array contains promises) as well as the filter callback results if they are promises. New filter callbacks will not be called if more than *n* promises are being awaited.

```ts
import { filter } from 'already'

somePromiseToAnArrayOfPromisesAndValues
.then( filter( { concurrency: 4 }, item => item.shouldBeIncluded( ) ) )
```

### filter without a promise chain

The `filter` function can be called without a promise chain, and act on an array of values or promises as the first argument.

```ts
import { filter } from 'already'

const outArray = await filter( inArray, filterFun );
// or with custom concurrency:
const outArray = await filter( inArray, { concurrency: 4 }, filterFun );
```

## map

Same as with `filter`, `map` acts like awaiting all promises in an array, and then applying `array.map( )` on the result. Also, just like with `filter`, it will await the resulting promises from the map callback (if they actually are promises).

```ts
import { map } from 'already'

somePromiseToAnArrayOfPromisesAndValues
.then( map( item => JSON.stringify( item ) ) )
```

### map concurrency

Like with `filter`, `map` allows a custom concurrency.

```ts
import { map } from 'already'

somePromiseToAnArrayOfPromisesAndValues
.then( map( { concurrency: 4 }, item => queryDB( item ) ) )
```

### map without a promise chain

The `map` function can be called without a promise chain, just like `filter`.

```ts
import { map } from 'already'

const outArray = await map( inArray, mapFun );
// or with custom concurrency:
const outArray = await map( inArray, { concurrency: 4 }, mapFun );
```


## reduce

Reducing (folding) over an iterable of values or promises is easily done with `reduce( )`. The reducer function can return promises, and they will be awaited before continuing with the next value.

The mechanism for this follows the reasoning behind Bluebird's [`reduce`](http://bluebirdjs.com/docs/api/promise.reduce.html) in how the initial value is handled, and the last argument in the reducer function being a number, not an array.

```ts
import { reduce } from 'already'

somePromiseToAnArray
.then( reduce( reducerFn[, initialValue ] ) )

// or on an array

reduce( arrayOrIterable, reducerFn[, initialValue ] )
```

If called within a promise chain (as the first example above), the `reduce` takes one or two arguments, a reducer function and an optional initial value.

If called outside a promise chain, it also takes the array (or any other iterable, or promise to any such) as the first argument.

The reducer function is on the format

```ts
reduce( accumulator: R, current: T, index: number, length: number ) => R | PromiseLike< R >;
```

The `accumulator` has the same type as the return value (although the return can be asynchronous), which is the *reduced* type `R`. The `current` is of type `T`, which is what the input array consists of (although it may consist of `PromiseLike< T >` too).

This means that the returned type from `reduce` doesn't need to be the same as the input, although **this is only true if `initialValue` is set**. If it is set, it will be used as the first `accumulator`, and `index` will begin at `0`. If `initialValue` is left unset (or is `undefined`), `R` and `T` must be the same, and  `index` will begin at `1`, since the first call will use the first index in the input as `accumulator` and the second as `current`.

`length` is the length of the input iterable/array, which is the same logic as in Bluebird, and **unlike** how Javascript's `Array.reduce` works (where you get the *array* as fourth argument).


## each

`each` iterates an array of promises or values, very much like `map`, although always serially as if `concurrency` was set to `1`.

The iterator function cannot return a value (or it will be ignored), but can return an empty promise which will be awaited before the next iteration. It's like `tap` but for elements in an array.

The return value of `each` is the input array unmodified.

If any of the iterator function calls throws an exception, or returns a rejected promise, the iteration will end and the return of `each` will be a promise rejected with this error.

```ts
import { each } from 'already'

somePromiseToAnArrayOfPromisesAndValues
.then( each( item => { doSomethingWith( item ); } ) )
.then( /* input array is here and unmodified */ )

// or provide the array as first argument:

const outArray = await each( inArray, iteratorFun );
// outArray ~ inArray, not necessarily the *same* array, but the same content
```


## some

Just like filter, map and reduce which here are implemented closely mimicing the Array prototype functions but supporting asynchrony, `some` works similar to [`Array.some()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/some). The return is different though, in that it doesn't necessarily return a promise to `true` or `false`, but rather a promise of the *truthy* value (of type `T`) or `false`.

The return type not being coerced to `true` upon match, makes it ideal in situations where `reduce` would otherwise be used only to find the first match. `some` may perform better, since it stops iterating on first match, while `reduce` would complete the iteration before it returns.

Like `filter`, `map` and `reduce` above, it supports a promise to a list, promises as values in the list, and an asynchronous predicate function.

```ts
import { some } from 'already'

somePromiseToAnArray
.then( some( predicateFn ) )
.then( ( t: T | false ) => { ... } ) // T is the return type of predicateFn

// or on an array

const t = await some( arrayOrIterable, predicateFn );
// t is of type T (the return type of predicateFn) or false
```

### Example

```ts
import { some } from 'already'

const arr = [ 1, 2, 3 ];

async function pred( num: number ): Promise< string >
{
    // ... Implementation goes here
}

const val = await some( arr, pred );
// val is now either a string (the first truthy match) or false
```


## once

To ensure a function is only called once, use `once()`. It handles both synchronous and asynchronous functions, in that you can await the wrapped function call. It will return the value returned from the wrapped function, every time the wrapper is called. It also comes in two shapes:

```ts
import { once } from 'already'

// Single function
const once1 = once( myFunction ); // Wrap a function
const ret1 = once1( ); // Will invoke myFunction
const ret2 = once1( ); // Will do nothing
// ret1 === ret2

// Multiple functions
const once2 = once( ); // Make dynamic wrapper
once2( myFunction1 ); // Will invoke myFunction1
once2( myFunction2 ); // Will invoke myFunction2
once2( myFunction1 ); // Will do nothing
once2( myFunction2 ); // Will do nothing
```

The dynamic approach is achieved by calling `once( )` without arguments. The result wrapper can be called with different functions, and every unique function will only be invoked once.

If the functions are asynchronous, just await the wrapper call:

```ts
// Single function
const once1 = once( myFunction ); // Wrap a function
await once1( ); // Will invoke myFunction
await once1( ); // Will do nothing

// Multiple functions
const once2 = once( ); // Make dynamic wrapper
await once2( myFunction1 ); // Will invoke myFunction1
await once2( myFunction2 ); // Will invoke myFunction2
await once2( myFunction1 ); // Will do nothing
await once2( myFunction2 ); // Will do nothing
```

Even if the functions are invoked immediately after each other, they won't be invoked twice, but they will all wait for the wrapped function to complete:

```ts
async function myFunction( ) { ... }
const once1 = once( myFunction );
const promise = once1( ); // Will invoke myFunction
await once1( ); // Will not invoke myFunction, but await its completion!
```

You can pass an argument to the function if it takes one. It will still only call the function once, regardless of the argument (unlike memoize functions):

```ts
const once1 = once( ( n: number ) => n * 3 ); // Wrap a function
12 === await once1( 4 ); // Will invoke myFunction
12 === await once1( 5 ); // Will do nothing (but return the old value)
```


## retry

The `retry( )` function can be used to call a function and "retry" (call it again) if it threw an exception, or returned a rejected promise.

The `retry( times, fn [, retryable ] )` function takes a number for maximum number of retries as first argument, and the function to call as the second argument. If `times` is 1, it will **retry** once, i.e. potentially calling `fn` two times.

The return value of `retry` is the same as that of `fn` as it will return the result of a *successful* call to `fn( )`.

The function is transparently handling callback functions (`fn`) returning *values* or *promises*.

The third and optional argument is a predicate function taking the error thrown/rejected from `fn`. It should return `true` if the error is *retryable*, and `false` if the error is not retryable and should propagate out of `retry` immediately.

Synchronous example:

```ts
function tryOpenFileSync( ) { /* ... */ } // Might throw

// Only retry ENOENT errors
const fd = retry(
    Infinity,
    tryOpenFileSync,
    err => err.code === 'ENOENT'
);
```

Asynchronous example:

```ts
async function sendMessage( ) { /* ... */ } // Might return a rejected promise

// Try sending 3 times. NOTE: await
const anything = await retry( 3, sendMessage );
```


## defer

The `defer` function template returns an object containing both a promise and its resolve/reject functions. This is generally an anti-pattern, and `new Promise( ... )` should be preferred, but this is sometimes necessary (or at least very useful).

```ts
import { defer } from 'already'

const deferred = defer< string >( );
deferred.promise; // The promise.
deferred.resolve; // The resolve function.
deferred.reject;  // The reject function.

deferred.resolve( "foo" ); // deferred.promise is now resolved to "foo"
```

### Empty defer

To create a defer object backed by a `Promise< void >`, creating it through `defer< void >( )` will not suffice. The returned object's `resolve` function will require an argument. Instead, create with an explicit void argument:

```ts
const deferred = defer( void 0 );
deferred.resolve( ); // This is now legal, typewise
```


## deferSet

Instead of creating a lot of defer objects, e.g. in unit tests to trigger asynchrony in a certain order, `deferSet` is a cleaner way.

A *"defer set"* is a dynamically growable set of indexes (numbers) which can be awaited, resolved or rejected at any time.

`deferSet( )` returns an object (of a class `OrderedAsynchrony`). This has the helper functions:

 * `wait( index | [indices...] ) -> Promise< void >`
 * `resolve( index | [indices...] ) -> Promise< void >`
 * `reject( index | [indices...] ) -> Promise< void >`

```ts
import { deferSet } from 'already'

const order = deferSet( );

order.resolve( 0 ); // Resolve index 0
await order.wait( 0 ); // Wait for promise 0 (which was resolved above)
```

The above will work fine, it's basically creating a `defer`, resolving it and then awaiting its promise. This will deadlock:

```ts
await order.wait( 0 ); // Will wait forever
order.resolve( 0 );
```

It's possible to wait, resolve and reject multiple indices at once, by specifying an array instead. And `wait` can take an optional index (or array of indices) to resolve, as well as an optional index (or array of indices) to reject.

The return value of `wait( )`, `resolve( )` and `reject( )` is a promise *and* the defer set itself.

```ts
// Do stuff, and eventually trigger certain index resolutions.
doFoo( ).then( ( ) => { order.resolve( 0 ); } ); // Eventually resolves index 0
doBar( ).then( ( ) => { order.resolve( [ 1, 3 ] ); } ); // Eventually resolves index 1 and 3
// etc.

await order.wait( [ 0, 1, 3 ], 2 ); // Await index 0, 1 and 3, resolve index 2.
order.reject( 4 ); // Will reject index 4 with an error.
await order.wait( 4 ); // Will (asynchronously) throw.
```


## reflect

A promise can be either resolved or rejected, but sometimes it's convenient to have a shared flow for either occasion. That's when `reflect` comes in handy. It takes a promise as argument, and returns a promise to a `Reflection` object which contains the *value* **or** *error*, and the booleans `isResolved` and `isRejected`.

```ts
import { reflect } from 'already'

const somePromise = Math.random( ) < 0.5
    ? Promise.resolve( 1 )
    : Promise.reject( new Error( ) );

const reflection = await reflect( somePromise );
const { value, error, isResolved, isRejected } = reflection;

if ( isResolved )
    doSomethingWithValue( value );
else
    handleError( error );
```


## inspect

In some cases is it useful to synchronously know if a promise is pending, resolved or rejected. Some promise libraries provide this on the promise as `isPending( )` functions e.g.

With `already`, wrap the promise in an *InspectablePromise* using the `inspect( )` function.

```ts
import { inspect } from 'already'

const inspectable = inspect( somePromise );
inspectable.promise    // <Promise> A new promise, chained from `somePromise`
inspectable.isPending  // <boolean>
inspectable.isResolved // <boolean>
inspectable.isRejected // <boolean>
```

**Note;** The returned object's promise must be used in the rest of the application, rather than the upstream promise (the one given as argument to `inspect`). It is technically not the same promise, and a rejection will otherwise likely result in an "Unhandled promise rejection" warning, or worse.

**Note;** The returned object will always be in *pending-mode* when the function returns, i.e. `isPending` will be `true` and `isResolved` and `isRejected` will both be `false`. Only after the next tick will these values have been settled. To ensure the right value "immediately", `await` the inspect return, to allow the value to settle:

```ts
import { inspect } from 'already'

const inspectable = await inspect( somePromise );
// inspectable.is{Pending|Resolved|Rejected} are now settled
```


## deferInspectable

A combination of `defer` and `inspect` is sometimes useful, where `deferInspectable` comes in handy.

```ts
import { deferInspectable } from 'already'

const deferred = deferInspectable< T >( );
deferred.promise    // The promise.
deferred.resolve;   // The resolve function.
deferred.reject;    // The reject function.
deferred.isPending  // <boolean>
deferred.isResolved // <boolean>
deferred.isRejected // <boolean>
```

For promises of `void` type, in TypeScript create it with `deferInspectable( void 0 )`.

Unlike `inspect`, the values are immediately correct, no `await` is necessary to settle the values. Also, when `resolve()` and `reject()` are called, the `is*` booleans are synchronously set.


## specific

The `specific` function can be used in a `.catch( ... )` handler to filter the catch for specific errors only. Its logic is taken from Bluebird's [`catch`](http://bluebirdjs.com/docs/api/catch.html).

The syntax is

```ts
specific( filter | [ filters ], handlerFn )
```

where the `filter` (or an array of such) is either an error constructor, a predicate function or an object, and `handlerFn` is the error handler.

Error constructors are checked with `instanceof`, predicate functions get the error object and must return `true` or `false`, and custom objects are shallowly checked key-by-key for `==` match. If the predicate function throws, the promise chain will contain this error.

```ts
import { specific } from 'already'

somePromise
.catch( specific( MyError, err => { /* handler */ } ) )
.catch( specific( isHttpClientError, err => { /* handler */ } ) )
.catch( specific( { minorIssue: true }, err => { /* handler */ } ) )
.catch( err => { /* any other error, OR if the above error handlers threw */ } )
```


## rethrow

Another `catch` helper is `rethrow` which allows a function to be called as an error handler, but ensures it rethrows the upstream error.
Note; if the callback function throws an error, or returns a rejected promise, this error will flow through rather than the upstream error.

The callback can either return nothing (synchronously) or an empty promise, which will be awaited before continuing with rethrowing.

The callback will get the error as argument.

```ts
import { rethrow } from 'already'

somePromise
.catch( rethrow( err => { /* handler */ } ) )
// the promise is still rejected
```

or, combined with `specific`:

```ts
import { specific, rethrow } from 'already'

somePromise
.catch( specific( MyError, rethrow( err => { /* handler */ } ) ) )
.catch( err => { /* handler */ } ) // will always be called, if somePromise was rejected
```


## wrapFunction

In many cases, wrapping a function with custom 'before' and 'after' hooks is useful, e.g. in unit tests. When working with asynchronous code, this may sound easier than it really is, especially in a type safe manner. The 'before' handler, the wrapped function and the 'after' handler can all be either synchronous or asynchronous, and the returned (wrapped) function should reflect this and be synchronous if possible, otherwise asynchronous.

`wrapFunction` takes a 'before' handler (a function) which is supposed to return an 'after' handler. It returns a new function which takes the target function as argument and performs the invocation by 1) calling the 'before' function, 2) calling the target function and 3) calling the 'after' function (returned by the 'before' function)

```ts
import { wrapFunction } from 'already'

const wrapFactory = wrapFunction(
    ( ) =>
    {
        // Do stuff before
        console.log( "before" );
        // ...

        return ( ) =>
        {
            // Do stuff after, e.g. clean up
            console.log( "after" );
        }
    }
);

function aUsefulFunction( )
{
    // Imagine this function to be useful, and we want to wrap it
    console.log( "useful" );
    return "yo";
}

// Call aUsefulFunction but wrap the call
const ret = wrapFactory( aUsefulFunction );

expect( ret ).to.equal( "yo" );

// Console output:
// before
// useful
// after
```

The before handler can also take an optional argument, which then must be provided when invoking the wrapper.

```ts
const wrapFactory = wrapFunction(
    ( hookData: string ) =>
    {
        // Do stuff before
        console.log( hookData );
        // ...

        return ( ) =>
        {
            // Do stuff after, e.g. clean up
            console.log( "after" );
        }
    }
);

function aUsefulFunction( )
{
    // Imagine this function to be useful, and we want to wrap it
    console.log( "useful" );
    return "yo";
}

// Call aUsefulFunction but wrap the call
const ret = wrapFactory( "before", aUsefulFunction );

expect( ret ).to.equal( "yo" );

// Console output:
// before
// useful
// after
```

And all three functions can be synchronous or asynchronous, e.g.

```ts
const wrapFactory = wrapFunction(
    async ( hookData: string ) =>
    {
        // Do stuff before
        console.log( hookData );
        // ...

        return ( ) =>
        {
            // Do stuff after, e.g. clean up
            console.log( "after" );
        }
    }
);

function aUsefulFunction( )
{
    // Imagine this function to be useful, and we want to wrap it
    console.log( "useful" );
    return "yo";
}

// Call aUsefulFunction but wrap the call
const ret = await wrapFactory( "before", aUsefulFunction );

expect( ret ).to.equal( "yo" );

// Console output:
// before
// useful
// after
```


## funnel

Ensuring exclusive calls to a function can be implemented in multiple ways. With asynchrony, this gets quite complicated.

Many problems can be generalized to only running one function at a time (awaiting it if necessary). For this, the [`throat`](https://www.npmjs.com/package/throat) package is useful (it is used by `already`). Sometimes a more fine grained control is desired, such as allowing a _test and early return_ as well as signalling that the concurrent logic is complete (to allow the next function call) before the whole function is complete. This results in a more understandable flow.

For this, `funnel()` is extremely handy.

Consider the following example

```ts
async function getConnection( )
{
    const conn = await getReusableConnection( );
    if ( conn ) // We have a re-usable connection or will wait for one to be free
        return conn;

    // We can create (at least) 1 more connection, but maybe only 1
    const newConn = await connect( );
    registerToConnectionPool( newConn ); // This is now re-usable
    return newConn;
}
```

The above is a connection pool, we might only want a certain number of connections. In this simple example, we can make a counter and check its value, but sometimes the counter isn't static, sometimes asynchronous "questions" must be asked in order to know whether to proceed or not.

Is the above code safe? It isn't. Two synchronously immediate calls to `getConnection` will likely get the same answer from `getReusableConnection`, i.e. *falsy*. This means, they'll both call `connect`, although maybe just one should have done so. Only one should have created a connection, then `registerToConnectionPool` while the other should wait until the first is complete, then retry `getConnection` from scratch to see if a connection can be re-used.

The `getConnection` could be wrapped inside a [`throat`](https://www.npmjs.com/package/throat) wrapper, but that wouldn't be as performant as possible. Consider two calls to `getConnection` when there are connections in the pool, but none is free. One of the two calls should create a new connection, but while this takes place (which may take time), another might be freed. This newly freed connection should be re-usable by the second call to `getConnection`.

`funnel` makes this trivial. Wrap the `getConnection` logic in a funnel. Allow concurrent access to `getReusableConnection` which is concurrency _safe_. Then create a _synchronization barrier_ (using `shouldRetry`/`retry`):

```ts
import { funnel } from "already";

const connectionFunnel = funnel< Connection >( );
// Or if pure JavaScript, just:
// const connectionFunnel = funnel( );

async function getConnection( )
{
    return connectionFunnel( async ( shouldRetry, retry ) =>
    {
        const conn = await getReusableConnection( );
        if ( conn ) // We have a re-usable connection or will wait for one to be free
            return conn;

        if ( shouldRetry( ) ) // <-- this and
            return retry( );  // <-- this, is the key

        // We can create (at least) 1 more connection, but maybe only 1
        const newConn = await connect( );
        registerToConnectionPool( newConn ); // This is now re-usable
        return newConn;
    } );
}
```

When creating a funnel, an options object can be provided with two options:

 * `onEmpty` [`callback`]: will be called when the last concurrent task has finished. This can be used for cleanup. Note; This can be called multiple times, it will be called when there is no pending/waiting tasks anymore.
 * `concurrency` [`number`]: Specifies how many concurrent tasks to allow before `shouldRetry` returns `true`. (Defaults to `1`).

The callback function to the funnel can take a third argument after `shouldRetry` and `retry`, which is a function called `shortcut`. This can be used to signal that the function is complete (in terms of synchronization) earlier than when its returned promise is resolved:

```ts
import { funnel } from "already";

const onEmpty = ( ) => console.log( "Concurrent tasks finished" );
const connectionFunnel = funnel( { onEmpty } );

async function getConnection( )
{
    return connectionFunnel( async ( shouldRetry, retry, shortcut ) =>
    {
        // Before shouldRetry there is no synchronization, this can be called
        // concurrently.
        const conn = await getReusableConnection( );
        if ( conn )
            return conn;

        if ( shouldRetry( ) )
            return retry( );

        // Synchronization begins
        const newConn = await connect( );
        registerToConnectionPool( newConn );
        // Synchronization ends
        shortcut( ); // This will signal that synchronization is complete,
                     // let concurrent tasks (if any) retry immediately.
        return decorateConnection( newConn ); // Maybe (asynchronously) slow
    } );
}
```


[npm-image]: https://img.shields.io/npm/v/already.svg
[npm-url]: https://npmjs.org/package/already
[downloads-image]: https://img.shields.io/npm/dm/already.svg
[build-image]: https://img.shields.io/github/workflow/status/grantila/already/Master.svg
[build-url]: https://github.com/grantila/already/actions?query=workflow%3AMaster
[coverage-image]: https://coveralls.io/repos/github/grantila/already/badge.svg?branch=master
[coverage-url]: https://coveralls.io/github/grantila/already?branch=master
[greenkeeper-image]: https://badges.greenkeeper.io/grantila/already.svg
[greenkeeper-url]: https://greenkeeper.io/
[lgtm-image]: https://img.shields.io/lgtm/grade/javascript/g/grantila/already.svg?logo=lgtm&logoWidth=18
[lgtm-url]: https://lgtm.com/projects/g/grantila/already/context:javascript
