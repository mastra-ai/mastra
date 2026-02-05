import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  DelegationStartContext,
  DelegationStartResult,
  DelegationCompleteContext,
  DelegationCompleteResult,
  DelegationConfig,
  OnDelegationStartHandler,
  OnDelegationCompleteHandler,
} from '../agent.types';

describe('Delegation Hooks Types', () => {
  describe('DelegationStartContext', () => {
    it('should have all required properties', () => {
      const context: DelegationStartContext = {
        primitiveId: 'test-agent',
        primitiveType: 'agent',
        prompt: 'Test prompt',
        params: {
          threadId: 'thread-1',
          resourceId: 'resource-1',
          instructions: 'Custom instructions',
          maxSteps: 10,
        },
        iteration: 1,
        runId: 'run-123',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        parentAgentId: 'parent-agent',
        parentAgentName: 'Parent Agent',
        toolCallId: 'tool-call-1',
        messages: [],
      };

      expect(context.primitiveId).toBe('test-agent');
      expect(context.primitiveType).toBe('agent');
      expect(context.prompt).toBe('Test prompt');
      expect(context.params.threadId).toBe('thread-1');
      expect(context.iteration).toBe(1);
    });

    it('should support workflow primitive type', () => {
      const context: DelegationStartContext = {
        primitiveId: 'test-workflow',
        primitiveType: 'workflow',
        prompt: 'Workflow input',
        params: {},
        iteration: 2,
        runId: 'run-456',
        parentAgentId: 'parent',
        parentAgentName: 'Parent',
        toolCallId: 'tc-1',
        messages: [],
      };

      expect(context.primitiveType).toBe('workflow');
    });
  });

  describe('DelegationStartResult', () => {
    it('should allow proceeding by default', () => {
      const result: DelegationStartResult = {};
      expect(result.proceed).toBeUndefined();
    });

    it('should support rejection with reason', () => {
      const result: DelegationStartResult = {
        proceed: false,
        rejectionReason: 'Not allowed',
      };

      expect(result.proceed).toBe(false);
      expect(result.rejectionReason).toBe('Not allowed');
    });

    it('should support prompt modification', () => {
      const result: DelegationStartResult = {
        modifiedPrompt: 'Modified prompt',
        modifiedInstructions: 'New instructions',
        modifiedMaxSteps: 5,
      };

      expect(result.modifiedPrompt).toBe('Modified prompt');
      expect(result.modifiedInstructions).toBe('New instructions');
      expect(result.modifiedMaxSteps).toBe(5);
    });
  });

  describe('DelegationCompleteContext', () => {
    it('should have all required properties for success', () => {
      const bailFn = vi.fn();
      const context: DelegationCompleteContext = {
        primitiveId: 'test-agent',
        primitiveType: 'agent',
        prompt: 'Original prompt',
        result: {
          text: 'Agent response',
          subAgentThreadId: 'sub-thread-1',
          subAgentResourceId: 'sub-resource-1',
        },
        duration: 1500,
        success: true,
        iteration: 1,
        runId: 'run-123',
        toolCallId: 'tc-1',
        parentAgentId: 'parent',
        parentAgentName: 'Parent Agent',
        messages: [],
        bail: bailFn,
      };

      expect(context.success).toBe(true);
      expect(context.result.text).toBe('Agent response');
      expect(context.duration).toBe(1500);
      expect(context.error).toBeUndefined();
    });

    it('should support error case', () => {
      const error = new Error('Execution failed');
      const context: DelegationCompleteContext = {
        primitiveId: 'test-agent',
        primitiveType: 'agent',
        prompt: 'Original prompt',
        result: { text: '' },
        duration: 500,
        success: false,
        error,
        iteration: 1,
        runId: 'run-123',
        toolCallId: 'tc-1',
        parentAgentId: 'parent',
        parentAgentName: 'Parent',
        messages: [],
        bail: vi.fn(),
      };

      expect(context.success).toBe(false);
      expect(context.error).toBe(error);
    });

    it('should provide bail function', () => {
      const bailFn = vi.fn();
      const context: DelegationCompleteContext = {
        primitiveId: 'test-agent',
        primitiveType: 'agent',
        prompt: 'Prompt',
        result: { text: 'Result' },
        duration: 100,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'parent',
        parentAgentName: 'Parent',
        messages: [],
        bail: bailFn,
      };

      context.bail();
      expect(bailFn).toHaveBeenCalled();
    });
  });

  describe('DelegationCompleteResult', () => {
    it('should support feedback', () => {
      const result: DelegationCompleteResult = {
        feedback: 'Great work, but consider X',
      };

      expect(result.feedback).toBe('Great work, but consider X');
    });

    it('should support stop processing', () => {
      const result: DelegationCompleteResult = {
        stopProcessing: true,
      };

      expect(result.stopProcessing).toBe(true);
    });
  });

  describe('DelegationConfig', () => {
    it('should support all configuration options', () => {
      const onStart: OnDelegationStartHandler = vi.fn();
      const onComplete: OnDelegationCompleteHandler = vi.fn();

      const config: DelegationConfig = {
        onDelegationStart: onStart,
        onDelegationComplete: onComplete,
        bailStrategy: 'first',
        contextFilter: {
          maxMessages: 10,
          includeSystem: false,
          includeToolMessages: true,
          filter: (msg) => msg.role === 'user',
        },
      };

      expect(config.onDelegationStart).toBe(onStart);
      expect(config.onDelegationComplete).toBe(onComplete);
      expect(config.bailStrategy).toBe('first');
      expect(config.contextFilter?.maxMessages).toBe(10);
    });

    it('should support bail strategy options', () => {
      const config1: DelegationConfig = { bailStrategy: 'first' };
      const config2: DelegationConfig = { bailStrategy: 'last' };

      expect(config1.bailStrategy).toBe('first');
      expect(config2.bailStrategy).toBe('last');
    });
  });

  describe('OnDelegationStartHandler', () => {
    it('should be callable and return void', async () => {
      const handler: OnDelegationStartHandler = vi.fn();
      const context: DelegationStartContext = {
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Test',
        params: {},
        iteration: 1,
        runId: 'run-1',
        parentAgentId: 'parent',
        parentAgentName: 'Parent',
        toolCallId: 'tc-1',
        messages: [],
      };

      const result = await handler(context);
      expect(result).toBeUndefined();
      expect(handler).toHaveBeenCalledWith(context);
    });

    it('should be callable and return result', async () => {
      const handler: OnDelegationStartHandler = vi.fn().mockResolvedValue({
        proceed: false,
        rejectionReason: 'Blocked',
      });

      const context: DelegationStartContext = {
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Test',
        params: {},
        iteration: 1,
        runId: 'run-1',
        parentAgentId: 'parent',
        parentAgentName: 'Parent',
        toolCallId: 'tc-1',
        messages: [],
      };

      const result = await handler(context);
      expect(result?.proceed).toBe(false);
      expect(result?.rejectionReason).toBe('Blocked');
    });
  });

  describe('OnDelegationCompleteHandler', () => {
    it('should be callable with bail function', async () => {
      let bailed = false;
      const handler: OnDelegationCompleteHandler = vi.fn(({ bail }) => {
        bail();
      });

      const bailFn = vi.fn(() => {
        bailed = true;
      });

      const context: DelegationCompleteContext = {
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Test',
        result: { text: 'Done' },
        duration: 100,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'parent',
        parentAgentName: 'Parent',
        messages: [],
        bail: bailFn,
      };

      await handler(context);
      expect(bailFn).toHaveBeenCalled();
    });

    it('should support async handlers', async () => {
      const handler: OnDelegationCompleteHandler = vi.fn().mockResolvedValue({
        feedback: 'Async feedback',
        stopProcessing: true,
      });

      const context: DelegationCompleteContext = {
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Test',
        result: { text: 'Done' },
        duration: 100,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'parent',
        parentAgentName: 'Parent',
        messages: [],
        bail: vi.fn(),
      };

      const result = await handler(context);
      expect(result?.feedback).toBe('Async feedback');
      expect(result?.stopProcessing).toBe(true);
    });
  });
});

