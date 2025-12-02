import * as React from 'react';
import { MemoExoticComponent, ForwardRefExoticComponent, Context, ReactNode, ComponentType, ComponentClass, ClassAttributes, JSX, FunctionComponent } from 'react';
import { Action, UnknownAction, Store, Dispatch } from 'redux';

/**
 * Copyright 2015, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

declare const REACT_STATICS: {
    readonly childContextTypes: true;
    readonly contextType: true;
    readonly contextTypes: true;
    readonly defaultProps: true;
    readonly displayName: true;
    readonly getDefaultProps: true;
    readonly getDerivedStateFromError: true;
    readonly getDerivedStateFromProps: true;
    readonly mixins: true;
    readonly propTypes: true;
    readonly type: true;
};
declare const KNOWN_STATICS: {
    readonly name: true;
    readonly length: true;
    readonly prototype: true;
    readonly caller: true;
    readonly callee: true;
    readonly arguments: true;
    readonly arity: true;
};
declare const FORWARD_REF_STATICS: {
    readonly $$typeof: true;
    readonly render: true;
    readonly defaultProps: true;
    readonly displayName: true;
    readonly propTypes: true;
};
declare const MEMO_STATICS: {
    readonly $$typeof: true;
    readonly compare: true;
    readonly defaultProps: true;
    readonly displayName: true;
    readonly propTypes: true;
    readonly type: true;
};
type NonReactStatics<Source, C extends {
    [key: string]: true;
} = {}> = {
    [key in Exclude<keyof Source, Source extends MemoExoticComponent<any> ? keyof typeof MEMO_STATICS | keyof C : Source extends ForwardRefExoticComponent<any> ? keyof typeof FORWARD_REF_STATICS | keyof C : keyof typeof REACT_STATICS | keyof typeof KNOWN_STATICS | keyof C>]: Source[key];
};

type VoidFunc = () => void;
type Listener = {
    callback: VoidFunc;
    next: Listener | null;
    prev: Listener | null;
};
declare function createListenerCollection(): {
    clear(): void;
    notify(): void;
    get(): Listener[];
    subscribe(callback: () => void): () => void;
};
type ListenerCollection = ReturnType<typeof createListenerCollection>;
interface Subscription {
    addNestedSub: (listener: VoidFunc) => VoidFunc;
    notifyNestedSubs: VoidFunc;
    handleChangeWrapper: VoidFunc;
    isSubscribed: () => boolean;
    onStateChange?: VoidFunc | null;
    trySubscribe: VoidFunc;
    tryUnsubscribe: VoidFunc;
    getListeners: () => ListenerCollection;
}

interface ProviderProps<A extends Action<string> = UnknownAction, S = unknown> {
    /**
     * The single Redux store in your application.
     */
    store: Store<S, A>;
    /**
     * An optional server state snapshot. Will be used during initial hydration render if available, to ensure that the UI output is consistent with the HTML generated on the server.
     */
    serverState?: S;
    /**
     * Optional context to be used internally in react-redux. Use React.createContext() to create a context to be used.
     * If this is used, you'll need to customize `connect` by supplying the same context provided to the Provider.
     * Set the initial value to null, and the hooks will error
     * if this is not overwritten by Provider.
     */
    context?: Context<ReactReduxContextValue<S, A> | null>;
    /**
     * Determines the frequency of stability checks for all selectors.
     * This setting overrides the global configuration for
     * the `useSelector` stability check, allowing you to specify how often
     * these checks should occur in development mode.
     *
     * @since 8.1.0
     */
    stabilityCheck?: DevModeCheckFrequency;
    /**
     * Determines the frequency of identity function checks for all selectors.
     * This setting overrides the global configuration for
     * the `useSelector` identity function check, allowing you to specify how often
     * these checks should occur in development mode.
     *
     * **Note**: Previously referred to as `noopCheck`.
     *
     * @since 9.0.0
     */
    identityFunctionCheck?: DevModeCheckFrequency;
    children: ReactNode;
}
declare function Provider<A extends Action<string> = UnknownAction, S = unknown>(providerProps: ProviderProps<A, S>): React.JSX.Element;

interface ReactReduxContextValue<SS = any, A extends Action<string> = UnknownAction> extends Pick<ProviderProps, 'stabilityCheck' | 'identityFunctionCheck'> {
    store: Store<SS, A>;
    subscription: Subscription;
    getServerState?: () => SS;
}
declare const ReactReduxContext: Context<ReactReduxContextValue<any, UnknownAction> | null>;
type ReactReduxContextInstance = typeof ReactReduxContext;

