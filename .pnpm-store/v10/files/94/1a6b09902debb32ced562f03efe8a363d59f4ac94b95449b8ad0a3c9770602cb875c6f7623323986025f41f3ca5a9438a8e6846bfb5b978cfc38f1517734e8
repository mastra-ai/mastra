<!---
  Licensed to the Apache Software Foundation (ASF) under one
  or more contributor license agreements.  See the NOTICE file
  distributed with this work for additional information
  regarding copyright ownership.  The ASF licenses this file
  to you under the Apache License, Version 2.0 (the
  "License"); you may not use this file except in compliance
  with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied.  See the License for the
  specific language governing permissions and limitations
  under the License.
-->

# [Apache Arrow](https://github.com/apache/arrow) in JS

[![npm version](https://img.shields.io/npm/v/apache-arrow.svg)](https://www.npmjs.com/package/apache-arrow)

Arrow is a set of technologies that enable big data systems to process and transfer data quickly.

## Install `apache-arrow` from NPM

`npm install apache-arrow` or `yarn add apache-arrow`

(read about how we [package apache-arrow](#packaging) below)

# Powering Columnar In-Memory Analytics

[Apache Arrow](https://github.com/apache/arrow) is a columnar memory layout specification for encoding vectors and table-like containers of flat and nested data. The Arrow spec aligns columnar data in memory to minimize cache misses and take advantage of the latest SIMD (Single input multiple data) and GPU operations on modern processors.

Apache Arrow is the emerging standard for large in-memory columnar data ([Spark](https://spark.apache.org/), [Pandas](https://wesmckinney.com/blog/pandas-and-apache-arrow/), [Drill](https://drill.apache.org/), [Graphistry](https://www.graphistry.com), ...). By standardizing on a common binary interchange format, big data systems can reduce the costs and friction associated with cross-system communication.

# Get Started

Check out our [API documentation][5] to learn more about how to use Apache Arrow's JS implementation. You can also learn by example by checking out some of the following resources:

* [/js/test/unit](https://github.com/apache/arrow/tree/main/js/test/unit) - Unit tests for Table and Vector

## Cookbook

### Get a table from an Arrow file on disk (in IPC format)

```js
import { readFileSync } from 'fs';
import { tableFromIPC } from 'apache-arrow';

const arrow = readFileSync('simple.arrow');
const table = tableFromIPC(arrow);

console.table(table.toArray());

/*
 foo,  bar,  baz
   1,    1,   aa
null, null, null
   3, null, null
   4,    4,  bbb
   5,    5, cccc
*/
```

### Create a Table when the Arrow file is split across buffers

```js
import { readFileSync } from 'fs';
import { tableFromIPC } from 'apache-arrow';

const table = tableFromIPC([
    'latlong/schema.arrow',
    'latlong/records.arrow'
].map((file) => readFileSync(file)));

console.table([...table]);

/*
        origin_lat,         origin_lon
35.393089294433594,  -97.6007308959961
35.393089294433594,  -97.6007308959961
35.393089294433594,  -97.6007308959961
29.533695220947266, -98.46977996826172
29.533695220947266, -98.46977996826172
*/
```

### Create a Table from JavaScript arrays

```js
import { tableFromArrays } from 'apache-arrow';

const LENGTH = 2000;

const rainAmounts = Float32Array.from(
    { length: LENGTH },
    () => Number((Math.random() * 20).toFixed(1)));

const rainDates = Array.from(
    { length: LENGTH },
    (_, i) => new Date(Date.now() - 1000 * 60 * 60 * 24 * i));

const rainfall = tableFromArrays({
    precipitation: rainAmounts,
    date: rainDates
});

console.table([...rainfall]);
```

### Load data with `fetch`

```js
import { tableFromIPC } from "apache-arrow";

const table = await tableFromIPC(fetch("/simple.arrow"));

console.table([...table]);
```

### Vectors look like JS Arrays

You can create vector from JavaScript typed arrays with `makeVector` and from JavaScript arrays with `vectorFromArray`. `makeVector` is a lot faster and does not require a copy.

```js
import { makeVector } from "apache-arrow";

const LENGTH = 2000;

const rainAmounts = Float32Array.from(
    { length: LENGTH },
    () => Number((Math.random() * 20).toFixed(1)));

const vector = makeVector(rainAmounts);

const typed = vector.toArray()

assert(typed instanceof Float32Array);

for (let i = -1, n = vector.length; ++i < n;) {
    assert(vector.get(i) === typed[i]);
}
```

### String vectors

Strings can be encoded as UTF-8 or dictionary encoded UTF-8. Dictionary encoding encodes repeated values more efficiently. You can create a dictionary encoded string conveniently with `vectorFromArray` or efficiently with `makeVector`.

```js
import { makeVector, vectorFromArray, Dictionary, Uint8, Utf8 } from "apache-arrow";

const utf8Vector = vectorFromArray(['foo', 'bar', 'baz'], new Utf8);

const dictionaryVector1 = vectorFromArray(
    ['foo', 'bar', 'baz', 'foo', 'bar']
);

const dictionaryVector2 = makeVector({
    data: [0, 1, 2, 0, 1],  // indexes into the dictionary
    dictionary: utf8Vector,
    type: new Dictionary(new Utf8, new Uint8)
});
```

# Getting involved

See [DEVELOP.md](DEVELOP.md)

Even if you do not plan to contribute to Apache Arrow itself or Arrow
integrations in other projects, we'd be happy to have you involved:

* Join the mailing list: send an email to
  [dev-subscribe@arrow.apache.org][1]. Share your ideas and use cases for the
  project
* Follow our activity on [GitHub issues][3]
* [Learn the format][2]
* Contribute code to one of the reference implementations

We prefer to receive contributions in the form of GitHub pull requests.
Please send pull requests against the [github.com/apache/arrow][4] repository.

If you are looking for some ideas on what to contribute, check out the [GitHub
issues][3] for the Apache Arrow project. Comment on the issue and/or contact
[dev@arrow.apache.org](https://mail-archives.apache.org/mod_mbox/arrow-dev/)
with your questions and ideas.

If you’d like to report a bug but don’t have time to fix it, you can still post
it on GitHub issues, or email the mailing list
[dev@arrow.apache.org](https://mail-archives.apache.org/mod_mbox/arrow-dev/)

## Packaging

`apache-arrow` is written in TypeScript, but the project is compiled to multiple JS versions and common module formats.

The base `apache-arrow` package includes all the compilation targets for convenience, but if you're conscientious about your `node_modules` footprint, we got you.

The targets are also published under the `@apache-arrow` namespace:

```sh
npm install apache-arrow # <-- combined es2015/CommonJS/ESModules/UMD + esnext/UMD
npm install @apache-arrow/ts # standalone TypeScript package
npm install @apache-arrow/es5-cjs # standalone es5/CommonJS package
npm install @apache-arrow/es5-esm # standalone es5/ESModules package
npm install @apache-arrow/es5-umd # standalone es5/UMD package
npm install @apache-arrow/es2015-cjs # standalone es2015/CommonJS package
npm install @apache-arrow/es2015-esm # standalone es2015/ESModules package
npm install @apache-arrow/es2015-umd # standalone es2015/UMD package
npm install @apache-arrow/esnext-cjs # standalone esNext/CommonJS package
npm install @apache-arrow/esnext-esm # standalone esNext/ESModules package
npm install @apache-arrow/esnext-umd # standalone esNext/UMD package
```

### Why we package like this

The JS community is a diverse group with a varied list of target environments and tool chains. Publishing multiple packages accommodates projects of all stripes.

If you think we missed a compilation target and it's a blocker for adoption, please open an issue.

### Supported Browsers and Platforms

The bundles we compile support moderns browser released in the last 5 years. This includes supported versions of
Firefox, Chrome, Edge, and Safari. We do not actively support Internet Explorer.
Apache Arrow also works on [maintained versions of Node](https://nodejs.org/en/about/releases/).

# People

Full list of broader Apache Arrow [committers](https://arrow.apache.org/committers/).

* Brian Hulette, _committer_
* Paul Taylor, _committer_
* Dominik Moritz, _committer_

# Powered By Apache Arrow in JS

Full list of broader Apache Arrow [projects & organizations](https://arrow.apache.org/powered_by/).

## Open Source Projects

* [Apache Arrow](https://arrow.apache.org) -- Parent project for Powering Columnar In-Memory Analytics, including affiliated open source projects
* [Perspective](https://github.com/finos/perspective) -- Perspective is an interactive analytics and data visualization component well-suited for large and/or streaming datasets. Perspective leverages Arrow C++ compiled to WebAssembly.
* [Falcon](https://github.com/uwdata/falcon) is a visualization tool for linked interactions across multiple aggregate visualizations of millions or billions of records.
* [Vega](https://github.com/vega) is an ecosystem of tools for interactive visualizations on the web. The Vega team implemented an [Arrow loader](https://github.com/vega/vega-loader-arrow).
* [Arquero](https://github.com/uwdata/arquero) is a library for query processing and transformation of array-backed data tables.
* [OmniSci](https://github.com/omnisci/mapd-connector) is a GPU database. Its JavaScript connector returns Arrow dataframes.

# License

[Apache 2.0](https://github.com/apache/arrow/blob/main/LICENSE)

[1]: mailto:dev-subscribe@arrow.apache.org
[2]: https://github.com/apache/arrow/tree/main/format
[3]: https://github.com/apache/arrow/issues
[4]: https://github.com/apache/arrow
[5]: https://arrow.apache.org/docs/js/
