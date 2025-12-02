import { BaseSubscribable } from "./BaseSubscribable";

type Transform<TState, TResult> = {
  execute: () => Promise<TResult>;

  /** transform the state after the promise resolves */
  then?: (state: TState, result: TResult) => TState;

  /** transform the state during resolution and afterwards */
  optimistic?: (state: TState) => TState;

  /** transform the state only while loading */
  loading?: (state: TState, task: Promise<TResult>) => TState;
};

type PendingTransform<TState, TResult> = Transform<TState, TResult> & {
  task: Promise<TResult>;
};

const pipeTransforms = <TState, TExtra>(
  initialState: TState,
  extraParam: TExtra,
  transforms: (((state: TState, extra: TExtra) => TState) | undefined)[],
): TState => {
  return transforms.reduce((state, transform) => {
    return transform?.(state, extraParam) ?? state;
  }, initialState);
};

export class OptimisticState<TState> extends BaseSubscribable {
  private readonly _pendingTransforms: Array<PendingTransform<TState, any>> =
    [];
  private _baseValue: TState;
  private _cachedValue: TState;

  public constructor(initialState: TState) {
    super();
    this._baseValue = initialState;
    this._cachedValue = initialState;
  }

  private _updateState(): void {
    this._cachedValue = this._pendingTransforms.reduce((state, transform) => {
      return pipeTransforms(state, transform.task, [
        transform.loading,
        transform.optimistic,
      ]);
    }, this._baseValue);

    this._notifySubscribers();
  }

  public get baseValue(): TState {
    return this._baseValue;
  }

  public get value(): TState {
    return this._cachedValue;
  }

  public update(state: TState): void {
    this._baseValue = state;
    this._updateState();
  }

  public async optimisticUpdate<TResult>(
    transform: Transform<TState, TResult>,
  ): Promise<TResult> {
    const task = transform.execute();
    const pendingTransform = { ...transform, task };
    try {
      this._pendingTransforms.push(pendingTransform);
      this._updateState();

      const result = await task;
      this._baseValue = pipeTransforms(this._baseValue, result, [
        transform.optimistic,
        transform.then,
      ]);
      return result;
    } finally {
      const index = this._pendingTransforms.indexOf(pendingTransform);
      if (index > -1) {
        this._pendingTransforms.splice(index, 1);
      }
      this._updateState();
    }
  }
}
