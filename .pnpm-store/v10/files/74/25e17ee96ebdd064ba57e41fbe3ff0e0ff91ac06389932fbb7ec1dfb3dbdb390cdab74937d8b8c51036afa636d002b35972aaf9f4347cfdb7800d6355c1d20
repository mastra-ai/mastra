<!-- NOTE: README.md is generated from src/README.md -->

# @codemirror/lang-rust [![NPM version](https://img.shields.io/npm/v/@codemirror/lang-rust.svg)](https://www.npmjs.org/package/@codemirror/lang-rust)

[ [**WEBSITE**](https://codemirror.net/) | [**ISSUES**](https://github.com/codemirror/dev/issues) | [**FORUM**](https://discuss.codemirror.net/c/next/) | [**CHANGELOG**](https://github.com/codemirror/lang-rust/blob/main/CHANGELOG.md) ]

This package implements Rust language support for the
[CodeMirror](https://codemirror.net/) code editor.

The [project page](https://codemirror.net/) has more information, a
number of [examples](https://codemirror.net/examples/) and the
[documentation](https://codemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/codemirror/lang-rust/tree/main/LICENSE).

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

## Usage

```javascript
import {EditorView, basicSetup} from "codemirror"
import {rust} from "@codemirror/lang-rust"

const view = new EditorView({
  parent: document.body,
  doc: `println!("Hello World!");`,
  extensions: [basicSetup, rust()]
})
```

## API Reference

<dl>
<dt id="user-content-rust">
  <code><strong><a href="#user-content-rust">rust</a></strong>() → <a href="https://codemirror.net/docs/ref#language.LanguageSupport">LanguageSupport</a></code></dt>

<dd><p>Rust language support</p>
</dd>
<dt id="user-content-rustlanguage">
  <code><strong><a href="#user-content-rustlanguage">rustLanguage</a></strong>: <a href="https://codemirror.net/docs/ref#language.LRLanguage">LRLanguage</a></code></dt>

<dd><p>A syntax provider based on the <a href="https://github.com/lezer-parser/rust">Lezer Rust
parser</a>, extended with
highlighting and indentation information.</p>
</dd>
</dl>
