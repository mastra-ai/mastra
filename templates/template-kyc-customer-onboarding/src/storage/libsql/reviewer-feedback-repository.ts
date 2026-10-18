import type { Client } from '@libsql/client';
import { z } from 'zod';

import type { ReviewerFeedbackRepository } from '../../contracts/repositories/reviewer-feedback-repository.js';
import { putReviewerFeedbackInputSchema } from '../../contracts/repositories/reviewer-feedback-repository.js';
import { reviewerFeedbackSchema } from '../../domain/review.js';
import { fingerprintRequest, runIdempotentMutation } from './idempotent-mutation.js';

export class LibSqlReviewerFeedbackRepository implements ReviewerFeedbackRepository {
  constructor(private readonly client: Client) {}
  async put(input: Parameters<ReviewerFeedbackRepository['put']>[0]) {
    const parsed = putReviewerFeedbackInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: parsed.feedback.tenantId,
      operation: 'PUT_REVIEWER_FEEDBACK',
      key: parsed.idempotencyKey,
      requestFingerprint: fingerprintRequest(parsed.feedback),
      createdAt: parsed.feedback.createdAt,
      completedAt: parsed.feedback.createdAt,
      execute: async transaction => {
        await transaction.execute({
          sql: 'INSERT INTO reviewer_feedback (tenant_id,id,case_id,review_id,payload_json,created_at) VALUES (?,?,?,?,?,?)',
          args: [
            parsed.feedback.tenantId,
            parsed.feedback.id,
            parsed.feedback.caseId,
            parsed.feedback.reviewId,
            JSON.stringify(parsed.feedback),
            parsed.feedback.createdAt,
          ],
        });
        return parsed.feedback;
      },
      parseResult: value => reviewerFeedbackSchema.parse(value),
    });
    return mutation.result;
  }
  async list(input: Parameters<ReviewerFeedbackRepository['list']>[0]) {
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM reviewer_feedback WHERE tenant_id=? AND case_id=? ORDER BY created_at,id',
      args: [input.tenantId, input.caseId],
    });
    return result.rows.map(row => reviewerFeedbackSchema.parse(JSON.parse(z.string().parse(row.payload_json))));
  }
}
