# `bytesish`

![5002](https://img.shields.io/badge/compiled%20bundle-5k-green) ![1903](https://img.shields.io/badge/gzipped%20bundle-2k-brightgreen)

If you're writing a library that needs to work in Node.js and in Browsers,
it's quite difficult to figure out what "the right thing" to do with binary
is.

If you want to be compatible with Node.js libraries you'll need to accept
and return `Buffer` instances. If you want to be compatible with Browser API's
you'll need to accept and return a number of types, the browser is sort of a mess
when it comes to binary with many different "views" of binary data.

The moment you use the Node.js `Buffer` API in a library that is bundled for
use in Browsers the bundler will inject a rather large polyfill for the entire
`Buffer` API. It's quite difficult to accept and return `Buffer` instances while
avoiding this penalty.

However, there is some good news. No matter what the binary type there's an underlying
`ArrayBuffer` associated with the instance. There's also one generic binary view object
available in both Node.js and Browsers called `DataView`. This means that you can take
any binary type and do a **zero memcopy** conversion to a `DataView`.

But there are some problems with `DataView`. Not all APIs take it in browsers and almost
none accept it in Node.js. It's a great API for reading and writing to an `ArrayBuffer`
but it lacks a lot of other functionality that can be difficult to accomplish cross-platform.

`bytesish` is here to help. This library helps you accept and convert different binary types
into a consistent type, `DataView`, without loading any polyfills or other dependencies, then
convert back into an ideal type for the platform your library is running in.

What `bytesish` does:

* Returns a `DataView` from any known binary type (zero copy).
* Creates a `DataView` from a string with any encoding.
* Converts any type to a string of any encoding.
* Converts any to an ideal native object (`Buffer` or `Uint8Array`).
* Provides utility functions for comparison, sorting, copying and slices
any binary type or string.

`bytesish` does not create a new Binary Type for accessing and manipulating
binary data, because you can just use `DataView` for that. `bytesish` tries to be a
small piece of code that does not contribute any more than necessary to your bundle size.
It does this by containing only the binary operations you need that are difficult to
do cross-platform (Node.js and Browsers).

```javascript
let bytes = require('bytesish')
let view = bytes('hello world')

/* zero copy conversions */
view = bytes(Buffer.from('hello world')) // Buffer instance
view = bytes((new TextEncoder()).encode('hello world')) // Uint8Array

/* base64 conversions */
let base64String = bytes.toString(view, 'base64')
base64String = bytes.toString(Buffer.from('hello world'), 'base64')
base64String = bytes.toString('hello world', 'base64')

/* since this is a string conversion it will create a new binary instance */
let viewCopy = bytes(base64String, 'base64')
```

# API

## Zero Copy

### `bytes(from)`

### `bytes.sort(a, b)`

### `bytes.compare(a, b)`

### `bytes.native(from[, encoding])`

### `bytes.slice(from[, start=0[, end=from.byteLength]])`

### `bytes.typedArray(from[, Class=Uint8Array])`

## Optimized (memcopy only when necessary)

### `bytes.arrayBuffer(from[, encoding])` 

## Memory Copy

All memcopy APIs return an `ArrayBuffer`

### `bytes.memcopy(from[, encoding])`

Returns an `ArrayBuffer` copy of the given binary or string.

### `bytes.memcopySlice(from[, start=0[, end=from.byteLength]])`

Returns an `ArrayBuffer` copy from a slize of the given binary or string.

### `bytes.concat(values)`

`values` is an iterable of binary or string types.

Returns a newly allocated `ArrayBuffer` contained the concatenated binary data.

## String Conversions

### `bytes(from[, encoding])`

### `bytes.toString(from[, outputEncoding])`
