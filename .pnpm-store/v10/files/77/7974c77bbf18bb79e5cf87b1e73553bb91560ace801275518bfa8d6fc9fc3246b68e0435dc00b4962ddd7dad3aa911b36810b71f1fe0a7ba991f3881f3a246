# The flow-parser package

This package contains the Flow parser in its compiled-to-JavaScript form.

# What is Flow

See [flow.org](https://flow.org/). The code for the Flow parser [lives on GitHub](https://github.com/facebook/flow/tree/master/src/parser).

# What is the Flow Parser

The Flow Parser is a JavaScript parser written in OCaml. It produces an AST that conforms to the [ESTree spec](https://github.com/estree/estree) and that mostly matches what [esprima](http://esprima.org/) produces. The Flow Parser can be compiled to native code or can be compiled to JavaScript using [js_of_ocaml](http://ocsigen.org/js_of_ocaml/). This npm package contains the Flow parser compiled to JavaScript.

# Usage

You can use the Flow parser in your browser or in node. To use in node you can just do

```JavaScript
require('flow-parser').parse('1+1', {});
```

To use in the browser, you can add

```HTML
<script src="flow_parser.js"></script>
```

which will make the `flow` object available to use like so:

```JavaScript
flow.parse('1+1', {});
```

## Options

The second argument to `flow.parse` is the options object. Currently supported options:

### Basic options
* `types` (boolean, default `true`) - enable parsing of Flow types
* `use_strict` (boolean, default `false`) - treat the file as strict, without needing a "use strict" directive
* `comments` (boolean, default `true`) - attach comments to AST nodes (`leadingComments` and `trailingComments`)
* `all_comments` (boolean, default `true`) - include a list of all comments from the whole program
* `tokens` (boolean, default `false`) - include a list of all parsed tokens in a top-level `tokens` property

### Language features
* `enums` (boolean, default `false`) - enable parsing of [enums](https://flow.org/en/docs/enums/)
* `match` (boolean, default `false`) - enable parsing of [match expressions and match statements](https://flow.org/en/docs/match/)
* `components` (boolean, default `false`) - enable parsing of [component syntax](https://flow.org/en/docs/react/component-syntax/)
* `assert_operator` (boolean, default `false`) - enable parsing of the assert operator
* `esproposal_decorators` (boolean, default `false`) - enable parsing of decorators
