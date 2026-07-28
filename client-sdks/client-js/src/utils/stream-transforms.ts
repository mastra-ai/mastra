const RECORD_SEPARATOR = '\x1E';
const SSE_FRAME_SEPARATOR = /\r?\n\r?\n/;

/**
 * Parses UTF-8 JSON values delimited by the record separator character.
 */
export function createRecordSeparatorJsonTransform<T>(): TransformStream<ArrayBuffer, T> {
  const decoder = new TextDecoder();
  let buffer = '';

  const processCompleteRecords = (controller: TransformStreamDefaultController<T>) => {
    let separatorIndex = buffer.indexOf(RECORD_SEPARATOR);

    while (separatorIndex !== -1) {
      const record = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + RECORD_SEPARATOR.length);

      if (record) {
        controller.enqueue(JSON.parse(record) as T);
      }

      separatorIndex = buffer.indexOf(RECORD_SEPARATOR);
    }
  };

  return new TransformStream<ArrayBuffer, T>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      processCompleteRecords(controller);
    },
    flush(controller) {
      buffer += decoder.decode();
      processCompleteRecords(controller);

      if (buffer) {
        controller.enqueue(JSON.parse(buffer) as T);
      }
    },
  });
}

/**
 * Parses UTF-8 JSON payloads from blank-line-delimited Server-Sent Events.
 */
export function createSseJsonTransform<T>(): TransformStream<ArrayBuffer, T> {
  const decoder = new TextDecoder();
  let buffer = '';

  const parseFrame = (frame: string, controller: TransformStreamDefaultController<T>) => {
    const dataLines: string[] = [];

    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith(':') || !line.startsWith('data:')) {
        continue;
      }

      const value = line.slice('data:'.length);
      dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
    }

    if (dataLines.length === 0) {
      return;
    }

    const payload = dataLines.join('\n');
    // Mirror processMastraStream: hono SSE adapters terminate with `data: [DONE]\n\n`.
    if (payload === '[DONE]') {
      return;
    }

    controller.enqueue(JSON.parse(payload) as T);
  };

  const processCompleteFrames = (controller: TransformStreamDefaultController<T>) => {
    let separatorMatch = SSE_FRAME_SEPARATOR.exec(buffer);

    while (separatorMatch) {
      parseFrame(buffer.slice(0, separatorMatch.index), controller);
      buffer = buffer.slice(separatorMatch.index + separatorMatch[0].length);
      separatorMatch = SSE_FRAME_SEPARATOR.exec(buffer);
    }
  };

  return new TransformStream<ArrayBuffer, T>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      processCompleteFrames(controller);
    },
    flush(controller) {
      buffer += decoder.decode();
      processCompleteFrames(controller);

      if (buffer) {
        parseFrame(buffer, controller);
      }
    },
  });
}
