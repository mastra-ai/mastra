import { Unsubscribe } from "../../types";

export type Subscribable = {
  subscribe: (callback: () => void) => Unsubscribe;
};

export type SubscribableWithState<TState, TPath> = Subscribable & {
  path: TPath;
  getState: () => TState;
};

export type NestedSubscribable<
  TState extends Subscribable | undefined,
  TPath,
> = SubscribableWithState<TState, TPath>;

export type EventSubscribable<TEvent extends string> = {
  event: TEvent;
  binding: SubscribableWithState<
    | {
        unstable_on: (event: TEvent, callback: () => void) => Unsubscribe;
      }
    | undefined,
    unknown
  >;
};
