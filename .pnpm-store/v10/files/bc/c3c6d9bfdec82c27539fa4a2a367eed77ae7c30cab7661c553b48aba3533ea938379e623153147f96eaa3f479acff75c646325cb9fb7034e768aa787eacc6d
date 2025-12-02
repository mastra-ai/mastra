/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AssistantFrameProvider } from "./AssistantFrameProvider";
import { AssistantFrameHost } from "./AssistantFrameHost";
import { ModelContextRegistry } from "../registry/ModelContextRegistry";
import z from "zod";

describe("AssistantFrame Integration", () => {
  let messageHandlers: Map<string, (event: MessageEvent) => void>;
  let iframeWindow: Window;
  let parentWindow: any;

  beforeEach(() => {
    messageHandlers = new Map();

    // Create a mock parent window that the iframe can post back to
    parentWindow = {
      postMessage: vi.fn((data: any) => {
        // When iframe posts to parent, deliver to parent handler
        const parentHandler = messageHandlers.get("parent");
        if (parentHandler) {
          Promise.resolve().then(() => {
            parentHandler({
              data,
              source: iframeWindow,
              origin: "*",
            } as MessageEvent);
          });
        }
      }),
    };

    // Create mock iframe window with proper message routing
    iframeWindow = {
      postMessage: vi.fn((data: any) => {
        // Route message to iframe handler (provider)
        const iframeHandler = messageHandlers.get("iframe");
        if (iframeHandler) {
          Promise.resolve().then(() => {
            iframeHandler({
              data,
              source: parentWindow, // parent window is the source for subscription
              origin: "*",
            } as MessageEvent);
          });
        }
      }),
    } as any;

    // Mock window.parent for iframe to broadcast to
    Object.defineProperty(window, "parent", {
      value: parentWindow,
      writable: true,
      configurable: true,
    });

    // Mock window methods for message passing
    vi.spyOn(window, "addEventListener").mockImplementation(
      (event: string, handler: any) => {
        if (event === "message") {
          // Store both handlers - we'll determine which is which based on usage
          if (!messageHandlers.has("iframe")) {
            messageHandlers.set("iframe", handler); // First registration is provider
          } else {
            messageHandlers.set("parent", handler); // Second is host
          }
        }
      },
    );

    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});

    vi.spyOn(window, "postMessage").mockImplementation(() => {
      // This shouldn't be called in our test setup
    });
  });

  afterEach(() => {
    // Clean up
    vi.restoreAllMocks();
    AssistantFrameProvider.dispose();
    messageHandlers.clear();
  });

  it("should establish connection between host and provider", async () => {
    // Setup provider in iframe
    const registry = new ModelContextRegistry();
    const unsubscribe =
      AssistantFrameProvider.addModelContextProvider(registry);

    // Setup host in parent
    const host = new AssistantFrameHost(iframeWindow);

    // Wait for connection
    await vi.waitFor(() => {
      expect(iframeWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "assistant-ui-frame",
          message: expect.objectContaining({
            type: "model-context-request",
          }),
        }),
        "*",
      );
    });

    // Clean up
    host.dispose();
    unsubscribe();
  });

  it("should sync tools from provider to host", async () => {
    // Setup provider with tools
    const registry = new ModelContextRegistry();

    const toolExecute = vi.fn().mockResolvedValue({ result: "search results" });
    registry.addTool({
      toolName: "search",
      description: "Search the web",
      parameters: z.object({ query: z.string() }),
      execute: toolExecute,
    });

    const unsubscribe =
      AssistantFrameProvider.addModelContextProvider(registry);

    // Setup host
    const host = new AssistantFrameHost(iframeWindow);

    // Wait for connection and initial sync
    await vi.waitFor(() => {
      const context = host.getModelContext();
      expect(context.tools).toBeDefined();
      expect(context.tools?.search).toBeDefined();
      expect(context.tools?.search.description).toBe("Search the web");
    });

    // Clean up
    host.dispose();
    unsubscribe();
  });

  it("should execute tools through the frame boundary", async () => {
    // Setup provider with executable tool
    const registry = new ModelContextRegistry();

    const toolExecute = vi
      .fn()
      .mockResolvedValue({ results: ["result1", "result2"] });
    registry.addTool({
      toolName: "search",
      description: "Search the web",
      parameters: z.object({ query: z.string() }),
      execute: toolExecute,
    });

    const unsubscribe =
      AssistantFrameProvider.addModelContextProvider(registry);

    // Setup host
    const host = new AssistantFrameHost(iframeWindow);

    // Wait for tools to be available
    await vi.waitFor(() => {
      const context = host.getModelContext();
      expect(context.tools?.search).toBeDefined();
    });

    // Execute tool through host
    const context = host.getModelContext();
    const searchTool = context.tools?.search;

    const resultPromise = searchTool!.execute!(
      { query: "test query" },
      {} as any,
    );

    // Wait for tool execution
    await vi.waitFor(() => {
      expect(toolExecute).toHaveBeenCalledWith(
        { query: "test query" },
        expect.objectContaining({
          toolCallId: expect.any(String),
          abortSignal: expect.any(AbortSignal),
        }),
      );
    });

    const result = await resultPromise;
    expect(result).toEqual({ results: ["result1", "result2"] });

    // Clean up
    host.dispose();
    unsubscribe();
  });

  it("should handle tool execution errors", async () => {
    // Setup provider with failing tool
    const registry = new ModelContextRegistry();

    const toolExecute = vi
      .fn()
      .mockRejectedValue(new Error("Tool execution failed"));
    registry.addTool({
      toolName: "failingTool",
      description: "A tool that fails",
      parameters: z.object({ input: z.string() }),
      execute: toolExecute,
    });

    const unsubscribe =
      AssistantFrameProvider.addModelContextProvider(registry);

    // Setup host
    const host = new AssistantFrameHost(iframeWindow);

    // Wait for tools to be available
    await vi.waitFor(() => {
      const context = host.getModelContext();
      expect(context.tools?.failingTool).toBeDefined();
    });

    // Execute tool and expect error
    const context = host.getModelContext();
    const failingTool = context.tools?.failingTool;

    await expect(
      failingTool!.execute!({ input: "test" }, {} as any),
    ).rejects.toThrow("Tool execution failed");

    // Clean up
    host.dispose();
    unsubscribe();
  });

  it("should handle multiple providers", async () => {
    // Setup multiple providers
    const registry1 = new ModelContextRegistry();
    const registry2 = new ModelContextRegistry();

    registry1.addTool({
      toolName: "tool1",
      description: "First tool",
      parameters: z.object({ input: z.string() }),
      execute: async () => ({ from: "tool1" }),
    });

    registry2.addTool({
      toolName: "tool2",
      description: "Second tool",
      parameters: z.object({ input: z.string() }),
      execute: async () => ({ from: "tool2" }),
    });

    const unsub1 = AssistantFrameProvider.addModelContextProvider(registry1);
    const unsub2 = AssistantFrameProvider.addModelContextProvider(registry2);

    // Setup host
    const host = new AssistantFrameHost(iframeWindow);

    // Wait for both tools to be available
    await vi.waitFor(() => {
      const context = host.getModelContext();
      expect(context.tools?.tool1).toBeDefined();
      expect(context.tools?.tool2).toBeDefined();
    });

    // Clean up
    host.dispose();
    unsub1();
    unsub2();
  });

  it("should merge system instructions from multiple providers", async () => {
    // Setup providers with system instructions
    const registry1 = new ModelContextRegistry();
    const registry2 = new ModelContextRegistry();

    registry1.addInstruction("You are a helpful assistant.");
    registry2.addInstruction("Always be concise.");

    const unsub1 = AssistantFrameProvider.addModelContextProvider(registry1);
    const unsub2 = AssistantFrameProvider.addModelContextProvider(registry2);

    // Setup host
    const host = new AssistantFrameHost(iframeWindow);

    // Wait for instructions to be synced
    await vi.waitFor(() => {
      const context = host.getModelContext();
      expect(context.system).toBeDefined();
      expect(context.system).toContain("You are a helpful assistant.");
      expect(context.system).toContain("Always be concise.");
    });

    // Clean up
    host.dispose();
    unsub1();
    unsub2();
  });

  it("should act as empty ModelContextProvider when iframe has no providers", async () => {
    // Don't register any providers in the iframe
    // This simulates an iframe that doesn't respond to model-context requests

    // Setup host
    const host = new AssistantFrameHost(iframeWindow);

    // Host should immediately return empty context
    const context = host.getModelContext();
    expect(context).toEqual({});

    // Wait a bit to ensure no errors occur
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Context should still be empty
    expect(host.getModelContext()).toEqual({});

    // Clean up
    host.dispose();
  });

  it("should clean up properly on dispose", async () => {
    // Setup provider
    const registry = new ModelContextRegistry();

    const unsubscribe =
      AssistantFrameProvider.addModelContextProvider(registry);

    // Setup host
    const host = new AssistantFrameHost(iframeWindow);

    // Wait for connection
    await vi.waitFor(() => {
      expect(iframeWindow.postMessage).toHaveBeenCalled();
    });

    // Dispose host
    host.dispose();

    // Verify event listener was removed (no unsubscribe message in new design)
    expect(window.removeEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );

    // Clean up provider
    unsubscribe();
    AssistantFrameProvider.dispose();
  });
});
