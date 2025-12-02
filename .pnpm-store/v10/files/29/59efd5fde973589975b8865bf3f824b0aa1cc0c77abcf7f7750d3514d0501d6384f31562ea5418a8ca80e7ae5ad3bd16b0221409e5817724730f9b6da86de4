/// <reference types="node" />
import type { Callback, Data, Encoding, Path, ReadOptions, WriteOptions } from './types';
declare function readFile(filePath: Path, options: Encoding | ReadOptions & {
    encoding: string;
}): Promise<string>;
declare function readFile(filePath: Path, options?: ReadOptions): Promise<Buffer>;
declare function readFileSync(filePath: Path, options: Encoding | ReadOptions & {
    encoding: string;
}): string;
declare function readFileSync(filePath: Path, options?: ReadOptions): Buffer;
declare function writeFile(filePath: Path, data: Data, callback?: Callback): Promise<void>;
declare function writeFile(filePath: Path, data: Data, options?: Encoding | WriteOptions, callback?: Callback): Promise<void>;
declare function writeFileSync(filePath: Path, data: Data, options?: Encoding | WriteOptions): void;
export { readFile, readFileSync, writeFile, writeFileSync };
export type { Encoding, ReadOptions, WriteOptions };
