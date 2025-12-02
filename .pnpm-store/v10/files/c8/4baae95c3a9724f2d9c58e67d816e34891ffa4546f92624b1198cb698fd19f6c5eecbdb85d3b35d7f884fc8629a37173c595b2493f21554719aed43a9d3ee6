// src/cloud/auiV0.ts
import { fromThreadMessageLike } from "../runtimes/external-store/ThreadMessageLike.js";
import { isJSONValue } from "../utils/json/is-json.js";
var auiV0Encode = (message) => {
  return {
    role: message.role,
    content: message.content.map((part) => {
      const type = part.type;
      switch (type) {
        case "text": {
          return {
            type: "text",
            text: part.text
          };
        }
        case "reasoning": {
          return {
            type: "reasoning",
            text: part.text
          };
        }
        case "source": {
          return {
            type: "source",
            sourceType: part.sourceType,
            id: part.id,
            url: part.url,
            ...part.title ? { title: part.title } : void 0
          };
        }
        case "tool-call": {
          if (!isJSONValue(part.result)) {
            console.warn(
              "tool-call result is not JSON! " + JSON.stringify(part)
            );
          }
          return {
            type: "tool-call",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            ...JSON.stringify(part.args) === part.argsText ? {
              args: part.args
            } : { argsText: part.argsText },
            ...part.result ? { result: part.result } : {},
            ...part.isError ? { isError: true } : {}
          };
        }
        default: {
          const unhandledType = type;
          throw new Error(
            `Message part type not supported by aui/v0: ${unhandledType}`
          );
        }
      }
    }),
    metadata: message.metadata,
    ...message.status ? {
      status: message.status?.type === "running" ? {
        type: "incomplete",
        reason: "cancelled"
      } : message.status
    } : void 0
  };
};
var auiV0Decode = (cloudMessage) => {
  const payload = cloudMessage.content;
  const message = fromThreadMessageLike(
    {
      id: cloudMessage.id,
      createdAt: cloudMessage.created_at,
      ...payload
    },
    cloudMessage.id,
    {
      type: "complete",
      reason: "unknown"
    }
  );
  return {
    parentId: cloudMessage.parent_id,
    message
  };
};
export {
  auiV0Decode,
  auiV0Encode
};
//# sourceMappingURL=auiV0.js.map