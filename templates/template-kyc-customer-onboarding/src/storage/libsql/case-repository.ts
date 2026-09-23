import type { Client, Transaction } from '@libsql/client';
import { z } from 'zod';

import type { CaseRepository } from '../../contracts/repositories/case-repository.js';
import {
  caseMutationResultSchema,
  createCaseInputSchema,
  transitionCaseRepositoryInputSchema,
} from '../../contracts/repositories/case-repository.js';
import { kycCaseSchema } from '../../domain/case.js';
import { NotFoundError, PersistenceConflictError } from '../../domain/errors.js';
import { caseCreatedEventSchema } from '../../domain/events.js';
import type { caseEventSchema } from '../../domain/events.js';
import { transitionCase } from '../../domain/state-machine.js';
import { runIdempotentMutation } from './idempotent-mutation.js';

const mutationOperation = 'CASE_MUTATION';
const persistedMutationResultSchema = caseMutationResultSchema.omit({ replayed: true });

export class LibSqlCaseRepository implements CaseRepository {
  constructor(private readonly client: Client) {}

  async create(input: Parameters<CaseRepository['create']>[0]) {
    const validated = createCaseInputSchema.parse(input);
    const event = caseCreatedEventSchema.parse({
      type: 'CASE_CREATED',
      id: validated.eventId,
      tenantId: validated.case.tenantId,
      caseId: validated.case.id,
      nextStatus: validated.case.status,
      command: 'CREATE_CASE',
      reasonCode: 'CASE_CREATED',
      actor: validated.actor,
      occurredAt: validated.case.createdAt,
      correlationId: validated.correlationId,
      policy: validated.case.policy,
      evidenceIds: [],
      idempotencyKey: validated.idempotencyKey,
      caseVersion: validated.case.version,
    });
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: validated.case.tenantId,
      operation: mutationOperation,
      key: validated.idempotencyKey,
      requestFingerprint: validated.requestFingerprint,
      createdAt: validated.case.createdAt,
      completedAt: validated.case.createdAt,
      execute: async transaction => {
        await transaction.execute({
          sql: `INSERT INTO kyc_cases
            (tenant_id, id, application_id, status, version, payload_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            validated.case.tenantId,
            validated.case.id,
            validated.case.applicationId,
            validated.case.status,
            validated.case.version,
            JSON.stringify(validated.case),
            validated.case.createdAt,
            validated.case.updatedAt,
          ],
        });
        await this.#insertEvent(transaction, event, validated.case);
        return { case: validated.case, event };
      },
      parseResult: value => persistedMutationResultSchema.parse(value),
    });
    return caseMutationResultSchema.parse({ ...mutation.result, replayed: mutation.replayed });
  }

  async get(input: Parameters<CaseRepository['get']>[0]) {
    const result = await this.client.execute({
      sql: 'SELECT payload_json FROM kyc_cases WHERE tenant_id = ? AND id = ?',
      args: [input.tenantId, input.caseId],
    });
    if (result.rows[0] === undefined) throw new NotFoundError('Case');
    return kycCaseSchema.parse(JSON.parse(z.string().parse(result.rows[0].payload_json)));
  }

  async transition(input: Parameters<CaseRepository['transition']>[0]) {
    const validated = transitionCaseRepositoryInputSchema.parse(input);
    const mutation = await runIdempotentMutation({
      client: this.client,
      tenantId: validated.tenantId,
      operation: mutationOperation,
      key: validated.idempotencyKey,
      requestFingerprint: validated.requestFingerprint,
      createdAt: validated.occurredAt,
      completedAt: validated.occurredAt,
      execute: async transaction => {
        const stored = await transaction.execute({
          sql: 'SELECT payload_json FROM kyc_cases WHERE tenant_id = ? AND id = ?',
          args: [validated.tenantId, validated.caseId],
        });
        if (stored.rows[0] === undefined) throw new NotFoundError('Case');
        const current = kycCaseSchema.parse(JSON.parse(z.string().parse(stored.rows[0].payload_json)));
        if (current.version !== validated.expectedVersion) throw new PersistenceConflictError('Case');
        const transition = transitionCase(current, {
          command: validated.command,
          eventId: validated.eventId,
          reasonCode: validated.reasonCode,
          actor: validated.actor,
          occurredAt: validated.occurredAt,
          correlationId: validated.correlationId,
          policy: validated.policy,
          evidenceIds: validated.evidenceIds,
          idempotencyKey: validated.idempotencyKey,
          ...(validated.workflowRunId === undefined ? {} : { workflowRunId: validated.workflowRunId }),
        });
        const update = await transaction.execute({
          sql: `UPDATE kyc_cases SET status = ?, version = ?, payload_json = ?, updated_at = ?
            WHERE tenant_id = ? AND id = ? AND version = ? AND status = ?`,
          args: [
            transition.case.status,
            transition.case.version,
            JSON.stringify(transition.case),
            transition.case.updatedAt,
            validated.tenantId,
            validated.caseId,
            validated.expectedVersion,
            current.status,
          ],
        });
        if (update.rowsAffected !== 1) throw new PersistenceConflictError('Case');
        await this.#insertEvent(transaction, transition.event, transition.case);
        return transition;
      },
      parseResult: value => persistedMutationResultSchema.parse(value),
    });
    return caseMutationResultSchema.parse({ ...mutation.result, replayed: mutation.replayed });
  }

  async #insertEvent(
    transaction: Transaction,
    event: z.infer<typeof caseEventSchema>,
    caseValue: z.infer<typeof kycCaseSchema>,
  ): Promise<void> {
    await transaction.execute({
      sql: `INSERT INTO case_events
        (tenant_id, id, case_id, event_type, case_version, occurred_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        event.tenantId,
        event.id,
        event.caseId,
        event.type,
        event.caseVersion,
        event.occurredAt,
        JSON.stringify(event),
      ],
    });
    await transaction.execute({
      sql: `INSERT INTO analytics_outbox
        (tenant_id, event_id, event_type, payload_json, created_at, projected_at)
        VALUES (?, ?, ?, ?, ?, NULL)`,
      args: [
        event.tenantId,
        event.id,
        event.type,
        JSON.stringify({
          kind: 'case',
          caseId: event.caseId,
          status: event.nextStatus,
          jurisdiction: caseValue.jurisdiction,
          policyVersion: event.policy.version,
          caseCreatedAt: caseValue.createdAt,
        }),
        event.occurredAt,
      ],
    });
  }
}
