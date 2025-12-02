[![view on npm](https://badgen.net/npm/v/typical)](https://www.npmjs.org/package/typical)
[![npm module downloads](https://badgen.net/npm/dt/typical)](https://www.npmjs.org/package/typical)
[![Gihub repo dependents](https://badgen.net/github/dependents-repo/75lb/typical)](https://github.com/75lb/typical/network/dependents?dependent_type=REPOSITORY)
[![Gihub package dependents](https://badgen.net/github/dependents-pkg/75lb/typical)](https://github.com/75lb/typical/network/dependents?dependent_type=PACKAGE)
[![Node.js CI](https://github.com/75lb/typical/actions/workflows/node.js.yml/badge.svg)](https://github.com/75lb/typical/actions/workflows/node.js.yml)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/feross/standard)

<a name="module_typical"></a>

## typical
Isomorphic, functional type-checking for Javascript.

**Example**  
```js
import t from 'typical'
const allDefined = array.every(t.isDefined)
```

* [typical](#module_typical)
    * [.isNumber(n)](#module_typical.isNumber) ⇒ <code>boolean</code>
    * [.isFiniteNumber(n)](#module_typical.isFiniteNumber) ⇒ <code>boolean</code>
    * [.isPlainObject(input)](#module_typical.isPlainObject) ⇒ <code>boolean</code>
    * [.isArrayLike(input)](#module_typical.isArrayLike) ⇒ <code>boolean</code>
    * [.isObject(input)](#module_typical.isObject) ⇒ <code>boolean</code>
    * [.isDefined(input)](#module_typical.isDefined) ⇒ <code>boolean</code>
    * [.isUndefined(input)](#module_typical.isUndefined) ⇒ <code>boolean</code>
    * [.isNull(input)](#module_typical.isNull) ⇒ <code>boolean</code>
    * [.isDefinedValue(input)](#module_typical.isDefinedValue) ⇒ <code>boolean</code>
    * [.isClass(input)](#module_typical.isClass) ⇒ <code>boolean</code>
    * [.isPrimitive(input)](#module_typical.isPrimitive) ⇒ <code>boolean</code>
    * [.isPromise(input)](#module_typical.isPromise) ⇒ <code>boolean</code>
    * [.isIterable(input)](#module_typical.isIterable) ⇒ <code>boolean</code>
    * [.isString(input)](#module_typical.isString) ⇒ <code>boolean</code>
    * [.isFunction(input)](#module_typical.isFunction) ⇒ <code>boolean</code>
    * [.isAsyncFunction(input)](#module_typical.isAsyncFunction) ⇒ <code>boolean</code>

<a name="module_typical.isNumber"></a>

### t.isNumber(n) ⇒ <code>boolean</code>
Returns true if input is a number (including infinity). It is a more reasonable alternative to `typeof n` which returns `number` for `NaN`.

**Kind**: static method of [<code>typical</code>](#module_typical)  
**Returns**: <code>boolean</code> - `true` if input is a number  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>\*</code> | The input to test |

**Example**  
```js
> t.isNumber(0)
true
> t.isNumber(1)
true
> t.isNumber(1.1)
true
> t.isNumber(0xff)
true
> t.isNumber(0644)
true
> t.isNumber(6.2e5)
true
> t.isNumber(NaN)
false
> t.isNumber(Infinity)
true
```
<a name="module_typical.isFiniteNumber"></a>

### t.isFiniteNumber(n) ⇒ <code>boolean</code>
Returns true if input is a finite number. Identical to `isNumber` beside excluding infinity.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>\*</code> | The input to test |

**Example**  
```js
> t.isFiniteNumber(0)
true
> t.isFiniteNumber(1)
true
> t.isFiniteNumber(1.1)
true
> t.isFiniteNumber(0xff)
true
> t.isFiniteNumber(0644)
true
> t.isFiniteNumber(6.2e5)
true
> t.isFiniteNumber(NaN)
false
> t.isFiniteNumber(Infinity)
false
```
<a name="module_typical.isPlainObject"></a>

### t.isPlainObject(input) ⇒ <code>boolean</code>
A plain object is a simple object literal, it is not an instance of a class. Returns true if the input `typeof` is `object` and directly decends from `Object`.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

**Example**  
```js
> t.isPlainObject({ something: 'one' })
true
> t.isPlainObject(new Date())
false
> t.isPlainObject([ 0, 1 ])
false
> t.isPlainObject(/test/)
false
> t.isPlainObject(1)
false
> t.isPlainObject('one')
false
> t.isPlainObject(null)
false
> t.isPlainObject((function * () {})())
false
> t.isPlainObject(function * () {})
false
```
<a name="module_typical.isArrayLike"></a>

### t.isArrayLike(input) ⇒ <code>boolean</code>
An array-like value has all the properties of an array yet is not an array instance. An example is the `arguments` object. Returns `true`` if the input value is an object, not `null`` and has a `length` property set with a numeric value.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

**Example**  
```js
function sum(x, y){
  console.log(t.isArrayLike(arguments))
  // prints `true`
}
```
<a name="module_typical.isObject"></a>

### t.isObject(input) ⇒ <code>boolean</code>
Returns true if the typeof input is `'object'` but not null.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

<a name="module_typical.isDefined"></a>

### t.isDefined(input) ⇒ <code>boolean</code>
Returns true if the input value is defined.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

<a name="module_typical.isUndefined"></a>

### t.isUndefined(input) ⇒ <code>boolean</code>
Returns true if the input value is undefined.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

<a name="module_typical.isNull"></a>

### t.isNull(input) ⇒ <code>boolean</code>
Returns true if the input value is null.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

<a name="module_typical.isDefinedValue"></a>

### t.isDefinedValue(input) ⇒ <code>boolean</code>
Returns true if the input value is not one of `undefined`, `null`, or `NaN`.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

<a name="module_typical.isClass"></a>

### t.isClass(input) ⇒ <code>boolean</code>
Returns true if the input value is an ES2015 `class`.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

<a name="module_typical.isPrimitive"></a>

### t.isPrimitive(input) ⇒ <code>boolean</code>
Returns true if the input is a string, number, symbol, boolean, null or undefined value.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

<a name="module_typical.isPromise"></a>

### t.isPromise(input) ⇒ <code>boolean</code>
Returns true if the input is a Promise.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

<a name="module_typical.isIterable"></a>

### t.isIterable(input) ⇒ <code>boolean</code>
Returns true if the input is an iterable (`Map`, `Set`, `Array`, Generator etc.).

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

**Example**  
```js
> t.isIterable('string')
true
> t.isIterable(new Map())
true
> t.isIterable([])
true
> t.isIterable((function * () {})())
true
> t.isIterable(Promise.resolve())
false
> t.isIterable(Promise)
false
> t.isIterable(true)
false
> t.isIterable({})
false
> t.isIterable(0)
false
> t.isIterable(1.1)
false
> t.isIterable(NaN)
false
> t.isIterable(Infinity)
false
> t.isIterable(function () {})
false
> t.isIterable(Date)
false
> t.isIterable()
false
> t.isIterable({ then: function () {} })
false
```
<a name="module_typical.isString"></a>

### t.isString(input) ⇒ <code>boolean</code>
Returns true if the input value is a string. The equivalent of `typeof input === 'string'` for use in funcitonal contexts.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

<a name="module_typical.isFunction"></a>

### t.isFunction(input) ⇒ <code>boolean</code>
Returns true if the input value is a function. The equivalent of `typeof input === 'function'` for use in funcitonal contexts.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

<a name="module_typical.isAsyncFunction"></a>

### t.isAsyncFunction(input) ⇒ <code>boolean</code>
Returns true if the input value is an async function or method.

**Kind**: static method of [<code>typical</code>](#module_typical)  

| Param | Type | Description |
| --- | --- | --- |
| input | <code>\*</code> | The input to test |

**Example**  
```js
> t.isAsyncFunction(function () {})
false
> t.isAsyncFunction(new Function())
false
> t.isAsyncFunction(() => {})
false
> t.isAsyncFunction(async function () {})
true
> const AsyncFunction = async function () {}.constructor
> t.isAsyncFunction(new AsyncFunction())
true
> t.isAsyncFunction(async () => {})
true
> class Command { async execute () {} }
> t.isAsyncFunction(new Command().execute)
true
```

## Load anywhere

This library is compatible with Node.js, the Web and any style of module loader. It can be loaded anywhere, natively without transpilation.

Within a Node.js ECMAScript Module:

```js
import t from 'typical'
import { isNumber } from 'typical'
```

CommonJS:

```js
const t = require('typical')
const { isNumber } = require('typical')
```

Within a modern browser ECMAScript Module:

```js
import t from './node_modules/typical/index.js'
```

* * *

&copy; 2014-25 Lloyd Brookes \<opensource@75lb.com\>.

Test suite by [test-runner](https://github.com/test-runner-js/test-runner). Documented by [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown).
