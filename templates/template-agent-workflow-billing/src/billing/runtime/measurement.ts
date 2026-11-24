import type { LanguageModelUsage } from '@mastra/core/stream';
import { BillingError, quantitySchema } from '../contracts/core.js';
import type { AdmissionIdentity, ExecutorOutcome, ResourceConfiguration } from './accounting.js';
import type { AccountingStorage } from '../storage/accounting.js';
import type { WorkflowStorage } from '../storage/workflows.js';
type Measurement = NonNullable<ExecutorOutcome['measurements']>[number];

export class MeasurementCollector {
  private call = 0;
  private steps = 0;
  private observed = 0;
  private reservedCalls = 0;
  private expired = false;
  complete = true;
  overflow = false;
  captureFailed = false;
  readonly controller = new AbortController();
  constructor(
    readonly executionId: string,
    readonly segment: number,
    readonly identity: AdmissionIdentity,
    readonly resource: ResourceConfiguration,
    private readonly storage: AccountingStorage,
    private readonly workflows: WorkflowStorage,
    private readonly workflow: boolean,
    private readonly cancel?: () => Promise<void>,
    private readonly initialUnits = 0,
    readonly agentDependencies?: readonly string[],
    readonly artifactSlots?: number,
  ) {
    this.observed = initialUnits;
  }
  async runWithinDeadline<T>(
    deadline: number | null,
    dispatch: () => Promise<T>,
  ): Promise<{ status: 'finished'; value: T } | { status: 'expired_before_dispatch' | 'expired_during_execution' }> {
    if (deadline === null) return { status: 'finished', value: await dispatch() };
    const remaining = deadline - Date.now();
    if (remaining <= 0) return { status: 'expired_before_dispatch' };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expire = () => {
      if (!this.expired) {
        // The native operation may ignore cancellation or have reached an
        // external service. Preserve uncertainty until termination is known.
        this.expired = true;
        this.controller.abort();
        if (this.cancel) void this.cancel().catch(() => {});
      }
      return { status: 'expired_during_execution' as const };
    };
    const expiry = new Promise<{ status: 'expired_during_execution' }>(resolve => {
      timer = setTimeout(() => resolve(expire()), remaining);
    });
    try {
      return await Promise.race([
        dispatch().then(value => (Date.now() >= deadline ? expire() : { status: 'finished' as const, value })),
        expiry,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  get deadlineExpired() {
    return this.expired;
  }

  get workflowVersion() {
    return this.workflow ? this.segment : undefined;
  }

  nextCall(maxSteps: number) {
    const charge = this.resource.policy.charge;
    if (
      charge.type === 'usage' &&
      charge.measure === 'model-calls' &&
      this.initialUnits + this.reservedCalls + maxSteps > charge.maxUnits
    ) {
      this.overflow = true;
      this.controller.abort();
      throw new BillingError('conflict');
    }
    this.reservedCalls += maxSteps;
    return ++this.call;
  }
  get callCount() {
    return this.call;
  }
  get stepCount() {
    return this.steps;
  }
  async missing() {
    if (this.expired) return;
    this.complete = false;
    if (this.workflow) await this.workflows.incomplete(this.executionId, this.segment);
  }
  async capture(call: number, step: number, usage: LanguageModelUsage) {
    if (this.expired) return;
    this.steps++;
    const numeric = (value: unknown) => quantitySchema.safeParse(value);
    const input = numeric(usage.inputTokens),
      output = numeric(usage.outputTokens),
      total = numeric(usage.totalTokens);
    const coherent =
      input.success &&
      output.success &&
      total.success &&
      BigInt(input.data) + BigInt(output.data) === BigInt(total.data);
    const values: Record<string, number | undefined> = {
      'input-tokens': input.success ? input.data : undefined,
      'output-tokens': output.success ? output.data : undefined,
      tokens: coherent ? total.data : undefined,
      'model-calls': 1,
    };
    const observations: Measurement[] = [];
    for (const measure of this.resource.measurements) {
      const units = values[measure.key];
      if (units !== undefined)
        observations.push({
          id: `segment:${this.segment}:call:${call}:step:${step}:${measure.key}`,
          measure: measure.key,
          units,
        });
    }
    try {
      await this.storage.capture(this.executionId, observations);
      const charge = this.resource.policy.charge;
      if (charge.type !== 'usage' && this.resource.measurements.some(measure => values[measure.key] === undefined))
        await this.missing();
      if (charge.type === 'usage') {
        const units = values[charge.measure];
        if (units === undefined) await this.missing();
        else {
          this.observed += units;
          if (!Number.isSafeInteger(this.observed) || this.observed > charge.maxUnits) {
            this.overflow = true;
            this.controller.abort();
            await this.cancel?.();
          }
        }
      }
    } catch (error) {
      this.captureFailed = true;
      this.controller.abort();
      throw error;
    }
  }
}
