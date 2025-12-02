"use client";

// src/primitives/message/MessagePartsGrouped.tsx
import {
  memo,
  useMemo
} from "react";
import {
  TextMessagePartProvider,
  useMessagePart,
  useMessagePartRuntime,
  useToolUIs
} from "../../context/index.js";
import {
  useMessage,
  useMessageRuntime
} from "../../context/react/MessageContext.js";
import { MessagePartRuntimeProvider } from "../../context/providers/MessagePartRuntimeProvider.js";
import { MessagePartPrimitiveText } from "../messagePart/MessagePartText.js";
import { MessagePartPrimitiveImage } from "../messagePart/MessagePartImage.js";
import { MessagePartPrimitiveInProgress } from "../messagePart/MessagePartInProgress.js";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var groupMessagePartsByParentId = (parts) => {
  const groupMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const parentId = part?.parentId;
    const groupId = parentId ?? `__ungrouped_${i}`;
    const indices = groupMap.get(groupId) ?? [];
    indices.push(i);
    groupMap.set(groupId, indices);
  }
  const groups = [];
  for (const [groupId, indices] of groupMap) {
    const groupKey = groupId.startsWith("__ungrouped_") ? void 0 : groupId;
    groups.push({ groupKey, indices });
  }
  return groups;
};
var useMessagePartsGrouped = (groupingFunction) => {
  const parts = useMessage((m) => m.content);
  return useMemo(() => {
    if (parts.length === 0) {
      return [];
    }
    return groupingFunction(parts);
  }, [parts, groupingFunction]);
};
var ToolUIDisplay = ({
  Fallback,
  ...props
}) => {
  const Render = useToolUIs((s) => s.getToolUI(props.toolName)) ?? Fallback;
  if (!Render) return null;
  return /* @__PURE__ */ jsx(Render, { ...props });
};
var defaultComponents = {
  Text: () => /* @__PURE__ */ jsxs("p", { style: { whiteSpace: "pre-line" }, children: [
    /* @__PURE__ */ jsx(MessagePartPrimitiveText, {}),
    /* @__PURE__ */ jsx(MessagePartPrimitiveInProgress, { children: /* @__PURE__ */ jsx("span", { style: { fontFamily: "revert" }, children: " \u25CF" }) })
  ] }),
  Reasoning: () => null,
  Source: () => null,
  Image: () => /* @__PURE__ */ jsx(MessagePartPrimitiveImage, {}),
  File: () => null,
  Unstable_Audio: () => null,
  Group: ({ children }) => children
};
var MessagePartComponent = ({
  components: {
    Text = defaultComponents.Text,
    Reasoning = defaultComponents.Reasoning,
    Image = defaultComponents.Image,
    Source = defaultComponents.Source,
    File = defaultComponents.File,
    Unstable_Audio: Audio = defaultComponents.Unstable_Audio,
    tools = {}
  } = {}
}) => {
  const MessagePartRuntime = useMessagePartRuntime();
  const part = useMessagePart();
  const type = part.type;
  if (type === "tool-call") {
    const addResult = (result) => MessagePartRuntime.addToolResult(result);
    if ("Override" in tools)
      return /* @__PURE__ */ jsx(tools.Override, { ...part, addResult });
    const Tool = tools.by_name?.[part.toolName] ?? tools.Fallback;
    return /* @__PURE__ */ jsx(ToolUIDisplay, { ...part, Fallback: Tool, addResult });
  }
  if (part.status.type === "requires-action")
    throw new Error("Encountered unexpected requires-action status");
  switch (type) {
    case "text":
      return /* @__PURE__ */ jsx(Text, { ...part });
    case "reasoning":
      return /* @__PURE__ */ jsx(Reasoning, { ...part });
    case "source":
      return /* @__PURE__ */ jsx(Source, { ...part });
    case "image":
      return /* @__PURE__ */ jsx(Image, { ...part });
    case "file":
      return /* @__PURE__ */ jsx(File, { ...part });
    case "audio":
      return /* @__PURE__ */ jsx(Audio, { ...part });
    default:
      const unhandledType = type;
      throw new Error(`Unknown message part type: ${unhandledType}`);
  }
};
var MessagePartImpl = ({ partIndex, components }) => {
  const messageRuntime = useMessageRuntime();
  const runtime = useMemo(
    () => messageRuntime.getMessagePartByIndex(partIndex),
    [messageRuntime, partIndex]
  );
  return /* @__PURE__ */ jsx(MessagePartRuntimeProvider, { runtime, children: /* @__PURE__ */ jsx(MessagePartComponent, { components }) });
};
var MessagePart = memo(
  MessagePartImpl,
  (prev, next) => prev.partIndex === next.partIndex && prev.components?.Text === next.components?.Text && prev.components?.Reasoning === next.components?.Reasoning && prev.components?.Source === next.components?.Source && prev.components?.Image === next.components?.Image && prev.components?.File === next.components?.File && prev.components?.Unstable_Audio === next.components?.Unstable_Audio && prev.components?.tools === next.components?.tools && prev.components?.Group === next.components?.Group
);
var COMPLETE_STATUS = Object.freeze({
  type: "complete"
});
var EmptyPartFallback = ({ status, component: Component }) => {
  return /* @__PURE__ */ jsx(TextMessagePartProvider, { text: "", isRunning: status.type === "running", children: /* @__PURE__ */ jsx(Component, { type: "text", text: "", status }) });
};
var EmptyPartsImpl = ({ components }) => {
  const status = useMessage((s) => s.status) ?? COMPLETE_STATUS;
  if (components?.Empty) return /* @__PURE__ */ jsx(components.Empty, { status });
  return /* @__PURE__ */ jsx(
    EmptyPartFallback,
    {
      status,
      component: components?.Text ?? defaultComponents.Text
    }
  );
};
var EmptyParts = memo(
  EmptyPartsImpl,
  (prev, next) => prev.components?.Empty === next.components?.Empty && prev.components?.Text === next.components?.Text
);
var MessagePrimitiveUnstable_PartsGrouped = ({ groupingFunction, components }) => {
  const contentLength = useMessage((s) => s.content.length);
  const messageGroups = useMessagePartsGrouped(groupingFunction);
  const partsElements = useMemo(() => {
    if (contentLength === 0) {
      return /* @__PURE__ */ jsx(EmptyParts, { components });
    }
    return messageGroups.map((group, groupIndex) => {
      const GroupComponent = components?.Group ?? defaultComponents.Group;
      return /* @__PURE__ */ jsx(
        GroupComponent,
        {
          groupKey: group.groupKey,
          indices: group.indices,
          children: group.indices.map((partIndex) => /* @__PURE__ */ jsx(
            MessagePart,
            {
              partIndex,
              components
            },
            partIndex
          ))
        },
        `group-${groupIndex}-${group.groupKey ?? "ungrouped"}`
      );
    });
  }, [messageGroups, components, contentLength]);
  return /* @__PURE__ */ jsx(Fragment, { children: partsElements });
};
MessagePrimitiveUnstable_PartsGrouped.displayName = "MessagePrimitive.Unstable_PartsGrouped";
var MessagePrimitiveUnstable_PartsGroupedByParentId = ({ components, ...props }) => {
  return /* @__PURE__ */ jsx(
    MessagePrimitiveUnstable_PartsGrouped,
    {
      ...props,
      components,
      groupingFunction: groupMessagePartsByParentId
    }
  );
};
MessagePrimitiveUnstable_PartsGroupedByParentId.displayName = "MessagePrimitive.Unstable_PartsGroupedByParentId";
export {
  MessagePrimitiveUnstable_PartsGrouped,
  MessagePrimitiveUnstable_PartsGroupedByParentId
};
//# sourceMappingURL=MessagePartsGrouped.js.map