# Stoppable

[![Build Status](https://travis-ci.org/hunterloftis/stoppable.svg?branch=master)](https://travis-ci.org/hunterloftis/stoppable)

> Node's `server.close()` the way you probably [expected it to work by default](https://github.com/nodejs/node/issues/2642).

## Summary

```js
const server = stoppable(http.createServer(handler))
server.stop()
```

Stoppable stops accepting new connections and closes existing, idle connections (including keep-alives)
without killing requests that are in-flight.

## Requirements

- Node.js v6+

Node.js v4.x is *unofficially* supported.

## Installation

```bash
yarn add stoppable
```

(or use npm)

## Usage

**constructor**

```js
stoppable(server, grace)
```

Decorates the server instance with a `stop` method.
Returns the server instance, so can be chained, or can be run as a standalone statement.

- server: Any HTTP or HTTPS Server instance
- grace: Milliseconds to wait before force-closing connections

`grace` defaults to Infinity (don't force-close).
If you want to immediately kill all sockets you can use a grace of 0.

**stop()**

```js
server.stop(callback)
```

Closes the server.

- callback: passed along to the existing `server.close` function to auto-register a 'close' event.
The first agrument is an error, and the second argument is a boolean that indicates whether it stopped gracefully.

## Design decisions

- Monkey patching generally sucks, but in this case it's the nicest API. Let's call it "decorating."
- `grace` could be specified on `stop`, but it's better to match the existing `server.close` API.
- Clients should be handled respectfully, so we aren't just destroying sockets, we're sending `FIN` packets first.
- Any solution to this problem requires bookkeeping on every connection and request/response.
We're doing a minimum of work on these "hot" code paths and delaying as much as possible to the actual `stop` method.

## Performance

There's no way to provide this functionality without bookkeeping on connection, disconnection, request, and response.
However, Stoppable strives to do minimal work in hot code paths and to use optimal data structures.

I'd be interested to see real-world performance benchmarks;
the simple loopback artillery benchmark included in the lib shows very little overhead from using a stoppable server:

### Without Stoppable

```plain
  Scenarios launched:  10000
  Scenarios completed: 10000
  Requests completed:  10000
  RPS sent: 939.85
  Request latency:
    min: 0.5
    max: 51.3
    median: 2.1
    p95: 3.7
    p99: 15.3
  Scenario duration:
    min: 1
    max: 60.7
    median: 3.6
    p95: 7.6
    p99: 19
  Scenario counts:
    0: 10000 (100%)
  Codes:
    200: 10000
```

### With Stoppable

```plain
  Scenarios launched:  10000
  Scenarios completed: 10000
  Requests completed:  10000
  RPS sent: 940.73
  Request latency:
    min: 0.5
    max: 43.4
    median: 2.1
    p95: 3.8
    p99: 15.5
  Scenario duration:
    min: 1.1
    max: 57
    median: 3.7
    p95: 8
    p99: 19.4
  Scenario counts:
    0: 10000 (100%)
  Codes:
    200: 10000
```

## License

MIT