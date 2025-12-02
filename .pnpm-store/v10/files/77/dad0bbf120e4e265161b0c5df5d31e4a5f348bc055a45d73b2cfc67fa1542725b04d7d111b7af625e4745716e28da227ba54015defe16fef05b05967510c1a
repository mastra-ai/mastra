'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var redux = require('redux');
var reactRedux = require('react-redux');
var cssBoxModel = require('css-box-model');
var rafSchd = require('raf-schd');
var _extends = require('@babel/runtime/helpers/extends');

const isProduction$1 = process.env.NODE_ENV === 'production';
const spacesAndTabs = /[ \t]{2,}/g;
const lineStartWithSpaces = /^[ \t]*/gm;
const clean$2 = value => value.replace(spacesAndTabs, ' ').replace(lineStartWithSpaces, '').trim();
const getDevMessage = message => clean$2(`
  %c@hello-pangea/dnd

  %c${clean$2(message)}

  %c👷‍ This is a development only message. It will be removed in production builds.
`);
const getFormattedMessage = message => [getDevMessage(message), 'color: #00C584; font-size: 1.2em; font-weight: bold;', 'line-height: 1.5', 'color: #723874;'];
const isDisabledFlag = '__@hello-pangea/dnd-disable-dev-warnings';
function log(type, message) {
  if (isProduction$1) {
    return;
  }
  if (typeof window !== 'undefined' && window[isDisabledFlag]) {
    return;
  }
  console[type](...getFormattedMessage(message));
}
const warning = log.bind(null, 'warn');
const error = log.bind(null, 'error');

function noop$2() {}

function getOptions(shared, fromBinding) {
  return {
    ...shared,
    ...fromBinding
  };
}
function bindEvents(el, bindings, sharedOptions) {
  const unbindings = bindings.map(binding => {
    const options = getOptions(sharedOptions, binding.options);
    el.addEventListener(binding.eventName, binding.fn, options);
    return function unbind() {
      el.removeEventListener(binding.eventName, binding.fn, options);
    };
  });
  return function unbindAll() {
    unbindings.forEach(unbind => {
      unbind();
    });
  };
}

const isProduction = process.env.NODE_ENV === 'production';
const prefix$1 = 'Invariant failed';
class RbdInvariant extends Error {}
RbdInvariant.prototype.toString = function toString() {
  return this.message;
};
function invariant(condition, message) {
  if (isProduction) {
    throw new RbdInvariant(prefix$1);
  } else {
    throw new RbdInvariant(`${prefix$1}: ${message || ''}`);
  }
}

class ErrorBoundary extends React.Component {
  constructor(...args) {
    super(...args);
    this.callbacks = null;
    this.unbind = noop$2;
    this.onWindowError = event => {
      const callbacks = this.getCallbacks();
      if (callbacks.isDragging()) {
        callbacks.tryAbort();
        process.env.NODE_ENV !== "production" ? warning(`
        An error was caught by our window 'error' event listener while a drag was occurring.
        The active drag has been aborted.
      `) : void 0;
      }
      const err = event.error;
      if (err instanceof RbdInvariant) {
        event.preventDefault();
        if (process.env.NODE_ENV !== 'production') {
          error(err.message);
        }
      }
    };
    this.getCallbacks = () => {
      if (!this.callbacks) {
        throw new Error('Unable to find AppCallbacks in <ErrorBoundary/>');
      }
      return this.callbacks;
    };
    this.setCallbacks = callbacks => {
      this.callbacks = callbacks;
    };
  }
  componentDidMount() {
    this.unbind = bindEvents(window, [{
      eventName: 'error',
      fn: this.onWindowError
    }]);
  }
  componentDidCatch(err) {
    if (err instanceof RbdInvariant) {
      if (process.env.NODE_ENV !== 'production') {
        error(err.message);
      }
      this.setState({});
      return;
    }
    throw err;
  }
  componentWillUnmount() {
    this.unbind();
  }
  render() {
    return this.props.children(this.setCallbacks);
  }
}

const dragHandleUsageInstructions = `
  Press space bar to start a drag.
  When dragging you can use the arrow keys to move the item around and escape to cancel.
  Some screen readers may require you to be in focus mode or to use your pass through key
`;
const position = index => index + 1;
const onDragStart = start => `
  You have lifted an item in position ${position(start.source.index)}
`;
const withLocation = (source, destination) => {
  const isInHomeList = source.droppableId === destination.droppableId;
  const startPosition = position(source.index);
  const endPosition = position(destination.index);
  if (isInHomeList) {
    return `
      You have moved the item from position ${startPosition}
      to position ${endPosition}
    `;
  }
  return `
    You have moved the item from position ${startPosition}
    in list ${source.droppableId}
    to list ${destination.droppableId}
    in position ${endPosition}
  `;
};
const withCombine = (id, source, combine) => {
  const inHomeList = source.droppableId === combine.droppableId;
  if (inHomeList) {
    return `
      The item ${id}
      has been combined with ${combine.draggableId}`;
  }
  return `
      The item ${id}
      in list ${source.droppableId}
      has been combined with ${combine.draggableId}
      in list ${combine.droppableId}
    `;
};
const onDragUpdate = update => {
  const location = update.destination;
  if (location) {
    return withLocation(update.source, location);
  }
  const combine = update.combine;
  if (combine) {
    return withCombine(update.draggableId, update.source, combine);
  }
  return 'You are over an area that cannot be dropped on';
};
const returnedToStart = source => `
  The item has returned to its starting position
  of ${position(source.index)}
`;
const onDragEnd = result => {
  if (result.reason === 'CANCEL') {
    return `
      Movement cancelled.
      ${returnedToStart(result.source)}
    `;
  }
  const location = result.destination;
  const combine = result.combine;
  if (location) {
    return `
      You have dropped the item.
      ${withLocation(result.source, location)}
    `;
  }
  if (combine) {
    return `
      You have dropped the item.
      ${withCombine(result.draggableId, result.source, combine)}
    `;
  }
  return `
    The item has been dropped while not over a drop area.
    ${returnedToStart(result.source)}
  `;
};
const preset = {
  dragHandleUsageInstructions,
  onDragStart,
  onDragUpdate,
  onDragEnd
};

function isEqual$2(first, second) {
  if (first === second) {
    return true;
  }
  if (Number.isNaN(first) && Number.isNaN(second)) {
    return true;
  }
  return false;
}
function areInputsEqual(newInputs, lastInputs) {
  if (newInputs.length !== lastInputs.length) {
    return false;
  }
  for (let i = 0; i < newInputs.length; i++) {
    if (!isEqual$2(newInputs[i], lastInputs[i])) {
      return false;
    }
  }
  return true;
}

function useMemo(getResult, inputs) {
  const initial = React.useState(() => ({
    inputs,
    result: getResult()
  }))[0];
  const isFirstRun = React.useRef(true);
  const committed = React.useRef(initial);
  const useCache = isFirstRun.current || Boolean(inputs && committed.current.inputs && areInputsEqual(inputs, committed.current.inputs));
  const cache = useCache ? committed.current : {
    inputs,
    result: getResult()
  };
  React.useEffect(() => {
    isFirstRun.current = false;
    committed.current = cache;
  }, [cache]);
  return cache.result;
}
function useCallback(callback, inputs) {
  return useMemo(() => callback, inputs);
}

const origin = {
  x: 0,
  y: 0
};
const add = (point1, point2) => ({
  x: point1.x + point2.x,
  y: point1.y + point2.y
});
const subtract = (point1, point2) => ({
  x: point1.x - point2.x,
  y: point1.y - point2.y
});
const isEqual$1 = (point1, point2) => point1.x === point2.x && point1.y === point2.y;
const negate = point => ({
  x: point.x !== 0 ? -point.x : 0,
  y: point.y !== 0 ? -point.y : 0
});
const patch = (line, value, otherValue = 0) => {
  if (line === 'x') {
    return {
      x: value,
      y: otherValue
    };
  }
  return {
    x: otherValue,
    y: value
  };
};
const distance = (point1, point2) => Math.sqrt((point2.x - point1.x) ** 2 + (point2.y - point1.y) ** 2);
const closest$1 = (target, points) => Math.min(...points.map(point => distance(target, point)));
const apply = fn => point => ({
  x: fn(point.x),
  y: fn(point.y)
});

var executeClip = (frame, subject) => {
  const result = cssBoxModel.getRect({
    top: Math.max(subject.top, frame.top),
    right: Math.min(subject.right, frame.right),
    bottom: Math.min(subject.bottom, frame.bottom),
    left: Math.max(subject.left, frame.left)
  });
  if (result.width <= 0 || result.height <= 0) {
    return null;
  }
  return result;
};

const offsetByPosition = (spacing, point) => ({
  top: spacing.top + point.y,
  left: spacing.left + point.x,
  bottom: spacing.bottom + point.y,
  right: spacing.right + point.x
});
const getCorners = spacing => [{
  x: spacing.left,
  y: spacing.top
}, {
  x: spacing.right,
  y: spacing.top
}, {
  x: spacing.left,
  y: spacing.bottom
}, {
  x: spacing.right,
  y: spacing.bottom
}];
const noSpacing = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
};

const scroll$1 = (target, frame) => {
  if (!frame) {
    return target;
  }
  return offsetByPosition(target, frame.scroll.diff.displacement);
};
const increase = (target, axis, withPlaceholder) => {
  if (withPlaceholder && withPlaceholder.increasedBy) {
    return {
      ...target,
      [axis.end]: target[axis.end] + withPlaceholder.increasedBy[axis.line]
    };
  }
  return target;
};
const clip = (target, frame) => {
  if (frame && frame.shouldClipSubject) {
    return executeClip(frame.pageMarginBox, target);
  }
  return cssBoxModel.getRect(target);
};
var getSubject = ({
  page,
  withPlaceholder,
  axis,
  frame
}) => {
  const scrolled = scroll$1(page.marginBox, frame);
  const increased = increase(scrolled, axis, withPlaceholder);
  const clipped = clip(increased, frame);
  return {
    page,
    withPlaceholder,
    active: clipped
  };
};

var scrollDroppable = (droppable, newScroll) => {
  !droppable.frame ? process.env.NODE_ENV !== "production" ? invariant() : invariant() : void 0;
  const scrollable = droppable.frame;
  const scrollDiff = subtract(newScroll, scrollable.scroll.initial);
  const scrollDisplacement = negate(scrollDiff);
  const frame = {
    ...scrollable,
    scroll: {
      initial: scrollable.scroll.initial,
      current: newScroll,
      diff: {
        value: scrollDiff,
        displacement: scrollDisplacement
      },
      max: scrollable.scroll.max
    }
  };
  const subject = getSubject({
    page: droppable.subject.page,
    withPlaceholder: droppable.subject.withPlaceholder,
    axis: droppable.axis,
    frame
  });
  const result = {
    ...droppable,
    frame,
    subject
  };
  return result;
};

function memoizeOne(resultFn, isEqual = areInputsEqual) {
  let cache = null;
  function memoized(...newArgs) {
    if (cache && cache.lastThis === this && isEqual(newArgs, cache.lastArgs)) {
      return cache.lastResult;
    }
    const lastResult = resultFn.apply(this, newArgs);
    cache = {
      lastResult,
      lastArgs: newArgs,
      lastThis: this
    };
    return lastResult;
  }
  memoized.clear = function clear() {
    cache = null;
  };
  return memoized;
}

const toDroppableMap = memoizeOne(droppables => droppables.reduce((previous, current) => {
  previous[current.descriptor.id] = current;
  return previous;
}, {}));
const toDraggableMap = memoizeOne(draggables => draggables.reduce((previous, current) => {
  previous[current.descriptor.id] = current;
  return previous;
}, {}));
const toDroppableList = memoizeOne(droppables => Object.values(droppables));
const toDraggableList = memoizeOne(draggables => Object.values(draggables));

var getDraggablesInsideDroppable = memoizeOne((droppableId, draggables) => {
  const result = toDraggableList(draggables).filter(draggable => droppableId === draggable.descriptor.droppableId).sort((a, b) => a.descriptor.index - b.descriptor.index);
  return result;
});

function tryGetDestination(impact) {
  if (impact.at && impact.at.type === 'REORDER') {
    return impact.at.destination;
  }
  return null;
}
function tryGetCombine(impact) {
  if (impact.at && impact.at.type === 'COMBINE') {
    return impact.at.combine;
  }
  return null;
}

var removeDraggableFromList = memoizeOne((remove, list) => list.filter(item => item.descriptor.id !== remove.descriptor.id));

var moveToNextCombine = ({
  isMovingForward,
  draggable,
  destination,
  insideDestination,
  previousImpact
}) => {
  if (!destination.isCombineEnabled) {
    return null;
  }
  const location = tryGetDestination(previousImpact);
  if (!location) {
    return null;
  }
  function getImpact(target) {
    const at = {
      type: 'COMBINE',
      combine: {
        draggableId: target,
        droppableId: destination.descriptor.id
      }
    };
    return {
      ...previousImpact,
      at
    };
  }
  const all = previousImpact.displaced.all;
  const closestId = all.length ? all[0] : null;
  if (isMovingForward) {
    return closestId ? getImpact(closestId) : null;
  }
  const withoutDraggable = removeDraggableFromList(draggable, insideDestination);
  if (!closestId) {
    if (!withoutDraggable.length) {
      return null;
    }
    const last = withoutDraggable[withoutDraggable.length - 1];
    return getImpact(last.descriptor.id);
  }
  const indexOfClosest = withoutDraggable.findIndex(d => d.descriptor.id === closestId);
  !(indexOfClosest !== -1) ? process.env.NODE_ENV !== "production" ? invariant(false, 'Could not find displaced item in set') : invariant() : void 0;
  const proposedIndex = indexOfClosest - 1;
  if (proposedIndex < 0) {
    return null;
  }
  const before = withoutDraggable[proposedIndex];
  return getImpact(before.descriptor.id);
};

var isHomeOf = (draggable, destination) => draggable.descriptor.droppableId === destination.descriptor.id;

const noDisplacedBy = {
  point: origin,
  value: 0
};
const emptyGroups = {
  invisible: {},
  visible: {},
  all: []
};
const noImpact = {
  displaced: emptyGroups,
  displacedBy: noDisplacedBy,
  at: null
};

var isWithin = (lowerBound, upperBound) => value => lowerBound <= value && value <= upperBound;

var isPartiallyVisibleThroughFrame = frame => {
  const isWithinVertical = isWithin(frame.top, frame.bottom);
  const isWithinHorizontal = isWithin(frame.left, frame.right);
  return subject => {
    const isContained = isWithinVertical(subject.top) && isWithinVertical(subject.bottom) && isWithinHorizontal(subject.left) && isWithinHorizontal(subject.right);
    if (isContained) {
      return true;
    }
    const isPartiallyVisibleVertically = isWithinVertical(subject.top) || isWithinVertical(subject.bottom);
    const isPartiallyVisibleHorizontally = isWithinHorizontal(subject.left) || isWithinHorizontal(subject.right);
    const isPartiallyContained = isPartiallyVisibleVertically && isPartiallyVisibleHorizontally;
    if (isPartiallyContained) {
      return true;
    }
    const isBiggerVertically = subject.top < frame.top && subject.bottom > frame.bottom;
    const isBiggerHorizontally = subject.left < frame.left && subject.right > frame.right;
    const isTargetBiggerThanFrame = isBiggerVertically && isBiggerHorizontally;
    if (isTargetBiggerThanFrame) {
      return true;
    }
    const isTargetBiggerOnOneAxis = isBiggerVertically && isPartiallyVisibleHorizontally || isBiggerHorizontally && isPartiallyVisibleVertically;
    return isTargetBiggerOnOneAxis;
  };
};

var isTotallyVisibleThroughFrame = frame => {
  const isWithinVertical = isWithin(frame.top, frame.bottom);
  const isWithinHorizontal = isWithin(frame.left, frame.right);
  return subject => {
    const isContained = isWithinVertical(subject.top) && isWithinVertical(subject.bottom) && isWithinHorizontal(subject.left) && isWithinHorizontal(subject.right);
    return isContained;
  };
};

const vertical = {
  direction: 'vertical',
  line: 'y',
  crossAxisLine: 'x',
  start: 'top',
  end: 'bottom',
  size: 'height',
  crossAxisStart: 'left',
  crossAxisEnd: 'right',
  crossAxisSize: 'width'
};
const horizontal = {
  direction: 'horizontal',
  line: 'x',
  crossAxisLine: 'y',
  start: 'left',
  end: 'right',
  size: 'width',
  crossAxisStart: 'top',
  crossAxisEnd: 'bottom',
  crossAxisSize: 'height'
};

var isTotallyVisibleThroughFrameOnAxis = axis => frame => {
  const isWithinVertical = isWithin(frame.top, frame.bottom);
  const isWithinHorizontal = isWithin(frame.left, frame.right);
  return subject => {
    if (axis === vertical) {
      return isWithinVertical(subject.top) && isWithinVertical(subject.bottom);
    }
    return isWithinHorizontal(subject.left) && isWithinHorizontal(subject.right);
  };
};

const getDroppableDisplaced = (target, destination) => {
  const displacement = destination.frame ? destination.frame.scroll.diff.displacement : origin;
  return offsetByPosition(target, displacement);
};
const isVisibleInDroppable = (target, destination, isVisibleThroughFrameFn) => {
  if (!destination.subject.active) {
    return false;
  }
  return isVisibleThroughFrameFn(destination.subject.active)(target);
};
const isVisibleInViewport = (target, viewport, isVisibleThroughFrameFn) => isVisibleThroughFrameFn(viewport)(target);
const isVisible$1 = ({
  target: toBeDisplaced,
  destination,
  viewport,
  withDroppableDisplacement,
  isVisibleThroughFrameFn
}) => {
  const displacedTarget = withDroppableDisplacement ? getDroppableDisplaced(toBeDisplaced, destination) : toBeDisplaced;
  return isVisibleInDroppable(displacedTarget, destination, isVisibleThroughFrameFn) && isVisibleInViewport(displacedTarget, viewport, isVisibleThroughFrameFn);
};
const isPartiallyVisible = args => isVisible$1({
  ...args,
  isVisibleThroughFrameFn: isPartiallyVisibleThroughFrame
});
const isTotallyVisible = args => isVisible$1({
  ...args,
  isVisibleThroughFrameFn: isTotallyVisibleThroughFrame
});
const isTotallyVisibleOnAxis = args => isVisible$1({
  ...args,
  isVisibleThroughFrameFn: isTotallyVisibleThroughFrameOnAxis(args.destination.axis)
});

const getShouldAnimate = (id, last, forceShouldAnimate) => {
  if (typeof forceShouldAnimate === 'boolean') {
    return forceShouldAnimate;
  }
  if (!last) {
    return true;
  }
  const {
    invisible,
    visible
  } = last;
  if (invisible[id]) {
    return false;
  }
  const previous = visible[id];
  return previous ? previous.shouldAnimate : true;
};
function getTarget(draggable, displacedBy) {
  const marginBox = draggable.page.marginBox;
  const expandBy = {
    top: displacedBy.point.y,
    right: 0,
    bottom: 0,
    left: displacedBy.point.x
  };
  return cssBoxModel.getRect(cssBoxModel.expand(marginBox, expandBy));
}
function getDisplacementGroups({
  afterDragging,
  destination,
  displacedBy,
  viewport,
  forceShouldAnimate,
  last
}) {
  return afterDragging.reduce(function process(groups, draggable) {
    const target = getTarget(draggable, displacedBy);
    const id = draggable.descriptor.id;
    groups.all.push(id);
    const isVisible = isPartiallyVisible({
      target,
      destination,
      viewport,
      withDroppableDisplacement: true
    });
    if (!isVisible) {
      groups.invisible[draggable.descriptor.id] = true;
      return groups;
    }
    const shouldAnimate = getShouldAnimate(id, last, forceShouldAnimate);
    const displacement = {
      draggableId: id,
      shouldAnimate
    };
    groups.visible[id] = displacement;
    return groups;
  }, {
    all: [],
    visible: {},
    invisible: {}
  });
}

function getIndexOfLastItem(draggables, options) {
  if (!draggables.length) {
    return 0;
  }
  const indexOfLastItem = draggables[draggables.length - 1].descriptor.index;
  return options.inHomeList ? indexOfLastItem : indexOfLastItem + 1;
}
function goAtEnd({
  insideDestination,
  inHomeList,
  displacedBy,
  destination
}) {
  const newIndex = getIndexOfLastItem(insideDestination, {
    inHomeList
  });
  return {
    displaced: emptyGroups,
    displacedBy,
    at: {
      type: 'REORDER',
      destination: {
        droppableId: destination.descriptor.id,
        index: newIndex
      }
    }
  };
}
function calculateReorderImpact({
  draggable,
  insideDestination,
  destination,
  viewport,
  displacedBy,
  last,
  index,
  forceShouldAnimate
}) {
  const inHomeList = isHomeOf(draggable, destination);
  if (index == null) {
    return goAtEnd({
      insideDestination,
      inHomeList,
      displacedBy,
      destination
    });
  }
  const match = insideDestination.find(item => item.descriptor.index === index);
  if (!match) {
    return goAtEnd({
      insideDestination,
      inHomeList,
      displacedBy,
      destination
    });
  }
  const withoutDragging = removeDraggableFromList(draggable, insideDestination);
  const sliceFrom = insideDestination.indexOf(match);
  const impacted = withoutDragging.slice(sliceFrom);
  const displaced = getDisplacementGroups({
    afterDragging: impacted,
    destination,
    displacedBy,
    last,
    viewport: viewport.frame,
    forceShouldAnimate
  });
  return {
    displaced,
    displacedBy,
    at: {
      type: 'REORDER',
      destination: {
        droppableId: destination.descriptor.id,
        index
      }
    }
  };
}

function didStartAfterCritical(draggableId, afterCritical) {
  return Boolean(afterCritical.effected[draggableId]);
}

var fromCombine = ({
  isMovingForward,
  destination,
  draggables,
  combine,
  afterCritical
}) => {
  if (!destination.isCombineEnabled) {
    return null;
  }
  const combineId = combine.draggableId;
  const combineWith = draggables[combineId];
  const combineWithIndex = combineWith.descriptor.index;
  const didCombineWithStartAfterCritical = didStartAfterCritical(combineId, afterCritical);
  if (didCombineWithStartAfterCritical) {
    if (isMovingForward) {
      return combineWithIndex;
    }
    return combineWithIndex - 1;
  }
  if (isMovingForward) {
    return combineWithIndex + 1;
  }
  return combineWithIndex;
};

var fromReorder = ({
  isMovingForward,
  isInHomeList,
  insideDestination,
  location
}) => {
  if (!insideDestination.length) {
    return null;
  }
  const currentIndex = location.index;
  const proposedIndex = isMovingForward ? currentIndex + 1 : currentIndex - 1;
  const firstIndex = insideDestination[0].descriptor.index;
  const lastIndex = insideDestination[insideDestination.length - 1].descriptor.index;
  const upperBound = isInHomeList ? lastIndex : lastIndex + 1;
  if (proposedIndex < firstIndex) {
    return null;
  }
  if (proposedIndex > upperBound) {
    return null;
  }
  return proposedIndex;
};

var moveToNextIndex = ({
  isMovingForward,
  isInHomeList,
  draggable,
  draggables,
  destination,
  insideDestination,
  previousImpact,
  viewport,
  afterCritical
}) => {
  const wasAt = previousImpact.at;
  !wasAt ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot move in direction without previous impact location') : invariant() : void 0;
  if (wasAt.type === 'REORDER') {
    const newIndex = fromReorder({
      isMovingForward,
      isInHomeList,
      location: wasAt.destination,
      insideDestination
    });
    if (newIndex == null) {
      return null;
    }
    return calculateReorderImpact({
      draggable,
      insideDestination,
      destination,
      viewport,
      last: previousImpact.displaced,
      displacedBy: previousImpact.displacedBy,
      index: newIndex
    });
  }
  const newIndex = fromCombine({
    isMovingForward,
    destination,
    displaced: previousImpact.displaced,
    draggables,
    combine: wasAt.combine,
    afterCritical
  });
  if (newIndex == null) {
    return null;
  }
  return calculateReorderImpact({
    draggable,
    insideDestination,
    destination,
    viewport,
    last: previousImpact.displaced,
    displacedBy: previousImpact.displacedBy,
    index: newIndex
  });
};

var getCombinedItemDisplacement = ({
  displaced,
  afterCritical,
  combineWith,
  displacedBy
}) => {
  const isDisplaced = Boolean(displaced.visible[combineWith] || displaced.invisible[combineWith]);
  if (didStartAfterCritical(combineWith, afterCritical)) {
    return isDisplaced ? origin : negate(displacedBy.point);
  }
  return isDisplaced ? displacedBy.point : origin;
};

var whenCombining = ({
  afterCritical,
  impact,
  draggables
}) => {
  const combine = tryGetCombine(impact);
  !combine ? process.env.NODE_ENV !== "production" ? invariant() : invariant() : void 0;
  const combineWith = combine.draggableId;
  const center = draggables[combineWith].page.borderBox.center;
  const displaceBy = getCombinedItemDisplacement({
    displaced: impact.displaced,
    afterCritical,
    combineWith,
    displacedBy: impact.displacedBy
  });
  return add(center, displaceBy);
};

const distanceFromStartToBorderBoxCenter = (axis, box) => box.margin[axis.start] + box.borderBox[axis.size] / 2;
const distanceFromEndToBorderBoxCenter = (axis, box) => box.margin[axis.end] + box.borderBox[axis.size] / 2;
const getCrossAxisBorderBoxCenter = (axis, target, isMoving) => target[axis.crossAxisStart] + isMoving.margin[axis.crossAxisStart] + isMoving.borderBox[axis.crossAxisSize] / 2;
const goAfter = ({
  axis,
  moveRelativeTo,
  isMoving
}) => patch(axis.line, moveRelativeTo.marginBox[axis.end] + distanceFromStartToBorderBoxCenter(axis, isMoving), getCrossAxisBorderBoxCenter(axis, moveRelativeTo.marginBox, isMoving));
const goBefore = ({
  axis,
  moveRelativeTo,
  isMoving
}) => patch(axis.line, moveRelativeTo.marginBox[axis.start] - distanceFromEndToBorderBoxCenter(axis, isMoving), getCrossAxisBorderBoxCenter(axis, moveRelativeTo.marginBox, isMoving));
const goIntoStart = ({
  axis,
  moveInto,
  isMoving
}) => patch(axis.line, moveInto.contentBox[axis.start] + distanceFromStartToBorderBoxCenter(axis, isMoving), getCrossAxisBorderBoxCenter(axis, moveInto.contentBox, isMoving));

