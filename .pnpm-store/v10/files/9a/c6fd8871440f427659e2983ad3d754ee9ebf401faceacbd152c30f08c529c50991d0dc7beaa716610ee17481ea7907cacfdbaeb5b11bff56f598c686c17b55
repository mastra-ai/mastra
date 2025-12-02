"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }/**
 * react-router v7.9.4
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */





















































var _chunkDI2QHYMJjs = require('./chunk-DI2QHYMJ.js');

// lib/components.tsx
var _react = require('react'); var React = _interopRequireWildcard(_react); var React2 = _interopRequireWildcard(_react); var React3 = _interopRequireWildcard(_react);
function mapRouteProperties(route) {
  let updates = {
    // Note: this check also occurs in createRoutesFromChildren so update
    // there if you change this -- please and thank you!
    hasErrorBoundary: route.hasErrorBoundary || route.ErrorBoundary != null || route.errorElement != null
  };
  if (route.Component) {
    if (_chunkDI2QHYMJjs.ENABLE_DEV_WARNINGS) {
      if (route.element) {
        _chunkDI2QHYMJjs.warning.call(void 0, 
          false,
          "You should not include both `Component` and `element` on your route - `Component` will be used."
        );
      }
    }
    Object.assign(updates, {
      element: React.createElement(route.Component),
      Component: void 0
    });
  }
  if (route.HydrateFallback) {
    if (_chunkDI2QHYMJjs.ENABLE_DEV_WARNINGS) {
      if (route.hydrateFallbackElement) {
        _chunkDI2QHYMJjs.warning.call(void 0, 
          false,
          "You should not include both `HydrateFallback` and `hydrateFallbackElement` on your route - `HydrateFallback` will be used."
        );
      }
    }
    Object.assign(updates, {
      hydrateFallbackElement: React.createElement(route.HydrateFallback),
      HydrateFallback: void 0
    });
  }
  if (route.ErrorBoundary) {
    if (_chunkDI2QHYMJjs.ENABLE_DEV_WARNINGS) {
      if (route.errorElement) {
        _chunkDI2QHYMJjs.warning.call(void 0, 
          false,
          "You should not include both `ErrorBoundary` and `errorElement` on your route - `ErrorBoundary` will be used."
        );
      }
    }
    Object.assign(updates, {
      errorElement: React.createElement(route.ErrorBoundary),
      ErrorBoundary: void 0
    });
  }
  return updates;
}
var hydrationRouteProperties = [
  "HydrateFallback",
  "hydrateFallbackElement"
];
function createMemoryRouter(routes, opts) {
  return _chunkDI2QHYMJjs.createRouter.call(void 0, {
    basename: _optionalChain([opts, 'optionalAccess', _2 => _2.basename]),
    getContext: _optionalChain([opts, 'optionalAccess', _3 => _3.getContext]),
    future: _optionalChain([opts, 'optionalAccess', _4 => _4.future]),
    history: _chunkDI2QHYMJjs.createMemoryHistory.call(void 0, {
      initialEntries: _optionalChain([opts, 'optionalAccess', _5 => _5.initialEntries]),
      initialIndex: _optionalChain([opts, 'optionalAccess', _6 => _6.initialIndex])
    }),
    hydrationData: _optionalChain([opts, 'optionalAccess', _7 => _7.hydrationData]),
    routes,
    hydrationRouteProperties,
    mapRouteProperties,
    dataStrategy: _optionalChain([opts, 'optionalAccess', _8 => _8.dataStrategy]),
    patchRoutesOnNavigation: _optionalChain([opts, 'optionalAccess', _9 => _9.patchRoutesOnNavigation])
  }).initialize();
}
var Deferred = class {
  constructor() {
    this.status = "pending";
    this.promise = new Promise((resolve, reject) => {
      this.resolve = (value) => {
        if (this.status === "pending") {
          this.status = "resolved";
          resolve(value);
        }
      };
      this.reject = (reason) => {
        if (this.status === "pending") {
          this.status = "rejected";
          reject(reason);
        }
      };
    });
  }
};
function shallowDiff(a, b) {
  if (a === b) {
    return false;
  }
  let aKeys = Object.keys(a);
  let bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return true;
  }
  for (let key of aKeys) {
    if (a[key] !== b[key]) {
      return true;
    }
  }
  return false;
}
function UNSTABLE_TransitionEnabledRouterProvider({
  router,
  flushSync: reactDomFlushSyncImpl,
  unstable_onError
}) {
  let fetcherData = React.useRef(/* @__PURE__ */ new Map());
  let [revalidating, startRevalidation] = React.useTransition();
  let [state, setState] = React.useState(router.state);
  router.__setPendingRerender = (promise) => startRevalidation(
    // @ts-expect-error - need react 19 types for this to be async
    async () => {
      const rerender = await promise;
      startRevalidation(() => {
        rerender();
      });
    }
  );
  let navigator = React.useMemo(() => {
    return {
      createHref: router.createHref,
      encodeLocation: router.encodeLocation,
      go: (n) => router.navigate(n),
      push: (to, state2, opts) => router.navigate(to, {
        state: state2,
        preventScrollReset: _optionalChain([opts, 'optionalAccess', _10 => _10.preventScrollReset])
      }),
      replace: (to, state2, opts) => router.navigate(to, {
        replace: true,
        state: state2,
        preventScrollReset: _optionalChain([opts, 'optionalAccess', _11 => _11.preventScrollReset])
      })
    };
  }, [router]);
  let basename = router.basename || "/";
  let dataRouterContext = React.useMemo(
    () => ({
      router,
      navigator,
      static: false,
      basename,
      unstable_onError
    }),
    [router, navigator, basename, unstable_onError]
  );
  React.useLayoutEffect(() => {
    return router.subscribe(
      (newState, { deletedFetchers, flushSync, viewTransitionOpts }) => {
        newState.fetchers.forEach((fetcher, key) => {
          if (fetcher.data !== void 0) {
            fetcherData.current.set(key, fetcher.data);
          }
        });
        deletedFetchers.forEach((key) => fetcherData.current.delete(key));
        const diff = shallowDiff(state, newState);
        if (!diff) return;
        if (flushSync) {
          if (reactDomFlushSyncImpl) {
            reactDomFlushSyncImpl(() => setState(newState));
          } else {
            setState(newState);
          }
        } else {
          React.startTransition(() => {
            setState(newState);
          });
        }
      }
    );
  }, [router, reactDomFlushSyncImpl, state]);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(_chunkDI2QHYMJjs.DataRouterContext.Provider, { value: dataRouterContext }, /* @__PURE__ */ React.createElement(
    _chunkDI2QHYMJjs.DataRouterStateContext.Provider,
    {
      value: {
        ...state,
        revalidation: revalidating ? "loading" : state.revalidation
      }
    },
    /* @__PURE__ */ React.createElement(_chunkDI2QHYMJjs.FetchersContext.Provider, { value: fetcherData.current }, /* @__PURE__ */ React.createElement(
      Router,
      {
        basename,
        location: state.location,
        navigationType: state.historyAction,
        navigator
      },
      /* @__PURE__ */ React.createElement(
        MemoizedDataRoutes,
        {
          routes: router.routes,
          future: router.future,
          state,
          unstable_onError
        }
      )
    ))
  )), null);
}
function RouterProvider({
  router,
  flushSync: reactDomFlushSyncImpl,
  unstable_onError
}) {
  let [state, setStateImpl] = React.useState(router.state);
  let [pendingState, setPendingState] = React.useState();
  let [vtContext, setVtContext] = React.useState({
    isTransitioning: false
  });
  let [renderDfd, setRenderDfd] = React.useState();
  let [transition, setTransition] = React.useState();
  let [interruption, setInterruption] = React.useState();
  let fetcherData = React.useRef(/* @__PURE__ */ new Map());
  let logErrorsAndSetState = React.useCallback(
    (newState) => {
      setStateImpl((prevState) => {
        if (newState.errors && unstable_onError) {
          Object.entries(newState.errors).forEach(([routeId, error]) => {
            if (_optionalChain([prevState, 'access', _12 => _12.errors, 'optionalAccess', _13 => _13[routeId]]) !== error) {
              unstable_onError(error);
            }
          });
        }
        return newState;
      });
    },
    [unstable_onError]
  );
  let setState = React.useCallback(
    (newState, { deletedFetchers, flushSync, viewTransitionOpts }) => {
      newState.fetchers.forEach((fetcher, key) => {
        if (fetcher.data !== void 0) {
          fetcherData.current.set(key, fetcher.data);
        }
      });
      deletedFetchers.forEach((key) => fetcherData.current.delete(key));
      _chunkDI2QHYMJjs.warnOnce.call(void 0, 
        flushSync === false || reactDomFlushSyncImpl != null,
        'You provided the `flushSync` option to a router update, but you are not using the `<RouterProvider>` from `react-router/dom` so `ReactDOM.flushSync()` is unavailable.  Please update your app to `import { RouterProvider } from "react-router/dom"` and ensure you have `react-dom` installed as a dependency to use the `flushSync` option.'
      );
      let isViewTransitionAvailable = router.window != null && router.window.document != null && typeof router.window.document.startViewTransition === "function";
      _chunkDI2QHYMJjs.warnOnce.call(void 0, 
        viewTransitionOpts == null || isViewTransitionAvailable,
        "You provided the `viewTransition` option to a router update, but you do not appear to be running in a DOM environment as `window.startViewTransition` is not available."
      );
      if (!viewTransitionOpts || !isViewTransitionAvailable) {
        if (reactDomFlushSyncImpl && flushSync) {
          reactDomFlushSyncImpl(() => logErrorsAndSetState(newState));
        } else {
          React.startTransition(() => logErrorsAndSetState(newState));
        }
        return;
      }
      if (reactDomFlushSyncImpl && flushSync) {
        reactDomFlushSyncImpl(() => {
          if (transition) {
            renderDfd && renderDfd.resolve();
            transition.skipTransition();
          }
          setVtContext({
            isTransitioning: true,
            flushSync: true,
            currentLocation: viewTransitionOpts.currentLocation,
            nextLocation: viewTransitionOpts.nextLocation
          });
        });
        let t = router.window.document.startViewTransition(() => {
          reactDomFlushSyncImpl(() => logErrorsAndSetState(newState));
        });
        t.finished.finally(() => {
          reactDomFlushSyncImpl(() => {
            setRenderDfd(void 0);
            setTransition(void 0);
            setPendingState(void 0);
            setVtContext({ isTransitioning: false });
          });
        });
        reactDomFlushSyncImpl(() => setTransition(t));
        return;
      }
      if (transition) {
        renderDfd && renderDfd.resolve();
        transition.skipTransition();
        setInterruption({
          state: newState,
          currentLocation: viewTransitionOpts.currentLocation,
          nextLocation: viewTransitionOpts.nextLocation
        });
      } else {
        setPendingState(newState);
        setVtContext({
          isTransitioning: true,
          flushSync: false,
          currentLocation: viewTransitionOpts.currentLocation,
          nextLocation: viewTransitionOpts.nextLocation
        });
      }
    },
    [
      router.window,
      reactDomFlushSyncImpl,
      transition,
      renderDfd,
      logErrorsAndSetState
    ]
  );
  React.useLayoutEffect(() => router.subscribe(setState), [router, setState]);
  React.useEffect(() => {
    if (vtContext.isTransitioning && !vtContext.flushSync) {
      setRenderDfd(new Deferred());
    }
  }, [vtContext]);
  React.useEffect(() => {
    if (renderDfd && pendingState && router.window) {
      let newState = pendingState;
      let renderPromise = renderDfd.promise;
      let transition2 = router.window.document.startViewTransition(async () => {
        React.startTransition(() => logErrorsAndSetState(newState));
        await renderPromise;
      });
      transition2.finished.finally(() => {
        setRenderDfd(void 0);
        setTransition(void 0);
        setPendingState(void 0);
        setVtContext({ isTransitioning: false });
      });
      setTransition(transition2);
    }
  }, [pendingState, renderDfd, router.window, logErrorsAndSetState]);
  React.useEffect(() => {
    if (renderDfd && pendingState && state.location.key === pendingState.location.key) {
      renderDfd.resolve();
    }
  }, [renderDfd, transition, state.location, pendingState]);
  React.useEffect(() => {
    if (!vtContext.isTransitioning && interruption) {
      setPendingState(interruption.state);
      setVtContext({
        isTransitioning: true,
        flushSync: false,
        currentLocation: interruption.currentLocation,
        nextLocation: interruption.nextLocation
      });
      setInterruption(void 0);
    }
  }, [vtContext.isTransitioning, interruption]);
  let navigator = React.useMemo(() => {
    return {
      createHref: router.createHref,
      encodeLocation: router.encodeLocation,
      go: (n) => router.navigate(n),
      push: (to, state2, opts) => router.navigate(to, {
        state: state2,
        preventScrollReset: _optionalChain([opts, 'optionalAccess', _14 => _14.preventScrollReset])
      }),
      replace: (to, state2, opts) => router.navigate(to, {
        replace: true,
        state: state2,
        preventScrollReset: _optionalChain([opts, 'optionalAccess', _15 => _15.preventScrollReset])
      })
    };
  }, [router]);
  let basename = router.basename || "/";
  let dataRouterContext = React.useMemo(
    () => ({
      router,
      navigator,
      static: false,
      basename,
      unstable_onError
    }),
    [router, navigator, basename, unstable_onError]
  );
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(_chunkDI2QHYMJjs.DataRouterContext.Provider, { value: dataRouterContext }, /* @__PURE__ */ React.createElement(_chunkDI2QHYMJjs.DataRouterStateContext.Provider, { value: state }, /* @__PURE__ */ React.createElement(_chunkDI2QHYMJjs.FetchersContext.Provider, { value: fetcherData.current }, /* @__PURE__ */ React.createElement(_chunkDI2QHYMJjs.ViewTransitionContext.Provider, { value: vtContext }, /* @__PURE__ */ React.createElement(
    Router,
    {
      basename,
      location: state.location,
      navigationType: state.historyAction,
      navigator
    },
    /* @__PURE__ */ React.createElement(
      MemoizedDataRoutes,
      {
        routes: router.routes,
        future: router.future,
        state,
        unstable_onError
      }
    )
  ))))), null);
}
var MemoizedDataRoutes = React.memo(DataRoutes);
function DataRoutes({
  routes,
  future,
  state,
  unstable_onError
}) {
  return _chunkDI2QHYMJjs.useRoutesImpl.call(void 0, routes, void 0, state, unstable_onError, future);
}
function MemoryRouter({
  basename,
  children,
  initialEntries,
  initialIndex
}) {
  let historyRef = React.useRef();
  if (historyRef.current == null) {
    historyRef.current = _chunkDI2QHYMJjs.createMemoryHistory.call(void 0, {
      initialEntries,
      initialIndex,
      v5Compat: true
    });
  }
  let history = historyRef.current;
  let [state, setStateImpl] = React.useState({
    action: history.action,
    location: history.location
  });
  let setState = React.useCallback(
    (newState) => {
      React.startTransition(() => setStateImpl(newState));
    },
    [setStateImpl]
  );
  React.useLayoutEffect(() => history.listen(setState), [history, setState]);
  return /* @__PURE__ */ React.createElement(
    Router,
    {
      basename,
      children,
      location: state.location,
      navigationType: state.action,
      navigator: history
    }
  );
}
function Navigate({
  to,
  replace,
  state,
  relative
}) {
  _chunkDI2QHYMJjs.invariant.call(void 0, 
    _chunkDI2QHYMJjs.useInRouterContext.call(void 0, ),
    // TODO: This error is probably because they somehow have 2 versions of
    // the router loaded. We can help them understand how to avoid that.
    `<Navigate> may be used only in the context of a <Router> component.`
  );
  let { static: isStatic } = React.useContext(_chunkDI2QHYMJjs.NavigationContext);
  _chunkDI2QHYMJjs.warning.call(void 0, 
    !isStatic,
    `<Navigate> must not be used on the initial render in a <StaticRouter>. This is a no-op, but you should modify your code so the <Navigate> is only ever rendered in response to some user interaction or state change.`
  );
  let { matches } = React.useContext(_chunkDI2QHYMJjs.RouteContext);
  let { pathname: locationPathname } = _chunkDI2QHYMJjs.useLocation.call(void 0, );
  let navigate = _chunkDI2QHYMJjs.useNavigate.call(void 0, );
  let path = _chunkDI2QHYMJjs.resolveTo.call(void 0, 
    to,
    _chunkDI2QHYMJjs.getResolveToMatches.call(void 0, matches),
    locationPathname,
    relative === "path"
  );
  let jsonPath = JSON.stringify(path);
  React.useEffect(() => {
    navigate(JSON.parse(jsonPath), { replace, state, relative });
  }, [navigate, jsonPath, relative, replace, state]);
  return null;
}
function Outlet(props) {
  return _chunkDI2QHYMJjs.useOutlet.call(void 0, props.context);
}
function Route(props) {
  _chunkDI2QHYMJjs.invariant.call(void 0, 
    false,
    `A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your <Route> in a <Routes>.`
  );
}
function Router({
  basename: basenameProp = "/",
  children = null,
  location: locationProp,
  navigationType = "POP" /* Pop */,
  navigator,
  static: staticProp = false
}) {
  _chunkDI2QHYMJjs.invariant.call(void 0, 
    !_chunkDI2QHYMJjs.useInRouterContext.call(void 0, ),
    `You cannot render a <Router> inside another <Router>. You should never have more than one in your app.`
  );
  let basename = basenameProp.replace(/^\/*/, "/");
  let navigationContext = React.useMemo(
    () => ({
      basename,
      navigator,
      static: staticProp,
      future: {}
    }),
    [basename, navigator, staticProp]
  );
  if (typeof locationProp === "string") {
    locationProp = _chunkDI2QHYMJjs.parsePath.call(void 0, locationProp);
  }
  let {
    pathname = "/",
    search = "",
    hash = "",
    state = null,
    key = "default"
  } = locationProp;
  let locationContext = React.useMemo(() => {
    let trailingPathname = _chunkDI2QHYMJjs.stripBasename.call(void 0, pathname, basename);
    if (trailingPathname == null) {
      return null;
    }
    return {
      location: {
        pathname: trailingPathname,
        search,
        hash,
        state,
        key
      },
      navigationType
    };
  }, [basename, pathname, search, hash, state, key, navigationType]);
  _chunkDI2QHYMJjs.warning.call(void 0, 
    locationContext != null,
    `<Router basename="${basename}"> is not able to match the URL "${pathname}${search}${hash}" because it does not start with the basename, so the <Router> won't render anything.`
  );
  if (locationContext == null) {
    return null;
  }
  return /* @__PURE__ */ React.createElement(_chunkDI2QHYMJjs.NavigationContext.Provider, { value: navigationContext }, /* @__PURE__ */ React.createElement(_chunkDI2QHYMJjs.LocationContext.Provider, { children, value: locationContext }));
}
function Routes({
  children,
  location
}) {
  return _chunkDI2QHYMJjs.useRoutes.call(void 0, createRoutesFromChildren(children), location);
}
function Await({
  children,
  errorElement,
  resolve
}) {
  let dataRouterContext = React.useContext(_chunkDI2QHYMJjs.DataRouterContext);
  return /* @__PURE__ */ React.createElement(
    AwaitErrorBoundary,
    {
      resolve,
      errorElement,
      unstable_onError: _optionalChain([dataRouterContext, 'optionalAccess', _16 => _16.unstable_onError])
    },
    /* @__PURE__ */ React.createElement(ResolveAwait, null, children)
  );
}
var AwaitErrorBoundary = class extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, errorInfo) {
    if (this.props.unstable_onError) {
      this.props.unstable_onError(error, errorInfo);
    } else {
      console.error(
        "<Await> caught the following error during render",
        error,
        errorInfo
      );
    }
  }
  render() {
    let { children, errorElement, resolve } = this.props;
    let promise = null;
    let status = 0 /* pending */;
    if (!(resolve instanceof Promise)) {
      status = 1 /* success */;
      promise = Promise.resolve();
      Object.defineProperty(promise, "_tracked", { get: () => true });
      Object.defineProperty(promise, "_data", { get: () => resolve });
    } else if (this.state.error) {
      status = 2 /* error */;
      let renderError = this.state.error;
      promise = Promise.reject().catch(() => {
      });
      Object.defineProperty(promise, "_tracked", { get: () => true });
      Object.defineProperty(promise, "_error", { get: () => renderError });
    } else if (resolve._tracked) {
      promise = resolve;
      status = "_error" in promise ? 2 /* error */ : "_data" in promise ? 1 /* success */ : 0 /* pending */;
    } else {
      status = 0 /* pending */;
      Object.defineProperty(resolve, "_tracked", { get: () => true });
      promise = resolve.then(
        (data) => Object.defineProperty(resolve, "_data", { get: () => data }),
        (error) => {
          _optionalChain([this, 'access', _17 => _17.props, 'access', _18 => _18.unstable_onError, 'optionalCall', _19 => _19(error)]);
          Object.defineProperty(resolve, "_error", { get: () => error });
        }
      );
    }
    if (status === 2 /* error */ && !errorElement) {
      throw promise._error;
    }
    if (status === 2 /* error */) {
      return /* @__PURE__ */ React.createElement(_chunkDI2QHYMJjs.AwaitContext.Provider, { value: promise, children: errorElement });
    }
    if (status === 1 /* success */) {
      return /* @__PURE__ */ React.createElement(_chunkDI2QHYMJjs.AwaitContext.Provider, { value: promise, children });
    }
    throw promise;
  }
};
function ResolveAwait({
  children
}) {
  let data = _chunkDI2QHYMJjs.useAsyncValue.call(void 0, );
  let toRender = typeof children === "function" ? children(data) : children;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, toRender);
}
function createRoutesFromChildren(children, parentPath = []) {
  let routes = [];
  React.Children.forEach(children, (element, index) => {
    if (!React.isValidElement(element)) {
      return;
    }
    let treePath = [...parentPath, index];
    if (element.type === React.Fragment) {
      routes.push.apply(
        routes,
        createRoutesFromChildren(element.props.children, treePath)
      );
      return;
    }
    _chunkDI2QHYMJjs.invariant.call(void 0, 
      element.type === Route,
      `[${typeof element.type === "string" ? element.type : element.type.name}] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>`
    );
    _chunkDI2QHYMJjs.invariant.call(void 0, 
      !element.props.index || !element.props.children,
      "An index route cannot have child routes."
    );
    let route = {
      id: element.props.id || treePath.join("-"),
      caseSensitive: element.props.caseSensitive,
      element: element.props.element,
      Component: element.props.Component,
      index: element.props.index,
      path: element.props.path,
      middleware: element.props.middleware,
      loader: element.props.loader,
      action: element.props.action,
      hydrateFallbackElement: element.props.hydrateFallbackElement,
      HydrateFallback: element.props.HydrateFallback,
      errorElement: element.props.errorElement,
      ErrorBoundary: element.props.ErrorBoundary,
      hasErrorBoundary: element.props.hasErrorBoundary === true || element.props.ErrorBoundary != null || element.props.errorElement != null,
      shouldRevalidate: element.props.shouldRevalidate,
      handle: element.props.handle,
      lazy: element.props.lazy
    };
    if (element.props.children) {
      route.children = createRoutesFromChildren(
        element.props.children,
        treePath
      );
    }
    routes.push(route);
  });
  return routes;
}
var createRoutesFromElements = createRoutesFromChildren;
function renderMatches(matches) {
  return _chunkDI2QHYMJjs._renderMatches.call(void 0, matches);
}
function useRouteComponentProps() {
  return {
    params: _chunkDI2QHYMJjs.useParams.call(void 0, ),
    loaderData: _chunkDI2QHYMJjs.useLoaderData.call(void 0, ),
    actionData: _chunkDI2QHYMJjs.useActionData.call(void 0, ),
    matches: _chunkDI2QHYMJjs.useMatches.call(void 0, )
  };
}
function WithComponentProps({
  children
}) {
  const props = useRouteComponentProps();
  return React.cloneElement(children, props);
}
function withComponentProps(Component2) {
  return function WithComponentProps2() {
    const props = useRouteComponentProps();
    return React.createElement(Component2, props);
  };
}
function useHydrateFallbackProps() {
  return {
    params: _chunkDI2QHYMJjs.useParams.call(void 0, ),
    loaderData: _chunkDI2QHYMJjs.useLoaderData.call(void 0, ),
    actionData: _chunkDI2QHYMJjs.useActionData.call(void 0, )
  };
}
function WithHydrateFallbackProps({
  children
}) {
  const props = useHydrateFallbackProps();
  return React.cloneElement(children, props);
}
function withHydrateFallbackProps(HydrateFallback) {
  return function WithHydrateFallbackProps2() {
    const props = useHydrateFallbackProps();
    return React.createElement(HydrateFallback, props);
  };
}
function useErrorBoundaryProps() {
  return {
    params: _chunkDI2QHYMJjs.useParams.call(void 0, ),
    loaderData: _chunkDI2QHYMJjs.useLoaderData.call(void 0, ),
    actionData: _chunkDI2QHYMJjs.useActionData.call(void 0, ),
    error: _chunkDI2QHYMJjs.useRouteError.call(void 0, )
  };
}
function WithErrorBoundaryProps({
  children
}) {
  const props = useErrorBoundaryProps();
  return React.cloneElement(children, props);
}
function withErrorBoundaryProps(ErrorBoundary) {
  return function WithErrorBoundaryProps2() {
    const props = useErrorBoundaryProps();
    return React.createElement(ErrorBoundary, props);
  };
}

