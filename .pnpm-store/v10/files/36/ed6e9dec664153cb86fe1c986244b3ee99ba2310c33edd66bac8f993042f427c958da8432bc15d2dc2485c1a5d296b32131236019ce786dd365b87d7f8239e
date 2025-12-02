import { BaseSubject } from "./BaseSubject";
import { SKIP_UPDATE } from "./SKIP_UPDATE";
import { SubscribableWithState } from "./Subscribable";

export class LazyMemoizeSubject<TState extends object, TPath>
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
  }

  private _previousStateDirty = true;
  private _previousState: TState | undefined;
  public getState = () => {
    if (!this.isConnected || this._previousStateDirty) {
      const newState = this.binding.getState();
      if (newState !== SKIP_UPDATE) {
        this._previousState = newState;
      }
      this._previousStateDirty = false;
    }
    if (this._previousState === undefined)
      throw new Error("Entry not available in the store");
    return this._previousState;
  };

  protected _connect() {
    const callback = () => {
      this._previousStateDirty = true;
      this.notifySubscribers();
    };

    return this.binding.subscribe(callback);
  }
}
