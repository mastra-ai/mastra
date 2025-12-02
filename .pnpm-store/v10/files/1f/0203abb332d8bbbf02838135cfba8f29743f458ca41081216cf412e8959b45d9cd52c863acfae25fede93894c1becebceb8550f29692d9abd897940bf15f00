// src/runtimes/utils/MessageRepository.tsx
import { generateId, generateOptimisticId } from "../../utils/idUtils.js";
import { getAutoStatus } from "../external-store/auto-status.js";
import { fromThreadMessageLike } from "../external-store/ThreadMessageLike.js";
var ExportedMessageRepository = {
  /**
   * Converts an array of messages to an ExportedMessageRepository format.
   * Creates parent-child relationships based on the order of messages in the array.
   *
   * @param messages - Array of message-like objects to convert
   * @returns ExportedMessageRepository with parent-child relationships established
   */
  fromArray: (messages) => {
    const conv = messages.map(
      (m) => fromThreadMessageLike(
        m,
        generateId(),
        getAutoStatus(false, false, false)
      )
    );
    return {
      messages: conv.map((m, idx) => ({
        parentId: idx > 0 ? conv[idx - 1].id : null,
        message: m
      }))
    };
  }
};
var findHead = (message) => {
  if (message.next) return findHead(message.next);
  if ("current" in message) return message;
  return null;
};
var CachedValue = class {
  /**
   * @param func - The function that computes the cached value
   */
  constructor(func) {
    this.func = func;
  }
  _value = null;
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
};
var MessageRepository = class {
  /** Map of message IDs to repository message objects */
  messages = /* @__PURE__ */ new Map();
  /** Reference to the current head (most recent) message in the active branch */
  head = null;
  /** Root node of the tree structure */
  root = {
    children: [],
    next: null
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
  performOp(newParent, child, operation) {
    const parentOrRoot = child.prev ?? this.root;
    const newParentOrRoot = newParent ?? this.root;
    if (operation === "relink" && parentOrRoot === newParentOrRoot) return;
    if (operation !== "link") {
      parentOrRoot.children = parentOrRoot.children.filter(
        (m) => m !== child.current.id
      );
      if (parentOrRoot.next === child) {
        const fallbackId = parentOrRoot.children.at(-1);
        const fallback = fallbackId ? this.messages.get(fallbackId) : null;
        if (fallback === void 0) {
          throw new Error(
            "MessageRepository(performOp/cut): Fallback sibling message not found. This is likely an internal bug in assistant-ui."
          );
        }
        parentOrRoot.next = fallback;
      }
    }
    if (operation !== "cut") {
      for (let current = newParent; current; current = current.prev) {
        if (current.current.id === child.current.id) {
          throw new Error(
            "MessageRepository(performOp/link): A message with the same id already exists in the parent tree. This error occurs if the same message id is found multiple times. This is likely an internal bug in assistant-ui."
          );
        }
      }
      newParentOrRoot.children = [
        ...newParentOrRoot.children,
        child.current.id
      ];
      if (findHead(child) === this.head || newParentOrRoot.next === null) {
        newParentOrRoot.next = child;
      }
      child.prev = newParent;
    }
  }
  /** Cached array of messages in the current active branch, from root to head */
  _messages = new CachedValue(() => {
    const messages = new Array(this.head?.level ?? 0);
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
  addOrUpdateMessage(parentId, message) {
    const existingItem = this.messages.get(message.id);
    const prev = parentId ? this.messages.get(parentId) : null;
    if (prev === void 0)
      throw new Error(
        "MessageRepository(addOrUpdateMessage): Parent message not found. This is likely an internal bug in assistant-ui."
      );
    if (existingItem) {
      existingItem.current = message;
      this.performOp(prev, existingItem, "relink");
      this._messages.dirty();
      return;
    }
    const newItem = {
      prev,
      current: message,
      next: null,
      children: [],
      level: prev ? prev.level + 1 : 0
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
  getMessage(messageId) {
    const message = this.messages.get(messageId);
    if (!message)
      throw new Error(
        "MessageRepository(updateMessage): Message not found. This is likely an internal bug in assistant-ui."
      );
    return {
      parentId: message.prev?.current.id ?? null,
      message: message.current
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
  appendOptimisticMessage(parentId, message) {
    let optimisticId;
    do {
      optimisticId = generateOptimisticId();
    } while (this.messages.has(optimisticId));
    this.addOrUpdateMessage(
      parentId,
      fromThreadMessageLike(message, optimisticId, { type: "running" })
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
  deleteMessage(messageId, replacementId) {
    const message = this.messages.get(messageId);
    if (!message)
      throw new Error(
        "MessageRepository(deleteMessage): Message not found. This is likely an internal bug in assistant-ui."
      );
    const replacement = replacementId === void 0 ? message.prev : replacementId === null ? null : this.messages.get(replacementId);
    if (replacement === void 0)
      throw new Error(
        "MessageRepository(deleteMessage): Replacement not found. This is likely an internal bug in assistant-ui."
      );
    for (const child of message.children) {
      const childMessage = this.messages.get(child);
      if (!childMessage)
        throw new Error(
          "MessageRepository(deleteMessage): Child message not found. This is likely an internal bug in assistant-ui."
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
  getBranches(messageId) {
    const message = this.messages.get(messageId);
    if (!message)
      throw new Error(
        "MessageRepository(getBranches): Message not found. This is likely an internal bug in assistant-ui."
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
  switchToBranch(messageId) {
    const message = this.messages.get(messageId);
    if (!message)
      throw new Error(
        "MessageRepository(switchToBranch): Branch not found. This is likely an internal bug in assistant-ui."
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
  resetHead(messageId) {
    if (messageId === null) {
      this.clear();
      return;
    }
    const message = this.messages.get(messageId);
    if (!message)
      throw new Error(
        "MessageRepository(resetHead): Branch not found. This is likely an internal bug in assistant-ui."
      );
    if (message.children.length > 0) {
      const deleteDescendants = (msg) => {
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
    for (let current = message; current; current = current.prev) {
      if (current.prev) {
        current.prev.next = current;
      }
    }
    this._messages.dirty();
  }
  /**
   * Clears all messages from the repository.
   */
  clear() {
    this.messages.clear();
    this.head = null;
    this.root = {
      children: [],
      next: null
    };
    this._messages.dirty();
  }
  /**
   * Exports the repository state for persistence.
   *
   * @returns Exportable repository state
   */
  export() {
    const exportItems = [];
    for (const [, message] of this.messages) {
      exportItems.push({
        message: message.current,
        parentId: message.prev?.current.id ?? null
      });
    }
    return {
      headId: this.head?.current.id ?? null,
      messages: exportItems
    };
  }
  /**
   * Imports repository state from an exported repository.
   *
   * @param repository - The exported repository state to import
   */
  import({ headId, messages }) {
    for (const { message, parentId } of messages) {
      this.addOrUpdateMessage(parentId, message);
    }
    this.resetHead(headId ?? messages.at(-1)?.message.id ?? null);
  }
};
export {
  ExportedMessageRepository,
  MessageRepository
};
//# sourceMappingURL=MessageRepository.js.map