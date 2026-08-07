export async function playStreamWithWebAudio(stream: ReadableStream, onEnded?: () => void) {
  const audioContext = new window.AudioContext();

  const reader = stream.getReader();
  const chunks = [];

  try {
    // Read all chunks
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine chunks into single ArrayBuffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      combinedBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Decode and play
    const audioBuffer = await audioContext.decodeAudioData(combinedBuffer.buffer);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.onended = onEnded ?? null;
    source.connect(audioContext.destination);
    source.start();

    return () => {
      source.onended = null;
      source.stop();
      void audioContext.close();
    };
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    await audioContext.close().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