/**
 * The frequency of development mode checks.
 *
 * @since 8.1.0
 * @internal
 */
type DevModeCheckFrequency = 'never' | 'once' | 'always';
/**
 * Represents the configuration for development mode checks.
 *
 * @since 9.0.0
 * @internal
 */
interface DevModeChecks {
    /**
     * Overrides the global stability check for the selector.
     * - `once` - Run only the first time the selector is called.
     * - `always` - Run every time the selector is called.
     * - `never` - Never run the stability check.
     *
     * @default 'once'
     *
     * @since 8.1.0
     */
    stabilityCheck: DevModeCheckFrequency;
    /**
     * Overrides the global identity function check for the selector.
     * - `once` - Run only the first time the selector is called.
     * - `always` - Run every time the selector is called.
     * - `never` - Never run the identity function check.
     *
     * **Note**: Previously referred to as `noopCheck`.
     *
     * @default 'once'
     *
     * @since 9.0.0
     */
    identityFunctionCheck: DevModeCheckFrequency;
}
interface UseSelectorOptions<Selected = unknown> {
    equalityFn?: EqualityFn<Selected>;
    /**
     * `useSelector` performs additional checks in development mode to help
     * identify and warn about potential issues in selector behavior. This
     * option allows you to customize the behavior of these checks per selector.
     *
     * @since 9.0.0
     */
    devModeChecks?: Partial<DevModeChecks>;
}
/**
 * Represents a custom hook that allows you to extract data from the
 * Redux store state, using a selector function. The selector function
 * takes the current state as an argument and returns a part of the state
 * or some derived data. The hook also supports an optional equality
 * function or options object to customize its behavior.
 *
 * @template StateType - The specific type of state this hook operates on.
 *
 * @public
 */
interface UseSelector<StateType = unknown> {
    /**
     * A function that takes a selector function as its first argument.
     * The selector function is responsible for selecting a part of
     * the Redux store's state or computing derived data.
     *
     * @param selector - A function that receives the current state and returns a part of the state or some derived data.
     * @param equalityFnOrOptions - An optional equality function or options object for customizing the behavior of the selector.
     * @returns The selected part of the state or derived data.
     *
     * @template TState - The specific type of state this hook operates on.
     * @template Selected - The type of the value that the selector function will return.
     */
    <TState extends StateType = StateType, Selected = unknown>(selector: (state: TState) => Selected, equalityFnOrOptions?: EqualityFn<Selected> | UseSelectorOptions<Selected>): Selected;
    /**
     * Creates a "pre-typed" version of {@linkcode useSelector useSelector}
     * where the `state` type is predefined.
     *
     * This allows you to set the `state` type once, eliminating the need to
     * specify it with every {@linkcode useSelector useSelector} call.
     *
     * @returns A pre-typed `useSelector` with the state type already defined.
     *
     * @example
     * ```ts
     * export const useAppSelector = useSelector.withTypes<RootState>()
     * ```
     *
     * @template OverrideStateType - The specific type of state this hook operates on.
     *
     * @since 9.1.0
     */
    withTypes: <OverrideStateType extends StateType>() => UseSelector<OverrideStateType>;
}
/**
 * Hook factory, which creates a `useSelector` hook bound to a given context.
 *
 * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
 * @returns {Function} A `useSelector` hook bound to the specified context.
 */
declare function createSelectorHook(context?: React.Context<ReactReduxContextValue<any, any> | null>): UseSelector;
/**
 * A hook to access the redux store's state. This hook takes a selector function
 * as an argument. The selector is called with the store state.
 *
 * This hook takes an optional equality comparison function as the second parameter
 * that allows you to customize the way the selected state is compared to determine
 * whether the component needs to be re-rendered.
 *
 * @param {Function} selector the selector function
 * @param {Function=} equalityFn the function that will be used to determine equality
 *
 * @returns {any} the selected state
 *
 * @example
 *
 * import React from 'react'
 * import { useSelector } from 'react-redux'
 *
 * export const CounterComponent = () => {
 *   const counter = useSelector(state => state.counter)
 *   return <div>{counter}</div>
 * }
 */
declare const useSelector: UseSelector<unknown>;

