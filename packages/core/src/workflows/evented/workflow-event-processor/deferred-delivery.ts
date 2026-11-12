/**
 * Thrown when a delivery waiting for another worker's step or sleep lease
 * gives up because this process is shutting down. The delivery is handed back
 * to the transport for another instance, and this processor does not record it
 * as a failed attempt. The transport still counts the delivery; once that
 * count exhausts the budget while the step's holder runs it, the delivery is
 * dropped instead of failing the run.
 */
export class DeferredDelivery extends Error {
  constructor() {
    super('Deferred a workflow step delivery while shutting down');
    this.name = 'DeferredDelivery';
  }
}
