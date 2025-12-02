export class PipeableTransformStream<I, O> extends TransformStream<I, O> {
  constructor(transform: (readable: ReadableStream<I>) => ReadableStream<O>) {
    super();
    const readable = transform(super.readable as unknown as ReadableStream<I>);
    Object.defineProperty(this, "readable", {
      value: readable,
      writable: false,
    });
  }
}
