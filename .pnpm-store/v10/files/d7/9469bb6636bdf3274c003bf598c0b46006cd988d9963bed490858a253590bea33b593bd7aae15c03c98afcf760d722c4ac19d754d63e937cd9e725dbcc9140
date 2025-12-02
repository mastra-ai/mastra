import { shallowEqual } from "./shallowEqual";
import { BaseSubject } from "./BaseSubject";
import { SubscribableWithState } from "./Subscribable";
import { SKIP_UPDATE } from "./SKIP_UPDATE";

export class ShallowMemoizeSubject<TState extends object, TPath>
  extends BaseSubject
  implements SubscribableWithState<TState, TPath>
{
  public get path() {
    return this.binding.path;
  }

  constructor(
    private binding: SubscribableWithState<TState | SKIP_UPDATE, TPath>,
  ) {
    super();
    const state = binding.getState();
    if (state === SKIP_UPDATE)
      throw new Error("Entry not available in the store");
    this._previousState = state;
  }

  private _previousState: TState;
  public getState = () => {
    if (!this.isConnected) this._syncState();
    return this._previousState;
  };

  private _syncState() {
    const state = this.binding.getState();
    if (state === SKIP_UPDATE) return false;
    if (shallowEqual(state, this._previousState)) return false;
    this._previousState = state;
    return true;
  }

  protected _connect() {
    const callback = () => {
      if (this._syncState()) {
        this.notifySubscribers();
      }
    };

    return this.binding.subscribe(callback);
  }
}
