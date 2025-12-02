import { drag } from 'd3-drag';
import { select, pointer } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import { interpolateZoom, interpolate } from 'd3-interpolate';

const errorMessages = {
    error001: () => '[React Flow]: Seems like you have not used zustand provider as an ancestor. Help: https://reactflow.dev/error#001',
    error002: () => "It looks like you've created a new nodeTypes or edgeTypes object. If this wasn't on purpose please define the nodeTypes/edgeTypes outside of the component or memoize them.",
    error003: (nodeType) => `Node type "${nodeType}" not found. Using fallback type "default".`,
    error004: () => 'The React Flow parent container needs a width and a height to render the graph.',
    error005: () => 'Only child nodes can use a parent extent.',
    error006: () => "Can't create edge. An edge needs a source and a target.",
    error007: (id) => `The old edge with id=${id} does not exist.`,
    error009: (type) => `Marker type "${type}" doesn't exist.`,
    error008: (handleType, { id, sourceHandle, targetHandle }) => `Couldn't create edge for ${handleType} handle id: "${handleType === 'source' ? sourceHandle : targetHandle}", edge id: ${id}.`,
    error010: () => 'Handle: No node id found. Make sure to only use a Handle inside a custom Node.',
    error011: (edgeType) => `Edge type "${edgeType}" not found. Using fallback type "default".`,
    error012: (id) => `Node with id "${id}" does not exist, it may have been removed. This can happen when a node is deleted before the "onNodeClick" handler is called.`,
    error013: (lib = 'react') => `It seems that you haven't loaded the styles. Please import '@xyflow/${lib}/dist/style.css' or base.css to make sure everything is working properly.`,
    error014: () => 'useNodeConnections: No node ID found. Call useNodeConnections inside a custom Node or provide a node ID.',
    error015: () => 'It seems that you are trying to drag a node that is not initialized. Please use onNodesChange as explained in the docs.',
};
const infiniteExtent = [
    [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
];
const elementSelectionKeys = ['Enter', ' ', 'Escape'];
const defaultAriaLabelConfig = {
    'node.a11yDescription.default': 'Press enter or space to select a node. Press delete to remove it and escape to cancel.',
    'node.a11yDescription.keyboardDisabled': 'Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel.',
    'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) => `Moved selected node ${direction}. New position, x: ${x}, y: ${y}`,
    'edge.a11yDescription.default': 'Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.',
    // Control elements
    'controls.ariaLabel': 'Control Panel',
    'controls.zoomIn.ariaLabel': 'Zoom In',
    'controls.zoomOut.ariaLabel': 'Zoom Out',
    'controls.fitView.ariaLabel': 'Fit View',
    'controls.interactive.ariaLabel': 'Toggle Interactivity',
    // Mini map
    'minimap.ariaLabel': 'Mini Map',
    // Handle
    'handle.ariaLabel': 'Handle',
};

/**
 * The `ConnectionMode` is used to set the mode of connection between nodes.
 * The `Strict` mode is the default one and only allows source to target edges.
 * `Loose` mode allows source to source and target to target edges as well.
 *
 * @public
 */
var ConnectionMode;
(function (ConnectionMode) {
    ConnectionMode["Strict"] = "strict";
    ConnectionMode["Loose"] = "loose";
})(ConnectionMode || (ConnectionMode = {}));
/**
 * This enum is used to set the different modes of panning the viewport when the
 * user scrolls. The `Free` mode allows the user to pan in any direction by scrolling
 * with a device like a trackpad. The `Vertical` and `Horizontal` modes restrict
 * scroll panning to only the vertical or horizontal axis, respectively.
 *
 * @public
 */
var PanOnScrollMode;
(function (PanOnScrollMode) {
    PanOnScrollMode["Free"] = "free";
    PanOnScrollMode["Vertical"] = "vertical";
    PanOnScrollMode["Horizontal"] = "horizontal";
})(PanOnScrollMode || (PanOnScrollMode = {}));
var SelectionMode;
(function (SelectionMode) {
    SelectionMode["Partial"] = "partial";
    SelectionMode["Full"] = "full";
})(SelectionMode || (SelectionMode = {}));
const initialConnection = {
    inProgress: false,
    isValid: null,
    from: null,
    fromHandle: null,
    fromPosition: null,
    fromNode: null,
    to: null,
    toHandle: null,
    toPosition: null,
    toNode: null,
    pointer: null,
};

/**
 * If you set the `connectionLineType` prop on your [`<ReactFlow />`](/api-reference/react-flow#connection-connectionLineType)
 *component, it will dictate the style of connection line rendered when creating
 *new edges.
 *
 * @public
 *
 * @remarks If you choose to render a custom connection line component, this value will be
 *passed to your component as part of its [`ConnectionLineComponentProps`](/api-reference/types/connection-line-component-props).
 */
var ConnectionLineType;
(function (ConnectionLineType) {
    ConnectionLineType["Bezier"] = "default";
    ConnectionLineType["Straight"] = "straight";
    ConnectionLineType["Step"] = "step";
    ConnectionLineType["SmoothStep"] = "smoothstep";
    ConnectionLineType["SimpleBezier"] = "simplebezier";
})(ConnectionLineType || (ConnectionLineType = {}));
/**
 * Edges may optionally have a marker on either end. The MarkerType type enumerates
 * the options available to you when configuring a given marker.
 *
 * @public
 */
var MarkerType;
(function (MarkerType) {
    MarkerType["Arrow"] = "arrow";
    MarkerType["ArrowClosed"] = "arrowclosed";
})(MarkerType || (MarkerType = {}));

/**
 * While [`PanelPosition`](/api-reference/types/panel-position) can be used to place a
 * component in the corners of a container, the `Position` enum is less precise and used
 * primarily in relation to edges and handles.
 *
 * @public
 */
var Position;
(function (Position) {
    Position["Left"] = "left";
    Position["Top"] = "top";
    Position["Right"] = "right";
    Position["Bottom"] = "bottom";
})(Position || (Position = {}));
const oppositePosition = {
    [Position.Left]: Position.Right,
    [Position.Right]: Position.Left,
    [Position.Top]: Position.Bottom,
    [Position.Bottom]: Position.Top,
};

/**
 * @internal
 */
function areConnectionMapsEqual(a, b) {
    if (!a && !b) {
        return true;
    }
    if (!a || !b || a.size !== b.size) {
        return false;
    }
    if (!a.size && !b.size) {
        return true;
    }
    for (const key of a.keys()) {
        if (!b.has(key)) {
            return false;
        }
    }
    return true;
}
/**
 * We call the callback for all connections in a that are not in b
 *
 * @internal
 */
function handleConnectionChange(a, b, cb) {
    if (!cb) {
        return;
    }
    const diff = [];
    a.forEach((connection, key) => {
        if (!b?.has(key)) {
            diff.push(connection);
        }
    });
    if (diff.length) {
        cb(diff);
    }
}
function getConnectionStatus(isValid) {
    return isValid === null ? null : isValid ? 'valid' : 'invalid';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test whether an object is usable as an Edge
 * @public
 * @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Edge if it returns true
 * @param element - The element to test
 * @returns A boolean indicating whether the element is an Edge
 */
const isEdgeBase = (element) => 'id' in element && 'source' in element && 'target' in element;
/**
 * Test whether an object is usable as a Node
 * @public
 * @remarks In TypeScript this is a type guard that will narrow the type of whatever you pass in to Node if it returns true
 * @param element - The element to test
 * @returns A boolean indicating whether the element is an Node
 */
const isNodeBase = (element) => 'id' in element && 'position' in element && !('source' in element) && !('target' in element);
const isInternalNodeBase = (element) => 'id' in element && 'internals' in element && !('source' in element) && !('target' in element);
/**
 * This util is used to tell you what nodes, if any, are connected to the given node
 * as the _target_ of an edge.
 * @public
 * @param node - The node to get the connected nodes from.
 * @param nodes - The array of all nodes.
 * @param edges - The array of all edges.
 * @returns An array of nodes that are connected over edges where the source is the given node.
 *
 * @example
 * ```ts
 *import { getOutgoers } from '@xyflow/react';
 *
 *const nodes = [];
 *const edges = [];
 *
 *const outgoers = getOutgoers(
 *  { id: '1', position: { x: 0, y: 0 }, data: { label: 'node' } },
 *  nodes,
 *  edges,
 *);
 *```
 */
const getOutgoers = (node, nodes, edges) => {
    if (!node.id) {
        return [];
    }
    const outgoerIds = new Set();
    edges.forEach((edge) => {
        if (edge.source === node.id) {
            outgoerIds.add(edge.target);
        }
    });
    return nodes.filter((n) => outgoerIds.has(n.id));
};
/**
 * This util is used to tell you what nodes, if any, are connected to the given node
 * as the _source_ of an edge.
 * @public
 * @param node - The node to get the connected nodes from.
 * @param nodes - The array of all nodes.
 * @param edges - The array of all edges.
 * @returns An array of nodes that are connected over edges where the target is the given node.
 *
 * @example
 * ```ts
 *import { getIncomers } from '@xyflow/react';
 *
 *const nodes = [];
 *const edges = [];
 *
 *const incomers = getIncomers(
 *  { id: '1', position: { x: 0, y: 0 }, data: { label: 'node' } },
 *  nodes,
 *  edges,
 *);
 *```
 */
const getIncomers = (node, nodes, edges) => {
    if (!node.id) {
        return [];
    }
    const incomersIds = new Set();
    edges.forEach((edge) => {
        if (edge.target === node.id) {
            incomersIds.add(edge.source);
        }
    });
    return nodes.filter((n) => incomersIds.has(n.id));
};
const getNodePositionWithOrigin = (node, nodeOrigin = [0, 0]) => {
    const { width, height } = getNodeDimensions(node);
    const origin = node.origin ?? nodeOrigin;
    const offsetX = width * origin[0];
    const offsetY = height * origin[1];
    return {
        x: node.position.x - offsetX,
        y: node.position.y - offsetY,
    };
};
/**
 * Returns the bounding box that contains all the given nodes in an array. This can
 * be useful when combined with [`getViewportForBounds`](/api-reference/utils/get-viewport-for-bounds)
 * to calculate the correct transform to fit the given nodes in a viewport.
 * @public
 * @remarks Useful when combined with {@link getViewportForBounds} to calculate the correct transform to fit the given nodes in a viewport.
 * @param nodes - Nodes to calculate the bounds for.
 * @returns Bounding box enclosing all nodes.
 *
 * @remarks This function was previously called `getRectOfNodes`
 *
 * @example
 * ```js
 *import { getNodesBounds } from '@xyflow/react';
 *
 *const nodes = [
 *  {
 *    id: 'a',
 *    position: { x: 0, y: 0 },
 *    data: { label: 'a' },
 *    width: 50,
 *    height: 25,
 *  },
 *  {
 *    id: 'b',
 *    position: { x: 100, y: 100 },
 *    data: { label: 'b' },
 *    width: 50,
 *    height: 25,
 *  },
 *];
 *
 *const bounds = getNodesBounds(nodes);
 *```
 */
const getNodesBounds = (nodes, params = { nodeOrigin: [0, 0] }) => {
    if (process.env.NODE_ENV === 'development' && !params.nodeLookup) {
        console.warn('Please use `getNodesBounds` from `useReactFlow`/`useSvelteFlow` hook to ensure correct values for sub flows. If not possible, you have to provide a nodeLookup to support sub flows.');
    }
    if (nodes.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    const box = nodes.reduce((currBox, nodeOrId) => {
        const isId = typeof nodeOrId === 'string';
        let currentNode = !params.nodeLookup && !isId ? nodeOrId : undefined;
        if (params.nodeLookup) {
            currentNode = isId
                ? params.nodeLookup.get(nodeOrId)
                : !isInternalNodeBase(nodeOrId)
                    ? params.nodeLookup.get(nodeOrId.id)
                    : nodeOrId;
        }
        const nodeBox = currentNode ? nodeToBox(currentNode, params.nodeOrigin) : { x: 0, y: 0, x2: 0, y2: 0 };
        return getBoundsOfBoxes(currBox, nodeBox);
    }, { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity });
    return boxToRect(box);
};
/**
 * Determines a bounding box that contains all given nodes in an array
 * @internal
 */
const getInternalNodesBounds = (nodeLookup, params = {}) => {
    let box = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };
    let hasVisibleNodes = false;
    nodeLookup.forEach((node) => {
        if (params.filter === undefined || params.filter(node)) {
            box = getBoundsOfBoxes(box, nodeToBox(node));
            hasVisibleNodes = true;
        }
    });
    return hasVisibleNodes ? boxToRect(box) : { x: 0, y: 0, width: 0, height: 0 };
};
const getNodesInside = (nodes, rect, [tx, ty, tScale] = [0, 0, 1], partially = false, 
// set excludeNonSelectableNodes if you want to pay attention to the nodes "selectable" attribute
excludeNonSelectableNodes = false) => {
    const paneRect = {
        ...pointToRendererPoint(rect, [tx, ty, tScale]),
        width: rect.width / tScale,
        height: rect.height / tScale,
    };
    const visibleNodes = [];
    for (const node of nodes.values()) {
        const { measured, selectable = true, hidden = false } = node;
        if ((excludeNonSelectableNodes && !selectable) || hidden) {
            continue;
        }
        const width = measured.width ?? node.width ?? node.initialWidth ?? null;
        const height = measured.height ?? node.height ?? node.initialHeight ?? null;
        const overlappingArea = getOverlappingArea(paneRect, nodeToRect(node));
        const area = (width ?? 0) * (height ?? 0);
        const partiallyVisible = partially && overlappingArea > 0;
        const forceInitialRender = !node.internals.handleBounds;
        const isVisible = forceInitialRender || partiallyVisible || overlappingArea >= area;
        if (isVisible || node.dragging) {
            visibleNodes.push(node);
        }
    }
    return visibleNodes;
};
/**
 * This utility filters an array of edges, keeping only those where either the source or target
 * node is present in the given array of nodes.
 * @public
 * @param nodes - Nodes you want to get the connected edges for.
 * @param edges - All edges.
 * @returns Array of edges that connect any of the given nodes with each other.
 *
 * @example
 * ```js
 *import { getConnectedEdges } from '@xyflow/react';
 *
 *const nodes = [
 *  { id: 'a', position: { x: 0, y: 0 } },
 *  { id: 'b', position: { x: 100, y: 0 } },
 *];
 *
 *const edges = [
 *  { id: 'a->c', source: 'a', target: 'c' },
 *  { id: 'c->d', source: 'c', target: 'd' },
 *];
 *
 *const connectedEdges = getConnectedEdges(nodes, edges);
 * // => [{ id: 'a->c', source: 'a', target: 'c' }]
 *```
 */
const getConnectedEdges = (nodes, edges) => {
    const nodeIds = new Set();
    nodes.forEach((node) => {
        nodeIds.add(node.id);
    });
    return edges.filter((edge) => nodeIds.has(edge.source) || nodeIds.has(edge.target));
};
function getFitViewNodes(nodeLookup, options) {
    const fitViewNodes = new Map();
    const optionNodeIds = options?.nodes ? new Set(options.nodes.map((node) => node.id)) : null;
    nodeLookup.forEach((n) => {
        const isVisible = n.measured.width && n.measured.height && (options?.includeHiddenNodes || !n.hidden);
        if (isVisible && (!optionNodeIds || optionNodeIds.has(n.id))) {
            fitViewNodes.set(n.id, n);
        }
    });
    return fitViewNodes;
}
async function fitViewport({ nodes, width, height, panZoom, minZoom, maxZoom }, options) {
    if (nodes.size === 0) {
        return Promise.resolve(true);
    }
    const nodesToFit = getFitViewNodes(nodes, options);
    const bounds = getInternalNodesBounds(nodesToFit);
    const viewport = getViewportForBounds(bounds, width, height, options?.minZoom ?? minZoom, options?.maxZoom ?? maxZoom, options?.padding ?? 0.1);
    await panZoom.setViewport(viewport, {
        duration: options?.duration,
        ease: options?.ease,
        interpolate: options?.interpolate,
    });
    return Promise.resolve(true);
}
/**
 * This function calculates the next position of a node, taking into account the node's extent, parent node, and origin.
 *
 * @internal
 * @returns position, positionAbsolute
 */
function calculateNodePosition({ nodeId, nextPosition, nodeLookup, nodeOrigin = [0, 0], nodeExtent, onError, }) {
    const node = nodeLookup.get(nodeId);
    const parentNode = node.parentId ? nodeLookup.get(node.parentId) : undefined;
    const { x: parentX, y: parentY } = parentNode ? parentNode.internals.positionAbsolute : { x: 0, y: 0 };
    const origin = node.origin ?? nodeOrigin;
    let extent = node.extent || nodeExtent;
    if (node.extent === 'parent' && !node.expandParent) {
        if (!parentNode) {
            onError?.('005', errorMessages['error005']());
        }
        else {
            const parentWidth = parentNode.measured.width;
            const parentHeight = parentNode.measured.height;
            if (parentWidth && parentHeight) {
                extent = [
                    [parentX, parentY],
                    [parentX + parentWidth, parentY + parentHeight],
                ];
            }
        }
    }
    else if (parentNode && isCoordinateExtent(node.extent)) {
        extent = [
            [node.extent[0][0] + parentX, node.extent[0][1] + parentY],
            [node.extent[1][0] + parentX, node.extent[1][1] + parentY],
        ];
    }
    const positionAbsolute = isCoordinateExtent(extent)
        ? clampPosition(nextPosition, extent, node.measured)
        : nextPosition;
    if (node.measured.width === undefined || node.measured.height === undefined) {
        onError?.('015', errorMessages['error015']());
    }
    return {
        position: {
            x: positionAbsolute.x - parentX + (node.measured.width ?? 0) * origin[0],
            y: positionAbsolute.y - parentY + (node.measured.height ?? 0) * origin[1],
        },
        positionAbsolute,
    };
}
/**
 * Pass in nodes & edges to delete, get arrays of nodes and edges that actually can be deleted
 * @internal
 * @param param.nodesToRemove - The nodes to remove
 * @param param.edgesToRemove - The edges to remove
 * @param param.nodes - All nodes
 * @param param.edges - All edges
 * @param param.onBeforeDelete - Callback to check which nodes and edges can be deleted
 * @returns nodes: nodes that can be deleted, edges: edges that can be deleted
 */
async function getElementsToRemove({ nodesToRemove = [], edgesToRemove = [], nodes, edges, onBeforeDelete, }) {
    const nodeIds = new Set(nodesToRemove.map((node) => node.id));
    const matchingNodes = [];
    for (const node of nodes) {
        if (node.deletable === false) {
            continue;
        }
        const isIncluded = nodeIds.has(node.id);
        const parentHit = !isIncluded && node.parentId && matchingNodes.find((n) => n.id === node.parentId);
        if (isIncluded || parentHit) {
            matchingNodes.push(node);
        }
    }
    const edgeIds = new Set(edgesToRemove.map((edge) => edge.id));
    const deletableEdges = edges.filter((edge) => edge.deletable !== false);
    const connectedEdges = getConnectedEdges(matchingNodes, deletableEdges);
    const matchingEdges = connectedEdges;
    for (const edge of deletableEdges) {
        const isIncluded = edgeIds.has(edge.id);
        if (isIncluded && !matchingEdges.find((e) => e.id === edge.id)) {
            matchingEdges.push(edge);
        }
    }
    if (!onBeforeDelete) {
        return {
            edges: matchingEdges,
            nodes: matchingNodes,
        };
    }
    const onBeforeDeleteResult = await onBeforeDelete({
        nodes: matchingNodes,
        edges: matchingEdges,
    });
    if (typeof onBeforeDeleteResult === 'boolean') {
        return onBeforeDeleteResult ? { edges: matchingEdges, nodes: matchingNodes } : { edges: [], nodes: [] };
    }
    return onBeforeDeleteResult;
}

const clamp = (val, min = 0, max = 1) => Math.min(Math.max(val, min), max);
const clampPosition = (position = { x: 0, y: 0 }, extent, dimensions) => ({
    x: clamp(position.x, extent[0][0], extent[1][0] - (dimensions?.width ?? 0)),
    y: clamp(position.y, extent[0][1], extent[1][1] - (dimensions?.height ?? 0)),
});
function clampPositionToParent(childPosition, childDimensions, parent) {
    const { width: parentWidth, height: parentHeight } = getNodeDimensions(parent);
    const { x: parentX, y: parentY } = parent.internals.positionAbsolute;
    return clampPosition(childPosition, [
        [parentX, parentY],
        [parentX + parentWidth, parentY + parentHeight],
    ], childDimensions);
}
/**
 * Calculates the velocity of panning when the mouse is close to the edge of the canvas
 * @internal
 * @param value - One dimensional poition of the mouse (x or y)
 * @param min - Minimal position on canvas before panning starts
 * @param max - Maximal position on canvas before panning starts
 * @returns - A number between 0 and 1 that represents the velocity of panning
 */
const calcAutoPanVelocity = (value, min, max) => {
    if (value < min) {
        return clamp(Math.abs(value - min), 1, min) / min;
    }
    else if (value > max) {
        return -clamp(Math.abs(value - max), 1, min) / min;
    }
    return 0;
};
const calcAutoPan = (pos, bounds, speed = 15, distance = 40) => {
    const xMovement = calcAutoPanVelocity(pos.x, distance, bounds.width - distance) * speed;
    const yMovement = calcAutoPanVelocity(pos.y, distance, bounds.height - distance) * speed;
    return [xMovement, yMovement];
};
const getBoundsOfBoxes = (box1, box2) => ({
    x: Math.min(box1.x, box2.x),
    y: Math.min(box1.y, box2.y),
    x2: Math.max(box1.x2, box2.x2),
    y2: Math.max(box1.y2, box2.y2),
});
const rectToBox = ({ x, y, width, height }) => ({
    x,
    y,
    x2: x + width,
    y2: y + height,
});
const boxToRect = ({ x, y, x2, y2 }) => ({
    x,
    y,
    width: x2 - x,
    height: y2 - y,
});
const nodeToRect = (node, nodeOrigin = [0, 0]) => {
    const { x, y } = isInternalNodeBase(node)
        ? node.internals.positionAbsolute
        : getNodePositionWithOrigin(node, nodeOrigin);
    return {
        x,
        y,
        width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
        height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0,
    };
};
const nodeToBox = (node, nodeOrigin = [0, 0]) => {
    const { x, y } = isInternalNodeBase(node)
        ? node.internals.positionAbsolute
        : getNodePositionWithOrigin(node, nodeOrigin);
    return {
        x,
        y,
        x2: x + (node.measured?.width ?? node.width ?? node.initialWidth ?? 0),
        y2: y + (node.measured?.height ?? node.height ?? node.initialHeight ?? 0),
    };
};
const getBoundsOfRects = (rect1, rect2) => boxToRect(getBoundsOfBoxes(rectToBox(rect1), rectToBox(rect2)));
const getOverlappingArea = (rectA, rectB) => {
    const xOverlap = Math.max(0, Math.min(rectA.x + rectA.width, rectB.x + rectB.width) - Math.max(rectA.x, rectB.x));
    const yOverlap = Math.max(0, Math.min(rectA.y + rectA.height, rectB.y + rectB.height) - Math.max(rectA.y, rectB.y));
    return Math.ceil(xOverlap * yOverlap);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isRectObject = (obj) => isNumeric(obj.width) && isNumeric(obj.height) && isNumeric(obj.x) && isNumeric(obj.y);
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const isNumeric = (n) => !isNaN(n) && isFinite(n);
// used for a11y key board controls for nodes and edges
const devWarn = (id, message) => {
    if (process.env.NODE_ENV === 'development') {
        console.warn(`[React Flow]: ${message} Help: https://reactflow.dev/error#${id}`);
    }
};
const snapPosition = (position, snapGrid = [1, 1]) => {
    return {
        x: snapGrid[0] * Math.round(position.x / snapGrid[0]),
        y: snapGrid[1] * Math.round(position.y / snapGrid[1]),
    };
};
const pointToRendererPoint = ({ x, y }, [tx, ty, tScale], snapToGrid = false, snapGrid = [1, 1]) => {
    const position = {
        x: (x - tx) / tScale,
        y: (y - ty) / tScale,
    };
    return snapToGrid ? snapPosition(position, snapGrid) : position;
};
const rendererPointToPoint = ({ x, y }, [tx, ty, tScale]) => {
    return {
        x: x * tScale + tx,
        y: y * tScale + ty,
    };
};
/**
 * Parses a single padding value to a number
 * @internal
 * @param padding - Padding to parse
 * @param viewport - Width or height of the viewport
 * @returns The padding in pixels
 */
function parsePadding(padding, viewport) {
    if (typeof padding === 'number') {
        return Math.floor((viewport - viewport / (1 + padding)) * 0.5);
    }
    if (typeof padding === 'string' && padding.endsWith('px')) {
        const paddingValue = parseFloat(padding);
        if (!Number.isNaN(paddingValue)) {
            return Math.floor(paddingValue);
        }
    }
    if (typeof padding === 'string' && padding.endsWith('%')) {
        const paddingValue = parseFloat(padding);
        if (!Number.isNaN(paddingValue)) {
            return Math.floor(viewport * paddingValue * 0.01);
        }
    }
    console.error(`[React Flow] The padding value "${padding}" is invalid. Please provide a number or a string with a valid unit (px or %).`);
    return 0;
}
/**
 * Parses the paddings to an object with top, right, bottom, left, x and y paddings
 * @internal
 * @param padding - Padding to parse
 * @param width - Width of the viewport
 * @param height - Height of the viewport
 * @returns An object with the paddings in pixels
 */
function parsePaddings(padding, width, height) {
    if (typeof padding === 'string' || typeof padding === 'number') {
        const paddingY = parsePadding(padding, height);
        const paddingX = parsePadding(padding, width);
        return {
            top: paddingY,
            right: paddingX,
            bottom: paddingY,
            left: paddingX,
            x: paddingX * 2,
            y: paddingY * 2,
        };
    }
    if (typeof padding === 'object') {
        const top = parsePadding(padding.top ?? padding.y ?? 0, height);
        const bottom = parsePadding(padding.bottom ?? padding.y ?? 0, height);
        const left = parsePadding(padding.left ?? padding.x ?? 0, width);
        const right = parsePadding(padding.right ?? padding.x ?? 0, width);
        return { top, right, bottom, left, x: left + right, y: top + bottom };
    }
    return { top: 0, right: 0, bottom: 0, left: 0, x: 0, y: 0 };
}
/**
 * Calculates the resulting paddings if the new viewport is applied
 * @internal
 * @param bounds - Bounds to fit inside viewport
 * @param x - X position of the viewport
 * @param y - Y position of the viewport
 * @param zoom - Zoom level of the viewport
 * @param width - Width of the viewport
 * @param height - Height of the viewport
 * @returns An object with the minimum padding required to fit the bounds inside the viewport
 */
function calculateAppliedPaddings(bounds, x, y, zoom, width, height) {
    const { x: left, y: top } = rendererPointToPoint(bounds, [x, y, zoom]);
    const { x: boundRight, y: boundBottom } = rendererPointToPoint({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, [x, y, zoom]);
    const right = width - boundRight;
    const bottom = height - boundBottom;
    return {
        left: Math.floor(left),
        top: Math.floor(top),
        right: Math.floor(right),
        bottom: Math.floor(bottom),
    };
}
/**
 * Returns a viewport that encloses the given bounds with padding.
 * @public
 * @remarks You can determine bounds of nodes with {@link getNodesBounds} and {@link getBoundsOfRects}
 * @param bounds - Bounds to fit inside viewport.
 * @param width - Width of the viewport.
 * @param height  - Height of the viewport.
 * @param minZoom - Minimum zoom level of the resulting viewport.
 * @param maxZoom - Maximum zoom level of the resulting viewport.
 * @param padding - Padding around the bounds.
 * @returns A transformed {@link Viewport} that encloses the given bounds which you can pass to e.g. {@link setViewport}.
 * @example
 * const { x, y, zoom } = getViewportForBounds(
 * { x: 0, y: 0, width: 100, height: 100},
 * 1200, 800, 0.5, 2);
 */
const getViewportForBounds = (bounds, width, height, minZoom, maxZoom, padding) => {
    // First we resolve all the paddings to actual pixel values
    const p = parsePaddings(padding, width, height);
    const xZoom = (width - p.x) / bounds.width;
    const yZoom = (height - p.y) / bounds.height;
    // We calculate the new x, y, zoom for a centered view
    const zoom = Math.min(xZoom, yZoom);
    const clampedZoom = clamp(zoom, minZoom, maxZoom);
    const boundsCenterX = bounds.x + bounds.width / 2;
    const boundsCenterY = bounds.y + bounds.height / 2;
    const x = width / 2 - boundsCenterX * clampedZoom;
    const y = height / 2 - boundsCenterY * clampedZoom;
    // Then we calculate the minimum padding, to respect asymmetric paddings
    const newPadding = calculateAppliedPaddings(bounds, x, y, clampedZoom, width, height);
    // We only want to have an offset if the newPadding is smaller than the required padding
    const offset = {
        left: Math.min(newPadding.left - p.left, 0),
        top: Math.min(newPadding.top - p.top, 0),
        right: Math.min(newPadding.right - p.right, 0),
        bottom: Math.min(newPadding.bottom - p.bottom, 0),
    };
    return {
        x: x - offset.left + offset.right,
        y: y - offset.top + offset.bottom,
        zoom: clampedZoom,
    };
};
const isMacOs = () => typeof navigator !== 'undefined' && navigator?.userAgent?.indexOf('Mac') >= 0;
function isCoordinateExtent(extent) {
    return extent !== undefined && extent !== null && extent !== 'parent';
}
function getNodeDimensions(node) {
    return {
        width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
        height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0,
    };
}
function nodeHasDimensions(node) {
    return ((node.measured?.width ?? node.width ?? node.initialWidth) !== undefined &&
        (node.measured?.height ?? node.height ?? node.initialHeight) !== undefined);
}
/**
 * Convert child position to aboslute position
 *
 * @internal
 * @param position
 * @param parentId
 * @param nodeLookup
 * @param nodeOrigin
 * @returns an internal node with an absolute position
 */
function evaluateAbsolutePosition(position, dimensions = { width: 0, height: 0 }, parentId, nodeLookup, nodeOrigin) {
    const positionAbsolute = { ...position };
    const parent = nodeLookup.get(parentId);
    if (parent) {
        const origin = parent.origin || nodeOrigin;
        positionAbsolute.x += parent.internals.positionAbsolute.x - (dimensions.width ?? 0) * origin[0];
        positionAbsolute.y += parent.internals.positionAbsolute.y - (dimensions.height ?? 0) * origin[1];
    }
    return positionAbsolute;
}
function areSetsEqual(a, b) {
    if (a.size !== b.size) {
        return false;
    }
    for (const item of a) {
        if (!b.has(item)) {
            return false;
        }
    }
    return true;
}
/**
 * Polyfill for Promise.withResolvers until we can use it in all browsers
 * @internal
 */
function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}
function mergeAriaLabelConfig(partial) {
    return { ...defaultAriaLabelConfig, ...(partial || {}) };
}

function getPointerPosition(event, { snapGrid = [0, 0], snapToGrid = false, transform, containerBounds }) {
    const { x, y } = getEventPosition(event);
    const pointerPos = pointToRendererPoint({ x: x - (containerBounds?.left ?? 0), y: y - (containerBounds?.top ?? 0) }, transform);
    const { x: xSnapped, y: ySnapped } = snapToGrid ? snapPosition(pointerPos, snapGrid) : pointerPos;
    // we need the snapped position in order to be able to skip unnecessary drag events
    return {
        xSnapped,
        ySnapped,
        ...pointerPos,
    };
}
const getDimensions = (node) => ({
    width: node.offsetWidth,
    height: node.offsetHeight,
});
const getHostForElement = (element) => element?.getRootNode?.() || window?.document;
const inputTags = ['INPUT', 'SELECT', 'TEXTAREA'];
function isInputDOMNode(event) {
    // using composed path for handling shadow dom
    const target = (event.composedPath?.()?.[0] || event.target);
    if (target?.nodeType !== 1 /* Node.ELEMENT_NODE */)
        return false;
    const isInput = inputTags.includes(target.nodeName) || target.hasAttribute('contenteditable');
    // when an input field is focused we don't want to trigger deletion or movement of nodes
    return isInput || !!target.closest('.nokey');
}
const isMouseEvent = (event) => 'clientX' in event;
const getEventPosition = (event, bounds) => {
    const isMouse = isMouseEvent(event);
    const evtX = isMouse ? event.clientX : event.touches?.[0].clientX;
    const evtY = isMouse ? event.clientY : event.touches?.[0].clientY;
    return {
        x: evtX - (bounds?.left ?? 0),
        y: evtY - (bounds?.top ?? 0),
    };
};
/*
 * The handle bounds are calculated relative to the node element.
 * We store them in the internals object of the node in order to avoid
 * unnecessary recalculations.
 */
const getHandleBounds = (type, nodeElement, nodeBounds, zoom, nodeId) => {
    const handles = nodeElement.querySelectorAll(`.${type}`);
    if (!handles || !handles.length) {
        return null;
    }
    return Array.from(handles).map((handle) => {
        const handleBounds = handle.getBoundingClientRect();
        return {
            id: handle.getAttribute('data-handleid'),
            type,
            nodeId,
            position: handle.getAttribute('data-handlepos'),
            x: (handleBounds.left - nodeBounds.left) / zoom,
            y: (handleBounds.top - nodeBounds.top) / zoom,
            ...getDimensions(handle),
        };
    });
};

function getBezierEdgeCenter({ sourceX, sourceY, targetX, targetY, sourceControlX, sourceControlY, targetControlX, targetControlY, }) {
    /*
     * cubic bezier t=0.5 mid point, not the actual mid point, but easy to calculate
     * https://stackoverflow.com/questions/67516101/how-to-find-distance-mid-point-of-bezier-curve
     */
    const centerX = sourceX * 0.125 + sourceControlX * 0.375 + targetControlX * 0.375 + targetX * 0.125;
    const centerY = sourceY * 0.125 + sourceControlY * 0.375 + targetControlY * 0.375 + targetY * 0.125;
    const offsetX = Math.abs(centerX - sourceX);
    const offsetY = Math.abs(centerY - sourceY);
    return [centerX, centerY, offsetX, offsetY];
}
function calculateControlOffset(distance, curvature) {
    if (distance >= 0) {
        return 0.5 * distance;
    }
    return curvature * 25 * Math.sqrt(-distance);
}
function getControlWithCurvature({ pos, x1, y1, x2, y2, c }) {
    switch (pos) {
        case Position.Left:
            return [x1 - calculateControlOffset(x1 - x2, c), y1];
        case Position.Right:
            return [x1 + calculateControlOffset(x2 - x1, c), y1];
        case Position.Top:
            return [x1, y1 - calculateControlOffset(y1 - y2, c)];
        case Position.Bottom:
            return [x1, y1 + calculateControlOffset(y2 - y1, c)];
    }
}
/**
 * The `getBezierPath` util returns everything you need to render a bezier edge
 *between two nodes.
 * @public
 * @returns A path string you can use in an SVG, the `labelX` and `labelY` position (center of path)
 * and `offsetX`, `offsetY` between source handle and label.
 * - `path`: the path to use in an SVG `<path>` element.
 * - `labelX`: the `x` position you can use to render a label for this edge.
 * - `labelY`: the `y` position you can use to render a label for this edge.
 * - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
 * middle of this path.
 * - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
 * middle of this path.
 * @example
 * ```js
 *  const source = { x: 0, y: 20 };
 *  const target = { x: 150, y: 100 };
 *
 *  const [path, labelX, labelY, offsetX, offsetY] = getBezierPath({
 *    sourceX: source.x,
 *    sourceY: source.y,
 *    sourcePosition: Position.Right,
 *    targetX: target.x,
 *    targetY: target.y,
 *    targetPosition: Position.Left,
 *});
 *```
 *
 * @remarks This function returns a tuple (aka a fixed-size array) to make it easier to
 *work with multiple edge paths at once.
 */
function getBezierPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, curvature = 0.25, }) {
    const [sourceControlX, sourceControlY] = getControlWithCurvature({
        pos: sourcePosition,
        x1: sourceX,
        y1: sourceY,
        x2: targetX,
        y2: targetY,
        c: curvature,
    });
    const [targetControlX, targetControlY] = getControlWithCurvature({
        pos: targetPosition,
        x1: targetX,
        y1: targetY,
        x2: sourceX,
        y2: sourceY,
        c: curvature,
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

// this is used for straight edges and simple smoothstep edges (LTR, RTL, BTT, TTB)
function getEdgeCenter({ sourceX, sourceY, targetX, targetY, }) {
    const xOffset = Math.abs(targetX - sourceX) / 2;
    const centerX = targetX < sourceX ? targetX + xOffset : targetX - xOffset;
    const yOffset = Math.abs(targetY - sourceY) / 2;
    const centerY = targetY < sourceY ? targetY + yOffset : targetY - yOffset;
    return [centerX, centerY, xOffset, yOffset];
}
/**
 * Returns the z-index for an edge based on the node it connects and whether it is selected.
 * By default, edges are rendered below nodes. This behaviour is different for edges that are
 * connected to nodes with a parent, as they are rendered above the parent node.
 */
function getElevatedEdgeZIndex({ sourceNode, targetNode, selected = false, zIndex, elevateOnSelect = false, }) {
    if (zIndex !== undefined) {
        return zIndex;
    }
    const edgeZ = elevateOnSelect && selected ? 1000 : 0;
    const nodeZ = Math.max(sourceNode.parentId || (elevateOnSelect && sourceNode.selected) ? sourceNode.internals.z : 0, targetNode.parentId || (elevateOnSelect && targetNode.selected) ? targetNode.internals.z : 0);
    return edgeZ + nodeZ;
}
function isEdgeVisible({ sourceNode, targetNode, width, height, transform }) {
    const edgeBox = getBoundsOfBoxes(nodeToBox(sourceNode), nodeToBox(targetNode));
    if (edgeBox.x === edgeBox.x2) {
        edgeBox.x2 += 1;
    }
    if (edgeBox.y === edgeBox.y2) {
        edgeBox.y2 += 1;
    }
    const viewRect = {
        x: -transform[0] / transform[2],
        y: -transform[1] / transform[2],
        width: width / transform[2],
        height: height / transform[2],
    };
    return getOverlappingArea(viewRect, boxToRect(edgeBox)) > 0;
}
const getEdgeId = ({ source, sourceHandle, target, targetHandle }) => `xy-edge__${source}${sourceHandle || ''}-${target}${targetHandle || ''}`;
const connectionExists = (edge, edges) => {
    return edges.some((el) => el.source === edge.source &&
        el.target === edge.target &&
        (el.sourceHandle === edge.sourceHandle || (!el.sourceHandle && !edge.sourceHandle)) &&
        (el.targetHandle === edge.targetHandle || (!el.targetHandle && !edge.targetHandle)));
};
/**
 * This util is a convenience function to add a new Edge to an array of edges. It also performs some validation to make sure you don't add an invalid edge or duplicate an existing one.
 * @public
 * @param edgeParams - Either an `Edge` or a `Connection` you want to add.
 * @param edges - The array of all current edges.
 * @returns A new array of edges with the new edge added.
 *
 * @remarks If an edge with the same `target` and `source` already exists (and the same
 *`targetHandle` and `sourceHandle` if those are set), then this util won't add
 *a new edge even if the `id` property is different.
 *
 */
const addEdge = (edgeParams, edges) => {
    if (!edgeParams.source || !edgeParams.target) {
        devWarn('006', errorMessages['error006']());
        return edges;
    }
    let edge;
    if (isEdgeBase(edgeParams)) {
        edge = { ...edgeParams };
    }
    else {
        edge = {
            ...edgeParams,
            id: getEdgeId(edgeParams),
        };
    }
    if (connectionExists(edge, edges)) {
        return edges;
    }
    if (edge.sourceHandle === null) {
        delete edge.sourceHandle;
    }
    if (edge.targetHandle === null) {
        delete edge.targetHandle;
    }
    return edges.concat(edge);
};
/**
 * A handy utility to update an existing [`Edge`](/api-reference/types/edge) with new properties.
 *This searches your edge array for an edge with a matching `id` and updates its
 *properties with the connection you provide.
 * @public
 * @param oldEdge - The edge you want to update.
 * @param newConnection - The new connection you want to update the edge with.
 * @param edges - The array of all current edges.
 * @returns The updated edges array.
 *
 * @example
 * ```js
 *const onReconnect = useCallback(
 *  (oldEdge: Edge, newConnection: Connection) => setEdges((els) => reconnectEdge(oldEdge, newConnection, els)),[]);
 *```
 */
const reconnectEdge = (oldEdge, newConnection, edges, options = { shouldReplaceId: true }) => {
    const { id: oldEdgeId, ...rest } = oldEdge;
    if (!newConnection.source || !newConnection.target) {
        devWarn('006', errorMessages['error006']());
        return edges;
    }
    const foundEdge = edges.find((e) => e.id === oldEdge.id);
    if (!foundEdge) {
        devWarn('007', errorMessages['error007'](oldEdgeId));
        return edges;
    }
    // Remove old edge and create the new edge with parameters of old edge.
    const edge = {
        ...rest,
        id: options.shouldReplaceId ? getEdgeId(newConnection) : oldEdgeId,
        source: newConnection.source,
        target: newConnection.target,
        sourceHandle: newConnection.sourceHandle,
        targetHandle: newConnection.targetHandle,
    };
    return edges.filter((e) => e.id !== oldEdgeId).concat(edge);
};

/**
 * Calculates the straight line path between two points.
 * @public
 * @returns A path string you can use in an SVG, the `labelX` and `labelY` position (center of path)
 * and `offsetX`, `offsetY` between source handle and label.
 *
 * - `path`: the path to use in an SVG `<path>` element.
 * - `labelX`: the `x` position you can use to render a label for this edge.
 * - `labelY`: the `y` position you can use to render a label for this edge.
 * - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
 * middle of this path.
 * - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
 * middle of this path.
 * @example
 * ```js
 *  const source = { x: 0, y: 20 };
 *  const target = { x: 150, y: 100 };
 *
 *  const [path, labelX, labelY, offsetX, offsetY] = getStraightPath({
 *    sourceX: source.x,
 *    sourceY: source.y,
 *    sourcePosition: Position.Right,
 *    targetX: target.x,
 *    targetY: target.y,
 *    targetPosition: Position.Left,
 *  });
 * ```
 * @remarks This function returns a tuple (aka a fixed-size array) to make it easier to work with multiple edge paths at once.
 */
function getStraightPath({ sourceX, sourceY, targetX, targetY, }) {
    const [labelX, labelY, offsetX, offsetY] = getEdgeCenter({
        sourceX,
        sourceY,
        targetX,
        targetY,
    });
    return [`M ${sourceX},${sourceY}L ${targetX},${targetY}`, labelX, labelY, offsetX, offsetY];
}

const handleDirections = {
    [Position.Left]: { x: -1, y: 0 },
    [Position.Right]: { x: 1, y: 0 },
    [Position.Top]: { x: 0, y: -1 },
    [Position.Bottom]: { x: 0, y: 1 },
};
const getDirection = ({ source, sourcePosition = Position.Bottom, target, }) => {
    if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
        return source.x < target.x ? { x: 1, y: 0 } : { x: -1, y: 0 };
    }
    return source.y < target.y ? { x: 0, y: 1 } : { x: 0, y: -1 };
};
const distance = (a, b) => Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
/*
 * With this function we try to mimic an orthogonal edge routing behaviour
 * It's not as good as a real orthogonal edge routing, but it's faster and good enough as a default for step and smooth step edges
 */
function getPoints({ source, sourcePosition = Position.Bottom, target, targetPosition = Position.Top, center, offset, stepPosition, }) {
    const sourceDir = handleDirections[sourcePosition];
    const targetDir = handleDirections[targetPosition];
    const sourceGapped = { x: source.x + sourceDir.x * offset, y: source.y + sourceDir.y * offset };
    const targetGapped = { x: target.x + targetDir.x * offset, y: target.y + targetDir.y * offset };
    const dir = getDirection({
        source: sourceGapped,
        sourcePosition,
        target: targetGapped,
    });
    const dirAccessor = dir.x !== 0 ? 'x' : 'y';
    const currDir = dir[dirAccessor];
    let points = [];
    let centerX, centerY;
    const sourceGapOffset = { x: 0, y: 0 };
    const targetGapOffset = { x: 0, y: 0 };
    const [, , defaultOffsetX, defaultOffsetY] = getEdgeCenter({
        sourceX: source.x,
        sourceY: source.y,
        targetX: target.x,
        targetY: target.y,
    });
    // opposite handle positions, default case
    if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
        if (dirAccessor === 'x') {
            // Primary direction is horizontal, so stepPosition affects X coordinate
            centerX = center.x ?? (sourceGapped.x + (targetGapped.x - sourceGapped.x) * stepPosition);
            centerY = center.y ?? (sourceGapped.y + targetGapped.y) / 2;
        }
        else {
            // Primary direction is vertical, so stepPosition affects Y coordinate  
            centerX = center.x ?? (sourceGapped.x + targetGapped.x) / 2;
            centerY = center.y ?? (sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition);
        }
        /*
         *    --->
         *    |
         * >---
         */
        const verticalSplit = [
            { x: centerX, y: sourceGapped.y },
            { x: centerX, y: targetGapped.y },
        ];
        /*
         *    |
         *  ---
         *  |
         */
        const horizontalSplit = [
            { x: sourceGapped.x, y: centerY },
            { x: targetGapped.x, y: centerY },
        ];
        if (sourceDir[dirAccessor] === currDir) {
            points = dirAccessor === 'x' ? verticalSplit : horizontalSplit;
        }
        else {
            points = dirAccessor === 'x' ? horizontalSplit : verticalSplit;
        }
    }
    else {
        // sourceTarget means we take x from source and y from target, targetSource is the opposite
        const sourceTarget = [{ x: sourceGapped.x, y: targetGapped.y }];
        const targetSource = [{ x: targetGapped.x, y: sourceGapped.y }];
        // this handles edges with same handle positions
        if (dirAccessor === 'x') {
            points = sourceDir.x === currDir ? targetSource : sourceTarget;
        }
        else {
            points = sourceDir.y === currDir ? sourceTarget : targetSource;
        }
        if (sourcePosition === targetPosition) {
            const diff = Math.abs(source[dirAccessor] - target[dirAccessor]);
            // if an edge goes from right to right for example (sourcePosition === targetPosition) and the distance between source.x and target.x is less than the offset, the added point and the gapped source/target will overlap. This leads to a weird edge path. To avoid this we add a gapOffset to the source/target
            if (diff <= offset) {
                const gapOffset = Math.min(offset - 1, offset - diff);
                if (sourceDir[dirAccessor] === currDir) {
                    sourceGapOffset[dirAccessor] = (sourceGapped[dirAccessor] > source[dirAccessor] ? -1 : 1) * gapOffset;
                }
                else {
                    targetGapOffset[dirAccessor] = (targetGapped[dirAccessor] > target[dirAccessor] ? -1 : 1) * gapOffset;
                }
            }
        }
        // these are conditions for handling mixed handle positions like Right -> Bottom for example
        if (sourcePosition !== targetPosition) {
            const dirAccessorOpposite = dirAccessor === 'x' ? 'y' : 'x';
            const isSameDir = sourceDir[dirAccessor] === targetDir[dirAccessorOpposite];
            const sourceGtTargetOppo = sourceGapped[dirAccessorOpposite] > targetGapped[dirAccessorOpposite];
            const sourceLtTargetOppo = sourceGapped[dirAccessorOpposite] < targetGapped[dirAccessorOpposite];
            const flipSourceTarget = (sourceDir[dirAccessor] === 1 && ((!isSameDir && sourceGtTargetOppo) || (isSameDir && sourceLtTargetOppo))) ||
                (sourceDir[dirAccessor] !== 1 && ((!isSameDir && sourceLtTargetOppo) || (isSameDir && sourceGtTargetOppo)));
            if (flipSourceTarget) {
                points = dirAccessor === 'x' ? sourceTarget : targetSource;
            }
        }
        const sourceGapPoint = { x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y };
        const targetGapPoint = { x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y };
        const maxXDistance = Math.max(Math.abs(sourceGapPoint.x - points[0].x), Math.abs(targetGapPoint.x - points[0].x));
        const maxYDistance = Math.max(Math.abs(sourceGapPoint.y - points[0].y), Math.abs(targetGapPoint.y - points[0].y));
        // we want to place the label on the longest segment of the edge
        if (maxXDistance >= maxYDistance) {
            centerX = (sourceGapPoint.x + targetGapPoint.x) / 2;
            centerY = points[0].y;
        }
        else {
            centerX = points[0].x;
            centerY = (sourceGapPoint.y + targetGapPoint.y) / 2;
        }
    }
    const pathPoints = [
        source,
        { x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y },
        ...points,
        { x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y },
        target,
    ];
    return [pathPoints, centerX, centerY, defaultOffsetX, defaultOffsetY];
}
function getBend(a, b, c, size) {
    const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size);
    const { x, y } = b;
    // no bend
    if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) {
        return `L${x} ${y}`;
    }
    // first segment is horizontal
    if (a.y === y) {
        const xDir = a.x < c.x ? -1 : 1;
        const yDir = a.y < c.y ? 1 : -1;
        return `L ${x + bendSize * xDir},${y}Q ${x},${y} ${x},${y + bendSize * yDir}`;
    }
    const xDir = a.x < c.x ? 1 : -1;
    const yDir = a.y < c.y ? -1 : 1;
    return `L ${x},${y + bendSize * yDir}Q ${x},${y} ${x + bendSize * xDir},${y}`;
}
/**
 * The `getSmoothStepPath` util returns everything you need to render a stepped path
 * between two nodes. The `borderRadius` property can be used to choose how rounded
 * the corners of those steps are.
 * @public
 * @returns A path string you can use in an SVG, the `labelX` and `labelY` position (center of path)
 * and `offsetX`, `offsetY` between source handle and label.
 *
 * - `path`: the path to use in an SVG `<path>` element.
 * - `labelX`: the `x` position you can use to render a label for this edge.
 * - `labelY`: the `y` position you can use to render a label for this edge.
 * - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
 * middle of this path.
 * - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
 * middle of this path.
 * @example
 * ```js
 *  const source = { x: 0, y: 20 };
 *  const target = { x: 150, y: 100 };
 *
 *  const [path, labelX, labelY, offsetX, offsetY] = getSmoothStepPath({
 *    sourceX: source.x,
 *    sourceY: source.y,
 *    sourcePosition: Position.Right,
 *    targetX: target.x,
 *    targetY: target.y,
 *    targetPosition: Position.Left,
 *  });
 * ```
 * @remarks This function returns a tuple (aka a fixed-size array) to make it easier to work with multiple edge paths at once.
 */
