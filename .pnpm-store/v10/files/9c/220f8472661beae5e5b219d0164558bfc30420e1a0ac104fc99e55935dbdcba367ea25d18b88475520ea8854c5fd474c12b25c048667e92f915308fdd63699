# Node-Redis

[![Tests](https://img.shields.io/github/actions/workflow/status/redis/node-redis/tests.yml?branch=master)](https://github.com/redis/node-redis/actions/workflows/tests.yml)
[![Coverage](https://codecov.io/gh/redis/node-redis/branch/master/graph/badge.svg?token=xcfqHhJC37)](https://codecov.io/gh/redis/node-redis)
[![License](https://img.shields.io/github/license/redis/node-redis.svg)](https://github.com/redis/node-redis/blob/master/LICENSE)

[![Discord](https://img.shields.io/discord/697882427875393627.svg?style=social&logo=discord)](https://discord.gg/redis)
[![Twitch](https://img.shields.io/twitch/status/redisinc?style=social)](https://www.twitch.tv/redisinc)
[![YouTube](https://img.shields.io/youtube/channel/views/UCD78lHSwYqMlyetR0_P4Vig?style=social)](https://www.youtube.com/redisinc)
[![Twitter](https://img.shields.io/twitter/follow/redisinc?style=social)](https://twitter.com/redisinc)

node-redis is a modern, high performance [Redis](https://redis.io) client for Node.js.

## How do I Redis?

[Learn for free at Redis University](https://university.redis.com/)

[Build faster with the Redis Launchpad](https://launchpad.redis.com/)

[Try the Redis Cloud](https://redis.com/try-free/)

[Dive in developer tutorials](https://developer.redis.com/)

[Join the Redis community](https://redis.com/community/)

[Work at Redis](https://redis.com/company/careers/jobs/)

## Installation

Start a redis via docker:

```bash
docker run -p 6379:6379 -d redis:8.0-rc1
```

To install node-redis, simply:

```bash
npm install redis
```
> "redis" is the "whole in one" package that includes all the other packages. If you only need a subset of the commands,
> you can install the individual packages. See the list below.

## Packages

| Name                                           | Description                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`redis`](https://github.com/redis/node-redis/tree/master/packages/redis)                    | The client with all the ["redis-stack"](https://github.com/redis-stack/redis-stack) modules |
| [`@redis/client`](https://github.com/redis/node-redis/tree/master/packages/client)           | The base clients (i.e `RedisClient`, `RedisCluster`, etc.)                                  |
| [`@redis/bloom`](https://github.com/redis/node-redis/tree/master/packages/bloom)             | [Redis Bloom](https://redis.io/docs/data-types/probabilistic/) commands                     |
| [`@redis/json`](https://github.com/redis/node-redis/tree/master/packages/json)               | [Redis JSON](https://redis.io/docs/data-types/json/) commands                               |
| [`@redis/search`](https://github.com/redis/node-redis/tree/master/packages/search)           | [RediSearch](https://redis.io/docs/interact/search-and-query/) commands                     |
| [`@redis/time-series`](https://github.com/redis/node-redis/tree/master/packages/time-series) | [Redis Time-Series](https://redis.io/docs/data-types/timeseries/) commands                  |
| [`@redis/entraid`](https://github.com/redis/node-redis/tree/master/packages/entraid)         | Secure token-based authentication for Redis clients using Microsoft Entra ID                |

> Looking for a high-level library to handle object mapping?
> See [redis-om-node](https://github.com/redis/redis-om-node)!


## Usage

### Basic Example

```typescript
import { createClient } from "redis";

const client = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();

await client.set("key", "value");
const value = await client.get("key");
client.destroy();
```

The above code connects to localhost on port 6379. To connect to a different host or port, use a connection string in
the format `redis[s]://[[username][:password]@][host][:port][/db-number]`:

```typescript
createClient({
  url: "redis://alice:foobared@awesome.redis.server:6380",
});
```

You can also use discrete parameters, UNIX sockets, and even TLS to connect. Details can be found in
the [client configuration guide](https://github.com/redis/node-redis/blob/master/docs/client-configuration.md).

To check if the the client is connected and ready to send commands, use `client.isReady` which returns a boolean.
`client.isOpen` is also available. This returns `true` when the client's underlying socket is open, and `false` when it
isn't (for example when the client is still connecting or reconnecting after a network error).

### Redis Commands

There is built-in support for all of the [out-of-the-box Redis commands](https://redis.io/commands). They are exposed
using the raw Redis command names (`HSET`, `HGETALL`, etc.) and a friendlier camel-cased version (`hSet`, `hGetAll`,
etc.):

```typescript
// raw Redis commands
await client.HSET("key", "field", "value");
await client.HGETALL("key");

// friendly JavaScript commands
await client.hSet("key", "field", "value");
await client.hGetAll("key");
```

Modifiers to commands are specified using a JavaScript object:

```typescript
await client.set("key", "value", {
  EX: 10,
  NX: true,
});
```

Replies will be transformed into useful data structures:

```typescript
await client.hGetAll("key"); // { field1: 'value1', field2: 'value2' }
await client.hVals("key"); // ['value1', 'value2']
```

`Buffer`s are supported as well:

```typescript
const client = createClient().withTypeMapping({
  [RESP_TYPES.BLOB_STRING]: Buffer
});

await client.hSet("key", "field", Buffer.from("value")); // 'OK'
await client.hGet("key", "field"); // { field: <Buffer 76 61 6c 75 65> }

```

### Unsupported Redis Commands

If you want to run commands and/or use arguments that Node Redis doesn't know about (yet!) use `.sendCommand()`:

```typescript
await client.sendCommand(["SET", "key", "value", "NX"]); // 'OK'

await client.sendCommand(["HGETALL", "key"]); // ['key1', 'field1', 'key2', 'field2']
```

### Transactions (Multi/Exec)

Start a [transaction](https://redis.io/topics/transactions) by calling `.multi()`, then chaining your commands. When
you're done, call `.exec()` and you'll get an array back with your results:

```typescript
await client.set("another-key", "another-value");

const [setKeyReply, otherKeyValue] = await client
  .multi()
  .set("key", "value")
  .get("another-key")
  .exec(); // ['OK', 'another-value']
```

You can also [watch](https://redis.io/topics/transactions#optimistic-locking-using-check-and-set) keys by calling
`.watch()`. Your transaction will abort if any of the watched keys change.


### Blocking Commands

In v4, `RedisClient` had the ability to create a pool of connections using an "Isolation Pool" on top of the "main"
connection. However, there was no way to use the pool without a "main" connection:

```javascript
const client = await createClient()
  .on("error", (err) => console.error(err))
  .connect();

await client.ping(client.commandOptions({ isolated: true }));
```

In v5 we've extracted this pool logic into its own class—`RedisClientPool`:

```javascript
const pool = await createClientPool()
  .on("error", (err) => console.error(err))
  .connect();

await pool.ping();
```


### Pub/Sub

See the [Pub/Sub overview](https://github.com/redis/node-redis/blob/master/docs/pub-sub.md).

### Scan Iterator

[`SCAN`](https://redis.io/commands/scan) results can be looped over
using [async iterators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator):

```typescript
for await (const key of client.scanIterator()) {
  // use the key!
  await client.get(key);
}
```

This works with `HSCAN`, `SSCAN`, and `ZSCAN` too:

```typescript
for await (const { field, value } of client.hScanIterator("hash")) {
}
for await (const member of client.sScanIterator("set")) {
}
for await (const { score, value } of client.zScanIterator("sorted-set")) {
}
```

You can override the default options by providing a configuration object:

```typescript
client.scanIterator({
  TYPE: "string", // `SCAN` only
  MATCH: "patter*",
  COUNT: 100,
});
```

### Disconnecting

The `QUIT` command has been deprecated in Redis 7.2 and should now also be considered deprecated in Node-Redis. Instead
of sending a `QUIT` command to the server, the client can simply close the network connection.

`client.QUIT/quit()` is replaced by `client.close()`. and, to avoid confusion, `client.disconnect()` has been renamed to
`client.destroy()`.

```typescript
client.destroy();
```
### Client Side Caching

Node Redis v5 adds support for [Client Side Caching](https://redis.io/docs/manual/client-side-caching/), which enables clients to cache query results locally. The Redis server will notify the client when cached results are no longer valid.

```typescript
// Enable client side caching with RESP3
const client = createClient({
  RESP: 3, 
  clientSideCache: {
    ttl: 0,             // Time-to-live (0 = no expiration)
    maxEntries: 0,      // Maximum entries (0 = unlimited)
    evictPolicy: "LRU"  // Eviction policy: "LRU" or "FIFO"
  }
});
```

See the [V5 documentation](https://github.com/redis/node-redis/blob/master/docs/v5.md#client-side-caching) for more details and advanced usage.

### Auto-Pipelining

Node Redis will automatically pipeline requests that are made during the same "tick".

```typescript
client.set("Tm9kZSBSZWRpcw==", "users:1");
client.sAdd("users:1:tokens", "Tm9kZSBSZWRpcw==");
```

Of course, if you don't do something with your Promises you're certain to
get [unhandled Promise exceptions](https://nodejs.org/api/process.html#process_event_unhandledrejection). To take
advantage of auto-pipelining and handle your Promises, use `Promise.all()`.

```typescript
await Promise.all([
  client.set("Tm9kZSBSZWRpcw==", "users:1"),
  client.sAdd("users:1:tokens", "Tm9kZSBSZWRpcw=="),
]);
```

### Programmability

See the [Programmability overview](https://github.com/redis/node-redis/blob/master/docs/programmability.md).

### Clustering

Check out the [Clustering Guide](https://github.com/redis/node-redis/blob/master/docs/clustering.md) when using Node Redis to connect to a Redis Cluster.

### Events

The Node Redis client class is an Nodejs EventEmitter and it emits an event each time the network status changes:

| Name                    | When                                                                               | Listener arguments                                        |
| ----------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `connect`               | Initiating a connection to the server                                              | _No arguments_                                            |
| `ready`                 | Client is ready to use                                                             | _No arguments_                                            |
| `end`                   | Connection has been closed (via `.disconnect()`)                                   | _No arguments_                                            |
| `error`                 | An error has occurred—usually a network issue such as "Socket closed unexpectedly" | `(error: Error)`                                          |
| `reconnecting`          | Client is trying to reconnect to the server                                        | _No arguments_                                            |
| `sharded-channel-moved` | See [here](https://github.com/redis/node-redis/blob/master/docs/pub-sub.md#sharded-channel-moved-event)                          | See [here](https://github.com/redis/node-redis/blob/master/docs/pub-sub.md#sharded-channel-moved-event) |

> :warning: You **MUST** listen to `error` events. If a client doesn't have at least one `error` listener registered and
> an `error` occurs, that error will be thrown and the Node.js process will exit. See the [ > `EventEmitter` docs](https://nodejs.org/api/events.html#events_error_events) for more details.

> The client will not emit [any other events](https://github.com/redis/node-redis/blob/master/docs/v3-to-v4.md#all-the-removed-events) beyond those listed above.

## Supported Redis versions

Node Redis is supported with the following versions of Redis:

| Version | Supported          |
| ------- | ------------------ |
| 8.0.z   | :heavy_check_mark: |
| 7.4.z   | :heavy_check_mark: |
| 7.2.z   | :heavy_check_mark: |
| < 7.2   | :x:                |

> Node Redis should work with older versions of Redis, but it is not fully tested and we cannot offer support.

## Migration

- [From V3 to V4](https://github.com/redis/node-redis/blob/master/docs/v3-to-v4.md)
- [From V4 to V5](https://github.com/redis/node-redis/blob/master/docs/v4-to-v5.md)
- [V5](https://github.com/redis/node-redis/blob/master/docs/v5.md)

## Contributing

If you'd like to contribute, check out the [contributing guide](https://github.com/redis/node-redis/blob/master/CONTRIBUTING.md).

Thank you to all the people who already contributed to Node Redis!

[![Contributors](https://contrib.rocks/image?repo=redis/node-redis)](https://github.com/redis/node-redis/graphs/contributors)

## License

This repository is licensed under the "MIT" license. See [LICENSE](https://github.com/redis/node-redis/blob/master/LICENSE).
