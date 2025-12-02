import { ReadonlyStore } from "../ReadonlyStore";
import { AttachmentRuntime } from "../../api/AttachmentRuntime";
import { UseBoundStore } from "zustand";
export type AttachmentContextValue = {
    useAttachmentRuntime: UseBoundStore<ReadonlyStore<AttachmentRuntime>>;
};
export declare const AttachmentContext: import("react").Context<AttachmentContextValue | null>;
export declare function useAttachmentRuntime(options?: {
    optional?: false | undefined;
}): AttachmentRuntime;
export declare function useAttachmentRuntime(options?: {
    optional?: boolean | undefined;
}): AttachmentRuntime | null;
export declare function useThreadComposerAttachmentRuntime(options?: {
    optional?: false | undefined;
}): AttachmentRuntime<"thread-composer">;
export declare function useThreadComposerAttachmentRuntime(options?: {
    optional?: boolean | undefined;
}): AttachmentRuntime<"thread-composer"> | null;
export declare function useEditComposerAttachmentRuntime(options?: {
    optional?: false | undefined;
}): AttachmentRuntime<"edit-composer">;
export declare function useEditComposerAttachmentRuntime(options?: {
    optional?: boolean | undefined;
}): AttachmentRuntime<"edit-composer"> | null;
export declare function useMessageAttachmentRuntime(options?: {
    optional?: false | undefined;
}): AttachmentRuntime<"message">;
export declare function useMessageAttachmentRuntime(options?: {
    optional?: boolean | undefined;
}): AttachmentRuntime<"message"> | null;
export declare const useAttachment: {
    (): import("../..").AttachmentState & {
        source: "message" | "edit-composer" | "thread-composer";
    };
    <TSelected>(selector: (state: import("../..").AttachmentState & {
        source: "message" | "edit-composer" | "thread-composer";
    }) => TSelected): TSelected;
    <TSelected>(selector: ((state: import("../..").AttachmentState & {
        source: "message" | "edit-composer" | "thread-composer";
    }) => TSelected) | undefined): (import("../..").AttachmentState & {
        source: "message" | "edit-composer" | "thread-composer";
    }) | TSelected;
    (options: {
        optional?: false | undefined;
    }): import("../..").AttachmentState & {
        source: "message" | "edit-composer" | "thread-composer";
    };
    (options: {
        optional?: boolean | undefined;
    }): (import("../..").AttachmentState & {
        source: "message" | "edit-composer" | "thread-composer";
    }) | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: import("../..").AttachmentState & {
            source: "message" | "edit-composer" | "thread-composer";
        }) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: import("../..").AttachmentState & {
            source: "message" | "edit-composer" | "thread-composer";
        }) => TSelected) | undefined;
    }): (import("../..").AttachmentState & {
        source: "message" | "edit-composer" | "thread-composer";
    }) | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: import("../..").AttachmentState & {
            source: "message" | "edit-composer" | "thread-composer";
        }) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: import("../..").AttachmentState & {
            source: "message" | "edit-composer" | "thread-composer";
        }) => TSelected) | undefined;
    }): (import("../..").AttachmentState & {
        source: "message" | "edit-composer" | "thread-composer";
    }) | TSelected | null;
};
export declare const useThreadComposerAttachment: {
    (): {
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "thread-composer";
    } & {
        source: "thread-composer";
    };
    <TSelected>(selector: (state: {
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "thread-composer";
    } & {
        source: "thread-composer";
    }) => TSelected): TSelected;
    <TSelected>(selector: ((state: {
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "thread-composer";
    } & {
        source: "thread-composer";
    }) => TSelected) | undefined): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "thread-composer";
    } & {
        source: "thread-composer";
    }) | TSelected;
    (options: {
        optional?: false | undefined;
    }): {
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "thread-composer";
    } & {
        source: "thread-composer";
    };
    (options: {
        optional?: boolean | undefined;
    }): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "thread-composer";
    } & {
        source: "thread-composer";
    }) | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: {
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
            file: File;
        } & {
            readonly source: "thread-composer";
        } & {
            source: "thread-composer";
        }) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: {
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
            file: File;
        } & {
            readonly source: "thread-composer";
        } & {
            source: "thread-composer";
        }) => TSelected) | undefined;
    }): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "thread-composer";
    } & {
        source: "thread-composer";
    }) | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: {
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
            file: File;
        } & {
            readonly source: "thread-composer";
        } & {
            source: "thread-composer";
        }) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: {
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
            file: File;
        } & {
            readonly source: "thread-composer";
        } & {
            source: "thread-composer";
        }) => TSelected) | undefined;
    }): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "thread-composer";
    } & {
        source: "thread-composer";
    }) | TSelected | null;
};
export declare const useEditComposerAttachment: {
    (): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    });
    <TSelected>(selector: (state: ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    })) => TSelected): TSelected;
    <TSelected>(selector: ((state: ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    })) => TSelected) | undefined): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | TSelected;
    (options: {
        optional?: false | undefined;
    }): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    });
    (options: {
        optional?: boolean | undefined;
    }): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: ({
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
            file: File;
        } & {
            readonly source: "edit-composer";
        } & {
            source: "edit-composer";
        }) | ({
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
            content: import("../..").ThreadUserMessagePart[];
        } & {
            readonly source: "edit-composer";
        } & {
            source: "edit-composer";
        })) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: ({
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
            file: File;
        } & {
            readonly source: "edit-composer";
        } & {
            source: "edit-composer";
        }) | ({
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
            content: import("../..").ThreadUserMessagePart[];
        } & {
            readonly source: "edit-composer";
        } & {
            source: "edit-composer";
        })) => TSelected) | undefined;
    }): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: ({
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
            file: File;
        } & {
            readonly source: "edit-composer";
        } & {
            source: "edit-composer";
        }) | ({
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
            content: import("../..").ThreadUserMessagePart[];
        } & {
            readonly source: "edit-composer";
        } & {
            source: "edit-composer";
        })) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: ({
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
            file: File;
        } & {
            readonly source: "edit-composer";
        } & {
            source: "edit-composer";
        }) | ({
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
            content: import("../..").ThreadUserMessagePart[];
        } & {
            readonly source: "edit-composer";
        } & {
            source: "edit-composer";
        })) => TSelected) | undefined;
    }): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").PendingAttachmentStatus;
        file: File;
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "edit-composer";
    } & {
        source: "edit-composer";
    }) | TSelected | null;
};
export declare const useMessageAttachment: {
    (): {
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "message";
    } & {
        source: "message";
    };
    <TSelected>(selector: (state: {
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "message";
    } & {
        source: "message";
    }) => TSelected): TSelected;
    <TSelected>(selector: ((state: {
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "message";
    } & {
        source: "message";
    }) => TSelected) | undefined): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "message";
    } & {
        source: "message";
    }) | TSelected;
    (options: {
        optional?: false | undefined;
    }): {
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "message";
    } & {
        source: "message";
    };
    (options: {
        optional?: boolean | undefined;
    }): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "message";
    } & {
        source: "message";
    }) | null;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: (state: {
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
            content: import("../..").ThreadUserMessagePart[];
        } & {
            readonly source: "message";
        } & {
            source: "message";
        }) => TSelected;
    }): TSelected;
    <TSelected>(options: {
        optional?: false | undefined;
        selector: ((state: {
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
            content: import("../..").ThreadUserMessagePart[];
        } & {
            readonly source: "message";
        } & {
            source: "message";
        }) => TSelected) | undefined;
    }): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "message";
    } & {
        source: "message";
    }) | TSelected;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: (state: {
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
            content: import("../..").ThreadUserMessagePart[];
        } & {
            readonly source: "message";
        } & {
            source: "message";
        }) => TSelected;
    }): TSelected | null;
    <TSelected>(options: {
        optional?: boolean | undefined;
        selector: ((state: {
            id: string;
            type: "image" | "document" | "file";
            name: string;
            contentType: string;
            file?: File;
            content?: import("../..").ThreadUserMessagePart[];
        } & {
            status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
            content: import("../..").ThreadUserMessagePart[];
        } & {
            readonly source: "message";
        } & {
            source: "message";
        }) => TSelected) | undefined;
    }): ({
        id: string;
        type: "image" | "document" | "file";
        name: string;
        contentType: string;
        file?: File;
        content?: import("../..").ThreadUserMessagePart[];
    } & {
        status: import("../../types/AttachmentTypes").CompleteAttachmentStatus;
        content: import("../..").ThreadUserMessagePart[];
    } & {
        readonly source: "message";
    } & {
        source: "message";
    }) | TSelected | null;
};
//# sourceMappingURL=AttachmentContext.d.ts.map