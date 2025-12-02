"use client"
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import { createContext, useContext, useMemo, forwardRef, useEffect, useRef, useState, useLayoutEffect, useCallback, memo } from 'react';
import cc from 'classcat';
import { errorMessages, mergeAriaLabelConfig, infiniteExtent, isInputDOMNode, getViewportForBounds, pointToRendererPoint, rendererPointToPoint, isNodeBase, isEdgeBase, getElementsToRemove, isRectObject, nodeToRect, getOverlappingArea, getNodesBounds, withResolvers, evaluateAbsolutePosition, getDimensions, XYPanZoom, PanOnScrollMode, SelectionMode, getEventPosition, getNodesInside, areSetsEqual, XYDrag, snapPosition, calculateNodePosition, Position, ConnectionMode, isMouseEvent, XYHandle, getHostForElement, addEdge, getInternalNodesBounds, isNumeric, nodeHasDimensions, getNodeDimensions, elementSelectionKeys, isEdgeVisible, MarkerType, createMarkerIds, getBezierEdgeCenter, getSmoothStepPath, getStraightPath, getBezierPath, getEdgePosition, getElevatedEdgeZIndex, getMarkerId, getConnectionStatus, ConnectionLineType, updateConnectionLookup, adoptUserNodes, initialConnection, devWarn, defaultAriaLabelConfig, updateNodeInternals, updateAbsolutePositions, handleExpandParent, panBy, fitViewport, isMacOs, areConnectionMapsEqual, handleConnectionChange, shallowNodeData, XYMinimap, getBoundsOfRects, ResizeControlVariant, XYResizer, XY_RESIZER_LINE_POSITIONS, XY_RESIZER_HANDLE_POSITIONS, getNodeToolbarTransform, getEdgeToolbarTransform } from '@xyflow/system';
export { ConnectionLineType, ConnectionMode, MarkerType, PanOnScrollMode, Position, ResizeControlVariant, SelectionMode, addEdge, getBezierEdgeCenter, getBezierPath, getConnectedEdges, getEdgeCenter, getIncomers, getNodesBounds, getOutgoers, getSmoothStepPath, getStraightPath, getViewportForBounds, reconnectEdge } from '@xyflow/system';
import { useStoreWithEqualityFn, createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { createPortal } from 'react-dom';

const StoreContext = createContext(null);
const Provider$1 = StoreContext.Provider;

const zustandErrorMessage = errorMessages['error001']();
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
function useStore(selector, equalityFn) {
    const store = useContext(StoreContext);
    if (store === null) {
        throw new Error(zustandErrorMessage);
    }
    return useStoreWithEqualityFn(store, selector, equalityFn);
}
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
function useStoreApi() {
    const store = useContext(StoreContext);
    if (store === null) {
        throw new Error(zustandErrorMessage);
    }
    return useMemo(() => ({
        getState: store.getState,
        setState: store.setState,
        subscribe: store.subscribe,
    }), [store]);
}

const style = { display: 'none' };
const ariaLiveStyle = {
    position: 'absolute',
    width: 1,
    height: 1,
    margin: -1,
    border: 0,
    padding: 0,
    overflow: 'hidden',
    clip: 'rect(0px, 0px, 0px, 0px)',
    clipPath: 'inset(100%)',
};
const ARIA_NODE_DESC_KEY = 'react-flow__node-desc';
const ARIA_EDGE_DESC_KEY = 'react-flow__edge-desc';
const ARIA_LIVE_MESSAGE = 'react-flow__aria-live';
const ariaLiveSelector = (s) => s.ariaLiveMessage;
const ariaLabelConfigSelector = (s) => s.ariaLabelConfig;
function AriaLiveMessage({ rfId }) {
    const ariaLiveMessage = useStore(ariaLiveSelector);
    return (jsx("div", { id: `${ARIA_LIVE_MESSAGE}-${rfId}`, "aria-live": "assertive", "aria-atomic": "true", style: ariaLiveStyle, children: ariaLiveMessage }));
}
function A11yDescriptions({ rfId, disableKeyboardA11y }) {
    const ariaLabelConfig = useStore(ariaLabelConfigSelector);
    return (jsxs(Fragment, { children: [jsx("div", { id: `${ARIA_NODE_DESC_KEY}-${rfId}`, style: style, children: disableKeyboardA11y
                    ? ariaLabelConfig['node.a11yDescription.default']
                    : ariaLabelConfig['node.a11yDescription.keyboardDisabled'] }), jsx("div", { id: `${ARIA_EDGE_DESC_KEY}-${rfId}`, style: style, children: ariaLabelConfig['edge.a11yDescription.default'] }), !disableKeyboardA11y && jsx(AriaLiveMessage, { rfId: rfId })] }));
}

/**
 * The `<Panel />` component helps you position content above the viewport.
 * It is used internally by the [`<MiniMap />`](/api-reference/components/minimap)
 * and [`<Controls />`](/api-reference/components/controls) components.
 *
 * @public
 *
 * @example
 * ```jsx
 *import { ReactFlow, Background, Panel } from '@xyflow/react';
 *
 *export default function Flow() {
 *  return (
 *    <ReactFlow nodes={[]} fitView>
 *      <Panel position="top-left">top-left</Panel>
 *      <Panel position="top-center">top-center</Panel>
 *      <Panel position="top-right">top-right</Panel>
 *      <Panel position="bottom-left">bottom-left</Panel>
 *      <Panel position="bottom-center">bottom-center</Panel>
 *      <Panel position="bottom-right">bottom-right</Panel>
 *    </ReactFlow>
 *  );
 *}
 *```
 */
const Panel = forwardRef(({ position = 'top-left', children, className, style, ...rest }, ref) => {
    const positionClasses = `${position}`.split('-');
    return (jsx("div", { className: cc(['react-flow__panel', className, ...positionClasses]), style: style, ref: ref, ...rest, children: children }));
});
Panel.displayName = 'Panel';

function Attribution({ proOptions, position = 'bottom-right' }) {
    if (proOptions?.hideAttribution) {
        return null;
    }
    return (jsx(Panel, { position: position, className: "react-flow__attribution", "data-message": "Please only hide this attribution when you are subscribed to React Flow Pro: https://pro.reactflow.dev", children: jsx("a", { href: "https://reactflow.dev", target: "_blank", rel: "noopener noreferrer", "aria-label": "React Flow attribution", children: "React Flow" }) }));
}

const selector$m = (s) => {
    const selectedNodes = [];
    const selectedEdges = [];
    for (const [, node] of s.nodeLookup) {
        if (node.selected) {
            selectedNodes.push(node.internals.userNode);
        }
    }
    for (const [, edge] of s.edgeLookup) {
        if (edge.selected) {
            selectedEdges.push(edge);
        }
    }
    return { selectedNodes, selectedEdges };
};
const selectId = (obj) => obj.id;
function areEqual(a, b) {
    return (shallow(a.selectedNodes.map(selectId), b.selectedNodes.map(selectId)) &&
        shallow(a.selectedEdges.map(selectId), b.selectedEdges.map(selectId)));
}
function SelectionListenerInner({ onSelectionChange, }) {
    const store = useStoreApi();
    const { selectedNodes, selectedEdges } = useStore(selector$m, areEqual);
    useEffect(() => {
        const params = { nodes: selectedNodes, edges: selectedEdges };
        onSelectionChange?.(params);
        store.getState().onSelectionChangeHandlers.forEach((fn) => fn(params));
    }, [selectedNodes, selectedEdges, onSelectionChange]);
    return null;
}
const changeSelector = (s) => !!s.onSelectionChangeHandlers;
function SelectionListener({ onSelectionChange, }) {
    const storeHasSelectionChangeHandlers = useStore(changeSelector);
    if (onSelectionChange || storeHasSelectionChangeHandlers) {
        return jsx(SelectionListenerInner, { onSelectionChange: onSelectionChange });
    }
    return null;
}

const defaultNodeOrigin = [0, 0];
const defaultViewport = { x: 0, y: 0, zoom: 1 };

/*
 * This component helps us to update the store with the values coming from the user.
 * We distinguish between values we can update directly with `useDirectStoreUpdater` (like `snapGrid`)
 * and values that have a dedicated setter function in the store (like `setNodes`).
 */
// These fields exist in the global store, and we need to keep them up to date
const reactFlowFieldsToTrack = [
    'nodes',
    'edges',
    'defaultNodes',
    'defaultEdges',
    'onConnect',
    'onConnectStart',
    'onConnectEnd',
    'onClickConnectStart',
    'onClickConnectEnd',
    'nodesDraggable',
    'autoPanOnNodeFocus',
    'nodesConnectable',
    'nodesFocusable',
    'edgesFocusable',
    'edgesReconnectable',
    'elevateNodesOnSelect',
    'elevateEdgesOnSelect',
    'minZoom',
    'maxZoom',
    'nodeExtent',
    'onNodesChange',
    'onEdgesChange',
    'elementsSelectable',
    'connectionMode',
    'snapGrid',
    'snapToGrid',
    'translateExtent',
    'connectOnClick',
    'defaultEdgeOptions',
    'fitView',
    'fitViewOptions',
    'onNodesDelete',
    'onEdgesDelete',
    'onDelete',
    'onNodeDrag',
    'onNodeDragStart',
    'onNodeDragStop',
    'onSelectionDrag',
    'onSelectionDragStart',
    'onSelectionDragStop',
    'onMoveStart',
    'onMove',
    'onMoveEnd',
    'noPanClassName',
    'nodeOrigin',
    'autoPanOnConnect',
    'autoPanOnNodeDrag',
    'onError',
    'connectionRadius',
    'isValidConnection',
    'selectNodesOnDrag',
    'nodeDragThreshold',
    'connectionDragThreshold',
    'onBeforeDelete',
    'debug',
    'autoPanSpeed',
    'ariaLabelConfig',
];
// rfId doesn't exist in ReactFlowProps, but it's one of the fields we want to update
const fieldsToTrack = [...reactFlowFieldsToTrack, 'rfId'];
const selector$l = (s) => ({
    setNodes: s.setNodes,
    setEdges: s.setEdges,
    setMinZoom: s.setMinZoom,
    setMaxZoom: s.setMaxZoom,
    setTranslateExtent: s.setTranslateExtent,
    setNodeExtent: s.setNodeExtent,
    reset: s.reset,
    setDefaultNodesAndEdges: s.setDefaultNodesAndEdges,
});
const initPrevValues = {
    /*
     * these are values that are also passed directly to other components
     * than the StoreUpdater. We can reduce the number of setStore calls
     * by setting the same values here as prev fields.
     */
    translateExtent: infiniteExtent,
    nodeOrigin: defaultNodeOrigin,
    minZoom: 0.5,
    maxZoom: 2,
    elementsSelectable: true,
    noPanClassName: 'nopan',
    rfId: '1',
};
function StoreUpdater(props) {
    const { setNodes, setEdges, setMinZoom, setMaxZoom, setTranslateExtent, setNodeExtent, reset, setDefaultNodesAndEdges, } = useStore(selector$l, shallow);
    const store = useStoreApi();
    useEffect(() => {
        setDefaultNodesAndEdges(props.defaultNodes, props.defaultEdges);
        return () => {
            // when we reset the store we also need to reset the previous fields
            previousFields.current = initPrevValues;
            reset();
        };
    }, []);
    const previousFields = useRef(initPrevValues);
    useEffect(() => {
        for (const fieldName of fieldsToTrack) {
            const fieldValue = props[fieldName];
            const previousFieldValue = previousFields.current[fieldName];
            if (fieldValue === previousFieldValue)
                continue;
            if (typeof props[fieldName] === 'undefined')
                continue;
            // Custom handling with dedicated setters for some fields
            if (fieldName === 'nodes')
                setNodes(fieldValue);
            else if (fieldName === 'edges')
                setEdges(fieldValue);
            else if (fieldName === 'minZoom')
                setMinZoom(fieldValue);
            else if (fieldName === 'maxZoom')
                setMaxZoom(fieldValue);
            else if (fieldName === 'translateExtent')
                setTranslateExtent(fieldValue);
            else if (fieldName === 'nodeExtent')
                setNodeExtent(fieldValue);
            else if (fieldName === 'ariaLabelConfig')
                store.setState({ ariaLabelConfig: mergeAriaLabelConfig(fieldValue) });
            // Renamed fields
            else if (fieldName === 'fitView')
                store.setState({ fitViewQueued: fieldValue });
            else if (fieldName === 'fitViewOptions')
                store.setState({ fitViewOptions: fieldValue });
            // General case
            else
                store.setState({ [fieldName]: fieldValue });
        }
        previousFields.current = props;
    }, 
    // Only re-run the effect if one of the fields we track changes
    fieldsToTrack.map((fieldName) => props[fieldName]));
    return null;
}

function getMediaQuery() {
    if (typeof window === 'undefined' || !window.matchMedia) {
        return null;
    }
    return window.matchMedia('(prefers-color-scheme: dark)');
}
/**
 * Hook for receiving the current color mode class 'dark' or 'light'.
 *
 * @internal
 * @param colorMode - The color mode to use ('dark', 'light' or 'system')
 */
function useColorModeClass(colorMode) {
    const [colorModeClass, setColorModeClass] = useState(colorMode === 'system' ? null : colorMode);
    useEffect(() => {
        if (colorMode !== 'system') {
            setColorModeClass(colorMode);
            return;
        }
        const mediaQuery = getMediaQuery();
        const updateColorModeClass = () => setColorModeClass(mediaQuery?.matches ? 'dark' : 'light');
        updateColorModeClass();
        mediaQuery?.addEventListener('change', updateColorModeClass);
        return () => {
            mediaQuery?.removeEventListener('change', updateColorModeClass);
        };
    }, [colorMode]);
    return colorModeClass !== null ? colorModeClass : getMediaQuery()?.matches ? 'dark' : 'light';
}

const defaultDoc = typeof document !== 'undefined' ? document : null;
/**
 * This hook lets you listen for specific key codes and tells you whether they are
 * currently pressed or not.
 *
 * @public
 * @param options - Options
 *
 * @example
 * ```tsx
 *import { useKeyPress } from '@xyflow/react';
 *
 *export default function () {
 *  const spacePressed = useKeyPress('Space');
 *  const cmdAndSPressed = useKeyPress(['Meta+s', 'Strg+s']);
 *
 *  return (
 *    <div>
 *     {spacePressed && <p>Space pressed!</p>}
 *     {cmdAndSPressed && <p>Cmd + S pressed!</p>}
 *    </div>
 *  );
 *}
 *```
 */
function useKeyPress(
/**
 * The key code (string or array of strings) specifies which key(s) should trigger
 * an action.
 *
 * A **string** can represent:
 * - A **single key**, e.g. `'a'`
 * - A **key combination**, using `'+'` to separate keys, e.g. `'a+d'`
 *
 * An  **array of strings** represents **multiple possible key inputs**. For example, `['a', 'd+s']`
 * means the user can press either the single key `'a'` or the combination of `'d'` and `'s'`.
 * @default null
 */
keyCode = null, options = { target: defaultDoc, actInsideInputWithModifier: true }) {
    const [keyPressed, setKeyPressed] = useState(false);
    // we need to remember if a modifier key is pressed in order to track it
    const modifierPressed = useRef(false);
    // we need to remember the pressed keys in order to support combinations
    const pressedKeys = useRef(new Set([]));
    /*
     * keyCodes = array with single keys [['a']] or key combinations [['a', 's']]
     * keysToWatch = array with all keys flattened ['a', 'd', 'ShiftLeft']
     * used to check if we store event.code or event.key. When the code is in the list of keysToWatch
     * we use the code otherwise the key. Explainer: When you press the left "command" key, the code is "MetaLeft"
     * and the key is "Meta". We want users to be able to pass keys and codes so we assume that the key is meant when
     * we can't find it in the list of keysToWatch.
     */
    const [keyCodes, keysToWatch] = useMemo(() => {
        if (keyCode !== null) {
            const keyCodeArr = Array.isArray(keyCode) ? keyCode : [keyCode];
            const keys = keyCodeArr
                .filter((kc) => typeof kc === 'string')
                /*
                 * we first replace all '+' with '\n'  which we will use to split the keys on
                 * then we replace '\n\n' with '\n+', this way we can also support the combination 'key++'
                 * in the end we simply split on '\n' to get the key array
                 */
                .map((kc) => kc.replace('+', '\n').replace('\n\n', '\n+').split('\n'));
            const keysFlat = keys.reduce((res, item) => res.concat(...item), []);
            return [keys, keysFlat];
        }
        return [[], []];
    }, [keyCode]);
    useEffect(() => {
        const target = options?.target ?? defaultDoc;
        const actInsideInputWithModifier = options?.actInsideInputWithModifier ?? true;
        if (keyCode !== null) {
            const downHandler = (event) => {
                modifierPressed.current = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
                const preventAction = (!modifierPressed.current || (modifierPressed.current && !actInsideInputWithModifier)) &&
                    isInputDOMNode(event);
                if (preventAction) {
                    return false;
                }
                const keyOrCode = useKeyOrCode(event.code, keysToWatch);
                pressedKeys.current.add(event[keyOrCode]);
                if (isMatchingKey(keyCodes, pressedKeys.current, false)) {
                    const target = (event.composedPath?.()?.[0] || event.target);
                    const isInteractiveElement = target?.nodeName === 'BUTTON' || target?.nodeName === 'A';
                    if (options.preventDefault !== false && (modifierPressed.current || !isInteractiveElement)) {
                        event.preventDefault();
                    }
                    setKeyPressed(true);
                }
            };
            const upHandler = (event) => {
                const keyOrCode = useKeyOrCode(event.code, keysToWatch);
                if (isMatchingKey(keyCodes, pressedKeys.current, true)) {
                    setKeyPressed(false);
                    pressedKeys.current.clear();
                }
                else {
                    pressedKeys.current.delete(event[keyOrCode]);
                }
                // fix for Mac: when cmd key is pressed, keyup is not triggered for any other key, see: https://stackoverflow.com/questions/27380018/when-cmd-key-is-kept-pressed-keyup-is-not-triggered-for-any-other-key
                if (event.key === 'Meta') {
                    pressedKeys.current.clear();
                }
                modifierPressed.current = false;
            };
            const resetHandler = () => {
                pressedKeys.current.clear();
                setKeyPressed(false);
            };
            target?.addEventListener('keydown', downHandler);
            target?.addEventListener('keyup', upHandler);
            window.addEventListener('blur', resetHandler);
            window.addEventListener('contextmenu', resetHandler);
            return () => {
                target?.removeEventListener('keydown', downHandler);
                target?.removeEventListener('keyup', upHandler);
                window.removeEventListener('blur', resetHandler);
                window.removeEventListener('contextmenu', resetHandler);
            };
        }
    }, [keyCode, setKeyPressed]);
    return keyPressed;
}
// utils
function isMatchingKey(keyCodes, pressedKeys, isUp) {
    return (keyCodes
        /*
         * we only want to compare same sizes of keyCode definitions
         * and pressed keys. When the user specified 'Meta' as a key somewhere
         * this would also be truthy without this filter when user presses 'Meta' + 'r'
         */
        .filter((keys) => isUp || keys.length === pressedKeys.size)
        /*
         * since we want to support multiple possibilities only one of the
         * combinations need to be part of the pressed keys
         */
        .some((keys) => keys.every((k) => pressedKeys.has(k))));
}
function useKeyOrCode(eventCode, keysToWatch) {
    return keysToWatch.includes(eventCode) ? 'code' : 'key';
}

/**
 * Hook for getting viewport helper functions.
 *
 * @internal
 * @returns viewport helper functions
 */
const useViewportHelper = () => {
    const store = useStoreApi();
    return useMemo(() => {
        return {
            zoomIn: (options) => {
                const { panZoom } = store.getState();
                return panZoom ? panZoom.scaleBy(1.2, { duration: options?.duration }) : Promise.resolve(false);
            },
            zoomOut: (options) => {
                const { panZoom } = store.getState();
                return panZoom ? panZoom.scaleBy(1 / 1.2, { duration: options?.duration }) : Promise.resolve(false);
            },
            zoomTo: (zoomLevel, options) => {
                const { panZoom } = store.getState();
                return panZoom ? panZoom.scaleTo(zoomLevel, { duration: options?.duration }) : Promise.resolve(false);
            },
            getZoom: () => store.getState().transform[2],
            setViewport: async (viewport, options) => {
                const { transform: [tX, tY, tZoom], panZoom, } = store.getState();
                if (!panZoom) {
                    return Promise.resolve(false);
                }
                await panZoom.setViewport({
                    x: viewport.x ?? tX,
                    y: viewport.y ?? tY,
                    zoom: viewport.zoom ?? tZoom,
                }, options);
                return Promise.resolve(true);
            },
            getViewport: () => {
                const [x, y, zoom] = store.getState().transform;
                return { x, y, zoom };
            },
            setCenter: async (x, y, options) => {
                return store.getState().setCenter(x, y, options);
            },
            fitBounds: async (bounds, options) => {
                const { width, height, minZoom, maxZoom, panZoom } = store.getState();
                const viewport = getViewportForBounds(bounds, width, height, minZoom, maxZoom, options?.padding ?? 0.1);
                if (!panZoom) {
                    return Promise.resolve(false);
                }
                await panZoom.setViewport(viewport, {
                    duration: options?.duration,
                    ease: options?.ease,
                    interpolate: options?.interpolate,
                });
                return Promise.resolve(true);
            },
            screenToFlowPosition: (clientPosition, options = {}) => {
                const { transform, snapGrid, snapToGrid, domNode } = store.getState();
                if (!domNode) {
                    return clientPosition;
                }
                const { x: domX, y: domY } = domNode.getBoundingClientRect();
                const correctedPosition = {
                    x: clientPosition.x - domX,
                    y: clientPosition.y - domY,
                };
                const _snapGrid = options.snapGrid ?? snapGrid;
                const _snapToGrid = options.snapToGrid ?? snapToGrid;
                return pointToRendererPoint(correctedPosition, transform, _snapToGrid, _snapGrid);
            },
            flowToScreenPosition: (flowPosition) => {
                const { transform, domNode } = store.getState();
                if (!domNode) {
                    return flowPosition;
                }
                const { x: domX, y: domY } = domNode.getBoundingClientRect();
                const rendererPosition = rendererPointToPoint(flowPosition, transform);
                return {
                    x: rendererPosition.x + domX,
                    y: rendererPosition.y + domY,
                };
            },
        };
    }, []);
};

/*
 * This function applies changes to nodes or edges that are triggered by React Flow internally.
 * When you drag a node for example, React Flow will send a position change update.
 * This function then applies the changes and returns the updated elements.
 */
function applyChanges(changes, elements) {
    const updatedElements = [];
    /*
     * By storing a map of changes for each element, we can a quick lookup as we
     * iterate over the elements array!
     */
    const changesMap = new Map();
    const addItemChanges = [];
    for (const change of changes) {
        if (change.type === 'add') {
            addItemChanges.push(change);
            continue;
        }
        else if (change.type === 'remove' || change.type === 'replace') {
            /*
             * For a 'remove' change we can safely ignore any other changes queued for
             * the same element, it's going to be removed anyway!
             */
            changesMap.set(change.id, [change]);
        }
        else {
            const elementChanges = changesMap.get(change.id);
            if (elementChanges) {
                /*
                 * If we have some changes queued already, we can do a mutable update of
                 * that array and save ourselves some copying.
                 */
                elementChanges.push(change);
            }
            else {
                changesMap.set(change.id, [change]);
            }
        }
    }
    for (const element of elements) {
        const changes = changesMap.get(element.id);
        /*
         * When there are no changes for an element we can just push it unmodified,
         * no need to copy it.
         */
        if (!changes) {
            updatedElements.push(element);
            continue;
        }
        // If we have a 'remove' change queued, it'll be the only change in the array
        if (changes[0].type === 'remove') {
            continue;
        }
        if (changes[0].type === 'replace') {
            updatedElements.push({ ...changes[0].item });
            continue;
        }
        /**
         * For other types of changes, we want to start with a shallow copy of the
         * object so React knows this element has changed. Sequential changes will
         * each _mutate_ this object, so there's only ever one copy.
         */
        const updatedElement = { ...element };
        for (const change of changes) {
            applyChange(change, updatedElement);
        }
        updatedElements.push(updatedElement);
    }
    /*
     * we need to wait for all changes to be applied before adding new items
     * to be able to add them at the correct index
     */
    if (addItemChanges.length) {
        addItemChanges.forEach((change) => {
            if (change.index !== undefined) {
                updatedElements.splice(change.index, 0, { ...change.item });
            }
            else {
                updatedElements.push({ ...change.item });
            }
        });
    }
    return updatedElements;
}
// Applies a single change to an element. This is a *mutable* update.
function applyChange(change, element) {
    switch (change.type) {
        case 'select': {
            element.selected = change.selected;
            break;
        }
        case 'position': {
            if (typeof change.position !== 'undefined') {
                element.position = change.position;
            }
            if (typeof change.dragging !== 'undefined') {
                element.dragging = change.dragging;
            }
            break;
        }
        case 'dimensions': {
            if (typeof change.dimensions !== 'undefined') {
                element.measured ??= {};
                element.measured.width = change.dimensions.width;
                element.measured.height = change.dimensions.height;
                if (change.setAttributes) {
                    if (change.setAttributes === true || change.setAttributes === 'width') {
                        element.width = change.dimensions.width;
                    }
                    if (change.setAttributes === true || change.setAttributes === 'height') {
                        element.height = change.dimensions.height;
                    }
                }
            }
            if (typeof change.resizing === 'boolean') {
                element.resizing = change.resizing;
            }
            break;
        }
    }
}
/**
 * Drop in function that applies node changes to an array of nodes.
 * @public
 * @param changes - Array of changes to apply.
 * @param nodes - Array of nodes to apply the changes to.
 * @returns Array of updated nodes.
 * @example
 *```tsx
 *import { useState, useCallback } from 'react';
 *import { ReactFlow, applyNodeChanges, type Node, type Edge, type OnNodesChange } from '@xyflow/react';
 *
 *export default function Flow() {
 *  const [nodes, setNodes] = useState<Node[]>([]);
 *  const [edges, setEdges] = useState<Edge[]>([]);
 *  const onNodesChange: OnNodesChange = useCallback(
 *    (changes) => {
 *      setNodes((oldNodes) => applyNodeChanges(changes, oldNodes));
 *    },
 *    [setNodes],
 *  );
 *
 *  return (
 *    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} />
 *  );
 *}
 *```
 * @remarks Various events on the <ReactFlow /> component can produce an {@link NodeChange}
 * that describes how to update the edges of your flow in some way.
 * If you don't need any custom behaviour, this util can be used to take an array
 * of these changes and apply them to your edges.
 */
function applyNodeChanges(changes, nodes) {
    return applyChanges(changes, nodes);
}
/**
 * Drop in function that applies edge changes to an array of edges.
 * @public
 * @param changes - Array of changes to apply.
 * @param edges - Array of edge to apply the changes to.
 * @returns Array of updated edges.
 * @example
 * ```tsx
 *import { useState, useCallback } from 'react';
 *import { ReactFlow, applyEdgeChanges } from '@xyflow/react';
 *
 *export default function Flow() {
 *  const [nodes, setNodes] = useState([]);
 *  const [edges, setEdges] = useState([]);
 *  const onEdgesChange = useCallback(
 *    (changes) => {
 *      setEdges((oldEdges) => applyEdgeChanges(changes, oldEdges));
 *    },
 *    [setEdges],
 *  );
 *
 *  return (
 *    <ReactFlow nodes={nodes} edges={edges} onEdgesChange={onEdgesChange} />
 *  );
 *}
 *```
 * @remarks Various events on the <ReactFlow /> component can produce an {@link EdgeChange}
 * that describes how to update the edges of your flow in some way.
 * If you don't need any custom behaviour, this util can be used to take an array
 * of these changes and apply them to your edges.
 */
function applyEdgeChanges(changes, edges) {
    return applyChanges(changes, edges);
}
function createSelectionChange(id, selected) {
    return {
        id,
        type: 'select',
        selected,
    };
}
function getSelectionChanges(items, selectedIds = new Set(), mutateItem = false) {
    const changes = [];
    for (const [id, item] of items) {
        const willBeSelected = selectedIds.has(id);
        // we don't want to set all items to selected=false on the first selection
        if (!(item.selected === undefined && !willBeSelected) && item.selected !== willBeSelected) {
            if (mutateItem) {
                /*
                 * this hack is needed for nodes. When the user dragged a node, it's selected.
                 * When another node gets dragged, we need to deselect the previous one,
                 * in order to have only one selected node at a time - the onNodesChange callback comes too late here :/
                 */
                item.selected = willBeSelected;
            }
            changes.push(createSelectionChange(item.id, willBeSelected));
        }
    }
    return changes;
}
function getElementsDiffChanges({ items = [], lookup, }) {
    const changes = [];
    const itemsLookup = new Map(items.map((item) => [item.id, item]));
    for (const [index, item] of items.entries()) {
        const lookupItem = lookup.get(item.id);
        const storeItem = lookupItem?.internals?.userNode ?? lookupItem;
        if (storeItem !== undefined && storeItem !== item) {
            changes.push({ id: item.id, item: item, type: 'replace' });
        }
        if (storeItem === undefined) {
            changes.push({ item: item, type: 'add', index });
        }
    }
    for (const [id] of lookup) {
        const nextNode = itemsLookup.get(id);
        if (nextNode === undefined) {
            changes.push({ id, type: 'remove' });
        }
    }
    return changes;
}
function elementToRemoveChange(item) {
    return {
        id: item.id,
        type: 'remove',
    };
}

/**
 * Test whether an object is usable as an [`Node`](/api-reference/types/node).
 * In TypeScript this is a type guard that will narrow the type of whatever you pass in to
 * [`Node`](/api-reference/types/node) if it returns `true`.
 *
 * @public
 * @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Node if it returns true
 * @param element - The element to test.
 * @returns Tests whether the provided value can be used as a `Node`. If you're using TypeScript,
 * this function acts as a type guard and will narrow the type of the value to `Node` if it returns
 * `true`.
 *
 * @example
 * ```js
 *import { isNode } from '@xyflow/react';
 *
 *if (isNode(node)) {
 * // ...
 *}
 *```
 */
const isNode = (element) => isNodeBase(element);
/**
 * Test whether an object is usable as an [`Edge`](/api-reference/types/edge).
 * In TypeScript this is a type guard that will narrow the type of whatever you pass in to
 * [`Edge`](/api-reference/types/edge) if it returns `true`.
 *
 * @public
 * @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Edge if it returns true
 * @param element - The element to test
 * @returns Tests whether the provided value can be used as an `Edge`. If you're using TypeScript,
 * this function acts as a type guard and will narrow the type of the value to `Edge` if it returns
 * `true`.
 *
 * @example
 * ```js
 *import { isEdge } from '@xyflow/react';
 *
 *if (isEdge(edge)) {
 * // ...
 *}
 *```
 */
const isEdge = (element) => isEdgeBase(element);
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
function fixedForwardRef(render) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return forwardRef(render);
}