// lib/dom/dom.ts
var defaultMethod = "get";
var defaultEncType = "application/x-www-form-urlencoded";
function isHtmlElement(object) {
  return object != null && typeof object.tagName === "string";
}
function isButtonElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "button";
}
function isFormElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "form";
}
function isInputElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "input";
}
function isModifiedEvent(event) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}
function shouldProcessLinkClick(event, target) {
  return event.button === 0 && // Ignore everything but left clicks
  (!target || target === "_self") && // Let browser handle "target=_blank" etc.
  !isModifiedEvent(event);
}
function createSearchParams(init = "") {
  return new URLSearchParams(
    typeof init === "string" || Array.isArray(init) || init instanceof URLSearchParams ? init : Object.keys(init).reduce((memo2, key) => {
      let value = init[key];
      return memo2.concat(
        Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]]
      );
    }, [])
  );
}
function getSearchParamsForLocation(locationSearch, defaultSearchParams) {
  let searchParams = createSearchParams(locationSearch);
  if (defaultSearchParams) {
    defaultSearchParams.forEach((_, key) => {
      if (!searchParams.has(key)) {
        defaultSearchParams.getAll(key).forEach((value) => {
          searchParams.append(key, value);
        });
      }
    });
  }
  return searchParams;
}
var _formDataSupportsSubmitter = null;
function isFormDataSubmitterSupported() {
  if (_formDataSupportsSubmitter === null) {
    try {
      new FormData(
        document.createElement("form"),
        // @ts-expect-error if FormData supports the submitter parameter, this will throw
        0
      );
      _formDataSupportsSubmitter = false;
    } catch (e) {
      _formDataSupportsSubmitter = true;
    }
  }
  return _formDataSupportsSubmitter;
}
var supportedFormEncTypes = /* @__PURE__ */ new Set([
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain"
]);
function getFormEncType(encType) {
  if (encType != null && !supportedFormEncTypes.has(encType)) {
    _chunkDI2QHYMJjs.warning.call(void 0, 
      false,
      `"${encType}" is not a valid \`encType\` for \`<Form>\`/\`<fetcher.Form>\` and will default to "${defaultEncType}"`
    );
    return null;
  }
  return encType;
}
function getFormSubmissionInfo(target, basename) {
  let method;
  let action;
  let encType;
  let formData;
  let body;
  if (isFormElement(target)) {
    let attr = target.getAttribute("action");
    action = attr ? _chunkDI2QHYMJjs.stripBasename.call(void 0, attr, basename) : null;
    method = target.getAttribute("method") || defaultMethod;
    encType = getFormEncType(target.getAttribute("enctype")) || defaultEncType;
    formData = new FormData(target);
  } else if (isButtonElement(target) || isInputElement(target) && (target.type === "submit" || target.type === "image")) {
    let form = target.form;
    if (form == null) {
      throw new Error(
        `Cannot submit a <button> or <input type="submit"> without a <form>`
      );
    }
    let attr = target.getAttribute("formaction") || form.getAttribute("action");
    action = attr ? _chunkDI2QHYMJjs.stripBasename.call(void 0, attr, basename) : null;
    method = target.getAttribute("formmethod") || form.getAttribute("method") || defaultMethod;
    encType = getFormEncType(target.getAttribute("formenctype")) || getFormEncType(form.getAttribute("enctype")) || defaultEncType;
    formData = new FormData(form, target);
    if (!isFormDataSubmitterSupported()) {
      let { name, type, value } = target;
      if (type === "image") {
        let prefix = name ? `${name}.` : "";
        formData.append(`${prefix}x`, "0");
        formData.append(`${prefix}y`, "0");
      } else if (name) {
        formData.append(name, value);
      }
    }
  } else if (isHtmlElement(target)) {
    throw new Error(
      `Cannot submit element that is not <form>, <button>, or <input type="submit|image">`
    );
  } else {
    method = defaultMethod;
    action = null;
    encType = defaultEncType;
    body = target;
  }
  if (formData && encType === "text/plain") {
    body = formData;
    formData = void 0;
  }
  return { action, method: method.toLowerCase(), encType, formData, body };
}

