import { Unsubscribe } from "../../types";

export class BaseSubscribable {
  private _subscribers = new Set<() => void>();

  public subscribe(callback: () => void): Unsubscribe {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  public waitForUpdate() {
    return new Promise<void>((resolve) => {
      const unsubscribe = this.subscribe(() => {
        unsubscribe();
        resolve();
      });
    });
  }

  protected _notifySubscribers() {
    const errors = [];
    for (const callback of this._subscribers) {
      try {
        callback();
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      if (errors.length === 1) {
        throw errors[0];
      } else {
        throw new AggregateError(errors);
      }
    }
  }
}
