import { Unsubscribe } from "../../types/Unsubscribe";

export abstract class BaseSubject {
  private _subscriptions = new Set<() => void>();
  private _connection: Unsubscribe | undefined;

  protected get isConnected() {
    return !!this._connection;
  }

  protected abstract _connect(): Unsubscribe;

  protected notifySubscribers() {
    for (const callback of this._subscriptions) callback();
  }

  private _updateConnection() {
    if (this._subscriptions.size > 0) {
      if (this._connection) return;
      this._connection = this._connect();
    } else {
      this._connection?.();
      this._connection = undefined;
    }
  }

  public subscribe(callback: () => void) {
    this._subscriptions.add(callback);
    this._updateConnection();

    return () => {
      this._subscriptions.delete(callback);
      this._updateConnection();
    };
  }
}