// lib/dom/lib.tsx

var isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined";
try {
  if (isBrowser) {
    window.__reactRouterVersion = // @ts-expect-error
    "7.9.4";
  }
} catch (e) {
}
function createBrowserRouter(routes, opts) {
  return _chunkDI2QHYMJjs.createRouter.call(void 0, {
    basename: _optionalChain([opts, 'optionalAccess', _20 => _20.basename]),
    getContext: _optionalChain([opts, 'optionalAccess', _21 => _21.getContext]),
    future: _optionalChain([opts, 'optionalAccess', _22 => _22.future]),
    history: _chunkDI2QHYMJjs.createBrowserHistory.call(void 0, { window: _optionalChain([opts, 'optionalAccess', _23 => _23.window]) }),
    hydrationData: _optionalChain([opts, 'optionalAccess', _24 => _24.hydrationData]) || parseHydrationData(),
    routes,
    mapRouteProperties,
    hydrationRouteProperties,
    dataStrategy: _optionalChain([opts, 'optionalAccess', _25 => _25.dataStrategy]),
    patchRoutesOnNavigation: _optionalChain([opts, 'optionalAccess', _26 => _26.patchRoutesOnNavigation]),
    window: _optionalChain([opts, 'optionalAccess', _27 => _27.window])
  }).initialize();
}
function createHashRouter(routes, opts) {
  return _chunkDI2QHYMJjs.createRouter.call(void 0, {
    basename: _optionalChain([opts, 'optionalAccess', _28 => _28.basename]),
    getContext: _optionalChain([opts, 'optionalAccess', _29 => _29.getContext]),
    future: _optionalChain([opts, 'optionalAccess', _30 => _30.future]),
    history: _chunkDI2QHYMJjs.createHashHistory.call(void 0, { window: _optionalChain([opts, 'optionalAccess', _31 => _31.window]) }),
    hydrationData: _optionalChain([opts, 'optionalAccess', _32 => _32.hydrationData]) || parseHydrationData(),
    routes,
    mapRouteProperties,
    hydrationRouteProperties,
    dataStrategy: _optionalChain([opts, 'optionalAccess', _33 => _33.dataStrategy]),
    patchRoutesOnNavigation: _optionalChain([opts, 'optionalAccess', _34 => _34.patchRoutesOnNavigation]),
    window: _optionalChain([opts, 'optionalAccess', _35 => _35.window])
  }).initialize();
}
function parseHydrationData() {
  let state = _optionalChain([window, 'optionalAccess', _36 => _36.__staticRouterHydrationData]);
  if (state && state.errors) {
    state = {
      ...state,
      errors: deserializeErrors(state.errors)
    };
  }
  return state;
}
function deserializeErrors(errors) {
  if (!errors) return null;
  let entries = Object.entries(errors);
  let serialized = {};
  for (let [key, val] of entries) {
    if (val && val.__type === "RouteErrorResponse") {
      serialized[key] = new (0, _chunkDI2QHYMJjs.ErrorResponseImpl)(
        val.status,
        val.statusText,
        val.data,
        val.internal === true
      );
    } else if (val && val.__type === "Error") {
      if (val.__subType) {
        let ErrorConstructor = window[val.__subType];
        if (typeof ErrorConstructor === "function") {
          try {
            let error = new ErrorConstructor(val.message);
            error.stack = "";
            serialized[key] = error;
          } catch (e) {
          }
        }
      }
      if (serialized[key] == null) {
        let error = new Error(val.message);
        error.stack = "";
        serialized[key] = error;
      }
    } else {
      serialized[key] = val;
    }
  }
  return serialized;
}
function BrowserRouter({
  basename,
  children,
  window: window2
}) {
  let historyRef = React2.useRef();
  if (historyRef.current == null) {
    historyRef.current = _chunkDI2QHYMJjs.createBrowserHistory.call(void 0, { window: window2, v5Compat: true });
  }
  let history = historyRef.current;
  let [state, setStateImpl] = React2.useState({
    action: history.action,
    location: history.location
  });
  let setState = React2.useCallback(
    (newState) => {
      React2.startTransition(() => setStateImpl(newState));
    },
    [setStateImpl]
  );
  React2.useLayoutEffect(() => history.listen(setState), [history, setState]);
  return /* @__PURE__ */ React2.createElement(
    Router,
    {
      basename,
      children,
      location: state.location,
      navigationType: state.action,
      navigator: history
    }
  );
}
function HashRouter({ basename, children, window: window2 }) {
  let historyRef = React2.useRef();
  if (historyRef.current == null) {
    historyRef.current = _chunkDI2QHYMJjs.createHashHistory.call(void 0, { window: window2, v5Compat: true });
  }
  let history = historyRef.current;
  let [state, setStateImpl] = React2.useState({
    action: history.action,
    location: history.location
  });
  let setState = React2.useCallback(
    (newState) => {
      React2.startTransition(() => setStateImpl(newState));
    },
    [setStateImpl]
  );
  React2.useLayoutEffect(() => history.listen(setState), [history, setState]);
  return /* @__PURE__ */ React2.createElement(
    Router,
    {
      basename,
      children,
      location: state.location,
      navigationType: state.action,
      navigator: history
    }
  );
}
function HistoryRouter({
  basename,
  children,
  history
}) {
  let [state, setStateImpl] = React2.useState({
    action: history.action,
    location: history.location
  });
  let setState = React2.useCallback(
    (newState) => {
      React2.startTransition(() => setStateImpl(newState));
    },
    [setStateImpl]
  );
  React2.useLayoutEffect(() => history.listen(setState), [history, setState]);
  return /* @__PURE__ */ React2.createElement(
    Router,
    {
      basename,
      children,
      location: state.location,
      navigationType: state.action,
      navigator: history
    }
  );
}
HistoryRouter.displayName = "unstable_HistoryRouter";
var ABSOLUTE_URL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
var Link = React2.forwardRef(
  function LinkWithRef({
    onClick,
    discover = "render",
    prefetch = "none",
    relative,
    reloadDocument,
    replace,
    state,
    target,
    to,
    preventScrollReset,
    viewTransition,
    ...rest
  }, forwardedRef) {
    let { basename } = React2.useContext(_chunkDI2QHYMJjs.NavigationContext);
    let isAbsolute = typeof to === "string" && ABSOLUTE_URL_REGEX.test(to);
    let absoluteHref;
    let isExternal = false;
    if (typeof to === "string" && isAbsolute) {
      absoluteHref = to;
      if (isBrowser) {
        try {
          let currentUrl = new URL(window.location.href);
          let targetUrl = to.startsWith("//") ? new URL(currentUrl.protocol + to) : new URL(to);
          let path = _chunkDI2QHYMJjs.stripBasename.call(void 0, targetUrl.pathname, basename);
          if (targetUrl.origin === currentUrl.origin && path != null) {
            to = path + targetUrl.search + targetUrl.hash;
          } else {
            isExternal = true;
          }
        } catch (e) {
          _chunkDI2QHYMJjs.warning.call(void 0, 
            false,
            `<Link to="${to}"> contains an invalid URL which will probably break when clicked - please update to a valid URL path.`
          );
        }
      }
    }
    let href = _chunkDI2QHYMJjs.useHref.call(void 0, to, { relative });
    let [shouldPrefetch, prefetchRef, prefetchHandlers] = _chunkDI2QHYMJjs.usePrefetchBehavior.call(void 0, 
      prefetch,
      rest
    );
    let internalOnClick = useLinkClickHandler(to, {
      replace,
      state,
      target,
      preventScrollReset,
      relative,
      viewTransition
    });
    function handleClick(event) {
      if (onClick) onClick(event);
      if (!event.defaultPrevented) {
        internalOnClick(event);
      }
    }
    let link = (
      // eslint-disable-next-line jsx-a11y/anchor-has-content
      /* @__PURE__ */ React2.createElement(
        "a",
        {
          ...rest,
          ...prefetchHandlers,
          href: absoluteHref || href,
          onClick: isExternal || reloadDocument ? onClick : handleClick,
          ref: _chunkDI2QHYMJjs.mergeRefs.call(void 0, forwardedRef, prefetchRef),
          target,
          "data-discover": !isAbsolute && discover === "render" ? "true" : void 0
        }
      )
    );
    return shouldPrefetch && !isAbsolute ? /* @__PURE__ */ React2.createElement(React2.Fragment, null, link, /* @__PURE__ */ React2.createElement(_chunkDI2QHYMJjs.PrefetchPageLinks, { page: href })) : link;
  }
);
Link.displayName = "Link";
var NavLink = React2.forwardRef(
  function NavLinkWithRef({
    "aria-current": ariaCurrentProp = "page",
    caseSensitive = false,
    className: classNameProp = "",
    end = false,
    style: styleProp,
    to,
    viewTransition,
    children,
    ...rest
  }, ref) {
    let path = _chunkDI2QHYMJjs.useResolvedPath.call(void 0, to, { relative: rest.relative });
    let location = _chunkDI2QHYMJjs.useLocation.call(void 0, );
    let routerState = React2.useContext(_chunkDI2QHYMJjs.DataRouterStateContext);
    let { navigator, basename } = React2.useContext(_chunkDI2QHYMJjs.NavigationContext);
    let isTransitioning = routerState != null && // Conditional usage is OK here because the usage of a data router is static
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useViewTransitionState(path) && viewTransition === true;
    let toPathname = navigator.encodeLocation ? navigator.encodeLocation(path).pathname : path.pathname;
    let locationPathname = location.pathname;
    let nextLocationPathname = routerState && routerState.navigation && routerState.navigation.location ? routerState.navigation.location.pathname : null;
    if (!caseSensitive) {
      locationPathname = locationPathname.toLowerCase();
      nextLocationPathname = nextLocationPathname ? nextLocationPathname.toLowerCase() : null;
      toPathname = toPathname.toLowerCase();
    }
    if (nextLocationPathname && basename) {
      nextLocationPathname = _chunkDI2QHYMJjs.stripBasename.call(void 0, nextLocationPathname, basename) || nextLocationPathname;
    }
    const endSlashPosition = toPathname !== "/" && toPathname.endsWith("/") ? toPathname.length - 1 : toPathname.length;
    let isActive = locationPathname === toPathname || !end && locationPathname.startsWith(toPathname) && locationPathname.charAt(endSlashPosition) === "/";
    let isPending = nextLocationPathname != null && (nextLocationPathname === toPathname || !end && nextLocationPathname.startsWith(toPathname) && nextLocationPathname.charAt(toPathname.length) === "/");
    let renderProps = {
      isActive,
      isPending,
      isTransitioning
    };
    let ariaCurrent = isActive ? ariaCurrentProp : void 0;
    let className;
    if (typeof classNameProp === "function") {
      className = classNameProp(renderProps);
    } else {
      className = [
        classNameProp,
        isActive ? "active" : null,
        isPending ? "pending" : null,
        isTransitioning ? "transitioning" : null
      ].filter(Boolean).join(" ");
    }
    let style = typeof styleProp === "function" ? styleProp(renderProps) : styleProp;
    return /* @__PURE__ */ React2.createElement(
      Link,
      {
        ...rest,
        "aria-current": ariaCurrent,
        className,
        ref,
        style,
        to,
        viewTransition
      },
      typeof children === "function" ? children(renderProps) : children
    );
  }
);
NavLink.displayName = "NavLink";
var Form = React2.forwardRef(
  ({
    discover = "render",
    fetcherKey,
    navigate,
    reloadDocument,
    replace,
    state,
    method = defaultMethod,
    action,
    onSubmit,
    relative,
    preventScrollReset,
    viewTransition,
    ...props
  }, forwardedRef) => {
    let submit = useSubmit();
    let formAction = useFormAction(action, { relative });
    let formMethod = method.toLowerCase() === "get" ? "get" : "post";
    let isAbsolute = typeof action === "string" && ABSOLUTE_URL_REGEX.test(action);
    let submitHandler = (event) => {
      onSubmit && onSubmit(event);
      if (event.defaultPrevented) return;
      event.preventDefault();
      let submitter = event.nativeEvent.submitter;
      let submitMethod = _optionalChain([submitter, 'optionalAccess', _37 => _37.getAttribute, 'call', _38 => _38("formmethod")]) || method;
      submit(submitter || event.currentTarget, {
        fetcherKey,
        method: submitMethod,
        navigate,
        replace,
        state,
        relative,
        preventScrollReset,
        viewTransition
      });
    };
    return /* @__PURE__ */ React2.createElement(
      "form",
      {
        ref: forwardedRef,
        method: formMethod,
        action: formAction,
        onSubmit: reloadDocument ? onSubmit : submitHandler,
        ...props,
        "data-discover": !isAbsolute && discover === "render" ? "true" : void 0
      }
    );
  }
);
Form.displayName = "Form";
function ScrollRestoration({
  getKey,
  storageKey,
  ...props
}) {
  let remixContext = React2.useContext(_chunkDI2QHYMJjs.FrameworkContext);
  let { basename } = React2.useContext(_chunkDI2QHYMJjs.NavigationContext);
  let location = _chunkDI2QHYMJjs.useLocation.call(void 0, );
  let matches = _chunkDI2QHYMJjs.useMatches.call(void 0, );
  useScrollRestoration({ getKey, storageKey });
  let ssrKey = React2.useMemo(
    () => {
      if (!remixContext || !getKey) return null;
      let userKey = getScrollRestorationKey(
        location,
        matches,
        basename,
        getKey
      );
      return userKey !== location.key ? userKey : null;
    },
    // Nah, we only need this the first time for the SSR render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  if (!remixContext || remixContext.isSpaMode) {
    return null;
  }
  let restoreScroll = ((storageKey2, restoreKey) => {
    if (!window.history.state || !window.history.state.key) {
      let key = Math.random().toString(32).slice(2);
      window.history.replaceState({ key }, "");
    }
    try {
      let positions = JSON.parse(sessionStorage.getItem(storageKey2) || "{}");
      let storedY = positions[restoreKey || window.history.state.key];
      if (typeof storedY === "number") {
        window.scrollTo(0, storedY);
      }
    } catch (error) {
      console.error(error);
      sessionStorage.removeItem(storageKey2);
    }
  }).toString();
  return /* @__PURE__ */ React2.createElement(
    "script",
    {
      ...props,
      suppressHydrationWarning: true,
      dangerouslySetInnerHTML: {
        __html: `(${restoreScroll})(${JSON.stringify(
          storageKey || SCROLL_RESTORATION_STORAGE_KEY
        )}, ${JSON.stringify(ssrKey)})`
      }
    }
  );
}
ScrollRestoration.displayName = "ScrollRestoration";
function getDataRouterConsoleError(hookName) {
  return `${hookName} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`;
}
function useDataRouterContext(hookName) {
  let ctx = React2.useContext(_chunkDI2QHYMJjs.DataRouterContext);
  _chunkDI2QHYMJjs.invariant.call(void 0, ctx, getDataRouterConsoleError(hookName));
  return ctx;
}
function useDataRouterState(hookName) {
  let state = React2.useContext(_chunkDI2QHYMJjs.DataRouterStateContext);
  _chunkDI2QHYMJjs.invariant.call(void 0, state, getDataRouterConsoleError(hookName));
  return state;
}
function useLinkClickHandler(to, {
  target,
  replace: replaceProp,
  state,
  preventScrollReset,
  relative,
  viewTransition
} = {}) {
  let navigate = _chunkDI2QHYMJjs.useNavigate.call(void 0, );
  let location = _chunkDI2QHYMJjs.useLocation.call(void 0, );
  let path = _chunkDI2QHYMJjs.useResolvedPath.call(void 0, to, { relative });
  return React2.useCallback(
    (event) => {
      if (shouldProcessLinkClick(event, target)) {
        event.preventDefault();
        let replace = replaceProp !== void 0 ? replaceProp : _chunkDI2QHYMJjs.createPath.call(void 0, location) === _chunkDI2QHYMJjs.createPath.call(void 0, path);
        navigate(to, {
          replace,
          state,
          preventScrollReset,
          relative,
          viewTransition
        });
      }
    },
    [
      location,
      navigate,
      path,
      replaceProp,
      state,
      target,
      to,
      preventScrollReset,
      relative,
      viewTransition
    ]
  );
}
function useSearchParams(defaultInit) {
  _chunkDI2QHYMJjs.warning.call(void 0, 
    typeof URLSearchParams !== "undefined",
    `You cannot use the \`useSearchParams\` hook in a browser that does not support the URLSearchParams API. If you need to support Internet Explorer 11, we recommend you load a polyfill such as https://github.com/ungap/url-search-params.`
  );
  let defaultSearchParamsRef = React2.useRef(createSearchParams(defaultInit));
  let hasSetSearchParamsRef = React2.useRef(false);
  let location = _chunkDI2QHYMJjs.useLocation.call(void 0, );
  let searchParams = React2.useMemo(
    () => (
      // Only merge in the defaults if we haven't yet called setSearchParams.
      // Once we call that we want those to take precedence, otherwise you can't
      // remove a param with setSearchParams({}) if it has an initial value
      getSearchParamsForLocation(
        location.search,
        hasSetSearchParamsRef.current ? null : defaultSearchParamsRef.current
      )
    ),
    [location.search]
  );
  let navigate = _chunkDI2QHYMJjs.useNavigate.call(void 0, );
  let setSearchParams = React2.useCallback(
    (nextInit, navigateOptions) => {
      const newSearchParams = createSearchParams(
        typeof nextInit === "function" ? nextInit(new URLSearchParams(searchParams)) : nextInit
      );
      hasSetSearchParamsRef.current = true;
      navigate("?" + newSearchParams, navigateOptions);
    },
    [navigate, searchParams]
  );
  return [searchParams, setSearchParams];
}
var fetcherId = 0;
var getUniqueFetcherId = () => `__${String(++fetcherId)}__`;
function useSubmit() {
  let { router } = useDataRouterContext("useSubmit" /* UseSubmit */);
  let { basename } = React2.useContext(_chunkDI2QHYMJjs.NavigationContext);
  let currentRouteId = _chunkDI2QHYMJjs.useRouteId.call(void 0, );
  return React2.useCallback(
    async (target, options = {}) => {
      let { action, method, encType, formData, body } = getFormSubmissionInfo(
        target,
        basename
      );
      if (options.navigate === false) {
        let key = options.fetcherKey || getUniqueFetcherId();
        await router.fetch(key, currentRouteId, options.action || action, {
          preventScrollReset: options.preventScrollReset,
          formData,
          body,
          formMethod: options.method || method,
          formEncType: options.encType || encType,
          flushSync: options.flushSync
        });
      } else {
        await router.navigate(options.action || action, {
          preventScrollReset: options.preventScrollReset,
          formData,
          body,
          formMethod: options.method || method,
          formEncType: options.encType || encType,
          replace: options.replace,
          state: options.state,
          fromRouteId: currentRouteId,
          flushSync: options.flushSync,
          viewTransition: options.viewTransition
        });
      }
    },
    [router, basename, currentRouteId]
  );
}
function useFormAction(action, { relative } = {}) {
  let { basename } = React2.useContext(_chunkDI2QHYMJjs.NavigationContext);
  let routeContext = React2.useContext(_chunkDI2QHYMJjs.RouteContext);
  _chunkDI2QHYMJjs.invariant.call(void 0, routeContext, "useFormAction must be used inside a RouteContext");
  let [match] = routeContext.matches.slice(-1);
  let path = { ..._chunkDI2QHYMJjs.useResolvedPath.call(void 0, action ? action : ".", { relative }) };
  let location = _chunkDI2QHYMJjs.useLocation.call(void 0, );
  if (action == null) {
    path.search = location.search;
    let params = new URLSearchParams(path.search);
    let indexValues = params.getAll("index");
    let hasNakedIndexParam = indexValues.some((v) => v === "");
    if (hasNakedIndexParam) {
      params.delete("index");
      indexValues.filter((v) => v).forEach((v) => params.append("index", v));
      let qs = params.toString();
      path.search = qs ? `?${qs}` : "";
    }
  }
  if ((!action || action === ".") && match.route.index) {
    path.search = path.search ? path.search.replace(/^\?/, "?index&") : "?index";
  }
  if (basename !== "/") {
    path.pathname = path.pathname === "/" ? basename : _chunkDI2QHYMJjs.joinPaths.call(void 0, [basename, path.pathname]);
  }
  return _chunkDI2QHYMJjs.createPath.call(void 0, path);
}
function useFetcher({
  key
} = {}) {
  let { router } = useDataRouterContext("useFetcher" /* UseFetcher */);
  let state = useDataRouterState("useFetcher" /* UseFetcher */);
  let fetcherData = React2.useContext(_chunkDI2QHYMJjs.FetchersContext);
  let route = React2.useContext(_chunkDI2QHYMJjs.RouteContext);
  let routeId = _optionalChain([route, 'access', _39 => _39.matches, 'access', _40 => _40[route.matches.length - 1], 'optionalAccess', _41 => _41.route, 'access', _42 => _42.id]);
  _chunkDI2QHYMJjs.invariant.call(void 0, fetcherData, `useFetcher must be used inside a FetchersContext`);
  _chunkDI2QHYMJjs.invariant.call(void 0, route, `useFetcher must be used inside a RouteContext`);
  _chunkDI2QHYMJjs.invariant.call(void 0, 
    routeId != null,
    `useFetcher can only be used on routes that contain a unique "id"`
  );
  let defaultKey = React2.useId();
  let [fetcherKey, setFetcherKey] = React2.useState(key || defaultKey);
  if (key && key !== fetcherKey) {
    setFetcherKey(key);
  }
  React2.useEffect(() => {
    router.getFetcher(fetcherKey);
    return () => router.deleteFetcher(fetcherKey);
  }, [router, fetcherKey]);
  let load = React2.useCallback(
    async (href, opts) => {
      _chunkDI2QHYMJjs.invariant.call(void 0, routeId, "No routeId available for fetcher.load()");
      await router.fetch(fetcherKey, routeId, href, opts);
    },
    [fetcherKey, routeId, router]
  );
  let submitImpl = useSubmit();
  let submit = React2.useCallback(
    async (target, opts) => {
      await submitImpl(target, {
        ...opts,
        navigate: false,
        fetcherKey
      });
    },
    [fetcherKey, submitImpl]
  );
  let unstable_reset = React2.useCallback((opts) => router.resetFetcher(fetcherKey, opts), [router, fetcherKey]);
  let FetcherForm = React2.useMemo(() => {
    let FetcherForm2 = React2.forwardRef(
      (props, ref) => {
        return /* @__PURE__ */ React2.createElement(Form, { ...props, navigate: false, fetcherKey, ref });
      }
    );
    FetcherForm2.displayName = "fetcher.Form";
    return FetcherForm2;
  }, [fetcherKey]);
  let fetcher = state.fetchers.get(fetcherKey) || _chunkDI2QHYMJjs.IDLE_FETCHER;
  let data = fetcherData.get(fetcherKey);
  let fetcherWithComponents = React2.useMemo(
    () => ({
      Form: FetcherForm,
      submit,
      load,
      unstable_reset,
      ...fetcher,
      data
    }),
    [FetcherForm, submit, load, unstable_reset, fetcher, data]
  );
  return fetcherWithComponents;
}
function useFetchers() {
  let state = useDataRouterState("useFetchers" /* UseFetchers */);
  return Array.from(state.fetchers.entries()).map(([key, fetcher]) => ({
    ...fetcher,
    key
  }));
}
var SCROLL_RESTORATION_STORAGE_KEY = "react-router-scroll-positions";
var savedScrollPositions = {};
function getScrollRestorationKey(location, matches, basename, getKey) {
  let key = null;
  if (getKey) {
    if (basename !== "/") {
      key = getKey(
        {
          ...location,
          pathname: _chunkDI2QHYMJjs.stripBasename.call(void 0, location.pathname, basename) || location.pathname
        },
        matches
      );
    } else {
      key = getKey(location, matches);
    }
  }
  if (key == null) {
    key = location.key;
  }
  return key;
}
function useScrollRestoration({
  getKey,
  storageKey
} = {}) {
  let { router } = useDataRouterContext("useScrollRestoration" /* UseScrollRestoration */);
  let { restoreScrollPosition, preventScrollReset } = useDataRouterState(
    "useScrollRestoration" /* UseScrollRestoration */
  );
  let { basename } = React2.useContext(_chunkDI2QHYMJjs.NavigationContext);
  let location = _chunkDI2QHYMJjs.useLocation.call(void 0, );
  let matches = _chunkDI2QHYMJjs.useMatches.call(void 0, );
  let navigation = _chunkDI2QHYMJjs.useNavigation.call(void 0, );
  React2.useEffect(() => {
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = "auto";
    };
  }, []);
  usePageHide(
    React2.useCallback(() => {
      if (navigation.state === "idle") {
        let key = getScrollRestorationKey(location, matches, basename, getKey);
        savedScrollPositions[key] = window.scrollY;
      }
      try {
        sessionStorage.setItem(
          storageKey || SCROLL_RESTORATION_STORAGE_KEY,
          JSON.stringify(savedScrollPositions)
        );
      } catch (error) {
        _chunkDI2QHYMJjs.warning.call(void 0, 
          false,
          `Failed to save scroll positions in sessionStorage, <ScrollRestoration /> will not work properly (${error}).`
        );
      }
      window.history.scrollRestoration = "auto";
    }, [navigation.state, getKey, basename, location, matches, storageKey])
  );
  if (typeof document !== "undefined") {
    React2.useLayoutEffect(() => {
      try {
        let sessionPositions = sessionStorage.getItem(
          storageKey || SCROLL_RESTORATION_STORAGE_KEY
        );
        if (sessionPositions) {
          savedScrollPositions = JSON.parse(sessionPositions);
        }
      } catch (e) {
      }
    }, [storageKey]);
    React2.useLayoutEffect(() => {
      let disableScrollRestoration = _optionalChain([router, 'optionalAccess', _43 => _43.enableScrollRestoration, 'call', _44 => _44(
        savedScrollPositions,
        () => window.scrollY,
        getKey ? (location2, matches2) => getScrollRestorationKey(location2, matches2, basename, getKey) : void 0
      )]);
      return () => disableScrollRestoration && disableScrollRestoration();
    }, [router, basename, getKey]);
    React2.useLayoutEffect(() => {
      if (restoreScrollPosition === false) {
        return;
      }
      if (typeof restoreScrollPosition === "number") {
        window.scrollTo(0, restoreScrollPosition);
        return;
      }
      try {
        if (location.hash) {
          let el = document.getElementById(
            decodeURIComponent(location.hash.slice(1))
          );
          if (el) {
            el.scrollIntoView();
            return;
          }
        }
      } catch (e2) {
        _chunkDI2QHYMJjs.warning.call(void 0, 
          false,
          `"${location.hash.slice(
            1
          )}" is not a decodable element ID. The view will not scroll to it.`
        );
      }
      if (preventScrollReset === true) {
        return;
      }
      window.scrollTo(0, 0);
    }, [location, restoreScrollPosition, preventScrollReset]);
  }
}
function useBeforeUnload(callback, options) {
  let { capture } = options || {};
  React2.useEffect(() => {
    let opts = capture != null ? { capture } : void 0;
    window.addEventListener("beforeunload", callback, opts);
    return () => {
      window.removeEventListener("beforeunload", callback, opts);
    };
  }, [callback, capture]);
}
function usePageHide(callback, options) {
  let { capture } = options || {};
  React2.useEffect(() => {
    let opts = capture != null ? { capture } : void 0;
    window.addEventListener("pagehide", callback, opts);
    return () => {
      window.removeEventListener("pagehide", callback, opts);
    };
  }, [callback, capture]);
}
function usePrompt({
  when,
  message
}) {
  let blocker = _chunkDI2QHYMJjs.useBlocker.call(void 0, when);
  React2.useEffect(() => {
    if (blocker.state === "blocked") {
      let proceed = window.confirm(message);
      if (proceed) {
        setTimeout(blocker.proceed, 0);
      } else {
        blocker.reset();
      }
    }
  }, [blocker, message]);
  React2.useEffect(() => {
    if (blocker.state === "blocked" && !when) {
      blocker.reset();
    }
  }, [blocker, when]);
}
function useViewTransitionState(to, { relative } = {}) {
  let vtContext = React2.useContext(_chunkDI2QHYMJjs.ViewTransitionContext);
  _chunkDI2QHYMJjs.invariant.call(void 0, 
    vtContext != null,
    "`useViewTransitionState` must be used within `react-router-dom`'s `RouterProvider`.  Did you accidentally import `RouterProvider` from `react-router`?"
  );
  let { basename } = useDataRouterContext(
    "useViewTransitionState" /* useViewTransitionState */
  );
  let path = _chunkDI2QHYMJjs.useResolvedPath.call(void 0, to, { relative });
  if (!vtContext.isTransitioning) {
    return false;
  }
  let currentPath = _chunkDI2QHYMJjs.stripBasename.call(void 0, vtContext.currentLocation.pathname, basename) || vtContext.currentLocation.pathname;
  let nextPath = _chunkDI2QHYMJjs.stripBasename.call(void 0, vtContext.nextLocation.pathname, basename) || vtContext.nextLocation.pathname;
  return _chunkDI2QHYMJjs.matchPath.call(void 0, path.pathname, nextPath) != null || _chunkDI2QHYMJjs.matchPath.call(void 0, path.pathname, currentPath) != null;
}