function getSmoothStepPath({ sourceX, sourceY, sourcePosition = Position.Bottom, targetX, targetY, targetPosition = Position.Top, borderRadius = 5, centerX, centerY, offset = 20, stepPosition = 0.5, }) {
    const [points, labelX, labelY, offsetX, offsetY] = getPoints({
        source: { x: sourceX, y: sourceY },
        sourcePosition,
        target: { x: targetX, y: targetY },
        targetPosition,
        center: { x: centerX, y: centerY },
        offset,
        stepPosition,
    });
    const path = points.reduce((res, p, i) => {
        let segment = '';
        if (i > 0 && i < points.length - 1) {
            segment = getBend(points[i - 1], p, points[i + 1], borderRadius);
        }
        else {
            segment = `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`;
        }
        res += segment;
        return res;
    }, '');
    return [path, labelX, labelY, offsetX, offsetY];
}

function isNodeInitialized(node) {
    return (node &&
        !!(node.internals.handleBounds || node.handles?.length) &&
        !!(node.measured.width || node.width || node.initialWidth));
}
function getEdgePosition(params) {
    const { sourceNode, targetNode } = params;
    if (!isNodeInitialized(sourceNode) || !isNodeInitialized(targetNode)) {
        return null;
    }
    const sourceHandleBounds = sourceNode.internals.handleBounds || toHandleBounds(sourceNode.handles);
    const targetHandleBounds = targetNode.internals.handleBounds || toHandleBounds(targetNode.handles);
    const sourceHandle = getHandle$1(sourceHandleBounds?.source ?? [], params.sourceHandle);
    const targetHandle = getHandle$1(
    // when connection type is loose we can define all handles as sources and connect source -> source
    params.connectionMode === ConnectionMode.Strict
        ? targetHandleBounds?.target ?? []
        : (targetHandleBounds?.target ?? []).concat(targetHandleBounds?.source ?? []), params.targetHandle);
    if (!sourceHandle || !targetHandle) {
        params.onError?.('008', errorMessages['error008'](!sourceHandle ? 'source' : 'target', {
            id: params.id,
            sourceHandle: params.sourceHandle,
            targetHandle: params.targetHandle,
        }));
        return null;
    }
    const sourcePosition = sourceHandle?.position || Position.Bottom;
    const targetPosition = targetHandle?.position || Position.Top;
    const source = getHandlePosition(sourceNode, sourceHandle, sourcePosition);
    const target = getHandlePosition(targetNode, targetHandle, targetPosition);
    return {
        sourceX: source.x,
        sourceY: source.y,
        targetX: target.x,
        targetY: target.y,
        sourcePosition,
        targetPosition,
    };
}
function toHandleBounds(handles) {
    if (!handles) {
        return null;
    }
    const source = [];
    const target = [];
    for (const handle of handles) {
        handle.width = handle.width ?? 1;
        handle.height = handle.height ?? 1;
        if (handle.type === 'source') {
            source.push(handle);
        }
        else if (handle.type === 'target') {
            target.push(handle);
        }
    }
    return {
        source,
        target,
    };
}
function getHandlePosition(node, handle, fallbackPosition = Position.Left, center = false) {
    const x = (handle?.x ?? 0) + node.internals.positionAbsolute.x;
    const y = (handle?.y ?? 0) + node.internals.positionAbsolute.y;
    const { width, height } = handle ?? getNodeDimensions(node);
    if (center) {
        return { x: x + width / 2, y: y + height / 2 };
    }
    const position = handle?.position ?? fallbackPosition;
    switch (position) {
        case Position.Top:
            return { x: x + width / 2, y };
        case Position.Right:
            return { x: x + width, y: y + height / 2 };
        case Position.Bottom:
            return { x: x + width / 2, y: y + height };
        case Position.Left:
            return { x, y: y + height / 2 };
    }
}
function getHandle$1(bounds, handleId) {
    if (!bounds) {
        return null;
    }
    // if no handleId is given, we use the first handle, otherwise we check for the id
    return (!handleId ? bounds[0] : bounds.find((d) => d.id === handleId)) || null;
}

