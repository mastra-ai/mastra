module.exports = {

"[project]/integrations/claude/dist/claude.esm.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "ClaudeIntegration": (()=>ClaudeIntegration)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$core$2f$dist$2f$core$2e$esm$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/packages/core/dist/core.esm.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$hey$2d$api$2b$client$2d$fetch$40$0$2e$3$2e$4$2f$node_modules$2f40$hey$2d$api$2f$client$2d$fetch$2f$dist$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@hey-api+client-fetch@0.3.4/node_modules/@hey-api/client-fetch/dist/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/zod@3.23.8/node_modules/zod/lib/index.mjs [app-rsc] (ecmascript)");
;
;
;
function asyncGeneratorStep(n, t, e, r, o, a, c) {
    try {
        var i = n[a](c), u = i.value;
    } catch (n) {
        return void e(n);
    }
    i.done ? t(u) : Promise.resolve(u).then(r, o);
}
function _asyncToGenerator(n) {
    return function() {
        var t = this, e = arguments;
        return new Promise(function(r, o) {
            var a = n.apply(t, e);
            function _next(n) {
                asyncGeneratorStep(a, r, o, _next, _throw, "next", n);
            }
            function _throw(n) {
                asyncGeneratorStep(a, r, o, _next, _throw, "throw", n);
            }
            _next(void 0);
        });
    };
}
function _defineProperties(e, r) {
    for(var t = 0; t < r.length; t++){
        var o = r[t];
        o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o);
    }
}
function _createClass(e, r, t) {
    return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", {
        writable: !1
    }), e;
}
function _extends() {
    return _extends = ("TURBOPACK compile-time truthy", 1) ? Object.assign.bind() : ("TURBOPACK unreachable", undefined), _extends.apply(null, arguments);
}
function _inheritsLoose(t, o) {
    t.prototype = Object.create(o.prototype), t.prototype.constructor = t, _setPrototypeOf(t, o);
}
function _regeneratorRuntime() {
    _regeneratorRuntime = function() {
        return e;
    };
    var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function(t, e, r) {
        t[e] = r.value;
    }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag";
    function define(t, e, r) {
        return Object.defineProperty(t, e, {
            value: r,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }), t[e];
    }
    try {
        define({}, "");
    } catch (t) {
        define = function(t, e, r) {
            return t[e] = r;
        };
    }
    function wrap(t, e, r, n) {
        var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []);
        return o(a, "_invoke", {
            value: makeInvokeMethod(t, r, c)
        }), a;
    }
    function tryCatch(t, e, r) {
        try {
            return {
                type: "normal",
                arg: t.call(e, r)
            };
        } catch (t) {
            return {
                type: "throw",
                arg: t
            };
        }
    }
    e.wrap = wrap;
    var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {};
    function Generator() {}
    function GeneratorFunction() {}
    function GeneratorFunctionPrototype() {}
    var p = {};
    define(p, a, function() {
        return this;
    });
    var d = Object.getPrototypeOf, v = d && d(d(values([])));
    v && v !== r && n.call(v, a) && (p = v);
    var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p);
    function defineIteratorMethods(t) {
        [
            "next",
            "throw",
            "return"
        ].forEach(function(e) {
            define(t, e, function(t) {
                return this._invoke(e, t);
            });
        });
    }
    function AsyncIterator(t, e) {
        function invoke(r, o, i, a) {
            var c = tryCatch(t[r], t, o);
            if ("throw" !== c.type) {
                var u = c.arg, h = u.value;
                return h && "object" == typeof h && n.call(h, "__await") ? e.resolve(h.__await).then(function(t) {
                    invoke("next", t, i, a);
                }, function(t) {
                    invoke("throw", t, i, a);
                }) : e.resolve(h).then(function(t) {
                    u.value = t, i(u);
                }, function(t) {
                    return invoke("throw", t, i, a);
                });
            }
            a(c.arg);
        }
        var r;
        o(this, "_invoke", {
            value: function(t, n) {
                function callInvokeWithMethodAndArg() {
                    return new e(function(e, r) {
                        invoke(t, n, e, r);
                    });
                }
                return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
            }
        });
    }
    function makeInvokeMethod(e, r, n) {
        var o = h;
        return function(i, a) {
            if (o === f) throw Error("Generator is already running");
            if (o === s) {
                if ("throw" === i) throw a;
                return {
                    value: t,
                    done: !0
                };
            }
            for(n.method = i, n.arg = a;;){
                var c = n.delegate;
                if (c) {
                    var u = maybeInvokeDelegate(c, n);
                    if (u) {
                        if (u === y) continue;
                        return u;
                    }
                }
                if ("next" === n.method) n.sent = n._sent = n.arg;
                else if ("throw" === n.method) {
                    if (o === h) throw o = s, n.arg;
                    n.dispatchException(n.arg);
                } else "return" === n.method && n.abrupt("return", n.arg);
                o = f;
                var p = tryCatch(e, r, n);
                if ("normal" === p.type) {
                    if (o = n.done ? s : l, p.arg === y) continue;
                    return {
                        value: p.arg,
                        done: n.done
                    };
                }
                "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg);
            }
        };
    }
    function maybeInvokeDelegate(e, r) {
        var n = r.method, o = e.iterator[n];
        if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y;
        var i = tryCatch(o, e.iterator, r.arg);
        if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y;
        var a = i.arg;
        return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y);
    }
    function pushTryEntry(t) {
        var e = {
            tryLoc: t[0]
        };
        1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e);
    }
    function resetTryEntry(t) {
        var e = t.completion || {};
        e.type = "normal", delete e.arg, t.completion = e;
    }
    function Context(t) {
        this.tryEntries = [
            {
                tryLoc: "root"
            }
        ], t.forEach(pushTryEntry, this), this.reset(!0);
    }
    function values(e) {
        if (e || "" === e) {
            var r = e[a];
            if (r) return r.call(e);
            if ("function" == typeof e.next) return e;
            if (!isNaN(e.length)) {
                var o = -1, i = function next() {
                    for(; ++o < e.length;)if (n.call(e, o)) return next.value = e[o], next.done = !1, next;
                    return next.value = t, next.done = !0, next;
                };
                return i.next = i;
            }
        }
        throw new TypeError(typeof e + " is not iterable");
    }
    return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", {
        value: GeneratorFunctionPrototype,
        configurable: !0
    }), o(GeneratorFunctionPrototype, "constructor", {
        value: GeneratorFunction,
        configurable: !0
    }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function(t) {
        var e = "function" == typeof t && t.constructor;
        return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name));
    }, e.mark = function(t) {
        return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t;
    }, e.awrap = function(t) {
        return {
            __await: t
        };
    }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function() {
        return this;
    }), e.AsyncIterator = AsyncIterator, e.async = function(t, r, n, o, i) {
        void 0 === i && (i = Promise);
        var a = new AsyncIterator(wrap(t, r, n, o), i);
        return e.isGeneratorFunction(r) ? a : a.next().then(function(t) {
            return t.done ? t.value : a.next();
        });
    }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function() {
        return this;
    }), define(g, "toString", function() {
        return "[object Generator]";
    }), e.keys = function(t) {
        var e = Object(t), r = [];
        for(var n in e)r.push(n);
        return r.reverse(), function next() {
            for(; r.length;){
                var t = r.pop();
                if (t in e) return next.value = t, next.done = !1, next;
            }
            return next.done = !0, next;
        };
    }, e.values = values, Context.prototype = {
        constructor: Context,
        reset: function(e) {
            if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for(var r in this)"t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t);
        },
        stop: function() {
            this.done = !0;
            var t = this.tryEntries[0].completion;
            if ("throw" === t.type) throw t.arg;
            return this.rval;
        },
        dispatchException: function(e) {
            if (this.done) throw e;
            var r = this;
            function handle(n, o) {
                return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o;
            }
            for(var o = this.tryEntries.length - 1; o >= 0; --o){
                var i = this.tryEntries[o], a = i.completion;
                if ("root" === i.tryLoc) return handle("end");
                if (i.tryLoc <= this.prev) {
                    var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc");
                    if (c && u) {
                        if (this.prev < i.catchLoc) return handle(i.catchLoc, !0);
                        if (this.prev < i.finallyLoc) return handle(i.finallyLoc);
                    } else if (c) {
                        if (this.prev < i.catchLoc) return handle(i.catchLoc, !0);
                    } else {
                        if (!u) throw Error("try statement without catch or finally");
                        if (this.prev < i.finallyLoc) return handle(i.finallyLoc);
                    }
                }
            }
        },
        abrupt: function(t, e) {
            for(var r = this.tryEntries.length - 1; r >= 0; --r){
                var o = this.tryEntries[r];
                if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) {
                    var i = o;
                    break;
                }
            }
            i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null);
            var a = i ? i.completion : {};
            return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a);
        },
        complete: function(t, e) {
            if ("throw" === t.type) throw t.arg;
            return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y;
        },
        finish: function(t) {
            for(var e = this.tryEntries.length - 1; e >= 0; --e){
                var r = this.tryEntries[e];
                if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y;
            }
        },
        catch: function(t) {
            for(var e = this.tryEntries.length - 1; e >= 0; --e){
                var r = this.tryEntries[e];
                if (r.tryLoc === t) {
                    var n = r.completion;
                    if ("throw" === n.type) {
                        var o = n.arg;
                        resetTryEntry(r);
                    }
                    return o;
                }
            }
            throw Error("illegal catch attempt");
        },
        delegateYield: function(e, r, n) {
            return this.delegate = {
                iterator: values(e),
                resultName: r,
                nextLoc: n
            }, "next" === this.method && (this.arg = t), y;
        }
    }, e;
}
function _setPrototypeOf(t, e) {
    return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(t, e) {
        return t.__proto__ = e, t;
    }, _setPrototypeOf(t, e);
}
function _toPrimitive(t, r) {
    if ("object" != typeof t || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
        var i = e.call(t, r || "default");
        if ("object" != typeof i) return i;
        throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
}
function _toPropertyKey(t) {
    var i = _toPrimitive(t, "string");
    return "symbol" == typeof i ? i : i + "";
}
var img = "data:image/png;base64,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";
var comments = {
    createMessage: {
        comment: 'Create a Message',
        doc: 'Create a Message\n  Send a structured list of input messages with text and/or image content, and the\n  model will generate the next message in the conversation.\n \n  The Messages API can be used for either single queries or stateless multi-turn\n  conversations.'
    },
    createMessageBatch: {
        comment: 'Create a Message Batch',
        doc: 'Create a Message Batch\n  Send a batch of Message creation requests.'
    },
    retrieveMessageBatch: {
        comment: 'Retrieve a Message Batch',
        doc: 'Retrieve a Message Batch\n  This endpoint is idempotent and can be used to poll for Message Batch\n  completion. To access the results of a Message Batch, make a request to the\n  `results_url` field in the response.'
    }
};
var client = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$hey$2d$api$2b$client$2d$fetch$40$0$2e$3$2e$4$2f$node_modules$2f40$hey$2d$api$2f$client$2d$fetch$2f$dist$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$hey$2d$api$2b$client$2d$fetch$40$0$2e$3$2e$4$2f$node_modules$2f40$hey$2d$api$2f$client$2d$fetch$2f$dist$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createConfig"])());
/**
 * Create a Message
 * Send a structured list of input messages with text and/or image content, and the
 * model will generate the next message in the conversation.
 *
 * The Messages API can be used for either single queries or stateless multi-turn
 * conversations.
 *
 */ var createMessage = function createMessage(options) {
    var _options$client;
    return ((_options$client = options == null ? void 0 : options.client) != null ? _options$client : client).post(_extends({}, options, {
        url: '/messages'
    }));
};
/**
 * Create a Message Batch
 * Send a batch of Message creation requests.
 */ var createMessageBatch = function createMessageBatch(options) {
    var _options$client2;
    return ((_options$client2 = options == null ? void 0 : options.client) != null ? _options$client2 : client).post(_extends({}, options, {
        url: '/messages/batches'
    }));
};
/**
 * Retrieve a Message Batch
 * This endpoint is idempotent and can be used to poll for Message Batch
 * completion. To access the results of a Message Batch, make a request to the
 * `results_url` field in the response.
 *
 */ var retrieveMessageBatch = function retrieveMessageBatch(options) {
    var _options$client3;
    return ((_options$client3 = options == null ? void 0 : options.client) != null ? _options$client3 : client).get(_extends({}, options, {
        url: '/messages/batches/{id}'
    }));
};
var integrationClient = {
    __proto__: null,
    client: client,
    createMessage: createMessage,
    createMessageBatch: createMessageBatch,
    retrieveMessageBatch: retrieveMessageBatch
};
// Generated by ts-to-zod
var textBlockDeltaSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    text: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('text_delta')
});
var inputJsonBlockDeltaSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    partial_json: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('input_json_delta')
});
var cacheControlEphemeralSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('ephemeral').optional()
});
var typeSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('ephemeral');
var blockDeltaSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
    textBlockDeltaSchema,
    inputJsonBlockDeltaSchema
]);
var contentBlockStopEventSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    index: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('content_block_stop')
});
var createMessageRequestMetadataSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    user_id: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional()
});
var errorSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    message: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string()
});
var errorEventSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('error'),
    error: errorSchema
});
var imageBlockSourceSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    data: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    media_type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('image/jpeg'),
        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('image/png'),
        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('image/gif'),
        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('image/webp')
    ]),
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('base64')
});
var mediaTypeSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('image/jpeg'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('image/png'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('image/gif'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('image/webp')
]);
var type2Schema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('base64');
var messageRoleSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('user'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('assistant')
]);
var stopReasonSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('end_turn'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('max_tokens'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('stop_sequence'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('tool_use')
]);
var usageSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    input_tokens: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
    output_tokens: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
    cache_creation_input_tokens: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().optional(),
    cache_read_input_tokens: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().optional()
});
var messageBatchRequestCountsSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    processing: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
    succeeded: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
    errored: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
    canceled: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
    expired: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number()
});
var processingStatusSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('in_progress'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('canceling'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('ended')
]);
var type3Schema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('message_batch');
var messageDeltaSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    stop_reason: /*#__PURE__*/ stopReasonSchema.optional(),
    stop_sequence: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional()
});
var messageDeltaUsageSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    output_tokens: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number()
});
var messageStopEventSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('message_stop')
});
var messageDeltaEventSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    delta: messageDeltaSchema,
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('message_delta'),
    usage: messageDeltaUsageSchema
});
var contentBlockDeltaEventSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    delta: blockDeltaSchema,
    index: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('content_block_delta')
});
var pingEventSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('ping')
});
var messageStreamEventTypeSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('message_start'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('message_delta'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('message_stop'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('content_block_start'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('content_block_delta'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('content_block_stop'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('ping'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('error')
]);
var textBlockSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    text: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('text').optional(),
    cache_control: /*#__PURE__*/ cacheControlEphemeralSchema.optional()
});
var toolCustomSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('ToolCustom').optional(),
    name: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    description: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    input_schema: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].record(/*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].unknown())
});
var toolComputerUseSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('ToolComputerUse').optional(),
    name: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    cache_control: /*#__PURE__*/ cacheControlEphemeralSchema.optional(),
    display_width_px: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
    display_height_px: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
    display_number: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().optional().nullable()
});
var toolTextEditorSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('ToolTextEditor').optional(),
    name: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    cache_control: /*#__PURE__*/ cacheControlEphemeralSchema.optional()
});
var toolBashSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('ToolBash').optional(),
    name: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    cache_control: /*#__PURE__*/ cacheControlEphemeralSchema.optional()
});
var toolChoiceTypeSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('auto'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('any'),
    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('tool')
]);
var toolUseBlockSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    id: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    name: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    input: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].record(/*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].unknown()),
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('tool_use').optional(),
    cache_control: /*#__PURE__*/ cacheControlEphemeralSchema.optional()
});
var createMessageErrorSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].unknown();
var messageBatchSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    id: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    created_at: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    expires_at: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    processing_status: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('in_progress'),
        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('canceling'),
        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('ended')
    ]),
    request_counts: messageBatchRequestCountsSchema,
    results_url: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional().nullable(),
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('message_batch')
});
var createMessageBatchErrorSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].unknown();
var retrieveMessageBatchDataSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    path: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        id: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string()
    })
});
var retrieveMessageBatchResponseSchema = messageBatchSchema;
var retrieveMessageBatchErrorSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].unknown();
var imageBlockSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    source: imageBlockSourceSchema,
    type: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('image').optional(),
    cache_control: /*#__PURE__*/ cacheControlEphemeralSchema.optional()
});
var toolChoiceSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: toolChoiceTypeSchema,
    name: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    disable_parallel_tool_use: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"]["boolean"]().optional()
});
var toolSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
    toolCustomSchema,
    toolComputerUseSchema,
    toolTextEditorSchema,
    toolBashSchema
]);
var createMessageBatchResponseSchema = messageBatchSchema;
var batchMessageRequestSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        custom_id: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
        params: createMessageRequestSchema
    });
});
var createMessageRequestSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        model: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('claude-3-5-sonnet-latest'),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('claude-3-5-sonnet-20241022'),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('claude-3-5-sonnet-20240620'),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('claude-3-opus-latest'),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('claude-3-opus-20240229'),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('claude-3-sonnet-20240229'),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('claude-3-haiku-20240307'),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('claude-2.1'),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('claude-2.0'),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('claude-instant-1.2')
        ]),
        messages: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(messageSchema),
        max_tokens: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
        metadata: createMessageRequestMetadataSchema.optional(),
        stop_sequences: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string()).optional(),
        system: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(blockSchema)
        ]).optional(),
        temperature: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().optional(),
        tool_choice: toolChoiceSchema.optional(),
        tools: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(toolSchema).optional(),
        top_k: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().optional(),
        top_p: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().optional(),
        stream: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"]["boolean"]().optional()
    });
});
var blockSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
        textBlockSchema,
        imageBlockSchema,
        toolUseBlockSchema,
        toolResultBlockSchema
    ]);
});
var toolResultBlockSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        tool_use_id: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
        content: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(blockSchema)
        ]),
        is_error: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"]["boolean"]().optional(),
        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('tool_result').optional(),
        cache_control: cacheControlEphemeralSchema.optional()
    });
});
var contentBlockStartEventSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        content_block: blockSchema,
        index: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('content_block_start')
    });
});
var createMessageBatchRequestSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        requests: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(batchMessageRequestSchema)
    });
});
var messageSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        id: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        content: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(blockSchema)
        ]),
        role: messageRoleSchema,
        model: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        stop_reason: stopReasonSchema.optional(),
        stop_sequence: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        usage: usageSchema.optional()
    });
});
var messageStartEventSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        message: messageSchema,
        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('message_start')
    });
});
var messageStreamEventSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
        messageStartEventSchema,
        messageDeltaEventSchema,
        messageStopEventSchema,
        contentBlockStartEventSchema,
        contentBlockDeltaEventSchema,
        contentBlockStopEventSchema,
        pingEventSchema,
        errorEventSchema
    ]);
});
var createMessageDataSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        body: createMessageRequestSchema
    });
});
var createMessageResponseSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return messageSchema;
});
var createMessageBatchDataSchema = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(function() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$8$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        body: createMessageBatchRequestSchema
    });
});
var zodSchema = {
    __proto__: null,
    batchMessageRequestSchema: batchMessageRequestSchema,
    blockDeltaSchema: blockDeltaSchema,
    blockSchema: blockSchema,
    cacheControlEphemeralSchema: cacheControlEphemeralSchema,
    contentBlockDeltaEventSchema: contentBlockDeltaEventSchema,
    contentBlockStartEventSchema: contentBlockStartEventSchema,
    contentBlockStopEventSchema: contentBlockStopEventSchema,
    createMessageBatchDataSchema: createMessageBatchDataSchema,
    createMessageBatchErrorSchema: createMessageBatchErrorSchema,
    createMessageBatchRequestSchema: createMessageBatchRequestSchema,
    createMessageBatchResponseSchema: createMessageBatchResponseSchema,
    createMessageDataSchema: createMessageDataSchema,
    createMessageErrorSchema: createMessageErrorSchema,
    createMessageRequestMetadataSchema: createMessageRequestMetadataSchema,
    createMessageRequestSchema: createMessageRequestSchema,
    createMessageResponseSchema: createMessageResponseSchema,
    errorEventSchema: errorEventSchema,
    errorSchema: errorSchema,
    imageBlockSchema: imageBlockSchema,
    imageBlockSourceSchema: imageBlockSourceSchema,
    inputJsonBlockDeltaSchema: inputJsonBlockDeltaSchema,
    mediaTypeSchema: mediaTypeSchema,
    messageBatchRequestCountsSchema: messageBatchRequestCountsSchema,
    messageBatchSchema: messageBatchSchema,
    messageDeltaEventSchema: messageDeltaEventSchema,
    messageDeltaSchema: messageDeltaSchema,
    messageDeltaUsageSchema: messageDeltaUsageSchema,
    messageRoleSchema: messageRoleSchema,
    messageSchema: messageSchema,
    messageStartEventSchema: messageStartEventSchema,
    messageStopEventSchema: messageStopEventSchema,
    messageStreamEventSchema: messageStreamEventSchema,
    messageStreamEventTypeSchema: messageStreamEventTypeSchema,
    pingEventSchema: pingEventSchema,
    processingStatusSchema: processingStatusSchema,
    retrieveMessageBatchDataSchema: retrieveMessageBatchDataSchema,
    retrieveMessageBatchErrorSchema: retrieveMessageBatchErrorSchema,
    retrieveMessageBatchResponseSchema: retrieveMessageBatchResponseSchema,
    stopReasonSchema: stopReasonSchema,
    textBlockDeltaSchema: textBlockDeltaSchema,
    textBlockSchema: textBlockSchema,
    toolBashSchema: toolBashSchema,
    toolChoiceSchema: toolChoiceSchema,
    toolChoiceTypeSchema: toolChoiceTypeSchema,
    toolComputerUseSchema: toolComputerUseSchema,
    toolCustomSchema: toolCustomSchema,
    toolResultBlockSchema: toolResultBlockSchema,
    toolSchema: toolSchema,
    toolTextEditorSchema: toolTextEditorSchema,
    toolUseBlockSchema: toolUseBlockSchema,
    type2Schema: type2Schema,
    type3Schema: type3Schema,
    typeSchema: typeSchema,
    usageSchema: usageSchema
};
var ClaudeIntegration = /*#__PURE__*/ function(_Integration) {
    function ClaudeIntegration(_ref) {
        var _this;
        var config = _ref.config;
        _this = _Integration.call(this) || this;
        _this.name = 'CLAUDE';
        _this.logoUrl = img;
        _this.config = void 0;
        _this.tools = void 0;
        _this.categories = [
            'ai',
            'communications'
        ];
        _this.description = 'Claude is a next generation AI assistant built for work and trained to be safe, accurate, and secure.';
        _this.getApiClient = /*#__PURE__*/ _asyncToGenerator(/*#__PURE__*/ _regeneratorRuntime().mark(function _callee() {
            var _this$config;
            var value, baseClient;
            return _regeneratorRuntime().wrap(function _callee$(_context) {
                while(1)switch(_context.prev = _context.next){
                    case 0:
                        value = {
                            'x-api-key': (_this$config = _this.config) == null ? void 0 : _this$config['ANTHROPIC_API_KEY']
                        };
                        baseClient = _this.baseClient;
                        baseClient.client.interceptors.request.use(function(request, options) {
                            request.headers.set('x-api-key', value == null ? void 0 : value['ANTHROPIC_API_KEY']);
                            return request;
                        });
                        return _context.abrupt("return", integrationClient);
                    case 4:
                    case "end":
                        return _context.stop();
                }
            }, _callee);
        }));
        _this.config = config;
        _this.tools = _this._generateIntegrationTools();
        return _this;
    }
    _inheritsLoose(ClaudeIntegration, _Integration);
    return _createClass(ClaudeIntegration, [
        {
            key: "toolSchemas",
            get: function get() {
                return zodSchema;
            }
        },
        {
            key: "toolDocumentations",
            get: function get() {
                return comments;
            }
        },
        {
            key: "baseClient",
            get: function get() {
                client.setConfig({
                    baseUrl: "https://api.anthropic.com/v1"
                });
                return integrationClient;
            }
        }
    ]);
}(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$core$2f$dist$2f$core$2e$esm$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Integration"]);
;
 //# sourceMappingURL=claude.esm.js.map
}}),

};

//# sourceMappingURL=%5Bproject%5D_integrations_claude_dist_claude_esm_896f51.js.map