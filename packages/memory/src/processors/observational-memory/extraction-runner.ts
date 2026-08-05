import type { Agent, AgentMemoryOption } from '@mastra/core/agent';
import { coreFeatures } from '@mastra/core/features';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';

import type { Extractor, ExtractorSource } from './extractor';
import { buildExtractorPriorLines } from './extractor';

export interface StructuredExtractionResult {
  values: Record<string, unknown>;
  failures: Array<{ slug: string; error: string }>;
}

function isAbortError(error: unknown, abortSignal?: AbortSignal): boolean {
  return (
    abortSignal?.aborted === true ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export async function extractStructuredValues(opts: {
  agent: Agent<any, any, any, any>;
  source: ExtractorSource;
  extractors?: readonly Extractor<any>[];
  memory?: AgentMemoryOption;
  priorExtractedValues?: Record<string, unknown>;
  requestContext?: RequestContext;
  observabilityContext?: ObservabilityContext;
  abortSignal?: AbortSignal;
}): Promise<StructuredExtractionResult> {
  const structuredExtractors = (opts.extractors ?? []).filter(extractor => extractor.mode === 'structured');
  if (structuredExtractors.length === 0) {
    return { values: {}, failures: [] };
  }

  const schema = z.object(
    Object.fromEntries(structuredExtractors.map(extractor => [extractor.slug, extractor.schema.optional()])) as Record<
      string,
      z.ZodTypeAny
    >,
  );
  const priorLines = buildExtractorPriorLines(structuredExtractors, opts.priorExtractedValues);
  const extractorInstructions = structuredExtractors
    .map(extractor => `- ${extractor.slug}: ${extractor.instructions}`)
    .join('\n');
  const subject = opts.source === 'reflector' ? 'reflection' : 'observations';
  const prompt = `Extract structured data from the ${subject} you made.

Return only the configured structured output object. Do not write observations, XML, markdown, or explanatory text.
Omit any property that is not supported by the ${subject} you made and the conversation context.
If a prior value is still applicable and carry-forward is enabled, return that prior value.

## Extractors

${extractorInstructions}${priorLines.length > 0 ? `\n\n## Prior Extracted Values\n\n${priorLines.join('\n\n')}` : ''}`;

  const values: Record<string, unknown> = {};
  const failures: Array<{ slug: string; error: string }> = [];

  const generateWithStructuredOutput = async (jsonPromptInjection?: boolean | 'system' | 'inline') => {
    const output = await opts.agent.generate(prompt, {
      structuredOutput: { schema, ...(jsonPromptInjection ? { jsonPromptInjection } : {}) },
      ...(opts.memory ? { memory: opts.memory } : {}),
      ...(opts.abortSignal ? { abortSignal: opts.abortSignal } : {}),
      ...(opts.requestContext ? { requestContext: opts.requestContext } : {}),
      ...opts.observabilityContext,
    });

    if (output.object === undefined) {
      throw new Error('structuredOutput object is undefined');
    }

    return output.object;
  };

  let object: Record<string, unknown>;
  try {
    object = await generateWithStructuredOutput();
  } catch (error) {
    if (isAbortError(error, opts.abortSignal)) {
      throw error;
    }

    try {
      const fallbackJsonPromptInjection = coreFeatures.has('json-prompt-injection:inline') ? 'inline' : true;
      object = await generateWithStructuredOutput(fallbackJsonPromptInjection);
    } catch (fallbackError) {
      if (isAbortError(fallbackError, opts.abortSignal)) {
        throw fallbackError;
      }

      const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      return {
        values,
        failures: structuredExtractors.map(extractor => ({ slug: extractor.slug, error: message })),
      };
    }
  }

  for (const extractor of structuredExtractors) {
    const value = (object as Record<string, unknown>)[extractor.slug];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    const parsed = extractor.schema.safeParse(value);
    if (parsed.success) {
      values[extractor.slug] = parsed.data;
    } else {
      failures.push({ slug: extractor.slug, error: parsed.error.message });
    }
  }

  return { values, failures };
}