// we need this hook to prevent a warning when using react-flow in SSR
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * This hook returns a queue that can be used to batch updates.
 *
 * @param runQueue - a function that gets called when the queue is flushed
 * @internal
 *
 * @returns a Queue object
 */
function useQueue(runQueue) {
    /*
     * Because we're using a ref above, we need some way to let React know when to
     * actually process the queue. We increment this number any time we mutate the
     * queue, creating a new state to trigger the layout effect below.
     * Using a boolean dirty flag here instead would lead to issues related to
     * automatic batching. (https://github.com/xyflow/xyflow/issues/4779)
     */
    const [serial, setSerial] = useState(BigInt(0));
    /*
     * A reference of all the batched updates to process before the next render. We
     * want a reference here so multiple synchronous calls to `setNodes` etc can be
     * batched together.
     */
    const [queue] = useState(() => createQueue(() => setSerial(n => n + BigInt(1))));
    /*
     * Layout effects are guaranteed to run before the next render which means we
     * shouldn't run into any issues with stale state or weird issues that come from
     * rendering things one frame later than expected (we used to use `setTimeout`).
     */
    useIsomorphicLayoutEffect(() => {
        const queueItems = queue.get();
        if (queueItems.length) {
            runQueue(queueItems);
            queue.reset();
        }
    }, [serial]);
    return queue;
}
function createQueue(cb) {
    let queue = [];
    return {
        get: () => queue,
        reset: () => {
            queue = [];
        },
        push: (item) => {
            queue.push(item);
            cb();
        },
    };
}

const BatchContext = createContext(null);
/**
 * This is a context provider that holds and processes the node and edge update queues
 * that are needed to handle setNodes, addNodes, setEdges and addEdges.
 *
 * @internal
 */
function BatchProvider({ children, }) {
    const store = useStoreApi();
    const nodeQueueHandler = useCallback((queueItems) => {
        const { nodes = [], setNodes, hasDefaultNodes, onNodesChange, nodeLookup, fitViewQueued } = store.getState();
        /*
         * This is essentially an `Array.reduce` in imperative clothing. Processing
         * this queue is a relatively hot path so we'd like to avoid the overhead of
         * array methods where we can.
         */
        let next = nodes;
        for (const payload of queueItems) {
            next = typeof payload === 'function' ? payload(next) : payload;
        }
        const changes = getElementsDiffChanges({
            items: next,
            lookup: nodeLookup,
        });
        if (hasDefaultNodes) {
            setNodes(next);
        }
        // We only want to fire onNodesChange if there are changes to the nodes
        if (changes.length > 0) {
            onNodesChange?.(changes);
        }
        else if (fitViewQueued) {
            // If there are no changes to the nodes, we still need to call setNodes
            // to trigger a re-render and fitView.
            window.requestAnimationFrame(() => {
                const { fitViewQueued, nodes, setNodes } = store.getState();
                if (fitViewQueued) {
                    setNodes(nodes);
                }
            });
        }
    }, []);
    const nodeQueue = useQueue(nodeQueueHandler);
    const edgeQueueHandler = useCallback((queueItems) => {
        const { edges = [], setEdges, hasDefaultEdges, onEdgesChange, edgeLookup } = store.getState();
        let next = edges;
        for (const payload of queueItems) {
            next = typeof payload === 'function' ? payload(next) : payload;
        }
        if (hasDefaultEdges) {
            setEdges(next);
        }
        else if (onEdgesChange) {
            onEdgesChange(getElementsDiffChanges({
                items: next,
                lookup: edgeLookup,
            }));
        }
    }, []);
    const edgeQueue = useQueue(edgeQueueHandler);
    const value = useMemo(() => ({ nodeQueue, edgeQueue }), []);
    return jsx(BatchContext.Provider, { value: value, children: children });
}
function useBatchContext() {
    const batchContext = useContext(BatchContext);
    if (!batchContext) {
        throw new Error('useBatchContext must be used within a BatchProvider');
    }
    return batchContext;
}

const selector$k = (s) => !!s.panZoom;
/**
 * This hook returns a ReactFlowInstance that can be used to update nodes and edges, manipulate the viewport, or query the current state of the flow.
 *
 * @public
 * @example
 * ```jsx
 *import { useCallback, useState } from 'react';
 *import { useReactFlow } from '@xyflow/react';
 *
 *export function NodeCounter() {
 *  const reactFlow = useReactFlow();
 *  const [count, setCount] = useState(0);
 *  const countNodes = useCallback(() => {
 *    setCount(reactFlow.getNodes().length);
 *    // you need to pass it as a dependency if you are using it with useEffect or useCallback
 *    // because at the first render, it's not initialized yet and some functions might not work.
 *  }, [reactFlow]);
 *
 *  return (
 *    <div>
 *      <button onClick={countNodes}>Update count</button>
 *      <p>There are {count} nodes in the flow.</p>
 *    </div>
 *  );
 *}
 *```
 */
function useReactFlow() {
    const viewportHelper = useViewportHelper();
    const store = useStoreApi();
    const batchContext = useBatchContext();
    const viewportInitialized = useStore(selector$k);
    const generalHelper = useMemo(() => {
        const getInternalNode = (id) => store.getState().nodeLookup.get(id);
        const setNodes = (payload) => {
            batchContext.nodeQueue.push(payload);
        };
        const setEdges = (payload) => {
            batchContext.edgeQueue.push(payload);
        };
        const getNodeRect = (node) => {
            const { nodeLookup, nodeOrigin } = store.getState();
            const nodeToUse = isNode(node) ? node : nodeLookup.get(node.id);
            const position = nodeToUse.parentId
                ? evaluateAbsolutePosition(nodeToUse.position, nodeToUse.measured, nodeToUse.parentId, nodeLookup, nodeOrigin)
                : nodeToUse.position;
            const nodeWithPosition = {
                ...nodeToUse,
                position,
                width: nodeToUse.measured?.width ?? nodeToUse.width,
                height: nodeToUse.measured?.height ?? nodeToUse.height,
            };
            return nodeToRect(nodeWithPosition);
        };
        const updateNode = (id, nodeUpdate, options = { replace: false }) => {
            setNodes((prevNodes) => prevNodes.map((node) => {
                if (node.id === id) {
                    const nextNode = typeof nodeUpdate === 'function' ? nodeUpdate(node) : nodeUpdate;
                    return options.replace && isNode(nextNode) ? nextNode : { ...node, ...nextNode };
                }
                return node;
            }));
        };
        const updateEdge = (id, edgeUpdate, options = { replace: false }) => {
            setEdges((prevEdges) => prevEdges.map((edge) => {
                if (edge.id === id) {
                    const nextEdge = typeof edgeUpdate === 'function' ? edgeUpdate(edge) : edgeUpdate;
                    return options.replace && isEdge(nextEdge) ? nextEdge : { ...edge, ...nextEdge };
                }
                return edge;
            }));
        };
        return {
            getNodes: () => store.getState().nodes.map((n) => ({ ...n })),
            getNode: (id) => getInternalNode(id)?.internals.userNode,
            getInternalNode,
            getEdges: () => {
                const { edges = [] } = store.getState();
                return edges.map((e) => ({ ...e }));
            },
            getEdge: (id) => store.getState().edgeLookup.get(id),
            setNodes,
            setEdges,
            addNodes: (payload) => {
                const newNodes = Array.isArray(payload) ? payload : [payload];
                batchContext.nodeQueue.push((nodes) => [...nodes, ...newNodes]);
            },
            addEdges: (payload) => {
                const newEdges = Array.isArray(payload) ? payload : [payload];
                batchContext.edgeQueue.push((edges) => [...edges, ...newEdges]);
            },
            toObject: () => {
                const { nodes = [], edges = [], transform } = store.getState();
                const [x, y, zoom] = transform;
                return {
                    nodes: nodes.map((n) => ({ ...n })),
                    edges: edges.map((e) => ({ ...e })),
                    viewport: {
                        x,
                        y,
                        zoom,
                    },
                };
            },
            deleteElements: async ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
                const { nodes, edges, onNodesDelete, onEdgesDelete, triggerNodeChanges, triggerEdgeChanges, onDelete, onBeforeDelete, } = store.getState();
                const { nodes: matchingNodes, edges: matchingEdges } = await getElementsToRemove({
                    nodesToRemove,
                    edgesToRemove,
                    nodes,
                    edges,
                    onBeforeDelete,
                });
                const hasMatchingEdges = matchingEdges.length > 0;
                const hasMatchingNodes = matchingNodes.length > 0;
                if (hasMatchingEdges) {
                    const edgeChanges = matchingEdges.map(elementToRemoveChange);
                    onEdgesDelete?.(matchingEdges);
                    triggerEdgeChanges(edgeChanges);
                }
                if (hasMatchingNodes) {
                    const nodeChanges = matchingNodes.map(elementToRemoveChange);
                    onNodesDelete?.(matchingNodes);
                    triggerNodeChanges(nodeChanges);
                }
                if (hasMatchingNodes || hasMatchingEdges) {
                    onDelete?.({ nodes: matchingNodes, edges: matchingEdges });
                }
                return { deletedNodes: matchingNodes, deletedEdges: matchingEdges };
            },
            /**
             * Partial is defined as "the 2 nodes/areas are intersecting partially".
             * If a is contained in b or b is contained in a, they are both
             * considered fully intersecting.
             */
            getIntersectingNodes: (nodeOrRect, partially = true, nodes) => {
                const isRect = isRectObject(nodeOrRect);
                const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);
                const hasNodesOption = nodes !== undefined;
                if (!nodeRect) {
                    return [];
                }
                return (nodes || store.getState().nodes).filter((n) => {
                    const internalNode = store.getState().nodeLookup.get(n.id);
                    if (internalNode && !isRect && (n.id === nodeOrRect.id || !internalNode.internals.positionAbsolute)) {
                        return false;
                    }
                    const currNodeRect = nodeToRect(hasNodesOption ? n : internalNode);
                    const overlappingArea = getOverlappingArea(currNodeRect, nodeRect);
                    const partiallyVisible = partially && overlappingArea > 0;
                    return (partiallyVisible ||
                        overlappingArea >= currNodeRect.width * currNodeRect.height ||
                        overlappingArea >= nodeRect.width * nodeRect.height);
                });
            },
            isNodeIntersecting: (nodeOrRect, area, partially = true) => {
                const isRect = isRectObject(nodeOrRect);
                const nodeRect = isRect ? nodeOrRect : getNodeRect(nodeOrRect);
                if (!nodeRect) {
                    return false;
                }
                const overlappingArea = getOverlappingArea(nodeRect, area);
                const partiallyVisible = partially && overlappingArea > 0;
                return (partiallyVisible ||
                    overlappingArea >= area.width * area.height ||
                    overlappingArea >= nodeRect.width * nodeRect.height);
            },
            updateNode,
            updateNodeData: (id, dataUpdate, options = { replace: false }) => {
                updateNode(id, (node) => {
                    const nextData = typeof dataUpdate === 'function' ? dataUpdate(node) : dataUpdate;
                    return options.replace ? { ...node, data: nextData } : { ...node, data: { ...node.data, ...nextData } };
                }, options);
            },
            updateEdge,
            updateEdgeData: (id, dataUpdate, options = { replace: false }) => {
                updateEdge(id, (edge) => {
                    const nextData = typeof dataUpdate === 'function' ? dataUpdate(edge) : dataUpdate;
                    return options.replace ? { ...edge, data: nextData } : { ...edge, data: { ...edge.data, ...nextData } };
                }, options);
            },
            getNodesBounds: (nodes) => {
                const { nodeLookup, nodeOrigin } = store.getState();
                return getNodesBounds(nodes, { nodeLookup, nodeOrigin });
            },
            getHandleConnections: ({ type, id, nodeId }) => Array.from(store
                .getState()
                .connectionLookup.get(`${nodeId}-${type}${id ? `-${id}` : ''}`)
                ?.values() ?? []),
            getNodeConnections: ({ type, handleId, nodeId }) => Array.from(store
                .getState()
                .connectionLookup.get(`${nodeId}${type ? (handleId ? `-${type}-${handleId}` : `-${type}`) : ''}`)
                ?.values() ?? []),
            fitView: async (options) => {
                // We either create a new Promise or reuse the existing one
                // Even if fitView is called multiple times in a row, we only end up with a single Promise
                const fitViewResolver = store.getState().fitViewResolver ?? withResolvers();
                // We schedule a fitView by setting fitViewQueued and triggering a setNodes
                store.setState({ fitViewQueued: true, fitViewOptions: options, fitViewResolver });
                batchContext.nodeQueue.push((nodes) => [...nodes]);
                return fitViewResolver.promise;
            },
        };
    }, []);
    return useMemo(() => {
        return {
            ...generalHelper,
            ...viewportHelper,
            viewportInitialized,
        };
    }, [viewportInitialized]);
}

const selected = (item) => item.selected;
const win$1 = typeof window !== 'undefined' ? window : undefined;
/**
 * Hook for handling global key events.
 *
 * @internal
 */
function useGlobalKeyHandler({ deleteKeyCode, multiSelectionKeyCode, }) {
    const store = useStoreApi();
    const { deleteElements } = useReactFlow();
    const deleteKeyPressed = useKeyPress(deleteKeyCode, { actInsideInputWithModifier: false });
    const multiSelectionKeyPressed = useKeyPress(multiSelectionKeyCode, { target: win$1 });
    useEffect(() => {
        if (deleteKeyPressed) {
            const { edges, nodes } = store.getState();
            deleteElements({ nodes: nodes.filter(selected), edges: edges.filter(selected) });
            store.setState({ nodesSelectionActive: false });
        }
    }, [deleteKeyPressed]);
    useEffect(() => {
        store.setState({ multiSelectionActive: multiSelectionKeyPressed });
    }, [multiSelectionKeyPressed]);
}

/**
 * Hook for handling resize events.
 *
 * @internal
 */
function useResizeHandler(domNode) {
    const store = useStoreApi();
    useEffect(() => {
        const updateDimensions = () => {
            if (!domNode.current || !(domNode.current.checkVisibility?.() ?? true)) {
                return false;
            }
            const size = getDimensions(domNode.current);
            if (size.height === 0 || size.width === 0) {
                store.getState().onError?.('004', errorMessages['error004']());
            }
            store.setState({ width: size.width || 500, height: size.height || 500 });
        };
        if (domNode.current) {
            updateDimensions();
            window.addEventListener('resize', updateDimensions);
            const resizeObserver = new ResizeObserver(() => updateDimensions());
            resizeObserver.observe(domNode.current);
            return () => {
                window.removeEventListener('resize', updateDimensions);
                if (resizeObserver && domNode.current) {
                    resizeObserver.unobserve(domNode.current);
                }
            };
        }
    }, []);
}

const containerStyle = {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
};

const selector$j = (s) => ({
    userSelectionActive: s.userSelectionActive,
    lib: s.lib,
    connectionInProgress: s.connection.inProgress,
});
function ZoomPane({ onPaneContextMenu, zoomOnScroll = true, zoomOnPinch = true, panOnScroll = false, panOnScrollSpeed = 0.5, panOnScrollMode = PanOnScrollMode.Free, zoomOnDoubleClick = true, panOnDrag = true, defaultViewport, translateExtent, minZoom, maxZoom, zoomActivationKeyCode, preventScrolling = true, children, noWheelClassName, noPanClassName, onViewportChange, isControlledViewport, paneClickDistance, selectionOnDrag, }) {
    const store = useStoreApi();
    const zoomPane = useRef(null);
    const { userSelectionActive, lib, connectionInProgress } = useStore(selector$j, shallow);
    const zoomActivationKeyPressed = useKeyPress(zoomActivationKeyCode);
    const panZoom = useRef();
    useResizeHandler(zoomPane);
    const onTransformChange = useCallback((transform) => {
        onViewportChange?.({ x: transform[0], y: transform[1], zoom: transform[2] });
        if (!isControlledViewport) {
            store.setState({ transform });
        }
    }, [onViewportChange, isControlledViewport]);
    useEffect(() => {
        if (zoomPane.current) {
            panZoom.current = XYPanZoom({
                domNode: zoomPane.current,
                minZoom,
                maxZoom,
                translateExtent,
                viewport: defaultViewport,
                onDraggingChange: (paneDragging) => store.setState({ paneDragging }),
                onPanZoomStart: (event, vp) => {
                    const { onViewportChangeStart, onMoveStart } = store.getState();
                    onMoveStart?.(event, vp);
                    onViewportChangeStart?.(vp);
                },
                onPanZoom: (event, vp) => {
                    const { onViewportChange, onMove } = store.getState();
                    onMove?.(event, vp);
                    onViewportChange?.(vp);
                },
                onPanZoomEnd: (event, vp) => {
                    const { onViewportChangeEnd, onMoveEnd } = store.getState();
                    onMoveEnd?.(event, vp);
                    onViewportChangeEnd?.(vp);
                },
            });
            const { x, y, zoom } = panZoom.current.getViewport();
            store.setState({
                panZoom: panZoom.current,
                transform: [x, y, zoom],
                domNode: zoomPane.current.closest('.react-flow'),
            });
            return () => {
                panZoom.current?.destroy();
            };
        }
    }, []);
    useEffect(() => {
        panZoom.current?.update({
            onPaneContextMenu,
            zoomOnScroll,
            zoomOnPinch,
            panOnScroll,
            panOnScrollSpeed,
            panOnScrollMode,
            zoomOnDoubleClick,
            panOnDrag,
            zoomActivationKeyPressed,
            preventScrolling,
            noPanClassName,
            userSelectionActive,
            noWheelClassName,
            lib,
            onTransformChange,
            connectionInProgress,
            selectionOnDrag,
            paneClickDistance,
        });
    }, [
        onPaneContextMenu,
        zoomOnScroll,
        zoomOnPinch,
        panOnScroll,
        panOnScrollSpeed,
        panOnScrollMode,
        zoomOnDoubleClick,
        panOnDrag,
        zoomActivationKeyPressed,
        preventScrolling,
        noPanClassName,
        userSelectionActive,
        noWheelClassName,
        lib,
        onTransformChange,
        connectionInProgress,
        selectionOnDrag,
        paneClickDistance,
    ]);
    return (jsx("div", { className: "react-flow__renderer", ref: zoomPane, style: containerStyle, children: children }));
}

const selector$i = (s) => ({
    userSelectionActive: s.userSelectionActive,
    userSelectionRect: s.userSelectionRect,
});
function UserSelection() {
    const { userSelectionActive, userSelectionRect } = useStore(selector$i, shallow);
    const isActive = userSelectionActive && userSelectionRect;
    if (!isActive) {
        return null;
    }
    return (jsx("div", { className: "react-flow__selection react-flow__container", style: {
            width: userSelectionRect.width,
            height: userSelectionRect.height,
            transform: `translate(${userSelectionRect.x}px, ${userSelectionRect.y}px)`,
        } }));
}

