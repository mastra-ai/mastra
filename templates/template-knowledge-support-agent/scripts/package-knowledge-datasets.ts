import { cp } from 'node:fs/promises';

// Keep the datasets out of Mastra's public asset folder.
await cp(
  new URL('../knowledge-datasets/', import.meta.url),
  new URL('../.mastra/output/.support-datasets/', import.meta.url),
  { recursive: true },
);
