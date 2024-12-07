(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push(["static/chunks/78671_next_dist_compiled_80f51a._.js", {

"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/process/browser.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
(function() {
    var e = {
        229: function(e) {
            var t = e.exports = {};
            var r;
            var n;
            function defaultSetTimout() {
                throw new Error("setTimeout has not been defined");
            }
            function defaultClearTimeout() {
                throw new Error("clearTimeout has not been defined");
            }
            (function() {
                try {
                    if (typeof setTimeout === "function") {
                        r = setTimeout;
                    } else {
                        r = defaultSetTimout;
                    }
                } catch (e) {
                    r = defaultSetTimout;
                }
                try {
                    if (typeof clearTimeout === "function") {
                        n = clearTimeout;
                    } else {
                        n = defaultClearTimeout;
                    }
                } catch (e) {
                    n = defaultClearTimeout;
                }
            })();
            function runTimeout(e) {
                if (r === setTimeout) {
                    return setTimeout(e, 0);
                }
                if ((r === defaultSetTimout || !r) && setTimeout) {
                    r = setTimeout;
                    return setTimeout(e, 0);
                }
                try {
                    return r(e, 0);
                } catch (t) {
                    try {
                        return r.call(null, e, 0);
                    } catch (t) {
                        return r.call(this, e, 0);
                    }
                }
            }
            function runClearTimeout(e) {
                if (n === clearTimeout) {
                    return clearTimeout(e);
                }
                if ((n === defaultClearTimeout || !n) && clearTimeout) {
                    n = clearTimeout;
                    return clearTimeout(e);
                }
                try {
                    return n(e);
                } catch (t) {
                    try {
                        return n.call(null, e);
                    } catch (t) {
                        return n.call(this, e);
                    }
                }
            }
            var i = [];
            var o = false;
            var u;
            var a = -1;
            function cleanUpNextTick() {
                if (!o || !u) {
                    return;
                }
                o = false;
                if (u.length) {
                    i = u.concat(i);
                } else {
                    a = -1;
                }
                if (i.length) {
                    drainQueue();
                }
            }
            function drainQueue() {
                if (o) {
                    return;
                }
                var e = runTimeout(cleanUpNextTick);
                o = true;
                var t = i.length;
                while(t){
                    u = i;
                    i = [];
                    while(++a < t){
                        if (u) {
                            u[a].run();
                        }
                    }
                    a = -1;
                    t = i.length;
                }
                u = null;
                o = false;
                runClearTimeout(e);
            }
            t.nextTick = function(e) {
                var t = new Array(arguments.length - 1);
                if (arguments.length > 1) {
                    for(var r = 1; r < arguments.length; r++){
                        t[r - 1] = arguments[r];
                    }
                }
                i.push(new Item(e, t));
                if (i.length === 1 && !o) {
                    runTimeout(drainQueue);
                }
            };
            function Item(e, t) {
                this.fun = e;
                this.array = t;
            }
            Item.prototype.run = function() {
                this.fun.apply(null, this.array);
            };
            t.title = "browser";
            t.browser = true;
            t.env = {};
            t.argv = [];
            t.version = "";
            t.versions = {};
            function noop() {}
            t.on = noop;
            t.addListener = noop;
            t.once = noop;
            t.off = noop;
            t.removeListener = noop;
            t.removeAllListeners = noop;
            t.emit = noop;
            t.prependListener = noop;
            t.prependOnceListener = noop;
            t.listeners = function(e) {
                return [];
            };
            t.binding = function(e) {
                throw new Error("process.binding is not supported");
            };
            t.cwd = function() {
                return "/";
            };
            t.chdir = function(e) {
                throw new Error("process.chdir is not supported");
            };
            t.umask = function() {
                return 0;
            };
        }
    };
    var t = {};
    function __nccwpck_require__(r) {
        var n = t[r];
        if (n !== undefined) {
            return n.exports;
        }
        var i = t[r] = {
            exports: {}
        };
        var o = true;
        try {
            e[r](i, i.exports, __nccwpck_require__);
            o = false;
        } finally{
            if (o) delete t[r];
        }
        return i.exports;
    }
    if (typeof __nccwpck_require__ !== "undefined") __nccwpck_require__.ab = __dirname + "/";
    var r = __nccwpck_require__(229);
    module.exports = r;
})();
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-refresh/cjs/react-refresh-runtime.development.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
 * @license React
 * react-refresh-runtime.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time truthy", 1) {
    (function() {
        'use strict';
        // ATTENTION
        var REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
        var REACT_MEMO_TYPE = Symbol.for('react.memo');
        var PossiblyWeakMap = typeof WeakMap === 'function' ? WeakMap : Map; // We never remove these associations.
        // It's OK to reference families, but use WeakMap/Set for types.
        var allFamiliesByID = new Map();
        var allFamiliesByType = new PossiblyWeakMap();
        var allSignaturesByType = new PossiblyWeakMap(); // This WeakMap is read by React, so we only put families
        // that have actually been edited here. This keeps checks fast.
        // $FlowIssue
        var updatedFamiliesByType = new PossiblyWeakMap(); // This is cleared on every performReactRefresh() call.
        // It is an array of [Family, NextType] tuples.
        var pendingUpdates = []; // This is injected by the renderer via DevTools global hook.
        var helpersByRendererID = new Map();
        var helpersByRoot = new Map(); // We keep track of mounted roots so we can schedule updates.
        var mountedRoots = new Set(); // If a root captures an error, we remember it so we can retry on edit.
        var failedRoots = new Set(); // In environments that support WeakMap, we also remember the last element for every root.
        // It needs to be weak because we do this even for roots that failed to mount.
        // If there is no WeakMap, we won't attempt to do retrying.
        // $FlowIssue
        var rootElements = typeof WeakMap === 'function' ? new WeakMap() : null;
        var isPerformingRefresh = false;
        function computeFullKey(signature) {
            if (signature.fullKey !== null) {
                return signature.fullKey;
            }
            var fullKey = signature.ownKey;
            var hooks;
            try {
                hooks = signature.getCustomHooks();
            } catch (err) {
                // This can happen in an edge case, e.g. if expression like Foo.useSomething
                // depends on Foo which is lazily initialized during rendering.
                // In that case just assume we'll have to remount.
                signature.forceReset = true;
                signature.fullKey = fullKey;
                return fullKey;
            }
            for(var i = 0; i < hooks.length; i++){
                var hook = hooks[i];
                if (typeof hook !== 'function') {
                    // Something's wrong. Assume we need to remount.
                    signature.forceReset = true;
                    signature.fullKey = fullKey;
                    return fullKey;
                }
                var nestedHookSignature = allSignaturesByType.get(hook);
                if (nestedHookSignature === undefined) {
                    continue;
                }
                var nestedHookKey = computeFullKey(nestedHookSignature);
                if (nestedHookSignature.forceReset) {
                    signature.forceReset = true;
                }
                fullKey += '\n---\n' + nestedHookKey;
            }
            signature.fullKey = fullKey;
            return fullKey;
        }
        function haveEqualSignatures(prevType, nextType) {
            var prevSignature = allSignaturesByType.get(prevType);
            var nextSignature = allSignaturesByType.get(nextType);
            if (prevSignature === undefined && nextSignature === undefined) {
                return true;
            }
            if (prevSignature === undefined || nextSignature === undefined) {
                return false;
            }
            if (computeFullKey(prevSignature) !== computeFullKey(nextSignature)) {
                return false;
            }
            if (nextSignature.forceReset) {
                return false;
            }
            return true;
        }
        function isReactClass(type) {
            return type.prototype && type.prototype.isReactComponent;
        }
        function canPreserveStateBetween(prevType, nextType) {
            if (isReactClass(prevType) || isReactClass(nextType)) {
                return false;
            }
            if (haveEqualSignatures(prevType, nextType)) {
                return true;
            }
            return false;
        }
        function resolveFamily(type) {
            // Only check updated types to keep lookups fast.
            return updatedFamiliesByType.get(type);
        } // If we didn't care about IE11, we could use new Map/Set(iterable).
        function cloneMap(map) {
            var clone = new Map();
            map.forEach(function(value, key) {
                clone.set(key, value);
            });
            return clone;
        }
        function cloneSet(set) {
            var clone = new Set();
            set.forEach(function(value) {
                clone.add(value);
            });
            return clone;
        } // This is a safety mechanism to protect against rogue getters and Proxies.
        function getProperty(object, property) {
            try {
                return object[property];
            } catch (err) {
                // Intentionally ignore.
                return undefined;
            }
        }
        function performReactRefresh() {
            if (pendingUpdates.length === 0) {
                return null;
            }
            if (isPerformingRefresh) {
                return null;
            }
            isPerformingRefresh = true;
            try {
                var staleFamilies = new Set();
                var updatedFamilies = new Set();
                var updates = pendingUpdates;
                pendingUpdates = [];
                updates.forEach(function(_ref) {
                    var family = _ref[0], nextType = _ref[1];
                    // Now that we got a real edit, we can create associations
                    // that will be read by the React reconciler.
                    var prevType = family.current;
                    updatedFamiliesByType.set(prevType, family);
                    updatedFamiliesByType.set(nextType, family);
                    family.current = nextType; // Determine whether this should be a re-render or a re-mount.
                    if (canPreserveStateBetween(prevType, nextType)) {
                        updatedFamilies.add(family);
                    } else {
                        staleFamilies.add(family);
                    }
                }); // TODO: rename these fields to something more meaningful.
                var update = {
                    updatedFamilies: updatedFamilies,
                    // Families that will re-render preserving state
                    staleFamilies: staleFamilies // Families that will be remounted
                };
                helpersByRendererID.forEach(function(helpers) {
                    // Even if there are no roots, set the handler on first update.
                    // This ensures that if *new* roots are mounted, they'll use the resolve handler.
                    helpers.setRefreshHandler(resolveFamily);
                });
                var didError = false;
                var firstError = null; // We snapshot maps and sets that are mutated during commits.
                // If we don't do this, there is a risk they will be mutated while
                // we iterate over them. For example, trying to recover a failed root
                // may cause another root to be added to the failed list -- an infinite loop.
                var failedRootsSnapshot = cloneSet(failedRoots);
                var mountedRootsSnapshot = cloneSet(mountedRoots);
                var helpersByRootSnapshot = cloneMap(helpersByRoot);
                failedRootsSnapshot.forEach(function(root) {
                    var helpers = helpersByRootSnapshot.get(root);
                    if (helpers === undefined) {
                        throw new Error('Could not find helpers for a root. This is a bug in React Refresh.');
                    }
                    if (!failedRoots.has(root)) {}
                    if (rootElements === null) {
                        return;
                    }
                    if (!rootElements.has(root)) {
                        return;
                    }
                    var element = rootElements.get(root);
                    try {
                        helpers.scheduleRoot(root, element);
                    } catch (err) {
                        if (!didError) {
                            didError = true;
                            firstError = err;
                        } // Keep trying other roots.
                    }
                });
                mountedRootsSnapshot.forEach(function(root) {
                    var helpers = helpersByRootSnapshot.get(root);
                    if (helpers === undefined) {
                        throw new Error('Could not find helpers for a root. This is a bug in React Refresh.');
                    }
                    if (!mountedRoots.has(root)) {}
                    try {
                        helpers.scheduleRefresh(root, update);
                    } catch (err) {
                        if (!didError) {
                            didError = true;
                            firstError = err;
                        } // Keep trying other roots.
                    }
                });
                if (didError) {
                    throw firstError;
                }
                return update;
            } finally{
                isPerformingRefresh = false;
            }
        }
        function register(type, id) {
            {
                if (type === null) {
                    return;
                }
                if (typeof type !== 'function' && typeof type !== 'object') {
                    return;
                } // This can happen in an edge case, e.g. if we register
                // return value of a HOC but it returns a cached component.
                // Ignore anything but the first registration for each type.
                if (allFamiliesByType.has(type)) {
                    return;
                } // Create family or remember to update it.
                // None of this bookkeeping affects reconciliation
                // until the first performReactRefresh() call above.
                var family = allFamiliesByID.get(id);
                if (family === undefined) {
                    family = {
                        current: type
                    };
                    allFamiliesByID.set(id, family);
                } else {
                    pendingUpdates.push([
                        family,
                        type
                    ]);
                }
                allFamiliesByType.set(type, family); // Visit inner types because we might not have registered them.
                if (typeof type === 'object' && type !== null) {
                    switch(getProperty(type, '$$typeof')){
                        case REACT_FORWARD_REF_TYPE:
                            register(type.render, id + '$render');
                            break;
                        case REACT_MEMO_TYPE:
                            register(type.type, id + '$type');
                            break;
                    }
                }
            }
        }
        function setSignature(type, key) {
            var forceReset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
            var getCustomHooks = arguments.length > 3 ? arguments[3] : undefined;
            {
                if (!allSignaturesByType.has(type)) {
                    allSignaturesByType.set(type, {
                        forceReset: forceReset,
                        ownKey: key,
                        fullKey: null,
                        getCustomHooks: getCustomHooks || function() {
                            return [];
                        }
                    });
                } // Visit inner types because we might not have signed them.
                if (typeof type === 'object' && type !== null) {
                    switch(getProperty(type, '$$typeof')){
                        case REACT_FORWARD_REF_TYPE:
                            setSignature(type.render, key, forceReset, getCustomHooks);
                            break;
                        case REACT_MEMO_TYPE:
                            setSignature(type.type, key, forceReset, getCustomHooks);
                            break;
                    }
                }
            }
        } // This is lazily called during first render for a type.
        // It captures Hook list at that time so inline requires don't break comparisons.
        function collectCustomHooksForSignature(type) {
            {
                var signature = allSignaturesByType.get(type);
                if (signature !== undefined) {
                    computeFullKey(signature);
                }
            }
        }
        function getFamilyByID(id) {
            {
                return allFamiliesByID.get(id);
            }
        }
        function getFamilyByType(type) {
            {
                return allFamiliesByType.get(type);
            }
        }
        function findAffectedHostInstances(families) {
            {
                var affectedInstances = new Set();
                mountedRoots.forEach(function(root) {
                    var helpers = helpersByRoot.get(root);
                    if (helpers === undefined) {
                        throw new Error('Could not find helpers for a root. This is a bug in React Refresh.');
                    }
                    var instancesForRoot = helpers.findHostInstancesForRefresh(root, families);
                    instancesForRoot.forEach(function(inst) {
                        affectedInstances.add(inst);
                    });
                });
                return affectedInstances;
            }
        }
        function injectIntoGlobalHook(globalObject) {
            {
                // For React Native, the global hook will be set up by require('react-devtools-core').
                // That code will run before us. So we need to monkeypatch functions on existing hook.
                // For React Web, the global hook will be set up by the extension.
                // This will also run before us.
                var hook = globalObject.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                if (hook === undefined) {
                    // However, if there is no DevTools extension, we'll need to set up the global hook ourselves.
                    // Note that in this case it's important that renderer code runs *after* this method call.
                    // Otherwise, the renderer will think that there is no global hook, and won't do the injection.
                    var nextID = 0;
                    globalObject.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook = {
                        renderers: new Map(),
                        supportsFiber: true,
                        inject: function(injected) {
                            return nextID++;
                        },
                        onScheduleFiberRoot: function(id, root, children) {},
                        onCommitFiberRoot: function(id, root, maybePriorityLevel, didError) {},
                        onCommitFiberUnmount: function() {}
                    };
                }
                if (hook.isDisabled) {
                    // This isn't a real property on the hook, but it can be set to opt out
                    // of DevTools integration and associated warnings and logs.
                    // Using console['warn'] to evade Babel and ESLint
                    console['warn']('Something has shimmed the React DevTools global hook (__REACT_DEVTOOLS_GLOBAL_HOOK__). ' + 'Fast Refresh is not compatible with this shim and will be disabled.');
                    return;
                } // Here, we just want to get a reference to scheduleRefresh.
                var oldInject = hook.inject;
                hook.inject = function(injected) {
                    var id = oldInject.apply(this, arguments);
                    if (typeof injected.scheduleRefresh === 'function' && typeof injected.setRefreshHandler === 'function') {
                        // This version supports React Refresh.
                        helpersByRendererID.set(id, injected);
                    }
                    return id;
                }; // Do the same for any already injected roots.
                // This is useful if ReactDOM has already been initialized.
                // https://github.com/facebook/react/issues/17626
                hook.renderers.forEach(function(injected, id) {
                    if (typeof injected.scheduleRefresh === 'function' && typeof injected.setRefreshHandler === 'function') {
                        // This version supports React Refresh.
                        helpersByRendererID.set(id, injected);
                    }
                }); // We also want to track currently mounted roots.
                var oldOnCommitFiberRoot = hook.onCommitFiberRoot;
                var oldOnScheduleFiberRoot = hook.onScheduleFiberRoot || function() {};
                hook.onScheduleFiberRoot = function(id, root, children) {
                    if (!isPerformingRefresh) {
                        // If it was intentionally scheduled, don't attempt to restore.
                        // This includes intentionally scheduled unmounts.
                        failedRoots.delete(root);
                        if (rootElements !== null) {
                            rootElements.set(root, children);
                        }
                    }
                    return oldOnScheduleFiberRoot.apply(this, arguments);
                };
                hook.onCommitFiberRoot = function(id, root, maybePriorityLevel, didError) {
                    var helpers = helpersByRendererID.get(id);
                    if (helpers !== undefined) {
                        helpersByRoot.set(root, helpers);
                        var current = root.current;
                        var alternate = current.alternate; // We need to determine whether this root has just (un)mounted.
                        // This logic is copy-pasted from similar logic in the DevTools backend.
                        // If this breaks with some refactoring, you'll want to update DevTools too.
                        if (alternate !== null) {
                            var wasMounted = alternate.memoizedState != null && alternate.memoizedState.element != null && mountedRoots.has(root);
                            var isMounted = current.memoizedState != null && current.memoizedState.element != null;
                            if (!wasMounted && isMounted) {
                                // Mount a new root.
                                mountedRoots.add(root);
                                failedRoots.delete(root);
                            } else if (wasMounted && isMounted) ;
                            else if (wasMounted && !isMounted) {
                                // Unmount an existing root.
                                mountedRoots.delete(root);
                                if (didError) {
                                    // We'll remount it on future edits.
                                    failedRoots.add(root);
                                } else {
                                    helpersByRoot.delete(root);
                                }
                            } else if (!wasMounted && !isMounted) {
                                if (didError) {
                                    // We'll remount it on future edits.
                                    failedRoots.add(root);
                                }
                            }
                        } else {
                            // Mount a new root.
                            mountedRoots.add(root);
                        }
                    } // Always call the decorated DevTools hook.
                    return oldOnCommitFiberRoot.apply(this, arguments);
                };
            }
        }
        function hasUnrecoverableErrors() {
            // TODO: delete this after removing dependency in RN.
            return false;
        } // Exposed for testing.
        function _getMountedRootCount() {
            {
                return mountedRoots.size;
            }
        } // This is a wrapper over more primitive functions for setting signature.
        // Signatures let us decide whether the Hook order has changed on refresh.
        //
        // This function is intended to be used as a transform target, e.g.:
        // var _s = createSignatureFunctionForTransform()
        //
        // function Hello() {
        //   const [foo, setFoo] = useState(0);
        //   const value = useCustomHook();
        //   _s(); /* Call without arguments triggers collecting the custom Hook list.
        //          * This doesn't happen during the module evaluation because we
        //          * don't want to change the module order with inline requires.
        //          * Next calls are noops. */
        //   return <h1>Hi</h1>;
        // }
        //
        // /* Call with arguments attaches the signature to the type: */
        // _s(
        //   Hello,
        //   'useState{[foo, setFoo]}(0)',
        //   () => [useCustomHook], /* Lazy to avoid triggering inline requires */
        // );
        function createSignatureFunctionForTransform() {
            {
                var savedType;
                var hasCustomHooks;
                var didCollectHooks = false;
                return function(type, key, forceReset, getCustomHooks) {
                    if (typeof key === 'string') {
                        // We're in the initial phase that associates signatures
                        // with the functions. Note this may be called multiple times
                        // in HOC chains like _s(hoc1(_s(hoc2(_s(actualFunction))))).
                        if (!savedType) {
                            // We're in the innermost call, so this is the actual type.
                            savedType = type;
                            hasCustomHooks = typeof getCustomHooks === 'function';
                        } // Set the signature for all types (even wrappers!) in case
                        // they have no signatures of their own. This is to prevent
                        // problems like https://github.com/facebook/react/issues/20417.
                        if (type != null && (typeof type === 'function' || typeof type === 'object')) {
                            setSignature(type, key, forceReset, getCustomHooks);
                        }
                        return type;
                    } else {
                        // We're in the _s() call without arguments, which means
                        // this is the time to collect custom Hook signatures.
                        // Only do this once. This path is hot and runs *inside* every render!
                        if (!didCollectHooks && hasCustomHooks) {
                            didCollectHooks = true;
                            collectCustomHooksForSignature(savedType);
                        }
                    }
                };
            }
        }
        function isLikelyComponentType(type) {
            {
                switch(typeof type){
                    case 'function':
                        {
                            // First, deal with classes.
                            if (type.prototype != null) {
                                if (type.prototype.isReactComponent) {
                                    // React class.
                                    return true;
                                }
                                var ownNames = Object.getOwnPropertyNames(type.prototype);
                                if (ownNames.length > 1 || ownNames[0] !== 'constructor') {
                                    // This looks like a class.
                                    return false;
                                } // eslint-disable-next-line no-proto
                                if (type.prototype.__proto__ !== Object.prototype) {
                                    // It has a superclass.
                                    return false;
                                } // Pass through.
                            // This looks like a regular function with empty prototype.
                            } // For plain functions and arrows, use name as a heuristic.
                            var name = type.name || type.displayName;
                            return typeof name === 'string' && /^[A-Z]/.test(name);
                        }
                    case 'object':
                        {
                            if (type != null) {
                                switch(getProperty(type, '$$typeof')){
                                    case REACT_FORWARD_REF_TYPE:
                                    case REACT_MEMO_TYPE:
                                        // Definitely React components.
                                        return true;
                                    default:
                                        return false;
                                }
                            }
                            return false;
                        }
                    default:
                        {
                            return false;
                        }
                }
            }
        }
        exports._getMountedRootCount = _getMountedRootCount;
        exports.collectCustomHooksForSignature = collectCustomHooksForSignature;
        exports.createSignatureFunctionForTransform = createSignatureFunctionForTransform;
        exports.findAffectedHostInstances = findAffectedHostInstances;
        exports.getFamilyByID = getFamilyByID;
        exports.getFamilyByType = getFamilyByType;
        exports.hasUnrecoverableErrors = hasUnrecoverableErrors;
        exports.injectIntoGlobalHook = injectIntoGlobalHook;
        exports.isLikelyComponentType = isLikelyComponentType;
        exports.performReactRefresh = performReactRefresh;
        exports.register = register;
        exports.setSignature = setSignature;
    })();
}
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-refresh/runtime.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time falsy", 0) {
    "TURBOPACK unreachable";
} else {
    module.exports = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-refresh/cjs/react-refresh-runtime.development.js [app-client] (ecmascript)");
}
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/@next/react-refresh-utils/dist/internal/helpers.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
/**
 * MIT License
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */ var __importDefault = this && this.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
// This file is copied from the Metro JavaScript bundler, with minor tweaks for
// webpack 4 compatibility.
//
// https://github.com/facebook/metro/blob/d6b9685c730d0d63577db40f41369157f28dfa3a/packages/metro/src/lib/polyfills/require.js
const runtime_1 = __importDefault(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-refresh/runtime.js [app-client] (ecmascript)"));
function isSafeExport(key) {
    return key === '__esModule' || key === '__N_SSG' || key === '__N_SSP' || // TODO: remove this key from page config instead of allow listing it
    key === 'config';
}
function registerExportsForReactRefresh(moduleExports, moduleID) {
    runtime_1.default.register(moduleExports, moduleID + ' %exports%');
    if (moduleExports == null || typeof moduleExports !== 'object') {
        // Exit if we can't iterate over exports.
        // (This is important for legacy environments.)
        return;
    }
    for(var key in moduleExports){
        if (isSafeExport(key)) {
            continue;
        }
        try {
            var exportValue = moduleExports[key];
        } catch (_a) {
            continue;
        }
        var typeID = moduleID + ' %exports% ' + key;
        runtime_1.default.register(exportValue, typeID);
    }
}
function getRefreshBoundarySignature(moduleExports) {
    var signature = [];
    signature.push(runtime_1.default.getFamilyByType(moduleExports));
    if (moduleExports == null || typeof moduleExports !== 'object') {
        // Exit if we can't iterate over exports.
        // (This is important for legacy environments.)
        return signature;
    }
    for(var key in moduleExports){
        if (isSafeExport(key)) {
            continue;
        }
        try {
            var exportValue = moduleExports[key];
        } catch (_a) {
            continue;
        }
        signature.push(key);
        signature.push(runtime_1.default.getFamilyByType(exportValue));
    }
    return signature;
}
function isReactRefreshBoundary(moduleExports) {
    if (runtime_1.default.isLikelyComponentType(moduleExports)) {
        return true;
    }
    if (moduleExports == null || typeof moduleExports !== 'object') {
        // Exit if we can't iterate over exports.
        return false;
    }
    var hasExports = false;
    var areAllExportsComponents = true;
    for(var key in moduleExports){
        hasExports = true;
        if (isSafeExport(key)) {
            continue;
        }
        try {
            var exportValue = moduleExports[key];
        } catch (_a) {
            // This might fail due to circular dependencies
            return false;
        }
        if (!runtime_1.default.isLikelyComponentType(exportValue)) {
            areAllExportsComponents = false;
        }
    }
    return hasExports && areAllExportsComponents;
}
function shouldInvalidateReactRefreshBoundary(prevSignature, nextSignature) {
    if (prevSignature.length !== nextSignature.length) {
        return true;
    }
    for(var i = 0; i < nextSignature.length; i++){
        if (prevSignature[i] !== nextSignature[i]) {
            return true;
        }
    }
    return false;
}
var isUpdateScheduled = false;
// This function aggregates updates from multiple modules into a single React Refresh call.
function scheduleUpdate() {
    if (isUpdateScheduled) {
        return;
    }
    isUpdateScheduled = true;
    function canApplyUpdate(status) {
        return status === 'idle';
    }
    function applyUpdate() {
        isUpdateScheduled = false;
        try {
            runtime_1.default.performReactRefresh();
        } catch (err) {
            console.warn('Warning: Failed to re-render. We will retry on the next Fast Refresh event.\n' + err);
        }
    }
    if (canApplyUpdate(module.hot.status())) {
        // Apply update on the next tick.
        Promise.resolve().then(()=>{
            applyUpdate();
        });
        return;
    }
    const statusHandler = (status)=>{
        if (canApplyUpdate(status)) {
            module.hot.removeStatusHandler(statusHandler);
            applyUpdate();
        }
    };
    // Apply update once the HMR runtime's status is idle.
    module.hot.addStatusHandler(statusHandler);
}
// Needs to be compatible with IE11
exports.default = {
    registerExportsForReactRefresh: registerExportsForReactRefresh,
    isReactRefreshBoundary: isReactRefreshBoundary,
    shouldInvalidateReactRefreshBoundary: shouldInvalidateReactRefreshBoundary,
    getRefreshBoundarySignature: getRefreshBoundarySignature,
    scheduleUpdate: scheduleUpdate
}; //# sourceMappingURL=helpers.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/@next/react-refresh-utils/dist/runtime.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
"use strict";
var __importDefault = this && this.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
const runtime_1 = __importDefault(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-refresh/runtime.js [app-client] (ecmascript)"));
const helpers_1 = __importDefault(__turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/@next/react-refresh-utils/dist/internal/helpers.js [app-client] (ecmascript)"));
// Hook into ReactDOM initialization
runtime_1.default.injectIntoGlobalHook(self);
// Register global helpers
self.$RefreshHelpers$ = helpers_1.default;
// Register a helper for module execution interception
self.$RefreshInterceptModuleExecution$ = function(webpackModuleId) {
    var prevRefreshReg = self.$RefreshReg$;
    var prevRefreshSig = self.$RefreshSig$;
    self.$RefreshReg$ = function(type, id) {
        runtime_1.default.register(type, webpackModuleId + ' ' + id);
    };
    self.$RefreshSig$ = runtime_1.default.createSignatureFunctionForTransform;
    // Modeled after `useEffect` cleanup pattern:
    // https://react.dev/learn/synchronizing-with-effects#step-3-add-cleanup-if-needed
    return function() {
        self.$RefreshReg$ = prevRefreshReg;
        self.$RefreshSig$ = prevRefreshSig;
    };
}; //# sourceMappingURL=runtime.js.map
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/cjs/react.development.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
 * @license React
 * react.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
"production" !== ("TURBOPACK compile-time value", "development") && function() {
    function defineDeprecationWarning(methodName, info) {
        Object.defineProperty(Component.prototype, methodName, {
            get: function() {
                console.warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
            }
        });
    }
    function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
    }
    function warnNoop(publicInstance, callerName) {
        publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
        var warningKey = publicInstance + "." + callerName;
        didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, publicInstance), didWarnStateUpdateForUnmountedComponent[warningKey] = !0);
    }
    function Component(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
    }
    function ComponentDummy() {}
    function PureComponent(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
    }
    function testStringCoercion(value) {
        return "" + value;
    }
    function checkKeyStringCoercion(value) {
        try {
            testStringCoercion(value);
            var JSCompiler_inline_result = !1;
        } catch (e) {
            JSCompiler_inline_result = !0;
        }
        if (JSCompiler_inline_result) {
            JSCompiler_inline_result = console;
            var JSCompiler_temp_const = JSCompiler_inline_result.error;
            var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
            return testStringCoercion(value);
        }
    }
    function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE$2 ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch(type){
            case REACT_FRAGMENT_TYPE:
                return "Fragment";
            case REACT_PORTAL_TYPE:
                return "Portal";
            case REACT_PROFILER_TYPE:
                return "Profiler";
            case REACT_STRICT_MODE_TYPE:
                return "StrictMode";
            case REACT_SUSPENSE_TYPE:
                return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
        }
        if ("object" === typeof type) switch("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof){
            case REACT_CONTEXT_TYPE:
                return (type.displayName || "Context") + ".Provider";
            case REACT_CONSUMER_TYPE:
                return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
                var innerType = type.render;
                type = type.displayName;
                type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                return type;
            case REACT_MEMO_TYPE:
                return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
                innerType = type._payload;
                type = type._init;
                try {
                    return getComponentNameFromType(type(innerType));
                } catch (x) {}
        }
        return null;
    }
    function isValidElementType(type) {
        return "string" === typeof type || "function" === typeof type || type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || type === REACT_OFFSCREEN_TYPE || "object" === typeof type && null !== type && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_CONSUMER_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_CLIENT_REFERENCE$1 || void 0 !== type.getModuleId) ? !0 : !1;
    }
    function disabledLog() {}
    function disableLogs() {
        if (0 === disabledDepth) {
            prevLog = console.log;
            prevInfo = console.info;
            prevWarn = console.warn;
            prevError = console.error;
            prevGroup = console.group;
            prevGroupCollapsed = console.groupCollapsed;
            prevGroupEnd = console.groupEnd;
            var props = {
                configurable: !0,
                enumerable: !0,
                value: disabledLog,
                writable: !0
            };
            Object.defineProperties(console, {
                info: props,
                log: props,
                warn: props,
                error: props,
                group: props,
                groupCollapsed: props,
                groupEnd: props
            });
        }
        disabledDepth++;
    }
    function reenableLogs() {
        disabledDepth--;
        if (0 === disabledDepth) {
            var props = {
                configurable: !0,
                enumerable: !0,
                writable: !0
            };
            Object.defineProperties(console, {
                log: assign({}, props, {
                    value: prevLog
                }),
                info: assign({}, props, {
                    value: prevInfo
                }),
                warn: assign({}, props, {
                    value: prevWarn
                }),
                error: assign({}, props, {
                    value: prevError
                }),
                group: assign({}, props, {
                    value: prevGroup
                }),
                groupCollapsed: assign({}, props, {
                    value: prevGroupCollapsed
                }),
                groupEnd: assign({}, props, {
                    value: prevGroupEnd
                })
            });
        }
        0 > disabledDepth && console.error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
    }
    function describeBuiltInComponentFrame(name) {
        if (void 0 === prefix) try {
            throw Error();
        } catch (x) {
            var match = x.stack.trim().match(/\n( *(at )?)/);
            prefix = match && match[1] || "";
            suffix = -1 < x.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < x.stack.indexOf("@") ? "@unknown:0:0" : "";
        }
        return "\n" + prefix + name + suffix;
    }
    function describeNativeComponentFrame(fn, construct) {
        if (!fn || reentry) return "";
        var frame = componentFrameCache.get(fn);
        if (void 0 !== frame) return frame;
        reentry = !0;
        frame = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        var previousDispatcher = null;
        previousDispatcher = ReactSharedInternals.H;
        ReactSharedInternals.H = null;
        disableLogs();
        try {
            var RunInRootFrame = {
                DetermineComponentFrameRoot: function() {
                    try {
                        if (construct) {
                            var Fake = function() {
                                throw Error();
                            };
                            Object.defineProperty(Fake.prototype, "props", {
                                set: function() {
                                    throw Error();
                                }
                            });
                            if ("object" === typeof Reflect && Reflect.construct) {
                                try {
                                    Reflect.construct(Fake, []);
                                } catch (x) {
                                    var control = x;
                                }
                                Reflect.construct(fn, [], Fake);
                            } else {
                                try {
                                    Fake.call();
                                } catch (x$0) {
                                    control = x$0;
                                }
                                fn.call(Fake.prototype);
                            }
                        } else {
                            try {
                                throw Error();
                            } catch (x$1) {
                                control = x$1;
                            }
                            (Fake = fn()) && "function" === typeof Fake.catch && Fake.catch(function() {});
                        }
                    } catch (sample) {
                        if (sample && control && "string" === typeof sample.stack) return [
                            sample.stack,
                            control.stack
                        ];
                    }
                    return [
                        null,
                        null
                    ];
                }
            };
            RunInRootFrame.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
            var namePropDescriptor = Object.getOwnPropertyDescriptor(RunInRootFrame.DetermineComponentFrameRoot, "name");
            namePropDescriptor && namePropDescriptor.configurable && Object.defineProperty(RunInRootFrame.DetermineComponentFrameRoot, "name", {
                value: "DetermineComponentFrameRoot"
            });
            var _RunInRootFrame$Deter = RunInRootFrame.DetermineComponentFrameRoot(), sampleStack = _RunInRootFrame$Deter[0], controlStack = _RunInRootFrame$Deter[1];
            if (sampleStack && controlStack) {
                var sampleLines = sampleStack.split("\n"), controlLines = controlStack.split("\n");
                for(_RunInRootFrame$Deter = namePropDescriptor = 0; namePropDescriptor < sampleLines.length && !sampleLines[namePropDescriptor].includes("DetermineComponentFrameRoot");)namePropDescriptor++;
                for(; _RunInRootFrame$Deter < controlLines.length && !controlLines[_RunInRootFrame$Deter].includes("DetermineComponentFrameRoot");)_RunInRootFrame$Deter++;
                if (namePropDescriptor === sampleLines.length || _RunInRootFrame$Deter === controlLines.length) for(namePropDescriptor = sampleLines.length - 1, _RunInRootFrame$Deter = controlLines.length - 1; 1 <= namePropDescriptor && 0 <= _RunInRootFrame$Deter && sampleLines[namePropDescriptor] !== controlLines[_RunInRootFrame$Deter];)_RunInRootFrame$Deter--;
                for(; 1 <= namePropDescriptor && 0 <= _RunInRootFrame$Deter; namePropDescriptor--, _RunInRootFrame$Deter--)if (sampleLines[namePropDescriptor] !== controlLines[_RunInRootFrame$Deter]) {
                    if (1 !== namePropDescriptor || 1 !== _RunInRootFrame$Deter) {
                        do if (namePropDescriptor--, _RunInRootFrame$Deter--, 0 > _RunInRootFrame$Deter || sampleLines[namePropDescriptor] !== controlLines[_RunInRootFrame$Deter]) {
                            var _frame = "\n" + sampleLines[namePropDescriptor].replace(" at new ", " at ");
                            fn.displayName && _frame.includes("<anonymous>") && (_frame = _frame.replace("<anonymous>", fn.displayName));
                            "function" === typeof fn && componentFrameCache.set(fn, _frame);
                            return _frame;
                        }
                        while (1 <= namePropDescriptor && 0 <= _RunInRootFrame$Deter)
                    }
                    break;
                }
            }
        } finally{
            reentry = !1, ReactSharedInternals.H = previousDispatcher, reenableLogs(), Error.prepareStackTrace = frame;
        }
        sampleLines = (sampleLines = fn ? fn.displayName || fn.name : "") ? describeBuiltInComponentFrame(sampleLines) : "";
        "function" === typeof fn && componentFrameCache.set(fn, sampleLines);
        return sampleLines;
    }
    function describeUnknownElementTypeFrameInDEV(type) {
        if (null == type) return "";
        if ("function" === typeof type) {
            var prototype = type.prototype;
            return describeNativeComponentFrame(type, !(!prototype || !prototype.isReactComponent));
        }
        if ("string" === typeof type) return describeBuiltInComponentFrame(type);
        switch(type){
            case REACT_SUSPENSE_TYPE:
                return describeBuiltInComponentFrame("Suspense");
            case REACT_SUSPENSE_LIST_TYPE:
                return describeBuiltInComponentFrame("SuspenseList");
        }
        if ("object" === typeof type) switch(type.$$typeof){
            case REACT_FORWARD_REF_TYPE:
                return type = describeNativeComponentFrame(type.render, !1), type;
            case REACT_MEMO_TYPE:
                return describeUnknownElementTypeFrameInDEV(type.type);
            case REACT_LAZY_TYPE:
                prototype = type._payload;
                type = type._init;
                try {
                    return describeUnknownElementTypeFrameInDEV(type(prototype));
                } catch (x) {}
        }
        return "";
    }
    function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
    }
    function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
            var getter = Object.getOwnPropertyDescriptor(config, "key").get;
            if (getter && getter.isReactWarning) return !1;
        }
        return void 0 !== config.key;
    }
    function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
            specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
        }
        warnAboutAccessingKey.isReactWarning = !0;
        Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: !0
        });
    }
    function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
    }
    function ReactElement(type, key, self, source, owner, props) {
        self = props.ref;
        type = {
            $$typeof: REACT_ELEMENT_TYPE,
            type: type,
            key: key,
            props: props,
            _owner: owner
        };
        null !== (void 0 !== self ? self : null) ? Object.defineProperty(type, "ref", {
            enumerable: !1,
            get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", {
            enumerable: !1,
            value: null
        });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: null
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
    }
    function cloneAndReplaceKey(oldElement, newKey) {
        newKey = ReactElement(oldElement.type, newKey, void 0, void 0, oldElement._owner, oldElement.props);
        newKey._store.validated = oldElement._store.validated;
        return newKey;
    }
    function validateChildKeys(node, parentType) {
        if ("object" === typeof node && node && node.$$typeof !== REACT_CLIENT_REFERENCE) {
            if (isArrayImpl(node)) for(var i = 0; i < node.length; i++){
                var child = node[i];
                isValidElement(child) && validateExplicitKey(child, parentType);
            }
            else if (isValidElement(node)) node._store && (node._store.validated = 1);
            else if (i = getIteratorFn(node), "function" === typeof i && i !== node.entries && (i = i.call(node), i !== node)) for(; !(node = i.next()).done;)isValidElement(node.value) && validateExplicitKey(node.value, parentType);
        }
    }
    function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    function validateExplicitKey(element, parentType) {
        if (element._store && !element._store.validated && null == element.key && (element._store.validated = 1, parentType = getCurrentComponentErrorInfo(parentType), !ownerHasKeyUseWarning[parentType])) {
            ownerHasKeyUseWarning[parentType] = !0;
            var childOwner = "";
            element && null != element._owner && element._owner !== getOwner() && (childOwner = null, "number" === typeof element._owner.tag ? childOwner = getComponentNameFromType(element._owner.type) : "string" === typeof element._owner.name && (childOwner = element._owner.name), childOwner = " It was passed a child from " + childOwner + ".");
            var prevGetCurrentStack = ReactSharedInternals.getCurrentStack;
            ReactSharedInternals.getCurrentStack = function() {
                var stack = describeUnknownElementTypeFrameInDEV(element.type);
                prevGetCurrentStack && (stack += prevGetCurrentStack() || "");
                return stack;
            };
            console.error('Each child in a list should have a unique "key" prop.%s%s See https://react.dev/link/warning-keys for more information.', parentType, childOwner);
            ReactSharedInternals.getCurrentStack = prevGetCurrentStack;
        }
    }
    function getCurrentComponentErrorInfo(parentType) {
        var info = "", owner = getOwner();
        owner && (owner = getComponentNameFromType(owner.type)) && (info = "\n\nCheck the render method of `" + owner + "`.");
        info || (parentType = getComponentNameFromType(parentType)) && (info = "\n\nCheck the top-level render call using <" + parentType + ">.");
        return info;
    }
    function escape(key) {
        var escaperLookup = {
            "=": "=0",
            ":": "=2"
        };
        return "$" + key.replace(/[=:]/g, function(match) {
            return escaperLookup[match];
        });
    }
    function getElementKey(element, index) {
        return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
    }
    function noop$1() {}
    function resolveThenable(thenable) {
        switch(thenable.status){
            case "fulfilled":
                return thenable.value;
            case "rejected":
                throw thenable.reason;
            default:
                switch("string" === typeof thenable.status ? thenable.then(noop$1, noop$1) : (thenable.status = "pending", thenable.then(function(fulfilledValue) {
                    "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
                }, function(error) {
                    "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
                })), thenable.status){
                    case "fulfilled":
                        return thenable.value;
                    case "rejected":
                        throw thenable.reason;
                }
        }
        throw thenable;
    }
    function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
        var type = typeof children;
        if ("undefined" === type || "boolean" === type) children = null;
        var invokeCallback = !1;
        if (null === children) invokeCallback = !0;
        else switch(type){
            case "bigint":
            case "string":
            case "number":
                invokeCallback = !0;
                break;
            case "object":
                switch(children.$$typeof){
                    case REACT_ELEMENT_TYPE:
                    case REACT_PORTAL_TYPE:
                        invokeCallback = !0;
                        break;
                    case REACT_LAZY_TYPE:
                        return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
                }
        }
        if (invokeCallback) {
            invokeCallback = children;
            callback = callback(invokeCallback);
            var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
            isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
                return c;
            })) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(callback, escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + childKey), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
            return 1;
        }
        invokeCallback = 0;
        childKey = "" === nameSoFar ? "." : nameSoFar + ":";
        if (isArrayImpl(children)) for(var i = 0; i < children.length; i++)nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
        else if (i = getIteratorFn(children), "function" === typeof i) for(i === children.entries && (didWarnAboutMaps || console.warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead."), didWarnAboutMaps = !0), children = i.call(children), i = 0; !(nameSoFar = children.next()).done;)nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
        else if ("object" === type) {
            if ("function" === typeof children.then) return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
            array = String(children);
            throw Error("Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
        }
        return invokeCallback;
    }
    function mapChildren(children, func, context) {
        if (null == children) return children;
        var result = [], count = 0;
        mapIntoArray(children, result, "", "", function(child) {
            return func.call(context, child, count++);
        });
        return result;
    }
    function lazyInitializer(payload) {
        if (-1 === payload._status) {
            var ctor = payload._result;
            ctor = ctor();
            ctor.then(function(moduleObject) {
                if (0 === payload._status || -1 === payload._status) payload._status = 1, payload._result = moduleObject;
            }, function(error) {
                if (0 === payload._status || -1 === payload._status) payload._status = 2, payload._result = error;
            });
            -1 === payload._status && (payload._status = 0, payload._result = ctor);
        }
        if (1 === payload._status) return ctor = payload._result, void 0 === ctor && console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", ctor), "default" in ctor || console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", ctor), ctor.default;
        throw payload._result;
    }
    function resolveDispatcher() {
        var dispatcher = ReactSharedInternals.H;
        null === dispatcher && console.error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.");
        return dispatcher;
    }
    function noop() {}
    function enqueueTask(task) {
        if (null === enqueueTaskImpl) try {
            var requireString = ("require" + Math.random()).slice(0, 7);
            enqueueTaskImpl = (module && module[requireString]).call(module, "timers").setImmediate;
        } catch (_err) {
            enqueueTaskImpl = function(callback) {
                !1 === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = !0, "undefined" === typeof MessageChannel && console.error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."));
                var channel = new MessageChannel();
                channel.port1.onmessage = callback;
                channel.port2.postMessage(void 0);
            };
        }
        return enqueueTaskImpl(task);
    }
    function aggregateErrors(errors) {
        return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
    }
    function popActScope(prevActQueue, prevActScopeDepth) {
        prevActScopeDepth !== actScopeDepth - 1 && console.error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
        actScopeDepth = prevActScopeDepth;
    }
    function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
        var queue = ReactSharedInternals.actQueue;
        if (null !== queue) if (0 !== queue.length) try {
            flushActQueue(queue);
            enqueueTask(function() {
                return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
            });
            return;
        } catch (error) {
            ReactSharedInternals.thrownErrors.push(error);
        }
        else ReactSharedInternals.actQueue = null;
        0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
    }
    function flushActQueue(queue) {
        if (!isFlushing) {
            isFlushing = !0;
            var i = 0;
            try {
                for(; i < queue.length; i++){
                    var callback = queue[i];
                    do {
                        ReactSharedInternals.didUsePromise = !1;
                        var continuation = callback(!1);
                        if (null !== continuation) {
                            if (ReactSharedInternals.didUsePromise) {
                                queue[i] = callback;
                                queue.splice(0, i);
                                return;
                            }
                            callback = continuation;
                        } else break;
                    }while (1)
                }
                queue.length = 0;
            } catch (error) {
                queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
            } finally{
                isFlushing = !1;
            }
        }
    }
    "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler");
    Symbol.for("react.provider");
    var REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
        isMounted: function() {
            return !1;
        },
        enqueueForceUpdate: function(publicInstance) {
            warnNoop(publicInstance, "forceUpdate");
        },
        enqueueReplaceState: function(publicInstance) {
            warnNoop(publicInstance, "replaceState");
        },
        enqueueSetState: function(publicInstance) {
            warnNoop(publicInstance, "setState");
        }
    }, assign = Object.assign, emptyObject = {};
    Object.freeze(emptyObject);
    Component.prototype.isReactComponent = {};
    Component.prototype.setState = function(partialState, callback) {
        if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
        this.updater.enqueueSetState(this, partialState, callback, "setState");
    };
    Component.prototype.forceUpdate = function(callback) {
        this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
    };
    var deprecatedAPIs = {
        isMounted: [
            "isMounted",
            "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
        ],
        replaceState: [
            "replaceState",
            "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
        ]
    }, fnName;
    for(fnName in deprecatedAPIs)deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
    ComponentDummy.prototype = Component.prototype;
    deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
    deprecatedAPIs.constructor = PureComponent;
    assign(deprecatedAPIs, Component.prototype);
    deprecatedAPIs.isPureReactComponent = !0;
    var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE$2 = Symbol.for("react.client.reference"), ReactSharedInternals = {
        H: null,
        A: null,
        T: null,
        S: null,
        actQueue: null,
        isBatchingLegacy: !1,
        didScheduleLegacyUpdate: !1,
        didUsePromise: !1,
        thrownErrors: [],
        getCurrentStack: null
    }, hasOwnProperty = Object.prototype.hasOwnProperty, REACT_CLIENT_REFERENCE$1 = Symbol.for("react.client.reference"), disabledDepth = 0, prevLog, prevInfo, prevWarn, prevError, prevGroup, prevGroupCollapsed, prevGroupEnd;
    disabledLog.__reactDisabledLog = !0;
    var prefix, suffix, reentry = !1;
    var componentFrameCache = new ("function" === typeof WeakMap ? WeakMap : Map)();
    var REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
    var didWarnAboutElementRef = {};
    var ownerHasKeyUseWarning = {}, didWarnAboutMaps = !1, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
            var event = new window.ErrorEvent("error", {
                bubbles: !0,
                cancelable: !0,
                message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
                error: error
            });
            if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"] && "function" === typeof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].emit) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].emit("uncaughtException", error);
            return;
        }
        console.error(error);
    }, didWarnAboutMessageChannel = !1, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = !1, isFlushing = !1, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
        queueMicrotask(function() {
            return queueMicrotask(callback);
        });
    } : enqueueTask;
    exports.Children = {
        map: mapChildren,
        forEach: function(children, forEachFunc, forEachContext) {
            mapChildren(children, function() {
                forEachFunc.apply(this, arguments);
            }, forEachContext);
        },
        count: function(children) {
            var n = 0;
            mapChildren(children, function() {
                n++;
            });
            return n;
        },
        toArray: function(children) {
            return mapChildren(children, function(child) {
                return child;
            }) || [];
        },
        only: function(children) {
            if (!isValidElement(children)) throw Error("React.Children.only expected to receive a single React element child.");
            return children;
        }
    };
    exports.Component = Component;
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.Profiler = REACT_PROFILER_TYPE;
    exports.PureComponent = PureComponent;
    exports.StrictMode = REACT_STRICT_MODE_TYPE;
    exports.Suspense = REACT_SUSPENSE_TYPE;
    exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
    exports.act = function(callback) {
        var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
        actScopeDepth++;
        var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = !1;
        try {
            var result = callback();
        } catch (error) {
            ReactSharedInternals.thrownErrors.push(error);
        }
        if (0 < ReactSharedInternals.thrownErrors.length) throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        if (null !== result && "object" === typeof result && "function" === typeof result.then) {
            var thenable = result;
            queueSeveralMicrotasks(function() {
                didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"));
            });
            return {
                then: function(resolve, reject) {
                    didAwaitActCall = !0;
                    thenable.then(function(returnValue) {
                        popActScope(prevActQueue, prevActScopeDepth);
                        if (0 === prevActScopeDepth) {
                            try {
                                flushActQueue(queue), enqueueTask(function() {
                                    return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                                });
                            } catch (error$2) {
                                ReactSharedInternals.thrownErrors.push(error$2);
                            }
                            if (0 < ReactSharedInternals.thrownErrors.length) {
                                var _thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
                                ReactSharedInternals.thrownErrors.length = 0;
                                reject(_thrownError);
                            }
                        } else resolve(returnValue);
                    }, function(error) {
                        popActScope(prevActQueue, prevActScopeDepth);
                        0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
                    });
                }
            };
        }
        var returnValue$jscomp$0 = result;
        popActScope(prevActQueue, prevActScopeDepth);
        0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
            didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"));
        }), ReactSharedInternals.actQueue = null);
        if (0 < ReactSharedInternals.thrownErrors.length) throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        return {
            then: function(resolve, reject) {
                didAwaitActCall = !0;
                0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
                    return recursivelyFlushAsyncActWork(returnValue$jscomp$0, resolve, reject);
                })) : resolve(returnValue$jscomp$0);
            }
        };
    };
    exports.cache = function(fn) {
        return function() {
            return fn.apply(null, arguments);
        };
    };
    exports.cloneElement = function(element, config, children) {
        if (null === element || void 0 === element) throw Error("The argument must be a React element, but you passed " + element + ".");
        var props = assign({}, element.props), key = element.key, owner = element._owner;
        if (null != config) {
            var JSCompiler_inline_result;
            a: {
                if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(config, "ref").get) && JSCompiler_inline_result.isReactWarning) {
                    JSCompiler_inline_result = !1;
                    break a;
                }
                JSCompiler_inline_result = void 0 !== config.ref;
            }
            JSCompiler_inline_result && (owner = getOwner());
            hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
            for(propName in config)!hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
        }
        var propName = arguments.length - 2;
        if (1 === propName) props.children = children;
        else if (1 < propName) {
            JSCompiler_inline_result = Array(propName);
            for(var i = 0; i < propName; i++)JSCompiler_inline_result[i] = arguments[i + 2];
            props.children = JSCompiler_inline_result;
        }
        props = ReactElement(element.type, key, void 0, void 0, owner, props);
        for(key = 2; key < arguments.length; key++)validateChildKeys(arguments[key], props.type);
        return props;
    };
    exports.createContext = function(defaultValue) {
        defaultValue = {
            $$typeof: REACT_CONTEXT_TYPE,
            _currentValue: defaultValue,
            _currentValue2: defaultValue,
            _threadCount: 0,
            Provider: null,
            Consumer: null
        };
        defaultValue.Provider = defaultValue;
        defaultValue.Consumer = {
            $$typeof: REACT_CONSUMER_TYPE,
            _context: defaultValue
        };
        defaultValue._currentRenderer = null;
        defaultValue._currentRenderer2 = null;
        return defaultValue;
    };
    exports.createElement = function(type, config, children) {
        if (isValidElementType(type)) for(var i = 2; i < arguments.length; i++)validateChildKeys(arguments[i], type);
        else {
            i = "";
            if (void 0 === type || "object" === typeof type && null !== type && 0 === Object.keys(type).length) i += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
            if (null === type) var typeString = "null";
            else isArrayImpl(type) ? typeString = "array" : void 0 !== type && type.$$typeof === REACT_ELEMENT_TYPE ? (typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />", i = " Did you accidentally export a JSX literal instead of a component?") : typeString = typeof type;
            console.error("React.createElement: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, i);
        }
        var propName;
        i = {};
        typeString = null;
        if (null != config) for(propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = !0, console.warn("Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform")), hasValidKey(config) && (checkKeyStringCoercion(config.key), typeString = "" + config.key), config)hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i[propName] = config[propName]);
        var childrenLength = arguments.length - 2;
        if (1 === childrenLength) i.children = children;
        else if (1 < childrenLength) {
            for(var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++)childArray[_i] = arguments[_i + 2];
            Object.freeze && Object.freeze(childArray);
            i.children = childArray;
        }
        if (type && type.defaultProps) for(propName in childrenLength = type.defaultProps, childrenLength)void 0 === i[propName] && (i[propName] = childrenLength[propName]);
        typeString && defineKeyPropWarningGetter(i, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
        return ReactElement(type, typeString, void 0, void 0, getOwner(), i);
    };
    exports.createRef = function() {
        var refObject = {
            current: null
        };
        Object.seal(refObject);
        return refObject;
    };
    exports.forwardRef = function(render) {
        null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).") : "function" !== typeof render ? console.error("forwardRef requires a render function but was given %s.", null === render ? "null" : typeof render) : 0 !== render.length && 2 !== render.length && console.error("forwardRef render functions accept exactly two parameters: props and ref. %s", 1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
        null != render && null != render.defaultProps && console.error("forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?");
        var elementType = {
            $$typeof: REACT_FORWARD_REF_TYPE,
            render: render
        }, ownName;
        Object.defineProperty(elementType, "displayName", {
            enumerable: !1,
            configurable: !0,
            get: function() {
                return ownName;
            },
            set: function(name) {
                ownName = name;
                render.name || render.displayName || (Object.defineProperty(render, "name", {
                    value: name
                }), render.displayName = name);
            }
        });
        return elementType;
    };
    exports.isValidElement = isValidElement;
    exports.lazy = function(ctor) {
        return {
            $$typeof: REACT_LAZY_TYPE,
            _payload: {
                _status: -1,
                _result: ctor
            },
            _init: lazyInitializer
        };
    };
    exports.memo = function(type, compare) {
        isValidElementType(type) || console.error("memo: The first argument must be a component. Instead received: %s", null === type ? "null" : typeof type);
        compare = {
            $$typeof: REACT_MEMO_TYPE,
            type: type,
            compare: void 0 === compare ? null : compare
        };
        var ownName;
        Object.defineProperty(compare, "displayName", {
            enumerable: !1,
            configurable: !0,
            get: function() {
                return ownName;
            },
            set: function(name) {
                ownName = name;
                type.name || type.displayName || (Object.defineProperty(type, "name", {
                    value: name
                }), type.displayName = name);
            }
        });
        return compare;
    };
    exports.startTransition = function(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        ReactSharedInternals.T = currentTransition;
        currentTransition._updatedFibers = new Set();
        try {
            var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
            null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
            "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
        } catch (error) {
            reportGlobalError(error);
        } finally{
            null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.")), ReactSharedInternals.T = prevTransition;
        }
    };
    exports.unstable_useCacheRefresh = function() {
        return resolveDispatcher().useCacheRefresh();
    };
    exports.use = function(usable) {
        return resolveDispatcher().use(usable);
    };
    exports.useActionState = function(action, initialState, permalink) {
        return resolveDispatcher().useActionState(action, initialState, permalink);
    };
    exports.useCallback = function(callback, deps) {
        return resolveDispatcher().useCallback(callback, deps);
    };
    exports.useContext = function(Context) {
        var dispatcher = resolveDispatcher();
        Context.$$typeof === REACT_CONSUMER_TYPE && console.error("Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?");
        return dispatcher.useContext(Context);
    };
    exports.useDebugValue = function(value, formatterFn) {
        return resolveDispatcher().useDebugValue(value, formatterFn);
    };
    exports.useDeferredValue = function(value, initialValue) {
        return resolveDispatcher().useDeferredValue(value, initialValue);
    };
    exports.useEffect = function(create, deps) {
        return resolveDispatcher().useEffect(create, deps);
    };
    exports.useId = function() {
        return resolveDispatcher().useId();
    };
    exports.useImperativeHandle = function(ref, create, deps) {
        return resolveDispatcher().useImperativeHandle(ref, create, deps);
    };
    exports.useInsertionEffect = function(create, deps) {
        return resolveDispatcher().useInsertionEffect(create, deps);
    };
    exports.useLayoutEffect = function(create, deps) {
        return resolveDispatcher().useLayoutEffect(create, deps);
    };
    exports.useMemo = function(create, deps) {
        return resolveDispatcher().useMemo(create, deps);
    };
    exports.useOptimistic = function(passthrough, reducer) {
        return resolveDispatcher().useOptimistic(passthrough, reducer);
    };
    exports.useReducer = function(reducer, initialArg, init) {
        return resolveDispatcher().useReducer(reducer, initialArg, init);
    };
    exports.useRef = function(initialValue) {
        return resolveDispatcher().useRef(initialValue);
    };
    exports.useState = function(initialState) {
        return resolveDispatcher().useState(initialState);
    };
    exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
        return resolveDispatcher().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    };
    exports.useTransition = function() {
        return resolveDispatcher().useTransition();
    };
    exports.version = "19.0.0-rc-66855b96-20241106";
    "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
}();
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time falsy", 0) {
    "TURBOPACK unreachable";
} else {
    module.exports = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/cjs/react.development.js [app-client] (ecmascript)");
}
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/cjs/react-jsx-runtime.development.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
"production" !== ("TURBOPACK compile-time value", "development") && function() {
    function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE$2 ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch(type){
            case REACT_FRAGMENT_TYPE:
                return "Fragment";
            case REACT_PORTAL_TYPE:
                return "Portal";
            case REACT_PROFILER_TYPE:
                return "Profiler";
            case REACT_STRICT_MODE_TYPE:
                return "StrictMode";
            case REACT_SUSPENSE_TYPE:
                return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
        }
        if ("object" === typeof type) switch("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof){
            case REACT_CONTEXT_TYPE:
                return (type.displayName || "Context") + ".Provider";
            case REACT_CONSUMER_TYPE:
                return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
                var innerType = type.render;
                type = type.displayName;
                type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                return type;
            case REACT_MEMO_TYPE:
                return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
                innerType = type._payload;
                type = type._init;
                try {
                    return getComponentNameFromType(type(innerType));
                } catch (x) {}
        }
        return null;
    }
    function testStringCoercion(value) {
        return "" + value;
    }
    function checkKeyStringCoercion(value) {
        try {
            testStringCoercion(value);
            var JSCompiler_inline_result = !1;
        } catch (e) {
            JSCompiler_inline_result = !0;
        }
        if (JSCompiler_inline_result) {
            JSCompiler_inline_result = console;
            var JSCompiler_temp_const = JSCompiler_inline_result.error;
            var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
            return testStringCoercion(value);
        }
    }
    function disabledLog() {}
    function disableLogs() {
        if (0 === disabledDepth) {
            prevLog = console.log;
            prevInfo = console.info;
            prevWarn = console.warn;
            prevError = console.error;
            prevGroup = console.group;
            prevGroupCollapsed = console.groupCollapsed;
            prevGroupEnd = console.groupEnd;
            var props = {
                configurable: !0,
                enumerable: !0,
                value: disabledLog,
                writable: !0
            };
            Object.defineProperties(console, {
                info: props,
                log: props,
                warn: props,
                error: props,
                group: props,
                groupCollapsed: props,
                groupEnd: props
            });
        }
        disabledDepth++;
    }
    function reenableLogs() {
        disabledDepth--;
        if (0 === disabledDepth) {
            var props = {
                configurable: !0,
                enumerable: !0,
                writable: !0
            };
            Object.defineProperties(console, {
                log: assign({}, props, {
                    value: prevLog
                }),
                info: assign({}, props, {
                    value: prevInfo
                }),
                warn: assign({}, props, {
                    value: prevWarn
                }),
                error: assign({}, props, {
                    value: prevError
                }),
                group: assign({}, props, {
                    value: prevGroup
                }),
                groupCollapsed: assign({}, props, {
                    value: prevGroupCollapsed
                }),
                groupEnd: assign({}, props, {
                    value: prevGroupEnd
                })
            });
        }
        0 > disabledDepth && console.error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
    }
    function describeBuiltInComponentFrame(name) {
        if (void 0 === prefix) try {
            throw Error();
        } catch (x) {
            var match = x.stack.trim().match(/\n( *(at )?)/);
            prefix = match && match[1] || "";
            suffix = -1 < x.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < x.stack.indexOf("@") ? "@unknown:0:0" : "";
        }
        return "\n" + prefix + name + suffix;
    }
    function describeNativeComponentFrame(fn, construct) {
        if (!fn || reentry) return "";
        var frame = componentFrameCache.get(fn);
        if (void 0 !== frame) return frame;
        reentry = !0;
        frame = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        var previousDispatcher = null;
        previousDispatcher = ReactSharedInternals.H;
        ReactSharedInternals.H = null;
        disableLogs();
        try {
            var RunInRootFrame = {
                DetermineComponentFrameRoot: function() {
                    try {
                        if (construct) {
                            var Fake = function() {
                                throw Error();
                            };
                            Object.defineProperty(Fake.prototype, "props", {
                                set: function() {
                                    throw Error();
                                }
                            });
                            if ("object" === typeof Reflect && Reflect.construct) {
                                try {
                                    Reflect.construct(Fake, []);
                                } catch (x) {
                                    var control = x;
                                }
                                Reflect.construct(fn, [], Fake);
                            } else {
                                try {
                                    Fake.call();
                                } catch (x$0) {
                                    control = x$0;
                                }
                                fn.call(Fake.prototype);
                            }
                        } else {
                            try {
                                throw Error();
                            } catch (x$1) {
                                control = x$1;
                            }
                            (Fake = fn()) && "function" === typeof Fake.catch && Fake.catch(function() {});
                        }
                    } catch (sample) {
                        if (sample && control && "string" === typeof sample.stack) return [
                            sample.stack,
                            control.stack
                        ];
                    }
                    return [
                        null,
                        null
                    ];
                }
            };
            RunInRootFrame.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
            var namePropDescriptor = Object.getOwnPropertyDescriptor(RunInRootFrame.DetermineComponentFrameRoot, "name");
            namePropDescriptor && namePropDescriptor.configurable && Object.defineProperty(RunInRootFrame.DetermineComponentFrameRoot, "name", {
                value: "DetermineComponentFrameRoot"
            });
            var _RunInRootFrame$Deter = RunInRootFrame.DetermineComponentFrameRoot(), sampleStack = _RunInRootFrame$Deter[0], controlStack = _RunInRootFrame$Deter[1];
            if (sampleStack && controlStack) {
                var sampleLines = sampleStack.split("\n"), controlLines = controlStack.split("\n");
                for(_RunInRootFrame$Deter = namePropDescriptor = 0; namePropDescriptor < sampleLines.length && !sampleLines[namePropDescriptor].includes("DetermineComponentFrameRoot");)namePropDescriptor++;
                for(; _RunInRootFrame$Deter < controlLines.length && !controlLines[_RunInRootFrame$Deter].includes("DetermineComponentFrameRoot");)_RunInRootFrame$Deter++;
                if (namePropDescriptor === sampleLines.length || _RunInRootFrame$Deter === controlLines.length) for(namePropDescriptor = sampleLines.length - 1, _RunInRootFrame$Deter = controlLines.length - 1; 1 <= namePropDescriptor && 0 <= _RunInRootFrame$Deter && sampleLines[namePropDescriptor] !== controlLines[_RunInRootFrame$Deter];)_RunInRootFrame$Deter--;
                for(; 1 <= namePropDescriptor && 0 <= _RunInRootFrame$Deter; namePropDescriptor--, _RunInRootFrame$Deter--)if (sampleLines[namePropDescriptor] !== controlLines[_RunInRootFrame$Deter]) {
                    if (1 !== namePropDescriptor || 1 !== _RunInRootFrame$Deter) {
                        do if (namePropDescriptor--, _RunInRootFrame$Deter--, 0 > _RunInRootFrame$Deter || sampleLines[namePropDescriptor] !== controlLines[_RunInRootFrame$Deter]) {
                            var _frame = "\n" + sampleLines[namePropDescriptor].replace(" at new ", " at ");
                            fn.displayName && _frame.includes("<anonymous>") && (_frame = _frame.replace("<anonymous>", fn.displayName));
                            "function" === typeof fn && componentFrameCache.set(fn, _frame);
                            return _frame;
                        }
                        while (1 <= namePropDescriptor && 0 <= _RunInRootFrame$Deter)
                    }
                    break;
                }
            }
        } finally{
            reentry = !1, ReactSharedInternals.H = previousDispatcher, reenableLogs(), Error.prepareStackTrace = frame;
        }
        sampleLines = (sampleLines = fn ? fn.displayName || fn.name : "") ? describeBuiltInComponentFrame(sampleLines) : "";
        "function" === typeof fn && componentFrameCache.set(fn, sampleLines);
        return sampleLines;
    }
    function describeUnknownElementTypeFrameInDEV(type) {
        if (null == type) return "";
        if ("function" === typeof type) {
            var prototype = type.prototype;
            return describeNativeComponentFrame(type, !(!prototype || !prototype.isReactComponent));
        }
        if ("string" === typeof type) return describeBuiltInComponentFrame(type);
        switch(type){
            case REACT_SUSPENSE_TYPE:
                return describeBuiltInComponentFrame("Suspense");
            case REACT_SUSPENSE_LIST_TYPE:
                return describeBuiltInComponentFrame("SuspenseList");
        }
        if ("object" === typeof type) switch(type.$$typeof){
            case REACT_FORWARD_REF_TYPE:
                return type = describeNativeComponentFrame(type.render, !1), type;
            case REACT_MEMO_TYPE:
                return describeUnknownElementTypeFrameInDEV(type.type);
            case REACT_LAZY_TYPE:
                prototype = type._payload;
                type = type._init;
                try {
                    return describeUnknownElementTypeFrameInDEV(type(prototype));
                } catch (x) {}
        }
        return "";
    }
    function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
    }
    function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
            var getter = Object.getOwnPropertyDescriptor(config, "key").get;
            if (getter && getter.isReactWarning) return !1;
        }
        return void 0 !== config.key;
    }
    function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
            specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
        }
        warnAboutAccessingKey.isReactWarning = !0;
        Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: !0
        });
    }
    function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
    }
    function ReactElement(type, key, self, source, owner, props) {
        self = props.ref;
        type = {
            $$typeof: REACT_ELEMENT_TYPE,
            type: type,
            key: key,
            props: props,
            _owner: owner
        };
        null !== (void 0 !== self ? self : null) ? Object.defineProperty(type, "ref", {
            enumerable: !1,
            get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", {
            enumerable: !1,
            value: null
        });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: null
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
    }
    function jsxDEVImpl(type, config, maybeKey, isStaticChildren, source, self) {
        if ("string" === typeof type || "function" === typeof type || type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || type === REACT_OFFSCREEN_TYPE || "object" === typeof type && null !== type && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_CONSUMER_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_CLIENT_REFERENCE$1 || void 0 !== type.getModuleId)) {
            var children = config.children;
            if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
                for(isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)validateChildKeys(children[isStaticChildren], type);
                Object.freeze && Object.freeze(children);
            } else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
            else validateChildKeys(children, type);
        } else {
            children = "";
            if (void 0 === type || "object" === typeof type && null !== type && 0 === Object.keys(type).length) children += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
            null === type ? isStaticChildren = "null" : isArrayImpl(type) ? isStaticChildren = "array" : void 0 !== type && type.$$typeof === REACT_ELEMENT_TYPE ? (isStaticChildren = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />", children = " Did you accidentally export a JSX literal instead of a component?") : isStaticChildren = typeof type;
            console.error("React.jsx: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", isStaticChildren, children);
        }
        if (hasOwnProperty.call(config, "key")) {
            children = getComponentNameFromType(type);
            var keys = Object.keys(config).filter(function(k) {
                return "key" !== k;
            });
            isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
            didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error('A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />', isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
        }
        children = null;
        void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
        hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
        if ("key" in config) {
            maybeKey = {};
            for(var propName in config)"key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
        return ReactElement(type, children, self, source, getOwner(), maybeKey);
    }
    function validateChildKeys(node, parentType) {
        if ("object" === typeof node && node && node.$$typeof !== REACT_CLIENT_REFERENCE) {
            if (isArrayImpl(node)) for(var i = 0; i < node.length; i++){
                var child = node[i];
                isValidElement(child) && validateExplicitKey(child, parentType);
            }
            else if (isValidElement(node)) node._store && (node._store.validated = 1);
            else if (null === node || "object" !== typeof node ? i = null : (i = MAYBE_ITERATOR_SYMBOL && node[MAYBE_ITERATOR_SYMBOL] || node["@@iterator"], i = "function" === typeof i ? i : null), "function" === typeof i && i !== node.entries && (i = i.call(node), i !== node)) for(; !(node = i.next()).done;)isValidElement(node.value) && validateExplicitKey(node.value, parentType);
        }
    }
    function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    function validateExplicitKey(element, parentType) {
        if (element._store && !element._store.validated && null == element.key && (element._store.validated = 1, parentType = getCurrentComponentErrorInfo(parentType), !ownerHasKeyUseWarning[parentType])) {
            ownerHasKeyUseWarning[parentType] = !0;
            var childOwner = "";
            element && null != element._owner && element._owner !== getOwner() && (childOwner = null, "number" === typeof element._owner.tag ? childOwner = getComponentNameFromType(element._owner.type) : "string" === typeof element._owner.name && (childOwner = element._owner.name), childOwner = " It was passed a child from " + childOwner + ".");
            var prevGetCurrentStack = ReactSharedInternals.getCurrentStack;
            ReactSharedInternals.getCurrentStack = function() {
                var stack = describeUnknownElementTypeFrameInDEV(element.type);
                prevGetCurrentStack && (stack += prevGetCurrentStack() || "");
                return stack;
            };
            console.error('Each child in a list should have a unique "key" prop.%s%s See https://react.dev/link/warning-keys for more information.', parentType, childOwner);
            ReactSharedInternals.getCurrentStack = prevGetCurrentStack;
        }
    }
    function getCurrentComponentErrorInfo(parentType) {
        var info = "", owner = getOwner();
        owner && (owner = getComponentNameFromType(owner.type)) && (info = "\n\nCheck the render method of `" + owner + "`.");
        info || (parentType = getComponentNameFromType(parentType)) && (info = "\n\nCheck the top-level render call using <" + parentType + ">.");
        return info;
    }
    var React = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler");
    Symbol.for("react.provider");
    var REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, REACT_CLIENT_REFERENCE$2 = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, assign = Object.assign, REACT_CLIENT_REFERENCE$1 = Symbol.for("react.client.reference"), isArrayImpl = Array.isArray, disabledDepth = 0, prevLog, prevInfo, prevWarn, prevError, prevGroup, prevGroupCollapsed, prevGroupEnd;
    disabledLog.__reactDisabledLog = !0;
    var prefix, suffix, reentry = !1;
    var componentFrameCache = new ("function" === typeof WeakMap ? WeakMap : Map)();
    var REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), specialPropKeyWarningShown;
    var didWarnAboutElementRef = {};
    var didWarnAboutKeySpread = {}, ownerHasKeyUseWarning = {};
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsx = function(type, config, maybeKey, source, self) {
        return jsxDEVImpl(type, config, maybeKey, !1, source, self);
    };
    exports.jsxs = function(type, config, maybeKey, source, self) {
        return jsxDEVImpl(type, config, maybeKey, !0, source, self);
    };
}();
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time falsy", 0) {
    "TURBOPACK unreachable";
} else {
    module.exports = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/cjs/react-jsx-runtime.development.js [app-client] (ecmascript)");
}
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/scheduler/cjs/scheduler.development.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
 * @license React
 * scheduler.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
