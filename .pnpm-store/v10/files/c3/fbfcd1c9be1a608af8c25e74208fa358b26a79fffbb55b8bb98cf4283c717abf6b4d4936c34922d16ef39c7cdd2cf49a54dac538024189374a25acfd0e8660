export type ThreadListItemRuntimePath = {
  readonly ref: string;
  readonly threadSelector:
    | { readonly type: "main" }
    | { readonly type: "index"; readonly index: number }
    | { readonly type: "archiveIndex"; readonly index: number }
    | { readonly type: "threadId"; readonly threadId: string };
};

export type ThreadRuntimePath = {
  readonly ref: string;
  readonly threadSelector:
    | { readonly type: "main" }
    | {
        readonly type: "threadId";
        readonly threadId: string;
      };
};

export type MessageRuntimePath = ThreadRuntimePath & {
  readonly messageSelector:
    | { readonly type: "messageId"; readonly messageId: string }
    | { readonly type: "index"; readonly index: number };
};

export type MessagePartRuntimePath = MessageRuntimePath & {
  readonly messagePartSelector:
    | { readonly type: "index"; readonly index: number }
    | { readonly type: "toolCallId"; readonly toolCallId: string };
};

export type AttachmentRuntimePath = (
  | (MessageRuntimePath & {
      readonly attachmentSource: "message" | "edit-composer";
    })
  | (ThreadRuntimePath & {
      readonly attachmentSource: "thread-composer";
    })
) & {
  readonly attachmentSelector:
    | {
        readonly type: "index";
        readonly index: number;
      }
    | {
        readonly type: "index";
        readonly index: number;
      }
    | {
        readonly type: "index";
        readonly index: number;
      };
};

export type ComposerRuntimePath =
  | (ThreadRuntimePath & {
      readonly composerSource: "thread";
    })
  | (MessageRuntimePath & {
      readonly composerSource: "edit";
    });
