import type { AIV4Type, AIV5Type } from '../../types';

export function hasAIV5CoreMessageCharacteristics(
  msg: AIV4Type.CoreMessage | AIV5Type.ModelMessage,
): msg is AIV5Type.ModelMessage {
  if (`experimental_providerMetadata` in msg) return false; // is v4 cause v5 doesn't have this property

  // String content is identical in both v4 and v5, so we can safely treat it as v5-compatible
  // This doesn't misclassify v4 messages because the format is the same
  if (typeof msg.content === `string`) return true;

  for (const part of msg.content) {
    if (part.type === `tool-result` && `output` in part) return true; // v5 renamed result->output,
    if (part.type === `tool-call` && `input` in part) return true; // v5 renamed args->input
    if (part.type === `tool-result` && `result` in part) return false; // v5 renamed result->output,
    if (part.type === `tool-call` && `args` in part) return false; // v5 renamed args->input

    // for file and image
    if (`mediaType` in part) return true; // v5 renamed mimeType->mediaType
    if (`mimeType` in part) return false;

    // applies to multiple part types
    if (`experimental_providerMetadata` in part) return false; // was in v4 but deprecated for providerOptions, v4+5 have providerOptions though, can't check the other way

    if (part.type === `reasoning` && `signature` in part) return false; // v5 doesn't have signature, which is optional in v4

    if (part.type === `redacted-reasoning`) return false; // only in v4, seems like in v5 they add it to providerOptions or something? https://github.com/vercel/ai/blob/main/packages/codemod/src/codemods/v5/replace-redacted-reasoning-type.ts#L90
  }

  // If no distinguishing features were found, the message format is identical in v4 and v5
  // We return true (v5-compatible) because the message can be used as-is with v5
  return true;
}
