'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var React__namespace = /*#__PURE__*/_interopNamespace(React);

const isBrowser = typeof window !== "undefined";

// The "contextmenu" event is not supported as a PointerEvent in all browsers yet, so MouseEvent still need to be handled

const PanelGroupContext = React.createContext(null);
PanelGroupContext.displayName = "PanelGroupContext";

const DATA_ATTRIBUTES = {
  group: "data-panel-group",
  groupDirection: "data-panel-group-direction",
  groupId: "data-panel-group-id",
  panel: "data-panel",
  panelCollapsible: "data-panel-collapsible",
  panelId: "data-panel-id",
  panelSize: "data-panel-size",
  resizeHandle: "data-resize-handle",
  resizeHandleActive: "data-resize-handle-active",
  resizeHandleEnabled: "data-panel-resize-handle-enabled",
  resizeHandleId: "data-panel-resize-handle-id",
  resizeHandleState: "data-resize-handle-state"
};
const PRECISION = 10;

const useIsomorphicLayoutEffect = isBrowser ? React.useLayoutEffect : () => {};

const useId = React__namespace["useId".toString()];
const wrappedUseId = typeof useId === "function" ? useId : () => null;
let counter = 0;
function useUniqueId(idFromParams = null) {
  const idFromUseId = wrappedUseId();
  const idRef = React.useRef(idFromParams || idFromUseId || null);
  if (idRef.current === null) {
    idRef.current = "" + counter++;
  }
  return idFromParams !== null && idFromParams !== void 0 ? idFromParams : idRef.current;
}

function PanelWithForwardedRef({
  children,
  className: classNameFromProps = "",
  collapsedSize,
  collapsible,
  defaultSize,
  forwardedRef,
  id: idFromProps,
  maxSize,
  minSize,
  onCollapse,
  onExpand,
  onResize,
  order,
  style: styleFromProps,
  tagName: Type = "div",
  ...rest
}) {
  const context = React.useContext(PanelGroupContext);
  if (context === null) {
    throw Error(`Panel components must be rendered within a PanelGroup container`);
  }
  const {
    collapsePanel,
    expandPanel,
    getPanelSize,
    getPanelStyle,
    groupId,
    isPanelCollapsed,
    reevaluatePanelConstraints,
    registerPanel,
    resizePanel,
    unregisterPanel
  } = context;
  const panelId = useUniqueId(idFromProps);
  const panelDataRef = React.useRef({
    callbacks: {
      onCollapse,
      onExpand,
      onResize
    },
    constraints: {
      collapsedSize,
      collapsible,
      defaultSize,
      maxSize,
      minSize
    },
    id: panelId,
    idIsFromProps: idFromProps !== undefined,
    order
  });
  const devWarningsRef = React.useRef({
    didLogMissingDefaultSizeWarning: false
  });

  // Normally we wouldn't log a warning during render,
  // but effects don't run on the server, so we can't do it there
  {
    if (!devWarningsRef.current.didLogMissingDefaultSizeWarning) {
      if (!isBrowser && defaultSize == null) {
        devWarningsRef.current.didLogMissingDefaultSizeWarning = true;
        console.warn(`WARNING: Panel defaultSize prop recommended to avoid layout shift after server rendering`);
      }
    }
  }
  useIsomorphicLayoutEffect(() => {
    const {
      callbacks,
      constraints
    } = panelDataRef.current;
    const prevConstraints = {
      ...constraints
    };
    panelDataRef.current.id = panelId;
    panelDataRef.current.idIsFromProps = idFromProps !== undefined;
    panelDataRef.current.order = order;
    callbacks.onCollapse = onCollapse;
    callbacks.onExpand = onExpand;
    callbacks.onResize = onResize;
    constraints.collapsedSize = collapsedSize;
    constraints.collapsible = collapsible;
    constraints.defaultSize = defaultSize;
    constraints.maxSize = maxSize;
    constraints.minSize = minSize;

    // If constraints have changed, we should revisit panel sizes.
    // This is uncommon but may happen if people are trying to implement pixel based constraints.
    if (prevConstraints.collapsedSize !== constraints.collapsedSize || prevConstraints.collapsible !== constraints.collapsible || prevConstraints.maxSize !== constraints.maxSize || prevConstraints.minSize !== constraints.minSize) {
      reevaluatePanelConstraints(panelDataRef.current, prevConstraints);
    }
  });
  useIsomorphicLayoutEffect(() => {
    const panelData = panelDataRef.current;
    registerPanel(panelData);
    return () => {
      unregisterPanel(panelData);
    };
  }, [order, panelId, registerPanel, unregisterPanel]);
  React.useImperativeHandle(forwardedRef, () => ({
    collapse: () => {
      collapsePanel(panelDataRef.current);
    },
    expand: minSize => {
      expandPanel(panelDataRef.current, minSize);
    },
    getId() {
      return panelId;
    },
    getSize() {
      return getPanelSize(panelDataRef.current);
    },
    isCollapsed() {
      return isPanelCollapsed(panelDataRef.current);
    },
    isExpanded() {
      return !isPanelCollapsed(panelDataRef.current);
    },
    resize: size => {
      resizePanel(panelDataRef.current, size);
    }
  }), [collapsePanel, expandPanel, getPanelSize, isPanelCollapsed, panelId, resizePanel]);
  const style = getPanelStyle(panelDataRef.current, defaultSize);
  return React.createElement(Type, {
    ...rest,
    children,
    className: classNameFromProps,
    id: panelId,
    style: {
      ...style,
      ...styleFromProps
    },
    // CSS selectors
    [DATA_ATTRIBUTES.groupId]: groupId,
    [DATA_ATTRIBUTES.panel]: "",
    [DATA_ATTRIBUTES.panelCollapsible]: collapsible || undefined,
    [DATA_ATTRIBUTES.panelId]: panelId,
    [DATA_ATTRIBUTES.panelSize]: parseFloat("" + style.flexGrow).toFixed(1)
  });
}
const Panel = React.forwardRef((props, ref) => React.createElement(PanelWithForwardedRef, {
  ...props,
  forwardedRef: ref
}));
PanelWithForwardedRef.displayName = "Panel";
Panel.displayName = "forwardRef(Panel)";

let nonce;
function getNonce() {
  return nonce;
}
function setNonce(value) {
  nonce = value;
}

let currentCursorStyle = null;
let enabled = true;
let prevRuleIndex = -1;
let styleElement = null;
function disableGlobalCursorStyles() {
  enabled = false;
}
function enableGlobalCursorStyles() {
  enabled = true;
}
function getCursorStyle(state, constraintFlags) {
  if (constraintFlags) {
    const horizontalMin = (constraintFlags & EXCEEDED_HORIZONTAL_MIN) !== 0;
    const horizontalMax = (constraintFlags & EXCEEDED_HORIZONTAL_MAX) !== 0;
    const verticalMin = (constraintFlags & EXCEEDED_VERTICAL_MIN) !== 0;
    const verticalMax = (constraintFlags & EXCEEDED_VERTICAL_MAX) !== 0;
    if (horizontalMin) {
      if (verticalMin) {
        return "se-resize";
      } else if (verticalMax) {
        return "ne-resize";
      } else {
        return "e-resize";
      }
    } else if (horizontalMax) {
      if (verticalMin) {
        return "sw-resize";
      } else if (verticalMax) {
        return "nw-resize";
      } else {
        return "w-resize";
      }
    } else if (verticalMin) {
      return "s-resize";
    } else if (verticalMax) {
      return "n-resize";
    }
  }
  switch (state) {
    case "horizontal":
      return "ew-resize";
    case "intersection":
      return "move";
    case "vertical":
      return "ns-resize";
  }
}
function resetGlobalCursorStyle() {
  if (styleElement !== null) {
    document.head.removeChild(styleElement);
    currentCursorStyle = null;
    styleElement = null;
    prevRuleIndex = -1;
  }
}
function setGlobalCursorStyle(state, constraintFlags) {
  var _styleElement$sheet$i, _styleElement$sheet2;
  if (!enabled) {
    return;
  }
  const style = getCursorStyle(state, constraintFlags);
  if (currentCursorStyle === style) {
    return;
  }
  currentCursorStyle = style;
  if (styleElement === null) {
    styleElement = document.createElement("style");
    const nonce = getNonce();
    if (nonce) {
      styleElement.setAttribute("nonce", nonce);
    }
    document.head.appendChild(styleElement);
  }
  if (prevRuleIndex >= 0) {
    var _styleElement$sheet;
    (_styleElement$sheet = styleElement.sheet) === null || _styleElement$sheet === void 0 ? void 0 : _styleElement$sheet.removeRule(prevRuleIndex);
  }
  prevRuleIndex = (_styleElement$sheet$i = (_styleElement$sheet2 = styleElement.sheet) === null || _styleElement$sheet2 === void 0 ? void 0 : _styleElement$sheet2.insertRule(`*{cursor: ${style} !important;}`)) !== null && _styleElement$sheet$i !== void 0 ? _styleElement$sheet$i : -1;
}

function isKeyDown(event) {
  return event.type === "keydown";
}
function isPointerEvent(event) {
  return event.type.startsWith("pointer");
}
function isMouseEvent(event) {
  return event.type.startsWith("mouse");
}

function getResizeEventCoordinates(event) {
  if (isPointerEvent(event)) {
    if (event.isPrimary) {
      return {
        x: event.clientX,
        y: event.clientY
      };
    }
  } else if (isMouseEvent(event)) {
    return {
      x: event.clientX,
      y: event.clientY
    };
  }
  return {
    x: Infinity,
    y: Infinity
  };
}

function getInputType() {
  if (typeof matchMedia === "function") {
    return matchMedia("(pointer:coarse)").matches ? "coarse" : "fine";
  }
}

function intersects(rectOne, rectTwo, strict) {
  if (strict) {
    return rectOne.x < rectTwo.x + rectTwo.width && rectOne.x + rectOne.width > rectTwo.x && rectOne.y < rectTwo.y + rectTwo.height && rectOne.y + rectOne.height > rectTwo.y;
  } else {
    return rectOne.x <= rectTwo.x + rectTwo.width && rectOne.x + rectOne.width >= rectTwo.x && rectOne.y <= rectTwo.y + rectTwo.height && rectOne.y + rectOne.height >= rectTwo.y;
  }
}

// Forked from NPM stacking-order@2.0.0

/**
 * Determine which of two nodes appears in front of the other —
 * if `a` is in front, returns 1, otherwise returns -1
 * @param {HTMLElement | SVGElement} a
 * @param {HTMLElement | SVGElement} b
 */