type FixTypeLater = any;
type EqualityFn<T> = (a: T, b: T) => boolean;
type ExtendedEqualityFn<T, P> = (a: T, b: T, c: P, d: P) => boolean;
type AnyIfEmpty<T extends object> = keyof T extends never ? any : T;
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
interface DispatchProp<A extends Action<string> = UnknownAction> {
    dispatch: Dispatch<A>;
}
/**
 * A property P will be present if:
 * - it is present in DecorationTargetProps
 *
 * Its value will be dependent on the following conditions
 * - if property P is present in InjectedProps and its definition extends the definition
 *   in DecorationTargetProps, then its definition will be that of DecorationTargetProps[P]
 * - if property P is not present in InjectedProps then its definition will be that of
 *   DecorationTargetProps[P]
 * - if property P is present in InjectedProps but does not extend the
 *   DecorationTargetProps[P] definition, its definition will be that of InjectedProps[P]
 */
type Matching<InjectedProps, DecorationTargetProps> = {
    [P in keyof DecorationTargetProps]: P extends keyof InjectedProps ? InjectedProps[P] extends DecorationTargetProps[P] ? DecorationTargetProps[P] : InjectedProps[P] : DecorationTargetProps[P];
};
/**
 * a property P will be present if :
 * - it is present in both DecorationTargetProps and InjectedProps
 * - InjectedProps[P] can satisfy DecorationTargetProps[P]
 * ie: decorated component can accept more types than decorator is injecting
 *
 * For decoration, inject props or ownProps are all optionally
 * required by the decorated (right hand side) component.
 * But any property required by the decorated component must be satisfied by the injected property.
 */
type Shared<InjectedProps, DecorationTargetProps> = {
    [P in Extract<keyof InjectedProps, keyof DecorationTargetProps>]?: InjectedProps[P] extends DecorationTargetProps[P] ? DecorationTargetProps[P] : never;
};
type GetProps<C> = C extends ComponentType<infer P> ? C extends ComponentClass<P> ? ClassAttributes<InstanceType<C>> & P : P : never;
type GetLibraryManagedProps<C> = JSX.LibraryManagedAttributes<C, GetProps<C>>;
type ConnectedComponent<C extends ComponentType<any>, P> = FunctionComponent<P> & NonReactStatics<C> & {
    WrappedComponent: C;
};
type ConnectPropsMaybeWithoutContext<TActualOwnProps> = TActualOwnProps extends {
    context: any;
} ? Omit<ConnectProps, 'context'> : ConnectProps;
type Identity<T> = T;
type Mapped<T> = Identity<{
    [k in keyof T]: T[k];
}>;
type InferableComponentEnhancerWithProps<TInjectedProps, TNeedsProps> = <C extends ComponentType<Matching<TInjectedProps, GetProps<C>>>>(component: C) => ConnectedComponent<C, Mapped<DistributiveOmit<GetLibraryManagedProps<C>, keyof Shared<TInjectedProps, GetLibraryManagedProps<C>>> & TNeedsProps & ConnectPropsMaybeWithoutContext<TNeedsProps & GetProps<C>>>>;
type InferableComponentEnhancer<TInjectedProps> = InferableComponentEnhancerWithProps<TInjectedProps, {}>;
type InferThunkActionCreatorType<TActionCreator extends (...args: any[]) => any> = TActionCreator extends (...args: infer TParams) => (...args: any[]) => infer TReturn ? (...args: TParams) => TReturn : TActionCreator;
type HandleThunkActionCreator<TActionCreator> = TActionCreator extends (...args: any[]) => any ? InferThunkActionCreatorType<TActionCreator> : TActionCreator;
type ResolveThunks<TDispatchProps> = TDispatchProps extends {
    [key: string]: any;
} ? {
    [C in keyof TDispatchProps]: HandleThunkActionCreator<TDispatchProps[C]>;
} : TDispatchProps;
/**
 * This interface allows you to easily create a hook that is properly typed for your
 * store's root state.
 *
 * @example
 *
 * interface RootState {
 *   property: string;
 * }
 *
 * const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
 */
interface TypedUseSelectorHook<TState> {
    <TSelected>(selector: (state: TState) => TSelected, equalityFn?: EqualityFn<NoInfer<TSelected>>): TSelected;
    <Selected = unknown>(selector: (state: TState) => Selected, options?: UseSelectorOptions<Selected>): Selected;
}
type NoInfer<T> = [T][T extends any ? 0 : never];