function getMarkerId(marker, id) {
    if (!marker) {
        return '';
    }
    if (typeof marker === 'string') {
        return marker;
    }
    const idPrefix = id ? `${id}__` : '';
    return `${idPrefix}${Object.keys(marker)
        .sort()
        .map((key) => `${key}=${marker[key]}`)
        .join('&')}`;
}
function createMarkerIds(edges, { id, defaultColor, defaultMarkerStart, defaultMarkerEnd, }) {
    const ids = new Set();
    return edges
        .reduce((markers, edge) => {
        [edge.markerStart || defaultMarkerStart, edge.markerEnd || defaultMarkerEnd].forEach((marker) => {
            if (marker && typeof marker === 'object') {
                const markerId = getMarkerId(marker, id);
                if (!ids.has(markerId)) {
                    markers.push({ id: markerId, color: marker.color || defaultColor, ...marker });
                    ids.add(markerId);
                }
            }
        });
        return markers;
    }, [])
        .sort((a, b) => a.id.localeCompare(b.id));
}

function getNodeToolbarTransform(nodeRect, viewport, position, offset, align) {
    let alignmentOffset = 0.5;
    if (align === 'start') {
        alignmentOffset = 0;
    }
    else if (align === 'end') {
        alignmentOffset = 1;
    }
    /*
     * position === Position.Top
     * we set the x any y position of the toolbar based on the nodes position
     */
    let pos = [
        (nodeRect.x + nodeRect.width * alignmentOffset) * viewport.zoom + viewport.x,
        nodeRect.y * viewport.zoom + viewport.y - offset,
    ];
    // and than shift it based on the alignment. The shift values are in %.
    let shift = [-100 * alignmentOffset, -100];
    switch (position) {
        case Position.Right:
            pos = [
                (nodeRect.x + nodeRect.width) * viewport.zoom + viewport.x + offset,
                (nodeRect.y + nodeRect.height * alignmentOffset) * viewport.zoom + viewport.y,
            ];
            shift = [0, -100 * alignmentOffset];
            break;
        case Position.Bottom:
            pos[1] = (nodeRect.y + nodeRect.height) * viewport.zoom + viewport.y + offset;
            shift[1] = 0;
            break;
        case Position.Left:
            pos = [
                nodeRect.x * viewport.zoom + viewport.x - offset,
                (nodeRect.y + nodeRect.height * alignmentOffset) * viewport.zoom + viewport.y,
            ];
            shift = [-100, -100 * alignmentOffset];
            break;
    }
    return `translate(${pos[0]}px, ${pos[1]}px) translate(${shift[0]}%, ${shift[1]}%)`;
}

