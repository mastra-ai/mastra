/**
 * Variable Resolution tests for workflows
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { RequestContext } from '@mastra/core/di';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for variable resolution tests.
 * These are created once and registered with Mastra/Inngest upfront.
 */
export function createVariableResolutionWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep, mapVariable } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should resolve trigger data
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: z.object({ inputData: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: executeAction,
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-resolve-trigger-data',
      inputSchema: z.object({ inputData: z.string() }),
      outputSchema: z.object({}),
    });

    workflow.then(step1).then(step2).commit();

    workflows['var-resolve-trigger-data'] = { workflow, mocks: { executeAction } };
  }

  // Test: should provide access to step results via getStepResult helper
  {
    const step1Action = vi.fn().mockImplementation(async () => {
      return { value: 'step1-result' };
    });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({ inputValue: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const nonExecutedStep = createStep({
      id: 'non-executed-step',
      execute: vi.fn(),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    let step2Assertions: (() => void) | null = null;

    const step2 = createStep({
      id: 'step2',
      execute: async ({ getStepResult }) => {
        // Test accessing previous step result
        const step1Result = getStepResult(step1);
        const step1ResultFromString = getStepResult('step1');
        const failedStep = getStepResult(nonExecutedStep);

        // Store assertions to run after execution
        step2Assertions = () => {
          expect(step1Result).toEqual({ value: 'step1-result' });
          expect(step1ResultFromString).toEqual({ value: 'step1-result' });
          expect(failedStep).toBe(null);
        };

        return { value: 'step2-result' };
      },
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-get-step-result',
      inputSchema: z.object({ inputValue: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['var-get-step-result'] = {
      workflow,
      mocks: { step1Action },
      getStep2Assertions: () => step2Assertions,
      resetAssertions: () => {
        step2Assertions = null;
      },
    };
  }

  // Test: should resolve trigger data from context
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      inputData: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-trigger-from-context',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).commit();

    workflows['var-trigger-from-context'] = { workflow, mocks: { executeAction } };
  }

  // Test: should resolve trigger data from getInitData
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ getInitData }) => {
        const initData = getInitData<z.infer<typeof triggerSchema>>();
        return { result: initData };
      },
      inputSchema: z.object({ result: z.string() }),
      outputSchema: z.object({ result: z.object({ cool: z.string() }) }),
    });

    const workflow = createWorkflow({
      id: 'var-get-init-data',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
      steps: [step1, step2],
    });

    workflow.then(step1).then(step2).commit();

    workflows['var-get-init-data'] = { workflow, mocks: { executeAction } };
  }

  // Test: should resolve variables from previous steps via .map()
  {
    const step1Action = vi.fn().mockResolvedValue({
      nested: { value: 'step1-data' },
    });
    const step2Action = vi.fn().mockResolvedValue({ result: 'success' });

    const step1 = createStep({
      id: 'step1',
      execute: step1Action,
      inputSchema: z.object({}),
      outputSchema: z.object({ nested: z.object({ value: z.string() }) }),
    });
    const step2 = createStep({
      id: 'step2',
      execute: step2Action,
      inputSchema: z.object({ previousValue: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-previous-step',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow
      .then(step1)
      .map({
        previousValue: mapVariable({
          step: step1,
          path: 'nested.value',
        }),
      })
      .then(step2)
      .commit();

    workflows['var-map-previous-step'] = { workflow, mocks: { step1Action, step2Action } };
  }

  // Test: should resolve inputs from previous steps that are not objects
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => {
        return 'step1-data';
      },
      inputSchema: z.object({}),
      outputSchema: z.string(),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: 'success', input: inputData };
      },
      inputSchema: z.string(),
      outputSchema: z.object({ result: z.string(), input: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-non-object-output',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['var-non-object-output'] = { workflow, mocks: {} };
  }

  // Test: should resolve inputs from previous steps that are arrays
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => {
        return [{ str: 'step1-data' }];
      },
      inputSchema: z.object({}),
      outputSchema: z.array(z.object({ str: z.string() })),
    });
    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: 'success', input: inputData };
      },
      inputSchema: z.array(z.object({ str: z.string() })),
      outputSchema: z.object({ result: z.string(), input: z.array(z.object({ str: z.string() })) }),
    });

    const workflow = createWorkflow({
      id: 'var-array-output',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    workflow.then(step1).then(step2).commit();

    workflows['var-array-output'] = { workflow, mocks: {} };
  }

  // Test: should resolve constant values via .map()
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return {
          result: inputData.candidates.map((c: { name: string }) => c.name).join('') || 'none',
          second: inputData.iteration,
        };
      },
      inputSchema: z.object({ candidates: z.array(z.object({ name: z.string() })), iteration: z.number() }),
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-constant',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    workflow
      .then(step1)
      .map({
        candidates: {
          value: [],
          schema: z.array(z.object({ name: z.string() })),
        },
        iteration: {
          value: 0,
          schema: z.number(),
        },
      })
      .then(step2)
      .commit();

    workflows['var-map-constant'] = { workflow, mocks: { executeAction } };
  }

  // Test: should resolve fully dynamic input via .map()
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return {
          result: inputData.candidates.map((c: { name: string }) => c.name).join(', ') || 'none',
          second: inputData.iteration,
        };
      },
      inputSchema: z.object({ candidates: z.array(z.object({ name: z.string() })), iteration: z.number() }),
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-dynamic',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    workflow
      .then(step1)
      .map(async ({ inputData }) => {
        return {
          candidates: [{ name: inputData.result }, { name: 'hello' }],
          iteration: 0,
        };
      })
      .then(step2)
      .commit();

    workflows['var-map-dynamic'] = { workflow, mocks: { executeAction } };
  }

  // Test: should resolve trigger data and DI requestContext values via .map()
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: inputData.test, second: inputData.test2 };
      },
      inputSchema: z.object({ test: z.string(), test2: z.number() }),
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-requestcontext',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string(), second: z.number() }),
    });

    workflow
      .then(step1)
      .map({
        test: mapVariable({
          initData: workflow,
          path: 'cool',
        }),
        test2: {
          requestContextPath: 'life',
          schema: z.number(),
        },
      })
      .then(step2)
      .commit();

    workflows['var-map-requestcontext'] = { workflow, mocks: { executeAction } };
  }

  // Test: should resolve dynamic mappings via .map()
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: inputData.test, second: inputData.test2 };
      },
      inputSchema: z.object({ test: z.string(), test2: z.string() }),
      outputSchema: z.object({ result: z.string(), second: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-dynamic-fn',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string(), second: z.string() }),
    });

    workflow
      .then(step1)
      .map({
        test: mapVariable({
          initData: workflow,
          path: 'cool',
        }),
        test2: {
          schema: z.string(),
          fn: async ({ inputData }) => {
            return 'Hello ' + inputData.result;
          },
        },
      })
      .then(step2)
      .map({
        result: mapVariable({
          step: step2,
          path: 'result',
        }),
        second: {
          schema: z.string(),
          fn: async ({ getStepResult }) => {
            return getStepResult(step1).result;
          },
        },
      })
      .commit();

    workflows['var-map-dynamic-fn'] = { workflow, mocks: { executeAction }, step1 };
  }

  // Test: should resolve dynamic mappings via .map() with custom step id
  {
    const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
    const triggerSchema = z.object({
      cool: z.string(),
    });

    const step1 = createStep({
      id: 'step1',
      execute: executeAction,
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: inputData.test, second: inputData.test2 };
      },
      inputSchema: z.object({ test: z.string(), test2: z.string() }),
      outputSchema: z.object({ result: z.string(), second: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'var-map-custom-step-id',
      inputSchema: triggerSchema,
      outputSchema: z.object({ result: z.string(), second: z.string() }),
    });

    workflow
      .then(step1)
      .map(
        {
          test: mapVariable({
            initData: workflow,
            path: 'cool',
          }),
          test2: {
            schema: z.string(),
            fn: async ({ inputData }) => {
              return 'Hello ' + inputData.result;
            },
          },
        },
        {
          id: 'step1-mapping',
        },
      )
      .then(step2)
      .map({
        result: mapVariable({
          step: step2,
          path: 'result',
        }),
        second: {
          schema: z.string(),
          fn: async ({ getStepResult }) => {
            return getStepResult(step1).result;
          },
        },
      })
      .commit();

    workflows['var-map-custom-step-id'] = { workflow, mocks: { executeAction }, step1 };
  }

  // ============================================================================
  // .map() template-string source
  // ============================================================================

  // Test: template references ${inputData.x}
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ name: 'Helsinki', temp: 22 }),
      inputSchema: z.object({}),
      outputSchema: z.object({ name: z.string(), temp: z.number() }),
    });
    const workflow = createWorkflow({
      id: 'var-template-inputdata',
      inputSchema: z.object({}),
      outputSchema: z.object({ summary: z.string() }),
    });
    workflow
      .then(step1)
      .map({
        summary: { template: '${inputData.name} is ${inputData.temp}°C' },
      })
      .commit();
    workflows['var-template-inputdata'] = { workflow, mocks: {} };
  }

  // Test: template references multiple namespaces (inputData + initData + state + requestContext)
  {
    const step1 = createStep({
      id: 'step1',
      execute: async ({ setState }) => {
        await setState({ phase: 'analyzing' });
        return { tone: 'cheerful' };
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ tone: z.string() }),
    });
    const workflow = createWorkflow({
      id: 'var-template-multi-namespace',
      inputSchema: z.object({ city: z.string() }),
      stateSchema: z.object({ phase: z.string().default('initial') }),
      outputSchema: z.object({ line: z.string() }),
    });
    workflow
      .then(step1)
      .map({
        line: {
          template: 'City=${initData.city} tone=${inputData.tone} phase=${state.phase} user=${requestContext.userId}',
        },
      })
      .commit();
    workflows['var-template-multi-namespace'] = { workflow, mocks: {} };
  }

  // Test: template references ${stepResults.<stepId>.<path>} for a non-adjacent step
  {
    const earlyStep = createStep({
      id: 'early-step',
      execute: async () => ({ value: { nested: 'deep' } }),
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.object({ nested: z.string() }) }),
    });
    const middleStep = createStep({
      id: 'middle-step',
      execute: async () => ({ unrelated: true }),
      inputSchema: z.object({}),
      outputSchema: z.object({ unrelated: z.boolean() }),
    });
    const workflow = createWorkflow({
      id: 'var-template-stepresults',
      inputSchema: z.object({}),
      outputSchema: z.object({ ref: z.string() }),
    });
    workflow
      .then(earlyStep)
      .then(middleStep)
      .map({
        ref: { template: 'pulled=${stepResults.early-step.value.nested}' },
      })
      .commit();
    workflows['var-template-stepresults'] = { workflow, mocks: {} };
  }

  // Unknown-namespace is now a definition-time error (see `validateTemplate`);
  // see the `throws at workflow-definition time on an unknown namespace` test.

  // Test: error — placeholder resolves to an object/array
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ obj: { a: 1, b: 2 } }),
      inputSchema: z.object({}),
      outputSchema: z.object({ obj: z.object({ a: z.number(), b: z.number() }) }),
    });
    const workflow = createWorkflow({
      id: 'var-template-object-value',
      inputSchema: z.object({}),
      outputSchema: z.any(),
    });
    workflow
      .then(step1)
      .map({
        bad: { template: '${inputData.obj}' },
      })
      .commit();
    workflows['var-template-object-value'] = { workflow, mocks: {} };
  }

  // Test: error — stepResults references a step that didn't run / doesn't exist
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ x: 1 }),
      inputSchema: z.object({}),
      outputSchema: z.object({ x: z.number() }),
    });
    const workflow = createWorkflow({
      id: 'var-template-missing-step',
      inputSchema: z.object({}),
      outputSchema: z.any(),
    });
    workflow
      .then(step1)
      .map({
        bad: { template: '${stepResults.nonexistent.x}' },
      })
      .commit();
    workflows['var-template-missing-step'] = { workflow, mocks: {} };
  }

  // Test: null/undefined placeholder renders as empty string
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ a: 'x', b: null as string | null }),
      inputSchema: z.object({}),
      outputSchema: z.object({ a: z.string(), b: z.string().nullable() }),
    });
    const workflow = createWorkflow({
      id: 'var-template-null',
      inputSchema: z.object({}),
      outputSchema: z.object({ s: z.string() }),
    });
    workflow
      .then(step1)
      .map({
        s: { template: 'a=${inputData.a} b=[${inputData.b}]' },
      })
      .commit();
    workflows['var-template-null'] = { workflow, mocks: {} };
  }

  // ============================================================================
  // Template-source edge cases — hardening pass
  // ============================================================================

  const stringyStep = () =>
    createStep({
      id: 'stringy',
      execute: async () => ({ a: 'A', b: 'B', list: [{ name: 'first' }, { name: 'second' }] }),
      inputSchema: z.object({}),
      outputSchema: z.object({
        a: z.string(),
        b: z.string(),
        list: z.array(z.object({ name: z.string() })),
      }),
    });

  // Edge: empty template string
  {
    const workflow = createWorkflow({
      id: 'var-template-edge-empty',
      inputSchema: z.object({}),
      outputSchema: z.object({ s: z.string() }),
    });
    workflow
      .then(stringyStep())
      .map({ s: { template: '' } })
      .commit();
    workflows['var-template-edge-empty'] = { workflow, mocks: {} };
  }

  // Edge: template with no placeholders
  {
    const workflow = createWorkflow({
      id: 'var-template-edge-no-placeholders',
      inputSchema: z.object({}),
      outputSchema: z.object({ s: z.string() }),
    });
    workflow
      .then(stringyStep())
      .map({ s: { template: 'literal-only' } })
      .commit();
    workflows['var-template-edge-no-placeholders'] = { workflow, mocks: {} };
  }

  // Edge: adjacent placeholders + placeholder at start + placeholder at end
  {
    const workflow = createWorkflow({
      id: 'var-template-edge-adjacent',
      inputSchema: z.object({}),
      outputSchema: z.object({
        adjacent: z.string(),
        atStart: z.string(),
        atEnd: z.string(),
      }),
    });
    workflow
      .then(stringyStep())
      .map({
        adjacent: { template: '${inputData.a}${inputData.b}' },
        atStart: { template: '${inputData.a} suffix' },
        atEnd: { template: 'prefix ${inputData.a}' },
      })
      .commit();
    workflows['var-template-edge-adjacent'] = { workflow, mocks: {} };
  }

  // Edge: stray `$` in literal portion
  {
    const workflow = createWorkflow({
      id: 'var-template-edge-stray-dollar',
      inputSchema: z.object({}),
      outputSchema: z.object({ s: z.string() }),
    });
    workflow
      .then(stringyStep())
      .map({ s: { template: '$5 then ${inputData.a}' } })
      .commit();
    workflows['var-template-edge-stray-dollar'] = { workflow, mocks: {} };
  }

  // Edge: numeric path segment (array indexing via JS coercion)
  {
    const workflow = createWorkflow({
      id: 'var-template-edge-numeric-path',
      inputSchema: z.object({}),
      outputSchema: z.object({ s: z.string() }),
    });
    workflow
      .then(stringyStep())
      .map({ s: { template: '${inputData.list.0.name}' } })
      .commit();
    workflows['var-template-edge-numeric-path'] = { workflow, mocks: {} };
  }

  // Edge: multiline template (newlines preserved verbatim)
  {
    const workflow = createWorkflow({
      id: 'var-template-edge-multiline',
      inputSchema: z.object({}),
      outputSchema: z.object({ s: z.string() }),
    });
    workflow
      .then(stringyStep())
      .map({ s: { template: 'line1=${inputData.a}\nline2=${inputData.b}' } })
      .commit();
    workflows['var-template-edge-multiline'] = { workflow, mocks: {} };
  }

  // Edge: template longer than the 1000-char serialization cap — runtime
  // still resolves, only the graph-view display gets truncated.
  {
    const filler = 'lorem '.repeat(200); // ~1200 chars of literal padding
    const workflow = createWorkflow({
      id: 'var-template-edge-long',
      inputSchema: z.object({}),
      outputSchema: z.object({ s: z.string() }),
    });
    workflow
      .then(stringyStep())
      .map({ s: { template: `${filler}value=\${inputData.a}` } })
      .commit();
    workflows['var-template-edge-long'] = { workflow, mocks: {} };
  }

  return workflows;
}

