import type {
  ComposerRuntimeCore,
  ThreadComposerRuntimeCore,
} from "../runtimes/core/ComposerRuntimeCore";
import type { ThreadRuntimeCore } from "../runtimes/core/ThreadRuntimeCore";
import type { ThreadListRuntimeCore } from "../runtimes/core/ThreadListRuntimeCore";
import type { SubscribableWithState } from "./subscribable/Subscribable";
import type { ThreadMessage } from "../types";
import type {
  SpeechState,
  SubmittedFeedback,
} from "../runtimes/core/ThreadRuntimeCore";
import type {
  ComposerRuntimePath,
  ThreadRuntimePath,
  ThreadListItemRuntimePath,
  MessageRuntimePath,
} from "./RuntimePathTypes";

export type ComposerRuntimeCoreBinding = SubscribableWithState<
  ComposerRuntimeCore | undefined,
  ComposerRuntimePath
>;

export type ThreadComposerRuntimeCoreBinding = SubscribableWithState<
  ThreadComposerRuntimeCore | undefined,
  ComposerRuntimePath & { composerSource: "thread" }
>;

export type EditComposerRuntimeCoreBinding = SubscribableWithState<
  ComposerRuntimeCore | undefined,
  ComposerRuntimePath & { composerSource: "edit" }
>;

export type ThreadRuntimeCoreBinding = SubscribableWithState<
  ThreadRuntimeCore,
  ThreadRuntimePath
>;

export type ThreadListRuntimeCoreBinding = SubscribableWithState<
  ThreadListRuntimeCore,
  ThreadListItemRuntimePath
>;

export type MessageStateBinding = SubscribableWithState<
  ThreadMessage & {
    readonly parentId: string | null;
    readonly isLast: boolean;
    readonly branchNumber: number;
    readonly branchCount: number;
    readonly speech: SpeechState | undefined;
    readonly submittedFeedback: SubmittedFeedback | undefined;
  },
  MessageRuntimePath
>;

export type ThreadListItemStatus = "archived" | "regular" | "new" | "deleted";

export type ThreadListItemState = {
  readonly isMain: boolean;
  readonly id: string;
  readonly remoteId: string | undefined;
  readonly externalId: string | undefined;
  /**
   * @deprecated Use `id` instead. This field will be removed in version 0.8.0.
   */
  readonly threadId: string;
  readonly status: ThreadListItemStatus;
  readonly title?: string | undefined;
};
