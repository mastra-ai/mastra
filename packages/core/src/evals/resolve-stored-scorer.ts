import { z } from 'zod';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { StorageScorerType, StorageScorerStepConfig } from '../storage/types';
import { createScorer } from './base';
import type { MastraScorer } from './base';

/**
 * Interpolates a template string with values from the context.
 *
 * Supports:
 * - {{run.output}} - Access run output
 * - {{run.input}} - Access run input
 * - {{run.groundTruth}} - Access ground truth
 * - {{results.preprocessStepResult}} - Access preprocess step result
 * - {{results.analyzeStepResult}} - Access analyze step result
 * - {{score}} - Access score (only in generateReason context)
 *
 * @example
 * ```
 * const template = "Analyze this output: {{run.output}}";
 * const result = interpolateTemplate(template, { run: { output: "Hello" } });
 * // result: "Analyze this output: Hello"
 * ```
 */
function interpolateTemplate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const parts = path.trim().split('.');
    let value: any = context;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return '';
      }
      value = value[part];
    }

    // Convert value to string representation
    if (value === undefined || value === null) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  });
}

/**
 * Converts a JSON Schema object to a Zod schema.
 * Supports basic types: string, number, boolean, object, array.
 *
 * @param jsonSchema - JSON Schema object
 * @returns Zod schema
 */
function jsonSchemaToZod(jsonSchema: Record<string, unknown>): z.ZodTypeAny {
  const type = jsonSchema.type as string;

  switch (type) {
    case 'string':
      return z.string();
    case 'number':
    case 'integer':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'array': {
      const items = jsonSchema.items as Record<string, unknown> | undefined;
      if (items) {
        return z.array(jsonSchemaToZod(items));
      }
      return z.array(z.any());
    }
    case 'object': {
      const properties = jsonSchema.properties as Record<string, Record<string, unknown>> | undefined;
      const required = (jsonSchema.required as string[]) || [];

      if (!properties) {
        return z.record(z.string(), z.any());
      }

      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        const propZod = jsonSchemaToZod(propSchema);
        shape[key] = required.includes(key) ? propZod : propZod.optional();
      }

      return z.object(shape);
    }
    default:
      return z.any();
  }
}

/**
 * Creates a prompt object compatible with MastraScorer from a stored step config.
 */
function createPromptObjectFromStep(step: StorageScorerStepConfig, defaultJudge?: StorageScorerType['judge']) {
  const judge = step.judge
    ? {
        model: step.judge.model,
        instructions: step.judge.instructions ?? defaultJudge?.instructions ?? '',
      }
    : defaultJudge
      ? {
          model: defaultJudge.model,
          instructions: defaultJudge.instructions,
        }
      : undefined;

  // generateScore and generateReason don't have outputSchema
  if (step.name === 'generateScore' || step.name === 'generateReason') {
    return {
      description: step.description,
      judge,
      createPrompt: (context: Record<string, any>) => interpolateTemplate(step.promptTemplate, context),
    };
  }

  // preprocess and analyze have outputSchema
  const outputSchema = step.outputSchema ? jsonSchemaToZod(step.outputSchema) : z.any();

  return {
    description: step.description,
    outputSchema,
    judge,
    createPrompt: (context: Record<string, any>) => interpolateTemplate(step.promptTemplate, context),
  };
}

/**
 * Resolves a stored scorer configuration to a runnable MastraScorer instance.
 *
 * This function takes a scorer definition stored in the database and converts it
 * to a fully functional MastraScorer that can be used to evaluate agent runs.
 *
 * @param storedScorer - The stored scorer configuration from the database
 * @returns A MastraScorer instance ready to run
 *
 * @example
 * ```typescript
 * const storedScorer = await storage.getStore('storedScorers').getScorerById({ id: 'my-scorer' });
 * const scorer = resolveStoredScorer(storedScorer);
 *
 * const result = await scorer.run({
 *   output: agentRun.output,
 *   input: agentRun.input,
 * });
 * ```
 */