type SelectorFactory<S, TProps, TOwnProps, TFactoryOptions> = (dispatch: Dispatch<Action<string>>, factoryOptions: TFactoryOptions) => Selector<S, TProps, TOwnProps>;
type Selector<S, TProps, TOwnProps = null> = TOwnProps extends null | undefined ? (state: S) => TProps : (state: S, ownProps: TOwnProps) => TProps;
type MapStateToProps<TStateProps, TOwnProps, State> = (state: State, ownProps: TOwnProps) => TStateProps;
type MapStateToPropsFactory<TStateProps, TOwnProps, State> = (initialState: State, ownProps: TOwnProps) => MapStateToProps<TStateProps, TOwnProps, State>;
type MapStateToPropsParam<TStateProps, TOwnProps, State> = MapStateToPropsFactory<TStateProps, TOwnProps, State> | MapStateToProps<TStateProps, TOwnProps, State> | null | undefined;
type MapDispatchToPropsFunction<TDispatchProps, TOwnProps> = (dispatch: Dispatch<Action<string>>, ownProps: TOwnProps) => TDispatchProps;
type MapDispatchToProps<TDispatchProps, TOwnProps> = MapDispatchToPropsFunction<TDispatchProps, TOwnProps> | TDispatchProps;
type MapDispatchToPropsFactory<TDispatchProps, TOwnProps> = (dispatch: Dispatch<Action<string>>, ownProps: TOwnProps) => MapDispatchToPropsFunction<TDispatchProps, TOwnProps>;
type MapDispatchToPropsParam<TDispatchProps, TOwnProps> = MapDispatchToPropsFactory<TDispatchProps, TOwnProps> | MapDispatchToProps<TDispatchProps, TOwnProps>;
type MapDispatchToPropsNonObject<TDispatchProps, TOwnProps> = MapDispatchToPropsFactory<TDispatchProps, TOwnProps> | MapDispatchToPropsFunction<TDispatchProps, TOwnProps>;
type MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps> = (stateProps: TStateProps, dispatchProps: TDispatchProps, ownProps: TOwnProps) => TMergedProps;

interface ConnectProps {
    /** A custom Context instance that the component can use to access the store from an alternate Provider using that same Context instance */
    context?: ReactReduxContextInstance;
    /** A Redux store instance to be used for subscriptions instead of the store from a Provider */
    store?: Store;
}
/**
 * Infers the type of props that a connector will inject into a component.
 */
type ConnectedProps<TConnector> = TConnector extends InferableComponentEnhancerWithProps<infer TInjectedProps, any> ? unknown extends TInjectedProps ? TConnector extends InferableComponentEnhancer<infer TInjectedProps> ? TInjectedProps : never : TInjectedProps : never;
interface ConnectOptions<State = unknown, TStateProps = {}, TOwnProps = {}, TMergedProps = {}> {
    forwardRef?: boolean;
    context?: typeof ReactReduxContext;
    areStatesEqual?: (nextState: State, prevState: State, nextOwnProps: TOwnProps, prevOwnProps: TOwnProps) => boolean;
    areOwnPropsEqual?: (nextOwnProps: TOwnProps, prevOwnProps: TOwnProps) => boolean;
    areStatePropsEqual?: (nextStateProps: TStateProps, prevStateProps: TStateProps) => boolean;
    areMergedPropsEqual?: (nextMergedProps: TMergedProps, prevMergedProps: TMergedProps) => boolean;
}
/**
 * Connects a React component to a Redux store.
 *
 * - Without arguments, just wraps the component, without changing the behavior / props
 *
 * - If 2 params are passed (3rd param, mergeProps, is skipped), default behavior
 * is to override ownProps (as stated in the docs), so what remains is everything that's
 * not a state or dispatch prop
 *
 * - When 3rd param is passed, we don't know if ownProps propagate and whether they
 * should be valid component props, because it depends on mergeProps implementation.
 * As such, it is the user's responsibility to extend ownProps interface from state or
 * dispatch props or both when applicable
 *
 * @param mapStateToProps
 * @param mapDispatchToProps
 * @param mergeProps
 * @param options
 */
