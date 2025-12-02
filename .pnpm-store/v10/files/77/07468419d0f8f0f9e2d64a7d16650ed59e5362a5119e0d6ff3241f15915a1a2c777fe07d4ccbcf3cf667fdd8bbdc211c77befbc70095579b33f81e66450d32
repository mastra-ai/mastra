"use client";

import {
  type ComponentType,
  type FC,
  memo,
  PropsWithChildren,
  useMemo,
} from "react";
import {
  TextMessagePartProvider,
  useMessagePart,
  useMessagePartRuntime,
  useToolUIs,
} from "../../context";
import {
  useMessage,
  useMessageRuntime,
} from "../../context/react/MessageContext";
import { MessagePartRuntimeProvider } from "../../context/providers/MessagePartRuntimeProvider";
import { MessagePartPrimitiveText } from "../messagePart/MessagePartText";
import { MessagePartPrimitiveImage } from "../messagePart/MessagePartImage";
import type {
  Unstable_AudioMessagePartComponent,
  EmptyMessagePartComponent,
  TextMessagePartComponent,
  ImageMessagePartComponent,
  SourceMessagePartComponent,
  ToolCallMessagePartComponent,
  ToolCallMessagePartProps,
  FileMessagePartComponent,
  ReasoningMessagePartComponent,
} from "../../types/MessagePartComponentTypes";
import { MessagePartPrimitiveInProgress } from "../messagePart/MessagePartInProgress";
import { MessagePartStatus } from "../../types/AssistantTypes";

type MessagePartGroup = {
  groupKey: string | undefined;
  indices: number[];
};

export type GroupingFunction = (parts: readonly any[]) => MessagePartGroup[];

/**
 * Groups message parts by their parent ID.
 * Parts without a parent ID appear in their chronological position as individual groups.
 * Parts with the same parent ID are grouped together at the position of their first occurrence.
 */
const groupMessagePartsByParentId: GroupingFunction = (
  parts: readonly any[],
): MessagePartGroup[] => {
  // Map maintains insertion order, so groups appear in order of first occurrence
  const groupMap = new Map<string, number[]>();

  // Process each part in order
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const parentId = part?.parentId as string | undefined;

    // For parts without parentId, assign a unique group ID to maintain their position
    const groupId = parentId ?? `__ungrouped_${i}`;

    // Get or create the indices array for this group
    const indices = groupMap.get(groupId) ?? [];
    indices.push(i);
    groupMap.set(groupId, indices);
  }

  // Convert map to array of groups
  const groups: MessagePartGroup[] = [];
  for (const [groupId, indices] of groupMap) {
    // Extract parentId (undefined for ungrouped parts)
    const groupKey = groupId.startsWith("__ungrouped_") ? undefined : groupId;
    groups.push({ groupKey, indices });
  }

  return groups;
};

const useMessagePartsGrouped = (
  groupingFunction: GroupingFunction,
): MessagePartGroup[] => {
  const parts = useMessage((m) => m.content);

  return useMemo(() => {
    if (parts.length === 0) {
      return [];
    }
    return groupingFunction(parts);
  }, [parts, groupingFunction]);
};