const alignXToPercent = {
    left: 0,
    center: 50,
    right: 100,
};
const alignYToPercent = {
    top: 0,
    center: 50,
    bottom: 100,
};
function getEdgeToolbarTransform(x, y, zoom, alignX = 'center', alignY = 'center') {
    return `translate(${x}px, ${y}px) scale(${1 / zoom}) translate(${-(alignXToPercent[alignX] ?? 50)}%, ${-(alignYToPercent[alignY] ?? 50)}%)`;
}

const SELECTED_NODE_Z = 1000;
const ROOT_PARENT_Z_INCREMENT = 10;
const defaultOptions = {
    nodeOrigin: [0, 0],
    nodeExtent: infiniteExtent,
    elevateNodesOnSelect: true,
    defaults: {},
};
const adoptUserNodesDefaultOptions = {
    ...defaultOptions,
    checkEquality: true,
};
function mergeObjects(base, incoming) {
    const result = { ...base };
    for (const key in incoming) {
        if (incoming[key] !== undefined) {
            // typecast is safe here, because we check for undefined
            result[key] = incoming[key];
        }
    }
    return result;
}
function updateAbsolutePositions(nodeLookup, parentLookup, options) {
    const _options = mergeObjects(defaultOptions, options);
    for (const node of nodeLookup.values()) {
        if (node.parentId) {
            updateChildNode(node, nodeLookup, parentLookup, _options);
        }
        else {
            const positionWithOrigin = getNodePositionWithOrigin(node, _options.nodeOrigin);
            const extent = isCoordinateExtent(node.extent) ? node.extent : _options.nodeExtent;
            const clampedPosition = clampPosition(positionWithOrigin, extent, getNodeDimensions(node));
            node.internals.positionAbsolute = clampedPosition;
        }
    }
}
function parseHandles(userNode, internalNode) {
    if (!userNode.handles) {
        return !userNode.measured ? undefined : internalNode?.internals.handleBounds;
    }
    const source = [];
    const target = [];
    for (const handle of userNode.handles) {
        const handleBounds = {
            id: handle.id,
            width: handle.width ?? 1,
            height: handle.height ?? 1,
            nodeId: userNode.id,
            x: handle.x,
            y: handle.y,
            position: handle.position,
            type: handle.type,
        };
        if (handle.type === 'source') {
            source.push(handleBounds);
        }
        else if (handle.type === 'target') {
            target.push(handleBounds);
        }
    }
    return {
        source,
        target,
    };
}
function adoptUserNodes(nodes, nodeLookup, parentLookup, options) {
    const _options = mergeObjects(adoptUserNodesDefaultOptions, options);
    let rootParentIndex = { i: -1 };
    let nodesInitialized = nodes.length > 0;
    const tmpLookup = new Map(nodeLookup);
    const selectedNodeZ = _options?.elevateNodesOnSelect ? SELECTED_NODE_Z : 0;
    nodeLookup.clear();
    parentLookup.clear();
    for (const userNode of nodes) {
        let internalNode = tmpLookup.get(userNode.id);
        if (_options.checkEquality && userNode === internalNode?.internals.userNode) {
            nodeLookup.set(userNode.id, internalNode);
        }
        else {
            const positionWithOrigin = getNodePositionWithOrigin(userNode, _options.nodeOrigin);
            const extent = isCoordinateExtent(userNode.extent) ? userNode.extent : _options.nodeExtent;
            const clampedPosition = clampPosition(positionWithOrigin, extent, getNodeDimensions(userNode));
            internalNode = {
                ..._options.defaults,
                ...userNode,
                measured: {
                    width: userNode.measured?.width,
                    height: userNode.measured?.height,
                },
                internals: {
                    positionAbsolute: clampedPosition,
                    // if user re-initializes the node or removes `measured` for whatever reason, we reset the handleBounds so that the node gets re-measured
                    handleBounds: parseHandles(userNode, internalNode),
                    z: calculateZ(userNode, selectedNodeZ),
                    userNode,
                },
            };
            nodeLookup.set(userNode.id, internalNode);
        }
        if ((internalNode.measured === undefined ||
            internalNode.measured.width === undefined ||
            internalNode.measured.height === undefined) &&
            !internalNode.hidden) {
            nodesInitialized = false;
        }
        if (userNode.parentId) {
            updateChildNode(internalNode, nodeLookup, parentLookup, options, rootParentIndex);
        }
    }
    return nodesInitialized;
}
function updateParentLookup(node, parentLookup) {
    if (!node.parentId) {
        return;
    }
    const childNodes = parentLookup.get(node.parentId);
    if (childNodes) {
        childNodes.set(node.id, node);
    }
    else {
        parentLookup.set(node.parentId, new Map([[node.id, node]]));
    }
}
/**
 * Updates positionAbsolute and zIndex of a child node and the parentLookup.
 */
function updateChildNode(node, nodeLookup, parentLookup, options, rootParentIndex) {
    const { elevateNodesOnSelect, nodeOrigin, nodeExtent } = mergeObjects(defaultOptions, options);
    const parentId = node.parentId;
    const parentNode = nodeLookup.get(parentId);
    if (!parentNode) {
        console.warn(`Parent node ${parentId} not found. Please make sure that parent nodes are in front of their child nodes in the nodes array.`);
        return;
    }
    updateParentLookup(node, parentLookup);
    // We just want to set the rootParentIndex for the first child
    if (rootParentIndex && !parentNode.parentId && parentNode.internals.rootParentIndex === undefined) {
        parentNode.internals.rootParentIndex = ++rootParentIndex.i;
        parentNode.internals.z = parentNode.internals.z + rootParentIndex.i * ROOT_PARENT_Z_INCREMENT;
    }
    // But we need to update rootParentIndex.i also when parent has not been updated
    if (rootParentIndex && parentNode.internals.rootParentIndex !== undefined) {
        rootParentIndex.i = parentNode.internals.rootParentIndex;
    }
    const selectedNodeZ = elevateNodesOnSelect ? SELECTED_NODE_Z : 0;
    const { x, y, z } = calculateChildXYZ(node, parentNode, nodeOrigin, nodeExtent, selectedNodeZ);
    const { positionAbsolute } = node.internals;
    const positionChanged = x !== positionAbsolute.x || y !== positionAbsolute.y;
    if (positionChanged || z !== node.internals.z) {
        // we create a new object to mark the node as updated
        nodeLookup.set(node.id, {
            ...node,
            internals: {
                ...node.internals,
                positionAbsolute: positionChanged ? { x, y } : positionAbsolute,
                z,
            },
        });
    }
}
function calculateZ(node, selectedNodeZ) {
    return (isNumeric(node.zIndex) ? node.zIndex : 0) + (node.selected ? selectedNodeZ : 0);
}
function calculateChildXYZ(childNode, parentNode, nodeOrigin, nodeExtent, selectedNodeZ) {
    const { x: parentX, y: parentY } = parentNode.internals.positionAbsolute;
    const childDimensions = getNodeDimensions(childNode);
    const positionWithOrigin = getNodePositionWithOrigin(childNode, nodeOrigin);
    const clampedPosition = isCoordinateExtent(childNode.extent)
        ? clampPosition(positionWithOrigin, childNode.extent, childDimensions)
        : positionWithOrigin;
    let absolutePosition = clampPosition({ x: parentX + clampedPosition.x, y: parentY + clampedPosition.y }, nodeExtent, childDimensions);
    if (childNode.extent === 'parent') {
        absolutePosition = clampPositionToParent(absolutePosition, childDimensions, parentNode);
    }
    const childZ = calculateZ(childNode, selectedNodeZ);
    const parentZ = parentNode.internals.z ?? 0;
    return {
        x: absolutePosition.x,
        y: absolutePosition.y,
        z: parentZ >= childZ ? parentZ + 1 : childZ,
    };
}
function handleExpandParent(children, nodeLookup, parentLookup, nodeOrigin = [0, 0]) {
    const changes = [];
    const parentExpansions = new Map();
    // determine the expanded rectangle the child nodes would take for each parent
    for (const child of children) {
        const parent = nodeLookup.get(child.parentId);
        if (!parent) {
            continue;
        }
        const parentRect = parentExpansions.get(child.parentId)?.expandedRect ?? nodeToRect(parent);
        const expandedRect = getBoundsOfRects(parentRect, child.rect);
        parentExpansions.set(child.parentId, { expandedRect, parent });
    }
    if (parentExpansions.size > 0) {
        parentExpansions.forEach(({ expandedRect, parent }, parentId) => {
            // determine the position & dimensions of the parent
            const positionAbsolute = parent.internals.positionAbsolute;
            const dimensions = getNodeDimensions(parent);
            const origin = parent.origin ?? nodeOrigin;
            // determine how much the parent expands in width and position
            const xChange = expandedRect.x < positionAbsolute.x ? Math.round(Math.abs(positionAbsolute.x - expandedRect.x)) : 0;
            const yChange = expandedRect.y < positionAbsolute.y ? Math.round(Math.abs(positionAbsolute.y - expandedRect.y)) : 0;
            const newWidth = Math.max(dimensions.width, Math.round(expandedRect.width));
            const newHeight = Math.max(dimensions.height, Math.round(expandedRect.height));
            const widthChange = (newWidth - dimensions.width) * origin[0];
            const heightChange = (newHeight - dimensions.height) * origin[1];
            // We need to correct the position of the parent node if the origin is not [0,0]
            if (xChange > 0 || yChange > 0 || widthChange || heightChange) {
                changes.push({
                    id: parentId,
                    type: 'position',
                    position: {
                        x: parent.position.x - xChange + widthChange,
                        y: parent.position.y - yChange + heightChange,
                    },
                });
                /*
                 * We move all child nodes in the oppsite direction
                 * so the x,y changes of the parent do not move the children
                 */
                parentLookup.get(parentId)?.forEach((childNode) => {
                    if (!children.some((child) => child.id === childNode.id)) {
                        changes.push({
                            id: childNode.id,
                            type: 'position',
                            position: {
                                x: childNode.position.x + xChange,
                                y: childNode.position.y + yChange,
                            },
                        });
                    }
                });
            }
            // We need to correct the dimensions of the parent node if the origin is not [0,0]
            if (dimensions.width < expandedRect.width || dimensions.height < expandedRect.height || xChange || yChange) {
                changes.push({
                    id: parentId,
                    type: 'dimensions',
                    setAttributes: true,
                    dimensions: {
                        width: newWidth + (xChange ? origin[0] * xChange - widthChange : 0),
                        height: newHeight + (yChange ? origin[1] * yChange - heightChange : 0),
                    },
                });
            }
        });
    }
    return changes;
}
function updateNodeInternals(updates, nodeLookup, parentLookup, domNode, nodeOrigin, nodeExtent) {
    const viewportNode = domNode?.querySelector('.xyflow__viewport');
    let updatedInternals = false;
    if (!viewportNode) {
        return { changes: [], updatedInternals };
    }
    const changes = [];
    const style = window.getComputedStyle(viewportNode);
    const { m22: zoom } = new window.DOMMatrixReadOnly(style.transform);
    // in this array we collect nodes, that might trigger changes (like expanding parent)
    const parentExpandChildren = [];
    for (const update of updates.values()) {
        const node = nodeLookup.get(update.id);
        if (!node) {
            continue;
        }
        if (node.hidden) {
            nodeLookup.set(node.id, {
                ...node,
                internals: {
                    ...node.internals,
                    handleBounds: undefined,
                },
            });
            updatedInternals = true;
            continue;
        }
        const dimensions = getDimensions(update.nodeElement);
        const dimensionChanged = node.measured.width !== dimensions.width || node.measured.height !== dimensions.height;
        const doUpdate = !!(dimensions.width &&
            dimensions.height &&
            (dimensionChanged || !node.internals.handleBounds || update.force));
        if (doUpdate) {
            const nodeBounds = update.nodeElement.getBoundingClientRect();
            const extent = isCoordinateExtent(node.extent) ? node.extent : nodeExtent;
            let { positionAbsolute } = node.internals;
            if (node.parentId && node.extent === 'parent') {
                positionAbsolute = clampPositionToParent(positionAbsolute, dimensions, nodeLookup.get(node.parentId));
            }
            else if (extent) {
                positionAbsolute = clampPosition(positionAbsolute, extent, dimensions);
            }
            const newNode = {
                ...node,
                measured: dimensions,
                internals: {
                    ...node.internals,
                    positionAbsolute,
                    handleBounds: {
                        source: getHandleBounds('source', update.nodeElement, nodeBounds, zoom, node.id),
                        target: getHandleBounds('target', update.nodeElement, nodeBounds, zoom, node.id),
                    },
                },
            };
            nodeLookup.set(node.id, newNode);
            if (node.parentId) {
                updateChildNode(newNode, nodeLookup, parentLookup, { nodeOrigin });
            }
            updatedInternals = true;
            if (dimensionChanged) {
                changes.push({
                    id: node.id,
                    type: 'dimensions',
                    dimensions,
                });
                if (node.expandParent && node.parentId) {
                    parentExpandChildren.push({
                        id: node.id,
                        parentId: node.parentId,
                        rect: nodeToRect(newNode, nodeOrigin),
                    });
                }
            }
        }
    }
    if (parentExpandChildren.length > 0) {
        const parentExpandChanges = handleExpandParent(parentExpandChildren, nodeLookup, parentLookup, nodeOrigin);
        changes.push(...parentExpandChanges);
    }
    return { changes, updatedInternals };
}
async function panBy({ delta, panZoom, transform, translateExtent, width, height, }) {
    if (!panZoom || (!delta.x && !delta.y)) {
        return Promise.resolve(false);
    }
    const nextViewport = await panZoom.setViewportConstrained({
        x: transform[0] + delta.x,
        y: transform[1] + delta.y,
        zoom: transform[2],
    }, [
        [0, 0],
        [width, height],
    ], translateExtent);
    const transformChanged = !!nextViewport &&
        (nextViewport.x !== transform[0] || nextViewport.y !== transform[1] || nextViewport.k !== transform[2]);
    return Promise.resolve(transformChanged);
}
/**
 * this function adds the connection to the connectionLookup
 * at the following keys: nodeId-type-handleId, nodeId-type and nodeId
 * @param type type of the connection
 * @param connection connection that should be added to the lookup
 * @param connectionKey at which key the connection should be added
 * @param connectionLookup reference to the connection lookup
 * @param nodeId nodeId of the connection
 * @param handleId handleId of the conneciton
 */
