import type * as Tokenx from 'tokenx';

let tokenxPromise: Promise<typeof Tokenx> | undefined;

export function loadTokenx(): Promise<typeof Tokenx> {
  tokenxPromise ??= import('tokenx');
  return tokenxPromise;
}