var whenReordering = ({
  impact,
  draggable,
  draggables,
  droppable,
  afterCritical
}) => {
  const insideDestination = getDraggablesInsideDroppable(droppable.descriptor.id, draggables);
  const draggablePage = draggable.page;
  const axis = droppable.axis;
  if (!insideDestination.length) {
    return goIntoStart({
      axis,
      moveInto: droppable.page,
      isMoving: draggablePage
    });
  }
  const {
    displaced,
    displacedBy
  } = impact;
  const closestAfter = displaced.all[0];
  if (closestAfter) {
    const closest = draggables[closestAfter];
    if (didStartAfterCritical(closestAfter, afterCritical)) {
      return goBefore({
        axis,
        moveRelativeTo: closest.page,
        isMoving: draggablePage
      });
    }
    const withDisplacement = cssBoxModel.offset(closest.page, displacedBy.point);
    return goBefore({
      axis,
      moveRelativeTo: withDisplacement,
      isMoving: draggablePage
    });
  }
  const last = insideDestination[insideDestination.length - 1];
  if (last.descriptor.id === draggable.descriptor.id) {
    return draggablePage.borderBox.center;
  }
  if (didStartAfterCritical(last.descriptor.id, afterCritical)) {
    const page = cssBoxModel.offset(last.page, negate(afterCritical.displacedBy.point));
    return goAfter({
      axis,
      moveRelativeTo: page,
      isMoving: draggablePage
    });
  }
  return goAfter({
    axis,
    moveRelativeTo: last.page,
    isMoving: draggablePage
  });
};

var withDroppableDisplacement = (droppable, point) => {
  const frame = droppable.frame;
  if (!frame) {
    return point;
  }
  return add(point, frame.scroll.diff.displacement);
};

const getResultWithoutDroppableDisplacement = ({
  impact,
  draggable,
  droppable,
  draggables,
  afterCritical
}) => {
  const original = draggable.page.borderBox.center;
  const at = impact.at;
  if (!droppable) {
    return original;
  }
  if (!at) {
    return original;
  }
  if (at.type === 'REORDER') {
    return whenReordering({
      impact,
      draggable,
      draggables,
      droppable,
      afterCritical
    });
  }
  return whenCombining({
    impact,
    draggables,
    afterCritical
  });
};
var getPageBorderBoxCenterFromImpact = args => {
  const withoutDisplacement = getResultWithoutDroppableDisplacement(args);
  const droppable = args.droppable;
  const withDisplacement = droppable ? withDroppableDisplacement(droppable, withoutDisplacement) : withoutDisplacement;
  return withDisplacement;
};

var scrollViewport = (viewport, newScroll) => {
  const diff = subtract(newScroll, viewport.scroll.initial);
  const displacement = negate(diff);
  const frame = cssBoxModel.getRect({
    top: newScroll.y,
    bottom: newScroll.y + viewport.frame.height,
    left: newScroll.x,
    right: newScroll.x + viewport.frame.width
  });
  const updated = {
    frame,
    scroll: {
      initial: viewport.scroll.initial,
      max: viewport.scroll.max,
      current: newScroll,
      diff: {
        value: diff,
        displacement
      }
    }
  };
  return updated;
};

function getDraggables$1(ids, draggables) {
  return ids.map(id => draggables[id]);
}
function tryGetVisible(id, groups) {
  for (let i = 0; i < groups.length; i++) {
    const displacement = groups[i].visible[id];
    if (displacement) {
      return displacement;
    }
  }
  return null;
}
var speculativelyIncrease = ({
  impact,
  viewport,
  destination,
  draggables,
  maxScrollChange
}) => {
  const scrolledViewport = scrollViewport(viewport, add(viewport.scroll.current, maxScrollChange));
  const scrolledDroppable = destination.frame ? scrollDroppable(destination, add(destination.frame.scroll.current, maxScrollChange)) : destination;
  const last = impact.displaced;
  const withViewportScroll = getDisplacementGroups({
    afterDragging: getDraggables$1(last.all, draggables),
    destination,
    displacedBy: impact.displacedBy,
    viewport: scrolledViewport.frame,
    last,
    forceShouldAnimate: false
  });
  const withDroppableScroll = getDisplacementGroups({
    afterDragging: getDraggables$1(last.all, draggables),
    destination: scrolledDroppable,
    displacedBy: impact.displacedBy,
    viewport: viewport.frame,
    last,
    forceShouldAnimate: false
  });
  const invisible = {};
  const visible = {};
  const groups = [last, withViewportScroll, withDroppableScroll];
  last.all.forEach(id => {
    const displacement = tryGetVisible(id, groups);
    if (displacement) {
      visible[id] = displacement;
      return;
    }
    invisible[id] = true;
  });
  const newImpact = {
    ...impact,
    displaced: {
      all: last.all,
      invisible,
      visible
    }
  };
  return newImpact;
};

var withViewportDisplacement = (viewport, point) => add(viewport.scroll.diff.displacement, point);

var getClientFromPageBorderBoxCenter = ({
  pageBorderBoxCenter,
  draggable,
  viewport
}) => {
  const withoutPageScrollChange = withViewportDisplacement(viewport, pageBorderBoxCenter);
  const offset = subtract(withoutPageScrollChange, draggable.page.borderBox.center);
  return add(draggable.client.borderBox.center, offset);
};

var isTotallyVisibleInNewLocation = ({
  draggable,
  destination,
  newPageBorderBoxCenter,
  viewport,
  withDroppableDisplacement,
  onlyOnMainAxis = false
}) => {
  const changeNeeded = subtract(newPageBorderBoxCenter, draggable.page.borderBox.center);
  const shifted = offsetByPosition(draggable.page.borderBox, changeNeeded);
  const args = {
    target: shifted,
    destination,
    withDroppableDisplacement,
    viewport
  };
  return onlyOnMainAxis ? isTotallyVisibleOnAxis(args) : isTotallyVisible(args);
};

var moveToNextPlace = ({
  isMovingForward,
  draggable,
  destination,
  draggables,
  previousImpact,
  viewport,
  previousPageBorderBoxCenter,
  previousClientSelection,
  afterCritical
}) => {
  if (!destination.isEnabled) {
    return null;
  }
  const insideDestination = getDraggablesInsideDroppable(destination.descriptor.id, draggables);
  const isInHomeList = isHomeOf(draggable, destination);
  const impact = moveToNextCombine({
    isMovingForward,
    draggable,
    destination,
    insideDestination,
    previousImpact
  }) || moveToNextIndex({
    isMovingForward,
    isInHomeList,
    draggable,
    draggables,
    destination,
    insideDestination,
    previousImpact,
    viewport,
    afterCritical
  });
  if (!impact) {
    return null;
  }
  const pageBorderBoxCenter = getPageBorderBoxCenterFromImpact({
    impact,
    draggable,
    droppable: destination,
    draggables,
    afterCritical
  });
  const isVisibleInNewLocation = isTotallyVisibleInNewLocation({
    draggable,
    destination,
    newPageBorderBoxCenter: pageBorderBoxCenter,
    viewport: viewport.frame,
    withDroppableDisplacement: false,
    onlyOnMainAxis: true
  });
  if (isVisibleInNewLocation) {
    const clientSelection = getClientFromPageBorderBoxCenter({
      pageBorderBoxCenter,
      draggable,
      viewport
    });
    return {
      clientSelection,
      impact,
      scrollJumpRequest: null
    };
  }
  const distance = subtract(pageBorderBoxCenter, previousPageBorderBoxCenter);
  const cautious = speculativelyIncrease({
    impact,
    viewport,
    destination,
    draggables,
    maxScrollChange: distance
  });
  return {
    clientSelection: previousClientSelection,
    impact: cautious,
    scrollJumpRequest: distance
  };
};

const getKnownActive = droppable => {
  const rect = droppable.subject.active;
  !rect ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot get clipped area from droppable') : invariant() : void 0;
  return rect;
};
var getBestCrossAxisDroppable = ({
  isMovingForward,
  pageBorderBoxCenter,
  source,
  droppables,
  viewport
}) => {
  const active = source.subject.active;
  if (!active) {
    return null;
  }
  const axis = source.axis;
  const isBetweenSourceClipped = isWithin(active[axis.start], active[axis.end]);
  const candidates = toDroppableList(droppables).filter(droppable => droppable !== source).filter(droppable => droppable.isEnabled).filter(droppable => Boolean(droppable.subject.active)).filter(droppable => isPartiallyVisibleThroughFrame(viewport.frame)(getKnownActive(droppable))).filter(droppable => {
    const activeOfTarget = getKnownActive(droppable);
    if (isMovingForward) {
      return active[axis.crossAxisEnd] < activeOfTarget[axis.crossAxisEnd];
    }
    return activeOfTarget[axis.crossAxisStart] < active[axis.crossAxisStart];
  }).filter(droppable => {
    const activeOfTarget = getKnownActive(droppable);
    const isBetweenDestinationClipped = isWithin(activeOfTarget[axis.start], activeOfTarget[axis.end]);
    return isBetweenSourceClipped(activeOfTarget[axis.start]) || isBetweenSourceClipped(activeOfTarget[axis.end]) || isBetweenDestinationClipped(active[axis.start]) || isBetweenDestinationClipped(active[axis.end]);
  }).sort((a, b) => {
    const first = getKnownActive(a)[axis.crossAxisStart];
    const second = getKnownActive(b)[axis.crossAxisStart];
    if (isMovingForward) {
      return first - second;
    }
    return second - first;
  }).filter((droppable, index, array) => getKnownActive(droppable)[axis.crossAxisStart] === getKnownActive(array[0])[axis.crossAxisStart]);
  if (!candidates.length) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }
  const contains = candidates.filter(droppable => {
    const isWithinDroppable = isWithin(getKnownActive(droppable)[axis.start], getKnownActive(droppable)[axis.end]);
    return isWithinDroppable(pageBorderBoxCenter[axis.line]);
  });
  if (contains.length === 1) {
    return contains[0];
  }
  if (contains.length > 1) {
    return contains.sort((a, b) => getKnownActive(a)[axis.start] - getKnownActive(b)[axis.start])[0];
  }
  return candidates.sort((a, b) => {
    const first = closest$1(pageBorderBoxCenter, getCorners(getKnownActive(a)));
    const second = closest$1(pageBorderBoxCenter, getCorners(getKnownActive(b)));
    if (first !== second) {
      return first - second;
    }
    return getKnownActive(a)[axis.start] - getKnownActive(b)[axis.start];
  })[0];
};

const getCurrentPageBorderBoxCenter = (draggable, afterCritical) => {
  const original = draggable.page.borderBox.center;
  return didStartAfterCritical(draggable.descriptor.id, afterCritical) ? subtract(original, afterCritical.displacedBy.point) : original;
};
const getCurrentPageBorderBox = (draggable, afterCritical) => {
  const original = draggable.page.borderBox;
  return didStartAfterCritical(draggable.descriptor.id, afterCritical) ? offsetByPosition(original, negate(afterCritical.displacedBy.point)) : original;
};

var getClosestDraggable = ({
  pageBorderBoxCenter,
  viewport,
  destination,
  insideDestination,
  afterCritical
}) => {
  const sorted = insideDestination.filter(draggable => isTotallyVisible({
    target: getCurrentPageBorderBox(draggable, afterCritical),
    destination,
    viewport: viewport.frame,
    withDroppableDisplacement: true
  })).sort((a, b) => {
    const distanceToA = distance(pageBorderBoxCenter, withDroppableDisplacement(destination, getCurrentPageBorderBoxCenter(a, afterCritical)));
    const distanceToB = distance(pageBorderBoxCenter, withDroppableDisplacement(destination, getCurrentPageBorderBoxCenter(b, afterCritical)));
    if (distanceToA < distanceToB) {
      return -1;
    }
    if (distanceToB < distanceToA) {
      return 1;
    }
    return a.descriptor.index - b.descriptor.index;
  });
  return sorted[0] || null;
};

var getDisplacedBy = memoizeOne(function getDisplacedBy(axis, displaceBy) {
  const displacement = displaceBy[axis.line];
  return {
    value: displacement,
    point: patch(axis.line, displacement)
  };
});

const getRequiredGrowthForPlaceholder = (droppable, placeholderSize, draggables) => {
  const axis = droppable.axis;
  if (droppable.descriptor.mode === 'virtual') {
    return patch(axis.line, placeholderSize[axis.line]);
  }
  const availableSpace = droppable.subject.page.contentBox[axis.size];
  const insideDroppable = getDraggablesInsideDroppable(droppable.descriptor.id, draggables);
  const spaceUsed = insideDroppable.reduce((sum, dimension) => sum + dimension.client.marginBox[axis.size], 0);
  const requiredSpace = spaceUsed + placeholderSize[axis.line];
  const needsToGrowBy = requiredSpace - availableSpace;
  if (needsToGrowBy <= 0) {
    return null;
  }
  return patch(axis.line, needsToGrowBy);
};
const withMaxScroll = (frame, max) => ({
  ...frame,
  scroll: {
    ...frame.scroll,
    max
  }
});
const addPlaceholder = (droppable, draggable, draggables) => {
  const frame = droppable.frame;
  !!isHomeOf(draggable, droppable) ? process.env.NODE_ENV !== "production" ? invariant(false, 'Should not add placeholder space to home list') : invariant() : void 0;
  !!droppable.subject.withPlaceholder ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot add placeholder size to a subject when it already has one') : invariant() : void 0;
  const placeholderSize = getDisplacedBy(droppable.axis, draggable.displaceBy).point;
  const requiredGrowth = getRequiredGrowthForPlaceholder(droppable, placeholderSize, draggables);
  const added = {
    placeholderSize,
    increasedBy: requiredGrowth,
    oldFrameMaxScroll: droppable.frame ? droppable.frame.scroll.max : null
  };
  if (!frame) {
    const subject = getSubject({
      page: droppable.subject.page,
      withPlaceholder: added,
      axis: droppable.axis,
      frame: droppable.frame
    });
    return {
      ...droppable,
      subject
    };
  }
  const maxScroll = requiredGrowth ? add(frame.scroll.max, requiredGrowth) : frame.scroll.max;
  const newFrame = withMaxScroll(frame, maxScroll);
  const subject = getSubject({
    page: droppable.subject.page,
    withPlaceholder: added,
    axis: droppable.axis,
    frame: newFrame
  });
  return {
    ...droppable,
    subject,
    frame: newFrame
  };
};
const removePlaceholder = droppable => {
  const added = droppable.subject.withPlaceholder;
  !added ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot remove placeholder form subject when there was none') : invariant() : void 0;
  const frame = droppable.frame;
  if (!frame) {
    const subject = getSubject({
      page: droppable.subject.page,
      axis: droppable.axis,
      frame: null,
      withPlaceholder: null
    });
    return {
      ...droppable,
      subject
    };
  }
  const oldMaxScroll = added.oldFrameMaxScroll;
  !oldMaxScroll ? process.env.NODE_ENV !== "production" ? invariant(false, 'Expected droppable with frame to have old max frame scroll when removing placeholder') : invariant() : void 0;
  const newFrame = withMaxScroll(frame, oldMaxScroll);
  const subject = getSubject({
    page: droppable.subject.page,
    axis: droppable.axis,
    frame: newFrame,
    withPlaceholder: null
  });
  return {
    ...droppable,
    subject,
    frame: newFrame
  };
};

var moveToNewDroppable = ({
  previousPageBorderBoxCenter,
  moveRelativeTo,
  insideDestination,
  draggable,
  draggables,
  destination,
  viewport,
  afterCritical
}) => {
  if (!moveRelativeTo) {
    if (insideDestination.length) {
      return null;
    }
    const proposed = {
      displaced: emptyGroups,
      displacedBy: noDisplacedBy,
      at: {
        type: 'REORDER',
        destination: {
          droppableId: destination.descriptor.id,
          index: 0
        }
      }
    };
    const proposedPageBorderBoxCenter = getPageBorderBoxCenterFromImpact({
      impact: proposed,
      draggable,
      droppable: destination,
      draggables,
      afterCritical
    });
    const withPlaceholder = isHomeOf(draggable, destination) ? destination : addPlaceholder(destination, draggable, draggables);
    const isVisibleInNewLocation = isTotallyVisibleInNewLocation({
      draggable,
      destination: withPlaceholder,
      newPageBorderBoxCenter: proposedPageBorderBoxCenter,
      viewport: viewport.frame,
      withDroppableDisplacement: false,
      onlyOnMainAxis: true
    });
    return isVisibleInNewLocation ? proposed : null;
  }
  const isGoingBeforeTarget = Boolean(previousPageBorderBoxCenter[destination.axis.line] <= moveRelativeTo.page.borderBox.center[destination.axis.line]);
  const proposedIndex = (() => {
    const relativeTo = moveRelativeTo.descriptor.index;
    if (moveRelativeTo.descriptor.id === draggable.descriptor.id) {
      return relativeTo;
    }
    if (isGoingBeforeTarget) {
      return relativeTo;
    }
    return relativeTo + 1;
  })();
  const displacedBy = getDisplacedBy(destination.axis, draggable.displaceBy);
  return calculateReorderImpact({
    draggable,
    insideDestination,
    destination,
    viewport,
    displacedBy,
    last: emptyGroups,
    index: proposedIndex
  });
};

var moveCrossAxis = ({
  isMovingForward,
  previousPageBorderBoxCenter,
  draggable,
  isOver,
  draggables,
  droppables,
  viewport,
  afterCritical
}) => {
  const destination = getBestCrossAxisDroppable({
    isMovingForward,
    pageBorderBoxCenter: previousPageBorderBoxCenter,
    source: isOver,
    droppables,
    viewport
  });
  if (!destination) {
    return null;
  }
  const insideDestination = getDraggablesInsideDroppable(destination.descriptor.id, draggables);
  const moveRelativeTo = getClosestDraggable({
    pageBorderBoxCenter: previousPageBorderBoxCenter,
    viewport,
    destination,
    insideDestination,
    afterCritical
  });
  const impact = moveToNewDroppable({
    previousPageBorderBoxCenter,
    destination,
    draggable,
    draggables,
    moveRelativeTo,
    insideDestination,
    viewport,
    afterCritical
  });
  if (!impact) {
    return null;
  }
  const pageBorderBoxCenter = getPageBorderBoxCenterFromImpact({
    impact,
    draggable,
    droppable: destination,
    draggables,
    afterCritical
  });
  const clientSelection = getClientFromPageBorderBoxCenter({
    pageBorderBoxCenter,
    draggable,
    viewport
  });
  return {
    clientSelection,
    impact,
    scrollJumpRequest: null
  };
};

var whatIsDraggedOver = impact => {
  const at = impact.at;
  if (!at) {
    return null;
  }
  if (at.type === 'REORDER') {
    return at.destination.droppableId;
  }
  return at.combine.droppableId;
};

const getDroppableOver$1 = (impact, droppables) => {
  const id = whatIsDraggedOver(impact);
  return id ? droppables[id] : null;
};
var moveInDirection = ({
  state,
  type
}) => {
  const isActuallyOver = getDroppableOver$1(state.impact, state.dimensions.droppables);
  const isMainAxisMovementAllowed = Boolean(isActuallyOver);
  const home = state.dimensions.droppables[state.critical.droppable.id];
  const isOver = isActuallyOver || home;
  const direction = isOver.axis.direction;
  const isMovingOnMainAxis = direction === 'vertical' && (type === 'MOVE_UP' || type === 'MOVE_DOWN') || direction === 'horizontal' && (type === 'MOVE_LEFT' || type === 'MOVE_RIGHT');
  if (isMovingOnMainAxis && !isMainAxisMovementAllowed) {
    return null;
  }
  const isMovingForward = type === 'MOVE_DOWN' || type === 'MOVE_RIGHT';
  const draggable = state.dimensions.draggables[state.critical.draggable.id];
  const previousPageBorderBoxCenter = state.current.page.borderBoxCenter;
  const {
    draggables,
    droppables
  } = state.dimensions;
  return isMovingOnMainAxis ? moveToNextPlace({
    isMovingForward,
    previousPageBorderBoxCenter,
    draggable,
    destination: isOver,
    draggables,
    viewport: state.viewport,
    previousClientSelection: state.current.client.selection,
    previousImpact: state.impact,
    afterCritical: state.afterCritical
  }) : moveCrossAxis({
    isMovingForward,
    previousPageBorderBoxCenter,
    draggable,
    isOver,
    draggables,
    droppables,
    viewport: state.viewport,
    afterCritical: state.afterCritical
  });
};

function isMovementAllowed(state) {
  return state.phase === 'DRAGGING' || state.phase === 'COLLECTING';
}

function isPositionInFrame(frame) {
  const isWithinVertical = isWithin(frame.top, frame.bottom);
  const isWithinHorizontal = isWithin(frame.left, frame.right);
  return function run(point) {
    return isWithinVertical(point.y) && isWithinHorizontal(point.x);
  };
}

function getHasOverlap(first, second) {
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
}
function getFurthestAway({
  pageBorderBox,
  draggable,
  candidates
}) {
  const startCenter = draggable.page.borderBox.center;
  const sorted = candidates.map(candidate => {
    const axis = candidate.axis;
    const target = patch(candidate.axis.line, pageBorderBox.center[axis.line], candidate.page.borderBox.center[axis.crossAxisLine]);
    return {
      id: candidate.descriptor.id,
      distance: distance(startCenter, target)
    };
  }).sort((a, b) => b.distance - a.distance);
  return sorted[0] ? sorted[0].id : null;
}
function getDroppableOver({
  pageBorderBox,
  draggable,
  droppables
}) {
  const candidates = toDroppableList(droppables).filter(item => {
    if (!item.isEnabled) {
      return false;
    }
    const active = item.subject.active;
    if (!active) {
      return false;
    }
    if (!getHasOverlap(pageBorderBox, active)) {
      return false;
    }
    if (isPositionInFrame(active)(pageBorderBox.center)) {
      return true;
    }
    const axis = item.axis;
    const childCenter = active.center[axis.crossAxisLine];
    const crossAxisStart = pageBorderBox[axis.crossAxisStart];
    const crossAxisEnd = pageBorderBox[axis.crossAxisEnd];
    const isContained = isWithin(active[axis.crossAxisStart], active[axis.crossAxisEnd]);
    const isStartContained = isContained(crossAxisStart);
    const isEndContained = isContained(crossAxisEnd);
    if (!isStartContained && !isEndContained) {
      return true;
    }
    if (isStartContained) {
      return crossAxisStart < childCenter;
    }
    return crossAxisEnd > childCenter;
  });
  if (!candidates.length) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0].descriptor.id;
  }
  return getFurthestAway({
    pageBorderBox,
    draggable,
    candidates
  });
}

const offsetRectByPosition = (rect, point) => cssBoxModel.getRect(offsetByPosition(rect, point));

var withDroppableScroll = (droppable, area) => {
  const frame = droppable.frame;
  if (!frame) {
    return area;
  }
  return offsetRectByPosition(area, frame.scroll.diff.value);
};

function getIsDisplaced({
  displaced,
  id
}) {
  return Boolean(displaced.visible[id] || displaced.invisible[id]);
}

function atIndex({
  draggable,
  closest,
  inHomeList
}) {
  if (!closest) {
    return null;
  }
  if (!inHomeList) {
    return closest.descriptor.index;
  }
  if (closest.descriptor.index > draggable.descriptor.index) {
    return closest.descriptor.index - 1;
  }
  return closest.descriptor.index;
}
var getReorderImpact = ({
  pageBorderBoxWithDroppableScroll: targetRect,
  draggable,
  destination,
  insideDestination,
  last,
  viewport,
  afterCritical
}) => {
  const axis = destination.axis;
  const displacedBy = getDisplacedBy(destination.axis, draggable.displaceBy);
  const displacement = displacedBy.value;
  const targetStart = targetRect[axis.start];
  const targetEnd = targetRect[axis.end];
  const withoutDragging = removeDraggableFromList(draggable, insideDestination);
  const closest = withoutDragging.find(child => {
    const id = child.descriptor.id;
    const childCenter = child.page.borderBox.center[axis.line];
    const didStartAfterCritical$1 = didStartAfterCritical(id, afterCritical);
    const isDisplaced = getIsDisplaced({
      displaced: last,
      id
    });
    if (didStartAfterCritical$1) {
      if (isDisplaced) {
        return targetEnd <= childCenter;
      }
      return targetStart < childCenter - displacement;
    }
    if (isDisplaced) {
      return targetEnd <= childCenter + displacement;
    }
    return targetStart < childCenter;
  }) || null;
  const newIndex = atIndex({
    draggable,
    closest,
    inHomeList: isHomeOf(draggable, destination)
  });
  return calculateReorderImpact({
    draggable,
    insideDestination,
    destination,
    viewport,
    last,
    displacedBy,
    index: newIndex
  });
};

const combineThresholdDivisor = 4;
var getCombineImpact = ({
  draggable,
  pageBorderBoxWithDroppableScroll: targetRect,
  previousImpact,
  destination,
  insideDestination,
  afterCritical
}) => {
  if (!destination.isCombineEnabled) {
    return null;
  }
  const axis = destination.axis;
  const displacedBy = getDisplacedBy(destination.axis, draggable.displaceBy);
  const displacement = displacedBy.value;
  const targetStart = targetRect[axis.start];
  const targetEnd = targetRect[axis.end];
  const withoutDragging = removeDraggableFromList(draggable, insideDestination);
  const combineWith = withoutDragging.find(child => {
    const id = child.descriptor.id;
    const childRect = child.page.borderBox;
    const childSize = childRect[axis.size];
    const threshold = childSize / combineThresholdDivisor;
    const didStartAfterCritical$1 = didStartAfterCritical(id, afterCritical);
    const isDisplaced = getIsDisplaced({
      displaced: previousImpact.displaced,
      id
    });
    if (didStartAfterCritical$1) {
      if (isDisplaced) {
        return targetEnd > childRect[axis.start] + threshold && targetEnd < childRect[axis.end] - threshold;
      }
      return targetStart > childRect[axis.start] - displacement + threshold && targetStart < childRect[axis.end] - displacement - threshold;
    }
    if (isDisplaced) {
      return targetEnd > childRect[axis.start] + displacement + threshold && targetEnd < childRect[axis.end] + displacement - threshold;
    }
    return targetStart > childRect[axis.start] + threshold && targetStart < childRect[axis.end] - threshold;
  });
  if (!combineWith) {
    return null;
  }
  const impact = {
    displacedBy,
    displaced: previousImpact.displaced,
    at: {
      type: 'COMBINE',
      combine: {
        draggableId: combineWith.descriptor.id,
        droppableId: destination.descriptor.id
      }
    }
  };
  return impact;
};

var getDragImpact = ({
  pageOffset,
  draggable,
  draggables,
  droppables,
  previousImpact,
  viewport,
  afterCritical
}) => {
  const pageBorderBox = offsetRectByPosition(draggable.page.borderBox, pageOffset);
  const destinationId = getDroppableOver({
    pageBorderBox,
    draggable,
    droppables
  });
  if (!destinationId) {
    return noImpact;
  }
  const destination = droppables[destinationId];
  const insideDestination = getDraggablesInsideDroppable(destination.descriptor.id, draggables);
  const pageBorderBoxWithDroppableScroll = withDroppableScroll(destination, pageBorderBox);
  return getCombineImpact({
    pageBorderBoxWithDroppableScroll,
    draggable,
    previousImpact,
    destination,
    insideDestination,
    afterCritical
  }) || getReorderImpact({
    pageBorderBoxWithDroppableScroll,
    draggable,
    destination,
    insideDestination,
    last: previousImpact.displaced,
    viewport,
    afterCritical
  });
};