function addConnectionToLookup(type, connection, connectionKey, connectionLookup, nodeId, handleId) {
    /*
     * We add the connection to the connectionLookup at the following keys
     * 1. nodeId, 2. nodeId-type, 3. nodeId-type-handleId
     * If the key already exists, we add the connection to the existing map
     */
    let key = nodeId;
    const nodeMap = connectionLookup.get(key) || new Map();
    connectionLookup.set(key, nodeMap.set(connectionKey, connection));
    key = `${nodeId}-${type}`;
    const typeMap = connectionLookup.get(key) || new Map();
    connectionLookup.set(key, typeMap.set(connectionKey, connection));
    if (handleId) {
        key = `${nodeId}-${type}-${handleId}`;
        const handleMap = connectionLookup.get(key) || new Map();
        connectionLookup.set(key, handleMap.set(connectionKey, connection));
    }
}
function updateConnectionLookup(connectionLookup, edgeLookup, edges) {
    connectionLookup.clear();
    edgeLookup.clear();
    for (const edge of edges) {
        const { source: sourceNode, target: targetNode, sourceHandle = null, targetHandle = null } = edge;
        const connection = { edgeId: edge.id, source: sourceNode, target: targetNode, sourceHandle, targetHandle };
        const sourceKey = `${sourceNode}-${sourceHandle}--${targetNode}-${targetHandle}`;
        const targetKey = `${targetNode}-${targetHandle}--${sourceNode}-${sourceHandle}`;
        addConnectionToLookup('source', connection, targetKey, connectionLookup, sourceNode, sourceHandle);
        addConnectionToLookup('target', connection, sourceKey, connectionLookup, targetNode, targetHandle);
        edgeLookup.set(edge.id, edge);
    }
}

function shallowNodeData(a, b) {
    if (a === null || b === null) {
        return false;
    }
    const _a = Array.isArray(a) ? a : [a];
    const _b = Array.isArray(b) ? b : [b];
    if (_a.length !== _b.length) {
        return false;
    }
    for (let i = 0; i < _a.length; i++) {
        if (_a[i].id !== _b[i].id || _a[i].type !== _b[i].type || !Object.is(_a[i].data, _b[i].data)) {
            return false;
        }
    }
    return true;
}

function isParentSelected(node, nodeLookup) {
    if (!node.parentId) {
        return false;
    }
    const parentNode = nodeLookup.get(node.parentId);
    if (!parentNode) {
        return false;
    }
    if (parentNode.selected) {
        return true;
    }
    return isParentSelected(parentNode, nodeLookup);
}
function hasSelector(target, selector, domNode) {
    let current = target;
    do {
        if (current?.matches?.(selector))
            return true;
        if (current === domNode)
            return false;
        current = current?.parentElement;
    } while (current);
    return false;
}
// looks for all selected nodes and created a NodeDragItem for each of them
function getDragItems(nodeLookup, nodesDraggable, mousePos, nodeId) {
    const dragItems = new Map();
    for (const [id, node] of nodeLookup) {
        if ((node.selected || node.id === nodeId) &&
            (!node.parentId || !isParentSelected(node, nodeLookup)) &&
            (node.draggable || (nodesDraggable && typeof node.draggable === 'undefined'))) {
            const internalNode = nodeLookup.get(id);
            if (internalNode) {
                dragItems.set(id, {
                    id,
                    position: internalNode.position || { x: 0, y: 0 },
                    distance: {
                        x: mousePos.x - internalNode.internals.positionAbsolute.x,
                        y: mousePos.y - internalNode.internals.positionAbsolute.y,
                    },
                    extent: internalNode.extent,
                    parentId: internalNode.parentId,
                    origin: internalNode.origin,
                    expandParent: internalNode.expandParent,
                    internals: {
                        positionAbsolute: internalNode.internals.positionAbsolute || { x: 0, y: 0 },
                    },
                    measured: {
                        width: internalNode.measured.width ?? 0,
                        height: internalNode.measured.height ?? 0,
                    },
                });
            }
        }
    }
    return dragItems;
}
/*
 * returns two params:
 * 1. the dragged node (or the first of the list, if we are dragging a node selection)
 * 2. array of selected nodes (for multi selections)
 */
function getEventHandlerParams({ nodeId, dragItems, nodeLookup, dragging = true, }) {
    const nodesFromDragItems = [];
    for (const [id, dragItem] of dragItems) {
        const node = nodeLookup.get(id)?.internals.userNode;
        if (node) {
            nodesFromDragItems.push({
                ...node,
                position: dragItem.position,
                dragging,
            });
        }
    }
    if (!nodeId) {
        return [nodesFromDragItems[0], nodesFromDragItems];
    }
    const node = nodeLookup.get(nodeId)?.internals.userNode;
    return [
        !node
            ? nodesFromDragItems[0]
            : {
                ...node,
                position: dragItems.get(nodeId)?.position || node.position,
                dragging,
            },
        nodesFromDragItems,
    ];
}
/**
 * If a selection is being dragged we want to apply the same snap offset to all nodes in the selection.
 * This function calculates the snap offset based on the first node in the selection.
 */
