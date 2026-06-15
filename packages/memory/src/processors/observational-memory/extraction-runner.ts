import type { Agent } from '@mastra/core/agent';
import type { CoreMessageV4 } from '@mastra/core/agent/message-list';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';

import type { Extractor, ExtractorSource } from './extractor';
import { buildExtractorPriorLines } from './extractor';

export interface StructuredExtractionResult {
  values: Record<string, unknown>;
  failures: Array<{ slug: string; error: string }>;
}

export async function extractStructuredValues(opts: {
  agent: Agent<any, any, any, any>;
  source: ExtractorSource;
  extractors: readonly Extractor<any>[];
  sourceMessages: CoreMessageV4[];
  sourceOutput: string;
  observations?: string;
  priorExtractedValues?: Record<string, unknown>;
  requestContext?: RequestContext;
  observabilityContext?: ObservabilityContext;
  abortSignal?: AbortSignal;
}): Promise<StructuredExtractionResult> {
  const structuredExtractors = opts.extractors.filter(extractor => extractor.mode === 'structured');
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
  const prompt = `Extract the configured Observational Memory values from the ${opts.source} result.

Return only values justified by the source messages and source output. If a value is unchanged and a prior value is available, carry it forward when appropriate. Omit values that cannot be inferred.

## Extractors

${extractorInstructions}${priorLines.length > 0 ? `\n\n## Prior Extracted Values\n\n${priorLines.join('\n\n')}` : ''}

## Source Output

${opts.sourceOutput}${opts.observations ? `\n\n## Parsed Observations\n\n${opts.observations}` : ''}`;

  const values: Record<string, unknown> = {};
  const failures: Array<{ slug: string; error: string }> = [];

  let object: Record<string, unknown>;
  try {
    const output = await opts.agent.generate(
      [...opts.sourceMessages, { role: 'assistant', content: opts.sourceOutput }, { role: 'user', content: prompt }],
      {
        structuredOutput: { schema },
        ...(opts.abortSignal ? { abortSignal: opts.abortSignal } : {}),
        ...(opts.requestContext ? { requestContext: opts.requestContext } : {}),
        ...opts.observabilityContext,
      },
    );
    object = output.object ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      values,
      failures: structuredExtractors.map(extractor => ({ slug: extractor.slug, error: message })),
    };
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
