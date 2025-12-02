(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react'), require('react-dom')) :
  typeof define === 'function' && define.amd ? define(['exports', 'react', 'react-dom'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ReactBeautifulDnd = {}, global.React, global.ReactDOM));
})(this, (function (exports, React, ReactDOM) { 'use strict';

  function _interopNamespaceDefault(e) {
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
    n.default = e;
    return Object.freeze(n);
  }

  var React__namespace = /*#__PURE__*/_interopNamespaceDefault(React);

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
    if (typeof window !== 'undefined' && window[isDisabledFlag]) {
      return;
    }
    console[type](...getFormattedMessage(message));
  }
  const warning$1 = log.bind(null, 'warn');
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

  const prefix$2 = 'Invariant failed';
  class RbdInvariant extends Error {}
  RbdInvariant.prototype.toString = function toString() {
    return this.message;
  };
  function invariant$1(condition, message) {
    {
      throw new RbdInvariant(`${prefix$2}: ${message || ''}`);
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
          warning$1(`
        An error was caught by our window 'error' event listener while a drag was occurring.
        The active drag has been aborted.
      `) ;
        }
        const err = event.error;
        if (err instanceof RbdInvariant) {
          event.preventDefault();
          {
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
        {
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

  // src/utils/formatProdErrorMessage.ts

  // src/utils/symbol-observable.ts
  var $$observable = /* @__PURE__ */ (() => typeof Symbol === "function" && Symbol.observable || "@@observable")();
  var symbol_observable_default = $$observable;

  // src/utils/actionTypes.ts
  var randomString = () => Math.random().toString(36).substring(7).split("").join(".");
  var ActionTypes = {
    INIT: `@@redux/INIT${/* @__PURE__ */ randomString()}`,
    REPLACE: `@@redux/REPLACE${/* @__PURE__ */ randomString()}`};
  var actionTypes_default = ActionTypes;

  // src/utils/isPlainObject.ts
  function isPlainObject$1(obj) {
    if (typeof obj !== "object" || obj === null)
      return false;
    let proto = obj;
    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto);
    }
    return Object.getPrototypeOf(obj) === proto || Object.getPrototypeOf(obj) === null;
  }

  // src/utils/kindOf.ts
  function miniKindOf(val) {
    if (val === void 0)
      return "undefined";
    if (val === null)
      return "null";
    const type = typeof val;
    switch (type) {
      case "boolean":
      case "string":
      case "number":
      case "symbol":
      case "function": {
        return type;
      }
    }
    if (Array.isArray(val))
      return "array";
    if (isDate(val))
      return "date";
    if (isError(val))
      return "error";
    const constructorName = ctorName(val);
    switch (constructorName) {
      case "Symbol":
      case "Promise":
      case "WeakMap":
      case "WeakSet":
      case "Map":
      case "Set":
        return constructorName;
    }
    return Object.prototype.toString.call(val).slice(8, -1).toLowerCase().replace(/\s/g, "");
  }
  function ctorName(val) {
    return typeof val.constructor === "function" ? val.constructor.name : null;
  }
  function isError(val) {
    return val instanceof Error || typeof val.message === "string" && val.constructor && typeof val.constructor.stackTraceLimit === "number";
  }
  function isDate(val) {
    if (val instanceof Date)
      return true;
    return typeof val.toDateString === "function" && typeof val.getDate === "function" && typeof val.setDate === "function";
  }
  function kindOf(val) {
    let typeOfVal = typeof val;
    {
      typeOfVal = miniKindOf(val);
    }
    return typeOfVal;
  }

  // src/createStore.ts
  function createStore$1(reducer, preloadedState, enhancer) {
    if (typeof reducer !== "function") {
      throw new Error(`Expected the root reducer to be a function. Instead, received: '${kindOf(reducer)}'`);
    }
    if (typeof preloadedState === "function" && typeof enhancer === "function" || typeof enhancer === "function" && typeof arguments[3] === "function") {
      throw new Error("It looks like you are passing several store enhancers to createStore(). This is not supported. Instead, compose them together to a single function. See https://redux.js.org/tutorials/fundamentals/part-4-store#creating-a-store-with-enhancers for an example.");
    }
    if (typeof preloadedState === "function" && typeof enhancer === "undefined") {
      enhancer = preloadedState;
      preloadedState = void 0;
    }
    if (typeof enhancer !== "undefined") {
      if (typeof enhancer !== "function") {
        throw new Error(`Expected the enhancer to be a function. Instead, received: '${kindOf(enhancer)}'`);
      }
      return enhancer(createStore$1)(reducer, preloadedState);
    }
    let currentReducer = reducer;
    let currentState = preloadedState;
    let currentListeners = /* @__PURE__ */ new Map();
    let nextListeners = currentListeners;
    let listenerIdCounter = 0;
    let isDispatching = false;
    function ensureCanMutateNextListeners() {
      if (nextListeners === currentListeners) {
        nextListeners = /* @__PURE__ */ new Map();
        currentListeners.forEach((listener, key) => {
          nextListeners.set(key, listener);
        });
      }
    }
    function getState() {
      if (isDispatching) {
        throw new Error("You may not call store.getState() while the reducer is executing. The reducer has already received the state as an argument. Pass it down from the top reducer instead of reading it from the store.");
      }
      return currentState;
    }
    function subscribe(listener) {
      if (typeof listener !== "function") {
        throw new Error(`Expected the listener to be a function. Instead, received: '${kindOf(listener)}'`);
      }
      if (isDispatching) {
        throw new Error("You may not call store.subscribe() while the reducer is executing. If you would like to be notified after the store has been updated, subscribe from a component and invoke store.getState() in the callback to access the latest state. See https://redux.js.org/api/store#subscribelistener for more details.");
      }
      let isSubscribed = true;
      ensureCanMutateNextListeners();
      const listenerId = listenerIdCounter++;
      nextListeners.set(listenerId, listener);
      return function unsubscribe() {
        if (!isSubscribed) {
          return;
        }
        if (isDispatching) {
          throw new Error("You may not unsubscribe from a store listener while the reducer is executing. See https://redux.js.org/api/store#subscribelistener for more details.");
        }
        isSubscribed = false;
        ensureCanMutateNextListeners();
        nextListeners.delete(listenerId);
        currentListeners = null;
      };
    }
    function dispatch(action) {
      if (!isPlainObject$1(action)) {
        throw new Error(`Actions must be plain objects. Instead, the actual type was: '${kindOf(action)}'. You may need to add middleware to your store setup to handle dispatching other values, such as 'redux-thunk' to handle dispatching functions. See https://redux.js.org/tutorials/fundamentals/part-4-store#middleware and https://redux.js.org/tutorials/fundamentals/part-6-async-logic#using-the-redux-thunk-middleware for examples.`);
      }
      if (typeof action.type === "undefined") {
        throw new Error('Actions may not have an undefined "type" property. You may have misspelled an action type string constant.');
      }
      if (typeof action.type !== "string") {
        throw new Error(`Action "type" property must be a string. Instead, the actual type was: '${kindOf(action.type)}'. Value was: '${action.type}' (stringified)`);
      }
      if (isDispatching) {
        throw new Error("Reducers may not dispatch actions.");
      }
      try {
        isDispatching = true;
        currentState = currentReducer(currentState, action);
      } finally {
        isDispatching = false;
      }
      const listeners = currentListeners = nextListeners;
      listeners.forEach((listener) => {
        listener();
      });
      return action;
    }
    function replaceReducer(nextReducer) {
      if (typeof nextReducer !== "function") {
        throw new Error(`Expected the nextReducer to be a function. Instead, received: '${kindOf(nextReducer)}`);
      }
      currentReducer = nextReducer;
      dispatch({
        type: actionTypes_default.REPLACE
      });
    }
    function observable() {
      const outerSubscribe = subscribe;
      return {
        /**
         * The minimal observable subscription method.
         * @param observer Any object that can be used as an observer.
         * The observer object should have a `next` method.
         * @returns An object with an `unsubscribe` method that can
         * be used to unsubscribe the observable from the store, and prevent further
         * emission of values from the observable.
         */
        subscribe(observer) {
          if (typeof observer !== "object" || observer === null) {
            throw new Error(`Expected the observer to be an object. Instead, received: '${kindOf(observer)}'`);
          }
          function observeState() {
            const observerAsObserver = observer;
            if (observerAsObserver.next) {
              observerAsObserver.next(getState());
            }
          }
          observeState();
          const unsubscribe = outerSubscribe(observeState);
          return {
            unsubscribe
          };
        },
        [symbol_observable_default]() {
          return this;
        }
      };
    }
    dispatch({
      type: actionTypes_default.INIT
    });
    const store = {
      dispatch,
      subscribe,
      getState,
      replaceReducer,
      [symbol_observable_default]: observable
    };
    return store;
  }

  // src/bindActionCreators.ts
  function bindActionCreator(actionCreator, dispatch) {
    return function(...args) {
      return dispatch(actionCreator.apply(this, args));
    };
  }
  function bindActionCreators$1(actionCreators, dispatch) {
    if (typeof actionCreators === "function") {
      return bindActionCreator(actionCreators, dispatch);
    }
    if (typeof actionCreators !== "object" || actionCreators === null) {
      throw new Error(`bindActionCreators expected an object or a function, but instead received: '${kindOf(actionCreators)}'. Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?`);
    }
    const boundActionCreators = {};
    for (const key in actionCreators) {
      const actionCreator = actionCreators[key];
      if (typeof actionCreator === "function") {
        boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
      }
    }
    return boundActionCreators;
  }

  // src/compose.ts
  function compose(...funcs) {
    if (funcs.length === 0) {
      return (arg) => arg;
    }
    if (funcs.length === 1) {
      return funcs[0];
    }
    return funcs.reduce((a, b) => (...args) => a(b(...args)));
  }

  // src/applyMiddleware.ts
  function applyMiddleware(...middlewares) {
    return (createStore2) => (reducer, preloadedState) => {
      const store = createStore2(reducer, preloadedState);
      let dispatch = () => {
        throw new Error("Dispatching while constructing your middleware is not allowed. Other middleware would not be applied to this dispatch.");
      };
      const middlewareAPI = {
        getState: store.getState,
        dispatch: (action, ...args) => dispatch(action, ...args)
      };
      const chain = middlewares.map((middleware) => middleware(middlewareAPI));
      dispatch = compose(...chain)(store.dispatch);
      return {
        ...store,
        dispatch
      };
    };
  }

  var useSyncExternalStoreWithSelector_development = {};

  /**
   * @license React
   * use-sync-external-store-with-selector.development.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   */

  var hasRequiredUseSyncExternalStoreWithSelector_development;

  function requireUseSyncExternalStoreWithSelector_development () {
  	if (hasRequiredUseSyncExternalStoreWithSelector_development) return useSyncExternalStoreWithSelector_development;
  	hasRequiredUseSyncExternalStoreWithSelector_development = 1;
  	((function () {
  	    function is(x, y) {
  	      return (x === y && (0 !== x || 1 / x === 1 / y)) || (x !== x && y !== y);
  	    }
  	    "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ &&
  	      "function" ===
  	        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart &&
  	      __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
  	    var React$1 = React,
  	      objectIs = "function" === typeof Object.is ? Object.is : is,
  	      useSyncExternalStore = React$1.useSyncExternalStore,
  	      useRef = React$1.useRef,
  	      useEffect = React$1.useEffect,
  	      useMemo = React$1.useMemo,
  	      useDebugValue = React$1.useDebugValue;
  	    useSyncExternalStoreWithSelector_development.useSyncExternalStoreWithSelector = function (
  	      subscribe,
  	      getSnapshot,
  	      getServerSnapshot,
  	      selector,
  	      isEqual
  	    ) {
  	      var instRef = useRef(null);
  	      if (null === instRef.current) {
  	        var inst = { hasValue: false, value: null };
  	        instRef.current = inst;
  	      } else inst = instRef.current;
  	      instRef = useMemo(
  	        function () {
  	          function memoizedSelector(nextSnapshot) {
  	            if (!hasMemo) {
  	              hasMemo = true;
  	              memoizedSnapshot = nextSnapshot;
  	              nextSnapshot = selector(nextSnapshot);
  	              if (void 0 !== isEqual && inst.hasValue) {
  	                var currentSelection = inst.value;
  	                if (isEqual(currentSelection, nextSnapshot))
  	                  return (memoizedSelection = currentSelection);
  	              }
  	              return (memoizedSelection = nextSnapshot);
  	            }
  	            currentSelection = memoizedSelection;
  	            if (objectIs(memoizedSnapshot, nextSnapshot))
  	              return currentSelection;
  	            var nextSelection = selector(nextSnapshot);
  	            if (void 0 !== isEqual && isEqual(currentSelection, nextSelection))
  	              return (memoizedSnapshot = nextSnapshot), currentSelection;
  	            memoizedSnapshot = nextSnapshot;
  	            return (memoizedSelection = nextSelection);
  	          }
  	          var hasMemo = false,
  	            memoizedSnapshot,
  	            memoizedSelection,
  	            maybeGetServerSnapshot =
  	              void 0 === getServerSnapshot ? null : getServerSnapshot;
  	          return [
  	            function () {
  	              return memoizedSelector(getSnapshot());
  	            },
  	            null === maybeGetServerSnapshot
  	              ? void 0
  	              : function () {
  	                  return memoizedSelector(maybeGetServerSnapshot());
  	                }
  	          ];
  	        },
  	        [getSnapshot, getServerSnapshot, selector, isEqual]
  	      );
  	      var value = useSyncExternalStore(subscribe, instRef[0], instRef[1]);
  	      useEffect(
  	        function () {
  	          inst.hasValue = true;
  	          inst.value = value;
  	        },
  	        [value]
  	      );
  	      useDebugValue(value);
  	      return value;
  	    };
  	    "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ &&
  	      "function" ===
  	        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop &&
  	      __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
  	  }))();
  	return useSyncExternalStoreWithSelector_development;
  }

  {
    requireUseSyncExternalStoreWithSelector_development();
  }

  // src/utils/react.ts

  // src/utils/react-is.ts
  var IS_REACT_19 = /* @__PURE__ */ React__namespace.version.startsWith("19");
  var REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for(
    IS_REACT_19 ? "react.transitional.element" : "react.element"
  );
  var REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for("react.portal");
  var REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for("react.fragment");
  var REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for("react.strict_mode");
  var REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for("react.profiler");
  var REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for("react.consumer");
  var REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for("react.context");
  var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
  var REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for("react.suspense");
  var REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for(
    "react.suspense_list"
  );
  var REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for("react.memo");
  var REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for("react.lazy");
  var REACT_OFFSCREEN_TYPE = /* @__PURE__ */ Symbol.for("react.offscreen");
  var REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for(
    "react.client.reference"
  );
  var ForwardRef = REACT_FORWARD_REF_TYPE;
  var Memo = REACT_MEMO_TYPE;
  function isValidElementType(type) {
    return typeof type === "string" || typeof type === "function" || type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || type === REACT_OFFSCREEN_TYPE || typeof type === "object" && type !== null && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_CONSUMER_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_CLIENT_REFERENCE || type.getModuleId !== void 0) ? true : false;
  }
  function typeOf(object) {
    if (typeof object === "object" && object !== null) {
      const { $$typeof } = object;
      switch ($$typeof) {
        case REACT_ELEMENT_TYPE:
          switch (object = object.type, object) {
            case REACT_FRAGMENT_TYPE:
            case REACT_PROFILER_TYPE:
            case REACT_STRICT_MODE_TYPE:
            case REACT_SUSPENSE_TYPE:
            case REACT_SUSPENSE_LIST_TYPE:
              return object;
            default:
              switch (object = object && object.$$typeof, object) {
                case REACT_CONTEXT_TYPE:
                case REACT_FORWARD_REF_TYPE:
                case REACT_LAZY_TYPE:
                case REACT_MEMO_TYPE:
                  return object;
                case REACT_CONSUMER_TYPE:
                  return object;
                default:
                  return $$typeof;
              }
          }
        case REACT_PORTAL_TYPE:
          return $$typeof;
      }
    }
  }
  function isContextConsumer(object) {
    return IS_REACT_19 ? typeOf(object) === REACT_CONSUMER_TYPE : typeOf(object) === REACT_CONTEXT_TYPE;
  }
  function isMemo(object) {
    return typeOf(object) === REACT_MEMO_TYPE;
  }

  // src/utils/warning.ts
  function warning(message) {
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error(message);
    }
    try {
      throw new Error(message);
    } catch (e) {
    }
  }

  // src/connect/verifySubselectors.ts
  function verify(selector, methodName) {
    if (!selector) {
      throw new Error(`Unexpected value for ${methodName} in connect.`);
    } else if (methodName === "mapStateToProps" || methodName === "mapDispatchToProps") {
      if (!Object.prototype.hasOwnProperty.call(selector, "dependsOnOwnProps")) {
        warning(
          `The selector for ${methodName} of connect did not specify a value for dependsOnOwnProps.`
        );
      }
    }
  }
  function verifySubselectors(mapStateToProps, mapDispatchToProps, mergeProps) {
    verify(mapStateToProps, "mapStateToProps");
    verify(mapDispatchToProps, "mapDispatchToProps");
    verify(mergeProps, "mergeProps");
  }

  // src/connect/selectorFactory.ts
  function pureFinalPropsSelectorFactory(mapStateToProps, mapDispatchToProps, mergeProps, dispatch, {
    areStatesEqual,
    areOwnPropsEqual,
    areStatePropsEqual
  }) {
    let hasRunAtLeastOnce = false;
    let state;
    let ownProps;
    let stateProps;
    let dispatchProps;
    let mergedProps;
    function handleFirstCall(firstState, firstOwnProps) {
      state = firstState;
      ownProps = firstOwnProps;
      stateProps = mapStateToProps(state, ownProps);
      dispatchProps = mapDispatchToProps(dispatch, ownProps);
      mergedProps = mergeProps(stateProps, dispatchProps, ownProps);
      hasRunAtLeastOnce = true;
      return mergedProps;
    }
    function handleNewPropsAndNewState() {
      stateProps = mapStateToProps(state, ownProps);
      if (mapDispatchToProps.dependsOnOwnProps)
        dispatchProps = mapDispatchToProps(dispatch, ownProps);
      mergedProps = mergeProps(stateProps, dispatchProps, ownProps);
      return mergedProps;
    }
    function handleNewProps() {
      if (mapStateToProps.dependsOnOwnProps)
        stateProps = mapStateToProps(state, ownProps);
      if (mapDispatchToProps.dependsOnOwnProps)
        dispatchProps = mapDispatchToProps(dispatch, ownProps);
      mergedProps = mergeProps(stateProps, dispatchProps, ownProps);
      return mergedProps;
    }
    function handleNewState() {
      const nextStateProps = mapStateToProps(state, ownProps);
      const statePropsChanged = !areStatePropsEqual(nextStateProps, stateProps);
      stateProps = nextStateProps;
      if (statePropsChanged)
        mergedProps = mergeProps(stateProps, dispatchProps, ownProps);
      return mergedProps;
    }
    function handleSubsequentCalls(nextState, nextOwnProps) {
      const propsChanged = !areOwnPropsEqual(nextOwnProps, ownProps);
      const stateChanged = !areStatesEqual(
        nextState,
        state,
        nextOwnProps,
        ownProps
      );
      state = nextState;
      ownProps = nextOwnProps;
      if (propsChanged && stateChanged) return handleNewPropsAndNewState();
      if (propsChanged) return handleNewProps();
      if (stateChanged) return handleNewState();
      return mergedProps;
    }
    return function pureFinalPropsSelector(nextState, nextOwnProps) {
      return hasRunAtLeastOnce ? handleSubsequentCalls(nextState, nextOwnProps) : handleFirstCall(nextState, nextOwnProps);
    };
  }
  function finalPropsSelectorFactory(dispatch, {
    initMapStateToProps,
    initMapDispatchToProps,
    initMergeProps,
    ...options
  }) {
    const mapStateToProps = initMapStateToProps(dispatch, options);
    const mapDispatchToProps = initMapDispatchToProps(dispatch, options);
    const mergeProps = initMergeProps(dispatch, options);
    {
      verifySubselectors(mapStateToProps, mapDispatchToProps, mergeProps);
    }
    return pureFinalPropsSelectorFactory(mapStateToProps, mapDispatchToProps, mergeProps, dispatch, options);
  }

  // src/utils/bindActionCreators.ts
  function bindActionCreators(actionCreators, dispatch) {
    const boundActionCreators = {};
    for (const key in actionCreators) {
      const actionCreator = actionCreators[key];
      if (typeof actionCreator === "function") {
        boundActionCreators[key] = (...args) => dispatch(actionCreator(...args));
      }
    }
    return boundActionCreators;
  }

  // src/utils/isPlainObject.ts
  function isPlainObject(obj) {
    if (typeof obj !== "object" || obj === null) return false;
    const proto = Object.getPrototypeOf(obj);
    if (proto === null) return true;
    let baseProto = proto;
    while (Object.getPrototypeOf(baseProto) !== null) {
      baseProto = Object.getPrototypeOf(baseProto);
    }
    return proto === baseProto;
  }

  // src/utils/verifyPlainObject.ts
  function verifyPlainObject(value, displayName, methodName) {
    if (!isPlainObject(value)) {
      warning(
        `${methodName}() in ${displayName} must return a plain object. Instead received ${value}.`
      );
    }
  }

  // src/connect/wrapMapToProps.ts
  function wrapMapToPropsConstant(getConstant) {
    return function initConstantSelector(dispatch) {
      const constant = getConstant(dispatch);
      function constantSelector() {
        return constant;
      }
      constantSelector.dependsOnOwnProps = false;
      return constantSelector;
    };
  }
  function getDependsOnOwnProps(mapToProps) {
    return mapToProps.dependsOnOwnProps ? Boolean(mapToProps.dependsOnOwnProps) : mapToProps.length !== 1;
  }
  function wrapMapToPropsFunc(mapToProps, methodName) {
    return function initProxySelector(dispatch, { displayName }) {
      const proxy = function mapToPropsProxy(stateOrDispatch, ownProps) {
        return proxy.dependsOnOwnProps ? proxy.mapToProps(stateOrDispatch, ownProps) : proxy.mapToProps(stateOrDispatch, void 0);
      };
      proxy.dependsOnOwnProps = true;
      proxy.mapToProps = function detectFactoryAndVerify(stateOrDispatch, ownProps) {
        proxy.mapToProps = mapToProps;
        proxy.dependsOnOwnProps = getDependsOnOwnProps(mapToProps);
        let props = proxy(stateOrDispatch, ownProps);
        if (typeof props === "function") {
          proxy.mapToProps = props;
          proxy.dependsOnOwnProps = getDependsOnOwnProps(props);
          props = proxy(stateOrDispatch, ownProps);
        }
        verifyPlainObject(props, displayName, methodName);
        return props;
      };
      return proxy;
    };
  }

  // src/connect/invalidArgFactory.ts
  function createInvalidArgFactory(arg, name) {
    return (dispatch, options) => {
      throw new Error(
        `Invalid value of type ${typeof arg} for ${name} argument when connecting component ${options.wrappedComponentName}.`
      );
    };
  }

  // src/connect/mapDispatchToProps.ts
  function mapDispatchToPropsFactory(mapDispatchToProps) {
    return mapDispatchToProps && typeof mapDispatchToProps === "object" ? wrapMapToPropsConstant(
      (dispatch) => (
        // @ts-ignore
        bindActionCreators(mapDispatchToProps, dispatch)
      )
    ) : !mapDispatchToProps ? wrapMapToPropsConstant((dispatch) => ({
      dispatch
    })) : typeof mapDispatchToProps === "function" ? (
      // @ts-ignore
      wrapMapToPropsFunc(mapDispatchToProps, "mapDispatchToProps")
    ) : createInvalidArgFactory(mapDispatchToProps, "mapDispatchToProps");
  }

  // src/connect/mapStateToProps.ts
  function mapStateToPropsFactory(mapStateToProps) {
    return !mapStateToProps ? wrapMapToPropsConstant(() => ({})) : typeof mapStateToProps === "function" ? (
      // @ts-ignore
      wrapMapToPropsFunc(mapStateToProps, "mapStateToProps")
    ) : createInvalidArgFactory(mapStateToProps, "mapStateToProps");
  }

  // src/connect/mergeProps.ts
  function defaultMergeProps(stateProps, dispatchProps, ownProps) {
    return { ...ownProps, ...stateProps, ...dispatchProps };
  }
  function wrapMergePropsFunc(mergeProps) {
    return function initMergePropsProxy(dispatch, { displayName, areMergedPropsEqual }) {
      let hasRunOnce = false;
      let mergedProps;
      return function mergePropsProxy(stateProps, dispatchProps, ownProps) {
        const nextMergedProps = mergeProps(stateProps, dispatchProps, ownProps);
        if (hasRunOnce) {
          if (!areMergedPropsEqual(nextMergedProps, mergedProps))
            mergedProps = nextMergedProps;
        } else {
          hasRunOnce = true;
          mergedProps = nextMergedProps;
          verifyPlainObject(mergedProps, displayName, "mergeProps");
        }
        return mergedProps;
      };
    };
  }
  function mergePropsFactory(mergeProps) {
    return !mergeProps ? () => defaultMergeProps : typeof mergeProps === "function" ? wrapMergePropsFunc(mergeProps) : createInvalidArgFactory(mergeProps, "mergeProps");
  }

  // src/utils/batch.ts
  function defaultNoopBatch(callback) {
    callback();
  }

  // src/utils/Subscription.ts
  function createListenerCollection() {
    let first = null;
    let last = null;
    return {
      clear() {
        first = null;
        last = null;
      },
      notify() {
        defaultNoopBatch(() => {
          let listener = first;
          while (listener) {
            listener.callback();
            listener = listener.next;
          }
        });
      },
      get() {
        const listeners = [];
        let listener = first;
        while (listener) {
          listeners.push(listener);
          listener = listener.next;
        }
        return listeners;
      },
      subscribe(callback) {
        let isSubscribed = true;
        const listener = last = {
          callback,
          next: null,
          prev: last
        };
        if (listener.prev) {
          listener.prev.next = listener;
        } else {
          first = listener;
        }
        return function unsubscribe() {
          if (!isSubscribed || first === null) return;
          isSubscribed = false;
          if (listener.next) {
            listener.next.prev = listener.prev;
          } else {
            last = listener.prev;
          }
          if (listener.prev) {
            listener.prev.next = listener.next;
          } else {
            first = listener.next;
          }
        };
      }
    };
  }
  var nullListeners = {
    notify() {
    },
    get: () => []
  };
  function createSubscription(store, parentSub) {
    let unsubscribe;
    let listeners = nullListeners;
    let subscriptionsAmount = 0;
    let selfSubscribed = false;
    function addNestedSub(listener) {
      trySubscribe();
      const cleanupListener = listeners.subscribe(listener);
      let removed = false;
      return () => {
        if (!removed) {
          removed = true;
          cleanupListener();
          tryUnsubscribe();
        }
      };
    }
    function notifyNestedSubs() {
      listeners.notify();
    }
    function handleChangeWrapper() {
      if (subscription.onStateChange) {
        subscription.onStateChange();
      }
    }
    function isSubscribed() {
      return selfSubscribed;
    }
    function trySubscribe() {
      subscriptionsAmount++;
      if (!unsubscribe) {
        unsubscribe = parentSub ? parentSub.addNestedSub(handleChangeWrapper) : store.subscribe(handleChangeWrapper);
        listeners = createListenerCollection();
      }
    }
    function tryUnsubscribe() {
      subscriptionsAmount--;
      if (unsubscribe && subscriptionsAmount === 0) {
        unsubscribe();
        unsubscribe = void 0;
        listeners.clear();
        listeners = nullListeners;
      }
    }
    function trySubscribeSelf() {
      if (!selfSubscribed) {
        selfSubscribed = true;
        trySubscribe();
      }
    }
    function tryUnsubscribeSelf() {
      if (selfSubscribed) {
        selfSubscribed = false;
        tryUnsubscribe();
      }
    }
    const subscription = {
      addNestedSub,
      notifyNestedSubs,
      handleChangeWrapper,
      isSubscribed,
      trySubscribe: trySubscribeSelf,
      tryUnsubscribe: tryUnsubscribeSelf,
      getListeners: () => listeners
    };
    return subscription;
  }

  // src/utils/useIsomorphicLayoutEffect.ts
  var canUseDOM = () => !!(typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined");
  var isDOM = /* @__PURE__ */ canUseDOM();
  var isRunningInReactNative = () => typeof navigator !== "undefined" && navigator.product === "ReactNative";
  var isReactNative = /* @__PURE__ */ isRunningInReactNative();
  var getUseIsomorphicLayoutEffect = () => isDOM || isReactNative ? React__namespace.useLayoutEffect : React__namespace.useEffect;
  var useIsomorphicLayoutEffect$1 = /* @__PURE__ */ getUseIsomorphicLayoutEffect();

  // src/utils/shallowEqual.ts
  function is(x, y) {
    if (x === y) {
      return x !== 0 || y !== 0 || 1 / x === 1 / y;
    } else {
      return x !== x && y !== y;
    }
  }
  function shallowEqual(objA, objB) {
    if (is(objA, objB)) return true;
    if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
      return false;
    }
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(objB, keysA[i]) || !is(objA[keysA[i]], objB[keysA[i]])) {
        return false;
      }
    }
    return true;
  }

  // src/utils/hoistStatics.ts
  var REACT_STATICS = {
    childContextTypes: true,
    contextType: true,
    contextTypes: true,
    defaultProps: true,
    displayName: true,
    getDefaultProps: true,
    getDerivedStateFromError: true,
    getDerivedStateFromProps: true,
    mixins: true,
    propTypes: true,
    type: true
  };
  var KNOWN_STATICS = {
    name: true,
    length: true,
    prototype: true,
    caller: true,
    callee: true,
    arguments: true,
    arity: true
  };
  var FORWARD_REF_STATICS = {
    $$typeof: true,
    render: true,
    defaultProps: true,
    displayName: true,
    propTypes: true
  };
  var MEMO_STATICS = {
    $$typeof: true,
    compare: true,
    defaultProps: true,
    displayName: true,
    propTypes: true,
    type: true
  };
  var TYPE_STATICS = {
    [ForwardRef]: FORWARD_REF_STATICS,
    [Memo]: MEMO_STATICS
  };
  function getStatics(component) {
    if (isMemo(component)) {
      return MEMO_STATICS;
    }
    return TYPE_STATICS[component["$$typeof"]] || REACT_STATICS;
  }
  var defineProperty = Object.defineProperty;
  var getOwnPropertyNames = Object.getOwnPropertyNames;
  var getOwnPropertySymbols = Object.getOwnPropertySymbols;
  var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  var getPrototypeOf = Object.getPrototypeOf;
  var objectPrototype = Object.prototype;
  function hoistNonReactStatics(targetComponent, sourceComponent) {
    if (typeof sourceComponent !== "string") {
      if (objectPrototype) {
        const inheritedComponent = getPrototypeOf(sourceComponent);
        if (inheritedComponent && inheritedComponent !== objectPrototype) {
          hoistNonReactStatics(targetComponent, inheritedComponent);
        }
      }
      let keys = getOwnPropertyNames(sourceComponent);
      if (getOwnPropertySymbols) {
        keys = keys.concat(getOwnPropertySymbols(sourceComponent));
      }
      const targetStatics = getStatics(targetComponent);
      const sourceStatics = getStatics(sourceComponent);
      for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        if (!KNOWN_STATICS[key] && !(sourceStatics && sourceStatics[key]) && !(targetStatics && targetStatics[key])) {
          const descriptor = getOwnPropertyDescriptor(sourceComponent, key);
          try {
            defineProperty(targetComponent, key, descriptor);
          } catch (e) {
          }
        }
      }
    }
    return targetComponent;
  }

  // src/components/Context.ts
  var ContextKey = /* @__PURE__ */ Symbol.for(`react-redux-context`);
  var gT = typeof globalThis !== "undefined" ? globalThis : (
    /* fall back to a per-module scope (pre-8.1 behaviour) if `globalThis` is not available */
    {}
  );
  function getContext() {
    if (!React__namespace.createContext) return {};
    const contextMap = gT[ContextKey] ??= /* @__PURE__ */ new Map();
    let realContext = contextMap.get(React__namespace.createContext);
    if (!realContext) {
      realContext = React__namespace.createContext(
        null
      );
      {
        realContext.displayName = "ReactRedux";
      }
      contextMap.set(React__namespace.createContext, realContext);
    }
    return realContext;
  }
  var ReactReduxContext = /* @__PURE__ */ getContext();

  // src/components/connect.tsx
  var NO_SUBSCRIPTION_ARRAY = [null, null];
  var stringifyComponent = (Comp) => {
    try {
      return JSON.stringify(Comp);
    } catch (err) {
      return String(Comp);
    }
  };
  function useIsomorphicLayoutEffectWithArgs(effectFunc, effectArgs, dependencies) {
    useIsomorphicLayoutEffect$1(() => effectFunc(...effectArgs), dependencies);
  }
  function captureWrapperProps(lastWrapperProps, lastChildProps, renderIsScheduled, wrapperProps, childPropsFromStoreUpdate, notifyNestedSubs) {
    lastWrapperProps.current = wrapperProps;
    renderIsScheduled.current = false;
    if (childPropsFromStoreUpdate.current) {
      childPropsFromStoreUpdate.current = null;
      notifyNestedSubs();
    }
  }
  function subscribeUpdates(shouldHandleStateChanges, store, subscription, childPropsSelector, lastWrapperProps, lastChildProps, renderIsScheduled, isMounted, childPropsFromStoreUpdate, notifyNestedSubs, additionalSubscribeListener) {
    if (!shouldHandleStateChanges) return () => {
    };
    let didUnsubscribe = false;
    let lastThrownError = null;
    const checkForUpdates = () => {
      if (didUnsubscribe || !isMounted.current) {
        return;
      }
      const latestStoreState = store.getState();
      let newChildProps, error;
      try {
        newChildProps = childPropsSelector(
          latestStoreState,
          lastWrapperProps.current
        );
      } catch (e) {
        error = e;
        lastThrownError = e;
      }
      if (!error) {
        lastThrownError = null;
      }
      if (newChildProps === lastChildProps.current) {
        if (!renderIsScheduled.current) {
          notifyNestedSubs();
        }
      } else {
        lastChildProps.current = newChildProps;
        childPropsFromStoreUpdate.current = newChildProps;
        renderIsScheduled.current = true;
        additionalSubscribeListener();
      }
    };
    subscription.onStateChange = checkForUpdates;
    subscription.trySubscribe();
    checkForUpdates();
    const unsubscribeWrapper = () => {
      didUnsubscribe = true;
      subscription.tryUnsubscribe();
      subscription.onStateChange = null;
      if (lastThrownError) {
        throw lastThrownError;
      }
    };
    return unsubscribeWrapper;
  }
  function strictEqual(a, b) {
    return a === b;
  }
  var hasWarnedAboutDeprecatedPureOption = false;
  function connect(mapStateToProps, mapDispatchToProps, mergeProps, {
    // The `pure` option has been removed, so TS doesn't like us destructuring this to check its existence.
    // @ts-ignore
    pure,
    areStatesEqual = strictEqual,
    areOwnPropsEqual = shallowEqual,
    areStatePropsEqual = shallowEqual,
    areMergedPropsEqual = shallowEqual,
    // use React's forwardRef to expose a ref of the wrapped component
    forwardRef = false,
    // the context consumer to use
    context = ReactReduxContext
  } = {}) {
    {
      if (pure !== void 0 && !hasWarnedAboutDeprecatedPureOption) {
        hasWarnedAboutDeprecatedPureOption = true;
        warning(
          'The `pure` option has been removed. `connect` is now always a "pure/memoized" component'
        );
      }
    }
    const Context = context;
    const initMapStateToProps = mapStateToPropsFactory(mapStateToProps);
    const initMapDispatchToProps = mapDispatchToPropsFactory(mapDispatchToProps);
    const initMergeProps = mergePropsFactory(mergeProps);
    const shouldHandleStateChanges = Boolean(mapStateToProps);
    const wrapWithConnect = (WrappedComponent) => {
      {
        const isValid = /* @__PURE__ */ isValidElementType(WrappedComponent);
        if (!isValid)
          throw new Error(
            `You must pass a component to the function returned by connect. Instead received ${stringifyComponent(
            WrappedComponent
          )}`
          );
      }
      const wrappedComponentName = WrappedComponent.displayName || WrappedComponent.name || "Component";
      const displayName = `Connect(${wrappedComponentName})`;
      const selectorFactoryOptions = {
        shouldHandleStateChanges,
        displayName,
        wrappedComponentName,
        WrappedComponent,
        // @ts-ignore
        initMapStateToProps,
        initMapDispatchToProps,
        initMergeProps,
        areStatesEqual,
        areStatePropsEqual,
        areOwnPropsEqual,
        areMergedPropsEqual
      };
      function ConnectFunction(props) {
        const [propsContext, reactReduxForwardedRef, wrapperProps] = React__namespace.useMemo(() => {
          const { reactReduxForwardedRef: reactReduxForwardedRef2, ...wrapperProps2 } = props;
          return [props.context, reactReduxForwardedRef2, wrapperProps2];
        }, [props]);
        const ContextToUse = React__namespace.useMemo(() => {
          let ResultContext = Context;
          if (propsContext?.Consumer) {
            {
              const isValid = /* @__PURE__ */ isContextConsumer(
                // @ts-ignore
                /* @__PURE__ */ React__namespace.createElement(propsContext.Consumer, null)
              );
              if (!isValid) {
                throw new Error(
                  "You must pass a valid React context consumer as `props.context`"
                );
              }
              ResultContext = propsContext;
            }
          }
          return ResultContext;
        }, [propsContext, Context]);
        const contextValue = React__namespace.useContext(ContextToUse);
        const didStoreComeFromProps = Boolean(props.store) && Boolean(props.store.getState) && Boolean(props.store.dispatch);
        const didStoreComeFromContext = Boolean(contextValue) && Boolean(contextValue.store);
        if (!didStoreComeFromProps && !didStoreComeFromContext) {
          throw new Error(
            `Could not find "store" in the context of "${displayName}". Either wrap the root component in a <Provider>, or pass a custom React context provider to <Provider> and the corresponding React context consumer to ${displayName} in connect options.`
          );
        }
        const store = didStoreComeFromProps ? props.store : contextValue.store;
        const getServerState = didStoreComeFromContext ? contextValue.getServerState : store.getState;
        const childPropsSelector = React__namespace.useMemo(() => {
          return finalPropsSelectorFactory(store.dispatch, selectorFactoryOptions);
        }, [store]);
        const [subscription, notifyNestedSubs] = React__namespace.useMemo(() => {
          if (!shouldHandleStateChanges) return NO_SUBSCRIPTION_ARRAY;
          const subscription2 = createSubscription(
            store,
            didStoreComeFromProps ? void 0 : contextValue.subscription
          );
          const notifyNestedSubs2 = subscription2.notifyNestedSubs.bind(subscription2);
          return [subscription2, notifyNestedSubs2];
        }, [store, didStoreComeFromProps, contextValue]);
        const overriddenContextValue = React__namespace.useMemo(() => {
          if (didStoreComeFromProps) {
            return contextValue;
          }
          return {
            ...contextValue,
            subscription
          };
        }, [didStoreComeFromProps, contextValue, subscription]);
        const lastChildProps = React__namespace.useRef(void 0);
        const lastWrapperProps = React__namespace.useRef(wrapperProps);
        const childPropsFromStoreUpdate = React__namespace.useRef(void 0);
        const renderIsScheduled = React__namespace.useRef(false);
        const isMounted = React__namespace.useRef(false);
        const latestSubscriptionCallbackError = React__namespace.useRef(
          void 0
        );
        useIsomorphicLayoutEffect$1(() => {
          isMounted.current = true;
          return () => {
            isMounted.current = false;
          };
        }, []);
        const actualChildPropsSelector = React__namespace.useMemo(() => {
          const selector = () => {
            if (childPropsFromStoreUpdate.current && wrapperProps === lastWrapperProps.current) {
              return childPropsFromStoreUpdate.current;
            }
            return childPropsSelector(store.getState(), wrapperProps);
          };
          return selector;
        }, [store, wrapperProps]);
        const subscribeForReact = React__namespace.useMemo(() => {
          const subscribe = (reactListener) => {
            if (!subscription) {
              return () => {
              };
            }
            return subscribeUpdates(
              shouldHandleStateChanges,
              store,
              subscription,
              // @ts-ignore
              childPropsSelector,
              lastWrapperProps,
              lastChildProps,
              renderIsScheduled,
              isMounted,
              childPropsFromStoreUpdate,
              notifyNestedSubs,
              reactListener
            );
          };
          return subscribe;
        }, [subscription]);
        useIsomorphicLayoutEffectWithArgs(captureWrapperProps, [
          lastWrapperProps,
          lastChildProps,
          renderIsScheduled,
          wrapperProps,
          childPropsFromStoreUpdate,
          notifyNestedSubs
        ]);
        let actualChildProps;
        try {
          actualChildProps = React__namespace.useSyncExternalStore(
            // TODO We're passing through a big wrapper that does a bunch of extra side effects besides subscribing
            subscribeForReact,
            // TODO This is incredibly hacky. We've already processed the store update and calculated new child props,
            // TODO and we're just passing that through so it triggers a re-render for us rather than relying on `uSES`.
            actualChildPropsSelector,
            getServerState ? () => childPropsSelector(getServerState(), wrapperProps) : actualChildPropsSelector
          );
        } catch (err) {
          if (latestSubscriptionCallbackError.current) {
            err.message += `
The error may be correlated with this previous error:
${latestSubscriptionCallbackError.current.stack}

`;
          }
          throw err;
        }
        useIsomorphicLayoutEffect$1(() => {
          latestSubscriptionCallbackError.current = void 0;
          childPropsFromStoreUpdate.current = void 0;
          lastChildProps.current = actualChildProps;
        });
        const renderedWrappedComponent = React__namespace.useMemo(() => {
          return (
            // @ts-ignore
            /* @__PURE__ */ React__namespace.createElement(
              WrappedComponent,
              {
                ...actualChildProps,
                ref: reactReduxForwardedRef
              }
            )
          );
        }, [reactReduxForwardedRef, WrappedComponent, actualChildProps]);
        const renderedChild = React__namespace.useMemo(() => {
          if (shouldHandleStateChanges) {
            return /* @__PURE__ */ React__namespace.createElement(ContextToUse.Provider, { value: overriddenContextValue }, renderedWrappedComponent);
          }
          return renderedWrappedComponent;
        }, [ContextToUse, renderedWrappedComponent, overriddenContextValue]);
        return renderedChild;
      }
      const _Connect = React__namespace.memo(ConnectFunction);
      const Connect = _Connect;
      Connect.WrappedComponent = WrappedComponent;
      Connect.displayName = ConnectFunction.displayName = displayName;
      if (forwardRef) {
        const _forwarded = React__namespace.forwardRef(
          function forwardConnectRef(props, ref) {
            return /* @__PURE__ */ React__namespace.createElement(Connect, { ...props, reactReduxForwardedRef: ref });
          }
        );
        const forwarded = _forwarded;
        forwarded.displayName = displayName;
        forwarded.WrappedComponent = WrappedComponent;
        return /* @__PURE__ */ hoistNonReactStatics(forwarded, WrappedComponent);
      }
      return /* @__PURE__ */ hoistNonReactStatics(Connect, WrappedComponent);
    };
    return wrapWithConnect;
  }
  var connect_default = connect;

  // src/components/Provider.tsx
  function Provider(providerProps) {
    const { children, context, serverState, store } = providerProps;
    const contextValue = React__namespace.useMemo(() => {
      const subscription = createSubscription(store);
      const baseContextValue = {
        store,
        subscription,
        getServerState: serverState ? () => serverState : void 0
      };
      {
        const { identityFunctionCheck = "once", stabilityCheck = "once" } = providerProps;
        return /* @__PURE__ */ Object.assign(baseContextValue, {
          stabilityCheck,
          identityFunctionCheck
        });
      }
    }, [store, serverState]);
    const previousState = React__namespace.useMemo(() => store.getState(), [store]);
    useIsomorphicLayoutEffect$1(() => {
      const { subscription } = contextValue;
      subscription.onStateChange = subscription.notifyNestedSubs;
      subscription.trySubscribe();
      if (previousState !== store.getState()) {
        subscription.notifyNestedSubs();
      }
      return () => {
        subscription.tryUnsubscribe();
        subscription.onStateChange = void 0;
      };
    }, [contextValue, previousState]);
    const Context = context || ReactReduxContext;
    return /* @__PURE__ */ React__namespace.createElement(Context.Provider, { value: contextValue }, children);
  }
  var Provider_default = Provider;

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

  var prefix$1 = 'Invariant failed';
  function invariant(condition, message) {
      var provided = typeof message === 'function' ? message() : message;
      var value = provided ? "".concat(prefix$1, ": ").concat(provided) : prefix$1;
      throw new Error(value);
  }

  var getRect = function getRect(_ref) {
    var top = _ref.top,
        right = _ref.right,
        bottom = _ref.bottom,
        left = _ref.left;
    var width = right - left;
    var height = bottom - top;
    var rect = {
      top: top,
      right: right,
      bottom: bottom,
      left: left,
      width: width,
      height: height,
      x: left,
      y: top,
      center: {
        x: (right + left) / 2,
        y: (bottom + top) / 2
      }
    };
    return rect;
  };
  var expand = function expand(target, expandBy) {
    return {
      top: target.top - expandBy.top,
      left: target.left - expandBy.left,
      bottom: target.bottom + expandBy.bottom,
      right: target.right + expandBy.right
    };
  };
  var shrink = function shrink(target, shrinkBy) {
    return {
      top: target.top + shrinkBy.top,
      left: target.left + shrinkBy.left,
      bottom: target.bottom - shrinkBy.bottom,
      right: target.right - shrinkBy.right
    };
  };

  var shift = function shift(target, shiftBy) {
    return {
      top: target.top + shiftBy.y,
      left: target.left + shiftBy.x,
      bottom: target.bottom + shiftBy.y,
      right: target.right + shiftBy.x
    };
  };

  var noSpacing$1 = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
  var createBox = function createBox(_ref2) {
    var borderBox = _ref2.borderBox,
        _ref2$margin = _ref2.margin,
        margin = _ref2$margin === void 0 ? noSpacing$1 : _ref2$margin,
        _ref2$border = _ref2.border,
        border = _ref2$border === void 0 ? noSpacing$1 : _ref2$border,
        _ref2$padding = _ref2.padding,
        padding = _ref2$padding === void 0 ? noSpacing$1 : _ref2$padding;
    var marginBox = getRect(expand(borderBox, margin));
    var paddingBox = getRect(shrink(borderBox, border));
    var contentBox = getRect(shrink(paddingBox, padding));
    return {
      marginBox: marginBox,
      borderBox: getRect(borderBox),
      paddingBox: paddingBox,
      contentBox: contentBox,
      margin: margin,
      border: border,
      padding: padding
    };
  };

  var parse = function parse(raw) {
    var value = raw.slice(0, -2);
    var suffix = raw.slice(-2);

    if (suffix !== 'px') {
      return 0;
    }

    var result = Number(value);
    !!isNaN(result) ? invariant(false, "Could not parse value [raw: " + raw + ", without suffix: " + value + "]")  : void 0;
    return result;
  };

  var getWindowScroll$1 = function getWindowScroll() {
    return {
      x: window.pageXOffset,
      y: window.pageYOffset
    };
  };

  var offset = function offset(original, change) {
    var borderBox = original.borderBox,
        border = original.border,
        margin = original.margin,
        padding = original.padding;
    var shifted = shift(borderBox, change);
    return createBox({
      borderBox: shifted,
      border: border,
      margin: margin,
      padding: padding
    });
  };
  var withScroll = function withScroll(original, scroll) {
    if (scroll === void 0) {
      scroll = getWindowScroll$1();
    }

    return offset(original, scroll);
  };
  var calculateBox = function calculateBox(borderBox, styles) {
    var margin = {
      top: parse(styles.marginTop),
      right: parse(styles.marginRight),
      bottom: parse(styles.marginBottom),
      left: parse(styles.marginLeft)
    };
    var padding = {
      top: parse(styles.paddingTop),
      right: parse(styles.paddingRight),
      bottom: parse(styles.paddingBottom),
      left: parse(styles.paddingLeft)
    };
    var border = {
      top: parse(styles.borderTopWidth),
      right: parse(styles.borderRightWidth),
      bottom: parse(styles.borderBottomWidth),
      left: parse(styles.borderLeftWidth)
    };
    return createBox({
      borderBox: borderBox,
      margin: margin,
      padding: padding,
      border: border
    });
  };
  var getBox = function getBox(el) {
    var borderBox = el.getBoundingClientRect();
    var styles = window.getComputedStyle(el);
    return calculateBox(borderBox, styles);
  };

  var executeClip = (frame, subject) => {
    const result = getRect({
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
    return getRect(target);
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
    !droppable.frame ? invariant$1()  : void 0;
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
    !(indexOfClosest !== -1) ? invariant$1(false, 'Could not find displaced item in set')  : void 0;
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
    return getRect(expand(marginBox, expandBy));
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
    !wasAt ? invariant$1(false, 'Cannot move in direction without previous impact location')  : void 0;
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
    !combine ? invariant$1()  : void 0;
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
      const withDisplacement = offset(closest.page, displacedBy.point);
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
      const page = offset(last.page, negate(afterCritical.displacedBy.point));
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
    const frame = getRect({
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
    !rect ? invariant$1(false, 'Cannot get clipped area from droppable')  : void 0;
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
    !!isHomeOf(draggable, droppable) ? invariant$1(false, 'Should not add placeholder space to home list')  : void 0;
    !!droppable.subject.withPlaceholder ? invariant$1(false, 'Cannot add placeholder size to a subject when it already has one')  : void 0;
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
    !added ? invariant$1(false, 'Cannot remove placeholder form subject when there was none')  : void 0;
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
    !oldMaxScroll ? invariant$1(false, 'Expected droppable with frame to have old max frame scroll when removing placeholder')  : void 0;
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

  const offsetRectByPosition = (rect, point) => getRect(offsetByPosition(rect, point));

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
    !(state.movementMode === 'SNAP') ? invariant$1()  : void 0;
    const needsVisibilityCheck = state.impact;
    const viewport = forcedViewport || state.viewport;
    const dimensions = forcedDimensions || state.dimensions;
    const {
      draggables,
      droppables
    } = dimensions;
    const draggable = draggables[state.critical.draggable.id];
    const isOver = whatIsDraggedOver(needsVisibilityCheck);
    !isOver ? invariant$1(false, 'Must be over a destination in SNAP movement mode')  : void 0;
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
    !(rawIndex !== -1) ? invariant$1(false, 'Expected draggable to be inside home list')  : void 0;
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

  var offsetDraggable = ({
    draggable,
    offset: offset$1,
    initialWindowScroll
  }) => {
    const client = offset(draggable.client, offset$1);
    const page = withScroll(client, initialWindowScroll);
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
    !frame ? invariant$1(false, 'Expected Droppable to have a frame')  : void 0;
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
      !(state.phase === 'IDLE') ? invariant$1(false, 'INITIAL_PUBLISH must come after a IDLE phase')  : void 0;
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
      !(state.phase === 'DRAGGING') ? invariant$1(false, `Collection cannot start from phase ${state.phase}`)  : void 0;
      const result = {
        ...state,
        phase: 'COLLECTING'
      };
      return result;
    }
    if (action.type === 'PUBLISH_WHILE_DRAGGING') {
      !(state.phase === 'COLLECTING' || state.phase === 'DROP_PENDING') ? invariant$1(false, `Unexpected ${action.type} received in phase ${state.phase}`)  : void 0;
      return publishWhileDraggingInVirtual({
        state,
        published: action.payload
      });
    }
    if (action.type === 'MOVE') {
      if (state.phase === 'DROP_PENDING') {
        return state;
      }
      !isMovementAllowed(state) ? invariant$1(false, `${action.type} not permitted in phase ${state.phase}`)  : void 0;
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
      !isMovementAllowed(state) ? invariant$1(false, `${action.type} not permitted in phase ${state.phase}`)  : void 0;
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
      !isMovementAllowed(state) ? invariant$1(false, `Attempting to move in an unsupported phase ${state.phase}`)  : void 0;
      const {
        id,
        isEnabled
      } = action.payload;
      const target = state.dimensions.droppables[id];
      !target ? invariant$1(false, `Cannot find Droppable[id: ${id}] to toggle its enabled state`)  : void 0;
      !(target.isEnabled !== isEnabled) ? invariant$1(false, `Trying to set droppable isEnabled to ${String(isEnabled)}
      but it is already ${String(target.isEnabled)}`)  : void 0;
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
      !isMovementAllowed(state) ? invariant$1(false, `Attempting to move in an unsupported phase ${state.phase}`)  : void 0;
      const {
        id,
        isCombineEnabled
      } = action.payload;
      const target = state.dimensions.droppables[id];
      !target ? invariant$1(false, `Cannot find Droppable[id: ${id}] to toggle its isCombineEnabled state`)  : void 0;
      !(target.isCombineEnabled !== isCombineEnabled) ? invariant$1(false, `Trying to set droppable isCombineEnabled to ${String(isCombineEnabled)}
      but it is already ${String(target.isCombineEnabled)}`)  : void 0;
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
      !isMovementAllowed(state) ? invariant$1(false, `Cannot move by window in phase ${state.phase}`)  : void 0;
      !state.isWindowScrollAllowed ? invariant$1(false, 'Window scrolling is currently not supported for fixed lists')  : void 0;
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
      !(state.phase === 'DRAGGING') ? invariant$1(false, `${action.type} received while not in DRAGGING phase`)  : void 0;
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
      !(state.phase === 'COLLECTING') ? invariant$1(false, 'Can only move into the DROP_PENDING phase from the COLLECTING phase')  : void 0;
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
      !(state.phase === 'DRAGGING' || state.phase === 'DROP_PENDING') ? invariant$1(false, `Cannot animate drop from phase ${state.phase}`)  : void 0;
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
    warning$1(`
    Detected non-consecutive <Draggable /> indexes.

    (This can cause unexpected bugs)

    ${formatted}
  `) ;
  }
  function validateDimensions(critical, dimensions) {
    {
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
    !(getState().phase === 'IDLE') ? invariant$1(false, 'Unexpected phase to start a drag')  : void 0;
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
    !!isWaitingForDrop ? invariant$1(false, 'A DROP action occurred while DROP_PENDING and still waiting')  : void 0;
    !(state.phase === 'DRAGGING' || state.phase === 'DROP_PENDING') ? invariant$1(false, `Cannot drop in phase: ${state.phase}`)  : void 0;
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

  var rafSchd = function rafSchd(fn) {
    var lastArgs = [];
    var frameId = null;

    var wrapperFn = function wrapperFn() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      lastArgs = args;

      if (frameId) {
        return;
      }

      frameId = requestAnimationFrame(function () {
        frameId = null;
        fn.apply(void 0, lastArgs);
      });
    };

    wrapperFn.cancel = function () {
      if (!frameId) {
        return;
      }

      cancelAnimationFrame(frameId);
      frameId = null;
    };

    return wrapperFn;
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
      !!isActive() ? invariant$1(false, 'Cannot start scroll listener when already active')  : void 0;
      unbind = bindEvents(window, [binding]);
    }
    function stop() {
      !isActive() ? invariant$1(false, 'Cannot stop scroll listener when not active')  : void 0;
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
        warning$1('Announcement already made. Not making a second announcement') ;
        return;
      }
      if (isExpired) {
        warning$1(`
        Announcements cannot be made asynchronously.
        Default message has already been announced.
      `) ;
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
      !(index !== -1) ? invariant$1(false, 'Could not find timer')  : void 0;
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
    fn();
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
      !!dragging ? invariant$1(false, 'Cannot fire onBeforeCapture as a drag start has already been published')  : void 0;
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
      !!dragging ? invariant$1(false, 'Cannot fire onBeforeDragStart as a drag start has already been published')  : void 0;
      withTimings('onBeforeDragStart', () => {
        const fn = getResponders().onBeforeDragStart;
        if (fn) {
          fn(getDragStart(critical, mode));
        }
      });
    };
    const start = (critical, mode) => {
      !!dragging ? invariant$1(false, 'Cannot fire onBeforeDragStart as a drag start has already been published')  : void 0;
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
      !dragging ? invariant$1(false, 'Cannot fire onDragMove when onDragStart has not been called')  : void 0;
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
      !dragging ? invariant$1(false, 'Can only flush responders while dragging')  : void 0;
      asyncMarshal.flush();
    };
    const drop = result => {
      !dragging ? invariant$1(false, 'Cannot fire onDragEnd when there is no matching onDragStart')  : void 0;
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
    !(state.phase === 'DROP_ANIMATING') ? invariant$1(false, 'Cannot finish a drop animating when no drop is occurring')  : void 0;
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
      !(state.phase === 'DRAGGING') ? invariant$1(false, 'Expected phase to be DRAGGING after INITIAL_PUBLISH')  : void 0;
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

  const composeEnhancers = typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
    name: '@hello-pangea/dnd'
  }) : compose;
  var createStore = ({
    dimensionMarshal,
    focusMarshal,
    styleMarshal,
    getResponders,
    announce,
    autoScroller
  }) => createStore$1(reducer, composeEnhancers(applyMiddleware(style(styleMarshal), dimensionMarshalStopper(dimensionMarshal), lift(dimensionMarshal), dropMiddleware, dropAnimationFinishMiddleware, dropAnimationFlushOnScrollMiddleware, pendingDrop, autoScroll(autoScroller), scrollListener, focus(focusMarshal), responders(getResponders, announce))));

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
    !doc ? invariant$1(false, 'Cannot find document.documentElement')  : void 0;
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
    const frame = getRect({
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
    const viewport = getViewport();
    const windowScroll = viewport.scroll.current;
    const home = critical.droppable;
    const droppables = registry.droppable.getAllByType(home.type).map(entry => entry.callbacks.getDimensionAndWatchScroll(windowScroll, scrollOptions));
    const draggables = registry.draggable.getAllByType(critical.draggable.type).map(entry => entry.getDimension(windowScroll));
    const dimensions = {
      draggables: toDraggableMap(draggables),
      droppables: toDroppableMap(droppables)
    };
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
      warning$1(`
      You are attempting to add or remove a Draggable [id: ${entry.descriptor.id}]
      while a drag is occurring. This is only supported for virtual lists.

      See https://github.com/hello-pangea/dnd/blob/main/docs/patterns/virtual-lists.md
    `) ;
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
      !registry.droppable.exists(id) ? invariant$1(false, `Cannot update is enabled flag of Droppable ${id} as it is not registered`)  : void 0;
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
      !registry.droppable.exists(id) ? invariant$1(false, `Cannot update isCombineEnabled flag of Droppable ${id} as it is not registered`)  : void 0;
      callbacks.updateDroppableIsCombineEnabled({
        id,
        isCombineEnabled
      });
    };
    const updateDroppableScroll = (id, newScroll) => {
      if (!collection) {
        return;
      }
      !registry.droppable.exists(id) ? invariant$1(false, `Cannot update the scroll on Droppable ${id} as it is not registered`)  : void 0;
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
      !collection ? invariant$1(false, 'Should only be subscribed when a collection is occurring')  : void 0;
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
      !!collection ? invariant$1(false, 'Cannot start capturing critical dimensions as there is already a collection')  : void 0;
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
      !droppable.frame ? invariant$1(false, 'Invalid result')  : void 0;
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
      warning$1(`
      Detected distance range of 0 in the fluid auto scroller
      This is unexpected and would cause a divide by 0 issue.
      Not allowing an auto scroll
    `) ;
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
      !dragging ? invariant$1(false, 'Cannot fluid scroll if not dragging')  : void 0;
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
    const start = state => {
      !!dragging ? invariant$1(false, 'Cannot start auto scrolling when already started')  : void 0;
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
      start,
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
      !destination ? invariant$1(false, 'Cannot perform a jump scroll when there is no destination')  : void 0;
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
    !head ? invariant$1(false, 'Cannot find the head to append a style to')  : void 0;
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
      !el ? invariant$1(false, 'Cannot set dynamic style element if it is not set')  : void 0;
      el.textContent = proposed;
    }), []);
    const setAlwaysStyle = useCallback(proposed => {
      const el = alwaysRef.current;
      !el ? invariant$1(false, 'Cannot set dynamic style element if it is not set')  : void 0;
      el.textContent = proposed;
    }, []);
    useIsomorphicLayoutEffect(() => {
      !(!alwaysRef.current && !dynamicRef.current) ? invariant$1(false, 'style elements already mounted')  : void 0;
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
          !current ? invariant$1(false, 'Cannot unmount ref as it is not set')  : void 0;
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
      warning$1(`Unable to find any drag handles in the context "${contextId}"`) ;
      return null;
    }
    const handle = possible.find(el => {
      return el.getAttribute(dragHandle.draggableId) === draggableId;
    });
    if (!handle) {
      warning$1(`Unable to find drag handle with id "${draggableId}" as no handle with a matching id was found`) ;
      return null;
    }
    if (!isHtmlElement(handle)) {
      warning$1('drag handle needs to be a HTMLElement') ;
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
      !entry ? invariant$1(false, `Cannot find draggable entry with id [${id}]`)  : void 0;
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
      !entry ? invariant$1(false, `Cannot find droppable entry with id [${id}]`)  : void 0;
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

  function _extends() {
    return _extends = Object.assign ? Object.assign.bind() : function (n) {
      for (var e = 1; e < arguments.length; e++) {
        var t = arguments[e];
        for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
      }
      return n;
    }, _extends.apply(null, arguments);
  }

  var getBodyElement = () => {
    const body = document.body;
    !body ? invariant$1(false, 'Cannot find document.body')  : void 0;
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
      warning$1(`
      A screen reader message was trying to be announced but it was unable to do so.
      This can occur if you unmount your <DragDropContext /> in your onDragEnd.
      Consider calling provided.announce() before the unmount so that the instruction will
      not be lost for users relying on a screen reader.

      Message not passed to screen reader:

      "${message}"
    `) ;
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
    !(result != null) ? invariant$1(false, `Unable to parse React version ${value}`)  : void 0;
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
    warning$1(`
    React version: [${actual.raw}]
    does not satisfy expected peer dependency version: [${peerDep.raw}]

    This can result in run time bugs, and even fatal crashes
  `) ;
  };

  const suffix = `
  We expect a html5 doctype: <!doctype html>
  This is to ensure consistent browser layout and measurement

  More information: https://github.com/hello-pangea/dnd/blob/main/docs/guides/doctype.md
`;
  var checkDoctype = doc => {
    const doctype = doc.doctype;
    if (!doctype) {
      warning$1(`
      No <!doctype html> found.

      ${suffix}
    `) ;
      return;
    }
    if (doctype.name.toLowerCase() !== 'html') {
      warning$1(`
      Unexpected <!doctype> found: (${doctype.name})

      ${suffix}
    `) ;
    }
    if (doctype.publicId !== '') {
      warning$1(`
      Unexpected <!doctype> publicId found: (${doctype.publicId})
      A html5 doctype does not have a publicId

      ${suffix}
    `) ;
    }
  };

  function useDev(useHook) {
    {
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
      !!lock ? invariant$1(false, 'Cannot claim lock as it is already claimed')  : void 0;
      const newLock = {
        abandon
      };
      lock = newLock;
      return newLock;
    }
    function release() {
      !lock ? invariant$1(false, 'Cannot release lock when there is no lock')  : void 0;
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
        !(phase.type === 'PENDING') ? invariant$1(false, 'Cannot be IDLE')  : void 0;
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
        !(phase.type !== 'IDLE') ? invariant$1(false, 'Unexpected phase')  : void 0;
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
      !(phaseRef.current.type === 'IDLE') ? invariant$1(false, 'Expected to move from IDLE to PENDING drag')  : void 0;
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
          !isCapturing ? invariant$1(false, 'Cannot stop capturing a keyboard drag when not capturing')  : void 0;
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
        !(phase.type !== 'IDLE') ? invariant$1()  : void 0;
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
      !(phase.type === 'PENDING') ? invariant$1(false, `Cannot start dragging from phase ${phase.type}`)  : void 0;
      const actions = phase.actions.fluidLift(phase.point);
      setPhase({
        type: 'DRAGGING',
        actions,
        hasMoved: false
      });
    }, [getPhase, setPhase]);
    const startPendingDrag = useCallback(function startPendingDrag(actions, point) {
      !(getPhase().type === 'IDLE') ? invariant$1(false, 'Expected to move from IDLE to PENDING drag')  : void 0;
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
        !(previousRef.current.length === sensorHooks.length) ? "development" !== "production" ? invariant$1(false, 'Cannot change the amount of sensor hooks after mounting') : invariant$1(false) : void 0;
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

  var getBorderBoxCenterPosition = el => getRect(el.getBoundingClientRect()).center;

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
      warning$1('event.target must be a Element') ;
      return null;
    }
    const selector = getSelector(contextId);
    const handle = closest(target, selector);
    if (!handle) {
      return null;
    }
    if (!isHtmlElement(handle)) {
      warning$1('drag handle must be a HTMLElement') ;
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
      warning$1('Draggable element is not a HTMLElement') ;
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
        warning$1(`
        Cannot perform action.
        The sensor no longer has an action lock.

        Tips:

        - Throw away your action handlers when forceStop() is called
        - Check actions.isActive() if you really need to
      `) ;
      }
      return false;
    }
    if (expected !== phase) {
      if (shouldWarn) {
        warning$1(`
        Cannot perform action.
        The actions you used belong to an outdated phase

        Current phase: ${expected}
        You called an action from outdated phase: ${phase}

        Tips:

        - Do not use preDragActions actions after calling preDragActions.lift()
      `) ;
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
      warning$1(`Unable to find draggable with id: ${draggableId}`) ;
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
      warning$1(`Unable to find draggable element with id: ${draggableId}`) ;
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
        invariant$1(false, `Cannot lift in phase ${phase}`)  ;
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
    !lazyRef.current ? invariant$1(false, 'Could not find store from lazy ref')  : void 0;
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
    const marshalCallbacks = useMemo(() => bindActionCreators$1({
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
      ...bindActionCreators$1({
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
    {
      if (lazyStoreRef.current && lazyStoreRef.current !== store) {
        warning$1('unexpected store change') ;
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
    }, React.createElement(Provider_default, {
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
    const client = calculateBox(borderBox, computedStyles);
    const page = withScroll(client, windowScroll);
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
      !el ? invariant$1(false, 'Cannot get dimension when no ref is set')  : void 0;
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
    !(el && isHtmlElement(el)) ? invariant$1(false, `
    provided.innerRef has not been provided with a HTMLElement.

    You can find a guide on using the innerRef callback functions at:
    https://github.com/hello-pangea/dnd/blob/main/docs/guides/using-inner-ref.md
  `)  : void 0;
  }

  function useValidation$1(props, contextId, getRef) {
    useDevSetupWarning(() => {
      function prefix(id) {
        return `Draggable[id: ${id}]: `;
      }
      const id = props.draggableId;
      !id ? "development" !== "production" ? invariant$1(false, 'Draggable requires a draggableId') : invariant$1(false) : void 0;
      !(typeof id === 'string') ? "development" !== "production" ? invariant$1(false, `Draggable requires a [string] draggableId.
      Provided: [type: ${typeof id}] (value: ${id})`) : invariant$1(false) : void 0;
      !Number.isInteger(props.index) ? "development" !== "production" ? invariant$1(false, `${prefix(id)} requires an integer index prop`) : invariant$1(false) : void 0;
      if (props.mapped.type === 'DRAGGING') {
        return;
      }
      checkIsValidInnerRef(getRef());
      if (props.isEnabled) {
        !findDragHandle(contextId, id) ? "development" !== "production" ? invariant$1(false, `${prefix(id)} Unable to find drag handle`) : invariant$1(false) : void 0;
      }
    });
  }
  function useClonePropValidation(isClone) {
    useDev(() => {
      const initialRef = React.useRef(isClone);
      useDevSetupWarning(() => {
        !(isClone === initialRef.current) ? "development" !== "production" ? invariant$1(false, 'Draggable isClone prop value changed during component life') : invariant$1(false) : void 0;
      }, [isClone]);
    });
  }

  function useRequiredContext(Context) {
    const result = React.useContext(Context);
    !result ? invariant$1(false, 'Could not find required context')  : void 0;
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
  const ConnectedDraggable = connect_default(makeMapStateToProps$1, mapDispatchToProps$1, null, {
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
    const body = getBodyElement();
    const html = document.documentElement;
    !html ? invariant$1()  : void 0;
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
    warning$1(`
    We have detected that your <body> element might be a scroll container.
    We have found no reliable way of detecting whether the <body> element is a scroll container.
    Under most circumstances a <body> scroll bar will be on the <html> element (document.documentElement)

    Because we cannot determine if the <body> is a scroll container, and generally it is not one,
    we will be treating the <body> as *not* a scroll container

    More information: https://github.com/hello-pangea/dnd/blob/main/docs/guides/how-we-detect-scroll-containers.md
  `) ;
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
    warning$1(`
    Droppable: unsupported nested scroll container detected.
    A Droppable can only have one scroll parent (which can be itself)
    Nested scroll containers are currently not supported.

    We hope to support nested scroll containers soon: https://github.com/atlassian/react-beautiful-dnd/issues/131
  `) ;
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
    const base = getBox(targetRef);
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
    const borderBox = expand(paddingBox, base.border);
    const client = createBox({
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
    const page = withScroll(client, windowScroll);
    const closest = (() => {
      if (!closestScrollable) {
        return null;
      }
      const frameClient = getBox(closestScrollable);
      const scrollSize = {
        scrollHeight: closestScrollable.scrollHeight,
        scrollWidth: closestScrollable.scrollWidth
      };
      return {
        client: frameClient,
        page: withScroll(frameClient, windowScroll),
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
      !whileDraggingRef.current ? invariant$1(false, 'Can only update scroll when dragging')  : void 0;
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
      !(dragging && closest) ? invariant$1(false, 'Could not find scroll options while scrolling')  : void 0;
      const options = dragging.scrollOptions;
      if (options.shouldPublishImmediately) {
        updateScroll();
        return;
      }
      scheduleScrollUpdate();
    }, [scheduleScrollUpdate, updateScroll]);
    const getDimensionAndWatchScroll = useCallback((windowScroll, options) => {
      !!whileDraggingRef.current ? invariant$1(false, 'Cannot collect a droppable while a drag is occurring')  : void 0;
      const previous = previousRef.current;
      const ref = previous.getDroppableRef();
      !ref ? invariant$1(false, 'Cannot collect without a droppable ref')  : void 0;
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
        {
          checkForNestedScrollContainers(scrollable);
        }
      }
      return dimension;
    }, [appContext.contextId, descriptor, onClosestScroll, previousRef]);
    const getScrollWhileDragging = useCallback(() => {
      const dragging = whileDraggingRef.current;
      const closest = getClosestScrollableFromDrag(dragging);
      !(dragging && closest) ? invariant$1(false, 'Can only recollect Droppable client for Droppables that have a scroll container')  : void 0;
      return getScroll(closest);
    }, []);
    const dragStopped = useCallback(() => {
      const dragging = whileDraggingRef.current;
      !dragging ? invariant$1(false, 'Cannot stop drag when no active drag')  : void 0;
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
      !dragging ? invariant$1(false, 'Cannot scroll when there is no drag')  : void 0;
      const closest = getClosestScrollableFromDrag(dragging);
      !closest ? invariant$1(false, 'Cannot scroll a droppable with no closest scrollable')  : void 0;
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
          warning$1('Unsupported: changing the droppableId or type of a Droppable during a drag') ;
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
    !props.droppableId ? invariant$1(false, 'A Droppable requires a droppableId prop')  : void 0;
    !(typeof props.droppableId === 'string') ? invariant$1(false, `A Droppable requires a [string] droppableId. Provided: [${typeof props.droppableId}]`)  : void 0;
  }, function boolean({
    props
  }) {
    !isBoolean(props.isDropDisabled) ? invariant$1(false, 'isDropDisabled must be a boolean')  : void 0;
    !isBoolean(props.isCombineEnabled) ? invariant$1(false, 'isCombineEnabled must be a boolean')  : void 0;
    !isBoolean(props.ignoreContainerClipping) ? invariant$1(false, 'ignoreContainerClipping must be a boolean')  : void 0;
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
    warning$1(`
      Droppable setup issue [droppableId: "${props.droppableId}"]:
      DroppableProvided > placeholder could not be found.

      Please be sure to add the {provided.placeholder} React Node as a child of your Droppable.
      More information: https://github.com/hello-pangea/dnd/blob/main/docs/api/droppable.md
    `) ;
  }];
  const virtual = [function hasClone({
    props
  }) {
    !props.renderClone ? invariant$1(false, 'Must provide a clone render function (renderClone) for virtual lists')  : void 0;
  }, function hasNoPlaceholder({
    getPlaceholderRef
  }) {
    !!getPlaceholderRef() ? invariant$1(false, 'Expected virtual list to not have a placeholder')  : void 0;
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
    !appContext ? invariant$1(false, 'Could not find app context')  : void 0;
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
    !document.body ? invariant$1(false, 'document.body is not ready')  : void 0;
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
  const ConnectedDroppable = connect_default(makeMapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, ownProps) => {
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

}));
