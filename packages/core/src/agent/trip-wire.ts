export class TripWire extends Error {
  constructor(reason: string) {
    super(reason);

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
