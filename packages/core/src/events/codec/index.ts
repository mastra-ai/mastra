// Side-effect import: register built-in class codecs (GeneratedFile, etc.)
import './registrations';

export { encode, decode } from './codec';
export { CODEC_TAG, type Envelope, type EnvelopeTag } from './tags';
export { registerClass, unregisterClass, getClassCodec, hasClassCodec, type ClassCodec } from './registry';
export { serializeError, rehydrateError } from './error';
