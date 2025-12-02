import type { ThreadMessage } from "../../types";
import { generateId, generateOptimisticId } from "../../utils/idUtils";
import { ThreadMessageLike } from "../external-store";
import { getAutoStatus } from "../external-store/auto-status";
import { fromThreadMessageLike } from "../external-store/ThreadMessageLike";

/**
 * Represents a parent node in the repository tree structure.
 */
type RepositoryParent = {
  /** IDs of child messages */
  children: string[];
  /** Reference to the next message in the active branch */
  next: RepositoryMessage | null;
};

/**
 * Represents a message node in the repository tree structure.
 */
type RepositoryMessage = RepositoryParent & {
  /** Reference to the parent message */
  prev: RepositoryMessage | null;
  /** The actual message data */
  current: ThreadMessage;
  /** The depth level in the tree (0 for root messages) */
  level: number;
};

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
export const ExportedMessageRepository = {
  /**
   * Converts an array of messages to an ExportedMessageRepository format.
   * Creates parent-child relationships based on the order of messages in the array.
   *
   * @param messages - Array of message-like objects to convert
   * @returns ExportedMessageRepository with parent-child relationships established
   */
  fromArray: (
    messages: readonly ThreadMessageLike[],
  ): ExportedMessageRepository => {
    const conv = messages.map((m) =>
      fromThreadMessageLike(
        m,
        generateId(),
        getAutoStatus(false, false, false),
      ),
    );

    return {
      messages: conv.map((m, idx) => ({
        parentId: idx > 0 ? conv[idx - 1]!.id : null,
        message: m,
      })),
    };
  },
};

/**
 * Recursively finds the head (leaf) message in a branch.
 *
 * @param message - The starting message or parent node
 * @returns The leaf message of the branch, or null if not found
 */
const findHead = (
  message: RepositoryMessage | RepositoryParent,
): RepositoryMessage | null => {
  if (message.next) return findHead(message.next);
  if ("current" in message) return message;
  return null;
};

/**
 * A utility class for caching computed values and invalidating the cache when needed.
 */
class CachedValue<T> {
  private _value: T | null = null;

  /**
   * @param func - The function that computes the cached value
   */
  constructor(private func: () => T) {}

  /**
   * Gets the cached value, computing it if necessary.
   */
  get value() {
    if (this._value === null) {
      this._value = this.func();
    }
    return this._value;
  }

  /**
   * Invalidates the cache, forcing recomputation on next access.
   */
  dirty() {
    this._value = null;
  }
}

/**
 * A repository that manages a tree of messages with branching capabilities.
 * Supports operations like adding, updating, and deleting messages, as well as
 * managing multiple conversation branches.
 */
export class MessageRepository {
  /** Map of message IDs to repository message objects */
  private messages = new Map<string, RepositoryMessage>();
  /** Reference to the current head (most recent) message in the active branch */
  private head: RepositoryMessage | null = null;
  /** Root node of the tree structure */
  private root: RepositoryParent = {
    children: [],
    next: null,
  };

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
  private performOp(
    newParent: RepositoryMessage | null,
    child: RepositoryMessage,
    operation: "cut" | "link" | "relink",
  ) {
    const parentOrRoot = child.prev ?? this.root;
    const newParentOrRoot = newParent ?? this.root;

    if (operation === "relink" && parentOrRoot === newParentOrRoot) return;

    // cut
    if (operation !== "link") {
      // remove from parentOrRoot.children
      parentOrRoot.children = parentOrRoot.children.filter(
        (m) => m !== child.current.id,
      );

      // update parentOrRoot.next
      if (parentOrRoot.next === child) {
        const fallbackId = parentOrRoot.children.at(-1);
        const fallback = fallbackId ? this.messages.get(fallbackId) : null;
        if (fallback === undefined) {
          throw new Error(
            "MessageRepository(performOp/cut): Fallback sibling message not found. This is likely an internal bug in assistant-ui.",
          );
        }
        parentOrRoot.next = fallback;
      }
    }

    // link
    if (operation !== "cut") {
      // ensure the child is not part of parent tree
      for (
        let current: RepositoryMessage | null = newParent;
        current;
        current = current.prev
      ) {
        if (current.current.id === child.current.id) {
          throw new Error(
            "MessageRepository(performOp/link): A message with the same id already exists in the parent tree. This error occurs if the same message id is found multiple times. This is likely an internal bug in assistant-ui.",
          );
        }
      }

      // add to parentOrRoot.children
      newParentOrRoot.children = [
        ...newParentOrRoot.children,
        child.current.id,
      ];

      // update parentOrRoot.next
      if (findHead(child) === this.head || newParentOrRoot.next === null) {
        newParentOrRoot.next = child;
      }

      child.prev = newParent;
    }
  }

