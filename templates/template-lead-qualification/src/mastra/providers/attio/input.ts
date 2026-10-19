import { z } from 'zod';
import type { AttioConfig } from '../../config/attio';
import type { IntakeConfig } from '../../config/lead-ingestion';
import { domainSchema, normalizedEventSchema } from '../../contracts';
import { AdmissionError, DeliveryConflictError } from '../../persistence/lead-event-store';
import type { LeadEventStore } from '../../persistence/lead-event-store';
import { attioEventSchema } from './store';
import type { AttioEvent, AttioStore } from './store';
import type { LeadIntake } from '../../intake';
import type { EventInputProvider } from '../input';
import { createAttioRoutes } from './routes';
import { parseAttioMetadata } from './metadata';
import type { AttioClient, AttioEntry } from './client';
import type { AttioOutputProvider } from './output';
import { OutputError } from '../output';
import { stageDecisionInputSchema, digestValue, commandWithinReceiptWindow } from '../../review/contracts';
import { ReviewConflictError } from '../../review/service';
import type { ReviewService } from '../../review/service';

/** The existing lifecycle worker drains this durable inbox before dispatching runs. */
export class AttioInputProvider implements EventInputProvider {
  readonly id = 'attio';
  readonly transport = 'custom';
  readonly source;
  readonly routes;
  constructor(
    private readonly store: LeadEventStore,
    readonly client: AttioClient,
    private readonly reviews: ReviewService,
    private readonly intake: IntakeConfig,
    private readonly admission: LeadIntake,
    private readonly output: AttioOutputProvider,
    private readonly config: AttioConfig,
    readonly inbox: AttioStore,
  ) {
    this.source = {
      ...intake.source,
      id: `attio:${client.config.listId}`,
      inputProviderId: this.id,
      destinationProviderId: intake.source.destinationProviderId,
      crmProviderIds: ['attio'],
    };
    this.routes = createAttioRoutes(inbox, config, intake.limits.maxBodyBytes, intake.limits.maxPendingRuns);
  }
  async drain() {
    for (const item of await this.inbox.pending(this.intake.limits.activeRuns)) {
      if (item.attempts >= this.config.limits.maxAttempts) {
        await this.inbox.finish(item.id, 'failed', 'attio_attempts_exhausted');
        continue;
      }
      await this.inbox.reserve(item.id);
      try {
        const runId = await this.admission.receive(this, { id: item.id, event: item.event }, item.receivedAt);
        await this.inbox.finish(item.id, runId ? 'done' : 'ignored', null, runId ?? null);
      } catch (error) {
        const failure =
          error instanceof OutputError
            ? error.code === 'identity_unresolved'
              ? new OutputError('attio_identity_unresolved', false)
              : error
            : error instanceof AdmissionError
              ? new OutputError('attio_admission_pressure', true)
              : new OutputError(
                  error instanceof ReviewConflictError || error instanceof DeliveryConflictError
                    ? 'attio_conflict'
                    : 'attio_invalid_data',
                  false,
                );
        const exhausted =
          !failure.retryable ||
          item.attempts + 1 >= this.config.limits.maxAttempts ||
          failure.retryAfterMs > this.config.limits.maxRetryDelayMs;
        if (exhausted)
          await this.inbox.finish(item.id, failure.code === 'attio_conflict' ? 'conflict' : 'failed', failure.code);
        else
          await this.inbox.retry(
            item.id,
            Math.max(this.config.limits.retryDelayMs, failure.retryAfterMs),
            failure.code,
          );
      }
    }
  }
  private async authoritative(
    entry: AttioEntry,
    name: keyof AttioConfig['fields'],
    event: AttioEvent,
    receivedAt: string,
    after: string,
  ) {
    const values = (await this.client.history(entry.id.entry_id, this.config.fields[name].id)).filter(
      value => value.active_until === null,
    );
    if (values.length > 1) throw new ReviewConflictError('Ambiguous active command');
    const value = values[0];
    if (digestValue(value ?? null) !== digestValue(this.client.value(entry, name) ?? null))
      throw new ReviewConflictError('Command changed during verification');
    if (!value) return;
    if (
      !event.actor ||
      event.actor.type !== 'workspace-member' ||
      value.created_by_actor.type !== 'workspace-member' ||
      value.created_by_actor.id !== event.actor.id ||
      Date.parse(value.active_from) <= Date.parse(after) ||
      !commandWithinReceiptWindow(value.active_from, receivedAt)
    )
      throw new ReviewConflictError('Command actor or time is not current');
    return { ...value, created_by_actor: value.created_by_actor };
  }
  async normalize(payload: unknown, source: IntakeConfig['source'], receivedAt: string) {
    const { id, event } = z.strictObject({ id: z.string().min(1), event: attioEventSchema }).parse(payload);
    if (event.id.workspace_id !== this.config.workspaceId || !event.id.entry_id) return;
    if (this.config.sales && event.id.list_id === this.config.sales.listId) {
      const runId = await this.sales(event, receivedAt);
      return runId ? { runId } : undefined;
    }
    if (
      event.id.list_id !== this.config.listId ||
      !['list-entry.created', 'list-entry.updated'].includes(event.event_type)
    )
      return;
    const created = event.event_type === 'list-entry.created';
    if (!created && source.destinationProviderId !== this.output.id) return;
    if (!created && event.id.attribute_id !== this.config.fields.stage.id) return;
    const delivered = (
      await this.store.client.execute({
        sql: 'SELECT run_id FROM lead_deliveries WHERE source_id=? AND event_id=?',
        args: [`attio:${this.config.listId}`, id],
      })
    ).rows[0];
    if (delivered) return { runId: z.string().parse(delivered.run_id) };
    const entry = await this.client.entry(event.id.entry_id);
    if (entry.parent_object !== this.config.companyObjectId && entry.parent_object !== 'companies')
      throw new OutputError('attio_company_required', false);
    const fields = this.client.fields(entry);
    const row = (
      await this.store.client.execute({
        sql: 'SELECT run_id FROM lead_cycles WHERE destination_provider=? AND destination_reference=? ORDER BY rowid DESC LIMIT 1',
        args: [source.destinationProviderId, entry.id.entry_id],
      })
    ).rows[0];
    const cycle = row ? await this.store.reviews.get(z.string().parse(row.run_id)) : null;
    if (
      !created &&
      cycle?.packet &&
      cycle.active &&
      cycle.state === 'awaiting_review' &&
      ['Qualified', 'Nurture', 'Disqualified'].includes(String(fields.stage))
    ) {
      const value = await this.authoritative(entry, 'stage', event, receivedAt, cycle.publishedAt!);
      if (!value) throw new ReviewConflictError('A current human Stage transition is required');
      const parsed = stageDecisionInputSchema.safeParse({
        kind: 'attio-stage',
        runId: cycle.runId,
        reviewId: fields.reviewId,
        revision: fields.reviewRevision,
        digest: cycle.packet.digest,
        decision: 'approved',
        stage: fields.stage,
        justification: typeof fields.reviewJustification === 'string' ? fields.reviewJustification : null,
      });
      if (!parsed.success)
        throw new OutputError(
          parsed.error.issues.some(issue => issue.path[0] === 'justification' && issue.code === 'too_big')
            ? 'attio_justification_too_long'
            : 'attio_invalid_stage_command',
          false,
        );
      await this.reviews.decideFromProvider(
        this.output.id,
        parsed.data,
        { provider: 'attio', workspaceId: this.config.workspaceId, memberId: value.created_by_actor.id },
        value.active_from,
        this.output.owned(fields),
        this.output.revision(entry),
      );
      return { runId: cycle.runId };
    }
    if (!['Triage', 'Needs review'].includes(String(fields.stage))) return;
    if (cycle) {
      if (
        created ||
        cycle.active ||
        !cycle.assessmentId ||
        !['applied', 'rejected', 'changes_requested', 'expired'].includes(cycle.state)
      )
        return;
      const value = await this.authoritative(
        entry,
        'stage',
        event,
        receivedAt,
        cycle.changedAt || cycle.publishedAt || '1970-01-01T00:00:00Z',
      );
      if (!value) throw new ReviewConflictError('A current human Stage transition is required');
      const operation = await this.store.reviews.operation(
        cycle.runId,
        cycle.state === 'applied' ? 'final' : 'closure',
        cycle.revision,
      );
      if (!operation || operation.state !== 'applied' || fields.operationId !== operation.id)
        throw new ReviewConflictError('Previous output is unreconciled');
      const previous = this.output.project(operation.patch, operation.id, operation.expected);
      const binding = {
        ...this.output.owned(fields),
        ...Object.fromEntries(this.output.reviewFields.map(name => [name, previous[name]])),
      };
      if (this.config.layoutVersion === 2 && fields.stage === 'Triage') {
        const currentMetadata = parseAttioMetadata(fields.metadata);
        const previousMetadata = parseAttioMetadata(previous.metadata);
        if (digestValue(currentMetadata.output) !== digestValue(previousMetadata.output))
          throw new ReviewConflictError('Previous machine-owned output changed');
        // A verified fresh-cycle request may replace submitted input, never the prior output.
        binding.metadata = previous.metadata;
      }
      if (digestValue(binding) !== digestValue(previous))
        throw new ReviewConflictError('Previous machine-owned output changed');
      if (fields.stage === 'Needs review') {
        await this.reviews.reopenFromProvider(
          this.output.id,
          cycle.runId,
          this.output.owned(fields),
          this.output.revision(entry),
          {
            memberId: value.created_by_actor.id,
            occurredAt: value.active_from,
            receivedAt,
          },
        );
        return { runId: cycle.runId };
      }
    } else if (!created || fields.stage !== 'Triage') return;
    const company = await this.client.company(entry.parent_record_id);
    const domains = [
      ...new Set(
        (company.values.domains ?? []).filter(value => value.active_until === null).map(value => value.domain),
      ),
    ];
    const domain = domains.length === 1 ? domainSchema.safeParse(domains[0]) : undefined;
    const metadata =
      this.config.layoutVersion === 2 && fields.metadata !== undefined
        ? parseAttioMetadata(fields.metadata)
        : undefined;
    if (!cycle && metadata?.output) throw new ReviewConflictError('New entries cannot supply machine output');
    const inquiry =
      this.config.layoutVersion === 2
        ? metadata?.input?.inquiry
        : fields.inquiry === undefined
          ? undefined
          : JSON.parse(z.string().parse(fields.inquiry));
    const normalized = normalizedEventSchema.parse({
      version: 1,
      type: 'lead.received',
      eventId: id,
      sourceId: source.id,
      receivedAt,
      lead: {
        reference: entry.id.entry_id,
        ...(domain?.success ? { domain: domain.data } : {}),
        crm: { providerId: 'attio', recordId: entry.parent_record_id },
        ...(inquiry ? { inquiry } : {}),
      },
      destination: { providerId: source.destinationProviderId, reference: entry.id.entry_id },
      ...(cycle ? { supersedesAssessmentId: cycle.assessmentId } : {}),
    });
    return {
      event: normalized,
      ...(source.destinationProviderId === this.output.id
        ? { expected: { fields: this.output.owned(fields), revision: this.output.revision(entry), marker: null } }
        : {}),
    };
  }

