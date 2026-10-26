import { Classifier } from '@mastra/core/classifier';
import { Mastra } from '@mastra/core/mastra';
import { EntityType, SpanType } from '@mastra/core/observability';
import { afterEach, describe, expect, it } from 'vitest';

import { Observability } from './default';
import { TestExporter } from './exporters';

describe('classifier tracing', () => {
  let observability: Observability | undefined;

  afterEach(async () => {
    await observability?.shutdown();
  });

  it('exports the classifier evaluation root span with the classifier entity', async () => {
    const exporter = new TestExporter();
    observability = new Observability({
      configs: { default: { serviceName: 'classifier-tracing', exporters: [exporter] } },
    });
    // Decision models have no HTTP provider in this repo, so the provider interface is implemented directly.
    const classifier = new Classifier({
      id: 'support-router',
      model: {
        specificationVersion: 'v4',
        provider: 'test-provider',
        modelId: 'test-model',
        supportedQuestionTypes: ['boolean'],
        doEvaluate: async () => ({
          answers: { refund: { type: 'boolean', probability: 0.9 } },
          usage: { inputTokens: 4, outputTokens: 2 },
          warnings: [],
        }),
      },
      questions: { refund: { type: 'boolean', criteria: { true: 'Refund', false: 'Other' } } },
    });
    const mastra = new Mastra({ logger: false, classifiers: { classifier }, observability });

    await mastra.getClassifier('classifier').decide({ state: 'I was charged twice' });

    const [span] = exporter.getSpansByType(SpanType.CLASSIFIER_EVALUATION);
    expect(span).toMatchObject({
      isRootSpan: true,
      entityType: EntityType.CLASSIFIER,
      entityId: 'support-router',
      entityName: 'support-router',
    });
  });
});
