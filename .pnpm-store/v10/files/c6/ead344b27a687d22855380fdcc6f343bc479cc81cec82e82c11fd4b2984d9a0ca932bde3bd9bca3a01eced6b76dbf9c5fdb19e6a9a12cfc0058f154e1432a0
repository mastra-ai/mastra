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
import { useShallow } from "zustand/shallow";

type MessagePartRange =
  | { type: "single"; index: number }
  | { type: "toolGroup"; startIndex: number; endIndex: number };

/**
 * Groups consecutive tool-call message parts into ranges.
 * Always groups tool calls, even if there's only one.
 */
const groupMessageParts = (
  messageTypes: readonly string[],
): MessagePartRange[] => {
  const ranges: MessagePartRange[] = [];
  let currentToolGroupStart = -1;

  for (let i = 0; i < messageTypes.length; i++) {
    const type = messageTypes[i];

    if (type === "tool-call") {
      // Start a new tool group if we haven't started one
      if (currentToolGroupStart === -1) {
        currentToolGroupStart = i;
      }
    } else {
      // End current tool group if it exists
      if (currentToolGroupStart !== -1) {
        ranges.push({
          type: "toolGroup",
          startIndex: currentToolGroupStart,
          endIndex: i - 1,
        });
        currentToolGroupStart = -1;
      }

      // Add non-tool-call part individually
      ranges.push({ type: "single", index: i });
    }
  }

  // Handle any remaining tool group at the end
  if (currentToolGroupStart !== -1) {
    ranges.push({
      type: "toolGroup",
      startIndex: currentToolGroupStart,
      endIndex: messageTypes.length - 1,
    });
  }

  return ranges;
};

const useMessagePartsGroups = (): MessagePartRange[] => {
  const messageTypes = useMessage(
    useShallow((m) => m.content.map((c) => c.type)),
  );

  return useMemo(() => {
    if (messageTypes.length === 0) {
      return [];
    }
    return groupMessageParts(messageTypes);
  }, [messageTypes]);
};

export namespace MessagePrimitiveParts {
  export type Props = {
    /**
     * Component configuration for rendering different types of message content.
     *
     * You can provide custom components for each content type (text, image, file, etc.)
     * and configure tool rendering behavior. If not provided, default components will be used.
     */
    components?:
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
           * Component for rendering grouped consecutive tool calls.
           *
           * When provided, this component will automatically wrap consecutive tool-call
           * message parts, allowing you to create collapsible sections, custom styling,
           * or other grouped presentations for multiple tool calls.
           *
           * The component receives:
           * - `startIndex`: The index of the first tool call in the group
           * - `endIndex`: The index of the last tool call in the group
           * - `children`: The rendered tool call components
           *
           * @example
           * ```tsx
           * // Collapsible tool group
           * ToolGroup: ({ startIndex, endIndex, children }) => (
           *   <details className="tool-group">
           *     <summary>
           *       {endIndex - startIndex + 1} tool calls
           *     </summary>
           *     <div className="tool-group-content">
           *       {children}
           *     </div>
           *   </details>
           * )
           * ```
           *
           * @example
           * ```tsx
           * // Custom styled tool group with header
           * ToolGroup: ({ startIndex, endIndex, children }) => (
           *   <div className="border rounded-lg p-4 my-2">
           *     <div className="text-sm text-gray-600 mb-2">
           *       Tool execution #{startIndex + 1}-{endIndex + 1}
           *     </div>
           *     <div className="space-y-2">
           *       {children}
           *     </div>
           *   </div>
           * )
           * ```
           *
           * @param startIndex - Index of the first tool call in the group
           * @param endIndex - Index of the last tool call in the group
           * @param children - Rendered tool call components to display within the group
           *
           * @deprecated This feature is still experimental and subject to change.
           */
          ToolGroup?: ComponentType<
            PropsWithChildren<{ startIndex: number; endIndex: number }>
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
  ToolGroup: ({ children }) => children,
} satisfies MessagePrimitiveParts.Props["components"];

type MessagePartComponentProps = {
  components: MessagePrimitiveParts.Props["components"];
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

export namespace MessagePrimitivePartByIndex {
  export type Props = {
    index: number;
    components: MessagePrimitiveParts.Props["components"];
  };
}

/**
 * Renders a single message part at the specified index.
 *
 * This component provides direct access to render a specific message part
 * within the current message context, using the provided component configuration.
 *
 * @example
 * ```tsx
 * <MessagePrimitive.PartByIndex
 *   index={0}
 *   components={{
 *     Text: MyTextComponent,
 *     Image: MyImageComponent
 *   }}
 * />
 * ```
 */
export const MessagePrimitivePartByIndex: FC<MessagePrimitivePartByIndex.Props> =
  memo(
    ({ index, components }) => {
      const messageRuntime = useMessageRuntime();
      const runtime = useMemo(
        () => messageRuntime.getMessagePartByIndex(index),
        [messageRuntime, index],
      );

      return (
        <MessagePartRuntimeProvider runtime={runtime}>
          <MessagePartComponent components={components} />
        </MessagePartRuntimeProvider>
      );
    },
    (prev, next) =>
      prev.index === next.index &&
      prev.components?.Text === next.components?.Text &&
      prev.components?.Reasoning === next.components?.Reasoning &&
      prev.components?.Source === next.components?.Source &&
      prev.components?.Image === next.components?.Image &&
      prev.components?.File === next.components?.File &&
      prev.components?.Unstable_Audio === next.components?.Unstable_Audio &&
      prev.components?.tools === next.components?.tools &&
      prev.components?.ToolGroup === next.components?.ToolGroup,
  );

MessagePrimitivePartByIndex.displayName = "MessagePrimitive.PartByIndex";

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
 * Renders the parts of a message with support for multiple content types.
 *
 * This component automatically handles different types of message content including
 * text, images, files, tool calls, and more. It provides a flexible component
 * system for customizing how each content type is rendered.
 *
 * @example
 * ```tsx
 * <MessagePrimitive.Parts
 *   components={{
 *     Text: ({ text }) => <p className="message-text">{text}</p>,
 *     Image: ({ image }) => <img src={image} alt="Message image" />,
 *     tools: {
 *       by_name: {
 *         calculator: CalculatorTool,
 *         weather: WeatherTool,
 *       },
 *       Fallback: DefaultToolComponent
 *     }
 *   }}
 * />
 * ```
 */
export const MessagePrimitiveParts: FC<MessagePrimitiveParts.Props> = ({
  components,
}) => {
  const contentLength = useMessage((s) => s.content.length);
  const messageRanges = useMessagePartsGroups();

  const partsElements = useMemo(() => {
    if (contentLength === 0) {
      return <EmptyParts components={components} />;
    }

    return messageRanges.map((range) => {
      if (range.type === "single") {
        return (
          <MessagePrimitivePartByIndex
            key={range.index}
            index={range.index}
            components={components}
          />
        );
      } else {
        const ToolGroupComponent =
          components!.ToolGroup ?? defaultComponents.ToolGroup;
        return (
          <ToolGroupComponent
            key={range.startIndex}
            startIndex={range.startIndex}
            endIndex={range.endIndex}
          >
            {Array.from(
              { length: range.endIndex - range.startIndex + 1 },
              (_, i) => (
                <MessagePrimitivePartByIndex
                  key={i}
                  index={range.startIndex + i}
                  components={components}
                />
              ),
            )}
          </ToolGroupComponent>
        );
      }
    });
  }, [messageRanges, components, contentLength]);

  return <>{partsElements}</>;
};

MessagePrimitiveParts.displayName = "MessagePrimitive.Parts";
