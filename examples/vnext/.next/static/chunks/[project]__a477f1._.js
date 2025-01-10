(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push(["static/chunks/[project]__a477f1._.js", {

"[project]/examples/vnext/src/app/favicon.ico.mjs { IMAGE => \"[project]/examples/vnext/src/app/favicon.ico [app-rsc] (static)\" } [app-rsc] (structured image object, ecmascript, Next.js server component, client modules)": ((__turbopack_context__) => {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, t: require } = __turbopack_context__;
{
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/router/utils/handle-smooth-scroll.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
 * Run function with `scroll-behavior: auto` applied to `<html/>`.
 * This css change will be reverted after the function finishes.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "handleSmoothScroll", {
    enumerable: true,
    get: function() {
        return handleSmoothScroll;
    }
});
function handleSmoothScroll(fn, options) {
    if (options === void 0) options = {};
    // if only the hash is changed, we don't need to disable smooth scrolling
    // we only care to prevent smooth scrolling when navigating to a new page to avoid jarring UX
    if (options.onlyHashChange) {
        fn();
        return;
    }
    const htmlElement = document.documentElement;
    const existing = htmlElement.style.scrollBehavior;
    htmlElement.style.scrollBehavior = 'auto';
    if (!options.dontForceLayout) {
        // In Chrome-based browsers we need to force reflow before calling `scrollTo`.
        // Otherwise it will not pickup the change in scrollBehavior
        // More info here: https://github.com/vercel/next.js/issues/40719#issuecomment-1336248042
        htmlElement.getClientRects();
    }
    fn();
    htmlElement.style.scrollBehavior = existing;
} //# sourceMappingURL=handle-smooth-scroll.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/layout-router.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, /**
 * OuterLayoutRouter handles the current segment as well as <Offscreen> rendering of other segments.
 * It can be rendered next to each other with a different `parallelRouterKey`, allowing for Parallel routes.
 */ "default", {
    enumerable: true,
    get: function() {
        return OuterLayoutRouter;
    }
});
const _interop_require_default = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _reactdom = /*#__PURE__*/ _interop_require_default._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)"));
const _approutercontextsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/app-router-context.shared-runtime.js [app-client] (ecmascript)");
const _fetchserverresponse = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/fetch-server-response.js [app-client] (ecmascript)");
const _unresolvedthenable = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/unresolved-thenable.js [app-client] (ecmascript)");
const _errorboundary = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/error-boundary.js [app-client] (ecmascript)");
const _matchsegments = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/match-segments.js [app-client] (ecmascript)");
const _handlesmoothscroll = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/router/utils/handle-smooth-scroll.js [app-client] (ecmascript)");
const _redirectboundary = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/redirect-boundary.js [app-client] (ecmascript)");
const _notfoundboundary = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/not-found-boundary.js [app-client] (ecmascript)");
const _getsegmentvalue = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/get-segment-value.js [app-client] (ecmascript)");
const _createroutercachekey = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js [app-client] (ecmascript)");
const _hasinterceptionrouteincurrenttree = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/router-reducer/reducers/has-interception-route-in-current-tree.js [app-client] (ecmascript)");
/**
 * Add refetch marker to router state at the point of the current layout segment.
 * This ensures the response returned is not further down than the current layout segment.
 */ function walkAddRefetch(segmentPathToWalk, treeToRecreate) {
    if (segmentPathToWalk) {
        const [segment, parallelRouteKey] = segmentPathToWalk;
        const isLast = segmentPathToWalk.length === 2;
        if ((0, _matchsegments.matchSegment)(treeToRecreate[0], segment)) {
            if (treeToRecreate[1].hasOwnProperty(parallelRouteKey)) {
                if (isLast) {
                    const subTree = walkAddRefetch(undefined, treeToRecreate[1][parallelRouteKey]);
                    return [
                        treeToRecreate[0],
                        {
                            ...treeToRecreate[1],
                            [parallelRouteKey]: [
                                subTree[0],
                                subTree[1],
                                subTree[2],
                                'refetch'
                            ]
                        }
                    ];
                }
                return [
                    treeToRecreate[0],
                    {
                        ...treeToRecreate[1],
                        [parallelRouteKey]: walkAddRefetch(segmentPathToWalk.slice(2), treeToRecreate[1][parallelRouteKey])
                    }
                ];
            }
        }
    }
    return treeToRecreate;
}
const __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = _reactdom.default.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
// TODO-APP: Replace with new React API for finding dom nodes without a `ref` when available
/**
 * Wraps ReactDOM.findDOMNode with additional logic to hide React Strict Mode warning
 */ function findDOMNode(instance) {
    // Tree-shake for server bundle
    if (typeof window === 'undefined') return null;
    // __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.findDOMNode is null during module init.
    // We need to lazily reference it.
    const internal_reactDOMfindDOMNode = __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.findDOMNode;
    return internal_reactDOMfindDOMNode(instance);
}
const rectProperties = [
    'bottom',
    'height',
    'left',
    'right',
    'top',
    'width',
    'x',
    'y'
];
/**
 * Check if a HTMLElement is hidden or fixed/sticky position
 */ function shouldSkipElement(element) {
    // we ignore fixed or sticky positioned elements since they'll likely pass the "in-viewport" check
    // and will result in a situation we bail on scroll because of something like a fixed nav,
    // even though the actual page content is offscreen
    if ([
        'sticky',
        'fixed'
    ].includes(getComputedStyle(element).position)) {
        if ("TURBOPACK compile-time truthy", 1) {
            console.warn('Skipping auto-scroll behavior due to `position: sticky` or `position: fixed` on element:', element);
        }
        return true;
    }
    // Uses `getBoundingClientRect` to check if the element is hidden instead of `offsetParent`
    // because `offsetParent` doesn't consider document/body
    const rect = element.getBoundingClientRect();
    return rectProperties.every((item)=>rect[item] === 0);
}
/**
 * Check if the top corner of the HTMLElement is in the viewport.
 */ function topOfElementInViewport(element, viewportHeight) {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.top <= viewportHeight;
}
/**
 * Find the DOM node for a hash fragment.
 * If `top` the page has to scroll to the top of the page. This mirrors the browser's behavior.
 * If the hash fragment is an id, the page has to scroll to the element with that id.
 * If the hash fragment is a name, the page has to scroll to the first element with that name.
 */ function getHashFragmentDomNode(hashFragment) {
    // If the hash fragment is `top` the page has to scroll to the top of the page.
    if (hashFragment === 'top') {
        return document.body;
    }
    var _document_getElementById;
    // If the hash fragment is an id, the page has to scroll to the element with that id.
    return (_document_getElementById = document.getElementById(hashFragment)) != null ? _document_getElementById : document.getElementsByName(hashFragment)[0];
}
class InnerScrollAndFocusHandler extends _react.default.Component {
    componentDidMount() {
        this.handlePotentialScroll();
    }
    componentDidUpdate() {
        // Because this property is overwritten in handlePotentialScroll it's fine to always run it when true as it'll be set to false for subsequent renders.
        if (this.props.focusAndScrollRef.apply) {
            this.handlePotentialScroll();
        }
    }
    render() {
        return this.props.children;
    }
    constructor(...args){
        super(...args);
        this.handlePotentialScroll = ()=>{
            // Handle scroll and focus, it's only applied once in the first useEffect that triggers that changed.
            const { focusAndScrollRef, segmentPath } = this.props;
            if (focusAndScrollRef.apply) {
                // segmentPaths is an array of segment paths that should be scrolled to
                // if the current segment path is not in the array, the scroll is not applied
                // unless the array is empty, in which case the scroll is always applied
                if (focusAndScrollRef.segmentPaths.length !== 0 && !focusAndScrollRef.segmentPaths.some((scrollRefSegmentPath)=>segmentPath.every((segment, index)=>(0, _matchsegments.matchSegment)(segment, scrollRefSegmentPath[index])))) {
                    return;
                }
                let domNode = null;
                const hashFragment = focusAndScrollRef.hashFragment;
                if (hashFragment) {
                    domNode = getHashFragmentDomNode(hashFragment);
                }
                // `findDOMNode` is tricky because it returns just the first child if the component is a fragment.
                // This already caused a bug where the first child was a <link/> in head.
                if (!domNode) {
                    domNode = findDOMNode(this);
                }
                // If there is no DOM node this layout-router level is skipped. It'll be handled higher-up in the tree.
                if (!(domNode instanceof Element)) {
                    return;
                }
                // Verify if the element is a HTMLElement and if we want to consider it for scroll behavior.
                // If the element is skipped, try to select the next sibling and try again.
                while(!(domNode instanceof HTMLElement) || shouldSkipElement(domNode)){
                    // No siblings found that match the criteria are found, so handle scroll higher up in the tree instead.
                    if (domNode.nextElementSibling === null) {
                        return;
                    }
                    domNode = domNode.nextElementSibling;
                }
                // State is mutated to ensure that the focus and scroll is applied only once.
                focusAndScrollRef.apply = false;
                focusAndScrollRef.hashFragment = null;
                focusAndScrollRef.segmentPaths = [];
                (0, _handlesmoothscroll.handleSmoothScroll)(()=>{
                    // In case of hash scroll, we only need to scroll the element into view
                    if (hashFragment) {
                        domNode.scrollIntoView();
                        return;
                    }
                    // Store the current viewport height because reading `clientHeight` causes a reflow,
                    // and it won't change during this function.
                    const htmlElement = document.documentElement;
                    const viewportHeight = htmlElement.clientHeight;
                    // If the element's top edge is already in the viewport, exit early.
                    if (topOfElementInViewport(domNode, viewportHeight)) {
                        return;
                    }
                    // Otherwise, try scrolling go the top of the document to be backward compatible with pages
                    // scrollIntoView() called on `<html/>` element scrolls horizontally on chrome and firefox (that shouldn't happen)
                    // We could use it to scroll horizontally following RTL but that also seems to be broken - it will always scroll left
                    // scrollLeft = 0 also seems to ignore RTL and manually checking for RTL is too much hassle so we will scroll just vertically
                    htmlElement.scrollTop = 0;
                    // Scroll to domNode if domNode is not in viewport when scrolled to top of document
                    if (!topOfElementInViewport(domNode, viewportHeight)) {
                        domNode.scrollIntoView();
                    }
                }, {
                    // We will force layout by querying domNode position
                    dontForceLayout: true,
                    onlyHashChange: focusAndScrollRef.onlyHashChange
                });
                // Mutate after scrolling so that it can be read by `handleSmoothScroll`
                focusAndScrollRef.onlyHashChange = false;
                // Set focus on the element
                domNode.focus();
            }
        };
    }
}
function ScrollAndFocusHandler(param) {
    let { segmentPath, children } = param;
    const context = (0, _react.useContext)(_approutercontextsharedruntime.GlobalLayoutRouterContext);
    if (!context) {
        throw new Error('invariant global layout router not mounted');
    }
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(InnerScrollAndFocusHandler, {
        segmentPath: segmentPath,
        focusAndScrollRef: context.focusAndScrollRef,
        children: children
    });
}
/**
 * InnerLayoutRouter handles rendering the provided segment based on the cache.
 */ function InnerLayoutRouter(param) {
    let { parallelRouterKey, url, childNodes, segmentPath, tree, // isActive,
    cacheKey } = param;
    const context = (0, _react.useContext)(_approutercontextsharedruntime.GlobalLayoutRouterContext);
    if (!context) {
        throw new Error('invariant global layout router not mounted');
    }
    const { buildId, changeByServerResponse, tree: fullTree } = context;
    // Read segment path from the parallel router cache node.
    let childNode = childNodes.get(cacheKey);
    // When data is not available during rendering client-side we need to fetch
    // it from the server.
    if (childNode === undefined) {
        const newLazyCacheNode = {
            lazyData: null,
            rsc: null,
            prefetchRsc: null,
            head: null,
            prefetchHead: null,
            parallelRoutes: new Map(),
            loading: null
        };
        /**
     * Flight data fetch kicked off during render and put into the cache.
     */ childNode = newLazyCacheNode;
        childNodes.set(cacheKey, newLazyCacheNode);
    }
    // `rsc` represents the renderable node for this segment.
    // If this segment has a `prefetchRsc`, it's the statically prefetched data.
    // We should use that on initial render instead of `rsc`. Then we'll switch
    // to `rsc` when the dynamic response streams in.
    //
    // If no prefetch data is available, then we go straight to rendering `rsc`.
    const resolvedPrefetchRsc = childNode.prefetchRsc !== null ? childNode.prefetchRsc : childNode.rsc;
    // We use `useDeferredValue` to handle switching between the prefetched and
    // final values. The second argument is returned on initial render, then it
    // re-renders with the first argument.
    //
    // @ts-expect-error The second argument to `useDeferredValue` is only
    // available in the experimental builds. When its disabled, it will always
    // return `rsc`.
    const rsc = (0, _react.useDeferredValue)(childNode.rsc, resolvedPrefetchRsc);
    // `rsc` is either a React node or a promise for a React node, except we
    // special case `null` to represent that this segment's data is missing. If
    // it's a promise, we need to unwrap it so we can determine whether or not the
    // data is missing.
    const resolvedRsc = typeof rsc === 'object' && rsc !== null && typeof rsc.then === 'function' ? (0, _react.use)(rsc) : rsc;
    if (!resolvedRsc) {
        // The data for this segment is not available, and there's no pending
        // navigation that will be able to fulfill it. We need to fetch more from
        // the server and patch the cache.
        // Check if there's already a pending request.
        let lazyData = childNode.lazyData;
        if (lazyData === null) {
            /**
       * Router state with refetch marker added
       */ // TODO-APP: remove ''
            const refetchTree = walkAddRefetch([
                '',
                ...segmentPath
            ], fullTree);
            const includeNextUrl = (0, _hasinterceptionrouteincurrenttree.hasInterceptionRouteInCurrentTree)(fullTree);
            childNode.lazyData = lazyData = (0, _fetchserverresponse.fetchServerResponse)(new URL(url, location.origin), {
                flightRouterState: refetchTree,
                nextUrl: includeNextUrl ? context.nextUrl : null,
                buildId
            }).then((serverResponse)=>{
                (0, _react.startTransition)(()=>{
                    changeByServerResponse({
                        previousTree: fullTree,
                        serverResponse
                    });
                });
                return serverResponse;
            });
        }
        // Suspend infinitely as `changeByServerResponse` will cause a different part of the tree to be rendered.
        // A falsey `resolvedRsc` indicates missing data -- we should not commit that branch, and we need to wait for the data to arrive.
        (0, _react.use)(_unresolvedthenable.unresolvedThenable);
    }
    // If we get to this point, then we know we have something we can render.
    const subtree = /*#__PURE__*/ (0, _jsxruntime.jsx)(_approutercontextsharedruntime.LayoutRouterContext.Provider, {
        value: {
            tree: tree[1][parallelRouterKey],
            childNodes: childNode.parallelRoutes,
            // TODO-APP: overriding of url for parallel routes
            url: url,
            loading: childNode.loading
        },
        children: resolvedRsc
    });
    // Ensure root layout is not wrapped in a div as the root layout renders `<html>`
    return subtree;
}
/**
 * Renders suspense boundary with the provided "loading" property as the fallback.
 * If no loading property is provided it renders the children without a suspense boundary.
 */ function LoadingBoundary(param) {
    let { children, hasLoading, loading, loadingStyles, loadingScripts } = param;
    // We have an explicit prop for checking if `loading` is provided, to disambiguate between a loading
    // component that returns `null` / `undefined`, vs not having a loading component at all.
    if (hasLoading) {
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(_react.Suspense, {
            fallback: /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
                children: [
                    loadingStyles,
                    loadingScripts,
                    loading
                ]
            }),
            children: children
        });
    }
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_jsxruntime.Fragment, {
        children: children
    });
}
function OuterLayoutRouter(param) {
    let { parallelRouterKey, segmentPath, error, errorStyles, errorScripts, templateStyles, templateScripts, template, notFound, notFoundStyles } = param;
    const context = (0, _react.useContext)(_approutercontextsharedruntime.LayoutRouterContext);
    if (!context) {
        throw new Error('invariant expected layout router to be mounted');
    }
    const { childNodes, tree, url, loading } = context;
    // Get the current parallelRouter cache node
    let childNodesForParallelRouter = childNodes.get(parallelRouterKey);
    // If the parallel router cache node does not exist yet, create it.
    // This writes to the cache when there is no item in the cache yet. It never *overwrites* existing cache items which is why it's safe in concurrent mode.
    if (!childNodesForParallelRouter) {
        childNodesForParallelRouter = new Map();
        childNodes.set(parallelRouterKey, childNodesForParallelRouter);
    }
    // Get the active segment in the tree
    // The reason arrays are used in the data format is that these are transferred from the server to the browser so it's optimized to save bytes.
    const treeSegment = tree[1][parallelRouterKey][0];
    // If segment is an array it's a dynamic route and we want to read the dynamic route value as the segment to get from the cache.
    const currentChildSegmentValue = (0, _getsegmentvalue.getSegmentValue)(treeSegment);
    /**
   * Decides which segments to keep rendering, all segments that are not active will be wrapped in `<Offscreen>`.
   */ // TODO-APP: Add handling of `<Offscreen>` when it's available.
    const preservedSegments = [
        treeSegment
    ];
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_jsxruntime.Fragment, {
        children: preservedSegments.map((preservedSegment)=>{
            const preservedSegmentValue = (0, _getsegmentvalue.getSegmentValue)(preservedSegment);
            const cacheKey = (0, _createroutercachekey.createRouterCacheKey)(preservedSegment);
            return(/*
            - Error boundary
              - Only renders error boundary if error component is provided.
              - Rendered for each segment to ensure they have their own error state.
            - Loading boundary
              - Only renders suspense boundary if loading components is provided.
              - Rendered for each segment to ensure they have their own loading state.
              - Passed to the router during rendering to ensure it can be immediately rendered when suspending on a Flight fetch.
          */ /*#__PURE__*/ (0, _jsxruntime.jsxs)(_approutercontextsharedruntime.TemplateContext.Provider, {
                value: /*#__PURE__*/ (0, _jsxruntime.jsx)(ScrollAndFocusHandler, {
                    segmentPath: segmentPath,
                    children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_errorboundary.ErrorBoundary, {
                        errorComponent: error,
                        errorStyles: errorStyles,
                        errorScripts: errorScripts,
                        children: /*#__PURE__*/ (0, _jsxruntime.jsx)(LoadingBoundary, {
                            hasLoading: Boolean(loading),
                            loading: loading == null ? void 0 : loading[0],
                            loadingStyles: loading == null ? void 0 : loading[1],
                            loadingScripts: loading == null ? void 0 : loading[2],
                            children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_notfoundboundary.NotFoundBoundary, {
                                notFound: notFound,
                                notFoundStyles: notFoundStyles,
                                children: /*#__PURE__*/ (0, _jsxruntime.jsx)(_redirectboundary.RedirectBoundary, {
                                    children: /*#__PURE__*/ (0, _jsxruntime.jsx)(InnerLayoutRouter, {
                                        parallelRouterKey: parallelRouterKey,
                                        url: url,
                                        tree: tree,
                                        childNodes: childNodesForParallelRouter,
                                        segmentPath: segmentPath,
                                        cacheKey: cacheKey,
                                        isActive: currentChildSegmentValue === preservedSegmentValue
                                    })
                                })
                            })
                        })
                    })
                }),
                children: [
                    templateStyles,
                    templateScripts,
                    template
                ]
            }, (0, _createroutercachekey.createRouterCacheKey)(preservedSegment, true)));
        })
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=layout-router.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/render-from-template-context.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return RenderFromTemplateContext;
    }
});
const _interop_require_wildcard = __turbopack_require__("[project]/node_modules/.pnpm/@swc+helpers@0.5.13/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _approutercontextsharedruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/app-router-context.shared-runtime.js [app-client] (ecmascript)");
function RenderFromTemplateContext() {
    const children = (0, _react.useContext)(_approutercontextsharedruntime.TemplateContext);
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_jsxruntime.Fragment, {
        children: children
    });
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=render-from-template-context.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/invariant-error.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "InvariantError", {
    enumerable: true,
    get: function() {
        return InvariantError;
    }
});
class InvariantError extends Error {
    constructor(message, options){
        super("Invariant: " + (message.endsWith('.') ? message : message + '.') + " This is a bug in Next.js.", options);
        this.name = 'InvariantError';
    }
} //# sourceMappingURL=invariant-error.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/web/spec-extension/adapters/reflect.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ReflectAdapter", {
    enumerable: true,
    get: function() {
        return ReflectAdapter;
    }
});
class ReflectAdapter {
    static get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
            return value.bind(target);
        }
        return value;
    }
    static set(target, prop, value, receiver) {
        return Reflect.set(target, prop, value, receiver);
    }
    static has(target, prop) {
        return Reflect.has(target, prop);
    }
    static deleteProperty(target, prop) {
        return Reflect.deleteProperty(target, prop);
    }
} //# sourceMappingURL=reflect.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/utils.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    describeHasCheckingStringProperty: null,
    describeStringPropertyAccess: null,
    throwWithStaticGenerationBailoutError: null,
    throwWithStaticGenerationBailoutErrorWithDynamicError: null,
    wellKnownProperties: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    describeHasCheckingStringProperty: function() {
        return describeHasCheckingStringProperty;
    },
    describeStringPropertyAccess: function() {
        return describeStringPropertyAccess;
    },
    throwWithStaticGenerationBailoutError: function() {
        return throwWithStaticGenerationBailoutError;
    },
    throwWithStaticGenerationBailoutErrorWithDynamicError: function() {
        return throwWithStaticGenerationBailoutErrorWithDynamicError;
    },
    wellKnownProperties: function() {
        return wellKnownProperties;
    }
});
const _staticgenerationbailout = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/static-generation-bailout.js [app-client] (ecmascript)");
// This regex will have fast negatives meaning valid identifiers may not pass
// this test. However this is only used during static generation to provide hints
// about why a page bailed out of some or all prerendering and we can use bracket notation
// for example while `ಠ_ಠ` is a valid identifier it's ok to print `searchParams['ಠ_ಠ']`
// even if this would have been fine too `searchParams.ಠ_ಠ`
const isDefinitelyAValidIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function describeStringPropertyAccess(target, prop) {
    if (isDefinitelyAValidIdentifier.test(prop)) {
        return `\`${target}.${prop}\``;
    }
    return `\`${target}[${JSON.stringify(prop)}]\``;
}
function describeHasCheckingStringProperty(target, prop) {
    const stringifiedProp = JSON.stringify(prop);
    return `\`Reflect.has(${target}, ${stringifiedProp})\`, \`${stringifiedProp} in ${target}\`, or similar`;
}
function throwWithStaticGenerationBailoutError(route, expression) {
    throw new _staticgenerationbailout.StaticGenBailoutError(`Route ${route} couldn't be rendered statically because it used ${expression}. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`);
}
function throwWithStaticGenerationBailoutErrorWithDynamicError(route, expression) {
    throw new _staticgenerationbailout.StaticGenBailoutError(`Route ${route} with \`dynamic = "error"\` couldn't be rendered statically because it used ${expression}. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`);
}
const wellKnownProperties = new Set([
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toString',
    'valueOf',
    'toLocaleString',
    // Promise prototype
    // fallthrough
    'then',
    'catch',
    'finally',
    // React Promise extension
    // fallthrough
    'status',
    // React introspection
    'displayName',
    // Common tested properties
    // fallthrough
    'toJSON',
    '$$typeof',
    '__esModule'
]); //# sourceMappingURL=utils.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/search-params.browser.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createRenderSearchParamsFromClient", {
    enumerable: true,
    get: function() {
        return createRenderSearchParamsFromClient;
    }
});
const _reflect = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/web/spec-extension/adapters/reflect.js [app-client] (ecmascript)");
const _utils = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/utils.js [app-client] (ecmascript)");
function createRenderSearchParamsFromClient(underlyingSearchParams) {
    if ("TURBOPACK compile-time truthy", 1) {
        return makeUntrackedExoticSearchParamsWithDevWarnings(underlyingSearchParams);
    } else {
        "TURBOPACK unreachable";
    }
}
const CachedSearchParams = new WeakMap();
function makeUntrackedExoticSearchParamsWithDevWarnings(underlyingSearchParams) {
    const cachedSearchParams = CachedSearchParams.get(underlyingSearchParams);
    if (cachedSearchParams) {
        return cachedSearchParams;
    }
    const proxiedProperties = new Set();
    const unproxiedProperties = [];
    const promise = Promise.resolve(underlyingSearchParams);
    Object.keys(underlyingSearchParams).forEach((prop)=>{
        if (_utils.wellKnownProperties.has(prop)) {
            // These properties cannot be shadowed because they need to be the
            // true underlying value for Promises to work correctly at runtime
            unproxiedProperties.push(prop);
        } else {
            proxiedProperties.add(prop);
            promise[prop] = underlyingSearchParams[prop];
        }
    });
    const proxiedPromise = new Proxy(promise, {
        get (target, prop, receiver) {
            if (typeof prop === 'string') {
                if (!_utils.wellKnownProperties.has(prop) && (proxiedProperties.has(prop) || // We are accessing a property that doesn't exist on the promise nor
                // the underlying searchParams.
                Reflect.has(target, prop) === false)) {
                    const expression = (0, _utils.describeStringPropertyAccess)('searchParams', prop);
                    warnForSyncAccess(expression);
                }
            }
            return _reflect.ReflectAdapter.get(target, prop, receiver);
        },
        set (target, prop, value, receiver) {
            if (typeof prop === 'string') {
                proxiedProperties.delete(prop);
            }
            return Reflect.set(target, prop, value, receiver);
        },
        has (target, prop) {
            if (typeof prop === 'string') {
                if (!_utils.wellKnownProperties.has(prop) && (proxiedProperties.has(prop) || // We are accessing a property that doesn't exist on the promise nor
                // the underlying searchParams.
                Reflect.has(target, prop) === false)) {
                    const expression = (0, _utils.describeHasCheckingStringProperty)('searchParams', prop);
                    warnForSyncAccess(expression);
                }
            }
            return Reflect.has(target, prop);
        },
        ownKeys (target) {
            warnForSyncSpread();
            return Reflect.ownKeys(target);
        }
    });
    CachedSearchParams.set(underlyingSearchParams, proxiedPromise);
    return proxiedPromise;
}
function makeUntrackedExoticSearchParams(underlyingSearchParams) {
    const cachedSearchParams = CachedSearchParams.get(underlyingSearchParams);
    if (cachedSearchParams) {
        return cachedSearchParams;
    }
    // We don't use makeResolvedReactPromise here because searchParams
    // supports copying with spread and we don't want to unnecessarily
    // instrument the promise with spreadable properties of ReactPromise.
    const promise = Promise.resolve(underlyingSearchParams);
    CachedSearchParams.set(underlyingSearchParams, promise);
    Object.keys(underlyingSearchParams).forEach((prop)=>{
        if (_utils.wellKnownProperties.has(prop)) {
        // These properties cannot be shadowed because they need to be the
        // true underlying value for Promises to work correctly at runtime
        } else {
            promise[prop] = underlyingSearchParams[prop];
        }
    });
    return promise;
}
const noop = ()=>{};
const warnForSyncAccess = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : function warnForSyncAccess(expression) {
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    console.error(`A searchParam property was accessed directly with ${expression}. ` + `\`searchParams\` should be unwrapped with \`React.use()\` before accessing its properties. ` + `Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`);
};
const warnForSyncSpread = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : function warnForSyncSpread() {
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    console.error(`The keys of \`searchParams\` were accessed directly. ` + `\`searchParams\` should be unwrapped with \`React.use()\` before accessing its properties. ` + `Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`);
}; //# sourceMappingURL=search-params.browser.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/params.browser.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createRenderParamsFromClient", {
    enumerable: true,
    get: function() {
        return createRenderParamsFromClient;
    }
});
const _reflect = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/web/spec-extension/adapters/reflect.js [app-client] (ecmascript)");
const _invarianterror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/invariant-error.js [app-client] (ecmascript)");
const _utils = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/utils.js [app-client] (ecmascript)");
function createRenderParamsFromClient(underlyingParams) {
    if ("TURBOPACK compile-time truthy", 1) {
        return makeDynamicallyTrackedExoticParamsWithDevWarnings(underlyingParams);
    } else {
        "TURBOPACK unreachable";
    }
}
const CachedParams = new WeakMap();
function makeUntrackedExoticParams(underlyingParams) {
    const cachedParams = CachedParams.get(underlyingParams);
    if (cachedParams) {
        return cachedParams;
    }
    const promise = Promise.resolve(underlyingParams);
    CachedParams.set(underlyingParams, promise);
    Object.keys(underlyingParams).forEach((prop)=>{
        if (_utils.wellKnownProperties.has(prop)) {
        // These properties cannot be shadowed because they need to be the
        // true underlying value for Promises to work correctly at runtime
        } else {
            promise[prop] = underlyingParams[prop];
        }
    });
    return promise;
}
function makeDynamicallyTrackedExoticParamsWithDevWarnings(underlyingParams) {
    const cachedParams = CachedParams.get(underlyingParams);
    if (cachedParams) {
        return cachedParams;
    }
    // We don't use makeResolvedReactPromise here because params
    // supports copying with spread and we don't want to unnecessarily
    // instrument the promise with spreadable properties of ReactPromise.
    const promise = Promise.resolve(underlyingParams);
    const proxiedProperties = new Set();
    const unproxiedProperties = [];
    Object.keys(underlyingParams).forEach((prop)=>{
        if (_utils.wellKnownProperties.has(prop)) {
        // These properties cannot be shadowed because they need to be the
        // true underlying value for Promises to work correctly at runtime
        } else {
            proxiedProperties.add(prop);
            promise[prop] = underlyingParams[prop];
        }
    });
    const proxiedPromise = new Proxy(promise, {
        get (target, prop, receiver) {
            if (typeof prop === 'string') {
                if (proxiedProperties.has(prop)) {
                    const expression = (0, _utils.describeStringPropertyAccess)('params', prop);
                    warnForSyncAccess(expression);
                }
            }
            return _reflect.ReflectAdapter.get(target, prop, receiver);
        },
        set (target, prop, value, receiver) {
            if (typeof prop === 'string') {
                proxiedProperties.delete(prop);
            }
            return _reflect.ReflectAdapter.set(target, prop, value, receiver);
        },
        ownKeys (target) {
            warnForEnumeration(unproxiedProperties);
            return Reflect.ownKeys(target);
        }
    });
    CachedParams.set(underlyingParams, proxiedPromise);
    return proxiedPromise;
}
const noop = ()=>{};
const warnForSyncAccess = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : function warnForSyncAccess(expression) {
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    console.error(`A param property was accessed directly with ${expression}. \`params\` is now a Promise and should be unwrapped with \`React.use()\` before accessing properties of the underlying params object. In this version of Next.js direct access to param properties is still supported to facilitate migration but in a future version you will be required to unwrap \`params\` with \`React.use()\`.`);
};
const warnForEnumeration = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : function warnForEnumeration(missingProperties) {
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    if (missingProperties.length) {
        const describedMissingProperties = describeListOfPropertyNames(missingProperties);
        console.error(`params are being enumerated incompletely missing these properties: ${describedMissingProperties}. ` + `\`params\` should be unwrapped with \`React.use()\` before using its value. ` + `Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`);
    } else {
        console.error(`params are being enumerated. ` + `\`params\` should be unwrapped with \`React.use()\` before using its value. ` + `Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`);
    }
};
function describeListOfPropertyNames(properties) {
    switch(properties.length){
        case 0:
            throw new _invarianterror.InvariantError('Expected describeListOfPropertyNames to be called with a non-empty list of strings.');
        case 1:
            return `\`${properties[0]}\``;
        case 2:
            return `\`${properties[0]}\` and \`${properties[1]}\``;
        default:
            {
                let description = '';
                for(let i = 0; i < properties.length - 1; i++){
                    description += `\`${properties[i]}\`, `;
                }
                description += `, and \`${properties[properties.length - 1]}\``;
                return description;
            }
    }
} //# sourceMappingURL=params.browser.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/create-deduped-by-callsite-server-error-logger.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createDedupedByCallsiteServerErrorLoggerDev", {
    enumerable: true,
    get: function() {
        return createDedupedByCallsiteServerErrorLoggerDev;
    }
});
const _react = /*#__PURE__*/ _interop_require_wildcard(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
const errorRef = {
    current: null
};
// React.cache is currently only available in canary/experimental React channels.
const cache = typeof _react.cache === 'function' ? _react.cache : (fn)=>fn;
// When Dynamic IO is enabled, we record these as errors so that they
// are captured by the dev overlay as it's more critical to fix these
// when enabled.
const logErrorOrWarn = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : console.warn;
// We don't want to dedupe across requests.
// The developer might've just attempted to fix the warning so we should warn again if it still happens.
const flushCurrentErrorIfNew = cache((key)=>{
    try {
        logErrorOrWarn(errorRef.current);
    } finally{
        errorRef.current = null;
    }
});
function createDedupedByCallsiteServerErrorLoggerDev(getMessage) {
    return function logDedupedError(...args) {
        const message = getMessage(...args);
        if ("TURBOPACK compile-time truthy", 1) {
            var _stack;
            const callStackFrames = (_stack = new Error().stack) == null ? void 0 : _stack.split('\n');
            if (callStackFrames === undefined || callStackFrames.length < 4) {
                logErrorOrWarn(message);
            } else {
                // Error:
                //   logDedupedError
                //   asyncApiBeingAccessedSynchronously
                //   <userland callsite>
                // TODO: This breaks if sourcemaps with ignore lists are enabled.
                const key = callStackFrames[4];
                errorRef.current = message;
                flushCurrentErrorIfNew(key);
            }
        } else {
            "TURBOPACK unreachable";
        }
    };
} //# sourceMappingURL=create-deduped-by-callsite-server-error-logger.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/lib/scheduler.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    atLeastOneTask: null,
    scheduleImmediate: null,
    scheduleOnNextTick: null,
    waitAtLeastOneReactRenderTask: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    atLeastOneTask: function() {
        return atLeastOneTask;
    },
    scheduleImmediate: function() {
        return scheduleImmediate;
    },
    scheduleOnNextTick: function() {
        return scheduleOnNextTick;
    },
    waitAtLeastOneReactRenderTask: function() {
        return waitAtLeastOneReactRenderTask;
    }
});
const scheduleOnNextTick = (cb)=>{
    // We use Promise.resolve().then() here so that the operation is scheduled at
    // the end of the promise job queue, we then add it to the next process tick
    // to ensure it's evaluated afterwards.
    //
    // This was inspired by the implementation of the DataLoader interface: https://github.com/graphql/dataloader/blob/d336bd15282664e0be4b4a657cb796f09bafbc6b/src/index.js#L213-L255
    //
    Promise.resolve().then(()=>{
        if ("TURBOPACK compile-time falsy", 0) {
            "TURBOPACK unreachable";
        } else {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].nextTick(cb);
        }
    });
};
const scheduleImmediate = (cb)=>{
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    } else {
        setImmediate(cb);
    }
};
function atLeastOneTask() {
    return new Promise((resolve)=>scheduleImmediate(resolve));
}
function waitAtLeastOneReactRenderTask() {
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    } else {
        return new Promise((r)=>setImmediate(r));
    }
} //# sourceMappingURL=scheduler.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/search-params.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    createPrerenderSearchParamsForClientPage: null,
    createSearchParamsFromClient: null,
    createServerSearchParamsForMetadata: null,
    createServerSearchParamsForServerPage: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    createPrerenderSearchParamsForClientPage: function() {
        return createPrerenderSearchParamsForClientPage;
    },
    createSearchParamsFromClient: function() {
        return createSearchParamsFromClient;
    },
    createServerSearchParamsForMetadata: function() {
        return createServerSearchParamsForMetadata;
    },
    createServerSearchParamsForServerPage: function() {
        return createServerSearchParamsForServerPage;
    }
});
const _reflect = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/web/spec-extension/adapters/reflect.js [app-client] (ecmascript)");
const _dynamicrendering = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/dynamic-rendering.js [app-client] (ecmascript)");
const _workunitasyncstorageexternal = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js [app-client] (ecmascript)");
const _invarianterror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/invariant-error.js [app-client] (ecmascript)");
const _dynamicrenderingutils = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/dynamic-rendering-utils.js [app-client] (ecmascript)");
const _creatededupedbycallsiteservererrorlogger = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/create-deduped-by-callsite-server-error-logger.js [app-client] (ecmascript)");
const _utils = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/utils.js [app-client] (ecmascript)");
const _scheduler = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/lib/scheduler.js [app-client] (ecmascript)");
function createSearchParamsFromClient(underlyingSearchParams, workStore) {
    const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
    if (workUnitStore) {
        switch(workUnitStore.type){
            case 'prerender':
            case 'prerender-ppr':
            case 'prerender-legacy':
                return createPrerenderSearchParams(workStore, workUnitStore);
            default:
        }
    }
    return createRenderSearchParams(underlyingSearchParams, workStore);
}
const createServerSearchParamsForMetadata = createServerSearchParamsForServerPage;
function createServerSearchParamsForServerPage(underlyingSearchParams, workStore) {
    const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
    if (workUnitStore) {
        switch(workUnitStore.type){
            case 'prerender':
            case 'prerender-ppr':
            case 'prerender-legacy':
                return createPrerenderSearchParams(workStore, workUnitStore);
            default:
        }
    }
    return createRenderSearchParams(underlyingSearchParams, workStore);
}
function createPrerenderSearchParamsForClientPage(workStore) {
    if (workStore.forceStatic) {
        // When using forceStatic we override all other logic and always just return an empty
        // dictionary object.
        return Promise.resolve({});
    }
    const prerenderStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
    if (prerenderStore && prerenderStore.type === 'prerender') {
        // dynamicIO Prerender
        // We're prerendering in a mode that aborts (dynamicIO) and should stall
        // the promise to ensure the RSC side is considered dynamic
        return (0, _dynamicrenderingutils.makeHangingPromise)(prerenderStore.renderSignal, '`searchParams`');
    }
    // We're prerendering in a mode that does not aborts. We resolve the promise without
    // any tracking because we're just transporting a value from server to client where the tracking
    // will be applied.
    return Promise.resolve({});
}
function createPrerenderSearchParams(workStore, prerenderStore) {
    if (workStore.forceStatic) {
        // When using forceStatic we override all other logic and always just return an empty
        // dictionary object.
        return Promise.resolve({});
    }
    if (prerenderStore.type === 'prerender') {
        // We are in a dynamicIO (PPR or otherwise) prerender
        return makeAbortingExoticSearchParams(workStore.route, prerenderStore);
    }
    // The remaining cases are prerender-ppr and prerender-legacy
    // We are in a legacy static generation and need to interrupt the prerender
    // when search params are accessed.
    return makeErroringExoticSearchParams(workStore, prerenderStore);
}
function createRenderSearchParams(underlyingSearchParams, workStore) {
    if (workStore.forceStatic) {
        // When using forceStatic we override all other logic and always just return an empty
        // dictionary object.
        return Promise.resolve({});
    } else {
        if (("TURBOPACK compile-time value", "development") === 'development' && !workStore.isPrefetchRequest) {
            return makeDynamicallyTrackedExoticSearchParamsWithDevWarnings(underlyingSearchParams, workStore);
        } else {
            return makeUntrackedExoticSearchParams(underlyingSearchParams, workStore);
        }
    }
}
const CachedSearchParams = new WeakMap();
function makeAbortingExoticSearchParams(route, prerenderStore) {
    const cachedSearchParams = CachedSearchParams.get(prerenderStore);
    if (cachedSearchParams) {
        return cachedSearchParams;
    }
    const promise = (0, _dynamicrenderingutils.makeHangingPromise)(prerenderStore.renderSignal, '`searchParams`');
    const proxiedPromise = new Proxy(promise, {
        get (target, prop, receiver) {
            if (Object.hasOwn(promise, prop)) {
                // The promise has this property directly. we must return it.
                // We know it isn't a dynamic access because it can only be something
                // that was previously written to the promise and thus not an underlying searchParam value
                return _reflect.ReflectAdapter.get(target, prop, receiver);
            }
            switch(prop){
                case 'then':
                    {
                        const expression = '`await searchParams`, `searchParams.then`, or similar';
                        (0, _dynamicrendering.annotateDynamicAccess)(expression, prerenderStore);
                        return _reflect.ReflectAdapter.get(target, prop, receiver);
                    }
                case 'status':
                    {
                        const expression = '`use(searchParams)`, `searchParams.status`, or similar';
                        (0, _dynamicrendering.annotateDynamicAccess)(expression, prerenderStore);
                        return _reflect.ReflectAdapter.get(target, prop, receiver);
                    }
                // Object prototype
                case 'hasOwnProperty':
                case 'isPrototypeOf':
                case 'propertyIsEnumerable':
                case 'toString':
                case 'valueOf':
                case 'toLocaleString':
                // Promise prototype
                // fallthrough
                case 'catch':
                case 'finally':
                // Common tested properties
                // fallthrough
                case 'toJSON':
                case '$$typeof':
                case '__esModule':
                    {
                        // These properties cannot be shadowed because they need to be the
                        // true underlying value for Promises to work correctly at runtime
                        return _reflect.ReflectAdapter.get(target, prop, receiver);
                    }
                default:
                    {
                        if (typeof prop === 'string') {
                            const expression = (0, _utils.describeStringPropertyAccess)('searchParams', prop);
                            const error = createSearchAccessError(route, expression);
                            (0, _dynamicrendering.abortAndThrowOnSynchronousRequestDataAccess)(route, expression, error, prerenderStore);
                        }
                        return _reflect.ReflectAdapter.get(target, prop, receiver);
                    }
            }
        },
        has (target, prop) {
            // We don't expect key checking to be used except for testing the existence of
            // searchParams so we make all has tests trigger dynamic. this means that `promise.then`
            // can resolve to the then function on the Promise prototype but 'then' in promise will assume
            // you are testing whether the searchParams has a 'then' property.
            if (typeof prop === 'string') {
                const expression = (0, _utils.describeHasCheckingStringProperty)('searchParams', prop);
                const error = createSearchAccessError(route, expression);
                (0, _dynamicrendering.abortAndThrowOnSynchronousRequestDataAccess)(route, expression, error, prerenderStore);
            }
            return _reflect.ReflectAdapter.has(target, prop);
        },
        ownKeys () {
            const expression = '`{...searchParams}`, `Object.keys(searchParams)`, or similar';
            const error = createSearchAccessError(route, expression);
            (0, _dynamicrendering.abortAndThrowOnSynchronousRequestDataAccess)(route, expression, error, prerenderStore);
        }
    });
    CachedSearchParams.set(prerenderStore, proxiedPromise);
    return proxiedPromise;
}
function makeErroringExoticSearchParams(workStore, prerenderStore) {
    const cachedSearchParams = CachedSearchParams.get(workStore);
    if (cachedSearchParams) {
        return cachedSearchParams;
    }
    const underlyingSearchParams = {};
    // For search params we don't construct a ReactPromise because we want to interrupt
    // rendering on any property access that was not set from outside and so we only want
    // to have properties like value and status if React sets them.
    const promise = Promise.resolve(underlyingSearchParams);
    const proxiedPromise = new Proxy(promise, {
        get (target, prop, receiver) {
            if (Object.hasOwn(promise, prop)) {
                // The promise has this property directly. we must return it.
                // We know it isn't a dynamic access because it can only be something
                // that was previously written to the promise and thus not an underlying searchParam value
                return _reflect.ReflectAdapter.get(target, prop, receiver);
            }
            switch(prop){
                // Object prototype
                case 'hasOwnProperty':
                case 'isPrototypeOf':
                case 'propertyIsEnumerable':
                case 'toString':
                case 'valueOf':
                case 'toLocaleString':
                // Promise prototype
                // fallthrough
                case 'catch':
                case 'finally':
                // Common tested properties
                // fallthrough
                case 'toJSON':
                case '$$typeof':
                case '__esModule':
                    {
                        // These properties cannot be shadowed because they need to be the
                        // true underlying value for Promises to work correctly at runtime
                        return _reflect.ReflectAdapter.get(target, prop, receiver);
                    }
                case 'then':
                    {
                        const expression = '`await searchParams`, `searchParams.then`, or similar';
                        if (workStore.dynamicShouldError) {
                            (0, _utils.throwWithStaticGenerationBailoutErrorWithDynamicError)(workStore.route, expression);
                        } else if (prerenderStore.type === 'prerender-ppr') {
                            // PPR Prerender (no dynamicIO)
                            (0, _dynamicrendering.postponeWithTracking)(workStore.route, expression, prerenderStore.dynamicTracking);
                        } else {
                            // Legacy Prerender
                            (0, _dynamicrendering.throwToInterruptStaticGeneration)(expression, workStore, prerenderStore);
                        }
                        return;
                    }
                case 'status':
                    {
                        const expression = '`use(searchParams)`, `searchParams.status`, or similar';
                        if (workStore.dynamicShouldError) {
                            (0, _utils.throwWithStaticGenerationBailoutErrorWithDynamicError)(workStore.route, expression);
                        } else if (prerenderStore.type === 'prerender-ppr') {
                            // PPR Prerender (no dynamicIO)
                            (0, _dynamicrendering.postponeWithTracking)(workStore.route, expression, prerenderStore.dynamicTracking);
                        } else {
                            // Legacy Prerender
                            (0, _dynamicrendering.throwToInterruptStaticGeneration)(expression, workStore, prerenderStore);
                        }
                        return;
                    }
                default:
                    {
                        if (typeof prop === 'string') {
                            const expression = (0, _utils.describeStringPropertyAccess)('searchParams', prop);
                            if (workStore.dynamicShouldError) {
                                (0, _utils.throwWithStaticGenerationBailoutErrorWithDynamicError)(workStore.route, expression);
                            } else if (prerenderStore.type === 'prerender-ppr') {
                                // PPR Prerender (no dynamicIO)
                                (0, _dynamicrendering.postponeWithTracking)(workStore.route, expression, prerenderStore.dynamicTracking);
                            } else {
                                // Legacy Prerender
                                (0, _dynamicrendering.throwToInterruptStaticGeneration)(expression, workStore, prerenderStore);
                            }
                        }
                        return _reflect.ReflectAdapter.get(target, prop, receiver);
                    }
            }
        },
        has (target, prop) {
            // We don't expect key checking to be used except for testing the existence of
            // searchParams so we make all has tests trigger dynamic. this means that `promise.then`
            // can resolve to the then function on the Promise prototype but 'then' in promise will assume
            // you are testing whether the searchParams has a 'then' property.
            if (typeof prop === 'string') {
                const expression = (0, _utils.describeHasCheckingStringProperty)('searchParams', prop);
                if (workStore.dynamicShouldError) {
                    (0, _utils.throwWithStaticGenerationBailoutErrorWithDynamicError)(workStore.route, expression);
                } else if (prerenderStore.type === 'prerender-ppr') {
                    // PPR Prerender (no dynamicIO)
                    (0, _dynamicrendering.postponeWithTracking)(workStore.route, expression, prerenderStore.dynamicTracking);
                } else {
                    // Legacy Prerender
                    (0, _dynamicrendering.throwToInterruptStaticGeneration)(expression, workStore, prerenderStore);
                }
                return false;
            }
            return _reflect.ReflectAdapter.has(target, prop);
        },
        ownKeys () {
            const expression = '`{...searchParams}`, `Object.keys(searchParams)`, or similar';
            if (workStore.dynamicShouldError) {
                (0, _utils.throwWithStaticGenerationBailoutErrorWithDynamicError)(workStore.route, expression);
            } else if (prerenderStore.type === 'prerender-ppr') {
                // PPR Prerender (no dynamicIO)
                (0, _dynamicrendering.postponeWithTracking)(workStore.route, expression, prerenderStore.dynamicTracking);
            } else {
                // Legacy Prerender
                (0, _dynamicrendering.throwToInterruptStaticGeneration)(expression, workStore, prerenderStore);
            }
        }
    });
    CachedSearchParams.set(workStore, proxiedPromise);
    return proxiedPromise;
}
function makeUntrackedExoticSearchParams(underlyingSearchParams, store) {
    const cachedSearchParams = CachedSearchParams.get(underlyingSearchParams);
    if (cachedSearchParams) {
        return cachedSearchParams;
    }
    // We don't use makeResolvedReactPromise here because searchParams
    // supports copying with spread and we don't want to unnecessarily
    // instrument the promise with spreadable properties of ReactPromise.
    const promise = Promise.resolve(underlyingSearchParams);
    CachedSearchParams.set(underlyingSearchParams, promise);
    Object.keys(underlyingSearchParams).forEach((prop)=>{
        switch(prop){
            // Object prototype
            case 'hasOwnProperty':
            case 'isPrototypeOf':
            case 'propertyIsEnumerable':
            case 'toString':
            case 'valueOf':
            case 'toLocaleString':
            // Promise prototype
            // fallthrough
            case 'then':
            case 'catch':
            case 'finally':
            // React Promise extension
            // fallthrough
            case 'status':
            // Common tested properties
            // fallthrough
            case 'toJSON':
            case '$$typeof':
            case '__esModule':
                {
                    break;
                }
            default:
                {
                    Object.defineProperty(promise, prop, {
                        get () {
                            const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
                            (0, _dynamicrendering.trackDynamicDataInDynamicRender)(store, workUnitStore);
                            return underlyingSearchParams[prop];
                        },
                        set (value) {
                            Object.defineProperty(promise, prop, {
                                value,
                                writable: true,
                                enumerable: true
                            });
                        },
                        enumerable: true,
                        configurable: true
                    });
                }
        }
    });
    return promise;
}
function makeDynamicallyTrackedExoticSearchParamsWithDevWarnings(underlyingSearchParams, store) {
    const cachedSearchParams = CachedSearchParams.get(underlyingSearchParams);
    if (cachedSearchParams) {
        return cachedSearchParams;
    }
    const proxiedProperties = new Set();
    const unproxiedProperties = [];
    // We have an unfortunate sequence of events that requires this initialization logic. We want to instrument the underlying
    // searchParams object to detect if you are accessing values in dev. This is used for warnings and for things like the static prerender
    // indicator. However when we pass this proxy to our Promise.resolve() below the VM checks if the resolved value is a promise by looking
    // at the `.then` property. To our dynamic tracking logic this is indistinguishable from a `then` searchParam and so we would normally trigger
    // dynamic tracking. However we know that this .then is not real dynamic access, it's just how thenables resolve in sequence. So we introduce
    // this initialization concept so we omit the dynamic check until after we've constructed our resolved promise.
    let promiseInitialized = false;
    const proxiedUnderlying = new Proxy(underlyingSearchParams, {
        get (target, prop, receiver) {
            if (typeof prop === 'string' && promiseInitialized) {
                if (store.dynamicShouldError) {
                    const expression = (0, _utils.describeStringPropertyAccess)('searchParams', prop);
                    (0, _utils.throwWithStaticGenerationBailoutErrorWithDynamicError)(store.route, expression);
                }
                const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
                (0, _dynamicrendering.trackDynamicDataInDynamicRender)(store, workUnitStore);
            }
            return _reflect.ReflectAdapter.get(target, prop, receiver);
        },
        has (target, prop) {
            if (typeof prop === 'string') {
                if (store.dynamicShouldError) {
                    const expression = (0, _utils.describeHasCheckingStringProperty)('searchParams', prop);
                    (0, _utils.throwWithStaticGenerationBailoutErrorWithDynamicError)(store.route, expression);
                }
            }
            return Reflect.has(target, prop);
        },
        ownKeys (target) {
            if (store.dynamicShouldError) {
                const expression = '`{...searchParams}`, `Object.keys(searchParams)`, or similar';
                (0, _utils.throwWithStaticGenerationBailoutErrorWithDynamicError)(store.route, expression);
            }
            return Reflect.ownKeys(target);
        }
    });
    // We don't use makeResolvedReactPromise here because searchParams
    // supports copying with spread and we don't want to unnecessarily
    // instrument the promise with spreadable properties of ReactPromise.
    const promise = new Promise((resolve)=>(0, _scheduler.scheduleImmediate)(()=>resolve(underlyingSearchParams)));
    promise.then(()=>{
        promiseInitialized = true;
    });
    Object.keys(underlyingSearchParams).forEach((prop)=>{
        if (_utils.wellKnownProperties.has(prop)) {
            // These properties cannot be shadowed because they need to be the
            // true underlying value for Promises to work correctly at runtime
            unproxiedProperties.push(prop);
        } else {
            proxiedProperties.add(prop);
            Object.defineProperty(promise, prop, {
                get () {
                    return proxiedUnderlying[prop];
                },
                set (newValue) {
                    Object.defineProperty(promise, prop, {
                        value: newValue,
                        writable: true,
                        enumerable: true
                    });
                },
                enumerable: true,
                configurable: true
            });
        }
    });
    const proxiedPromise = new Proxy(promise, {
        get (target, prop, receiver) {
            if (prop === 'then' && store.dynamicShouldError) {
                const expression = '`searchParams.then`';
                (0, _utils.throwWithStaticGenerationBailoutErrorWithDynamicError)(store.route, expression);
            }
            if (typeof prop === 'string') {
                if (!_utils.wellKnownProperties.has(prop) && (proxiedProperties.has(prop) || // We are accessing a property that doesn't exist on the promise nor
                // the underlying searchParams.
                Reflect.has(target, prop) === false)) {
                    const expression = (0, _utils.describeStringPropertyAccess)('searchParams', prop);
                    syncIODev(store.route, expression);
                }
            }
            return _reflect.ReflectAdapter.get(target, prop, receiver);
        },
        set (target, prop, value, receiver) {
            if (typeof prop === 'string') {
                proxiedProperties.delete(prop);
            }
            return Reflect.set(target, prop, value, receiver);
        },
        has (target, prop) {
            if (typeof prop === 'string') {
                if (!_utils.wellKnownProperties.has(prop) && (proxiedProperties.has(prop) || // We are accessing a property that doesn't exist on the promise nor
                // the underlying searchParams.
                Reflect.has(target, prop) === false)) {
                    const expression = (0, _utils.describeHasCheckingStringProperty)('searchParams', prop);
                    syncIODev(store.route, expression);
                }
            }
            return Reflect.has(target, prop);
        },
        ownKeys (target) {
            const expression = '`Object.keys(searchParams)` or similar';
            syncIODev(store.route, expression, unproxiedProperties);
            return Reflect.ownKeys(target);
        }
    });
    CachedSearchParams.set(underlyingSearchParams, proxiedPromise);
    return proxiedPromise;
}
function syncIODev(route, expression, missingProperties) {
    // In all cases we warn normally
    if (missingProperties && missingProperties.length > 0) {
        warnForIncompleteEnumeration(route, expression, missingProperties);
    } else {
        warnForSyncAccess(route, expression);
    }
    const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
    if (workUnitStore && workUnitStore.type === 'request' && workUnitStore.prerenderPhase === true) {
        // When we're rendering dynamically in dev we need to advance out of the
        // Prerender environment when we read Request data synchronously
        const requestStore = workUnitStore;
        (0, _dynamicrendering.trackSynchronousRequestDataAccessInDev)(requestStore);
    }
}
const noop = ()=>{};
const warnForSyncAccess = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : (0, _creatededupedbycallsiteservererrorlogger.createDedupedByCallsiteServerErrorLoggerDev)(createSearchAccessError);
const warnForIncompleteEnumeration = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : (0, _creatededupedbycallsiteservererrorlogger.createDedupedByCallsiteServerErrorLoggerDev)(createIncompleteEnumerationError);
function createSearchAccessError(route, expression) {
    const prefix = route ? `Route "${route}" ` : 'This route ';
    return new Error(`${prefix}used ${expression}. ` + `\`searchParams\` should be awaited before using its properties. ` + `Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`);
}
function createIncompleteEnumerationError(route, expression, missingProperties) {
    const prefix = route ? `Route "${route}" ` : 'This route ';
    return new Error(`${prefix}used ${expression}. ` + `\`searchParams\` should be awaited before using its properties. ` + `The following properties were not available through enumeration ` + `because they conflict with builtin or well-known property names: ` + `${describeListOfPropertyNames(missingProperties)}. ` + `Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`);
}
function describeListOfPropertyNames(properties) {
    switch(properties.length){
        case 0:
            throw new _invarianterror.InvariantError('Expected describeListOfPropertyNames to be called with a non-empty list of strings.');
        case 1:
            return `\`${properties[0]}\``;
        case 2:
            return `\`${properties[0]}\` and \`${properties[1]}\``;
        default:
            {
                let description = '';
                for(let i = 0; i < properties.length - 1; i++){
                    description += `\`${properties[i]}\`, `;
                }
                description += `, and \`${properties[properties.length - 1]}\``;
                return description;
            }
    }
} //# sourceMappingURL=search-params.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/params.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    createParamsFromClient: null,
    createPrerenderParamsForClientSegment: null,
    createServerParamsForMetadata: null,
    createServerParamsForRoute: null,
    createServerParamsForServerSegment: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    createParamsFromClient: function() {
        return createParamsFromClient;
    },
    createPrerenderParamsForClientSegment: function() {
        return createPrerenderParamsForClientSegment;
    },
    createServerParamsForMetadata: function() {
        return createServerParamsForMetadata;
    },
    createServerParamsForRoute: function() {
        return createServerParamsForRoute;
    },
    createServerParamsForServerSegment: function() {
        return createServerParamsForServerSegment;
    }
});
const _reflect = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/web/spec-extension/adapters/reflect.js [app-client] (ecmascript)");
const _dynamicrendering = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/dynamic-rendering.js [app-client] (ecmascript)");
const _workunitasyncstorageexternal = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/work-unit-async-storage.external.js [app-client] (ecmascript)");
const _invarianterror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/invariant-error.js [app-client] (ecmascript)");
const _utils = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/utils.js [app-client] (ecmascript)");
const _dynamicrenderingutils = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/dynamic-rendering-utils.js [app-client] (ecmascript)");
const _creatededupedbycallsiteservererrorlogger = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/create-deduped-by-callsite-server-error-logger.js [app-client] (ecmascript)");
const _scheduler = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/lib/scheduler.js [app-client] (ecmascript)");
function createParamsFromClient(underlyingParams, workStore) {
    const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
    if (workUnitStore) {
        switch(workUnitStore.type){
            case 'prerender':
            case 'prerender-ppr':
            case 'prerender-legacy':
                return createPrerenderParams(underlyingParams, workStore, workUnitStore);
            default:
        }
    }
    return createRenderParams(underlyingParams, workStore);
}
const createServerParamsForMetadata = createServerParamsForServerSegment;
function createServerParamsForRoute(underlyingParams, workStore) {
    const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
    if (workUnitStore) {
        switch(workUnitStore.type){
            case 'prerender':
            case 'prerender-ppr':
            case 'prerender-legacy':
                return createPrerenderParams(underlyingParams, workStore, workUnitStore);
            default:
        }
    }
    return createRenderParams(underlyingParams, workStore);
}
function createServerParamsForServerSegment(underlyingParams, workStore) {
    const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
    if (workUnitStore) {
        switch(workUnitStore.type){
            case 'prerender':
            case 'prerender-ppr':
            case 'prerender-legacy':
                return createPrerenderParams(underlyingParams, workStore, workUnitStore);
            default:
        }
    }
    return createRenderParams(underlyingParams, workStore);
}
function createPrerenderParamsForClientSegment(underlyingParams, workStore) {
    const prerenderStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
    if (prerenderStore && prerenderStore.type === 'prerender') {
        const fallbackParams = workStore.fallbackRouteParams;
        if (fallbackParams) {
            for(let key in underlyingParams){
                if (fallbackParams.has(key)) {
                    // This params object has one of more fallback params so we need to consider
                    // the awaiting of this params object "dynamic". Since we are in dynamicIO mode
                    // we encode this as a promise that never resolves
                    return (0, _dynamicrenderingutils.makeHangingPromise)(prerenderStore.renderSignal, '`params`');
                }
            }
        }
    }
    // We're prerendering in a mode that does not abort. We resolve the promise without
    // any tracking because we're just transporting a value from server to client where the tracking
    // will be applied.
    return Promise.resolve(underlyingParams);
}
function createPrerenderParams(underlyingParams, workStore, prerenderStore) {
    const fallbackParams = workStore.fallbackRouteParams;
    if (fallbackParams) {
        let hasSomeFallbackParams = false;
        for(const key in underlyingParams){
            if (fallbackParams.has(key)) {
                hasSomeFallbackParams = true;
                break;
            }
        }
        if (hasSomeFallbackParams) {
            // params need to be treated as dynamic because we have at least one fallback param
            if (prerenderStore.type === 'prerender') {
                // We are in a dynamicIO (PPR or otherwise) prerender
                return makeAbortingExoticParams(underlyingParams, workStore.route, prerenderStore);
            }
            // remaining cases are prender-ppr and prerender-legacy
            // We aren't in a dynamicIO prerender but we do have fallback params at this
            // level so we need to make an erroring exotic params object which will postpone
            // if you access the fallback params
            return makeErroringExoticParams(underlyingParams, fallbackParams, workStore, prerenderStore);
        }
    }
    // We don't have any fallback params so we have an entirely static safe params object
    return makeUntrackedExoticParams(underlyingParams);
}
function createRenderParams(underlyingParams, workStore) {
    if (("TURBOPACK compile-time value", "development") === 'development' && !workStore.isPrefetchRequest) {
        return makeDynamicallyTrackedExoticParamsWithDevWarnings(underlyingParams, workStore);
    } else {
        return makeUntrackedExoticParams(underlyingParams);
    }
}
const CachedParams = new WeakMap();
function makeAbortingExoticParams(underlyingParams, route, prerenderStore) {
    const cachedParams = CachedParams.get(underlyingParams);
    if (cachedParams) {
        return cachedParams;
    }
    const promise = (0, _dynamicrenderingutils.makeHangingPromise)(prerenderStore.renderSignal, '`params`');
    CachedParams.set(underlyingParams, promise);
    Object.keys(underlyingParams).forEach((prop)=>{
        if (_utils.wellKnownProperties.has(prop)) {
        // These properties cannot be shadowed because they need to be the
        // true underlying value for Promises to work correctly at runtime
        } else {
            Object.defineProperty(promise, prop, {
                get () {
                    const expression = (0, _utils.describeStringPropertyAccess)('params', prop);
                    const error = createParamsAccessError(route, expression);
                    (0, _dynamicrendering.abortAndThrowOnSynchronousRequestDataAccess)(route, expression, error, prerenderStore);
                },
                set (newValue) {
                    Object.defineProperty(promise, prop, {
                        value: newValue,
                        writable: true,
                        enumerable: true
                    });
                },
                enumerable: true,
                configurable: true
            });
        }
    });
    return promise;
}
function makeErroringExoticParams(underlyingParams, fallbackParams, workStore, prerenderStore) {
    const cachedParams = CachedParams.get(underlyingParams);
    if (cachedParams) {
        return cachedParams;
    }
    const augmentedUnderlying = {
        ...underlyingParams
    };
    // We don't use makeResolvedReactPromise here because params
    // supports copying with spread and we don't want to unnecessarily
    // instrument the promise with spreadable properties of ReactPromise.
    const promise = Promise.resolve(augmentedUnderlying);
    CachedParams.set(underlyingParams, promise);
    Object.keys(underlyingParams).forEach((prop)=>{
        if (_utils.wellKnownProperties.has(prop)) {
        // These properties cannot be shadowed because they need to be the
        // true underlying value for Promises to work correctly at runtime
        } else {
            if (fallbackParams.has(prop)) {
                Object.defineProperty(augmentedUnderlying, prop, {
                    get () {
                        const expression = (0, _utils.describeStringPropertyAccess)('params', prop);
                        // In most dynamic APIs we also throw if `dynamic = "error"` however
                        // for params is only dynamic when we're generating a fallback shell
                        // and even when `dynamic = "error"` we still support generating dynamic
                        // fallback shells
                        // TODO remove this comment when dynamicIO is the default since there
                        // will be no `dynamic = "error"`
                        if (prerenderStore.type === 'prerender-ppr') {
                            // PPR Prerender (no dynamicIO)
                            (0, _dynamicrendering.postponeWithTracking)(workStore.route, expression, prerenderStore.dynamicTracking);
                        } else {
                            // Legacy Prerender
                            (0, _dynamicrendering.throwToInterruptStaticGeneration)(expression, workStore, prerenderStore);
                        }
                    },
                    enumerable: true
                });
                Object.defineProperty(promise, prop, {
                    get () {
                        const expression = (0, _utils.describeStringPropertyAccess)('params', prop);
                        // In most dynamic APIs we also throw if `dynamic = "error"` however
                        // for params is only dynamic when we're generating a fallback shell
                        // and even when `dynamic = "error"` we still support generating dynamic
                        // fallback shells
                        // TODO remove this comment when dynamicIO is the default since there
                        // will be no `dynamic = "error"`
                        if (prerenderStore.type === 'prerender-ppr') {
                            // PPR Prerender (no dynamicIO)
                            (0, _dynamicrendering.postponeWithTracking)(workStore.route, expression, prerenderStore.dynamicTracking);
                        } else {
                            // Legacy Prerender
                            (0, _dynamicrendering.throwToInterruptStaticGeneration)(expression, workStore, prerenderStore);
                        }
                    },
                    set (newValue) {
                        Object.defineProperty(promise, prop, {
                            value: newValue,
                            writable: true,
                            enumerable: true
                        });
                    },
                    enumerable: true,
                    configurable: true
                });
            } else {
                promise[prop] = underlyingParams[prop];
            }
        }
    });
    return promise;
}
function makeUntrackedExoticParams(underlyingParams) {
    const cachedParams = CachedParams.get(underlyingParams);
    if (cachedParams) {
        return cachedParams;
    }
    // We don't use makeResolvedReactPromise here because params
    // supports copying with spread and we don't want to unnecessarily
    // instrument the promise with spreadable properties of ReactPromise.
    const promise = Promise.resolve(underlyingParams);
    CachedParams.set(underlyingParams, promise);
    Object.keys(underlyingParams).forEach((prop)=>{
        if (_utils.wellKnownProperties.has(prop)) {
        // These properties cannot be shadowed because they need to be the
        // true underlying value for Promises to work correctly at runtime
        } else {
            promise[prop] = underlyingParams[prop];
        }
    });
    return promise;
}
function makeDynamicallyTrackedExoticParamsWithDevWarnings(underlyingParams, store) {
    const cachedParams = CachedParams.get(underlyingParams);
    if (cachedParams) {
        return cachedParams;
    }
    // We don't use makeResolvedReactPromise here because params
    // supports copying with spread and we don't want to unnecessarily
    // instrument the promise with spreadable properties of ReactPromise.
    const promise = new Promise((resolve)=>(0, _scheduler.scheduleImmediate)(()=>resolve(underlyingParams)));
    const proxiedProperties = new Set();
    const unproxiedProperties = [];
    Object.keys(underlyingParams).forEach((prop)=>{
        if (_utils.wellKnownProperties.has(prop)) {
            // These properties cannot be shadowed because they need to be the
            // true underlying value for Promises to work correctly at runtime
            unproxiedProperties.push(prop);
        } else {
            proxiedProperties.add(prop);
            promise[prop] = underlyingParams[prop];
        }
    });
    const proxiedPromise = new Proxy(promise, {
        get (target, prop, receiver) {
            if (typeof prop === 'string') {
                if (proxiedProperties.has(prop)) {
                    const expression = (0, _utils.describeStringPropertyAccess)('params', prop);
                    syncIODev(store.route, expression);
                }
            }
            return _reflect.ReflectAdapter.get(target, prop, receiver);
        },
        set (target, prop, value, receiver) {
            if (typeof prop === 'string') {
                proxiedProperties.delete(prop);
            }
            return _reflect.ReflectAdapter.set(target, prop, value, receiver);
        },
        ownKeys (target) {
            const expression = '`...params` or similar expression';
            syncIODev(store.route, expression, unproxiedProperties);
            return Reflect.ownKeys(target);
        }
    });
    CachedParams.set(underlyingParams, proxiedPromise);
    return proxiedPromise;
}
function syncIODev(route, expression, missingProperties) {
    const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
    if (workUnitStore && workUnitStore.type === 'request' && workUnitStore.prerenderPhase === true) {
        // When we're rendering dynamically in dev we need to advance out of the
        // Prerender environment when we read Request data synchronously
        const requestStore = workUnitStore;
        (0, _dynamicrendering.trackSynchronousRequestDataAccessInDev)(requestStore);
    }
    // In all cases we warn normally
    if (missingProperties && missingProperties.length > 0) {
        warnForIncompleteEnumeration(route, expression, missingProperties);
    } else {
        warnForSyncAccess(route, expression);
    }
}
const noop = ()=>{};
const warnForSyncAccess = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : (0, _creatededupedbycallsiteservererrorlogger.createDedupedByCallsiteServerErrorLoggerDev)(createParamsAccessError);
const warnForIncompleteEnumeration = ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : (0, _creatededupedbycallsiteservererrorlogger.createDedupedByCallsiteServerErrorLoggerDev)(createIncompleteEnumerationError);
function createParamsAccessError(route, expression) {
    const prefix = route ? `Route "${route}" ` : 'This route ';
    return new Error(`${prefix}used ${expression}. ` + `\`params\` should be awaited before using its properties. ` + `Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`);
}
function createIncompleteEnumerationError(route, expression, missingProperties) {
    const prefix = route ? `Route "${route}" ` : 'This route ';
    return new Error(`${prefix}used ${expression}. ` + `\`params\` should be awaited before using its properties. ` + `The following properties were not available through enumeration ` + `because they conflict with builtin property names: ` + `${describeListOfPropertyNames(missingProperties)}. ` + `Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`);
}
function describeListOfPropertyNames(properties) {
    switch(properties.length){
        case 0:
            throw new _invarianterror.InvariantError('Expected describeListOfPropertyNames to be called with a non-empty list of strings.');
        case 1:
            return `\`${properties[0]}\``;
        case 2:
            return `\`${properties[0]}\` and \`${properties[1]}\``;
        default:
            {
                let description = '';
                for(let i = 0; i < properties.length - 1; i++){
                    description += `\`${properties[i]}\`, `;
                }
                description += `, and \`${properties[properties.length - 1]}\``;
                return description;
            }
    }
} //# sourceMappingURL=params.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/client-page.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ClientPageRoot", {
    enumerable: true,
    get: function() {
        return ClientPageRoot;
    }
});
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _invarianterror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/invariant-error.js [app-client] (ecmascript)");
function ClientPageRoot(param) {
    let { Component, searchParams, params, promises } = param;
    if (typeof window === 'undefined') {
        const { workAsyncStorage } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/work-async-storage.external.js [app-client] (ecmascript)");
        let clientSearchParams;
        let clientParams;
        // We are going to instrument the searchParams prop with tracking for the
        // appropriate context. We wrap differently in prerendering vs rendering
        const store = workAsyncStorage.getStore();
        if (!store) {
            throw new _invarianterror.InvariantError('Expected workStore to exist when handling searchParams in a client Page.');
        }
        const { createSearchParamsFromClient } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/search-params.js [app-client] (ecmascript)");
        clientSearchParams = createSearchParamsFromClient(searchParams, store);
        const { createParamsFromClient } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/params.js [app-client] (ecmascript)");
        clientParams = createParamsFromClient(params, store);
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(Component, {
            params: clientParams,
            searchParams: clientSearchParams
        });
    } else {
        const { createRenderSearchParamsFromClient } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/search-params.browser.js [app-client] (ecmascript)");
        const clientSearchParams = createRenderSearchParamsFromClient(searchParams);
        const { createRenderParamsFromClient } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/params.browser.js [app-client] (ecmascript)");
        const clientParams = createRenderParamsFromClient(params);
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(Component, {
            params: clientParams,
            searchParams: clientSearchParams
        });
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=client-page.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/client/components/client-segment.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ClientSegmentRoot", {
    enumerable: true,
    get: function() {
        return ClientSegmentRoot;
    }
});
const _jsxruntime = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _invarianterror = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/shared/lib/invariant-error.js [app-client] (ecmascript)");
function ClientSegmentRoot(param) {
    let { Component, slots, params, promise } = param;
    if (typeof window === 'undefined') {
        const { workAsyncStorage } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/app-render/work-async-storage.external.js [app-client] (ecmascript)");
        let clientParams;
        // We are going to instrument the searchParams prop with tracking for the
        // appropriate context. We wrap differently in prerendering vs rendering
        const store = workAsyncStorage.getStore();
        if (!store) {
            throw new _invarianterror.InvariantError('Expected workStore to exist when handling params in a client segment such as a Layout or Template.');
        }
        const { createParamsFromClient } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/params.js [app-client] (ecmascript)");
        clientParams = createParamsFromClient(params, store);
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(Component, {
            ...slots,
            params: clientParams
        });
    } else {
        const { createRenderParamsFromClient } = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/server/request/params.browser.js [app-client] (ecmascript)");
        const clientParams = createRenderParamsFromClient(params);
        return /*#__PURE__*/ (0, _jsxruntime.jsx)(Component, {
            ...slots,
            params: clientParams
        });
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=client-segment.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/lib/metadata/metadata-boundary.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use client";
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    MetadataBoundary: null,
    OutletBoundary: null,
    ViewportBoundary: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    MetadataBoundary: function() {
        return MetadataBoundary;
    },
    OutletBoundary: function() {
        return OutletBoundary;
    },
    ViewportBoundary: function() {
        return ViewportBoundary;
    }
});
const _metadataconstants = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/lib/metadata/metadata-constants.js [app-client] (ecmascript)");
// We use a namespace object to allow us to recover the name of the function
// at runtime even when production bundling/minification is used.
const NameSpace = {
    [_metadataconstants.METADATA_BOUNDARY_NAME]: function({ children }) {
        return children;
    },
    [_metadataconstants.VIEWPORT_BOUNDARY_NAME]: function({ children }) {
        return children;
    },
    [_metadataconstants.OUTLET_BOUNDARY_NAME]: function({ children }) {
        return children;
    }
};
const MetadataBoundary = // so it retains the name inferred from the namespace object
NameSpace[_metadataconstants.METADATA_BOUNDARY_NAME.slice(0)];
const ViewportBoundary = // so it retains the name inferred from the namespace object
NameSpace[_metadataconstants.VIEWPORT_BOUNDARY_NAME.slice(0)];
const OutletBoundary = // so it retains the name inferred from the namespace object
NameSpace[_metadataconstants.OUTLET_BOUNDARY_NAME.slice(0)]; //# sourceMappingURL=metadata-boundary.js.map
}}),
}]);

//# sourceMappingURL=%5Bproject%5D__a477f1._.js.map