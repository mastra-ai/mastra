"use client";

import { forwardRef, type FC } from "react";
import {
  AudioLinesIcon,
  CheckIcon,
  CopyIcon,
  RefreshCwIcon,
  StopCircleIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import {
  ActionBarPrimitive,
  MessagePrimitive,
  useThread,
  } from "@assistant-ui/react";
import { TooltipIconButton } from "./base/tooltip-icon-button";
import { withDefaults } from "./utils/withDefaults";
import { useThreadConfig } from "./thread-config";

const useAllowCopy = (ensureCapability = false) => {
  const { assistantMessage: { allowCopy = true } = {} } = useThreadConfig();
  const copySupported = useThread((t) => t.capabilities.unstable_copy);
  return allowCopy && (!ensureCapability || copySupported);
};

const useAllowSpeak = (ensureCapability = false) => {
  const { assistantMessage: { allowSpeak = true } = {} } = useThreadConfig();
  const speechSupported = useThread((t) => t.capabilities.speech);
  return allowSpeak && (!ensureCapability || speechSupported);
};

const useAllowReload = (ensureCapability = false) => {
  const { assistantMessage: { allowReload = true } = {} } = useThreadConfig();
  const reloadSupported = useThread((t) => t.capabilities.reload);
  return allowReload && (!ensureCapability || reloadSupported);
};

const useAllowFeedbackPositive = (ensureCapability = false) => {
  const { assistantMessage: { allowFeedbackPositive = true } = {} } =
    useThreadConfig();
  const feedbackSupported = useThread((t) => t.capabilities.feedback);
  return allowFeedbackPositive && (!ensureCapability || feedbackSupported);
};

const useAllowFeedbackNegative = (ensureCapability = false) => {
  const { assistantMessage: { allowFeedbackNegative = true } = {} } =
    useThreadConfig();
  const feedbackSupported = useThread((t) => t.capabilities.feedback);
  return allowFeedbackNegative && (!ensureCapability || feedbackSupported);
};

const AssistantActionBar: FC = () => {
  const allowCopy = useAllowCopy(true);
  const allowReload = useAllowReload(true);
  const allowSpeak = useAllowSpeak(true);
  const allowFeedbackPositive = useAllowFeedbackPositive(true);
  const allowFeedbackNegative = useAllowFeedbackNegative(true);
  if (
    !allowCopy &&
    !allowReload &&
    !allowSpeak &&
    !allowFeedbackPositive &&
    !allowFeedbackNegative
  )
    return null;

  return (
    <AssistantActionBarRoot
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
    >
      {allowSpeak && <AssistantActionBarSpeechControl />}
      {allowCopy && <AssistantActionBarCopy />}
      {allowReload && <AssistantActionBarReload />}
      {allowFeedbackPositive && <AssistantActionBarFeedbackPositive />}
      {allowFeedbackNegative && <AssistantActionBarFeedbackNegative />}
    </AssistantActionBarRoot>
  );
};

AssistantActionBar.displayName = "AssistantActionBar";

const AssistantActionBarRoot = withDefaults(ActionBarPrimitive.Root, {
  className: "aui-assistant-action-bar-root",
});

AssistantActionBarRoot.displayName = "AssistantActionBarRoot";

namespace AssistantActionBarCopy {
  export type Element = ActionBarPrimitive.Copy.Element;
  export type Props = Partial<TooltipIconButton.Props> & {
    copiedDuration?: number | undefined;
  };
}

const AssistantActionBarCopy = forwardRef<
  AssistantActionBarCopy.Element,
  AssistantActionBarCopy.Props
>(({ copiedDuration, ...props }, ref) => {
  const {
    strings: {
      assistantMessage: { copy: { tooltip = "Copy" } = {} } = {},
    } = {},
  } = useThreadConfig();

  return (
    <ActionBarPrimitive.Copy copiedDuration={copiedDuration} asChild>
      <TooltipIconButton tooltip={tooltip} {...props} ref={ref}>
        {props.children ?? (
          <>
            <MessagePrimitive.If copied>
              <CheckIcon />
            </MessagePrimitive.If>
            <MessagePrimitive.If copied={false}>
              <CopyIcon />
            </MessagePrimitive.If>
          </>
        )}
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
  );
});

AssistantActionBarCopy.displayName = "AssistantActionBarCopy";

const AssistantActionBarSpeechControl: FC = () => {
  return (
    <>
      <MessagePrimitive.If speaking={false}>
        <AssistantActionBarSpeak />
      </MessagePrimitive.If>
      <MessagePrimitive.If speaking>
        <AssistantActionBarStopSpeaking />
      </MessagePrimitive.If>
    </>
  );
};

namespace AssistantActionBarSpeak {
  export type Element = ActionBarPrimitive.Speak.Element;
  export type Props = Partial<TooltipIconButton.Props>;
}

const AssistantActionBarSpeak = forwardRef<
  AssistantActionBarSpeak.Element,
  AssistantActionBarSpeak.Props
>((props, ref) => {
  const {
    strings: {
      assistantMessage: { speak: { tooltip = "Read aloud" } = {} } = {},
    } = {},
  } = useThreadConfig();
  const allowSpeak = useAllowSpeak();

  return (
    <ActionBarPrimitive.Speak disabled={!allowSpeak} asChild>
      <TooltipIconButton tooltip={tooltip} {...props} ref={ref}>
        {props.children ?? <AudioLinesIcon />}
      </TooltipIconButton>
    </ActionBarPrimitive.Speak>
  );
});

AssistantActionBarSpeak.displayName = "AssistantActionBarSpeak";

namespace AssistantActionBarStopSpeaking {
  export type Element = ActionBarPrimitive.StopSpeaking.Element;
  export type Props = Partial<TooltipIconButton.Props>;
}

const AssistantActionBarStopSpeaking = forwardRef<
  AssistantActionBarStopSpeaking.Element,
  AssistantActionBarStopSpeaking.Props
>((props, ref) => {
  const {
    strings: {
      assistantMessage: {
        speak: { stop: { tooltip: stopTooltip = "Stop" } = {} } = {},
      } = {},
    } = {},
  } = useThreadConfig();
  const allowSpeak = useAllowSpeak();

  return (
    <ActionBarPrimitive.StopSpeaking disabled={!allowSpeak} asChild>
      <TooltipIconButton tooltip={stopTooltip} {...props} ref={ref}>
        {props.children ?? <StopCircleIcon />}
      </TooltipIconButton>
    </ActionBarPrimitive.StopSpeaking>
  );
});

AssistantActionBarStopSpeaking.displayName = "AssistantActionBarStopSpeaking";

namespace AssistantActionBarReload {
  export type Element = ActionBarPrimitive.Reload.Element;
  export type Props = Partial<TooltipIconButton.Props>;
}

const AssistantActionBarReload = forwardRef<
  AssistantActionBarReload.Element,
  AssistantActionBarReload.Props
>((props, ref) => {
  const {
    strings: {
      assistantMessage: { reload: { tooltip = "Refresh" } = {} } = {},
    } = {},
  } = useThreadConfig();
  const allowReload = useAllowReload();
  return (
    <ActionBarPrimitive.Reload disabled={!allowReload} asChild>
      <TooltipIconButton tooltip={tooltip} {...props} ref={ref}>
        {props.children ?? <RefreshCwIcon />}
      </TooltipIconButton>
    </ActionBarPrimitive.Reload>
  );
});

AssistantActionBarReload.displayName = "AssistantActionBarReload";

namespace AssistantActionBarFeedbackPositive {
  export type Element = ActionBarPrimitive.FeedbackPositive.Element;
  export type Props = Partial<TooltipIconButton.Props>;
}

const AssistantActionBarFeedbackPositive = forwardRef<
  AssistantActionBarFeedbackPositive.Element,
  AssistantActionBarFeedbackPositive.Props
>((props, ref) => {
  const {
    strings: {
      assistantMessage: {
        feedback: { positive: { tooltip = "Good response" } = {} } = {},
      } = {},
    } = {},
  } = useThreadConfig();
  const allowFeedbackPositive = useAllowFeedbackPositive();
  return (
    <ActionBarPrimitive.FeedbackPositive
      disabled={!allowFeedbackPositive}
      className="aui-assistant-action-bar-feedback-positive"
      asChild
    >
      <TooltipIconButton tooltip={tooltip} {...props} ref={ref}>
        {props.children ?? <ThumbsUpIcon />}
      </TooltipIconButton>
    </ActionBarPrimitive.FeedbackPositive>
  );
});

AssistantActionBarFeedbackPositive.displayName =
  "AssistantActionBarFeedbackPositive";

namespace AssistantActionBarFeedbackNegative {
  export type Element = ActionBarPrimitive.FeedbackNegative.Element;
  export type Props = Partial<TooltipIconButton.Props>;
}

const AssistantActionBarFeedbackNegative = forwardRef<
  AssistantActionBarFeedbackNegative.Element,
  AssistantActionBarFeedbackNegative.Props
>((props, ref) => {
  const {
    strings: {
      assistantMessage: {
        feedback: { negative: { tooltip = "Bad response" } = {} } = {},
      } = {},
    } = {},
  } = useThreadConfig();
  const allowFeedbackNegative = useAllowFeedbackNegative();
  return (
    <ActionBarPrimitive.FeedbackNegative
      disabled={!allowFeedbackNegative}
      className="aui-assistant-action-bar-feedback-negative"
      asChild
    >
      <TooltipIconButton tooltip={tooltip} {...props} ref={ref}>
        {props.children ?? <ThumbsDownIcon />}
      </TooltipIconButton>
    </ActionBarPrimitive.FeedbackNegative>
  );
});

AssistantActionBarFeedbackNegative.displayName =
  "AssistantActionBarFeedbackNegative";

const exports = {
  Root: AssistantActionBarRoot,
  Reload: AssistantActionBarReload,
  Copy: AssistantActionBarCopy,
  Speak: AssistantActionBarSpeak,
  StopSpeaking: AssistantActionBarStopSpeaking,
  SpeechControl: AssistantActionBarSpeechControl,
  FeedbackPositive: AssistantActionBarFeedbackPositive,
  FeedbackNegative: AssistantActionBarFeedbackNegative,
};

export default Object.assign(
  AssistantActionBar,
  exports,
) as typeof AssistantActionBar & typeof exports;
