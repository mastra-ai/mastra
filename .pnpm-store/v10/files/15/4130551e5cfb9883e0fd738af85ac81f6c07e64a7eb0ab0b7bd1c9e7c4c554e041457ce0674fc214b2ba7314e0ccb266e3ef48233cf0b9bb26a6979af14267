# ![Heap.js](assets/heap-js.png) Heap.js

[![npm version](https://img.shields.io/npm/v/heap-js.svg?style=flat)](https://www.npmjs.com/package/heap-js)
[![Coverage Status](https://img.shields.io/coveralls/ignlg/heap-js/master.svg?style=flat)](https://coveralls.io/github/ignlg/heap-js?branch=master)

**Efficient Binary heap (priority queue, binary tree) data structure for JavaScript / TypeScript.**

**Now with support for async comparators with the new `HeapAsync` class!**

Includes JavaScript methods, Python's _heapq module_ methods, and Java's _PriorityQueue_ methods.

Easy to use, known interfaces, tested, and well-documented JavaScript binary heap library.

Instances are `integer min heap` by default.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/ignlg/heap-js)

## Is it faster than sorting an array?

It depends on your usage, but for some scenarios, it is much faster:

```
heap vs array: push + pop/unshift 50
 heap  x 72,130 ops/sec ±0.50% (93 runs sampled)
 array x 121 ops/sec ±78.09% (5 runs sampled)

heap vs array: push + peek 20
 heap  x 622,332 ops/sec ±27.93% (63 runs sampled)
 array x 207 ops/sec ±78.18% (5 runs sampled)

heap vs array: push + top(1) of 100
 heap  x 124,835 ops/sec ±40.37% (61 runs sampled)
 array x 123 ops/sec ±78.49% (5 runs sampled)

heap vs array: push + top(50) of 100
 heap  x 59,210 ops/sec ±17.66% (82 runs sampled)
 array x 125 ops/sec ±78.79% (5 runs sampled)
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ignlg/heap-js&type=Date)](https://star-history.com/#ignlg/heap-js&Date)

## Changelog

### 2.7.1

- Optimize loop condition in HeapAsync init method.

### 2.7

- Improves performance of sorting methods. Thanks to @BeatsuDev for the contribution.
- Improves tests and documentation.

### 2.6

- Improves performance of remove and sorting methods.
- Improves tests and documentation.

### 2.5

- Improves the `limit` property to support negative, Infinity, and NaN values. They will be set as `0` and the heap will not be limited.
- Adds the `setLimit` method to set the limit of the heap. It returns `NaN` if the limit is negative, or NaN. This method is useful to check if the limit was set as expected.
- Improves tests and documentation.

### 2.4

- Adds the `indexOf` method to find the first index of an element in the heap.
- Adds the `indexOfEvery` method to find all indexes of an element in the heap.
- Changes the `remove` method to use the `indexOf` method.
- Changes the `contains` method to use the `indexOf` method.
- Improves documentation.

### 2.3

- Adds the `HeapAsync` class, with async methods and supporting async comparators. It is a drop-in replacement for the `Heap` class with Promises.

### 2.2

- Fixes `.iterator()` method to follow [Java's PriorityQueue implementation:
](https://docs.oracle.com/javase/8/docs/api/java/util/PriorityQueue.html)
  > The Iterator provided in method [iterator()](<https://docs.oracle.com/javase/8/docs/api/java/util/PriorityQueue.html#iterator()>) is not guaranteed to traverse the elements of the priority queue in any particular order.

Notice that _using the heap directly as an iterator will consume the heap,_ as Python's `heapq` implementation does.

### 2.1

- Adds `Heap.nlargest` as in `heapq`.
- Adds `Heap.nsmallest` as in `heapq`.
- Sanitizes `top` / `bottom` input to force an integer.
- Linted with Eslint.

### 2.0

The main breaking change is that now _`top(N)` does NOT sort the output_, because sorting should not be part of the spec for a priority queue. The output is the top N elements, and they will be _partially ordered_ with the peek at index `0` by definition.

- `top(N)` is unordered, only the first element is guaranteed to be the top priority element.
- Fixes custom heap issue [#31](https://github.com/ignlg/heap-js/issues/31).
- Performance improvements.
- More tests, including those for custom heaps.
- Auxiliary experimental `top(N)` algorithms.
- (WIP) Benchmarks.

### 1.5

- Adds the `Iterator` interface and `iterator()` method.

## Examples

### Basic usage

#### Min Heap

A heap where the smallest element is always at the top. It is the default heap.

```js
import { Heap } from 'heap-js';

// Min Heap by default
const minHeap = new Heap();

// Initialize the heap with an array
minHeap.init([5, 18, 1]);
// Push a new value
minHeap.push(2);

console.log(minHeap.peek()); //> 1
console.log(minHeap.pop()); //> 1
console.log(minHeap.peek()); //> 2
```

#### Max Heap

A heap where the largest element is always at the top.

```js
import { Heap } from 'heap-js';

// Max Heap
const maxHeap = new Heap(Heap.maxComparator);

// Initialize the heap with an array
maxHeap.init([3, 4, 1, 12, 8]);
// Push a new value
maxHeap.push(2);

console.log(maxHeap.peek()); //> 12
console.log(maxHeap.pop()); //> 12
console.log(maxHeap.peek()); //> 8
```

#### Custom Heap

A heap where the most important element is always at the top, but the elements are objects with a `priority` property.

```js
import { Heap } from 'heap-js';

const customPriorityComparator = (a, b) => a.priority - b.priority;
// Custom Heap
const customHeap = new Heap(customPriorityComparator);

// Initialize the heap with an array
customHeap.init([{ priority: 5 }, { priority: 18 }, { priority: 1 }]);
// Push a new value
customHeap.push({ priority: 2 });

console.log(customHeap.peek()); //> { priority: 1 }
console.log(customHeap.pop()); //> { priority: 1 }
console.log(customHeap.peek()); //> { priority: 2 }
```

#### Min HeapAsync

A heap where the most important element is always at the top, the elements are objects with a `priority` property, and the comparator function is asynchronous. Implements the same interface as `Heap`, but almost all methods return a `Promise`.

```js
import { HeapAsync } from 'heap-js';

const customPriorityComparator = (a, b) => Promise.resolve(a.priority - b.priority);
// Custom HeapAsync
const customHeap = new HeapAsync(customPriorityComparator);

// Initialize the heap with an array
await customHeap.init([{ priority: 5 }, { priority: 18 }, { priority: 1 }]);
// Push a new value
await customHeap.push({ priority: 2 });

console.log(customHeap.peek()); //> { priority: 1 }
console.log(await customHeap.pop()); //> { priority: 1 }
console.log(await customHeap.peek()); //> { priority: 2 }
```

### Priority Queue usage

#### JavaScript / Python-style iterator (recommended)

Iterates over the heap consuming it, and guarantees to traverse the elements of the heap in the order of priority. Useful.

```js
const { Heap } = require('heap-js');

// Get all tasks from the database
const tasks = db.collection.find().toArray();
// The most important task has the lowest priority value
const customPriorityComparator = (a, b) => a.priority - b.priority;

// Create the priority queue
const priorityQueue = new Heap(customPriorityComparator);
// Initialize the priority queue with the tasks
priorityQueue.init(tasks);

// Iterator that will consume the heap while traversing it in the order of priority
for (const task of priorityQueue) {
  console.log(task);
}
```

#### Java-style iterator (not recommended)

Iterates over the heap without consuming it, but does not guarantee to traverse the elements of the heap in any particular order. Barely useful.

```js
const { Heap } = require('heap-js');

// Get all tasks from the database
const tasks = db.collection.find().toArray();
// The most important task has the lowest priority value
const customPriorityComparator = (a, b) => a.priority - b.priority;

const priorityQueue = new Heap(customPriorityComparator);
// Initialize the priority queue with the tasks
priorityQueue.init(tasks);

// Iterator, the Java way, that will not consume the heap BUT does not guarantee to traverse the elements of the heap in any particular order. Barely useful.
for (const task of priorityQueue.iterator()) {
  console.log(task);
}
```

### Python-like static methods

```js
import { Heap } from 'heap-js';
const numbers = [2, 3, 7, 5];

// Changes the array elements order into a heap in-place
Heap.heapify(numbers);
console.log(numbers); //> [ 2, 3, 5, 7 ]

// Pushes a new value to the heap
Heap.heappush(numbers, 1);
console.log(numbers); //> [ 1, 2, 5, 7, 3 ]
```

## Installation

```bash
yarn add heap-js # if you use yarn

npm install --save heap-js # if you use npm
```

## Constructor

### Heap

```js
new Heap([comparator]);
```

### HeapAsync

```js
new HeapAsync([asyncComparator]);
```

## Comparators already included

- `Heap.minComparator`: Uses less-than operator to compare elements. It is the default comparator.
- `Heap.maxComparator`: Uses greater-than operator to compare elements.
- `Heap.minComparatorNumber`: Uses subtraction `a - b` to compare elements.
- `Heap.maxComparatorNumber`: Uses subtraction `b - a` to compare elements.

## Implements JavaScript-style methods

- `for (const value of heap)` directly usable as an Iterator, **consumes the heap.**
- `length` of the heap.
- `limit` the number of elements in the heap.
- `pop()` the top element.
- `push(...elements)` one or more elements to the heap.
- `pushpop(element)` faster than `push` & `pop`.
- `replace(element)` faster than `pop` & `push`.
- `top(number?)` most valuable elements from the heap.
- `bottom(number?)` least valuable elements from the heap.
- `indexOf(element, fn?)` returns the internal index of the first occurrence of the element in the heap.
- `indexOfEvery(element, fn?)` returns an array with the internal indexes of all occurrences of the element in the heap.

## Implements Java's `PriorityQueue` interface

- `add(element)` to the heap.
- `addAll([element, element, ... ])` to the heap, faster than loop `add`.
- `clear()`
- `clone()`
- `comparator()`
- `contains(element, fn?)`
- _`element()` alias of `peek()`_
- `isEmpty()`
- `iterator()` returns the same as `toArray()` because it is iterable and follows Java's implementation. Barely useful. Use `for (const value of heap)` instead.
- _`offer(element)` alias of `add(element)`_
- `peek()`
- _`poll()` alias of `pop()`_
- `remove(element?)`
- _`removeAll()` alias of `clear()`_
- _`size()` alias of `length`_
- `toArray()`
- `toString()`

To do:

- `containsAll`
- `equals`
- `retainAll`

## Implements static Python's `heapq` interface

- `Heap.heapify(array, comparator?)` that converts an array to an array-heap.
- `Heap.heappop(heapArray, comparator?)` that takes the peek of the array-heap.
- `Heap.heappush(heapArray, item, comparator?)` that appends elements to the array-heap.
- `Heap.heappushpop(heapArray, item, comparator?)` faster than `heappush` & `heappop`.
- `Heap.heapreplace(heapArray, item, comparator?)` faster than `heappop` & `heappush`.
- `Heap.nlargest(n, iterable, comparator?)` that gets the `n` most valuable elements of an iterable.
- `Heap.nsmallest(n, iterable, comparator?)` that gets the `n` least valuable elements of an iterable.

Extras:

- `Heap.heaptop(n, heapArray, comparator?)` that returns the `n` most valuable elements of the array-heap
- `Heap.heapbottom(n, heapArray, comparator?)` that returns the `n` least valuable elements of the array-heap

To do:

- `merge(...iterables, comparator?)`

## Documentation

<https://ignlg.github.io/heap-js/>

## Sponsor

We are looking for sponsors to help us maintain and improve **Heap.js**. If you're interested in supporting this project, please get in touch with us.

## Collaborate

Would you like to contribute to **Heap.js**? Feel free to submit a pull request, open an issue, or reach out to the maintainers. We welcome your feedback and ideas!

### Dev setup

```bash
yarn
```

### Tests

```bash
npm run test
```

### Benchmarks

```bash
npm run benchmarks
```

### License

Heap.js is [BSD 3-Clause Licensed](LICENSE).