/**
 * Create tests for variable resolution.
 * Tests use pre-registered workflows from the registry.
 */
export function createVariableResolutionTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { createWorkflow, createStep, execute, mapVariable, skipTests } = ctx;

  // If no registry provided, use legacy mode (create workflows inline)
  const useRegistry = registry !== undefined;

  describe('Variable Resolution', () => {
    it('should resolve trigger data', async () => {
      if (useRegistry) {
        const { workflow } = registry!['var-resolve-trigger-data']!;
        const result = await execute(workflow, { inputData: 'test-input' });

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: { result: 'success' },
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success' },
        });
      } else {
        // Legacy inline mode
        const executeAction = vi.fn().mockResolvedValue({ result: 'success' });

        const step1 = createStep({
          id: 'step1',
          execute: executeAction,
          inputSchema: z.object({ inputData: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: executeAction,
          inputSchema: z.object({ result: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ inputData: z.string() }),
          outputSchema: z.object({}),
        });

        workflow.then(step1).then(step2).commit();

        const result = await execute(workflow, { inputData: 'test-input' });

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: { result: 'success' },
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success' },
        });
      }
    });

    it('should provide access to step results via getStepResult helper', async () => {
      if (useRegistry) {
        const entry = registry!['var-get-step-result']!;
        entry.resetAssertions?.();

        const result = await execute(entry.workflow, { inputValue: 'test-input' });

        expect(entry.mocks.step1Action).toHaveBeenCalled();
        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: { value: 'step1-result' },
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { value: 'step2-result' },
        });

        // Run assertions captured during step execution
        const assertions = entry.getStep2Assertions?.();
        if (assertions) assertions();
      } else {
        // Legacy inline mode
        const step1Action = vi.fn().mockImplementation(async ({ inputData }) => {
          expect(inputData).toEqual({ inputValue: 'test-input' });
          return { value: 'step1-result' };
        });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({ inputValue: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });

        const nonExecutedStep = createStep({
          id: 'non-executed-step',
          execute: vi.fn(),
          inputSchema: z.object({}),
          outputSchema: z.object({}),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ getStepResult }) => {
            // Test accessing previous step result
            const step1Result = getStepResult(step1);
            expect(step1Result).toEqual({ value: 'step1-result' });
            const step1ResultFromString = getStepResult('step1');
            expect(step1ResultFromString).toEqual({ value: 'step1-result' });

            const failedStep = getStepResult(nonExecutedStep);
            expect(failedStep).toBe(null);

            return { value: 'step2-result' };
          },
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({ inputValue: z.string() }),
          outputSchema: z.object({ value: z.string() }),
        });

        workflow.then(step1).then(step2).commit();

        const result = await execute(workflow, { inputValue: 'test-input' });

        expect(step1Action).toHaveBeenCalled();
        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: { value: 'step1-result' },
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { value: 'step2-result' },
        });
      }
    });

    it('should resolve trigger data from context', async () => {
      if (useRegistry) {
        const { workflow, mocks } = registry!['var-trigger-from-context']!;
        await execute(workflow, { inputData: 'test-input' });

        expect(mocks.executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { inputData: 'test-input' },
          }),
        );
      } else {
        // Legacy inline mode
        const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          inputData: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute: executeAction,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        workflow.then(step1).commit();

        await execute(workflow, { inputData: 'test-input' });

        expect(executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { inputData: 'test-input' },
          }),
        );
      }
    });

    it.skipIf(skipTests.getInitData)('should resolve trigger data from getInitData', async () => {
      if (useRegistry) {
        const { workflow, mocks } = registry!['var-get-init-data']!;
        const result = await execute(workflow, { cool: 'test-input' });

        expect(mocks.executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: { cool: 'test-input' } },
        });
      } else {
        // Legacy inline mode
        const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute: executeAction,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ getInitData }) => {
            const initData = getInitData<z.infer<typeof triggerSchema>>();
            return { result: initData };
          },
          inputSchema: z.object({ result: z.string() }),
          outputSchema: z.object({ result: z.object({ cool: z.string() }) }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
          steps: [step1, step2],
        });

        workflow.then(step1).then(step2).commit();

        const result = await execute(workflow, { cool: 'test-input' });

        expect(executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: { cool: 'test-input' } },
        });
      }
    });

    it.skipIf(skipTests.mapPreviousStep)('should resolve variables from previous steps via .map()', async () => {
      if (useRegistry) {
        const { workflow, mocks } = registry!['var-map-previous-step']!;
        const result = await execute(workflow, {});

        expect(mocks.step2Action).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: {
              previousValue: 'step1-data',
            },
          }),
        );
        expect(result.status).toBe('success');
      } else {
        // Legacy inline mode
        const step1Action = vi.fn().mockResolvedValue({
          nested: { value: 'step1-data' },
        });
        const step2Action = vi.fn().mockResolvedValue({ result: 'success' });

        const step1 = createStep({
          id: 'step1',
          execute: step1Action,
          inputSchema: z.object({}),
          outputSchema: z.object({ nested: z.object({ value: z.string() }) }),
        });
        const step2 = createStep({
          id: 'step2',
          execute: step2Action,
          inputSchema: z.object({ previousValue: z.string() }),
          outputSchema: z.object({ result: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow
          .then(step1)
          .map({
            previousValue: mapVariable({
              step: step1,
              path: 'nested.value',
            }),
          })
          .then(step2)
          .commit();

        const result = await execute(workflow, {});

        expect(step2Action).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: {
              previousValue: 'step1-data',
            },
          }),
        );
        expect(result.status).toBe('success');
      }
    });

    it.skipIf(skipTests.nonObjectOutput)('should resolve inputs from previous steps that are not objects', async () => {
      if (useRegistry) {
        const { workflow } = registry!['var-non-object-output']!;
        const result = await execute(workflow, {});

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: 'step1-data',
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success', input: 'step1-data' },
        });
      } else {
        // Legacy inline mode
        const step1 = createStep({
          id: 'step1',
          execute: async () => {
            return 'step1-data';
          },
          inputSchema: z.object({}),
          outputSchema: z.string(),
        });
        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return { result: 'success', input: inputData };
          },
          inputSchema: z.string(),
          outputSchema: z.object({ result: z.string(), input: z.string() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow.then(step1).then(step2).commit();

        const result = await execute(workflow, {});

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: 'step1-data',
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success', input: 'step1-data' },
        });
      }
    });

    it('should resolve inputs from previous steps that are arrays', async () => {
      if (useRegistry) {
        const { workflow } = registry!['var-array-output']!;
        const result = await execute(workflow, {});

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: [{ str: 'step1-data' }],
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success', input: [{ str: 'step1-data' }] },
        });
      } else {
        // Legacy inline mode
        const step1 = createStep({
          id: 'step1',
          execute: async () => {
            return [{ str: 'step1-data' }];
          },
          inputSchema: z.object({}),
          outputSchema: z.array(z.object({ str: z.string() })),
        });
        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return { result: 'success', input: inputData };
          },
          inputSchema: z.array(z.object({ str: z.string() })),
          outputSchema: z.object({ result: z.string(), input: z.array(z.object({ str: z.string() })) }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ result: z.string() }),
        });

        workflow.then(step1).then(step2).commit();

        const result = await execute(workflow, {});

        expect(result.steps.step1).toMatchObject({
          status: 'success',
          output: [{ str: 'step1-data' }],
        });
        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success', input: [{ str: 'step1-data' }] },
        });
      }
    });

    it('should resolve constant values via .map()', async () => {
      if (useRegistry) {
        const { workflow } = registry!['var-map-constant']!;
        const result = await execute(workflow, { cool: 'test-input' });

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'none', second: 0 },
        });
      } else {
        // Legacy inline mode
        const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute: executeAction,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return {
              result: inputData.candidates.map((c: { name: string }) => c.name).join('') || 'none',
              second: inputData.iteration,
            };
          },
          inputSchema: z.object({ candidates: z.array(z.object({ name: z.string() })), iteration: z.number() }),
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        workflow
          .then(step1)
          .map({
            candidates: {
              value: [],
              schema: z.array(z.object({ name: z.string() })),
            },
            iteration: {
              value: 0,
              schema: z.number(),
            },
          })
          .then(step2)
          .commit();

        const result = await execute(workflow, { cool: 'test-input' });

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'none', second: 0 },
        });
      }
    });

    it('should resolve fully dynamic input via .map()', async () => {
      if (useRegistry) {
        const { workflow } = registry!['var-map-dynamic']!;
        const result = await execute(workflow, { cool: 'test-input' });

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success, hello', second: 0 },
        });
      } else {
        // Legacy inline mode
        const executeAction = vi.fn().mockResolvedValue({ result: 'success' });
        const triggerSchema = z.object({
          cool: z.string(),
        });

        const step1 = createStep({
          id: 'step1',
          execute: executeAction,
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string() }),
        });

        const step2 = createStep({
          id: 'step2',
          execute: async ({ inputData }) => {
            return {
              result: inputData.candidates.map((c: { name: string }) => c.name).join(', ') || 'none',
              second: inputData.iteration,
            };
          },
          inputSchema: z.object({ candidates: z.array(z.object({ name: z.string() })), iteration: z.number() }),
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        const workflow = createWorkflow({
          id: 'test-workflow',
          inputSchema: triggerSchema,
          outputSchema: z.object({ result: z.string(), second: z.number() }),
        });

        workflow
          .then(step1)
          .map(async ({ inputData }) => {
            return {
              candidates: [{ name: inputData.result }, { name: 'hello' }],
              iteration: 0,
            };
          })
          .then(step2)
          .commit();

        const result = await execute(workflow, { cool: 'test-input' });

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'success, hello', second: 0 },
        });
      }
    });

    it.skipIf(skipTests.mapRequestContextPath)(
      'should resolve trigger data and DI requestContext values via .map()',
      async () => {
        if (useRegistry) {
          const { workflow, mocks } = registry!['var-map-requestcontext']!;
          const requestContext = new RequestContext();
          requestContext.set('life', 42);

          const result = await execute(workflow, { cool: 'test-input' }, { requestContext });

          expect(mocks.executeAction).toHaveBeenCalledWith(
            expect.objectContaining({
              inputData: { cool: 'test-input' },
            }),
          );

          expect(result.steps.step2).toMatchObject({
            status: 'success',
            output: { result: 'test-input', second: 42 },
          });
        }
      },
    );

    it.skipIf(skipTests.mapDynamicFn)('should resolve dynamic mappings via .map()', async () => {
      if (useRegistry) {
        const { workflow, mocks } = registry!['var-map-dynamic-fn']!;
        const result = await execute(workflow, { cool: 'test-input' });

        if (result.status !== 'success') {
          throw new Error('Workflow should have succeeded');
        }

        expect(mocks.executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'test-input', second: 'Hello success' },
        });

        expect(result.result).toEqual({
          result: 'test-input',
          second: 'success',
        });
      }
    });

    it.skipIf(skipTests.mapCustomStepId)('should resolve dynamic mappings via .map() with custom step id', async () => {
      if (useRegistry) {
        const { workflow, mocks } = registry!['var-map-custom-step-id']!;
        const result = await execute(workflow, { cool: 'test-input' });

        if (result.status !== 'success') {
          throw new Error('Workflow should have succeeded');
        }

        expect(mocks.executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            inputData: { cool: 'test-input' },
          }),
        );

        expect(result.steps['step1-mapping']).toBeDefined();

        expect(result.steps['step1-mapping']).toMatchObject({
          status: 'success',
          output: { test: 'test-input', test2: 'Hello success' },
        });

        expect(result.steps.step2).toMatchObject({
          status: 'success',
          output: { result: 'test-input', second: 'Hello success' },
        });

        expect(result.result).toEqual({
          result: 'test-input',
          second: 'success',
        });
      }
    });

    // ========================================================================
    // .map() template-string source
    // ========================================================================

    describe('.map() template source', () => {
      it('interpolates ${inputData.<path>}', async () => {
        if (!useRegistry) return; // template tests only run in registry mode
        const { workflow } = registry!['var-template-inputdata']!;
        const result = await execute(workflow, {});
        expect(result.status).toBe('success');
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({
          status: 'success',
          output: { summary: 'Helsinki is 22°C' },
        });
      });

      it('interpolates ${initData.<path>}, ${inputData.<path>}, ${state.<path>}, ${requestContext.<key>}', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-multi-namespace']!;
        const requestContext = new RequestContext({ userId: 'tony' } as any);
        const result = await execute(workflow, { city: 'Helsinki' }, { requestContext });
        expect(result.status).toBe('success');
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({
          status: 'success',
          output: { line: 'City=Helsinki tone=cheerful phase=analyzing user=tony' },
        });
      });

      it('interpolates ${stepResults.<stepId>.<path>} for a non-adjacent step', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-stepresults']!;
        const result = await execute(workflow, {});
        expect(result.status).toBe('success');
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({
          status: 'success',
          output: { ref: 'pulled=deep' },
        });
      });

      it('renders null/undefined placeholder values as empty string', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-null']!;
        const result = await execute(workflow, {});
        expect(result.status).toBe('success');
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({
          status: 'success',
          output: { s: 'a=x b=[]' },
        });
      });

      // Unknown-namespace is caught at workflow-definition time now — see the
      // matching `throws at workflow-definition time on an unknown namespace`
      // test below in the definition-time section.

      it('JSON-stringifies a placeholder value that resolves to an object/array', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-object-value']!;
        const result = await execute(workflow, {});
        expect(result.status).toBe('success');
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({
          status: 'success',
          output: { bad: '{"a":1,"b":2}' },
        });
      });

      it('throws when stepResults references a non-existent step', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-missing-step']!;
        const result = await execute(workflow, {});
        expect(result.status).toBe('failed');
        if (result.status === 'failed') {
          expect(String((result as any).error?.message ?? result.error)).toMatch(/stepResults\.nonexistent/);
        }
      });

      // ======================================================================
      // Edge-case behaviours
      // ======================================================================

      it('resolves an empty template to an empty string', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-edge-empty']!;
        const result = await execute(workflow, {});
        expect(result.status).toBe('success');
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({ status: 'success', output: { s: '' } });
      });

      it('passes through templates with no placeholders verbatim', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-edge-no-placeholders']!;
        const result = await execute(workflow, {});
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({ status: 'success', output: { s: 'literal-only' } });
      });

      it('handles adjacent placeholders, placeholder-at-start, and placeholder-at-end', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-edge-adjacent']!;
        const result = await execute(workflow, {});
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({
          status: 'success',
          output: {
            adjacent: 'AB',
            atStart: 'A suffix',
            atEnd: 'prefix A',
          },
        });
      });

      it('leaves a stray `$` in the literal portion alone', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-edge-stray-dollar']!;
        const result = await execute(workflow, {});
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({ status: 'success', output: { s: '$5 then A' } });
      });

      it('supports numeric path segments (array indexing via JS coercion)', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-edge-numeric-path']!;
        const result = await execute(workflow, {});
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({ status: 'success', output: { s: 'first' } });
      });

      it('preserves newlines in multiline templates', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-edge-multiline']!;
        const result = await execute(workflow, {});
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({
          status: 'success',
          output: { s: 'line1=A\nline2=B' },
        });
      });

      it('resolves templates longer than the 1000-char serialization cap', async () => {
        if (!useRegistry) return;
        const { workflow } = registry!['var-template-edge-long']!;
        const result = await execute(workflow, {});
        const mappingStep = Object.entries(result.steps).find(([id]) => id.startsWith('mapping_'));
        expect(mappingStep?.[1]).toMatchObject({ status: 'success' });
        const output = (mappingStep?.[1] as any).output?.s as string;
        expect(output.length).toBeGreaterThan(1000);
        expect(output.endsWith('value=A')).toBe(true);
      });

      // ======================================================================
      // Definition-time validation (failures surface at .map(), not at run)
      // ======================================================================

      it('throws at workflow-definition time when a placeholder has whitespace inside', () => {
        const stepA = createStep({
          id: 'stepA',
          execute: async () => ({ x: '1' }),
          inputSchema: z.object({}),
          outputSchema: z.object({ x: z.string() }),
        });
        expect(() =>
          createWorkflow({
            id: 'var-template-defn-ws',
            inputSchema: z.object({}),
            outputSchema: z.any(),
          })
            .then(stepA)
            .map({ bad: { template: '${ inputData.x }' } }),
        ).toThrow(/whitespace-padded/);
      });

      it('throws at workflow-definition time when a placeholder is empty', () => {
        const stepA = createStep({
          id: 'stepA',
          execute: async () => ({ x: '1' }),
          inputSchema: z.object({}),
          outputSchema: z.object({ x: z.string() }),
        });
        expect(() =>
          createWorkflow({
            id: 'var-template-defn-empty',
            inputSchema: z.object({}),
            outputSchema: z.any(),
          })
            .then(stepA)
            .map({ bad: { template: 'a${}b' } }),
        ).toThrow(/empty or whitespace-padded/);
      });

      it('throws at workflow-definition time on an unknown namespace', () => {
        const stepA = createStep({
          id: 'stepA',
          execute: async () => ({ x: '1' }),
          inputSchema: z.object({}),
          outputSchema: z.object({ x: z.string() }),
        });
        expect(() =>
          createWorkflow({
            id: 'var-template-defn-unknown',
            inputSchema: z.object({}),
            outputSchema: z.any(),
          })
            .then(stepA)
            .map({ bad: { template: '${nope.x}' } }),
        ).toThrow(/unknown namespace "nope"/);
      });

      it('accepts a bare ${stepResults.<stepId>} placeholder at workflow-definition time (scalar path)', () => {
        const stepA = createStep({
          id: 'stepA',
          execute: async () => ({ x: '1' }),
          inputSchema: z.object({}),
          outputSchema: z.object({ x: z.string() }),
        });
        expect(() =>
          createWorkflow({
            id: 'var-template-defn-stepresults-bare',
            inputSchema: z.object({}),
            outputSchema: z.any(),
          })
            .then(stepA)
            .map({ ok: { template: '${stepResults.stepA}' } }),
        ).not.toThrow();
      });

      it('throws at workflow-definition time when stepResults placeholder has no step id', () => {
        const stepA = createStep({
          id: 'stepA',
          execute: async () => ({ x: '1' }),
          inputSchema: z.object({}),
          outputSchema: z.object({ x: z.string() }),
        });
        expect(() =>
          createWorkflow({
            id: 'var-template-defn-stepresults-empty',
            inputSchema: z.object({}),
            outputSchema: z.any(),
          })
            .then(stepA)
            .map({ bad: { template: '${stepResults.}' } }),
        ).toThrow(/stepResults\.<stepId>/);
      });
    });
  });
}