export function resolveStoredScorer(storedScorer: StorageScorerType): MastraScorer<string, any, any, any> {
  // Validate that we have at least a generateScore step
  const hasGenerateScore = storedScorer.steps.some(step => step.name === 'generateScore');
  if (!hasGenerateScore) {
    throw new MastraError({
      id: 'MASTR_STORED_SCORER_MISSING_GENERATE_SCORE',
      domain: ErrorDomain.SCORER,
      category: ErrorCategory.USER,
      text: `Stored scorer "${storedScorer.id}" must have a generateScore step`,
      details: {
        scorerId: storedScorer.id,
        steps: storedScorer.steps.map(s => s.name).join(', '),
      },
    });
  }

  // Validate that generateScore has a judge configured (either step-level or scorer-level)
  const generateScoreStep = storedScorer.steps.find(step => step.name === 'generateScore');
  if (!generateScoreStep?.judge && !storedScorer.judge) {
    throw new MastraError({
      id: 'MASTR_STORED_SCORER_MISSING_JUDGE',
      domain: ErrorDomain.SCORER,
      category: ErrorCategory.USER,
      text: `Stored scorer "${storedScorer.id}" requires a judge configuration for prompt-based steps`,
      details: {
        scorerId: storedScorer.id,
      },
    });
  }

  // Convert the stored type to the format expected by createScorer
  let scorerType: 'agent' | { input: z.ZodTypeAny; output: z.ZodTypeAny } | undefined;
  if (storedScorer.type === 'agent') {
    scorerType = 'agent';
  } else if (storedScorer.type && typeof storedScorer.type === 'object') {
    scorerType = {
      input: storedScorer.type.inputSchema ? jsonSchemaToZod(storedScorer.type.inputSchema) : z.any(),
      output: storedScorer.type.outputSchema ? jsonSchemaToZod(storedScorer.type.outputSchema) : z.any(),
    };
  }

  // Create the base scorer
  let scorer = createScorer({
    id: storedScorer.id,
    name: storedScorer.name,
    description: storedScorer.description,
    judge: storedScorer.judge
      ? {
          model: storedScorer.judge.model,
          instructions: storedScorer.judge.instructions,
        }
      : undefined,
    type: scorerType,
  });

  // Sort steps in the correct pipeline order
  const stepOrder = ['preprocess', 'analyze', 'generateScore', 'generateReason'] as const;
  const sortedSteps = [...storedScorer.steps].sort((a, b) => stepOrder.indexOf(a.name) - stepOrder.indexOf(b.name));

  // Add each step to the scorer pipeline
  for (const step of sortedSteps) {
    const promptObject = createPromptObjectFromStep(step, storedScorer.judge);

    switch (step.name) {
      case 'preprocess':
        scorer = scorer.preprocess(promptObject as any);
        break;
      case 'analyze':
        scorer = scorer.analyze(promptObject as any);
        break;
      case 'generateScore':
        scorer = scorer.generateScore(promptObject as any);
        break;
      case 'generateReason':
        scorer = scorer.generateReason(promptObject as any);
        break;
    }
  }

  return scorer;
}

/**
 * Resolves multiple stored scorer configurations to MastraScorer instances.
 *
 * @param storedScorers - Array of stored scorer configurations
 * @returns Map of scorer ID to MastraScorer instance
 */
export function resolveStoredScorers(
  storedScorers: StorageScorerType[],
): Map<string, MastraScorer<string, any, any, any>> {
  const scorers = new Map<string, MastraScorer<string, any, any, any>>();

  for (const storedScorer of storedScorers) {
    try {
      scorers.set(storedScorer.id, resolveStoredScorer(storedScorer));
    } catch (error) {
      // Log warning but continue with other scorers
      console.warn(`Failed to resolve stored scorer "${storedScorer.id}":`, error);
    }
  }

  return scorers;
}