const wrapHandler = (handler, containerRef) => {
    return (event) => {
        if (event.target !== containerRef.current) {
            return;
        }
        handler?.(event);
    };
};
const selector$h = (s) => ({
    userSelectionActive: s.userSelectionActive,
    elementsSelectable: s.elementsSelectable,
    connectionInProgress: s.connection.inProgress,
    dragging: s.paneDragging,
});
function Pane({ isSelecting, selectionKeyPressed, selectionMode = SelectionMode.Full, panOnDrag, paneClickDistance, selectionOnDrag, onSelectionStart, onSelectionEnd, onPaneClick, onPaneContextMenu, onPaneScroll, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, children, }) {
    const store = useStoreApi();
    const { userSelectionActive, elementsSelectable, dragging, connectionInProgress } = useStore(selector$h, shallow);
    const isSelectionEnabled = elementsSelectable && (isSelecting || userSelectionActive);
    const container = useRef(null);
    const containerBounds = useRef();
    const selectedNodeIds = useRef(new Set());
    const selectedEdgeIds = useRef(new Set());
    // Used to prevent click events when the user lets go of the selectionKey during a selection
    const selectionInProgress = useRef(false);
    const onClick = (event) => {
        // We prevent click events when the user let go of the selectionKey during a selection
        // We also prevent click events when a connection is in progress
        if (selectionInProgress.current || connectionInProgress) {
            selectionInProgress.current = false;
            return;
        }
        onPaneClick?.(event);
        store.getState().resetSelectedElements();
        store.setState({ nodesSelectionActive: false });
    };
    const onContextMenu = (event) => {
        if (Array.isArray(panOnDrag) && panOnDrag?.includes(2)) {
            event.preventDefault();
            return;
        }
        onPaneContextMenu?.(event);
    };
    const onWheel = onPaneScroll ? (event) => onPaneScroll(event) : undefined;
    const onClickCapture = (event) => {
        if (selectionInProgress.current) {
            event.stopPropagation();
            selectionInProgress.current = false;
        }
    };
    // We are using capture here in order to prevent other pointer events
    // to be able to create a selection above a node or an edge
    const onPointerDownCapture = (event) => {
        const { domNode } = store.getState();
        containerBounds.current = domNode?.getBoundingClientRect();
        if (!containerBounds.current)
            return;
        const eventTargetIsContainer = event.target === container.current;
        // if a child element has the 'nokey' class, we don't want to swallow the event and don't start a selection
        const isNoKeyEvent = !eventTargetIsContainer && !!event.target.closest('.nokey');
        const isSelectionActive = (selectionOnDrag && eventTargetIsContainer) || selectionKeyPressed;
        if (isNoKeyEvent || !isSelecting || !isSelectionActive || event.button !== 0 || !event.isPrimary) {
            return;
        }
        event.target?.setPointerCapture?.(event.pointerId);
        selectionInProgress.current = false;
        const { x, y } = getEventPosition(event.nativeEvent, containerBounds.current);
        store.setState({
            userSelectionRect: {
                width: 0,
                height: 0,
                startX: x,
                startY: y,
                x,
                y,
            },
        });
        if (!eventTargetIsContainer) {
            event.stopPropagation();
            event.preventDefault();
        }
    };
    const onPointerMove = (event) => {
        const { userSelectionRect, transform, nodeLookup, edgeLookup, connectionLookup, triggerNodeChanges, triggerEdgeChanges, defaultEdgeOptions, resetSelectedElements, } = store.getState();
        if (!containerBounds.current || !userSelectionRect) {
            return;
        }
        const { x: mouseX, y: mouseY } = getEventPosition(event.nativeEvent, containerBounds.current);
        const { startX, startY } = userSelectionRect;
        if (!selectionInProgress.current) {
            const requiredDistance = selectionKeyPressed ? 0 : paneClickDistance;
            const distance = Math.hypot(mouseX - startX, mouseY - startY);
            if (distance <= requiredDistance) {
                return;
            }
            resetSelectedElements();
            onSelectionStart?.(event);
        }
        selectionInProgress.current = true;
        const nextUserSelectRect = {
            startX,
            startY,
            x: mouseX < startX ? mouseX : startX,
            y: mouseY < startY ? mouseY : startY,
            width: Math.abs(mouseX - startX),
            height: Math.abs(mouseY - startY),
        };
        const prevSelectedNodeIds = selectedNodeIds.current;
        const prevSelectedEdgeIds = selectedEdgeIds.current;
        selectedNodeIds.current = new Set(getNodesInside(nodeLookup, nextUserSelectRect, transform, selectionMode === SelectionMode.Partial, true).map((node) => node.id));
        selectedEdgeIds.current = new Set();
        const edgesSelectable = defaultEdgeOptions?.selectable ?? true;
        // We look for all edges connected to the selected nodes
        for (const nodeId of selectedNodeIds.current) {
            const connections = connectionLookup.get(nodeId);
            if (!connections)
                continue;
            for (const { edgeId } of connections.values()) {
                const edge = edgeLookup.get(edgeId);
                if (edge && (edge.selectable ?? edgesSelectable)) {
                    selectedEdgeIds.current.add(edgeId);
                }
            }
        }
        if (!areSetsEqual(prevSelectedNodeIds, selectedNodeIds.current)) {
            const changes = getSelectionChanges(nodeLookup, selectedNodeIds.current, true);
            triggerNodeChanges(changes);
        }
        if (!areSetsEqual(prevSelectedEdgeIds, selectedEdgeIds.current)) {
            const changes = getSelectionChanges(edgeLookup, selectedEdgeIds.current);
            triggerEdgeChanges(changes);
        }
        store.setState({
            userSelectionRect: nextUserSelectRect,
            userSelectionActive: true,
            nodesSelectionActive: false,
        });
    };
    const onPointerUp = (event) => {
        if (event.button !== 0) {
            return;
        }
        event.target?.releasePointerCapture?.(event.pointerId);
        /*
         * We only want to trigger click functions when in selection mode if
         * the user did not move the mouse.
         */
        if (!userSelectionActive && event.target === container.current && store.getState().userSelectionRect) {
            onClick?.(event);
        }
        store.setState({
            userSelectionActive: false,
            userSelectionRect: null,
        });
        if (selectionInProgress.current) {
            onSelectionEnd?.(event);
            store.setState({
                nodesSelectionActive: selectedNodeIds.current.size > 0,
            });
        }
    };
    const draggable = panOnDrag === true || (Array.isArray(panOnDrag) && panOnDrag.includes(0));
    return (jsxs("div", { className: cc(['react-flow__pane', { draggable, dragging, selection: isSelecting }]), onClick: isSelectionEnabled ? undefined : wrapHandler(onClick, container), onContextMenu: wrapHandler(onContextMenu, container), onWheel: wrapHandler(onWheel, container), onPointerEnter: isSelectionEnabled ? undefined : onPaneMouseEnter, onPointerMove: isSelectionEnabled ? onPointerMove : onPaneMouseMove, onPointerUp: isSelectionEnabled ? onPointerUp : undefined, onPointerDownCapture: isSelectionEnabled ? onPointerDownCapture : undefined, onClickCapture: isSelectionEnabled ? onClickCapture : undefined, onPointerLeave: onPaneMouseLeave, ref: container, style: containerStyle, children: [children, jsx(UserSelection, {})] }));
}

/*
 * this handler is called by
 * 1. the click handler when node is not draggable or selectNodesOnDrag = false
 * or
 * 2. the on drag start handler when node is draggable and selectNodesOnDrag = true
 */
function handleNodeClick({ id, store, unselect = false, nodeRef, }) {
    const { addSelectedNodes, unselectNodesAndEdges, multiSelectionActive, nodeLookup, onError } = store.getState();
    const node = nodeLookup.get(id);
    if (!node) {
        onError?.('012', errorMessages['error012'](id));
        return;
    }
    store.setState({ nodesSelectionActive: false });
    if (!node.selected) {
        addSelectedNodes([id]);
    }
    else if (unselect || (node.selected && multiSelectionActive)) {
        unselectNodesAndEdges({ nodes: [node], edges: [] });
        requestAnimationFrame(() => nodeRef?.current?.blur());
    }
}

/**
 * Hook for calling XYDrag helper from @xyflow/system.
 *
 * @internal
 */
function useDrag({ nodeRef, disabled = false, noDragClassName, handleSelector, nodeId, isSelectable, nodeClickDistance, }) {
    const store = useStoreApi();
    const [dragging, setDragging] = useState(false);
    const xyDrag = useRef();
    useEffect(() => {
        xyDrag.current = XYDrag({
            getStoreItems: () => store.getState(),
            onNodeMouseDown: (id) => {
                handleNodeClick({
                    id,
                    store,
                    nodeRef,
                });
            },
            onDragStart: () => {
                setDragging(true);
            },
            onDragStop: () => {
                setDragging(false);
            },
        });
    }, []);
    useEffect(() => {
        if (disabled) {
            xyDrag.current?.destroy();
        }
        else if (nodeRef.current) {
            xyDrag.current?.update({
                noDragClassName,
                handleSelector,
                domNode: nodeRef.current,
                isSelectable,
                nodeId,
                nodeClickDistance,
            });
            return () => {
                xyDrag.current?.destroy();
            };
        }
    }, [noDragClassName, handleSelector, disabled, isSelectable, nodeRef, nodeId]);
    return dragging;
}

const selectedAndDraggable = (nodesDraggable) => (n) => n.selected && (n.draggable || (nodesDraggable && typeof n.draggable === 'undefined'));
/**
 * Hook for updating node positions by passing a direction and factor
 *
 * @internal
 * @returns function for updating node positions
 */
function useMoveSelectedNodes() {
    const store = useStoreApi();
    const moveSelectedNodes = useCallback((params) => {
        const { nodeExtent, snapToGrid, snapGrid, nodesDraggable, onError, updateNodePositions, nodeLookup, nodeOrigin } = store.getState();
        const nodeUpdates = new Map();
        const isSelected = selectedAndDraggable(nodesDraggable);
        /*
         * by default a node moves 5px on each key press
         * if snap grid is enabled, we use that for the velocity
         */
        const xVelo = snapToGrid ? snapGrid[0] : 5;
        const yVelo = snapToGrid ? snapGrid[1] : 5;
        const xDiff = params.direction.x * xVelo * params.factor;
        const yDiff = params.direction.y * yVelo * params.factor;
        for (const [, node] of nodeLookup) {
            if (!isSelected(node)) {
                continue;
            }
            let nextPosition = {
                x: node.internals.positionAbsolute.x + xDiff,
                y: node.internals.positionAbsolute.y + yDiff,
            };
            if (snapToGrid) {
                nextPosition = snapPosition(nextPosition, snapGrid);
            }
            const { position, positionAbsolute } = calculateNodePosition({
                nodeId: node.id,
                nextPosition,
                nodeLookup,
                nodeExtent,
                nodeOrigin,
                onError,
            });
            node.position = position;
            node.internals.positionAbsolute = positionAbsolute;
            nodeUpdates.set(node.id, node);
        }
        updateNodePositions(nodeUpdates);
    }, []);
    return moveSelectedNodes;
}

const NodeIdContext = createContext(null);
const Provider = NodeIdContext.Provider;
NodeIdContext.Consumer;
/**
 * You can use this hook to get the id of the node it is used inside. It is useful
 * if you need the node's id deeper in the render tree but don't want to manually
 * drill down the id as a prop.
 *
 * @public
 * @returns The id for a node in the flow.
 *
 * @example
 *```jsx
 *import { useNodeId } from '@xyflow/react';
 *
 *export default function CustomNode() {
 *  return (
 *    <div>
 *      <span>This node has an id of </span>
 *      <NodeIdDisplay />
 *    </div>
 *  );
 *}
 *
 *function NodeIdDisplay() {
 *  const nodeId = useNodeId();
 *
 *  return <span>{nodeId}</span>;
 *}
 *```
 */
const useNodeId = () => {
    const nodeId = useContext(NodeIdContext);
    return nodeId;
};

const selector$g = (s) => ({
    connectOnClick: s.connectOnClick,
    noPanClassName: s.noPanClassName,
    rfId: s.rfId,
});
const connectingSelector = (nodeId, handleId, type) => (state) => {
    const { connectionClickStartHandle: clickHandle, connectionMode, connection } = state;
    const { fromHandle, toHandle, isValid } = connection;
    const connectingTo = toHandle?.nodeId === nodeId && toHandle?.id === handleId && toHandle?.type === type;
    return {
        connectingFrom: fromHandle?.nodeId === nodeId && fromHandle?.id === handleId && fromHandle?.type === type,
        connectingTo,
        clickConnecting: clickHandle?.nodeId === nodeId && clickHandle?.id === handleId && clickHandle?.type === type,
        isPossibleEndHandle: connectionMode === ConnectionMode.Strict
            ? fromHandle?.type !== type
            : nodeId !== fromHandle?.nodeId || handleId !== fromHandle?.id,
        connectionInProcess: !!fromHandle,
        clickConnectionInProcess: !!clickHandle,
        valid: connectingTo && isValid,
    };
};
function HandleComponent({ type = 'source', position = Position.Top, isValidConnection, isConnectable = true, isConnectableStart = true, isConnectableEnd = true, id, onConnect, children, className, onMouseDown, onTouchStart, ...rest }, ref) {
    const handleId = id || null;
    const isTarget = type === 'target';
    const store = useStoreApi();
    const nodeId = useNodeId();
    const { connectOnClick, noPanClassName, rfId } = useStore(selector$g, shallow);
    const { connectingFrom, connectingTo, clickConnecting, isPossibleEndHandle, connectionInProcess, clickConnectionInProcess, valid, } = useStore(connectingSelector(nodeId, handleId, type), shallow);
    if (!nodeId) {
        store.getState().onError?.('010', errorMessages['error010']());
    }
    const onConnectExtended = (params) => {
        const { defaultEdgeOptions, onConnect: onConnectAction, hasDefaultEdges } = store.getState();
        const edgeParams = {
            ...defaultEdgeOptions,
            ...params,
        };
        if (hasDefaultEdges) {
            const { edges, setEdges } = store.getState();
            setEdges(addEdge(edgeParams, edges));
        }
        onConnectAction?.(edgeParams);
        onConnect?.(edgeParams);
    };
    const onPointerDown = (event) => {
        if (!nodeId) {
            return;
        }
        const isMouseTriggered = isMouseEvent(event.nativeEvent);
        if (isConnectableStart &&
            ((isMouseTriggered && event.button === 0) || !isMouseTriggered)) {
            const currentStore = store.getState();
            XYHandle.onPointerDown(event.nativeEvent, {
                handleDomNode: event.currentTarget,
                autoPanOnConnect: currentStore.autoPanOnConnect,
                connectionMode: currentStore.connectionMode,
                connectionRadius: currentStore.connectionRadius,
                domNode: currentStore.domNode,
                nodeLookup: currentStore.nodeLookup,
                lib: currentStore.lib,
                isTarget,
                handleId,
                nodeId,
                flowId: currentStore.rfId,
                panBy: currentStore.panBy,
                cancelConnection: currentStore.cancelConnection,
                onConnectStart: currentStore.onConnectStart,
                onConnectEnd: currentStore.onConnectEnd,
                updateConnection: currentStore.updateConnection,
                onConnect: onConnectExtended,
                isValidConnection: isValidConnection || currentStore.isValidConnection,
                getTransform: () => store.getState().transform,
                getFromHandle: () => store.getState().connection.fromHandle,
                autoPanSpeed: currentStore.autoPanSpeed,
                dragThreshold: currentStore.connectionDragThreshold,
            });
        }
        if (isMouseTriggered) {
            onMouseDown?.(event);
        }
        else {
            onTouchStart?.(event);
        }
    };
    const onClick = (event) => {
        const { onClickConnectStart, onClickConnectEnd, connectionClickStartHandle, connectionMode, isValidConnection: isValidConnectionStore, lib, rfId: flowId, nodeLookup, connection: connectionState, } = store.getState();
        if (!nodeId || (!connectionClickStartHandle && !isConnectableStart)) {
            return;
        }
        if (!connectionClickStartHandle) {
            onClickConnectStart?.(event.nativeEvent, { nodeId, handleId, handleType: type });
            store.setState({ connectionClickStartHandle: { nodeId, type, id: handleId } });
            return;
        }
        const doc = getHostForElement(event.target);
        const isValidConnectionHandler = isValidConnection || isValidConnectionStore;
        const { connection, isValid } = XYHandle.isValid(event.nativeEvent, {
            handle: {
                nodeId,
                id: handleId,
                type,
            },
            connectionMode,
            fromNodeId: connectionClickStartHandle.nodeId,
            fromHandleId: connectionClickStartHandle.id || null,
            fromType: connectionClickStartHandle.type,
            isValidConnection: isValidConnectionHandler,
            flowId,
            doc,
            lib,
            nodeLookup,
        });
        if (isValid && connection) {
            onConnectExtended(connection);
        }
        const connectionClone = structuredClone(connectionState);
        delete connectionClone.inProgress;
        connectionClone.toPosition = connectionClone.toHandle ? connectionClone.toHandle.position : null;
        onClickConnectEnd?.(event, connectionClone);
        store.setState({ connectionClickStartHandle: null });
    };
    return (jsx("div", { "data-handleid": handleId, "data-nodeid": nodeId, "data-handlepos": position, "data-id": `${rfId}-${nodeId}-${handleId}-${type}`, className: cc([
            'react-flow__handle',
            `react-flow__handle-${position}`,
            'nodrag',
            noPanClassName,
            className,
            {
                source: !isTarget,
                target: isTarget,
                connectable: isConnectable,
                connectablestart: isConnectableStart,
                connectableend: isConnectableEnd,
                clickconnecting: clickConnecting,
                connectingfrom: connectingFrom,
                connectingto: connectingTo,
                valid,
                /*
                 * shows where you can start a connection from
                 * and where you can end it while connecting
                 */
                connectionindicator: isConnectable &&
                    (!connectionInProcess || isPossibleEndHandle) &&
                    (connectionInProcess || clickConnectionInProcess ? isConnectableEnd : isConnectableStart),
            },
        ]), onMouseDown: onPointerDown, onTouchStart: onPointerDown, onClick: connectOnClick ? onClick : undefined, ref: ref, ...rest, children: children }));
}
/**
 * The `<Handle />` component is used in your [custom nodes](/learn/customization/custom-nodes)
 * to define connection points.
 *
 *@public
 *
 *@example
 *
 *```jsx
 *import { Handle, Position } from '@xyflow/react';
 *
 *export function CustomNode({ data }) {
 *  return (
 *    <>
 *      <div style={{ padding: '10px 20px' }}>
 *        {data.label}
 *      </div>
 *
 *      <Handle type="target" position={Position.Left} />
 *      <Handle type="source" position={Position.Right} />
 *    </>
 *  );
 *};
 *```
 */
const Handle = memo(fixedForwardRef(HandleComponent));

function InputNode({ data, isConnectable, sourcePosition = Position.Bottom }) {
    return (jsxs(Fragment, { children: [data?.label, jsx(Handle, { type: "source", position: sourcePosition, isConnectable: isConnectable })] }));
}

function DefaultNode({ data, isConnectable, targetPosition = Position.Top, sourcePosition = Position.Bottom, }) {
    return (jsxs(Fragment, { children: [jsx(Handle, { type: "target", position: targetPosition, isConnectable: isConnectable }), data?.label, jsx(Handle, { type: "source", position: sourcePosition, isConnectable: isConnectable })] }));
}

function GroupNode() {
    return null;
}

function OutputNode({ data, isConnectable, targetPosition = Position.Top }) {
    return (jsxs(Fragment, { children: [jsx(Handle, { type: "target", position: targetPosition, isConnectable: isConnectable }), data?.label] }));
}

const arrowKeyDiffs = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
};
const builtinNodeTypes = {
    input: InputNode,
    default: DefaultNode,
    output: OutputNode,
    group: GroupNode,
};
function getNodeInlineStyleDimensions(node) {
    if (node.internals.handleBounds === undefined) {
        return {
            width: node.width ?? node.initialWidth ?? node.style?.width,
            height: node.height ?? node.initialHeight ?? node.style?.height,
        };
    }
    return {
        width: node.width ?? node.style?.width,
        height: node.height ?? node.style?.height,
    };
}

const selector$f = (s) => {
    const { width, height, x, y } = getInternalNodesBounds(s.nodeLookup, {
        filter: (node) => !!node.selected,
    });
    return {
        width: isNumeric(width) ? width : null,
        height: isNumeric(height) ? height : null,
        userSelectionActive: s.userSelectionActive,
        transformString: `translate(${s.transform[0]}px,${s.transform[1]}px) scale(${s.transform[2]}) translate(${x}px,${y}px)`,
    };
};
function NodesSelection({ onSelectionContextMenu, noPanClassName, disableKeyboardA11y, }) {
    const store = useStoreApi();
    const { width, height, transformString, userSelectionActive } = useStore(selector$f, shallow);
    const moveSelectedNodes = useMoveSelectedNodes();
    const nodeRef = useRef(null);
    useEffect(() => {
        if (!disableKeyboardA11y) {
            nodeRef.current?.focus({
                preventScroll: true,
            });
        }
    }, [disableKeyboardA11y]);
    useDrag({
        nodeRef,
    });
    if (userSelectionActive || !width || !height) {
        return null;
    }
    const onContextMenu = onSelectionContextMenu
        ? (event) => {
            const selectedNodes = store.getState().nodes.filter((n) => n.selected);
            onSelectionContextMenu(event, selectedNodes);
        }
        : undefined;
    const onKeyDown = (event) => {
        if (Object.prototype.hasOwnProperty.call(arrowKeyDiffs, event.key)) {
            event.preventDefault();
            moveSelectedNodes({
                direction: arrowKeyDiffs[event.key],
                factor: event.shiftKey ? 4 : 1,
            });
        }
    };
    return (jsx("div", { className: cc(['react-flow__nodesselection', 'react-flow__container', noPanClassName]), style: {
            transform: transformString,
        }, children: jsx("div", { ref: nodeRef, className: "react-flow__nodesselection-rect", onContextMenu: onContextMenu, tabIndex: disableKeyboardA11y ? undefined : -1, onKeyDown: disableKeyboardA11y ? undefined : onKeyDown, style: {
                width,
                height,
            } }) }));
}

const win = typeof window !== 'undefined' ? window : undefined;
const selector$e = (s) => {
    return { nodesSelectionActive: s.nodesSelectionActive, userSelectionActive: s.userSelectionActive };
};
function FlowRendererComponent({ children, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneContextMenu, onPaneScroll, paneClickDistance, deleteKeyCode, selectionKeyCode, selectionOnDrag, selectionMode, onSelectionStart, onSelectionEnd, multiSelectionKeyCode, panActivationKeyCode, zoomActivationKeyCode, elementsSelectable, zoomOnScroll, zoomOnPinch, panOnScroll: _panOnScroll, panOnScrollSpeed, panOnScrollMode, zoomOnDoubleClick, panOnDrag: _panOnDrag, defaultViewport, translateExtent, minZoom, maxZoom, preventScrolling, onSelectionContextMenu, noWheelClassName, noPanClassName, disableKeyboardA11y, onViewportChange, isControlledViewport, }) {
    const { nodesSelectionActive, userSelectionActive } = useStore(selector$e);
    const selectionKeyPressed = useKeyPress(selectionKeyCode, { target: win });
    const panActivationKeyPressed = useKeyPress(panActivationKeyCode, { target: win });
    const panOnDrag = panActivationKeyPressed || _panOnDrag;
    const panOnScroll = panActivationKeyPressed || _panOnScroll;
    const _selectionOnDrag = selectionOnDrag && panOnDrag !== true;
    const isSelecting = selectionKeyPressed || userSelectionActive || _selectionOnDrag;
    useGlobalKeyHandler({ deleteKeyCode, multiSelectionKeyCode });
    return (jsx(ZoomPane, { onPaneContextMenu: onPaneContextMenu, elementsSelectable: elementsSelectable, zoomOnScroll: zoomOnScroll, zoomOnPinch: zoomOnPinch, panOnScroll: panOnScroll, panOnScrollSpeed: panOnScrollSpeed, panOnScrollMode: panOnScrollMode, zoomOnDoubleClick: zoomOnDoubleClick, panOnDrag: !selectionKeyPressed && panOnDrag, defaultViewport: defaultViewport, translateExtent: translateExtent, minZoom: minZoom, maxZoom: maxZoom, zoomActivationKeyCode: zoomActivationKeyCode, preventScrolling: preventScrolling, noWheelClassName: noWheelClassName, noPanClassName: noPanClassName, onViewportChange: onViewportChange, isControlledViewport: isControlledViewport, paneClickDistance: paneClickDistance, selectionOnDrag: _selectionOnDrag, children: jsxs(Pane, { onSelectionStart: onSelectionStart, onSelectionEnd: onSelectionEnd, onPaneClick: onPaneClick, onPaneMouseEnter: onPaneMouseEnter, onPaneMouseMove: onPaneMouseMove, onPaneMouseLeave: onPaneMouseLeave, onPaneContextMenu: onPaneContextMenu, onPaneScroll: onPaneScroll, panOnDrag: panOnDrag, isSelecting: !!isSelecting, selectionMode: selectionMode, selectionKeyPressed: selectionKeyPressed, paneClickDistance: paneClickDistance, selectionOnDrag: _selectionOnDrag, children: [children, nodesSelectionActive && (jsx(NodesSelection, { onSelectionContextMenu: onSelectionContextMenu, noPanClassName: noPanClassName, disableKeyboardA11y: disableKeyboardA11y }))] }) }));
}
FlowRendererComponent.displayName = 'FlowRenderer';
const FlowRenderer = memo(FlowRendererComponent);

const selector$d = (onlyRenderVisible) => (s) => {
    return onlyRenderVisible
        ? getNodesInside(s.nodeLookup, { x: 0, y: 0, width: s.width, height: s.height }, s.transform, true).map((node) => node.id)
        : Array.from(s.nodeLookup.keys());
};
/**
 * Hook for getting the visible node ids from the store.
 *
 * @internal
 * @param onlyRenderVisible
 * @returns array with visible node ids
 */
function useVisibleNodeIds(onlyRenderVisible) {
    const nodeIds = useStore(useCallback(selector$d(onlyRenderVisible), [onlyRenderVisible]), shallow);
    return nodeIds;
}

const selector$c = (s) => s.updateNodeInternals;
function useResizeObserver() {
    const updateNodeInternals = useStore(selector$c);
    const [resizeObserver] = useState(() => {
        if (typeof ResizeObserver === 'undefined') {
            return null;
        }
        return new ResizeObserver((entries) => {
            const updates = new Map();
            entries.forEach((entry) => {
                const id = entry.target.getAttribute('data-id');
                updates.set(id, {
                    id,
                    nodeElement: entry.target,
                    force: true,
                });
            });
            updateNodeInternals(updates);
        });
    });
    useEffect(() => {
        return () => {
            resizeObserver?.disconnect();
        };
    }, [resizeObserver]);
    return resizeObserver;
}

/**
 * Hook to handle the resize observation + internal updates for the passed node.
 *
 * @internal
 * @returns nodeRef - reference to the node element
 */
function useNodeObserver({ node, nodeType, hasDimensions, resizeObserver, }) {
    const store = useStoreApi();
    const nodeRef = useRef(null);
    const observedNode = useRef(null);
    const prevSourcePosition = useRef(node.sourcePosition);
    const prevTargetPosition = useRef(node.targetPosition);
    const prevType = useRef(nodeType);
    const isInitialized = hasDimensions && !!node.internals.handleBounds;
    useEffect(() => {
        if (nodeRef.current && !node.hidden && (!isInitialized || observedNode.current !== nodeRef.current)) {
            if (observedNode.current) {
                resizeObserver?.unobserve(observedNode.current);
            }
            resizeObserver?.observe(nodeRef.current);
            observedNode.current = nodeRef.current;
        }
    }, [isInitialized, node.hidden]);
    useEffect(() => {
        return () => {
            if (observedNode.current) {
                resizeObserver?.unobserve(observedNode.current);
                observedNode.current = null;
            }
        };
    }, []);
    useEffect(() => {
        if (nodeRef.current) {
            /*
             * when the user programmatically changes the source or handle position, we need to update the internals
             * to make sure the edges are updated correctly
             */
            const typeChanged = prevType.current !== nodeType;
            const sourcePosChanged = prevSourcePosition.current !== node.sourcePosition;
            const targetPosChanged = prevTargetPosition.current !== node.targetPosition;
            if (typeChanged || sourcePosChanged || targetPosChanged) {
                prevType.current = nodeType;
                prevSourcePosition.current = node.sourcePosition;
                prevTargetPosition.current = node.targetPosition;
                store
                    .getState()
                    .updateNodeInternals(new Map([[node.id, { id: node.id, nodeElement: nodeRef.current, force: true }]]));
            }
        }
    }, [node.id, nodeType, node.sourcePosition, node.targetPosition]);
    return nodeRef;
}

