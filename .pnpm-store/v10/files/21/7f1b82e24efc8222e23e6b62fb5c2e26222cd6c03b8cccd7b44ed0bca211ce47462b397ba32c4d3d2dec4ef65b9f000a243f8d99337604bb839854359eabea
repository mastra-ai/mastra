# @redis/bloom

This package provides support for the [RedisBloom](https://redis.io/docs/data-types/probabilistic/) module, which adds additional probabilistic data structures to Redis.

Should be used with [`redis`/`@redis/client`](https://github.com/redis/node-redis).

:warning: To use these extra commands, your Redis server must have the RedisBloom module installed.

RedisBloom provides the following probabilistic data structures:

* Bloom Filter: for checking set membership with a high degree of certainty.
* Cuckoo Filter: for checking set membership with a high degree of certainty.
* T-Digest: for estimating the quantiles of a stream of data.
* Top-K: Maintain a list of k most frequently seen items.
* Count-Min Sketch: Determine the frequency of events in a stream.

For some examples, see [`bloom-filter.js`](https://github.com/redis/node-redis/tree/master/examples/bloom-filter.js), [`cuckoo-filter.js`](https://github.com/redis/node-redis/tree/master/examples/cuckoo-filter.js), [`count-min-sketch.js`](https://github.com/redis/node-redis/tree/master/examples/count-min-sketch.js) and [`topk.js`](https://github.com/redis/node-redis/tree/master/examples/topk.js) in the [examples folder](https://github.com/redis/node-redis/tree/master/examples).
