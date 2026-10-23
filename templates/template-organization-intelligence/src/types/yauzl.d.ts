declare module 'yauzl' {
  import type { Readable } from 'node:stream';
  export type Entry = { fileName: string; uncompressedSize: number };
  export type ZipFile = {
    readEntry(): void;
    close(): void;
    on(event: 'entry', callback: (entry: Entry) => void): void;
    on(event: 'end' | 'error', callback: (error?: Error) => void): void;
    openReadStream(entry: Entry, callback: (error: Error | null, stream?: Readable) => void): void;
  };
  export function fromBuffer(
    data: Buffer,
    options: object,
    callback: (error: Error | null, zip?: ZipFile) => void,
  ): void;
}
