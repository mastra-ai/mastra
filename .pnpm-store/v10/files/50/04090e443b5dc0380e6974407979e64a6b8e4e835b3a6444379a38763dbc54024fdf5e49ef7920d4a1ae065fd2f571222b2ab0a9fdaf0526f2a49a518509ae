"use client";

import {
  ComponentType,
  FC,
  PropsWithChildren,
  ReactNode,
  createContext,
  useContext,
} from "react";

import { AvatarProps } from "./base/avatar";
import {
  AssistantRuntime,
  EmptyContentPartComponent,
  TextContentPartComponent,
  ToolCallContentPartProps,
  AssistantRuntimeProvider,
  AssistantToolUI,
  useAssistantRuntime,
} from "@assistant-ui/react";

export type SuggestionConfig = {
  text?: ReactNode | undefined;
  prompt: string;
};

export type ThreadWelcomeConfig = {
  message?: string | null | undefined;
  suggestions?: SuggestionConfig[] | undefined;
};

export type UserMessageConfig = {
  allowEdit?: boolean | undefined;
};

export type AssistantMessageConfig = {
  allowReload?: boolean | undefined;
  allowCopy?: boolean | undefined;
  allowSpeak?: boolean | undefined;
  allowFeedbackPositive?: boolean | undefined;
  allowFeedbackNegative?: boolean | undefined;
  components?:
    | {
        Text?: TextContentPartComponent | undefined;
        Empty?: EmptyContentPartComponent | undefined;
        ToolFallback?: ComponentType<ToolCallContentPartProps> | undefined;
        Footer?: ComponentType | undefined;
      }
    | undefined;
};

export type BranchPickerConfig = {
  allowBranchPicker?: boolean | undefined;
};

export type ComposerConfig = {
  allowAttachments?: boolean | undefined;
};

export type StringsConfig = {
  assistantModal?: {
    open: {
      button: {
        tooltip?: string | undefined;
      };
    };
    closed: {
      button: {
        tooltip?: string | undefined;
      };
    };
  };
  threadList?: {
    new?: {
      label?: string | undefined;
    };
    item?: {
      title?: {
        fallback?: string | undefined;
      };
      archive?: {
        tooltip?: string | undefined;
      };
    };
  };
  thread?: {
    scrollToBottom?: {
      tooltip?: string | undefined;
    };
  };
  welcome?: {
    message?: string | undefined;
  };
  userMessage?: {
    edit?: {
      tooltip?: string | undefined;
    };
  };
  assistantMessage?: {
    reload?: {
      tooltip?: string | undefined;
    };
    copy?: {
      tooltip?: string | undefined;
    };
    speak?: {
      tooltip?: string | undefined;
      stop?: {
        tooltip?: string | undefined;
      };
    };
    feedback?: {
      positive?: {
        tooltip?: string | undefined;
      };
      negative?: {
        tooltip?: string | undefined;
      };
    };
  };
  branchPicker?: {
    previous?: {
      tooltip?: string | undefined;
    };
    next?: {
      tooltip?: string | undefined;
    };
  };
  composer?: {
    send?:
      | {
          tooltip?: string | undefined;
        }
      | undefined;
    cancel?:
      | {
          tooltip?: string | undefined;
        }
      | undefined;
    addAttachment?:
      | {
          tooltip?: string | undefined;
        }
      | undefined;
    removeAttachment?: {
      tooltip?: string | undefined;
    };
    input?: {
      placeholder?: string | undefined;
    };
  };
  editComposer?: {
    send?: {
      label?: string | undefined;
    };
    cancel?: {
      label?: string | undefined;
    };
  };
  code?: {
    header?: {
      copy?: {
        tooltip?: string | undefined;
      };
    };
  };
};

const ThreadConfigContext = createContext<ThreadConfig>({});

export type ThreadConfig = {
  runtime?: AssistantRuntime | undefined;

  assistantAvatar?: AvatarProps | undefined;

  welcome?: ThreadWelcomeConfig | undefined;
  assistantMessage?: AssistantMessageConfig | undefined;
  userMessage?: UserMessageConfig | undefined;

  branchPicker?: BranchPickerConfig | undefined;

  composer?: ComposerConfig | undefined;

  strings?: StringsConfig | undefined;

  tools?: AssistantToolUI[] | undefined; // TODO add AssistantTool support

  components?:
    | {
        UserMessage?: ComponentType | undefined;
        AssistantMessage?: ComponentType | undefined;
        EditComposer?: ComponentType | undefined;
        Composer?: ComponentType | undefined;
        ThreadWelcome?: ComponentType | undefined;
        MessagesFooter?: ComponentType | undefined;
      }
    | undefined;
};

export const useThreadConfig = (): Omit<ThreadConfig, "runtime"> => {
  return useContext(ThreadConfigContext);
};

export type ThreadConfigProviderProps = PropsWithChildren<{
  config?: ThreadConfig | undefined;
}>;

export const ThreadConfigProvider: FC<ThreadConfigProviderProps> = ({
  children,
  config,
}) => {
  const hasAssistant = !!useAssistantRuntime({ optional: true });

  const hasConfig = config && Object.keys(config).length > 0;
  const outerConfig = useThreadConfig();

  if (hasConfig && Object.keys(outerConfig).length > 0) {
    throw new Error(
      "You are providing ThreadConfig to several nested components. Please provide all configuration to the same component.",
    );
  }

  const configProvider = hasConfig ? (
    <ThreadConfigContext.Provider value={config}>
      {children}
    </ThreadConfigContext.Provider>
  ) : (
    <>{children}</>
  );

  if (!config?.runtime) return configProvider;

  if (hasAssistant) {
    throw new Error(
      "You provided a runtime to <Thread> while simulataneously using <AssistantRuntimeProvider>. This is not allowed.",
    );
  }
  return (
    <AssistantRuntimeProvider runtime={config.runtime}>
      {configProvider}
    </AssistantRuntimeProvider>
  );
};

ThreadConfigProvider.displayName = "ThreadConfigProvider";