function compare(a, b) {
  if (a === b) throw new Error("Cannot compare node with itself");
  const ancestors = {
    a: get_ancestors(a),
    b: get_ancestors(b)
  };
  let common_ancestor;

  // remove shared ancestors
  while (ancestors.a.at(-1) === ancestors.b.at(-1)) {
    a = ancestors.a.pop();
    b = ancestors.b.pop();
    common_ancestor = a;
  }
  assert(common_ancestor, "Stacking order can only be calculated for elements with a common ancestor");
  const z_indexes = {
    a: get_z_index(find_stacking_context(ancestors.a)),
    b: get_z_index(find_stacking_context(ancestors.b))
  };
  if (z_indexes.a === z_indexes.b) {
    const children = common_ancestor.childNodes;
    const furthest_ancestors = {
      a: ancestors.a.at(-1),
      b: ancestors.b.at(-1)
    };
    let i = children.length;
    while (i--) {
      const child = children[i];
      if (child === furthest_ancestors.a) return 1;
      if (child === furthest_ancestors.b) return -1;
    }
  }
  return Math.sign(z_indexes.a - z_indexes.b);
}
const props = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;

/** @param {HTMLElement | SVGElement} node */
function is_flex_item(node) {
  var _get_parent;
  // @ts-ignore
  const display = getComputedStyle((_get_parent = get_parent(node)) !== null && _get_parent !== void 0 ? _get_parent : node).display;
  return display === "flex" || display === "inline-flex";
}

/** @param {HTMLElement | SVGElement} node */
function creates_stacking_context(node) {
  const style = getComputedStyle(node);

  // https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z_index/The_stacking_context
  if (style.position === "fixed") return true;
  // Forked to fix upstream bug https://github.com/Rich-Harris/stacking-order/issues/3
  // if (
  //   (style.zIndex !== "auto" && style.position !== "static") ||
  //   is_flex_item(node)
  // )
  if (style.zIndex !== "auto" && (style.position !== "static" || is_flex_item(node))) return true;
  if (+style.opacity < 1) return true;
  if ("transform" in style && style.transform !== "none") return true;
  if ("webkitTransform" in style && style.webkitTransform !== "none") return true;
  if ("mixBlendMode" in style && style.mixBlendMode !== "normal") return true;
  if ("filter" in style && style.filter !== "none") return true;
  if ("webkitFilter" in style && style.webkitFilter !== "none") return true;
  if ("isolation" in style && style.isolation === "isolate") return true;
  if (props.test(style.willChange)) return true;
  // @ts-expect-error
  if (style.webkitOverflowScrolling === "touch") return true;
  return false;
}

/** @param {(HTMLElement| SVGElement)[]} nodes */
function find_stacking_context(nodes) {
  let i = nodes.length;
  while (i--) {
    const node = nodes[i];
    assert(node, "Missing node");
    if (creates_stacking_context(node)) return node;
  }
  return null;
}

/** @param {HTMLElement | SVGElement} node */
function get_z_index(node) {
  return node && Number(getComputedStyle(node).zIndex) || 0;
}

/** @param {HTMLElement} node */
function get_ancestors(node) {
  const ancestors = [];
  while (node) {
    ancestors.push(node);
    // @ts-ignore
    node = get_parent(node);
  }
  return ancestors; // [ node, ... <body>, <html>, document ]
}

/** @param {HTMLElement} node */
function get_parent(node) {
  const {
    parentNode
  } = node;
  if (parentNode && parentNode instanceof ShadowRoot) {
    return parentNode.host;
  }
  return parentNode;
}

const EXCEEDED_HORIZONTAL_MIN = 0b0001;
const EXCEEDED_HORIZONTAL_MAX = 0b0010;
const EXCEEDED_VERTICAL_MIN = 0b0100;
const EXCEEDED_VERTICAL_MAX = 0b1000;
const isCoarsePointer = getInputType() === "coarse";
let intersectingHandles = [];
let isPointerDown = false;
let ownerDocumentCounts = new Map();
let panelConstraintFlags = new Map();
const registeredResizeHandlers = new Set();
function registerResizeHandle(resizeHandleId, element, direction, hitAreaMargins, setResizeHandlerState) {
  var _ownerDocumentCounts$;
  const {
    ownerDocument
  } = element;
  const data = {
    direction,
    element,
    hitAreaMargins,
    setResizeHandlerState
  };
  const count = (_ownerDocumentCounts$ = ownerDocumentCounts.get(ownerDocument)) !== null && _ownerDocumentCounts$ !== void 0 ? _ownerDocumentCounts$ : 0;
  ownerDocumentCounts.set(ownerDocument, count + 1);
  registeredResizeHandlers.add(data);
  updateListeners();
  return function unregisterResizeHandle() {
    var _ownerDocumentCounts$2;
    panelConstraintFlags.delete(resizeHandleId);
    registeredResizeHandlers.delete(data);
    const count = (_ownerDocumentCounts$2 = ownerDocumentCounts.get(ownerDocument)) !== null && _ownerDocumentCounts$2 !== void 0 ? _ownerDocumentCounts$2 : 1;
    ownerDocumentCounts.set(ownerDocument, count - 1);
    updateListeners();
    if (count === 1) {
      ownerDocumentCounts.delete(ownerDocument);
    }

    // If the resize handle that is currently unmounting is intersecting with the pointer,
    // update the global pointer to account for the change
    if (intersectingHandles.includes(data)) {
      const index = intersectingHandles.indexOf(data);
      if (index >= 0) {
        intersectingHandles.splice(index, 1);
      }
      updateCursor();

      // Also instruct the handle to stop dragging; this prevents the parent group from being left in an inconsistent state
      // See github.com/bvaughn/react-resizable-panels/issues/402
      setResizeHandlerState("up", true, null);
    }
  };
}
function handlePointerDown(event) {
  const {
    target
  } = event;
  const {
    x,
    y
  } = getResizeEventCoordinates(event);
  isPointerDown = true;
  recalculateIntersectingHandles({
    target,
    x,
    y
  });
  updateListeners();
  if (intersectingHandles.length > 0) {
    updateResizeHandlerStates("down", event);
    event.preventDefault();
    if (!isWithinResizeHandle(target)) {
      event.stopImmediatePropagation();
    }
  }
}
function handlePointerMove(event) {
  const {
    x,
    y
  } = getResizeEventCoordinates(event);

  // Edge case (see #340)
  // Detect when the pointer has been released outside an iframe on a different domain
  if (isPointerDown && event.buttons === 0) {
    isPointerDown = false;
    updateResizeHandlerStates("up", event);
  }
  if (!isPointerDown) {
    const {
      target
    } = event;

    // Recalculate intersecting handles whenever the pointer moves, except if it has already been pressed
    // at that point, the handles may not move with the pointer (depending on constraints)
    // but the same set of active handles should be locked until the pointer is released
    recalculateIntersectingHandles({
      target,
      x,
      y
    });
  }
  updateResizeHandlerStates("move", event);

  // Update cursor based on return value(s) from active handles
  updateCursor();
  if (intersectingHandles.length > 0) {
    event.preventDefault();
  }
}
function handlePointerUp(event) {
  const {
    target
  } = event;
  const {
    x,
    y
  } = getResizeEventCoordinates(event);
  panelConstraintFlags.clear();
  isPointerDown = false;
  if (intersectingHandles.length > 0) {
    event.preventDefault();
    if (!isWithinResizeHandle(target)) {
      event.stopImmediatePropagation();
    }
  }
  updateResizeHandlerStates("up", event);
  recalculateIntersectingHandles({
    target,
    x,
    y
  });
  updateCursor();
  updateListeners();
}
function isWithinResizeHandle(element) {
  let currentElement = element;
  while (currentElement) {
    if (currentElement.hasAttribute(DATA_ATTRIBUTES.resizeHandle)) {
      return true;
    }
    currentElement = currentElement.parentElement;
  }
  return false;
}
function recalculateIntersectingHandles({
  target,
  x,
  y
}) {
  intersectingHandles.splice(0);
  let targetElement = null;
  if (target instanceof HTMLElement || target instanceof SVGElement) {
    targetElement = target;
  }
  registeredResizeHandlers.forEach(data => {
    const {
      element: dragHandleElement,
      hitAreaMargins
    } = data;
    const dragHandleRect = dragHandleElement.getBoundingClientRect();
    const {
      bottom,
      left,
      right,
      top
    } = dragHandleRect;
    const margin = isCoarsePointer ? hitAreaMargins.coarse : hitAreaMargins.fine;
    const eventIntersects = x >= left - margin && x <= right + margin && y >= top - margin && y <= bottom + margin;
    if (eventIntersects) {
      // TRICKY
      // We listen for pointers events at the root in order to support hit area margins
      // (determining when the pointer is close enough to an element to be considered a "hit")
      // Clicking on an element "above" a handle (e.g. a modal) should prevent a hit though
      // so at this point we need to compare stacking order of a potentially intersecting drag handle,
      // and the element that was actually clicked/touched
      if (targetElement !== null && document.contains(targetElement) && dragHandleElement !== targetElement && !dragHandleElement.contains(targetElement) && !targetElement.contains(dragHandleElement) &&
      // Calculating stacking order has a cost, so we should avoid it if possible
      // That is why we only check potentially intersecting handles,
      // and why we skip if the event target is within the handle's DOM
      compare(targetElement, dragHandleElement) > 0) {
        // If the target is above the drag handle, then we also need to confirm they overlap
        // If they are beside each other (e.g. a panel and its drag handle) then the handle is still interactive
        //
        // It's not enough to compare only the target
        // The target might be a small element inside of a larger container
        // (For example, a SPAN or a DIV inside of a larger modal dialog)
        let currentElement = targetElement;
        let didIntersect = false;
        while (currentElement) {
          if (currentElement.contains(dragHandleElement)) {
            break;
          } else if (intersects(currentElement.getBoundingClientRect(), dragHandleRect, true)) {
            didIntersect = true;
            break;
          }
          currentElement = currentElement.parentElement;
        }
        if (didIntersect) {
          return;
        }
      }
      intersectingHandles.push(data);
    }
  });
}
function reportConstraintsViolation(resizeHandleId, flag) {
  panelConstraintFlags.set(resizeHandleId, flag);
}
function updateCursor() {
  let intersectsHorizontal = false;
  let intersectsVertical = false;
  intersectingHandles.forEach(data => {
    const {
      direction
    } = data;
    if (direction === "horizontal") {
      intersectsHorizontal = true;
    } else {
      intersectsVertical = true;
    }
  });
  let constraintFlags = 0;
  panelConstraintFlags.forEach(flag => {
    constraintFlags |= flag;
  });
  if (intersectsHorizontal && intersectsVertical) {
    setGlobalCursorStyle("intersection", constraintFlags);
  } else if (intersectsHorizontal) {
    setGlobalCursorStyle("horizontal", constraintFlags);
  } else if (intersectsVertical) {
    setGlobalCursorStyle("vertical", constraintFlags);
  } else {
    resetGlobalCursorStyle();
  }
}
let listenersAbortController = new AbortController();
function updateListeners() {
  listenersAbortController.abort();
  listenersAbortController = new AbortController();
  const options = {
    capture: true,
    signal: listenersAbortController.signal
  };
  if (!registeredResizeHandlers.size) {
    return;
  }
  if (isPointerDown) {
    if (intersectingHandles.length > 0) {
      ownerDocumentCounts.forEach((count, ownerDocument) => {
        const {
          body
        } = ownerDocument;
        if (count > 0) {
          body.addEventListener("contextmenu", handlePointerUp, options);
          body.addEventListener("pointerleave", handlePointerMove, options);
          body.addEventListener("pointermove", handlePointerMove, options);
        }
      });
    }
    window.addEventListener("pointerup", handlePointerUp, options);
    window.addEventListener("pointercancel", handlePointerUp, options);
  } else {
    ownerDocumentCounts.forEach((count, ownerDocument) => {
      const {
        body
      } = ownerDocument;
      if (count > 0) {
        body.addEventListener("pointerdown", handlePointerDown, options);
        body.addEventListener("pointermove", handlePointerMove, options);
      }
    });
  }
}
function updateResizeHandlerStates(action, event) {
  registeredResizeHandlers.forEach(data => {
    const {
      setResizeHandlerState
    } = data;
    const isActive = intersectingHandles.includes(data);
    setResizeHandlerState(action, isActive, event);
  });
}

