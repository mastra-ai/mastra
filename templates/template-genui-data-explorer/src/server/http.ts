export const maximumBody = 2 * 1024 * 1024;
export async function boundedBody(request: Request) {
  if (Number(request.headers.get("content-length")) > maximumBody) return;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    signal.throwIfAborted();
    while (true) {
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) return Buffer.concat(chunks).toString("utf8");
      bytes += next.value.byteLength;
      if (bytes > maximumBody) {
        cancel();
        return;
      }
      chunks.push(next.value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
