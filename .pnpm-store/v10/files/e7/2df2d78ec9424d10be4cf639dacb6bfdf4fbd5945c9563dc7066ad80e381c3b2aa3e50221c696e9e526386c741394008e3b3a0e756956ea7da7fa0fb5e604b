
/* MAIN */

type Callback = ( error: Exception | void ) => void;

type Data = Uint8Array | string | undefined;

type Disposer = () => void;

type Encoding = 'ascii' | 'base64' | 'binary' | 'hex' | 'latin1' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2';

type Exception = NodeJS.ErrnoException;

type Path = string;

type ReadOptions = {
  encoding?: Encoding | null,
  mode?: string | number | false,
  timeout?: number
};

type WriteOptions = {
  chown?: { gid: number, uid: number } | false,
  encoding?: Encoding | null,
  fsync?: boolean,
  fsyncWait?: boolean,
  mode?: string | number | false,
  schedule?: ( filePath: string ) => Promise<Disposer>,
  timeout?: number,
  tmpCreate?: ( filePath: string ) => string,
  tmpCreated?: ( filePath: string ) => void,
  tmpPurge?: boolean
};

/* EXPORT */

export type {Callback, Data, Disposer, Encoding, Exception, Path, ReadOptions, WriteOptions};