describe('Delegation Hook Scenarios', () => {
  describe('Rejection scenarios', () => {
    it('should reject delegation based on primitive id', async () => {
      const blockedAgents = ['dangerous-agent', 'untrusted-agent'];

      const handler: OnDelegationStartHandler = ({ primitiveId }) => {
        if (blockedAgents.includes(primitiveId)) {
          return {
            proceed: false,
            rejectionReason: `Agent ${primitiveId} is blocked`,
          };
        }
      };

      const context1: DelegationStartContext = {
        primitiveId: 'dangerous-agent',
        primitiveType: 'agent',
        prompt: 'Do something dangerous',
        params: {},
        iteration: 1,
        runId: 'run-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        toolCallId: 'tc-1',
        messages: [],
      };

      const context2: DelegationStartContext = {
        ...context1,
        primitiveId: 'safe-agent',
      };

      const result1 = await handler(context1);
      const result2 = await handler(context2);

      expect(result1?.proceed).toBe(false);
      expect(result1?.rejectionReason).toContain('dangerous-agent');
      expect(result2).toBeUndefined();
    });

    it('should reject delegation based on prompt content', async () => {
      const handler: OnDelegationStartHandler = ({ prompt }) => {
        if (prompt.toLowerCase().includes('delete')) {
          return {
            proceed: false,
            rejectionReason: 'Destructive operations not allowed',
          };
        }
      };

      const dangerousContext: DelegationStartContext = {
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Delete all files',
        params: {},
        iteration: 1,
        runId: 'run-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        toolCallId: 'tc-1',
        messages: [],
      };

      const safeContext: DelegationStartContext = {
        ...dangerousContext,
        prompt: 'List all files',
      };

      const result1 = await handler(dangerousContext);
      const result2 = await handler(safeContext);

      expect(result1?.proceed).toBe(false);
      expect(result2).toBeUndefined();
    });
  });

  describe('Modification scenarios', () => {
    it('should prepend priority to prompts', async () => {
      const handler: OnDelegationStartHandler = ({ prompt }) => {
        return {
          modifiedPrompt: `[HIGH PRIORITY] ${prompt}`,
        };
      };

      const context: DelegationStartContext = {
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Fix the bug',
        params: {},
        iteration: 1,
        runId: 'run-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        toolCallId: 'tc-1',
        messages: [],
      };

      const result = await handler(context);
      expect(result?.modifiedPrompt).toBe('[HIGH PRIORITY] Fix the bug');
    });

    it('should limit maxSteps based on iteration', async () => {
      const handler: OnDelegationStartHandler = ({ iteration }) => {
        // Reduce allowed steps as iterations increase
        const maxSteps = Math.max(3, 10 - iteration);
        return { modifiedMaxSteps: maxSteps };
      };

      const context1: DelegationStartContext = {
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Task',
        params: {},
        iteration: 1,
        runId: 'run-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        toolCallId: 'tc-1',
        messages: [],
      };

      const context5: DelegationStartContext = { ...context1, iteration: 5 };
      const context9: DelegationStartContext = { ...context1, iteration: 9 };

      const result1 = await handler(context1);
      const result5 = await handler(context5);
      const result9 = await handler(context9);

      expect(result1?.modifiedMaxSteps).toBe(9);
      expect(result5?.modifiedMaxSteps).toBe(5);
      expect(result9?.modifiedMaxSteps).toBe(3);
    });
  });

  describe('Completion hook scenarios', () => {
    it('should provide feedback on incomplete results', async () => {
      const handler: OnDelegationCompleteHandler = ({ result, success }) => {
        if (success && !result.text.includes('DONE')) {
          return {
            feedback: 'Task does not appear complete. Please verify all requirements are met.',
          };
        }
      };

      const incompleteContext: DelegationCompleteContext = {
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Complete the task',
        result: { text: 'I made some progress but need more time' },
        duration: 5000,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: vi.fn(),
      };

      const completeContext: DelegationCompleteContext = {
        ...incompleteContext,
        result: { text: 'DONE - All tasks completed successfully' },
      };

      const result1 = await handler(incompleteContext);
      const result2 = await handler(completeContext);

      expect(result1?.feedback).toContain('not appear complete');
      expect(result2).toBeUndefined();
    });

    it('should bail on critical completion', async () => {
      let bailCalled = false;

      const handler: OnDelegationCompleteHandler = ({ primitiveId, result, bail }) => {
        if (primitiveId === 'critical-agent' && result.text.includes('SUCCESS')) {
          bail();
          return { stopProcessing: true };
        }
      };

      const context: DelegationCompleteContext = {
        primitiveId: 'critical-agent',
        primitiveType: 'agent',
        prompt: 'Critical task',
        result: { text: 'SUCCESS - Critical task completed' },
        duration: 1000,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: () => {
          bailCalled = true;
        },
      };

      const result = await handler(context);

      expect(bailCalled).toBe(true);
      expect(result?.stopProcessing).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const errorLogs: string[] = [];

      const handler: OnDelegationCompleteHandler = ({ primitiveId, success, error }) => {
        if (!success && error) {
          errorLogs.push(`Error in ${primitiveId}: ${error.message}`);
          return {
            feedback: `The ${primitiveId} encountered an error. Please try a different approach.`,
          };
        }
      };

      const context: DelegationCompleteContext = {
        primitiveId: 'failing-agent',
        primitiveType: 'agent',
        prompt: 'Risky task',
        result: { text: '' },
        duration: 500,
        success: false,
        error: new Error('API rate limit exceeded'),
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: vi.fn(),
      };

      const result = await handler(context);

      expect(errorLogs).toContain('Error in failing-agent: API rate limit exceeded');
      expect(result?.feedback).toContain('encountered an error');
    });
  });
});

