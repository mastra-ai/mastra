# is-stream-ended
> Check if a stream has ended.

```sh
$ npm install --save is-stream-ended
```
```js
var isStreamEnded = require('is-stream-ended');

isStreamEnded(stream); // false
stream.end();
isStreamEnded(stream); // true
```

### isStreamEnded(stream)

#### stream

- Type: `Stream`, `Object`

Providing a stream will check against the `stream._readableState` object. To check from the `_writableState`, provide that object directly.
