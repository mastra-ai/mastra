import { describe, it, expect, vi } from 'vitest';
import { safeExecuteTool } from '../safe-execute';

describe('safeExecuteTool', () => {
  // Basic execution
  it('should execute a tool and return its result', async () => {
    const tool = {
      id: 'test-tool',
      execute: vi.fn().mockResolvedValue({ data: 'hello' }),
    };
    const result = await safeExecuteTool(tool, { input: 'test' });
    expect(result).toEqual({ data: 'hello' });
    expect(tool.execute).toHaveBeenCalledOnce();
  });

  // Null/missing tool handling
  it('should return null if tool is null', async () => {
    const result = await safeExecuteTool(null as any, {});
    expect(result).toBeNull();
  });

  it('should return null if tool has no execute function', async () => {
    const result = await safeExecuteTool({ id: 'no-exec' } as any, {});
    expect(result).toBeNull();
  });

  // Error handling
  it('should return null if tool.execute throws', async () => {
    const tool = {
      id: 'throwing-tool',
      execute: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const result = await safeExecuteTool(tool, {});
    expect(result).toBeNull();
  });

  // Context propagation
  it('should forward context to the inner tool', async () => {
    const mockContext = {
      requestContext: { userId: '123' },
      tracingContext: { spanId: 'abc' },
    };
    const tool = {
      id: 'ctx-tool',
      execute: vi.fn().mockResolvedValue('ok'),
    };
    await safeExecuteTool(tool, { input: 'test' }, mockContext as any);
    const passedContext = tool.execute.mock.calls[0][1];
    expect(passedContext.requestContext).toEqual({ userId: '123' });
  });

  // Max depth protection
  it('should return null when max depth is exceeded', async () => {
    const tool = {
      id: 'deep-tool',
      execute: vi.fn().mockResolvedValue('ok'),
    };
    // Test with maxDepth: 0 to ensure immediate rejection
    const result = await safeExecuteTool(tool, {}, undefined, { maxDepth: 0 });
    expect(result).toBeNull();
    expect(tool.execute).not.toHaveBeenCalled();
  });

  // AbortSignal respect
  it('should return null if abortSignal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const tool = {
      id: 'abort-tool',
      execute: vi.fn().mockResolvedValue('ok'),
    };
    const result = await safeExecuteTool(tool, {}, { abortSignal: controller.signal } as any);
    expect(result).toBeNull();
    expect(tool.execute).not.toHaveBeenCalled();
  });

  // Custom max depth
  it('should respect custom maxDepth option', async () => {
    const tool = {
      id: 'depth-tool',
      execute: vi.fn().mockResolvedValue('ok'),
    };
    const result = await safeExecuteTool(tool, {}, undefined, { maxDepth: 5 });
    expect(result).toEqual('ok');
  });

  // Depth tracking
  it('should track call depth across nested calls', async () => {
    const innerTool = {
      id: 'inner-tool',
      execute: vi.fn().mockResolvedValue('inner-result'),
    };

    const outerTool = {
      id: 'outer-tool',
      execute: async (input: any, context: any) => {
        const innerResult = await safeExecuteTool(innerTool, {}, context);
        return { outer: true, inner: innerResult };
      },
    };

    const result = await safeExecuteTool(outerTool, {});
    expect(result).toEqual({ outer: true, inner: 'inner-result' });
  });

  // Test with tool missing id
  it('should handle tool without id gracefully', async () => {
    const tool = {
      execute: vi.fn().mockResolvedValue('no-id-result'),
    };
    const result = await safeExecuteTool(tool, {});
    expect(result).toEqual('no-id-result');
  });

  // Test custom span name
  it('should use custom span name when provided', async () => {
    const tool = {
      id: 'custom-span-tool',
      execute: vi.fn().mockResolvedValue('ok'),
    };
    const result = await safeExecuteTool(tool, {}, undefined, { spanName: 'my-custom-span' });
    expect(result).toEqual('ok');
  });

  // Tracing integration tests
  describe('tracing integration', () => {
    it('should create a child span when a currentSpan exists in tracingContext', async () => {
      const childSpan = {
        id: 'child-span',
        end: vi.fn(),
        error: vi.fn(),
      };

      const createChildSpan = vi.fn().mockReturnValue(childSpan);

      const parentSpan = {
        id: 'parent-span',
        createChildSpan,
      };

      const tracingContext = {
        currentSpan: parentSpan,
      };

      const tool = {
        id: 'traced-tool',
        execute: vi.fn().mockResolvedValue('trace-result'),
      };

      const result = await safeExecuteTool(tool, { foo: 'bar' }, { tracingContext } as any);

      expect(result).toEqual('trace-result');
      expect(createChildSpan).toHaveBeenCalledTimes(1);
      expect(createChildSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_call',
          name: 'safeExecuteTool:traced-tool',
          input: { foo: 'bar' },
          entityType: 'tool',
          entityId: 'traced-tool',
          entityName: 'traced-tool',
        }),
      );
    });

    it('should pass the child span to nested tool calls via tracingContext', async () => {
      const innerChildSpan = {
        id: 'inner-child-span',
        end: vi.fn(),
        error: vi.fn(),
      };

      const outerChildSpan = {
        id: 'outer-child-span',
        end: vi.fn(),
        error: vi.fn(),
        createChildSpan: vi.fn().mockReturnValue(innerChildSpan),
      };

      const parentSpan = {
        id: 'parent-span',
        createChildSpan: vi.fn().mockReturnValue(outerChildSpan),
      };

      const tracingContext = {
        currentSpan: parentSpan,
      };

      const innerToolSpans: any[] = [];

      const innerTool = {
        id: 'inner-traced-tool',
        execute: vi.fn(async (_input: any, context: any) => {
          innerToolSpans.push(context?.tracingContext?.currentSpan);
          return 'inner-trace-result';
        }),
      };

      const outerTool = {
        id: 'outer-traced-tool',
        execute: async (_input: any, context: any) => {
          const innerResult = await safeExecuteTool(innerTool, {}, context);
          return { outer: true, inner: innerResult };
        },
      };

      const result = await safeExecuteTool(outerTool, {}, { tracingContext } as any);

      expect(result).toEqual({ outer: true, inner: 'inner-trace-result' });
      // The outer call should create a child span from the parent
      expect(parentSpan.createChildSpan).toHaveBeenCalledTimes(1);
      // The outer child span should have created a child span for the inner tool call
      expect(outerChildSpan.createChildSpan).toHaveBeenCalledTimes(1);
      // The inner tool should see the inner child span (created from outerChildSpan) as its currentSpan
      expect(innerToolSpans[0]).toBe(innerChildSpan);
    });

    it('should call childSpan.end with result and success attributes on success', async () => {
      const childSpan = {
        id: 'child-span',
        end: vi.fn(),
        error: vi.fn(),
      };

      const createChildSpan = vi.fn().mockReturnValue(childSpan);

      const parentSpan = {
        id: 'parent-span',
        createChildSpan,
      };

      const tracingContext = {
        currentSpan: parentSpan,
      };

      const tool = {
        id: 'end-span-tool',
        execute: vi.fn().mockResolvedValue({ ok: true }),
      };

      const result = await safeExecuteTool(tool, { input: 'x' }, { tracingContext } as any);

      expect(result).toEqual({ ok: true });
      expect(childSpan.end).toHaveBeenCalledTimes(1);
      expect(childSpan.end).toHaveBeenCalledWith({
        output: { ok: true },
        attributes: { success: true },
      });
    });

    it('should call childSpan.error when the tool throws an error', async () => {
      const childSpan = {
        id: 'child-span',
        end: vi.fn(),
        error: vi.fn(),
      };

      const createChildSpan = vi.fn().mockReturnValue(childSpan);

      const parentSpan = {
        id: 'parent-span',
        createChildSpan,
      };

      const tracingContext = {
        currentSpan: parentSpan,
      };

      const toolError = new Error('tool failed');
      const tool = {
        id: 'error-span-tool',
        execute: vi.fn().mockRejectedValue(toolError),
      };

      const result = await safeExecuteTool(tool, { input: 'y' }, { tracingContext } as any);

      expect(result).toBeNull();
      expect(childSpan.error).toHaveBeenCalledTimes(1);
      expect(childSpan.error).toHaveBeenCalledWith({
        error: toolError,
        attributes: { success: false },
      });
    });

    it('should create a proper span hierarchy for deeply nested tool calls', async () => {
      const deepestSpan = {
        id: 'deepest-span',
        end: vi.fn(),
        error: vi.fn(),
      };

      const middleSpan = {
        id: 'middle-span',
        end: vi.fn(),
        error: vi.fn(),
        createChildSpan: vi.fn().mockReturnValue(deepestSpan),
      };

      const outerSpan = {
        id: 'outer-span',
        end: vi.fn(),
        error: vi.fn(),
        createChildSpan: vi.fn().mockReturnValue(middleSpan),
      };

      const rootSpan = {
        id: 'root-span',
        createChildSpan: vi.fn().mockReturnValue(outerSpan),
      };

      const tracingContext = {
        currentSpan: rootSpan,
      };

      const spansSeen: any[] = [];

      const deepestTool = {
        id: 'deepest-tool',
        execute: vi.fn(async (_input: any, context: any) => {
          spansSeen.push(context?.tracingContext?.currentSpan);
          return 'deepest';
        }),
      };

      const middleTool = {
        id: 'middle-tool',
        execute: async (_input: any, context: any) => {
          spansSeen.push(context?.tracingContext?.currentSpan);
          return safeExecuteTool(deepestTool, {}, context);
        },
      };

      const outerTool = {
        id: 'outer-tool',
        execute: async (_input: any, context: any) => {
          spansSeen.push(context?.tracingContext?.currentSpan);
          return safeExecuteTool(middleTool, {}, context);
        },
      };

      const result = await safeExecuteTool(outerTool, {}, { tracingContext } as any);
      expect(result).toEqual('deepest');

      // Three child spans should be created: outer, middle, deepest
      expect(rootSpan.createChildSpan).toHaveBeenCalledTimes(1);
      expect(outerSpan.createChildSpan).toHaveBeenCalledTimes(1);
      expect(middleSpan.createChildSpan).toHaveBeenCalledTimes(1);

      // Verify the span hierarchy
      expect(spansSeen[0]).toBe(outerSpan);
      expect(spansSeen[1]).toBe(middleSpan);
      expect(spansSeen[2]).toBe(deepestSpan);
    });
  });
});
