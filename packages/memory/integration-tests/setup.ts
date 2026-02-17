import { $ } from 'execa';

export default async function setup() {
  await $(
    {},
  )`pnpm tsc ./src/worker/generic-memory-worker.ts ./src/worker/mock-embedder.ts --esModuleInterop --resolveJsonModule --module commonjs --target es2020 --outDir ./ --rootDir ./ --skipLibCheck`;
}
