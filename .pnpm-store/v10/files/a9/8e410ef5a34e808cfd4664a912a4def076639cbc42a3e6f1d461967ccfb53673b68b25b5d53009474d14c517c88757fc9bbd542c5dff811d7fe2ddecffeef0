# pg-query-stream

Receive result rows from [pg](https://github.com/brianc/node-postgres) as a readable (object) stream.

## installation

```bash
$ npm install pg --save
$ npm install pg-query-stream --save
```

_requires pg>=2.8.1_

## use

```js
const pg = require('pg')
const pool = new pg.Pool()
const QueryStream = require('pg-query-stream')
const JSONStream = require('JSONStream')

// pipe 1,000,000 rows to stdout without blowing up your memory usage
pool.connect((err, client, done) => {
  if (err) throw err
  const query = new QueryStream('SELECT * FROM generate_series(0, $1) num', [1000000])
  const stream = client.query(query)
  // release the client when the stream is finished
  stream.on('end', done)
  stream.pipe(JSONStream.stringify()).pipe(process.stdout)
})
```

The stream uses a cursor on the server so it efficiently keeps only a low number of rows in memory.

This is especially useful when doing [ETL](http://en.wikipedia.org/wiki/Extract,_transform,_load) on a huge table. Using manual `limit` and `offset` queries to fake out async iteration through your data is cumbersome, and _way way way_ slower than using a cursor.

_note: this module only works with the JavaScript client, and does not work with the native bindings. libpq doesn't expose the protocol at a level where a cursor can be manipulated directly_

## contribution

I'm very open to contribution! Open a pull request with your code or idea and we'll talk about it. If it's not way insane we'll merge it in too: isn't open source awesome?

## license

The MIT License (MIT)

Copyright (c) 2013-2020 Brian M. Carlson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