// lib/dom/server.tsx

function StaticRouter({
  basename,
  children,
  location: locationProp = "/"
}) {
  if (typeof locationProp === "string") {
    locationProp = _chunkDI2QHYMJjs.parsePath.call(void 0, locationProp);
  }
  let action = "POP" /* Pop */;
  let location = {
    pathname: locationProp.pathname || "/",
    search: locationProp.search || "",
    hash: locationProp.hash || "",
    state: locationProp.state != null ? locationProp.state : null,
    key: locationProp.key || "default"
  };
  let staticNavigator = getStatelessNavigator();
  return /* @__PURE__ */ React3.createElement(
    Router,
    {
      basename,
      children,
      location,
      navigationType: action,
      navigator: staticNavigator,
      static: true
    }
  );
}
function StaticRouterProvider({
  context,
  router,
  hydrate = true,
  nonce
}) {
  _chunkDI2QHYMJjs.invariant.call(void 0, 
    router && context,
    "You must provide `router` and `context` to <StaticRouterProvider>"
  );
  let dataRouterContext = {
    router,
    navigator: getStatelessNavigator(),
    static: true,
    staticContext: context,
    basename: context.basename || "/"
  };
  let fetchersContext = /* @__PURE__ */ new Map();
  let hydrateScript = "";
  if (hydrate !== false) {
    let data = {
      loaderData: context.loaderData,
      actionData: context.actionData,
      errors: serializeErrors(context.errors)
    };
    let json = htmlEscape(JSON.stringify(JSON.stringify(data)));
    hydrateScript = `window.__staticRouterHydrationData = JSON.parse(${json});`;
  }
  let { state } = dataRouterContext.router;
  return /* @__PURE__ */ React3.createElement(React3.Fragment, null, /* @__PURE__ */ React3.createElement(_chunkDI2QHYMJjs.DataRouterContext.Provider, { value: dataRouterContext }, /* @__PURE__ */ React3.createElement(_chunkDI2QHYMJjs.DataRouterStateContext.Provider, { value: state }, /* @__PURE__ */ React3.createElement(_chunkDI2QHYMJjs.FetchersContext.Provider, { value: fetchersContext }, /* @__PURE__ */ React3.createElement(_chunkDI2QHYMJjs.ViewTransitionContext.Provider, { value: { isTransitioning: false } }, /* @__PURE__ */ React3.createElement(
    Router,
    {
      basename: dataRouterContext.basename,
      location: state.location,
      navigationType: state.historyAction,
      navigator: dataRouterContext.navigator,
      static: dataRouterContext.static
    },
    /* @__PURE__ */ React3.createElement(
      DataRoutes2,
      {
        routes: router.routes,
        future: router.future,
        state
      }
    )
  ))))), hydrateScript ? /* @__PURE__ */ React3.createElement(
    "script",
    {
      suppressHydrationWarning: true,
      nonce,
      dangerouslySetInnerHTML: { __html: hydrateScript }
    }
  ) : null);
}
function DataRoutes2({
  routes,
  future,
  state
}) {
  return _chunkDI2QHYMJjs.useRoutesImpl.call(void 0, routes, void 0, state, void 0, future);
}
function serializeErrors(errors) {
  if (!errors) return null;
  let entries = Object.entries(errors);
  let serialized = {};
  for (let [key, val] of entries) {
    if (_chunkDI2QHYMJjs.isRouteErrorResponse.call(void 0, val)) {
      serialized[key] = { ...val, __type: "RouteErrorResponse" };
    } else if (val instanceof Error) {
      serialized[key] = {
        message: val.message,
        __type: "Error",
        // If this is a subclass (i.e., ReferenceError), send up the type so we
        // can re-create the same type during hydration.
        ...val.name !== "Error" ? {
          __subType: val.name
        } : {}
      };
    } else {
      serialized[key] = val;
    }
  }
  return serialized;
}
function getStatelessNavigator() {
  return {
    createHref,
    encodeLocation,
    push(to) {
      throw new Error(
        `You cannot use navigator.push() on the server because it is a stateless environment. This error was probably triggered when you did a \`navigate(${JSON.stringify(to)})\` somewhere in your app.`
      );
    },
    replace(to) {
      throw new Error(
        `You cannot use navigator.replace() on the server because it is a stateless environment. This error was probably triggered when you did a \`navigate(${JSON.stringify(to)}, { replace: true })\` somewhere in your app.`
      );
    },
    go(delta) {
      throw new Error(
        `You cannot use navigator.go() on the server because it is a stateless environment. This error was probably triggered when you did a \`navigate(${delta})\` somewhere in your app.`
      );
    },
    back() {
      throw new Error(
        `You cannot use navigator.back() on the server because it is a stateless environment.`
      );
    },
    forward() {
      throw new Error(
        `You cannot use navigator.forward() on the server because it is a stateless environment.`
      );
    }
  };
}
function createStaticHandler2(routes, opts) {
  return _chunkDI2QHYMJjs.createStaticHandler.call(void 0, routes, {
    ...opts,
    mapRouteProperties
  });
}
function createStaticRouter(routes, context, opts = {}) {
  let manifest = {};
  let dataRoutes = _chunkDI2QHYMJjs.convertRoutesToDataRoutes.call(void 0, 
    routes,
    mapRouteProperties,
    void 0,
    manifest
  );
  let matches = context.matches.map((match) => {
    let route = manifest[match.route.id] || match.route;
    return {
      ...match,
      route
    };
  });
  let msg = (method) => `You cannot use router.${method}() on the server because it is a stateless environment`;
  return {
    get basename() {
      return context.basename;
    },
    get future() {
      return {
        v8_middleware: false,
        ..._optionalChain([opts, 'optionalAccess', _45 => _45.future])
      };
    },
    get state() {
      return {
        historyAction: "POP" /* Pop */,
        location: context.location,
        matches,
        loaderData: context.loaderData,
        actionData: context.actionData,
        errors: context.errors,
        initialized: true,
        navigation: _chunkDI2QHYMJjs.IDLE_NAVIGATION,
        restoreScrollPosition: null,
        preventScrollReset: false,
        revalidation: "idle",
        fetchers: /* @__PURE__ */ new Map(),
        blockers: /* @__PURE__ */ new Map()
      };
    },
    get routes() {
      return dataRoutes;
    },
    get window() {
      return void 0;
    },
    initialize() {
      throw msg("initialize");
    },
    subscribe() {
      throw msg("subscribe");
    },
    enableScrollRestoration() {
      throw msg("enableScrollRestoration");
    },
    navigate() {
      throw msg("navigate");
    },
    fetch() {
      throw msg("fetch");
    },
    revalidate() {
      throw msg("revalidate");
    },
    createHref,
    encodeLocation,
    getFetcher() {
      return _chunkDI2QHYMJjs.IDLE_FETCHER;
    },
    deleteFetcher() {
      throw msg("deleteFetcher");
    },
    resetFetcher() {
      throw msg("resetFetcher");
    },
    dispose() {
      throw msg("dispose");
    },
    getBlocker() {
      return _chunkDI2QHYMJjs.IDLE_BLOCKER;
    },
    deleteBlocker() {
      throw msg("deleteBlocker");
    },
    patchRoutes() {
      throw msg("patchRoutes");
    },
    _internalFetchControllers: /* @__PURE__ */ new Map(),
    _internalSetRoutes() {
      throw msg("_internalSetRoutes");
    },
    _internalSetStateDoNotUseOrYouWillBreakYourApp() {
      throw msg("_internalSetStateDoNotUseOrYouWillBreakYourApp");
    }
  };
}
function createHref(to) {
  return typeof to === "string" ? to : _chunkDI2QHYMJjs.createPath.call(void 0, to);
}
function encodeLocation(to) {
  let href = typeof to === "string" ? to : _chunkDI2QHYMJjs.createPath.call(void 0, to);
  href = href.replace(/ $/, "%20");
  let encoded = ABSOLUTE_URL_REGEX2.test(href) ? new URL(href) : new URL(href, "http://localhost");
  return {
    pathname: encoded.pathname,
    search: encoded.search,
    hash: encoded.hash
  };
}
var ABSOLUTE_URL_REGEX2 = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
var ESCAPE_LOOKUP = {
  "&": "\\u0026",
  ">": "\\u003e",
  "<": "\\u003c",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};