function useForceUpdate() {
  const [_, setCount] = React.useState(0);
  return React.useCallback(() => setCount(prevCount => prevCount + 1), []);
}

function assert(expectedCondition, message) {
  if (!expectedCondition) {
    console.error(message);
    throw Error(message);
  }
}

function fuzzyCompareNumbers(actual, expected, fractionDigits = PRECISION) {
  if (actual.toFixed(fractionDigits) === expected.toFixed(fractionDigits)) {
    return 0;
  } else {
    return actual > expected ? 1 : -1;
  }
}
function fuzzyNumbersEqual$1(actual, expected, fractionDigits = PRECISION) {
  return fuzzyCompareNumbers(actual, expected, fractionDigits) === 0;
}

function fuzzyNumbersEqual(actual, expected, fractionDigits) {
  return fuzzyCompareNumbers(actual, expected, fractionDigits) === 0;
}

function fuzzyLayoutsEqual(actual, expected, fractionDigits) {
  if (actual.length !== expected.length) {
    return false;
  }
  for (let index = 0; index < actual.length; index++) {
    const actualSize = actual[index];
    const expectedSize = expected[index];
    if (!fuzzyNumbersEqual(actualSize, expectedSize, fractionDigits)) {
      return false;
    }
  }
  return true;
}

// Panel size must be in percentages; pixel values should be pre-converted
function resizePanel({
  panelConstraints: panelConstraintsArray,
  panelIndex,
  size
}) {
  const panelConstraints = panelConstraintsArray[panelIndex];
  assert(panelConstraints != null, `Panel constraints not found for index ${panelIndex}`);
  let {
    collapsedSize = 0,
    collapsible,
    maxSize = 100,
    minSize = 0
  } = panelConstraints;
  if (fuzzyCompareNumbers(size, minSize) < 0) {
    if (collapsible) {
      // Collapsible panels should snap closed or open only once they cross the halfway point between collapsed and min size.
      const halfwayPoint = (collapsedSize + minSize) / 2;
      if (fuzzyCompareNumbers(size, halfwayPoint) < 0) {
        size = collapsedSize;
      } else {
        size = minSize;
      }
    } else {
      size = minSize;
    }
  }
  size = Math.min(maxSize, size);
  size = parseFloat(size.toFixed(PRECISION));
  return size;
}

// All units must be in percentages; pixel values should be pre-converted
function adjustLayoutByDelta({
  delta,
  initialLayout,
  panelConstraints: panelConstraintsArray,
  pivotIndices,
  prevLayout,
  trigger
}) {
  if (fuzzyNumbersEqual(delta, 0)) {
    return initialLayout;
  }
  const nextLayout = [...initialLayout];
  const [firstPivotIndex, secondPivotIndex] = pivotIndices;
  assert(firstPivotIndex != null, "Invalid first pivot index");
  assert(secondPivotIndex != null, "Invalid second pivot index");
  let deltaApplied = 0;

  // const DEBUG = [];
  // DEBUG.push(`adjustLayoutByDelta()`);
  // DEBUG.push(`  initialLayout: ${initialLayout.join(", ")}`);
  // DEBUG.push(`  prevLayout: ${prevLayout.join(", ")}`);
  // DEBUG.push(`  delta: ${delta}`);
  // DEBUG.push(`  pivotIndices: ${pivotIndices.join(", ")}`);
  // DEBUG.push(`  trigger: ${trigger}`);
  // DEBUG.push("");

  // A resizing panel affects the panels before or after it.
  //
  // A negative delta means the panel(s) immediately after the resize handle should grow/expand by decreasing its offset.
  // Other panels may also need to shrink/contract (and shift) to make room, depending on the min weights.
  //
  // A positive delta means the panel(s) immediately before the resize handle should "expand".
  // This is accomplished by shrinking/contracting (and shifting) one or more of the panels after the resize handle.

  {
    // If this is a resize triggered by a keyboard event, our logic for expanding/collapsing is different.
    // We no longer check the halfway threshold because this may prevent the panel from expanding at all.
    if (trigger === "keyboard") {
      {
        // Check if we should expand a collapsed panel
        const index = delta < 0 ? secondPivotIndex : firstPivotIndex;
        const panelConstraints = panelConstraintsArray[index];
        assert(panelConstraints, `Panel constraints not found for index ${index}`);
        const {
          collapsedSize = 0,
          collapsible,
          minSize = 0
        } = panelConstraints;

        // DEBUG.push(`edge case check 1: ${index}`);
        // DEBUG.push(`  -> collapsible? ${collapsible}`);
        if (collapsible) {
          const prevSize = initialLayout[index];
          assert(prevSize != null, `Previous layout not found for panel index ${index}`);
          if (fuzzyNumbersEqual(prevSize, collapsedSize)) {
            const localDelta = minSize - prevSize;
            // DEBUG.push(`  -> expand delta: ${localDelta}`);

            if (fuzzyCompareNumbers(localDelta, Math.abs(delta)) > 0) {
              delta = delta < 0 ? 0 - localDelta : localDelta;
              // DEBUG.push(`  -> delta: ${delta}`);
            }
          }
        }
      }

      {
        // Check if we should collapse a panel at its minimum size
        const index = delta < 0 ? firstPivotIndex : secondPivotIndex;
        const panelConstraints = panelConstraintsArray[index];
        assert(panelConstraints, `No panel constraints found for index ${index}`);
        const {
          collapsedSize = 0,
          collapsible,
          minSize = 0
        } = panelConstraints;

        // DEBUG.push(`edge case check 2: ${index}`);
        // DEBUG.push(`  -> collapsible? ${collapsible}`);
        if (collapsible) {
          const prevSize = initialLayout[index];
          assert(prevSize != null, `Previous layout not found for panel index ${index}`);
          if (fuzzyNumbersEqual(prevSize, minSize)) {
            const localDelta = prevSize - collapsedSize;
            // DEBUG.push(`  -> expand delta: ${localDelta}`);

            if (fuzzyCompareNumbers(localDelta, Math.abs(delta)) > 0) {
              delta = delta < 0 ? 0 - localDelta : localDelta;
              // DEBUG.push(`  -> delta: ${delta}`);
            }
          }
        }
      }
    }
    // DEBUG.push("");
  }

  {
    // Pre-calculate max available delta in the opposite direction of our pivot.
    // This will be the maximum amount we're allowed to expand/contract the panels in the primary direction.
    // If this amount is less than the requested delta, adjust the requested delta.
    // If this amount is greater than the requested delta, that's useful information too–
    // as an expanding panel might change from collapsed to min size.

    const increment = delta < 0 ? 1 : -1;
    let index = delta < 0 ? secondPivotIndex : firstPivotIndex;
    let maxAvailableDelta = 0;

    // DEBUG.push("pre calc...");
    while (true) {
      const prevSize = initialLayout[index];
      assert(prevSize != null, `Previous layout not found for panel index ${index}`);
      const maxSafeSize = resizePanel({
        panelConstraints: panelConstraintsArray,
        panelIndex: index,
        size: 100
      });
      const delta = maxSafeSize - prevSize;
      // DEBUG.push(`  ${index}: ${prevSize} -> ${maxSafeSize}`);

      maxAvailableDelta += delta;
      index += increment;
      if (index < 0 || index >= panelConstraintsArray.length) {
        break;
      }
    }

    // DEBUG.push(`  -> max available delta: ${maxAvailableDelta}`);
    const minAbsDelta = Math.min(Math.abs(delta), Math.abs(maxAvailableDelta));
    delta = delta < 0 ? 0 - minAbsDelta : minAbsDelta;
    // DEBUG.push(`  -> adjusted delta: ${delta}`);
    // DEBUG.push("");
  }

  {
    // Delta added to a panel needs to be subtracted from other panels (within the constraints that those panels allow).

    const pivotIndex = delta < 0 ? firstPivotIndex : secondPivotIndex;
    let index = pivotIndex;
    while (index >= 0 && index < panelConstraintsArray.length) {
      const deltaRemaining = Math.abs(delta) - Math.abs(deltaApplied);
      const prevSize = initialLayout[index];
      assert(prevSize != null, `Previous layout not found for panel index ${index}`);
      const unsafeSize = prevSize - deltaRemaining;
      const safeSize = resizePanel({
        panelConstraints: panelConstraintsArray,
        panelIndex: index,
        size: unsafeSize
      });
      if (!fuzzyNumbersEqual(prevSize, safeSize)) {
        deltaApplied += prevSize - safeSize;
        nextLayout[index] = safeSize;
        if (deltaApplied.toPrecision(3).localeCompare(Math.abs(delta).toPrecision(3), undefined, {
          numeric: true
        }) >= 0) {
          break;
        }
      }
      if (delta < 0) {
        index--;
      } else {
        index++;
      }
    }
  }
  // DEBUG.push(`after 1: ${nextLayout.join(", ")}`);
  // DEBUG.push(`  deltaApplied: ${deltaApplied}`);
  // DEBUG.push("");

  // If we were unable to resize any of the panels panels, return the previous state.
  // This will essentially bailout and ignore e.g. drags past a panel's boundaries
  if (fuzzyLayoutsEqual(prevLayout, nextLayout)) {
    // DEBUG.push(`bailout to previous layout: ${prevLayout.join(", ")}`);
    // console.log(DEBUG.join("\n"));

    return prevLayout;
  }
  {
    // Now distribute the applied delta to the panels in the other direction
    const pivotIndex = delta < 0 ? secondPivotIndex : firstPivotIndex;
    const prevSize = initialLayout[pivotIndex];
    assert(prevSize != null, `Previous layout not found for panel index ${pivotIndex}`);
    const unsafeSize = prevSize + deltaApplied;
    const safeSize = resizePanel({
      panelConstraints: panelConstraintsArray,
      panelIndex: pivotIndex,
      size: unsafeSize
    });

    // Adjust the pivot panel before, but only by the amount that surrounding panels were able to shrink/contract.
    nextLayout[pivotIndex] = safeSize;

    // Edge case where expanding or contracting one panel caused another one to change collapsed state
    if (!fuzzyNumbersEqual(safeSize, unsafeSize)) {
      let deltaRemaining = unsafeSize - safeSize;
      const pivotIndex = delta < 0 ? secondPivotIndex : firstPivotIndex;
      let index = pivotIndex;
      while (index >= 0 && index < panelConstraintsArray.length) {
        const prevSize = nextLayout[index];
        assert(prevSize != null, `Previous layout not found for panel index ${index}`);
        const unsafeSize = prevSize + deltaRemaining;
        const safeSize = resizePanel({
          panelConstraints: panelConstraintsArray,
          panelIndex: index,
          size: unsafeSize
        });
        if (!fuzzyNumbersEqual(prevSize, safeSize)) {
          deltaRemaining -= safeSize - prevSize;
          nextLayout[index] = safeSize;
        }
        if (fuzzyNumbersEqual(deltaRemaining, 0)) {
          break;
        }
        if (delta > 0) {
          index--;
        } else {
          index++;
        }
      }
    }
  }
  // DEBUG.push(`after 2: ${nextLayout.join(", ")}`);
  // DEBUG.push(`  deltaApplied: ${deltaApplied}`);
  // DEBUG.push("");

  const totalSize = nextLayout.reduce((total, size) => size + total, 0);
  // DEBUG.push(`total size: ${totalSize}`);

  // If our new layout doesn't add up to 100%, that means the requested delta can't be applied
  // In that case, fall back to our most recent valid layout
  if (!fuzzyNumbersEqual(totalSize, 100)) {
    // DEBUG.push(`bailout to previous layout: ${prevLayout.join(", ")}`);
    // console.log(DEBUG.join("\n"));

    return prevLayout;
  }

  // console.log(DEBUG.join("\n"));
  return nextLayout;
}