  private async sales(event: AttioEvent, receivedAt: string) {
    const sales = this.config.sales!;
    if (event.event_type !== 'list-entry.updated' || event.id.attribute_id !== sales.stage.id) return;
    const entry = await this.client.entry(event.id.entry_id!, sales.listId);
    const active = (field: typeof sales.stage) => {
      const values = (entry.entry_values[field.slug] ?? entry.entry_values[field.id] ?? []).filter(
        value => value.active_until === null,
      );
      return values.length === 1 ? values[0] : undefined;
    };
    const value = active(sales.stage);
    const history = (await this.client.history(entry.id.entry_id, sales.stage.id, sales.listId)).filter(
      item => item.active_until === null,
    );
    if (
      !value ||
      history.length !== 1 ||
      digestValue(history[0]) !== digestValue(value) ||
      Date.parse(value.active_from) > Date.parse(receivedAt)
    )
      throw new ReviewConflictError('Sales value changed');
    const option = value.status?.id.status_id ?? value.option?.id.option_id;
    const outcome = option === sales.wonOptionId ? 'won' : option === sales.lostOptionId ? 'lost' : undefined;
    if (!outcome) return;
    const assessmentId = z.uuid().parse(active(sales.assessmentId)?.value);
    const cycleId = z.uuid().parse(active(sales.cycleId)?.value);
    const cycle = await this.store.reviews.get(cycleId);
    if (!cycle || cycle.state !== 'applied' || cycle.assessmentId !== assessmentId)
      throw new ReviewConflictError('Sales assessment is not applied');
    const semanticId = digestValue({ entry: entry.id, assessmentId, cycleId, outcome, at: value.active_from });
    await this.store.client.execute({
      sql: 'INSERT OR IGNORE INTO lead_sales_outcomes(event_id,assessment_id,cycle_id,outcome,occurred_at) VALUES(?,?,?,?,?)',
      args: [semanticId, assessmentId, cycleId, outcome, value.active_from],
    });
    return cycleId;
  }
}
