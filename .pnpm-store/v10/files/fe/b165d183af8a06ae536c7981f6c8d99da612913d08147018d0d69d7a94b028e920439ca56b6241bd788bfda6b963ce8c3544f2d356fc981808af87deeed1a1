# big.js

**A small, fast JavaScript library for arbitrary-precision decimal arithmetic.**

[![npm version](https://img.shields.io/npm/v/big.js.svg)](https://www.npmjs.com/package/big.js)
[![npm downloads](https://img.shields.io/npm/dw/big.js)](https://www.npmjs.com/package/big.js)
[![CI](https://github.com/MikeMcl/big.js/actions/workflows/ci.yml/badge.svg)](https://github.com/MikeMcl/big.js/actions/workflows/ci.yml)

## Features

- Simple API
- Faster, smaller and easier-to-use than JavaScript versions of Java's BigDecimal
- Only 6 KB minified
- Replicates the `toExponential`, `toFixed` and `toPrecision` methods of JavaScript Numbers
- Stores values in an accessible decimal floating point format
- Comprehensive [documentation](http://mikemcl.github.io/big.js/) and test set
- No dependencies
- Uses ECMAScript 3 only, so works in all browsers

The little sister to [bignumber.js](https://github.com/MikeMcl/bignumber.js/) and [decimal.js](https://github.com/MikeMcl/decimal.js/). See [here](https://github.com/MikeMcl/big.js/wiki) for some notes on the difference between them.

## Install

The library is the single JavaScript file *big.js* or the ES module *big.mjs*.

### Browsers

Add Big to global scope:

```html
<script src='path/to/big.js'></script>
```

ES module:

```html
<script type='module'>
import Big from './path/to/big.mjs';
```

Get a minified version from a CDN:

```html
<script src='https://cdn.jsdelivr.net/npm/big.js@7.0.1/big.min.js'></script>
```

### [Node.js](http://nodejs.org)

```bash
$ npm install big.js
```

CommonJS:

```javascript
const Big = require('big.js');
```

ES module:

```javascript
import Big from 'big.js';
```

### [Deno](https://deno.land/)

```javascript
import Big from 'https://raw.githubusercontent.com/mikemcl/big.js/v7.0.1/big.mjs';
import Big from 'https://unpkg.com/big.js@latest/big.mjs';
```

## Use

*In the code examples below, semicolons and `toString` calls are not shown.*

The library exports a single constructor function, `Big`.

A Big number is created from a primitive number, string, or other Big number.

```javascript
x = new Big(123.4567)
y = Big('123456.7e-3')                 // 'new' is optional
z = new Big(x)
x.eq(y) && x.eq(z) && y.eq(z)          // true
```

In Big strict mode, creating a Big number from a primitive number is disallowed.

```javascript
Big.strict = true
x = new Big(1)                         // TypeError: [big.js] Invalid number
y = new Big('1.0000000000000001')
y.toNumber()                           // Error: [big.js] Imprecise conversion
```

A Big number is immutable in the sense that it is not changed by its methods.

```javascript
0.3 - 0.1                              // 0.19999999999999998
x = new Big(0.3)
x.minus(0.1)                           // "0.2"
x                                      // "0.3"
```

The methods that return a Big number can be chained.

```javascript
x.div(y).plus(z).times(9).minus('1.234567801234567e+8').plus(976.54321).div('2598.11772')
x.sqrt().div(y).pow(3).gt(y.mod(z))    // true
```

Like JavaScript's Number type, there are `toExponential`, `toFixed` and `toPrecision` methods.

```javascript
x = new Big(255.5)
x.toExponential(5)                     // "2.55500e+2"
x.toFixed(5)                           // "255.50000"
x.toPrecision(5)                       // "255.50"
```

The arithmetic methods always return the exact result except `div`, `sqrt` and `pow`
(with negative exponent), as these methods involve division.

The maximum number of decimal places and the rounding mode used to round the results of these methods is determined by the value of the `DP` and `RM` properties of the `Big` number constructor.

```javascript
Big.DP = 10
Big.RM = Big.roundHalfUp

x = new Big(2);
y = new Big(3);
z = x.div(y)                           // "0.6666666667"
z.sqrt()                               // "0.8164965809"
z.pow(-3)                              // "3.3749999995"
z.times(z)                             // "0.44444444448888888889"
z.times(z).round(10)                   // "0.4444444445"
```

The value of a Big number is stored in a decimal floating point format in terms of a coefficient, exponent and sign.

```javascript
x = new Big(-123.456);
x.c                                    // [1,2,3,4,5,6]    coefficient (i.e. significand)
x.e                                    // 2                exponent
x.s                                    // -1               sign
```

For advanced usage, multiple Big number constructors can be created, each with an independent configuration.

For further information see the [API](http://mikemcl.github.io/big.js/) reference documentation.

## Minify

To minify using, for example, npm and [terser](https://github.com/terser/terser)

```bash
$ npm install -g terser
```

```bash
$ terser big.js -c -m -o big.min.js
```

## Test

The *test* directory contains the test scripts for each Big number method.

The tests can be run with Node.js or a browser.

Run all the tests:

```bash
$ npm test
```

Test a single method:

```bash
$ node test/toFixed
```

For the browser, see *runner.html* and *test.html* in the *test/browser* directory.

*big-vs-number.html* is a old application that enables some of the methods of big.js to be compared with those of JavaScript's Number type.

## TypeScript

The [DefinitelyTyped](https://github.com/borisyankov/DefinitelyTyped) project has a Typescript type definitions file for big.js.

```bash
$ npm install --save-dev @types/big.js
```

Any questions about the TypeScript type definitions file should be addressed to the DefinitelyTyped project.

## Licence

[MIT](LICENCE.md)

## Contributors

<a href="graphs/contributors"><img src="https://opencollective.com/bigjs/contributors.svg?width=890&button=false" /></a>

## Financial supporters

Thank you to all who have supported this project via [Open Collective](https://opencollective.com/bigjs), particularly [Coinbase](https://www.coinbase.com/).

<img src="https://opencollective.com/bigjs/sponsor/0/avatar.svg">