  /** Cached array of messages in the current active branch, from root to head */
  private _messages = new CachedValue<readonly ThreadMessage[]>(() => {
    const messages = new Array<ThreadMessage>(this.head?.level ?? 0);
    for (let current = this.head; current; current = current.prev) {
      messages[current.level] = current.current;
    }
    return messages;
  });

  /**
   * Gets the ID of the current head message.
   * @returns The ID of the head message, or null if no messages exist
   */
  get headId() {
    return this.head?.current.id ?? null;
  }

  /**
   * Gets all messages in the current active branch, from root to head.
   * @returns Array of messages in the current branch
   */
  getMessages() {
    return this._messages.value;
  }

  /**
   * Adds a new message or updates an existing one in the repository.
   * If the message ID already exists, the message is updated and potentially relinked to a new parent.
   * If the message is new, it's added as a child of the specified parent.
   *
   * @param parentId - ID of the parent message, or null for root messages
   * @param message - The message to add or update
   * @throws Error if the parent message is not found
   */
  addOrUpdateMessage(parentId: string | null, message: ThreadMessage) {
    const existingItem = this.messages.get(message.id);
    const prev = parentId ? this.messages.get(parentId) : null;
    if (prev === undefined)
      throw new Error(
        "MessageRepository(addOrUpdateMessage): Parent message not found. This is likely an internal bug in assistant-ui.",
      );

    // update existing message
    if (existingItem) {
      existingItem.current = message;
      this.performOp(prev, existingItem, "relink");
      this._messages.dirty();
      return;
    }

    // create a new message
    const newItem: RepositoryMessage = {
      prev,
      current: message,
      next: null,
      children: [],
      level: prev ? prev.level + 1 : 0,
    };

    this.messages.set(message.id, newItem);
    this.performOp(prev, newItem, "link");

    if (this.head === prev) {
      this.head = newItem;
    }

    this._messages.dirty();
  }

  /**
   * Gets a message and its parent ID by message ID.
   *
   * @param messageId - ID of the message to retrieve
   * @returns Object containing the message and its parent ID
   * @throws Error if the message is not found
   */
  getMessage(messageId: string) {
    const message = this.messages.get(messageId);
    if (!message)
      throw new Error(
        "MessageRepository(updateMessage): Message not found. This is likely an internal bug in assistant-ui.",
      );

    return {
      parentId: message.prev?.current.id ?? null,
      message: message.current,
    };
  }

  /**
   * Adds an optimistic message to the repository.
   * An optimistic message is a temporary placeholder that will be replaced by a real message later.
   *
   * @param parentId - ID of the parent message, or null for root messages
   * @param message - The core message to convert to an optimistic message
   * @returns The generated optimistic ID
   */
  appendOptimisticMessage(parentId: string | null, message: ThreadMessageLike) {
    let optimisticId: string;
    do {
      optimisticId = generateOptimisticId();
    } while (this.messages.has(optimisticId));

    this.addOrUpdateMessage(
      parentId,
      fromThreadMessageLike(message, optimisticId, { type: "running" }),
    );

    return optimisticId;
  }