export namespace MessagePrimitiveUnstable_PartsGrouped {
  export type Props = {
    /**
     * Function that takes an array of message parts and returns an array of groups.
     * Each group contains a key (for identification) and an array of indices.
     *
     * @example
     * ```tsx
     * // Group by parent ID (default behavior)
     * groupingFunction={(parts) => {
     *   const groups = new Map<string, number[]>();
     *   parts.forEach((part, i) => {
     *     const key = part.parentId ?? `__ungrouped_${i}`;
     *     const indices = groups.get(key) ?? [];
     *     indices.push(i);
     *     groups.set(key, indices);
     *   });
     *   return Array.from(groups.entries()).map(([key, indices]) => ({
     *     key: key.startsWith("__ungrouped_") ? undefined : key,
     *     indices
     *   }));
     * }}
     * ```
     *
     * @example
     * ```tsx
     * // Group by tool name
     * import { groupMessagePartsByToolName } from "@assistant-ui/react";
     *
     * <MessagePrimitive.Unstable_PartsGrouped
     *   groupingFunction={groupMessagePartsByToolName}
     *   components={{
     *     Group: ({ key, indices, children }) => {
     *       if (!key) return <>{children}</>;
     *       return (
     *         <div className="tool-group">
     *           <h4>Tool: {key}</h4>
     *           {children}
     *         </div>
     *       );
     *     }
     *   }}
     * />
     * ```
     */
    groupingFunction: GroupingFunction;

    /**
     * Component configuration for rendering different types of message content.
     *
     * You can provide custom components for each content type (text, image, file, etc.)
     * and configure tool rendering behavior. If not provided, default components will be used.
     */
    components:
      | {
          /** Component for rendering empty messages */
          Empty?: EmptyMessagePartComponent | undefined;
          /** Component for rendering text content */
          Text?: TextMessagePartComponent | undefined;
          /** Component for rendering reasoning content (typically hidden) */
          Reasoning?: ReasoningMessagePartComponent | undefined;
          /** Component for rendering source content */
          Source?: SourceMessagePartComponent | undefined;
          /** Component for rendering image content */
          Image?: ImageMessagePartComponent | undefined;
          /** Component for rendering file content */
          File?: FileMessagePartComponent | undefined;
          /** Component for rendering audio content (experimental) */
          Unstable_Audio?: Unstable_AudioMessagePartComponent | undefined;
          /** Configuration for tool call rendering */
          tools?:
            | {
                /** Map of tool names to their specific components */
                by_name?:
                  | Record<string, ToolCallMessagePartComponent | undefined>
                  | undefined;
                /** Fallback component for unregistered tools */
                Fallback?: ComponentType<ToolCallMessagePartProps> | undefined;
              }
            | {
                /** Override component that handles all tool calls */
                Override: ComponentType<ToolCallMessagePartProps>;
              }
            | undefined;

          /**
           * Component for rendering grouped message parts.
           *
           * When provided, this component will automatically wrap message parts that share
           * the same group key as determined by the groupingFunction.
           *
           * The component receives:
           * - `groupKey`: The group key (or undefined for ungrouped parts)
           * - `indices`: Array of indices for the parts in this group
           * - `children`: The rendered message part components
           *
           * @example
           * ```tsx
           * // Collapsible group
           * Group: ({ groupKey, indices, children }) => {
           *   if (!groupKey) return <>{children}</>;
           *   return (
           *     <details className="message-group">
           *       <summary>
           *         Group {groupKey} ({indices.length} parts)
           *       </summary>
           *       <div className="group-content">
           *         {children}
           *       </div>
           *     </details>
           *   );
           * }
           * ```
           *
           * @param groupKey - The group key (undefined for ungrouped parts)
           * @param indices - Array of indices for the parts in this group
           * @param children - Rendered message part components to display within the group
           */
          Group?: ComponentType<
            PropsWithChildren<{
              groupKey: string | undefined;
              indices: number[];
            }>
          >;
        }
      | undefined;
  };
}

const ToolUIDisplay = ({
  Fallback,
  ...props
}: {
  Fallback: ToolCallMessagePartComponent | undefined;
} & ToolCallMessagePartProps) => {
  const Render = useToolUIs((s) => s.getToolUI(props.toolName)) ?? Fallback;
  if (!Render) return null;
  return <Render {...props} />;
};

const defaultComponents = {
  Text: () => (
    <p style={{ whiteSpace: "pre-line" }}>
      <MessagePartPrimitiveText />
      <MessagePartPrimitiveInProgress>
        <span style={{ fontFamily: "revert" }}>{" \u25CF"}</span>
      </MessagePartPrimitiveInProgress>
    </p>
  ),
  Reasoning: () => null,
  Source: () => null,
  Image: () => <MessagePartPrimitiveImage />,
  File: () => null,
  Unstable_Audio: () => null,
  Group: ({ children }) => children,
} satisfies MessagePrimitiveUnstable_PartsGrouped.Props["components"];

type MessagePartComponentProps = {
  components: MessagePrimitiveUnstable_PartsGrouped.Props["components"];
};

const MessagePartComponent: FC<MessagePartComponentProps> = ({
  components: {
    Text = defaultComponents.Text,
    Reasoning = defaultComponents.Reasoning,
    Image = defaultComponents.Image,
    Source = defaultComponents.Source,
    File = defaultComponents.File,
    Unstable_Audio: Audio = defaultComponents.Unstable_Audio,
    tools = {},
  } = {},
}) => {
  const MessagePartRuntime = useMessagePartRuntime();

  const part = useMessagePart();

  const type = part.type;
  if (type === "tool-call") {
    const addResult = (result: any) => MessagePartRuntime.addToolResult(result);
    if ("Override" in tools)
      return <tools.Override {...part} addResult={addResult} />;
    const Tool = tools.by_name?.[part.toolName] ?? tools.Fallback;
    return <ToolUIDisplay {...part} Fallback={Tool} addResult={addResult} />;
  }

  if (part.status.type === "requires-action")
    throw new Error("Encountered unexpected requires-action status");

  switch (type) {
    case "text":
      return <Text {...part} />;

    case "reasoning":
      return <Reasoning {...part} />;

    case "source":
      return <Source {...part} />;

    case "image":
      // eslint-disable-next-line jsx-a11y/alt-text
      return <Image {...part} />;

    case "file":
      return <File {...part} />;

    case "audio":
      return <Audio {...part} />;

    default:
      const unhandledType: never = type;
      throw new Error(`Unknown message part type: ${unhandledType}`);
  }
};

type MessagePartProps = {
  partIndex: number;
  components: MessagePrimitiveUnstable_PartsGrouped.Props["components"];
};

const MessagePartImpl: FC<MessagePartProps> = ({ partIndex, components }) => {
  const messageRuntime = useMessageRuntime();
  const runtime = useMemo(
    () => messageRuntime.getMessagePartByIndex(partIndex),
    [messageRuntime, partIndex],
  );

  return (
    <MessagePartRuntimeProvider runtime={runtime}>
      <MessagePartComponent components={components} />
    </MessagePartRuntimeProvider>
  );
};

