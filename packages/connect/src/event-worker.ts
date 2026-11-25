import type { IMastraLogger } from '@mastra/core/logger';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerStopOptions } from '@mastra/core/worker';
import type { Workflow } from '@mastra/core/workflows';

import { selectsConnectEvent } from './event-filter.js';
import type { ConnectEventFilter, FilteredConnectEvent } from './event-filter.js';
import { selectedConnectEvents } from './events.js';
import type { ConnectEvent, ConnectEventsOptions } from './events.js';

type MaybePromise<T> = T | Promise<T>;

/** A workflow whose input is `TInput`. */
type WorkflowWithInput<TInput> = Workflow<any, any, any, any, TInput, any, any, any>;

export interface ConnectEventTriggerOptions<
  F extends ConnectEventFilter | undefined = undefined,
  U extends boolean = false,
  TInput = unknown,
> {
  /** Which providers and event types start the workflow. Omit it to start it for every event. */
  events?: F;
  /** The workflow to start. It must be registered on the Mastra the worker runs on. */
  workflow: WorkflowWithInput<TInput>;
  /** The workflow's input for an event. Return `undefined` to skip the event. */
  inputData: (event: FilteredConnectEvent<F, U>) => MaybePromise<NoInfer<TInput> | undefined>;
  /**
   * Start the workflow for events whose signature the platform couldn't
   * verify. Their payloads may be forged, so they're skipped by default.
   */
  includeUnverified?: U;
}

/** A workflow started by Connect events. Create one with {@link onConnectEvent}. */
export interface ConnectEventTrigger {
  readonly events?: ConnectEventFilter;
  readonly workflow: WorkflowWithInput<any>;
  readonly inputData: (event: ConnectEvent) => MaybePromise<unknown>;
  readonly includeUnverified?: boolean;
}

/**
 * Starts `workflow` for the Connect events `events` selects. Pass it to
 * `ConnectEventWorker`'s `triggers`.
 *
 * @example
 * ```ts
 * onConnectEvent({
 *   events: { github: ['pull_request.opened'] },
 *   workflow: reviewPullRequest,
 *   inputData: event => ({ repo: event.payload.repository.full_name, number: event.payload.number }),
 * });
 * ```
 */
export function onConnectEvent<
  const F extends ConnectEventFilter | undefined = undefined,
  U extends boolean = false,
  TInput = unknown,
>(trigger: ConnectEventTriggerOptions<F, U, TInput>): ConnectEventTrigger {
  return trigger as unknown as ConnectEventTrigger;
}

interface RunnableTrigger {
  trigger: ConnectEventTrigger;
  /** The workflow registered on Mastra, which runs with its storage. */
  workflow: WorkflowWithInput<unknown>;
}

export interface ConnectEventWorkerOptions extends Omit<ConnectEventsOptions, 'events' | 'includeUnverified'> {
  /** The workflows to start, and the events that start them. */
  triggers: ConnectEventTrigger[];
}

/**
 * Starts workflows from provider events on a project's Connect connections.
 * Pass it to `new Mastra({ workers: [...] })`; it subscribes when Mastra
 * starts its workers.
 *
 * Each event starts a workflow once: the run id comes from the event, so a
 * redelivered webhook finds the run it already started and is skipped. Runs
 * get the event's `resourceId` when the connection belongs to an end user.
 *
 * @example
 * ```ts
 * const connectEvents = new ConnectEventWorker({
 *   triggers: [
 *     onConnectEvent({
 *       events: { linear: ['Issue.create'] },
 *       workflow: triageIssue,
 *       inputData: event => ({ issueId: event.payload.data.id }),
 *     }),
 *   ],
 * });
 *
 * export const mastra = new Mastra({ workflows: { triageIssue }, workers: [connectEvents] });
 * ```
 */
export class ConnectEventWorker extends MastraWorker {
  readonly name = 'connect-events';

  readonly #options: ConnectEventWorkerOptions;
  #events?: ReturnType<typeof selectedConnectEvents>;
  #delivery?: Promise<void>;

  constructor(options: ConnectEventWorkerOptions) {
    super();
    this.#options = options;
  }

  get isRunning(): boolean {
    return this.#events !== undefined;
  }

  /** Subscribes to the project's Connect events. Called when Mastra starts its workers. */
  async start(): Promise<void> {
    if (this.#events) return;
    const { triggers, ...eventsOptions } = this.#options;
    const runnable: RunnableTrigger[] = [];
    for (const trigger of triggers) {
      const workflow = this.#registered(trigger);
      if (workflow) runnable.push({ trigger, workflow });
      else {
        this.#logger.error(
          `Connect event worker: workflow "${trigger.workflow.id}" isn't registered on this Mastra, so Connect events won't start it`,
        );
      }
    }
    if (runnable.length === 0) return;

    let events: ReturnType<typeof selectedConnectEvents>;
    try {
      // Each trigger picks its own events, so the subscription takes any event one of them selects.
      events = selectedConnectEvents(eventsOptions, event =>
        runnable.some(({ trigger }) => selectsConnectEvent(trigger, event)),
      );
    } catch (error) {
      this.#logger.error('Connect event worker could not subscribe', { error });
      return;
    }
    this.#events = events;
    this.#delivery = this.#deliver(events, runnable);
  }

  /**
   * Ends the subscription and waits for the event being handled, up to
   * `drainTimeout` ms. Workflows already started keep running.
   */
  async stop(options?: WorkerStopOptions): Promise<void> {
    const events = this.#events;
    const delivery = this.#delivery;
    this.#events = undefined;
    this.#delivery = undefined;
    events?.close();
    if (!delivery) return;
    if (options?.drainTimeout === undefined) return delivery;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([delivery, new Promise<void>(resolve => (timer = setTimeout(resolve, options.drainTimeout)))]);
    clearTimeout(timer);
  }

  async #deliver(events: ReturnType<typeof selectedConnectEvents>, triggers: RunnableTrigger[]): Promise<void> {
    try {
      for await (const event of events) {
        for (const runnable of triggers) {
          await this.#trigger(runnable, event);
        }
      }
    } catch (error) {
      this.#logger.error('Connect event worker subscription ended', { error });
    } finally {
      if (this.#events === events) {
        this.#events = undefined;
        this.#delivery = undefined;
      }
    }
  }

  async #trigger({ trigger, workflow }: RunnableTrigger, event: ConnectEvent): Promise<void> {
    if (!selectsConnectEvent(trigger, event)) return;
    try {
      const inputData = await trigger.inputData(event);
      if (inputData === undefined) return;
      const run = await workflow.createRun({
        // Redelivered webhooks keep their source event id, so they reopen this run instead of starting another.
        runId: `connect:${workflow.id}:${event.provider}:${event.sourceEventId ?? event.id}`,
        resourceId: event.resourceId,
      });
      if (run.workflowRunStatus !== 'pending') return;
      await run.startAsync({ inputData });
    } catch (error) {
      // One event that can't start its workflow must not end the subscription.
      this.#logger.error('Connect event worker could not start a workflow', {
        error,
        workflowId: workflow.id,
        eventId: event.id,
        provider: event.provider,
        eventType: event.eventType,
      });
    }
  }

  #registered(trigger: ConnectEventTrigger): WorkflowWithInput<unknown> | undefined {
    const id = trigger.workflow.id;
    return Object.values(this.mastra?.listWorkflows() ?? {}).find(workflow => workflow.id === id);
  }

  get #logger(): Pick<IMastraLogger, 'error'> {
    return this.deps?.logger ?? this.mastra?.getLogger() ?? console;
  }
}
