import { createLogger } from '../logger';
import { z } from 'zod';

import { Workflow } from './index';

describe('Workflow', () => {
  let workflow: Workflow;

  beforeEach(() => {
    workflow = new Workflow('test-workflow', createLogger({ type: 'CONSOLE' }));
  });

  describe('Basic Workflow Execution', () => {
    it('should execute a single step workflow successfully', async () => {
      const action = jest.fn().mockResolvedValue({ result: 'success' });

      workflow
        .addStep('step1', {
          action,
        })
        .commitMachine();

      const result = await workflow.executeWorkflow();

      expect(action).toHaveBeenCalled();
      expect(result.results['step1']).toEqual({ result: 'success' });
    });

    it('should execute multiple steps based on transitions', async () => {
      const executionOrder: string[] = [];

      const step1Action = jest.fn().mockImplementation(async () => {
        executionOrder.push('step1');
        return { value: 'step1' };
      });
      const step2Action = jest.fn().mockImplementation(async () => {
        executionOrder.push('step2');
        return { value: 'step2' };
      });

      workflow
        .addStep('step1', {
          action: step1Action,
          transitions: {
            step2: { condition: undefined },
          },
        })
        .addStep('step2', {
          action: step2Action,
        })
        .commitMachine();

      const result = await workflow.executeWorkflow();

      expect(executionOrder).toEqual(['step1', 'step2']);
      expect(result.results).toEqual({
        step1: { value: 'step1' },
        step2: { value: 'step2' },
      });
    });
  });

  describe('Transition Conditions', () => {
    it('should follow conditional transitions', async () => {
      const step1Action = jest.fn().mockImplementation(() => {
        return Promise.resolve({ status: 'success' });
      });
      const step2Action = jest.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step2' });
      });
      const step3Action = jest.fn().mockImplementation(() => {
        return Promise.resolve({ result: 'step3' });
      });

      workflow
        .addStep('step1', {
          action: step1Action,
          transitions: {
            step2: {
              condition: {
                ref: { stepId: 'step1', path: 'status' },
                query: { $eq: 'success' },
              },
            },
            step3: {
              condition: {
                ref: { stepId: 'step1', path: 'status' },
                query: { $eq: 'failed' },
              },
            },
          },
        })
        .addStep('step2', {
          action: step2Action,
        })
        .addStep('step3', {
          action: step3Action,
        })
        .commitMachine();

      const result = await workflow.executeWorkflow();

      expect(step1Action).toHaveBeenCalled();
      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });

    it('should handle complex transition conditions', async () => {
      const step1Action = jest.fn().mockResolvedValue({
        status: 'success',
        count: 5,
      });
      const step2Action = jest.fn().mockResolvedValue({ result: 'step2' });
      const step3Action = jest.fn().mockResolvedValue({ result: 'step3' });

      workflow
        .addStep('step1', {
          action: step1Action,
          transitions: {
            step2: {
              condition: {
                and: [
                  {
                    ref: { stepId: 'step1', path: 'status' },
                    query: { $eq: 'success' },
                  },
                  {
                    ref: { stepId: 'step1', path: 'count' },
                    query: { $gte: 3 },
                  },
                ],
              },
            },
            step3: {
              condition: {
                or: [
                  {
                    ref: { stepId: 'step1', path: 'status' },
                    query: { $eq: 'failed' },
                  },
                  {
                    ref: { stepId: 'step1', path: 'count' },
                    query: { $lt: 3 },
                  },
                ],
              },
            },
          },
        })
        .addStep('step2', {
          action: step2Action,
        })
        .addStep('step3', {
          action: step3Action,
        })
        .commitMachine();

      const result = await workflow.executeWorkflow();

      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });
  });

  describe('Workflow Validation', () => {
    describe('Circular Dependencies', () => {
      it('should detect simple circular dependency', () => {
        expect(() => {
          workflow
            .addStep('step1', {
              action: async () => ({}),
              transitions: {
                step2: { condition: undefined },
              },
            })
            .addStep('step2', {
              action: async () => ({}),
              transitions: {
                step1: { condition: undefined },
              },
            })
            .commitMachine();
        }).toThrow('Circular dependency detected');
      });

      it('should detect complex circular dependency', () => {
        expect(() => {
          workflow
            .addStep('step1', {
              action: async () => ({}),
              transitions: {
                step2: { condition: undefined },
              },
            })
            .addStep('step2', {
              action: async () => ({}),
              transitions: {
                step3: { condition: undefined },
              },
            })
            .addStep('step3', {
              action: async () => ({}),
              transitions: {
                step1: { condition: undefined },
              },
            })
            .commitMachine();
        }).toThrow('Circular dependency detected');
      });
    });

    describe('Terminal Paths', () => {
      it('should detect when no path leads to terminal state', () => {
        expect(() => {
          workflow
            .addStep('step1', {
              action: async () => ({}),
              transitions: {
                step2: { condition: undefined },
              },
            })
            .addStep('step2', {
              action: async () => ({}),
              transitions: {
                step1: { condition: undefined },
              },
            })
            .commitMachine();
        }).toThrow('No path to terminal state found');
      });

      it('should validate workflow with valid terminal path', () => {
        expect(() => {
          workflow
            .addStep('step1', {
              action: async () => ({}),
              transitions: {
                step2: { condition: undefined },
              },
            })
            .addStep('step2', {
              action: async () => ({}),
              transitions: null, // Terminal state
            })
            .commitMachine();
        }).not.toThrow();
      });

      it('should validate workflow with multiple valid terminal paths', () => {
        expect(() => {
          workflow
            .addStep('step1', {
              action: async () => ({}),
              transitions: {
                step2: { condition: undefined },
                step3: { condition: undefined },
              },
            })
            .addStep('step2', {
              action: async () => ({}),
              transitions: null,
            })
            .addStep('step3', {
              action: async () => ({}),
              transitions: null,
            })
            .commitMachine();
        }).not.toThrow();
      });
    });

    describe('Unreachable Steps', () => {
      it('should detect unreachable steps', () => {
        expect(() => {
          workflow
            .addStep('step1', {
              action: async () => ({}),
              transitions: {
                step2: { condition: undefined },
              },
            })
            .addStep('step2', {
              action: async () => ({}),
              transitions: null,
            })
            .addStep('step3', {
              // Unreachable
              action: async () => ({}),
              transitions: null,
            })
            .commitMachine();
        }).toThrow('Step is not reachable from the initial step (Step: step3)');
      });

      it('should validate fully connected workflow', () => {
        expect(() => {
          workflow
            .addStep('step1', {
              action: async () => ({}),
              transitions: {
                step2: { condition: undefined },
                step3: { condition: undefined },
              },
            })
            .addStep('step2', {
              action: async () => ({}),
            })
            .addStep('step3', {
              action: async () => ({}),
            })
            .commitMachine();
        }).not.toThrow();
      });
    });

    describe('Complex Validation Scenarios', () => {
      it('should detect multiple validation issues', () => {
        expect(() => {
          workflow
            .addStep('step1', {
              action: async () => ({}),
              transitions: {
                step2: { condition: undefined },
              },
            })
            .addStep('step2', {
              action: async () => ({}),
              transitions: {
                step1: { condition: undefined },
              },
            })
            .addStep('step3', {
              // Unreachable
              action: async () => ({}),
              transitions: null,
            })
            .commitMachine();
        }).toThrow(
          `Workflow validation failed:
[circular_dependency] Circular dependency detected in workflow (Path: step1 → step2 → step1)
[no_terminal_path] No path to terminal state found (Path: step1 → step2) (Step: step2)
[no_terminal_path] No path to terminal state found (Path: step1) (Step: step1)
[unreachable_step] Step is not reachable from the initial step (Step: step3)`
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle step execution errors', async () => {
      const error = new Error('Step execution failed');
      const failingAction = jest.fn().mockRejectedValue(error);

      workflow
        .addStep('step1', {
          action: failingAction,
        })
        .commitMachine();

      await expect(workflow.executeWorkflow()).rejects.toEqual({
        error: 'Step execution failed',
      });
    });

    it('should handle variable resolution errors', async () => {
      workflow
        .addStep('step1', {
          action: jest.fn().mockResolvedValue({ data: 'success' }),
          transitions: {
            step2: { condition: undefined },
          },
        })
        .addStep('step2', {
          action: jest.fn(),
          variables: {
            data: { stepId: 'step1', path: 'nonexistent.path' },
          },
        })
        .commitMachine();

      await expect(workflow.executeWorkflow()).rejects.toEqual({
        error: 'Cannot resolve path "nonexistent.path" from step1',
      });
    });
  });

  describe('Variable Resolution', () => {
    it('should resolve variables from trigger data', async () => {
      const action = jest.fn().mockResolvedValue({ result: 'success' });
      const triggerSchema = z.object({
        inputData: z.string(),
      });

      workflow
        .setTriggerSchema(triggerSchema)
        .addStep('step1', {
          action,
          variables: {
            input: { stepId: 'trigger', path: 'inputData' },
          },
        })
        .commitMachine();

      await workflow.executeWorkflow({ inputData: 'test-input' });

      expect(action).toHaveBeenCalledWith({ input: 'test-input' });
    });

    it('should resolve variables from previous steps', async () => {
      const step1Action = jest.fn().mockResolvedValue({
        nested: { value: 'step1-data' },
      });
      const step2Action = jest.fn().mockResolvedValue({ result: 'success' });

      workflow
        .addStep('step1', {
          action: step1Action,
          transitions: {
            step2: { condition: undefined },
          },
        })
        .addStep('step2', {
          action: step2Action,
          variables: {
            previousValue: { stepId: 'step1', path: 'nested.value' },
          },
        })
        .commitMachine();

      await workflow.executeWorkflow();

      expect(step2Action).toHaveBeenCalledWith({
        previousValue: 'step1-data',
      });
    });
  });

  describe('Complex Conditions', () => {
    it('should handle nested AND/OR conditions', async () => {
      const step1Action = jest.fn().mockResolvedValue({
        status: 'partial',
        score: 75,
        flags: { isValid: true },
      });
      const step2Action = jest.fn().mockResolvedValue({ result: 'step2' });
      const step3Action = jest.fn().mockResolvedValue({ result: 'step3' });

      workflow
        .addStep('step1', {
          action: step1Action,
          transitions: {
            step2: {
              condition: {
                and: [
                  {
                    or: [
                      {
                        ref: { stepId: 'step1', path: 'status' },
                        query: { $eq: 'success' },
                      },
                      {
                        and: [
                          {
                            ref: { stepId: 'step1', path: 'status' },
                            query: { $eq: 'partial' },
                          },
                          {
                            ref: { stepId: 'step1', path: 'score' },
                            query: { $gte: 70 },
                          },
                        ],
                      },
                    ],
                  },
                  {
                    ref: { stepId: 'step1', path: 'flags.isValid' },
                    query: { $eq: true },
                  },
                ],
              },
            },
            step3: {
              condition: {
                or: [
                  {
                    ref: { stepId: 'step1', path: 'status' },
                    query: { $eq: 'failed' },
                  },
                  {
                    ref: { stepId: 'step1', path: 'score' },
                    query: { $lt: 70 },
                  },
                ],
              },
            },
          },
        })
        .addStep('step2', {
          action: step2Action,
        })
        .addStep('step3', {
          action: step3Action,
        })
        .commitMachine();

      const result = await workflow.executeWorkflow();

      expect(step2Action).toHaveBeenCalled();
      expect(step3Action).not.toHaveBeenCalled();
      expect(result.results.step2).toEqual({ result: 'step2' });
    });
    it('should handle case where no transition conditions match', async () => {
      workflow
        .addStep('start', {
          action: async () => ({ status: 'unknown' }),
          transitions: {
            success: {
              condition: {
                ref: { stepId: 'start', path: 'status' },
                query: { $eq: 'success' },
              },
            },
            failure: {
              condition: {
                ref: { stepId: 'start', path: 'status' },
                query: { $eq: 'failed' },
              },
            },
          },
        })
        .addStep('success', {
          action: async () => ({ result: 'success' }),
        })
        .addStep('failure', {
          action: async () => ({ result: 'failure' }),
        })
        .commitMachine();

      await expect(workflow.executeWorkflow()).rejects.toEqual({
        error: 'No matching transition conditions',
      });
    });
  });

  describe('Schema Validation', () => {
    it('should validate trigger data against schema', async () => {
      const triggerSchema = z.object({
        required: z.string(),
        nested: z.object({
          value: z.number(),
        }),
      });

      workflow
        .setTriggerSchema(triggerSchema)
        .addStep('step1', {
          action: jest.fn().mockResolvedValue({ result: 'success' }),
        })
        .commitMachine();

      // Should fail validation
      await expect(
        workflow.executeWorkflow({
          required: 'test',
          nested: { value: 'not-a-number' },
        })
      ).rejects.toThrow();

      // Should pass validation
      await workflow.executeWorkflow({
        required: 'test',
        nested: { value: 42 },
      });
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle a multi-step workflow with data transformations', async () => {
      const triggerSchema = z.object({
        items: z.array(
          z.object({
            id: z.number(),
            value: z.number(),
          })
        ),
      });

      workflow
        .setTriggerSchema(triggerSchema)
        .addStep('filter', {
          action: async (data: any) => {
            return {
              filtered: data.items.filter((item: any) => item.value > 50),
            };
          },
          variables: {
            items: { stepId: 'trigger', path: '.' },
          },
          transitions: {
            process: {
              condition: {
                ref: { stepId: 'filter', path: 'filtered' },
                query: { $where: (value: any) => value.length > 0 },
              },
            },
            noResults: {
              condition: {
                ref: { stepId: 'filter', path: 'filtered' },
                query: { $where: (value: any) => value.length === 0 },
              },
            },
          },
        })
        .addStep('process', {
          action: async ({ items }) => ({
            processed: items.map((item: any) => ({
              id: item.id,
              doubled: item.value * 2,
            })),
          }),
          variables: {
            items: { stepId: 'filter', path: 'filtered' },
          },
        })
        .addStep('noResults', {
          action: async () => ({ status: 'no-items-to-process' }),
        })
        .commitMachine();

      const result = await workflow.executeWorkflow({
        items: [
          { id: 1, value: 25 },
          { id: 2, value: 75 },
          { id: 3, value: 100 },
        ],
      });

      expect((result.results.filter as any).filtered).toHaveLength(2);
      expect((result.results.process as any).processed).toEqual([
        { id: 2, doubled: 150 },
        { id: 3, doubled: 200 },
      ]);
    });
  });
});
