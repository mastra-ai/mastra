[![view on npm](https://badgen.net/npm/v/wordwrapjs)](https://www.npmjs.org/package/wordwrapjs)
[![npm module downloads](https://badgen.net/npm/dt/wordwrapjs)](https://www.npmjs.org/package/wordwrapjs)
[![Gihub repo dependents](https://badgen.net/github/dependents-repo/75lb/wordwrapjs)](https://github.com/75lb/wordwrapjs/network/dependents?dependent_type=REPOSITORY)
[![Gihub package dependents](https://badgen.net/github/dependents-pkg/75lb/wordwrapjs)](https://github.com/75lb/wordwrapjs/network/dependents?dependent_type=PACKAGE)
[![Node.js CI](https://github.com/75lb/wordwrapjs/actions/workflows/node.js.yml/badge.svg)](https://github.com/75lb/wordwrapjs/actions/workflows/node.js.yml)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/feross/standard)

# wordwrapjs

Word wrapping for plain text.

## Synopsis

Wrap some text in a 20 character column.

```js
import wordwrap from 'wordwrapjs'

const text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
const result = wordwrap.wrap(text, { width: 20 })
```

`result` now looks like this:
```
Lorem ipsum dolor
sit amet,
consectetur
adipiscing elit, sed
do eiusmod tempor
incididunt ut labore
et dolore magna
aliqua.
```

Force long words to wrap by setting the `break` flag.

```
Welcome to Node.js v16.6.2.
> wrap = require('wordwrapjs')

> url = 'https://github.com/75lb/wordwrapjs'
> wrap.lines(url, { width: 18 })
[ 'https://github.com/75lb/wordwrapjs' ]

> wrap.lines(url, { width: 18, break: true })
[ 'https://github.com', '/75lb/wordwrapjs' ]
```

## Load anywhere

This library is compatible with Node.js, the Web and any style of module loader. It can be loaded anywhere, natively without transpilation.

Node.js:

```js
const wordwrap = require('wordwrapjs')
```

Within Node.js with ECMAScript Module support enabled:

```js
import wordwrap from 'wordwrapjs'
```

Within an modern browser ECMAScript Module:

```js
import wordwrap from './node_modules/wordwrapjs/dist/index.mjs'
```

Old browser (adds `window.wordwrapjs`):

```html
<script nomodule src="./node_modules/wordwrapjs/dist/index.js"></script>
```

## API Reference


* [wordwrapjs](#module_wordwrapjs)
    * [Wordwrap](#exp_module_wordwrapjs--Wordwrap) ⏏
        * [new Wordwrap(text, [options])](#new_module_wordwrapjs--Wordwrap_new)
        * _static_
            * [.wrap(text, [options])](#module_wordwrapjs--Wordwrap.wrap)
            * [.lines(text, [options])](#module_wordwrapjs--Wordwrap.lines)
            * [.isWrappable(text)](#module_wordwrapjs--Wordwrap.isWrappable) ⇒ <code>boolean</code>
            * [.getChunks(text)](#module_wordwrapjs--Wordwrap.getChunks) ⇒ <code>Array.&lt;string&gt;</code>
        * _inner_
            * [~WordwrapOptions](#module_wordwrapjs--Wordwrap..WordwrapOptions) : <code>Object</code>

<a name="exp_module_wordwrapjs--Wordwrap"></a>

### Wordwrap ⏏
**Kind**: Exported class  
<a name="new_module_wordwrapjs--Wordwrap_new"></a>

#### new Wordwrap(text, [options])

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | The input text to wrap. |
| [options] | [<code>WordwrapOptions</code>](#module_wordwrapjs--Wordwrap..WordwrapOptions) |  |

<a name="module_wordwrapjs--Wordwrap.wrap"></a>

#### Wordwrap.wrap(text, [options])
**Kind**: static method of [<code>Wordwrap</code>](#exp_module_wordwrapjs--Wordwrap)  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | the input text to wrap |
| [options] | [<code>WordwrapOptions</code>](#module_wordwrapjs--Wordwrap..WordwrapOptions) |  |

<a name="module_wordwrapjs--Wordwrap.lines"></a>

#### Wordwrap.lines(text, [options])
Wraps the input text, returning an array of strings (lines).

**Kind**: static method of [<code>Wordwrap</code>](#exp_module_wordwrapjs--Wordwrap)  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | input text |
| [options] | [<code>WordwrapOptions</code>](#module_wordwrapjs--Wordwrap..WordwrapOptions) |  |

<a name="module_wordwrapjs--Wordwrap.isWrappable"></a>

#### Wordwrap.isWrappable(text) ⇒ <code>boolean</code>
Returns true if the input text would be wrapped if passed into `.wrap()`.

**Kind**: static method of [<code>Wordwrap</code>](#exp_module_wordwrapjs--Wordwrap)  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | input text |

<a name="module_wordwrapjs--Wordwrap.getChunks"></a>

#### Wordwrap.getChunks(text) ⇒ <code>Array.&lt;string&gt;</code>
Splits the input text into an array of words and whitespace.

**Kind**: static method of [<code>Wordwrap</code>](#exp_module_wordwrapjs--Wordwrap)  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | input text |

<a name="module_wordwrapjs--Wordwrap..WordwrapOptions"></a>

#### Wordwrap~WordwrapOptions : <code>Object</code>
Wordwrap options.

**Kind**: inner typedef of [<code>Wordwrap</code>](#exp_module_wordwrapjs--Wordwrap)  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [width] | <code>number</code> | <code>30</code> | The max column width in characters. |
| [break] | <code>boolean</code> | <code>false</code> | If true, words exceeding the specified `width` will be forcefully broken |
| [noTrim] | <code>boolean</code> | <code>false</code> | By default, each line output is trimmed. If `noTrim` is set, no line-trimming occurs - all whitespace from the input text is left in. |
| [eol] | <code>string</code> | <code>&quot;&#x27;\\n&#x27;&quot;</code> | The end of line character to use. Defaults to `\n`. |


* * *

&copy; 2015-25 Lloyd Brookes \<opensource@75lb.com\>. Documented by [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown).
