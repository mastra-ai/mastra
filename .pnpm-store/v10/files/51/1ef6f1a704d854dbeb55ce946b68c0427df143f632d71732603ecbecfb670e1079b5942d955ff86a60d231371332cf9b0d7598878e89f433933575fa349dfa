# JSON11 – JSON for Humans

JSON11 is an extension to the popular [JSON] and [JSON5] file formats. With the right
options, it can be used for machine-to-machine communication.

JSON11 extends the **[JSON5 Data Interchange Format](https://spec.json5.org/)** which is
itself a superset of JSON (so valid JSON and JSON5 files will always be valid JSON11 files),
to include some productions from [ECMAScript 11] (ES11).
It's also a _subset_ of ES11, so valid JSON11 files will always be valid ES11.[*](#ecmascript-compatibility)

[JSON]: https://tools.ietf.org/html/rfc715

[JSON5]: https://json5.org/

[ECMAScript 11]: https://262.ecma-international.org/11.0/

## Summary of Features
The following ECMAScript 11 features, which are not supported in JSON or JSON5, 
have been extended to JSON11.

### Numbers
- Long numerals may be parsed as BigInts.

### BigInts
- Arbitrary precision integers can be serialized.

The following ECMAScript 5.1 features, which are not supported in JSON, have
been inherited from JSON5.

### Objects
- Object keys may be an ECMAScript 5.1 _[IdentifierName]_.
- Objects may have a single trailing comma.

### Arrays
- Arrays may have a single trailing comma.

### Strings
- Strings may be single quoted.
- Strings may span multiple lines by escaping new line characters.
- Strings may include character escapes.

### Numbers
- Numbers may be hexadecimal.
- Numbers may have a leading or trailing decimal point.
- Numbers may be [IEEE 754] positive infinity, negative infinity, and NaN.
- Numbers may begin with an explicit plus sign.

### Comments
- Single and multi-line comments are allowed.

### White Space
- Additional white space characters are allowed.

[IdentifierName]: https://www.ecma-international.org/ecma-262/5.1/#sec-7.6

[IEEE 754]: http://ieeexplore.ieee.org/servlet/opac?punumber=4610933

## Example
Kitchen-sink example:

```json5
{
  // comments
  unquoted: 'and you can quote me on that',
  singleQuotes: 'I can use "double quotes" here',
  lineBreaks: "Look, Mom! \
No \\n's!",
  hexadecimal: 0xdecaf,
  leadingDecimalPoint: .8675309, andTrailing: 8675309.,
  positiveSign: +1,
  trailingComma: 'in objects', andIn: ['arrays',],
  "backwardsCompatible": "with JSON",
  "longNumeral": 1186694007922679455n
}
```

## Installation and Usage
### Node.js
```sh
npm install json11
```

#### CommonJS
```js
const JSON11 = require('json11')
```

#### Modules
```js
import JSON11 from 'json11'
```

### Browsers
#### UMD
```html
<!-- This will create a global `JSON11` variable. -->
<script src="https://unpkg.com/json11/dist/umd/index.min.js"></script>
```

#### Modules
```html
<script type="module">
  import JSON11 from 'https://unpkg.com/json11/dist/es/index.min.mjs'
</script>
```

## API
The JSON11 API is compatible with the [JSON API].

[JSON API]:
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON

### JSON11.parse()
Parses a JSON11 string, constructing the JavaScript value or object described by
the string. An optional reviver function can be provided to perform a
transformation on the resulting object before it is returned.

#### Syntax
    JSON11.parse(text[, reviver, [options]])

#### Parameters
- `text`: The string to parse as JSON11.
- `reviver`: If a function, this prescribes how the value originally produced by
  parsing is transformed, before being returned.
- `options`: An object with the following properties:
  - `withLongNumerals`: (false) To parse integers beyond safe limits as BigInt.

#### Return value
The object corresponding to the given JSON11 text.

### JSON11.stringify()
Converts a JavaScript value to a JSON11 string, optionally replacing values if a
replacer function is specified, or optionally including only the specified
properties if a replacer array is specified.

#### Syntax
    JSON11.stringify(value[, replacer[, space]])
    JSON11.stringify(value[, options])

#### Parameters
- `value`: The value to convert to a JSON11 string.
- `replacer`: A function that alters the behavior of the stringification
  process, or an array of String and Number objects that serve as a whitelist
  for selecting/filtering the properties of the value object to be included in
  the JSON11 string. If this value is null or not provided, all properties of the
  object are included in the resulting JSON11 string.
- `space`: A String or Number object that's used to insert white space into the
  output JSON11 string for readability purposes. If this is a Number, it
  indicates the number of space characters to use as white space; this number is
  capped at 10 (if it is greater, the value is just 10). Values less than 1
  indicate that no space should be used. If this is a String, the string (or the
  first 10 characters of the string, if it's longer than that) is used as white
  space. If this parameter is not provided (or is null), no white space is used.
  If white space is used, trailing commas will be used in objects and arrays.
- `options`: An object with the following properties:
  - `replacer`: Same as the `replacer` parameter.
  - `space`: Same as the `space` parameter.
  - `quote`: A String representing the quote character to use when serializing
    strings.
  - `quoteNames`: (false) Force wrapping property names in quotes.
  - `withBigInt`: (true) Serialize BigInt values with the 'n' suffix

#### Return value
A JSON11 string representing the value.


## CLI
Since JSON is more widely used than JSON11, this package includes a CLI for
converting JSON11 to JSON and for validating the syntax of JSON11 documents.

### Installation
```sh
npm install --global json11
```

### Usage
```sh
json5 [options] <file>
```

If `<file>` is not provided, then STDIN is used.

#### Options:
- `-s`, `--space`: The number of spaces to indent or `t` for tabs
- `-o`, `--out-file [file]`: Output to the specified file, otherwise STDOUT
- `-v`, `--validate`: Validate JSON11 but do not output JSON
- `-V`, `--version`: Output the version number
- `-h`, `--help`: Output usage information

## Contributing
### Development
Fork this repo and clone your fork. Install the dependencies with `npm i`.

When contributing code, please write relevant tests and run `npm test` and `npm
run lint` before submitting pull requests. Please use an editor that supports
[EditorConfig](http://editorconfig.org/).

### Issues
To report bugs or request features regarding this **JavaScript implementation**
of JSON11, please submit an issue to **_this_ repository**.

### Security Vulnerabilities and Disclosures
To report a security vulnerability, please follow the guidelines
described in our [security policy](./SECURITY.md).

## ECMAScript Compatibility
While JSON11 aims to be fully compatible with ES5, there is one exception where
both JSON and JSON11 are not. Both JSON and JSON11 allow unescaped line and
paragraph separator characters (U+2028 and U+2029) in strings, however ES5 does
not. A [proposal](https://github.com/tc39/proposal-json-superset) to allow these
characters in strings was adopted into ES2019, making JSON and JSON11 fully
compatible with ES2019.

## License
MIT. See [LICENSE.md](./LICENSE.md) for details.

## Credits
JSON5 contributors did the heavy lifting.