var patchDroppableMap = (droppables, updated) => ({
  ...droppables,
  [updated.descriptor.id]: updated
});

const clearUnusedPlaceholder = ({
  previousImpact,
  impact,
  droppables
}) => {
  const last = whatIsDraggedOver(previousImpact);
  const now = whatIsDraggedOver(impact);
  if (!last) {
    return droppables;
  }
  if (last === now) {
    return droppables;
  }
  const lastDroppable = droppables[last];
  if (!lastDroppable.subject.withPlaceholder) {
    return droppables;
  }
  const updated = removePlaceholder(lastDroppable);
  return patchDroppableMap(droppables, updated);
};
var recomputePlaceholders = ({
  draggable,
  draggables,
  droppables,
  previousImpact,
  impact
}) => {
  const cleaned = clearUnusedPlaceholder({
    previousImpact,
    impact,
    droppables
  });
  const isOver = whatIsDraggedOver(impact);
  if (!isOver) {
    return cleaned;
  }
  const droppable = droppables[isOver];
  if (isHomeOf(draggable, droppable)) {
    return cleaned;
  }
  if (droppable.subject.withPlaceholder) {
    return cleaned;
  }
  const patched = addPlaceholder(droppable, draggable, draggables);
  return patchDroppableMap(cleaned, patched);
};

var update = ({
  state,
  clientSelection: forcedClientSelection,
  dimensions: forcedDimensions,
  viewport: forcedViewport,
  impact: forcedImpact,
  scrollJumpRequest
}) => {
  const viewport = forcedViewport || state.viewport;
  const dimensions = forcedDimensions || state.dimensions;
  const clientSelection = forcedClientSelection || state.current.client.selection;
  const offset = subtract(clientSelection, state.initial.client.selection);
  const client = {
    offset,
    selection: clientSelection,
    borderBoxCenter: add(state.initial.client.borderBoxCenter, offset)
  };
  const page = {
    selection: add(client.selection, viewport.scroll.current),
    borderBoxCenter: add(client.borderBoxCenter, viewport.scroll.current),
    offset: add(client.offset, viewport.scroll.diff.value)
  };
  const current = {
    client,
    page
  };
  if (state.phase === 'COLLECTING') {
    return {
      ...state,
      dimensions,
      viewport,
      current
    };
  }
  const draggable = dimensions.draggables[state.critical.draggable.id];
  const newImpact = forcedImpact || getDragImpact({
    pageOffset: page.offset,
    draggable,
    draggables: dimensions.draggables,
    droppables: dimensions.droppables,
    previousImpact: state.impact,
    viewport,
    afterCritical: state.afterCritical
  });
  const withUpdatedPlaceholders = recomputePlaceholders({
    draggable,
    impact: newImpact,
    previousImpact: state.impact,
    draggables: dimensions.draggables,
    droppables: dimensions.droppables
  });
  const result = {
    ...state,
    current,
    dimensions: {
      draggables: dimensions.draggables,
      droppables: withUpdatedPlaceholders
    },
    impact: newImpact,
    viewport,
    scrollJumpRequest: scrollJumpRequest || null,
    forceShouldAnimate: scrollJumpRequest ? false : null
  };
  return result;
};

function getDraggables(ids, draggables) {
  return ids.map(id => draggables[id]);
}
var recompute = ({
  impact,
  viewport,
  draggables,
  destination,
  forceShouldAnimate
}) => {
  const last = impact.displaced;
  const afterDragging = getDraggables(last.all, draggables);
  const displaced = getDisplacementGroups({
    afterDragging,
    destination,
    displacedBy: impact.displacedBy,
    viewport: viewport.frame,
    forceShouldAnimate,
    last
  });
  return {
    ...impact,
    displaced
  };
};

var getClientBorderBoxCenter = ({
  impact,
  draggable,
  droppable,
  draggables,
  viewport,
  afterCritical
}) => {
  const pageBorderBoxCenter = getPageBorderBoxCenterFromImpact({
    impact,
    draggable,
    draggables,
    droppable,
    afterCritical
  });
  return getClientFromPageBorderBoxCenter({
    pageBorderBoxCenter,
    draggable,
    viewport
  });
};

var refreshSnap = ({
  state,
  dimensions: forcedDimensions,
  viewport: forcedViewport
}) => {
  !(state.movementMode === 'SNAP') ? process.env.NODE_ENV !== "production" ? invariant() : invariant() : void 0;
  const needsVisibilityCheck = state.impact;
  const viewport = forcedViewport || state.viewport;
  const dimensions = forcedDimensions || state.dimensions;
  const {
    draggables,
    droppables
  } = dimensions;
  const draggable = draggables[state.critical.draggable.id];
  const isOver = whatIsDraggedOver(needsVisibilityCheck);
  !isOver ? process.env.NODE_ENV !== "production" ? invariant(false, 'Must be over a destination in SNAP movement mode') : invariant() : void 0;
  const destination = droppables[isOver];
  const impact = recompute({
    impact: needsVisibilityCheck,
    viewport,
    destination,
    draggables
  });
  const clientSelection = getClientBorderBoxCenter({
    impact,
    draggable,
    droppable: destination,
    draggables,
    viewport,
    afterCritical: state.afterCritical
  });
  return update({
    impact,
    clientSelection,
    state,
    dimensions,
    viewport
  });
};

var getHomeLocation = descriptor => ({
  index: descriptor.index,
  droppableId: descriptor.droppableId
});

var getLiftEffect = ({
  draggable,
  home,
  draggables,
  viewport
}) => {
  const displacedBy = getDisplacedBy(home.axis, draggable.displaceBy);
  const insideHome = getDraggablesInsideDroppable(home.descriptor.id, draggables);
  const rawIndex = insideHome.indexOf(draggable);
  !(rawIndex !== -1) ? process.env.NODE_ENV !== "production" ? invariant(false, 'Expected draggable to be inside home list') : invariant() : void 0;
  const afterDragging = insideHome.slice(rawIndex + 1);
  const effected = afterDragging.reduce((previous, item) => {
    previous[item.descriptor.id] = true;
    return previous;
  }, {});
  const afterCritical = {
    inVirtualList: home.descriptor.mode === 'virtual',
    displacedBy,
    effected
  };
  const displaced = getDisplacementGroups({
    afterDragging,
    destination: home,
    displacedBy,
    last: null,
    viewport: viewport.frame,
    forceShouldAnimate: false
  });
  const impact = {
    displaced,
    displacedBy,
    at: {
      type: 'REORDER',
      destination: getHomeLocation(draggable.descriptor)
    }
  };
  return {
    impact,
    afterCritical
  };
};

var patchDimensionMap = (dimensions, updated) => ({
  draggables: dimensions.draggables,
  droppables: patchDroppableMap(dimensions.droppables, updated)
});

const start = key => {
  if (process.env.NODE_ENV !== 'production') {
    {
      return;
    }
  }
};
const finish = key => {
  if (process.env.NODE_ENV !== 'production') {
    {
      return;
    }
  }
};

var offsetDraggable = ({
  draggable,
  offset,
  initialWindowScroll
}) => {
  const client = cssBoxModel.offset(draggable.client, offset);
  const page = cssBoxModel.withScroll(client, initialWindowScroll);
  const moved = {
    ...draggable,
    placeholder: {
      ...draggable.placeholder,
      client
    },
    client,
    page
  };
  return moved;
};

var getFrame = droppable => {
  const frame = droppable.frame;
  !frame ? process.env.NODE_ENV !== "production" ? invariant(false, 'Expected Droppable to have a frame') : invariant() : void 0;
  return frame;
};

var adjustAdditionsForScrollChanges = ({
  additions,
  updatedDroppables,
  viewport
}) => {
  const windowScrollChange = viewport.scroll.diff.value;
  return additions.map(draggable => {
    const droppableId = draggable.descriptor.droppableId;
    const modified = updatedDroppables[droppableId];
    const frame = getFrame(modified);
    const droppableScrollChange = frame.scroll.diff.value;
    const totalChange = add(windowScrollChange, droppableScrollChange);
    const moved = offsetDraggable({
      draggable,
      offset: totalChange,
      initialWindowScroll: viewport.scroll.initial
    });
    return moved;
  });
};

var publishWhileDraggingInVirtual = ({
  state,
  published
}) => {
  start();
  const withScrollChange = published.modified.map(update => {
    const existing = state.dimensions.droppables[update.droppableId];
    const scrolled = scrollDroppable(existing, update.scroll);
    return scrolled;
  });
  const droppables = {
    ...state.dimensions.droppables,
    ...toDroppableMap(withScrollChange)
  };
  const updatedAdditions = toDraggableMap(adjustAdditionsForScrollChanges({
    additions: published.additions,
    updatedDroppables: droppables,
    viewport: state.viewport
  }));
  const draggables = {
    ...state.dimensions.draggables,
    ...updatedAdditions
  };
  published.removals.forEach(id => {
    delete draggables[id];
  });
  const dimensions = {
    droppables,
    draggables
  };
  const wasOverId = whatIsDraggedOver(state.impact);
  const wasOver = wasOverId ? dimensions.droppables[wasOverId] : null;
  const draggable = dimensions.draggables[state.critical.draggable.id];
  const home = dimensions.droppables[state.critical.droppable.id];
  const {
    impact: onLiftImpact,
    afterCritical
  } = getLiftEffect({
    draggable,
    home,
    draggables,
    viewport: state.viewport
  });
  const previousImpact = wasOver && wasOver.isCombineEnabled ? state.impact : onLiftImpact;
  const impact = getDragImpact({
    pageOffset: state.current.page.offset,
    draggable: dimensions.draggables[state.critical.draggable.id],
    draggables: dimensions.draggables,
    droppables: dimensions.droppables,
    previousImpact,
    viewport: state.viewport,
    afterCritical
  });
  finish();
  const draggingState = {
    ...state,
    phase: 'DRAGGING',
    impact,
    onLiftImpact,
    dimensions,
    afterCritical,
    forceShouldAnimate: false
  };
  if (state.phase === 'COLLECTING') {
    return draggingState;
  }
  const dropPending = {
    ...draggingState,
    phase: 'DROP_PENDING',
    reason: state.reason,
    isWaiting: false
  };
  return dropPending;
};

const isSnapping = state => state.movementMode === 'SNAP';
const postDroppableChange = (state, updated, isEnabledChanging) => {
  const dimensions = patchDimensionMap(state.dimensions, updated);
  if (!isSnapping(state) || isEnabledChanging) {
    return update({
      state,
      dimensions
    });
  }
  return refreshSnap({
    state,
    dimensions
  });
};
function removeScrollJumpRequest(state) {
  if (state.isDragging && state.movementMode === 'SNAP') {
    return {
      ...state,
      scrollJumpRequest: null
    };
  }
  return state;
}
const idle$2 = {
  phase: 'IDLE',
  completed: null,
  shouldFlush: false
};
var reducer = (state = idle$2, action) => {
  if (action.type === 'FLUSH') {
    return {
      ...idle$2,
      shouldFlush: true
    };
  }
  if (action.type === 'INITIAL_PUBLISH') {
    !(state.phase === 'IDLE') ? process.env.NODE_ENV !== "production" ? invariant(false, 'INITIAL_PUBLISH must come after a IDLE phase') : invariant() : void 0;
    const {
      critical,
      clientSelection,
      viewport,
      dimensions,
      movementMode
    } = action.payload;
    const draggable = dimensions.draggables[critical.draggable.id];
    const home = dimensions.droppables[critical.droppable.id];
    const client = {
      selection: clientSelection,
      borderBoxCenter: draggable.client.borderBox.center,
      offset: origin
    };
    const initial = {
      client,
      page: {
        selection: add(client.selection, viewport.scroll.initial),
        borderBoxCenter: add(client.selection, viewport.scroll.initial),
        offset: add(client.selection, viewport.scroll.diff.value)
      }
    };
    const isWindowScrollAllowed = toDroppableList(dimensions.droppables).every(item => !item.isFixedOnPage);
    const {
      impact,
      afterCritical
    } = getLiftEffect({
      draggable,
      home,
      draggables: dimensions.draggables,
      viewport
    });
    const result = {
      phase: 'DRAGGING',
      isDragging: true,
      critical,
      movementMode,
      dimensions,
      initial,
      current: initial,
      isWindowScrollAllowed,
      impact,
      afterCritical,
      onLiftImpact: impact,
      viewport,
      scrollJumpRequest: null,
      forceShouldAnimate: null
    };
    return result;
  }
  if (action.type === 'COLLECTION_STARTING') {
    if (state.phase === 'COLLECTING' || state.phase === 'DROP_PENDING') {
      return state;
    }
    !(state.phase === 'DRAGGING') ? process.env.NODE_ENV !== "production" ? invariant(false, `Collection cannot start from phase ${state.phase}`) : invariant() : void 0;
    const result = {
      ...state,
      phase: 'COLLECTING'
    };
    return result;
  }
  if (action.type === 'PUBLISH_WHILE_DRAGGING') {
    !(state.phase === 'COLLECTING' || state.phase === 'DROP_PENDING') ? process.env.NODE_ENV !== "production" ? invariant(false, `Unexpected ${action.type} received in phase ${state.phase}`) : invariant() : void 0;
    return publishWhileDraggingInVirtual({
      state,
      published: action.payload
    });
  }
  if (action.type === 'MOVE') {
    if (state.phase === 'DROP_PENDING') {
      return state;
    }
    !isMovementAllowed(state) ? process.env.NODE_ENV !== "production" ? invariant(false, `${action.type} not permitted in phase ${state.phase}`) : invariant() : void 0;
    const {
      client: clientSelection
    } = action.payload;
    if (isEqual$1(clientSelection, state.current.client.selection)) {
      return state;
    }
    return update({
      state,
      clientSelection,
      impact: isSnapping(state) ? state.impact : null
    });
  }
  if (action.type === 'UPDATE_DROPPABLE_SCROLL') {
    if (state.phase === 'DROP_PENDING') {
      return removeScrollJumpRequest(state);
    }
    if (state.phase === 'COLLECTING') {
      return removeScrollJumpRequest(state);
    }
    !isMovementAllowed(state) ? process.env.NODE_ENV !== "production" ? invariant(false, `${action.type} not permitted in phase ${state.phase}`) : invariant() : void 0;
    const {
      id,
      newScroll
    } = action.payload;
    const target = state.dimensions.droppables[id];
    if (!target) {
      return state;
    }
    const scrolled = scrollDroppable(target, newScroll);
    return postDroppableChange(state, scrolled, false);
  }
  if (action.type === 'UPDATE_DROPPABLE_IS_ENABLED') {
    if (state.phase === 'DROP_PENDING') {
      return state;
    }
    !isMovementAllowed(state) ? process.env.NODE_ENV !== "production" ? invariant(false, `Attempting to move in an unsupported phase ${state.phase}`) : invariant() : void 0;
    const {
      id,
      isEnabled
    } = action.payload;
    const target = state.dimensions.droppables[id];
    !target ? process.env.NODE_ENV !== "production" ? invariant(false, `Cannot find Droppable[id: ${id}] to toggle its enabled state`) : invariant() : void 0;
    !(target.isEnabled !== isEnabled) ? process.env.NODE_ENV !== "production" ? invariant(false, `Trying to set droppable isEnabled to ${String(isEnabled)}
      but it is already ${String(target.isEnabled)}`) : invariant() : void 0;
    const updated = {
      ...target,
      isEnabled
    };
    return postDroppableChange(state, updated, true);
  }
  if (action.type === 'UPDATE_DROPPABLE_IS_COMBINE_ENABLED') {
    if (state.phase === 'DROP_PENDING') {
      return state;
    }
    !isMovementAllowed(state) ? process.env.NODE_ENV !== "production" ? invariant(false, `Attempting to move in an unsupported phase ${state.phase}`) : invariant() : void 0;
    const {
      id,
      isCombineEnabled
    } = action.payload;
    const target = state.dimensions.droppables[id];
    !target ? process.env.NODE_ENV !== "production" ? invariant(false, `Cannot find Droppable[id: ${id}] to toggle its isCombineEnabled state`) : invariant() : void 0;
    !(target.isCombineEnabled !== isCombineEnabled) ? process.env.NODE_ENV !== "production" ? invariant(false, `Trying to set droppable isCombineEnabled to ${String(isCombineEnabled)}
      but it is already ${String(target.isCombineEnabled)}`) : invariant() : void 0;
    const updated = {
      ...target,
      isCombineEnabled
    };
    return postDroppableChange(state, updated, true);
  }
  if (action.type === 'MOVE_BY_WINDOW_SCROLL') {
    if (state.phase === 'DROP_PENDING' || state.phase === 'DROP_ANIMATING') {
      return state;
    }
    !isMovementAllowed(state) ? process.env.NODE_ENV !== "production" ? invariant(false, `Cannot move by window in phase ${state.phase}`) : invariant() : void 0;
    !state.isWindowScrollAllowed ? process.env.NODE_ENV !== "production" ? invariant(false, 'Window scrolling is currently not supported for fixed lists') : invariant() : void 0;
    const newScroll = action.payload.newScroll;
    if (isEqual$1(state.viewport.scroll.current, newScroll)) {
      return removeScrollJumpRequest(state);
    }
    const viewport = scrollViewport(state.viewport, newScroll);
    if (isSnapping(state)) {
      return refreshSnap({
        state,
        viewport
      });
    }
    return update({
      state,
      viewport
    });
  }
  if (action.type === 'UPDATE_VIEWPORT_MAX_SCROLL') {
    if (!isMovementAllowed(state)) {
      return state;
    }
    const maxScroll = action.payload.maxScroll;
    if (isEqual$1(maxScroll, state.viewport.scroll.max)) {
      return state;
    }
    const withMaxScroll = {
      ...state.viewport,
      scroll: {
        ...state.viewport.scroll,
        max: maxScroll
      }
    };
    return {
      ...state,
      viewport: withMaxScroll
    };
  }
  if (action.type === 'MOVE_UP' || action.type === 'MOVE_DOWN' || action.type === 'MOVE_LEFT' || action.type === 'MOVE_RIGHT') {
    if (state.phase === 'COLLECTING' || state.phase === 'DROP_PENDING') {
      return state;
    }
    !(state.phase === 'DRAGGING') ? process.env.NODE_ENV !== "production" ? invariant(false, `${action.type} received while not in DRAGGING phase`) : invariant() : void 0;
    const result = moveInDirection({
      state,
      type: action.type
    });
    if (!result) {
      return state;
    }
    return update({
      state,
      impact: result.impact,
      clientSelection: result.clientSelection,
      scrollJumpRequest: result.scrollJumpRequest
    });
  }
  if (action.type === 'DROP_PENDING') {
    const reason = action.payload.reason;
    !(state.phase === 'COLLECTING') ? process.env.NODE_ENV !== "production" ? invariant(false, 'Can only move into the DROP_PENDING phase from the COLLECTING phase') : invariant() : void 0;
    const newState = {
      ...state,
      phase: 'DROP_PENDING',
      isWaiting: true,
      reason
    };
    return newState;
  }
  if (action.type === 'DROP_ANIMATE') {
    const {
      completed,
      dropDuration,
      newHomeClientOffset
    } = action.payload;
    !(state.phase === 'DRAGGING' || state.phase === 'DROP_PENDING') ? process.env.NODE_ENV !== "production" ? invariant(false, `Cannot animate drop from phase ${state.phase}`) : invariant() : void 0;
    const result = {
      phase: 'DROP_ANIMATING',
      completed,
      dropDuration,
      newHomeClientOffset,
      dimensions: state.dimensions
    };
    return result;
  }
  if (action.type === 'DROP_COMPLETE') {
    const {
      completed
    } = action.payload;
    return {
      phase: 'IDLE',
      completed,
      shouldFlush: false
    };
  }
  return state;
};

function guard(action, predicate) {
  return action instanceof Object && 'type' in action && action.type === predicate;
}
const beforeInitialCapture = args => ({
  type: 'BEFORE_INITIAL_CAPTURE',
  payload: args
});
const lift$1 = args => ({
  type: 'LIFT',
  payload: args
});
const initialPublish = args => ({
  type: 'INITIAL_PUBLISH',
  payload: args
});
const publishWhileDragging = args => ({
  type: 'PUBLISH_WHILE_DRAGGING',
  payload: args
});
const collectionStarting = () => ({
  type: 'COLLECTION_STARTING',
  payload: null
});
const updateDroppableScroll = args => ({
  type: 'UPDATE_DROPPABLE_SCROLL',
  payload: args
});
const updateDroppableIsEnabled = args => ({
  type: 'UPDATE_DROPPABLE_IS_ENABLED',
  payload: args
});
const updateDroppableIsCombineEnabled = args => ({
  type: 'UPDATE_DROPPABLE_IS_COMBINE_ENABLED',
  payload: args
});
const move = args => ({
  type: 'MOVE',
  payload: args
});
const moveByWindowScroll = args => ({
  type: 'MOVE_BY_WINDOW_SCROLL',
  payload: args
});
const updateViewportMaxScroll = args => ({
  type: 'UPDATE_VIEWPORT_MAX_SCROLL',
  payload: args
});
const moveUp = () => ({
  type: 'MOVE_UP',
  payload: null
});
const moveDown = () => ({
  type: 'MOVE_DOWN',
  payload: null
});
const moveRight = () => ({
  type: 'MOVE_RIGHT',
  payload: null
});
const moveLeft = () => ({
  type: 'MOVE_LEFT',
  payload: null
});
const flush = () => ({
  type: 'FLUSH',
  payload: null
});
const animateDrop = args => ({
  type: 'DROP_ANIMATE',
  payload: args
});
const completeDrop = args => ({
  type: 'DROP_COMPLETE',
  payload: args
});
const drop = args => ({
  type: 'DROP',
  payload: args
});
const dropPending = args => ({
  type: 'DROP_PENDING',
  payload: args
});
const dropAnimationFinished = () => ({
  type: 'DROP_ANIMATION_FINISHED',
  payload: null
});

function checkIndexes(insideDestination) {
  if (insideDestination.length <= 1) {
    return;
  }
  const indexes = insideDestination.map(d => d.descriptor.index);
  const errors = {};
  for (let i = 1; i < indexes.length; i++) {
    const current = indexes[i];
    const previous = indexes[i - 1];
    if (current !== previous + 1) {
      errors[current] = true;
    }
  }
  if (!Object.keys(errors).length) {
    return;
  }
  const formatted = indexes.map(index => {
    const hasError = Boolean(errors[index]);
    return hasError ? `[🔥${index}]` : `${index}`;
  }).join(', ');
  process.env.NODE_ENV !== "production" ? warning(`
    Detected non-consecutive <Draggable /> indexes.

    (This can cause unexpected bugs)

    ${formatted}
  `) : void 0;
}
function validateDimensions(critical, dimensions) {
  if (process.env.NODE_ENV !== 'production') {
    const insideDestination = getDraggablesInsideDroppable(critical.droppable.id, dimensions.draggables);
    checkIndexes(insideDestination);
  }
}

var lift = marshal => ({
  getState,
  dispatch
}) => next => action => {
  if (!guard(action, 'LIFT')) {
    next(action);
    return;
  }
  const {
    id,
    clientSelection,
    movementMode
  } = action.payload;
  const initial = getState();
  if (initial.phase === 'DROP_ANIMATING') {
    dispatch(completeDrop({
      completed: initial.completed
    }));
  }
  !(getState().phase === 'IDLE') ? process.env.NODE_ENV !== "production" ? invariant(false, 'Unexpected phase to start a drag') : invariant() : void 0;
  dispatch(flush());
  dispatch(beforeInitialCapture({
    draggableId: id,
    movementMode
  }));
  const scrollOptions = {
    shouldPublishImmediately: movementMode === 'SNAP'
  };
  const request = {
    draggableId: id,
    scrollOptions
  };
  const {
    critical,
    dimensions,
    viewport
  } = marshal.startPublishing(request);
  validateDimensions(critical, dimensions);
  dispatch(initialPublish({
    critical,
    dimensions,
    clientSelection,
    movementMode,
    viewport
  }));
};

var style = marshal => () => next => action => {
  if (guard(action, 'INITIAL_PUBLISH')) {
    marshal.dragging();
  }
  if (guard(action, 'DROP_ANIMATE')) {
    marshal.dropping(action.payload.completed.result.reason);
  }
  if (guard(action, 'FLUSH') || guard(action, 'DROP_COMPLETE')) {
    marshal.resting();
  }
  next(action);
};

const curves = {
  outOfTheWay: 'cubic-bezier(0.2, 0, 0, 1)',
  drop: 'cubic-bezier(.2,1,.1,1)'
};
const combine = {
  opacity: {
    drop: 0,
    combining: 0.7
  },
  scale: {
    drop: 0.75
  }
};
const timings = {
  outOfTheWay: 0.2,
  minDropTime: 0.33,
  maxDropTime: 0.55
};
const outOfTheWayTiming = `${timings.outOfTheWay}s ${curves.outOfTheWay}`;
const transitions = {
  fluid: `opacity ${outOfTheWayTiming}`,
  snap: `transform ${outOfTheWayTiming}, opacity ${outOfTheWayTiming}`,
  drop: duration => {
    const timing = `${duration}s ${curves.drop}`;
    return `transform ${timing}, opacity ${timing}`;
  },
  outOfTheWay: `transform ${outOfTheWayTiming}`,
  placeholder: `height ${outOfTheWayTiming}, width ${outOfTheWayTiming}, margin ${outOfTheWayTiming}`
};
const moveTo = offset => isEqual$1(offset, origin) ? undefined : `translate(${offset.x}px, ${offset.y}px)`;
const transforms = {
  moveTo,
  drop: (offset, isCombining) => {
    const translate = moveTo(offset);
    if (!translate) {
      return undefined;
    }
    if (!isCombining) {
      return translate;
    }
    return `${translate} scale(${combine.scale.drop})`;
  }
};

const {
  minDropTime,
  maxDropTime
} = timings;
const dropTimeRange = maxDropTime - minDropTime;
const maxDropTimeAtDistance = 1500;
const cancelDropModifier = 0.6;
var getDropDuration = ({
  current,
  destination,
  reason
}) => {
  const distance$1 = distance(current, destination);
  if (distance$1 <= 0) {
    return minDropTime;
  }
  if (distance$1 >= maxDropTimeAtDistance) {
    return maxDropTime;
  }
  const percentage = distance$1 / maxDropTimeAtDistance;
  const duration = minDropTime + dropTimeRange * percentage;
  const withDuration = reason === 'CANCEL' ? duration * cancelDropModifier : duration;
  return Number(withDuration.toFixed(2));
};

