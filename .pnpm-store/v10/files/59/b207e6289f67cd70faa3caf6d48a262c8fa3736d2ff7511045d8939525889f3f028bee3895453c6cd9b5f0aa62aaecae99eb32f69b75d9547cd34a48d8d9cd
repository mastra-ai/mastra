import type { Edge, Node, ReactFlowState } from '../types';
/**
 * This hook can be used to subscribe to internal state changes of the React Flow
 * component. The `useStore` hook is re-exported from the [Zustand](https://github.com/pmndrs/zustand)
 * state management library, so you should check out their docs for more details.
 *
 * @public
 * @param selector - A selector function that returns a slice of the flow's internal state.
 * Extracting or transforming just the state you need is a good practice to avoid unnecessary
 * re-renders.
 * @param equalityFn - A function to compare the previous and next value. This is incredibly useful
 * for preventing unnecessary re-renders. Good sensible defaults are using `Object.is` or importing
 * `zustand/shallow`, but you can be as granular as you like.
 * @returns The selected state slice.
 *
 * @example
 * ```ts
 * const nodes = useStore((state) => state.nodes);
 * ```
 *
 * @remarks This hook should only be used if there is no other way to access the internal
 * state. For many of the common use cases, there are dedicated hooks available
 * such as {@link useReactFlow}, {@link useViewport}, etc.
 */
declare function useStore<StateSlice = unknown>(selector: (state: ReactFlowState) => StateSlice, equalityFn?: (a: StateSlice, b: StateSlice) => boolean): StateSlice;
/**
 * In some cases, you might need to access the store directly. This hook returns the store object which can be used on demand to access the state or dispatch actions.
 *
 * @returns The store object.
 * @example
 * ```ts
 * const store = useStoreApi();
 * ```
 *
 * @remarks This hook should only be used if there is no other way to access the internal
 * state. For many of the common use cases, there are dedicated hooks available
 * such as {@link useReactFlow}, {@link useViewport}, etc.
 */
declare function useStoreApi<NodeType extends Node = Node, EdgeType extends Edge = Edge>(): {
    getState: () => ReactFlowState<NodeType, EdgeType>;
    setState: (partial: ReactFlowState<NodeType, EdgeType> | Partial<ReactFlowState<NodeType, EdgeType>> | ((state: ReactFlowState<NodeType, EdgeType>) => ReactFlowState<NodeType, EdgeType> | Partial<ReactFlowState<NodeType, EdgeType>>), replace?: boolean | undefined) => void;
    subscribe: (listener: (state: ReactFlowState<NodeType, EdgeType>, prevState: ReactFlowState<NodeType, EdgeType>) => void) => () => void;
};
export { useStore, useStoreApi };
//# sourceMappingURL=useStore.d.ts.map