var ESCAPE_REGEX = /[&><\u2028\u2029]/g;
function htmlEscape(str) {
  return str.replace(ESCAPE_REGEX, (match) => ESCAPE_LOOKUP[match]);
}















































exports.mapRouteProperties = mapRouteProperties; exports.hydrationRouteProperties = hydrationRouteProperties; exports.createMemoryRouter = createMemoryRouter; exports.UNSTABLE_TransitionEnabledRouterProvider = UNSTABLE_TransitionEnabledRouterProvider; exports.RouterProvider = RouterProvider; exports.MemoryRouter = MemoryRouter; exports.Navigate = Navigate; exports.Outlet = Outlet; exports.Route = Route; exports.Router = Router; exports.Routes = Routes; exports.Await = Await; exports.createRoutesFromChildren = createRoutesFromChildren; exports.createRoutesFromElements = createRoutesFromElements; exports.renderMatches = renderMatches; exports.WithComponentProps = WithComponentProps; exports.withComponentProps = withComponentProps; exports.WithHydrateFallbackProps = WithHydrateFallbackProps; exports.withHydrateFallbackProps = withHydrateFallbackProps; exports.WithErrorBoundaryProps = WithErrorBoundaryProps; exports.withErrorBoundaryProps = withErrorBoundaryProps; exports.createSearchParams = createSearchParams; exports.createBrowserRouter = createBrowserRouter; exports.createHashRouter = createHashRouter; exports.BrowserRouter = BrowserRouter; exports.HashRouter = HashRouter; exports.HistoryRouter = HistoryRouter; exports.Link = Link; exports.NavLink = NavLink; exports.Form = Form; exports.ScrollRestoration = ScrollRestoration; exports.useLinkClickHandler = useLinkClickHandler; exports.useSearchParams = useSearchParams; exports.useSubmit = useSubmit; exports.useFormAction = useFormAction; exports.useFetcher = useFetcher; exports.useFetchers = useFetchers; exports.useScrollRestoration = useScrollRestoration; exports.useBeforeUnload = useBeforeUnload; exports.usePrompt = usePrompt; exports.useViewTransitionState = useViewTransitionState; exports.StaticRouter = StaticRouter; exports.StaticRouterProvider = StaticRouterProvider; exports.createStaticHandler = createStaticHandler2; exports.createStaticRouter = createStaticRouter;