var getNewHomeClientOffset = ({
  impact,
  draggable,
  dimensions,
  viewport,
  afterCritical
}) => {
  const {
    draggables,
    droppables
  } = dimensions;
  const droppableId = whatIsDraggedOver(impact);
  const destination = droppableId ? droppables[droppableId] : null;
  const home = droppables[draggable.descriptor.droppableId];
  const newClientCenter = getClientBorderBoxCenter({
    impact,
    draggable,
    draggables,
    afterCritical,
    droppable: destination || home,
    viewport
  });
  const offset = subtract(newClientCenter, draggable.client.borderBox.center);
  return offset;
};

var getDropImpact = ({
  draggables,
  reason,
  lastImpact,
  home,
  viewport,
  onLiftImpact
}) => {
  if (!lastImpact.at || reason !== 'DROP') {
    const recomputedHomeImpact = recompute({
      draggables,
      impact: onLiftImpact,
      destination: home,
      viewport,
      forceShouldAnimate: true
    });
    return {
      impact: recomputedHomeImpact,
      didDropInsideDroppable: false
    };
  }
  if (lastImpact.at.type === 'REORDER') {
    return {
      impact: lastImpact,
      didDropInsideDroppable: true
    };
  }
  const withoutMovement = {
    ...lastImpact,
    displaced: emptyGroups
  };
  return {
    impact: withoutMovement,
    didDropInsideDroppable: true
  };
};

const dropMiddleware = ({
  getState,
  dispatch
}) => next => action => {
  if (!guard(action, 'DROP')) {
    next(action);
    return;
  }
  const state = getState();
  const reason = action.payload.reason;
  if (state.phase === 'COLLECTING') {
    dispatch(dropPending({
      reason
    }));
    return;
  }
  if (state.phase === 'IDLE') {
    return;
  }
  const isWaitingForDrop = state.phase === 'DROP_PENDING' && state.isWaiting;
  !!isWaitingForDrop ? process.env.NODE_ENV !== "production" ? invariant(false, 'A DROP action occurred while DROP_PENDING and still waiting') : invariant() : void 0;
  !(state.phase === 'DRAGGING' || state.phase === 'DROP_PENDING') ? process.env.NODE_ENV !== "production" ? invariant(false, `Cannot drop in phase: ${state.phase}`) : invariant() : void 0;
  const critical = state.critical;
  const dimensions = state.dimensions;
  const draggable = dimensions.draggables[state.critical.draggable.id];
  const {
    impact,
    didDropInsideDroppable
  } = getDropImpact({
    reason,
    lastImpact: state.impact,
    afterCritical: state.afterCritical,
    onLiftImpact: state.onLiftImpact,
    home: state.dimensions.droppables[state.critical.droppable.id],
    viewport: state.viewport,
    draggables: state.dimensions.draggables
  });
  const destination = didDropInsideDroppable ? tryGetDestination(impact) : null;
  const combine = didDropInsideDroppable ? tryGetCombine(impact) : null;
  const source = {
    index: critical.draggable.index,
    droppableId: critical.droppable.id
  };
  const result = {
    draggableId: draggable.descriptor.id,
    type: draggable.descriptor.type,
    source,
    reason,
    mode: state.movementMode,
    destination,
    combine
  };
  const newHomeClientOffset = getNewHomeClientOffset({
    impact,
    draggable,
    dimensions,
    viewport: state.viewport,
    afterCritical: state.afterCritical
  });
  const completed = {
    critical: state.critical,
    afterCritical: state.afterCritical,
    result,
    impact
  };
  const isAnimationRequired = !isEqual$1(state.current.client.offset, newHomeClientOffset) || Boolean(result.combine);
  if (!isAnimationRequired) {
    dispatch(completeDrop({
      completed
    }));
    return;
  }
  const dropDuration = getDropDuration({
    current: state.current.client.offset,
    destination: newHomeClientOffset,
    reason
  });
  const args = {
    newHomeClientOffset,
    dropDuration,
    completed
  };
  dispatch(animateDrop(args));
};

var getWindowScroll = () => ({
  x: window.pageXOffset,
  y: window.pageYOffset
});

function getWindowScrollBinding(update) {
  return {
    eventName: 'scroll',
    options: {
      passive: true,
      capture: false
    },
    fn: event => {
      if (event.target !== window && event.target !== window.document) {
        return;
      }
      update();
    }
  };
}
function getScrollListener({
  onWindowScroll
}) {
  function updateScroll() {
    onWindowScroll(getWindowScroll());
  }
  const scheduled = rafSchd(updateScroll);
  const binding = getWindowScrollBinding(scheduled);
  let unbind = noop$2;
  function isActive() {
    return unbind !== noop$2;
  }
  function start() {
    !!isActive() ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot start scroll listener when already active') : invariant() : void 0;
    unbind = bindEvents(window, [binding]);
  }
  function stop() {
    !isActive() ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot stop scroll listener when not active') : invariant() : void 0;
    scheduled.cancel();
    unbind();
    unbind = noop$2;
  }
  return {
    start,
    stop,
    isActive
  };
}

const shouldStop$1 = action => guard(action, 'DROP_COMPLETE') || guard(action, 'DROP_ANIMATE') || guard(action, 'FLUSH');
const scrollListener = store => {
  const listener = getScrollListener({
    onWindowScroll: newScroll => {
      store.dispatch(moveByWindowScroll({
        newScroll
      }));
    }
  });
  return next => action => {
    if (!listener.isActive() && guard(action, 'INITIAL_PUBLISH')) {
      listener.start();
    }
    if (listener.isActive() && shouldStop$1(action)) {
      listener.stop();
    }
    next(action);
  };
};

var getExpiringAnnounce = announce => {
  let wasCalled = false;
  let isExpired = false;
  const timeoutId = setTimeout(() => {
    isExpired = true;
  });
  const result = message => {
    if (wasCalled) {
      process.env.NODE_ENV !== "production" ? warning('Announcement already made. Not making a second announcement') : void 0;
      return;
    }
    if (isExpired) {
      process.env.NODE_ENV !== "production" ? warning(`
        Announcements cannot be made asynchronously.
        Default message has already been announced.
      `) : void 0;
      return;
    }
    wasCalled = true;
    announce(message);
    clearTimeout(timeoutId);
  };
  result.wasCalled = () => wasCalled;
  return result;
};

var getAsyncMarshal = () => {
  const entries = [];
  const execute = timerId => {
    const index = entries.findIndex(item => item.timerId === timerId);
    !(index !== -1) ? process.env.NODE_ENV !== "production" ? invariant(false, 'Could not find timer') : invariant() : void 0;
    const [entry] = entries.splice(index, 1);
    entry.callback();
  };
  const add = fn => {
    const timerId = setTimeout(() => execute(timerId));
    const entry = {
      timerId,
      callback: fn
    };
    entries.push(entry);
  };
  const flush = () => {
    if (!entries.length) {
      return;
    }
    const shallow = [...entries];
    entries.length = 0;
    shallow.forEach(entry => {
      clearTimeout(entry.timerId);
      entry.callback();
    });
  };
  return {
    add,
    flush
  };
};

const areLocationsEqual = (first, second) => {
  if (first == null && second == null) {
    return true;
  }
  if (first == null || second == null) {
    return false;
  }
  return first.droppableId === second.droppableId && first.index === second.index;
};
const isCombineEqual = (first, second) => {
  if (first == null && second == null) {
    return true;
  }
  if (first == null || second == null) {
    return false;
  }
  return first.draggableId === second.draggableId && first.droppableId === second.droppableId;
};
const isCriticalEqual = (first, second) => {
  if (first === second) {
    return true;
  }
  const isDraggableEqual = first.draggable.id === second.draggable.id && first.draggable.droppableId === second.draggable.droppableId && first.draggable.type === second.draggable.type && first.draggable.index === second.draggable.index;
  const isDroppableEqual = first.droppable.id === second.droppable.id && first.droppable.type === second.droppable.type;
  return isDraggableEqual && isDroppableEqual;
};

const withTimings = (key, fn) => {
  start();
  fn();
  finish();
};
const getDragStart = (critical, mode) => ({
  draggableId: critical.draggable.id,
  type: critical.droppable.type,
  source: {
    droppableId: critical.droppable.id,
    index: critical.draggable.index
  },
  mode
});
function execute(responder, data, announce, getDefaultMessage) {
  if (!responder) {
    announce(getDefaultMessage(data));
    return;
  }
  const willExpire = getExpiringAnnounce(announce);
  const provided = {
    announce: willExpire
  };
  responder(data, provided);
  if (!willExpire.wasCalled()) {
    announce(getDefaultMessage(data));
  }
}
var getPublisher = (getResponders, announce) => {
  const asyncMarshal = getAsyncMarshal();
  let dragging = null;
  const beforeCapture = (draggableId, mode) => {
    !!dragging ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot fire onBeforeCapture as a drag start has already been published') : invariant() : void 0;
    withTimings('onBeforeCapture', () => {
      const fn = getResponders().onBeforeCapture;
      if (fn) {
        const before = {
          draggableId,
          mode
        };
        fn(before);
      }
    });
  };
  const beforeStart = (critical, mode) => {
    !!dragging ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot fire onBeforeDragStart as a drag start has already been published') : invariant() : void 0;
    withTimings('onBeforeDragStart', () => {
      const fn = getResponders().onBeforeDragStart;
      if (fn) {
        fn(getDragStart(critical, mode));
      }
    });
  };
  const start = (critical, mode) => {
    !!dragging ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot fire onBeforeDragStart as a drag start has already been published') : invariant() : void 0;
    const data = getDragStart(critical, mode);
    dragging = {
      mode,
      lastCritical: critical,
      lastLocation: data.source,
      lastCombine: null
    };
    asyncMarshal.add(() => {
      withTimings('onDragStart', () => execute(getResponders().onDragStart, data, announce, preset.onDragStart));
    });
  };
  const update = (critical, impact) => {
    const location = tryGetDestination(impact);
    const combine = tryGetCombine(impact);
    !dragging ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot fire onDragMove when onDragStart has not been called') : invariant() : void 0;
    const hasCriticalChanged = !isCriticalEqual(critical, dragging.lastCritical);
    if (hasCriticalChanged) {
      dragging.lastCritical = critical;
    }
    const hasLocationChanged = !areLocationsEqual(dragging.lastLocation, location);
    if (hasLocationChanged) {
      dragging.lastLocation = location;
    }
    const hasGroupingChanged = !isCombineEqual(dragging.lastCombine, combine);
    if (hasGroupingChanged) {
      dragging.lastCombine = combine;
    }
    if (!hasCriticalChanged && !hasLocationChanged && !hasGroupingChanged) {
      return;
    }
    const data = {
      ...getDragStart(critical, dragging.mode),
      combine,
      destination: location
    };
    asyncMarshal.add(() => {
      withTimings('onDragUpdate', () => execute(getResponders().onDragUpdate, data, announce, preset.onDragUpdate));
    });
  };
  const flush = () => {
    !dragging ? process.env.NODE_ENV !== "production" ? invariant(false, 'Can only flush responders while dragging') : invariant() : void 0;
    asyncMarshal.flush();
  };
  const drop = result => {
    !dragging ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot fire onDragEnd when there is no matching onDragStart') : invariant() : void 0;
    dragging = null;
    withTimings('onDragEnd', () => execute(getResponders().onDragEnd, result, announce, preset.onDragEnd));
  };
  const abort = () => {
    if (!dragging) {
      return;
    }
    const result = {
      ...getDragStart(dragging.lastCritical, dragging.mode),
      combine: null,
      destination: null,
      reason: 'CANCEL'
    };
    drop(result);
  };
  return {
    beforeCapture,
    beforeStart,
    start,
    update,
    flush,
    drop,
    abort
  };
};

var responders = (getResponders, announce) => {
  const publisher = getPublisher(getResponders, announce);
  return store => next => action => {
    if (guard(action, 'BEFORE_INITIAL_CAPTURE')) {
      publisher.beforeCapture(action.payload.draggableId, action.payload.movementMode);
      return;
    }
    if (guard(action, 'INITIAL_PUBLISH')) {
      const critical = action.payload.critical;
      publisher.beforeStart(critical, action.payload.movementMode);
      next(action);
      publisher.start(critical, action.payload.movementMode);
      return;
    }
    if (guard(action, 'DROP_COMPLETE')) {
      const result = action.payload.completed.result;
      publisher.flush();
      next(action);
      publisher.drop(result);
      return;
    }
    next(action);
    if (guard(action, 'FLUSH')) {
      publisher.abort();
      return;
    }
    const state = store.getState();
    if (state.phase === 'DRAGGING') {
      publisher.update(state.critical, state.impact);
    }
  };
};

const dropAnimationFinishMiddleware = store => next => action => {
  if (!guard(action, 'DROP_ANIMATION_FINISHED')) {
    next(action);
    return;
  }
  const state = store.getState();
  !(state.phase === 'DROP_ANIMATING') ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot finish a drop animating when no drop is occurring') : invariant() : void 0;
  store.dispatch(completeDrop({
    completed: state.completed
  }));
};

const dropAnimationFlushOnScrollMiddleware = store => {
  let unbind = null;
  let frameId = null;
  function clear() {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (unbind) {
      unbind();
      unbind = null;
    }
  }
  return next => action => {
    if (guard(action, 'FLUSH') || guard(action, 'DROP_COMPLETE') || guard(action, 'DROP_ANIMATION_FINISHED')) {
      clear();
    }
    next(action);
    if (!guard(action, 'DROP_ANIMATE')) {
      return;
    }
    const binding = {
      eventName: 'scroll',
      options: {
        capture: true,
        passive: false,
        once: true
      },
      fn: function flushDropAnimation() {
        const state = store.getState();
        if (state.phase === 'DROP_ANIMATING') {
          store.dispatch(dropAnimationFinished());
        }
      }
    };
    frameId = requestAnimationFrame(() => {
      frameId = null;
      unbind = bindEvents(window, [binding]);
    });
  };
};

var dimensionMarshalStopper = marshal => () => next => action => {
  if (guard(action, 'DROP_COMPLETE') || guard(action, 'FLUSH') || guard(action, 'DROP_ANIMATE')) {
    marshal.stopPublishing();
  }
  next(action);
};

var focus = marshal => {
  let isWatching = false;
  return () => next => action => {
    if (guard(action, 'INITIAL_PUBLISH')) {
      isWatching = true;
      marshal.tryRecordFocus(action.payload.critical.draggable.id);
      next(action);
      marshal.tryRestoreFocusRecorded();
      return;
    }
    next(action);
    if (!isWatching) {
      return;
    }
    if (guard(action, 'FLUSH')) {
      isWatching = false;
      marshal.tryRestoreFocusRecorded();
      return;
    }
    if (guard(action, 'DROP_COMPLETE')) {
      isWatching = false;
      const result = action.payload.completed.result;
      if (result.combine) {
        marshal.tryShiftRecord(result.draggableId, result.combine.draggableId);
      }
      marshal.tryRestoreFocusRecorded();
    }
  };
};

const shouldStop = action => guard(action, 'DROP_COMPLETE') || guard(action, 'DROP_ANIMATE') || guard(action, 'FLUSH');
var autoScroll = autoScroller => store => next => action => {
  if (shouldStop(action)) {
    autoScroller.stop();
    next(action);
    return;
  }
  if (guard(action, 'INITIAL_PUBLISH')) {
    next(action);
    const state = store.getState();
    !(state.phase === 'DRAGGING') ? process.env.NODE_ENV !== "production" ? invariant(false, 'Expected phase to be DRAGGING after INITIAL_PUBLISH') : invariant() : void 0;
    autoScroller.start(state);
    return;
  }
  next(action);
  autoScroller.scroll(store.getState());
};

const pendingDrop = store => next => action => {
  next(action);
  if (!guard(action, 'PUBLISH_WHILE_DRAGGING')) {
    return;
  }
  const postActionState = store.getState();
  if (postActionState.phase !== 'DROP_PENDING') {
    return;
  }
  if (postActionState.isWaiting) {
    return;
  }
  store.dispatch(drop({
    reason: postActionState.reason
  }));
};

const composeEnhancers = process.env.NODE_ENV !== 'production' && typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
  name: '@hello-pangea/dnd'
}) : redux.compose;
var createStore = ({
  dimensionMarshal,
  focusMarshal,
  styleMarshal,
  getResponders,
  announce,
  autoScroller
}) => redux.createStore(reducer, composeEnhancers(redux.applyMiddleware(style(styleMarshal), dimensionMarshalStopper(dimensionMarshal), lift(dimensionMarshal), dropMiddleware, dropAnimationFinishMiddleware, dropAnimationFlushOnScrollMiddleware, pendingDrop, autoScroll(autoScroller), scrollListener, focus(focusMarshal), responders(getResponders, announce))));

const clean$1 = () => ({
  additions: {},
  removals: {},
  modified: {}
});
function createPublisher({
  registry,
  callbacks
}) {
  let staging = clean$1();
  let frameId = null;
  const collect = () => {
    if (frameId) {
      return;
    }
    callbacks.collectionStarting();
    frameId = requestAnimationFrame(() => {
      frameId = null;
      start();
      const {
        additions,
        removals,
        modified
      } = staging;
      const added = Object.keys(additions).map(id => registry.draggable.getById(id).getDimension(origin)).sort((a, b) => a.descriptor.index - b.descriptor.index);
      const updated = Object.keys(modified).map(id => {
        const entry = registry.droppable.getById(id);
        const scroll = entry.callbacks.getScrollWhileDragging();
        return {
          droppableId: id,
          scroll
        };
      });
      const result = {
        additions: added,
        removals: Object.keys(removals),
        modified: updated
      };
      staging = clean$1();
      finish();
      callbacks.publish(result);
    });
  };
  const add = entry => {
    const id = entry.descriptor.id;
    staging.additions[id] = entry;
    staging.modified[entry.descriptor.droppableId] = true;
    if (staging.removals[id]) {
      delete staging.removals[id];
    }
    collect();
  };
  const remove = entry => {
    const descriptor = entry.descriptor;
    staging.removals[descriptor.id] = true;
    staging.modified[descriptor.droppableId] = true;
    if (staging.additions[descriptor.id]) {
      delete staging.additions[descriptor.id];
    }
    collect();
  };
  const stop = () => {
    if (!frameId) {
      return;
    }
    cancelAnimationFrame(frameId);
    frameId = null;
    staging = clean$1();
  };
  return {
    add,
    remove,
    stop
  };
}

var getMaxScroll = ({
  scrollHeight,
  scrollWidth,
  height,
  width
}) => {
  const maxScroll = subtract({
    x: scrollWidth,
    y: scrollHeight
  }, {
    x: width,
    y: height
  });
  const adjustedMaxScroll = {
    x: Math.max(0, maxScroll.x),
    y: Math.max(0, maxScroll.y)
  };
  return adjustedMaxScroll;
};

var getDocumentElement = () => {
  const doc = document.documentElement;
  !doc ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot find document.documentElement') : invariant() : void 0;
  return doc;
};

var getMaxWindowScroll = () => {
  const doc = getDocumentElement();
  const maxScroll = getMaxScroll({
    scrollHeight: doc.scrollHeight,
    scrollWidth: doc.scrollWidth,
    width: doc.clientWidth,
    height: doc.clientHeight
  });
  return maxScroll;
};

var getViewport = () => {
  const scroll = getWindowScroll();
  const maxScroll = getMaxWindowScroll();
  const top = scroll.y;
  const left = scroll.x;
  const doc = getDocumentElement();
  const width = doc.clientWidth;
  const height = doc.clientHeight;
  const right = left + width;
  const bottom = top + height;
  const frame = cssBoxModel.getRect({
    top,
    left,
    right,
    bottom
  });
  const viewport = {
    frame,
    scroll: {
      initial: scroll,
      current: scroll,
      max: maxScroll,
      diff: {
        value: origin,
        displacement: origin
      }
    }
  };
  return viewport;
};

var getInitialPublish = ({
  critical,
  scrollOptions,
  registry
}) => {
  start();
  const viewport = getViewport();
  const windowScroll = viewport.scroll.current;
  const home = critical.droppable;
  const droppables = registry.droppable.getAllByType(home.type).map(entry => entry.callbacks.getDimensionAndWatchScroll(windowScroll, scrollOptions));
  const draggables = registry.draggable.getAllByType(critical.draggable.type).map(entry => entry.getDimension(windowScroll));
  const dimensions = {
    draggables: toDraggableMap(draggables),
    droppables: toDroppableMap(droppables)
  };
  finish();
  const result = {
    dimensions,
    critical,
    viewport
  };
  return result;
};

function shouldPublishUpdate(registry, dragging, entry) {
  if (entry.descriptor.id === dragging.id) {
    return false;
  }
  if (entry.descriptor.type !== dragging.type) {
    return false;
  }
  const home = registry.droppable.getById(entry.descriptor.droppableId);
  if (home.descriptor.mode !== 'virtual') {
    process.env.NODE_ENV !== "production" ? warning(`
      You are attempting to add or remove a Draggable [id: ${entry.descriptor.id}]
      while a drag is occurring. This is only supported for virtual lists.

      See https://github.com/hello-pangea/dnd/blob/main/docs/patterns/virtual-lists.md
    `) : void 0;
    return false;
  }
  return true;
}
var createDimensionMarshal = (registry, callbacks) => {
  let collection = null;
  const publisher = createPublisher({
    callbacks: {
      publish: callbacks.publishWhileDragging,
      collectionStarting: callbacks.collectionStarting
    },
    registry
  });
  const updateDroppableIsEnabled = (id, isEnabled) => {
    !registry.droppable.exists(id) ? process.env.NODE_ENV !== "production" ? invariant(false, `Cannot update is enabled flag of Droppable ${id} as it is not registered`) : invariant() : void 0;
    if (!collection) {
      return;
    }
    callbacks.updateDroppableIsEnabled({
      id,
      isEnabled
    });
  };
  const updateDroppableIsCombineEnabled = (id, isCombineEnabled) => {
    if (!collection) {
      return;
    }
    !registry.droppable.exists(id) ? process.env.NODE_ENV !== "production" ? invariant(false, `Cannot update isCombineEnabled flag of Droppable ${id} as it is not registered`) : invariant() : void 0;
    callbacks.updateDroppableIsCombineEnabled({
      id,
      isCombineEnabled
    });
  };
  const updateDroppableScroll = (id, newScroll) => {
    if (!collection) {
      return;
    }
    !registry.droppable.exists(id) ? process.env.NODE_ENV !== "production" ? invariant(false, `Cannot update the scroll on Droppable ${id} as it is not registered`) : invariant() : void 0;
    callbacks.updateDroppableScroll({
      id,
      newScroll
    });
  };
  const scrollDroppable = (id, change) => {
    if (!collection) {
      return;
    }
    registry.droppable.getById(id).callbacks.scroll(change);
  };
  const stopPublishing = () => {
    if (!collection) {
      return;
    }
    publisher.stop();
    const home = collection.critical.droppable;
    registry.droppable.getAllByType(home.type).forEach(entry => entry.callbacks.dragStopped());
    collection.unsubscribe();
    collection = null;
  };
  const subscriber = event => {
    !collection ? process.env.NODE_ENV !== "production" ? invariant(false, 'Should only be subscribed when a collection is occurring') : invariant() : void 0;
    const dragging = collection.critical.draggable;
    if (event.type === 'ADDITION') {
      if (shouldPublishUpdate(registry, dragging, event.value)) {
        publisher.add(event.value);
      }
    }
    if (event.type === 'REMOVAL') {
      if (shouldPublishUpdate(registry, dragging, event.value)) {
        publisher.remove(event.value);
      }
    }
  };
  const startPublishing = request => {
    !!collection ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot start capturing critical dimensions as there is already a collection') : invariant() : void 0;
    const entry = registry.draggable.getById(request.draggableId);
    const home = registry.droppable.getById(entry.descriptor.droppableId);
    const critical = {
      draggable: entry.descriptor,
      droppable: home.descriptor
    };
    const unsubscribe = registry.subscribe(subscriber);
    collection = {
      critical,
      unsubscribe
    };
    return getInitialPublish({
      critical,
      registry,
      scrollOptions: request.scrollOptions
    });
  };
  const marshal = {
    updateDroppableIsEnabled,
    updateDroppableIsCombineEnabled,
    scrollDroppable,
    updateDroppableScroll,
    startPublishing,
    stopPublishing
  };
  return marshal;
};

var canStartDrag = (state, id) => {
  if (state.phase === 'IDLE') {
    return true;
  }
  if (state.phase !== 'DROP_ANIMATING') {
    return false;
  }
  if (state.completed.result.draggableId === id) {
    return false;
  }
  return state.completed.result.reason === 'DROP';
};

var scrollWindow = change => {
  window.scrollBy(change.x, change.y);
};

const getScrollableDroppables = memoizeOne(droppables => toDroppableList(droppables).filter(droppable => {
  if (!droppable.isEnabled) {
    return false;
  }
  if (!droppable.frame) {
    return false;
  }
  return true;
}));
const getScrollableDroppableOver = (target, droppables) => {
  const maybe = getScrollableDroppables(droppables).find(droppable => {
    !droppable.frame ? process.env.NODE_ENV !== "production" ? invariant(false, 'Invalid result') : invariant() : void 0;
    return isPositionInFrame(droppable.frame.pageMarginBox)(target);
  }) || null;
  return maybe;
};
var getBestScrollableDroppable = ({
  center,
  destination,
  droppables
}) => {
  if (destination) {
    const dimension = droppables[destination];
    if (!dimension.frame) {
      return null;
    }
    return dimension;
  }
  const dimension = getScrollableDroppableOver(center, droppables);
  return dimension;
};

const defaultAutoScrollerOptions = {
  startFromPercentage: 0.25,
  maxScrollAtPercentage: 0.05,
  maxPixelScroll: 28,
  ease: percentage => percentage ** 2,
  durationDampening: {
    stopDampeningAt: 1200,
    accelerateAt: 360
  },
  disabled: false
};

var getDistanceThresholds = (container, axis, getAutoScrollerOptions = () => defaultAutoScrollerOptions) => {
  const autoScrollerOptions = getAutoScrollerOptions();
  const startScrollingFrom = container[axis.size] * autoScrollerOptions.startFromPercentage;
  const maxScrollValueAt = container[axis.size] * autoScrollerOptions.maxScrollAtPercentage;
  const thresholds = {
    startScrollingFrom,
    maxScrollValueAt
  };
  return thresholds;
};

var getPercentage = ({
  startOfRange,
  endOfRange,
  current
}) => {
  const range = endOfRange - startOfRange;
  if (range === 0) {
    process.env.NODE_ENV !== "production" ? warning(`
      Detected distance range of 0 in the fluid auto scroller
      This is unexpected and would cause a divide by 0 issue.
      Not allowing an auto scroll
    `) : void 0;
    return 0;
  }
  const currentInRange = current - startOfRange;
  const percentage = currentInRange / range;
  return percentage;
};

