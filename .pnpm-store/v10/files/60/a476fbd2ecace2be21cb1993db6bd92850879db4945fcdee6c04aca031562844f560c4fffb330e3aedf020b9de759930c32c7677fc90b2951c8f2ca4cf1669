import type { ThreadMessage } from "../../types";
import { ThreadMessageLike } from "../external-store";
/**
 * Represents a message item that can be exported from the repository.
 */
export type ExportedMessageRepositoryItem = {
    /** The message data */
    message: ThreadMessage;
    /** ID of the parent message, or null for root messages */
    parentId: string | null;
};
/**
 * Represents the entire repository state for export/import.
 */
export type ExportedMessageRepository = {
    /** ID of the head message, or null/undefined if no head */
    headId?: string | null;
    /** Array of all messages with their parent references */
    messages: Array<{
        message: ThreadMessage;
        parentId: string | null;
    }>;
};
/**
 * Utility functions for working with exported message repositories.
 */
export declare const ExportedMessageRepository: {
    /**
     * Converts an array of messages to an ExportedMessageRepository format.
     * Creates parent-child relationships based on the order of messages in the array.
     *
     * @param messages - Array of message-like objects to convert
     * @returns ExportedMessageRepository with parent-child relationships established
     */
    fromArray: (messages: readonly ThreadMessageLike[]) => ExportedMessageRepository;
};
/**
 * A repository that manages a tree of messages with branching capabilities.
 * Supports operations like adding, updating, and deleting messages, as well as
 * managing multiple conversation branches.
 */
export declare class MessageRepository {
    /** Map of message IDs to repository message objects */
    private messages;
    /** Reference to the current head (most recent) message in the active branch */
    private head;
    /** Root node of the tree structure */
    private root;
    /**
     * Performs link/unlink operations between messages in the tree.
     *
     * @param newParent - The new parent message, or null
     * @param child - The child message to operate on
     * @param operation - The type of operation to perform:
     *   - "cut": Remove the child from its current parent
     *   - "link": Add the child to a new parent
     *   - "relink": Both cut and link operations
     */
    private performOp;
    /** Cached array of messages in the current active branch, from root to head */
    private _messages;
    /**
     * Gets the ID of the current head message.
     * @returns The ID of the head message, or null if no messages exist
     */
    get headId(): string | null;
    /**
     * Gets all messages in the current active branch, from root to head.
     * @returns Array of messages in the current branch
     */
    getMessages(): readonly ThreadMessage[];
    /**
     * Adds a new message or updates an existing one in the repository.
     * If the message ID already exists, the message is updated and potentially relinked to a new parent.
     * If the message is new, it's added as a child of the specified parent.
     *
     * @param parentId - ID of the parent message, or null for root messages
     * @param message - The message to add or update
     * @throws Error if the parent message is not found
     */
    addOrUpdateMessage(parentId: string | null, message: ThreadMessage): void;
    /**
     * Gets a message and its parent ID by message ID.
     *
     * @param messageId - ID of the message to retrieve
     * @returns Object containing the message and its parent ID
     * @throws Error if the message is not found
     */
    getMessage(messageId: string): {
        parentId: string | null;
        message: ThreadMessage;
    };
    /**
     * Adds an optimistic message to the repository.
     * An optimistic message is a temporary placeholder that will be replaced by a real message later.
     *
     * @param parentId - ID of the parent message, or null for root messages
     * @param message - The core message to convert to an optimistic message
     * @returns The generated optimistic ID
     */
    appendOptimisticMessage(parentId: string | null, message: ThreadMessageLike): string;
    /**
     * Deletes a message from the repository and relinks its children.
     *
     * @param messageId - ID of the message to delete
     * @param replacementId - Optional ID of the message to become the new parent of the children,
     *                       undefined means use the deleted message's parent,
     *                       null means use the root
     * @throws Error if the message or replacement is not found
     */
    deleteMessage(messageId: string, replacementId?: string | null | undefined): void;
    /**
     * Gets all branch IDs (sibling messages) at the level of a specified message.
     *
     * @param messageId - ID of the message to find branches for
     * @returns Array of message IDs representing branches
     * @throws Error if the message is not found
     */
    getBranches(messageId: string): string[];
    /**
     * Switches the active branch to the one containing the specified message.
     *
     * @param messageId - ID of the message in the branch to switch to
     * @throws Error if the branch is not found
     */
    switchToBranch(messageId: string): void;
    /**
     * Resets the head to a specific message or null.
     *
     * @param messageId - ID of the message to set as head, or null to clear the head
     * @throws Error if the message is not found
     */
    resetHead(messageId: string | null): void;
    /**
     * Clears all messages from the repository.
     */
    clear(): void;
    /**
     * Exports the repository state for persistence.
     *
     * @returns Exportable repository state
     */
    export(): ExportedMessageRepository;
    /**
     * Imports repository state from an exported repository.
     *
     * @param repository - The exported repository state to import
     */
    import({ headId, messages }: ExportedMessageRepository): void;
}
//# sourceMappingURL=MessageRepository.d.ts.map