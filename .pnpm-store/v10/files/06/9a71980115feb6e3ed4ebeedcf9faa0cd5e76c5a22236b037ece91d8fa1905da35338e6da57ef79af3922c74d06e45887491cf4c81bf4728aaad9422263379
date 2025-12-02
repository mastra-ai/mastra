"use client";

import { ComponentPropsWithoutRef, forwardRef, useMemo, type FC } from "react";
import { MessagePrimitive } from "@assistant-ui/react";
import BranchPicker from "./branch-picker";
import { Avatar } from "./base/avatar";
import { withDefaults } from "./utils/withDefaults";
import { useThreadConfig } from "./thread-config";
import AssistantActionBar from "./assistant-action-bar";
import ContentPart from "./content-part";

const AssistantMessage: FC = () => {
  return (
    <AssistantMessageRoot>
      <AssistantMessageAvatar />
      <AssistantMessageContent />
      <BranchPicker />
      <AssistantActionBar />
    </AssistantMessageRoot>
  );
};

AssistantMessage.displayName = "AssistantMessage";

const AssistantMessageAvatar: FC = () => {
  const { assistantAvatar: avatar = { fallback: "A" } } = useThreadConfig();
  return <Avatar {...avatar} />;
};

const AssistantMessageRoot = withDefaults(MessagePrimitive.Root, {
  className: "aui-assistant-message-root",
});

AssistantMessageRoot.displayName = "AssistantMessageRoot";

const AssistantMessageContentWrapper = withDefaults("div", {
  className: "aui-assistant-message-content",
});

namespace AssistantMessageContent {
  export type Element = HTMLDivElement;
  export type Props = MessagePrimitive.Content.Props &
    ComponentPropsWithoutRef<"div">;
}

const AssistantMessageContent = forwardRef<
  AssistantMessageContent.Element,
  AssistantMessageContent.Props
>(({ components: componentsProp, ...rest }, ref) => {
  const { tools, assistantMessage: { components = {} } = {} } =
    useThreadConfig();

  const toolsComponents = useMemo(
    () => ({
      by_name: !tools
        ? undefined
        : Object.fromEntries(
            tools.map((t) => [
              t.unstable_tool.toolName,
              t.unstable_tool.render,
            ]),
          ),
      Fallback: components.ToolFallback,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...(tools ?? []), components.ToolFallback],
  );
  const Footer = components.Footer;

  return (
    <AssistantMessageContentWrapper {...rest} ref={ref}>
      <MessagePrimitive.Content
        components={{
          ...componentsProp,
          Text: componentsProp?.Text ?? components.Text ?? ContentPart.Text,
          Empty: componentsProp?.Empty ?? components.Empty,
          tools: toolsComponents,
        }}
      />
      {Footer && <Footer />}
    </AssistantMessageContentWrapper>
  );
});

AssistantMessageContent.displayName = "AssistantMessageContent";

const exports = {
  Root: AssistantMessageRoot,
  Avatar: AssistantMessageAvatar,
  Content: AssistantMessageContent,
};

export default Object.assign(
  AssistantMessage,
  exports,
) as typeof AssistantMessage & typeof exports;
