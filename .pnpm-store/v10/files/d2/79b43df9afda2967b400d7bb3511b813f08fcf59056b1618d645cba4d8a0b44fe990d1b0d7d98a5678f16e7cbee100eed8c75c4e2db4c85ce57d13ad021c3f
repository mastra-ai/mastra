<!-- NOTE: README.md is generated from mode/README.md -->

# @codemirror/legacy-modes [![NPM version](https://img.shields.io/npm/v/@codemirror/legacy-modes.svg)](https://www.npmjs.org/package/@codemirror/legacy-modes)

[ [**WEBSITE**](https://codemirror.net/) | [**ISSUES**](https://github.com/codemirror/dev/issues) | [**FORUM**](https://discuss.codemirror.net/c/next/) | [**CHANGELOG**](https://github.com/codemirror/legacy-modes/blob/main/CHANGELOG.md) ]

This package implements a collection of ported [stream
language](https://codemirror.net/docs/ref#language.StreamParser) modes for
the [CodeMirror](https://codemirror.net/) code editor. Each mode is
available as a separate script file, under
`"@codemirror/legacy-modes/mode/[name]"`, and exports the values
listed below.

The [project page](https://codemirror.net/) has more information, a
number of [examples](https://codemirror.net/examples/) and the
[documentation](https://codemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/codemirror/legacy-modes/tree/main/LICENSE).

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

## Usage

Using modes from this package works like this:

 - Install this package and the
   [`@codemirror/language`](https://codemirror.net/docs/ref/#language)
   package.

 - Find the `StreamParser` instance you need in the reference below.

 - Add `StreamLanguage.define(theParser)` to your editor's
   configuration.

For example, to load the Lua mode, you'd do something like...

```javascript
import {StreamLanguage} from "@codemirror/language"
import {lua} from "@codemirror/legacy-modes/mode/lua"

import {EditorView, basicSetup} from "codemirror"

let view = new EditorView({
  extensions: [basicSetup, StreamLanguage.define(lua)]
})
```

## API Reference
