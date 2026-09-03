import { describe, expect, it } from 'vitest';

import { getMetricNamesArgsSchema } from './discovery';
import { createFeedbackArgsSchema } from './feedback';
import { listLogsArgsSchema } from './logs';
import { batchCreateMetricsArgsSchema } from './metrics';
import { scoreInputSchema } from './scores';
import { EntityType, entityTypeField } from './shared';

describe('observability storage contracts', () => {
  it('preserves page and delta list normalization', () => {
    expect(listLogsArgsSchema.parse({})).toMatchObject({
      mode: 'page',
      pagination: { page: 0, perPage: 10 },
      orderBy: { field: 'timestamp', direction: 'DESC' },
      limit: 10,
    });

    expect(listLogsArgsSchema.parse({ mode: 'delta', after: 'next', limit: '25' })).toMatchObject({
      mode: 'delta',
      after: 'next',
      limit: 25,
      pagination: { page: 0, perPage: 10 },
    });
    expect(() => listLogsArgsSchema.parse({ mode: 'delta', pagination: {} })).toThrow(
      'pagination is not allowed in delta mode',
    );
  });

  it('parses representative log, metric, score, feedback, and discovery inputs', () => {
    expect(entityTypeField.parse(EntityType.AGENT)).toBe('agent');
    expect(entityTypeField.parse('workflow_run')).toBe('workflow_run');
    expect(() => entityTypeField.parse('not-an-entity')).toThrow();

    expect(
      batchCreateMetricsArgsSchema.parse({
        metrics: [{ timestamp: new Date(), name: 'request_duration_ms', value: 12 }],
      }).metrics[0]?.labels,
    ).toEqual({});
    expect(scoreInputSchema.parse({ scorerId: 'quality', score: 0.9 }).score).toBe(0.9);
    expect(
      createFeedbackArgsSchema.parse({
        feedback: { timestamp: new Date(), feedbackType: 'rating', value: 5, userId: 'user-1' },
      }).feedback.feedbackUserId,
    ).toBe('user-1');
    expect(getMetricNamesArgsSchema.parse({ prefix: 'request', limit: '20' })).toEqual({
      prefix: 'request',
      limit: 20,
    });
  });
});
