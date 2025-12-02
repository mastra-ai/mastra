// src/utils/sha256-node.ts
import { Readable } from "stream";
import { createHash } from "crypto";
async function* sha256Node(buffer, opts) {
  const sha256Stream = createHash("sha256");
  const size = buffer instanceof Blob ? buffer.size : buffer.byteLength;
  let done = 0;
  const readable = buffer instanceof Blob ? Readable.fromWeb(buffer.stream()) : Readable.from(Buffer.from(buffer));
  for await (const buffer2 of readable) {
    sha256Stream.update(buffer2);
    done += buffer2.length;
    yield done / size;
    opts?.abortSignal?.throwIfAborted();
  }
  return sha256Stream.digest("hex");
}
export {
  sha256Node
};