  /**
   * Deletes a message from the repository and relinks its children.
   *
   * @param messageId - ID of the message to delete
   * @param replacementId - Optional ID of the message to become the new parent of the children,
   *                       undefined means use the deleted message's parent,
   *                       null means use the root
   * @throws Error if the message or replacement is not found
   */
  deleteMessage(messageId: string, replacementId?: string | null | undefined) {
    const message = this.messages.get(messageId);

    if (!message)
      throw new Error(
        "MessageRepository(deleteMessage): Message not found. This is likely an internal bug in assistant-ui.",
      );

    const replacement =
      replacementId === undefined
        ? message.prev // if no replacementId is provided, use the parent
        : replacementId === null
          ? null
          : this.messages.get(replacementId);
    if (replacement === undefined)
      throw new Error(
        "MessageRepository(deleteMessage): Replacement not found. This is likely an internal bug in assistant-ui.",
      );

    for (const child of message.children) {
      const childMessage = this.messages.get(child);
      if (!childMessage)
        throw new Error(
          "MessageRepository(deleteMessage): Child message not found. This is likely an internal bug in assistant-ui.",
        );
      this.performOp(replacement, childMessage, "relink");
    }

    this.performOp(null, message, "cut");
    this.messages.delete(messageId);

    if (this.head === message) {
      this.head = findHead(replacement ?? this.root);
    }

    this._messages.dirty();
  }

  /**
   * Gets all branch IDs (sibling messages) at the level of a specified message.
   *
   * @param messageId - ID of the message to find branches for
   * @returns Array of message IDs representing branches
   * @throws Error if the message is not found
   */
  getBranches(messageId: string) {
    const message = this.messages.get(messageId);
    if (!message)
      throw new Error(
        "MessageRepository(getBranches): Message not found. This is likely an internal bug in assistant-ui.",
      );

    const { children } = message.prev ?? this.root;
    return children;
  }

  /**
   * Switches the active branch to the one containing the specified message.
   *
   * @param messageId - ID of the message in the branch to switch to
   * @throws Error if the branch is not found
   */
  switchToBranch(messageId: string) {
    const message = this.messages.get(messageId);
    if (!message)
      throw new Error(
        "MessageRepository(switchToBranch): Branch not found. This is likely an internal bug in assistant-ui.",
      );

    const prevOrRoot = message.prev ?? this.root;
    prevOrRoot.next = message;

    this.head = findHead(message);

    this._messages.dirty();
  }

  /**
   * Resets the head to a specific message or null.
   *
   * @param messageId - ID of the message to set as head, or null to clear the head
   * @throws Error if the message is not found
   */
  resetHead(messageId: string | null) {
    if (messageId === null) {
      this.clear();
      return;
    }

    const message = this.messages.get(messageId);
    if (!message)
      throw new Error(
        "MessageRepository(resetHead): Branch not found. This is likely an internal bug in assistant-ui.",
      );

    if (message.children.length > 0) {
      const deleteDescendants = (msg: RepositoryMessage) => {
        for (const childId of msg.children) {
          const childMessage = this.messages.get(childId);
          if (childMessage) {
            deleteDescendants(childMessage);
            this.messages.delete(childId);
          }
        }
      };
      deleteDescendants(message);

      message.children = [];
      message.next = null;
    }

    this.head = message;
    for (
      let current: RepositoryMessage | null = message;
      current;
      current = current.prev
    ) {
      if (current.prev) {
        current.prev.next = current;
      }
    }

    this._messages.dirty();
  }

  /**
   * Clears all messages from the repository.
   */
  clear(): void {
    this.messages.clear();
    this.head = null;
    this.root = {
      children: [],
      next: null,
    };
    this._messages.dirty();
  }

  /**
   * Exports the repository state for persistence.
   *
   * @returns Exportable repository state
   */
  export(): ExportedMessageRepository {
    const exportItems: ExportedMessageRepository["messages"] = [];

    // hint: we are relying on the insertion order of the messages
    // this is important for the import function to properly link the messages
    for (const [, message] of this.messages) {
      exportItems.push({
        message: message.current,
        parentId: message.prev?.current.id ?? null,
      });
    }

    return {
      headId: this.head?.current.id ?? null,
      messages: exportItems,
    };
  }

  /**
   * Imports repository state from an exported repository.
   *
   * @param repository - The exported repository state to import
   */
  import({ headId, messages }: ExportedMessageRepository) {
    for (const { message, parentId } of messages) {
      this.addOrUpdateMessage(parentId, message);
    }

    // switch to the saved head id if it is not the most recent message
    this.resetHead(headId ?? messages.at(-1)?.message.id ?? null);
  }
}
