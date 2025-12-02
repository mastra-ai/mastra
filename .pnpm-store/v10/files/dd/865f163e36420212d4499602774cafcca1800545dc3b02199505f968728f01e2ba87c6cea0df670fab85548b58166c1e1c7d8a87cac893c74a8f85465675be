# Typed-Emitter

[![NPM Version](https://img.shields.io/npm/v/typed-emitter.svg)](https://www.npmjs.com/package/typed-emitter)

Strictly typed event emitter interface for TypeScript.

Code size: Zero bytes - Just the typings, no implementation. Use the default event emitter of the `events` module in node.js or bring your favorite implementation when writing code for the browser.


## Installation

```sh
$ npm install --save-dev typed-emitter

# Using yarn:
$ yarn add --dev typed-emitter
```


## Usage

```ts
import EventEmitter from "events"
import TypedEmitter from "typed-emitter"

// Define your emitter's types like that:
// Key: Event name; Value: Listener function signature
type MessageEvents = {
  error: (error: Error) => void,
  message: (body: string, from: string) => void
}

const messageEmitter = new EventEmitter() as TypedEmitter<MessageEvents>

// Good 👍
messageEmitter.emit("message", "Hi there!", "no-reply@test.com")

// TypeScript will catch those mistakes ✋
messageEmitter.emit("mail", "Hi there!", "no-reply@test.com")
messageEmitter.emit("message", "Hi there!", true)

// Good 👍
messageEmitter.on("error", (error: Error) => { /* ... */ })

// TypeScript will catch those mistakes ✋
messageEmitter.on("error", (error: string) => { /* ... */ })
messageEmitter.on("failure", (error: Error) => { /* ... */ })
```

## Extending an emitter

You might find yourself in a situation where you need to extend an event emitter, but also want to strictly type its events. Here is how to.

```ts
class MyEventEmitter extends (EventEmitter as new () => TypedEmitter<MyEvents>) {
  // ...
}
```

As a generic class:

```ts
class MyEventEmitter<T> extends (EventEmitter as { new<T>(): TypedEmitter<T> })<T> {
  // ...
}
```

## RxJS `fromEvent` types inference

The default `fromEvent` from RxJS will return an `Observable<unknown>` for our typed emitter.

This can be fixed by the following code, by replacing the `fromEvent` type with our enhanced one: `FromEvent`:

```ts
import { fromEvent as rxFromEvent } from "rxjs"
import { default as TypedEmitter, FromEvent } from "typed-emitter/rxjs"

// The `Observable` typing can be correctly inferenced
const fromEvent = rxFromEvent as FromEvent
```

Learn more from [rxjs fromEvent compatibility #9](https://github.com/andywer/typed-emitter/issues/9)
for the `fromEvent` compatibility discussions.

## Why another package?

The interface that comes with `@types/node` is not type-safe at all. It does not even offer a way of specifying the events that the emitter will emit...

The `eventemitter3` package is a popular event emitter implementation that comes with TypeScript types out of the box. Unfortunately there is no way to declare the event arguments that the listeners have to expect.

There were a few other examples of type-safe event emitter interfaces out there as well. They were either not published to npm, had an inconsistent interface or other limitations.

## License

MIT
