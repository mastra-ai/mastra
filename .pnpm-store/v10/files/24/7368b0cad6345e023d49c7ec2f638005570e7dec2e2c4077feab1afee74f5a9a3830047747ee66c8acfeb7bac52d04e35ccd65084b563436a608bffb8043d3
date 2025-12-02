SPEX
----

Specialized Promise Extensions.

[![Build Status](https://github.com/vitaly-t/spex/actions/workflows/ci.yml/badge.svg)](https://github.com/vitaly-t/spex/actions/workflows/ci.yml)
[![Node Version](https://img.shields.io/badge/nodejs-14%20--%2022-green.svg?logo=node.js&style=flat)](https://nodejs.org)

[batch], [page], [sequence] - promise methods for the following patterns:
* [Data Throttling & Load Balancing](http://vitaly-t.github.io/spex/tutorial-throttling.html)
* [Linked and Detached Sequencing](http://vitaly-t.github.io/spex/tutorial-sequencing.html)
* [Streaming and Paging](http://vitaly-t.github.io/spex/tutorial-streaming.html)
* [Batch Processing](http://vitaly-t.github.io/spex/tutorial-batch.html)

## Installing

```
$ npm i spex
```

## Usage

* For any [Promises/A+] library: [Promise], [Bluebird], [When], [Q], [RSVP], etc.

```js
const promise = require('bluebird');
const spex = require('spex')(promise);
```

* For ES6 Promise:

```js
const spex = require('spex')(Promise);
```

See also: [client-side usage](http://vitaly-t.github.io/spex/tutorial-client.html).

## API

* [Module]
* Methods
  - [batch] 
  - [page]
  - [sequence]
  - [stream](http://vitaly-t.github.io/spex/stream.html)
    - [read]

## Testing

* Clone the repository (or download, if you prefer):

```
$ git clone https://github.com/vitaly-t/spex
```

* Install the library's DEV dependencies:

```
$ npm install
```

* To run all tests:

```
$ npm test
```

* To run all tests with coverage:

```
$ npm run coverage
```

## License

Copyright © 2025 [Vitaly Tomilov](https://github.com/vitaly-t);
Released under the MIT license.

[Module]:http://vitaly-t.github.io/spex/index.html
[batch]:http://vitaly-t.github.io/spex/global.html#batch
[page]:http://vitaly-t.github.io/spex/global.html#page
[sequence]:http://vitaly-t.github.io/spex/global.html#sequence
[read]:http://vitaly-t.github.io/spex/stream.html#.read
[Promises/A+]:https://promisesaplus.com/
[Promise]:https://github.com/then/promise
[Bluebird]:https://github.com/petkaantonov/bluebird
[When]:https://github.com/cujojs/when
[Q]:https://github.com/kriskowal/q
[RSVP]:https://github.com/tildeio/rsvp.js