function calculateAriaValues({
  layout,
  panelsArray,
  pivotIndices
}) {
  let currentMinSize = 0;
  let currentMaxSize = 100;
  let totalMinSize = 0;
  let totalMaxSize = 0;
  const firstIndex = pivotIndices[0];
  assert(firstIndex != null, "No pivot index found");

  // A panel's effective min/max sizes also need to account for other panel's sizes.
  panelsArray.forEach((panelData, index) => {
    const {
      constraints
    } = panelData;
    const {
      maxSize = 100,
      minSize = 0
    } = constraints;
    if (index === firstIndex) {
      currentMinSize = minSize;
      currentMaxSize = maxSize;
    } else {
      totalMinSize += minSize;
      totalMaxSize += maxSize;
    }
  });
  const valueMax = Math.min(currentMaxSize, 100 - totalMinSize);
  const valueMin = Math.max(currentMinSize, 100 - totalMaxSize);
  const valueNow = layout[firstIndex];
  return {
    valueMax,
    valueMin,
    valueNow
  };
}

function getResizeHandleElementsForGroup(groupId, scope = document) {
  return Array.from(scope.querySelectorAll(`[${DATA_ATTRIBUTES.resizeHandleId}][data-panel-group-id="${groupId}"]`));
}

function getResizeHandleElementIndex(groupId, id, scope = document) {
  const handles = getResizeHandleElementsForGroup(groupId, scope);
  const index = handles.findIndex(handle => handle.getAttribute(DATA_ATTRIBUTES.resizeHandleId) === id);
  return index !== null && index !== void 0 ? index : null;
}

function determinePivotIndices(groupId, dragHandleId, panelGroupElement) {
  const index = getResizeHandleElementIndex(groupId, dragHandleId, panelGroupElement);
  return index != null ? [index, index + 1] : [-1, -1];
}

function getPanelGroupElement(id, rootElement = document) {
  var _dataset;
  //If the root element is the PanelGroup
  if (rootElement instanceof HTMLElement && (rootElement === null || rootElement === void 0 ? void 0 : (_dataset = rootElement.dataset) === null || _dataset === void 0 ? void 0 : _dataset.panelGroupId) == id) {
    return rootElement;
  }

  //Else query children
  const element = rootElement.querySelector(`[data-panel-group][data-panel-group-id="${id}"]`);
  if (element) {
    return element;
  }
  return null;
}

function getResizeHandleElement(id, scope = document) {
  const element = scope.querySelector(`[${DATA_ATTRIBUTES.resizeHandleId}="${id}"]`);
  if (element) {
    return element;
  }
  return null;
}

function getResizeHandlePanelIds(groupId, handleId, panelsArray, scope = document) {
  var _panelsArray$index$id, _panelsArray$index, _panelsArray$id, _panelsArray;
  const handle = getResizeHandleElement(handleId, scope);
  const handles = getResizeHandleElementsForGroup(groupId, scope);
  const index = handle ? handles.indexOf(handle) : -1;
  const idBefore = (_panelsArray$index$id = (_panelsArray$index = panelsArray[index]) === null || _panelsArray$index === void 0 ? void 0 : _panelsArray$index.id) !== null && _panelsArray$index$id !== void 0 ? _panelsArray$index$id : null;
  const idAfter = (_panelsArray$id = (_panelsArray = panelsArray[index + 1]) === null || _panelsArray === void 0 ? void 0 : _panelsArray.id) !== null && _panelsArray$id !== void 0 ? _panelsArray$id : null;
  return [idBefore, idAfter];
}

// https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/

function useWindowSplitterPanelGroupBehavior({
  committedValuesRef,
  eagerValuesRef,
  groupId,
  layout,
  panelDataArray,
  panelGroupElement,
  setLayout
}) {
  const devWarningsRef = React.useRef({
    didWarnAboutMissingResizeHandle: false
  });
  useIsomorphicLayoutEffect(() => {
    if (!panelGroupElement) {
      return;
    }
    const resizeHandleElements = getResizeHandleElementsForGroup(groupId, panelGroupElement);
    for (let index = 0; index < panelDataArray.length - 1; index++) {
      const {
        valueMax,
        valueMin,
        valueNow
      } = calculateAriaValues({
        layout,
        panelsArray: panelDataArray,
        pivotIndices: [index, index + 1]
      });
      const resizeHandleElement = resizeHandleElements[index];
      if (resizeHandleElement == null) {
        {
          const {
            didWarnAboutMissingResizeHandle
          } = devWarningsRef.current;
          if (!didWarnAboutMissingResizeHandle) {
            devWarningsRef.current.didWarnAboutMissingResizeHandle = true;
            console.warn(`WARNING: Missing resize handle for PanelGroup "${groupId}"`);
          }
        }
      } else {
        const panelData = panelDataArray[index];
        assert(panelData, `No panel data found for index "${index}"`);
        resizeHandleElement.setAttribute("aria-controls", panelData.id);
        resizeHandleElement.setAttribute("aria-valuemax", "" + Math.round(valueMax));
        resizeHandleElement.setAttribute("aria-valuemin", "" + Math.round(valueMin));
        resizeHandleElement.setAttribute("aria-valuenow", valueNow != null ? "" + Math.round(valueNow) : "");
      }
    }
    return () => {
      resizeHandleElements.forEach((resizeHandleElement, index) => {
        resizeHandleElement.removeAttribute("aria-controls");
        resizeHandleElement.removeAttribute("aria-valuemax");
        resizeHandleElement.removeAttribute("aria-valuemin");
        resizeHandleElement.removeAttribute("aria-valuenow");
      });
    };
  }, [groupId, layout, panelDataArray, panelGroupElement]);
  React.useEffect(() => {
    if (!panelGroupElement) {
      return;
    }
    const eagerValues = eagerValuesRef.current;
    assert(eagerValues, `Eager values not found`);
    const {
      panelDataArray
    } = eagerValues;
    const groupElement = getPanelGroupElement(groupId, panelGroupElement);
    assert(groupElement != null, `No group found for id "${groupId}"`);
    const handles = getResizeHandleElementsForGroup(groupId, panelGroupElement);
    assert(handles, `No resize handles found for group id "${groupId}"`);
    const cleanupFunctions = handles.map(handle => {
      const handleId = handle.getAttribute(DATA_ATTRIBUTES.resizeHandleId);
      assert(handleId, `Resize handle element has no handle id attribute`);
      const [idBefore, idAfter] = getResizeHandlePanelIds(groupId, handleId, panelDataArray, panelGroupElement);
      if (idBefore == null || idAfter == null) {
        return () => {};
      }
      const onKeyDown = event => {
        if (event.defaultPrevented) {
          return;
        }
        switch (event.key) {
          case "Enter":
            {
              event.preventDefault();
              const index = panelDataArray.findIndex(panelData => panelData.id === idBefore);
              if (index >= 0) {
                const panelData = panelDataArray[index];
                assert(panelData, `No panel data found for index ${index}`);
                const size = layout[index];
                const {
                  collapsedSize = 0,
                  collapsible,
                  minSize = 0
                } = panelData.constraints;
                if (size != null && collapsible) {
                  const nextLayout = adjustLayoutByDelta({
                    delta: fuzzyNumbersEqual(size, collapsedSize) ? minSize - collapsedSize : collapsedSize - size,
                    initialLayout: layout,
                    panelConstraints: panelDataArray.map(panelData => panelData.constraints),
                    pivotIndices: determinePivotIndices(groupId, handleId, panelGroupElement),
                    prevLayout: layout,
                    trigger: "keyboard"
                  });
                  if (layout !== nextLayout) {
                    setLayout(nextLayout);
                  }
                }
              }
              break;
            }
        }
      };
      handle.addEventListener("keydown", onKeyDown);
      return () => {
        handle.removeEventListener("keydown", onKeyDown);
      };
    });
    return () => {
      cleanupFunctions.forEach(cleanupFunction => cleanupFunction());
    };
  }, [panelGroupElement, committedValuesRef, eagerValuesRef, groupId, layout, panelDataArray, setLayout]);
}

function areEqual(arrayA, arrayB) {
  if (arrayA.length !== arrayB.length) {
    return false;
  }
  for (let index = 0; index < arrayA.length; index++) {
    if (arrayA[index] !== arrayB[index]) {
      return false;
    }
  }
  return true;
}

function getResizeEventCursorPosition(direction, event) {
  const isHorizontal = direction === "horizontal";
  const {
    x,
    y
  } = getResizeEventCoordinates(event);
  return isHorizontal ? x : y;
}

function calculateDragOffsetPercentage(event, dragHandleId, direction, initialDragState, panelGroupElement) {
  const isHorizontal = direction === "horizontal";
  const handleElement = getResizeHandleElement(dragHandleId, panelGroupElement);
  assert(handleElement, `No resize handle element found for id "${dragHandleId}"`);
  const groupId = handleElement.getAttribute(DATA_ATTRIBUTES.groupId);
  assert(groupId, `Resize handle element has no group id attribute`);
  let {
    initialCursorPosition
  } = initialDragState;
  const cursorPosition = getResizeEventCursorPosition(direction, event);
  const groupElement = getPanelGroupElement(groupId, panelGroupElement);
  assert(groupElement, `No group element found for id "${groupId}"`);
  const groupRect = groupElement.getBoundingClientRect();
  const groupSizeInPixels = isHorizontal ? groupRect.width : groupRect.height;
  const offsetPixels = cursorPosition - initialCursorPosition;
  const offsetPercentage = offsetPixels / groupSizeInPixels * 100;
  return offsetPercentage;
}

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX
function calculateDeltaPercentage(event, dragHandleId, direction, initialDragState, keyboardResizeBy, panelGroupElement) {
  if (isKeyDown(event)) {
    const isHorizontal = direction === "horizontal";
    let delta = 0;
    if (event.shiftKey) {
      delta = 100;
    } else if (keyboardResizeBy != null) {
      delta = keyboardResizeBy;
    } else {
      delta = 10;
    }
    let movement = 0;
    switch (event.key) {
      case "ArrowDown":
        movement = isHorizontal ? 0 : delta;
        break;
      case "ArrowLeft":
        movement = isHorizontal ? -delta : 0;
        break;
      case "ArrowRight":
        movement = isHorizontal ? delta : 0;
        break;
      case "ArrowUp":
        movement = isHorizontal ? 0 : -delta;
        break;
      case "End":
        movement = 100;
        break;
      case "Home":
        movement = -100;
        break;
    }
    return movement;
  } else {
    if (initialDragState == null) {
      return 0;
    }
    return calculateDragOffsetPercentage(event, dragHandleId, direction, initialDragState, panelGroupElement);
  }
}

