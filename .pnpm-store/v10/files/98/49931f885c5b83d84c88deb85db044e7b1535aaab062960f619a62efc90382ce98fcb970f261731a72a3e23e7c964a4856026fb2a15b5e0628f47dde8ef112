# codemirror [![NPM version](https://img.shields.io/npm/v/codemirror)](https://www.npmjs.org/package/codemirror)

[ [**WEBSITE**](https://codemirror.net/) | [**DOCS**](https://codemirror.net/docs/ref/#codemirror) | [**ISSUES**](https://github.com/codemirror/dev/issues) | [**FORUM**](https://discuss.codemirror.net/c/next/) | [**CHANGELOG**](https://github.com/codemirror/basic-setup/blob/main/CHANGELOG.md) ]

This package provides an example configuration for the
[CodeMirror](https://codemirror.net/) code editor. The actual editor
is implemented in the various packages under the `@codemirror` scope,
which this package depends on.

The [project page](https://codemirror.net/) has more information, a
number of [examples](https://codemirror.net/examples/) and the
[documentation](https://codemirror.net/docs/).

This code is released under an
[MIT license](https://github.com/codemirror/basic-setup/tree/main/LICENSE).

We aim to be an inclusive, welcoming community. To make that explicit,
we have a [code of
conduct](http://contributor-covenant.org/version/1/1/0/) that applies
to communication around the project.

## Usage

```javascript
import {EditorView, basicSetup} from "codemirror"

const view = new EditorView({
  parent: document.body,
  doc: "Hello",
  extensions: [basicSetup /* ... */]
})
```

This sets up a basic code editor containing the word "Hello". You'll
usually want to add at least a [language
mode](https://codemirror.net/#languages) to your configuration.