"production" !== ("TURBOPACK compile-time value", "development") && function() {
    function performWorkUntilDeadline() {
        if (isMessageLoopRunning) {
            var currentTime = exports.unstable_now();
            startTime = currentTime;
            var hasMoreWork = !0;
            try {
                a: {
                    isHostCallbackScheduled = !1;
                    isHostTimeoutScheduled && (isHostTimeoutScheduled = !1, localClearTimeout(taskTimeoutID), taskTimeoutID = -1);
                    isPerformingWork = !0;
                    var previousPriorityLevel = currentPriorityLevel;
                    try {
                        b: {
                            advanceTimers(currentTime);
                            for(currentTask = peek(taskQueue); null !== currentTask && !(currentTask.expirationTime > currentTime && shouldYieldToHost());){
                                var callback = currentTask.callback;
                                if ("function" === typeof callback) {
                                    currentTask.callback = null;
                                    currentPriorityLevel = currentTask.priorityLevel;
                                    var continuationCallback = callback(currentTask.expirationTime <= currentTime);
                                    currentTime = exports.unstable_now();
                                    if ("function" === typeof continuationCallback) {
                                        currentTask.callback = continuationCallback;
                                        advanceTimers(currentTime);
                                        hasMoreWork = !0;
                                        break b;
                                    }
                                    currentTask === peek(taskQueue) && pop(taskQueue);
                                    advanceTimers(currentTime);
                                } else pop(taskQueue);
                                currentTask = peek(taskQueue);
                            }
                            if (null !== currentTask) hasMoreWork = !0;
                            else {
                                var firstTimer = peek(timerQueue);
                                null !== firstTimer && requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
                                hasMoreWork = !1;
                            }
                        }
                        break a;
                    } finally{
                        currentTask = null, currentPriorityLevel = previousPriorityLevel, isPerformingWork = !1;
                    }
                    hasMoreWork = void 0;
                }
            } finally{
                hasMoreWork ? schedulePerformWorkUntilDeadline() : isMessageLoopRunning = !1;
            }
        }
    }
    function push(heap, node) {
        var index = heap.length;
        heap.push(node);
        a: for(; 0 < index;){
            var parentIndex = index - 1 >>> 1, parent = heap[parentIndex];
            if (0 < compare(parent, node)) heap[parentIndex] = node, heap[index] = parent, index = parentIndex;
            else break a;
        }
    }
    function peek(heap) {
        return 0 === heap.length ? null : heap[0];
    }
    function pop(heap) {
        if (0 === heap.length) return null;
        var first = heap[0], last = heap.pop();
        if (last !== first) {
            heap[0] = last;
            a: for(var index = 0, length = heap.length, halfLength = length >>> 1; index < halfLength;){
                var leftIndex = 2 * (index + 1) - 1, left = heap[leftIndex], rightIndex = leftIndex + 1, right = heap[rightIndex];
                if (0 > compare(left, last)) rightIndex < length && 0 > compare(right, left) ? (heap[index] = right, heap[rightIndex] = last, index = rightIndex) : (heap[index] = left, heap[leftIndex] = last, index = leftIndex);
                else if (rightIndex < length && 0 > compare(right, last)) heap[index] = right, heap[rightIndex] = last, index = rightIndex;
                else break a;
            }
        }
        return first;
    }
    function compare(a, b) {
        var diff = a.sortIndex - b.sortIndex;
        return 0 !== diff ? diff : a.id - b.id;
    }
    function advanceTimers(currentTime) {
        for(var timer = peek(timerQueue); null !== timer;){
            if (null === timer.callback) pop(timerQueue);
            else if (timer.startTime <= currentTime) pop(timerQueue), timer.sortIndex = timer.expirationTime, push(taskQueue, timer);
            else break;
            timer = peek(timerQueue);
        }
    }
    function handleTimeout(currentTime) {
        isHostTimeoutScheduled = !1;
        advanceTimers(currentTime);
        if (!isHostCallbackScheduled) if (null !== peek(taskQueue)) isHostCallbackScheduled = !0, requestHostCallback();
        else {
            var firstTimer = peek(timerQueue);
            null !== firstTimer && requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
        }
    }
    function shouldYieldToHost() {
        return exports.unstable_now() - startTime < frameInterval ? !1 : !0;
    }
    function requestHostCallback() {
        isMessageLoopRunning || (isMessageLoopRunning = !0, schedulePerformWorkUntilDeadline());
    }
    function requestHostTimeout(callback, ms) {
        taskTimeoutID = localSetTimeout(function() {
            callback(exports.unstable_now());
        }, ms);
    }
    "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
    exports.unstable_now = void 0;
    if ("object" === typeof performance && "function" === typeof performance.now) {
        var localPerformance = performance;
        exports.unstable_now = function() {
            return localPerformance.now();
        };
    } else {
        var localDate = Date, initialTime = localDate.now();
        exports.unstable_now = function() {
            return localDate.now() - initialTime;
        };
    }
    var taskQueue = [], timerQueue = [], taskIdCounter = 1, currentTask = null, currentPriorityLevel = 3, isPerformingWork = !1, isHostCallbackScheduled = !1, isHostTimeoutScheduled = !1, localSetTimeout = "function" === typeof setTimeout ? setTimeout : null, localClearTimeout = "function" === typeof clearTimeout ? clearTimeout : null, localSetImmediate = "undefined" !== typeof setImmediate ? setImmediate : null, isMessageLoopRunning = !1, taskTimeoutID = -1, frameInterval = 5, startTime = -1;
    if ("function" === typeof localSetImmediate) var schedulePerformWorkUntilDeadline = function() {
        localSetImmediate(performWorkUntilDeadline);
    };
    else if ("undefined" !== typeof MessageChannel) {
        var channel = new MessageChannel(), port = channel.port2;
        channel.port1.onmessage = performWorkUntilDeadline;
        schedulePerformWorkUntilDeadline = function() {
            port.postMessage(null);
        };
    } else schedulePerformWorkUntilDeadline = function() {
        localSetTimeout(performWorkUntilDeadline, 0);
    };
    exports.unstable_IdlePriority = 5;
    exports.unstable_ImmediatePriority = 1;
    exports.unstable_LowPriority = 4;
    exports.unstable_NormalPriority = 3;
    exports.unstable_Profiling = null;
    exports.unstable_UserBlockingPriority = 2;
    exports.unstable_cancelCallback = function(task) {
        task.callback = null;
    };
    exports.unstable_continueExecution = function() {
        isHostCallbackScheduled || isPerformingWork || (isHostCallbackScheduled = !0, requestHostCallback());
    };
    exports.unstable_forceFrameRate = function(fps) {
        0 > fps || 125 < fps ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : frameInterval = 0 < fps ? Math.floor(1e3 / fps) : 5;
    };
    exports.unstable_getCurrentPriorityLevel = function() {
        return currentPriorityLevel;
    };
    exports.unstable_getFirstCallbackNode = function() {
        return peek(taskQueue);
    };
    exports.unstable_next = function(eventHandler) {
        switch(currentPriorityLevel){
            case 1:
            case 2:
            case 3:
                var priorityLevel = 3;
                break;
            default:
                priorityLevel = currentPriorityLevel;
        }
        var previousPriorityLevel = currentPriorityLevel;
        currentPriorityLevel = priorityLevel;
        try {
            return eventHandler();
        } finally{
            currentPriorityLevel = previousPriorityLevel;
        }
    };
    exports.unstable_pauseExecution = function() {};
    exports.unstable_requestPaint = function() {};
    exports.unstable_runWithPriority = function(priorityLevel, eventHandler) {
        switch(priorityLevel){
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
                break;
            default:
                priorityLevel = 3;
        }
        var previousPriorityLevel = currentPriorityLevel;
        currentPriorityLevel = priorityLevel;
        try {
            return eventHandler();
        } finally{
            currentPriorityLevel = previousPriorityLevel;
        }
    };
    exports.unstable_scheduleCallback = function(priorityLevel, callback, options) {
        var currentTime = exports.unstable_now();
        "object" === typeof options && null !== options ? (options = options.delay, options = "number" === typeof options && 0 < options ? currentTime + options : currentTime) : options = currentTime;
        switch(priorityLevel){
            case 1:
                var timeout = -1;
                break;
            case 2:
                timeout = 250;
                break;
            case 5:
                timeout = 1073741823;
                break;
            case 4:
                timeout = 1e4;
                break;
            default:
                timeout = 5e3;
        }
        timeout = options + timeout;
        priorityLevel = {
            id: taskIdCounter++,
            callback: callback,
            priorityLevel: priorityLevel,
            startTime: options,
            expirationTime: timeout,
            sortIndex: -1
        };
        options > currentTime ? (priorityLevel.sortIndex = options, push(timerQueue, priorityLevel), null === peek(taskQueue) && priorityLevel === peek(timerQueue) && (isHostTimeoutScheduled ? (localClearTimeout(taskTimeoutID), taskTimeoutID = -1) : isHostTimeoutScheduled = !0, requestHostTimeout(handleTimeout, options - currentTime))) : (priorityLevel.sortIndex = timeout, push(taskQueue, priorityLevel), isHostCallbackScheduled || isPerformingWork || (isHostCallbackScheduled = !0, requestHostCallback()));
        return priorityLevel;
    };
    exports.unstable_shouldYield = shouldYieldToHost;
    exports.unstable_wrapCallback = function(callback) {
        var parentPriorityLevel = currentPriorityLevel;
        return function() {
            var previousPriorityLevel = currentPriorityLevel;
            currentPriorityLevel = parentPriorityLevel;
            try {
                return callback.apply(this, arguments);
            } finally{
                currentPriorityLevel = previousPriorityLevel;
            }
        };
    };
    "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
}();
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/scheduler/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time falsy", 0) {
    "TURBOPACK unreachable";
} else {
    module.exports = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/scheduler/cjs/scheduler.development.js [app-client] (ecmascript)");
}
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-server-dom-turbopack/cjs/react-server-dom-turbopack-client.browser.development.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
 * @license React
 * react-server-dom-turbopack-client.browser.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
