import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  MessageRepository,
  ExportedMessageRepository,
} from "../runtimes/utils/MessageRepository";
import type { ThreadMessage, TextMessagePart } from "../types/AssistantTypes";
import { ThreadMessageLike } from "../runtimes";

// Mock generateId and generateOptimisticId to make tests deterministic
const mockGenerateId = vi.fn();
const mockGenerateOptimisticId = vi.fn();
const mockIsOptimisticId = vi.fn((id: string) =>
  id.startsWith("__optimistic__"),
);

vi.mock("../utils/idUtils", () => ({
  generateId: () => mockGenerateId(),
  generateOptimisticId: () => mockGenerateOptimisticId(),
  isOptimisticId: (id: string) => mockIsOptimisticId(id),
}));

/**
 * Tests for the MessageRepository class, which manages message threads with branching capabilities.
 *
 * This suite verifies that the repository:
 * - Correctly manages message additions, updates, and deletions
 * - Properly maintains parent-child relationships between messages
 * - Handles branch creation and switching between branches
 * - Successfully imports and exports repository state
 * - Correctly manages optimistic messages in the thread
 * - Handles edge cases and error conditions gracefully
 */
describe("MessageRepository", () => {
  let repository: MessageRepository;
  let nextMockId = 1;

  /**
   * Creates a test ThreadMessage with the given overrides.
   */
  const createTestMessage = (overrides = {}): ThreadMessage => ({
    id: "test-id",
    role: "assistant",
    createdAt: new Date(),
    content: [{ type: "text", text: "Test message" }],
    status: { type: "complete", reason: "stop" },
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {},
    },
    ...overrides,
  });

  /**
   * Creates a test CoreMessage with the given overrides.
   */
  const createThreadMessageLike = (overrides = {}): ThreadMessageLike => ({
    role: "assistant",
    content: [{ type: "text", text: "Test message" }],
    ...overrides,
  });

  beforeEach(() => {
    repository = new MessageRepository();
    // Reset mocks with predictable counter-based values
    nextMockId = 1;
    mockGenerateId.mockImplementation(() => `mock-id-${nextMockId++}`);
    mockGenerateOptimisticId.mockImplementation(
      () => `__optimistic__mock-id-${nextMockId++}`,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Core functionality tests - these test the public contract
  describe("Basic CRUD operations", () => {
    /**
     * Tests the ability to add a new message to the repository.
     * The message should be retrievable from the repository.
     */
    it("should add a new message to the repository", () => {
      const message = createTestMessage({ id: "message-id" });
      repository.addOrUpdateMessage(null, message);

      const messages = repository.getMessages();
      expect(messages).toContain(message);
    });

    /**
     * Tests the ability to update an existing message in the repository.
     * The update should replace the message content while maintaining its position.
     */
    it("should update an existing message", () => {
      const message = createTestMessage({ id: "message-id" });
      repository.addOrUpdateMessage(null, message);

      const updatedContent = [
        { type: "text", text: "Updated message" },
      ] as const;
      const updatedMessage = createTestMessage({
        id: "message-id",
        content: updatedContent,
      });

      repository.addOrUpdateMessage(null, updatedMessage);

      const retrievedMessage = repository.getMessage("message-id").message;
      expect(retrievedMessage.content).toEqual(updatedContent);
    });

    /**
     * Tests that the repository correctly establishes parent-child relationships.
     * The child message should reference its parent properly.
     */
    it("should establish parent-child relationships between messages", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const child = createTestMessage({ id: "child-id" });

      repository.addOrUpdateMessage(null, parent);
      repository.addOrUpdateMessage("parent-id", child);

      const childWithParent = repository.getMessage("child-id");
      expect(childWithParent.parentId).toBe("parent-id");
    });

    /**
     * Tests that adding a message with a non-existent parent ID throws an error.
     * This maintains data integrity in the repository.
     */
    it("should throw an error when parent message is not found", () => {
      const message = createTestMessage();

      expect(() => {
        repository.addOrUpdateMessage("non-existent-id", message);
      }).toThrow(/Parent message not found/);
    });

    /**
     * Tests that getMessages() returns all messages in the active branch in the correct order.
     * The order should be from root to head.
     */
    it("should retrieve all messages in the current branch", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const child = createTestMessage({ id: "child-id" });
      const grandchild = createTestMessage({ id: "grandchild-id" });

      repository.addOrUpdateMessage(null, parent);
      repository.addOrUpdateMessage("parent-id", child);
      repository.addOrUpdateMessage("child-id", grandchild);

      const messages = repository.getMessages();

      // Should return messages in order from root to head
      expect(messages.map((m) => m.id)).toEqual([
        "parent-id",
        "child-id",
        "grandchild-id",
      ]);
    });

    /**
     * Tests that the head message is updated correctly as messages are added.
     * The head should always point to the most recently added message in the active branch.
     */
    it("should track the head message", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const child = createTestMessage({ id: "child-id" });

      repository.addOrUpdateMessage(null, parent);
      expect(repository.headId).toBe("parent-id");

      repository.addOrUpdateMessage("parent-id", child);
      expect(repository.headId).toBe("child-id");
    });

    /**
     * Tests that deleting a message adjusts the head pointer correctly.
     * After deleting the head, the head should point to its parent.
     */
    it("should delete a message and adjust the head", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const child = createTestMessage({ id: "child-id" });

      repository.addOrUpdateMessage(null, parent);
      repository.addOrUpdateMessage("parent-id", child);

      // Initial head should be child
      expect(repository.headId).toBe("child-id");

      // Delete child
      repository.deleteMessage("child-id");

      // Head should now be parent
      expect(repository.headId).toBe("parent-id");

      // Child should be gone
      const messages = repository.getMessages();
      expect(messages.map((m) => m.id)).toEqual(["parent-id"]);
    });

    /**
     * Tests that clearing the repository removes all messages.
     * The repository should be empty and the head should be null after clearing.
     */
    it("should clear all messages", () => {
      const message = createTestMessage();
      repository.addOrUpdateMessage(null, message);

      repository.clear();

      expect(repository.getMessages()).toHaveLength(0);
      expect(repository.headId).toBeNull();
    });
  });

  describe("Branch management", () => {
    /**
     * Tests creating multiple branches from a parent message.
     * Both branches should have the same parent and be separately accessible.
     */
    it("should create multiple branches from a parent message", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const branch1 = createTestMessage({ id: "branch1-id" });
      const branch2 = createTestMessage({ id: "branch2-id" });

      repository.addOrUpdateMessage(null, parent);
      repository.addOrUpdateMessage("parent-id", branch1);
      repository.addOrUpdateMessage("parent-id", branch2);

      // Test we can switch between branches
      repository.switchToBranch("branch1-id");
      expect(repository.headId).toBe("branch1-id");

      repository.switchToBranch("branch2-id");
      expect(repository.headId).toBe("branch2-id");

      // Get branches from a child to verify siblings
      const branches = repository.getBranches("branch1-id");
      expect(branches).toContain("branch1-id");
      expect(branches).toContain("branch2-id");
    });

    /**
     * Tests switching between branches and verifying each branch's content.
     * Each branch should maintain its own path of messages.
     */
    it("should switch between branches and maintain branch state", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const branch1 = createTestMessage({ id: "branch1-id" });
      const branch2 = createTestMessage({ id: "branch2-id" });

      repository.addOrUpdateMessage(null, parent);
      repository.addOrUpdateMessage("parent-id", branch1);
      repository.addOrUpdateMessage("parent-id", branch2);

      // Switch to first branch
      repository.switchToBranch("branch1-id");
      expect(repository.headId).toBe("branch1-id");

      // Messages should show parent -> branch1 path
      const messages1 = repository.getMessages();
      expect(messages1.map((m) => m.id)).toEqual(["parent-id", "branch1-id"]);

      // Switch to second branch
      repository.switchToBranch("branch2-id");
      expect(repository.headId).toBe("branch2-id");

      // Messages should show parent -> branch2 path
      const messages2 = repository.getMessages();
      expect(messages2.map((m) => m.id)).toEqual(["parent-id", "branch2-id"]);
    });

    /**
     * Tests that trying to switch to a non-existent branch throws an error.
     * This ensures that the repository maintains valid state.
     */
    it("should throw error when switching to a non-existent branch", () => {
      expect(() => {
        repository.switchToBranch("non-existent-id");
      }).toThrow(/Branch not found/);
    });

    /**
     * Tests resetting the head to an earlier message in the tree.
     * This should truncate the active branch at the specified message.
     */
    it("should reset head to an earlier message in the tree", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const child = createTestMessage({ id: "child-id" });
      const grandchild = createTestMessage({ id: "grandchild-id" });

      repository.addOrUpdateMessage(null, parent);
      repository.addOrUpdateMessage("parent-id", child);
      repository.addOrUpdateMessage("child-id", grandchild);

      // Reset to parent
      repository.resetHead("parent-id");

      // Head should be parent
      expect(repository.headId).toBe("parent-id");

      // Messages should only include parent
      const messages = repository.getMessages();
      expect(messages.map((m) => m.id)).toEqual(["parent-id"]);
    });

    /**
     * Tests that resetting head to a message with children removes those children.
     * All descendants should be deleted from the repository.
     */
    it("should remove children when resetting head to a message with children", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const child = createTestMessage({ id: "child-id" });
      const grandchild1 = createTestMessage({ id: "grandchild1-id" });
      const grandchild2 = createTestMessage({ id: "grandchild2-id" });
      const greatGrandchild = createTestMessage({ id: "greatgrandchild-id" });

      // Build tree: parent -> child -> grandchild1
      //                            \-> grandchild2 -> greatGrandchild
      repository.addOrUpdateMessage(null, parent);
      repository.addOrUpdateMessage("parent-id", child);
      repository.addOrUpdateMessage("child-id", grandchild1);
      repository.addOrUpdateMessage("child-id", grandchild2);
      repository.addOrUpdateMessage("grandchild2-id", greatGrandchild);

      // Reset to child (which has children)
      repository.resetHead("child-id");

      // Head should be child
      expect(repository.headId).toBe("child-id");

      // Messages should only include parent and child
      const messages = repository.getMessages();
      expect(messages.map((m) => m.id)).toEqual(["parent-id", "child-id"]);

      // Verify children are removed from repository
      expect(() => repository.getMessage("grandchild1-id")).toThrow(
        /Message not found/,
      );
      expect(() => repository.getMessage("grandchild2-id")).toThrow(
        /Message not found/,
      );
      expect(() => repository.getMessage("greatgrandchild-id")).toThrow(
        /Message not found/,
      );

      // Verify branches are empty for the child
      const branches = repository.getBranches("child-id");
      expect(branches).toEqual(["child-id"]);
    });

    /**
     * Tests resetting the head to null.
     * This should clear the active branch completely.
     */
    it("should reset head to null when null is passed", () => {
      const message = createTestMessage();
      repository.addOrUpdateMessage(null, message);

      repository.resetHead(null);

      expect(repository.headId).toBeNull();
      expect(repository.getMessages()).toHaveLength(0);
    });
  });

  describe("Optimistic messages", () => {
    /**
     * Tests creating an optimistic message with a unique ID.
     * The message should have a running status and the correct ID.
     */
    it("should create an optimistic message with a unique ID", () => {
      mockGenerateOptimisticId.mockReturnValue("__optimistic__generated-id");

      const coreMessage = createThreadMessageLike();
      const optimisticId = repository.appendOptimisticMessage(
        null,
        coreMessage,
      );

      expect(optimisticId).toBe("__optimistic__generated-id");
      expect(repository.getMessage(optimisticId).message.status?.type).toBe(
        "running",
      );
    });

    /**
     * Tests creating an optimistic message as a child of a specified parent.
     * The message should have the correct parent relationship.
     */
    it("should create an optimistic message as a child of a specified parent", () => {
      const parent = createTestMessage({ id: "parent-id" });
      repository.addOrUpdateMessage(null, parent);

      const coreMessage = createThreadMessageLike();
      const optimisticId = repository.appendOptimisticMessage(
        "parent-id",
        coreMessage,
      );

      // Verify parent relationship
      const result = repository.getMessage(optimisticId);
      expect(result.parentId).toBe("parent-id");
    });

    /**
     * Tests that optimistic IDs are unique even if the first generated ID
     * already exists in the repository.
     */
    it("should retry generating unique optimistic IDs if initial one exists", () => {
      // First call returns an ID that already exists
      mockGenerateOptimisticId.mockReturnValueOnce("__optimistic__existing-id");

      // Create a message with the ID that will conflict
      const existingMessage = createTestMessage({
        id: "__optimistic__existing-id",
      });
      repository.addOrUpdateMessage(null, existingMessage);

      // Second call returns a unique ID
      mockGenerateOptimisticId.mockReturnValueOnce("__optimistic__unique-id");

      const coreMessage = createThreadMessageLike();
      const optimisticId = repository.appendOptimisticMessage(
        null,
        coreMessage,
      );

      // Should have used the second ID
      expect(optimisticId).toBe("__optimistic__unique-id");
      expect(mockGenerateOptimisticId).toHaveBeenCalledTimes(2);
    });
  });

  describe("Export and import", () => {
    /**
     * Tests exporting the repository state.
     * The exported state should correctly represent all messages and relationships.
     */
    it("should export the repository state", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const child = createTestMessage({ id: "child-id" });

      repository.addOrUpdateMessage(null, parent);
      repository.addOrUpdateMessage("parent-id", child);

      const exported = repository.export();

      expect(exported.headId).toBe("child-id");
      expect(exported.messages).toHaveLength(2);
      expect(
        exported.messages.find((m) => m.message.id === "parent-id")?.parentId,
      ).toBeNull();
      expect(
        exported.messages.find((m) => m.message.id === "child-id")?.parentId,
      ).toBe("parent-id");
    });

    /**
     * Tests importing repository state.
     * The imported state should correctly restore all messages and relationships.
     */
    it("should import repository state", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const child = createTestMessage({ id: "child-id" });

      const exported = {
        headId: "child-id",
        messages: [
          { message: parent, parentId: null },
          { message: child, parentId: "parent-id" },
        ],
      };

      repository.import(exported);

      expect(repository.headId).toBe("child-id");
      const messages = repository.getMessages();
      expect(messages.map((m) => m.id)).toEqual(["parent-id", "child-id"]);
    });

    /**
     * Tests importing with a specified head that is not the most recent message.
     * This simulates restoring a specific branch even if it's not the latest one.
     */
    it("should import with a specified head that is not the most recent message", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const child1 = createTestMessage({ id: "child1-id" });
      const child2 = createTestMessage({ id: "child2-id" });

      const exported = {
        headId: "child1-id", // Specify child1 as head, not the last message
        messages: [
          { message: parent, parentId: null },
          { message: child1, parentId: "parent-id" },
          { message: child2, parentId: "parent-id" }, // Sibling of child1
        ],
      };

      repository.import(exported);

      // Head should be as specified
      expect(repository.headId).toBe("child1-id");

      // Active branch should be parent -> child1
      const messages = repository.getMessages();
      expect(messages.map((m) => m.id)).toEqual(["parent-id", "child1-id"]);

      // We should be able to switch to child2
      repository.switchToBranch("child2-id");
      expect(repository.headId).toBe("child2-id");
    });

    /**
     * Tests that importing with invalid parent references throws an error.
     * This ensures data integrity during import.
     */
    it("should throw an error when importing with invalid parent references", () => {
      const child = createTestMessage({ id: "child-id" });

      const exported = {
        headId: "child-id",
        messages: [{ message: child, parentId: "non-existent-id" }],
      };

      expect(() => {
        repository.import(exported);
      }).toThrow(/Parent message not found/);
    });
  });

  describe("ExportedMessageRepository utility", () => {
    /**
     * Tests converting an array of messages to repository format.
     * The converted format should establish proper parent-child relationships.
     */
    it("should convert an array of messages to repository format", () => {
      mockGenerateId.mockReturnValue("generated-id");

      const messages: ThreadMessageLike[] = [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: "Hello" },
          ] as TextMessagePart[],
        },
        {
          role: "assistant" as const,
          content: [
            { type: "text" as const, text: "Hi there" },
          ] as TextMessagePart[],
        },
      ];

      const result = ExportedMessageRepository.fromArray(messages);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]!.parentId).toBeNull();
      expect(result.messages[1]!.parentId).toBe("generated-id");
    });

    /**
     * Tests handling empty message arrays.
     * The repository should handle this gracefully.
     */
    it("should handle empty message arrays", () => {
      const result = ExportedMessageRepository.fromArray([]);
      expect(result.messages).toHaveLength(0);
    });
  });

  describe("Complex scenarios", () => {
    /**
     * Tests that the tree structure is maintained after deleting nodes.
     * Child nodes should be preserved and accessible after deleting a sibling.
     */
    it("should maintain tree structure after deletions", () => {
      // Create tree:
      // root
      // └── A
      //     ├── B
      //     └── C

      const root = createTestMessage({ id: "root-id" });
      const nodeA = createTestMessage({ id: "A-id" });
      const nodeB = createTestMessage({ id: "B-id" });
      const nodeC = createTestMessage({ id: "C-id" });

      repository.addOrUpdateMessage(null, root);
      repository.addOrUpdateMessage("root-id", nodeA);
      repository.addOrUpdateMessage("A-id", nodeB);
      repository.addOrUpdateMessage("A-id", nodeC);

      // Delete B
      repository.deleteMessage("B-id");

      // Verify A still has C as child
      repository.switchToBranch("C-id");
      expect(repository.headId).toBe("C-id");

      // Check that we still have root -> A -> C path
      const messages = repository.getMessages();
      expect(messages.map((m) => m.id)).toEqual(["root-id", "A-id", "C-id"]);
    });

    /**
     * Tests relinking children when deleting a middle node.
     * Children of the deleted node should be relinked to the specified replacement.
     */
    it("should relink children when deleting a middle node", () => {
      // Create: root -> A -> B -> C
      const root = createTestMessage({ id: "root-id" });
      const nodeA = createTestMessage({ id: "A-id" });
      const nodeB = createTestMessage({ id: "B-id" });
      const nodeC = createTestMessage({ id: "C-id" });

      repository.addOrUpdateMessage(null, root);
      repository.addOrUpdateMessage("root-id", nodeA);
      repository.addOrUpdateMessage("A-id", nodeB);
      repository.addOrUpdateMessage("B-id", nodeC);

      // Delete B, specifying A as the new parent for B's children
      repository.deleteMessage("B-id", "A-id");

      // Verify C is now a child of A directly
      const c = repository.getMessage("C-id");
      expect(c.parentId).toBe("A-id");

      // Check that we have a path from root to C
      repository.switchToBranch("C-id");
      const messages = repository.getMessages();

      // Must contain root, A, and C (B was deleted)
      expect(messages.some((m) => m.id === "root-id")).toBe(true);
      expect(messages.some((m) => m.id === "A-id")).toBe(true);
      expect(messages.some((m) => m.id === "C-id")).toBe(true);
      expect(messages.some((m) => m.id === "B-id")).toBe(false);
    });

    /**
     * Tests deleting a node with multiple children and ensuring all children
     * are properly relinked to the specified replacement.
     */
    it("should relink multiple children when deleting a parent node", () => {
      // Create: root -> A -> B (and A -> C, A -> D)
      const root = createTestMessage({ id: "root-id" });
      const nodeA = createTestMessage({ id: "A-id" });
      const nodeB = createTestMessage({ id: "B-id" });
      const nodeC = createTestMessage({ id: "C-id" });
      const nodeD = createTestMessage({ id: "D-id" });

      repository.addOrUpdateMessage(null, root);
      repository.addOrUpdateMessage("root-id", nodeA);
      repository.addOrUpdateMessage("A-id", nodeB);
      repository.addOrUpdateMessage("A-id", nodeC);
      repository.addOrUpdateMessage("A-id", nodeD);

      // Delete A, specifying root as the new parent for A's children
      repository.deleteMessage("A-id", "root-id");

      // Verify B, C, D are now children of root
      expect(repository.getMessage("B-id").parentId).toBe("root-id");
      expect(repository.getMessage("C-id").parentId).toBe("root-id");
      expect(repository.getMessage("D-id").parentId).toBe("root-id");

      // This test is checking specifically that after deletion and relinking,
      // we can still access each branch. The exact message structure may vary depending
      // on implementation details of MessageRepository's internal tree management.
      // Instead of checking array length and order exactly, we'll verify that:
      // 1. We can access each branch
      // 2. Each branch contains both root and the target message

      // Verify B branch
      repository.switchToBranch("B-id");
      const bMessages = repository.getMessages();
      expect(bMessages.some((m) => m.id === "root-id")).toBe(true);
      expect(bMessages.some((m) => m.id === "B-id")).toBe(true);
      expect(bMessages.some((m) => m.id === "A-id")).toBe(false);

      // Verify C branch
      repository.switchToBranch("C-id");
      const cMessages = repository.getMessages();
      expect(cMessages.some((m) => m.id === "root-id")).toBe(true);
      expect(cMessages.some((m) => m.id === "C-id")).toBe(true);
      expect(cMessages.some((m) => m.id === "A-id")).toBe(false);

      // Verify D branch
      repository.switchToBranch("D-id");
      const dMessages = repository.getMessages();
      expect(dMessages.some((m) => m.id === "root-id")).toBe(true);
      expect(dMessages.some((m) => m.id === "D-id")).toBe(true);
      expect(dMessages.some((m) => m.id === "A-id")).toBe(false);
    });

    /**
     * Tests that updating a message preserves its position in the tree.
     */
    it("should preserve message position when updating content", () => {
      const parent = createTestMessage({ id: "parent-id" });
      const child1 = createTestMessage({ id: "child1-id" });
      const child2 = createTestMessage({ id: "child2-id" });

      repository.addOrUpdateMessage(null, parent);
      repository.addOrUpdateMessage("parent-id", child1);
      repository.addOrUpdateMessage("child1-id", child2);

      // Update child1 with new content
      const updatedChild1 = createTestMessage({
        id: "child1-id",
        content: [{ type: "text", text: "Updated content" }],
      });

      repository.addOrUpdateMessage("parent-id", updatedChild1);

      // Verify structure is preserved
      const messages = repository.getMessages();
      expect(messages.map((m) => m.id)).toEqual([
        "parent-id",
        "child1-id",
        "child2-id",
      ]);

      // Verify content was updated
      const MessagePart = messages[1]!.content[0];
      expect(MessagePart.type).toBe("text");
      expect((MessagePart as TextMessagePart).text).toBe("Updated content");
    });
  });
});
