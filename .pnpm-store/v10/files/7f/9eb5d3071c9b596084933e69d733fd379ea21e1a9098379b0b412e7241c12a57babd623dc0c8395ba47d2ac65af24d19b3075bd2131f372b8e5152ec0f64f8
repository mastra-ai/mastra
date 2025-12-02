# outdent

## Removes leading indentation from ES6 template strings

[![Build Status](https://travis-ci.org/cspotcode/outdent.svg?branch=master)](https://travis-ci.org/cspotcode/outdent) [![typings included](https://img.shields.io/badge/typings-included-brightgreen.svg)](#typescript-declarations)

ES6 template strings are great, but they preserve everything between the backticks, including leading spaces.
Sometimes I want to indent my template literals to make my code more readable without including all those spaces in the
string.

Outdent will remove those leading spaces, as well as the leading and trailing newlines.

### Usage

Import **outdent** using your module system of choice.

CommonJS:
```javascript
const outdent = require('outdent');
```

ES6 Modules & TypeScript:
```javascript
import outdent from 'outdent';
```

#### Examples

```javascript
import outdent from 'outdent';

const markdown = outdent`
    # My Markdown File

    Here is some indented code:

        console.log("hello world!");
`;

console.log(markdown);

fs.writeFileSync('output.md', markdown);
```

The contents of `output.md` do not have the leading indentation:

```markdown
# My Markdown File

Here is some indented code:

    console.log("hello world!");
```

As a JavaScript string:

```javascript
var markdown = '# My Markdown File\n' +
               '\n' +
               'Here is some indented code:' +
               '\n' +
               '    console.log("hello world!");';
```

You can pass options to **outdent** to control its behavior. They are explained in [Options](#options).

```javascript
const output = outdent({trimLeadingNewline: false, trimTrailingNewline: false})`
    Hello world!
`;

assert(output === '\nHello world!\n');
```

You can explicitly specify the indentation level by passing `outdent` as the first interpolated value. Its position sets the indentation level and it is removed from the output:

```javascript
const output = outdent`
      ${outdent}
        Yo
    12345
          Hello world
`;

assert(output === '  Yo\n345\n    Hello world');
```

*Note: `${outdent}` must be alone on its own line without anything before or after it. It cannot be preceded by any non-whitespace characters.*
*If these conditions are not met, outdent will follow normal indentation-detection behavior.*

Outdent can also remove indentation from plain strings via the `string` method.

```javascript
const output = outdent.string('\n    Hello world!\n');

assert(output === 'Hello world!');
```

### Options

#### `trimLeadingNewline`
*Default: true*

#### `trimTrailingNewline`
*Default: true*

Whether or not outdent should remove the leading and/or trailing newline from your template string.  For example:

```javascript
var s = outdent({trimLeadingNewline: false})`
    Hello
`;

assert(s === '\nHello');

s = outdent({trimTrailingNewline: false})`
    Hello
`

assert(s === 'Hello\n');

s = outdent({trimLeadingNewline: false, trimTrailingNewline: false})`

`;

assert(s === '\n\n');
```

<!--
#### `pass`

Returns an arguments array that can be passed to another tagging function, instead of returning a string.

For example, say you want to use outdent with the following code:

```javascript
function query(barVal) {
    return prepareSql`
SELECT * from foo where bar = ${barVal}
    `;
}
```

`prepareSql` is expecting to receive a strings array and all interpolated values so that it can create a safe SQL
query.  To add outdent into the mix, we
must set `pass: true` and splat the result into `prepareSql`.

```javascript
var odRaw = outdent({pass: true});
function query(barVal) {
    return prepareSql(...odRaw`
        SELECT * from foo where bar = ${barVal}
    `)
}
```

*This is a contrived example because SQL servers don't care about indentation.  But perhaps the result is
being logged and looks better without indentation?  Perhaps you're doing something totally different with tagged
template strings? Regardless, the `pass` option is here in case you need it. :-)*

-->

### Gotchas

#### Start on a new line

Start the contents of your template string on a new line *after* the opening backtick.  Otherwise, outdent
has no choice but to detect indentation from the *second* line, which does not work in all situations.

```javascript
// Bad
const output = outdent `* item 1
                          * sub-item
`;
// output === '* item 1\n* sub-item'; Indentation of sub-item is lost

// Good
const output = outdent `
    * item 1
      * sub-item
`;
```

#### Spaces and tabs

Spaces and tabs are treated identically. **outdent** does not verify that you are using spaces or tabs consistently; they
are all treated as a single character for the purpose of removing indentation. Spaces, tabs, and smart tabs should
all work correctly provided you use them consistently.

### TypeScript declarations

This module includes TypeScript type declarations so you will get code completion and error-checking without installing anything else.

<!--
### TODOs

[ ] Support tabs and/or smart tabs (verify they're being used correctly?  Throw an error if not?)
-->

### Questions or Bugs?

File an issue on Github: https://github.com/cspotcode/outdent/issues
