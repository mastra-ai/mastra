<!-- NOTE: README.md is generated from src/README.md -->

# @codemirror/lang-cpp [![NPM version](https://img.shields.io/npm/v/@codemirror/lang-cpp.svg)](https://www.npmjs.org/package/@codemirror/lang-cpp)

[ [**WEBSITE**](https://codemirror.net/) | [**ISSUES**](https://github.com/codemirror/dev/issues) | [**FORUM**](https://discuss.codemirror.net/c/next/) | [**CHANGELOG**](https://github.com/codemirror/lang-cpp/blob/main/CHANGELOG.md) ]

This package implements C++ language support for the
[CodeMirror](https://codemirror.net/) code editor.

The [project page](https://codemirror.net/) has more information, a
number of [examples](https://codemirror.net/examples/) and the
[documentation](https://codemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/codemirror/lang-cpp/tree/main/LICENSE).

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

## Usage

```javascript
import {EditorView, basicSetup} from "codemirror"
import {cpp} from "@codemirror/lang-cpp"

const view = new EditorView({
  parent: document.body,
  doc: `for (int i = 0; i < 1024; i++)\n  cout << elt[i] << "\\n";`,
  extensions: [basicSetup, cpp()]
})
```

## API Reference

<dl>
<dt id="user-content-cpp">
  <code><strong><a href="#user-content-cpp">cpp</a></strong>() → <a href="https://codemirror.net/docs/ref#language.LanguageSupport">LanguageSupport</a></code></dt>

<dd><p>Language support for C++.</p>
</dd>
<dt id="user-content-cpplanguage">
  <code><strong><a href="#user-content-cpplanguage">cppLanguage</a></strong>: <a href="https://codemirror.net/docs/ref#language.LRLanguage">LRLanguage</a></code></dt>

<dd><p>A language provider based on the <a href="https://github.com/lezer-parser/cpp">Lezer C++
parser</a>, extended with
highlighting and indentation information.</p>
</dd>
</dl>