interface Connect<DefaultState = unknown> {
    (): InferableComponentEnhancer<DispatchProp>;
    /** mapState only */
    <TStateProps = {}, no_dispatch = {}, TOwnProps = {}, State = DefaultState>(mapStateToProps: MapStateToPropsParam<TStateProps, TOwnProps, State>): InferableComponentEnhancerWithProps<TStateProps & DispatchProp, TOwnProps>;
    /** mapDispatch only (as a function) */
    <no_state = {}, TDispatchProps = {}, TOwnProps = {}>(mapStateToProps: null | undefined, mapDispatchToProps: MapDispatchToPropsNonObject<TDispatchProps, TOwnProps>): InferableComponentEnhancerWithProps<TDispatchProps, TOwnProps>;
    /** mapDispatch only (as an object) */
    <no_state = {}, TDispatchProps = {}, TOwnProps = {}>(mapStateToProps: null | undefined, mapDispatchToProps: MapDispatchToPropsParam<TDispatchProps, TOwnProps>): InferableComponentEnhancerWithProps<ResolveThunks<TDispatchProps>, TOwnProps>;
    /** mapState and mapDispatch (as a function)*/
    <TStateProps = {}, TDispatchProps = {}, TOwnProps = {}, State = DefaultState>(mapStateToProps: MapStateToPropsParam<TStateProps, TOwnProps, State>, mapDispatchToProps: MapDispatchToPropsNonObject<TDispatchProps, TOwnProps>): InferableComponentEnhancerWithProps<TStateProps & TDispatchProps, TOwnProps>;
    /** mapState and mapDispatch (nullish) */
    <TStateProps = {}, TDispatchProps = {}, TOwnProps = {}, State = DefaultState>(mapStateToProps: MapStateToPropsParam<TStateProps, TOwnProps, State>, mapDispatchToProps: null | undefined): InferableComponentEnhancerWithProps<TStateProps, TOwnProps>;
    /** mapState and mapDispatch (as an object) */
    <TStateProps = {}, TDispatchProps = {}, TOwnProps = {}, State = DefaultState>(mapStateToProps: MapStateToPropsParam<TStateProps, TOwnProps, State>, mapDispatchToProps: MapDispatchToPropsParam<TDispatchProps, TOwnProps>): InferableComponentEnhancerWithProps<TStateProps & ResolveThunks<TDispatchProps>, TOwnProps>;
    /** mergeProps only */
    <no_state = {}, no_dispatch = {}, TOwnProps = {}, TMergedProps = {}>(mapStateToProps: null | undefined, mapDispatchToProps: null | undefined, mergeProps: MergeProps<undefined, DispatchProp, TOwnProps, TMergedProps>): InferableComponentEnhancerWithProps<TMergedProps, TOwnProps>;
    /** mapState and mergeProps */
    <TStateProps = {}, no_dispatch = {}, TOwnProps = {}, TMergedProps = {}, State = DefaultState>(mapStateToProps: MapStateToPropsParam<TStateProps, TOwnProps, State>, mapDispatchToProps: null | undefined, mergeProps: MergeProps<TStateProps, DispatchProp, TOwnProps, TMergedProps>): InferableComponentEnhancerWithProps<TMergedProps, TOwnProps>;
    /** mapDispatch (as a object) and mergeProps */
    <no_state = {}, TDispatchProps = {}, TOwnProps = {}, TMergedProps = {}>(mapStateToProps: null | undefined, mapDispatchToProps: MapDispatchToPropsParam<TDispatchProps, TOwnProps>, mergeProps: MergeProps<undefined, TDispatchProps, TOwnProps, TMergedProps>): InferableComponentEnhancerWithProps<TMergedProps, TOwnProps>;
    /** mapState and options */
    <TStateProps = {}, no_dispatch = {}, TOwnProps = {}, State = DefaultState>(mapStateToProps: MapStateToPropsParam<TStateProps, TOwnProps, State>, mapDispatchToProps: null | undefined, mergeProps: null | undefined, options: ConnectOptions<State, TStateProps, TOwnProps>): InferableComponentEnhancerWithProps<DispatchProp & TStateProps, TOwnProps>;
    /** mapDispatch (as a function) and options */
    <TStateProps = {}, TDispatchProps = {}, TOwnProps = {}>(mapStateToProps: null | undefined, mapDispatchToProps: MapDispatchToPropsNonObject<TDispatchProps, TOwnProps>, mergeProps: null | undefined, options: ConnectOptions<{}, TStateProps, TOwnProps>): InferableComponentEnhancerWithProps<TDispatchProps, TOwnProps>;
    /** mapDispatch (as an object) and options*/
    <TStateProps = {}, TDispatchProps = {}, TOwnProps = {}>(mapStateToProps: null | undefined, mapDispatchToProps: MapDispatchToPropsParam<TDispatchProps, TOwnProps>, mergeProps: null | undefined, options: ConnectOptions<{}, TStateProps, TOwnProps>): InferableComponentEnhancerWithProps<ResolveThunks<TDispatchProps>, TOwnProps>;
    /** mapState,  mapDispatch (as a function), and options */
    <TStateProps = {}, TDispatchProps = {}, TOwnProps = {}, State = DefaultState>(mapStateToProps: MapStateToPropsParam<TStateProps, TOwnProps, State>, mapDispatchToProps: MapDispatchToPropsNonObject<TDispatchProps, TOwnProps>, mergeProps: null | undefined, options: ConnectOptions<State, TStateProps, TOwnProps>): InferableComponentEnhancerWithProps<TStateProps & TDispatchProps, TOwnProps>;
    /** mapState,  mapDispatch (as an object), and options */
    <TStateProps = {}, TDispatchProps = {}, TOwnProps = {}, State = DefaultState>(mapStateToProps: MapStateToPropsParam<TStateProps, TOwnProps, State>, mapDispatchToProps: MapDispatchToPropsParam<TDispatchProps, TOwnProps>, mergeProps: null | undefined, options: ConnectOptions<State, TStateProps, TOwnProps>): InferableComponentEnhancerWithProps<TStateProps & ResolveThunks<TDispatchProps>, TOwnProps>;
    /** mapState, mapDispatch, mergeProps, and options */
    <TStateProps = {}, TDispatchProps = {}, TOwnProps = {}, TMergedProps = {}, State = DefaultState>(mapStateToProps: MapStateToPropsParam<TStateProps, TOwnProps, State>, mapDispatchToProps: MapDispatchToPropsParam<TDispatchProps, TOwnProps>, mergeProps: MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>, options?: ConnectOptions<State, TStateProps, TOwnProps, TMergedProps>): InferableComponentEnhancerWithProps<TMergedProps, TOwnProps>;
}
declare const _default: Connect;

