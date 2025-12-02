/**
 * Type definition for event handler functions
 */
type EventHandler<Events extends Record<string, unknown>, Key extends keyof Events> = (payload: Events[Key]) => void;
/**
 * @interface
 * Strongly-typed event bus interface that enables type-safe publish/subscribe patterns
 */
type EventBus<Events extends Record<string, unknown>> = {
    /**
     * Subscribe to an event
     *
     * @param event - The event name to subscribe to
     * @param handler - The callback function to execute when the event is dispatched
     * @param opts - Optional configuration
     * @param opts.notify - If true and the event was previously dispatched, handler will be called immediately with the latest payload
     * @returns void
     */
    on: <Event extends keyof Events>(event: Event, handler: EventHandler<Events, Event>, opts?: {
        notify?: boolean;
    }) => void;
    /**
     * Subscribe to an event with pre-dispatch priority
     * Pre-dispatch handlers are called before regular event handlers when an event is dispatched
     *
     * @param event - The event name to subscribe to
     * @param handler - The callback function to execute when the event is dispatched
     * @returns void
     */
    prioritizedOn: <Event extends keyof Events>(event: Event, handler: EventHandler<Events, Event>) => void;
    /**
     * Publish an event with a payload
     * Triggers all registered handlers for the event
     *
     * @param event - The event name to publish
     * @param payload - The data to pass to event handlers
     * @returns void
     */
    emit: <Event extends keyof Events>(event: Event, payload: Events[Event]) => void;
    /**
     * Unsubscribe from an event
     *
     * @param event - The event name to unsubscribe from
     * @param handler - Optional specific handler to remove. If omitted, all handlers for the event are removed
     * @returns void
     */
    off: <Event extends keyof Events>(event: Event, handler?: EventHandler<Events, Event>) => void;
    /**
     * Unsubscribe from a pre-dispatch event
     *
     * @param event - The event name to unsubscribe from
     * @param handler - Optional specific handler to remove. If omitted, all pre-dispatch handlers for the event are removed
     * @returns void
     */
    prioritizedOff: <Event extends keyof Events>(event: Event, handler?: EventHandler<Events, Event>) => void;
    /**
     * Internal utilities for the event bus
     */
    internal: {
        /**
         * Retrieve all listeners for a specific event
         *
         * @param event - The event name to get listeners for
         * @returns Array of handler functions
         */
        retrieveListeners: <Event extends keyof Events>(event: Event) => Array<(...args: any[]) => void>;
    };
};
/**
 * A ES6/2015 compatible 300 byte event bus
 *
 * Creates a strongly-typed event bus that enables publish/subscribe communication between components.
 *
 * @template Events - A record type that maps event names to their payload types
 * @returns An EventBus instance with the following methods:
 * - `on`: Subscribe to an event
 * - `onPreDispatch`: Subscribe to an event, triggered before regular subscribers
 * - `emit`: Publish an event with payload
 * - `off`: Unsubscribe from an event
 * - `offPreDispatch`: Unsubscribe from a pre-dispatch event
 *
 * @example
 * // Define event types
 * const eventBus = createEventBus<{
 *   'user-login': { userId: string; timestamp: number };
 *   'data-updated': { records: any[] };
 *   'error': Error;
 * }>();
 *
 * // Subscribe to events
 * eventBus.on('user-login', ({ userId, timestamp }) => {
 *   console.log(`User ${userId} logged in at ${timestamp}`);
 * });
 *
 * // Subscribe with immediate notification if event was already dispatched
 * eventBus.on('user-login', (payload) => {
 *   // This will be called immediately if 'user-login' was previously dispatched
 * }, { notify: true });
 *
 * // Publish an event
 * eventBus.emit('user-login', { userId: 'abc123', timestamp: Date.now() });
 *
 * // Unsubscribe from event
 * const handler = (payload) => console.log(payload);
 * eventBus.on('error', handler);
 * // Later...
 * eventBus.off('error', handler);
 *
 * // Unsubscribe all handlers for an event
 * eventBus.off('data-updated');
 */
declare const createEventBus: <Events extends Record<string, unknown>>() => EventBus<Events>;

export { createEventBus };
