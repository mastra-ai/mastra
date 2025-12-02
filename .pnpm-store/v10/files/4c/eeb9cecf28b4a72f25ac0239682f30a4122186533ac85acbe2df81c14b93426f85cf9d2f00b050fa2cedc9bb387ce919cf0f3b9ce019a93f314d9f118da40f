// src/core/AssistantStream.ts
var AssistantStream = {
  toResponse(stream, transformer) {
    return new Response(AssistantStream.toByteStream(stream, transformer), {
      headers: transformer.headers ?? {}
    });
  },
  fromResponse(response, transformer) {
    return AssistantStream.fromByteStream(response.body, transformer);
  },
  toByteStream(stream, transformer) {
    return stream.pipeThrough(transformer);
  },
  fromByteStream(readable, transformer) {
    return readable.pipeThrough(transformer);
  }
};
export {
  AssistantStream
};
//# sourceMappingURL=AssistantStream.js.map