memory-stream
=============

Node.js streams implementation for buffered memory writes.

# Usage

```javascript
var fs = require('fs');
var MemoryStream = require('memory-stream');

var rs = fs.createReadStream('source.txt');
var ws = new MemoryStream();

ws.on('finish', function() {
  console.log(ws.toString());
});

rs.pipe(ws);
```