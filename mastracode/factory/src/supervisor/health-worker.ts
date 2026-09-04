import { MastraWorker } from '@mastra/core/worker';

import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { runFactoryHealthCheck } from './health.js';

export const DEFAULT_SUPERVISOR_HEALTH_INTERVAL_MS = 5 * 60_000;

export class FactorySupervisorHealthWorker extends MastraWorker {
  readonly name = 'factory-supervisor-health';

  readonly #projects: FactoryProjectsStorage;
  readonly #workItems: WorkItemsStorage;
  readonly #intervalMs: number;
  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #inFlight: Promise<void> | undefined;

  constructor(input: { projects: FactoryProjectsStorage; workItems: WorkItemsStorage; intervalMs?: number }) {
    super();
    this.#projects = input.projects;
    this.#workItems = input.workItems;
    this.#intervalMs = input.intervalMs ?? DEFAULT_SUPERVISOR_HEALTH_INTERVAL_MS;
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('FactorySupervisorHealthWorker: call init() before start()');
    this.#running = true;
    this.#schedule(0);
  }

  async stop(): Promise<void> {
    this.#running = false;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    await this.#inFlight;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  #schedule(delayMs: number): void {
    if (!this.#running) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#inFlight = this.#tick()
        .catch(error => this.deps?.logger.error('Factory supervisor health sweep failed', { error }))
        .finally(() => {
          this.#inFlight = undefined;
          this.#schedule(this.#intervalMs);
        });
    }, delayMs);
    this.#timer.unref?.();
  }

  async #tick(): Promise<void> {
    const now = new Date();
    const projects = await this.#projects.listAll();
    const concurrency = 4;
    let nextIndex = 0;
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(concurrency, projects.length) }, async () => {
        while (nextIndex < projects.length) {
          const project = projects[nextIndex++];
          if (!project) return;
          const report = await runFactoryHealthCheck(
            this.#workItems,
            { orgId: project.orgId, factoryProjectId: project.id },
            { now },
          );
          await this.#workItems.syncSupervisorFindings({
            orgId: project.orgId,
            factoryProjectId: project.id,
            findings: report.findings,
            now,
          });
        }
      }),
    );
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
}