function calculateUnsafeDefaultLayout({
  panelDataArray
}) {
  const layout = Array(panelDataArray.length);
  const panelConstraintsArray = panelDataArray.map(panelData => panelData.constraints);
  let numPanelsWithSizes = 0;
  let remainingSize = 100;

  // Distribute default sizes first
  for (let index = 0; index < panelDataArray.length; index++) {
    const panelConstraints = panelConstraintsArray[index];
    assert(panelConstraints, `Panel constraints not found for index ${index}`);
    const {
      defaultSize
    } = panelConstraints;
    if (defaultSize != null) {
      numPanelsWithSizes++;
      layout[index] = defaultSize;
      remainingSize -= defaultSize;
    }
  }

  // Remaining size should be distributed evenly between panels without default sizes
  for (let index = 0; index < panelDataArray.length; index++) {
    const panelConstraints = panelConstraintsArray[index];
    assert(panelConstraints, `Panel constraints not found for index ${index}`);
    const {
      defaultSize
    } = panelConstraints;
    if (defaultSize != null) {
      continue;
    }
    const numRemainingPanels = panelDataArray.length - numPanelsWithSizes;
    const size = remainingSize / numRemainingPanels;
    numPanelsWithSizes++;
    layout[index] = size;
    remainingSize -= size;
  }
  return layout;
}

// Layout should be pre-converted into percentages
function callPanelCallbacks(panelsArray, layout, panelIdToLastNotifiedSizeMap) {
  layout.forEach((size, index) => {
    const panelData = panelsArray[index];
    assert(panelData, `Panel data not found for index ${index}`);
    const {
      callbacks,
      constraints,
      id: panelId
    } = panelData;
    const {
      collapsedSize = 0,
      collapsible
    } = constraints;
    const lastNotifiedSize = panelIdToLastNotifiedSizeMap[panelId];
    if (lastNotifiedSize == null || size !== lastNotifiedSize) {
      panelIdToLastNotifiedSizeMap[panelId] = size;
      const {
        onCollapse,
        onExpand,
        onResize
      } = callbacks;
      if (onResize) {
        onResize(size, lastNotifiedSize);
      }
      if (collapsible && (onCollapse || onExpand)) {
        if (onExpand && (lastNotifiedSize == null || fuzzyNumbersEqual$1(lastNotifiedSize, collapsedSize)) && !fuzzyNumbersEqual$1(size, collapsedSize)) {
          onExpand();
        }
        if (onCollapse && (lastNotifiedSize == null || !fuzzyNumbersEqual$1(lastNotifiedSize, collapsedSize)) && fuzzyNumbersEqual$1(size, collapsedSize)) {
          onCollapse();
        }
      }
    }
  });
}

function compareLayouts(a, b) {
  if (a.length !== b.length) {
    return false;
  } else {
    for (let index = 0; index < a.length; index++) {
      if (a[index] != b[index]) {
        return false;
      }
    }
  }
  return true;
}

// This method returns a number between 1 and 100 representing

// the % of the group's overall space this panel should occupy.
function computePanelFlexBoxStyle({
  defaultSize,
  dragState,
  layout,
  panelData,
  panelIndex,
  precision = 3
}) {
  const size = layout[panelIndex];
  let flexGrow;
  if (size == null) {
    // Initial render (before panels have registered themselves)
    // In order to support server rendering, fall back to default size if provided
    flexGrow = defaultSize != undefined ? defaultSize.toPrecision(precision) : "1";
  } else if (panelData.length === 1) {
    // Special case: Single panel group should always fill full width/height
    flexGrow = "1";
  } else {
    flexGrow = size.toPrecision(precision);
  }
  return {
    flexBasis: 0,
    flexGrow,
    flexShrink: 1,
    // Without this, Panel sizes may be unintentionally overridden by their content
    overflow: "hidden",
    // Disable pointer events inside of a panel during resize
    // This avoid edge cases like nested iframes
    pointerEvents: dragState !== null ? "none" : undefined
  };
}

function debounce(callback, durationMs = 10) {
  let timeoutId = null;
  let callable = (...args) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      callback(...args);
    }, durationMs);
  };
  return callable;
}

// PanelGroup might be rendering in a server-side environment where localStorage is not available
// or on a browser with cookies/storage disabled.
// In either case, this function avoids accessing localStorage until needed,
// and avoids throwing user-visible errors.
function initializeDefaultStorage(storageObject) {
  try {
    if (typeof localStorage !== "undefined") {
      // Bypass this check for future calls
      storageObject.getItem = name => {
        return localStorage.getItem(name);
      };
      storageObject.setItem = (name, value) => {
        localStorage.setItem(name, value);
      };
    } else {
      throw new Error("localStorage not supported in this environment");
    }
  } catch (error) {
    console.error(error);
    storageObject.getItem = () => null;
    storageObject.setItem = () => {};
  }
}

function getPanelGroupKey(autoSaveId) {
  return `react-resizable-panels:${autoSaveId}`;
}

// Note that Panel ids might be user-provided (stable) or useId generated (non-deterministic)
// so they should not be used as part of the serialization key.
// Using the min/max size attributes should work well enough as a backup.
// Pre-sorting by minSize allows remembering layouts even if panels are re-ordered/dragged.
function getPanelKey(panels) {
  return panels.map(panel => {
    const {
      constraints,
      id,
      idIsFromProps,
      order
    } = panel;
    if (idIsFromProps) {
      return id;
    } else {
      return order ? `${order}:${JSON.stringify(constraints)}` : JSON.stringify(constraints);
    }
  }).sort((a, b) => a.localeCompare(b)).join(",");
}
function loadSerializedPanelGroupState(autoSaveId, storage) {
  try {
    const panelGroupKey = getPanelGroupKey(autoSaveId);
    const serialized = storage.getItem(panelGroupKey);
    if (serialized) {
      const parsed = JSON.parse(serialized);
      if (typeof parsed === "object" && parsed != null) {
        return parsed;
      }
    }
  } catch (error) {}
  return null;
}
function loadPanelGroupState(autoSaveId, panels, storage) {
  var _loadSerializedPanelG, _state$panelKey;
  const state = (_loadSerializedPanelG = loadSerializedPanelGroupState(autoSaveId, storage)) !== null && _loadSerializedPanelG !== void 0 ? _loadSerializedPanelG : {};
  const panelKey = getPanelKey(panels);
  return (_state$panelKey = state[panelKey]) !== null && _state$panelKey !== void 0 ? _state$panelKey : null;
}
function savePanelGroupState(autoSaveId, panels, panelSizesBeforeCollapse, sizes, storage) {
  var _loadSerializedPanelG2;
  const panelGroupKey = getPanelGroupKey(autoSaveId);
  const panelKey = getPanelKey(panels);
  const state = (_loadSerializedPanelG2 = loadSerializedPanelGroupState(autoSaveId, storage)) !== null && _loadSerializedPanelG2 !== void 0 ? _loadSerializedPanelG2 : {};
  state[panelKey] = {
    expandToSizes: Object.fromEntries(panelSizesBeforeCollapse.entries()),
    layout: sizes
  };
  try {
    storage.setItem(panelGroupKey, JSON.stringify(state));
  } catch (error) {
    console.error(error);
  }
}

function validatePanelConstraints({
  panelConstraints: panelConstraintsArray,
  panelId,
  panelIndex
}) {
  {
    const warnings = [];
    const panelConstraints = panelConstraintsArray[panelIndex];
    assert(panelConstraints, `No panel constraints found for index ${panelIndex}`);
    const {
      collapsedSize = 0,
      collapsible = false,
      defaultSize,
      maxSize = 100,
      minSize = 0
    } = panelConstraints;
    if (minSize > maxSize) {
      warnings.push(`min size (${minSize}%) should not be greater than max size (${maxSize}%)`);
    }
    if (defaultSize != null) {
      if (defaultSize < 0) {
        warnings.push("default size should not be less than 0");
      } else if (defaultSize < minSize && (!collapsible || defaultSize !== collapsedSize)) {
        warnings.push("default size should not be less than min size");
      }
      if (defaultSize > 100) {
        warnings.push("default size should not be greater than 100");
      } else if (defaultSize > maxSize) {
        warnings.push("default size should not be greater than max size");
      }
    }
    if (collapsedSize > minSize) {
      warnings.push("collapsed size should not be greater than min size");
    }
    if (warnings.length > 0) {
      const name = panelId != null ? `Panel "${panelId}"` : "Panel";
      console.warn(`${name} has an invalid configuration:\n\n${warnings.join("\n")}`);
      return false;
    }
  }
  return true;
}

// All units must be in percentages; pixel values should be pre-converted
function validatePanelGroupLayout({
  layout: prevLayout,
  panelConstraints
}) {
  const nextLayout = [...prevLayout];
  const nextLayoutTotalSize = nextLayout.reduce((accumulated, current) => accumulated + current, 0);

  // Validate layout expectations
  if (nextLayout.length !== panelConstraints.length) {
    throw Error(`Invalid ${panelConstraints.length} panel layout: ${nextLayout.map(size => `${size}%`).join(", ")}`);
  } else if (!fuzzyNumbersEqual(nextLayoutTotalSize, 100) && nextLayout.length > 0) {
    // This is not ideal so we should warn about it, but it may be recoverable in some cases
    // (especially if the amount is small)
    {
      console.warn(`WARNING: Invalid layout total size: ${nextLayout.map(size => `${size}%`).join(", ")}. Layout normalization will be applied.`);
    }
    for (let index = 0; index < panelConstraints.length; index++) {
      const unsafeSize = nextLayout[index];
      assert(unsafeSize != null, `No layout data found for index ${index}`);
      const safeSize = 100 / nextLayoutTotalSize * unsafeSize;
      nextLayout[index] = safeSize;
    }
  }
  let remainingSize = 0;

  // First pass: Validate the proposed layout given each panel's constraints
  for (let index = 0; index < panelConstraints.length; index++) {
    const unsafeSize = nextLayout[index];
    assert(unsafeSize != null, `No layout data found for index ${index}`);
    const safeSize = resizePanel({
      panelConstraints,
      panelIndex: index,
      size: unsafeSize
    });
    if (unsafeSize != safeSize) {
      remainingSize += unsafeSize - safeSize;
      nextLayout[index] = safeSize;
    }
  }

  // If there is additional, left over space, assign it to any panel(s) that permits it
  // (It's not worth taking multiple additional passes to evenly distribute)
  if (!fuzzyNumbersEqual(remainingSize, 0)) {
    for (let index = 0; index < panelConstraints.length; index++) {
      const prevSize = nextLayout[index];
      assert(prevSize != null, `No layout data found for index ${index}`);
      const unsafeSize = prevSize + remainingSize;
      const safeSize = resizePanel({
        panelConstraints,
        panelIndex: index,
        size: unsafeSize
      });
      if (prevSize !== safeSize) {
        remainingSize -= safeSize - prevSize;
        nextLayout[index] = safeSize;

        // Once we've used up the remainder, bail
        if (fuzzyNumbersEqual(remainingSize, 0)) {
          break;
        }
      }
    }
  }
  return nextLayout;
}

