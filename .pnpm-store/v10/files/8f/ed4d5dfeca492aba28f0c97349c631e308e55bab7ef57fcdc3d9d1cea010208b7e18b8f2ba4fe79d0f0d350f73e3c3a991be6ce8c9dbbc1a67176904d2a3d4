json-bignum
===========

Node.js JSON replacement which handles 64-bit integers and arbitrary-precision decimals. It is a modified version of [Douglas Crockford's JSON library](https://github.com/douglascrockford/JSON-js). Although it can handle 64-bit integers and arbitrary-precision decimals, it is slower than the built-in JSON functions.

## Install

    $ npm install json-bignum

## Usage

### parse()

```js
var bignumJSON = require('json-bignum');

var obj = bignumJSON.parse('{ "decimal": -9223372036854775807.4237482374983253298159 }');
```

### stringify()

```js
var bignumJSON = require('json-bignum');

var obj = {
    bigint: new bignumJSON.BigNumber('92233720368547758074237482374983253298159'),
    decimal: new bignumJSON.BigNumber('-9223372036854775807.4237482374983253298159'),
};

console.log(bignumJSON.stringify(obj));
```

### BigNumber

The ```BigNumber``` class simply stores the number as a string. It does not support arithmetic, but if you need that here are some excellent libraries.

* [BigDecimal.js](https://github.com/iriscouch/bigdecimal.js): a literal port of Java's ```BigInteger``` and ```BigDecimal``` classes.
* [bigint](https://github.com/substack/node-bigint): Big integer arithmetic using GMP.
* [bignum](https://github.com/justmoon/node-bignum): Big integer arithmetic using OpenSSL.

```js
// example using BigDecimal.js

var bignumJSON = require('json-bignum');
var bigdecimal = require('bigdecimal');

var jsonStr = '{"normal":-922337203.234,"big":-9223372036854775807.4237482374983253298159}';
var jsonObj = bignumJSON.parse(jsonStr);

var a = new bigdecimal.BigDecimal(jsonObj.normal.toString());
var b = new bigdecimal.BigDecimal(jsonObj.big.toString());
var sum = a.add(b);

jsonObj.sum = new bignumJSON.BigNumber(sum.toString());

console.log(bignumJSON.stringify(jsonObj));
```

## Caveats

It is not recommended to mix calls to ```JSON``` and ```bignumJSON```. For example, ```JSON.stringify()``` does not know how to parse ```BigNumber```.

## Benchmark

Below shows the result of the benchmark on my machine.

    $ node benchmark.js
    10000 calls of JSON.parse():                                   26.746847 ms
    10000 calls of JSON.stringify():                               20.824071 ms
    10000 calls of bignumJSON.parse() with bignums in JSON:        221.945307 ms
    10000 calls of bignumJSON.parse() without bignums in JSON:     150.626292 ms
    10000 calls of bignumJSON.stringify() with bignums in JSON:    64.166056 ms
    10000 calls of bignumJSON.stringify() without bignums in JSON: 61.860016 ms
