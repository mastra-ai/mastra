import type { Event, EventCallback } from './types';

const LOCAL_WORKFLOW_OWNER = Symbol('local workflow owner');
const workerOwners = new WeakMap<EventCallback, object>();

type LocalWorkflowEvent = { [LOCAL_WORKFLOW_OWNER]?: object };

export function pinLocalWorkflowEvent(event: Omit<Event, 'id' | 'createdAt'>, owner: object) {
  return { ...event, [LOCAL_WORKFLOW_OWNER]: owner };
}

export function registerLocalWorkflowWorker(callback: EventCallback, owner: object) {
  workerOwners.set(callback, owner);
}

export function canHandleLocalWorkflowEvent(event: Event & LocalWorkflowEvent, owner: object): boolean {
  return !event[LOCAL_WORKFLOW_OWNER] || event[LOCAL_WORKFLOW_OWNER] === owner;
}

// Observers still see the event. Only workflow workers compete for its execution.
export function canDeliverLocalWorkflowEvent(event: Event, callback: EventCallback): boolean {
  const owner = workerOwners.get(callback);
  return !owner || canHandleLocalWorkflowEvent(event, owner);
}