declare function shallowEqual(objA: any, objB: any): boolean;

declare function defaultNoopBatch(callback: () => void): void;

/**
 * Represents a custom hook that provides a dispatch function
 * from the Redux store.
 *
 * @template DispatchType - The specific type of the dispatch function.
 *
 * @since 9.1.0
 * @public
 */
interface UseDispatch<DispatchType extends Dispatch<UnknownAction> = Dispatch<UnknownAction>> {
    /**
     * Returns the dispatch function from the Redux store.
     *
     * @returns The dispatch function from the Redux store.
     *
     * @template AppDispatch - The specific type of the dispatch function.
     */
    <AppDispatch extends DispatchType = DispatchType>(): AppDispatch;
    /**
     * Creates a "pre-typed" version of {@linkcode useDispatch useDispatch}
     * where the type of the `dispatch` function is predefined.
     *
     * This allows you to set the `dispatch` type once, eliminating the need to
     * specify it with every {@linkcode useDispatch useDispatch} call.
     *
     * @returns A pre-typed `useDispatch` with the dispatch type already defined.
     *
     * @example
     * ```ts
     * export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
     * ```
     *
     * @template OverrideDispatchType - The specific type of the dispatch function.
     *
     * @since 9.1.0
     */
    withTypes: <OverrideDispatchType extends DispatchType>() => UseDispatch<OverrideDispatchType>;
}
/**
 * Hook factory, which creates a `useDispatch` hook bound to a given context.
 *
 * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
 * @returns {Function} A `useDispatch` hook bound to the specified context.
 */
declare function createDispatchHook<StateType = unknown, ActionType extends Action = UnknownAction>(context?: Context<ReactReduxContextValue<StateType, ActionType> | null>): UseDispatch<Dispatch<ActionType>>;
/**
 * A hook to access the redux `dispatch` function.
 *
 * @returns {any|function} redux store's `dispatch` function
 *
 * @example
 *
 * import React, { useCallback } from 'react'
 * import { useDispatch } from 'react-redux'
 *
 * export const CounterComponent = ({ value }) => {
 *   const dispatch = useDispatch()
 *   const increaseCounter = useCallback(() => dispatch({ type: 'increase-counter' }), [])
 *   return (
 *     <div>
 *       <span>{value}</span>
 *       <button onClick={increaseCounter}>Increase counter</button>
 *     </div>
 *   )
 * }
 */
