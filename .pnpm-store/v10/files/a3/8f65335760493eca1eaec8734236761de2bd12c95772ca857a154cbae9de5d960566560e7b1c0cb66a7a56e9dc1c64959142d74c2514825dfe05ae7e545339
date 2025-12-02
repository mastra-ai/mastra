'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var index = require('./index.cjs');
class EventSourceParserStream extends TransformStream {
  constructor() {
    let parser;
    super({
      start(controller) {
        parser = index.createParser(event => {
          if (event.type === "event") {
            controller.enqueue(event);
          }
        });
      },
      transform(chunk) {
        parser.feed(chunk);
      }
    });
  }
}
exports.EventSourceParserStream = EventSourceParserStream;
//# sourceMappingURL=stream.cjs.map
