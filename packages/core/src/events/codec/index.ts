// Built-in class codecs (GeneratedFile, DefaultStepResult, etc.) are
// registered via a named import inside `./codec.ts` so they survive
// `"sideEffects": false` tree-shaking in dist consumers.
export { encode, decode } from './codec';
export { CODEC_TAG, type Envelope, type EnvelopeTag } from './tags';
export { registerClass, unregisterClass, getClassCodec, hasClassCodec, type ClassCodec } from './registry';
export { serializeError, rehydrateError } from './error';
