declare module 'snappyjs' {
  const SnappyJS: {
    compress(input: Uint8Array | ArrayBuffer | Buffer): ArrayBuffer;
    uncompress(input: Uint8Array | ArrayBuffer | Buffer): ArrayBuffer;
  };
  export default SnappyJS;
}
