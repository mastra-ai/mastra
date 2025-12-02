"use client";

import { ComponentPropsWithoutRef, forwardRef, type FC } from "react";
import { withDefaults } from "./utils/withDefaults";
import { Avatar } from "./base/avatar";
import { SuggestionConfig, useThreadConfig } from "./thread-config";
import { ThreadPrimitive, useThread } from "@assistant-ui/react";

const ThreadWelcome: FC = () => {
  return (
    <ThreadWelcomeRoot>
      <ThreadWelcomeCenter>
        <ThreadWelcomeAvatar />
        <ThreadWelcomeMessage />
      </ThreadWelcomeCenter>
      <ThreadWelcomeSuggestions />
    </ThreadWelcomeRoot>
  );
};

ThreadWelcome.displayName = "ThreadWelcome";

const ThreadWelcomeRootStyled = withDefaults("div", {
  className: "aui-thread-welcome-root",
});

const ThreadWelcomeCenter = withDefaults("div", {
  className: "aui-thread-welcome-center",
});

namespace ThreadWelcomeRoot {
  export type Element = HTMLDivElement;
  export type Props = ComponentPropsWithoutRef<"div">;
}

const ThreadWelcomeRoot = forwardRef<
  ThreadWelcomeRoot.Element,
  ThreadWelcomeRoot.Props
>((props, ref) => {
  return (
    <ThreadPrimitive.Empty>
      <ThreadWelcomeRootStyled {...props} ref={ref} />
    </ThreadPrimitive.Empty>
  );
});

ThreadWelcomeRoot.displayName = "ThreadWelcomeRoot";

const ThreadWelcomeAvatar: FC = () => {
  const { assistantAvatar: avatar = { fallback: "A" } } = useThreadConfig();
  return <Avatar {...avatar} />;
};

const ThreadWelcomeMessageStyled = withDefaults("p", {
  className: "aui-thread-welcome-message",
});

namespace ThreadWelcomeMessage {
  export type Element = HTMLParagraphElement;
  export type Props = Omit<
    ComponentPropsWithoutRef<typeof ThreadWelcomeMessageStyled>,
    "children"
  > & { message?: string | undefined };
}

const ThreadWelcomeMessage = forwardRef<
  ThreadWelcomeMessage.Element,
  ThreadWelcomeMessage.Props
>(({ message: messageProp, ...rest }, ref) => {
  const {
    welcome: { message } = {},
    strings: {
      welcome: { message: defaultMessage = "How can I help you today?" } = {},
    } = {},
  } = useThreadConfig();
  return (
    <ThreadWelcomeMessageStyled {...rest} ref={ref}>
      {messageProp ?? message ?? defaultMessage}
    </ThreadWelcomeMessageStyled>
  );
});

ThreadWelcomeMessage.displayName = "ThreadWelcomeMessage";

const ThreadWelcomeSuggestionContainer = withDefaults("div", {
  className: "aui-thread-welcome-suggestions",
});

const ThreadWelcomeSuggestionStyled = withDefaults(ThreadPrimitive.Suggestion, {
  className: "aui-thread-welcome-suggestion",
});

export namespace ThreadWelcomeSuggestion {
  export type Props = {
    suggestion: SuggestionConfig;
  };
}

const ThreadWelcomeSuggestion: FC<ThreadWelcomeSuggestion.Props> = ({
  suggestion: { text, prompt },
}) => {
  return (
    <ThreadWelcomeSuggestionStyled prompt={prompt} method="replace" autoSend>
      <span className="aui-thread-welcome-suggestion-text">
        {text ?? prompt}
      </span>
    </ThreadWelcomeSuggestionStyled>
  );
};

const ThreadWelcomeSuggestions: FC = () => {
  const suggestions2 = useThread((t) => t.suggestions);
  const { welcome: { suggestions } = {} } = useThreadConfig();

  const finalSuggestions = suggestions2.length ? suggestions2 : suggestions;

  return (
    <ThreadWelcomeSuggestionContainer>
      {finalSuggestions?.map((suggestion, idx) => {
        const key = `${suggestion.prompt}-${idx}`;
        return <ThreadWelcomeSuggestion key={key} suggestion={suggestion} />;
      })}
    </ThreadWelcomeSuggestionContainer>
  );
};

ThreadWelcomeSuggestions.displayName = "ThreadWelcomeSuggestions";

const exports = {
  Root: ThreadWelcomeRoot,
  Center: ThreadWelcomeCenter,
  Avatar: ThreadWelcomeAvatar,
  Message: ThreadWelcomeMessage,
  Suggestions: ThreadWelcomeSuggestions,
  Suggestion: ThreadWelcomeSuggestion,
};

export default Object.assign(ThreadWelcome, exports) as typeof ThreadWelcome &
  typeof exports;
