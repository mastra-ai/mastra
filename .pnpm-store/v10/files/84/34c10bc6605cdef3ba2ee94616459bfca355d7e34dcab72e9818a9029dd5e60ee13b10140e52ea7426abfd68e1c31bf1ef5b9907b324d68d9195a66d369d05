import { Unsubscribe } from "../../types";
import { BaseSubject } from "./BaseSubject";
import {
  NestedSubscribable,
  Subscribable,
  SubscribableWithState,
} from "./Subscribable";

export class NestedSubscriptionSubject<
    TState extends Subscribable | undefined,
    TPath,
  >
  extends BaseSubject
  implements
    SubscribableWithState<TState, TPath>,
    NestedSubscribable<TState, TPath>
{
  public get path() {
    return this.binding.path;
  }

  constructor(private binding: NestedSubscribable<TState, TPath>) {
    super();
  }

  public getState() {
    return this.binding.getState();
  }

  public outerSubscribe(callback: () => void) {
    return this.binding.subscribe(callback);
  }

  protected _connect(): Unsubscribe {
    const callback = () => {
      this.notifySubscribers();
    };

    let lastState = this.binding.getState();
    let innerUnsubscribe = lastState?.subscribe(callback);
    const onRuntimeUpdate = () => {
      const newState = this.binding.getState();
      if (newState === lastState) return;
      lastState = newState;

      innerUnsubscribe?.();
      innerUnsubscribe = this.binding.getState()?.subscribe(callback);

      callback();
    };

    const outerUnsubscribe = this.outerSubscribe(onRuntimeUpdate);
    return () => {
      outerUnsubscribe?.();
      innerUnsubscribe?.();
    };
  }
}
