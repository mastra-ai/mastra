import { createParser } from './index.js';
class EventSourceParserStream extends TransformStream {
  constructor() {
    let parser;
    super({
      start(controller) {
        parser = createParser(event => {
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
export { EventSourceParserStream };
//# sourceMappingURL=stream.js.map
