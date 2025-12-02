# URI Template

[![Node.js CI](https://github.com/grncdr/uri-template/actions/workflows/nodejs.yml/badge.svg)](https://github.com/grncdr/uri-template/actions/workflows/nodejs.yml)

This is a node.js implementation of the URI template draft standard
defined at http://tools.ietf.org/html/rfc6570

## Example

```javascript
var parser = require("uri-template");

var tpl = parser.parse("/{year}/{month}/{day}{?orderBy,direction}");

tpl.expand({ year: 2006, month: 6, day: 6 });
// /2006/6/6

tpl.expand({ year: 2006, month: 6, day: 6, orderBy: "size" });
// /2006/6/6?orderBy=size

tpl.expand({ year: 2006, month: 6, day: 6, orderBy: "time", direction: "asc" });
// /2006/6/6?orderBy=time&direction=asc

var queryTpl = parser.parse("/search{?q,otherParams*}");
queryTpl.expand({
  q: "Bigger office",
  otherParams: { prefer: "Sterling's office", accept: "Crane's office" },
});
// /search?q=Bigger%20office&prefer=Sterling%27s%20office&accept=Crane%27s%20office
```

For more thorough coverage of the syntax, see the [RFC](https://datatracker.ietf.org/doc/html/rfc6570).

## 
