# TypedEventTarget [![NPM](https://img.shields.io/npm/v/typescript-event-target?style=flat-square)](https://npmjs.com/package/typescript-event-target) [![JSR](https://img.shields.io/jsr/v/%40derzade/typescript-event-target?style=flat-square)](https://jsr.io/@derzade/typescript-event-target/) [![Deno](https://img.shields.io/badge/available%20on-deno.land/x-lightgrey.svg?logo=deno&labelColor=black&style=flat-square)](https://deno.land/x/typescript_event_target/) [![License](https://img.shields.io/github/license/derzade/typescript-event-target?style=flat-square)](/LICENSE)

_Strictly typed [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) that directly extends `EventTarget` to function as a drop-in replacement. It works with all Event-Types and accounts for basically no additional bundle-size._

## Motivation

Since `EventTarget` support landed in NodeJS v14.5, they are the only way to go forward, when talking about event driven JS.  
But `EventTarget` lacks in terms of developer experience and Typescript integration. To be specific:

-   No strictly typed event listeners & events
-   Missing proper IntelliSense integration
-   No auto-complete for event types

The weird thing is, that with JS-native objects, which implement `EventTarget` (like WebSocket, Worker or any HTML-Elements), you get all those features out of the box:

<img alt="Visual Studio Code" src="https://user-images.githubusercontent.com/12705416/203958225-7ecf9b96-8004-44d0-b670-8fcb1ae62394.png" style="width: 75%">

**This package aims to** fix these shortcomings and **add all these missing features for custom EventTargets**.

## Installation

### NPM

Install the package:

```
npm i --save typescript-event-target
```

Then import as follows:

```ts
import { TypedEventTarget } from 'typescript-event-target';
```

### Deno

Either install from [JSR](https://jsr.io/@derzade/typescript-event-target/doc/~/TypedEventListenerObject):

```
deno add @derzade/typescript-event-target
```

or import directly form `deno.land/x/`:

```ts
import { TypedEventTarget } from 'https://deno.land/x/typescript_event_target/mod.ts';
```

> :warning: Warning: It is best practice to "pin" to a particular version. `https://deno.land/x/` supports using git tags in the URL to direct you at a particular version. So to use version 1.0.0 of TypedEventTarget, you would want to import `https://deno.land/x/typescript_event_target@v1.0.0/mod.ts`.

## Usage

1. [Basic Example](#basic-example)
1. [Dispatching Events](#dispatching-events)
1. [Extending `TypedEventTarget`](#extending-typedeventtarget)
1. [Different Event Types](#different-event-types)

### Basic Example

```ts
// Step 1: Create an interface, which
// includes all dispatchable events
interface MyEventMap {
    hello: Event;
    time: CustomEvent<number>;
}

// Step 2: Create your TypedEventTarget, with
// the EventMap as the type parameter
const eventTarget = new TypedEventTarget<MyEventMap>();

// Step 3: Strictly typed EventListeners 🎉
eventTarget.addEventListener('time', (event) => {
    // event is of type CustomEvent<number>

    const time = event.detail;

    // time is of type number
});
```

### Dispatching Events

`TypedEventTarget` directly extends `EventTarget`, so [`dispatchEvent`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent) **works as expected**, but is marked as deprecated. The reason for this is that `dispatchEvent` cannot be strictly typed easily. Instead, `TypedEventTarget` introduces a `dispatchTypedEvent` method, which is strictly typed by taking an additional `_type` parameter (just used for type checking).

```ts
interface MyEventMap {
    time: CustomEvent<number>;
}

const eventTarget = new TypedEventTarget<MyEventMap>();

eventTarget.dispatchTypedEvent(
    'time',
    new CustomEvent('time', { detail: Date.now() })
);
```

### Extending `TypedEventTarget`

Instead of directly instantiating `TypedEventTarget`, you can also extend it:

```ts
interface MyEventMap {
    time: CustomEvent<number>;
    // [...]
}

class MyEventTarget extends TypedEventTarget<MyEventMap> {
    /* [...] */
}

const myTarget = new MyEventTarget();
myTarget.addEventListener('time', (e) => {
    /* [...] */
});
```

### Different Event Types

Your EventMap can include [`Event`](https://developer.mozilla.org/en-US/docs/Web/API/Event) as well as any type, that extends [`Event`](https://developer.mozilla.org/en-US/docs/Web/API/Event). These can be native Events or even own classes:

```ts
class MyEvent extends Event {
    /* [...] */
}

class MyEventMap {
    boring: Event;
    custom: CustomEvent<number>;
    mine: MyEvent;
    mouse: MouseEvent;
    keyboard: KeyboardEvent;
}

const eventTarget = new TypedEventTarget<MyEventMap>();

eventTarget.addEventListener('mine', (e) => {
    // e is of type MyEvent
});
```

## Bundle Size

This package mostly only contains TypeScript definitions. Therefore, it amounts up to basically no bundle size. The only thing that is bundled is the `dispatchTypedEvent`-method, which is just a simple wrapper around the native `dispatchEvent`-method.

|           |      Deflate |        Brotli |      Gzip | Uncompressed |
| --------- | -----------: | ------------: | --------: | -----------: |
| ES Module | **92 Bytes** |      95 Bytes | 110 Bytes |    119 Bytes |
| Common JS |    336 Bytes | **308 Bytes** | 354 Bytes |    599 Bytes |