var minScroll = 1;

var getValueFromDistance = (distanceToEdge, thresholds, getAutoScrollerOptions = () => defaultAutoScrollerOptions) => {
  const autoScrollerOptions = getAutoScrollerOptions();
  if (distanceToEdge > thresholds.startScrollingFrom) {
    return 0;
  }
  if (distanceToEdge <= thresholds.maxScrollValueAt) {
    return autoScrollerOptions.maxPixelScroll;
  }
  if (distanceToEdge === thresholds.startScrollingFrom) {
    return minScroll;
  }
  const percentageFromMaxScrollValueAt = getPercentage({
    startOfRange: thresholds.maxScrollValueAt,
    endOfRange: thresholds.startScrollingFrom,
    current: distanceToEdge
  });
  const percentageFromStartScrollingFrom = 1 - percentageFromMaxScrollValueAt;
  const scroll = autoScrollerOptions.maxPixelScroll * autoScrollerOptions.ease(percentageFromStartScrollingFrom);
  return Math.ceil(scroll);
};

var dampenValueByTime = (proposedScroll, dragStartTime, getAutoScrollerOptions) => {
  const autoScrollerOptions = getAutoScrollerOptions();
  const accelerateAt = autoScrollerOptions.durationDampening.accelerateAt;
  const stopAt = autoScrollerOptions.durationDampening.stopDampeningAt;
  const startOfRange = dragStartTime;
  const endOfRange = stopAt;
  const now = Date.now();
  const runTime = now - startOfRange;
  if (runTime >= stopAt) {
    return proposedScroll;
  }
  if (runTime < accelerateAt) {
    return minScroll;
  }
  const betweenAccelerateAtAndStopAtPercentage = getPercentage({
    startOfRange: accelerateAt,
    endOfRange,
    current: runTime
  });
  const scroll = proposedScroll * autoScrollerOptions.ease(betweenAccelerateAtAndStopAtPercentage);
  return Math.ceil(scroll);
};

var getValue = ({
  distanceToEdge,
  thresholds,
  dragStartTime,
  shouldUseTimeDampening,
  getAutoScrollerOptions
}) => {
  const scroll = getValueFromDistance(distanceToEdge, thresholds, getAutoScrollerOptions);
  if (scroll === 0) {
    return 0;
  }
  if (!shouldUseTimeDampening) {
    return scroll;
  }
  return Math.max(dampenValueByTime(scroll, dragStartTime, getAutoScrollerOptions), minScroll);
};