function calculateSnapOffset({ dragItems, snapGrid, x, y, }) {
    const refDragItem = dragItems.values().next().value;
    if (!refDragItem) {
        return null;
    }
    const refPos = {
        x: x - refDragItem.distance.x,
        y: y - refDragItem.distance.y,
    };
    const refPosSnapped = snapPosition(refPos, snapGrid);
    return {
        x: refPosSnapped.x - refPos.x,
        y: refPosSnapped.y - refPos.y,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function XYDrag({ onNodeMouseDown, getStoreItems, onDragStart, onDrag, onDragStop, }) {
    let lastPos = { x: null, y: null };
    let autoPanId = 0;
    let dragItems = new Map();
    let autoPanStarted = false;
    let mousePosition = { x: 0, y: 0 };
    let containerBounds = null;
    let dragStarted = false;
    let d3Selection = null;
    let abortDrag = false; // prevents unintentional dragging on multitouch
    let nodePositionsChanged = false;
    // we store the last drag event to be able to use it in the update function
    let dragEvent = null;
    // public functions
    function update({ noDragClassName, handleSelector, domNode, isSelectable, nodeId, nodeClickDistance = 0, }) {
        d3Selection = select(domNode);
        function updateNodes({ x, y }) {
            const { nodeLookup, nodeExtent, snapGrid, snapToGrid, nodeOrigin, onNodeDrag, onSelectionDrag, onError, updateNodePositions, } = getStoreItems();
            lastPos = { x, y };
            let hasChange = false;
            const isMultiDrag = dragItems.size > 1;
            const nodesBox = isMultiDrag && nodeExtent ? rectToBox(getInternalNodesBounds(dragItems)) : null;
            const multiDragSnapOffset = isMultiDrag && snapToGrid
                ? calculateSnapOffset({
                    dragItems,
                    snapGrid,
                    x,
                    y,
                })
                : null;
            for (const [id, dragItem] of dragItems) {
                /*
                 * if the node is not in the nodeLookup anymore, it was probably deleted while dragging
                 */
                if (!nodeLookup.has(id)) {
                    continue;
                }
                let nextPosition = { x: x - dragItem.distance.x, y: y - dragItem.distance.y };
                if (snapToGrid) {
                    nextPosition = multiDragSnapOffset
                        ? {
                            x: Math.round(nextPosition.x + multiDragSnapOffset.x),
                            y: Math.round(nextPosition.y + multiDragSnapOffset.y),
                        }
                        : snapPosition(nextPosition, snapGrid);
                }
                let adjustedNodeExtent = null;
                if (isMultiDrag && nodeExtent && !dragItem.extent && nodesBox) {
                    const { positionAbsolute } = dragItem.internals;
                    const x1 = positionAbsolute.x - nodesBox.x + nodeExtent[0][0];
                    const x2 = positionAbsolute.x + dragItem.measured.width - nodesBox.x2 + nodeExtent[1][0];
                    const y1 = positionAbsolute.y - nodesBox.y + nodeExtent[0][1];
                    const y2 = positionAbsolute.y + dragItem.measured.height - nodesBox.y2 + nodeExtent[1][1];
                    adjustedNodeExtent = [
                        [x1, y1],
                        [x2, y2],
                    ];
                }
                const { position, positionAbsolute } = calculateNodePosition({
                    nodeId: id,
                    nextPosition,
                    nodeLookup,
                    nodeExtent: adjustedNodeExtent ? adjustedNodeExtent : nodeExtent,
                    nodeOrigin,
                    onError,
                });
                // we want to make sure that we only fire a change event when there is a change
                hasChange = hasChange || dragItem.position.x !== position.x || dragItem.position.y !== position.y;
                dragItem.position = position;
                dragItem.internals.positionAbsolute = positionAbsolute;
            }
            nodePositionsChanged = nodePositionsChanged || hasChange;
            if (!hasChange) {
                return;
            }
            updateNodePositions(dragItems, true);
            if (dragEvent && (onDrag || onNodeDrag || (!nodeId && onSelectionDrag))) {
                const [currentNode, currentNodes] = getEventHandlerParams({
                    nodeId,
                    dragItems,
                    nodeLookup,
                });
                onDrag?.(dragEvent, dragItems, currentNode, currentNodes);
                onNodeDrag?.(dragEvent, currentNode, currentNodes);
                if (!nodeId) {
                    onSelectionDrag?.(dragEvent, currentNodes);
                }
            }
        }
        async function autoPan() {
            if (!containerBounds) {
                return;
            }
            const { transform, panBy, autoPanSpeed, autoPanOnNodeDrag } = getStoreItems();
            if (!autoPanOnNodeDrag) {
                autoPanStarted = false;
                cancelAnimationFrame(autoPanId);
                return;
            }
            const [xMovement, yMovement] = calcAutoPan(mousePosition, containerBounds, autoPanSpeed);
            if (xMovement !== 0 || yMovement !== 0) {
                lastPos.x = (lastPos.x ?? 0) - xMovement / transform[2];
                lastPos.y = (lastPos.y ?? 0) - yMovement / transform[2];
                if (await panBy({ x: xMovement, y: yMovement })) {
                    updateNodes(lastPos);
                }
            }
            autoPanId = requestAnimationFrame(autoPan);
        }
        function startDrag(event) {
            const { nodeLookup, multiSelectionActive, nodesDraggable, transform, snapGrid, snapToGrid, selectNodesOnDrag, onNodeDragStart, onSelectionDragStart, unselectNodesAndEdges, } = getStoreItems();
            dragStarted = true;
            if ((!selectNodesOnDrag || !isSelectable) && !multiSelectionActive && nodeId) {
                if (!nodeLookup.get(nodeId)?.selected) {
                    // we need to reset selected nodes when selectNodesOnDrag=false
                    unselectNodesAndEdges();
                }
            }
            if (isSelectable && selectNodesOnDrag && nodeId) {
                onNodeMouseDown?.(nodeId);
            }
            const pointerPos = getPointerPosition(event.sourceEvent, { transform, snapGrid, snapToGrid, containerBounds });
            lastPos = pointerPos;
            dragItems = getDragItems(nodeLookup, nodesDraggable, pointerPos, nodeId);
            if (dragItems.size > 0 && (onDragStart || onNodeDragStart || (!nodeId && onSelectionDragStart))) {
                const [currentNode, currentNodes] = getEventHandlerParams({
                    nodeId,
                    dragItems,
                    nodeLookup,
                });
                onDragStart?.(event.sourceEvent, dragItems, currentNode, currentNodes);
                onNodeDragStart?.(event.sourceEvent, currentNode, currentNodes);
                if (!nodeId) {
                    onSelectionDragStart?.(event.sourceEvent, currentNodes);
                }
            }
        }
        const d3DragInstance = drag()
            .clickDistance(nodeClickDistance)
            .on('start', (event) => {
            const { domNode, nodeDragThreshold, transform, snapGrid, snapToGrid } = getStoreItems();
            containerBounds = domNode?.getBoundingClientRect() || null;
            abortDrag = false;
            nodePositionsChanged = false;
            dragEvent = event.sourceEvent;
            if (nodeDragThreshold === 0) {
                startDrag(event);
            }
            const pointerPos = getPointerPosition(event.sourceEvent, { transform, snapGrid, snapToGrid, containerBounds });
            lastPos = pointerPos;
            mousePosition = getEventPosition(event.sourceEvent, containerBounds);
        })
            .on('drag', (event) => {
            const { autoPanOnNodeDrag, transform, snapGrid, snapToGrid, nodeDragThreshold, nodeLookup } = getStoreItems();
            const pointerPos = getPointerPosition(event.sourceEvent, { transform, snapGrid, snapToGrid, containerBounds });
            dragEvent = event.sourceEvent;
            if ((event.sourceEvent.type === 'touchmove' && event.sourceEvent.touches.length > 1) ||
                // if user deletes a node while dragging, we need to abort the drag to prevent errors
                (nodeId && !nodeLookup.has(nodeId))) {
                abortDrag = true;
            }
            if (abortDrag) {
                return;
            }
            if (!autoPanStarted && autoPanOnNodeDrag && dragStarted) {
                autoPanStarted = true;
                autoPan();
            }
            if (!dragStarted) {
                // Calculate distance in client coordinates for consistent drag threshold behavior across zoom levels
                const currentMousePosition = getEventPosition(event.sourceEvent, containerBounds);
                const x = currentMousePosition.x - mousePosition.x;
                const y = currentMousePosition.y - mousePosition.y;
                const distance = Math.sqrt(x * x + y * y);
                if (distance > nodeDragThreshold) {
                    startDrag(event);
                }
            }
            // skip events without movement
            if ((lastPos.x !== pointerPos.xSnapped || lastPos.y !== pointerPos.ySnapped) && dragItems && dragStarted) {
                mousePosition = getEventPosition(event.sourceEvent, containerBounds);
                updateNodes(pointerPos);
            }
        })
            .on('end', (event) => {
            if (!dragStarted || abortDrag) {
                return;
            }
            autoPanStarted = false;
            dragStarted = false;
            cancelAnimationFrame(autoPanId);
            if (dragItems.size > 0) {
                const { nodeLookup, updateNodePositions, onNodeDragStop, onSelectionDragStop } = getStoreItems();
                if (nodePositionsChanged) {
                    updateNodePositions(dragItems, false);
                    nodePositionsChanged = false;
                }
                if (onDragStop || onNodeDragStop || (!nodeId && onSelectionDragStop)) {
                    const [currentNode, currentNodes] = getEventHandlerParams({
                        nodeId,
                        dragItems,
                        nodeLookup,
                        dragging: false,
                    });
                    onDragStop?.(event.sourceEvent, dragItems, currentNode, currentNodes);
                    onNodeDragStop?.(event.sourceEvent, currentNode, currentNodes);
                    if (!nodeId) {
                        onSelectionDragStop?.(event.sourceEvent, currentNodes);
                    }
                }
            }
        })
            .filter((event) => {
            const target = event.target;
            const isDraggable = !event.button &&
                (!noDragClassName || !hasSelector(target, `.${noDragClassName}`, domNode)) &&
                (!handleSelector || hasSelector(target, handleSelector, domNode));
            return isDraggable;
        });
        d3Selection.call(d3DragInstance);
    }
    function destroy() {
        d3Selection?.on('.drag', null);
    }
    return {
        update,
        destroy,
    };
}

function getNodesWithinDistance(position, nodeLookup, distance) {
    const nodes = [];
    const rect = {
        x: position.x - distance,
        y: position.y - distance,
        width: distance * 2,
        height: distance * 2,
    };
    for (const node of nodeLookup.values()) {
        if (getOverlappingArea(rect, nodeToRect(node)) > 0) {
            nodes.push(node);
        }
    }
    return nodes;
}
/*
 * this distance is used for the area around the user pointer
 * while doing a connection for finding the closest nodes
 */
const ADDITIONAL_DISTANCE = 250;
function getClosestHandle(position, connectionRadius, nodeLookup, fromHandle) {
    let closestHandles = [];
    let minDistance = Infinity;
    const closeNodes = getNodesWithinDistance(position, nodeLookup, connectionRadius + ADDITIONAL_DISTANCE);
    for (const node of closeNodes) {
        const allHandles = [...(node.internals.handleBounds?.source ?? []), ...(node.internals.handleBounds?.target ?? [])];
        for (const handle of allHandles) {
            // if the handle is the same as the fromHandle we skip it
            if (fromHandle.nodeId === handle.nodeId && fromHandle.type === handle.type && fromHandle.id === handle.id) {
                continue;
            }
            // determine absolute position of the handle
            const { x, y } = getHandlePosition(node, handle, handle.position, true);
            const distance = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
            if (distance > connectionRadius) {
                continue;
            }
            if (distance < minDistance) {
                closestHandles = [{ ...handle, x, y }];
                minDistance = distance;
            }
            else if (distance === minDistance) {
                // when multiple handles are on the same distance we collect all of them
                closestHandles.push({ ...handle, x, y });
            }
        }
    }
    if (!closestHandles.length) {
        return null;
    }
    // when multiple handles overlay each other we prefer the opposite handle
    if (closestHandles.length > 1) {
        const oppositeHandleType = fromHandle.type === 'source' ? 'target' : 'source';
        return closestHandles.find((handle) => handle.type === oppositeHandleType) ?? closestHandles[0];
    }
    return closestHandles[0];
}
function getHandle(nodeId, handleType, handleId, nodeLookup, connectionMode, withAbsolutePosition = false) {
    const node = nodeLookup.get(nodeId);
    if (!node) {
        return null;
    }
    const handles = connectionMode === 'strict'
        ? node.internals.handleBounds?.[handleType]
        : [...(node.internals.handleBounds?.source ?? []), ...(node.internals.handleBounds?.target ?? [])];
    const handle = (handleId ? handles?.find((h) => h.id === handleId) : handles?.[0]) ?? null;
    return handle && withAbsolutePosition
        ? { ...handle, ...getHandlePosition(node, handle, handle.position, true) }
        : handle;
}
function getHandleType(edgeUpdaterType, handleDomNode) {
    if (edgeUpdaterType) {
        return edgeUpdaterType;
    }
    else if (handleDomNode?.classList.contains('target')) {
        return 'target';
    }
    else if (handleDomNode?.classList.contains('source')) {
        return 'source';
    }
    return null;
}
function isConnectionValid(isInsideConnectionRadius, isHandleValid) {
    let isValid = null;
    if (isHandleValid) {
        isValid = true;
    }
    else if (isInsideConnectionRadius && !isHandleValid) {
        isValid = false;
    }
    return isValid;
}

const alwaysValid = () => true;
function onPointerDown(event, { connectionMode, connectionRadius, handleId, nodeId, edgeUpdaterType, isTarget, domNode, nodeLookup, lib, autoPanOnConnect, flowId, panBy, cancelConnection, onConnectStart, onConnect, onConnectEnd, isValidConnection = alwaysValid, onReconnectEnd, updateConnection, getTransform, getFromHandle, autoPanSpeed, dragThreshold = 1, handleDomNode, }) {
    // when xyflow is used inside a shadow root we can't use document
    const doc = getHostForElement(event.target);
    let autoPanId = 0;
    let closestHandle;
    const { x, y } = getEventPosition(event);
    const handleType = getHandleType(edgeUpdaterType, handleDomNode);
    const containerBounds = domNode?.getBoundingClientRect();
    let connectionStarted = false;
    if (!containerBounds || !handleType) {
        return;
    }
    const fromHandleInternal = getHandle(nodeId, handleType, handleId, nodeLookup, connectionMode);
    if (!fromHandleInternal) {
        return;
    }
    let position = getEventPosition(event, containerBounds);
    let autoPanStarted = false;
    let connection = null;
    let isValid = false;
    let resultHandleDomNode = null;
    // when the user is moving the mouse close to the edge of the canvas while connecting we move the canvas
    function autoPan() {
        if (!autoPanOnConnect || !containerBounds) {
            return;
        }
        const [x, y] = calcAutoPan(position, containerBounds, autoPanSpeed);
        panBy({ x, y });
        autoPanId = requestAnimationFrame(autoPan);
    }
    // Stays the same for all consecutive pointermove events
    const fromHandle = {
        ...fromHandleInternal,
        nodeId,
        type: handleType,
        position: fromHandleInternal.position,
    };
    const fromNodeInternal = nodeLookup.get(nodeId);
    const from = getHandlePosition(fromNodeInternal, fromHandle, Position.Left, true);
    let previousConnection = {
        inProgress: true,
        isValid: null,
        from,
        fromHandle,
        fromPosition: fromHandle.position,
        fromNode: fromNodeInternal,
        to: position,
        toHandle: null,
        toPosition: oppositePosition[fromHandle.position],
        toNode: null,
        pointer: position,
    };
    function startConnection() {
        connectionStarted = true;
        updateConnection(previousConnection);
        onConnectStart?.(event, { nodeId, handleId, handleType });
    }
    if (dragThreshold === 0) {
        startConnection();
    }
    function onPointerMove(event) {
        if (!connectionStarted) {
            const { x: evtX, y: evtY } = getEventPosition(event);
            const dx = evtX - x;
            const dy = evtY - y;
            const nextConnectionStarted = dx * dx + dy * dy > dragThreshold * dragThreshold;
            if (!nextConnectionStarted) {
                return;
            }
            startConnection();
        }
        if (!getFromHandle() || !fromHandle) {
            onPointerUp(event);
            return;
        }
        const transform = getTransform();
        position = getEventPosition(event, containerBounds);
        closestHandle = getClosestHandle(pointToRendererPoint(position, transform, false, [1, 1]), connectionRadius, nodeLookup, fromHandle);
        if (!autoPanStarted) {
            autoPan();
            autoPanStarted = true;
        }
        const result = isValidHandle(event, {
            handle: closestHandle,
            connectionMode,
            fromNodeId: nodeId,
            fromHandleId: handleId,
            fromType: isTarget ? 'target' : 'source',
            isValidConnection,
            doc,
            lib,
            flowId,
            nodeLookup,
        });
        resultHandleDomNode = result.handleDomNode;
        connection = result.connection;
        isValid = isConnectionValid(!!closestHandle, result.isValid);
        const newConnection = {
            // from stays the same
            ...previousConnection,
            isValid,
            to: result.toHandle && isValid
                ? rendererPointToPoint({ x: result.toHandle.x, y: result.toHandle.y }, transform)
                : position,
            toHandle: result.toHandle,
            toPosition: isValid && result.toHandle ? result.toHandle.position : oppositePosition[fromHandle.position],
            toNode: result.toHandle ? nodeLookup.get(result.toHandle.nodeId) : null,
            pointer: position,
        };
        updateConnection(newConnection);
        previousConnection = newConnection;
    }
    function onPointerUp(event) {
        // Prevent multi-touch aborting connection
        if ('touches' in event && event.touches.length > 0) {
            return;
        }
        if (connectionStarted) {
            if ((closestHandle || resultHandleDomNode) && connection && isValid) {
                onConnect?.(connection);
            }
            /*
             * it's important to get a fresh reference from the store here
             * in order to get the latest state of onConnectEnd
             */
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { inProgress, ...connectionState } = previousConnection;
            const finalConnectionState = {
                ...connectionState,
                toPosition: previousConnection.toHandle ? previousConnection.toPosition : null,
            };
            onConnectEnd?.(event, finalConnectionState);
            if (edgeUpdaterType) {
                onReconnectEnd?.(event, finalConnectionState);
            }
        }
        cancelConnection();
        cancelAnimationFrame(autoPanId);
        autoPanStarted = false;
        isValid = false;
        connection = null;
        resultHandleDomNode = null;
        doc.removeEventListener('mousemove', onPointerMove);
        doc.removeEventListener('mouseup', onPointerUp);
        doc.removeEventListener('touchmove', onPointerMove);
        doc.removeEventListener('touchend', onPointerUp);
    }
    doc.addEventListener('mousemove', onPointerMove);
    doc.addEventListener('mouseup', onPointerUp);
    doc.addEventListener('touchmove', onPointerMove);
    doc.addEventListener('touchend', onPointerUp);
}
// checks if  and returns connection in fom of an object { source: 123, target: 312 }
function isValidHandle(event, { handle, connectionMode, fromNodeId, fromHandleId, fromType, doc, lib, flowId, isValidConnection = alwaysValid, nodeLookup, }) {
    const isTarget = fromType === 'target';
    const handleDomNode = handle
        ? doc.querySelector(`.${lib}-flow__handle[data-id="${flowId}-${handle?.nodeId}-${handle?.id}-${handle?.type}"]`)
        : null;
    const { x, y } = getEventPosition(event);
    const handleBelow = doc.elementFromPoint(x, y);
    /*
     * we always want to prioritize the handle below the mouse cursor over the closest distance handle,
     * because it could be that the center of another handle is closer to the mouse pointer than the handle below the cursor
     */
    const handleToCheck = handleBelow?.classList.contains(`${lib}-flow__handle`) ? handleBelow : handleDomNode;
    const result = {
        handleDomNode: handleToCheck,
        isValid: false,
        connection: null,
        toHandle: null,
    };
    if (handleToCheck) {
        const handleType = getHandleType(undefined, handleToCheck);
        const handleNodeId = handleToCheck.getAttribute('data-nodeid');
        const handleId = handleToCheck.getAttribute('data-handleid');
        const connectable = handleToCheck.classList.contains('connectable');
        const connectableEnd = handleToCheck.classList.contains('connectableend');
        if (!handleNodeId || !handleType) {
            return result;
        }
        const connection = {
            source: isTarget ? handleNodeId : fromNodeId,
            sourceHandle: isTarget ? handleId : fromHandleId,
            target: isTarget ? fromNodeId : handleNodeId,
            targetHandle: isTarget ? fromHandleId : handleId,
        };
        result.connection = connection;
        const isConnectable = connectable && connectableEnd;
        // in strict mode we don't allow target to target or source to source connections
        const isValid = isConnectable &&
            (connectionMode === ConnectionMode.Strict
                ? (isTarget && handleType === 'source') || (!isTarget && handleType === 'target')
                : handleNodeId !== fromNodeId || handleId !== fromHandleId);
        result.isValid = isValid && isValidConnection(connection);
        result.toHandle = getHandle(handleNodeId, handleType, handleId, nodeLookup, connectionMode, true);
    }
    return result;
}
const XYHandle = {
    onPointerDown,
    isValid: isValidHandle,
};

function XYMinimap({ domNode, panZoom, getTransform, getViewScale }) {
    const selection = select(domNode);
    function update({ translateExtent, width, height, zoomStep = 1, pannable = true, zoomable = true, inversePan = false, }) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const zoomHandler = (event) => {
            if (event.sourceEvent.type !== 'wheel' || !panZoom) {
                return;
            }
            const transform = getTransform();
            const factor = event.sourceEvent.ctrlKey && isMacOs() ? 10 : 1;
            const pinchDelta = -event.sourceEvent.deltaY *
                (event.sourceEvent.deltaMode === 1 ? 0.05 : event.sourceEvent.deltaMode ? 1 : 0.002) *
                zoomStep;
            const nextZoom = transform[2] * Math.pow(2, pinchDelta * factor);
            panZoom.scaleTo(nextZoom);
        };
        let panStart = [0, 0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const panStartHandler = (event) => {
            if (event.sourceEvent.type === 'mousedown' || event.sourceEvent.type === 'touchstart') {
                panStart = [
                    event.sourceEvent.clientX ?? event.sourceEvent.touches[0].clientX,
                    event.sourceEvent.clientY ?? event.sourceEvent.touches[0].clientY,
                ];
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const panHandler = (event) => {
            const transform = getTransform();
            if ((event.sourceEvent.type !== 'mousemove' && event.sourceEvent.type !== 'touchmove') || !panZoom) {
                return;
            }
            const panCurrent = [
                event.sourceEvent.clientX ?? event.sourceEvent.touches[0].clientX,
                event.sourceEvent.clientY ?? event.sourceEvent.touches[0].clientY,
            ];
            const panDelta = [panCurrent[0] - panStart[0], panCurrent[1] - panStart[1]];
            panStart = panCurrent;
            const moveScale = getViewScale() * Math.max(transform[2], Math.log(transform[2])) * (inversePan ? -1 : 1);
            const position = {
                x: transform[0] - panDelta[0] * moveScale,
                y: transform[1] - panDelta[1] * moveScale,
            };
            const extent = [
                [0, 0],
                [width, height],
            ];
            panZoom.setViewportConstrained({
                x: position.x,
                y: position.y,
                zoom: transform[2],
            }, extent, translateExtent);
        };
        const zoomAndPanHandler = zoom()
            .on('start', panStartHandler)
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            .on('zoom', pannable ? panHandler : null)
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            .on('zoom.wheel', zoomable ? zoomHandler : null);
        selection.call(zoomAndPanHandler, {});
    }
    function destroy() {
        selection.on('zoom', null);
    }
    return {
        update,
        destroy,
        pointer,
    };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const transformToViewport = (transform) => ({
    x: transform.x,
    y: transform.y,
    zoom: transform.k,
});
const viewportToTransform = ({ x, y, zoom }) => zoomIdentity.translate(x, y).scale(zoom);
const isWrappedWithClass = (event, className) => event.target.closest(`.${className}`);
const isRightClickPan = (panOnDrag, usedButton) => usedButton === 2 && Array.isArray(panOnDrag) && panOnDrag.includes(2);
// taken from d3-ease: https://github.com/d3/d3-ease/blob/main/src/cubic.js
const defaultEase = (t) => ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
const getD3Transition = (selection, duration = 0, ease = defaultEase, onEnd = () => { }) => {
    const hasDuration = typeof duration === 'number' && duration > 0;
    if (!hasDuration) {
        onEnd();
    }
    return hasDuration ? selection.transition().duration(duration).ease(ease).on('end', onEnd) : selection;
};
const wheelDelta = (event) => {
    const factor = event.ctrlKey && isMacOs() ? 10 : 1;
    return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * factor;
};

function createPanOnScrollHandler({ zoomPanValues, noWheelClassName, d3Selection, d3Zoom, panOnScrollMode, panOnScrollSpeed, zoomOnPinch, onPanZoomStart, onPanZoom, onPanZoomEnd, }) {
    return (event) => {
        if (isWrappedWithClass(event, noWheelClassName)) {
            if (event.ctrlKey) {
                event.preventDefault(); // stop native page zoom for pinch zooming
            }
            return false;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        const currentZoom = d3Selection.property('__zoom').k || 1;
        // macos sets ctrlKey=true for pinch gesture on a trackpad
        if (event.ctrlKey && zoomOnPinch) {
            const point = pointer(event);
            const pinchDelta = wheelDelta(event);
            const zoom = currentZoom * Math.pow(2, pinchDelta);
            // @ts-ignore
            d3Zoom.scaleTo(d3Selection, zoom, point, event);
            return;
        }
        /*
         * increase scroll speed in firefox
         * firefox: deltaMode === 1; chrome: deltaMode === 0
         */
        const deltaNormalize = event.deltaMode === 1 ? 20 : 1;
        let deltaX = panOnScrollMode === PanOnScrollMode.Vertical ? 0 : event.deltaX * deltaNormalize;
        let deltaY = panOnScrollMode === PanOnScrollMode.Horizontal ? 0 : event.deltaY * deltaNormalize;
        // this enables vertical scrolling with shift + scroll on windows
        if (!isMacOs() && event.shiftKey && panOnScrollMode !== PanOnScrollMode.Vertical) {
            deltaX = event.deltaY * deltaNormalize;
            deltaY = 0;
        }
        d3Zoom.translateBy(d3Selection, -(deltaX / currentZoom) * panOnScrollSpeed, -(deltaY / currentZoom) * panOnScrollSpeed, 
        // @ts-ignore
        { internal: true });
        const nextViewport = transformToViewport(d3Selection.property('__zoom'));
        clearTimeout(zoomPanValues.panScrollTimeout);
        /*
         * for pan on scroll we need to handle the event calls on our own
         * we can't use the start, zoom and end events from d3-zoom
         * because start and move gets called on every scroll event and not once at the beginning
         */
        if (!zoomPanValues.isPanScrolling) {
            zoomPanValues.isPanScrolling = true;
            onPanZoomStart?.(event, nextViewport);
        }
        else {
            onPanZoom?.(event, nextViewport);
            zoomPanValues.panScrollTimeout = setTimeout(() => {
                onPanZoomEnd?.(event, nextViewport);
                zoomPanValues.isPanScrolling = false;
            }, 150);
        }
    };
}
function createZoomOnScrollHandler({ noWheelClassName, preventScrolling, d3ZoomHandler }) {
    return function (event, d) {
        const isWheel = event.type === 'wheel';
        // we still want to enable pinch zooming even if preventScrolling is set to false
        const preventZoom = !preventScrolling && isWheel && !event.ctrlKey;
        const hasNoWheelClass = isWrappedWithClass(event, noWheelClassName);
        // if user is pinch zooming above a nowheel element, we don't want the browser to zoom
        if (event.ctrlKey && isWheel && hasNoWheelClass) {
            event.preventDefault();
        }
        if (preventZoom || hasNoWheelClass) {
            return null;
        }
        event.preventDefault();
        d3ZoomHandler.call(this, event, d);
    };
}
function createPanZoomStartHandler({ zoomPanValues, onDraggingChange, onPanZoomStart }) {
    return (event) => {
        if (event.sourceEvent?.internal) {
            return;
        }
        const viewport = transformToViewport(event.transform);
        // we need to remember it here, because it's always 0 in the "zoom" event
        zoomPanValues.mouseButton = event.sourceEvent?.button || 0;
        zoomPanValues.isZoomingOrPanning = true;
        zoomPanValues.prevViewport = viewport;
        if (event.sourceEvent?.type === 'mousedown') {
            onDraggingChange(true);
        }
        if (onPanZoomStart) {
            onPanZoomStart?.(event.sourceEvent, viewport);
        }
    };
}
function createPanZoomHandler({ zoomPanValues, panOnDrag, onPaneContextMenu, onTransformChange, onPanZoom, }) {
    return (event) => {
        zoomPanValues.usedRightMouseButton = !!(onPaneContextMenu && isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0));
        if (!event.sourceEvent?.sync) {
            onTransformChange([event.transform.x, event.transform.y, event.transform.k]);
        }
        if (onPanZoom && !event.sourceEvent?.internal) {
            onPanZoom?.(event.sourceEvent, transformToViewport(event.transform));
        }
    };
}
function createPanZoomEndHandler({ zoomPanValues, panOnDrag, panOnScroll, onDraggingChange, onPanZoomEnd, onPaneContextMenu, }) {
    return (event) => {
        if (event.sourceEvent?.internal) {
            return;
        }
        zoomPanValues.isZoomingOrPanning = false;
        if (onPaneContextMenu &&
            isRightClickPan(panOnDrag, zoomPanValues.mouseButton ?? 0) &&
            !zoomPanValues.usedRightMouseButton &&
            event.sourceEvent) {
            onPaneContextMenu(event.sourceEvent);
        }
        zoomPanValues.usedRightMouseButton = false;
        onDraggingChange(false);
        if (onPanZoomEnd) {
            const viewport = transformToViewport(event.transform);
            zoomPanValues.prevViewport = viewport;
            clearTimeout(zoomPanValues.timerId);
            zoomPanValues.timerId = setTimeout(() => {
                onPanZoomEnd?.(event.sourceEvent, viewport);
            }, 
            // we need a setTimeout for panOnScroll to supress multiple end events fired during scroll
            panOnScroll ? 150 : 0);
        }
    };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function createFilter({ zoomActivationKeyPressed, zoomOnScroll, zoomOnPinch, panOnDrag, panOnScroll, zoomOnDoubleClick, userSelectionActive, noWheelClassName, noPanClassName, lib, connectionInProgress, }) {
    return (event) => {
        const zoomScroll = zoomActivationKeyPressed || zoomOnScroll;
        const pinchZoom = zoomOnPinch && event.ctrlKey;
        const isWheelEvent = event.type === 'wheel';
        if (event.button === 1 &&
            event.type === 'mousedown' &&
            (isWrappedWithClass(event, `${lib}-flow__node`) || isWrappedWithClass(event, `${lib}-flow__edge`))) {
            return true;
        }
        // if all interactions are disabled, we prevent all zoom events
        if (!panOnDrag && !zoomScroll && !panOnScroll && !zoomOnDoubleClick && !zoomOnPinch) {
            return false;
        }
        // during a selection we prevent all other interactions
        if (userSelectionActive) {
            return false;
        }
        // we want to disable pinch-zooming while making a connection
        if (connectionInProgress && !isWheelEvent) {
            return false;
        }
        // if the target element is inside an element with the nowheel class, we prevent zooming
        if (isWrappedWithClass(event, noWheelClassName) && isWheelEvent) {
            return false;
        }
        // if the target element is inside an element with the nopan class, we prevent panning
        if (isWrappedWithClass(event, noPanClassName) &&
            (!isWheelEvent || (panOnScroll && isWheelEvent && !zoomActivationKeyPressed))) {
            return false;
        }
        if (!zoomOnPinch && event.ctrlKey && isWheelEvent) {
            return false;
        }
        if (!zoomOnPinch && event.type === 'touchstart' && event.touches?.length > 1) {
            event.preventDefault(); // if you manage to start with 2 touches, we prevent native zoom
            return false;
        }
        // when there is no scroll handling enabled, we prevent all wheel events
        if (!zoomScroll && !panOnScroll && !pinchZoom && isWheelEvent) {
            return false;
        }
        // if the pane is not movable, we prevent dragging it with mousestart or touchstart
        if (!panOnDrag && (event.type === 'mousedown' || event.type === 'touchstart')) {
            return false;
        }
        // if the pane is only movable using allowed clicks
        if (Array.isArray(panOnDrag) && !panOnDrag.includes(event.button) && event.type === 'mousedown') {
            return false;
        }
        // We only allow right clicks if pan on drag is set to right click
        const buttonAllowed = (Array.isArray(panOnDrag) && panOnDrag.includes(event.button)) || !event.button || event.button <= 1;
        // default filter for d3-zoom
        return (!event.ctrlKey || isWheelEvent) && buttonAllowed;
    };
}

function XYPanZoom({ domNode, minZoom, maxZoom, translateExtent, viewport, onPanZoom, onPanZoomStart, onPanZoomEnd, onDraggingChange, }) {
    const zoomPanValues = {
        isZoomingOrPanning: false,
        usedRightMouseButton: false,
        prevViewport: { x: 0, y: 0, zoom: 0 },
        mouseButton: 0,
        timerId: undefined,
        panScrollTimeout: undefined,
        isPanScrolling: false,
    };
    const bbox = domNode.getBoundingClientRect();
    const d3ZoomInstance = zoom().scaleExtent([minZoom, maxZoom]).translateExtent(translateExtent);
    const d3Selection = select(domNode).call(d3ZoomInstance);
    setViewportConstrained({
        x: viewport.x,
        y: viewport.y,
        zoom: clamp(viewport.zoom, minZoom, maxZoom),
    }, [
        [0, 0],
        [bbox.width, bbox.height],
    ], translateExtent);
    const d3ZoomHandler = d3Selection.on('wheel.zoom');
    const d3DblClickZoomHandler = d3Selection.on('dblclick.zoom');
    d3ZoomInstance.wheelDelta(wheelDelta);
    function setTransform(transform, options) {
        if (d3Selection) {
            return new Promise((resolve) => {
                d3ZoomInstance?.interpolate(options?.interpolate === 'linear' ? interpolate : interpolateZoom).transform(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), transform);
            });
        }
        return Promise.resolve(false);
    }
    // public functions
    function update({ noWheelClassName, noPanClassName, onPaneContextMenu, userSelectionActive, panOnScroll, panOnDrag, panOnScrollMode, panOnScrollSpeed, preventScrolling, zoomOnPinch, zoomOnScroll, zoomOnDoubleClick, zoomActivationKeyPressed, lib, onTransformChange, connectionInProgress, paneClickDistance, selectionOnDrag, }) {
        if (userSelectionActive && !zoomPanValues.isZoomingOrPanning) {
            destroy();
        }
        const isPanOnScroll = panOnScroll && !zoomActivationKeyPressed && !userSelectionActive;
        d3ZoomInstance.clickDistance(selectionOnDrag ? Infinity : !isNumeric(paneClickDistance) || paneClickDistance < 0 ? 0 : paneClickDistance);
        const wheelHandler = isPanOnScroll
            ? createPanOnScrollHandler({
                zoomPanValues,
                noWheelClassName,
                d3Selection,
                d3Zoom: d3ZoomInstance,
                panOnScrollMode,
                panOnScrollSpeed,
                zoomOnPinch,
                onPanZoomStart,
                onPanZoom,
                onPanZoomEnd,
            })
            : createZoomOnScrollHandler({
                noWheelClassName,
                preventScrolling,
                d3ZoomHandler,
            });
        d3Selection.on('wheel.zoom', wheelHandler, { passive: false });
        if (!userSelectionActive) {
            // pan zoom start
            const startHandler = createPanZoomStartHandler({
                zoomPanValues,
                onDraggingChange,
                onPanZoomStart,
            });
            d3ZoomInstance.on('start', startHandler);
            // pan zoom
            const panZoomHandler = createPanZoomHandler({
                zoomPanValues,
                panOnDrag,
                onPaneContextMenu: !!onPaneContextMenu,
                onPanZoom,
                onTransformChange,
            });
            d3ZoomInstance.on('zoom', panZoomHandler);
            // pan zoom end
            const panZoomEndHandler = createPanZoomEndHandler({
                zoomPanValues,
                panOnDrag,
                panOnScroll,
                onPaneContextMenu,
                onPanZoomEnd,
                onDraggingChange,
            });
            d3ZoomInstance.on('end', panZoomEndHandler);
        }
        const filter = createFilter({
            zoomActivationKeyPressed,
            panOnDrag,
            zoomOnScroll,
            panOnScroll,
            zoomOnDoubleClick,
            zoomOnPinch,
            userSelectionActive,
            noPanClassName,
            noWheelClassName,
            lib,
            connectionInProgress,
        });
        d3ZoomInstance.filter(filter);
        /*
         * We cannot add zoomOnDoubleClick to the filter above because
         * double tapping on touch screens circumvents the filter and
         * dblclick.zoom is fired on the selection directly
         */
        if (zoomOnDoubleClick) {
            d3Selection.on('dblclick.zoom', d3DblClickZoomHandler);
        }
        else {
            d3Selection.on('dblclick.zoom', null);
        }
    }
    function destroy() {
        d3ZoomInstance.on('zoom', null);
    }
    async function setViewportConstrained(viewport, extent, translateExtent) {
        const nextTransform = viewportToTransform(viewport);
        const contrainedTransform = d3ZoomInstance?.constrain()(nextTransform, extent, translateExtent);
        if (contrainedTransform) {
            await setTransform(contrainedTransform);
        }
        return new Promise((resolve) => resolve(contrainedTransform));
    }
    async function setViewport(viewport, options) {
        const nextTransform = viewportToTransform(viewport);
        await setTransform(nextTransform, options);
        return new Promise((resolve) => resolve(nextTransform));
    }
    function syncViewport(viewport) {
        if (d3Selection) {
            const nextTransform = viewportToTransform(viewport);
            const currentTransform = d3Selection.property('__zoom');
            if (currentTransform.k !== viewport.zoom ||
                currentTransform.x !== viewport.x ||
                currentTransform.y !== viewport.y) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                d3ZoomInstance?.transform(d3Selection, nextTransform, null, { sync: true });
            }
        }
    }
    function getViewport() {
        const transform = d3Selection ? zoomTransform(d3Selection.node()) : { x: 0, y: 0, k: 1 };
        return { x: transform.x, y: transform.y, zoom: transform.k };
    }
    function scaleTo(zoom, options) {
        if (d3Selection) {
            return new Promise((resolve) => {
                d3ZoomInstance?.interpolate(options?.interpolate === 'linear' ? interpolate : interpolateZoom).scaleTo(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), zoom);
            });
        }
        return Promise.resolve(false);
    }
    function scaleBy(factor, options) {
        if (d3Selection) {
            return new Promise((resolve) => {
                d3ZoomInstance?.interpolate(options?.interpolate === 'linear' ? interpolate : interpolateZoom).scaleBy(getD3Transition(d3Selection, options?.duration, options?.ease, () => resolve(true)), factor);
            });
        }
        return Promise.resolve(false);
    }
    function setScaleExtent(scaleExtent) {
        d3ZoomInstance?.scaleExtent(scaleExtent);
    }
    function setTranslateExtent(translateExtent) {
        d3ZoomInstance?.translateExtent(translateExtent);
    }
    function setClickDistance(distance) {
        const validDistance = !isNumeric(distance) || distance < 0 ? 0 : distance;
        d3ZoomInstance?.clickDistance(validDistance);
    }
    return {
        update,
        destroy,
        setViewport,
        setViewportConstrained,
        getViewport,
        scaleTo,
        scaleBy,
        setScaleExtent,
        setTranslateExtent,
        syncViewport,
        setClickDistance,
    };
}

/**
 * Used to determine the variant of the resize control
 *
 * @public
 */
var ResizeControlVariant;
(function (ResizeControlVariant) {
    ResizeControlVariant["Line"] = "line";
    ResizeControlVariant["Handle"] = "handle";
})(ResizeControlVariant || (ResizeControlVariant = {}));
const XY_RESIZER_HANDLE_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const XY_RESIZER_LINE_POSITIONS = ['top', 'right', 'bottom', 'left'];

/**
 * Get all connecting edges for a given set of nodes
 * @param width - new width of the node
 * @param prevWidth - previous width of the node
 * @param height - new height of the node
 * @param prevHeight - previous height of the node
 * @param affectsX - whether to invert the resize direction for the x axis
 * @param affectsY - whether to invert the resize direction for the y axis
 * @returns array of two numbers representing the direction of the resize for each axis, 0 = no change, 1 = increase, -1 = decrease
 */
function getResizeDirection({ width, prevWidth, height, prevHeight, affectsX, affectsY, }) {
    const deltaWidth = width - prevWidth;
    const deltaHeight = height - prevHeight;
    const direction = [deltaWidth > 0 ? 1 : deltaWidth < 0 ? -1 : 0, deltaHeight > 0 ? 1 : deltaHeight < 0 ? -1 : 0];
    if (deltaWidth && affectsX) {
        direction[0] = direction[0] * -1;
    }
    if (deltaHeight && affectsY) {
        direction[1] = direction[1] * -1;
    }
    return direction;
}
/**
 * Parses the control position that is being dragged to dimensions that are being resized
 * @param controlPosition - position of the control that is being dragged
 * @returns isHorizontal, isVertical, affectsX, affectsY,
 */
function getControlDirection(controlPosition) {
    const isHorizontal = controlPosition.includes('right') || controlPosition.includes('left');
    const isVertical = controlPosition.includes('bottom') || controlPosition.includes('top');
    const affectsX = controlPosition.includes('left');
    const affectsY = controlPosition.includes('top');
    return {
        isHorizontal,
        isVertical,
        affectsX,
        affectsY,
    };
}
function getLowerExtentClamp(lowerExtent, lowerBound) {
    return Math.max(0, lowerBound - lowerExtent);
}
function getUpperExtentClamp(upperExtent, upperBound) {
    return Math.max(0, upperExtent - upperBound);
}
function getSizeClamp(size, minSize, maxSize) {
    return Math.max(0, minSize - size, size - maxSize);
}
function xor(a, b) {
    return a ? !b : b;
}
/**
 * Calculates new width & height and x & y of node after resize based on pointer position
 * @description - Buckle up, this is a chunky one... If you want to determine the new dimensions of a node after a resize,
 * you have to account for all possible restrictions: min/max width/height of the node, the maximum extent the node is allowed
 * to move in (in this case: resize into) determined by the parent node, the minimal extent determined by child nodes
 * with expandParent or extent: 'parent' set and oh yeah, these things also have to work with keepAspectRatio!
 * The way this is done is by determining how much each of these restricting actually restricts the resize and then applying the
 * strongest restriction. Because the resize affects x, y and width, height and width, height of a opposing side with keepAspectRatio,
 * the resize amount is always kept in distX & distY amount (the distance in mouse movement)
 * Instead of clamping each value, we first calculate the biggest 'clamp' (for the lack of a better name) and then apply it to all values.
 * To complicate things nodeOrigin has to be taken into account as well. This is done by offsetting the nodes as if their origin is [0, 0],
 * then calculating the restrictions as usual
 * @param startValues - starting values of resize
 * @param controlDirection - dimensions affected by the resize
 * @param pointerPosition - the current pointer position corrected for snapping
 * @param boundaries - minimum and maximum dimensions of the node
 * @param keepAspectRatio - prevent changes of asprect ratio
 * @returns x, y, width and height of the node after resize
 */
function getDimensionsAfterResize(startValues, controlDirection, pointerPosition, boundaries, keepAspectRatio, nodeOrigin, extent, childExtent) {
    let { affectsX, affectsY } = controlDirection;
    const { isHorizontal, isVertical } = controlDirection;
    const isDiagonal = isHorizontal && isVertical;
    const { xSnapped, ySnapped } = pointerPosition;
    const { minWidth, maxWidth, minHeight, maxHeight } = boundaries;
    const { x: startX, y: startY, width: startWidth, height: startHeight, aspectRatio } = startValues;
    let distX = Math.floor(isHorizontal ? xSnapped - startValues.pointerX : 0);
    let distY = Math.floor(isVertical ? ySnapped - startValues.pointerY : 0);
    const newWidth = startWidth + (affectsX ? -distX : distX);
    const newHeight = startHeight + (affectsY ? -distY : distY);
    const originOffsetX = -nodeOrigin[0] * startWidth;
    const originOffsetY = -nodeOrigin[1] * startHeight;
    // Check if maxWidth, minWWidth, maxHeight, minHeight are restricting the resize
    let clampX = getSizeClamp(newWidth, minWidth, maxWidth);
    let clampY = getSizeClamp(newHeight, minHeight, maxHeight);
    // Check if extent is restricting the resize
    if (extent) {
        let xExtentClamp = 0;
        let yExtentClamp = 0;
        if (affectsX && distX < 0) {
            xExtentClamp = getLowerExtentClamp(startX + distX + originOffsetX, extent[0][0]);
        }
        else if (!affectsX && distX > 0) {
            xExtentClamp = getUpperExtentClamp(startX + newWidth + originOffsetX, extent[1][0]);
        }
        if (affectsY && distY < 0) {
            yExtentClamp = getLowerExtentClamp(startY + distY + originOffsetY, extent[0][1]);
        }
        else if (!affectsY && distY > 0) {
            yExtentClamp = getUpperExtentClamp(startY + newHeight + originOffsetY, extent[1][1]);
        }
        clampX = Math.max(clampX, xExtentClamp);
        clampY = Math.max(clampY, yExtentClamp);
    }
    // Check if the child extent is restricting the resize
    if (childExtent) {
        let xExtentClamp = 0;
        let yExtentClamp = 0;
        if (affectsX && distX > 0) {
            xExtentClamp = getUpperExtentClamp(startX + distX, childExtent[0][0]);
        }
        else if (!affectsX && distX < 0) {
            xExtentClamp = getLowerExtentClamp(startX + newWidth, childExtent[1][0]);
        }
        if (affectsY && distY > 0) {
            yExtentClamp = getUpperExtentClamp(startY + distY, childExtent[0][1]);
        }
        else if (!affectsY && distY < 0) {
            yExtentClamp = getLowerExtentClamp(startY + newHeight, childExtent[1][1]);
        }
        clampX = Math.max(clampX, xExtentClamp);
        clampY = Math.max(clampY, yExtentClamp);
    }
    // Check if the aspect ratio resizing of the other side is restricting the resize
    if (keepAspectRatio) {
        if (isHorizontal) {
            // Check if the max dimensions might be restricting the resize
            const aspectHeightClamp = getSizeClamp(newWidth / aspectRatio, minHeight, maxHeight) * aspectRatio;
            clampX = Math.max(clampX, aspectHeightClamp);
            // Check if the extent is restricting the resize
            if (extent) {
                let aspectExtentClamp = 0;
                if ((!affectsX && !affectsY) || (affectsX && !affectsY && isDiagonal)) {
                    aspectExtentClamp =
                        getUpperExtentClamp(startY + originOffsetY + newWidth / aspectRatio, extent[1][1]) * aspectRatio;
                }
                else {
                    aspectExtentClamp =
                        getLowerExtentClamp(startY + originOffsetY + (affectsX ? distX : -distX) / aspectRatio, extent[0][1]) *
                            aspectRatio;
                }
                clampX = Math.max(clampX, aspectExtentClamp);
            }
            // Check if the child extent is restricting the resize
            if (childExtent) {
                let aspectExtentClamp = 0;
                if ((!affectsX && !affectsY) || (affectsX && !affectsY && isDiagonal)) {
                    aspectExtentClamp = getLowerExtentClamp(startY + newWidth / aspectRatio, childExtent[1][1]) * aspectRatio;
                }
                else {
                    aspectExtentClamp =
                        getUpperExtentClamp(startY + (affectsX ? distX : -distX) / aspectRatio, childExtent[0][1]) * aspectRatio;
                }
                clampX = Math.max(clampX, aspectExtentClamp);
            }
        }
        // Do the same thing for vertical resizing
        if (isVertical) {
            const aspectWidthClamp = getSizeClamp(newHeight * aspectRatio, minWidth, maxWidth) / aspectRatio;
            clampY = Math.max(clampY, aspectWidthClamp);
            if (extent) {
                let aspectExtentClamp = 0;
                if ((!affectsX && !affectsY) || (affectsY && !affectsX && isDiagonal)) {
                    aspectExtentClamp =
                        getUpperExtentClamp(startX + newHeight * aspectRatio + originOffsetX, extent[1][0]) / aspectRatio;
                }
                else {
                    aspectExtentClamp =
                        getLowerExtentClamp(startX + (affectsY ? distY : -distY) * aspectRatio + originOffsetX, extent[0][0]) /
                            aspectRatio;
                }
                clampY = Math.max(clampY, aspectExtentClamp);
            }
            if (childExtent) {
                let aspectExtentClamp = 0;
                if ((!affectsX && !affectsY) || (affectsY && !affectsX && isDiagonal)) {
                    aspectExtentClamp = getLowerExtentClamp(startX + newHeight * aspectRatio, childExtent[1][0]) / aspectRatio;
                }
                else {
                    aspectExtentClamp =
                        getUpperExtentClamp(startX + (affectsY ? distY : -distY) * aspectRatio, childExtent[0][0]) / aspectRatio;
                }
                clampY = Math.max(clampY, aspectExtentClamp);
            }
        }
    }
    distY = distY + (distY < 0 ? clampY : -clampY);
    distX = distX + (distX < 0 ? clampX : -clampX);
    if (keepAspectRatio) {
        if (isDiagonal) {
            if (newWidth > newHeight * aspectRatio) {
                distY = (xor(affectsX, affectsY) ? -distX : distX) / aspectRatio;
            }
            else {
                distX = (xor(affectsX, affectsY) ? -distY : distY) * aspectRatio;
            }
        }
        else {
            if (isHorizontal) {
                distY = distX / aspectRatio;
                affectsY = affectsX;
            }
            else {
                distX = distY * aspectRatio;
                affectsX = affectsY;
            }
        }
    }
    const x = affectsX ? startX + distX : startX;
    const y = affectsY ? startY + distY : startY;
    return {
        width: startWidth + (affectsX ? -distX : distX),
        height: startHeight + (affectsY ? -distY : distY),
        x: nodeOrigin[0] * distX * (!affectsX ? 1 : -1) + x,
        y: nodeOrigin[1] * distY * (!affectsY ? 1 : -1) + y,
    };
}

const initPrevValues = { width: 0, height: 0, x: 0, y: 0 };
const initStartValues = {
    ...initPrevValues,
    pointerX: 0,
    pointerY: 0,
    aspectRatio: 1,
};
function nodeToParentExtent(node) {
    return [
        [0, 0],
        [node.measured.width, node.measured.height],
    ];
}
function nodeToChildExtent(child, parent, nodeOrigin) {
    const x = parent.position.x + child.position.x;
    const y = parent.position.y + child.position.y;
    const width = child.measured.width ?? 0;
    const height = child.measured.height ?? 0;
    const originOffsetX = nodeOrigin[0] * width;
    const originOffsetY = nodeOrigin[1] * height;
    return [
        [x - originOffsetX, y - originOffsetY],
        [x + width - originOffsetX, y + height - originOffsetY],
    ];
}
function XYResizer({ domNode, nodeId, getStoreItems, onChange, onEnd }) {
    const selection = select(domNode);
    let params = {
        controlDirection: getControlDirection('bottom-right'),
        boundaries: {
            minWidth: 0,
            minHeight: 0,
            maxWidth: Number.MAX_VALUE,
            maxHeight: Number.MAX_VALUE,
        },
        resizeDirection: undefined,
        keepAspectRatio: false,
    };
    function update({ controlPosition, boundaries, keepAspectRatio, resizeDirection, onResizeStart, onResize, onResizeEnd, shouldResize, }) {
        let prevValues = { ...initPrevValues };
        let startValues = { ...initStartValues };
        params = {
            boundaries,
            resizeDirection,
            keepAspectRatio,
            controlDirection: getControlDirection(controlPosition),
        };
        let node = undefined;
        let containerBounds = null;
        let childNodes = [];
        let parentNode = undefined; // Needed to fix expandParent
        let parentExtent = undefined;
        let childExtent = undefined;
        // we only want to trigger onResizeEnd if onResize was actually called
        let resizeDetected = false;
        const dragHandler = drag()
            .on('start', (event) => {
            const { nodeLookup, transform, snapGrid, snapToGrid, nodeOrigin, paneDomNode } = getStoreItems();
            node = nodeLookup.get(nodeId);
            if (!node) {
                return;
            }
            containerBounds = paneDomNode?.getBoundingClientRect() ?? null;
            const { xSnapped, ySnapped } = getPointerPosition(event.sourceEvent, {
                transform,
                snapGrid,
                snapToGrid,
                containerBounds,
            });
            prevValues = {
                width: node.measured.width ?? 0,
                height: node.measured.height ?? 0,
                x: node.position.x ?? 0,
                y: node.position.y ?? 0,
            };
            startValues = {
                ...prevValues,
                pointerX: xSnapped,
                pointerY: ySnapped,
                aspectRatio: prevValues.width / prevValues.height,
            };
            parentNode = undefined;
            if (node.parentId && (node.extent === 'parent' || node.expandParent)) {
                parentNode = nodeLookup.get(node.parentId);
                parentExtent = parentNode && node.extent === 'parent' ? nodeToParentExtent(parentNode) : undefined;
            }
            /*
             * Collect all child nodes to correct their relative positions when top/left changes
             * Determine largest minimal extent the parent node is allowed to resize to
             */
            childNodes = [];
            childExtent = undefined;
            for (const [childId, child] of nodeLookup) {
                if (child.parentId === nodeId) {
                    childNodes.push({
                        id: childId,
                        position: { ...child.position },
                        extent: child.extent,
                    });
                    if (child.extent === 'parent' || child.expandParent) {
                        const extent = nodeToChildExtent(child, node, child.origin ?? nodeOrigin);
                        if (childExtent) {
                            childExtent = [
                                [Math.min(extent[0][0], childExtent[0][0]), Math.min(extent[0][1], childExtent[0][1])],
                                [Math.max(extent[1][0], childExtent[1][0]), Math.max(extent[1][1], childExtent[1][1])],
                            ];
                        }
                        else {
                            childExtent = extent;
                        }
                    }
                }
            }
            onResizeStart?.(event, { ...prevValues });
        })
            .on('drag', (event) => {
            const { transform, snapGrid, snapToGrid, nodeOrigin: storeNodeOrigin } = getStoreItems();
            const pointerPosition = getPointerPosition(event.sourceEvent, {
                transform,
                snapGrid,
                snapToGrid,
                containerBounds,
            });
            const childChanges = [];
            if (!node) {
                return;
            }
            const { x: prevX, y: prevY, width: prevWidth, height: prevHeight } = prevValues;
            const change = {};
            const nodeOrigin = node.origin ?? storeNodeOrigin;
            const { width, height, x, y } = getDimensionsAfterResize(startValues, params.controlDirection, pointerPosition, params.boundaries, params.keepAspectRatio, nodeOrigin, parentExtent, childExtent);
            const isWidthChange = width !== prevWidth;
            const isHeightChange = height !== prevHeight;
            const isXPosChange = x !== prevX && isWidthChange;
            const isYPosChange = y !== prevY && isHeightChange;
            if (!isXPosChange && !isYPosChange && !isWidthChange && !isHeightChange) {
                return;
            }
            if (isXPosChange || isYPosChange || nodeOrigin[0] === 1 || nodeOrigin[1] === 1) {
                change.x = isXPosChange ? x : prevValues.x;
                change.y = isYPosChange ? y : prevValues.y;
                prevValues.x = change.x;
                prevValues.y = change.y;
                /*
                 * when top/left changes, correct the relative positions of child nodes
                 * so that they stay in the same position
                 */
                if (childNodes.length > 0) {
                    const xChange = x - prevX;
                    const yChange = y - prevY;
                    for (const childNode of childNodes) {
                        childNode.position = {
                            x: childNode.position.x - xChange + nodeOrigin[0] * (width - prevWidth),
                            y: childNode.position.y - yChange + nodeOrigin[1] * (height - prevHeight),
                        };
                        childChanges.push(childNode);
                    }
                }
            }
            if (isWidthChange || isHeightChange) {
                change.width =
                    isWidthChange && (!params.resizeDirection || params.resizeDirection === 'horizontal')
                        ? width
                        : prevValues.width;
                change.height =
                    isHeightChange && (!params.resizeDirection || params.resizeDirection === 'vertical')
                        ? height
                        : prevValues.height;
                prevValues.width = change.width;
                prevValues.height = change.height;
            }
            // Fix expandParent when resizing from top/left
            if (parentNode && node.expandParent) {
                const xLimit = nodeOrigin[0] * (change.width ?? 0);
                if (change.x && change.x < xLimit) {
                    prevValues.x = xLimit;
                    startValues.x = startValues.x - (change.x - xLimit);
                }
                const yLimit = nodeOrigin[1] * (change.height ?? 0);
                if (change.y && change.y < yLimit) {
                    prevValues.y = yLimit;
                    startValues.y = startValues.y - (change.y - yLimit);
                }
            }
            const direction = getResizeDirection({
                width: prevValues.width,
                prevWidth,
                height: prevValues.height,
                prevHeight,
                affectsX: params.controlDirection.affectsX,
                affectsY: params.controlDirection.affectsY,
            });
            const nextValues = { ...prevValues, direction };
            const callResize = shouldResize?.(event, nextValues);
            if (callResize === false) {
                return;
            }
            resizeDetected = true;
            onResize?.(event, nextValues);
            onChange(change, childChanges);
        })
            .on('end', (event) => {
            if (!resizeDetected) {
                return;
            }
            onResizeEnd?.(event, { ...prevValues });
            onEnd?.({ ...prevValues });
            resizeDetected = false;
        });
        selection.call(dragHandler);
    }
    function destroy() {
        selection.on('.drag', null);
    }
    return {
        update,
        destroy,
    };
}

export { ConnectionLineType, ConnectionMode, MarkerType, PanOnScrollMode, Position, ResizeControlVariant, SelectionMode, XYDrag, XYHandle, XYMinimap, XYPanZoom, XYResizer, XY_RESIZER_HANDLE_POSITIONS, XY_RESIZER_LINE_POSITIONS, addEdge, adoptUserNodes, areConnectionMapsEqual, areSetsEqual, boxToRect, calcAutoPan, calculateNodePosition, clamp, clampPosition, clampPositionToParent, createMarkerIds, defaultAriaLabelConfig, devWarn, elementSelectionKeys, errorMessages, evaluateAbsolutePosition, fitViewport, getBezierEdgeCenter, getBezierPath, getBoundsOfBoxes, getBoundsOfRects, getConnectedEdges, getConnectionStatus, getDimensions, getEdgeCenter, getEdgePosition, getEdgeToolbarTransform, getElementsToRemove, getElevatedEdgeZIndex, getEventPosition, getHandleBounds, getHandlePosition, getHostForElement, getIncomers, getInternalNodesBounds, getMarkerId, getNodeDimensions, getNodePositionWithOrigin, getNodeToolbarTransform, getNodesBounds, getNodesInside, getOutgoers, getOverlappingArea, getPointerPosition, getSmoothStepPath, getStraightPath, getViewportForBounds, handleConnectionChange, handleExpandParent, infiniteExtent, initialConnection, isCoordinateExtent, isEdgeBase, isEdgeVisible, isInputDOMNode, isInternalNodeBase, isMacOs, isMouseEvent, isNodeBase, isNumeric, isRectObject, mergeAriaLabelConfig, nodeHasDimensions, nodeToBox, nodeToRect, oppositePosition, panBy, pointToRendererPoint, reconnectEdge, rectToBox, rendererPointToPoint, shallowNodeData, snapPosition, updateAbsolutePositions, updateConnectionLookup, updateNodeInternals, withResolvers };
