import { $ } from 'execa';

export default async function setup() {
  if (process.env.MASTRA_SOURCE_MODE !== '1') {
    await $(
      {},
    )`pnpm tsc ./src/worker/generic-memory-worker.ts ./src/worker/mock-embedder.ts --esModuleInterop --resolveJsonModule --module commonjs --target es2020 --outDir ./ --rootDir ./ --skipLibCheck`;
  }

  if (process.env.MASTRA_SOURCE_MODE !== '1') {
    // Pre-download fastembed models to avoid race conditions when multiple
    // test files call FlagEmbedding.init() concurrently. warmup() only
    // downloads — it does not create ONNX sessions, so no handles leak.
    const fastembedPackage = '@mastra/fastembed';
    const { warmup } = await import(fastembedPackage);
    await warmup();
  }
}