const MessagePart = memo(
  MessagePartImpl,
  (prev, next) =>
    prev.partIndex === next.partIndex &&
    prev.components?.Text === next.components?.Text &&
    prev.components?.Reasoning === next.components?.Reasoning &&
    prev.components?.Source === next.components?.Source &&
    prev.components?.Image === next.components?.Image &&
    prev.components?.File === next.components?.File &&
    prev.components?.Unstable_Audio === next.components?.Unstable_Audio &&
    prev.components?.tools === next.components?.tools &&
    prev.components?.Group === next.components?.Group,
);

const COMPLETE_STATUS: MessagePartStatus = Object.freeze({
  type: "complete",
});

const EmptyPartFallback: FC<{
  status: MessagePartStatus;
  component: TextMessagePartComponent;
}> = ({ status, component: Component }) => {
  return (
    <TextMessagePartProvider text="" isRunning={status.type === "running"}>
      <Component type="text" text="" status={status} />
    </TextMessagePartProvider>
  );
};

const EmptyPartsImpl: FC<MessagePartComponentProps> = ({ components }) => {
  const status =
    useMessage((s) => s.status as MessagePartStatus) ?? COMPLETE_STATUS;

  if (components?.Empty) return <components.Empty status={status} />;

  return (
    <EmptyPartFallback
      status={status}
      component={components?.Text ?? defaultComponents.Text}
    />
  );
};

const EmptyParts = memo(
  EmptyPartsImpl,
  (prev, next) =>
    prev.components?.Empty === next.components?.Empty &&
    prev.components?.Text === next.components?.Text,
);

/**
 * Renders the parts of a message grouped by a custom grouping function.
 *
 * This component allows you to group message parts based on any criteria you define.
 * The grouping function receives all message parts and returns an array of groups,
 * where each group has a key and an array of part indices.
 *
 * @example
 * ```tsx
 * // Group by parent ID (default behavior)
 * <MessagePrimitive.Unstable_PartsGrouped
 *   components={{
 *     Text: ({ text }) => <p className="message-text">{text}</p>,
 *     Image: ({ image }) => <img src={image} alt="Message image" />,
 *     Group: ({ groupKey, indices, children }) => {
 *       if (!groupKey) return <>{children}</>;
 *       return (
 *         <div className="parent-group border rounded p-4">
 *           <h4>Parent ID: {groupKey}</h4>
 *           {children}
 *         </div>
 *       );
 *     }
 *   }}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Group by tool name
 * import { groupMessagePartsByToolName } from "@assistant-ui/react";
 *
 * <MessagePrimitive.Unstable_PartsGrouped
 *   groupingFunction={groupMessagePartsByToolName}
 *   components={{
 *     Group: ({ groupKey, indices, children }) => {
 *       if (!groupKey) return <>{children}</>;
 *       return (
 *         <div className="tool-group">
 *           <h4>Tool: {groupKey}</h4>
 *           {children}
 *         </div>
 *       );
 *     }
 *   }}
 * />
 * ```
 */
export const MessagePrimitiveUnstable_PartsGrouped: FC<
  MessagePrimitiveUnstable_PartsGrouped.Props
> = ({ groupingFunction, components }) => {
  const contentLength = useMessage((s) => s.content.length);
  const messageGroups = useMessagePartsGrouped(groupingFunction);

  const partsElements = useMemo(() => {
    if (contentLength === 0) {
      return <EmptyParts components={components} />;
    }

    return messageGroups.map((group, groupIndex) => {
      const GroupComponent = components?.Group ?? defaultComponents.Group;

      return (
        <GroupComponent
          key={`group-${groupIndex}-${group.groupKey ?? "ungrouped"}`}
          groupKey={group.groupKey}
          indices={group.indices}
        >
          {group.indices.map((partIndex) => (
            <MessagePart
              key={partIndex}
              partIndex={partIndex}
              components={components}
            />
          ))}
        </GroupComponent>
      );
    });
  }, [messageGroups, components, contentLength]);

  return <>{partsElements}</>;
};

MessagePrimitiveUnstable_PartsGrouped.displayName =
  "MessagePrimitive.Unstable_PartsGrouped";

/**
 * Renders the parts of a message grouped by their parent ID.
 * This is a convenience wrapper around Unstable_PartsGrouped with parent ID grouping.
 *
 * @deprecated Use MessagePrimitive.Unstable_PartsGrouped instead for more flexibility
 */
export const MessagePrimitiveUnstable_PartsGroupedByParentId: FC<
  Omit<MessagePrimitiveUnstable_PartsGrouped.Props, "groupingFunction">
> = ({ components, ...props }) => {
  return (
    <MessagePrimitiveUnstable_PartsGrouped
      {...props}
      components={components}
      groupingFunction={groupMessagePartsByParentId}
    />
  );
};

MessagePrimitiveUnstable_PartsGroupedByParentId.displayName =
  "MessagePrimitive.Unstable_PartsGroupedByParentId";