var getScrollOnAxis = ({
  container,
  distanceToEdges,
  dragStartTime,
  axis,
  shouldUseTimeDampening,
  getAutoScrollerOptions
}) => {
  const thresholds = getDistanceThresholds(container, axis, getAutoScrollerOptions);
  const isCloserToEnd = distanceToEdges[axis.end] < distanceToEdges[axis.start];
  if (isCloserToEnd) {
    return getValue({
      distanceToEdge: distanceToEdges[axis.end],
      thresholds,
      dragStartTime,
      shouldUseTimeDampening,
      getAutoScrollerOptions
    });
  }
  return -1 * getValue({
    distanceToEdge: distanceToEdges[axis.start],
    thresholds,
    dragStartTime,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
};

var adjustForSizeLimits = ({
  container,
  subject,
  proposedScroll
}) => {
  const isTooBigVertically = subject.height > container.height;
  const isTooBigHorizontally = subject.width > container.width;
  if (!isTooBigHorizontally && !isTooBigVertically) {
    return proposedScroll;
  }
  if (isTooBigHorizontally && isTooBigVertically) {
    return null;
  }
  return {
    x: isTooBigHorizontally ? 0 : proposedScroll.x,
    y: isTooBigVertically ? 0 : proposedScroll.y
  };
};

const clean = apply(value => value === 0 ? 0 : value);
var getScroll$1 = ({
  dragStartTime,
  container,
  subject,
  center,
  shouldUseTimeDampening,
  getAutoScrollerOptions
}) => {
  const distanceToEdges = {
    top: center.y - container.top,
    right: container.right - center.x,
    bottom: container.bottom - center.y,
    left: center.x - container.left
  };
  const y = getScrollOnAxis({
    container,
    distanceToEdges,
    dragStartTime,
    axis: vertical,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
  const x = getScrollOnAxis({
    container,
    distanceToEdges,
    dragStartTime,
    axis: horizontal,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
  const required = clean({
    x,
    y
  });
  if (isEqual$1(required, origin)) {
    return null;
  }
  const limited = adjustForSizeLimits({
    container,
    subject,
    proposedScroll: required
  });
  if (!limited) {
    return null;
  }
  return isEqual$1(limited, origin) ? null : limited;
};

const smallestSigned = apply(value => {
  if (value === 0) {
    return 0;
  }
  return value > 0 ? 1 : -1;
});
const getOverlap = (() => {
  const getRemainder = (target, max) => {
    if (target < 0) {
      return target;
    }
    if (target > max) {
      return target - max;
    }
    return 0;
  };
  return ({
    current,
    max,
    change
  }) => {
    const targetScroll = add(current, change);
    const overlap = {
      x: getRemainder(targetScroll.x, max.x),
      y: getRemainder(targetScroll.y, max.y)
    };
    if (isEqual$1(overlap, origin)) {
      return null;
    }
    return overlap;
  };
})();
const canPartiallyScroll = ({
  max: rawMax,
  current,
  change
}) => {
  const max = {
    x: Math.max(current.x, rawMax.x),
    y: Math.max(current.y, rawMax.y)
  };
  const smallestChange = smallestSigned(change);
  const overlap = getOverlap({
    max,
    current,
    change: smallestChange
  });
  if (!overlap) {
    return true;
  }
  if (smallestChange.x !== 0 && overlap.x === 0) {
    return true;
  }
  if (smallestChange.y !== 0 && overlap.y === 0) {
    return true;
  }
  return false;
};
const canScrollWindow = (viewport, change) => canPartiallyScroll({
  current: viewport.scroll.current,
  max: viewport.scroll.max,
  change
});
const getWindowOverlap = (viewport, change) => {
  if (!canScrollWindow(viewport, change)) {
    return null;
  }
  const max = viewport.scroll.max;
  const current = viewport.scroll.current;
  return getOverlap({
    current,
    max,
    change
  });
};
const canScrollDroppable = (droppable, change) => {
  const frame = droppable.frame;
  if (!frame) {
    return false;
  }
  return canPartiallyScroll({
    current: frame.scroll.current,
    max: frame.scroll.max,
    change
  });
};
const getDroppableOverlap = (droppable, change) => {
  const frame = droppable.frame;
  if (!frame) {
    return null;
  }
  if (!canScrollDroppable(droppable, change)) {
    return null;
  }
  return getOverlap({
    current: frame.scroll.current,
    max: frame.scroll.max,
    change
  });
};

var getWindowScrollChange = ({
  viewport,
  subject,
  center,
  dragStartTime,
  shouldUseTimeDampening,
  getAutoScrollerOptions
}) => {
  const scroll = getScroll$1({
    dragStartTime,
    container: viewport.frame,
    subject,
    center,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
  return scroll && canScrollWindow(viewport, scroll) ? scroll : null;
};

var getDroppableScrollChange = ({
  droppable,
  subject,
  center,
  dragStartTime,
  shouldUseTimeDampening,
  getAutoScrollerOptions
}) => {
  const frame = droppable.frame;
  if (!frame) {
    return null;
  }
  const scroll = getScroll$1({
    dragStartTime,
    container: frame.pageMarginBox,
    subject,
    center,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
  return scroll && canScrollDroppable(droppable, scroll) ? scroll : null;
};

var scroll = ({
  state,
  dragStartTime,
  shouldUseTimeDampening,
  scrollWindow,
  scrollDroppable,
  getAutoScrollerOptions
}) => {
  const center = state.current.page.borderBoxCenter;
  const draggable = state.dimensions.draggables[state.critical.draggable.id];
  const subject = draggable.page.marginBox;
  if (state.isWindowScrollAllowed) {
    const viewport = state.viewport;
    const change = getWindowScrollChange({
      dragStartTime,
      viewport,
      subject,
      center,
      shouldUseTimeDampening,
      getAutoScrollerOptions
    });
    if (change) {
      scrollWindow(change);
      return;
    }
  }
  const droppable = getBestScrollableDroppable({
    center,
    destination: whatIsDraggedOver(state.impact),
    droppables: state.dimensions.droppables
  });
  if (!droppable) {
    return;
  }
  const change = getDroppableScrollChange({
    dragStartTime,
    droppable,
    subject,
    center,
    shouldUseTimeDampening,
    getAutoScrollerOptions
  });
  if (change) {
    scrollDroppable(droppable.descriptor.id, change);
  }
};

var createFluidScroller = ({
  scrollWindow,
  scrollDroppable,
  getAutoScrollerOptions = () => defaultAutoScrollerOptions
}) => {
  const scheduleWindowScroll = rafSchd(scrollWindow);
  const scheduleDroppableScroll = rafSchd(scrollDroppable);
  let dragging = null;
  const tryScroll = state => {
    !dragging ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot fluid scroll if not dragging') : invariant() : void 0;
    const {
      shouldUseTimeDampening,
      dragStartTime
    } = dragging;
    scroll({
      state,
      scrollWindow: scheduleWindowScroll,
      scrollDroppable: scheduleDroppableScroll,
      dragStartTime,
      shouldUseTimeDampening,
      getAutoScrollerOptions
    });
  };
  const start$1 = state => {
    start();
    !!dragging ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot start auto scrolling when already started') : invariant() : void 0;
    const dragStartTime = Date.now();
    let wasScrollNeeded = false;
    const fakeScrollCallback = () => {
      wasScrollNeeded = true;
    };
    scroll({
      state,
      dragStartTime: 0,
      shouldUseTimeDampening: false,
      scrollWindow: fakeScrollCallback,
      scrollDroppable: fakeScrollCallback,
      getAutoScrollerOptions
    });
    dragging = {
      dragStartTime,
      shouldUseTimeDampening: wasScrollNeeded
    };
    finish();
    if (wasScrollNeeded) {
      tryScroll(state);
    }
  };
  const stop = () => {
    if (!dragging) {
      return;
    }
    scheduleWindowScroll.cancel();
    scheduleDroppableScroll.cancel();
    dragging = null;
  };
  return {
    start: start$1,
    stop,
    scroll: tryScroll
  };
};

var createJumpScroller = ({
  move,
  scrollDroppable,
  scrollWindow
}) => {
  const moveByOffset = (state, offset) => {
    const client = add(state.current.client.selection, offset);
    move({
      client
    });
  };
  const scrollDroppableAsMuchAsItCan = (droppable, change) => {
    if (!canScrollDroppable(droppable, change)) {
      return change;
    }
    const overlap = getDroppableOverlap(droppable, change);
    if (!overlap) {
      scrollDroppable(droppable.descriptor.id, change);
      return null;
    }
    const whatTheDroppableCanScroll = subtract(change, overlap);
    scrollDroppable(droppable.descriptor.id, whatTheDroppableCanScroll);
    const remainder = subtract(change, whatTheDroppableCanScroll);
    return remainder;
  };
  const scrollWindowAsMuchAsItCan = (isWindowScrollAllowed, viewport, change) => {
    if (!isWindowScrollAllowed) {
      return change;
    }
    if (!canScrollWindow(viewport, change)) {
      return change;
    }
    const overlap = getWindowOverlap(viewport, change);
    if (!overlap) {
      scrollWindow(change);
      return null;
    }
    const whatTheWindowCanScroll = subtract(change, overlap);
    scrollWindow(whatTheWindowCanScroll);
    const remainder = subtract(change, whatTheWindowCanScroll);
    return remainder;
  };
  const jumpScroller = state => {
    const request = state.scrollJumpRequest;
    if (!request) {
      return;
    }
    const destination = whatIsDraggedOver(state.impact);
    !destination ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot perform a jump scroll when there is no destination') : invariant() : void 0;
    const droppableRemainder = scrollDroppableAsMuchAsItCan(state.dimensions.droppables[destination], request);
    if (!droppableRemainder) {
      return;
    }
    const viewport = state.viewport;
    const windowRemainder = scrollWindowAsMuchAsItCan(state.isWindowScrollAllowed, viewport, droppableRemainder);
    if (!windowRemainder) {
      return;
    }
    moveByOffset(state, windowRemainder);
  };
  return jumpScroller;
};

var createAutoScroller = ({
  scrollDroppable,
  scrollWindow,
  move,
  getAutoScrollerOptions
}) => {
  const fluidScroller = createFluidScroller({
    scrollWindow,
    scrollDroppable,
    getAutoScrollerOptions
  });
  const jumpScroll = createJumpScroller({
    move,
    scrollWindow,
    scrollDroppable
  });
  const scroll = state => {
    const autoScrollerOptions = getAutoScrollerOptions();
    if (autoScrollerOptions.disabled || state.phase !== 'DRAGGING') {
      return;
    }
    if (state.movementMode === 'FLUID') {
      fluidScroller.scroll(state);
      return;
    }
    if (!state.scrollJumpRequest) {
      return;
    }
    jumpScroll(state);
  };
  const scroller = {
    scroll,
    start: fluidScroller.start,
    stop: fluidScroller.stop
  };
  return scroller;
};

const prefix = 'data-rfd';
const dragHandle = (() => {
  const base = `${prefix}-drag-handle`;
  return {
    base,
    draggableId: `${base}-draggable-id`,
    contextId: `${base}-context-id`
  };
})();
const draggable = (() => {
  const base = `${prefix}-draggable`;
  return {
    base,
    contextId: `${base}-context-id`,
    id: `${base}-id`
  };
})();
const droppable = (() => {
  const base = `${prefix}-droppable`;
  return {
    base,
    contextId: `${base}-context-id`,
    id: `${base}-id`
  };
})();
const scrollContainer = {
  contextId: `${prefix}-scroll-container-context-id`
};

const makeGetSelector = context => attribute => `[${attribute}="${context}"]`;
const getStyles = (rules, property) => rules.map(rule => {
  const value = rule.styles[property];
  if (!value) {
    return '';
  }
  return `${rule.selector} { ${value} }`;
}).join(' ');
const noPointerEvents = 'pointer-events: none;';
var getStyles$1 = contextId => {
  const getSelector = makeGetSelector(contextId);
  const dragHandle$1 = (() => {
    const grabCursor = `
      cursor: -webkit-grab;
      cursor: grab;
    `;
    return {
      selector: getSelector(dragHandle.contextId),
      styles: {
        always: `
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: rgba(0,0,0,0);
          touch-action: manipulation;
        `,
        resting: grabCursor,
        dragging: noPointerEvents,
        dropAnimating: grabCursor
      }
    };
  })();
  const draggable$1 = (() => {
    const transition = `
      transition: ${transitions.outOfTheWay};
    `;
    return {
      selector: getSelector(draggable.contextId),
      styles: {
        dragging: transition,
        dropAnimating: transition,
        userCancel: transition
      }
    };
  })();
  const droppable$1 = {
    selector: getSelector(droppable.contextId),
    styles: {
      always: `overflow-anchor: none;`
    }
  };
  const body = {
    selector: 'body',
    styles: {
      dragging: `
        cursor: grabbing;
        cursor: -webkit-grabbing;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        overflow-anchor: none;
      `
    }
  };
  const rules = [draggable$1, dragHandle$1, droppable$1, body];
  return {
    always: getStyles(rules, 'always'),
    resting: getStyles(rules, 'resting'),
    dragging: getStyles(rules, 'dragging'),
    dropAnimating: getStyles(rules, 'dropAnimating'),
    userCancel: getStyles(rules, 'userCancel')
  };
};

const useIsomorphicLayoutEffect = typeof window !== 'undefined' && typeof window.document !== 'undefined' && typeof window.document.createElement !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const getHead = () => {
  const head = document.querySelector('head');
  !head ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot find the head to append a style to') : invariant() : void 0;
  return head;
};
const createStyleEl = nonce => {
  const el = document.createElement('style');
  if (nonce) {
    el.setAttribute('nonce', nonce);
  }
  el.type = 'text/css';
  return el;
};
function useStyleMarshal(contextId, nonce) {
  const styles = useMemo(() => getStyles$1(contextId), [contextId]);
  const alwaysRef = React.useRef(null);
  const dynamicRef = React.useRef(null);
  const setDynamicStyle = useCallback(memoizeOne(proposed => {
    const el = dynamicRef.current;
    !el ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot set dynamic style element if it is not set') : invariant() : void 0;
    el.textContent = proposed;
  }), []);
  const setAlwaysStyle = useCallback(proposed => {
    const el = alwaysRef.current;
    !el ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot set dynamic style element if it is not set') : invariant() : void 0;
    el.textContent = proposed;
  }, []);
  useIsomorphicLayoutEffect(() => {
    !(!alwaysRef.current && !dynamicRef.current) ? process.env.NODE_ENV !== "production" ? invariant(false, 'style elements already mounted') : invariant() : void 0;
    const always = createStyleEl(nonce);
    const dynamic = createStyleEl(nonce);
    alwaysRef.current = always;
    dynamicRef.current = dynamic;
    always.setAttribute(`${prefix}-always`, contextId);
    dynamic.setAttribute(`${prefix}-dynamic`, contextId);
    getHead().appendChild(always);
    getHead().appendChild(dynamic);
    setAlwaysStyle(styles.always);
    setDynamicStyle(styles.resting);
    return () => {
      const remove = ref => {
        const current = ref.current;
        !current ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot unmount ref as it is not set') : invariant() : void 0;
        getHead().removeChild(current);
        ref.current = null;
      };
      remove(alwaysRef);
      remove(dynamicRef);
    };
  }, [nonce, setAlwaysStyle, setDynamicStyle, styles.always, styles.resting, contextId]);
  const dragging = useCallback(() => setDynamicStyle(styles.dragging), [setDynamicStyle, styles.dragging]);
  const dropping = useCallback(reason => {
    if (reason === 'DROP') {
      setDynamicStyle(styles.dropAnimating);
      return;
    }
    setDynamicStyle(styles.userCancel);
  }, [setDynamicStyle, styles.dropAnimating, styles.userCancel]);
  const resting = useCallback(() => {
    if (!dynamicRef.current) {
      return;
    }
    setDynamicStyle(styles.resting);
  }, [setDynamicStyle, styles.resting]);
  const marshal = useMemo(() => ({
    dragging,
    dropping,
    resting
  }), [dragging, dropping, resting]);
  return marshal;
}

function querySelectorAll(parentNode, selector) {
  return Array.from(parentNode.querySelectorAll(selector));
}

var getWindowFromEl = el => {
  if (el && el.ownerDocument && el.ownerDocument.defaultView) {
    return el.ownerDocument.defaultView;
  }
  return window;
};

function isHtmlElement(el) {
  return el instanceof getWindowFromEl(el).HTMLElement;
}

function findDragHandle(contextId, draggableId) {
  const selector = `[${dragHandle.contextId}="${contextId}"]`;
  const possible = querySelectorAll(document, selector);
  if (!possible.length) {
    process.env.NODE_ENV !== "production" ? warning(`Unable to find any drag handles in the context "${contextId}"`) : void 0;
    return null;
  }
  const handle = possible.find(el => {
    return el.getAttribute(dragHandle.draggableId) === draggableId;
  });
  if (!handle) {
    process.env.NODE_ENV !== "production" ? warning(`Unable to find drag handle with id "${draggableId}" as no handle with a matching id was found`) : void 0;
    return null;
  }
  if (!isHtmlElement(handle)) {
    process.env.NODE_ENV !== "production" ? warning('drag handle needs to be a HTMLElement') : void 0;
    return null;
  }
  return handle;
}

function useFocusMarshal(contextId) {
  const entriesRef = React.useRef({});
  const recordRef = React.useRef(null);
  const restoreFocusFrameRef = React.useRef(null);
  const isMountedRef = React.useRef(false);
  const register = useCallback(function register(id, focus) {
    const entry = {
      id,
      focus
    };
    entriesRef.current[id] = entry;
    return function unregister() {
      const entries = entriesRef.current;
      const current = entries[id];
      if (current !== entry) {
        delete entries[id];
      }
    };
  }, []);
  const tryGiveFocus = useCallback(function tryGiveFocus(tryGiveFocusTo) {
    const handle = findDragHandle(contextId, tryGiveFocusTo);
    if (handle && handle !== document.activeElement) {
      handle.focus();
    }
  }, [contextId]);
  const tryShiftRecord = useCallback(function tryShiftRecord(previous, redirectTo) {
    if (recordRef.current === previous) {
      recordRef.current = redirectTo;
    }
  }, []);
  const tryRestoreFocusRecorded = useCallback(function tryRestoreFocusRecorded() {
    if (restoreFocusFrameRef.current) {
      return;
    }
    if (!isMountedRef.current) {
      return;
    }
    restoreFocusFrameRef.current = requestAnimationFrame(() => {
      restoreFocusFrameRef.current = null;
      const record = recordRef.current;
      if (record) {
        tryGiveFocus(record);
      }
    });
  }, [tryGiveFocus]);
  const tryRecordFocus = useCallback(function tryRecordFocus(id) {
    recordRef.current = null;
    const focused = document.activeElement;
    if (!focused) {
      return;
    }
    if (focused.getAttribute(dragHandle.draggableId) !== id) {
      return;
    }
    recordRef.current = id;
  }, []);
  useIsomorphicLayoutEffect(() => {
    isMountedRef.current = true;
    return function clearFrameOnUnmount() {
      isMountedRef.current = false;
      const frameId = restoreFocusFrameRef.current;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);
  const marshal = useMemo(() => ({
    register,
    tryRecordFocus,
    tryRestoreFocusRecorded,
    tryShiftRecord
  }), [register, tryRecordFocus, tryRestoreFocusRecorded, tryShiftRecord]);
  return marshal;
}

function createRegistry() {
  const entries = {
    draggables: {},
    droppables: {}
  };
  const subscribers = [];
  function subscribe(cb) {
    subscribers.push(cb);
    return function unsubscribe() {
      const index = subscribers.indexOf(cb);
      if (index === -1) {
        return;
      }
      subscribers.splice(index, 1);
    };
  }
  function notify(event) {
    if (subscribers.length) {
      subscribers.forEach(cb => cb(event));
    }
  }
  function findDraggableById(id) {
    return entries.draggables[id] || null;
  }
  function getDraggableById(id) {
    const entry = findDraggableById(id);
    !entry ? process.env.NODE_ENV !== "production" ? invariant(false, `Cannot find draggable entry with id [${id}]`) : invariant() : void 0;
    return entry;
  }
  const draggableAPI = {
    register: entry => {
      entries.draggables[entry.descriptor.id] = entry;
      notify({
        type: 'ADDITION',
        value: entry
      });
    },
    update: (entry, last) => {
      const current = entries.draggables[last.descriptor.id];
      if (!current) {
        return;
      }
      if (current.uniqueId !== entry.uniqueId) {
        return;
      }
      delete entries.draggables[last.descriptor.id];
      entries.draggables[entry.descriptor.id] = entry;
    },
    unregister: entry => {
      const draggableId = entry.descriptor.id;
      const current = findDraggableById(draggableId);
      if (!current) {
        return;
      }
      if (entry.uniqueId !== current.uniqueId) {
        return;
      }
      delete entries.draggables[draggableId];
      if (entries.droppables[entry.descriptor.droppableId]) {
        notify({
          type: 'REMOVAL',
          value: entry
        });
      }
    },
    getById: getDraggableById,
    findById: findDraggableById,
    exists: id => Boolean(findDraggableById(id)),
    getAllByType: type => Object.values(entries.draggables).filter(entry => entry.descriptor.type === type)
  };
  function findDroppableById(id) {
    return entries.droppables[id] || null;
  }
  function getDroppableById(id) {
    const entry = findDroppableById(id);
    !entry ? process.env.NODE_ENV !== "production" ? invariant(false, `Cannot find droppable entry with id [${id}]`) : invariant() : void 0;
    return entry;
  }
  const droppableAPI = {
    register: entry => {
      entries.droppables[entry.descriptor.id] = entry;
    },
    unregister: entry => {
      const current = findDroppableById(entry.descriptor.id);
      if (!current) {
        return;
      }
      if (entry.uniqueId !== current.uniqueId) {
        return;
      }
      delete entries.droppables[entry.descriptor.id];
    },
    getById: getDroppableById,
    findById: findDroppableById,
    exists: id => Boolean(findDroppableById(id)),
    getAllByType: type => Object.values(entries.droppables).filter(entry => entry.descriptor.type === type)
  };
  function clean() {
    entries.draggables = {};
    entries.droppables = {};
    subscribers.length = 0;
  }
  return {
    draggable: draggableAPI,
    droppable: droppableAPI,
    subscribe,
    clean
  };
}

function useRegistry() {
  const registry = useMemo(createRegistry, []);
  React.useEffect(() => {
    return function unmount() {
      registry.clean();
    };
  }, [registry]);
  return registry;
}

var StoreContext = React.createContext(null);

var getBodyElement = () => {
  const body = document.body;
  !body ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot find document.body') : invariant() : void 0;
  return body;
};

const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  border: '0',
  padding: '0',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  'clip-path': 'inset(100%)'
};

const getId = contextId => `rfd-announcement-${contextId}`;
function useAnnouncer(contextId) {
  const id = useMemo(() => getId(contextId), [contextId]);
  const ref = React.useRef(null);
  React.useEffect(function setup() {
    const el = document.createElement('div');
    ref.current = el;
    el.id = id;
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-atomic', 'true');
    _extends(el.style, visuallyHidden);
    getBodyElement().appendChild(el);
    return function cleanup() {
      setTimeout(function remove() {
        const body = getBodyElement();
        if (body.contains(el)) {
          body.removeChild(el);
        }
        if (el === ref.current) {
          ref.current = null;
        }
      });
    };
  }, [id]);
  const announce = useCallback(message => {
    const el = ref.current;
    if (el) {
      el.textContent = message;
      return;
    }
    process.env.NODE_ENV !== "production" ? warning(`
      A screen reader message was trying to be announced but it was unable to do so.
      This can occur if you unmount your <DragDropContext /> in your onDragEnd.
      Consider calling provided.announce() before the unmount so that the instruction will
      not be lost for users relying on a screen reader.

      Message not passed to screen reader:

      "${message}"
    `) : void 0;
  }, []);
  return announce;
}

const defaults = {
  separator: '::'
};
function useUniqueId(prefix, options = defaults) {
  const id = React.useId();
  return useMemo(() => `${prefix}${options.separator}${id}`, [options.separator, prefix, id]);
}

function getElementId({
  contextId,
  uniqueId
}) {
  return `rfd-hidden-text-${contextId}-${uniqueId}`;
}
function useHiddenTextElement({
  contextId,
  text
}) {
  const uniqueId = useUniqueId('hidden-text', {
    separator: '-'
  });
  const id = useMemo(() => getElementId({
    contextId,
    uniqueId
  }), [uniqueId, contextId]);
  React.useEffect(function mount() {
    const el = document.createElement('div');
    el.id = id;
    el.textContent = text;
    el.style.display = 'none';
    getBodyElement().appendChild(el);
    return function unmount() {
      const body = getBodyElement();
      if (body.contains(el)) {
        body.removeChild(el);
      }
    };
  }, [id, text]);
  return id;
}

var AppContext = React.createContext(null);

var peerDependencies = {
	react: "^18.0.0 || ^19.0.0"};

const semver = /(\d+)\.(\d+)\.(\d+)/;
const getVersion = value => {
  const result = semver.exec(value);
  !(result != null) ? process.env.NODE_ENV !== "production" ? invariant(false, `Unable to parse React version ${value}`) : invariant() : void 0;
  const major = Number(result[1]);
  const minor = Number(result[2]);
  const patch = Number(result[3]);
  return {
    major,
    minor,
    patch,
    raw: value
  };
};
const isSatisfied = (expected, actual) => {
  if (actual.major > expected.major) {
    return true;
  }
  if (actual.major < expected.major) {
    return false;
  }
  if (actual.minor > expected.minor) {
    return true;
  }
  if (actual.minor < expected.minor) {
    return false;
  }
  return actual.patch >= expected.patch;
};
var checkReactVersion = (peerDepValue, actualValue) => {
  const peerDep = getVersion(peerDepValue);
  const actual = getVersion(actualValue);
  if (isSatisfied(peerDep, actual)) {
    return;
  }
  process.env.NODE_ENV !== "production" ? warning(`
    React version: [${actual.raw}]
    does not satisfy expected peer dependency version: [${peerDep.raw}]

    This can result in run time bugs, and even fatal crashes
  `) : void 0;
};

const suffix = `
  We expect a html5 doctype: <!doctype html>
  This is to ensure consistent browser layout and measurement

  More information: https://github.com/hello-pangea/dnd/blob/main/docs/guides/doctype.md
`;
var checkDoctype = doc => {
  const doctype = doc.doctype;
  if (!doctype) {
    process.env.NODE_ENV !== "production" ? warning(`
      No <!doctype html> found.

      ${suffix}
    `) : void 0;
    return;
  }
  if (doctype.name.toLowerCase() !== 'html') {
    process.env.NODE_ENV !== "production" ? warning(`
      Unexpected <!doctype> found: (${doctype.name})

      ${suffix}
    `) : void 0;
  }
  if (doctype.publicId !== '') {
    process.env.NODE_ENV !== "production" ? warning(`
      Unexpected <!doctype> publicId found: (${doctype.publicId})
      A html5 doctype does not have a publicId

      ${suffix}
    `) : void 0;
  }
};

function useDev(useHook) {
  if (process.env.NODE_ENV !== 'production') {
    useHook();
  }
}

function useDevSetupWarning(fn, inputs) {
  useDev(() => {
    React.useEffect(() => {
      try {
        fn();
      } catch (e) {
        error(`
          A setup problem was encountered.

          > ${e.message}
        `);
      }
    }, inputs);
  });
}

function useStartupValidation() {
  useDevSetupWarning(() => {
    checkReactVersion(peerDependencies.react, React.version);
    checkDoctype(document);
  }, []);
}

function usePrevious(current) {
  const ref = React.useRef(current);
  React.useEffect(() => {
    ref.current = current;
  });
  return ref;
}

function create() {
  let lock = null;
  function isClaimed() {
    return Boolean(lock);
  }
  function isActive(value) {
    return value === lock;
  }
  function claim(abandon) {
    !!lock ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot claim lock as it is already claimed') : invariant() : void 0;
    const newLock = {
      abandon
    };
    lock = newLock;
    return newLock;
  }
  function release() {
    !lock ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot release lock when there is no lock') : invariant() : void 0;
    lock = null;
  }
  function tryAbandon() {
    if (lock) {
      lock.abandon();
      release();
    }
  }
  return {
    isClaimed,
    isActive,
    claim,
    release,
    tryAbandon
  };
}

function isDragging(state) {
  if (state.phase === 'IDLE' || state.phase === 'DROP_ANIMATING') {
    return false;
  }
  return state.isDragging;
}

const tab = 9;
const enter = 13;
const escape = 27;
const space = 32;
const pageUp = 33;
const pageDown = 34;
const end = 35;
const home = 36;
const arrowLeft = 37;
const arrowUp = 38;
const arrowRight = 39;
const arrowDown = 40;

const preventedKeys = {
  [enter]: true,
  [tab]: true
};
var preventStandardKeyEvents = event => {
  if (preventedKeys[event.keyCode]) {
    event.preventDefault();
  }
};

const supportedEventName = (() => {
  const base = 'visibilitychange';
  if (typeof document === 'undefined') {
    return base;
  }
  const candidates = [base, `ms${base}`, `webkit${base}`, `moz${base}`, `o${base}`];
  const supported = candidates.find(eventName => `on${eventName}` in document);
  return supported || base;
})();

const primaryButton = 0;
const sloppyClickThreshold = 5;
function isSloppyClickThresholdExceeded(original, current) {
  return Math.abs(current.x - original.x) >= sloppyClickThreshold || Math.abs(current.y - original.y) >= sloppyClickThreshold;
}
const idle$1 = {
  type: 'IDLE'
};
function getCaptureBindings({
  cancel,
  completed,
  getPhase,
  setPhase
}) {
  return [{
    eventName: 'mousemove',
    fn: event => {
      const {
        button,
        clientX,
        clientY
      } = event;
      if (button !== primaryButton) {
        return;
      }
      const point = {
        x: clientX,
        y: clientY
      };
      const phase = getPhase();
      if (phase.type === 'DRAGGING') {
        event.preventDefault();
        phase.actions.move(point);
        return;
      }
      !(phase.type === 'PENDING') ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot be IDLE') : invariant() : void 0;
      const pending = phase.point;
      if (!isSloppyClickThresholdExceeded(pending, point)) {
        return;
      }
      event.preventDefault();
      const actions = phase.actions.fluidLift(point);
      setPhase({
        type: 'DRAGGING',
        actions
      });
    }
  }, {
    eventName: 'mouseup',
    fn: event => {
      const phase = getPhase();
      if (phase.type !== 'DRAGGING') {
        cancel();
        return;
      }
      event.preventDefault();
      phase.actions.drop({
        shouldBlockNextClick: true
      });
      completed();
    }
  }, {
    eventName: 'mousedown',
    fn: event => {
      if (getPhase().type === 'DRAGGING') {
        event.preventDefault();
      }
      cancel();
    }
  }, {
    eventName: 'keydown',
    fn: event => {
      const phase = getPhase();
      if (phase.type === 'PENDING') {
        cancel();
        return;
      }
      if (event.keyCode === escape) {
        event.preventDefault();
        cancel();
        return;
      }
      preventStandardKeyEvents(event);
    }
  }, {
    eventName: 'resize',
    fn: cancel
  }, {
    eventName: 'scroll',
    options: {
      passive: true,
      capture: false
    },
    fn: () => {
      if (getPhase().type === 'PENDING') {
        cancel();
      }
    }
  }, {
    eventName: 'webkitmouseforcedown',
    fn: event => {
      const phase = getPhase();
      !(phase.type !== 'IDLE') ? process.env.NODE_ENV !== "production" ? invariant(false, 'Unexpected phase') : invariant() : void 0;
      if (phase.actions.shouldRespectForcePress()) {
        cancel();
        return;
      }
      event.preventDefault();
    }
  }, {
    eventName: supportedEventName,
    fn: cancel
  }];
}
function useMouseSensor(api) {
  const phaseRef = React.useRef(idle$1);
  const unbindEventsRef = React.useRef(noop$2);
  const startCaptureBinding = useMemo(() => ({
    eventName: 'mousedown',
    fn: function onMouseDown(event) {
      if (event.defaultPrevented) {
        return;
      }
      if (event.button !== primaryButton) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
      }
      const draggableId = api.findClosestDraggableId(event);
      if (!draggableId) {
        return;
      }
      const actions = api.tryGetLock(draggableId, stop, {
        sourceEvent: event
      });
      if (!actions) {
        return;
      }
      event.preventDefault();
      const point = {
        x: event.clientX,
        y: event.clientY
      };
      unbindEventsRef.current();
      startPendingDrag(actions, point);
    }
  }), [api]);
  const preventForcePressBinding = useMemo(() => ({
    eventName: 'webkitmouseforcewillbegin',
    fn: event => {
      if (event.defaultPrevented) {
        return;
      }
      const id = api.findClosestDraggableId(event);
      if (!id) {
        return;
      }
      const options = api.findOptionsForDraggable(id);
      if (!options) {
        return;
      }
      if (options.shouldRespectForcePress) {
        return;
      }
      if (!api.canGetLock(id)) {
        return;
      }
      event.preventDefault();
    }
  }), [api]);
  const listenForCapture = useCallback(function listenForCapture() {
    const options = {
      passive: false,
      capture: true
    };
    unbindEventsRef.current = bindEvents(window, [preventForcePressBinding, startCaptureBinding], options);
  }, [preventForcePressBinding, startCaptureBinding]);
  const stop = useCallback(() => {
    const current = phaseRef.current;
    if (current.type === 'IDLE') {
      return;
    }
    phaseRef.current = idle$1;
    unbindEventsRef.current();
    listenForCapture();
  }, [listenForCapture]);
  const cancel = useCallback(() => {
    const phase = phaseRef.current;
    stop();
    if (phase.type === 'DRAGGING') {
      phase.actions.cancel({
        shouldBlockNextClick: true
      });
    }
    if (phase.type === 'PENDING') {
      phase.actions.abort();
    }
  }, [stop]);
  const bindCapturingEvents = useCallback(function bindCapturingEvents() {
    const options = {
      capture: true,
      passive: false
    };
    const bindings = getCaptureBindings({
      cancel,
      completed: stop,
      getPhase: () => phaseRef.current,
      setPhase: phase => {
        phaseRef.current = phase;
      }
    });
    unbindEventsRef.current = bindEvents(window, bindings, options);
  }, [cancel, stop]);
  const startPendingDrag = useCallback(function startPendingDrag(actions, point) {
    !(phaseRef.current.type === 'IDLE') ? process.env.NODE_ENV !== "production" ? invariant(false, 'Expected to move from IDLE to PENDING drag') : invariant() : void 0;
    phaseRef.current = {
      type: 'PENDING',
      point,
      actions
    };
    bindCapturingEvents();
  }, [bindCapturingEvents]);
  useIsomorphicLayoutEffect(function mount() {
    listenForCapture();
    return function unmount() {
      unbindEventsRef.current();
    };
  }, [listenForCapture]);
}

function noop$1() {}
const scrollJumpKeys = {
  [pageDown]: true,
  [pageUp]: true,
  [home]: true,
  [end]: true
};
function getDraggingBindings(actions, stop) {
  function cancel() {
    stop();
    actions.cancel();
  }
  function drop() {
    stop();
    actions.drop();
  }
  return [{
    eventName: 'keydown',
    fn: event => {
      if (event.keyCode === escape) {
        event.preventDefault();
        cancel();
        return;
      }
      if (event.keyCode === space) {
        event.preventDefault();
        drop();
        return;
      }
      if (event.keyCode === arrowDown) {
        event.preventDefault();
        actions.moveDown();
        return;
      }
      if (event.keyCode === arrowUp) {
        event.preventDefault();
        actions.moveUp();
        return;
      }
      if (event.keyCode === arrowRight) {
        event.preventDefault();
        actions.moveRight();
        return;
      }
      if (event.keyCode === arrowLeft) {
        event.preventDefault();
        actions.moveLeft();
        return;
      }
      if (scrollJumpKeys[event.keyCode]) {
        event.preventDefault();
        return;
      }
      preventStandardKeyEvents(event);
    }
  }, {
    eventName: 'mousedown',
    fn: cancel
  }, {
    eventName: 'mouseup',
    fn: cancel
  }, {
    eventName: 'click',
    fn: cancel
  }, {
    eventName: 'touchstart',
    fn: cancel
  }, {
    eventName: 'resize',
    fn: cancel
  }, {
    eventName: 'wheel',
    fn: cancel,
    options: {
      passive: true
    }
  }, {
    eventName: supportedEventName,
    fn: cancel
  }];
}
function useKeyboardSensor(api) {
  const unbindEventsRef = React.useRef(noop$1);
  const startCaptureBinding = useMemo(() => ({
    eventName: 'keydown',
    fn: function onKeyDown(event) {
      if (event.defaultPrevented) {
        return;
      }
      if (event.keyCode !== space) {
        return;
      }
      const draggableId = api.findClosestDraggableId(event);
      if (!draggableId) {
        return;
      }
      const preDrag = api.tryGetLock(draggableId, stop, {
        sourceEvent: event
      });
      if (!preDrag) {
        return;
      }
      event.preventDefault();
      let isCapturing = true;
      const actions = preDrag.snapLift();
      unbindEventsRef.current();
      function stop() {
        !isCapturing ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot stop capturing a keyboard drag when not capturing') : invariant() : void 0;
        isCapturing = false;
        unbindEventsRef.current();
        listenForCapture();
      }
      unbindEventsRef.current = bindEvents(window, getDraggingBindings(actions, stop), {
        capture: true,
        passive: false
      });
    }
  }), [api]);
  const listenForCapture = useCallback(function tryStartCapture() {
    const options = {
      passive: false,
      capture: true
    };
    unbindEventsRef.current = bindEvents(window, [startCaptureBinding], options);
  }, [startCaptureBinding]);
  useIsomorphicLayoutEffect(function mount() {
    listenForCapture();
    return function unmount() {
      unbindEventsRef.current();
    };
  }, [listenForCapture]);
}

const idle = {
  type: 'IDLE'
};
const timeForLongPress = 120;
const forcePressThreshold = 0.15;
function getWindowBindings({
  cancel,
  getPhase
}) {
  return [{
    eventName: 'orientationchange',
    fn: cancel
  }, {
    eventName: 'resize',
    fn: cancel
  }, {
    eventName: 'contextmenu',
    fn: event => {
      event.preventDefault();
    }
  }, {
    eventName: 'keydown',
    fn: event => {
      if (getPhase().type !== 'DRAGGING') {
        cancel();
        return;
      }
      if (event.keyCode === escape) {
        event.preventDefault();
      }
      cancel();
    }
  }, {
    eventName: supportedEventName,
    fn: cancel
  }];
}
function getHandleBindings({
  cancel,
  completed,
  getPhase
}) {
  return [{
    eventName: 'touchmove',
    options: {
      capture: false
    },
    fn: event => {
      const phase = getPhase();
      if (phase.type !== 'DRAGGING') {
        cancel();
        return;
      }
      phase.hasMoved = true;
      const {
        clientX,
        clientY
      } = event.touches[0];
      const point = {
        x: clientX,
        y: clientY
      };
      event.preventDefault();
      phase.actions.move(point);
    }
  }, {
    eventName: 'touchend',
    fn: event => {
      const phase = getPhase();
      if (phase.type !== 'DRAGGING') {
        cancel();
        return;
      }
      event.preventDefault();
      phase.actions.drop({
        shouldBlockNextClick: true
      });
      completed();
    }
  }, {
    eventName: 'touchcancel',
    fn: event => {
      if (getPhase().type !== 'DRAGGING') {
        cancel();
        return;
      }
      event.preventDefault();
      cancel();
    }
  }, {
    eventName: 'touchforcechange',
    fn: event => {
      const phase = getPhase();
      !(phase.type !== 'IDLE') ? process.env.NODE_ENV !== "production" ? invariant() : invariant() : void 0;
      const touch = event.touches[0];
      if (!touch) {
        return;
      }
      const isForcePress = touch.force >= forcePressThreshold;
      if (!isForcePress) {
        return;
      }
      const shouldRespect = phase.actions.shouldRespectForcePress();
      if (phase.type === 'PENDING') {
        if (shouldRespect) {
          cancel();
        }
        return;
      }
      if (shouldRespect) {
        if (phase.hasMoved) {
          event.preventDefault();
          return;
        }
        cancel();
        return;
      }
      event.preventDefault();
    }
  }, {
    eventName: supportedEventName,
    fn: cancel
  }];
}
function useTouchSensor(api) {
  const phaseRef = React.useRef(idle);
  const unbindEventsRef = React.useRef(noop$2);
  const getPhase = useCallback(function getPhase() {
    return phaseRef.current;
  }, []);
  const setPhase = useCallback(function setPhase(phase) {
    phaseRef.current = phase;
  }, []);
  const startCaptureBinding = useMemo(() => ({
    eventName: 'touchstart',
    fn: function onTouchStart(event) {
      if (event.defaultPrevented) {
        return;
      }
      const draggableId = api.findClosestDraggableId(event);
      if (!draggableId) {
        return;
      }
      const actions = api.tryGetLock(draggableId, stop, {
        sourceEvent: event
      });
      if (!actions) {
        return;
      }
      const touch = event.touches[0];
      const {
        clientX,
        clientY
      } = touch;
      const point = {
        x: clientX,
        y: clientY
      };
      unbindEventsRef.current();
      startPendingDrag(actions, point);
    }
  }), [api]);
  const listenForCapture = useCallback(function listenForCapture() {
    const options = {
      capture: true,
      passive: false
    };
    unbindEventsRef.current = bindEvents(window, [startCaptureBinding], options);
  }, [startCaptureBinding]);
  const stop = useCallback(() => {
    const current = phaseRef.current;
    if (current.type === 'IDLE') {
      return;
    }
    if (current.type === 'PENDING') {
      clearTimeout(current.longPressTimerId);
    }
    setPhase(idle);
    unbindEventsRef.current();
    listenForCapture();
  }, [listenForCapture, setPhase]);
  const cancel = useCallback(() => {
    const phase = phaseRef.current;
    stop();
    if (phase.type === 'DRAGGING') {
      phase.actions.cancel({
        shouldBlockNextClick: true
      });
    }
    if (phase.type === 'PENDING') {
      phase.actions.abort();
    }
  }, [stop]);
  const bindCapturingEvents = useCallback(function bindCapturingEvents() {
    const options = {
      capture: true,
      passive: false
    };
    const args = {
      cancel,
      completed: stop,
      getPhase
    };
    const unbindTarget = bindEvents(window, getHandleBindings(args), options);
    const unbindWindow = bindEvents(window, getWindowBindings(args), options);
    unbindEventsRef.current = function unbindAll() {
      unbindTarget();
      unbindWindow();
    };
  }, [cancel, getPhase, stop]);
  const startDragging = useCallback(function startDragging() {
    const phase = getPhase();
    !(phase.type === 'PENDING') ? process.env.NODE_ENV !== "production" ? invariant(false, `Cannot start dragging from phase ${phase.type}`) : invariant() : void 0;
    const actions = phase.actions.fluidLift(phase.point);
    setPhase({
      type: 'DRAGGING',
      actions,
      hasMoved: false
    });
  }, [getPhase, setPhase]);
  const startPendingDrag = useCallback(function startPendingDrag(actions, point) {
    !(getPhase().type === 'IDLE') ? process.env.NODE_ENV !== "production" ? invariant(false, 'Expected to move from IDLE to PENDING drag') : invariant() : void 0;
    const longPressTimerId = setTimeout(startDragging, timeForLongPress);
    setPhase({
      type: 'PENDING',
      point,
      actions,
      longPressTimerId
    });
    bindCapturingEvents();
  }, [bindCapturingEvents, getPhase, setPhase, startDragging]);
  useIsomorphicLayoutEffect(function mount() {
    listenForCapture();
    return function unmount() {
      unbindEventsRef.current();
      const phase = getPhase();
      if (phase.type === 'PENDING') {
        clearTimeout(phase.longPressTimerId);
        setPhase(idle);
      }
    };
  }, [getPhase, listenForCapture, setPhase]);
  useIsomorphicLayoutEffect(function webkitHack() {
    const unbind = bindEvents(window, [{
      eventName: 'touchmove',
      fn: () => {},
      options: {
        capture: false,
        passive: false
      }
    }]);
    return unbind;
  }, []);
}

function useValidateSensorHooks(sensorHooks) {
  useDev(() => {
    const previousRef = usePrevious(sensorHooks);
    useDevSetupWarning(() => {
      !(previousRef.current.length === sensorHooks.length) ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot change the amount of sensor hooks after mounting') : invariant(false) : void 0;
    });
  });
}

const interactiveTagNames = ['input', 'button', 'textarea', 'select', 'option', 'optgroup', 'video', 'audio'];
function isAnInteractiveElement(parent, current) {
  if (current == null) {
    return false;
  }
  const hasAnInteractiveTag = interactiveTagNames.includes(current.tagName.toLowerCase());
  if (hasAnInteractiveTag) {
    return true;
  }
  const attribute = current.getAttribute('contenteditable');
  if (attribute === 'true' || attribute === '') {
    return true;
  }
  if (current === parent) {
    return false;
  }
  return isAnInteractiveElement(parent, current.parentElement);
}
function isEventInInteractiveElement(draggable, event) {
  const target = event.target;
  if (!isHtmlElement(target)) {
    return false;
  }
  return isAnInteractiveElement(draggable, target);
}

var getBorderBoxCenterPosition = el => cssBoxModel.getRect(el.getBoundingClientRect()).center;

function isElement(el) {
  return el instanceof getWindowFromEl(el).Element;
}

const supportedMatchesName = (() => {
  const base = 'matches';
  if (typeof document === 'undefined') {
    return base;
  }
  const candidates = [base, 'msMatchesSelector', 'webkitMatchesSelector'];
  const value = candidates.find(name => name in Element.prototype);
  return value || base;
})();
function closestPonyfill(el, selector) {
  if (el == null) {
    return null;
  }
  if (el[supportedMatchesName](selector)) {
    return el;
  }
  return closestPonyfill(el.parentElement, selector);
}
function closest(el, selector) {
  if (el.closest) {
    return el.closest(selector);
  }
  return closestPonyfill(el, selector);
}

function getSelector(contextId) {
  return `[${dragHandle.contextId}="${contextId}"]`;
}
function findClosestDragHandleFromEvent(contextId, event) {
  const target = event.target;
  if (!isElement(target)) {
    process.env.NODE_ENV !== "production" ? warning('event.target must be a Element') : void 0;
    return null;
  }
  const selector = getSelector(contextId);
  const handle = closest(target, selector);
  if (!handle) {
    return null;
  }
  if (!isHtmlElement(handle)) {
    process.env.NODE_ENV !== "production" ? warning('drag handle must be a HTMLElement') : void 0;
    return null;
  }
  return handle;
}
function tryGetClosestDraggableIdFromEvent(contextId, event) {
  const handle = findClosestDragHandleFromEvent(contextId, event);
  if (!handle) {
    return null;
  }
  return handle.getAttribute(dragHandle.draggableId);
}

function findDraggable(contextId, draggableId) {
  const selector = `[${draggable.contextId}="${contextId}"]`;
  const possible = querySelectorAll(document, selector);
  const draggable$1 = possible.find(el => {
    return el.getAttribute(draggable.id) === draggableId;
  });
  if (!draggable$1) {
    return null;
  }
  if (!isHtmlElement(draggable$1)) {
    process.env.NODE_ENV !== "production" ? warning('Draggable element is not a HTMLElement') : void 0;
    return null;
  }
  return draggable$1;
}

function preventDefault(event) {
  event.preventDefault();
}
function isActive({
  expected,
  phase,
  isLockActive,
  shouldWarn
}) {
  if (!isLockActive()) {
    if (shouldWarn) {
      process.env.NODE_ENV !== "production" ? warning(`
        Cannot perform action.
        The sensor no longer has an action lock.

        Tips:

        - Throw away your action handlers when forceStop() is called
        - Check actions.isActive() if you really need to
      `) : void 0;
    }
    return false;
  }
  if (expected !== phase) {
    if (shouldWarn) {
      process.env.NODE_ENV !== "production" ? warning(`
        Cannot perform action.
        The actions you used belong to an outdated phase

        Current phase: ${expected}
        You called an action from outdated phase: ${phase}

        Tips:

        - Do not use preDragActions actions after calling preDragActions.lift()
      `) : void 0;
    }
    return false;
  }
  return true;
}
function canStart({
  lockAPI,
  store,
  registry,
  draggableId
}) {
  if (lockAPI.isClaimed()) {
    return false;
  }
  const entry = registry.draggable.findById(draggableId);
  if (!entry) {
    process.env.NODE_ENV !== "production" ? warning(`Unable to find draggable with id: ${draggableId}`) : void 0;
    return false;
  }
  if (!entry.options.isEnabled) {
    return false;
  }
  if (!canStartDrag(store.getState(), draggableId)) {
    return false;
  }
  return true;
}
function tryStart({
  lockAPI,
  contextId,
  store,
  registry,
  draggableId,
  forceSensorStop,
  sourceEvent
}) {
  const shouldStart = canStart({
    lockAPI,
    store,
    registry,
    draggableId
  });
  if (!shouldStart) {
    return null;
  }
  const entry = registry.draggable.getById(draggableId);
  const el = findDraggable(contextId, entry.descriptor.id);
  if (!el) {
    process.env.NODE_ENV !== "production" ? warning(`Unable to find draggable element with id: ${draggableId}`) : void 0;
    return null;
  }
  if (sourceEvent && !entry.options.canDragInteractiveElements && isEventInInteractiveElement(el, sourceEvent)) {
    return null;
  }
  const lock = lockAPI.claim(forceSensorStop || noop$2);
  let phase = 'PRE_DRAG';
  function getShouldRespectForcePress() {
    return entry.options.shouldRespectForcePress;
  }
  function isLockActive() {
    return lockAPI.isActive(lock);
  }
  function tryDispatch(expected, getAction) {
    if (isActive({
      expected,
      phase,
      isLockActive,
      shouldWarn: true
    })) {
      store.dispatch(getAction());
    }
  }
  const tryDispatchWhenDragging = tryDispatch.bind(null, 'DRAGGING');
  function lift(args) {
    function completed() {
      lockAPI.release();
      phase = 'COMPLETED';
    }
    if (phase !== 'PRE_DRAG') {
      completed();
      process.env.NODE_ENV !== "production" ? invariant(false, `Cannot lift in phase ${phase}`) : invariant() ;
    }
    store.dispatch(lift$1(args.liftActionArgs));
    phase = 'DRAGGING';
    function finish(reason, options = {
      shouldBlockNextClick: false
    }) {
      args.cleanup();
      if (options.shouldBlockNextClick) {
        const unbind = bindEvents(window, [{
          eventName: 'click',
          fn: preventDefault,
          options: {
            once: true,
            passive: false,
            capture: true
          }
        }]);
        setTimeout(unbind);
      }
      completed();
      store.dispatch(drop({
        reason
      }));
    }
    return {
      isActive: () => isActive({
        expected: 'DRAGGING',
        phase,
        isLockActive,
        shouldWarn: false
      }),
      shouldRespectForcePress: getShouldRespectForcePress,
      drop: options => finish('DROP', options),
      cancel: options => finish('CANCEL', options),
      ...args.actions
    };
  }
  function fluidLift(clientSelection) {
    const move$1 = rafSchd(client => {
      tryDispatchWhenDragging(() => move({
        client
      }));
    });
    const api = lift({
      liftActionArgs: {
        id: draggableId,
        clientSelection,
        movementMode: 'FLUID'
      },
      cleanup: () => move$1.cancel(),
      actions: {
        move: move$1
      }
    });
    return {
      ...api,
      move: move$1
    };
  }
  function snapLift() {
    const actions = {
      moveUp: () => tryDispatchWhenDragging(moveUp),
      moveRight: () => tryDispatchWhenDragging(moveRight),
      moveDown: () => tryDispatchWhenDragging(moveDown),
      moveLeft: () => tryDispatchWhenDragging(moveLeft)
    };
    return lift({
      liftActionArgs: {
        id: draggableId,
        clientSelection: getBorderBoxCenterPosition(el),
        movementMode: 'SNAP'
      },
      cleanup: noop$2,
      actions
    });
  }
  function abortPreDrag() {
    const shouldRelease = isActive({
      expected: 'PRE_DRAG',
      phase,
      isLockActive,
      shouldWarn: true
    });
    if (shouldRelease) {
      lockAPI.release();
    }
  }
  const preDrag = {
    isActive: () => isActive({
      expected: 'PRE_DRAG',
      phase,
      isLockActive,
      shouldWarn: false
    }),
    shouldRespectForcePress: getShouldRespectForcePress,
    fluidLift,
    snapLift,
    abort: abortPreDrag
  };
  return preDrag;
}
const defaultSensors = [useMouseSensor, useKeyboardSensor, useTouchSensor];
function useSensorMarshal({
  contextId,
  store,
  registry,
  customSensors,
  enableDefaultSensors
}) {
  const useSensors = [...(enableDefaultSensors ? defaultSensors : []), ...(customSensors || [])];
  const lockAPI = React.useState(() => create())[0];
  const tryAbandonLock = useCallback(function tryAbandonLock(previous, current) {
    if (isDragging(previous) && !isDragging(current)) {
      lockAPI.tryAbandon();
    }
  }, [lockAPI]);
  useIsomorphicLayoutEffect(function listenToStore() {
    let previous = store.getState();
    const unsubscribe = store.subscribe(() => {
      const current = store.getState();
      tryAbandonLock(previous, current);
      previous = current;
    });
    return unsubscribe;
  }, [lockAPI, store, tryAbandonLock]);
  useIsomorphicLayoutEffect(() => {
    return lockAPI.tryAbandon;
  }, [lockAPI.tryAbandon]);
  const canGetLock = useCallback(draggableId => {
    return canStart({
      lockAPI,
      registry,
      store,
      draggableId
    });
  }, [lockAPI, registry, store]);
  const tryGetLock = useCallback((draggableId, forceStop, options) => tryStart({
    lockAPI,
    registry,
    contextId,
    store,
    draggableId,
    forceSensorStop: forceStop || null,
    sourceEvent: options && options.sourceEvent ? options.sourceEvent : null
  }), [contextId, lockAPI, registry, store]);
  const findClosestDraggableId = useCallback(event => tryGetClosestDraggableIdFromEvent(contextId, event), [contextId]);
  const findOptionsForDraggable = useCallback(id => {
    const entry = registry.draggable.findById(id);
    return entry ? entry.options : null;
  }, [registry.draggable]);
  const tryReleaseLock = useCallback(function tryReleaseLock() {
    if (!lockAPI.isClaimed()) {
      return;
    }
    lockAPI.tryAbandon();
    if (store.getState().phase !== 'IDLE') {
      store.dispatch(flush());
    }
  }, [lockAPI, store]);
  const isLockClaimed = useCallback(() => lockAPI.isClaimed(), [lockAPI]);
  const api = useMemo(() => ({
    canGetLock,
    tryGetLock,
    findClosestDraggableId,
    findOptionsForDraggable,
    tryReleaseLock,
    isLockClaimed
  }), [canGetLock, tryGetLock, findClosestDraggableId, findOptionsForDraggable, tryReleaseLock, isLockClaimed]);
  useValidateSensorHooks(useSensors);
  for (let i = 0; i < useSensors.length; i++) {
    useSensors[i](api);
  }
}

const createResponders = props => ({
  onBeforeCapture: t => {
    const onBeforeCapureCallback = () => {
      if (props.onBeforeCapture) {
        props.onBeforeCapture(t);
      }
    };
    ReactDOM.flushSync(onBeforeCapureCallback);
  },
  onBeforeDragStart: props.onBeforeDragStart,
  onDragStart: props.onDragStart,
  onDragEnd: props.onDragEnd,
  onDragUpdate: props.onDragUpdate
});
const createAutoScrollerOptions = props => ({
  ...defaultAutoScrollerOptions,
  ...props.autoScrollerOptions,
  durationDampening: {
    ...defaultAutoScrollerOptions.durationDampening,
    ...props.autoScrollerOptions
  }
});
function getStore(lazyRef) {
  !lazyRef.current ? process.env.NODE_ENV !== "production" ? invariant(false, 'Could not find store from lazy ref') : invariant() : void 0;
  return lazyRef.current;
}
function App(props) {
  const {
    contextId,
    setCallbacks,
    sensors,
    nonce,
    dragHandleUsageInstructions
  } = props;
  const lazyStoreRef = React.useRef(null);
  useStartupValidation();
  const lastPropsRef = usePrevious(props);
  const getResponders = useCallback(() => {
    return createResponders(lastPropsRef.current);
  }, [lastPropsRef]);
  const getAutoScrollerOptions = useCallback(() => {
    return createAutoScrollerOptions(lastPropsRef.current);
  }, [lastPropsRef]);
  const announce = useAnnouncer(contextId);
  const dragHandleUsageInstructionsId = useHiddenTextElement({
    contextId,
    text: dragHandleUsageInstructions
  });
  const styleMarshal = useStyleMarshal(contextId, nonce);
  const lazyDispatch = useCallback(action => {
    getStore(lazyStoreRef).dispatch(action);
  }, []);
  const marshalCallbacks = useMemo(() => redux.bindActionCreators({
    publishWhileDragging,
    updateDroppableScroll,
    updateDroppableIsEnabled,
    updateDroppableIsCombineEnabled,
    collectionStarting
  }, lazyDispatch), [lazyDispatch]);
  const registry = useRegistry();
  const dimensionMarshal = useMemo(() => {
    return createDimensionMarshal(registry, marshalCallbacks);
  }, [registry, marshalCallbacks]);
  const autoScroller = useMemo(() => createAutoScroller({
    scrollWindow,
    scrollDroppable: dimensionMarshal.scrollDroppable,
    getAutoScrollerOptions,
    ...redux.bindActionCreators({
      move
    }, lazyDispatch)
  }), [dimensionMarshal.scrollDroppable, lazyDispatch, getAutoScrollerOptions]);
  const focusMarshal = useFocusMarshal(contextId);
  const store = useMemo(() => createStore({
    announce,
    autoScroller,
    dimensionMarshal,
    focusMarshal,
    getResponders,
    styleMarshal
  }), [announce, autoScroller, dimensionMarshal, focusMarshal, getResponders, styleMarshal]);
  if (process.env.NODE_ENV !== 'production') {
    if (lazyStoreRef.current && lazyStoreRef.current !== store) {
      process.env.NODE_ENV !== "production" ? warning('unexpected store change') : void 0;
    }
  }
  lazyStoreRef.current = store;
  const tryResetStore = useCallback(() => {
    const current = getStore(lazyStoreRef);
    const state = current.getState();
    if (state.phase !== 'IDLE') {
      current.dispatch(flush());
    }
  }, []);
  const isDragging = useCallback(() => {
    const state = getStore(lazyStoreRef).getState();
    if (state.phase === 'DROP_ANIMATING') {
      return true;
    }
    if (state.phase === 'IDLE') {
      return false;
    }
    return state.isDragging;
  }, []);
  const appCallbacks = useMemo(() => ({
    isDragging,
    tryAbort: tryResetStore
  }), [isDragging, tryResetStore]);
  setCallbacks(appCallbacks);
  const getCanLift = useCallback(id => canStartDrag(getStore(lazyStoreRef).getState(), id), []);
  const getIsMovementAllowed = useCallback(() => isMovementAllowed(getStore(lazyStoreRef).getState()), []);
  const appContext = useMemo(() => ({
    marshal: dimensionMarshal,
    focus: focusMarshal,
    contextId,
    canLift: getCanLift,
    isMovementAllowed: getIsMovementAllowed,
    dragHandleUsageInstructionsId,
    registry
  }), [contextId, dimensionMarshal, dragHandleUsageInstructionsId, focusMarshal, getCanLift, getIsMovementAllowed, registry]);
  useSensorMarshal({
    contextId,
    store,
    registry,
    customSensors: sensors || null,
    enableDefaultSensors: props.enableDefaultSensors !== false
  });
  React.useEffect(() => {
    return tryResetStore;
  }, [tryResetStore]);
  return React.createElement(AppContext.Provider, {
    value: appContext
  }, React.createElement(reactRedux.Provider, {
    context: StoreContext,
    store: store
  }, props.children));
}

function useUniqueContextId() {
  return React.useId();
}

function DragDropContext(props) {
  const contextId = useUniqueContextId();
  const dragHandleUsageInstructions = props.dragHandleUsageInstructions || preset.dragHandleUsageInstructions;
  return React.createElement(ErrorBoundary, null, setCallbacks => React.createElement(App, {
    nonce: props.nonce,
    contextId: contextId,
    setCallbacks: setCallbacks,
    dragHandleUsageInstructions: dragHandleUsageInstructions,
    enableDefaultSensors: props.enableDefaultSensors,
    sensors: props.sensors,
    onBeforeCapture: props.onBeforeCapture,
    onBeforeDragStart: props.onBeforeDragStart,
    onDragStart: props.onDragStart,
    onDragUpdate: props.onDragUpdate,
    onDragEnd: props.onDragEnd,
    autoScrollerOptions: props.autoScrollerOptions
  }, props.children));
}

const zIndexOptions = {
  dragging: 5000,
  dropAnimating: 4500
};
const getDraggingTransition = (shouldAnimateDragMovement, dropping) => {
  if (dropping) {
    return transitions.drop(dropping.duration);
  }
  if (shouldAnimateDragMovement) {
    return transitions.snap;
  }
  return transitions.fluid;
};
const getDraggingOpacity = (isCombining, isDropAnimating) => {
  if (!isCombining) {
    return undefined;
  }
  return isDropAnimating ? combine.opacity.drop : combine.opacity.combining;
};
const getShouldDraggingAnimate = dragging => {
  if (dragging.forceShouldAnimate != null) {
    return dragging.forceShouldAnimate;
  }
  return dragging.mode === 'SNAP';
};
function getDraggingStyle(dragging) {
  const dimension = dragging.dimension;
  const box = dimension.client;
  const {
    offset,
    combineWith,
    dropping
  } = dragging;
  const isCombining = Boolean(combineWith);
  const shouldAnimate = getShouldDraggingAnimate(dragging);
  const isDropAnimating = Boolean(dropping);
  const transform = isDropAnimating ? transforms.drop(offset, isCombining) : transforms.moveTo(offset);
  const style = {
    position: 'fixed',
    top: box.marginBox.top,
    left: box.marginBox.left,
    boxSizing: 'border-box',
    width: box.borderBox.width,
    height: box.borderBox.height,
    transition: getDraggingTransition(shouldAnimate, dropping),
    transform,
    opacity: getDraggingOpacity(isCombining, isDropAnimating),
    zIndex: isDropAnimating ? zIndexOptions.dropAnimating : zIndexOptions.dragging,
    pointerEvents: 'none'
  };
  return style;
}
function getSecondaryStyle(secondary) {
  return {
    transform: transforms.moveTo(secondary.offset),
    transition: secondary.shouldAnimateDisplacement ? undefined : 'none'
  };
}
function getStyle$1(mapped) {
  return mapped.type === 'DRAGGING' ? getDraggingStyle(mapped) : getSecondaryStyle(mapped);
}

function getDimension$1(descriptor, el, windowScroll = origin) {
  const computedStyles = window.getComputedStyle(el);
  const borderBox = el.getBoundingClientRect();
  const client = cssBoxModel.calculateBox(borderBox, computedStyles);
  const page = cssBoxModel.withScroll(client, windowScroll);
  const placeholder = {
    client,
    tagName: el.tagName.toLowerCase(),
    display: computedStyles.display
  };
  const displaceBy = {
    x: client.marginBox.width,
    y: client.marginBox.height
  };
  const dimension = {
    descriptor,
    placeholder,
    displaceBy,
    client,
    page
  };
  return dimension;
}

function useDraggablePublisher(args) {
  const uniqueId = useUniqueId('draggable');
  const {
    descriptor,
    registry,
    getDraggableRef,
    canDragInteractiveElements,
    shouldRespectForcePress,
    isEnabled
  } = args;
  const options = useMemo(() => ({
    canDragInteractiveElements,
    shouldRespectForcePress,
    isEnabled
  }), [canDragInteractiveElements, isEnabled, shouldRespectForcePress]);
  const getDimension = useCallback(windowScroll => {
    const el = getDraggableRef();
    !el ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot get dimension when no ref is set') : invariant() : void 0;
    return getDimension$1(descriptor, el, windowScroll);
  }, [descriptor, getDraggableRef]);
  const entry = useMemo(() => ({
    uniqueId,
    descriptor,
    options,
    getDimension
  }), [descriptor, getDimension, options, uniqueId]);
  const publishedRef = React.useRef(entry);
  const isFirstPublishRef = React.useRef(true);
  useIsomorphicLayoutEffect(() => {
    registry.draggable.register(publishedRef.current);
    return () => registry.draggable.unregister(publishedRef.current);
  }, [registry.draggable]);
  useIsomorphicLayoutEffect(() => {
    if (isFirstPublishRef.current) {
      isFirstPublishRef.current = false;
      return;
    }
    const last = publishedRef.current;
    publishedRef.current = entry;
    registry.draggable.update(entry, last);
  }, [entry, registry.draggable]);
}

var DroppableContext = React.createContext(null);

function checkIsValidInnerRef(el) {
  !(el && isHtmlElement(el)) ? process.env.NODE_ENV !== "production" ? invariant(false, `
    provided.innerRef has not been provided with a HTMLElement.

    You can find a guide on using the innerRef callback functions at:
    https://github.com/hello-pangea/dnd/blob/main/docs/guides/using-inner-ref.md
  `) : invariant() : void 0;
}

function useValidation$1(props, contextId, getRef) {
  useDevSetupWarning(() => {
    function prefix(id) {
      return `Draggable[id: ${id}]: `;
    }
    const id = props.draggableId;
    !id ? process.env.NODE_ENV !== "production" ? invariant(false, 'Draggable requires a draggableId') : invariant(false) : void 0;
    !(typeof id === 'string') ? process.env.NODE_ENV !== "production" ? invariant(false, `Draggable requires a [string] draggableId.
      Provided: [type: ${typeof id}] (value: ${id})`) : invariant(false) : void 0;
    !Number.isInteger(props.index) ? process.env.NODE_ENV !== "production" ? invariant(false, `${prefix(id)} requires an integer index prop`) : invariant(false) : void 0;
    if (props.mapped.type === 'DRAGGING') {
      return;
    }
    checkIsValidInnerRef(getRef());
    if (props.isEnabled) {
      !findDragHandle(contextId, id) ? process.env.NODE_ENV !== "production" ? invariant(false, `${prefix(id)} Unable to find drag handle`) : invariant(false) : void 0;
    }
  });
}
function useClonePropValidation(isClone) {
  useDev(() => {
    const initialRef = React.useRef(isClone);
    useDevSetupWarning(() => {
      !(isClone === initialRef.current) ? process.env.NODE_ENV !== "production" ? invariant(false, 'Draggable isClone prop value changed during component life') : invariant(false) : void 0;
    }, [isClone]);
  });
}

function useRequiredContext(Context) {
  const result = React.useContext(Context);
  !result ? process.env.NODE_ENV !== "production" ? invariant(false, 'Could not find required context') : invariant() : void 0;
  return result;
}

function preventHtml5Dnd(event) {
  event.preventDefault();
}
const Draggable = props => {
  const ref = React.useRef(null);
  const setRef = useCallback((el = null) => {
    ref.current = el;
  }, []);
  const getRef = useCallback(() => ref.current, []);
  const {
    contextId,
    dragHandleUsageInstructionsId,
    registry
  } = useRequiredContext(AppContext);
  const {
    type,
    droppableId
  } = useRequiredContext(DroppableContext);
  const descriptor = useMemo(() => ({
    id: props.draggableId,
    index: props.index,
    type,
    droppableId
  }), [props.draggableId, props.index, type, droppableId]);
  const {
    children,
    draggableId,
    isEnabled,
    shouldRespectForcePress,
    canDragInteractiveElements,
    isClone,
    mapped,
    dropAnimationFinished: dropAnimationFinishedAction
  } = props;
  useValidation$1(props, contextId, getRef);
  useClonePropValidation(isClone);
  if (!isClone) {
    const forPublisher = useMemo(() => ({
      descriptor,
      registry,
      getDraggableRef: getRef,
      canDragInteractiveElements,
      shouldRespectForcePress,
      isEnabled
    }), [descriptor, registry, getRef, canDragInteractiveElements, shouldRespectForcePress, isEnabled]);
    useDraggablePublisher(forPublisher);
  }
  const dragHandleProps = useMemo(() => isEnabled ? {
    tabIndex: 0,
    role: 'button',
    'aria-describedby': dragHandleUsageInstructionsId,
    'data-rfd-drag-handle-draggable-id': draggableId,
    'data-rfd-drag-handle-context-id': contextId,
    draggable: false,
    onDragStart: preventHtml5Dnd
  } : null, [contextId, dragHandleUsageInstructionsId, draggableId, isEnabled]);
  const onMoveEnd = useCallback(event => {
    if (mapped.type !== 'DRAGGING') {
      return;
    }
    if (!mapped.dropping) {
      return;
    }
    if (event.propertyName !== 'transform') {
      return;
    }
    ReactDOM.flushSync(dropAnimationFinishedAction);
  }, [dropAnimationFinishedAction, mapped]);
  const provided = useMemo(() => {
    const style = getStyle$1(mapped);
    const onTransitionEnd = mapped.type === 'DRAGGING' && mapped.dropping ? onMoveEnd : undefined;
    const result = {
      innerRef: setRef,
      draggableProps: {
        'data-rfd-draggable-context-id': contextId,
        'data-rfd-draggable-id': draggableId,
        style,
        onTransitionEnd
      },
      dragHandleProps
    };
    return result;
  }, [contextId, dragHandleProps, draggableId, mapped, onMoveEnd, setRef]);
  const rubric = useMemo(() => ({
    draggableId: descriptor.id,
    type: descriptor.type,
    source: {
      index: descriptor.index,
      droppableId: descriptor.droppableId
    }
  }), [descriptor.droppableId, descriptor.id, descriptor.index, descriptor.type]);
  return React.createElement(React.Fragment, null, children(provided, mapped.snapshot, rubric));
};

var isStrictEqual = (a, b) => a === b;

var whatIsDraggedOverFromResult = result => {
  const {
    combine,
    destination
  } = result;
  if (destination) {
    return destination.droppableId;
  }
  if (combine) {
    return combine.droppableId;
  }
  return null;
};

const getCombineWithFromResult = result => {
  return result.combine ? result.combine.draggableId : null;
};
const getCombineWithFromImpact = impact => {
  return impact.at && impact.at.type === 'COMBINE' ? impact.at.combine.draggableId : null;
};
function getDraggableSelector() {
  const memoizedOffset = memoizeOne((x, y) => ({
    x,
    y
  }));
  const getMemoizedSnapshot = memoizeOne((mode, isClone, draggingOver = null, combineWith = null, dropping = null) => ({
    isDragging: true,
    isClone,
    isDropAnimating: Boolean(dropping),
    dropAnimation: dropping,
    mode,
    draggingOver,
    combineWith,
    combineTargetFor: null
  }));
  const getMemoizedProps = memoizeOne((offset, mode, dimension, isClone, draggingOver = null, combineWith = null, forceShouldAnimate = null) => ({
    mapped: {
      type: 'DRAGGING',
      dropping: null,
      draggingOver,
      combineWith,
      mode,
      offset,
      dimension,
      forceShouldAnimate,
      snapshot: getMemoizedSnapshot(mode, isClone, draggingOver, combineWith, null)
    }
  }));
  const selector = (state, ownProps) => {
    if (isDragging(state)) {
      if (state.critical.draggable.id !== ownProps.draggableId) {
        return null;
      }
      const offset = state.current.client.offset;
      const dimension = state.dimensions.draggables[ownProps.draggableId];
      const draggingOver = whatIsDraggedOver(state.impact);
      const combineWith = getCombineWithFromImpact(state.impact);
      const forceShouldAnimate = state.forceShouldAnimate;
      return getMemoizedProps(memoizedOffset(offset.x, offset.y), state.movementMode, dimension, ownProps.isClone, draggingOver, combineWith, forceShouldAnimate);
    }
    if (state.phase === 'DROP_ANIMATING') {
      const completed = state.completed;
      if (completed.result.draggableId !== ownProps.draggableId) {
        return null;
      }
      const isClone = ownProps.isClone;
      const dimension = state.dimensions.draggables[ownProps.draggableId];
      const result = completed.result;
      const mode = result.mode;
      const draggingOver = whatIsDraggedOverFromResult(result);
      const combineWith = getCombineWithFromResult(result);
      const duration = state.dropDuration;
      const dropping = {
        duration,
        curve: curves.drop,
        moveTo: state.newHomeClientOffset,
        opacity: combineWith ? combine.opacity.drop : null,
        scale: combineWith ? combine.scale.drop : null
      };
      return {
        mapped: {
          type: 'DRAGGING',
          offset: state.newHomeClientOffset,
          dimension,
          dropping,
          draggingOver,
          combineWith,
          mode,
          forceShouldAnimate: null,
          snapshot: getMemoizedSnapshot(mode, isClone, draggingOver, combineWith, dropping)
        }
      };
    }
    return null;
  };
  return selector;
}
function getSecondarySnapshot(combineTargetFor = null) {
  return {
    isDragging: false,
    isDropAnimating: false,
    isClone: false,
    dropAnimation: null,
    mode: null,
    draggingOver: null,
    combineTargetFor,
    combineWith: null
  };
}
const atRest = {
  mapped: {
    type: 'SECONDARY',
    offset: origin,
    combineTargetFor: null,
    shouldAnimateDisplacement: true,
    snapshot: getSecondarySnapshot(null)
  }
};
function getSecondarySelector() {
  const memoizedOffset = memoizeOne((x, y) => ({
    x,
    y
  }));
  const getMemoizedSnapshot = memoizeOne(getSecondarySnapshot);
  const getMemoizedProps = memoizeOne((offset, combineTargetFor = null, shouldAnimateDisplacement) => ({
    mapped: {
      type: 'SECONDARY',
      offset,
      combineTargetFor,
      shouldAnimateDisplacement,
      snapshot: getMemoizedSnapshot(combineTargetFor)
    }
  }));
  const getFallback = combineTargetFor => {
    return combineTargetFor ? getMemoizedProps(origin, combineTargetFor, true) : null;
  };
  const getProps = (ownId, draggingId, impact, afterCritical) => {
    const visualDisplacement = impact.displaced.visible[ownId];
    const isAfterCriticalInVirtualList = Boolean(afterCritical.inVirtualList && afterCritical.effected[ownId]);
    const combine = tryGetCombine(impact);
    const combineTargetFor = combine && combine.draggableId === ownId ? draggingId : null;
    if (!visualDisplacement) {
      if (!isAfterCriticalInVirtualList) {
        return getFallback(combineTargetFor);
      }
      if (impact.displaced.invisible[ownId]) {
        return null;
      }
      const change = negate(afterCritical.displacedBy.point);
      const offset = memoizedOffset(change.x, change.y);
      return getMemoizedProps(offset, combineTargetFor, true);
    }
    if (isAfterCriticalInVirtualList) {
      return getFallback(combineTargetFor);
    }
    const displaceBy = impact.displacedBy.point;
    const offset = memoizedOffset(displaceBy.x, displaceBy.y);
    return getMemoizedProps(offset, combineTargetFor, visualDisplacement.shouldAnimate);
  };
  const selector = (state, ownProps) => {
    if (isDragging(state)) {
      if (state.critical.draggable.id === ownProps.draggableId) {
        return null;
      }
      return getProps(ownProps.draggableId, state.critical.draggable.id, state.impact, state.afterCritical);
    }
    if (state.phase === 'DROP_ANIMATING') {
      const completed = state.completed;
      if (completed.result.draggableId === ownProps.draggableId) {
        return null;
      }
      return getProps(ownProps.draggableId, completed.result.draggableId, completed.impact, completed.afterCritical);
    }
    return null;
  };
  return selector;
}
const makeMapStateToProps$1 = () => {
  const draggingSelector = getDraggableSelector();
  const secondarySelector = getSecondarySelector();
  const selector = (state, ownProps) => draggingSelector(state, ownProps) || secondarySelector(state, ownProps) || atRest;
  return selector;
};
const mapDispatchToProps$1 = {
  dropAnimationFinished: dropAnimationFinished
};
const ConnectedDraggable = reactRedux.connect(makeMapStateToProps$1, mapDispatchToProps$1, null, {
  context: StoreContext,
  areStatePropsEqual: isStrictEqual
})(Draggable);

function PrivateDraggable(props) {
  const droppableContext = useRequiredContext(DroppableContext);
  const isUsingCloneFor = droppableContext.isUsingCloneFor;
  if (isUsingCloneFor === props.draggableId && !props.isClone) {
    return null;
  }
  return React.createElement(ConnectedDraggable, props);
}
function PublicDraggable(props) {
  const isEnabled = typeof props.isDragDisabled === 'boolean' ? !props.isDragDisabled : true;
  const canDragInteractiveElements = Boolean(props.disableInteractiveElementBlocking);
  const shouldRespectForcePress = Boolean(props.shouldRespectForcePress);
  return React.createElement(PrivateDraggable, _extends({}, props, {
    isClone: false,
    isEnabled: isEnabled,
    canDragInteractiveElements: canDragInteractiveElements,
    shouldRespectForcePress: shouldRespectForcePress
  }));
}

const isEqual = base => value => base === value;
const isScroll = isEqual('scroll');
const isAuto = isEqual('auto');
const isVisible = isEqual('visible');
const isEither = (overflow, fn) => fn(overflow.overflowX) || fn(overflow.overflowY);
const isBoth = (overflow, fn) => fn(overflow.overflowX) && fn(overflow.overflowY);
const isElementScrollable = el => {
  const style = window.getComputedStyle(el);
  const overflow = {
    overflowX: style.overflowX,
    overflowY: style.overflowY
  };
  return isEither(overflow, isScroll) || isEither(overflow, isAuto);
};
const isBodyScrollable = () => {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  const body = getBodyElement();
  const html = document.documentElement;
  !html ? process.env.NODE_ENV !== "production" ? invariant() : invariant() : void 0;
  if (!isElementScrollable(body)) {
    return false;
  }
  const htmlStyle = window.getComputedStyle(html);
  const htmlOverflow = {
    overflowX: htmlStyle.overflowX,
    overflowY: htmlStyle.overflowY
  };
  if (isBoth(htmlOverflow, isVisible)) {
    return false;
  }
  process.env.NODE_ENV !== "production" ? warning(`
    We have detected that your <body> element might be a scroll container.
    We have found no reliable way of detecting whether the <body> element is a scroll container.
    Under most circumstances a <body> scroll bar will be on the <html> element (document.documentElement)

    Because we cannot determine if the <body> is a scroll container, and generally it is not one,
    we will be treating the <body> as *not* a scroll container

    More information: https://github.com/hello-pangea/dnd/blob/main/docs/guides/how-we-detect-scroll-containers.md
  `) : void 0;
  return false;
};
const getClosestScrollable = el => {
  if (el == null) {
    return null;
  }
  if (el === document.body) {
    return isBodyScrollable() ? el : null;
  }
  if (el === document.documentElement) {
    return null;
  }
  if (!isElementScrollable(el)) {
    return getClosestScrollable(el.parentElement);
  }
  return el;
};

var checkForNestedScrollContainers = scrollable => {
  if (!scrollable) {
    return;
  }
  const anotherScrollParent = getClosestScrollable(scrollable.parentElement);
  if (!anotherScrollParent) {
    return;
  }
  process.env.NODE_ENV !== "production" ? warning(`
    Droppable: unsupported nested scroll container detected.
    A Droppable can only have one scroll parent (which can be itself)
    Nested scroll containers are currently not supported.

    We hope to support nested scroll containers soon: https://github.com/atlassian/react-beautiful-dnd/issues/131
  `) : void 0;
};

var getScroll = el => ({
  x: el.scrollLeft,
  y: el.scrollTop
});

const getIsFixed = el => {
  if (!el) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.position === 'fixed') {
    return true;
  }
  return getIsFixed(el.parentElement);
};
var getEnv = start => {
  const closestScrollable = getClosestScrollable(start);
  const isFixedOnPage = getIsFixed(start);
  return {
    closestScrollable,
    isFixedOnPage
  };
};

var getDroppableDimension = ({
  descriptor,
  isEnabled,
  isCombineEnabled,
  isFixedOnPage,
  direction,
  client,
  page,
  closest
}) => {
  const frame = (() => {
    if (!closest) {
      return null;
    }
    const {
      scrollSize,
      client: frameClient
    } = closest;
    const maxScroll = getMaxScroll({
      scrollHeight: scrollSize.scrollHeight,
      scrollWidth: scrollSize.scrollWidth,
      height: frameClient.paddingBox.height,
      width: frameClient.paddingBox.width
    });
    return {
      pageMarginBox: closest.page.marginBox,
      frameClient,
      scrollSize,
      shouldClipSubject: closest.shouldClipSubject,
      scroll: {
        initial: closest.scroll,
        current: closest.scroll,
        max: maxScroll,
        diff: {
          value: origin,
          displacement: origin
        }
      }
    };
  })();
  const axis = direction === 'vertical' ? vertical : horizontal;
  const subject = getSubject({
    page,
    withPlaceholder: null,
    axis,
    frame
  });
  const dimension = {
    descriptor,
    isCombineEnabled,
    isFixedOnPage,
    axis,
    isEnabled,
    client,
    page,
    frame,
    subject
  };
  return dimension;
};

const getClient = (targetRef, closestScrollable) => {
  const base = cssBoxModel.getBox(targetRef);
  if (!closestScrollable) {
    return base;
  }
  if (targetRef !== closestScrollable) {
    return base;
  }
  const top = base.paddingBox.top - closestScrollable.scrollTop;
  const left = base.paddingBox.left - closestScrollable.scrollLeft;
  const bottom = top + closestScrollable.scrollHeight;
  const right = left + closestScrollable.scrollWidth;
  const paddingBox = {
    top,
    right,
    bottom,
    left
  };
  const borderBox = cssBoxModel.expand(paddingBox, base.border);
  const client = cssBoxModel.createBox({
    borderBox,
    margin: base.margin,
    border: base.border,
    padding: base.padding
  });
  return client;
};
var getDimension = ({
  ref,
  descriptor,
  env,
  windowScroll,
  direction,
  isDropDisabled,
  isCombineEnabled,
  shouldClipSubject
}) => {
  const closestScrollable = env.closestScrollable;
  const client = getClient(ref, closestScrollable);
  const page = cssBoxModel.withScroll(client, windowScroll);
  const closest = (() => {
    if (!closestScrollable) {
      return null;
    }
    const frameClient = cssBoxModel.getBox(closestScrollable);
    const scrollSize = {
      scrollHeight: closestScrollable.scrollHeight,
      scrollWidth: closestScrollable.scrollWidth
    };
    return {
      client: frameClient,
      page: cssBoxModel.withScroll(frameClient, windowScroll),
      scroll: getScroll(closestScrollable),
      scrollSize,
      shouldClipSubject
    };
  })();
  const dimension = getDroppableDimension({
    descriptor,
    isEnabled: !isDropDisabled,
    isCombineEnabled,
    isFixedOnPage: env.isFixedOnPage,
    direction,
    client,
    page,
    closest
  });
  return dimension;
};

const immediate = {
  passive: false
};
const delayed = {
  passive: true
};
var getListenerOptions = options => options.shouldPublishImmediately ? immediate : delayed;

const getClosestScrollableFromDrag = dragging => dragging && dragging.env.closestScrollable || null;
function useDroppablePublisher(args) {
  const whileDraggingRef = React.useRef(null);
  const appContext = useRequiredContext(AppContext);
  const uniqueId = useUniqueId('droppable');
  const {
    registry,
    marshal
  } = appContext;
  const previousRef = usePrevious(args);
  const descriptor = useMemo(() => ({
    id: args.droppableId,
    type: args.type,
    mode: args.mode
  }), [args.droppableId, args.mode, args.type]);
  const publishedDescriptorRef = React.useRef(descriptor);
  const memoizedUpdateScroll = useMemo(() => memoizeOne((x, y) => {
    !whileDraggingRef.current ? process.env.NODE_ENV !== "production" ? invariant(false, 'Can only update scroll when dragging') : invariant() : void 0;
    const scroll = {
      x,
      y
    };
    marshal.updateDroppableScroll(descriptor.id, scroll);
  }), [descriptor.id, marshal]);
  const getClosestScroll = useCallback(() => {
    const dragging = whileDraggingRef.current;
    if (!dragging || !dragging.env.closestScrollable) {
      return origin;
    }
    return getScroll(dragging.env.closestScrollable);
  }, []);
  const updateScroll = useCallback(() => {
    const scroll = getClosestScroll();
    memoizedUpdateScroll(scroll.x, scroll.y);
  }, [getClosestScroll, memoizedUpdateScroll]);
  const scheduleScrollUpdate = useMemo(() => rafSchd(updateScroll), [updateScroll]);
  const onClosestScroll = useCallback(() => {
    const dragging = whileDraggingRef.current;
    const closest = getClosestScrollableFromDrag(dragging);
    !(dragging && closest) ? process.env.NODE_ENV !== "production" ? invariant(false, 'Could not find scroll options while scrolling') : invariant() : void 0;
    const options = dragging.scrollOptions;
    if (options.shouldPublishImmediately) {
      updateScroll();
      return;
    }
    scheduleScrollUpdate();
  }, [scheduleScrollUpdate, updateScroll]);
  const getDimensionAndWatchScroll = useCallback((windowScroll, options) => {
    !!whileDraggingRef.current ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot collect a droppable while a drag is occurring') : invariant() : void 0;
    const previous = previousRef.current;
    const ref = previous.getDroppableRef();
    !ref ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot collect without a droppable ref') : invariant() : void 0;
    const env = getEnv(ref);
    const dragging = {
      ref,
      descriptor,
      env,
      scrollOptions: options
    };
    whileDraggingRef.current = dragging;
    const dimension = getDimension({
      ref,
      descriptor,
      env,
      windowScroll,
      direction: previous.direction,
      isDropDisabled: previous.isDropDisabled,
      isCombineEnabled: previous.isCombineEnabled,
      shouldClipSubject: !previous.ignoreContainerClipping
    });
    const scrollable = env.closestScrollable;
    if (scrollable) {
      scrollable.setAttribute(scrollContainer.contextId, appContext.contextId);
      scrollable.addEventListener('scroll', onClosestScroll, getListenerOptions(dragging.scrollOptions));
      if (process.env.NODE_ENV !== 'production') {
        checkForNestedScrollContainers(scrollable);
      }
    }
    return dimension;
  }, [appContext.contextId, descriptor, onClosestScroll, previousRef]);
  const getScrollWhileDragging = useCallback(() => {
    const dragging = whileDraggingRef.current;
    const closest = getClosestScrollableFromDrag(dragging);
    !(dragging && closest) ? process.env.NODE_ENV !== "production" ? invariant(false, 'Can only recollect Droppable client for Droppables that have a scroll container') : invariant() : void 0;
    return getScroll(closest);
  }, []);
  const dragStopped = useCallback(() => {
    const dragging = whileDraggingRef.current;
    !dragging ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot stop drag when no active drag') : invariant() : void 0;
    const closest = getClosestScrollableFromDrag(dragging);
    whileDraggingRef.current = null;
    if (!closest) {
      return;
    }
    scheduleScrollUpdate.cancel();
    closest.removeAttribute(scrollContainer.contextId);
    closest.removeEventListener('scroll', onClosestScroll, getListenerOptions(dragging.scrollOptions));
  }, [onClosestScroll, scheduleScrollUpdate]);
  const scroll = useCallback(change => {
    const dragging = whileDraggingRef.current;
    !dragging ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot scroll when there is no drag') : invariant() : void 0;
    const closest = getClosestScrollableFromDrag(dragging);
    !closest ? process.env.NODE_ENV !== "production" ? invariant(false, 'Cannot scroll a droppable with no closest scrollable') : invariant() : void 0;
    closest.scrollTop += change.y;
    closest.scrollLeft += change.x;
  }, []);
  const callbacks = useMemo(() => {
    return {
      getDimensionAndWatchScroll,
      getScrollWhileDragging,
      dragStopped,
      scroll
    };
  }, [dragStopped, getDimensionAndWatchScroll, getScrollWhileDragging, scroll]);
  const entry = useMemo(() => ({
    uniqueId,
    descriptor,
    callbacks
  }), [callbacks, descriptor, uniqueId]);
  useIsomorphicLayoutEffect(() => {
    publishedDescriptorRef.current = entry.descriptor;
    registry.droppable.register(entry);
    return () => {
      if (whileDraggingRef.current) {
        process.env.NODE_ENV !== "production" ? warning('Unsupported: changing the droppableId or type of a Droppable during a drag') : void 0;
        dragStopped();
      }
      registry.droppable.unregister(entry);
    };
  }, [callbacks, descriptor, dragStopped, entry, marshal, registry.droppable]);
  useIsomorphicLayoutEffect(() => {
    if (!whileDraggingRef.current) {
      return;
    }
    marshal.updateDroppableIsEnabled(publishedDescriptorRef.current.id, !args.isDropDisabled);
  }, [args.isDropDisabled, marshal]);
  useIsomorphicLayoutEffect(() => {
    if (!whileDraggingRef.current) {
      return;
    }
    marshal.updateDroppableIsCombineEnabled(publishedDescriptorRef.current.id, args.isCombineEnabled);
  }, [args.isCombineEnabled, marshal]);
}

function noop() {}
const empty = {
  width: 0,
  height: 0,
  margin: noSpacing
};
const getSize = ({
  isAnimatingOpenOnMount,
  placeholder,
  animate
}) => {
  if (isAnimatingOpenOnMount) {
    return empty;
  }
  if (animate === 'close') {
    return empty;
  }
  return {
    height: placeholder.client.borderBox.height,
    width: placeholder.client.borderBox.width,
    margin: placeholder.client.margin
  };
};
const getStyle = ({
  isAnimatingOpenOnMount,
  placeholder,
  animate
}) => {
  const size = getSize({
    isAnimatingOpenOnMount,
    placeholder,
    animate
  });
  return {
    display: placeholder.display,
    boxSizing: 'border-box',
    width: size.width,
    height: size.height,
    marginTop: size.margin.top,
    marginRight: size.margin.right,
    marginBottom: size.margin.bottom,
    marginLeft: size.margin.left,
    flexShrink: '0',
    flexGrow: '0',
    pointerEvents: 'none',
    transition: animate !== 'none' ? transitions.placeholder : null
  };
};
const Placeholder = props => {
  const animateOpenTimerRef = React.useRef(null);
  const tryClearAnimateOpenTimer = useCallback(() => {
    if (!animateOpenTimerRef.current) {
      return;
    }
    clearTimeout(animateOpenTimerRef.current);
    animateOpenTimerRef.current = null;
  }, []);
  const {
    animate,
    onTransitionEnd,
    onClose,
    contextId
  } = props;
  const [isAnimatingOpenOnMount, setIsAnimatingOpenOnMount] = React.useState(props.animate === 'open');
  React.useEffect(() => {
    if (!isAnimatingOpenOnMount) {
      return noop;
    }
    if (animate !== 'open') {
      tryClearAnimateOpenTimer();
      setIsAnimatingOpenOnMount(false);
      return noop;
    }
    if (animateOpenTimerRef.current) {
      return noop;
    }
    animateOpenTimerRef.current = setTimeout(() => {
      animateOpenTimerRef.current = null;
      setIsAnimatingOpenOnMount(false);
    });
    return tryClearAnimateOpenTimer;
  }, [animate, isAnimatingOpenOnMount, tryClearAnimateOpenTimer]);
  const onSizeChangeEnd = useCallback(event => {
    if (event.propertyName !== 'height') {
      return;
    }
    onTransitionEnd();
    if (animate === 'close') {
      onClose();
    }
  }, [animate, onClose, onTransitionEnd]);
  const style = getStyle({
    isAnimatingOpenOnMount,
    animate: props.animate,
    placeholder: props.placeholder
  });
  return React.createElement(props.placeholder.tagName, {
    style,
    'data-rfd-placeholder-context-id': contextId,
    onTransitionEnd: onSizeChangeEnd,
    ref: props.innerRef
  });
};
var Placeholder$1 = React.memo(Placeholder);

function isBoolean(value) {
  return typeof value === 'boolean';
}
function runChecks(args, checks) {
  checks.forEach(check => check(args));
}
const shared = [function required({
  props
}) {
  !props.droppableId ? process.env.NODE_ENV !== "production" ? invariant(false, 'A Droppable requires a droppableId prop') : invariant() : void 0;
  !(typeof props.droppableId === 'string') ? process.env.NODE_ENV !== "production" ? invariant(false, `A Droppable requires a [string] droppableId. Provided: [${typeof props.droppableId}]`) : invariant() : void 0;
}, function boolean({
  props
}) {
  !isBoolean(props.isDropDisabled) ? process.env.NODE_ENV !== "production" ? invariant(false, 'isDropDisabled must be a boolean') : invariant() : void 0;
  !isBoolean(props.isCombineEnabled) ? process.env.NODE_ENV !== "production" ? invariant(false, 'isCombineEnabled must be a boolean') : invariant() : void 0;
  !isBoolean(props.ignoreContainerClipping) ? process.env.NODE_ENV !== "production" ? invariant(false, 'ignoreContainerClipping must be a boolean') : invariant() : void 0;
}, function ref({
  getDroppableRef
}) {
  checkIsValidInnerRef(getDroppableRef());
}];
const standard = [function placeholder({
  props,
  getPlaceholderRef
}) {
  if (!props.placeholder) {
    return;
  }
  const ref = getPlaceholderRef();
  if (ref) {
    return;
  }
  process.env.NODE_ENV !== "production" ? warning(`
      Droppable setup issue [droppableId: "${props.droppableId}"]:
      DroppableProvided > placeholder could not be found.

      Please be sure to add the {provided.placeholder} React Node as a child of your Droppable.
      More information: https://github.com/hello-pangea/dnd/blob/main/docs/api/droppable.md
    `) : void 0;
}];
const virtual = [function hasClone({
  props
}) {
  !props.renderClone ? process.env.NODE_ENV !== "production" ? invariant(false, 'Must provide a clone render function (renderClone) for virtual lists') : invariant() : void 0;
}, function hasNoPlaceholder({
  getPlaceholderRef
}) {
  !!getPlaceholderRef() ? process.env.NODE_ENV !== "production" ? invariant(false, 'Expected virtual list to not have a placeholder') : invariant() : void 0;
}];
function useValidation(args) {
  useDevSetupWarning(() => {
    runChecks(args, shared);
    if (args.props.mode === 'standard') {
      runChecks(args, standard);
    }
    if (args.props.mode === 'virtual') {
      runChecks(args, virtual);
    }
  });
}

class AnimateInOut extends React.PureComponent {
  constructor(...args) {
    super(...args);
    this.state = {
      isVisible: Boolean(this.props.on),
      data: this.props.on,
      animate: this.props.shouldAnimate && this.props.on ? 'open' : 'none'
    };
    this.onClose = () => {
      if (this.state.animate !== 'close') {
        return;
      }
      this.setState({
        isVisible: false
      });
    };
  }
  static getDerivedStateFromProps(props, state) {
    if (!props.shouldAnimate) {
      return {
        isVisible: Boolean(props.on),
        data: props.on,
        animate: 'none'
      };
    }
    if (props.on) {
      return {
        isVisible: true,
        data: props.on,
        animate: 'open'
      };
    }
    if (state.isVisible) {
      return {
        isVisible: true,
        data: state.data,
        animate: 'close'
      };
    }
    return {
      isVisible: false,
      animate: 'close',
      data: null
    };
  }
  render() {
    if (!this.state.isVisible) {
      return null;
    }
    const provided = {
      onClose: this.onClose,
      data: this.state.data,
      animate: this.state.animate
    };
    return this.props.children(provided);
  }
}

const Droppable = props => {
  const appContext = React.useContext(AppContext);
  !appContext ? process.env.NODE_ENV !== "production" ? invariant(false, 'Could not find app context') : invariant() : void 0;
  const {
    contextId,
    isMovementAllowed
  } = appContext;
  const droppableRef = React.useRef(null);
  const placeholderRef = React.useRef(null);
  const {
    children,
    droppableId,
    type,
    mode,
    direction,
    ignoreContainerClipping,
    isDropDisabled,
    isCombineEnabled,
    snapshot,
    useClone,
    updateViewportMaxScroll,
    getContainerForClone
  } = props;
  const getDroppableRef = useCallback(() => droppableRef.current, []);
  const setDroppableRef = useCallback((value = null) => {
    droppableRef.current = value;
  }, []);
  const getPlaceholderRef = useCallback(() => placeholderRef.current, []);
  const setPlaceholderRef = useCallback((value = null) => {
    placeholderRef.current = value;
  }, []);
  useValidation({
    props,
    getDroppableRef,
    getPlaceholderRef
  });
  const onPlaceholderTransitionEnd = useCallback(() => {
    if (isMovementAllowed()) {
      updateViewportMaxScroll({
        maxScroll: getMaxWindowScroll()
      });
    }
  }, [isMovementAllowed, updateViewportMaxScroll]);
  useDroppablePublisher({
    droppableId,
    type,
    mode,
    direction,
    isDropDisabled,
    isCombineEnabled,
    ignoreContainerClipping,
    getDroppableRef
  });
  const placeholder = useMemo(() => React.createElement(AnimateInOut, {
    on: props.placeholder,
    shouldAnimate: props.shouldAnimatePlaceholder
  }, ({
    onClose,
    data,
    animate
  }) => React.createElement(Placeholder$1, {
    placeholder: data,
    onClose: onClose,
    innerRef: setPlaceholderRef,
    animate: animate,
    contextId: contextId,
    onTransitionEnd: onPlaceholderTransitionEnd
  })), [contextId, onPlaceholderTransitionEnd, props.placeholder, props.shouldAnimatePlaceholder, setPlaceholderRef]);
  const provided = useMemo(() => ({
    innerRef: setDroppableRef,
    placeholder,
    droppableProps: {
      'data-rfd-droppable-id': droppableId,
      'data-rfd-droppable-context-id': contextId
    }
  }), [contextId, droppableId, placeholder, setDroppableRef]);
  const isUsingCloneFor = useClone ? useClone.dragging.draggableId : null;
  const droppableContext = useMemo(() => ({
    droppableId,
    type,
    isUsingCloneFor
  }), [droppableId, isUsingCloneFor, type]);
  function getClone() {
    if (!useClone) {
      return null;
    }
    const {
      dragging,
      render
    } = useClone;
    const node = React.createElement(PrivateDraggable, {
      draggableId: dragging.draggableId,
      index: dragging.source.index,
      isClone: true,
      isEnabled: true,
      shouldRespectForcePress: false,
      canDragInteractiveElements: true
    }, (draggableProvided, draggableSnapshot) => render(draggableProvided, draggableSnapshot, dragging));
    return ReactDOM.createPortal(node, getContainerForClone());
  }
  return React.createElement(DroppableContext.Provider, {
    value: droppableContext
  }, children(provided, snapshot), getClone());
};

function getBody() {
  !document.body ? process.env.NODE_ENV !== "production" ? invariant(false, 'document.body is not ready') : invariant() : void 0;
  return document.body;
}
const defaultProps = {
  mode: 'standard',
  type: 'DEFAULT',
  direction: 'vertical',
  isDropDisabled: false,
  isCombineEnabled: false,
  ignoreContainerClipping: false,
  renderClone: null,
  getContainerForClone: getBody
};
const attachDefaultPropsToOwnProps = ownProps => {
  let mergedProps = {
    ...ownProps
  };
  let defaultPropKey;
  for (defaultPropKey in defaultProps) {
    if (ownProps[defaultPropKey] === undefined) {
      mergedProps = {
        ...mergedProps,
        [defaultPropKey]: defaultProps[defaultPropKey]
      };
    }
  }
  return mergedProps;
};
const isMatchingType = (type, critical) => type === critical.droppable.type;
const getDraggable = (critical, dimensions) => dimensions.draggables[critical.draggable.id];
const makeMapStateToProps = () => {
  const idleWithAnimation = {
    placeholder: null,
    shouldAnimatePlaceholder: true,
    snapshot: {
      isDraggingOver: false,
      draggingOverWith: null,
      draggingFromThisWith: null,
      isUsingPlaceholder: false
    },
    useClone: null
  };
  const idleWithoutAnimation = {
    ...idleWithAnimation,
    shouldAnimatePlaceholder: false
  };
  const getDraggableRubric = memoizeOne(descriptor => ({
    draggableId: descriptor.id,
    type: descriptor.type,
    source: {
      index: descriptor.index,
      droppableId: descriptor.droppableId
    }
  }));
  const getMapProps = memoizeOne((id, isEnabled, isDraggingOverForConsumer, isDraggingOverForImpact, dragging, renderClone) => {
    const draggableId = dragging.descriptor.id;
    const isHome = dragging.descriptor.droppableId === id;
    if (isHome) {
      const useClone = renderClone ? {
        render: renderClone,
        dragging: getDraggableRubric(dragging.descriptor)
      } : null;
      const snapshot = {
        isDraggingOver: isDraggingOverForConsumer,
        draggingOverWith: isDraggingOverForConsumer ? draggableId : null,
        draggingFromThisWith: draggableId,
        isUsingPlaceholder: true
      };
      return {
        placeholder: dragging.placeholder,
        shouldAnimatePlaceholder: false,
        snapshot,
        useClone
      };
    }
    if (!isEnabled) {
      return idleWithoutAnimation;
    }
    if (!isDraggingOverForImpact) {
      return idleWithAnimation;
    }
    const snapshot = {
      isDraggingOver: isDraggingOverForConsumer,
      draggingOverWith: draggableId,
      draggingFromThisWith: null,
      isUsingPlaceholder: true
    };
    return {
      placeholder: dragging.placeholder,
      shouldAnimatePlaceholder: true,
      snapshot,
      useClone: null
    };
  });
  const selector = (state, ownProps) => {
    const ownPropsWithDefaultProps = attachDefaultPropsToOwnProps(ownProps);
    const id = ownPropsWithDefaultProps.droppableId;
    const type = ownPropsWithDefaultProps.type;
    const isEnabled = !ownPropsWithDefaultProps.isDropDisabled;
    const renderClone = ownPropsWithDefaultProps.renderClone;
    if (isDragging(state)) {
      const critical = state.critical;
      if (!isMatchingType(type, critical)) {
        return idleWithoutAnimation;
      }
      const dragging = getDraggable(critical, state.dimensions);
      const isDraggingOver = whatIsDraggedOver(state.impact) === id;
      return getMapProps(id, isEnabled, isDraggingOver, isDraggingOver, dragging, renderClone);
    }
    if (state.phase === 'DROP_ANIMATING') {
      const completed = state.completed;
      if (!isMatchingType(type, completed.critical)) {
        return idleWithoutAnimation;
      }
      const dragging = getDraggable(completed.critical, state.dimensions);
      return getMapProps(id, isEnabled, whatIsDraggedOverFromResult(completed.result) === id, whatIsDraggedOver(completed.impact) === id, dragging, renderClone);
    }
    if (state.phase === 'IDLE' && state.completed && !state.shouldFlush) {
      const completed = state.completed;
      if (!isMatchingType(type, completed.critical)) {
        return idleWithoutAnimation;
      }
      const wasOver = whatIsDraggedOver(completed.impact) === id;
      const wasCombining = Boolean(completed.impact.at && completed.impact.at.type === 'COMBINE');
      const isHome = completed.critical.droppable.id === id;
      if (wasOver) {
        return wasCombining ? idleWithAnimation : idleWithoutAnimation;
      }
      if (isHome) {
        return idleWithAnimation;
      }
      return idleWithoutAnimation;
    }
    return idleWithoutAnimation;
  };
  return selector;
};
const mapDispatchToProps = {
  updateViewportMaxScroll: updateViewportMaxScroll
};
const ConnectedDroppable = reactRedux.connect(makeMapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, ownProps) => {
  return {
    ...attachDefaultPropsToOwnProps(ownProps),
    ...stateProps,
    ...dispatchProps
  };
}, {
  context: StoreContext,
  areStatePropsEqual: isStrictEqual
})(Droppable);

exports.DragDropContext = DragDropContext;
exports.Draggable = PublicDraggable;
exports.Droppable = ConnectedDroppable;
exports.useKeyboardSensor = useKeyboardSensor;
exports.useMouseSensor = useMouseSensor;
exports.useTouchSensor = useTouchSensor;