function NodeWrapper({ id, onClick, onMouseEnter, onMouseMove, onMouseLeave, onContextMenu, onDoubleClick, nodesDraggable, elementsSelectable, nodesConnectable, nodesFocusable, resizeObserver, noDragClassName, noPanClassName, disableKeyboardA11y, rfId, nodeTypes, nodeClickDistance, onError, }) {
    const { node, internals, isParent } = useStore((s) => {
        const node = s.nodeLookup.get(id);
        const isParent = s.parentLookup.has(id);
        return {
            node,
            internals: node.internals,
            isParent,
        };
    }, shallow);
    let nodeType = node.type || 'default';
    let NodeComponent = nodeTypes?.[nodeType] || builtinNodeTypes[nodeType];
    if (NodeComponent === undefined) {
        onError?.('003', errorMessages['error003'](nodeType));
        nodeType = 'default';
        NodeComponent = nodeTypes?.['default'] || builtinNodeTypes.default;
    }
    const isDraggable = !!(node.draggable || (nodesDraggable && typeof node.draggable === 'undefined'));
    const isSelectable = !!(node.selectable || (elementsSelectable && typeof node.selectable === 'undefined'));
    const isConnectable = !!(node.connectable || (nodesConnectable && typeof node.connectable === 'undefined'));
    const isFocusable = !!(node.focusable || (nodesFocusable && typeof node.focusable === 'undefined'));
    const store = useStoreApi();
    const hasDimensions = nodeHasDimensions(node);
    const nodeRef = useNodeObserver({ node, nodeType, hasDimensions, resizeObserver });
    const dragging = useDrag({
        nodeRef,
        disabled: node.hidden || !isDraggable,
        noDragClassName,
        handleSelector: node.dragHandle,
        nodeId: id,
        isSelectable,
        nodeClickDistance,
    });
    const moveSelectedNodes = useMoveSelectedNodes();
    if (node.hidden) {
        return null;
    }
    const nodeDimensions = getNodeDimensions(node);
    const inlineDimensions = getNodeInlineStyleDimensions(node);
    const hasPointerEvents = isSelectable || isDraggable || onClick || onMouseEnter || onMouseMove || onMouseLeave;
    const onMouseEnterHandler = onMouseEnter
        ? (event) => onMouseEnter(event, { ...internals.userNode })
        : undefined;
    const onMouseMoveHandler = onMouseMove
        ? (event) => onMouseMove(event, { ...internals.userNode })
        : undefined;
    const onMouseLeaveHandler = onMouseLeave
        ? (event) => onMouseLeave(event, { ...internals.userNode })
        : undefined;
    const onContextMenuHandler = onContextMenu
        ? (event) => onContextMenu(event, { ...internals.userNode })
        : undefined;
    const onDoubleClickHandler = onDoubleClick
        ? (event) => onDoubleClick(event, { ...internals.userNode })
        : undefined;
    const onSelectNodeHandler = (event) => {
        const { selectNodesOnDrag, nodeDragThreshold } = store.getState();
        if (isSelectable && (!selectNodesOnDrag || !isDraggable || nodeDragThreshold > 0)) {
            /*
             * this handler gets called by XYDrag on drag start when selectNodesOnDrag=true
             * here we only need to call it when selectNodesOnDrag=false
             */
            handleNodeClick({
                id,
                store,
                nodeRef,
            });
        }
        if (onClick) {
            onClick(event, { ...internals.userNode });
        }
    };
    const onKeyDown = (event) => {
        if (isInputDOMNode(event.nativeEvent) || disableKeyboardA11y) {
            return;
        }
        if (elementSelectionKeys.includes(event.key) && isSelectable) {
            const unselect = event.key === 'Escape';
            handleNodeClick({
                id,
                store,
                unselect,
                nodeRef,
            });
        }
        else if (isDraggable && node.selected && Object.prototype.hasOwnProperty.call(arrowKeyDiffs, event.key)) {
            // prevent default scrolling behavior on arrow key press when node is moved
            event.preventDefault();
            const { ariaLabelConfig } = store.getState();
            store.setState({
                ariaLiveMessage: ariaLabelConfig['node.a11yDescription.ariaLiveMessage']({
                    direction: event.key.replace('Arrow', '').toLowerCase(),
                    x: ~~internals.positionAbsolute.x,
                    y: ~~internals.positionAbsolute.y,
                }),
            });
            moveSelectedNodes({
                direction: arrowKeyDiffs[event.key],
                factor: event.shiftKey ? 4 : 1,
            });
        }
    };
    const onFocus = () => {
        if (disableKeyboardA11y || !nodeRef.current?.matches(':focus-visible')) {
            return;
        }
        const { transform, width, height, autoPanOnNodeFocus, setCenter } = store.getState();
        if (!autoPanOnNodeFocus) {
            return;
        }
        const withinViewport = getNodesInside(new Map([[id, node]]), { x: 0, y: 0, width, height }, transform, true).length > 0;
        if (!withinViewport) {
            setCenter(node.position.x + nodeDimensions.width / 2, node.position.y + nodeDimensions.height / 2, {
                zoom: transform[2],
            });
        }
    };
    return (jsx("div", { className: cc([
            'react-flow__node',
            `react-flow__node-${nodeType}`,
            {
                // this is overwritable by passing `nopan` as a class name
                [noPanClassName]: isDraggable,
            },
            node.className,
            {
                selected: node.selected,
                selectable: isSelectable,
                parent: isParent,
                draggable: isDraggable,
                dragging,
            },
        ]), ref: nodeRef, style: {
            zIndex: internals.z,
            transform: `translate(${internals.positionAbsolute.x}px,${internals.positionAbsolute.y}px)`,
            pointerEvents: hasPointerEvents ? 'all' : 'none',
            visibility: hasDimensions ? 'visible' : 'hidden',
            ...node.style,
            ...inlineDimensions,
        }, "data-id": id, "data-testid": `rf__node-${id}`, onMouseEnter: onMouseEnterHandler, onMouseMove: onMouseMoveHandler, onMouseLeave: onMouseLeaveHandler, onContextMenu: onContextMenuHandler, onClick: onSelectNodeHandler, onDoubleClick: onDoubleClickHandler, onKeyDown: isFocusable ? onKeyDown : undefined, tabIndex: isFocusable ? 0 : undefined, onFocus: isFocusable ? onFocus : undefined, role: node.ariaRole ?? (isFocusable ? 'group' : undefined), "aria-roledescription": "node", "aria-describedby": disableKeyboardA11y ? undefined : `${ARIA_NODE_DESC_KEY}-${rfId}`, "aria-label": node.ariaLabel, ...node.domAttributes, children: jsx(Provider, { value: id, children: jsx(NodeComponent, { id: id, data: node.data, type: nodeType, positionAbsoluteX: internals.positionAbsolute.x, positionAbsoluteY: internals.positionAbsolute.y, selected: node.selected ?? false, selectable: isSelectable, draggable: isDraggable, deletable: node.deletable ?? true, isConnectable: isConnectable, sourcePosition: node.sourcePosition, targetPosition: node.targetPosition, dragging: dragging, dragHandle: node.dragHandle, zIndex: internals.z, parentId: node.parentId, ...nodeDimensions }) }) }));
}
var NodeWrapper$1 = memo(NodeWrapper);

const selector$b = (s) => ({
    nodesDraggable: s.nodesDraggable,
    nodesConnectable: s.nodesConnectable,
    nodesFocusable: s.nodesFocusable,
    elementsSelectable: s.elementsSelectable,
    onError: s.onError,
});
function NodeRendererComponent(props) {
    const { nodesDraggable, nodesConnectable, nodesFocusable, elementsSelectable, onError } = useStore(selector$b, shallow);
    const nodeIds = useVisibleNodeIds(props.onlyRenderVisibleElements);
    const resizeObserver = useResizeObserver();
    return (jsx("div", { className: "react-flow__nodes", style: containerStyle, children: nodeIds.map((nodeId) => {
            return (
            /*
             * The split of responsibilities between NodeRenderer and
             * NodeComponentWrapper may appear weird. However, it’s designed to
             * minimize the cost of updates when individual nodes change.
             *
             * For example, when you’re dragging a single node, that node gets
             * updated multiple times per second. If `NodeRenderer` were to update
             * every time, it would have to re-run the `nodes.map()` loop every
             * time. This gets pricey with hundreds of nodes, especially if every
             * loop cycle does more than just rendering a JSX element!
             *
             * As a result of this choice, we took the following implementation
             * decisions:
             * - NodeRenderer subscribes *only* to node IDs – and therefore
             *   rerender *only* when visible nodes are added or removed.
             * - NodeRenderer performs all operations the result of which can be
             *   shared between nodes (such as creating the `ResizeObserver`
             *   instance, or subscribing to `selector`). This means extra prop
             *   drilling into `NodeComponentWrapper`, but it means we need to run
             *   these operations only once – instead of once per node.
             * - Any operations that you’d normally write inside `nodes.map` are
             *   moved into `NodeComponentWrapper`. This ensures they are
             *   memorized – so if `NodeRenderer` *has* to rerender, it only
             *   needs to regenerate the list of nodes, nothing else.
             */
            jsx(NodeWrapper$1, { id: nodeId, nodeTypes: props.nodeTypes, nodeExtent: props.nodeExtent, onClick: props.onNodeClick, onMouseEnter: props.onNodeMouseEnter, onMouseMove: props.onNodeMouseMove, onMouseLeave: props.onNodeMouseLeave, onContextMenu: props.onNodeContextMenu, onDoubleClick: props.onNodeDoubleClick, noDragClassName: props.noDragClassName, noPanClassName: props.noPanClassName, rfId: props.rfId, disableKeyboardA11y: props.disableKeyboardA11y, resizeObserver: resizeObserver, nodesDraggable: nodesDraggable, nodesConnectable: nodesConnectable, nodesFocusable: nodesFocusable, elementsSelectable: elementsSelectable, nodeClickDistance: props.nodeClickDistance, onError: onError }, nodeId));
        }) }));
}
NodeRendererComponent.displayName = 'NodeRenderer';
const NodeRenderer = memo(NodeRendererComponent);

/**
 * Hook for getting the visible edge ids from the store.
 *
 * @internal
 * @param onlyRenderVisible
 * @returns array with visible edge ids
 */
function useVisibleEdgeIds(onlyRenderVisible) {
    const edgeIds = useStore(useCallback((s) => {
        if (!onlyRenderVisible) {
            return s.edges.map((edge) => edge.id);
        }
        const visibleEdgeIds = [];
        if (s.width && s.height) {
            for (const edge of s.edges) {
                const sourceNode = s.nodeLookup.get(edge.source);
                const targetNode = s.nodeLookup.get(edge.target);
                if (sourceNode &&
                    targetNode &&
                    isEdgeVisible({
                        sourceNode,
                        targetNode,
                        width: s.width,
                        height: s.height,
                        transform: s.transform,
                    })) {
                    visibleEdgeIds.push(edge.id);
                }
            }
        }
        return visibleEdgeIds;
    }, [onlyRenderVisible]), shallow);
    return edgeIds;
}

const ArrowSymbol = ({ color = 'none', strokeWidth = 1 }) => {
    const style = {
        strokeWidth,
        ...(color && { stroke: color }),
    };
    return (jsx("polyline", { className: "arrow", style: style, strokeLinecap: "round", fill: "none", strokeLinejoin: "round", points: "-5,-4 0,0 -5,4" }));
};
const ArrowClosedSymbol = ({ color = 'none', strokeWidth = 1 }) => {
    const style = {
        strokeWidth,
        ...(color && { stroke: color, fill: color }),
    };
    return (jsx("polyline", { className: "arrowclosed", style: style, strokeLinecap: "round", strokeLinejoin: "round", points: "-5,-4 0,0 -5,4 -5,-4" }));
};
const MarkerSymbols = {
    [MarkerType.Arrow]: ArrowSymbol,
    [MarkerType.ArrowClosed]: ArrowClosedSymbol,
};
function useMarkerSymbol(type) {
    const store = useStoreApi();
    const symbol = useMemo(() => {
        const symbolExists = Object.prototype.hasOwnProperty.call(MarkerSymbols, type);
        if (!symbolExists) {
            store.getState().onError?.('009', errorMessages['error009'](type));
            return null;
        }
        return MarkerSymbols[type];
    }, [type]);
    return symbol;
}

const Marker = ({ id, type, color, width = 12.5, height = 12.5, markerUnits = 'strokeWidth', strokeWidth, orient = 'auto-start-reverse', }) => {
    const Symbol = useMarkerSymbol(type);
    if (!Symbol) {
        return null;
    }
    return (jsx("marker", { className: "react-flow__arrowhead", id: id, markerWidth: `${width}`, markerHeight: `${height}`, viewBox: "-10 -10 20 20", markerUnits: markerUnits, orient: orient, refX: "0", refY: "0", children: jsx(Symbol, { color: color, strokeWidth: strokeWidth }) }));
};
/*
 * when you have multiple flows on a page and you hide the first one, the other ones have no markers anymore
 * when they do have markers with the same ids. To prevent this the user can pass a unique id to the react flow wrapper
 * that we can then use for creating our unique marker ids
 */
const MarkerDefinitions = ({ defaultColor, rfId }) => {
    const edges = useStore((s) => s.edges);
    const defaultEdgeOptions = useStore((s) => s.defaultEdgeOptions);
    const markers = useMemo(() => {
        const markers = createMarkerIds(edges, {
            id: rfId,
            defaultColor,
            defaultMarkerStart: defaultEdgeOptions?.markerStart,
            defaultMarkerEnd: defaultEdgeOptions?.markerEnd,
        });
        return markers;
    }, [edges, defaultEdgeOptions, rfId, defaultColor]);
    if (!markers.length) {
        return null;
    }
    return (jsx("svg", { className: "react-flow__marker", "aria-hidden": "true", children: jsx("defs", { children: markers.map((marker) => (jsx(Marker, { id: marker.id, type: marker.type, color: marker.color, width: marker.width, height: marker.height, markerUnits: marker.markerUnits, strokeWidth: marker.strokeWidth, orient: marker.orient }, marker.id))) }) }));
};
MarkerDefinitions.displayName = 'MarkerDefinitions';
var MarkerDefinitions$1 = memo(MarkerDefinitions);

function EdgeTextComponent({ x, y, label, labelStyle, labelShowBg = true, labelBgStyle, labelBgPadding = [2, 4], labelBgBorderRadius = 2, children, className, ...rest }) {
    const [edgeTextBbox, setEdgeTextBbox] = useState({ x: 1, y: 0, width: 0, height: 0 });
    const edgeTextClasses = cc(['react-flow__edge-textwrapper', className]);
    const edgeTextRef = useRef(null);
    useEffect(() => {
        if (edgeTextRef.current) {
            const textBbox = edgeTextRef.current.getBBox();
            setEdgeTextBbox({
                x: textBbox.x,
                y: textBbox.y,
                width: textBbox.width,
                height: textBbox.height,
            });
        }
    }, [label]);
    if (!label) {
        return null;
    }
    return (jsxs("g", { transform: `translate(${x - edgeTextBbox.width / 2} ${y - edgeTextBbox.height / 2})`, className: edgeTextClasses, visibility: edgeTextBbox.width ? 'visible' : 'hidden', ...rest, children: [labelShowBg && (jsx("rect", { width: edgeTextBbox.width + 2 * labelBgPadding[0], x: -labelBgPadding[0], y: -labelBgPadding[1], height: edgeTextBbox.height + 2 * labelBgPadding[1], className: "react-flow__edge-textbg", style: labelBgStyle, rx: labelBgBorderRadius, ry: labelBgBorderRadius })), jsx("text", { className: "react-flow__edge-text", y: edgeTextBbox.height / 2, dy: "0.3em", ref: edgeTextRef, style: labelStyle, children: label }), children] }));
}
EdgeTextComponent.displayName = 'EdgeText';
/**
 * You can use the `<EdgeText />` component as a helper component to display text
 * within your custom edges.
 *
 * @public
 *
 * @example
 * ```jsx
 * import { EdgeText } from '@xyflow/react';
 *
 * export function CustomEdgeLabel({ label }) {
 *   return (
 *     <EdgeText
 *       x={100}
 *       y={100}
 *       label={label}
 *       labelStyle={{ fill: 'white' }}
 *       labelShowBg
 *       labelBgStyle={{ fill: 'red' }}
 *       labelBgPadding={[2, 4]}
 *       labelBgBorderRadius={2}
 *     />
 *   );
 * }
 *```
 */
const EdgeText = memo(EdgeTextComponent);

/**
 * The `<BaseEdge />` component gets used internally for all the edges. It can be
 * used inside a custom edge and handles the invisible helper edge and the edge label
 * for you.
 *
 * @public
 * @example
 * ```jsx
 *import { BaseEdge } from '@xyflow/react';
 *
 *export function CustomEdge({ sourceX, sourceY, targetX, targetY, ...props }) {
 *  const [edgePath] = getStraightPath({
 *    sourceX,
 *    sourceY,
 *    targetX,
 *    targetY,
 *  });
 *
 *  return <BaseEdge path={edgePath} {...props} />;
 *}
 *```
 *
 * @remarks If you want to use an edge marker with the [`<BaseEdge />`](/api-reference/components/base-edge) component,
 * you can pass the `markerStart` or `markerEnd` props passed to your custom edge
 * through to the [`<BaseEdge />`](/api-reference/components/base-edge) component.
 * You can see all the props passed to a custom edge by looking at the [`EdgeProps`](/api-reference/types/edge-props) type.
 */
function BaseEdge({ path, labelX, labelY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, interactionWidth = 20, ...props }) {
    return (jsxs(Fragment, { children: [jsx("path", { ...props, d: path, fill: "none", className: cc(['react-flow__edge-path', props.className]) }), interactionWidth ? (jsx("path", { d: path, fill: "none", strokeOpacity: 0, strokeWidth: interactionWidth, className: "react-flow__edge-interaction" })) : null, label && isNumeric(labelX) && isNumeric(labelY) ? (jsx(EdgeText, { x: labelX, y: labelY, label: label, labelStyle: labelStyle, labelShowBg: labelShowBg, labelBgStyle: labelBgStyle, labelBgPadding: labelBgPadding, labelBgBorderRadius: labelBgBorderRadius })) : null] }));
}

function getControl({ pos, x1, y1, x2, y2 }) {
    if (pos === Position.Left || pos === Position.Right) {
        return [0.5 * (x1 + x2), y1];
    }
    return [x1, 0.5 * (y1 + y2)];
}
/**
 * The `getSimpleBezierPath` util returns everything you need to render a simple
 * bezier edge between two nodes.
 * @public
 * @returns
 * - `path`: the path to use in an SVG `<path>` element.
 * - `labelX`: the `x` position you can use to render a label for this edge.
 * - `labelY`: the `y` position you can use to render a label for this edge.
 * - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
 * middle of this path.
 * - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
 * middle of this path.
 */
function getSimpleBezierPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, }) {
    const [sourceControlX, sourceControlY] = getControl({
        pos: sourcePosition,
        x1: sourceX,
        y1: sourceY,
        x2: targetX,
        y2: targetY,
    });
    const [targetControlX, targetControlY] = getControl({
        pos: targetPosition,
        x1: targetX,
        y1: targetY,
        x2: sourceX,
        y2: sourceY,
    });
    const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourceControlX,
        sourceControlY,
        targetControlX,
        targetControlY,
    });
    return [
        `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
        labelX,
        labelY,
        offsetX,
        offsetY,
    ];
}
function createSimpleBezierEdge(params) {
    // eslint-disable-next-line react/display-name
    return memo(({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, markerEnd, markerStart, interactionWidth, }) => {
        const [path, labelX, labelY] = getSimpleBezierPath({
            sourceX,
            sourceY,
            sourcePosition,
            targetX,
            targetY,
            targetPosition,
        });
        const _id = params.isInternal ? undefined : id;
        return (jsx(BaseEdge, { id: _id, path: path, labelX: labelX, labelY: labelY, label: label, labelStyle: labelStyle, labelShowBg: labelShowBg, labelBgStyle: labelBgStyle, labelBgPadding: labelBgPadding, labelBgBorderRadius: labelBgBorderRadius, style: style, markerEnd: markerEnd, markerStart: markerStart, interactionWidth: interactionWidth }));
    });
}
const SimpleBezierEdge = createSimpleBezierEdge({ isInternal: false });
const SimpleBezierEdgeInternal = createSimpleBezierEdge({ isInternal: true });
SimpleBezierEdge.displayName = 'SimpleBezierEdge';
SimpleBezierEdgeInternal.displayName = 'SimpleBezierEdgeInternal';

function createSmoothStepEdge(params) {
    // eslint-disable-next-line react/display-name
    return memo(({ id, sourceX, sourceY, targetX, targetY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, sourcePosition = Position.Bottom, targetPosition = Position.Top, markerEnd, markerStart, pathOptions, interactionWidth, }) => {
        const [path, labelX, labelY] = getSmoothStepPath({
            sourceX,
            sourceY,
            sourcePosition,
            targetX,
            targetY,
            targetPosition,
            borderRadius: pathOptions?.borderRadius,
            offset: pathOptions?.offset,
            stepPosition: pathOptions?.stepPosition,
        });
        const _id = params.isInternal ? undefined : id;
        return (jsx(BaseEdge, { id: _id, path: path, labelX: labelX, labelY: labelY, label: label, labelStyle: labelStyle, labelShowBg: labelShowBg, labelBgStyle: labelBgStyle, labelBgPadding: labelBgPadding, labelBgBorderRadius: labelBgBorderRadius, style: style, markerEnd: markerEnd, markerStart: markerStart, interactionWidth: interactionWidth }));
    });
}
/**
 * Component that can be used inside a custom edge to render a smooth step edge.
 *
 * @public
 * @example
 *
 * ```tsx
 * import { SmoothStepEdge } from '@xyflow/react';
 *
 * function CustomEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }) {
 *   return (
 *     <SmoothStepEdge
 *       sourceX={sourceX}
 *       sourceY={sourceY}
 *       targetX={targetX}
 *       targetY={targetY}
 *       sourcePosition={sourcePosition}
 *       targetPosition={targetPosition}
 *     />
 *   );
 * }
 * ```
 */
const SmoothStepEdge = createSmoothStepEdge({ isInternal: false });
/**
 * @internal
 */
const SmoothStepEdgeInternal = createSmoothStepEdge({ isInternal: true });
SmoothStepEdge.displayName = 'SmoothStepEdge';
SmoothStepEdgeInternal.displayName = 'SmoothStepEdgeInternal';

function createStepEdge(params) {
    // eslint-disable-next-line react/display-name
    return memo(({ id, ...props }) => {
        const _id = params.isInternal ? undefined : id;
        return (jsx(SmoothStepEdge, { ...props, id: _id, pathOptions: useMemo(() => ({ borderRadius: 0, offset: props.pathOptions?.offset }), [props.pathOptions?.offset]) }));
    });
}
/**
 * Component that can be used inside a custom edge to render a step edge.
 *
 * @public
 * @example
 *
 * ```tsx
 * import { StepEdge } from '@xyflow/react';
 *
 * function CustomEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }) {
 *   return (
 *     <StepEdge
 *       sourceX={sourceX}
 *       sourceY={sourceY}
 *       targetX={targetX}
 *       targetY={targetY}
 *       sourcePosition={sourcePosition}
 *       targetPosition={targetPosition}
 *     />
 *   );
 * }
 * ```
 */
const StepEdge = createStepEdge({ isInternal: false });
/**
 * @internal
 */
const StepEdgeInternal = createStepEdge({ isInternal: true });
StepEdge.displayName = 'StepEdge';
StepEdgeInternal.displayName = 'StepEdgeInternal';

function createStraightEdge(params) {
    // eslint-disable-next-line react/display-name
    return memo(({ id, sourceX, sourceY, targetX, targetY, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, markerEnd, markerStart, interactionWidth, }) => {
        const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
        const _id = params.isInternal ? undefined : id;
        return (jsx(BaseEdge, { id: _id, path: path, labelX: labelX, labelY: labelY, label: label, labelStyle: labelStyle, labelShowBg: labelShowBg, labelBgStyle: labelBgStyle, labelBgPadding: labelBgPadding, labelBgBorderRadius: labelBgBorderRadius, style: style, markerEnd: markerEnd, markerStart: markerStart, interactionWidth: interactionWidth }));
    });
}
/**
 * Component that can be used inside a custom edge to render a straight line.
 *
 * @public
 * @example
 *
 * ```tsx
 * import { StraightEdge } from '@xyflow/react';
 *
 * function CustomEdge({ sourceX, sourceY, targetX, targetY }) {
 *   return (
 *     <StraightEdge
 *       sourceX={sourceX}
 *       sourceY={sourceY}
 *       targetX={targetX}
 *       targetY={targetY}
 *     />
 *   );
 * }
 * ```
 */
const StraightEdge = createStraightEdge({ isInternal: false });
/**
 * @internal
 */
const StraightEdgeInternal = createStraightEdge({ isInternal: true });
StraightEdge.displayName = 'StraightEdge';
StraightEdgeInternal.displayName = 'StraightEdgeInternal';

function createBezierEdge(params) {
    // eslint-disable-next-line react/display-name
    return memo(({ id, sourceX, sourceY, targetX, targetY, sourcePosition = Position.Bottom, targetPosition = Position.Top, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, style, markerEnd, markerStart, pathOptions, interactionWidth, }) => {
        const [path, labelX, labelY] = getBezierPath({
            sourceX,
            sourceY,
            sourcePosition,
            targetX,
            targetY,
            targetPosition,
            curvature: pathOptions?.curvature,
        });
        const _id = params.isInternal ? undefined : id;
        return (jsx(BaseEdge, { id: _id, path: path, labelX: labelX, labelY: labelY, label: label, labelStyle: labelStyle, labelShowBg: labelShowBg, labelBgStyle: labelBgStyle, labelBgPadding: labelBgPadding, labelBgBorderRadius: labelBgBorderRadius, style: style, markerEnd: markerEnd, markerStart: markerStart, interactionWidth: interactionWidth }));
    });
}
/**
 * Component that can be used inside a custom edge to render a bezier curve.
 *
 * @public
 * @example
 *
 * ```tsx
 * import { BezierEdge } from '@xyflow/react';
 *
 * function CustomEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }) {
 *   return (
 *     <BezierEdge
 *       sourceX={sourceX}
 *       sourceY={sourceY}
 *       targetX={targetX}
 *       targetY={targetY}
 *       sourcePosition={sourcePosition}
 *       targetPosition={targetPosition}
 *     />
 *   );
 * }
 * ```
 */
const BezierEdge = createBezierEdge({ isInternal: false });
/**
 * @internal
 */
const BezierEdgeInternal = createBezierEdge({ isInternal: true });
BezierEdge.displayName = 'BezierEdge';
BezierEdgeInternal.displayName = 'BezierEdgeInternal';

const builtinEdgeTypes = {
    default: BezierEdgeInternal,
    straight: StraightEdgeInternal,
    step: StepEdgeInternal,
    smoothstep: SmoothStepEdgeInternal,
    simplebezier: SimpleBezierEdgeInternal,
};
const nullPosition = {
    sourceX: null,
    sourceY: null,
    targetX: null,
    targetY: null,
    sourcePosition: null,
    targetPosition: null,
};

const shiftX = (x, shift, position) => {
    if (position === Position.Left)
        return x - shift;
    if (position === Position.Right)
        return x + shift;
    return x;
};
const shiftY = (y, shift, position) => {
    if (position === Position.Top)
        return y - shift;
    if (position === Position.Bottom)
        return y + shift;
    return y;
};
const EdgeUpdaterClassName = 'react-flow__edgeupdater';
/**
 * @internal
 */
function EdgeAnchor({ position, centerX, centerY, radius = 10, onMouseDown, onMouseEnter, onMouseOut, type, }) {
    return (jsx("circle", { onMouseDown: onMouseDown, onMouseEnter: onMouseEnter, onMouseOut: onMouseOut, className: cc([EdgeUpdaterClassName, `${EdgeUpdaterClassName}-${type}`]), cx: shiftX(centerX, radius, position), cy: shiftY(centerY, radius, position), r: radius, stroke: "transparent", fill: "transparent" }));
}

function EdgeUpdateAnchors({ isReconnectable, reconnectRadius, edge, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, onReconnect, onReconnectStart, onReconnectEnd, setReconnecting, setUpdateHover, }) {
    const store = useStoreApi();
    const handleEdgeUpdater = (event, oppositeHandle) => {
        // avoid triggering edge updater if mouse btn is not left
        if (event.button !== 0) {
            return;
        }
        const { autoPanOnConnect, domNode, isValidConnection, connectionMode, connectionRadius, lib, onConnectStart, onConnectEnd, cancelConnection, nodeLookup, rfId: flowId, panBy, updateConnection, } = store.getState();
        const isTarget = oppositeHandle.type === 'target';
        const _onReconnectEnd = (evt, connectionState) => {
            setReconnecting(false);
            onReconnectEnd?.(evt, edge, oppositeHandle.type, connectionState);
        };
        const onConnectEdge = (connection) => onReconnect?.(edge, connection);
        const _onConnectStart = (_event, params) => {
            setReconnecting(true);
            onReconnectStart?.(event, edge, oppositeHandle.type);
            onConnectStart?.(_event, params);
        };
        XYHandle.onPointerDown(event.nativeEvent, {
            autoPanOnConnect,
            connectionMode,
            connectionRadius,
            domNode,
            handleId: oppositeHandle.id,
            nodeId: oppositeHandle.nodeId,
            nodeLookup,
            isTarget,
            edgeUpdaterType: oppositeHandle.type,
            lib,
            flowId,
            cancelConnection,
            panBy,
            isValidConnection,
            onConnect: onConnectEdge,
            onConnectStart: _onConnectStart,
            onConnectEnd,
            onReconnectEnd: _onReconnectEnd,
            updateConnection,
            getTransform: () => store.getState().transform,
            getFromHandle: () => store.getState().connection.fromHandle,
            dragThreshold: store.getState().connectionDragThreshold,
            handleDomNode: event.currentTarget,
        });
    };
    const onReconnectSourceMouseDown = (event) => handleEdgeUpdater(event, { nodeId: edge.target, id: edge.targetHandle ?? null, type: 'target' });
    const onReconnectTargetMouseDown = (event) => handleEdgeUpdater(event, { nodeId: edge.source, id: edge.sourceHandle ?? null, type: 'source' });
    const onReconnectMouseEnter = () => setUpdateHover(true);
    const onReconnectMouseOut = () => setUpdateHover(false);
    return (jsxs(Fragment, { children: [(isReconnectable === true || isReconnectable === 'source') && (jsx(EdgeAnchor, { position: sourcePosition, centerX: sourceX, centerY: sourceY, radius: reconnectRadius, onMouseDown: onReconnectSourceMouseDown, onMouseEnter: onReconnectMouseEnter, onMouseOut: onReconnectMouseOut, type: "source" })), (isReconnectable === true || isReconnectable === 'target') && (jsx(EdgeAnchor, { position: targetPosition, centerX: targetX, centerY: targetY, radius: reconnectRadius, onMouseDown: onReconnectTargetMouseDown, onMouseEnter: onReconnectMouseEnter, onMouseOut: onReconnectMouseOut, type: "target" }))] }));
}

function EdgeWrapper({ id, edgesFocusable, edgesReconnectable, elementsSelectable, onClick, onDoubleClick, onContextMenu, onMouseEnter, onMouseMove, onMouseLeave, reconnectRadius, onReconnect, onReconnectStart, onReconnectEnd, rfId, edgeTypes, noPanClassName, onError, disableKeyboardA11y, }) {
    let edge = useStore((s) => s.edgeLookup.get(id));
    const defaultEdgeOptions = useStore((s) => s.defaultEdgeOptions);
    edge = defaultEdgeOptions ? { ...defaultEdgeOptions, ...edge } : edge;
    let edgeType = edge.type || 'default';
    let EdgeComponent = edgeTypes?.[edgeType] || builtinEdgeTypes[edgeType];
    if (EdgeComponent === undefined) {
        onError?.('011', errorMessages['error011'](edgeType));
        edgeType = 'default';
        EdgeComponent = edgeTypes?.['default'] || builtinEdgeTypes.default;
    }
    const isFocusable = !!(edge.focusable || (edgesFocusable && typeof edge.focusable === 'undefined'));
    const isReconnectable = typeof onReconnect !== 'undefined' &&
        (edge.reconnectable || (edgesReconnectable && typeof edge.reconnectable === 'undefined'));
    const isSelectable = !!(edge.selectable || (elementsSelectable && typeof edge.selectable === 'undefined'));
    const edgeRef = useRef(null);
    const [updateHover, setUpdateHover] = useState(false);
    const [reconnecting, setReconnecting] = useState(false);
    const store = useStoreApi();
    const { zIndex, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = useStore(useCallback((store) => {
        const sourceNode = store.nodeLookup.get(edge.source);
        const targetNode = store.nodeLookup.get(edge.target);
        if (!sourceNode || !targetNode) {
            return {
                zIndex: edge.zIndex,
                ...nullPosition,
            };
        }
        const edgePosition = getEdgePosition({
            id,
            sourceNode,
            targetNode,
            sourceHandle: edge.sourceHandle || null,
            targetHandle: edge.targetHandle || null,
            connectionMode: store.connectionMode,
            onError,
        });
        const zIndex = getElevatedEdgeZIndex({
            selected: edge.selected,
            zIndex: edge.zIndex,
            sourceNode,
            targetNode,
            elevateOnSelect: store.elevateEdgesOnSelect,
        });
        return {
            zIndex,
            ...(edgePosition || nullPosition),
        };
    }, [edge.source, edge.target, edge.sourceHandle, edge.targetHandle, edge.selected, edge.zIndex]), shallow);
    const markerStartUrl = useMemo(() => (edge.markerStart ? `url('#${getMarkerId(edge.markerStart, rfId)}')` : undefined), [edge.markerStart, rfId]);
    const markerEndUrl = useMemo(() => (edge.markerEnd ? `url('#${getMarkerId(edge.markerEnd, rfId)}')` : undefined), [edge.markerEnd, rfId]);
    if (edge.hidden || sourceX === null || sourceY === null || targetX === null || targetY === null) {
        return null;
    }
    const onEdgeClick = (event) => {
        const { addSelectedEdges, unselectNodesAndEdges, multiSelectionActive } = store.getState();
        if (isSelectable) {
            store.setState({ nodesSelectionActive: false });
            if (edge.selected && multiSelectionActive) {
                unselectNodesAndEdges({ nodes: [], edges: [edge] });
                edgeRef.current?.blur();
            }
            else {
                addSelectedEdges([id]);
            }
        }
        if (onClick) {
            onClick(event, edge);
        }
    };
    const onEdgeDoubleClick = onDoubleClick
        ? (event) => {
            onDoubleClick(event, { ...edge });
        }
        : undefined;
    const onEdgeContextMenu = onContextMenu
        ? (event) => {
            onContextMenu(event, { ...edge });
        }
        : undefined;
    const onEdgeMouseEnter = onMouseEnter
        ? (event) => {
            onMouseEnter(event, { ...edge });
        }
        : undefined;
    const onEdgeMouseMove = onMouseMove
        ? (event) => {
            onMouseMove(event, { ...edge });
        }
        : undefined;
    const onEdgeMouseLeave = onMouseLeave
        ? (event) => {
            onMouseLeave(event, { ...edge });
        }
        : undefined;
    const onKeyDown = (event) => {
        if (!disableKeyboardA11y && elementSelectionKeys.includes(event.key) && isSelectable) {
            const { unselectNodesAndEdges, addSelectedEdges } = store.getState();
            const unselect = event.key === 'Escape';
            if (unselect) {
                edgeRef.current?.blur();
                unselectNodesAndEdges({ edges: [edge] });
            }
            else {
                addSelectedEdges([id]);
            }
        }
    };
    return (jsx("svg", { style: { zIndex }, children: jsxs("g", { className: cc([
                'react-flow__edge',
                `react-flow__edge-${edgeType}`,
                edge.className,
                noPanClassName,
                {
                    selected: edge.selected,
                    animated: edge.animated,
                    inactive: !isSelectable && !onClick,
                    updating: updateHover,
                    selectable: isSelectable,
                },
            ]), onClick: onEdgeClick, onDoubleClick: onEdgeDoubleClick, onContextMenu: onEdgeContextMenu, onMouseEnter: onEdgeMouseEnter, onMouseMove: onEdgeMouseMove, onMouseLeave: onEdgeMouseLeave, onKeyDown: isFocusable ? onKeyDown : undefined, tabIndex: isFocusable ? 0 : undefined, role: edge.ariaRole ?? (isFocusable ? 'group' : 'img'), "aria-roledescription": "edge", "data-id": id, "data-testid": `rf__edge-${id}`, "aria-label": edge.ariaLabel === null ? undefined : edge.ariaLabel || `Edge from ${edge.source} to ${edge.target}`, "aria-describedby": isFocusable ? `${ARIA_EDGE_DESC_KEY}-${rfId}` : undefined, ref: edgeRef, ...edge.domAttributes, children: [!reconnecting && (jsx(EdgeComponent, { id: id, source: edge.source, target: edge.target, type: edge.type, selected: edge.selected, animated: edge.animated, selectable: isSelectable, deletable: edge.deletable ?? true, label: edge.label, labelStyle: edge.labelStyle, labelShowBg: edge.labelShowBg, labelBgStyle: edge.labelBgStyle, labelBgPadding: edge.labelBgPadding, labelBgBorderRadius: edge.labelBgBorderRadius, sourceX: sourceX, sourceY: sourceY, targetX: targetX, targetY: targetY, sourcePosition: sourcePosition, targetPosition: targetPosition, data: edge.data, style: edge.style, sourceHandleId: edge.sourceHandle, targetHandleId: edge.targetHandle, markerStart: markerStartUrl, markerEnd: markerEndUrl, pathOptions: 'pathOptions' in edge ? edge.pathOptions : undefined, interactionWidth: edge.interactionWidth })), isReconnectable && (jsx(EdgeUpdateAnchors, { edge: edge, isReconnectable: isReconnectable, reconnectRadius: reconnectRadius, onReconnect: onReconnect, onReconnectStart: onReconnectStart, onReconnectEnd: onReconnectEnd, sourceX: sourceX, sourceY: sourceY, targetX: targetX, targetY: targetY, sourcePosition: sourcePosition, targetPosition: targetPosition, setUpdateHover: setUpdateHover, setReconnecting: setReconnecting }))] }) }));
}
var EdgeWrapper$1 = memo(EdgeWrapper);

const selector$a = (s) => ({
    edgesFocusable: s.edgesFocusable,
    edgesReconnectable: s.edgesReconnectable,
    elementsSelectable: s.elementsSelectable,
    connectionMode: s.connectionMode,
    onError: s.onError,
});
function EdgeRendererComponent({ defaultMarkerColor, onlyRenderVisibleElements, rfId, edgeTypes, noPanClassName, onReconnect, onEdgeContextMenu, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, onEdgeClick, reconnectRadius, onEdgeDoubleClick, onReconnectStart, onReconnectEnd, disableKeyboardA11y, }) {
    const { edgesFocusable, edgesReconnectable, elementsSelectable, onError } = useStore(selector$a, shallow);
    const edgeIds = useVisibleEdgeIds(onlyRenderVisibleElements);
    return (jsxs("div", { className: "react-flow__edges", children: [jsx(MarkerDefinitions$1, { defaultColor: defaultMarkerColor, rfId: rfId }), edgeIds.map((id) => {
                return (jsx(EdgeWrapper$1, { id: id, edgesFocusable: edgesFocusable, edgesReconnectable: edgesReconnectable, elementsSelectable: elementsSelectable, noPanClassName: noPanClassName, onReconnect: onReconnect, onContextMenu: onEdgeContextMenu, onMouseEnter: onEdgeMouseEnter, onMouseMove: onEdgeMouseMove, onMouseLeave: onEdgeMouseLeave, onClick: onEdgeClick, reconnectRadius: reconnectRadius, onDoubleClick: onEdgeDoubleClick, onReconnectStart: onReconnectStart, onReconnectEnd: onReconnectEnd, rfId: rfId, onError: onError, edgeTypes: edgeTypes, disableKeyboardA11y: disableKeyboardA11y }, id));
            })] }));
}
EdgeRendererComponent.displayName = 'EdgeRenderer';
const EdgeRenderer = memo(EdgeRendererComponent);

const selector$9 = (s) => `translate(${s.transform[0]}px,${s.transform[1]}px) scale(${s.transform[2]})`;
function Viewport({ children }) {
    const transform = useStore(selector$9);
    return (jsx("div", { className: "react-flow__viewport xyflow__viewport react-flow__container", style: { transform }, children: children }));
}

/**
 * Hook for calling onInit handler.
 *
 * @internal
 */
function useOnInitHandler(onInit) {
    const rfInstance = useReactFlow();
    const isInitialized = useRef(false);
    useEffect(() => {
        if (!isInitialized.current && rfInstance.viewportInitialized && onInit) {
            setTimeout(() => onInit(rfInstance), 1);
            isInitialized.current = true;
        }
    }, [onInit, rfInstance.viewportInitialized]);
}

const selector$8 = (state) => state.panZoom?.syncViewport;
/**
 * Hook for syncing the viewport with the panzoom instance.
 *
 * @internal
 * @param viewport
 */
function useViewportSync(viewport) {
    const syncViewport = useStore(selector$8);
    const store = useStoreApi();
    useEffect(() => {
        if (viewport) {
            syncViewport?.(viewport);
            store.setState({ transform: [viewport.x, viewport.y, viewport.zoom] });
        }
    }, [viewport, syncViewport]);
    return null;
}

function storeSelector$1(s) {
    return s.connection.inProgress
        ? { ...s.connection, to: pointToRendererPoint(s.connection.to, s.transform) }
        : { ...s.connection };
}
function getSelector(connectionSelector) {
    if (connectionSelector) {
        const combinedSelector = (s) => {
            const connection = storeSelector$1(s);
            return connectionSelector(connection);
        };
        return combinedSelector;
    }
    return storeSelector$1;
}
/**
 * The `useConnection` hook returns the current connection when there is an active
 * connection interaction. If no connection interaction is active, it returns null
 * for every property. A typical use case for this hook is to colorize handles
 * based on a certain condition (e.g. if the connection is valid or not).
 *
 * @public
 * @param connectionSelector - An optional selector function used to extract a slice of the
 * `ConnectionState` data. Using a selector can prevent component re-renders where data you don't
 * otherwise care about might change. If a selector is not provided, the entire `ConnectionState`
 * object is returned unchanged.
 * @example
 *
 * ```tsx
 *import { useConnection } from '@xyflow/react';
 *
 *function App() {
 *  const connection = useConnection();
 *
 *  return (
 *    <div> {connection ? `Someone is trying to make a connection from ${connection.fromNode} to this one.` : 'There are currently no incoming connections!'}
 *
 *   </div>
 *   );
 * }
 * ```
 *
 * @returns ConnectionState
 */
function useConnection(connectionSelector) {
    const combinedSelector = getSelector(connectionSelector);
    return useStore(combinedSelector, shallow);
}

const selector$7 = (s) => ({
    nodesConnectable: s.nodesConnectable,
    isValid: s.connection.isValid,
    inProgress: s.connection.inProgress,
    width: s.width,
    height: s.height,
});
function ConnectionLineWrapper({ containerStyle, style, type, component, }) {
    const { nodesConnectable, width, height, isValid, inProgress } = useStore(selector$7, shallow);
    const renderConnection = !!(width && nodesConnectable && inProgress);
    if (!renderConnection) {
        return null;
    }
    return (jsx("svg", { style: containerStyle, width: width, height: height, className: "react-flow__connectionline react-flow__container", children: jsx("g", { className: cc(['react-flow__connection', getConnectionStatus(isValid)]), children: jsx(ConnectionLine, { style: style, type: type, CustomComponent: component, isValid: isValid }) }) }));
}
const ConnectionLine = ({ style, type = ConnectionLineType.Bezier, CustomComponent, isValid, }) => {
    const { inProgress, from, fromNode, fromHandle, fromPosition, to, toNode, toHandle, toPosition, pointer } = useConnection();
    if (!inProgress) {
        return;
    }
    if (CustomComponent) {
        return (jsx(CustomComponent, { connectionLineType: type, connectionLineStyle: style, fromNode: fromNode, fromHandle: fromHandle, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, fromPosition: fromPosition, toPosition: toPosition, connectionStatus: getConnectionStatus(isValid), toNode: toNode, toHandle: toHandle, pointer: pointer }));
    }
    let path = '';
    const pathParams = {
        sourceX: from.x,
        sourceY: from.y,
        sourcePosition: fromPosition,
        targetX: to.x,
        targetY: to.y,
        targetPosition: toPosition,
    };
    switch (type) {
        case ConnectionLineType.Bezier:
            [path] = getBezierPath(pathParams);
            break;
        case ConnectionLineType.SimpleBezier:
            [path] = getSimpleBezierPath(pathParams);
            break;
        case ConnectionLineType.Step:
            [path] = getSmoothStepPath({
                ...pathParams,
                borderRadius: 0,
            });
            break;
        case ConnectionLineType.SmoothStep:
            [path] = getSmoothStepPath(pathParams);
            break;
        default:
            [path] = getStraightPath(pathParams);
    }
    return jsx("path", { d: path, fill: "none", className: "react-flow__connection-path", style: style });
};
ConnectionLine.displayName = 'ConnectionLine';

const emptyTypes = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useNodeOrEdgeTypesWarning(nodeOrEdgeTypes = emptyTypes) {
    const typesRef = useRef(nodeOrEdgeTypes);
    const store = useStoreApi();
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const usedKeys = new Set([...Object.keys(typesRef.current), ...Object.keys(nodeOrEdgeTypes)]);
            for (const key of usedKeys) {
                if (typesRef.current[key] !== nodeOrEdgeTypes[key]) {
                    store.getState().onError?.('002', errorMessages['error002']());
                    break;
                }
            }
            typesRef.current = nodeOrEdgeTypes;
        }
    }, [nodeOrEdgeTypes]);
}

function useStylesLoadedWarning() {
    const store = useStoreApi();
    const checked = useRef(false);
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            if (!checked.current) {
                const pane = document.querySelector('.react-flow__pane');
                if (pane && !(window.getComputedStyle(pane).zIndex === '1')) {
                    store.getState().onError?.('013', errorMessages['error013']('react'));
                }
                checked.current = true;
            }
        }
    }, []);
}

function GraphViewComponent({ nodeTypes, edgeTypes, onInit, onNodeClick, onEdgeClick, onNodeDoubleClick, onEdgeDoubleClick, onNodeMouseEnter, onNodeMouseMove, onNodeMouseLeave, onNodeContextMenu, onSelectionContextMenu, onSelectionStart, onSelectionEnd, connectionLineType, connectionLineStyle, connectionLineComponent, connectionLineContainerStyle, selectionKeyCode, selectionOnDrag, selectionMode, multiSelectionKeyCode, panActivationKeyCode, zoomActivationKeyCode, deleteKeyCode, onlyRenderVisibleElements, elementsSelectable, defaultViewport, translateExtent, minZoom, maxZoom, preventScrolling, defaultMarkerColor, zoomOnScroll, zoomOnPinch, panOnScroll, panOnScrollSpeed, panOnScrollMode, zoomOnDoubleClick, panOnDrag, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneScroll, onPaneContextMenu, paneClickDistance, nodeClickDistance, onEdgeContextMenu, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, reconnectRadius, onReconnect, onReconnectStart, onReconnectEnd, noDragClassName, noWheelClassName, noPanClassName, disableKeyboardA11y, nodeExtent, rfId, viewport, onViewportChange, }) {
    useNodeOrEdgeTypesWarning(nodeTypes);
    useNodeOrEdgeTypesWarning(edgeTypes);
    useStylesLoadedWarning();
    useOnInitHandler(onInit);
    useViewportSync(viewport);
    return (jsx(FlowRenderer, { onPaneClick: onPaneClick, onPaneMouseEnter: onPaneMouseEnter, onPaneMouseMove: onPaneMouseMove, onPaneMouseLeave: onPaneMouseLeave, onPaneContextMenu: onPaneContextMenu, onPaneScroll: onPaneScroll, paneClickDistance: paneClickDistance, deleteKeyCode: deleteKeyCode, selectionKeyCode: selectionKeyCode, selectionOnDrag: selectionOnDrag, selectionMode: selectionMode, onSelectionStart: onSelectionStart, onSelectionEnd: onSelectionEnd, multiSelectionKeyCode: multiSelectionKeyCode, panActivationKeyCode: panActivationKeyCode, zoomActivationKeyCode: zoomActivationKeyCode, elementsSelectable: elementsSelectable, zoomOnScroll: zoomOnScroll, zoomOnPinch: zoomOnPinch, zoomOnDoubleClick: zoomOnDoubleClick, panOnScroll: panOnScroll, panOnScrollSpeed: panOnScrollSpeed, panOnScrollMode: panOnScrollMode, panOnDrag: panOnDrag, defaultViewport: defaultViewport, translateExtent: translateExtent, minZoom: minZoom, maxZoom: maxZoom, onSelectionContextMenu: onSelectionContextMenu, preventScrolling: preventScrolling, noDragClassName: noDragClassName, noWheelClassName: noWheelClassName, noPanClassName: noPanClassName, disableKeyboardA11y: disableKeyboardA11y, onViewportChange: onViewportChange, isControlledViewport: !!viewport, children: jsxs(Viewport, { children: [jsx(EdgeRenderer, { edgeTypes: edgeTypes, onEdgeClick: onEdgeClick, onEdgeDoubleClick: onEdgeDoubleClick, onReconnect: onReconnect, onReconnectStart: onReconnectStart, onReconnectEnd: onReconnectEnd, onlyRenderVisibleElements: onlyRenderVisibleElements, onEdgeContextMenu: onEdgeContextMenu, onEdgeMouseEnter: onEdgeMouseEnter, onEdgeMouseMove: onEdgeMouseMove, onEdgeMouseLeave: onEdgeMouseLeave, reconnectRadius: reconnectRadius, defaultMarkerColor: defaultMarkerColor, noPanClassName: noPanClassName, disableKeyboardA11y: disableKeyboardA11y, rfId: rfId }), jsx(ConnectionLineWrapper, { style: connectionLineStyle, type: connectionLineType, component: connectionLineComponent, containerStyle: connectionLineContainerStyle }), jsx("div", { className: "react-flow__edgelabel-renderer" }), jsx(NodeRenderer, { nodeTypes: nodeTypes, onNodeClick: onNodeClick, onNodeDoubleClick: onNodeDoubleClick, onNodeMouseEnter: onNodeMouseEnter, onNodeMouseMove: onNodeMouseMove, onNodeMouseLeave: onNodeMouseLeave, onNodeContextMenu: onNodeContextMenu, nodeClickDistance: nodeClickDistance, onlyRenderVisibleElements: onlyRenderVisibleElements, noPanClassName: noPanClassName, noDragClassName: noDragClassName, disableKeyboardA11y: disableKeyboardA11y, nodeExtent: nodeExtent, rfId: rfId }), jsx("div", { className: "react-flow__viewport-portal" })] }) }));
}
GraphViewComponent.displayName = 'GraphView';
const GraphView = memo(GraphViewComponent);

const getInitialState = ({ nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom = 0.5, maxZoom = 2, nodeOrigin, nodeExtent, } = {}) => {
    const nodeLookup = new Map();
    const parentLookup = new Map();
    const connectionLookup = new Map();
    const edgeLookup = new Map();
    const storeEdges = defaultEdges ?? edges ?? [];
    const storeNodes = defaultNodes ?? nodes ?? [];
    const storeNodeOrigin = nodeOrigin ?? [0, 0];
    const storeNodeExtent = nodeExtent ?? infiniteExtent;
    updateConnectionLookup(connectionLookup, edgeLookup, storeEdges);
    const nodesInitialized = adoptUserNodes(storeNodes, nodeLookup, parentLookup, {
        nodeOrigin: storeNodeOrigin,
        nodeExtent: storeNodeExtent,
        elevateNodesOnSelect: false,
    });
    let transform = [0, 0, 1];
    if (fitView && width && height) {
        const bounds = getInternalNodesBounds(nodeLookup, {
            filter: (node) => !!((node.width || node.initialWidth) && (node.height || node.initialHeight)),
        });
        const { x, y, zoom } = getViewportForBounds(bounds, width, height, minZoom, maxZoom, fitViewOptions?.padding ?? 0.1);
        transform = [x, y, zoom];
    }
    return {
        rfId: '1',
        width: width ?? 0,
        height: height ?? 0,
        transform,
        nodes: storeNodes,
        nodesInitialized,
        nodeLookup,
        parentLookup,
        edges: storeEdges,
        edgeLookup,
        connectionLookup,
        onNodesChange: null,
        onEdgesChange: null,
        hasDefaultNodes: defaultNodes !== undefined,
        hasDefaultEdges: defaultEdges !== undefined,
        panZoom: null,
        minZoom,
        maxZoom,
        translateExtent: infiniteExtent,
        nodeExtent: storeNodeExtent,
        nodesSelectionActive: false,
        userSelectionActive: false,
        userSelectionRect: null,
        connectionMode: ConnectionMode.Strict,
        domNode: null,
        paneDragging: false,
        noPanClassName: 'nopan',
        nodeOrigin: storeNodeOrigin,
        nodeDragThreshold: 1,
        connectionDragThreshold: 1,
        snapGrid: [15, 15],
        snapToGrid: false,
        nodesDraggable: true,
        nodesConnectable: true,
        nodesFocusable: true,
        edgesFocusable: true,
        edgesReconnectable: true,
        elementsSelectable: true,
        elevateNodesOnSelect: true,
        elevateEdgesOnSelect: false,
        selectNodesOnDrag: true,
        multiSelectionActive: false,
        fitViewQueued: fitView ?? false,
        fitViewOptions,
        fitViewResolver: null,
        connection: { ...initialConnection },
        connectionClickStartHandle: null,
        connectOnClick: true,
        ariaLiveMessage: '',
        autoPanOnConnect: true,
        autoPanOnNodeDrag: true,
        autoPanOnNodeFocus: true,
        autoPanSpeed: 15,
        connectionRadius: 20,
        onError: devWarn,
        isValidConnection: undefined,
        onSelectionChangeHandlers: [],
        lib: 'react',
        debug: false,
        ariaLabelConfig: defaultAriaLabelConfig,
    };
};

const createStore = ({ nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom, maxZoom, nodeOrigin, nodeExtent, }) => createWithEqualityFn((set, get) => {
    async function resolveFitView() {
        const { nodeLookup, panZoom, fitViewOptions, fitViewResolver, width, height, minZoom, maxZoom } = get();
        if (!panZoom) {
            return;
        }
        await fitViewport({
            nodes: nodeLookup,
            width,
            height,
            panZoom,
            minZoom,
            maxZoom,
        }, fitViewOptions);
        fitViewResolver?.resolve(true);
        /**
         * wait for the fitViewport to resolve before deleting the resolver,
         * we want to reuse the old resolver if the user calls fitView again in the mean time
         */
        set({ fitViewResolver: null });
    }
    return {
        ...getInitialState({
            nodes,
            edges,
            width,
            height,
            fitView,
            fitViewOptions,
            minZoom,
            maxZoom,
            nodeOrigin,
            nodeExtent,
            defaultNodes,
            defaultEdges,
        }),
        setNodes: (nodes) => {
            const { nodeLookup, parentLookup, nodeOrigin, elevateNodesOnSelect, fitViewQueued } = get();
            /*
             * setNodes() is called exclusively in response to user actions:
             * - either when the `<ReactFlow nodes>` prop is updated in the controlled ReactFlow setup,
             * - or when the user calls something like `reactFlowInstance.setNodes()` in an uncontrolled ReactFlow setup.
             *
             * When this happens, we take the note objects passed by the user and extend them with fields
             * relevant for internal React Flow operations.
             */
            const nodesInitialized = adoptUserNodes(nodes, nodeLookup, parentLookup, {
                nodeOrigin,
                nodeExtent,
                elevateNodesOnSelect,
                checkEquality: true,
            });
            if (fitViewQueued && nodesInitialized) {
                resolveFitView();
                set({ nodes, nodesInitialized, fitViewQueued: false, fitViewOptions: undefined });
            }
            else {
                set({ nodes, nodesInitialized });
            }
        },
        setEdges: (edges) => {
            const { connectionLookup, edgeLookup } = get();
            updateConnectionLookup(connectionLookup, edgeLookup, edges);
            set({ edges });
        },
        setDefaultNodesAndEdges: (nodes, edges) => {
            if (nodes) {
                const { setNodes } = get();
                setNodes(nodes);
                set({ hasDefaultNodes: true });
            }
            if (edges) {
                const { setEdges } = get();
                setEdges(edges);
                set({ hasDefaultEdges: true });
            }
        },
        /*
         * Every node gets registerd at a ResizeObserver. Whenever a node
         * changes its dimensions, this function is called to measure the
         * new dimensions and update the nodes.
         */
        updateNodeInternals: (updates) => {
            const { triggerNodeChanges, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent, debug, fitViewQueued } = get();
            const { changes, updatedInternals } = updateNodeInternals(updates, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent);
            if (!updatedInternals) {
                return;
            }
            updateAbsolutePositions(nodeLookup, parentLookup, { nodeOrigin, nodeExtent });
            if (fitViewQueued) {
                resolveFitView();
                set({ fitViewQueued: false, fitViewOptions: undefined });
            }
            else {
                // we always want to trigger useStore calls whenever updateNodeInternals is called
                set({});
            }
            if (changes?.length > 0) {
                if (debug) {
                    console.log('React Flow: trigger node changes', changes);
                }
                triggerNodeChanges?.(changes);
            }
        },
        updateNodePositions: (nodeDragItems, dragging = false) => {
            const parentExpandChildren = [];
            const changes = [];
            const { nodeLookup, triggerNodeChanges } = get();
            for (const [id, dragItem] of nodeDragItems) {
                // we are using the nodelookup to be sure to use the current expandParent and parentId value
                const node = nodeLookup.get(id);
                const expandParent = !!(node?.expandParent && node?.parentId && dragItem?.position);
                const change = {
                    id,
                    type: 'position',
                    position: expandParent
                        ? {
                            x: Math.max(0, dragItem.position.x),
                            y: Math.max(0, dragItem.position.y),
                        }
                        : dragItem.position,
                    dragging,
                };
                if (expandParent && node.parentId) {
                    parentExpandChildren.push({
                        id,
                        parentId: node.parentId,
                        rect: {
                            ...dragItem.internals.positionAbsolute,
                            width: dragItem.measured.width ?? 0,
                            height: dragItem.measured.height ?? 0,
                        },
                    });
                }
                changes.push(change);
            }
            if (parentExpandChildren.length > 0) {
                const { parentLookup, nodeOrigin } = get();
                const parentExpandChanges = handleExpandParent(parentExpandChildren, nodeLookup, parentLookup, nodeOrigin);
                changes.push(...parentExpandChanges);
            }
            triggerNodeChanges(changes);
        },
        triggerNodeChanges: (changes) => {
            const { onNodesChange, setNodes, nodes, hasDefaultNodes, debug } = get();
            if (changes?.length) {
                if (hasDefaultNodes) {
                    const updatedNodes = applyNodeChanges(changes, nodes);
                    setNodes(updatedNodes);
                }
                if (debug) {
                    console.log('React Flow: trigger node changes', changes);
                }
                onNodesChange?.(changes);
            }
        },
        triggerEdgeChanges: (changes) => {
            const { onEdgesChange, setEdges, edges, hasDefaultEdges, debug } = get();
            if (changes?.length) {
                if (hasDefaultEdges) {
                    const updatedEdges = applyEdgeChanges(changes, edges);
                    setEdges(updatedEdges);
                }
                if (debug) {
                    console.log('React Flow: trigger edge changes', changes);
                }
                onEdgesChange?.(changes);
            }
        },
        addSelectedNodes: (selectedNodeIds) => {
            const { multiSelectionActive, edgeLookup, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get();
            if (multiSelectionActive) {
                const nodeChanges = selectedNodeIds.map((nodeId) => createSelectionChange(nodeId, true));
                triggerNodeChanges(nodeChanges);
                return;
            }
            triggerNodeChanges(getSelectionChanges(nodeLookup, new Set([...selectedNodeIds]), true));
            triggerEdgeChanges(getSelectionChanges(edgeLookup));
        },
        addSelectedEdges: (selectedEdgeIds) => {
            const { multiSelectionActive, edgeLookup, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get();
            if (multiSelectionActive) {
                const changedEdges = selectedEdgeIds.map((edgeId) => createSelectionChange(edgeId, true));
                triggerEdgeChanges(changedEdges);
                return;
            }
            triggerEdgeChanges(getSelectionChanges(edgeLookup, new Set([...selectedEdgeIds])));
            triggerNodeChanges(getSelectionChanges(nodeLookup, new Set(), true));
        },
        unselectNodesAndEdges: ({ nodes, edges } = {}) => {
            const { edges: storeEdges, nodes: storeNodes, nodeLookup, triggerNodeChanges, triggerEdgeChanges } = get();
            const nodesToUnselect = nodes ? nodes : storeNodes;
            const edgesToUnselect = edges ? edges : storeEdges;
            const nodeChanges = nodesToUnselect.map((n) => {
                const internalNode = nodeLookup.get(n.id);
                if (internalNode) {
                    /*
                     * we need to unselect the internal node that was selected previously before we
                     * send the change to the user to prevent it to be selected while dragging the new node
                     */
                    internalNode.selected = false;
                }
                return createSelectionChange(n.id, false);
            });
            const edgeChanges = edgesToUnselect.map((edge) => createSelectionChange(edge.id, false));
            triggerNodeChanges(nodeChanges);
            triggerEdgeChanges(edgeChanges);
        },
        setMinZoom: (minZoom) => {
            const { panZoom, maxZoom } = get();
            panZoom?.setScaleExtent([minZoom, maxZoom]);
            set({ minZoom });
        },
        setMaxZoom: (maxZoom) => {
            const { panZoom, minZoom } = get();
            panZoom?.setScaleExtent([minZoom, maxZoom]);
            set({ maxZoom });
        },
        setTranslateExtent: (translateExtent) => {
            get().panZoom?.setTranslateExtent(translateExtent);
            set({ translateExtent });
        },
        resetSelectedElements: () => {
            const { edges, nodes, triggerNodeChanges, triggerEdgeChanges, elementsSelectable } = get();
            if (!elementsSelectable) {
                return;
            }
            const nodeChanges = nodes.reduce((res, node) => (node.selected ? [...res, createSelectionChange(node.id, false)] : res), []);
            const edgeChanges = edges.reduce((res, edge) => (edge.selected ? [...res, createSelectionChange(edge.id, false)] : res), []);
            triggerNodeChanges(nodeChanges);
            triggerEdgeChanges(edgeChanges);
        },
        setNodeExtent: (nextNodeExtent) => {
            const { nodes, nodeLookup, parentLookup, nodeOrigin, elevateNodesOnSelect, nodeExtent } = get();
            if (nextNodeExtent[0][0] === nodeExtent[0][0] &&
                nextNodeExtent[0][1] === nodeExtent[0][1] &&
                nextNodeExtent[1][0] === nodeExtent[1][0] &&
                nextNodeExtent[1][1] === nodeExtent[1][1]) {
                return;
            }
            adoptUserNodes(nodes, nodeLookup, parentLookup, {
                nodeOrigin,
                nodeExtent: nextNodeExtent,
                elevateNodesOnSelect,
                checkEquality: false,
            });
            set({ nodeExtent: nextNodeExtent });
        },
        panBy: (delta) => {
            const { transform, width, height, panZoom, translateExtent } = get();
            return panBy({ delta, panZoom, transform, translateExtent, width, height });
        },
        setCenter: async (x, y, options) => {
            const { width, height, maxZoom, panZoom } = get();
            if (!panZoom) {
                return Promise.resolve(false);
            }
            const nextZoom = typeof options?.zoom !== 'undefined' ? options.zoom : maxZoom;
            await panZoom.setViewport({
                x: width / 2 - x * nextZoom,
                y: height / 2 - y * nextZoom,
                zoom: nextZoom,
            }, { duration: options?.duration, ease: options?.ease, interpolate: options?.interpolate });
            return Promise.resolve(true);
        },
        cancelConnection: () => {
            set({
                connection: { ...initialConnection },
            });
        },
        updateConnection: (connection) => {
            set({ connection });
        },
        reset: () => set({ ...getInitialState() }),
    };
}, Object.is);

/**
 * The `<ReactFlowProvider />` component is a [context provider](https://react.dev/learn/passing-data-deeply-with-context#)
 * that makes it possible to access a flow's internal state outside of the
 * [`<ReactFlow />`](/api-reference/react-flow) component. Many of the hooks we
 * provide rely on this component to work.
 * @public
 *
 * @example
 * ```tsx
 *import { ReactFlow, ReactFlowProvider, useNodes } from '@xyflow/react'
 *
 *export default function Flow() {
 *  return (
 *    <ReactFlowProvider>
 *      <ReactFlow nodes={...} edges={...} />
 *      <Sidebar />
 *    </ReactFlowProvider>
 *  );
 *}
 *
 *function Sidebar() {
 *  // This hook will only work if the component it's used in is a child of a
 *  // <ReactFlowProvider />.
 *  const nodes = useNodes()
 *
 *  return <aside>do something with nodes</aside>;
 *}
 *```
 *
 * @remarks If you're using a router and want your flow's state to persist across routes,
 * it's vital that you place the `<ReactFlowProvider />` component _outside_ of
 * your router. If you have multiple flows on the same page you will need to use a separate
 * `<ReactFlowProvider />` for each flow.
 */
function ReactFlowProvider({ initialNodes: nodes, initialEdges: edges, defaultNodes, defaultEdges, initialWidth: width, initialHeight: height, initialMinZoom: minZoom, initialMaxZoom: maxZoom, initialFitViewOptions: fitViewOptions, fitView, nodeOrigin, nodeExtent, children, }) {
    const [store] = useState(() => createStore({
        nodes,
        edges,
        defaultNodes,
        defaultEdges,
        width,
        height,
        fitView,
        minZoom,
        maxZoom,
        fitViewOptions,
        nodeOrigin,
        nodeExtent,
    }));
    return (jsx(Provider$1, { value: store, children: jsx(BatchProvider, { children: children }) }));
}

function Wrapper({ children, nodes, edges, defaultNodes, defaultEdges, width, height, fitView, fitViewOptions, minZoom, maxZoom, nodeOrigin, nodeExtent, }) {
    const isWrapped = useContext(StoreContext);
    if (isWrapped) {
        /*
         * we need to wrap it with a fragment because it's not allowed for children to be a ReactNode
         * https://github.com/DefinitelyTyped/DefinitelyTyped/issues/18051
         */
        return jsx(Fragment, { children: children });
    }
    return (jsx(ReactFlowProvider, { initialNodes: nodes, initialEdges: edges, defaultNodes: defaultNodes, defaultEdges: defaultEdges, initialWidth: width, initialHeight: height, fitView: fitView, initialFitViewOptions: fitViewOptions, initialMinZoom: minZoom, initialMaxZoom: maxZoom, nodeOrigin: nodeOrigin, nodeExtent: nodeExtent, children: children }));
}

const wrapperStyle = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 0,
};
function ReactFlow({ nodes, edges, defaultNodes, defaultEdges, className, nodeTypes, edgeTypes, onNodeClick, onEdgeClick, onInit, onMove, onMoveStart, onMoveEnd, onConnect, onConnectStart, onConnectEnd, onClickConnectStart, onClickConnectEnd, onNodeMouseEnter, onNodeMouseMove, onNodeMouseLeave, onNodeContextMenu, onNodeDoubleClick, onNodeDragStart, onNodeDrag, onNodeDragStop, onNodesDelete, onEdgesDelete, onDelete, onSelectionChange, onSelectionDragStart, onSelectionDrag, onSelectionDragStop, onSelectionContextMenu, onSelectionStart, onSelectionEnd, onBeforeDelete, connectionMode, connectionLineType = ConnectionLineType.Bezier, connectionLineStyle, connectionLineComponent, connectionLineContainerStyle, deleteKeyCode = 'Backspace', selectionKeyCode = 'Shift', selectionOnDrag = false, selectionMode = SelectionMode.Full, panActivationKeyCode = 'Space', multiSelectionKeyCode = isMacOs() ? 'Meta' : 'Control', zoomActivationKeyCode = isMacOs() ? 'Meta' : 'Control', snapToGrid, snapGrid, onlyRenderVisibleElements = false, selectNodesOnDrag, nodesDraggable, autoPanOnNodeFocus, nodesConnectable, nodesFocusable, nodeOrigin = defaultNodeOrigin, edgesFocusable, edgesReconnectable, elementsSelectable = true, defaultViewport: defaultViewport$1 = defaultViewport, minZoom = 0.5, maxZoom = 2, translateExtent = infiniteExtent, preventScrolling = true, nodeExtent, defaultMarkerColor = '#b1b1b7', zoomOnScroll = true, zoomOnPinch = true, panOnScroll = false, panOnScrollSpeed = 0.5, panOnScrollMode = PanOnScrollMode.Free, zoomOnDoubleClick = true, panOnDrag = true, onPaneClick, onPaneMouseEnter, onPaneMouseMove, onPaneMouseLeave, onPaneScroll, onPaneContextMenu, paneClickDistance = 1, nodeClickDistance = 0, children, onReconnect, onReconnectStart, onReconnectEnd, onEdgeContextMenu, onEdgeDoubleClick, onEdgeMouseEnter, onEdgeMouseMove, onEdgeMouseLeave, reconnectRadius = 10, onNodesChange, onEdgesChange, noDragClassName = 'nodrag', noWheelClassName = 'nowheel', noPanClassName = 'nopan', fitView, fitViewOptions, connectOnClick, attributionPosition, proOptions, defaultEdgeOptions, elevateNodesOnSelect, elevateEdgesOnSelect, disableKeyboardA11y = false, autoPanOnConnect, autoPanOnNodeDrag, autoPanSpeed, connectionRadius, isValidConnection, onError, style, id, nodeDragThreshold, connectionDragThreshold, viewport, onViewportChange, width, height, colorMode = 'light', debug, onScroll, ariaLabelConfig, ...rest }, ref) {
    const rfId = id || '1';
    const colorModeClassName = useColorModeClass(colorMode);
    // Undo scroll events, preventing viewport from shifting when nodes outside of it are focused
    const wrapperOnScroll = useCallback((e) => {
        e.currentTarget.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        onScroll?.(e);
    }, [onScroll]);
    return (jsx("div", { "data-testid": "rf__wrapper", ...rest, onScroll: wrapperOnScroll, style: { ...style, ...wrapperStyle }, ref: ref, className: cc(['react-flow', className, colorModeClassName]), id: id, role: "application", children: jsxs(Wrapper, { nodes: nodes, edges: edges, width: width, height: height, fitView: fitView, fitViewOptions: fitViewOptions, minZoom: minZoom, maxZoom: maxZoom, nodeOrigin: nodeOrigin, nodeExtent: nodeExtent, children: [jsx(GraphView, { onInit: onInit, onNodeClick: onNodeClick, onEdgeClick: onEdgeClick, onNodeMouseEnter: onNodeMouseEnter, onNodeMouseMove: onNodeMouseMove, onNodeMouseLeave: onNodeMouseLeave, onNodeContextMenu: onNodeContextMenu, onNodeDoubleClick: onNodeDoubleClick, nodeTypes: nodeTypes, edgeTypes: edgeTypes, connectionLineType: connectionLineType, connectionLineStyle: connectionLineStyle, connectionLineComponent: connectionLineComponent, connectionLineContainerStyle: connectionLineContainerStyle, selectionKeyCode: selectionKeyCode, selectionOnDrag: selectionOnDrag, selectionMode: selectionMode, deleteKeyCode: deleteKeyCode, multiSelectionKeyCode: multiSelectionKeyCode, panActivationKeyCode: panActivationKeyCode, zoomActivationKeyCode: zoomActivationKeyCode, onlyRenderVisibleElements: onlyRenderVisibleElements, defaultViewport: defaultViewport$1, translateExtent: translateExtent, minZoom: minZoom, maxZoom: maxZoom, preventScrolling: preventScrolling, zoomOnScroll: zoomOnScroll, zoomOnPinch: zoomOnPinch, zoomOnDoubleClick: zoomOnDoubleClick, panOnScroll: panOnScroll, panOnScrollSpeed: panOnScrollSpeed, panOnScrollMode: panOnScrollMode, panOnDrag: panOnDrag, onPaneClick: onPaneClick, onPaneMouseEnter: onPaneMouseEnter, onPaneMouseMove: onPaneMouseMove, onPaneMouseLeave: onPaneMouseLeave, onPaneScroll: onPaneScroll, onPaneContextMenu: onPaneContextMenu, paneClickDistance: paneClickDistance, nodeClickDistance: nodeClickDistance, onSelectionContextMenu: onSelectionContextMenu, onSelectionStart: onSelectionStart, onSelectionEnd: onSelectionEnd, onReconnect: onReconnect, onReconnectStart: onReconnectStart, onReconnectEnd: onReconnectEnd, onEdgeContextMenu: onEdgeContextMenu, onEdgeDoubleClick: onEdgeDoubleClick, onEdgeMouseEnter: onEdgeMouseEnter, onEdgeMouseMove: onEdgeMouseMove, onEdgeMouseLeave: onEdgeMouseLeave, reconnectRadius: reconnectRadius, defaultMarkerColor: defaultMarkerColor, noDragClassName: noDragClassName, noWheelClassName: noWheelClassName, noPanClassName: noPanClassName, rfId: rfId, disableKeyboardA11y: disableKeyboardA11y, nodeExtent: nodeExtent, viewport: viewport, onViewportChange: onViewportChange }), jsx(StoreUpdater, { nodes: nodes, edges: edges, defaultNodes: defaultNodes, defaultEdges: defaultEdges, onConnect: onConnect, onConnectStart: onConnectStart, onConnectEnd: onConnectEnd, onClickConnectStart: onClickConnectStart, onClickConnectEnd: onClickConnectEnd, nodesDraggable: nodesDraggable, autoPanOnNodeFocus: autoPanOnNodeFocus, nodesConnectable: nodesConnectable, nodesFocusable: nodesFocusable, edgesFocusable: edgesFocusable, edgesReconnectable: edgesReconnectable, elementsSelectable: elementsSelectable, elevateNodesOnSelect: elevateNodesOnSelect, elevateEdgesOnSelect: elevateEdgesOnSelect, minZoom: minZoom, maxZoom: maxZoom, nodeExtent: nodeExtent, onNodesChange: onNodesChange, onEdgesChange: onEdgesChange, snapToGrid: snapToGrid, snapGrid: snapGrid, connectionMode: connectionMode, translateExtent: translateExtent, connectOnClick: connectOnClick, defaultEdgeOptions: defaultEdgeOptions, fitView: fitView, fitViewOptions: fitViewOptions, onNodesDelete: onNodesDelete, onEdgesDelete: onEdgesDelete, onDelete: onDelete, onNodeDragStart: onNodeDragStart, onNodeDrag: onNodeDrag, onNodeDragStop: onNodeDragStop, onSelectionDrag: onSelectionDrag, onSelectionDragStart: onSelectionDragStart, onSelectionDragStop: onSelectionDragStop, onMove: onMove, onMoveStart: onMoveStart, onMoveEnd: onMoveEnd, noPanClassName: noPanClassName, nodeOrigin: nodeOrigin, rfId: rfId, autoPanOnConnect: autoPanOnConnect, autoPanOnNodeDrag: autoPanOnNodeDrag, autoPanSpeed: autoPanSpeed, onError: onError, connectionRadius: connectionRadius, isValidConnection: isValidConnection, selectNodesOnDrag: selectNodesOnDrag, nodeDragThreshold: nodeDragThreshold, connectionDragThreshold: connectionDragThreshold, onBeforeDelete: onBeforeDelete, debug: debug, ariaLabelConfig: ariaLabelConfig }), jsx(SelectionListener, { onSelectionChange: onSelectionChange }), children, jsx(Attribution, { proOptions: proOptions, position: attributionPosition }), jsx(A11yDescriptions, { rfId: rfId, disableKeyboardA11y: disableKeyboardA11y })] }) }));
}
/**
 * The `<ReactFlow />` component is the heart of your React Flow application.
 * It renders your nodes and edges and handles user interaction
 *
 * @public
 *
 * @example
 * ```tsx
 *import { ReactFlow } from '@xyflow/react'
 *
 *export default function Flow() {
 *  return (<ReactFlow
 *    nodes={...}
 *    edges={...}
 *    onNodesChange={...}
 *    ...
 *  />);
 *}
 *```
 */
var index = fixedForwardRef(ReactFlow);

const selector$6 = (s) => s.domNode?.querySelector('.react-flow__edgelabel-renderer');
/**
 * Edges are SVG-based. If you want to render more complex labels you can use the
 * `<EdgeLabelRenderer />` component to access a div based renderer. This component
 * is a portal that renders the label in a `<div />` that is positioned on top of
 * the edges. You can see an example usage of the component in the
 * [edge label renderer example](/examples/edges/edge-label-renderer).
 * @public
 *
 * @example
 * ```jsx
 * import React from 'react';
 * import { getBezierPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
 *
 * export function CustomEdge({ id, data, ...props }) {
 *   const [edgePath, labelX, labelY] = getBezierPath(props);
 *
 *   return (
 *     <>
 *       <BaseEdge id={id} path={edgePath} />
 *       <EdgeLabelRenderer>
 *         <div
 *           style={{
 *             position: 'absolute',
 *             transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
 *             background: '#ffcc00',
 *             padding: 10,
 *         }}
 *           className="nodrag nopan"
 *         >
 *          {data.label}
 *         </div>
 *       </EdgeLabelRenderer>
 *     </>
 *   );
 * };
 * ```
 *
 * @remarks The `<EdgeLabelRenderer />` has no pointer events by default. If you want to
 * add mouse interactions you need to set the style `pointerEvents: all` and add
 * the `nopan` class on the label or the element you want to interact with.
 */
function EdgeLabelRenderer({ children }) {
    const edgeLabelRenderer = useStore(selector$6);
    if (!edgeLabelRenderer) {
        return null;
    }
    return createPortal(children, edgeLabelRenderer);
}

const selector$5 = (s) => s.domNode?.querySelector('.react-flow__viewport-portal');
/**
 * The `<ViewportPortal />` component can be used to add components to the same viewport
 * of the flow where nodes and edges are rendered. This is useful when you want to render
 * your own components that are adhere to the same coordinate system as the nodes & edges
 * and are also affected by zooming and panning
 * @public
 * @example
 *
 * ```jsx
 *import React from 'react';
 *import { ViewportPortal } from '@xyflow/react';
 *
 *export default function () {
 *  return (
 *    <ViewportPortal>
 *      <div
 *        style={{ transform: 'translate(100px, 100px)', position: 'absolute' }}
 *      >
 *        This div is positioned at [100, 100] on the flow.
 *      </div>
 *    </ViewportPortal>
 *  );
 *}
 *```
 */
function ViewportPortal({ children }) {
    const viewPortalDiv = useStore(selector$5);
    if (!viewPortalDiv) {
        return null;
    }
    return createPortal(children, viewPortalDiv);
}

/**
 * When you programmatically add or remove handles to a node or update a node's
 * handle position, you need to let React Flow know about it using this hook. This
 * will update the internal dimensions of the node and properly reposition handles
 * on the canvas if necessary.
 *
 * @public
 * @returns Use this function to tell React Flow to update the internal state of one or more nodes
 * that you have changed programmatically.
 *
 * @example
 * ```jsx
 *import { useCallback, useState } from 'react';
 *import { Handle, useUpdateNodeInternals } from '@xyflow/react';
 *
 *export default function RandomHandleNode({ id }) {
 *  const updateNodeInternals = useUpdateNodeInternals();
 *  const [handleCount, setHandleCount] = useState(0);
 *  const randomizeHandleCount = useCallback(() => {
 *   setHandleCount(Math.floor(Math.random() * 10));
 *    updateNodeInternals(id);
 *  }, [id, updateNodeInternals]);
 *
 *  return (
 *    <>
 *      {Array.from({ length: handleCount }).map((_, index) => (
 *        <Handle
 *          key={index}
 *          type="target"
 *          position="left"
 *          id={`handle-${index}`}
 *        />
 *      ))}
 *
 *      <div>
 *        <button onClick={randomizeHandleCount}>Randomize handle count</button>
 *        <p>There are {handleCount} handles on this node.</p>
 *      </div>
 *    </>
 *  );
 *}
 *```
 * @remarks This hook can only be used in a component that is a child of a
 *{@link ReactFlowProvider} or a {@link ReactFlow} component.
 */
function useUpdateNodeInternals() {
    const store = useStoreApi();
    return useCallback((id) => {
        const { domNode, updateNodeInternals } = store.getState();
        const updateIds = Array.isArray(id) ? id : [id];
        const updates = new Map();
        updateIds.forEach((updateId) => {
            const nodeElement = domNode?.querySelector(`.react-flow__node[data-id="${updateId}"]`);
            if (nodeElement) {
                updates.set(updateId, { id: updateId, nodeElement, force: true });
            }
        });
        requestAnimationFrame(() => updateNodeInternals(updates, { triggerFitView: false }));
    }, []);
}

const nodesSelector = (state) => state.nodes;
/**
 * This hook returns an array of the current nodes. Components that use this hook
 * will re-render **whenever any node changes**, including when a node is selected
 * or moved.
 *
 * @public
 * @returns An array of all nodes currently in the flow.
 *
 * @example
 * ```jsx
 *import { useNodes } from '@xyflow/react';
 *
 *export default function() {
 *  const nodes = useNodes();
 *
 *  return <div>There are currently {nodes.length} nodes!</div>;
 *}
 *```
 */
function useNodes() {
    const nodes = useStore(nodesSelector, shallow);
    return nodes;
}

const edgesSelector = (state) => state.edges;
/**
 * This hook returns an array of the current edges. Components that use this hook
 * will re-render **whenever any edge changes**.
 *
 * @public
 * @returns An array of all edges currently in the flow.
 *
 * @example
 * ```tsx
 *import { useEdges } from '@xyflow/react';
 *
 *export default function () {
 *  const edges = useEdges();
 *
 *  return <div>There are currently {edges.length} edges!</div>;
 *}
 *```
 */
function useEdges() {
    const edges = useStore(edgesSelector, shallow);
    return edges;
}

const viewportSelector = (state) => ({
    x: state.transform[0],
    y: state.transform[1],
    zoom: state.transform[2],
});
/**
 * The `useViewport` hook is a convenient way to read the current state of the
 * {@link Viewport} in a component. Components that use this hook
 * will re-render **whenever the viewport changes**.
 *
 * @public
 * @returns The current viewport.
 *
 * @example
 *
 *```jsx
 *import { useViewport } from '@xyflow/react';
 *
 *export default function ViewportDisplay() {
 *  const { x, y, zoom } = useViewport();
 *
 *  return (
 *    <div>
 *      <p>
 *        The viewport is currently at ({x}, {y}) and zoomed to {zoom}.
 *      </p>
 *    </div>
 *  );
 *}
 *```
 *
 * @remarks This hook can only be used in a component that is a child of a
 *{@link ReactFlowProvider} or a {@link ReactFlow} component.
 */
function useViewport() {
    const viewport = useStore(viewportSelector, shallow);
    return viewport;
}

/**
 * This hook makes it easy to prototype a controlled flow where you manage the
 * state of nodes and edges outside the `ReactFlowInstance`. You can think of it
 * like React's `useState` hook with an additional helper callback.
 *
 * @public
 * @returns
 * - `nodes`: The current array of nodes. You might pass this directly to the `nodes` prop of your
 * `<ReactFlow />` component, or you may want to manipulate it first to perform some layouting,
 * for example.
 * - `setNodes`: A function that you can use to update the nodes. You can pass it a new array of
 * nodes or a callback that receives the current array of nodes and returns a new array of nodes.
 * This is the same as the second element of the tuple returned by React's `useState` hook.
 * - `onNodesChange`: A handy callback that can take an array of `NodeChanges` and update the nodes
 * state accordingly. You'll typically pass this directly to the `onNodesChange` prop of your
 * `<ReactFlow />` component.
 * @example
 *
 *```tsx
 *import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';
 *
 *const initialNodes = [];
 *const initialEdges = [];
 *
 *export default function () {
 *  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
 *  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
 *
 *  return (
 *    <ReactFlow
 *      nodes={nodes}
 *      edges={edges}
 *      onNodesChange={onNodesChange}
 *      onEdgesChange={onEdgesChange}
 *    />
 *  );
 *}
 *```
 *
 * @remarks This hook was created to make prototyping easier and our documentation
 * examples clearer. Although it is OK to use this hook in production, in
 * practice you may want to use a more sophisticated state management solution
 * like Zustand {@link https://reactflow.dev/docs/guides/state-management/} instead.
 *
 */
function useNodesState(initialNodes) {
    const [nodes, setNodes] = useState(initialNodes);
    const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
    return [nodes, setNodes, onNodesChange];
}
/**
 * This hook makes it easy to prototype a controlled flow where you manage the
 * state of nodes and edges outside the `ReactFlowInstance`. You can think of it
 * like React's `useState` hook with an additional helper callback.
 *
 * @public
 * @returns
 * - `edges`: The current array of edges. You might pass this directly to the `edges` prop of your
 * `<ReactFlow />` component, or you may want to manipulate it first to perform some layouting,
 * for example.
 *
 * - `setEdges`: A function that you can use to update the edges. You can pass it a new array of
 * edges or a callback that receives the current array of edges and returns a new array of edges.
 * This is the same as the second element of the tuple returned by React's `useState` hook.
 *
 * - `onEdgesChange`: A handy callback that can take an array of `EdgeChanges` and update the edges
 * state accordingly. You'll typically pass this directly to the `onEdgesChange` prop of your
 * `<ReactFlow />` component.
 * @example
 *
 *```tsx
 *import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';
 *
 *const initialNodes = [];
 *const initialEdges = [];
 *
 *export default function () {
 *  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
 *  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
 *
 *  return (
 *    <ReactFlow
 *      nodes={nodes}
 *      edges={edges}
 *      onNodesChange={onNodesChange}
 *      onEdgesChange={onEdgesChange}
 *    />
 *  );
 *}
 *```
 *
 * @remarks This hook was created to make prototyping easier and our documentation
 * examples clearer. Although it is OK to use this hook in production, in
 * practice you may want to use a more sophisticated state management solution
 * like Zustand {@link https://reactflow.dev/docs/guides/state-management/} instead.
 *
 */
function useEdgesState(initialEdges) {
    const [edges, setEdges] = useState(initialEdges);
    const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
    return [edges, setEdges, onEdgesChange];
}

/**
 * The `useOnViewportChange` hook lets you listen for changes to the viewport such
 * as panning and zooming. You can provide a callback for each phase of a viewport
 * change: `onStart`, `onChange`, and `onEnd`.
 *
 * @public
 * @example
 * ```jsx
 *import { useCallback } from 'react';
 *import { useOnViewportChange } from '@xyflow/react';
 *
 *function ViewportChangeLogger() {
 *  useOnViewportChange({
 *    onStart: (viewport: Viewport) => console.log('start', viewport),
 *    onChange: (viewport: Viewport) => console.log('change', viewport),
 *    onEnd: (viewport: Viewport) => console.log('end', viewport),
 *  });
 *
 *  return null;
 *}
 *```
 */
function useOnViewportChange({ onStart, onChange, onEnd }) {
    const store = useStoreApi();
    useEffect(() => {
        store.setState({ onViewportChangeStart: onStart });
    }, [onStart]);
    useEffect(() => {
        store.setState({ onViewportChange: onChange });
    }, [onChange]);
    useEffect(() => {
        store.setState({ onViewportChangeEnd: onEnd });
    }, [onEnd]);
}

/**
 * This hook lets you listen for changes to both node and edge selection. As the
 *name implies, the callback you provide will be called whenever the selection of
 *_either_ nodes or edges changes.
 *
 * @public
 * @example
 * ```jsx
 *import { useState } from 'react';
 *import { ReactFlow, useOnSelectionChange } from '@xyflow/react';
 *
 *function SelectionDisplay() {
 *  const [selectedNodes, setSelectedNodes] = useState([]);
 *  const [selectedEdges, setSelectedEdges] = useState([]);
 *
 *  // the passed handler has to be memoized, otherwise the hook will not work correctly
 *  const onChange = useCallback(({ nodes, edges }) => {
 *    setSelectedNodes(nodes.map((node) => node.id));
 *    setSelectedEdges(edges.map((edge) => edge.id));
 *  }, []);
 *
 *  useOnSelectionChange({
 *    onChange,
 *  });
 *
 *  return (
 *    <div>
 *      <p>Selected nodes: {selectedNodes.join(', ')}</p>
 *      <p>Selected edges: {selectedEdges.join(', ')}</p>
 *    </div>
 *  );
 *}
 *```
 *
 * @remarks You need to memoize the passed `onChange` handler, otherwise the hook will not work correctly.
 */
function useOnSelectionChange({ onChange, }) {
    const store = useStoreApi();
    useEffect(() => {
        const nextOnSelectionChangeHandlers = [...store.getState().onSelectionChangeHandlers, onChange];
        store.setState({ onSelectionChangeHandlers: nextOnSelectionChangeHandlers });
        return () => {
            const nextHandlers = store.getState().onSelectionChangeHandlers.filter((fn) => fn !== onChange);
            store.setState({ onSelectionChangeHandlers: nextHandlers });
        };
    }, [onChange]);
}

const selector$4 = (options) => (s) => {
    if (!options.includeHiddenNodes) {
        return s.nodesInitialized;
    }
    if (s.nodeLookup.size === 0) {
        return false;
    }
    for (const [, { internals }] of s.nodeLookup) {
        if (internals.handleBounds === undefined || !nodeHasDimensions(internals.userNode)) {
            return false;
        }
    }
    return true;
};
/**
 * This hook tells you whether all the nodes in a flow have been measured and given
 *a width and height. When you add a node to the flow, this hook will return
 *`false` and then `true` again once the node has been measured.
 *
 * @public
 * @returns Whether or not the nodes have been initialized by the `<ReactFlow />` component and
 * given a width and height.
 *
 * @example
 * ```jsx
 *import { useReactFlow, useNodesInitialized } from '@xyflow/react';
 *import { useEffect, useState } from 'react';
 *
 *const options = {
 *  includeHiddenNodes: false,
 *};
 *
 *export default function useLayout() {
 *  const { getNodes } = useReactFlow();
 *  const nodesInitialized = useNodesInitialized(options);
 *  const [layoutedNodes, setLayoutedNodes] = useState(getNodes());
 *
 *  useEffect(() => {
 *    if (nodesInitialized) {
 *      setLayoutedNodes(yourLayoutingFunction(getNodes()));
 *    }
 *  }, [nodesInitialized]);
 *
 *  return layoutedNodes;
 *}
 *```
 */
function useNodesInitialized(options = {
    includeHiddenNodes: false,
}) {
    const initialized = useStore(selector$4(options));
    return initialized;
}

/**
 * Hook to check if a <Handle /> is connected to another <Handle /> and get the connections.
 *
 * @public
 * @deprecated Use `useNodeConnections` instead.
 * @returns An array with handle connections.
 */
function useHandleConnections({ type, id, nodeId, onConnect, onDisconnect, }) {
    console.warn('[DEPRECATED] `useHandleConnections` is deprecated. Instead use `useNodeConnections` https://reactflow.dev/api-reference/hooks/useNodeConnections');
    const _nodeId = useNodeId();
    const currentNodeId = nodeId ?? _nodeId;
    const prevConnections = useRef(null);
    const connections = useStore((state) => state.connectionLookup.get(`${currentNodeId}-${type}${id ? `-${id}` : ''}`), areConnectionMapsEqual);
    useEffect(() => {
        // @todo dicuss if onConnect/onDisconnect should be called when the component mounts/unmounts
        if (prevConnections.current && prevConnections.current !== connections) {
            const _connections = connections ?? new Map();
            handleConnectionChange(prevConnections.current, _connections, onDisconnect);
            handleConnectionChange(_connections, prevConnections.current, onConnect);
        }
        prevConnections.current = connections ?? new Map();
    }, [connections, onConnect, onDisconnect]);
    return useMemo(() => Array.from(connections?.values() ?? []), [connections]);
}

const error014 = errorMessages['error014']();
/**
 * This hook returns an array of connections on a specific node, handle type ('source', 'target') or handle ID.
 *
 * @public
 * @returns An array with connections.
 *
 * @example
 * ```jsx
 *import { useNodeConnections } from '@xyflow/react';
 *
 *export default function () {
 *  const connections = useNodeConnections({
 *    handleType: 'target',
 *    handleId: 'my-handle',
 *  });
 *
 *  return (
 *    <div>There are currently {connections.length} incoming connections!</div>
 *  );
 *}
 *```
 */
function useNodeConnections({ id, handleType, handleId, onConnect, onDisconnect, } = {}) {
    const nodeId = useNodeId();
    const currentNodeId = id ?? nodeId;
    if (!currentNodeId) {
        throw new Error(error014);
    }
    const prevConnections = useRef(null);
    const connections = useStore((state) => state.connectionLookup.get(`${currentNodeId}${handleType ? (handleId ? `-${handleType}-${handleId}` : `-${handleType}`) : ''}`), areConnectionMapsEqual);
    useEffect(() => {
        // @todo discuss if onConnect/onDisconnect should be called when the component mounts/unmounts
        if (prevConnections.current && prevConnections.current !== connections) {
            const _connections = connections ?? new Map();
            handleConnectionChange(prevConnections.current, _connections, onDisconnect);
            handleConnectionChange(_connections, prevConnections.current, onConnect);
        }
        prevConnections.current = connections ?? new Map();
    }, [connections, onConnect, onDisconnect]);
    return useMemo(() => Array.from(connections?.values() ?? []), [connections]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useNodesData(nodeIds) {
    const nodesData = useStore(useCallback((s) => {
        const data = [];
        const isArrayOfIds = Array.isArray(nodeIds);
        const _nodeIds = isArrayOfIds ? nodeIds : [nodeIds];
        for (const nodeId of _nodeIds) {
            const node = s.nodeLookup.get(nodeId);
            if (node) {
                data.push({
                    id: node.id,
                    type: node.type,
                    data: node.data,
                });
            }
        }
        return isArrayOfIds ? data : data[0] ?? null;
    }, [nodeIds]), shallowNodeData);
    return nodesData;
}

/**
 * This hook returns the internal representation of a specific node.
 * Components that use this hook will re-render **whenever the node changes**,
 * including when a node is selected or moved.
 *
 * @public
 * @param id - The ID of a node you want to observe.
 * @returns The `InternalNode` object for the node with the given ID.
 *
 * @example
 * ```tsx
 *import { useInternalNode } from '@xyflow/react';
 *
 *export default function () {
 *  const internalNode = useInternalNode('node-1');
 *  const absolutePosition = internalNode.internals.positionAbsolute;
 *
 *  return (
 *    <div>
 *      The absolute position of the node is at:
 *      <p>x: {absolutePosition.x}</p>
 *      <p>y: {absolutePosition.y}</p>
 *    </div>
 *  );
 *}
 *```
 */
function useInternalNode(id) {
    const node = useStore(useCallback((s) => s.nodeLookup.get(id), [id]), shallow);
    return node;
}

function LinePattern({ dimensions, lineWidth, variant, className }) {
    return (jsx("path", { strokeWidth: lineWidth, d: `M${dimensions[0] / 2} 0 V${dimensions[1]} M0 ${dimensions[1] / 2} H${dimensions[0]}`, className: cc(['react-flow__background-pattern', variant, className]) }));
}
function DotPattern({ radius, className }) {
    return (jsx("circle", { cx: radius, cy: radius, r: radius, className: cc(['react-flow__background-pattern', 'dots', className]) }));
}

/**
 * The three variants are exported as an enum for convenience. You can either import
 * the enum and use it like `BackgroundVariant.Lines` or you can use the raw string
 * value directly.
 * @public
 */
var BackgroundVariant;
(function (BackgroundVariant) {
    BackgroundVariant["Lines"] = "lines";
    BackgroundVariant["Dots"] = "dots";
    BackgroundVariant["Cross"] = "cross";
})(BackgroundVariant || (BackgroundVariant = {}));

const defaultSize = {
    [BackgroundVariant.Dots]: 1,
    [BackgroundVariant.Lines]: 1,
    [BackgroundVariant.Cross]: 6,
};
const selector$3 = (s) => ({ transform: s.transform, patternId: `pattern-${s.rfId}` });
function BackgroundComponent({ id, variant = BackgroundVariant.Dots, 
// only used for dots and cross
gap = 20, 
// only used for lines and cross
size, lineWidth = 1, offset = 0, color, bgColor, style, className, patternClassName, }) {
    const ref = useRef(null);
    const { transform, patternId } = useStore(selector$3, shallow);
    const patternSize = size || defaultSize[variant];
    const isDots = variant === BackgroundVariant.Dots;
    const isCross = variant === BackgroundVariant.Cross;
    const gapXY = Array.isArray(gap) ? gap : [gap, gap];
    const scaledGap = [gapXY[0] * transform[2] || 1, gapXY[1] * transform[2] || 1];
    const scaledSize = patternSize * transform[2];
    const offsetXY = Array.isArray(offset) ? offset : [offset, offset];
    const patternDimensions = isCross ? [scaledSize, scaledSize] : scaledGap;
    const scaledOffset = [
        offsetXY[0] * transform[2] || 1 + patternDimensions[0] / 2,
        offsetXY[1] * transform[2] || 1 + patternDimensions[1] / 2,
    ];
    const _patternId = `${patternId}${id ? id : ''}`;
    return (jsxs("svg", { className: cc(['react-flow__background', className]), style: {
            ...style,
            ...containerStyle,
            '--xy-background-color-props': bgColor,
            '--xy-background-pattern-color-props': color,
        }, ref: ref, "data-testid": "rf__background", children: [jsx("pattern", { id: _patternId, x: transform[0] % scaledGap[0], y: transform[1] % scaledGap[1], width: scaledGap[0], height: scaledGap[1], patternUnits: "userSpaceOnUse", patternTransform: `translate(-${scaledOffset[0]},-${scaledOffset[1]})`, children: isDots ? (jsx(DotPattern, { radius: scaledSize / 2, className: patternClassName })) : (jsx(LinePattern, { dimensions: patternDimensions, lineWidth: lineWidth, variant: variant, className: patternClassName })) }), jsx("rect", { x: "0", y: "0", width: "100%", height: "100%", fill: `url(#${_patternId})` })] }));
}
BackgroundComponent.displayName = 'Background';
/**
 * The `<Background />` component makes it convenient to render different types of backgrounds common in node-based UIs. It comes with three variants: lines, dots and cross.
 *
 * @example
 *
 * A simple example of how to use the Background component.
 *
 * ```tsx
 * import { useState } from 'react';
 * import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react';
 *
 * export default function Flow() {
 *   return (
 *     <ReactFlow defaultNodes={[...]} defaultEdges={[...]}>
 *       <Background color="#ccc" variant={BackgroundVariant.Dots} />
 *     </ReactFlow>
 *   );
 * }
 * ```
 *
 * @example
 *
 * In this example you can see how to combine multiple backgrounds
 *
 * ```tsx
 * import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react';
 * import '@xyflow/react/dist/style.css';
 *
 * export default function Flow() {
 *   return (
 *     <ReactFlow defaultNodes={[...]} defaultEdges={[...]}>
 *       <Background
 *         id="1"
 *         gap={10}
 *         color="#f1f1f1"
 *         variant={BackgroundVariant.Lines}
 *       />
 *       <Background
 *         id="2"
 *         gap={100}
 *         color="#ccc"
 *         variant={BackgroundVariant.Lines}
 *       />
 *     </ReactFlow>
 *   );
 * }
 * ```
 *
 * @remarks
 *
 * When combining multiple <Background /> components it’s important to give each of them a unique id prop!
 *
 */
const Background = memo(BackgroundComponent);

function PlusIcon() {
    return (jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 32 32", children: jsx("path", { d: "M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" }) }));
}

function MinusIcon() {
    return (jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 32 5", children: jsx("path", { d: "M0 0h32v4.2H0z" }) }));
}

function FitViewIcon() {
    return (jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 32 30", children: jsx("path", { d: "M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" }) }));
}

function LockIcon() {
    return (jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 25 32", children: jsx("path", { d: "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z" }) }));
}

function UnlockIcon() {
    return (jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 25 32", children: jsx("path", { d: "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047z" }) }));
}

/**
 * You can add buttons to the control panel by using the `<ControlButton />` component
 * and pass it as a child to the [`<Controls />`](/api-reference/components/controls) component.
 *
 * @public
 * @example
 *```jsx
 *import { MagicWand } from '@radix-ui/react-icons'
 *import { ReactFlow, Controls, ControlButton } from '@xyflow/react'
 *
 *export default function Flow() {
 *  return (
 *    <ReactFlow nodes={[...]} edges={[...]}>
 *      <Controls>
 *        <ControlButton onClick={() => alert('Something magical just happened. ✨')}>
 *          <MagicWand />
 *        </ControlButton>
 *      </Controls>
 *    </ReactFlow>
 *  )
 *}
 *```
 */
function ControlButton({ children, className, ...rest }) {
    return (jsx("button", { type: "button", className: cc(['react-flow__controls-button', className]), ...rest, children: children }));
}

const selector$2 = (s) => ({
    isInteractive: s.nodesDraggable || s.nodesConnectable || s.elementsSelectable,
    minZoomReached: s.transform[2] <= s.minZoom,
    maxZoomReached: s.transform[2] >= s.maxZoom,
    ariaLabelConfig: s.ariaLabelConfig,
});
function ControlsComponent({ style, showZoom = true, showFitView = true, showInteractive = true, fitViewOptions, onZoomIn, onZoomOut, onFitView, onInteractiveChange, className, children, position = 'bottom-left', orientation = 'vertical', 'aria-label': ariaLabel, }) {
    const store = useStoreApi();
    const { isInteractive, minZoomReached, maxZoomReached, ariaLabelConfig } = useStore(selector$2, shallow);
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const onZoomInHandler = () => {
        zoomIn();
        onZoomIn?.();
    };
    const onZoomOutHandler = () => {
        zoomOut();
        onZoomOut?.();
    };
    const onFitViewHandler = () => {
        fitView(fitViewOptions);
        onFitView?.();
    };
    const onToggleInteractivity = () => {
        store.setState({
            nodesDraggable: !isInteractive,
            nodesConnectable: !isInteractive,
            elementsSelectable: !isInteractive,
        });
        onInteractiveChange?.(!isInteractive);
    };
    const orientationClass = orientation === 'horizontal' ? 'horizontal' : 'vertical';
    return (jsxs(Panel, { className: cc(['react-flow__controls', orientationClass, className]), position: position, style: style, "data-testid": "rf__controls", "aria-label": ariaLabel ?? ariaLabelConfig['controls.ariaLabel'], children: [showZoom && (jsxs(Fragment, { children: [jsx(ControlButton, { onClick: onZoomInHandler, className: "react-flow__controls-zoomin", title: ariaLabelConfig['controls.zoomIn.ariaLabel'], "aria-label": ariaLabelConfig['controls.zoomIn.ariaLabel'], disabled: maxZoomReached, children: jsx(PlusIcon, {}) }), jsx(ControlButton, { onClick: onZoomOutHandler, className: "react-flow__controls-zoomout", title: ariaLabelConfig['controls.zoomOut.ariaLabel'], "aria-label": ariaLabelConfig['controls.zoomOut.ariaLabel'], disabled: minZoomReached, children: jsx(MinusIcon, {}) })] })), showFitView && (jsx(ControlButton, { className: "react-flow__controls-fitview", onClick: onFitViewHandler, title: ariaLabelConfig['controls.fitView.ariaLabel'], "aria-label": ariaLabelConfig['controls.fitView.ariaLabel'], children: jsx(FitViewIcon, {}) })), showInteractive && (jsx(ControlButton, { className: "react-flow__controls-interactive", onClick: onToggleInteractivity, title: ariaLabelConfig['controls.interactive.ariaLabel'], "aria-label": ariaLabelConfig['controls.interactive.ariaLabel'], children: isInteractive ? jsx(UnlockIcon, {}) : jsx(LockIcon, {}) })), children] }));
}
ControlsComponent.displayName = 'Controls';
/**
 * The `<Controls />` component renders a small panel that contains convenient
 * buttons to zoom in, zoom out, fit the view, and lock the viewport.
 *
 * @public
 * @example
 *```tsx
 *import { ReactFlow, Controls } from '@xyflow/react'
 *
 *export default function Flow() {
 *  return (
 *    <ReactFlow nodes={[...]} edges={[...]}>
 *      <Controls />
 *    </ReactFlow>
 *  )
 *}
 *```
 *
 * @remarks To extend or customise the controls, you can use the [`<ControlButton />`](/api-reference/components/control-button) component
 *
 */
const Controls = memo(ControlsComponent);

function MiniMapNodeComponent({ id, x, y, width, height, style, color, strokeColor, strokeWidth, className, borderRadius, shapeRendering, selected, onClick, }) {
    const { background, backgroundColor } = style || {};
    const fill = (color || background || backgroundColor);
    return (jsx("rect", { className: cc(['react-flow__minimap-node', { selected }, className]), x: x, y: y, rx: borderRadius, ry: borderRadius, width: width, height: height, style: {
            fill,
            stroke: strokeColor,
            strokeWidth,
        }, shapeRendering: shapeRendering, onClick: onClick ? (event) => onClick(event, id) : undefined }));
}
const MiniMapNode = memo(MiniMapNodeComponent);

const selectorNodeIds = (s) => s.nodes.map((node) => node.id);
const getAttrFunction = (func) => func instanceof Function ? func : () => func;
function MiniMapNodes({ nodeStrokeColor, nodeColor, nodeClassName = '', nodeBorderRadius = 5, nodeStrokeWidth, 
/*
 * We need to rename the prop to be `CapitalCase` so that JSX will render it as
 * a component properly.
 */
nodeComponent: NodeComponent = MiniMapNode, onClick, }) {
    const nodeIds = useStore(selectorNodeIds, shallow);
    const nodeColorFunc = getAttrFunction(nodeColor);
    const nodeStrokeColorFunc = getAttrFunction(nodeStrokeColor);
    const nodeClassNameFunc = getAttrFunction(nodeClassName);
    const shapeRendering = typeof window === 'undefined' || !!window.chrome ? 'crispEdges' : 'geometricPrecision';
    return (jsx(Fragment, { children: nodeIds.map((nodeId) => (
        /*
         * The split of responsibilities between MiniMapNodes and
         * NodeComponentWrapper may appear weird. However, it’s designed to
         * minimize the cost of updates when individual nodes change.
         *
         * For more details, see a similar commit in `NodeRenderer/index.tsx`.
         */
        jsx(NodeComponentWrapper, { id: nodeId, nodeColorFunc: nodeColorFunc, nodeStrokeColorFunc: nodeStrokeColorFunc, nodeClassNameFunc: nodeClassNameFunc, nodeBorderRadius: nodeBorderRadius, nodeStrokeWidth: nodeStrokeWidth, NodeComponent: NodeComponent, onClick: onClick, shapeRendering: shapeRendering }, nodeId))) }));
}
function NodeComponentWrapperInner({ id, nodeColorFunc, nodeStrokeColorFunc, nodeClassNameFunc, nodeBorderRadius, nodeStrokeWidth, shapeRendering, NodeComponent, onClick, }) {
    const { node, x, y, width, height } = useStore((s) => {
        const { internals } = s.nodeLookup.get(id);
        const node = internals.userNode;
        const { x, y } = internals.positionAbsolute;
        const { width, height } = getNodeDimensions(node);
        return {
            node,
            x,
            y,
            width,
            height,
        };
    }, shallow);
    if (!node || node.hidden || !nodeHasDimensions(node)) {
        return null;
    }
    return (jsx(NodeComponent, { x: x, y: y, width: width, height: height, style: node.style, selected: !!node.selected, className: nodeClassNameFunc(node), color: nodeColorFunc(node), borderRadius: nodeBorderRadius, strokeColor: nodeStrokeColorFunc(node), strokeWidth: nodeStrokeWidth, shapeRendering: shapeRendering, onClick: onClick, id: node.id }));
}
const NodeComponentWrapper = memo(NodeComponentWrapperInner);
var MiniMapNodes$1 = memo(MiniMapNodes);

const defaultWidth = 200;
const defaultHeight = 150;
const filterHidden = (node) => !node.hidden;
const selector$1 = (s) => {
    const viewBB = {
        x: -s.transform[0] / s.transform[2],
        y: -s.transform[1] / s.transform[2],
        width: s.width / s.transform[2],
        height: s.height / s.transform[2],
    };
    return {
        viewBB,
        boundingRect: s.nodeLookup.size > 0
            ? getBoundsOfRects(getInternalNodesBounds(s.nodeLookup, { filter: filterHidden }), viewBB)
            : viewBB,
        rfId: s.rfId,
        panZoom: s.panZoom,
        translateExtent: s.translateExtent,
        flowWidth: s.width,
        flowHeight: s.height,
        ariaLabelConfig: s.ariaLabelConfig,
    };
};
const ARIA_LABEL_KEY = 'react-flow__minimap-desc';
function MiniMapComponent({ style, className, nodeStrokeColor, nodeColor, nodeClassName = '', nodeBorderRadius = 5, nodeStrokeWidth, 
/*
 * We need to rename the prop to be `CapitalCase` so that JSX will render it as
 * a component properly.
 */
nodeComponent, bgColor, maskColor, maskStrokeColor, maskStrokeWidth, position = 'bottom-right', onClick, onNodeClick, pannable = false, zoomable = false, ariaLabel, inversePan, zoomStep = 1, offsetScale = 5, }) {
    const store = useStoreApi();
    const svg = useRef(null);
    const { boundingRect, viewBB, rfId, panZoom, translateExtent, flowWidth, flowHeight, ariaLabelConfig } = useStore(selector$1, shallow);
    const elementWidth = style?.width ?? defaultWidth;
    const elementHeight = style?.height ?? defaultHeight;
    const scaledWidth = boundingRect.width / elementWidth;
    const scaledHeight = boundingRect.height / elementHeight;
    const viewScale = Math.max(scaledWidth, scaledHeight);
    const viewWidth = viewScale * elementWidth;
    const viewHeight = viewScale * elementHeight;
    const offset = offsetScale * viewScale;
    const x = boundingRect.x - (viewWidth - boundingRect.width) / 2 - offset;
    const y = boundingRect.y - (viewHeight - boundingRect.height) / 2 - offset;
    const width = viewWidth + offset * 2;
    const height = viewHeight + offset * 2;
    const labelledBy = `${ARIA_LABEL_KEY}-${rfId}`;
    const viewScaleRef = useRef(0);
    const minimapInstance = useRef();
    viewScaleRef.current = viewScale;
    useEffect(() => {
        if (svg.current && panZoom) {
            minimapInstance.current = XYMinimap({
                domNode: svg.current,
                panZoom,
                getTransform: () => store.getState().transform,
                getViewScale: () => viewScaleRef.current,
            });
            return () => {
                minimapInstance.current?.destroy();
            };
        }
    }, [panZoom]);
    useEffect(() => {
        minimapInstance.current?.update({
            translateExtent,
            width: flowWidth,
            height: flowHeight,
            inversePan,
            pannable,
            zoomStep,
            zoomable,
        });
    }, [pannable, zoomable, inversePan, zoomStep, translateExtent, flowWidth, flowHeight]);
    const onSvgClick = onClick
        ? (event) => {
            const [x, y] = minimapInstance.current?.pointer(event) || [0, 0];
            onClick(event, { x, y });
        }
        : undefined;
    const onSvgNodeClick = onNodeClick
        ? useCallback((event, nodeId) => {
            const node = store.getState().nodeLookup.get(nodeId).internals.userNode;
            onNodeClick(event, node);
        }, [])
        : undefined;
    const _ariaLabel = ariaLabel ?? ariaLabelConfig['minimap.ariaLabel'];
    return (jsx(Panel, { position: position, style: {
            ...style,
            '--xy-minimap-background-color-props': typeof bgColor === 'string' ? bgColor : undefined,
            '--xy-minimap-mask-background-color-props': typeof maskColor === 'string' ? maskColor : undefined,
            '--xy-minimap-mask-stroke-color-props': typeof maskStrokeColor === 'string' ? maskStrokeColor : undefined,
            '--xy-minimap-mask-stroke-width-props': typeof maskStrokeWidth === 'number' ? maskStrokeWidth * viewScale : undefined,
            '--xy-minimap-node-background-color-props': typeof nodeColor === 'string' ? nodeColor : undefined,
            '--xy-minimap-node-stroke-color-props': typeof nodeStrokeColor === 'string' ? nodeStrokeColor : undefined,
            '--xy-minimap-node-stroke-width-props': typeof nodeStrokeWidth === 'number' ? nodeStrokeWidth : undefined,
        }, className: cc(['react-flow__minimap', className]), "data-testid": "rf__minimap", children: jsxs("svg", { width: elementWidth, height: elementHeight, viewBox: `${x} ${y} ${width} ${height}`, className: "react-flow__minimap-svg", role: "img", "aria-labelledby": labelledBy, ref: svg, onClick: onSvgClick, children: [_ariaLabel && jsx("title", { id: labelledBy, children: _ariaLabel }), jsx(MiniMapNodes$1, { onClick: onSvgNodeClick, nodeColor: nodeColor, nodeStrokeColor: nodeStrokeColor, nodeBorderRadius: nodeBorderRadius, nodeClassName: nodeClassName, nodeStrokeWidth: nodeStrokeWidth, nodeComponent: nodeComponent }), jsx("path", { className: "react-flow__minimap-mask", d: `M${x - offset},${y - offset}h${width + offset * 2}v${height + offset * 2}h${-width - offset * 2}z
        M${viewBB.x},${viewBB.y}h${viewBB.width}v${viewBB.height}h${-viewBB.width}z`, fillRule: "evenodd", pointerEvents: "none" })] }) }));
}
MiniMapComponent.displayName = 'MiniMap';
/**
 * The `<MiniMap />` component can be used to render an overview of your flow. It
 * renders each node as an SVG element and visualizes where the current viewport is
 * in relation to the rest of the flow.
 *
 * @public
 * @example
 *
 * ```jsx
 *import { ReactFlow, MiniMap } from '@xyflow/react';
 *
 *export default function Flow() {
 *  return (
 *    <ReactFlow nodes={[...]]} edges={[...]]}>
 *      <MiniMap nodeStrokeWidth={3} />
 *    </ReactFlow>
 *  );
 *}
 *```
 */
const MiniMap = memo(MiniMapComponent);

const scaleSelector = (calculateScale) => (store) => calculateScale ? `${Math.max(1 / store.transform[2], 1)}` : undefined;
const defaultPositions = {
    [ResizeControlVariant.Line]: 'right',
    [ResizeControlVariant.Handle]: 'bottom-right',
};
function ResizeControl({ nodeId, position, variant = ResizeControlVariant.Handle, className, style = undefined, children, color, minWidth = 10, minHeight = 10, maxWidth = Number.MAX_VALUE, maxHeight = Number.MAX_VALUE, keepAspectRatio = false, resizeDirection, autoScale = true, shouldResize, onResizeStart, onResize, onResizeEnd, }) {
    const contextNodeId = useNodeId();
    const id = typeof nodeId === 'string' ? nodeId : contextNodeId;
    const store = useStoreApi();
    const resizeControlRef = useRef(null);
    const isHandleControl = variant === ResizeControlVariant.Handle;
    const scale = useStore(useCallback(scaleSelector(isHandleControl && autoScale), [isHandleControl, autoScale]), shallow);
    const resizer = useRef(null);
    const controlPosition = position ?? defaultPositions[variant];
    useEffect(() => {
        if (!resizeControlRef.current || !id) {
            return;
        }
        if (!resizer.current) {
            resizer.current = XYResizer({
                domNode: resizeControlRef.current,
                nodeId: id,
                getStoreItems: () => {
                    const { nodeLookup, transform, snapGrid, snapToGrid, nodeOrigin, domNode } = store.getState();
                    return {
                        nodeLookup,
                        transform,
                        snapGrid,
                        snapToGrid,
                        nodeOrigin,
                        paneDomNode: domNode,
                    };
                },
                onChange: (change, childChanges) => {
                    const { triggerNodeChanges, nodeLookup, parentLookup, nodeOrigin } = store.getState();
                    const changes = [];
                    const nextPosition = { x: change.x, y: change.y };
                    const node = nodeLookup.get(id);
                    if (node && node.expandParent && node.parentId) {
                        const origin = node.origin ?? nodeOrigin;
                        const width = change.width ?? node.measured.width ?? 0;
                        const height = change.height ?? node.measured.height ?? 0;
                        const child = {
                            id: node.id,
                            parentId: node.parentId,
                            rect: {
                                width,
                                height,
                                ...evaluateAbsolutePosition({
                                    x: change.x ?? node.position.x,
                                    y: change.y ?? node.position.y,
                                }, { width, height }, node.parentId, nodeLookup, origin),
                            },
                        };
                        const parentExpandChanges = handleExpandParent([child], nodeLookup, parentLookup, nodeOrigin);
                        changes.push(...parentExpandChanges);
                        /*
                         * when the parent was expanded by the child node, its position will be clamped at
                         * 0,0 when node origin is 0,0 and to width, height if it's 1,1
                         */
                        nextPosition.x = change.x ? Math.max(origin[0] * width, change.x) : undefined;
                        nextPosition.y = change.y ? Math.max(origin[1] * height, change.y) : undefined;
                    }
                    if (nextPosition.x !== undefined && nextPosition.y !== undefined) {
                        const positionChange = {
                            id,
                            type: 'position',
                            position: { ...nextPosition },
                        };
                        changes.push(positionChange);
                    }
                    if (change.width !== undefined && change.height !== undefined) {
                        const setAttributes = !resizeDirection ? true : resizeDirection === 'horizontal' ? 'width' : 'height';
                        const dimensionChange = {
                            id,
                            type: 'dimensions',
                            resizing: true,
                            setAttributes,
                            dimensions: {
                                width: change.width,
                                height: change.height,
                            },
                        };
                        changes.push(dimensionChange);
                    }
                    for (const childChange of childChanges) {
                        const positionChange = {
                            ...childChange,
                            type: 'position',
                        };
                        changes.push(positionChange);
                    }
                    triggerNodeChanges(changes);
                },
                onEnd: ({ width, height }) => {
                    const dimensionChange = {
                        id: id,
                        type: 'dimensions',
                        resizing: false,
                        dimensions: {
                            width,
                            height,
                        },
                    };
                    store.getState().triggerNodeChanges([dimensionChange]);
                },
            });
        }
        resizer.current.update({
            controlPosition,
            boundaries: {
                minWidth,
                minHeight,
                maxWidth,
                maxHeight,
            },
            keepAspectRatio,
            resizeDirection,
            onResizeStart,
            onResize,
            onResizeEnd,
            shouldResize,
        });
        return () => {
            resizer.current?.destroy();
        };
    }, [
        controlPosition,
        minWidth,
        minHeight,
        maxWidth,
        maxHeight,
        keepAspectRatio,
        onResizeStart,
        onResize,
        onResizeEnd,
        shouldResize,
    ]);
    const positionClassNames = controlPosition.split('-');
    return (jsx("div", { className: cc(['react-flow__resize-control', 'nodrag', ...positionClassNames, variant, className]), ref: resizeControlRef, style: {
            ...style,
            scale,
            ...(color && { [isHandleControl ? 'backgroundColor' : 'borderColor']: color }),
        }, children: children }));
}
/**
 * To create your own resizing UI, you can use the `NodeResizeControl` component where you can pass children (such as icons).
 * @public
 *
 */
const NodeResizeControl = memo(ResizeControl);

/**
 * The `<NodeResizer />` component can be used to add a resize functionality to your
 * nodes. It renders draggable controls around the node to resize in all directions.
 * @public
 *
 * @example
 *```jsx
 *import { memo } from 'react';
 *import { Handle, Position, NodeResizer } from '@xyflow/react';
 *
 *function ResizableNode({ data }) {
 *  return (
 *    <>
 *      <NodeResizer minWidth={100} minHeight={30} />
 *      <Handle type="target" position={Position.Left} />
 *      <div style={{ padding: 10 }}>{data.label}</div>
 *      <Handle type="source" position={Position.Right} />
 *    </>
 *  );
 *};
 *
 *export default memo(ResizableNode);
 *```
 */
function NodeResizer({ nodeId, isVisible = true, handleClassName, handleStyle, lineClassName, lineStyle, color, minWidth = 10, minHeight = 10, maxWidth = Number.MAX_VALUE, maxHeight = Number.MAX_VALUE, keepAspectRatio = false, autoScale = true, shouldResize, onResizeStart, onResize, onResizeEnd, }) {
    if (!isVisible) {
        return null;
    }
    return (jsxs(Fragment, { children: [XY_RESIZER_LINE_POSITIONS.map((position) => (jsx(NodeResizeControl, { className: lineClassName, style: lineStyle, nodeId: nodeId, position: position, variant: ResizeControlVariant.Line, color: color, minWidth: minWidth, minHeight: minHeight, maxWidth: maxWidth, maxHeight: maxHeight, onResizeStart: onResizeStart, keepAspectRatio: keepAspectRatio, autoScale: autoScale, shouldResize: shouldResize, onResize: onResize, onResizeEnd: onResizeEnd }, position))), XY_RESIZER_HANDLE_POSITIONS.map((position) => (jsx(NodeResizeControl, { className: handleClassName, style: handleStyle, nodeId: nodeId, position: position, color: color, minWidth: minWidth, minHeight: minHeight, maxWidth: maxWidth, maxHeight: maxHeight, onResizeStart: onResizeStart, keepAspectRatio: keepAspectRatio, autoScale: autoScale, shouldResize: shouldResize, onResize: onResize, onResizeEnd: onResizeEnd }, position)))] }));
}

const selector = (state) => state.domNode?.querySelector('.react-flow__renderer');
function NodeToolbarPortal({ children }) {
    const wrapperRef = useStore(selector);
    if (!wrapperRef) {
        return null;
    }
    return createPortal(children, wrapperRef);
}

const nodeEqualityFn = (a, b) => a?.internals.positionAbsolute.x !== b?.internals.positionAbsolute.x ||
    a?.internals.positionAbsolute.y !== b?.internals.positionAbsolute.y ||
    a?.measured.width !== b?.measured.width ||
    a?.measured.height !== b?.measured.height ||
    a?.selected !== b?.selected ||
    a?.internals.z !== b?.internals.z;
const nodesEqualityFn = (a, b) => {
    if (a.size !== b.size) {
        return false;
    }
    for (const [key, node] of a) {
        if (nodeEqualityFn(node, b.get(key))) {
            return false;
        }
    }
    return true;
};
const storeSelector = (state) => ({
    x: state.transform[0],
    y: state.transform[1],
    zoom: state.transform[2],
    selectedNodesCount: state.nodes.filter((node) => node.selected).length,
});
/**
 * This component can render a toolbar or tooltip to one side of a custom node. This
 * toolbar doesn't scale with the viewport so that the content is always visible.
 *
 * @public
 * @example
 * ```jsx
 *import { memo } from 'react';
 *import { Handle, Position, NodeToolbar } from '@xyflow/react';
 *
 *function CustomNode({ data }) {
 *  return (
 *    <>
 *      <NodeToolbar isVisible={data.toolbarVisible} position={data.toolbarPosition}>
 *        <button>delete</button>
 *        <button>copy</button>
 *        <button>expand</button>
 *      </NodeToolbar>
 *
 *      <div style={{ padding: '10px 20px' }}>
 *        {data.label}
 *      </div>
 *
 *      <Handle type="target" position={Position.Left} />
 *      <Handle type="source" position={Position.Right} />
 *    </>
 *  );
 *};
 *
 *export default memo(CustomNode);
 *```
 * @remarks By default, the toolbar is only visible when a node is selected. If multiple
 * nodes are selected it will not be visible to prevent overlapping toolbars or
 * clutter. You can override this behavior by setting the `isVisible` prop to `true`.
 */
function NodeToolbar({ nodeId, children, className, style, isVisible, position = Position.Top, offset = 10, align = 'center', ...rest }) {
    const contextNodeId = useNodeId();
    const nodesSelector = useCallback((state) => {
        const nodeIds = Array.isArray(nodeId) ? nodeId : [nodeId || contextNodeId || ''];
        const internalNodes = nodeIds.reduce((res, id) => {
            const node = state.nodeLookup.get(id);
            if (node) {
                res.set(node.id, node);
            }
            return res;
        }, new Map());
        return internalNodes;
    }, [nodeId, contextNodeId]);
    const nodes = useStore(nodesSelector, nodesEqualityFn);
    const { x, y, zoom, selectedNodesCount } = useStore(storeSelector, shallow);
    // if isVisible is not set, we show the toolbar only if its node is selected and no other node is selected
    const isActive = typeof isVisible === 'boolean'
        ? isVisible
        : nodes.size === 1 && nodes.values().next().value?.selected && selectedNodesCount === 1;
    if (!isActive || !nodes.size) {
        return null;
    }
    const nodeRect = getInternalNodesBounds(nodes);
    const nodesArray = Array.from(nodes.values());
    const zIndex = Math.max(...nodesArray.map((node) => node.internals.z + 1));
    const wrapperStyle = {
        position: 'absolute',
        transform: getNodeToolbarTransform(nodeRect, { x, y, zoom }, position, offset, align),
        zIndex,
        ...style,
    };
    return (jsx(NodeToolbarPortal, { children: jsx("div", { style: wrapperStyle, className: cc(['react-flow__node-toolbar', className]), ...rest, "data-id": nodesArray.reduce((acc, node) => `${acc}${node.id} `, '').trim(), children: children }) }));
}

const zoomSelector = (state) => state.transform[2];
/**
 * This component can render a toolbar or tooltip to one side of a custom edge. This
 * toolbar doesn't scale with the viewport so that the content stays the same size.
 *
 * @public
 * @example
 * ```jsx
 * import { EdgeToolbar, BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
 *
 * export function CustomEdge({ id, data, ...props }: EdgeProps) {
 *   const [edgePath, centerX, centerY] = getBezierPath(props);
 *
 *   return (
 *     <>
 *       <BaseEdge id={id} path={edgePath} />
 *       <EdgeToolbar edgeId={id} x={centerX} y={centerY} isVisible>
 *         <button onClick={() => console.log('edge', id, 'click')}}>Click me</button>
 *       </EdgeToolbar>
 *     </>
 *   );
 * }
 * ```
 */
function EdgeToolbar({ edgeId, x, y, children, className, style, isVisible, alignX = 'center', alignY = 'center', ...rest }) {
    const edgeSelector = useCallback((state) => state.edgeLookup.get(edgeId), [edgeId]);
    const edge = useStore(edgeSelector, shallow);
    const isActive = typeof isVisible === 'boolean' ? isVisible : edge?.selected;
    const zoom = useStore(zoomSelector);
    if (!isActive) {
        return null;
    }
    const zIndex = (edge?.zIndex ?? 0) + 1;
    const transform = getEdgeToolbarTransform(x, y, zoom, alignX, alignY);
    return (jsx(EdgeLabelRenderer, { children: jsx("div", { style: {
                position: 'absolute',
                transform,
                zIndex,
                pointerEvents: 'all',
                transformOrigin: '0 0',
                ...style,
            }, className: cc(['react-flow__edge-toolbar', className]), "data-id": edge?.id ?? '', ...rest, children: children }) }));
}

export { Background, BackgroundVariant, BaseEdge, BezierEdge, ControlButton, Controls, EdgeLabelRenderer, EdgeText, EdgeToolbar, Handle, MiniMap, MiniMapNode, NodeResizeControl, NodeResizer, NodeToolbar, Panel, index as ReactFlow, ReactFlowProvider, SimpleBezierEdge, SmoothStepEdge, StepEdge, StraightEdge, ViewportPortal, applyEdgeChanges, applyNodeChanges, getSimpleBezierPath, isEdge, isNode, useConnection, useEdges, useEdgesState, useHandleConnections, useInternalNode, useKeyPress, useNodeConnections, useNodeId, useNodes, useNodesData, useNodesInitialized, useNodesState, useOnSelectionChange, useOnViewportChange, useReactFlow, useStore, useStoreApi, useUpdateNodeInternals, useViewport };
