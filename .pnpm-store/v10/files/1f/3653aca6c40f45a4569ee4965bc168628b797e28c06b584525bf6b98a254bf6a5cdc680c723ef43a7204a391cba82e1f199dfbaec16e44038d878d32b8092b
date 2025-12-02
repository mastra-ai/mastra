import * as react_jsx_runtime from 'react/jsx-runtime';

declare const __internal_curr: unique symbol;
declare const __internal_error: unique symbol;
/**
 * StreamableValue is a value that can be streamed over the network via AI Actions.
 * To read the streamed values, use the `readStreamableValue` or `useStreamableValue` APIs.
 */
type StreamableValue<T = any, E = any> = {
    [__internal_curr]?: T;
    [__internal_error]?: E;
};

/**
 * `readStreamableValue` takes a streamable value created via the `createStreamableValue().value` API,
 * and returns an async iterator.
 *
 * ```js
 * // Inside your AI action:
 *
 * async function action() {
 *   'use server'
 *   const streamable = createStreamableValue();
 *
 *   streamable.update(1);
 *   streamable.update(2);
 *   streamable.done(3);
 *   // ...
 *   return streamable.value;
 * }
 * ```
 *
 * And to read the value:
 *
 * ```js
 * const streamableValue = await action()
 * for await (const v of readStreamableValue(streamableValue)) {
 *   console.log(v)
 * }
 * ```
 *
 * This logs out 1, 2, 3 on console.
 */
declare function readStreamableValue<T = unknown>(streamableValue: StreamableValue<T>): AsyncIterable<T | undefined>;

/**
 * `useStreamableValue` is a React hook that takes a streamable value created via the `createStreamableValue().value` API,
 * and returns the current value, error, and pending state.
 *
 * This is useful for consuming streamable values received from a component's props. For example:
 *
 * ```js
 * function MyComponent({ streamableValue }) {
 *   const [data, error, pending] = useStreamableValue(streamableValue);
 *
 *   if (pending) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return <div>Data: {data}</div>;
 * }
 * ```
 */
declare function useStreamableValue<T = unknown, Error = unknown>(streamableValue?: StreamableValue<T>): [data: T | undefined, error: Error | undefined, pending: boolean];

type ServerWrappedAction<T = unknown> = (aiState: T, ...args: unknown[]) => Promise<[Promise<T>, unknown]>;
type ServerWrappedActions<T = unknown> = Record<string, ServerWrappedAction<T>>;
type InternalAIProviderProps<AIState = any, UIState = any> = {
    children: React.ReactNode;
    initialUIState: UIState;
    initialAIState: AIState;
    initialAIStatePatch: undefined | Promise<AIState>;
    wrappedActions: ServerWrappedActions<AIState>;
    wrappedSyncUIState?: ServerWrappedAction<AIState>;
};
type AIProviderProps<AIState = any, UIState = any, Actions = any> = {
    children: React.ReactNode;
    initialAIState?: AIState;
    initialUIState?: UIState;
    /** $ActionTypes is only added for type inference and is never used at runtime **/
    $ActionTypes?: Actions;
};
type AIProvider<AIState = any, UIState = any, Actions = any> = (props: AIProviderProps<AIState, UIState, Actions>) => Promise<React.ReactElement>;
type InferAIState<T, Fallback> = T extends AIProvider<infer AIState, any, any> ? AIState : Fallback;
type InferUIState<T, Fallback> = T extends AIProvider<any, infer UIState, any> ? UIState : Fallback;
type InferActions<T, Fallback> = T extends AIProvider<any, any, infer Actions> ? Actions : Fallback;
type ValueOrUpdater<T> = T | ((current: T) => T);

declare function InternalAIProvider({ children, initialUIState, initialAIState, initialAIStatePatch, wrappedActions, wrappedSyncUIState, }: InternalAIProviderProps): react_jsx_runtime.JSX.Element;
declare function useUIState<AI extends AIProvider = any>(): [InferUIState<AI, any>, (v: InferUIState<AI, any> | ((v_: InferUIState<AI, any>) => InferUIState<AI, any>)) => void];
declare function useAIState<AI extends AIProvider = any>(): [
    InferAIState<AI, any>,
    (newState: ValueOrUpdater<InferAIState<AI, any>>) => void
];
declare function useAIState<AI extends AIProvider = any>(key: keyof InferAIState<AI, any>): [
    InferAIState<AI, any>[typeof key],
    (newState: ValueOrUpdater<InferAIState<AI, any>[typeof key]>) => void
];
declare function useActions<AI extends AIProvider = any>(): InferActions<AI, any>;
declare function useSyncUIState(): () => Promise<void>;

export { InternalAIProvider, readStreamableValue, useAIState, useActions, useStreamableValue, useSyncUIState, useUIState };
