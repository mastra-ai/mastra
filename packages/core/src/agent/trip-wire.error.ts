/**
 * TripWire error class - used to signal that a processor has blocked content
 * Extracted to avoid circular dependencies between agent and stream modules
 */
export class TripWire extends Error {
  constructor(reason: string) {
    super(reason);

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
