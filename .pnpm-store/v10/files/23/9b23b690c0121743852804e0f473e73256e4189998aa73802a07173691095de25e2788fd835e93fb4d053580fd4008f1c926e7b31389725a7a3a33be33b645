<!-- NOTE: README.md is generated from src/README.md -->

# @codemirror/lang-php [![NPM version](https://img.shields.io/npm/v/@codemirror/lang-php.svg)](https://www.npmjs.org/package/@codemirror/lang-php)

[ [**WEBSITE**](https://codemirror.net/) | [**ISSUES**](https://github.com/codemirror/dev/issues) | [**FORUM**](https://discuss.codemirror.net/c/next/) | [**CHANGELOG**](https://github.com/codemirror/lang-php/blob/main/CHANGELOG.md) ]

This package implements PHP language support for the
[CodeMirror](https://codemirror.net/) code editor.

The [project page](https://codemirror.net/) has more information, a
number of [examples](https://codemirror.net/examples/) and the
[documentation](https://codemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/codemirror/lang-php/tree/main/LICENSE).

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

## Usage

```javascript
import {EditorView, basicSetup} from "codemirror"
import {php} from "@codemirror/lang-php"

const view = new EditorView({
  parent: document.body,
  doc: `<? echo "Hello world" ?>`,
  extensions: [basicSetup, php()]
})
```

## API Reference

<dl>
<dt id="user-content-php">
  <code><strong><a href="#user-content-php">php</a></strong>(<a id="user-content-php^config" href="#user-content-php^config">config</a>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object">Object</a> = {}) → <a href="https://codemirror.net/docs/ref#language.LanguageSupport">LanguageSupport</a></code></dt>

<dd><p>PHP language support.</p>
<dl><dt id="user-content-php^config">
  <code><strong><a href="#user-content-php^config">config</a></strong></code></dt>

<dd><dl><dt id="user-content-php^config.baselanguage">
  <code><strong><a href="#user-content-php^config.baselanguage">baseLanguage</a></strong>&#8288;?: <a href="https://codemirror.net/docs/ref#language.Language">Language</a></code></dt>

<dd><p>By default, the parser will treat content outside of <code>&lt;?</code> and
<code>?&gt;</code> markers as HTML. You can pass a different language here to
change that. Explicitly passing disables parsing of such content.</p>
</dd><dt id="user-content-php^config.plain">
  <code><strong><a href="#user-content-php^config.plain">plain</a></strong>&#8288;?: <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean">boolean</a></code></dt>

<dd><p>By default, PHP parsing only starts at the first <code>&lt;?</code> marker.
When you set this to true, it starts immediately at the start of
the document.</p>
</dd></dl></dd></dl></dd>
<dt id="user-content-phplanguage">
  <code><strong><a href="#user-content-phplanguage">phpLanguage</a></strong>: <a href="https://codemirror.net/docs/ref#language.LRLanguage">LRLanguage</a></code></dt>

<dd><p>A language provider based on the <a href="https://github.com/lezer-parser/php">Lezer PHP
parser</a>, extended with
highlighting and indentation information.</p>
</dd>
</dl>
