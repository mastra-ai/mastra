/**
 * Schema Validation tests for workflows
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowTestContext, WorkflowRegistry, WorkflowCreatorContext } from '../types';

/**
 * Create all workflows needed for schema validation tests.
 */
export function createSchemaValidationWorkflows(ctx: WorkflowCreatorContext) {
  const { createWorkflow, createStep } = ctx;
  const workflows: WorkflowRegistry = {};

  // Test: should throw error if trigger data is invalid
  {
    const triggerSchema = z.object({
      required: z.string(),
      nested: z.object({
        value: z.number(),
      }),
    });

    const step1 = createStep({
      id: 'step1',
      execute: vi.fn().mockResolvedValue({ result: 'success' }),
      inputSchema: z.object({
        required: z.string(),
        nested: z.object({
          value: z.number(),
        }),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
    });

    const workflow = createWorkflow({
      id: 'schema-invalid-trigger',
      inputSchema: triggerSchema,
      outputSchema: z.object({
        result: z.string(),
      }),
      steps: [step1],
      options: { validateInputs: true },
    });

    workflow.then(step1).commit();

    workflows['schema-invalid-trigger'] = { workflow, mocks: {} };
  }

  // Test: should use default value from inputSchema
  {
    const triggerSchema = z.object({
      required: z.string(),
      nested: z
        .object({
          value: z.number(),
        })
        .optional()
        .default({ value: 1 }),
    });

    const step1 = createStep({
      id: 'step1',
      execute: async ({ inputData }) => {
        return inputData;
      },
      inputSchema: triggerSchema,
      outputSchema: triggerSchema,
    });

    const workflow = createWorkflow({
      id: 'schema-default-value',
      inputSchema: triggerSchema,
      outputSchema: triggerSchema,
      steps: [step1],
      options: { validateInputs: true },
    });

    workflow.then(step1).commit();

    workflows['schema-default-value'] = { workflow, mocks: {} };
  }

  // Test: should throw error if inputData is invalid
  {
    const successAction = vi.fn().mockImplementation(() => {
      return { result: 'success' };
    });

    const step1 = createStep({
      id: 'step1',
      execute: successAction,
      inputSchema: z.object({
        start: z.string(),
      }),
      outputSchema: z.object({
        start: z.string(),
      }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: successAction,
      inputSchema: z.object({
        start: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
    });

    const workflow = createWorkflow({
      id: 'schema-invalid-input',
      inputSchema: z.object({
        start: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
      steps: [step1, step2],
      options: { validateInputs: true },
    });

    workflow.then(step1).then(step2).commit();

    workflows['schema-invalid-input'] = { workflow, mocks: { successAction } };
  }

  // Test: should use default value from inputSchema for step input
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ someValue: 'test' }),
      inputSchema: z.object({}),
      outputSchema: z.object({ someValue: z.string() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: inputData.defaultedValue + '-processed' };
      },
      inputSchema: z.object({
        defaultedValue: z.string().default('default-value'),
      }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'schema-step-default',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1, step2],
      options: { validateInputs: true },
    });

    workflow
      .then(step1)
      .then(step2 as any)
      .commit();

    workflows['schema-step-default'] = { workflow, mocks: {} };
  }

  // Test: should allow a steps input schema to be a subset of the previous step output schema
  {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({
        value1: 'test1',
        value2: 'test2',
        value3: 'test3',
      }),
      inputSchema: z.object({}),
      outputSchema: z.object({
        value1: z.string(),
        value2: z.string(),
        value3: z.string(),
      }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: async ({ inputData }) => {
        return { result: inputData.value1 + '-processed' };
      },
      inputSchema: z.object({
        value1: z.string(),
      }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'schema-subset-input',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1, step2],
    });

    workflow.then(step1).then(step2).commit();

    workflows['schema-subset-input'] = { workflow, mocks: {} };
  }

  // Test: should properly validate input schema when .map is used after .foreach - bug #11313
  {
    const mapAction = vi.fn().mockImplementation(async ({ inputData }) => {
      return { value: inputData.value + 11 };
    });

    const mapStep = createStep({
      id: 'map',
      description: 'Maps (+11) on the current value',
      inputSchema: z.object({
        value: z.number(),
      }),
      outputSchema: z.object({
        value: z.number(),
      }),
      execute: mapAction,
    });

    const finalStep = createStep({
      id: 'final',
      description: 'Final step that prints the result',
      inputSchema: z.object({
        inputValue: z.number(),
      }),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
      execute: async ({ inputData }) => {
        return { finalValue: inputData.inputValue };
      },
    });

    const workflow = createWorkflow({
      steps: [mapStep, finalStep],
      id: 'schema-map-after-foreach-bug-11313',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.object({
        finalValue: z.number(),
      }),
    });

    workflow
      .foreach(mapStep)
      .map(
        async ({ inputData }) => {
          return {
            inputValue: inputData.reduce((acc: number, curr: { value: number }) => acc + curr.value, 0),
          };
        },
        { id: 'map-step' },
      )
      .then(finalStep)
      .commit();

    workflows['schema-map-after-foreach-bug-11313'] = {
      workflow,
      mocks: { mapAction },
      resetMocks: () => {
        mapAction.mockClear();
      },
    };
  }

  // Test: should throw error if inputData is invalid in workflow with .map()
  {
    const step1 = createStep({
      id: 'step1',
      execute: async ({ inputData }) => ({ start: inputData.start }),
      inputSchema: z.object({ start: z.number() }),
      outputSchema: z.object({ start: z.number() }),
    });

    const step2 = createStep({
      id: 'step2',
      execute: vi.fn().mockResolvedValue({ result: 'success' }),
      inputSchema: z.object({ start: z.string() }), // expects string, will get number
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'schema-map-invalid',
      inputSchema: z.object({ start: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      options: { validateInputs: true },
    });

    workflow
      .then(step1)
      .map(async ({ inputData }) => ({ start: inputData.start }))
      .then(step2)
      .commit();

    workflows['schema-map-invalid'] = { workflow, mocks: {} };
  }

  // Test: should throw error if inputData is invalid in nested workflows
  {
    const innerStep = createStep({
      id: 'inner-step',
      execute: vi.fn().mockResolvedValue({ result: 'inner' }),
      inputSchema: z.object({ value: z.string() }), // expects string
      outputSchema: z.object({ result: z.string() }),
    });

    const nestedWorkflow = createWorkflow({
      id: 'schema-nested-inner',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      options: { validateInputs: true },
    })
      .then(innerStep)
      .commit();

    const outerStep = createStep({
      id: 'outer-step',
      execute: async ({ inputData }) => ({ value: inputData.num }), // passes number, not string
      inputSchema: z.object({ num: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    });

    const workflow = createWorkflow({
      id: 'schema-nested-invalid',
      inputSchema: z.object({ num: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      options: { validateInputs: true },
    });

    workflow
      .then(outerStep)
      .then(nestedWorkflow as any)
      .commit();

    workflows['schema-nested-invalid'] = { workflow, mocks: {} };
  }

  // Test: should preserve ZodError as cause when validation fails
  {
    const step1 = createStep({
      id: 'step1',
      execute: vi.fn().mockResolvedValue({ result: 'success' }),
      inputSchema: z.object({ requiredField: z.string(), numberField: z.number() }),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'schema-zod-cause',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: true },
    });

    workflow.then(step1 as any).commit();

    workflows['schema-zod-cause'] = { workflow, mocks: {} };
  }

  // #29424: the workflow inputSchema must see the caller's real input. An omitted value
  // (undefined) lets a top-level default apply; an explicit null reaches a nullable schema.
  // Each workflow records what its first step received and what getInitData() returned.
  {
    const createInputPassthroughWorkflow = (id: string, schema: z.ZodType) => {
      const observeInput = vi.fn();
      const step = createStep({
        id: 'observe',
        inputSchema: schema,
        outputSchema: z.object({ received: schema }),
        execute: async ({ inputData, getInitData }) => {
          observeInput({ inputData, initData: getInitData() });
          return { received: inputData };
        },
      });

      const workflow = createWorkflow({
        id,
        inputSchema: schema,
        outputSchema: z.object({ received: schema }),
        steps: [step],
        options: { validateInputs: true },
      });
      workflow.then(step).commit();

      workflows[id] = { workflow, mocks: { observeInput }, resetMocks: () => observeInput.mockClear() };
    };

    createInputPassthroughWorkflow(
      'schema-omitted-input-object-default',
      z.object({ count: z.number() }).default({ count: 5 }),
    );
    createInputPassthroughWorkflow('schema-omitted-input-scalar-default', z.number().default(7));
    createInputPassthroughWorkflow('schema-nullable-input', z.string().nullable());
    createInputPassthroughWorkflow('schema-omitted-input-required', z.object({ count: z.number() }));

    // With validateInputs off, the first step receives inputData exactly as the caller passed it.
    const observeUnvalidatedInput = vi.fn();
    const unvalidatedStep = createStep({
      id: 'observe',
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ receivedUndefined: z.boolean() }),
      execute: async ({ inputData }) => {
        observeUnvalidatedInput(inputData);
        return { receivedUndefined: inputData === undefined };
      },
    });
    const unvalidatedWorkflow = createWorkflow({
      id: 'schema-omitted-input-unvalidated',
      inputSchema: z.object({ count: z.number() }),
      outputSchema: z.object({ receivedUndefined: z.boolean() }),
      steps: [unvalidatedStep],
      options: { validateInputs: false },
    });
    unvalidatedWorkflow.then(unvalidatedStep).commit();
    workflows['schema-omitted-input-unvalidated'] = {
      workflow: unvalidatedWorkflow,
      mocks: { observeUnvalidatedInput },
      resetMocks: () => observeUnvalidatedInput.mockClear(),
    };
  }

  return workflows;
}

/**
 * Create tests for schema validation.
 */
export function createSchemaValidationTests(ctx: WorkflowTestContext, registry?: WorkflowRegistry) {
  const { execute, skipTests } = ctx;

  describe('Schema Validation', () => {
    it.skipIf(skipTests.schemaValidationThrows)('should throw error if trigger data is invalid', async () => {
      const { workflow } = registry!['schema-invalid-trigger']!;

      try {
        await execute(workflow, {
          required: 'test',
          nested: { value: 'not-a-number' as any },
        });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as any)?.stack).toContain(
          'Error: Invalid input data: \n- nested.value: Invalid input: expected number, received string',
        );
      }
    });

    it('should use default value from inputSchema', async () => {
      const { workflow } = registry!['schema-default-value']!;
      const result = await execute(workflow, {
        required: 'test',
      });

      expect(result.status).toBe('success');
      expect(result.steps.step1).toMatchObject({
        status: 'success',
        output: { required: 'test', nested: { value: 1 } },
      });

      expect(result.result).toEqual({ required: 'test', nested: { value: 1 } });
    });

    it.skipIf(skipTests.schemaValidationThrows)('should throw error if inputData is invalid', async () => {
      const { workflow } = registry!['schema-invalid-input']!;

      try {
        await execute(workflow, {
          start: 123 as any,
        });
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as any)?.stack).toContain(
          'Error: Invalid input data: \n- start: Invalid input: expected string, received number',
        );
      }
    });

    it('should use default value from inputSchema for step input', async () => {
      const { workflow } = registry!['schema-step-default']!;
      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'default-value-processed' },
      });
    });

    it('should allow a steps input schema to be a subset of the previous step output schema', async () => {
      const { workflow } = registry!['schema-subset-input']!;
      const result = await execute(workflow, {});

      expect(result.status).toBe('success');
      expect(result.steps.step2).toMatchObject({
        status: 'success',
        output: { result: 'test1-processed' },
      });
    });

    // Bug regression test #11313 - .map after .foreach should properly validate schema
    it('should properly validate input schema when .map is used after .foreach - bug #11313', async () => {
      const { workflow, mocks, resetMocks } = registry!['schema-map-after-foreach-bug-11313']!;
      resetMocks?.();

      const result = await execute(workflow, [{ value: 1 }, { value: 22 }, { value: 333 }]);

      expect(mocks.mapAction).toHaveBeenCalledTimes(3);
      expect(result.steps).toMatchObject({
        map: {
          status: 'success',
          output: [{ value: 12 }, { value: 33 }, { value: 344 }],
        },
        'map-step': {
          status: 'success',
          output: { inputValue: 12 + 33 + 344 }, // 389
        },
        final: {
          status: 'success',
          output: { finalValue: 389 },
        },
      });
    });

    it.skipIf(skipTests.schemaMapValidation)(
      'should throw error if inputData is invalid in workflow with .map()',
      async () => {
        const { workflow } = registry!['schema-map-invalid']!;
        const result = await execute(workflow, { start: 2 });
        expect(result.status).toBe('failed');
        if (result.status === 'failed') {
          expect(result.error).toBeDefined();
          expect((result.error as any).message).toContain('Step input validation failed');
          expect((result.error as any).message).toContain('start: Invalid input: expected string, received number');
        }
      },
    );

    it.skipIf(skipTests.schemaNestedValidation)(
      'should throw error if inputData is invalid in nested workflows',
      async () => {
        const { workflow } = registry!['schema-nested-invalid']!;
        const result = await execute(workflow, { num: 42 });
        expect(result.status).toBe('failed');
        if (result.status === 'failed') {
          expect(result.error).toBeDefined();
          expect((result.error as any).message).toContain('Invalid input: expected string, received number');
        }
      },
    );

    it.skipIf(skipTests.schemaZodErrorCause)(
      'should preserve ZodError as cause when input validation fails',
      async () => {
        const { workflow } = registry!['schema-zod-cause']!;
        const result = await execute(workflow, {});
        expect(result.status).toBe('failed');
        if (result.status === 'failed') {
          expect(result.error).toBeDefined();
          expect((result.error as any).message).toContain('Step input validation failed');
          expect((result.error as any).cause).toBeDefined();
          expect((result.error as any).cause.issues).toBeDefined();
          expect(Array.isArray((result.error as any).cause.issues)).toBe(true);
          expect((result.error as any).cause.issues.length).toBeGreaterThanOrEqual(2);
        }
      },
    );

    it.skipIf(skipTests.schemaWaitForEvent)('should throw error if waitForEvent is used', async () => {
      const { createWorkflow: createWf, createStep: createSt } = ctx;
      const step1 = createSt({
        id: 'step1',
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
      });
      const step2 = createSt({
        id: 'step2',
        execute: vi.fn(),
        inputSchema: z.object({ result: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        resumeSchema: z.any(),
      });
      const workflow = createWf({
        id: 'schema-waitforevent-test',
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        steps: [step1, step2],
      });
      try {
        // @ts-expect-error - waitForEvent is removed
        workflow.then(step1).waitForEvent('hello-event', step2).commit();
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect((error as any).message).toContain('waitForEvent has been removed');
      }
    });

    describe('workflow input passed to inputSchema as given (#29424)', () => {
      // A case an engine fails deterministically stays visible: it runs as it.fails there.
      const itFailsIf = (knownFailure: boolean | undefined) => (knownFailure ? it.fails : it);
      const firstObserved = (mocks: Record<string, any>) => mocks.observeInput.mock.calls[0]?.[0];

      it('applies a top-level object default when inputData is omitted', async () => {
        const { workflow, mocks, resetMocks } = registry!['schema-omitted-input-object-default']!;
        resetMocks?.();

        const result = await execute(workflow, undefined);

        expect(result.status).toBe('success');
        expect(result.result).toEqual({ received: { count: 5 } });
        expect(mocks.observeInput).toHaveBeenCalledTimes(1);
        expect(firstObserved(mocks).inputData).toEqual({ count: 5 });
      });

      itFailsIf(skipTests.schemaInitDataDefaultFails)(
        'returns the defaulted input from getInitData() when inputData is omitted',
        async () => {
          const { workflow, mocks, resetMocks } = registry!['schema-omitted-input-object-default']!;
          resetMocks?.();

          const result = await execute(workflow, undefined);

          expect(result.status).toBe('success');
          expect(firstObserved(mocks).initData).toEqual({ count: 5 });
        },
      );

      it('uses an explicit value over the inputSchema default', async () => {
        const { workflow, mocks, resetMocks } = registry!['schema-omitted-input-object-default']!;
        resetMocks?.();

        const result = await execute(workflow, { count: 2 });

        expect(result.status).toBe('success');
        expect(result.result).toEqual({ received: { count: 2 } });
        expect(firstObserved(mocks)).toEqual({ inputData: { count: 2 }, initData: { count: 2 } });
      });

      it('applies a scalar inputSchema default when inputData is omitted', async () => {
        const { workflow, mocks, resetMocks } = registry!['schema-omitted-input-scalar-default']!;
        resetMocks?.();

        const result = await execute(workflow, undefined);

        expect(result.status).toBe('success');
        expect(result.result).toEqual({ received: 7 });
        expect(firstObserved(mocks).inputData).toBe(7);
      });

      it('accepts explicit null for a nullable inputSchema', async () => {
        const { workflow, mocks, resetMocks } = registry!['schema-nullable-input']!;
        resetMocks?.();

        const result = await execute(workflow, null);

        expect(result.status).toBe('success');
        expect(result.result).toEqual({ received: null });
        expect(firstObserved(mocks)).toEqual({ inputData: null, initData: null });
      });

      it('passes omitted inputData to the first step as undefined when validateInputs is off', async () => {
        const { workflow, mocks, resetMocks } = registry!['schema-omitted-input-unvalidated']!;
        resetMocks?.();

        const result = await execute(workflow, undefined);

        expect(result.status).toBe('success');
        expect(result.result).toEqual({ receivedUndefined: true });
        expect(mocks.observeUnvalidatedInput).toHaveBeenCalledTimes(1);
        expect(mocks.observeUnvalidatedInput).toHaveBeenCalledWith(undefined);
      });

      it.skipIf(skipTests.schemaValidationThrows)(
        'still rejects omitted inputData when the inputSchema has no default',
        async () => {
          const { workflow, mocks, resetMocks } = registry!['schema-omitted-input-required']!;
          resetMocks?.();

          await expect(execute(workflow, undefined)).rejects.toThrow('Invalid input data');
          expect(mocks.observeInput).not.toHaveBeenCalled();
        },
      );
    });
  });
}