describe('Bail Mechanism and Strategy', () => {
  describe('Bail function behavior', () => {
    it('should call bail() and set bailed flag', async () => {
      let bailedFlag = false;
      const bailFn = () => {
        bailedFlag = true;
      };

      const handler: OnDelegationCompleteHandler = ({ bail }) => {
        bail();
        return { stopProcessing: true };
      };

      const context: DelegationCompleteContext = {
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Task',
        result: { text: 'Done' },
        duration: 100,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: bailFn,
      };

      const result = await handler(context);

      expect(bailedFlag).toBe(true);
      expect(result?.stopProcessing).toBe(true);
    });

    it('should not bail when bail() is not called', async () => {
      let bailedFlag = false;
      const bailFn = () => {
        bailedFlag = true;
      };

      const handler: OnDelegationCompleteHandler = () => {
        // Do not call bail
        return { feedback: 'Good work' };
      };

      const context: DelegationCompleteContext = {
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Task',
        result: { text: 'Done' },
        duration: 100,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: bailFn,
      };

      const result = await handler(context);

      expect(bailedFlag).toBe(false);
      expect(result?.feedback).toBe('Good work');
    });

    it('should bail based on result condition', async () => {
      let bailedFlag = false;
      const bailFn = () => {
        bailedFlag = true;
      };

      const handler: OnDelegationCompleteHandler = ({ result, bail }) => {
        if (result.text.includes('CRITICAL_SUCCESS')) {
          bail();
          return { stopProcessing: true };
        }
        return undefined;
      };

      // Test with critical result
      const criticalContext: DelegationCompleteContext = {
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Task',
        result: { text: 'CRITICAL_SUCCESS achieved' },
        duration: 100,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: bailFn,
      };

      await handler(criticalContext);
      expect(bailedFlag).toBe(true);

      // Reset and test with normal result
      bailedFlag = false;
      const normalContext: DelegationCompleteContext = {
        ...criticalContext,
        result: { text: 'Regular success' },
        bail: bailFn,
      };

      await handler(normalContext);
      expect(bailedFlag).toBe(false);
    });
  });

  describe('Bail strategy configuration', () => {
    it('should support first bail strategy configuration', () => {
      const config: DelegationConfig = {
        bailStrategy: 'first',
        onDelegationComplete: vi.fn(),
      };

      expect(config.bailStrategy).toBe('first');
    });

    it('should support last bail strategy configuration', () => {
      const config: DelegationConfig = {
        bailStrategy: 'last',
        onDelegationComplete: vi.fn(),
      };

      expect(config.bailStrategy).toBe('last');
    });

    it('should default to undefined bail strategy when not specified', () => {
      const config: DelegationConfig = {
        onDelegationComplete: vi.fn(),
      };

      expect(config.bailStrategy).toBeUndefined();
    });
  });

  describe('Concurrent delegation with bail', () => {
    it('should track bail calls from multiple concurrent completions', async () => {
      const bailCallOrder: string[] = [];
      const results: Array<{ primitiveId: string; bailed: boolean }> = [];

      // Simulate concurrent delegations completing
      const createBailFn = (primitiveId: string) => () => {
        bailCallOrder.push(primitiveId);
      };

      const handler: OnDelegationCompleteHandler = ({ primitiveId, result, bail }) => {
        if (result.text.includes('bail')) {
          bail();
          results.push({ primitiveId, bailed: true });
          return { stopProcessing: true };
        }
        results.push({ primitiveId, bailed: false });
        return undefined;
      };

      // Simulate 3 agents completing with different results
      const contexts: DelegationCompleteContext[] = [
        {
          primitiveId: 'agent-1',
          primitiveType: 'agent',
          prompt: 'Task 1',
          result: { text: 'Regular result' },
          duration: 100,
          success: true,
          iteration: 1,
          runId: 'run-1',
          toolCallId: 'tc-1',
          parentAgentId: 'supervisor',
          parentAgentName: 'Supervisor',
          messages: [],
          bail: createBailFn('agent-1'),
        },
        {
          primitiveId: 'agent-2',
          primitiveType: 'agent',
          prompt: 'Task 2',
          result: { text: 'Should bail now' },
          duration: 150,
          success: true,
          iteration: 1,
          runId: 'run-1',
          toolCallId: 'tc-2',
          parentAgentId: 'supervisor',
          parentAgentName: 'Supervisor',
          messages: [],
          bail: createBailFn('agent-2'),
        },
        {
          primitiveId: 'agent-3',
          primitiveType: 'agent',
          prompt: 'Task 3',
          result: { text: 'Another bail trigger' },
          duration: 200,
          success: true,
          iteration: 1,
          runId: 'run-1',
          toolCallId: 'tc-3',
          parentAgentId: 'supervisor',
          parentAgentName: 'Supervisor',
          messages: [],
          bail: createBailFn('agent-3'),
        },
      ];

      // Execute all handlers
      await Promise.all(contexts.map(ctx => handler(ctx)));

      // Verify bail calls
      expect(bailCallOrder).toEqual(['agent-2', 'agent-3']);
      expect(results).toEqual([
        { primitiveId: 'agent-1', bailed: false },
        { primitiveId: 'agent-2', bailed: true },
        { primitiveId: 'agent-3', bailed: true },
      ]);
    });

    it('should implement first bail strategy logic', async () => {
      const bailStrategy = 'first';
      const bailedAgents: string[] = [];
      let firstBailedAgent: string | null = null;

      const createBailFn = (primitiveId: string) => () => {
        bailedAgents.push(primitiveId);
        if (bailStrategy === 'first' && firstBailedAgent === null) {
          firstBailedAgent = primitiveId;
        }
      };

      const handler: OnDelegationCompleteHandler = ({ primitiveId, result, bail }) => {
        if (result.text.includes('SUCCESS')) {
          bail();
          return { stopProcessing: true };
        }
        return undefined;
      };

      // Simulate completion order: agent-2 completes first with SUCCESS
      const completionOrder = [
        { primitiveId: 'agent-2', result: 'SUCCESS from agent 2' },
        { primitiveId: 'agent-1', result: 'Working...' },
        { primitiveId: 'agent-3', result: 'SUCCESS from agent 3' },
      ];

      for (const { primitiveId, result } of completionOrder) {
        const context: DelegationCompleteContext = {
          primitiveId,
          primitiveType: 'agent',
          prompt: 'Task',
          result: { text: result },
          duration: 100,
          success: true,
          iteration: 1,
          runId: 'run-1',
          toolCallId: `tc-${primitiveId}`,
          parentAgentId: 'supervisor',
          parentAgentName: 'Supervisor',
          messages: [],
          bail: createBailFn(primitiveId),
        };

        await handler(context);
      }

      // With 'first' strategy, agent-2 should be the one that matters
      expect(firstBailedAgent).toBe('agent-2');
      expect(bailedAgents).toContain('agent-2');
    });

    it('should implement last bail strategy logic', async () => {
      const bailStrategy = 'last';
      const bailedAgents: string[] = [];
      let lastBailedAgent: string | null = null;

      const createBailFn = (primitiveId: string) => () => {
        bailedAgents.push(primitiveId);
        if (bailStrategy === 'last') {
          lastBailedAgent = primitiveId; // Always update to the last one
        }
      };

      const handler: OnDelegationCompleteHandler = ({ primitiveId, result, bail }) => {
        if (result.text.includes('SUCCESS')) {
          bail();
          return { stopProcessing: true };
        }
        return undefined;
      };

      // Simulate completion order
      const completionOrder = [
        { primitiveId: 'agent-1', result: 'SUCCESS from agent 1' },
        { primitiveId: 'agent-2', result: 'Working...' },
        { primitiveId: 'agent-3', result: 'SUCCESS from agent 3' },
      ];

      for (const { primitiveId, result } of completionOrder) {
        const context: DelegationCompleteContext = {
          primitiveId,
          primitiveType: 'agent',
          prompt: 'Task',
          result: { text: result },
          duration: 100,
          success: true,
          iteration: 1,
          runId: 'run-1',
          toolCallId: `tc-${primitiveId}`,
          parentAgentId: 'supervisor',
          parentAgentName: 'Supervisor',
          messages: [],
          bail: createBailFn(primitiveId),
        };

        await handler(context);
      }

      // With 'last' strategy, agent-3 should be the final one
      expect(lastBailedAgent).toBe('agent-3');
      expect(bailedAgents).toEqual(['agent-1', 'agent-3']);
    });
  });

  describe('Bail with feedback and stopProcessing', () => {
    it('should combine bail with feedback', async () => {
      let bailedFlag = false;
      const bailFn = () => {
        bailedFlag = true;
      };

      const handler: OnDelegationCompleteHandler = ({ bail }) => {
        bail();
        return {
          feedback: 'Critical task completed, stopping further processing',
          stopProcessing: true,
        };
      };

      const context: DelegationCompleteContext = {
        primitiveId: 'critical-agent',
        primitiveType: 'agent',
        prompt: 'Critical task',
        result: { text: 'Mission accomplished' },
        duration: 500,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: bailFn,
      };

      const result = await handler(context);

      expect(bailedFlag).toBe(true);
      expect(result?.feedback).toBe('Critical task completed, stopping further processing');
      expect(result?.stopProcessing).toBe(true);
    });

    it('should bail with different feedback based on result quality', async () => {
      const createHandler = (): OnDelegationCompleteHandler => {
        return ({ result, bail }) => {
          if (result.text.includes('EXCELLENT')) {
            bail();
            return {
              feedback: 'Outstanding result achieved',
              stopProcessing: true,
            };
          } else if (result.text.includes('GOOD')) {
            bail();
            return {
              feedback: 'Satisfactory result',
              stopProcessing: false,
            };
          }
          return { feedback: 'Continue working' };
        };
      };

      const handler = createHandler();

      // Test excellent result
      let bailCalled = false;
      const excellentResult = await handler({
        primitiveId: 'agent-1',
        primitiveType: 'agent',
        prompt: 'Task',
        result: { text: 'EXCELLENT work!' },
        duration: 100,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: () => {
          bailCalled = true;
        },
      });

      expect(bailCalled).toBe(true);
      expect(excellentResult?.feedback).toBe('Outstanding result achieved');
      expect(excellentResult?.stopProcessing).toBe(true);

      // Test good result
      bailCalled = false;
      const goodResult = await handler({
        primitiveId: 'agent-2',
        primitiveType: 'agent',
        prompt: 'Task',
        result: { text: 'GOOD effort' },
        duration: 100,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-2',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: () => {
          bailCalled = true;
        },
      });

      expect(bailCalled).toBe(true);
      expect(goodResult?.feedback).toBe('Satisfactory result');
      expect(goodResult?.stopProcessing).toBe(false);

      // Test average result (no bail)
      bailCalled = false;
      const averageResult = await handler({
        primitiveId: 'agent-3',
        primitiveType: 'agent',
        prompt: 'Task',
        result: { text: 'Average result' },
        duration: 100,
        success: true,
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-3',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: () => {
          bailCalled = true;
        },
      });

      expect(bailCalled).toBe(false);
      expect(averageResult?.feedback).toBe('Continue working');
    });
  });

  describe('Bail with error handling', () => {
    it('should not bail on failed delegations', async () => {
      let bailCalled = false;

      const handler: OnDelegationCompleteHandler = ({ success, bail }) => {
        // Only bail on success
        if (success) {
          bail();
          return { stopProcessing: true };
        }
        return { feedback: 'Delegation failed, retrying...' };
      };

      const context: DelegationCompleteContext = {
        primitiveId: 'failing-agent',
        primitiveType: 'agent',
        prompt: 'Risky task',
        result: { text: '' },
        duration: 100,
        success: false,
        error: new Error('Connection timeout'),
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: () => {
          bailCalled = true;
        },
      };

      const result = await handler(context);

      expect(bailCalled).toBe(false);
      expect(result?.feedback).toBe('Delegation failed, retrying...');
    });

    it('should bail on specific error conditions', async () => {
      let bailCalled = false;

      const handler: OnDelegationCompleteHandler = ({ success, error, bail }) => {
        // Bail on rate limit errors to prevent further calls
        if (!success && error?.message.includes('rate limit')) {
          bail();
          return {
            stopProcessing: true,
            feedback: 'Rate limit reached, stopping all delegations',
          };
        }
        return undefined;
      };

      const context: DelegationCompleteContext = {
        primitiveId: 'api-agent',
        primitiveType: 'agent',
        prompt: 'API call',
        result: { text: '' },
        duration: 100,
        success: false,
        error: new Error('API rate limit exceeded'),
        iteration: 1,
        runId: 'run-1',
        toolCallId: 'tc-1',
        parentAgentId: 'supervisor',
        parentAgentName: 'Supervisor',
        messages: [],
        bail: () => {
          bailCalled = true;
        },
      };

      const result = await handler(context);

      expect(bailCalled).toBe(true);
      expect(result?.stopProcessing).toBe(true);
      expect(result?.feedback).toBe('Rate limit reached, stopping all delegations');
    });
  });
});