const LOCAL_STORAGE_DEBOUNCE_INTERVAL = 100;
const defaultStorage = {
  getItem: name => {
    initializeDefaultStorage(defaultStorage);
    return defaultStorage.getItem(name);
  },
  setItem: (name, value) => {
    initializeDefaultStorage(defaultStorage);
    defaultStorage.setItem(name, value);
  }
};
const debounceMap = {};
function PanelGroupWithForwardedRef({
  autoSaveId = null,
  children,
  className: classNameFromProps = "",
  direction,
  forwardedRef,
  id: idFromProps = null,
  onLayout = null,
  keyboardResizeBy = null,
  storage = defaultStorage,
  style: styleFromProps,
  tagName: Type = "div",
  ...rest
}) {
  const groupId = useUniqueId(idFromProps);
  const panelGroupElementRef = React.useRef(null);
  const [dragState, setDragState] = React.useState(null);
  const [layout, setLayout] = React.useState([]);
  const forceUpdate = useForceUpdate();
  const panelIdToLastNotifiedSizeMapRef = React.useRef({});
  const panelSizeBeforeCollapseRef = React.useRef(new Map());
  const prevDeltaRef = React.useRef(0);
  const committedValuesRef = React.useRef({
    autoSaveId,
    direction,
    dragState,
    id: groupId,
    keyboardResizeBy,
    onLayout,
    storage
  });
  const eagerValuesRef = React.useRef({
    layout,
    panelDataArray: [],
    panelDataArrayChanged: false
  });
  const devWarningsRef = React.useRef({
    didLogIdAndOrderWarning: false,
    didLogPanelConstraintsWarning: false,
    prevPanelIds: []
  });
  React.useImperativeHandle(forwardedRef, () => ({
    getId: () => committedValuesRef.current.id,
    getLayout: () => {
      const {
        layout
      } = eagerValuesRef.current;
      return layout;
    },
    setLayout: unsafeLayout => {
      const {
        onLayout
      } = committedValuesRef.current;
      const {
        layout: prevLayout,
        panelDataArray
      } = eagerValuesRef.current;
      const safeLayout = validatePanelGroupLayout({
        layout: unsafeLayout,
        panelConstraints: panelDataArray.map(panelData => panelData.constraints)
      });
      if (!areEqual(prevLayout, safeLayout)) {
        setLayout(safeLayout);
        eagerValuesRef.current.layout = safeLayout;
        if (onLayout) {
          onLayout(safeLayout);
        }
        callPanelCallbacks(panelDataArray, safeLayout, panelIdToLastNotifiedSizeMapRef.current);
      }
    }
  }), []);
  useIsomorphicLayoutEffect(() => {
    committedValuesRef.current.autoSaveId = autoSaveId;
    committedValuesRef.current.direction = direction;
    committedValuesRef.current.dragState = dragState;
    committedValuesRef.current.id = groupId;
    committedValuesRef.current.onLayout = onLayout;
    committedValuesRef.current.storage = storage;
  });
  useWindowSplitterPanelGroupBehavior({
    committedValuesRef,
    eagerValuesRef,
    groupId,
    layout,
    panelDataArray: eagerValuesRef.current.panelDataArray,
    setLayout,
    panelGroupElement: panelGroupElementRef.current
  });
  React.useEffect(() => {
    const {
      panelDataArray
    } = eagerValuesRef.current;

    // If this panel has been configured to persist sizing information, save sizes to local storage.
    if (autoSaveId) {
      if (layout.length === 0 || layout.length !== panelDataArray.length) {
        return;
      }
      let debouncedSave = debounceMap[autoSaveId];

      // Limit the frequency of localStorage updates.
      if (debouncedSave == null) {
        debouncedSave = debounce(savePanelGroupState, LOCAL_STORAGE_DEBOUNCE_INTERVAL);
        debounceMap[autoSaveId] = debouncedSave;
      }

      // Clone mutable data before passing to the debounced function,
      // else we run the risk of saving an incorrect combination of mutable and immutable values to state.
      const clonedPanelDataArray = [...panelDataArray];
      const clonedPanelSizesBeforeCollapse = new Map(panelSizeBeforeCollapseRef.current);
      debouncedSave(autoSaveId, clonedPanelDataArray, clonedPanelSizesBeforeCollapse, layout, storage);
    }
  }, [autoSaveId, layout, storage]);

  // DEV warnings
  React.useEffect(() => {
    {
      const {
        panelDataArray
      } = eagerValuesRef.current;
      const {
        didLogIdAndOrderWarning,
        didLogPanelConstraintsWarning,
        prevPanelIds
      } = devWarningsRef.current;
      if (!didLogIdAndOrderWarning) {
        const panelIds = panelDataArray.map(({
          id
        }) => id);
        devWarningsRef.current.prevPanelIds = panelIds;
        const panelsHaveChanged = prevPanelIds.length > 0 && !areEqual(prevPanelIds, panelIds);
        if (panelsHaveChanged) {
          if (panelDataArray.find(({
            idIsFromProps,
            order
          }) => !idIsFromProps || order == null)) {
            devWarningsRef.current.didLogIdAndOrderWarning = true;
            console.warn(`WARNING: Panel id and order props recommended when panels are dynamically rendered`);
          }
        }
      }
      if (!didLogPanelConstraintsWarning) {
        const panelConstraints = panelDataArray.map(panelData => panelData.constraints);
        for (let panelIndex = 0; panelIndex < panelConstraints.length; panelIndex++) {
          const panelData = panelDataArray[panelIndex];
          assert(panelData, `Panel data not found for index ${panelIndex}`);
          const isValid = validatePanelConstraints({
            panelConstraints,
            panelId: panelData.id,
            panelIndex
          });
          if (!isValid) {
            devWarningsRef.current.didLogPanelConstraintsWarning = true;
            break;
          }
        }
      }
    }
  });

  // External APIs are safe to memoize via committed values ref
  const collapsePanel = React.useCallback(panelData => {
    const {
      onLayout
    } = committedValuesRef.current;
    const {
      layout: prevLayout,
      panelDataArray
    } = eagerValuesRef.current;
    if (panelData.constraints.collapsible) {
      const panelConstraintsArray = panelDataArray.map(panelData => panelData.constraints);
      const {
        collapsedSize = 0,
        panelSize,
        pivotIndices
      } = panelDataHelper(panelDataArray, panelData, prevLayout);
      assert(panelSize != null, `Panel size not found for panel "${panelData.id}"`);
      if (!fuzzyNumbersEqual$1(panelSize, collapsedSize)) {
        // Store size before collapse;
        // This is the size that gets restored if the expand() API is used.
        panelSizeBeforeCollapseRef.current.set(panelData.id, panelSize);
        const isLastPanel = findPanelDataIndex(panelDataArray, panelData) === panelDataArray.length - 1;
        const delta = isLastPanel ? panelSize - collapsedSize : collapsedSize - panelSize;
        const nextLayout = adjustLayoutByDelta({
          delta,
          initialLayout: prevLayout,
          panelConstraints: panelConstraintsArray,
          pivotIndices,
          prevLayout,
          trigger: "imperative-api"
        });
        if (!compareLayouts(prevLayout, nextLayout)) {
          setLayout(nextLayout);
          eagerValuesRef.current.layout = nextLayout;
          if (onLayout) {
            onLayout(nextLayout);
          }
          callPanelCallbacks(panelDataArray, nextLayout, panelIdToLastNotifiedSizeMapRef.current);
        }
      }
    }
  }, []);

  // External APIs are safe to memoize via committed values ref
  const expandPanel = React.useCallback((panelData, minSizeOverride) => {
    const {
      onLayout
    } = committedValuesRef.current;
    const {
      layout: prevLayout,
      panelDataArray
    } = eagerValuesRef.current;
    if (panelData.constraints.collapsible) {
      const panelConstraintsArray = panelDataArray.map(panelData => panelData.constraints);
      const {
        collapsedSize = 0,
        panelSize = 0,
        minSize: minSizeFromProps = 0,
        pivotIndices
      } = panelDataHelper(panelDataArray, panelData, prevLayout);
      const minSize = minSizeOverride !== null && minSizeOverride !== void 0 ? minSizeOverride : minSizeFromProps;
      if (fuzzyNumbersEqual$1(panelSize, collapsedSize)) {
        // Restore this panel to the size it was before it was collapsed, if possible.
        const prevPanelSize = panelSizeBeforeCollapseRef.current.get(panelData.id);
        const baseSize = prevPanelSize != null && prevPanelSize >= minSize ? prevPanelSize : minSize;
        const isLastPanel = findPanelDataIndex(panelDataArray, panelData) === panelDataArray.length - 1;
        const delta = isLastPanel ? panelSize - baseSize : baseSize - panelSize;
        const nextLayout = adjustLayoutByDelta({
          delta,
          initialLayout: prevLayout,
          panelConstraints: panelConstraintsArray,
          pivotIndices,
          prevLayout,
          trigger: "imperative-api"
        });
        if (!compareLayouts(prevLayout, nextLayout)) {
          setLayout(nextLayout);
          eagerValuesRef.current.layout = nextLayout;
          if (onLayout) {
            onLayout(nextLayout);
          }
          callPanelCallbacks(panelDataArray, nextLayout, panelIdToLastNotifiedSizeMapRef.current);
        }
      }
    }
  }, []);

  // External APIs are safe to memoize via committed values ref
  const getPanelSize = React.useCallback(panelData => {
    const {
      layout,
      panelDataArray
    } = eagerValuesRef.current;
    const {
      panelSize
    } = panelDataHelper(panelDataArray, panelData, layout);
    assert(panelSize != null, `Panel size not found for panel "${panelData.id}"`);
    return panelSize;
  }, []);

  // This API should never read from committedValuesRef
  const getPanelStyle = React.useCallback((panelData, defaultSize) => {
    const {
      panelDataArray
    } = eagerValuesRef.current;
    const panelIndex = findPanelDataIndex(panelDataArray, panelData);
    return computePanelFlexBoxStyle({
      defaultSize,
      dragState,
      layout,
      panelData: panelDataArray,
      panelIndex
    });
  }, [dragState, layout]);

  // External APIs are safe to memoize via committed values ref
  const isPanelCollapsed = React.useCallback(panelData => {
    const {
      layout,
      panelDataArray
    } = eagerValuesRef.current;
    const {
      collapsedSize = 0,
      collapsible,
      panelSize
    } = panelDataHelper(panelDataArray, panelData, layout);
    assert(panelSize != null, `Panel size not found for panel "${panelData.id}"`);
    return collapsible === true && fuzzyNumbersEqual$1(panelSize, collapsedSize);
  }, []);

  // External APIs are safe to memoize via committed values ref
  const isPanelExpanded = React.useCallback(panelData => {
    const {
      layout,
      panelDataArray
    } = eagerValuesRef.current;
    const {
      collapsedSize = 0,
      collapsible,
      panelSize
    } = panelDataHelper(panelDataArray, panelData, layout);
    assert(panelSize != null, `Panel size not found for panel "${panelData.id}"`);
    return !collapsible || fuzzyCompareNumbers(panelSize, collapsedSize) > 0;
  }, []);
  const registerPanel = React.useCallback(panelData => {
    const {
      panelDataArray
    } = eagerValuesRef.current;
    panelDataArray.push(panelData);
    panelDataArray.sort((panelA, panelB) => {
      const orderA = panelA.order;
      const orderB = panelB.order;
      if (orderA == null && orderB == null) {
        return 0;
      } else if (orderA == null) {
        return -1;
      } else if (orderB == null) {
        return 1;
      } else {
        return orderA - orderB;
      }
    });
    eagerValuesRef.current.panelDataArrayChanged = true;
    forceUpdate();
  }, [forceUpdate]);

  // (Re)calculate group layout whenever panels are registered or unregistered.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useIsomorphicLayoutEffect(() => {
    if (eagerValuesRef.current.panelDataArrayChanged) {
      eagerValuesRef.current.panelDataArrayChanged = false;
      const {
        autoSaveId,
        onLayout,
        storage
      } = committedValuesRef.current;
      const {
        layout: prevLayout,
        panelDataArray
      } = eagerValuesRef.current;

      // If this panel has been configured to persist sizing information,
      // default size should be restored from local storage if possible.
      let unsafeLayout = null;
      if (autoSaveId) {
        const state = loadPanelGroupState(autoSaveId, panelDataArray, storage);
        if (state) {
          panelSizeBeforeCollapseRef.current = new Map(Object.entries(state.expandToSizes));
          unsafeLayout = state.layout;
        }
      }
      if (unsafeLayout == null) {
        unsafeLayout = calculateUnsafeDefaultLayout({
          panelDataArray
        });
      }

      // Validate even saved layouts in case something has changed since last render
      // e.g. for pixel groups, this could be the size of the window
      const nextLayout = validatePanelGroupLayout({
        layout: unsafeLayout,
        panelConstraints: panelDataArray.map(panelData => panelData.constraints)
      });
      if (!areEqual(prevLayout, nextLayout)) {
        setLayout(nextLayout);
        eagerValuesRef.current.layout = nextLayout;
        if (onLayout) {
          onLayout(nextLayout);
        }
        callPanelCallbacks(panelDataArray, nextLayout, panelIdToLastNotifiedSizeMapRef.current);
      }
    }
  });

  // Reset the cached layout if hidden by the Activity/Offscreen API
  useIsomorphicLayoutEffect(() => {
    const eagerValues = eagerValuesRef.current;
    return () => {
      eagerValues.layout = [];
    };
  }, []);
  const registerResizeHandle = React.useCallback(dragHandleId => {
    let isRTL = false;
    const panelGroupElement = panelGroupElementRef.current;
    if (panelGroupElement) {
      const style = window.getComputedStyle(panelGroupElement, null);
      if (style.getPropertyValue("direction") === "rtl") {
        isRTL = true;
      }
    }
    return function resizeHandler(event) {
      event.preventDefault();
      const panelGroupElement = panelGroupElementRef.current;
      if (!panelGroupElement) {
        return () => null;
      }
      const {
        direction,
        dragState,
        id: groupId,
        keyboardResizeBy,
        onLayout
      } = committedValuesRef.current;
      const {
        layout: prevLayout,
        panelDataArray
      } = eagerValuesRef.current;
      const {
        initialLayout
      } = dragState !== null && dragState !== void 0 ? dragState : {};
      const pivotIndices = determinePivotIndices(groupId, dragHandleId, panelGroupElement);
      let delta = calculateDeltaPercentage(event, dragHandleId, direction, dragState, keyboardResizeBy, panelGroupElement);
      const isHorizontal = direction === "horizontal";
      if (isHorizontal && isRTL) {
        delta = -delta;
      }
      const panelConstraints = panelDataArray.map(panelData => panelData.constraints);
      const nextLayout = adjustLayoutByDelta({
        delta,
        initialLayout: initialLayout !== null && initialLayout !== void 0 ? initialLayout : prevLayout,
        panelConstraints,
        pivotIndices,
        prevLayout,
        trigger: isKeyDown(event) ? "keyboard" : "mouse-or-touch"
      });
      const layoutChanged = !compareLayouts(prevLayout, nextLayout);

      // Only update the cursor for layout changes triggered by touch/mouse events (not keyboard)
      // Update the cursor even if the layout hasn't changed (we may need to show an invalid cursor state)
      if (isPointerEvent(event) || isMouseEvent(event)) {
        // Watch for multiple subsequent deltas; this might occur for tiny cursor movements.
        // In this case, Panel sizes might not change–
        // but updating cursor in this scenario would cause a flicker.
        if (prevDeltaRef.current != delta) {
          prevDeltaRef.current = delta;
          if (!layoutChanged && delta !== 0) {
            // If the pointer has moved too far to resize the panel any further, note this so we can update the cursor.
            // This mimics VS Code behavior.
            if (isHorizontal) {
              reportConstraintsViolation(dragHandleId, delta < 0 ? EXCEEDED_HORIZONTAL_MIN : EXCEEDED_HORIZONTAL_MAX);
            } else {
              reportConstraintsViolation(dragHandleId, delta < 0 ? EXCEEDED_VERTICAL_MIN : EXCEEDED_VERTICAL_MAX);
            }
          } else {
            reportConstraintsViolation(dragHandleId, 0);
          }
        }
      }
      if (layoutChanged) {
        setLayout(nextLayout);
        eagerValuesRef.current.layout = nextLayout;
        if (onLayout) {
          onLayout(nextLayout);
        }
        callPanelCallbacks(panelDataArray, nextLayout, panelIdToLastNotifiedSizeMapRef.current);
      }
    };
  }, []);

  // External APIs are safe to memoize via committed values ref
  const resizePanel = React.useCallback((panelData, unsafePanelSize) => {
    const {
      onLayout
    } = committedValuesRef.current;
    const {
      layout: prevLayout,
      panelDataArray
    } = eagerValuesRef.current;
    const panelConstraintsArray = panelDataArray.map(panelData => panelData.constraints);
    const {
      panelSize,
      pivotIndices
    } = panelDataHelper(panelDataArray, panelData, prevLayout);
    assert(panelSize != null, `Panel size not found for panel "${panelData.id}"`);
    const isLastPanel = findPanelDataIndex(panelDataArray, panelData) === panelDataArray.length - 1;
    const delta = isLastPanel ? panelSize - unsafePanelSize : unsafePanelSize - panelSize;
    const nextLayout = adjustLayoutByDelta({
      delta,
      initialLayout: prevLayout,
      panelConstraints: panelConstraintsArray,
      pivotIndices,
      prevLayout,
      trigger: "imperative-api"
    });
    if (!compareLayouts(prevLayout, nextLayout)) {
      setLayout(nextLayout);
      eagerValuesRef.current.layout = nextLayout;
      if (onLayout) {
        onLayout(nextLayout);
      }
      callPanelCallbacks(panelDataArray, nextLayout, panelIdToLastNotifiedSizeMapRef.current);
    }
  }, []);
  const reevaluatePanelConstraints = React.useCallback((panelData, prevConstraints) => {
    const {
      layout,
      panelDataArray
    } = eagerValuesRef.current;
    const {
      collapsedSize: prevCollapsedSize = 0,
      collapsible: prevCollapsible
    } = prevConstraints;
    const {
      collapsedSize: nextCollapsedSize = 0,
      collapsible: nextCollapsible,
      maxSize: nextMaxSize = 100,
      minSize: nextMinSize = 0
    } = panelData.constraints;
    const {
      panelSize: prevPanelSize
    } = panelDataHelper(panelDataArray, panelData, layout);
    if (prevPanelSize == null) {
      // It's possible that the panels in this group have changed since the last render
      return;
    }
    if (prevCollapsible && nextCollapsible && fuzzyNumbersEqual$1(prevPanelSize, prevCollapsedSize)) {
      if (!fuzzyNumbersEqual$1(prevCollapsedSize, nextCollapsedSize)) {
        resizePanel(panelData, nextCollapsedSize);
      }
    } else if (prevPanelSize < nextMinSize) {
      resizePanel(panelData, nextMinSize);
    } else if (prevPanelSize > nextMaxSize) {
      resizePanel(panelData, nextMaxSize);
    }
  }, [resizePanel]);

  // TODO Multiple drag handles can be active at the same time so this API is a bit awkward now
  const startDragging = React.useCallback((dragHandleId, event) => {
    const {
      direction
    } = committedValuesRef.current;
    const {
      layout
    } = eagerValuesRef.current;
    if (!panelGroupElementRef.current) {
      return;
    }
    const handleElement = getResizeHandleElement(dragHandleId, panelGroupElementRef.current);
    assert(handleElement, `Drag handle element not found for id "${dragHandleId}"`);
    const initialCursorPosition = getResizeEventCursorPosition(direction, event);
    setDragState({
      dragHandleId,
      dragHandleRect: handleElement.getBoundingClientRect(),
      initialCursorPosition,
      initialLayout: layout
    });
  }, []);
  const stopDragging = React.useCallback(() => {
    setDragState(null);
  }, []);
  const unregisterPanel = React.useCallback(panelData => {
    const {
      panelDataArray
    } = eagerValuesRef.current;
    const index = findPanelDataIndex(panelDataArray, panelData);
    if (index >= 0) {
      panelDataArray.splice(index, 1);

      // TRICKY
      // When a panel is removed from the group, we should delete the most recent prev-size entry for it.
      // If we don't do this, then a conditionally rendered panel might not call onResize when it's re-mounted.
      // Strict effects mode makes this tricky though because all panels will be registered, unregistered, then re-registered on mount.
      delete panelIdToLastNotifiedSizeMapRef.current[panelData.id];
      eagerValuesRef.current.panelDataArrayChanged = true;
      forceUpdate();
    }
  }, [forceUpdate]);
  const context = React.useMemo(() => ({
    collapsePanel,
    direction,
    dragState,
    expandPanel,
    getPanelSize,
    getPanelStyle,
    groupId,
    isPanelCollapsed,
    isPanelExpanded,
    reevaluatePanelConstraints,
    registerPanel,
    registerResizeHandle,
    resizePanel,
    startDragging,
    stopDragging,
    unregisterPanel,
    panelGroupElement: panelGroupElementRef.current
  }), [collapsePanel, dragState, direction, expandPanel, getPanelSize, getPanelStyle, groupId, isPanelCollapsed, isPanelExpanded, reevaluatePanelConstraints, registerPanel, registerResizeHandle, resizePanel, startDragging, stopDragging, unregisterPanel]);
  const style = {
    display: "flex",
    flexDirection: direction === "horizontal" ? "row" : "column",
    height: "100%",
    overflow: "hidden",
    width: "100%"
  };
  return React.createElement(PanelGroupContext.Provider, {
    value: context
  }, React.createElement(Type, {
    ...rest,
    children,
    className: classNameFromProps,
    id: idFromProps,
    ref: panelGroupElementRef,
    style: {
      ...style,
      ...styleFromProps
    },
    // CSS selectors
    [DATA_ATTRIBUTES.group]: "",
    [DATA_ATTRIBUTES.groupDirection]: direction,
    [DATA_ATTRIBUTES.groupId]: groupId
  }));
}
const PanelGroup = React.forwardRef((props, ref) => React.createElement(PanelGroupWithForwardedRef, {
  ...props,
  forwardedRef: ref
}));
PanelGroupWithForwardedRef.displayName = "PanelGroup";
PanelGroup.displayName = "forwardRef(PanelGroup)";
function findPanelDataIndex(panelDataArray, panelData) {
  return panelDataArray.findIndex(prevPanelData => prevPanelData === panelData || prevPanelData.id === panelData.id);
}
function panelDataHelper(panelDataArray, panelData, layout) {
  const panelIndex = findPanelDataIndex(panelDataArray, panelData);
  const isLastPanel = panelIndex === panelDataArray.length - 1;
  const pivotIndices = isLastPanel ? [panelIndex - 1, panelIndex] : [panelIndex, panelIndex + 1];
  const panelSize = layout[panelIndex];
  return {
    ...panelData.constraints,
    panelSize,
    pivotIndices
  };
}

