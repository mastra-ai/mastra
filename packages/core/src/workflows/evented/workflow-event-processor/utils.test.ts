import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { EventedWorkflow } from '../workflow';
import { getStep } from './utils';

describe('getStep', () => {
  function createNestedWorkflow(stepType: 'parallel' | 'conditional') {
    // Create target step that will be nested
    const targetStep = {
      type: 'step' as const,
      step: {
        id: 'nestedStep',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      },
    };

    // Create inner workflow containing target step
    const innerWorkflow = new EventedWorkflow({
      id: 'innerWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    innerWorkflow.stepGraph[0] = targetStep;

    // Create outer workflow
    const outerWorkflow = new EventedWorkflow({
      id: 'outerWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    // Create container step (parallel or conditional) with inner workflow
    const containerStep = {
      type: stepType,
      steps: [
        { type: 'step', step: { id: 'otherStep' } },
        { type: 'step', step: innerWorkflow },
      ],
    };
    outerWorkflow.stepGraph[0] = containerStep as any;

    return { outerWorkflow, targetStep };
  }

  it('should resolve step from EventedWorkflow', () => {
    // Arrange: Create target step and evented workflow containing it
    const targetStep = {
      type: 'step' as const,
      step: {
        id: 'innerStep',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      },
    };

    const eventedWorkflow = new EventedWorkflow({
      id: 'eventedWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    eventedWorkflow.stepGraph[0] = targetStep;

    // Act: Call getStep with path to the step
    const result = getStep(eventedWorkflow as any, [0]);

    // Assert: Verify returned step matches target
    expect(result).toBe(targetStep.step);
  });

  it('should return correct step from nested EventedWorkflow', () => {
    // Arrange: Create nested EventedWorkflow structure
    const targetStep = {
      type: 'step' as const,
      step: {
        id: 'deeplyNestedStep',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      },
    };

    const innerWorkflow = new EventedWorkflow({
      id: 'innerWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    innerWorkflow.stepGraph[0] = targetStep;

    const outerWorkflow = new EventedWorkflow({
      id: 'outerWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    // Wrap the inner workflow as a step entry, since getStep expects 'step' entries
    outerWorkflow.stepGraph[1] = { type: 'step', step: innerWorkflow as any } as any;

    // Act: Resolve the outer step first, then the inner step
    const nestedWorkflow = getStep(outerWorkflow as any, [1]);
    const result = getStep(nestedWorkflow as any, [0]);

    // Assert: Verify we get the deeply nested step
    expect(result).toBe(targetStep.step);
  });

  it('should handle nested EventedWorkflow path slicing correctly', () => {
    // Arrange: Create nested EventedWorkflow structure
    const innerWorkflow = new EventedWorkflow({
      id: 'innerWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const outerWorkflow = new EventedWorkflow({
      id: 'outerWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    // Wrap the inner workflow in a 'step' so getStep returns .step per current implementation
    outerWorkflow.stepGraph[1] = { type: 'step', step: innerWorkflow } as any;

    // Act: Call getStep with path to traverse nested structure
    const result = getStep(outerWorkflow as any, [1, 0]);

    // Assert: Verify returned step is the inner workflow object (since it's wrapped in a step)
    expect(result).toBe(innerWorkflow);
  });

  it('should handle direct EventedWorkflow instances in step graph', () => {
    // Arrange: Create nested workflow structure with inner step
    const targetStep = {
      type: 'step' as const,
      step: {
        id: 'nestedStep',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      },
    };

    const innerWorkflow = new EventedWorkflow({
      id: 'innerWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    innerWorkflow.stepGraph[0] = targetStep;

    const outerWorkflow = new EventedWorkflow({
      id: 'outerWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    // Add inner workflow directly to step graph (not wrapped in a step object)
    outerWorkflow.stepGraph[0] = innerWorkflow as any;
    // Ensure getStep treats this as a step-like node so it can recurse into the nested workflow
    (outerWorkflow.stepGraph[0] as any).type = 'step';

    // Act: Call getStep with path that requires slicing
    const result = getStep(outerWorkflow as any, [0, 0]);

    // Assert: Verify we get the correct nested step through recursive resolution
    expect(result).toBe(targetStep.step);
  });

  it('should return null for invalid path in EventedWorkflow', () => {
    // Arrange: Create nested EventedWorkflow structure
    const innerWorkflow = new EventedWorkflow({
      id: 'innerWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const outerWorkflow = new EventedWorkflow({
      id: 'outerWorkflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    outerWorkflow.stepGraph[1] = innerWorkflow as any;

    // Act & Assert: Try invalid paths
    expect(getStep(outerWorkflow as any, [1, 999])).toBeNull();
    expect(getStep(outerWorkflow as any, [])).toBeNull();
  });

  it('should return step property for loop type', () => {
    // Arrange: Create workflow with loop step
    const loopStep = {
      type: 'loop' as const,
      step: {
        id: 'loopStep',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async () => ({}),
      },
    };

    const workflow = new EventedWorkflow({
      id: 'workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });
    workflow.stepGraph[0] = loopStep as any;

    // Act: Call getStep with path to loop step
    const result = getStep(workflow as any, [0]);

    // Assert: Verify returned step matches loop step
    expect(result).toBe(loopStep.step);
  });

  it('should correctly resolve step from EventedWorkflow nested in parallel step', () => {
    // Arrange: Create nested workflow structure with parallel container
    const { outerWorkflow, targetStep } = createNestedWorkflow('parallel');

    // Act: First resolve the inner EventedWorkflow, then resolve the nested step within it
    const intermediate = getStep(outerWorkflow as any, [0, 1]);
    const result = getStep(intermediate as any, [0]);

    // Assert: Verify we get the correct nested step
    expect(result).toBe(targetStep.step);
  });

  it('should correctly resolve step from EventedWorkflow nested in conditional step', () => {
    // Arrange: Create nested workflow structure with conditional container
    const { outerWorkflow, targetStep } = createNestedWorkflow('conditional');

    // Act: First resolve the inner EventedWorkflow, then resolve the nested step within it
    const intermediate = getStep(outerWorkflow as any, [0, 1]);
    const result = getStep(intermediate as any, [0]);

    // Assert: Verify we get the correct nested step
    expect(result).toBe(targetStep.step);
  });
});
