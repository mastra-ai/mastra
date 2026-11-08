import type { LanguageModelUsage } from '@mastra/core/stream';
import { BillingError, quantitySchema } from './contracts.js';
import type { AdmissionIdentity, ExecutorOutcome, ResourceConfiguration } from './accounting.js';
import type { AccountingStorage } from './storage/accounting.js';
import type { WorkflowStorage } from './storage/workflows.js';
type Measurement = NonNullable<ExecutorOutcome['measurements']>[number];

export class MeasurementCollector {
  private call = 0;
  private steps = 0;
  private observed = 0;
  private reservedCalls = 0;
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
    initialUnits = 0,
    readonly agentDependencies?: readonly string[],
  ) {
    this.observed = initialUnits;
  }
  nextCall(maxSteps: number) {
    const charge = this.resource.policy.charge;
    if (
      charge.type === 'usage' &&
      charge.measure === 'model-calls' &&
      this.reservedCalls + maxSteps > charge.maxUnits
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
    this.complete = false;
    if (this.workflow) await this.workflows.incomplete(this.executionId);
  }
  async capture(call: number, step: number, usage: LanguageModelUsage) {
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