// https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/

function useWindowSplitterResizeHandlerBehavior({
  disabled,
  handleId,
  resizeHandler,
  panelGroupElement
}) {
  React.useEffect(() => {
    if (disabled || resizeHandler == null || panelGroupElement == null) {
      return;
    }
    const handleElement = getResizeHandleElement(handleId, panelGroupElement);
    if (handleElement == null) {
      return;
    }
    const onKeyDown = event => {
      if (event.defaultPrevented) {
        return;
      }
      switch (event.key) {
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "End":
        case "Home":
          {
            event.preventDefault();
            resizeHandler(event);
            break;
          }
        case "F6":
          {
            event.preventDefault();
            const groupId = handleElement.getAttribute(DATA_ATTRIBUTES.groupId);
            assert(groupId, `No group element found for id "${groupId}"`);
            const handles = getResizeHandleElementsForGroup(groupId, panelGroupElement);
            const index = getResizeHandleElementIndex(groupId, handleId, panelGroupElement);
            assert(index !== null, `No resize element found for id "${handleId}"`);
            const nextIndex = event.shiftKey ? index > 0 ? index - 1 : handles.length - 1 : index + 1 < handles.length ? index + 1 : 0;
            const nextHandle = handles[nextIndex];
            nextHandle.focus();
            break;
          }
      }
    };
    handleElement.addEventListener("keydown", onKeyDown);
    return () => {
      handleElement.removeEventListener("keydown", onKeyDown);
    };
  }, [panelGroupElement, disabled, handleId, resizeHandler]);
}

