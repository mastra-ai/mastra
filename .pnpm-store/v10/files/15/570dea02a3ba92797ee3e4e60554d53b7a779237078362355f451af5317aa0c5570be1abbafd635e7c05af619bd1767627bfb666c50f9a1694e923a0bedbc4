// src/runtimes/external-store/ThreadMessageLike.tsx
import { parsePartialJsonObject } from "assistant-stream/utils";
import { generateId } from "../../utils/idUtils.js";
var fromThreadMessageLike = (like, fallbackId, fallbackStatus) => {
  const { role, id, createdAt, attachments, status, metadata } = like;
  const common = {
    id: id ?? fallbackId,
    createdAt: createdAt ?? /* @__PURE__ */ new Date()
  };
  const content = typeof like.content === "string" ? [{ type: "text", text: like.content }] : like.content;
  const sanitizeImageContent = ({
    image,
    ...rest
  }) => {
    const match = image.match(
      /^data:image\/(png|jpeg|jpg|gif|webp);base64,(.*)$/
    );
    if (match) {
      return { ...rest, image };
    }
    console.warn(`Invalid image data format detected`);
    return null;
  };
  if (role !== "user" && attachments?.length)
    throw new Error("attachments are only supported for user messages");
  if (role !== "assistant" && status)
    throw new Error("status is only supported for assistant messages");
  if (role !== "assistant" && metadata?.steps)
    throw new Error("metadata.steps is only supported for assistant messages");
  switch (role) {
    case "assistant":
      return {
        ...common,
        role,
        content: content.map((part) => {
          const type = part.type;
          switch (type) {
            case "text":
            case "reasoning":
              if (part.text.trim().length === 0) return null;
              return part;
            case "file":
            case "source":
              return part;
            case "image":
              return sanitizeImageContent(part);
            case "tool-call": {
              const { parentId, ...basePart } = part;
              const commonProps = {
                ...basePart,
                toolCallId: part.toolCallId ?? "tool-" + generateId(),
                ...parentId !== void 0 && { parentId }
              };
              if (part.args) {
                return {
                  ...commonProps,
                  args: part.args,
                  argsText: JSON.stringify(part.args)
                };
              }
              return {
                ...commonProps,
                args: part.args ?? parsePartialJsonObject(part.argsText ?? "") ?? {},
                argsText: part.argsText ?? ""
              };
            }
            default: {
              const unhandledType = type;
              throw new Error(
                `Unsupported assistant message part type: ${unhandledType}`
              );
            }
          }
        }).filter((c) => !!c),
        status: status ?? fallbackStatus,
        metadata: {
          unstable_state: metadata?.unstable_state ?? null,
          unstable_annotations: metadata?.unstable_annotations ?? [],
          unstable_data: metadata?.unstable_data ?? [],
          custom: metadata?.custom ?? {},
          steps: metadata?.steps ?? []
        }
      };
    case "user":
      return {
        ...common,
        role,
        content: content.map((part) => {
          const type = part.type;
          switch (type) {
            case "text":
            case "image":
            case "audio":
            case "file":
              return part;
            default: {
              const unhandledType = type;
              throw new Error(
                `Unsupported user message part type: ${unhandledType}`
              );
            }
          }
        }),
        attachments: attachments ?? [],
        metadata: {
          custom: metadata?.custom ?? {}
        }
      };
    case "system":
      if (content.length !== 1 || content[0].type !== "text")
        throw new Error(
          "System messages must have exactly one text message part."
        );
      return {
        ...common,
        role,
        content,
        metadata: {
          custom: metadata?.custom ?? {}
        }
      };
    default: {
      const unsupportedRole = role;
      throw new Error(`Unknown message role: ${unsupportedRole}`);
    }
  }
};
export {
  fromThreadMessageLike
};
//# sourceMappingURL=ThreadMessageLike.js.map