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
"use client";


var _chunk4E5LHRQPjs = require('./chunk-4E5LHRQP.js');

// lib/dom-export/dom-router-provider.tsx
var _react = require('react'); var React = _interopRequireWildcard(_react); var React2 = _interopRequireWildcard(_react);
var _reactdom = require('react-dom'); var ReactDOM = _interopRequireWildcard(_reactdom);
var _reactrouter = require('react-router');
function RouterProvider(props) {
  return /* @__PURE__ */ React.createElement(_reactrouter.RouterProvider, { flushSync: ReactDOM.flushSync, ...props });
}

// lib/dom-export/hydrated-router.tsx


















var ssrInfo = null;
var router = null;
function initSsrInfo() {
  if (!ssrInfo && window.__reactRouterContext && window.__reactRouterManifest && window.__reactRouterRouteModules) {
    if (window.__reactRouterManifest.sri === true) {
      const importMap = document.querySelector("script[rr-importmap]");
      if (_optionalChain([importMap, 'optionalAccess', _ => _.textContent])) {
        try {
          window.__reactRouterManifest.sri = JSON.parse(
            importMap.textContent
          ).integrity;
        } catch (err) {
          console.error("Failed to parse import map", err);
        }
      }
    }
    ssrInfo = {
      context: window.__reactRouterContext,
      manifest: window.__reactRouterManifest,
      routeModules: window.__reactRouterRouteModules,
      stateDecodingPromise: void 0,
      router: void 0,
      routerInitialized: false
    };
  }
}
function createHydratedRouter({
  getContext
}) {
  initSsrInfo();
  if (!ssrInfo) {
    throw new Error(
      "You must be using the SSR features of React Router in order to skip passing a `router` prop to `<RouterProvider>`"
    );
  }
  let localSsrInfo = ssrInfo;
  if (!ssrInfo.stateDecodingPromise) {
    let stream = ssrInfo.context.stream;
    _reactrouter.UNSAFE_invariant.call(void 0, stream, "No stream found for single fetch decoding");
    ssrInfo.context.stream = void 0;
    ssrInfo.stateDecodingPromise = _reactrouter.UNSAFE_decodeViaTurboStream.call(void 0, stream, window).then((value) => {
      ssrInfo.context.state = value.value;
      localSsrInfo.stateDecodingPromise.value = true;
    }).catch((e) => {
      localSsrInfo.stateDecodingPromise.error = e;
    });
  }
  if (ssrInfo.stateDecodingPromise.error) {
    throw ssrInfo.stateDecodingPromise.error;
  }
  if (!ssrInfo.stateDecodingPromise.value) {
    throw ssrInfo.stateDecodingPromise;
  }
  let routes = _reactrouter.UNSAFE_createClientRoutes.call(void 0, 
    ssrInfo.manifest.routes,
    ssrInfo.routeModules,
    ssrInfo.context.state,
    ssrInfo.context.ssr,
    ssrInfo.context.isSpaMode
  );
  let hydrationData = void 0;
  if (ssrInfo.context.isSpaMode) {
    let { loaderData } = ssrInfo.context.state;
    if (_optionalChain([ssrInfo, 'access', _2 => _2.manifest, 'access', _3 => _3.routes, 'access', _4 => _4.root, 'optionalAccess', _5 => _5.hasLoader]) && loaderData && "root" in loaderData) {
      hydrationData = {
        loaderData: {
          root: loaderData.root
        }
      };
    }
  } else {
    hydrationData = _reactrouter.UNSAFE_getHydrationData.call(void 0, {
      state: ssrInfo.context.state,
      routes,
      getRouteInfo: (routeId) => ({
        clientLoader: _optionalChain([ssrInfo, 'access', _6 => _6.routeModules, 'access', _7 => _7[routeId], 'optionalAccess', _8 => _8.clientLoader]),
        hasLoader: _optionalChain([ssrInfo, 'access', _9 => _9.manifest, 'access', _10 => _10.routes, 'access', _11 => _11[routeId], 'optionalAccess', _12 => _12.hasLoader]) === true,
        hasHydrateFallback: _optionalChain([ssrInfo, 'access', _13 => _13.routeModules, 'access', _14 => _14[routeId], 'optionalAccess', _15 => _15.HydrateFallback]) != null
      }),
      location: window.location,
      basename: _optionalChain([window, 'access', _16 => _16.__reactRouterContext, 'optionalAccess', _17 => _17.basename]),
      isSpaMode: ssrInfo.context.isSpaMode
    });
    if (hydrationData && hydrationData.errors) {
      hydrationData.errors = _reactrouter.UNSAFE_deserializeErrors.call(void 0, hydrationData.errors);
    }
  }
  let router2 = _reactrouter.UNSAFE_createRouter.call(void 0, {
    routes,
    history: _reactrouter.UNSAFE_createBrowserHistory.call(void 0, ),
    basename: ssrInfo.context.basename,
    getContext,
    hydrationData,
    hydrationRouteProperties: _reactrouter.UNSAFE_hydrationRouteProperties,
    mapRouteProperties: _reactrouter.UNSAFE_mapRouteProperties,
    future: {
      middleware: ssrInfo.context.future.v8_middleware
    },
    dataStrategy: _reactrouter.UNSAFE_getTurboStreamSingleFetchDataStrategy.call(void 0, 
      () => router2,
      ssrInfo.manifest,
      ssrInfo.routeModules,
      ssrInfo.context.ssr,
      ssrInfo.context.basename
    ),
    patchRoutesOnNavigation: _reactrouter.UNSAFE_getPatchRoutesOnNavigationFunction.call(void 0, 
      ssrInfo.manifest,
      ssrInfo.routeModules,
      ssrInfo.context.ssr,
      ssrInfo.context.routeDiscovery,
      ssrInfo.context.isSpaMode,
      ssrInfo.context.basename
    )
  });
  ssrInfo.router = router2;
  if (router2.state.initialized) {
    ssrInfo.routerInitialized = true;
    router2.initialize();
  }
  router2.createRoutesForHMR = /* spacer so ts-ignore does not affect the right hand of the assignment */
  _reactrouter.UNSAFE_createClientRoutesWithHMRRevalidationOptOut;
  window.__reactRouterDataRouter = router2;
  return router2;
}
function HydratedRouter(props) {
  if (!router) {
    router = createHydratedRouter({
      getContext: props.getContext
    });
  }
  let [criticalCss, setCriticalCss] = React2.useState(
    process.env.NODE_ENV === "development" ? _optionalChain([ssrInfo, 'optionalAccess', _18 => _18.context, 'access', _19 => _19.criticalCss]) : void 0
  );
  React2.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setCriticalCss(void 0);
    }
  }, []);
  React2.useEffect(() => {
    if (process.env.NODE_ENV === "development" && criticalCss === void 0) {
      document.querySelectorAll(`[${_chunk4E5LHRQPjs.CRITICAL_CSS_DATA_ATTRIBUTE}]`).forEach((element) => element.remove());
    }
  }, [criticalCss]);
  let [location, setLocation] = React2.useState(router.state.location);
  React2.useLayoutEffect(() => {
    if (ssrInfo && ssrInfo.router && !ssrInfo.routerInitialized) {
      ssrInfo.routerInitialized = true;
      ssrInfo.router.initialize();
    }
  }, []);
  React2.useLayoutEffect(() => {
    if (ssrInfo && ssrInfo.router) {
      return ssrInfo.router.subscribe((newState) => {
        if (newState.location !== location) {
          setLocation(newState.location);
        }
      });
    }
  }, [location]);
  _reactrouter.UNSAFE_invariant.call(void 0, ssrInfo, "ssrInfo unavailable for HydratedRouter");
  _reactrouter.UNSAFE_useFogOFWarDiscovery.call(void 0, 
    router,
    ssrInfo.manifest,
    ssrInfo.routeModules,
    ssrInfo.context.ssr,
    ssrInfo.context.routeDiscovery,
    ssrInfo.context.isSpaMode
  );
  return (
    // This fragment is important to ensure we match the <ServerRouter> JSX
    // structure so that useId values hydrate correctly
    /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement(
      _reactrouter.UNSAFE_FrameworkContext.Provider,
      {
        value: {
          manifest: ssrInfo.manifest,
          routeModules: ssrInfo.routeModules,
          future: ssrInfo.context.future,
          criticalCss,
          ssr: ssrInfo.context.ssr,
          isSpaMode: ssrInfo.context.isSpaMode,
          routeDiscovery: ssrInfo.context.routeDiscovery
        }
      },
      /* @__PURE__ */ React2.createElement(_reactrouter.UNSAFE_RemixErrorBoundary, { location }, /* @__PURE__ */ React2.createElement(
        RouterProvider,
        {
          router,
          unstable_onError: props.unstable_onError
        }
      ))
    ), /* @__PURE__ */ React2.createElement(React2.Fragment, null))
  );
}



exports.HydratedRouter = HydratedRouter; exports.RouterProvider = RouterProvider;
