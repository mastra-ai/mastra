import { ComponentPropsWithoutRef, forwardRef, type FC } from "react";
import { MessagePrimitive } from "@assistant-ui/react";

import BranchPicker from "./branch-picker";
import { withDefaults } from "./utils/withDefaults";
import UserActionBar from "./user-action-bar";
import ContentPart from "./content-part";
import Attachment from "./attachment-ui";

const UserMessage: FC = () => {
  return (
    <UserMessageRoot>
      <UserMessageAttachments />
      {/* TODO this is temporary until we place the UserActionBar in a better place */}
      <MessagePrimitive.If hasContent>
        <UserActionBar />
        <UserMessageContent />
      </MessagePrimitive.If>
      <BranchPicker />
    </UserMessageRoot>
  );
};

UserMessage.displayName = "UserMessage";

const UserMessageRoot = withDefaults(MessagePrimitive.Root, {
  className: "aui-user-message-root",
});

UserMessageRoot.displayName = "UserMessageRoot";

const UserMessageContentWrapper = withDefaults("div", {
  className: "aui-user-message-content",
});

namespace UserMessageContent {
  export type Element = HTMLDivElement;
  export type Props = MessagePrimitive.Content.Props &
    ComponentPropsWithoutRef<"div">;
}

const UserMessageContent = forwardRef<
  UserMessageContent.Element,
  UserMessageContent.Props
>(({ components, ...props }, ref) => {
  return (
    <UserMessageContentWrapper {...props} ref={ref}>
      <MessagePrimitive.Content
        components={{
          ...components,
          Text: components?.Text ?? ContentPart.Text,
        }}
      />
    </UserMessageContentWrapper>
  );
});

UserMessageContent.displayName = "UserMessageContent";

const UserMessageAttachmentsContainer = withDefaults("div", {
  className: "aui-user-message-attachments",
});

namespace UserMessageAttachments {
  export type Props = Partial<MessagePrimitive.Attachments.Props>;
}

const UserMessageAttachments: FC<UserMessageAttachments.Props> = ({
  components,
}) => {
  return (
    <MessagePrimitive.If hasAttachments>
      <UserMessageAttachmentsContainer>
        <MessagePrimitive.Attachments
          components={{
            ...components,
            Attachment: components?.Attachment ?? Attachment,
          }}
        />
      </UserMessageAttachmentsContainer>
    </MessagePrimitive.If>
  );
};

const exports = {
  Root: UserMessageRoot,
  Content: UserMessageContent,
  Attachments: UserMessageAttachments,
};

export default Object.assign(UserMessage, exports) as typeof UserMessage &
  typeof exports;