declare const useDispatch: UseDispatch<Dispatch<UnknownAction>>;

/**
 * Represents a type that extracts the action type from a given Redux store.
 *
 * @template StoreType - The specific type of the Redux store.
 *
 * @since 9.1.0
 * @internal
 */
type ExtractStoreActionType<StoreType extends Store> = StoreType extends Store<any, infer ActionType> ? ActionType : never;
/**
 * Represents a custom hook that provides access to the Redux store.
 *
 * @template StoreType - The specific type of the Redux store that gets returned.
 *
 * @since 9.1.0
 * @public
 */
interface UseStore<StoreType extends Store> {
    /**
     * Returns the Redux store instance.
     *
     * @returns The Redux store instance.
     */
    (): StoreType;
    /**
     * Returns the Redux store instance with specific state and action types.
     *
     * @returns The Redux store with the specified state and action types.
     *
     * @template StateType - The specific type of the state used in the store.
     * @template ActionType - The specific type of the actions used in the store.
     */
    <StateType extends ReturnType<StoreType['getState']> = ReturnType<StoreType['getState']>, ActionType extends Action = ExtractStoreActionType<Store>>(): Store<StateType, ActionType>;
    /**
     * Creates a "pre-typed" version of {@linkcode useStore useStore}
     * where the type of the Redux `store` is predefined.
     *
     * This allows you to set the `store` type once, eliminating the need to
     * specify it with every {@linkcode useStore useStore} call.
     *
     * @returns A pre-typed `useStore` with the store type already defined.
     *
     * @example
     * ```ts
     * export const useAppStore = useStore.withTypes<AppStore>()
     * ```
     *
     * @template OverrideStoreType - The specific type of the Redux store that gets returned.
     *
     * @since 9.1.0
     */
    withTypes: <OverrideStoreType extends StoreType>() => UseStore<OverrideStoreType>;
}
/**
 * Hook factory, which creates a `useStore` hook bound to a given context.
 *
 * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
 * @returns {Function} A `useStore` hook bound to the specified context.
 */
declare function createStoreHook<StateType = unknown, ActionType extends Action = Action>(context?: Context<ReactReduxContextValue<StateType, ActionType> | null>): UseStore<Store<StateType, ActionType>>;
/**
 * A hook to access the redux store.
 *
 * @returns {any} the redux store
 *
 * @example
 *
 * import React from 'react'
 * import { useStore } from 'react-redux'
 *
 * export const ExampleComponent = () => {
 *   const store = useStore()
 *   return <div>{store.getState()}</div>
 * }
 */
declare const useStore: UseStore<Store<unknown, Action, unknown>>;

/**
 * @deprecated As of React 18, batching is enabled by default for ReactDOM and React Native.
 * This is now a no-op that immediately runs the callback.
 */
declare const batch: typeof defaultNoopBatch;

export { type AnyIfEmpty, type Connect, type ConnectProps, type ConnectPropsMaybeWithoutContext, type ConnectedComponent, type ConnectedProps, type DispatchProp, type DistributiveOmit, type EqualityFn, type ExtendedEqualityFn, type FixTypeLater, type GetLibraryManagedProps, type GetProps, type HandleThunkActionCreator, type InferThunkActionCreatorType, type InferableComponentEnhancer, type InferableComponentEnhancerWithProps, type MapDispatchToProps, type MapDispatchToPropsFactory, type MapDispatchToPropsFunction, type MapDispatchToPropsNonObject, type MapDispatchToPropsParam, type MapStateToProps, type MapStateToPropsFactory, type MapStateToPropsParam, type Mapped, type Matching, type MergeProps, type NoInfer, Provider, type ProviderProps, ReactReduxContext, type ReactReduxContextValue, type ResolveThunks, type Selector, type SelectorFactory, type Shared, type Subscription, type TypedUseSelectorHook, type UseDispatch, type UseSelector, type UseStore, batch, _default as connect, createDispatchHook, createSelectorHook, createStoreHook, shallowEqual, useDispatch, useSelector, useStore };
