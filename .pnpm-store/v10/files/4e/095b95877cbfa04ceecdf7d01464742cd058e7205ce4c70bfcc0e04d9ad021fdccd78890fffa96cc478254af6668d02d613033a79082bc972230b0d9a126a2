// src/core/utils/stream/PipeableTransformStream.ts
var PipeableTransformStream = class extends TransformStream {
  constructor(transform) {
    super();
    const readable = transform(super.readable);
    Object.defineProperty(this, "readable", {
      value: readable,
      writable: false
    });
  }
};
export {
  PipeableTransformStream
};
//# sourceMappingURL=PipeableTransformStream.js.map