# @isaacs/ttlcache

The time-based use-recency-unaware cousin of
[`lru-cache`](http://npm.im/lru-cache)

## Usage

Essentially, this is the same API as
[`lru-cache`](http://npm.im/lru-cache), but it does not do LRU tracking,
and is bound primarily by time, rather than space.  Since entries are not
purged based on recency of use, it can save a lot of extra work managing
linked lists, mapping keys to pointers, and so on.

TTLs are millisecond granularity.

If a capacity limit is set, then the soonest-expiring items are purged
first, to bring it down to the size limit.

Iteration is in order from soonest expiring until latest expiring.

If multiple items are expiring in the same ms, then the soonest-added
items are considered "older" for purposes of iterating and purging down to
capacity.

A TTL _must_ be set for every entry, which can be defaulted in the
constructor.

Custom size calculation is not supported.  Max capacity is simply the count
of items in the cache.

```js
const TTLCache = require('@isaacs/ttlcache')
const cache = new TTLCache({ max: 10000, ttl: 1000 })

// set some value
cache.set(1, 2)

// 999 ms later
cache.has(1) // returns true
cache.get(1) // returns 2

// 1000 ms later
cache.get(1) // returns undefined
cache.has(1) // returns false
```

## Caveat Regarding Timers and Graceful Exits

On Node.js, this module uses the `Timeout.unref()` method to
prevent its internal `setTimeout` calls from keeping the process
running indefinitely.  However, on other systems such as Deno,
where the `setTimeout` method does not return an object with an
`unref()` method, the process will stay open as long as any
unexpired entry exists in the cache.

You may call `cache.cancelTimer()` to clear the timeout and
allow the process to exit normally. Be advised that canceling the
timer in this way will of course prevent anything from expiring.

## API

### `const TTLCache = require('@isaacs/ttlcache')` or `import TTLCache from '@isaacs/ttlcache'`

Default export is the `TTLCache` class.

### `new TTLCache({ ttl, max = Infinty, updateAgeOnGet = false, checkAgeOnGet = false, noUpdateTTL = false, noDisposeOnSet = false })`

Create a new `TTLCache` object.

* `max` The max number of items to keep in the cache.  Must be
  positive integer or `Infinity`, defaults to `Infinity` (ie,
  limited only by TTL, not by item count).
* `ttl` The max time in ms to store items.  Overridable on the `set()`
  method.  Must be a positive integer or `Infinity` (see note
  below about immortality hazards).  If `undefined` in
  constructor, then a TTL _must_ be provided in each `set()`
  call.
* `updateAgeOnGet` Should the age of an item be updated when it is
  retrieved?  Defaults to `false`.  Overridable on the `get()` method.
* `checkAgeOnGet` Check the TTL whenever an item is retrieved
  with `get()`. If the item is past its ttl, but the timer has
  not yet fired, then delete it and return undefined. By default,
  the cache will return a value if it has one, even if it is
  technically beyond its TTL.
* `noUpdateTTL` Should setting a new value for an existing key leave the
  TTL unchanged?  Defaults to `false`.  Overridable on the `set()` method.
  (Note that TTL is _always_ updated if the item is expired, since that is
  treated as a new `set()` and the old item is no longer relevant.)
* `dispose` Method called with `(value, key, reason)` when an item is
  removed from the cache.  Called once item is fully removed from cache.
  It is safe to re-add at this point, but note that adding when `reason` is
  `'set'` can result in infinite recursion if `noDisponseOnSet` is not
  specified.

    Disposal reasons:

    * `'stale'` TTL expired.
    * `'set'` Overwritten with a new different value.
    * `'evict'` Removed from the cache to stay within capacity limit.
    * `'delete'` Explicitly deleted with `cache.delete()` or
      `cache.clear()`

* `noDisposeOnSet` Do not call `dispose()` method when overwriting a key
  with a new value.  Defaults to `false`.  Overridable on `set()` method.

When used as an iterator, like `for (const [key, value] of cache)` or
`[...cache]`, the cache yields the same results as the `entries()` method.

### `cache.size`

The number of items in the cache.

### `cache.set(key, value, { ttl, noUpdateTTL, noDisposeOnSet } = {})`

Store a value in the cache for the specified time.

`ttl` and `noUpdateTTL` optionally override defaults on the constructor.

Returns the cache object.

### `cache.get(key, {updateAgeOnGet, checkAgeOnGet, ttl} = {})`

Get an item stored in the cache.  Returns `undefined` if the item is not in
the cache (including if it has expired and been purged).

If `updateAgeOnGet` is `true`, then re-add the item into the
cache with the updated `ttl` value.  All options default to the
settings on the constructor.

If `checkAgeOnGet`, then an item will be deleted if it is found
to be beyond its TTL, which can happen if the setTimeout timer
has not yet fired to trigger its expiration.

Note that using `updateAgeOnGet` _can_ effectively simulate a
"least-recently-used" type of algorithm, by repeatedly updating
the TTL of items as they are used.  However, if you find yourself
doing this, consider using
[`lru-cache`](http://npm.im/lru-cache), as it is much more
optimized for an LRU use case.

### `cache.getRemainingTTL(key)`

Return the remaining time before an item expires.  Returns `0` if the item
is not found in the cache or is already expired.

### `cache.has(key)`

Return true if the item is in the cache.

### `cache.delete(key)`

Remove an item from the cache.

### `cache.clear()`

Delete all items from the cache.

### `cache.entries()`

Return an iterator that walks through each `[key, value]` from soonest
expiring to latest expiring.  (Items expiring at the same time are walked
in insertion order.)

Default iteration method for the cache object.

### `cache.keys()`

Return an iterator that walks through each `key` from soonest expiring to
latest expiring.

### `cache.values()`

Return an iterator that walks through each `value` from soonest expiring to
latest expiring.

### `cache.cancelTimer()`

Clear the internal timer, and stop automatically expiring items
when their TTL expires.

This allows the process to exit normally on Deno and other
platforms that lack Node's `Timer.unref()` method.

## Internal Methods

You should not ever call these, they are managed automatically.

### `purgeStale`

**Internal**

Removes items which have expired.  Called automatically.

### `purgeToCapacity`

**Internal**

Removes soonest-expiring items when the capacity limit is reached.  Called
automatically.

### `dispose`

**Internal**

Called when an item is removed from the cache and should be disposed.  Set
this on the constructor options.

### `setTimer`

**Internal**

Called when an with a ttl is added. This ensures that only one timer
is setup at once. Called automatically.

## Algorithm

The cache uses two `Map` objects.  The first maps item keys to their
expiration time, and the second maps item keys to their values.  Then, a
null-prototype object uses the expiration time as keys, with the value
being an array of all the keys expiring at that time.

This leverages a few important features of modern JavaScript engines for
fairly good performance:

- `Map` objects are highly optimized for referring to arbitrary values by
  arbitrary keys.
- Objects with solely integer-numeric keys are iterated in sorted numeric
  order rather than insertion order, and insertions in the middle of the
  key ordering are still very fast.  This is true of all modern JS engines
  tested at the time of this module's creation, but most particularly V8
  (the engine in Node.js).

When it is time to prune, we can always walk the null-prototype object in
iteration order, deleting items until we come to the first key greater than
the current time.

Thus, the `start` time doesn't need to be tracked, only the expiration
time.  When an item age is updated (either explicitly on `get()`, or by
setting to a new value), it is deleted and re-inserted.

## Immortality Hazards

It is possible to set a TTL of `Infinity`, in which case an item
will never expire.  As it does not expire, its TTL is not
tracked, and `getRemainingTTL()` will return `Infinity` for that
key.

If you do this, then the item will never be purged.  Create
enough immortal values, and the cache will grow to consume all
available memory.  If find yourself doing this, it's _probably_
better to use a different data structure, such as a `Map` or
plain old object to store values, as it will have better
performance and the hazards will be more obvious.