function PanelResizeHandle({
  children = null,
  className: classNameFromProps = "",
  disabled = false,
  hitAreaMargins,
  id: idFromProps,
  onBlur,
  onClick,
  onDragging,
  onFocus,
  onPointerDown,
  onPointerUp,
  style: styleFromProps = {},
  tabIndex = 0,
  tagName: Type = "div",
  ...rest
}) {
  var _hitAreaMargins$coars, _hitAreaMargins$fine;
  const elementRef = React.useRef(null);

  // Use a ref to guard against users passing inline props
  const callbacksRef = React.useRef({
    onClick,
    onDragging,
    onPointerDown,
    onPointerUp
  });
  React.useEffect(() => {
    callbacksRef.current.onClick = onClick;
    callbacksRef.current.onDragging = onDragging;
    callbacksRef.current.onPointerDown = onPointerDown;
    callbacksRef.current.onPointerUp = onPointerUp;
  });
  const panelGroupContext = React.useContext(PanelGroupContext);
  if (panelGroupContext === null) {
    throw Error(`PanelResizeHandle components must be rendered within a PanelGroup container`);
  }
  const {
    direction,
    groupId,
    registerResizeHandle: registerResizeHandleWithParentGroup,
    startDragging,
    stopDragging,
    panelGroupElement
  } = panelGroupContext;
  const resizeHandleId = useUniqueId(idFromProps);
  const [state, setState] = React.useState("inactive");
  const [isFocused, setIsFocused] = React.useState(false);
  const [resizeHandler, setResizeHandler] = React.useState(null);
  const committedValuesRef = React.useRef({
    state
  });
  useIsomorphicLayoutEffect(() => {
    committedValuesRef.current.state = state;
  });
  React.useEffect(() => {
    if (disabled) {
      setResizeHandler(null);
    } else {
      const resizeHandler = registerResizeHandleWithParentGroup(resizeHandleId);
      setResizeHandler(() => resizeHandler);
    }
  }, [disabled, resizeHandleId, registerResizeHandleWithParentGroup]);

  // Extract hit area margins before passing them to the effect's dependency array
  // so that inline object values won't trigger re-renders
  const coarseHitAreaMargins = (_hitAreaMargins$coars = hitAreaMargins === null || hitAreaMargins === void 0 ? void 0 : hitAreaMargins.coarse) !== null && _hitAreaMargins$coars !== void 0 ? _hitAreaMargins$coars : 15;
  const fineHitAreaMargins = (_hitAreaMargins$fine = hitAreaMargins === null || hitAreaMargins === void 0 ? void 0 : hitAreaMargins.fine) !== null && _hitAreaMargins$fine !== void 0 ? _hitAreaMargins$fine : 5;
  React.useEffect(() => {
    if (disabled || resizeHandler == null) {
      return;
    }
    const element = elementRef.current;
    assert(element, "Element ref not attached");
    let didMove = false;
    const setResizeHandlerState = (action, isActive, event) => {
      if (!isActive) {
        setState("inactive");
        return;
      }
      switch (action) {
        case "down":
          {
            setState("drag");
            didMove = false;
            assert(event, 'Expected event to be defined for "down" action');
            startDragging(resizeHandleId, event);
            const {
              onDragging,
              onPointerDown
            } = callbacksRef.current;
            onDragging === null || onDragging === void 0 ? void 0 : onDragging(true);
            onPointerDown === null || onPointerDown === void 0 ? void 0 : onPointerDown();
            break;
          }
        case "move":
          {
            const {
              state
            } = committedValuesRef.current;
            didMove = true;
            if (state !== "drag") {
              setState("hover");
            }
            assert(event, 'Expected event to be defined for "move" action');
            resizeHandler(event);
            break;
          }
        case "up":
          {
            setState("hover");
            stopDragging();
            const {
              onClick,
              onDragging,
              onPointerUp
            } = callbacksRef.current;
            onDragging === null || onDragging === void 0 ? void 0 : onDragging(false);
            onPointerUp === null || onPointerUp === void 0 ? void 0 : onPointerUp();
            if (!didMove) {
              onClick === null || onClick === void 0 ? void 0 : onClick();
            }
            break;
          }
      }
    };
    return registerResizeHandle(resizeHandleId, element, direction, {
      coarse: coarseHitAreaMargins,
      fine: fineHitAreaMargins
    }, setResizeHandlerState);
  }, [coarseHitAreaMargins, direction, disabled, fineHitAreaMargins, registerResizeHandleWithParentGroup, resizeHandleId, resizeHandler, startDragging, stopDragging]);
  useWindowSplitterResizeHandlerBehavior({
    disabled,
    handleId: resizeHandleId,
    resizeHandler,
    panelGroupElement
  });
  const style = {
    touchAction: "none",
    userSelect: "none"
  };
  return React.createElement(Type, {
    ...rest,
    children,
    className: classNameFromProps,
    id: idFromProps,
    onBlur: () => {
      setIsFocused(false);
      onBlur === null || onBlur === void 0 ? void 0 : onBlur();
    },
    onFocus: () => {
      setIsFocused(true);
      onFocus === null || onFocus === void 0 ? void 0 : onFocus();
    },
    ref: elementRef,
    role: "separator",
    style: {
      ...style,
      ...styleFromProps
    },
    tabIndex,
    // CSS selectors
    [DATA_ATTRIBUTES.groupDirection]: direction,
    [DATA_ATTRIBUTES.groupId]: groupId,
    [DATA_ATTRIBUTES.resizeHandle]: "",
    [DATA_ATTRIBUTES.resizeHandleActive]: state === "drag" ? "pointer" : isFocused ? "keyboard" : undefined,
    [DATA_ATTRIBUTES.resizeHandleEnabled]: !disabled,
    [DATA_ATTRIBUTES.resizeHandleId]: resizeHandleId,
    [DATA_ATTRIBUTES.resizeHandleState]: state
  });
}
PanelResizeHandle.displayName = "PanelResizeHandle";

function getPanelElement(id, scope = document) {
  const element = scope.querySelector(`[data-panel-id="${id}"]`);
  if (element) {
    return element;
  }
  return null;
}

function getPanelElementsForGroup(groupId, scope = document) {
  return Array.from(scope.querySelectorAll(`[data-panel][data-panel-group-id="${groupId}"]`));
}

function getIntersectingRectangle(rectOne, rectTwo, strict) {
  if (!intersects(rectOne, rectTwo, strict)) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
  }
  return {
    x: Math.max(rectOne.x, rectTwo.x),
    y: Math.max(rectOne.y, rectTwo.y),
    width: Math.min(rectOne.x + rectOne.width, rectTwo.x + rectTwo.width) - Math.max(rectOne.x, rectTwo.x),
    height: Math.min(rectOne.y + rectOne.height, rectTwo.y + rectTwo.height) - Math.max(rectOne.y, rectTwo.y)
  };
}

exports.DATA_ATTRIBUTES = DATA_ATTRIBUTES;
exports.Panel = Panel;
exports.PanelGroup = PanelGroup;
exports.PanelResizeHandle = PanelResizeHandle;
exports.assert = assert;
exports.disableGlobalCursorStyles = disableGlobalCursorStyles;
exports.enableGlobalCursorStyles = enableGlobalCursorStyles;
exports.getIntersectingRectangle = getIntersectingRectangle;
exports.getPanelElement = getPanelElement;
exports.getPanelElementsForGroup = getPanelElementsForGroup;
exports.getPanelGroupElement = getPanelGroupElement;
exports.getResizeHandleElement = getResizeHandleElement;
exports.getResizeHandleElementIndex = getResizeHandleElementIndex;
exports.getResizeHandleElementsForGroup = getResizeHandleElementsForGroup;
exports.getResizeHandlePanelIds = getResizeHandlePanelIds;
exports.intersects = intersects;
exports.setNonce = setNonce;
