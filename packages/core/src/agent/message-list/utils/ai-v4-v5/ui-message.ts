import type { AIV4Type, AIV5Type } from '../../types';

export function hasAIV5UIMessageCharacteristics(
  msg: AIV5Type.UIMessage | AIV4Type.UIMessage,
): msg is AIV5Type.UIMessage {
  // ai v4 has these separated arrays of parts that don't record overall order
  // so we can check for their presence as a faster/early check
  if (
    `toolInvocations` in msg ||
    `reasoning` in msg ||
    `experimental_attachments` in msg ||
    `data` in msg ||
    `annotations` in msg
    // don't check `content` in msg because it fully narrows the type to v5 and there's a chance someone might mess up and add content to a v5 message, that's more likely than the other keys
  )
    return false;

  for (const part of msg.parts) {
    if (`metadata` in part) return true;

    // tools are annoying cause ai v5 has the type as
    // tool-${toolName}
    // in v4 we had tool-invocation
    // technically
    // v4 tool
    if (`toolInvocation` in part) return false;
    // v5 tool
    if (`toolCallId` in part) return true;

    if (part.type === `source`) return false;
    if (part.type === `source-url`) return true;

    if (part.type === `reasoning`) {
      if (`state` in part || `text` in part) return true; // v5
      if (`reasoning` in part || `details` in part) return false; // v4
    }

    if (part.type === `file` && `mediaType` in part) return true;
  }

  return true;
}
