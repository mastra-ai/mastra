# pct-encode

Create versions of strings where characters that match a regular expression are percent encoded.

## Synopsis

```javascript
var pctEncode = require("pct-encode");

var encode = pctEncode(/\W/g);

console.log(encode("UTF-8 in your URIs: ✓")); // UTF-8%20in%20your%20URIs%3A%20%E2%9C%93
```

## API

### module.exports = function (regexp) -> function encode(string)

Given a regular expression, this returns a function that takes a string and
returns a copy with characters that match `regexp` percent-encoded.