"production" !== ("TURBOPACK compile-time value", "development") && function() {
    function _defineProperty(obj, key, value) {
        key in obj ? Object.defineProperty(obj, key, {
            value: value,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : obj[key] = value;
        return obj;
    }
    function resolveClientReference(bundlerConfig, metadata) {
        if (bundlerConfig) {
            var moduleExports = bundlerConfig[metadata[0]];
            if (bundlerConfig = moduleExports && moduleExports[metadata[2]]) moduleExports = bundlerConfig.name;
            else {
                bundlerConfig = moduleExports && moduleExports["*"];
                if (!bundlerConfig) throw Error('Could not find the module "' + metadata[0] + '" in the React Server Consumer Manifest. This is probably a bug in the React Server Components bundler.');
                moduleExports = metadata[2];
            }
            return 4 === metadata.length ? [
                bundlerConfig.id,
                bundlerConfig.chunks,
                moduleExports,
                1
            ] : [
                bundlerConfig.id,
                bundlerConfig.chunks,
                moduleExports
            ];
        }
        return metadata;
    }
    function resolveServerReference(bundlerConfig, id) {
        var name = "", resolvedModuleData = bundlerConfig[id];
        if (resolvedModuleData) name = resolvedModuleData.name;
        else {
            var idx = id.lastIndexOf("#");
            -1 !== idx && (name = id.slice(idx + 1), resolvedModuleData = bundlerConfig[id.slice(0, idx)]);
            if (!resolvedModuleData) throw Error('Could not find the module "' + id + '" in the React Server Manifest. This is probably a bug in the React Server Components bundler.');
        }
        return [
            resolvedModuleData.id,
            resolvedModuleData.chunks,
            name
        ];
    }
    function requireAsyncModule(id) {
        var promise = __turbopack_require__(id);
        if ("function" !== typeof promise.then || "fulfilled" === promise.status) return null;
        promise.then(function(value) {
            promise.status = "fulfilled";
            promise.value = value;
        }, function(reason) {
            promise.status = "rejected";
            promise.reason = reason;
        });
        return promise;
    }
    function ignoreReject() {}
    function preloadModule(metadata) {
        for(var chunks = metadata[1], promises = [], i = 0; i < chunks.length; i++){
            var chunkFilename = chunks[i], entry = chunkCache.get(chunkFilename);
            if (void 0 === entry) {
                entry = __turbopack_load__(chunkFilename);
                promises.push(entry);
                var resolve = chunkCache.set.bind(chunkCache, chunkFilename, null);
                entry.then(resolve, ignoreReject);
                chunkCache.set(chunkFilename, entry);
            } else null !== entry && promises.push(entry);
        }
        return 4 === metadata.length ? 0 === promises.length ? requireAsyncModule(metadata[0]) : Promise.all(promises).then(function() {
            return requireAsyncModule(metadata[0]);
        }) : 0 < promises.length ? Promise.all(promises) : null;
    }
    function requireModule(metadata) {
        var moduleExports = __turbopack_require__(metadata[0]);
        if (4 === metadata.length && "function" === typeof moduleExports.then) if ("fulfilled" === moduleExports.status) moduleExports = moduleExports.value;
        else throw moduleExports.reason;
        return "*" === metadata[2] ? moduleExports : "" === metadata[2] ? moduleExports.__esModule ? moduleExports.default : moduleExports : moduleExports[metadata[2]];
    }
    function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
    }
    function isObjectPrototype(object) {
        if (!object) return !1;
        var ObjectPrototype = Object.prototype;
        if (object === ObjectPrototype) return !0;
        if (getPrototypeOf(object)) return !1;
        object = Object.getOwnPropertyNames(object);
        for(var i = 0; i < object.length; i++)if (!(object[i] in ObjectPrototype)) return !1;
        return !0;
    }
    function isSimpleObject(object) {
        if (!isObjectPrototype(getPrototypeOf(object))) return !1;
        for(var names = Object.getOwnPropertyNames(object), i = 0; i < names.length; i++){
            var descriptor = Object.getOwnPropertyDescriptor(object, names[i]);
            if (!descriptor || !descriptor.enumerable && ("key" !== names[i] && "ref" !== names[i] || "function" !== typeof descriptor.get)) return !1;
        }
        return !0;
    }
    function objectName(object) {
        return Object.prototype.toString.call(object).replace(/^\[object (.*)\]$/, function(m, p0) {
            return p0;
        });
    }
    function describeKeyForErrorMessage(key) {
        var encodedKey = JSON.stringify(key);
        return '"' + key + '"' === encodedKey ? key : encodedKey;
    }
    function describeValueForErrorMessage(value) {
        switch(typeof value){
            case "string":
                return JSON.stringify(10 >= value.length ? value : value.slice(0, 10) + "...");
            case "object":
                if (isArrayImpl(value)) return "[...]";
                if (null !== value && value.$$typeof === CLIENT_REFERENCE_TAG) return "client";
                value = objectName(value);
                return "Object" === value ? "{...}" : value;
            case "function":
                return value.$$typeof === CLIENT_REFERENCE_TAG ? "client" : (value = value.displayName || value.name) ? "function " + value : "function";
            default:
                return String(value);
        }
    }
    function describeElementType(type) {
        if ("string" === typeof type) return type;
        switch(type){
            case REACT_SUSPENSE_TYPE:
                return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
        }
        if ("object" === typeof type) switch(type.$$typeof){
            case REACT_FORWARD_REF_TYPE:
                return describeElementType(type.render);
            case REACT_MEMO_TYPE:
                return describeElementType(type.type);
            case REACT_LAZY_TYPE:
                var payload = type._payload;
                type = type._init;
                try {
                    return describeElementType(type(payload));
                } catch (x) {}
        }
        return "";
    }
    function describeObjectForErrorMessage(objectOrArray, expandedName) {
        var objKind = objectName(objectOrArray);
        if ("Object" !== objKind && "Array" !== objKind) return objKind;
        var start = -1, length = 0;
        if (isArrayImpl(objectOrArray)) if (jsxChildrenParents.has(objectOrArray)) {
            var type = jsxChildrenParents.get(objectOrArray);
            objKind = "<" + describeElementType(type) + ">";
            for(var i = 0; i < objectOrArray.length; i++){
                var value = objectOrArray[i];
                value = "string" === typeof value ? value : "object" === typeof value && null !== value ? "{" + describeObjectForErrorMessage(value) + "}" : "{" + describeValueForErrorMessage(value) + "}";
                "" + i === expandedName ? (start = objKind.length, length = value.length, objKind += value) : objKind = 15 > value.length && 40 > objKind.length + value.length ? objKind + value : objKind + "{...}";
            }
            objKind += "</" + describeElementType(type) + ">";
        } else {
            objKind = "[";
            for(type = 0; type < objectOrArray.length; type++)0 < type && (objKind += ", "), i = objectOrArray[type], i = "object" === typeof i && null !== i ? describeObjectForErrorMessage(i) : describeValueForErrorMessage(i), "" + type === expandedName ? (start = objKind.length, length = i.length, objKind += i) : objKind = 10 > i.length && 40 > objKind.length + i.length ? objKind + i : objKind + "...";
            objKind += "]";
        }
        else if (objectOrArray.$$typeof === REACT_ELEMENT_TYPE) objKind = "<" + describeElementType(objectOrArray.type) + "/>";
        else {
            if (objectOrArray.$$typeof === CLIENT_REFERENCE_TAG) return "client";
            if (jsxPropsParents.has(objectOrArray)) {
                objKind = jsxPropsParents.get(objectOrArray);
                objKind = "<" + (describeElementType(objKind) || "...");
                type = Object.keys(objectOrArray);
                for(i = 0; i < type.length; i++){
                    objKind += " ";
                    value = type[i];
                    objKind += describeKeyForErrorMessage(value) + "=";
                    var _value2 = objectOrArray[value];
                    var _substr2 = value === expandedName && "object" === typeof _value2 && null !== _value2 ? describeObjectForErrorMessage(_value2) : describeValueForErrorMessage(_value2);
                    "string" !== typeof _value2 && (_substr2 = "{" + _substr2 + "}");
                    value === expandedName ? (start = objKind.length, length = _substr2.length, objKind += _substr2) : objKind = 10 > _substr2.length && 40 > objKind.length + _substr2.length ? objKind + _substr2 : objKind + "...";
                }
                objKind += ">";
            } else {
                objKind = "{";
                type = Object.keys(objectOrArray);
                for(i = 0; i < type.length; i++)0 < i && (objKind += ", "), value = type[i], objKind += describeKeyForErrorMessage(value) + ": ", _value2 = objectOrArray[value], _value2 = "object" === typeof _value2 && null !== _value2 ? describeObjectForErrorMessage(_value2) : describeValueForErrorMessage(_value2), value === expandedName ? (start = objKind.length, length = _value2.length, objKind += _value2) : objKind = 10 > _value2.length && 40 > objKind.length + _value2.length ? objKind + _value2 : objKind + "...";
                objKind += "}";
            }
        }
        return void 0 === expandedName ? objKind : -1 < start && 0 < length ? (objectOrArray = " ".repeat(start) + "^".repeat(length), "\n  " + objKind + "\n  " + objectOrArray) : "\n  " + objKind;
    }
    function serializeNumber(number) {
        return Number.isFinite(number) ? 0 === number && -Infinity === 1 / number ? "$-0" : number : Infinity === number ? "$Infinity" : -Infinity === number ? "$-Infinity" : "$NaN";
    }
    function processReply(root, formFieldPrefix, temporaryReferences, resolve, reject) {
        function serializeTypedArray(tag, typedArray) {
            typedArray = new Blob([
                new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)
            ]);
            var blobId = nextPartId++;
            null === formData && (formData = new FormData());
            formData.append(formFieldPrefix + blobId, typedArray);
            return "$" + tag + blobId.toString(16);
        }
        function serializeBinaryReader(reader) {
            function progress(entry) {
                entry.done ? (entry = nextPartId++, data.append(formFieldPrefix + entry, new Blob(buffer)), data.append(formFieldPrefix + streamId, '"$o' + entry.toString(16) + '"'), data.append(formFieldPrefix + streamId, "C"), pendingParts--, 0 === pendingParts && resolve(data)) : (buffer.push(entry.value), reader.read(new Uint8Array(1024)).then(progress, reject));
            }
            null === formData && (formData = new FormData());
            var data = formData;
            pendingParts++;
            var streamId = nextPartId++, buffer = [];
            reader.read(new Uint8Array(1024)).then(progress, reject);
            return "$r" + streamId.toString(16);
        }
        function serializeReader(reader) {
            function progress(entry) {
                if (entry.done) data.append(formFieldPrefix + streamId, "C"), pendingParts--, 0 === pendingParts && resolve(data);
                else try {
                    var partJSON = JSON.stringify(entry.value, resolveToJSON);
                    data.append(formFieldPrefix + streamId, partJSON);
                    reader.read().then(progress, reject);
                } catch (x) {
                    reject(x);
                }
            }
            null === formData && (formData = new FormData());
            var data = formData;
            pendingParts++;
            var streamId = nextPartId++;
            reader.read().then(progress, reject);
            return "$R" + streamId.toString(16);
        }
        function serializeReadableStream(stream) {
            try {
                var binaryReader = stream.getReader({
                    mode: "byob"
                });
            } catch (x) {
                return serializeReader(stream.getReader());
            }
            return serializeBinaryReader(binaryReader);
        }
        function serializeAsyncIterable(iterable, iterator) {
            function progress(entry) {
                if (entry.done) {
                    if (void 0 === entry.value) data.append(formFieldPrefix + streamId, "C");
                    else try {
                        var partJSON = JSON.stringify(entry.value, resolveToJSON);
                        data.append(formFieldPrefix + streamId, "C" + partJSON);
                    } catch (x) {
                        reject(x);
                        return;
                    }
                    pendingParts--;
                    0 === pendingParts && resolve(data);
                } else try {
                    var _partJSON = JSON.stringify(entry.value, resolveToJSON);
                    data.append(formFieldPrefix + streamId, _partJSON);
                    iterator.next().then(progress, reject);
                } catch (x$0) {
                    reject(x$0);
                }
            }
            null === formData && (formData = new FormData());
            var data = formData;
            pendingParts++;
            var streamId = nextPartId++;
            iterable = iterable === iterator;
            iterator.next().then(progress, reject);
            return "$" + (iterable ? "x" : "X") + streamId.toString(16);
        }
        function resolveToJSON(key, value) {
            var originalValue = this[key];
            "object" !== typeof originalValue || originalValue === value || originalValue instanceof Date || ("Object" !== objectName(originalValue) ? console.error("Only plain objects can be passed to Server Functions from the Client. %s objects are not supported.%s", objectName(originalValue), describeObjectForErrorMessage(this, key)) : console.error("Only plain objects can be passed to Server Functions from the Client. Objects with toJSON methods are not supported. Convert it manually to a simple value before passing it to props.%s", describeObjectForErrorMessage(this, key)));
            if (null === value) return null;
            if ("object" === typeof value) {
                switch(value.$$typeof){
                    case REACT_ELEMENT_TYPE:
                        if (void 0 !== temporaryReferences && -1 === key.indexOf(":")) {
                            var parentReference = writtenObjects.get(this);
                            if (void 0 !== parentReference) return temporaryReferences.set(parentReference + ":" + key, value), "$T";
                        }
                        throw Error("React Element cannot be passed to Server Functions from the Client without a temporary reference set. Pass a TemporaryReferenceSet to the options." + describeObjectForErrorMessage(this, key));
                    case REACT_LAZY_TYPE:
                        originalValue = value._payload;
                        var init = value._init;
                        null === formData && (formData = new FormData());
                        pendingParts++;
                        try {
                            parentReference = init(originalValue);
                            var lazyId = nextPartId++, partJSON = serializeModel(parentReference, lazyId);
                            formData.append(formFieldPrefix + lazyId, partJSON);
                            return "$" + lazyId.toString(16);
                        } catch (x) {
                            if ("object" === typeof x && null !== x && "function" === typeof x.then) {
                                pendingParts++;
                                var _lazyId = nextPartId++;
                                parentReference = function() {
                                    try {
                                        var _partJSON2 = serializeModel(value, _lazyId), _data = formData;
                                        _data.append(formFieldPrefix + _lazyId, _partJSON2);
                                        pendingParts--;
                                        0 === pendingParts && resolve(_data);
                                    } catch (reason) {
                                        reject(reason);
                                    }
                                };
                                x.then(parentReference, parentReference);
                                return "$" + _lazyId.toString(16);
                            }
                            reject(x);
                            return null;
                        } finally{
                            pendingParts--;
                        }
                }
                if ("function" === typeof value.then) {
                    null === formData && (formData = new FormData());
                    pendingParts++;
                    var promiseId = nextPartId++;
                    value.then(function(partValue) {
                        try {
                            var _partJSON3 = serializeModel(partValue, promiseId);
                            partValue = formData;
                            partValue.append(formFieldPrefix + promiseId, _partJSON3);
                            pendingParts--;
                            0 === pendingParts && resolve(partValue);
                        } catch (reason) {
                            reject(reason);
                        }
                    }, reject);
                    return "$@" + promiseId.toString(16);
                }
                parentReference = writtenObjects.get(value);
                if (void 0 !== parentReference) if (modelRoot === value) modelRoot = null;
                else return parentReference;
                else -1 === key.indexOf(":") && (parentReference = writtenObjects.get(this), void 0 !== parentReference && (parentReference = parentReference + ":" + key, writtenObjects.set(value, parentReference), void 0 !== temporaryReferences && temporaryReferences.set(parentReference, value)));
                if (isArrayImpl(value)) return value;
                if (value instanceof FormData) {
                    null === formData && (formData = new FormData());
                    var _data3 = formData;
                    key = nextPartId++;
                    var prefix = formFieldPrefix + key + "_";
                    value.forEach(function(originalValue, originalKey) {
                        _data3.append(prefix + originalKey, originalValue);
                    });
                    return "$K" + key.toString(16);
                }
                if (value instanceof Map) return key = nextPartId++, parentReference = serializeModel(Array.from(value), key), null === formData && (formData = new FormData()), formData.append(formFieldPrefix + key, parentReference), "$Q" + key.toString(16);
                if (value instanceof Set) return key = nextPartId++, parentReference = serializeModel(Array.from(value), key), null === formData && (formData = new FormData()), formData.append(formFieldPrefix + key, parentReference), "$W" + key.toString(16);
                if (value instanceof ArrayBuffer) return key = new Blob([
                    value
                ]), parentReference = nextPartId++, null === formData && (formData = new FormData()), formData.append(formFieldPrefix + parentReference, key), "$A" + parentReference.toString(16);
                if (value instanceof Int8Array) return serializeTypedArray("O", value);
                if (value instanceof Uint8Array) return serializeTypedArray("o", value);
                if (value instanceof Uint8ClampedArray) return serializeTypedArray("U", value);
                if (value instanceof Int16Array) return serializeTypedArray("S", value);
                if (value instanceof Uint16Array) return serializeTypedArray("s", value);
                if (value instanceof Int32Array) return serializeTypedArray("L", value);
                if (value instanceof Uint32Array) return serializeTypedArray("l", value);
                if (value instanceof Float32Array) return serializeTypedArray("G", value);
                if (value instanceof Float64Array) return serializeTypedArray("g", value);
                if (value instanceof BigInt64Array) return serializeTypedArray("M", value);
                if (value instanceof BigUint64Array) return serializeTypedArray("m", value);
                if (value instanceof DataView) return serializeTypedArray("V", value);
                if ("function" === typeof Blob && value instanceof Blob) return null === formData && (formData = new FormData()), key = nextPartId++, formData.append(formFieldPrefix + key, value), "$B" + key.toString(16);
                if (parentReference = getIteratorFn(value)) return parentReference = parentReference.call(value), parentReference === value ? (key = nextPartId++, parentReference = serializeModel(Array.from(parentReference), key), null === formData && (formData = new FormData()), formData.append(formFieldPrefix + key, parentReference), "$i" + key.toString(16)) : Array.from(parentReference);
                if ("function" === typeof ReadableStream && value instanceof ReadableStream) return serializeReadableStream(value);
                parentReference = value[ASYNC_ITERATOR];
                if ("function" === typeof parentReference) return serializeAsyncIterable(value, parentReference.call(value));
                parentReference = getPrototypeOf(value);
                if (parentReference !== ObjectPrototype && (null === parentReference || null !== getPrototypeOf(parentReference))) {
                    if (void 0 === temporaryReferences) throw Error("Only plain objects, and a few built-ins, can be passed to Server Actions. Classes or null prototypes are not supported." + describeObjectForErrorMessage(this, key));
                    return "$T";
                }
                value.$$typeof === REACT_CONTEXT_TYPE ? console.error("React Context Providers cannot be passed to Server Functions from the Client.%s", describeObjectForErrorMessage(this, key)) : "Object" !== objectName(value) ? console.error("Only plain objects can be passed to Server Functions from the Client. %s objects are not supported.%s", objectName(value), describeObjectForErrorMessage(this, key)) : isSimpleObject(value) ? Object.getOwnPropertySymbols && (parentReference = Object.getOwnPropertySymbols(value), 0 < parentReference.length && console.error("Only plain objects can be passed to Server Functions from the Client. Objects with symbol properties like %s are not supported.%s", parentReference[0].description, describeObjectForErrorMessage(this, key))) : console.error("Only plain objects can be passed to Server Functions from the Client. Classes or other objects with methods are not supported.%s", describeObjectForErrorMessage(this, key));
                return value;
            }
            if ("string" === typeof value) {
                if ("Z" === value[value.length - 1] && this[key] instanceof Date) return "$D" + value;
                key = "$" === value[0] ? "$" + value : value;
                return key;
            }
            if ("boolean" === typeof value) return value;
            if ("number" === typeof value) return serializeNumber(value);
            if ("undefined" === typeof value) return "$undefined";
            if ("function" === typeof value) {
                parentReference = knownServerReferences.get(value);
                if (void 0 !== parentReference) return key = JSON.stringify(parentReference, resolveToJSON), null === formData && (formData = new FormData()), parentReference = nextPartId++, formData.set(formFieldPrefix + parentReference, key), "$F" + parentReference.toString(16);
                if (void 0 !== temporaryReferences && -1 === key.indexOf(":") && (parentReference = writtenObjects.get(this), void 0 !== parentReference)) return temporaryReferences.set(parentReference + ":" + key, value), "$T";
                throw Error("Client Functions cannot be passed directly to Server Functions. Only Functions passed from the Server can be passed back again.");
            }
            if ("symbol" === typeof value) {
                if (void 0 !== temporaryReferences && -1 === key.indexOf(":") && (parentReference = writtenObjects.get(this), void 0 !== parentReference)) return temporaryReferences.set(parentReference + ":" + key, value), "$T";
                throw Error("Symbols cannot be passed to a Server Function without a temporary reference set. Pass a TemporaryReferenceSet to the options." + describeObjectForErrorMessage(this, key));
            }
            if ("bigint" === typeof value) return "$n" + value.toString(10);
            throw Error("Type " + typeof value + " is not supported as an argument to a Server Function.");
        }
        function serializeModel(model, id) {
            "object" === typeof model && null !== model && (id = "$" + id.toString(16), writtenObjects.set(model, id), void 0 !== temporaryReferences && temporaryReferences.set(id, model));
            modelRoot = model;
            return JSON.stringify(model, resolveToJSON);
        }
        var nextPartId = 1, pendingParts = 0, formData = null, writtenObjects = new WeakMap(), modelRoot = root, json = serializeModel(root, 0);
        null === formData ? resolve(json) : (formData.set(formFieldPrefix + "0", json), 0 === pendingParts && resolve(formData));
        return function() {
            0 < pendingParts && (pendingParts = 0, null === formData ? resolve(json) : resolve(formData));
        };
    }
    function createFakeServerFunction(name, filename, sourceMap, line, col, environmentName, innerFunction) {
        name || (name = "<anonymous>");
        var encodedName = JSON.stringify(name);
        1 >= line ? (line = encodedName.length + 7, col = "s=>({" + encodedName + " ".repeat(col < line ? 0 : col - line) + ":(...args) => s(...args)})\n/* This module is a proxy to a Server Action. Turn on Source Maps to see the server source. */") : col = "/* This module is a proxy to a Server Action. Turn on Source Maps to see the server source. */" + "\n".repeat(line - 2) + "server=>({" + encodedName + ":\n" + " ".repeat(1 > col ? 0 : col - 1) + "(...args) => server(...args)})";
        filename.startsWith("/") && (filename = "file://" + filename);
        sourceMap ? (col += "\n//# sourceURL=rsc://React/" + encodeURIComponent(environmentName) + "/" + filename + "?s" + fakeServerFunctionIdx++, col += "\n//# sourceMappingURL=" + sourceMap) : filename && (col += "\n//# sourceURL=" + filename);
        try {
            return (0, eval)(col)(innerFunction)[name];
        } catch (x) {
            return innerFunction;
        }
    }
    function registerServerReference(proxy, reference) {
        knownServerReferences.set(proxy, reference);
    }
    function createBoundServerReference(metaData, callServer, encodeFormAction, findSourceMapURL) {
        function action() {
            var args = Array.prototype.slice.call(arguments);
            return bound ? "fulfilled" === bound.status ? callServer(id, bound.value.concat(args)) : Promise.resolve(bound).then(function(boundArgs) {
                return callServer(id, boundArgs.concat(args));
            }) : callServer(id, args);
        }
        var id = metaData.id, bound = metaData.bound, location = metaData.location;
        if (location) {
            encodeFormAction = metaData.name || "";
            var filename = location[1], line = location[2];
            location = location[3];
            metaData = metaData.env || "Server";
            findSourceMapURL = null == findSourceMapURL ? null : findSourceMapURL(filename, metaData);
            action = createFakeServerFunction(encodeFormAction, filename, findSourceMapURL, line, location, metaData, action);
        }
        registerServerReference(action, {
            id: id,
            bound: bound
        });
        return action;
    }
    function parseStackLocation(error) {
        error = error.stack;
        error.startsWith("Error: react-stack-top-frame\n") && (error = error.slice(29));
        var endOfFirst = error.indexOf("\n");
        if (-1 !== endOfFirst) {
            var endOfSecond = error.indexOf("\n", endOfFirst + 1);
            endOfFirst = -1 === endOfSecond ? error.slice(endOfFirst + 1) : error.slice(endOfFirst + 1, endOfSecond);
        } else endOfFirst = error;
        error = v8FrameRegExp.exec(endOfFirst);
        if (!error && (error = jscSpiderMonkeyFrameRegExp.exec(endOfFirst), !error)) return null;
        endOfFirst = error[1] || "";
        "<anonymous>" === endOfFirst && (endOfFirst = "");
        endOfSecond = error[2] || error[5] || "";
        "<anonymous>" === endOfSecond && (endOfSecond = "");
        return [
            endOfFirst,
            endOfSecond,
            +(error[3] || error[6]),
            +(error[4] || error[7])
        ];
    }
    function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch(type){
            case REACT_FRAGMENT_TYPE:
                return "Fragment";
            case REACT_PORTAL_TYPE:
                return "Portal";
            case REACT_PROFILER_TYPE:
                return "Profiler";
            case REACT_STRICT_MODE_TYPE:
                return "StrictMode";
            case REACT_SUSPENSE_TYPE:
                return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
        }
        if ("object" === typeof type) switch("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof){
            case REACT_CONTEXT_TYPE:
                return (type.displayName || "Context") + ".Provider";
            case REACT_CONSUMER_TYPE:
                return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
                var innerType = type.render;
                type = type.displayName;
                type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                return type;
            case REACT_MEMO_TYPE:
                return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
                innerType = type._payload;
                type = type._init;
                try {
                    return getComponentNameFromType(type(innerType));
                } catch (x) {}
        }
        return null;
    }
    function ReactPromise(status, value, reason, response) {
        this.status = status;
        this.value = value;
        this.reason = reason;
        this._response = response;
        this._debugInfo = null;
    }
    function readChunk(chunk) {
        switch(chunk.status){
            case "resolved_model":
                initializeModelChunk(chunk);
                break;
            case "resolved_module":
                initializeModuleChunk(chunk);
        }
        switch(chunk.status){
            case "fulfilled":
                return chunk.value;
            case "pending":
            case "blocked":
                throw chunk;
            default:
                throw chunk.reason;
        }
    }
    function createPendingChunk(response) {
        return new ReactPromise("pending", null, null, response);
    }
    function wakeChunk(listeners, value) {
        for(var i = 0; i < listeners.length; i++)(0, listeners[i])(value);
    }
    function wakeChunkIfInitialized(chunk, resolveListeners, rejectListeners) {
        switch(chunk.status){
            case "fulfilled":
                wakeChunk(resolveListeners, chunk.value);
                break;
            case "pending":
            case "blocked":
                if (chunk.value) for(var i = 0; i < resolveListeners.length; i++)chunk.value.push(resolveListeners[i]);
                else chunk.value = resolveListeners;
                if (chunk.reason) {
                    if (rejectListeners) for(resolveListeners = 0; resolveListeners < rejectListeners.length; resolveListeners++)chunk.reason.push(rejectListeners[resolveListeners]);
                } else chunk.reason = rejectListeners;
                break;
            case "rejected":
                rejectListeners && wakeChunk(rejectListeners, chunk.reason);
        }
    }
    function triggerErrorOnChunk(chunk, error) {
        if ("pending" !== chunk.status && "blocked" !== chunk.status) chunk.reason.error(error);
        else {
            var listeners = chunk.reason;
            chunk.status = "rejected";
            chunk.reason = error;
            null !== listeners && wakeChunk(listeners, error);
        }
    }
    function createResolvedIteratorResultChunk(response, value, done) {
        return new ReactPromise("resolved_model", (done ? '{"done":true,"value":' : '{"done":false,"value":') + value + "}", null, response);
    }
    function resolveIteratorResultChunk(chunk, value, done) {
        resolveModelChunk(chunk, (done ? '{"done":true,"value":' : '{"done":false,"value":') + value + "}");
    }
    function resolveModelChunk(chunk, value) {
        if ("pending" !== chunk.status) chunk.reason.enqueueModel(value);
        else {
            var resolveListeners = chunk.value, rejectListeners = chunk.reason;
            chunk.status = "resolved_model";
            chunk.value = value;
            null !== resolveListeners && (initializeModelChunk(chunk), wakeChunkIfInitialized(chunk, resolveListeners, rejectListeners));
        }
    }
    function resolveModuleChunk(chunk, value) {
        if ("pending" === chunk.status || "blocked" === chunk.status) {
            var resolveListeners = chunk.value, rejectListeners = chunk.reason;
            chunk.status = "resolved_module";
            chunk.value = value;
            null !== resolveListeners && (initializeModuleChunk(chunk), wakeChunkIfInitialized(chunk, resolveListeners, rejectListeners));
        }
    }
    function initializeModelChunk(chunk) {
        var prevHandler = initializingHandler;
        initializingHandler = null;
        var resolvedModel = chunk.value;
        chunk.status = "blocked";
        chunk.value = null;
        chunk.reason = null;
        try {
            var value = JSON.parse(resolvedModel, chunk._response._fromJSON), resolveListeners = chunk.value;
            null !== resolveListeners && (chunk.value = null, chunk.reason = null, wakeChunk(resolveListeners, value));
            if (null !== initializingHandler) {
                if (initializingHandler.errored) throw initializingHandler.value;
                if (0 < initializingHandler.deps) {
                    initializingHandler.value = value;
                    initializingHandler.chunk = chunk;
                    return;
                }
            }
            chunk.status = "fulfilled";
            chunk.value = value;
        } catch (error) {
            chunk.status = "rejected", chunk.reason = error;
        } finally{
            initializingHandler = prevHandler;
        }
    }
    function initializeModuleChunk(chunk) {
        try {
            var value = requireModule(chunk.value);
            chunk.status = "fulfilled";
            chunk.value = value;
        } catch (error) {
            chunk.status = "rejected", chunk.reason = error;
        }
    }
    function reportGlobalError(response, error) {
        response._chunks.forEach(function(chunk) {
            "pending" === chunk.status && triggerErrorOnChunk(chunk, error);
        });
    }
    function nullRefGetter() {
        return null;
    }
    function createLazyChunkWrapper(chunk) {
        var lazyType = {
            $$typeof: REACT_LAZY_TYPE,
            _payload: chunk,
            _init: readChunk
        };
        chunk = chunk._debugInfo || (chunk._debugInfo = []);
        lazyType._debugInfo = chunk;
        return lazyType;
    }
    function getChunk(response, id) {
        var chunks = response._chunks, chunk = chunks.get(id);
        chunk || (chunk = createPendingChunk(response), chunks.set(id, chunk));
        return chunk;
    }
    function waitForReference(referencedChunk, parentObject, key, response, map, path) {
        function fulfill(value) {
            for(var i = 1; i < path.length; i++){
                for(; value.$$typeof === REACT_LAZY_TYPE;)if (value = value._payload, value === handler.chunk) value = handler.value;
                else if ("fulfilled" === value.status) value = value.value;
                else {
                    path.splice(0, i - 1);
                    value.then(fulfill, reject);
                    return;
                }
                value = value[path[i]];
            }
            i = map(response, value, parentObject, key);
            parentObject[key] = i;
            "" === key && null === handler.value && (handler.value = i);
            if (parentObject[0] === REACT_ELEMENT_TYPE && "object" === typeof handler.value && null !== handler.value && handler.value.$$typeof === REACT_ELEMENT_TYPE) switch(value = handler.value, key){
                case "3":
                    value.props = i;
                    break;
                case "4":
                    value._owner = i;
            }
            handler.deps--;
            0 === handler.deps && (i = handler.chunk, null !== i && "blocked" === i.status && (value = i.value, i.status = "fulfilled", i.value = handler.value, null !== value && wakeChunk(value, handler.value)));
        }
        function reject(error) {
            if (!handler.errored) {
                var blockedValue = handler.value;
                handler.errored = !0;
                handler.value = error;
                var chunk = handler.chunk;
                null !== chunk && "blocked" === chunk.status && ("object" === typeof blockedValue && null !== blockedValue && blockedValue.$$typeof === REACT_ELEMENT_TYPE && (blockedValue = {
                    name: getComponentNameFromType(blockedValue.type) || "",
                    owner: blockedValue._owner
                }, (chunk._debugInfo || (chunk._debugInfo = [])).push(blockedValue)), triggerErrorOnChunk(chunk, error));
            }
        }
        if (initializingHandler) {
            var handler = initializingHandler;
            handler.deps++;
        } else handler = initializingHandler = {
            parent: null,
            chunk: null,
            value: null,
            deps: 1,
            errored: !1
        };
        referencedChunk.then(fulfill, reject);
        return null;
    }
    function loadServerReference(response, metaData, parentObject, key) {
        if (!response._serverReferenceConfig) return createBoundServerReference(metaData, response._callServer, response._encodeFormAction, response._debugFindSourceMapURL);
        var serverReference = resolveServerReference(response._serverReferenceConfig, metaData.id);
        if (response = preloadModule(serverReference)) metaData.bound && (response = Promise.all([
            response,
            metaData.bound
        ]));
        else if (metaData.bound) response = Promise.resolve(metaData.bound);
        else return requireModule(serverReference);
        if (initializingHandler) {
            var handler = initializingHandler;
            handler.deps++;
        } else handler = initializingHandler = {
            parent: null,
            chunk: null,
            value: null,
            deps: 1,
            errored: !1
        };
        response.then(function() {
            var resolvedValue = requireModule(serverReference);
            if (metaData.bound) {
                var boundArgs = metaData.bound.value.slice(0);
                boundArgs.unshift(null);
                resolvedValue = resolvedValue.bind.apply(resolvedValue, boundArgs);
            }
            parentObject[key] = resolvedValue;
            "" === key && null === handler.value && (handler.value = resolvedValue);
            if (parentObject[0] === REACT_ELEMENT_TYPE && "object" === typeof handler.value && null !== handler.value && handler.value.$$typeof === REACT_ELEMENT_TYPE) switch(boundArgs = handler.value, key){
                case "3":
                    boundArgs.props = resolvedValue;
                    break;
                case "4":
                    boundArgs._owner = resolvedValue;
            }
            handler.deps--;
            0 === handler.deps && (resolvedValue = handler.chunk, null !== resolvedValue && "blocked" === resolvedValue.status && (boundArgs = resolvedValue.value, resolvedValue.status = "fulfilled", resolvedValue.value = handler.value, null !== boundArgs && wakeChunk(boundArgs, handler.value)));
        }, function(error) {
            if (!handler.errored) {
                var blockedValue = handler.value;
                handler.errored = !0;
                handler.value = error;
                var chunk = handler.chunk;
                null !== chunk && "blocked" === chunk.status && ("object" === typeof blockedValue && null !== blockedValue && blockedValue.$$typeof === REACT_ELEMENT_TYPE && (blockedValue = {
                    name: getComponentNameFromType(blockedValue.type) || "",
                    owner: blockedValue._owner
                }, (chunk._debugInfo || (chunk._debugInfo = [])).push(blockedValue)), triggerErrorOnChunk(chunk, error));
            }
        });
        return null;
    }
    function getOutlinedModel(response, reference, parentObject, key, map) {
        reference = reference.split(":");
        var id = parseInt(reference[0], 16);
        id = getChunk(response, id);
        switch(id.status){
            case "resolved_model":
                initializeModelChunk(id);
                break;
            case "resolved_module":
                initializeModuleChunk(id);
        }
        switch(id.status){
            case "fulfilled":
                for(var value = id.value, i = 1; i < reference.length; i++){
                    for(; value.$$typeof === REACT_LAZY_TYPE;)if (value = value._payload, "fulfilled" === value.status) value = value.value;
                    else return waitForReference(value, parentObject, key, response, map, reference.slice(i - 1));
                    value = value[reference[i]];
                }
                response = map(response, value, parentObject, key);
                id._debugInfo && ("object" !== typeof response || null === response || !isArrayImpl(response) && "function" !== typeof response[ASYNC_ITERATOR] && response.$$typeof !== REACT_ELEMENT_TYPE || response._debugInfo || Object.defineProperty(response, "_debugInfo", {
                    configurable: !1,
                    enumerable: !1,
                    writable: !0,
                    value: id._debugInfo
                }));
                return response;
            case "pending":
            case "blocked":
                return waitForReference(id, parentObject, key, response, map, reference);
            default:
                return initializingHandler ? (initializingHandler.errored = !0, initializingHandler.value = id.reason) : initializingHandler = {
                    parent: null,
                    chunk: null,
                    value: id.reason,
                    deps: 0,
                    errored: !0
                }, null;
        }
    }
    function createMap(response, model) {
        return new Map(model);
    }
    function createSet(response, model) {
        return new Set(model);
    }
    function createBlob(response, model) {
        return new Blob(model.slice(1), {
            type: model[0]
        });
    }
    function createFormData(response, model) {
        response = new FormData();
        for(var i = 0; i < model.length; i++)response.append(model[i][0], model[i][1]);
        return response;
    }
    function extractIterator(response, model) {
        return model[Symbol.iterator]();
    }
    function createModel(response, model) {
        return model;
    }
    function parseModelString(response, parentObject, key, value) {
        if ("$" === value[0]) {
            if ("$" === value) return null !== initializingHandler && "0" === key && (initializingHandler = {
                parent: initializingHandler,
                chunk: null,
                value: null,
                deps: 0,
                errored: !1
            }), REACT_ELEMENT_TYPE;
            switch(value[1]){
                case "$":
                    return value.slice(1);
                case "L":
                    return parentObject = parseInt(value.slice(2), 16), response = getChunk(response, parentObject), createLazyChunkWrapper(response);
                case "@":
                    if (2 === value.length) return new Promise(function() {});
                    parentObject = parseInt(value.slice(2), 16);
                    return getChunk(response, parentObject);
                case "S":
                    return Symbol.for(value.slice(2));
                case "F":
                    return value = value.slice(2), getOutlinedModel(response, value, parentObject, key, loadServerReference);
                case "T":
                    parentObject = "$" + value.slice(2);
                    response = response._tempRefs;
                    if (null == response) throw Error("Missing a temporary reference set but the RSC response returned a temporary reference. Pass a temporaryReference option with the set that was used with the reply.");
                    return response.get(parentObject);
                case "Q":
                    return value = value.slice(2), getOutlinedModel(response, value, parentObject, key, createMap);
                case "W":
                    return value = value.slice(2), getOutlinedModel(response, value, parentObject, key, createSet);
                case "B":
                    return value = value.slice(2), getOutlinedModel(response, value, parentObject, key, createBlob);
                case "K":
                    return value = value.slice(2), getOutlinedModel(response, value, parentObject, key, createFormData);
                case "Z":
                    return value = value.slice(2), getOutlinedModel(response, value, parentObject, key, resolveErrorDev);
                case "i":
                    return value = value.slice(2), getOutlinedModel(response, value, parentObject, key, extractIterator);
                case "I":
                    return Infinity;
                case "-":
                    return "$-0" === value ? -0 : -Infinity;
                case "N":
                    return NaN;
                case "u":
                    return;
                case "D":
                    return new Date(Date.parse(value.slice(2)));
                case "n":
                    return BigInt(value.slice(2));
                case "E":
                    try {
                        return (0, eval)(value.slice(2));
                    } catch (x) {
                        return function() {};
                    }
                case "Y":
                    return Object.defineProperty(parentObject, key, {
                        get: function() {
                            return "This object has been omitted by React in the console log to avoid sending too much data from the server. Try logging smaller or more specific objects.";
                        },
                        enumerable: !0,
                        configurable: !1
                    }), null;
                default:
                    return value = value.slice(1), getOutlinedModel(response, value, parentObject, key, createModel);
            }
        }
        return value;
    }
    function missingCall() {
        throw Error('Trying to call a function from "use server" but the callServer option was not implemented in your router runtime.');
    }
    function ResponseInstance(bundlerConfig, serverReferenceConfig, moduleLoading, callServer, encodeFormAction, nonce, temporaryReferences, findSourceMapURL, replayConsole, environmentName) {
        var chunks = new Map();
        this._bundlerConfig = bundlerConfig;
        this._serverReferenceConfig = serverReferenceConfig;
        this._moduleLoading = moduleLoading;
        this._callServer = void 0 !== callServer ? callServer : missingCall;
        this._encodeFormAction = encodeFormAction;
        this._nonce = nonce;
        this._chunks = chunks;
        this._stringDecoder = new TextDecoder();
        this._fromJSON = null;
        this._rowLength = this._rowTag = this._rowID = this._rowState = 0;
        this._buffer = [];
        this._tempRefs = temporaryReferences;
        this._debugRootOwner = bundlerConfig = void 0 === ReactSharedInteralsServer || null === ReactSharedInteralsServer.A ? null : ReactSharedInteralsServer.A.getOwner();
        this._debugRootStack = null !== bundlerConfig ? Error("react-stack-top-frame") : null;
        this._debugFindSourceMapURL = findSourceMapURL;
        this._replayConsole = replayConsole;
        this._rootEnvironmentName = void 0 === environmentName ? "Server" : environmentName;
        this._fromJSON = createFromJSONCallback(this);
    }
    function resolveModel(response, id, model) {
        var chunks = response._chunks, chunk = chunks.get(id);
        chunk ? resolveModelChunk(chunk, model) : chunks.set(id, new ReactPromise("resolved_model", model, null, response));
    }
    function resolveText(response, id, text) {
        var chunks = response._chunks, chunk = chunks.get(id);
        chunk && "pending" !== chunk.status ? chunk.reason.enqueueValue(text) : chunks.set(id, new ReactPromise("fulfilled", text, null, response));
    }
    function resolveBuffer(response, id, buffer) {
        var chunks = response._chunks, chunk = chunks.get(id);
        chunk && "pending" !== chunk.status ? chunk.reason.enqueueValue(buffer) : chunks.set(id, new ReactPromise("fulfilled", buffer, null, response));
    }
    function resolveModule(response, id, model) {
        var chunks = response._chunks, chunk = chunks.get(id);
        model = JSON.parse(model, response._fromJSON);
        var clientReference = resolveClientReference(response._bundlerConfig, model);
        if (model = preloadModule(clientReference)) {
            if (chunk) {
                var blockedChunk = chunk;
                blockedChunk.status = "blocked";
            } else blockedChunk = new ReactPromise("blocked", null, null, response), chunks.set(id, blockedChunk);
            model.then(function() {
                return resolveModuleChunk(blockedChunk, clientReference);
            }, function(error) {
                return triggerErrorOnChunk(blockedChunk, error);
            });
        } else chunk ? resolveModuleChunk(chunk, clientReference) : chunks.set(id, new ReactPromise("resolved_module", clientReference, null, response));
    }
    function resolveStream(response, id, stream, controller) {
        var chunks = response._chunks, chunk = chunks.get(id);
        chunk ? "pending" === chunk.status && (response = chunk.value, chunk.status = "fulfilled", chunk.value = stream, chunk.reason = controller, null !== response && wakeChunk(response, chunk.value)) : chunks.set(id, new ReactPromise("fulfilled", stream, controller, response));
    }
    function startReadableStream(response, id, type) {
        var controller = null;
        type = new ReadableStream({
            type: type,
            start: function(c) {
                controller = c;
            }
        });
        var previousBlockedChunk = null;
        resolveStream(response, id, type, {
            enqueueValue: function(value) {
                null === previousBlockedChunk ? controller.enqueue(value) : previousBlockedChunk.then(function() {
                    controller.enqueue(value);
                });
            },
            enqueueModel: function(json) {
                if (null === previousBlockedChunk) {
                    var chunk = new ReactPromise("resolved_model", json, null, response);
                    initializeModelChunk(chunk);
                    "fulfilled" === chunk.status ? controller.enqueue(chunk.value) : (chunk.then(function(v) {
                        return controller.enqueue(v);
                    }, function(e) {
                        return controller.error(e);
                    }), previousBlockedChunk = chunk);
                } else {
                    chunk = previousBlockedChunk;
                    var _chunk3 = createPendingChunk(response);
                    _chunk3.then(function(v) {
                        return controller.enqueue(v);
                    }, function(e) {
                        return controller.error(e);
                    });
                    previousBlockedChunk = _chunk3;
                    chunk.then(function() {
                        previousBlockedChunk === _chunk3 && (previousBlockedChunk = null);
                        resolveModelChunk(_chunk3, json);
                    });
                }
            },
            close: function() {
                if (null === previousBlockedChunk) controller.close();
                else {
                    var blockedChunk = previousBlockedChunk;
                    previousBlockedChunk = null;
                    blockedChunk.then(function() {
                        return controller.close();
                    });
                }
            },
            error: function(error) {
                if (null === previousBlockedChunk) controller.error(error);
                else {
                    var blockedChunk = previousBlockedChunk;
                    previousBlockedChunk = null;
                    blockedChunk.then(function() {
                        return controller.error(error);
                    });
                }
            }
        });
    }
    function asyncIterator() {
        return this;
    }
    function createIterator(next) {
        next = {
            next: next
        };
        next[ASYNC_ITERATOR] = asyncIterator;
        return next;
    }
    function startAsyncIterable(response, id, iterator) {
        var buffer = [], closed = !1, nextWriteIndex = 0, iterable = _defineProperty({}, ASYNC_ITERATOR, function() {
            var nextReadIndex = 0;
            return createIterator(function(arg) {
                if (void 0 !== arg) throw Error("Values cannot be passed to next() of AsyncIterables passed to Client Components.");
                if (nextReadIndex === buffer.length) {
                    if (closed) return new ReactPromise("fulfilled", {
                        done: !0,
                        value: void 0
                    }, null, response);
                    buffer[nextReadIndex] = createPendingChunk(response);
                }
                return buffer[nextReadIndex++];
            });
        });
        resolveStream(response, id, iterator ? iterable[ASYNC_ITERATOR]() : iterable, {
            enqueueValue: function(value) {
                if (nextWriteIndex === buffer.length) buffer[nextWriteIndex] = new ReactPromise("fulfilled", {
                    done: !1,
                    value: value
                }, null, response);
                else {
                    var chunk = buffer[nextWriteIndex], resolveListeners = chunk.value, rejectListeners = chunk.reason;
                    chunk.status = "fulfilled";
                    chunk.value = {
                        done: !1,
                        value: value
                    };
                    null !== resolveListeners && wakeChunkIfInitialized(chunk, resolveListeners, rejectListeners);
                }
                nextWriteIndex++;
            },
            enqueueModel: function(value) {
                nextWriteIndex === buffer.length ? buffer[nextWriteIndex] = createResolvedIteratorResultChunk(response, value, !1) : resolveIteratorResultChunk(buffer[nextWriteIndex], value, !1);
                nextWriteIndex++;
            },
            close: function(value) {
                closed = !0;
                nextWriteIndex === buffer.length ? buffer[nextWriteIndex] = createResolvedIteratorResultChunk(response, value, !0) : resolveIteratorResultChunk(buffer[nextWriteIndex], value, !0);
                for(nextWriteIndex++; nextWriteIndex < buffer.length;)resolveIteratorResultChunk(buffer[nextWriteIndex++], '"$undefined"', !0);
            },
            error: function(error) {
                closed = !0;
                for(nextWriteIndex === buffer.length && (buffer[nextWriteIndex] = createPendingChunk(response)); nextWriteIndex < buffer.length;)triggerErrorOnChunk(buffer[nextWriteIndex++], error);
            }
        });
    }
    function stopStream(response, id, row) {
        (response = response._chunks.get(id)) && "fulfilled" === response.status && response.reason.close("" === row ? '"$undefined"' : row);
    }
    function resolveErrorDev(response, errorInfo) {
        var env = errorInfo.env;
        errorInfo = buildFakeCallStack(response, errorInfo.stack, env, Error.bind(null, errorInfo.message || "An error occurred in the Server Components render but no message was provided"));
        response = getRootTask(response, env);
        response = null != response ? response.run(errorInfo) : errorInfo();
        response.environmentName = env;
        return response;
    }
    function resolveHint(response, code, model) {
        response = JSON.parse(model, response._fromJSON);
        model = ReactDOMSharedInternals.d;
        switch(code){
            case "D":
                model.D(response);
                break;
            case "C":
                "string" === typeof response ? model.C(response) : model.C(response[0], response[1]);
                break;
            case "L":
                code = response[0];
                var as = response[1];
                3 === response.length ? model.L(code, as, response[2]) : model.L(code, as);
                break;
            case "m":
                "string" === typeof response ? model.m(response) : model.m(response[0], response[1]);
                break;
            case "X":
                "string" === typeof response ? model.X(response) : model.X(response[0], response[1]);
                break;
            case "S":
                "string" === typeof response ? model.S(response) : model.S(response[0], 0 === response[1] ? void 0 : response[1], 3 === response.length ? response[2] : void 0);
                break;
            case "M":
                "string" === typeof response ? model.M(response) : model.M(response[0], response[1]);
        }
    }
    function createFakeFunction(name, filename, sourceMap, line, col, environmentName) {
        name || (name = "<anonymous>");
        var encodedName = JSON.stringify(name);
        1 >= line ? (line = encodedName.length + 7, col = "({" + encodedName + ":_=>" + " ".repeat(col < line ? 0 : col - line) + "_()})\n/* This module was rendered by a Server Component. Turn on Source Maps to see the server source. */") : col = "/* This module was rendered by a Server Component. Turn on Source Maps to see the server source. */" + "\n".repeat(line - 2) + "({" + encodedName + ":_=>\n" + " ".repeat(1 > col ? 0 : col - 1) + "_()})";
        filename.startsWith("/") && (filename = "file://" + filename);
        sourceMap ? (col += "\n//# sourceURL=rsc://React/" + encodeURIComponent(environmentName) + "/" + encodeURI(filename) + "?" + fakeFunctionIdx++, col += "\n//# sourceMappingURL=" + sourceMap) : col = filename ? col + ("\n//# sourceURL=" + encodeURI(filename)) : col + "\n//# sourceURL=<anonymous>";
        try {
            var fn = (0, eval)(col)[name];
        } catch (x) {
            fn = function(_) {
                return _();
            };
        }
        return fn;
    }
    function buildFakeCallStack(response, stack, environmentName, innerCall) {
        for(var i = 0; i < stack.length; i++){
            var frame = stack[i], frameKey = frame.join("-") + "-" + environmentName, fn = fakeFunctionCache.get(frameKey);
            if (void 0 === fn) {
                fn = frame[0];
                var filename = frame[1], line = frame[2];
                frame = frame[3];
                var findSourceMapURL = response._debugFindSourceMapURL;
                findSourceMapURL = findSourceMapURL ? findSourceMapURL(filename, environmentName) : null;
                fn = createFakeFunction(fn, filename, findSourceMapURL, line, frame, environmentName);
                fakeFunctionCache.set(frameKey, fn);
            }
            innerCall = fn.bind(null, innerCall);
        }
        return innerCall;
    }
    function getRootTask(response, childEnvironmentName) {
        var rootTask = response._debugRootTask;
        return rootTask ? response._rootEnvironmentName !== childEnvironmentName ? (response = console.createTask.bind(console, '"use ' + childEnvironmentName.toLowerCase() + '"'), rootTask.run(response)) : rootTask : null;
    }
    function fakeJSXCallSite() {
        return Error("react-stack-top-frame");
    }
    function initializeFakeStack(response, debugInfo) {
        void 0 === debugInfo.debugStack && (null != debugInfo.stack && (debugInfo.debugStack = createFakeJSXCallStackInDEV(response, debugInfo.stack, null == debugInfo.env ? "" : debugInfo.env)), null != debugInfo.owner && initializeFakeStack(response, debugInfo.owner));
    }
    function resolveDebugInfo(response, id, debugInfo) {
        null === debugInfo.owner && null != response._debugRootOwner ? (debugInfo.owner = response._debugRootOwner, debugInfo.debugStack = response._debugRootStack) : initializeFakeStack(response, debugInfo);
        response = getChunk(response, id);
        (response._debugInfo || (response._debugInfo = [])).push(debugInfo);
    }
    function getCurrentStackInDEV() {
        return "";
    }
    function resolveConsoleEntry(response, value) {
        if (response._replayConsole) {
            var payload = JSON.parse(value, response._fromJSON);
            value = payload[0];
            var stackTrace = payload[1], owner = payload[2], env = payload[3];
            payload = payload.slice(4);
            replayConsoleWithCallStackInDEV(response, value, stackTrace, owner, env, payload);
        }
    }
    function mergeBuffer(buffer, lastChunk) {
        for(var l = buffer.length, byteLength = lastChunk.length, i = 0; i < l; i++)byteLength += buffer[i].byteLength;
        byteLength = new Uint8Array(byteLength);
        for(var _i2 = i = 0; _i2 < l; _i2++){
            var chunk = buffer[_i2];
            byteLength.set(chunk, i);
            i += chunk.byteLength;
        }
        byteLength.set(lastChunk, i);
        return byteLength;
    }
    function resolveTypedArray(response, id, buffer, lastChunk, constructor, bytesPerElement) {
        buffer = 0 === buffer.length && 0 === lastChunk.byteOffset % bytesPerElement ? lastChunk : mergeBuffer(buffer, lastChunk);
        constructor = new constructor(buffer.buffer, buffer.byteOffset, buffer.byteLength / bytesPerElement);
        resolveBuffer(response, id, constructor);
    }
    function processFullBinaryRow(response, id, tag, buffer, chunk) {
        switch(tag){
            case 65:
                resolveBuffer(response, id, mergeBuffer(buffer, chunk).buffer);
                return;
            case 79:
                resolveTypedArray(response, id, buffer, chunk, Int8Array, 1);
                return;
            case 111:
                resolveBuffer(response, id, 0 === buffer.length ? chunk : mergeBuffer(buffer, chunk));
                return;
            case 85:
                resolveTypedArray(response, id, buffer, chunk, Uint8ClampedArray, 1);
                return;
            case 83:
                resolveTypedArray(response, id, buffer, chunk, Int16Array, 2);
                return;
            case 115:
                resolveTypedArray(response, id, buffer, chunk, Uint16Array, 2);
                return;
            case 76:
                resolveTypedArray(response, id, buffer, chunk, Int32Array, 4);
                return;
            case 108:
                resolveTypedArray(response, id, buffer, chunk, Uint32Array, 4);
                return;
            case 71:
                resolveTypedArray(response, id, buffer, chunk, Float32Array, 4);
                return;
            case 103:
                resolveTypedArray(response, id, buffer, chunk, Float64Array, 8);
                return;
            case 77:
                resolveTypedArray(response, id, buffer, chunk, BigInt64Array, 8);
                return;
            case 109:
                resolveTypedArray(response, id, buffer, chunk, BigUint64Array, 8);
                return;
            case 86:
                resolveTypedArray(response, id, buffer, chunk, DataView, 1);
                return;
        }
        for(var stringDecoder = response._stringDecoder, row = "", i = 0; i < buffer.length; i++)row += stringDecoder.decode(buffer[i], decoderOptions);
        row += stringDecoder.decode(chunk);
        processFullStringRow(response, id, tag, row);
    }
    function processFullStringRow(response, id, tag, row) {
        switch(tag){
            case 73:
                resolveModule(response, id, row);
                break;
            case 72:
                resolveHint(response, row[0], row.slice(1));
                break;
            case 69:
                row = JSON.parse(row);
                tag = resolveErrorDev(response, row);
                tag.digest = row.digest;
                row = response._chunks;
                var chunk = row.get(id);
                chunk ? triggerErrorOnChunk(chunk, tag) : row.set(id, new ReactPromise("rejected", null, tag, response));
                break;
            case 84:
                resolveText(response, id, row);
                break;
            case 68:
                tag = new ReactPromise("resolved_model", row, null, response);
                initializeModelChunk(tag);
                "fulfilled" === tag.status ? resolveDebugInfo(response, id, tag.value) : tag.then(function(v) {
                    return resolveDebugInfo(response, id, v);
                }, function() {});
                break;
            case 87:
                resolveConsoleEntry(response, row);
                break;
            case 82:
                startReadableStream(response, id, void 0);
                break;
            case 114:
                startReadableStream(response, id, "bytes");
                break;
            case 88:
                startAsyncIterable(response, id, !1);
                break;
            case 120:
                startAsyncIterable(response, id, !0);
                break;
            case 67:
                stopStream(response, id, row);
                break;
            default:
                resolveModel(response, id, row);
        }
    }
    function createFromJSONCallback(response) {
        return function(key, value) {
            if ("string" === typeof value) return parseModelString(response, this, key, value);
            if ("object" === typeof value && null !== value) {
                if (value[0] === REACT_ELEMENT_TYPE) if (key = value[4], value = {
                    $$typeof: REACT_ELEMENT_TYPE,
                    type: value[1],
                    key: value[2],
                    props: value[3],
                    _owner: null === key ? response._debugRootOwner : key
                }, Object.defineProperty(value, "ref", {
                    enumerable: !1,
                    get: nullRefGetter
                }), value._store = {}, Object.defineProperty(value._store, "validated", {
                    configurable: !1,
                    enumerable: !1,
                    writable: !0,
                    value: 1
                }), Object.defineProperty(value, "_debugInfo", {
                    configurable: !1,
                    enumerable: !1,
                    writable: !0,
                    value: null
                }), null !== initializingHandler) {
                    var handler = initializingHandler;
                    initializingHandler = handler.parent;
                    handler.errored ? (key = new ReactPromise("rejected", null, handler.value, response), value = {
                        name: getComponentNameFromType(value.type) || "",
                        owner: value._owner
                    }, key._debugInfo = [
                        value
                    ], value = createLazyChunkWrapper(key)) : 0 < handler.deps && (key = new ReactPromise("blocked", null, null, response), handler.value = value, handler.chunk = key, value = Object.freeze.bind(Object, value.props), key.then(value, value), value = createLazyChunkWrapper(key));
                } else Object.freeze(value.props);
                return value;
            }
            return value;
        };
    }
    function createResponseFromOptions(options) {
        return new ResponseInstance(null, null, null, options && options.callServer ? options.callServer : void 0, void 0, void 0, options && options.temporaryReferences ? options.temporaryReferences : void 0, options && options.findSourceMapURL ? options.findSourceMapURL : void 0, options ? !1 !== options.replayConsoleLogs : !0, options && options.environmentName ? options.environmentName : void 0);
    }
    function startReadingFromStream(response, stream) {
        function progress(_ref) {
            var value = _ref.value;
            if (_ref.done) reportGlobalError(response, Error("Connection closed."));
            else {
                var i = 0, rowState = response._rowState;
                _ref = response._rowID;
                for(var rowTag = response._rowTag, rowLength = response._rowLength, buffer = response._buffer, chunkLength = value.length; i < chunkLength;){
                    var lastIdx = -1;
                    switch(rowState){
                        case 0:
                            lastIdx = value[i++];
                            58 === lastIdx ? rowState = 1 : _ref = _ref << 4 | (96 < lastIdx ? lastIdx - 87 : lastIdx - 48);
                            continue;
                        case 1:
                            rowState = value[i];
                            84 === rowState || 65 === rowState || 79 === rowState || 111 === rowState || 85 === rowState || 83 === rowState || 115 === rowState || 76 === rowState || 108 === rowState || 71 === rowState || 103 === rowState || 77 === rowState || 109 === rowState || 86 === rowState ? (rowTag = rowState, rowState = 2, i++) : 64 < rowState && 91 > rowState || 35 === rowState || 114 === rowState || 120 === rowState ? (rowTag = rowState, rowState = 3, i++) : (rowTag = 0, rowState = 3);
                            continue;
                        case 2:
                            lastIdx = value[i++];
                            44 === lastIdx ? rowState = 4 : rowLength = rowLength << 4 | (96 < lastIdx ? lastIdx - 87 : lastIdx - 48);
                            continue;
                        case 3:
                            lastIdx = value.indexOf(10, i);
                            break;
                        case 4:
                            lastIdx = i + rowLength, lastIdx > value.length && (lastIdx = -1);
                    }
                    var offset = value.byteOffset + i;
                    if (-1 < lastIdx) rowLength = new Uint8Array(value.buffer, offset, lastIdx - i), processFullBinaryRow(response, _ref, rowTag, buffer, rowLength), i = lastIdx, 3 === rowState && i++, rowLength = _ref = rowTag = rowState = 0, buffer.length = 0;
                    else {
                        value = new Uint8Array(value.buffer, offset, value.byteLength - i);
                        buffer.push(value);
                        rowLength -= value.byteLength;
                        break;
                    }
                }
                response._rowState = rowState;
                response._rowID = _ref;
                response._rowTag = rowTag;
                response._rowLength = rowLength;
                return reader.read().then(progress).catch(error);
            }
        }
        function error(e) {
            reportGlobalError(response, e);
        }
        var reader = stream.getReader();
        reader.read().then(progress).catch(error);
    }
    var React = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"), ReactDOM = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)"), decoderOptions = {
        stream: !0
    }, bind = Function.prototype.bind, chunkCache = new Map(), ReactDOMSharedInternals = ReactDOM.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler");
    Symbol.for("react.provider");
    var REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, ASYNC_ITERATOR = Symbol.asyncIterator, isArrayImpl = Array.isArray, getPrototypeOf = Object.getPrototypeOf, jsxPropsParents = new WeakMap(), jsxChildrenParents = new WeakMap(), CLIENT_REFERENCE_TAG = Symbol.for("react.client.reference"), ObjectPrototype = Object.prototype, knownServerReferences = new WeakMap(), fakeServerFunctionIdx = 0, v8FrameRegExp = /^ {3} at (?:(.+) \((.+):(\d+):(\d+)\)|(?:async )?(.+):(\d+):(\d+))$/, jscSpiderMonkeyFrameRegExp = /(?:(.*)@)?(.*):(\d+):(\d+)/, REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference");
    new ("function" === typeof WeakMap ? WeakMap : Map)();
    var ReactSharedInteralsServer = React.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE || ReactSharedInteralsServer;
    ReactPromise.prototype = Object.create(Promise.prototype);
    ReactPromise.prototype.then = function(resolve, reject) {
        switch(this.status){
            case "resolved_model":
                initializeModelChunk(this);
                break;
            case "resolved_module":
                initializeModuleChunk(this);
        }
        switch(this.status){
            case "fulfilled":
                resolve(this.value);
                break;
            case "pending":
            case "blocked":
                resolve && (null === this.value && (this.value = []), this.value.push(resolve));
                reject && (null === this.reason && (this.reason = []), this.reason.push(reject));
                break;
            default:
                reject && reject(this.reason);
        }
    };
    var initializingHandler = null, fakeFunctionCache = new Map(), fakeFunctionIdx = 0, createFakeJSXCallStack = {
        "react-stack-bottom-frame": function(response, stack, environmentName) {
            return buildFakeCallStack(response, stack, environmentName, fakeJSXCallSite)();
        }
    }, createFakeJSXCallStackInDEV = createFakeJSXCallStack["react-stack-bottom-frame"].bind(createFakeJSXCallStack), currentOwnerInDEV = null, replayConsoleWithCallStack = {
        "react-stack-bottom-frame": function(response, methodName, stackTrace, owner, env, args) {
            var prevStack = ReactSharedInternals.getCurrentStack;
            ReactSharedInternals.getCurrentStack = getCurrentStackInDEV;
            currentOwnerInDEV = null === owner ? response._debugRootOwner : owner;
            try {
                a: {
                    var offset = 0;
                    switch(methodName){
                        case "dir":
                        case "dirxml":
                        case "groupEnd":
                        case "table":
                            var JSCompiler_inline_result = bind.apply(console[methodName], [
                                console
                            ].concat(args));
                            break a;
                        case "assert":
                            offset = 1;
                    }
                    var newArgs = args.slice(0);
                    "string" === typeof newArgs[offset] ? newArgs.splice(offset, 1, "%c%s%c " + newArgs[offset], "background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px", " " + env + " ", "") : newArgs.splice(offset, 0, "%c%s%c ", "background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px", " " + env + " ", "");
                    newArgs.unshift(console);
                    JSCompiler_inline_result = bind.apply(console[methodName], newArgs);
                }
                var callStack = buildFakeCallStack(response, stackTrace, env, JSCompiler_inline_result);
                null != owner && initializeFakeStack(response, owner);
                var rootTask = getRootTask(response, env);
                null != rootTask ? rootTask.run(callStack) : callStack();
            } finally{
                currentOwnerInDEV = null, ReactSharedInternals.getCurrentStack = prevStack;
            }
        }
    }, replayConsoleWithCallStackInDEV = replayConsoleWithCallStack["react-stack-bottom-frame"].bind(replayConsoleWithCallStack);
    (function(internals) {
        if ("undefined" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) return !1;
        var hook = __REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (hook.isDisabled || !hook.supportsFlight) return !0;
        try {
            hook.inject(internals);
        } catch (err) {
            console.error("React instrumentation encountered an error: %s.", err);
        }
        return hook.checkDCE ? !0 : !1;
    })({
        bundleType: 1,
        version: "19.0.0-rc-66855b96-20241106",
        rendererPackageName: "react-server-dom-turbopack",
        currentDispatcherRef: ReactSharedInternals,
        reconcilerVersion: "19.0.0-rc-66855b96-20241106",
        getCurrentComponentInfo: function() {
            return currentOwnerInDEV;
        }
    });
    exports.createFromFetch = function(promiseForResponse, options) {
        var response = createResponseFromOptions(options);
        promiseForResponse.then(function(r) {
            startReadingFromStream(response, r.body);
        }, function(e) {
            reportGlobalError(response, e);
        });
        return getChunk(response, 0);
    };
    exports.createFromReadableStream = function(stream, options) {
        options = createResponseFromOptions(options);
        startReadingFromStream(options, stream);
        return getChunk(options, 0);
    };
    exports.createServerReference = function(id, callServer, encodeFormAction, findSourceMapURL, functionName) {
        function action() {
            var args = Array.prototype.slice.call(arguments);
            return callServer(id, args);
        }
        var location = parseStackLocation(Error("react-stack-top-frame"));
        if (null !== location) {
            encodeFormAction = location[1];
            var line = location[2];
            location = location[3];
            findSourceMapURL = null == findSourceMapURL ? null : findSourceMapURL(encodeFormAction, "Client");
            action = createFakeServerFunction(functionName || "", encodeFormAction, findSourceMapURL, line, location, "Client", action);
        }
        registerServerReference(action, {
            id: id,
            bound: null
        });
        return action;
    };
    exports.createTemporaryReferenceSet = function() {
        return new Map();
    };
    exports.encodeReply = function(value, options) {
        return new Promise(function(resolve, reject) {
            var abort = processReply(value, "", options && options.temporaryReferences ? options.temporaryReferences : void 0, resolve, reject);
            if (options && options.signal) {
                var signal = options.signal;
                if (signal.aborted) abort(signal.reason);
                else {
                    var listener = function() {
                        abort(signal.reason);
                        signal.removeEventListener("abort", listener);
                    };
                    signal.addEventListener("abort", listener);
                }
            }
        });
    };
}();
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-server-dom-turbopack/client.browser.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$0$2e$3_$40$babel$2b$core$40$7$2e$26$2e$0_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_babel$2d$plugin$2d$macros$40$3$2e$1$2e$0_react$2d$dom$40$1_5uj2k562ubpoy7gbyohpnyupru$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time falsy", 0) {
    "TURBOPACK unreachable";
} else {
    module.exports = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-server-dom-turbopack/cjs/react-server-dom-turbopack-client.browser.development.js [app-client] (ecmascript)");
}
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-server-dom-turbopack/client.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
'use strict';
module.exports = __turbopack_require__("[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/react-server-dom-turbopack/client.browser.js [app-client] (ecmascript)");
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/strip-ansi/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
(()=>{
    "use strict";
    var e = {
        511: (e)=>{
            e.exports = ({ onlyFirst: e = false } = {})=>{
                const r = [
                    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
                    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
                ].join("|");
                return new RegExp(r, e ? undefined : "g");
            };
        },
        532: (e, r, _)=>{
            const t = _(511);
            e.exports = (e)=>typeof e === "string" ? e.replace(t(), "") : e;
        }
    };
    var r = {};
    function __nccwpck_require__(_) {
        var t = r[_];
        if (t !== undefined) {
            return t.exports;
        }
        var a = r[_] = {
            exports: {}
        };
        var n = true;
        try {
            e[_](a, a.exports, __nccwpck_require__);
            n = false;
        } finally{
            if (n) delete r[_];
        }
        return a.exports;
    }
    if (typeof __nccwpck_require__ !== "undefined") __nccwpck_require__.ab = __dirname + "/";
    var _ = __nccwpck_require__(532);
    module.exports = _;
})();
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/stacktrace-parser/stack-trace-parser.cjs.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
(()=>{
    "use strict";
    if (typeof __nccwpck_require__ !== "undefined") __nccwpck_require__.ab = __dirname + "/";
    var e = {};
    (()=>{
        var r = e;
        Object.defineProperty(r, "__esModule", {
            value: true
        });
        var n = "<unknown>";
        function parse(e) {
            var r = e.split("\n");
            return r.reduce(function(e, r) {
                var n = parseChrome(r) || parseWinjs(r) || parseGecko(r) || parseNode(r) || parseJSC(r);
                if (n) {
                    e.push(n);
                }
                return e;
            }, []);
        }
        var a = /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/|[a-z]:\\|\\\\).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
        var l = /\((\S*)(?::(\d+))(?::(\d+))\)/;
        function parseChrome(e) {
            var r = a.exec(e);
            if (!r) {
                return null;
            }
            var u = r[2] && r[2].indexOf("native") === 0;
            var t = r[2] && r[2].indexOf("eval") === 0;
            var i = l.exec(r[2]);
            if (t && i != null) {
                r[2] = i[1];
                r[3] = i[2];
                r[4] = i[3];
            }
            return {
                file: !u ? r[2] : null,
                methodName: r[1] || n,
                arguments: u ? [
                    r[2]
                ] : [],
                lineNumber: r[3] ? +r[3] : null,
                column: r[4] ? +r[4] : null
            };
        }
        var u = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;
        function parseWinjs(e) {
            var r = u.exec(e);
            if (!r) {
                return null;
            }
            return {
                file: r[2],
                methodName: r[1] || n,
                arguments: [],
                lineNumber: +r[3],
                column: r[4] ? +r[4] : null
            };
        }
        var t = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|\[native).*?|[^@]*bundle)(?::(\d+))?(?::(\d+))?\s*$/i;
        var i = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
        function parseGecko(e) {
            var r = t.exec(e);
            if (!r) {
                return null;
            }
            var a = r[3] && r[3].indexOf(" > eval") > -1;
            var l = i.exec(r[3]);
            if (a && l != null) {
                r[3] = l[1];
                r[4] = l[2];
                r[5] = null;
            }
            return {
                file: r[3],
                methodName: r[1] || n,
                arguments: r[2] ? r[2].split(",") : [],
                lineNumber: r[4] ? +r[4] : null,
                column: r[5] ? +r[5] : null
            };
        }
        var s = /^\s*(?:([^@]*)(?:\((.*?)\))?@)?(\S.*?):(\d+)(?::(\d+))?\s*$/i;
        function parseJSC(e) {
            var r = s.exec(e);
            if (!r) {
                return null;
            }
            return {
                file: r[3],
                methodName: r[1] || n,
                arguments: [],
                lineNumber: +r[4],
                column: r[5] ? +r[5] : null
            };
        }
        var o = /^\s*at (?:((?:\[object object\])?[^\\/]+(?: \[as \S+\])?) )?\(?(.*?):(\d+)(?::(\d+))?\)?\s*$/i;
        function parseNode(e) {
            var r = o.exec(e);
            if (!r) {
                return null;
            }
            return {
                file: r[2],
                methodName: r[1] || n,
                arguments: [],
                lineNumber: +r[3],
                column: r[4] ? +r[4] : null
            };
        }
        r.parse = parse;
    })();
    module.exports = e;
})();
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/platform/platform.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
(()=>{
    var e = {
        541: function(e, i, t) {
            e = t.nmd(e);
            /*!
 * Platform.js v1.3.6
 * Copyright 2014-2020 Benjamin Tan
 * Copyright 2011-2013 John-David Dalton
 * Available under MIT license
 */ (function() {
                "use strict";
                var t = {
                    function: true,
                    object: true
                };
                var r = t[typeof window] && window || this;
                var a = r;
                var n = t[typeof i] && i;
                var o = t["object"] && e && !e.nodeType && e;
                var l = n && o && typeof global == "object" && global;
                if (l && (l.global === l || l.window === l || l.self === l)) {
                    r = l;
                }
                var s = Math.pow(2, 53) - 1;
                var f = /\bOpera/;
                var b = this;
                var c = Object.prototype;
                var p = c.hasOwnProperty;
                var u = c.toString;
                function capitalize(e) {
                    e = String(e);
                    return e.charAt(0).toUpperCase() + e.slice(1);
                }
                function cleanupOS(e, i, t) {
                    var r = {
                        "10.0": "10",
                        6.4: "10 Technical Preview",
                        6.3: "8.1",
                        6.2: "8",
                        6.1: "Server 2008 R2 / 7",
                        "6.0": "Server 2008 / Vista",
                        5.2: "Server 2003 / XP 64-bit",
                        5.1: "XP",
                        5.01: "2000 SP1",
                        "5.0": "2000",
                        "4.0": "NT",
                        "4.90": "ME"
                    };
                    if (i && t && /^Win/i.test(e) && !/^Windows Phone /i.test(e) && (r = r[/[\d.]+$/.exec(e)])) {
                        e = "Windows " + r;
                    }
                    e = String(e);
                    if (i && t) {
                        e = e.replace(RegExp(i, "i"), t);
                    }
                    e = format(e.replace(/ ce$/i, " CE").replace(/\bhpw/i, "web").replace(/\bMacintosh\b/, "Mac OS").replace(/_PowerPC\b/i, " OS").replace(/\b(OS X) [^ \d]+/i, "$1").replace(/\bMac (OS X)\b/, "$1").replace(/\/(\d)/, " $1").replace(/_/g, ".").replace(/(?: BePC|[ .]*fc[ \d.]+)$/i, "").replace(/\bx86\.64\b/gi, "x86_64").replace(/\b(Windows Phone) OS\b/, "$1").replace(/\b(Chrome OS \w+) [\d.]+\b/, "$1").split(" on ")[0]);
                    return e;
                }
                function each(e, i) {
                    var t = -1, r = e ? e.length : 0;
                    if (typeof r == "number" && r > -1 && r <= s) {
                        while(++t < r){
                            i(e[t], t, e);
                        }
                    } else {
                        forOwn(e, i);
                    }
                }
                function format(e) {
                    e = trim(e);
                    return /^(?:webOS|i(?:OS|P))/.test(e) ? e : capitalize(e);
                }
                function forOwn(e, i) {
                    for(var t in e){
                        if (p.call(e, t)) {
                            i(e[t], t, e);
                        }
                    }
                }
                function getClassOf(e) {
                    return e == null ? capitalize(e) : u.call(e).slice(8, -1);
                }
                function isHostType(e, i) {
                    var t = e != null ? typeof e[i] : "number";
                    return !/^(?:boolean|number|string|undefined)$/.test(t) && (t == "object" ? !!e[i] : true);
                }
                function qualify(e) {
                    return String(e).replace(/([ -])(?!$)/g, "$1?");
                }
                function reduce(e, i) {
                    var t = null;
                    each(e, function(r, a) {
                        t = i(t, r, a, e);
                    });
                    return t;
                }
                function trim(e) {
                    return String(e).replace(/^ +| +$/g, "");
                }
                function parse(e) {
                    var i = r;
                    var t = e && typeof e == "object" && getClassOf(e) != "String";
                    if (t) {
                        i = e;
                        e = null;
                    }
                    var n = i.navigator || {};
                    var o = n.userAgent || "";
                    e || (e = o);
                    var l = t || b == a;
                    var s = t ? !!n.likeChrome : /\bChrome\b/.test(e) && !/internal|\n/i.test(u.toString());
                    var c = "Object", p = t ? c : "ScriptBridgingProxyObject", d = t ? c : "Environment", S = t && i.java ? "JavaPackage" : getClassOf(i.java), x = t ? c : "RuntimeObject";
                    var m = /\bJava/.test(S) && i.java;
                    var g = m && getClassOf(i.environment) == d;
                    var h = m ? "a" : "α";
                    var v = m ? "b" : "β";
                    var O = i.document || {};
                    var y = i.operamini || i.opera;
                    var w = f.test(w = t && y ? y["[[Class]]"] : getClassOf(y)) ? w : y = null;
                    var M;
                    var E = e;
                    var P = [];
                    var C = null;
                    var k = e == o;
                    var B = k && y && typeof y.version == "function" && y.version();
                    var W;
                    var _ = getLayout([
                        {
                            label: "EdgeHTML",
                            pattern: "Edge"
                        },
                        "Trident",
                        {
                            label: "WebKit",
                            pattern: "AppleWebKit"
                        },
                        "iCab",
                        "Presto",
                        "NetFront",
                        "Tasman",
                        "KHTML",
                        "Gecko"
                    ]);
                    var R = getName([
                        "Adobe AIR",
                        "Arora",
                        "Avant Browser",
                        "Breach",
                        "Camino",
                        "Electron",
                        "Epiphany",
                        "Fennec",
                        "Flock",
                        "Galeon",
                        "GreenBrowser",
                        "iCab",
                        "Iceweasel",
                        "K-Meleon",
                        "Konqueror",
                        "Lunascape",
                        "Maxthon",
                        {
                            label: "Microsoft Edge",
                            pattern: "(?:Edge|Edg|EdgA|EdgiOS)"
                        },
                        "Midori",
                        "Nook Browser",
                        "PaleMoon",
                        "PhantomJS",
                        "Raven",
                        "Rekonq",
                        "RockMelt",
                        {
                            label: "Samsung Internet",
                            pattern: "SamsungBrowser"
                        },
                        "SeaMonkey",
                        {
                            label: "Silk",
                            pattern: "(?:Cloud9|Silk-Accelerated)"
                        },
                        "Sleipnir",
                        "SlimBrowser",
                        {
                            label: "SRWare Iron",
                            pattern: "Iron"
                        },
                        "Sunrise",
                        "Swiftfox",
                        "Vivaldi",
                        "Waterfox",
                        "WebPositive",
                        {
                            label: "Yandex Browser",
                            pattern: "YaBrowser"
                        },
                        {
                            label: "UC Browser",
                            pattern: "UCBrowser"
                        },
                        "Opera Mini",
                        {
                            label: "Opera Mini",
                            pattern: "OPiOS"
                        },
                        "Opera",
                        {
                            label: "Opera",
                            pattern: "OPR"
                        },
                        "Chromium",
                        "Chrome",
                        {
                            label: "Chrome",
                            pattern: "(?:HeadlessChrome)"
                        },
                        {
                            label: "Chrome Mobile",
                            pattern: "(?:CriOS|CrMo)"
                        },
                        {
                            label: "Firefox",
                            pattern: "(?:Firefox|Minefield)"
                        },
                        {
                            label: "Firefox for iOS",
                            pattern: "FxiOS"
                        },
                        {
                            label: "IE",
                            pattern: "IEMobile"
                        },
                        {
                            label: "IE",
                            pattern: "MSIE"
                        },
                        "Safari"
                    ]);
                    var A = getProduct([
                        {
                            label: "BlackBerry",
                            pattern: "BB10"
                        },
                        "BlackBerry",
                        {
                            label: "Galaxy S",
                            pattern: "GT-I9000"
                        },
                        {
                            label: "Galaxy S2",
                            pattern: "GT-I9100"
                        },
                        {
                            label: "Galaxy S3",
                            pattern: "GT-I9300"
                        },
                        {
                            label: "Galaxy S4",
                            pattern: "GT-I9500"
                        },
                        {
                            label: "Galaxy S5",
                            pattern: "SM-G900"
                        },
                        {
                            label: "Galaxy S6",
                            pattern: "SM-G920"
                        },
                        {
                            label: "Galaxy S6 Edge",
                            pattern: "SM-G925"
                        },
                        {
                            label: "Galaxy S7",
                            pattern: "SM-G930"
                        },
                        {
                            label: "Galaxy S7 Edge",
                            pattern: "SM-G935"
                        },
                        "Google TV",
                        "Lumia",
                        "iPad",
                        "iPod",
                        "iPhone",
                        "Kindle",
                        {
                            label: "Kindle Fire",
                            pattern: "(?:Cloud9|Silk-Accelerated)"
                        },
                        "Nexus",
                        "Nook",
                        "PlayBook",
                        "PlayStation Vita",
                        "PlayStation",
                        "TouchPad",
                        "Transformer",
                        {
                            label: "Wii U",
                            pattern: "WiiU"
                        },
                        "Wii",
                        "Xbox One",
                        {
                            label: "Xbox 360",
                            pattern: "Xbox"
                        },
                        "Xoom"
                    ]);
                    var I = getManufacturer({
                        Apple: {
                            iPad: 1,
                            iPhone: 1,
                            iPod: 1
                        },
                        Alcatel: {},
                        Archos: {},
                        Amazon: {
                            Kindle: 1,
                            "Kindle Fire": 1
                        },
                        Asus: {
                            Transformer: 1
                        },
                        "Barnes & Noble": {
                            Nook: 1
                        },
                        BlackBerry: {
                            PlayBook: 1
                        },
                        Google: {
                            "Google TV": 1,
                            Nexus: 1
                        },
                        HP: {
                            TouchPad: 1
                        },
                        HTC: {},
                        Huawei: {},
                        Lenovo: {},
                        LG: {},
                        Microsoft: {
                            Xbox: 1,
                            "Xbox One": 1
                        },
                        Motorola: {
                            Xoom: 1
                        },
                        Nintendo: {
                            "Wii U": 1,
                            Wii: 1
                        },
                        Nokia: {
                            Lumia: 1
                        },
                        Oppo: {},
                        Samsung: {
                            "Galaxy S": 1,
                            "Galaxy S2": 1,
                            "Galaxy S3": 1,
                            "Galaxy S4": 1
                        },
                        Sony: {
                            PlayStation: 1,
                            "PlayStation Vita": 1
                        },
                        Xiaomi: {
                            Mi: 1,
                            Redmi: 1
                        }
                    });
                    var T = getOS([
                        "Windows Phone",
                        "KaiOS",
                        "Android",
                        "CentOS",
                        {
                            label: "Chrome OS",
                            pattern: "CrOS"
                        },
                        "Debian",
                        {
                            label: "DragonFly BSD",
                            pattern: "DragonFly"
                        },
                        "Fedora",
                        "FreeBSD",
                        "Gentoo",
                        "Haiku",
                        "Kubuntu",
                        "Linux Mint",
                        "OpenBSD",
                        "Red Hat",
                        "SuSE",
                        "Ubuntu",
                        "Xubuntu",
                        "Cygwin",
                        "Symbian OS",
                        "hpwOS",
                        "webOS ",
                        "webOS",
                        "Tablet OS",
                        "Tizen",
                        "Linux",
                        "Mac OS X",
                        "Macintosh",
                        "Mac",
                        "Windows 98;",
                        "Windows "
                    ]);
                    function getLayout(i) {
                        return reduce(i, function(i, t) {
                            return i || RegExp("\\b" + (t.pattern || qualify(t)) + "\\b", "i").exec(e) && (t.label || t);
                        });
                    }
                    function getManufacturer(i) {
                        return reduce(i, function(i, t, r) {
                            return i || (t[A] || t[/^[a-z]+(?: +[a-z]+\b)*/i.exec(A)] || RegExp("\\b" + qualify(r) + "(?:\\b|\\w*\\d)", "i").exec(e)) && r;
                        });
                    }
                    function getName(i) {
                        return reduce(i, function(i, t) {
                            return i || RegExp("\\b" + (t.pattern || qualify(t)) + "\\b", "i").exec(e) && (t.label || t);
                        });
                    }
                    function getOS(i) {
                        return reduce(i, function(i, t) {
                            var r = t.pattern || qualify(t);
                            if (!i && (i = RegExp("\\b" + r + "(?:/[\\d.]+|[ \\w.]*)", "i").exec(e))) {
                                i = cleanupOS(i, r, t.label || t);
                            }
                            return i;
                        });
                    }
                    function getProduct(i) {
                        return reduce(i, function(i, t) {
                            var r = t.pattern || qualify(t);
                            if (!i && (i = RegExp("\\b" + r + " *\\d+[.\\w_]*", "i").exec(e) || RegExp("\\b" + r + " *\\w+-[\\w]*", "i").exec(e) || RegExp("\\b" + r + "(?:; *(?:[a-z]+[_-])?[a-z]+\\d+|[^ ();-]*)", "i").exec(e))) {
                                if ((i = String(t.label && !RegExp(r, "i").test(t.label) ? t.label : i).split("/"))[1] && !/[\d.]+/.test(i[0])) {
                                    i[0] += " " + i[1];
                                }
                                t = t.label || t;
                                i = format(i[0].replace(RegExp(r, "i"), t).replace(RegExp("; *(?:" + t + "[_-])?", "i"), " ").replace(RegExp("(" + t + ")[-_.]?(\\w)", "i"), "$1 $2"));
                            }
                            return i;
                        });
                    }
                    function getVersion(i) {
                        return reduce(i, function(i, t) {
                            return i || (RegExp(t + "(?:-[\\d.]+/|(?: for [\\w-]+)?[ /-])([\\d.]+[^ ();/_-]*)", "i").exec(e) || 0)[1] || null;
                        });
                    }
                    function toStringPlatform() {
                        return this.description || "";
                    }
                    _ && (_ = [
                        _
                    ]);
                    if (/\bAndroid\b/.test(T) && !A && (M = /\bAndroid[^;]*;(.*?)(?:Build|\) AppleWebKit)\b/i.exec(e))) {
                        A = trim(M[1]).replace(/^[a-z]{2}-[a-z]{2};\s*/i, "") || null;
                    }
                    if (I && !A) {
                        A = getProduct([
                            I
                        ]);
                    } else if (I && A) {
                        A = A.replace(RegExp("^(" + qualify(I) + ")[-_.\\s]", "i"), I + " ").replace(RegExp("^(" + qualify(I) + ")[-_.]?(\\w)", "i"), I + " $2");
                    }
                    if (M = /\bGoogle TV\b/.exec(A)) {
                        A = M[0];
                    }
                    if (/\bSimulator\b/i.test(e)) {
                        A = (A ? A + " " : "") + "Simulator";
                    }
                    if (R == "Opera Mini" && /\bOPiOS\b/.test(e)) {
                        P.push("running in Turbo/Uncompressed mode");
                    }
                    if (R == "IE" && /\blike iPhone OS\b/.test(e)) {
                        M = parse(e.replace(/like iPhone OS/, ""));
                        I = M.manufacturer;
                        A = M.product;
                    } else if (/^iP/.test(A)) {
                        R || (R = "Safari");
                        T = "iOS" + ((M = / OS ([\d_]+)/i.exec(e)) ? " " + M[1].replace(/_/g, ".") : "");
                    } else if (R == "Konqueror" && /^Linux\b/i.test(T)) {
                        T = "Kubuntu";
                    } else if (I && I != "Google" && (/Chrome/.test(R) && !/\bMobile Safari\b/i.test(e) || /\bVita\b/.test(A)) || /\bAndroid\b/.test(T) && /^Chrome/.test(R) && /\bVersion\//i.test(e)) {
                        R = "Android Browser";
                        T = /\bAndroid\b/.test(T) ? T : "Android";
                    } else if (R == "Silk") {
                        if (!/\bMobi/i.test(e)) {
                            T = "Android";
                            P.unshift("desktop mode");
                        }
                        if (/Accelerated *= *true/i.test(e)) {
                            P.unshift("accelerated");
                        }
                    } else if (R == "UC Browser" && /\bUCWEB\b/.test(e)) {
                        P.push("speed mode");
                    } else if (R == "PaleMoon" && (M = /\bFirefox\/([\d.]+)\b/.exec(e))) {
                        P.push("identifying as Firefox " + M[1]);
                    } else if (R == "Firefox" && (M = /\b(Mobile|Tablet|TV)\b/i.exec(e))) {
                        T || (T = "Firefox OS");
                        A || (A = M[1]);
                    } else if (!R || (M = !/\bMinefield\b/i.test(e) && /\b(?:Firefox|Safari)\b/.exec(R))) {
                        if (R && !A && /[\/,]|^[^(]+?\)/.test(e.slice(e.indexOf(M + "/") + 8))) {
                            R = null;
                        }
                        if ((M = A || I || T) && (A || I || /\b(?:Android|Symbian OS|Tablet OS|webOS)\b/.test(T))) {
                            R = /[a-z]+(?: Hat)?/i.exec(/\bAndroid\b/.test(T) ? T : M) + " Browser";
                        }
                    } else if (R == "Electron" && (M = (/\bChrome\/([\d.]+)\b/.exec(e) || 0)[1])) {
                        P.push("Chromium " + M);
                    }
                    if (!B) {
                        B = getVersion([
                            "(?:Cloud9|CriOS|CrMo|Edge|Edg|EdgA|EdgiOS|FxiOS|HeadlessChrome|IEMobile|Iron|Opera ?Mini|OPiOS|OPR|Raven|SamsungBrowser|Silk(?!/[\\d.]+$)|UCBrowser|YaBrowser)",
                            "Version",
                            qualify(R),
                            "(?:Firefox|Minefield|NetFront)"
                        ]);
                    }
                    if (M = _ == "iCab" && parseFloat(B) > 3 && "WebKit" || /\bOpera\b/.test(R) && (/\bOPR\b/.test(e) ? "Blink" : "Presto") || /\b(?:Midori|Nook|Safari)\b/i.test(e) && !/^(?:Trident|EdgeHTML)$/.test(_) && "WebKit" || !_ && /\bMSIE\b/i.test(e) && (T == "Mac OS" ? "Tasman" : "Trident") || _ == "WebKit" && /\bPlayStation\b(?! Vita\b)/i.test(R) && "NetFront") {
                        _ = [
                            M
                        ];
                    }
                    if (R == "IE" && (M = (/; *(?:XBLWP|ZuneWP)(\d+)/i.exec(e) || 0)[1])) {
                        R += " Mobile";
                        T = "Windows Phone " + (/\+$/.test(M) ? M : M + ".x");
                        P.unshift("desktop mode");
                    } else if (/\bWPDesktop\b/i.test(e)) {
                        R = "IE Mobile";
                        T = "Windows Phone 8.x";
                        P.unshift("desktop mode");
                        B || (B = (/\brv:([\d.]+)/.exec(e) || 0)[1]);
                    } else if (R != "IE" && _ == "Trident" && (M = /\brv:([\d.]+)/.exec(e))) {
                        if (R) {
                            P.push("identifying as " + R + (B ? " " + B : ""));
                        }
                        R = "IE";
                        B = M[1];
                    }
                    if (k) {
                        if (isHostType(i, "global")) {
                            if (m) {
                                M = m.lang.System;
                                E = M.getProperty("os.arch");
                                T = T || M.getProperty("os.name") + " " + M.getProperty("os.version");
                            }
                            if (g) {
                                try {
                                    B = i.require("ringo/engine").version.join(".");
                                    R = "RingoJS";
                                } catch (e) {
                                    if ((M = i.system) && M.global.system == i.system) {
                                        R = "Narwhal";
                                        T || (T = M[0].os || null);
                                    }
                                }
                                if (!R) {
                                    R = "Rhino";
                                }
                            } else if (typeof i.process == "object" && !i.process.browser && (M = i.process)) {
                                if (typeof M.versions == "object") {
                                    if (typeof M.versions.electron == "string") {
                                        P.push("Node " + M.versions.node);
                                        R = "Electron";
                                        B = M.versions.electron;
                                    } else if (typeof M.versions.nw == "string") {
                                        P.push("Chromium " + B, "Node " + M.versions.node);
                                        R = "NW.js";
                                        B = M.versions.nw;
                                    }
                                }
                                if (!R) {
                                    R = "Node.js";
                                    E = M.arch;
                                    T = M.platform;
                                    B = /[\d.]+/.exec(M.version);
                                    B = B ? B[0] : null;
                                }
                            }
                        } else if (getClassOf(M = i.runtime) == p) {
                            R = "Adobe AIR";
                            T = M.flash.system.Capabilities.os;
                        } else if (getClassOf(M = i.phantom) == x) {
                            R = "PhantomJS";
                            B = (M = M.version || null) && M.major + "." + M.minor + "." + M.patch;
                        } else if (typeof O.documentMode == "number" && (M = /\bTrident\/(\d+)/i.exec(e))) {
                            B = [
                                B,
                                O.documentMode
                            ];
                            if ((M = +M[1] + 4) != B[1]) {
                                P.push("IE " + B[1] + " mode");
                                _ && (_[1] = "");
                                B[1] = M;
                            }
                            B = R == "IE" ? String(B[1].toFixed(1)) : B[0];
                        } else if (typeof O.documentMode == "number" && /^(?:Chrome|Firefox)\b/.test(R)) {
                            P.push("masking as " + R + " " + B);
                            R = "IE";
                            B = "11.0";
                            _ = [
                                "Trident"
                            ];
                            T = "Windows";
                        }
                        T = T && format(T);
                    }
                    if (B && (M = /(?:[ab]|dp|pre|[ab]\d+pre)(?:\d+\+?)?$/i.exec(B) || /(?:alpha|beta)(?: ?\d)?/i.exec(e + ";" + (k && n.appMinorVersion)) || /\bMinefield\b/i.test(e) && "a")) {
                        C = /b/i.test(M) ? "beta" : "alpha";
                        B = B.replace(RegExp(M + "\\+?$"), "") + (C == "beta" ? v : h) + (/\d+\+?/.exec(M) || "");
                    }
                    if (R == "Fennec" || R == "Firefox" && /\b(?:Android|Firefox OS|KaiOS)\b/.test(T)) {
                        R = "Firefox Mobile";
                    } else if (R == "Maxthon" && B) {
                        B = B.replace(/\.[\d.]+/, ".x");
                    } else if (/\bXbox\b/i.test(A)) {
                        if (A == "Xbox 360") {
                            T = null;
                        }
                        if (A == "Xbox 360" && /\bIEMobile\b/.test(e)) {
                            P.unshift("mobile mode");
                        }
                    } else if ((/^(?:Chrome|IE|Opera)$/.test(R) || R && !A && !/Browser|Mobi/.test(R)) && (T == "Windows CE" || /Mobi/i.test(e))) {
                        R += " Mobile";
                    } else if (R == "IE" && k) {
                        try {
                            if (i.external === null) {
                                P.unshift("platform preview");
                            }
                        } catch (e) {
                            P.unshift("embedded");
                        }
                    } else if ((/\bBlackBerry\b/.test(A) || /\bBB10\b/.test(e)) && (M = (RegExp(A.replace(/ +/g, " *") + "/([.\\d]+)", "i").exec(e) || 0)[1] || B)) {
                        M = [
                            M,
                            /BB10/.test(e)
                        ];
                        T = (M[1] ? (A = null, I = "BlackBerry") : "Device Software") + " " + M[0];
                        B = null;
                    } else if (this != forOwn && A != "Wii" && (k && y || /Opera/.test(R) && /\b(?:MSIE|Firefox)\b/i.test(e) || R == "Firefox" && /\bOS X (?:\d+\.){2,}/.test(T) || R == "IE" && (T && !/^Win/.test(T) && B > 5.5 || /\bWindows XP\b/.test(T) && B > 8 || B == 8 && !/\bTrident\b/.test(e))) && !f.test(M = parse.call(forOwn, e.replace(f, "") + ";")) && M.name) {
                        M = "ing as " + M.name + ((M = M.version) ? " " + M : "");
                        if (f.test(R)) {
                            if (/\bIE\b/.test(M) && T == "Mac OS") {
                                T = null;
                            }
                            M = "identify" + M;
                        } else {
                            M = "mask" + M;
                            if (w) {
                                R = format(w.replace(/([a-z])([A-Z])/g, "$1 $2"));
                            } else {
                                R = "Opera";
                            }
                            if (/\bIE\b/.test(M)) {
                                T = null;
                            }
                            if (!k) {
                                B = null;
                            }
                        }
                        _ = [
                            "Presto"
                        ];
                        P.push(M);
                    }
                    if (M = (/\bAppleWebKit\/([\d.]+\+?)/i.exec(e) || 0)[1]) {
                        M = [
                            parseFloat(M.replace(/\.(\d)$/, ".0$1")),
                            M
                        ];
                        if (R == "Safari" && M[1].slice(-1) == "+") {
                            R = "WebKit Nightly";
                            C = "alpha";
                            B = M[1].slice(0, -1);
                        } else if (B == M[1] || B == (M[2] = (/\bSafari\/([\d.]+\+?)/i.exec(e) || 0)[1])) {
                            B = null;
                        }
                        M[1] = (/\b(?:Headless)?Chrome\/([\d.]+)/i.exec(e) || 0)[1];
                        if (M[0] == 537.36 && M[2] == 537.36 && parseFloat(M[1]) >= 28 && _ == "WebKit") {
                            _ = [
                                "Blink"
                            ];
                        }
                        if (!k || !s && !M[1]) {
                            _ && (_[1] = "like Safari");
                            M = (M = M[0], M < 400 ? 1 : M < 500 ? 2 : M < 526 ? 3 : M < 533 ? 4 : M < 534 ? "4+" : M < 535 ? 5 : M < 537 ? 6 : M < 538 ? 7 : M < 601 ? 8 : M < 602 ? 9 : M < 604 ? 10 : M < 606 ? 11 : M < 608 ? 12 : "12");
                        } else {
                            _ && (_[1] = "like Chrome");
                            M = M[1] || (M = M[0], M < 530 ? 1 : M < 532 ? 2 : M < 532.05 ? 3 : M < 533 ? 4 : M < 534.03 ? 5 : M < 534.07 ? 6 : M < 534.1 ? 7 : M < 534.13 ? 8 : M < 534.16 ? 9 : M < 534.24 ? 10 : M < 534.3 ? 11 : M < 535.01 ? 12 : M < 535.02 ? "13+" : M < 535.07 ? 15 : M < 535.11 ? 16 : M < 535.19 ? 17 : M < 536.05 ? 18 : M < 536.1 ? 19 : M < 537.01 ? 20 : M < 537.11 ? "21+" : M < 537.13 ? 23 : M < 537.18 ? 24 : M < 537.24 ? 25 : M < 537.36 ? 26 : _ != "Blink" ? "27" : "28");
                        }
                        _ && (_[1] += " " + (M += typeof M == "number" ? ".x" : /[.+]/.test(M) ? "" : "+"));
                        if (R == "Safari" && (!B || parseInt(B) > 45)) {
                            B = M;
                        } else if (R == "Chrome" && /\bHeadlessChrome/i.test(e)) {
                            P.unshift("headless");
                        }
                    }
                    if (R == "Opera" && (M = /\bzbov|zvav$/.exec(T))) {
                        R += " ";
                        P.unshift("desktop mode");
                        if (M == "zvav") {
                            R += "Mini";
                            B = null;
                        } else {
                            R += "Mobile";
                        }
                        T = T.replace(RegExp(" *" + M + "$"), "");
                    } else if (R == "Safari" && /\bChrome\b/.exec(_ && _[1])) {
                        P.unshift("desktop mode");
                        R = "Chrome Mobile";
                        B = null;
                        if (/\bOS X\b/.test(T)) {
                            I = "Apple";
                            T = "iOS 4.3+";
                        } else {
                            T = null;
                        }
                    } else if (/\bSRWare Iron\b/.test(R) && !B) {
                        B = getVersion("Chrome");
                    }
                    if (B && B.indexOf(M = /[\d.]+$/.exec(T)) == 0 && e.indexOf("/" + M + "-") > -1) {
                        T = trim(T.replace(M, ""));
                    }
                    if (T && T.indexOf(R) != -1 && !RegExp(R + " OS").test(T)) {
                        T = T.replace(RegExp(" *" + qualify(R) + " *"), "");
                    }
                    if (_ && !/\b(?:Avant|Nook)\b/.test(R) && (/Browser|Lunascape|Maxthon/.test(R) || R != "Safari" && /^iOS/.test(T) && /\bSafari\b/.test(_[1]) || /^(?:Adobe|Arora|Breach|Midori|Opera|Phantom|Rekonq|Rock|Samsung Internet|Sleipnir|SRWare Iron|Vivaldi|Web)/.test(R) && _[1])) {
                        (M = _[_.length - 1]) && P.push(M);
                    }
                    if (P.length) {
                        P = [
                            "(" + P.join("; ") + ")"
                        ];
                    }
                    if (I && A && A.indexOf(I) < 0) {
                        P.push("on " + I);
                    }
                    if (A) {
                        P.push((/^on /.test(P[P.length - 1]) ? "" : "on ") + A);
                    }
                    if (T) {
                        M = / ([\d.+]+)$/.exec(T);
                        W = M && T.charAt(T.length - M[0].length - 1) == "/";
                        T = {
                            architecture: 32,
                            family: M && !W ? T.replace(M[0], "") : T,
                            version: M ? M[1] : null,
                            toString: function() {
                                var e = this.version;
                                return this.family + (e && !W ? " " + e : "") + (this.architecture == 64 ? " 64-bit" : "");
                            }
                        };
                    }
                    if ((M = /\b(?:AMD|IA|Win|WOW|x86_|x)64\b/i.exec(E)) && !/\bi686\b/i.test(E)) {
                        if (T) {
                            T.architecture = 64;
                            T.family = T.family.replace(RegExp(" *" + M), "");
                        }
                        if (R && (/\bWOW64\b/i.test(e) || k && /\w(?:86|32)$/.test(n.cpuClass || n.platform) && !/\bWin64; x64\b/i.test(e))) {
                            P.unshift("32-bit");
                        }
                    } else if (T && /^OS X/.test(T.family) && R == "Chrome" && parseFloat(B) >= 39) {
                        T.architecture = 64;
                    }
                    e || (e = null);
                    var F = {};
                    F.description = e;
                    F.layout = _ && _[0];
                    F.manufacturer = I;
                    F.name = R;
                    F.prerelease = C;
                    F.product = A;
                    F.ua = e;
                    F.version = R && B;
                    F.os = T || {
                        architecture: null,
                        family: null,
                        version: null,
                        toString: function() {
                            return "null";
                        }
                    };
                    F.parse = parse;
                    F.toString = toStringPlatform;
                    if (F.version) {
                        P.unshift(B);
                    }
                    if (F.name) {
                        P.unshift(R);
                    }
                    if (T && R && !(T == String(T).split(" ")[0] && (T == R.split(" ")[0] || A))) {
                        P.push(A ? "(" + T + ")" : "on " + T);
                    }
                    if (P.length) {
                        F.description = P.join(" ");
                    }
                    return F;
                }
                var d = parse();
                if (n && o) {
                    forOwn(d, function(e, i) {
                        n[i] = e;
                    });
                } else {
                    r.platform = d;
                }
            }).call(this);
        }
    };
    var i = {};
    function __nccwpck_require__(t) {
        var r = i[t];
        if (r !== undefined) {
            return r.exports;
        }
        var a = i[t] = {
            id: t,
            loaded: false,
            exports: {}
        };
        var n = true;
        try {
            e[t].call(a.exports, a, a.exports, __nccwpck_require__);
            n = false;
        } finally{
            if (n) delete i[t];
        }
        a.loaded = true;
        return a.exports;
    }
    (()=>{
        __nccwpck_require__.nmd = (e)=>{
            e.paths = [];
            if (!e.children) e.children = [];
            return e;
        };
    })();
    if (typeof __nccwpck_require__ !== "undefined") __nccwpck_require__.ab = __dirname + "/";
    var t = __nccwpck_require__(541);
    module.exports = t;
})();
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/css.escape/css.escape.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
(()=>{
    var e = {
        553: function(e) {
            (function(r, t) {
                if ("TURBOPACK compile-time truthy", 1) {
                    e.exports = t(r);
                } else {}
            })(typeof global != "undefined" ? global : this, function(e) {
                if (e.CSS && e.CSS.escape) {
                    return e.CSS.escape;
                }
                var cssEscape = function(e) {
                    if (arguments.length == 0) {
                        throw new TypeError("`CSS.escape` requires an argument.");
                    }
                    var r = String(e);
                    var t = r.length;
                    var n = -1;
                    var a;
                    var i = "";
                    var u = r.charCodeAt(0);
                    while(++n < t){
                        a = r.charCodeAt(n);
                        if (a == 0) {
                            i += "�";
                            continue;
                        }
                        if (a >= 1 && a <= 31 || a == 127 || n == 0 && a >= 48 && a <= 57 || n == 1 && a >= 48 && a <= 57 && u == 45) {
                            i += "\\" + a.toString(16) + " ";
                            continue;
                        }
                        if (n == 0 && t == 1 && a == 45) {
                            i += "\\" + r.charAt(n);
                            continue;
                        }
                        if (a >= 128 || a == 45 || a == 95 || a >= 48 && a <= 57 || a >= 65 && a <= 90 || a >= 97 && a <= 122) {
                            i += r.charAt(n);
                            continue;
                        }
                        i += "\\" + r.charAt(n);
                    }
                    return i;
                };
                if (!e.CSS) {
                    e.CSS = {};
                }
                e.CSS.escape = cssEscape;
                return cssEscape;
            });
        }
    };
    var r = {};
    function __nccwpck_require__(t) {
        var n = r[t];
        if (n !== undefined) {
            return n.exports;
        }
        var a = r[t] = {
            exports: {}
        };
        var i = true;
        try {
            e[t].call(a.exports, a, a.exports, __nccwpck_require__);
            i = false;
        } finally{
            if (i) delete r[t];
        }
        return a.exports;
    }
    if (typeof __nccwpck_require__ !== "undefined") __nccwpck_require__.ab = __dirname + "/";
    var t = __nccwpck_require__(553);
    module.exports = t;
})();
}}),
"[project]/node_modules/.pnpm/next@15.0.3_@babel+core@7.26.0_@opentelemetry+api@1.9.0_babel-plugin-macros@3.1.0_react-dom@1_5uj2k562ubpoy7gbyohpnyupru/node_modules/next/dist/compiled/anser/index.js [app-client] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, m: module, e: exports, t: require } = __turbopack_context__;
{
(()=>{
    "use strict";
    var e = {
        211: (e)=>{
            var r = function() {
                function defineProperties(e, r) {
                    for(var n = 0; n < r.length; n++){
                        var s = r[n];
                        s.enumerable = s.enumerable || false;
                        s.configurable = true;
                        if ("value" in s) s.writable = true;
                        Object.defineProperty(e, s.key, s);
                    }
                }
                return function(e, r, n) {
                    if (r) defineProperties(e.prototype, r);
                    if (n) defineProperties(e, n);
                    return e;
                };
            }();
            function _classCallCheck(e, r) {
                if (!(e instanceof r)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            }
            var n = [
                [
                    {
                        color: "0, 0, 0",
                        class: "ansi-black"
                    },
                    {
                        color: "187, 0, 0",
                        class: "ansi-red"
                    },
                    {
                        color: "0, 187, 0",
                        class: "ansi-green"
                    },
                    {
                        color: "187, 187, 0",
                        class: "ansi-yellow"
                    },
                    {
                        color: "0, 0, 187",
                        class: "ansi-blue"
                    },
                    {
                        color: "187, 0, 187",
                        class: "ansi-magenta"
                    },
                    {
                        color: "0, 187, 187",
                        class: "ansi-cyan"
                    },
                    {
                        color: "255,255,255",
                        class: "ansi-white"
                    }
                ],
                [
                    {
                        color: "85, 85, 85",
                        class: "ansi-bright-black"
                    },
                    {
                        color: "255, 85, 85",
                        class: "ansi-bright-red"
                    },
                    {
                        color: "0, 255, 0",
                        class: "ansi-bright-green"
                    },
                    {
                        color: "255, 255, 85",
                        class: "ansi-bright-yellow"
                    },
                    {
                        color: "85, 85, 255",
                        class: "ansi-bright-blue"
                    },
                    {
                        color: "255, 85, 255",
                        class: "ansi-bright-magenta"
                    },
                    {
                        color: "85, 255, 255",
                        class: "ansi-bright-cyan"
                    },
                    {
                        color: "255, 255, 255",
                        class: "ansi-bright-white"
                    }
                ]
            ];
            var s = function() {
                r(Anser, null, [
                    {
                        key: "escapeForHtml",
                        value: function escapeForHtml(e) {
                            return (new Anser).escapeForHtml(e);
                        }
                    },
                    {
                        key: "linkify",
                        value: function linkify(e) {
                            return (new Anser).linkify(e);
                        }
                    },
                    {
                        key: "ansiToHtml",
                        value: function ansiToHtml(e, r) {
                            return (new Anser).ansiToHtml(e, r);
                        }
                    },
                    {
                        key: "ansiToJson",
                        value: function ansiToJson(e, r) {
                            return (new Anser).ansiToJson(e, r);
                        }
                    },
                    {
                        key: "ansiToText",
                        value: function ansiToText(e) {
                            return (new Anser).ansiToText(e);
                        }
                    }
                ]);
                function Anser() {
                    _classCallCheck(this, Anser);
                    this.fg = this.bg = this.fg_truecolor = this.bg_truecolor = null;
                    this.bright = 0;
                }
                r(Anser, [
                    {
                        key: "setupPalette",
                        value: function setupPalette() {
                            this.PALETTE_COLORS = [];
                            for(var e = 0; e < 2; ++e){
                                for(var r = 0; r < 8; ++r){
                                    this.PALETTE_COLORS.push(n[e][r].color);
                                }
                            }
                            var s = [
                                0,
                                95,
                                135,
                                175,
                                215,
                                255
                            ];
                            var i = function format(e, r, n) {
                                return s[e] + ", " + s[r] + ", " + s[n];
                            };
                            var t = void 0, o = void 0, a = void 0;
                            for(var l = 0; l < 6; ++l){
                                for(var c = 0; c < 6; ++c){
                                    for(var u = 0; u < 6; ++u){
                                        this.PALETTE_COLORS.push(i(l, c, u));
                                    }
                                }
                            }
                            var f = 8;
                            for(var h = 0; h < 24; ++h, f += 10){
                                this.PALETTE_COLORS.push(i(f, f, f));
                            }
                        }
                    },
                    {
                        key: "escapeForHtml",
                        value: function escapeForHtml(e) {
                            return e.replace(/[&<>]/gm, function(e) {
                                return e == "&" ? "&amp;" : e == "<" ? "&lt;" : e == ">" ? "&gt;" : "";
                            });
                        }
                    },
                    {
                        key: "linkify",
                        value: function linkify(e) {
                            return e.replace(/(https?:\/\/[^\s]+)/gm, function(e) {
                                return '<a href="' + e + '">' + e + "</a>";
                            });
                        }
                    },
                    {
                        key: "ansiToHtml",
                        value: function ansiToHtml(e, r) {
                            return this.process(e, r, true);
                        }
                    },
                    {
                        key: "ansiToJson",
                        value: function ansiToJson(e, r) {
                            r = r || {};
                            r.json = true;
                            r.clearLine = false;
                            return this.process(e, r, true);
                        }
                    },
                    {
                        key: "ansiToText",
                        value: function ansiToText(e) {
                            return this.process(e, {}, false);
                        }
                    },
                    {
                        key: "process",
                        value: function process(e, r, n) {
                            var s = this;
                            var i = this;
                            var t = e.split(/\033\[/);
                            var o = t.shift();
                            if (r === undefined || r === null) {
                                r = {};
                            }
                            r.clearLine = /\r/.test(e);
                            var a = t.map(function(e) {
                                return s.processChunk(e, r, n);
                            });
                            if (r && r.json) {
                                var l = i.processChunkJson("");
                                l.content = o;
                                l.clearLine = r.clearLine;
                                a.unshift(l);
                                if (r.remove_empty) {
                                    a = a.filter(function(e) {
                                        return !e.isEmpty();
                                    });
                                }
                                return a;
                            } else {
                                a.unshift(o);
                            }
                            return a.join("");
                        }
                    },
                    {
                        key: "processChunkJson",
                        value: function processChunkJson(e, r, s) {
                            r = typeof r == "undefined" ? {} : r;
                            var i = r.use_classes = typeof r.use_classes != "undefined" && r.use_classes;
                            var t = r.key = i ? "class" : "color";
                            var o = {
                                content: e,
                                fg: null,
                                bg: null,
                                fg_truecolor: null,
                                bg_truecolor: null,
                                clearLine: r.clearLine,
                                decoration: null,
                                was_processed: false,
                                isEmpty: function isEmpty() {
                                    return !o.content;
                                }
                            };
                            var a = e.match(/^([!\x3c-\x3f]*)([\d;]*)([\x20-\x2c]*[\x40-\x7e])([\s\S]*)/m);
                            if (!a) return o;
                            var l = o.content = a[4];
                            var c = a[2].split(";");
                            if (a[1] !== "" || a[3] !== "m") {
                                return o;
                            }
                            if (!s) {
                                return o;
                            }
                            var u = this;
                            u.decoration = null;
                            while(c.length > 0){
                                var f = c.shift();
                                var h = parseInt(f);
                                if (isNaN(h) || h === 0) {
                                    u.fg = u.bg = u.decoration = null;
                                } else if (h === 1) {
                                    u.decoration = "bold";
                                } else if (h === 2) {
                                    u.decoration = "dim";
                                } else if (h == 3) {
                                    u.decoration = "italic";
                                } else if (h == 4) {
                                    u.decoration = "underline";
                                } else if (h == 5) {
                                    u.decoration = "blink";
                                } else if (h === 7) {
                                    u.decoration = "reverse";
                                } else if (h === 8) {
                                    u.decoration = "hidden";
                                } else if (h === 9) {
                                    u.decoration = "strikethrough";
                                } else if (h == 39) {
                                    u.fg = null;
                                } else if (h == 49) {
                                    u.bg = null;
                                } else if (h >= 30 && h < 38) {
                                    u.fg = n[0][h % 10][t];
                                } else if (h >= 90 && h < 98) {
                                    u.fg = n[1][h % 10][t];
                                } else if (h >= 40 && h < 48) {
                                    u.bg = n[0][h % 10][t];
                                } else if (h >= 100 && h < 108) {
                                    u.bg = n[1][h % 10][t];
                                } else if (h === 38 || h === 48) {
                                    var p = h === 38;
                                    if (c.length >= 1) {
                                        var g = c.shift();
                                        if (g === "5" && c.length >= 1) {
                                            var v = parseInt(c.shift());
                                            if (v >= 0 && v <= 255) {
                                                if (!i) {
                                                    if (!this.PALETTE_COLORS) {
                                                        u.setupPalette();
                                                    }
                                                    if (p) {
                                                        u.fg = this.PALETTE_COLORS[v];
                                                    } else {
                                                        u.bg = this.PALETTE_COLORS[v];
                                                    }
                                                } else {
                                                    var d = v >= 16 ? "ansi-palette-" + v : n[v > 7 ? 1 : 0][v % 8]["class"];
                                                    if (p) {
                                                        u.fg = d;
                                                    } else {
                                                        u.bg = d;
                                                    }
                                                }
                                            }
                                        } else if (g === "2" && c.length >= 3) {
                                            var _ = parseInt(c.shift());
                                            var b = parseInt(c.shift());
                                            var y = parseInt(c.shift());
                                            if (_ >= 0 && _ <= 255 && b >= 0 && b <= 255 && y >= 0 && y <= 255) {
                                                var k = _ + ", " + b + ", " + y;
                                                if (!i) {
                                                    if (p) {
                                                        u.fg = k;
                                                    } else {
                                                        u.bg = k;
                                                    }
                                                } else {
                                                    if (p) {
                                                        u.fg = "ansi-truecolor";
                                                        u.fg_truecolor = k;
                                                    } else {
                                                        u.bg = "ansi-truecolor";
                                                        u.bg_truecolor = k;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            if (u.fg === null && u.bg === null && u.decoration === null) {
                                return o;
                            } else {
                                var T = [];
                                var m = [];
                                var w = {};
                                o.fg = u.fg;
                                o.bg = u.bg;
                                o.fg_truecolor = u.fg_truecolor;
                                o.bg_truecolor = u.bg_truecolor;
                                o.decoration = u.decoration;
                                o.was_processed = true;
                                return o;
                            }
                        }
                    },
                    {
                        key: "processChunk",
                        value: function processChunk(e, r, n) {
                            var s = this;
                            var i = this;
                            r = r || {};
                            var t = this.processChunkJson(e, r, n);
                            if (r.json) {
                                return t;
                            }
                            if (t.isEmpty()) {
                                return "";
                            }
                            if (!t.was_processed) {
                                return t.content;
                            }
                            var o = r.use_classes;
                            var a = [];
                            var l = [];
                            var c = {};
                            var u = function render_data(e) {
                                var r = [];
                                var n = void 0;
                                for(n in e){
                                    if (e.hasOwnProperty(n)) {
                                        r.push("data-" + n + '="' + s.escapeForHtml(e[n]) + '"');
                                    }
                                }
                                return r.length > 0 ? " " + r.join(" ") : "";
                            };
                            if (t.fg) {
                                if (o) {
                                    l.push(t.fg + "-fg");
                                    if (t.fg_truecolor !== null) {
                                        c["ansi-truecolor-fg"] = t.fg_truecolor;
                                        t.fg_truecolor = null;
                                    }
                                } else {
                                    a.push("color:rgb(" + t.fg + ")");
                                }
                            }
                            if (t.bg) {
                                if (o) {
                                    l.push(t.bg + "-bg");
                                    if (t.bg_truecolor !== null) {
                                        c["ansi-truecolor-bg"] = t.bg_truecolor;
                                        t.bg_truecolor = null;
                                    }
                                } else {
                                    a.push("background-color:rgb(" + t.bg + ")");
                                }
                            }
                            if (t.decoration) {
                                if (o) {
                                    l.push("ansi-" + t.decoration);
                                } else if (t.decoration === "bold") {
                                    a.push("font-weight:bold");
                                } else if (t.decoration === "dim") {
                                    a.push("opacity:0.5");
                                } else if (t.decoration === "italic") {
                                    a.push("font-style:italic");
                                } else if (t.decoration === "reverse") {
                                    a.push("filter:invert(100%)");
                                } else if (t.decoration === "hidden") {
                                    a.push("visibility:hidden");
                                } else if (t.decoration === "strikethrough") {
                                    a.push("text-decoration:line-through");
                                } else {
                                    a.push("text-decoration:" + t.decoration);
                                }
                            }
                            if (o) {
                                return '<span class="' + l.join(" ") + '"' + u(c) + ">" + t.content + "</span>";
                            } else {
                                return '<span style="' + a.join(";") + '"' + u(c) + ">" + t.content + "</span>";
                            }
                        }
                    }
                ]);
                return Anser;
            }();
            e.exports = s;
        }
    };
    var r = {};
    function __nccwpck_require__(n) {
        var s = r[n];
        if (s !== undefined) {
            return s.exports;
        }
        var i = r[n] = {
            exports: {}
        };
        var t = true;
        try {
            e[n](i, i.exports, __nccwpck_require__);
            t = false;
        } finally{
            if (t) delete r[n];
        }
        return i.exports;
    }
    if (typeof __nccwpck_require__ !== "undefined") __nccwpck_require__.ab = __dirname + "/";
    var n = __nccwpck_require__(211);
    module.exports = n;
})();
}}),
}]);

//# sourceMappingURL=78671_next_dist_compiled_80f51a._.js.map