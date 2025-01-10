module.exports = {

"[project]/node_modules/.pnpm/web-streams-polyfill@4.0.0-beta.3/node_modules/web-streams-polyfill/dist/ponyfill.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
 * @license
 * web-streams-polyfill v4.0.0-beta.3
 * Copyright 2021 Mattias Buelens, Diwank Singh Tomer and other contributors.
 * This code is released under the MIT license.
 * SPDX-License-Identifier: MIT
 */ !function(e, t) {
    ("TURBOPACK compile-time truthy", 1) ? t(exports) : ("TURBOPACK unreachable", undefined);
}(this, function(e) {
    "use strict";
    const t = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? Symbol : (e)=>`Symbol(${e})`;
    function r() {}
    function o(e) {
        return "object" == typeof e && null !== e || "function" == typeof e;
    }
    const n = r;
    function a(e, t) {
        try {
            Object.defineProperty(e, "name", {
                value: t,
                configurable: !0
            });
        } catch (e) {}
    }
    const i = Promise, l = Promise.prototype.then, s = Promise.resolve.bind(i), u = Promise.reject.bind(i);
    function c(e) {
        return new i(e);
    }
    function d(e) {
        return s(e);
    }
    function f(e) {
        return u(e);
    }
    function b(e, t, r) {
        return l.call(e, t, r);
    }
    function h(e, t, r) {
        b(b(e, t, r), void 0, n);
    }
    function _(e, t) {
        h(e, t);
    }
    function p(e, t) {
        h(e, void 0, t);
    }
    function m(e, t, r) {
        return b(e, t, r);
    }
    function y(e) {
        b(e, void 0, n);
    }
    let g = (e)=>{
        if ("function" == typeof queueMicrotask) g = queueMicrotask;
        else {
            const e = d(void 0);
            g = (t)=>b(e, t);
        }
        return g(e);
    };
    function S(e, t, r) {
        if ("function" != typeof e) throw new TypeError("Argument is not a function");
        return Function.prototype.apply.call(e, t, r);
    }
    function w(e, t, r) {
        try {
            return d(S(e, t, r));
        } catch (e) {
            return f(e);
        }
    }
    class v {
        constructor(){
            this._cursor = 0, this._size = 0, this._front = {
                _elements: [],
                _next: void 0
            }, this._back = this._front, this._cursor = 0, this._size = 0;
        }
        get length() {
            return this._size;
        }
        push(e) {
            const t = this._back;
            let r = t;
            16383 === t._elements.length && (r = {
                _elements: [],
                _next: void 0
            }), t._elements.push(e), r !== t && (this._back = r, t._next = r), ++this._size;
        }
        shift() {
            const e = this._front;
            let t = e;
            const r = this._cursor;
            let o = r + 1;
            const n = e._elements, a = n[r];
            return 16384 === o && (t = e._next, o = 0), --this._size, this._cursor = o, e !== t && (this._front = t), n[r] = void 0, a;
        }
        forEach(e) {
            let t = this._cursor, r = this._front, o = r._elements;
            for(; !(t === o.length && void 0 === r._next || t === o.length && (r = r._next, o = r._elements, t = 0, 0 === o.length));)e(o[t]), ++t;
        }
        peek() {
            const e = this._front, t = this._cursor;
            return e._elements[t];
        }
    }
    const R = t("[[AbortSteps]]"), T = t("[[ErrorSteps]]"), q = t("[[CancelSteps]]"), C = t("[[PullSteps]]"), P = t("[[ReleaseSteps]]");
    function E(e, t) {
        e._ownerReadableStream = t, t._reader = e, "readable" === t._state ? B(e) : "closed" === t._state ? function(e) {
            B(e), z(e);
        }(e) : A(e, t._storedError);
    }
    function W(e, t) {
        return Xt(e._ownerReadableStream, t);
    }
    function O(e) {
        const t = e._ownerReadableStream;
        "readable" === t._state ? j(e, new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")) : function(e, t) {
            A(e, t);
        }(e, new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")), t._readableStreamController[P](), t._reader = void 0, e._ownerReadableStream = void 0;
    }
    function k(e) {
        return new TypeError("Cannot " + e + " a stream using a released reader");
    }
    function B(e) {
        e._closedPromise = c((t, r)=>{
            e._closedPromise_resolve = t, e._closedPromise_reject = r;
        });
    }
    function A(e, t) {
        B(e), j(e, t);
    }
    function j(e, t) {
        void 0 !== e._closedPromise_reject && (y(e._closedPromise), e._closedPromise_reject(t), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0);
    }
    function z(e) {
        void 0 !== e._closedPromise_resolve && (e._closedPromise_resolve(void 0), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0);
    }
    const L = Number.isFinite || function(e) {
        return "number" == typeof e && isFinite(e);
    }, F = Math.trunc || function(e) {
        return e < 0 ? Math.ceil(e) : Math.floor(e);
    };
    function D(e, t) {
        if (void 0 !== e && "object" != typeof (r = e) && "function" != typeof r) throw new TypeError(`${t} is not an object.`);
        var r;
    }
    function I(e, t) {
        if ("function" != typeof e) throw new TypeError(`${t} is not a function.`);
    }
    function $(e, t) {
        if (!function(e) {
            return "object" == typeof e && null !== e || "function" == typeof e;
        }(e)) throw new TypeError(`${t} is not an object.`);
    }
    function M(e, t, r) {
        if (void 0 === e) throw new TypeError(`Parameter ${t} is required in '${r}'.`);
    }
    function Y(e, t, r) {
        if (void 0 === e) throw new TypeError(`${t} is required in '${r}'.`);
    }
    function Q(e) {
        return Number(e);
    }
    function N(e) {
        return 0 === e ? 0 : e;
    }
    function x(e, t) {
        const r = Number.MAX_SAFE_INTEGER;
        let o = Number(e);
        if (o = N(o), !L(o)) throw new TypeError(`${t} is not a finite number`);
        if (o = function(e) {
            return N(F(e));
        }(o), o < 0 || o > r) throw new TypeError(`${t} is outside the accepted range of 0 to ${r}, inclusive`);
        return L(o) && 0 !== o ? o : 0;
    }
    function H(e) {
        if (!o(e)) return !1;
        if ("function" != typeof e.getReader) return !1;
        try {
            return "boolean" == typeof e.locked;
        } catch (e) {
            return !1;
        }
    }
    function V(e) {
        if (!o(e)) return !1;
        if ("function" != typeof e.getWriter) return !1;
        try {
            return "boolean" == typeof e.locked;
        } catch (e) {
            return !1;
        }
    }
    function U(e, t) {
        if (!Ut(e)) throw new TypeError(`${t} is not a ReadableStream.`);
    }
    function G(e, t) {
        e._reader._readRequests.push(t);
    }
    function X(e, t, r) {
        const o = e._reader._readRequests.shift();
        r ? o._closeSteps() : o._chunkSteps(t);
    }
    function J(e) {
        return e._reader._readRequests.length;
    }
    function K(e) {
        const t = e._reader;
        return void 0 !== t && !!Z(t);
    }
    class ReadableStreamDefaultReader {
        constructor(e){
            if (M(e, 1, "ReadableStreamDefaultReader"), U(e, "First parameter"), Gt(e)) throw new TypeError("This stream has already been locked for exclusive reading by another reader");
            E(this, e), this._readRequests = new v;
        }
        get closed() {
            return Z(this) ? this._closedPromise : f(te("closed"));
        }
        cancel(e) {
            return Z(this) ? void 0 === this._ownerReadableStream ? f(k("cancel")) : W(this, e) : f(te("cancel"));
        }
        read() {
            if (!Z(this)) return f(te("read"));
            if (void 0 === this._ownerReadableStream) return f(k("read from"));
            let e, t;
            const r = c((r, o)=>{
                e = r, t = o;
            });
            return function(e, t) {
                const r = e._ownerReadableStream;
                r._disturbed = !0, "closed" === r._state ? t._closeSteps() : "errored" === r._state ? t._errorSteps(r._storedError) : r._readableStreamController[C](t);
            }(this, {
                _chunkSteps: (t)=>e({
                        value: t,
                        done: !1
                    }),
                _closeSteps: ()=>e({
                        value: void 0,
                        done: !0
                    }),
                _errorSteps: (e)=>t(e)
            }), r;
        }
        releaseLock() {
            if (!Z(this)) throw te("releaseLock");
            void 0 !== this._ownerReadableStream && function(e) {
                O(e);
                const t = new TypeError("Reader was released");
                ee(e, t);
            }(this);
        }
    }
    function Z(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_readRequests") && e instanceof ReadableStreamDefaultReader;
    }
    function ee(e, t) {
        const r = e._readRequests;
        e._readRequests = new v, r.forEach((e)=>{
            e._errorSteps(t);
        });
    }
    function te(e) {
        return new TypeError(`ReadableStreamDefaultReader.prototype.${e} can only be used on a ReadableStreamDefaultReader`);
    }
    Object.defineProperties(ReadableStreamDefaultReader.prototype, {
        cancel: {
            enumerable: !0
        },
        read: {
            enumerable: !0
        },
        releaseLock: {
            enumerable: !0
        },
        closed: {
            enumerable: !0
        }
    }), a(ReadableStreamDefaultReader.prototype.cancel, "cancel"), a(ReadableStreamDefaultReader.prototype.read, "read"), a(ReadableStreamDefaultReader.prototype.releaseLock, "releaseLock"), "symbol" == typeof t.toStringTag && Object.defineProperty(ReadableStreamDefaultReader.prototype, t.toStringTag, {
        value: "ReadableStreamDefaultReader",
        configurable: !0
    });
    class re {
        constructor(e, t){
            this._ongoingPromise = void 0, this._isFinished = !1, this._reader = e, this._preventCancel = t;
        }
        next() {
            const e = ()=>this._nextSteps();
            return this._ongoingPromise = this._ongoingPromise ? m(this._ongoingPromise, e, e) : e(), this._ongoingPromise;
        }
        return(e) {
            const t = ()=>this._returnSteps(e);
            return this._ongoingPromise ? m(this._ongoingPromise, t, t) : t();
        }
        _nextSteps() {
            if (this._isFinished) return Promise.resolve({
                value: void 0,
                done: !0
            });
            const e = this._reader;
            return void 0 === e ? f(k("iterate")) : b(e.read(), (e)=>{
                var t;
                return this._ongoingPromise = void 0, e.done && (this._isFinished = !0, null === (t = this._reader) || void 0 === t || t.releaseLock(), this._reader = void 0), e;
            }, (e)=>{
                var t;
                throw this._ongoingPromise = void 0, this._isFinished = !0, null === (t = this._reader) || void 0 === t || t.releaseLock(), this._reader = void 0, e;
            });
        }
        _returnSteps(e) {
            if (this._isFinished) return Promise.resolve({
                value: e,
                done: !0
            });
            this._isFinished = !0;
            const t = this._reader;
            if (void 0 === t) return f(k("finish iterating"));
            if (this._reader = void 0, !this._preventCancel) {
                const r = t.cancel(e);
                return t.releaseLock(), m(r, ()=>({
                        value: e,
                        done: !0
                    }));
            }
            return t.releaseLock(), d({
                value: e,
                done: !0
            });
        }
    }
    const oe = {
        next () {
            return ne(this) ? this._asyncIteratorImpl.next() : f(ae("next"));
        },
        return (e) {
            return ne(this) ? this._asyncIteratorImpl.return(e) : f(ae("return"));
        }
    };
    function ne(e) {
        if (!o(e)) return !1;
        if (!Object.prototype.hasOwnProperty.call(e, "_asyncIteratorImpl")) return !1;
        try {
            return e._asyncIteratorImpl instanceof re;
        } catch (e) {
            return !1;
        }
    }
    function ae(e) {
        return new TypeError(`ReadableStreamAsyncIterator.${e} can only be used on a ReadableSteamAsyncIterator`);
    }
    "symbol" == typeof t.asyncIterator && Object.defineProperty(oe, t.asyncIterator, {
        value () {
            return this;
        },
        writable: !0,
        configurable: !0
    });
    const ie = Number.isNaN || function(e) {
        return e != e;
    };
    function le(e, t, r, o, n) {
        new Uint8Array(e).set(new Uint8Array(r, o, n), t);
    }
    function se(e) {
        const t = function(e, t, r) {
            if (e.slice) return e.slice(t, r);
            const o = r - t, n = new ArrayBuffer(o);
            return le(n, 0, e, t, o), n;
        }(e.buffer, e.byteOffset, e.byteOffset + e.byteLength);
        return new Uint8Array(t);
    }
    function ue(e) {
        const t = e._queue.shift();
        return e._queueTotalSize -= t.size, e._queueTotalSize < 0 && (e._queueTotalSize = 0), t.value;
    }
    function ce(e, t, r) {
        if ("number" != typeof (o = r) || ie(o) || o < 0 || r === 1 / 0) throw new RangeError("Size must be a finite, non-NaN, non-negative number.");
        var o;
        e._queue.push({
            value: t,
            size: r
        }), e._queueTotalSize += r;
    }
    function de(e) {
        e._queue = new v, e._queueTotalSize = 0;
    }
    class ReadableStreamBYOBRequest {
        constructor(){
            throw new TypeError("Illegal constructor");
        }
        get view() {
            if (!be(this)) throw Ae("view");
            return this._view;
        }
        respond(e) {
            if (!be(this)) throw Ae("respond");
            if (M(e, 1, "respond"), e = x(e, "First parameter"), void 0 === this._associatedReadableByteStreamController) throw new TypeError("This BYOB request has been invalidated");
            this._view.buffer, function(e, t) {
                const r = e._pendingPullIntos.peek();
                if ("closed" === e._controlledReadableByteStream._state) {
                    if (0 !== t) throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream");
                } else {
                    if (0 === t) throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");
                    if (r.bytesFilled + t > r.byteLength) throw new RangeError("bytesWritten out of range");
                }
                r.buffer = r.buffer, Ce(e, t);
            }(this._associatedReadableByteStreamController, e);
        }
        respondWithNewView(e) {
            if (!be(this)) throw Ae("respondWithNewView");
            if (M(e, 1, "respondWithNewView"), !ArrayBuffer.isView(e)) throw new TypeError("You can only respond with array buffer views");
            if (void 0 === this._associatedReadableByteStreamController) throw new TypeError("This BYOB request has been invalidated");
            e.buffer, function(e, t) {
                const r = e._pendingPullIntos.peek();
                if ("closed" === e._controlledReadableByteStream._state) {
                    if (0 !== t.byteLength) throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream");
                } else if (0 === t.byteLength) throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");
                if (r.byteOffset + r.bytesFilled !== t.byteOffset) throw new RangeError("The region specified by view does not match byobRequest");
                if (r.bufferByteLength !== t.buffer.byteLength) throw new RangeError("The buffer of view has different capacity than byobRequest");
                if (r.bytesFilled + t.byteLength > r.byteLength) throw new RangeError("The region specified by view is larger than byobRequest");
                const o = t.byteLength;
                r.buffer = t.buffer, Ce(e, o);
            }(this._associatedReadableByteStreamController, e);
        }
    }
    Object.defineProperties(ReadableStreamBYOBRequest.prototype, {
        respond: {
            enumerable: !0
        },
        respondWithNewView: {
            enumerable: !0
        },
        view: {
            enumerable: !0
        }
    }), a(ReadableStreamBYOBRequest.prototype.respond, "respond"), a(ReadableStreamBYOBRequest.prototype.respondWithNewView, "respondWithNewView"), "symbol" == typeof t.toStringTag && Object.defineProperty(ReadableStreamBYOBRequest.prototype, t.toStringTag, {
        value: "ReadableStreamBYOBRequest",
        configurable: !0
    });
    class ReadableByteStreamController {
        constructor(){
            throw new TypeError("Illegal constructor");
        }
        get byobRequest() {
            if (!fe(this)) throw je("byobRequest");
            return function(e) {
                if (null === e._byobRequest && e._pendingPullIntos.length > 0) {
                    const t = e._pendingPullIntos.peek(), r = new Uint8Array(t.buffer, t.byteOffset + t.bytesFilled, t.byteLength - t.bytesFilled), o = Object.create(ReadableStreamBYOBRequest.prototype);
                    !function(e, t, r) {
                        e._associatedReadableByteStreamController = t, e._view = r;
                    }(o, e, r), e._byobRequest = o;
                }
                return e._byobRequest;
            }(this);
        }
        get desiredSize() {
            if (!fe(this)) throw je("desiredSize");
            return ke(this);
        }
        close() {
            if (!fe(this)) throw je("close");
            if (this._closeRequested) throw new TypeError("The stream has already been closed; do not close it again!");
            const e = this._controlledReadableByteStream._state;
            if ("readable" !== e) throw new TypeError(`The stream (in ${e} state) is not in the readable state and cannot be closed`);
            !function(e) {
                const t = e._controlledReadableByteStream;
                if (e._closeRequested || "readable" !== t._state) return;
                if (e._queueTotalSize > 0) return void (e._closeRequested = !0);
                if (e._pendingPullIntos.length > 0) {
                    if (e._pendingPullIntos.peek().bytesFilled > 0) {
                        const t = new TypeError("Insufficient bytes to fill elements in the given buffer");
                        throw We(e, t), t;
                    }
                }
                Ee(e), Jt(t);
            }(this);
        }
        enqueue(e) {
            if (!fe(this)) throw je("enqueue");
            if (M(e, 1, "enqueue"), !ArrayBuffer.isView(e)) throw new TypeError("chunk must be an array buffer view");
            if (0 === e.byteLength) throw new TypeError("chunk must have non-zero byteLength");
            if (0 === e.buffer.byteLength) throw new TypeError("chunk's buffer must have non-zero byteLength");
            if (this._closeRequested) throw new TypeError("stream is closed or draining");
            const t = this._controlledReadableByteStream._state;
            if ("readable" !== t) throw new TypeError(`The stream (in ${t} state) is not in the readable state and cannot be enqueued to`);
            !function(e, t) {
                const r = e._controlledReadableByteStream;
                if (e._closeRequested || "readable" !== r._state) return;
                const o = t.buffer, n = t.byteOffset, a = t.byteLength, i = o;
                if (e._pendingPullIntos.length > 0) {
                    const t = e._pendingPullIntos.peek();
                    t.buffer, Te(e), t.buffer = t.buffer, "none" === t.readerType && Se(e, t);
                }
                if (K(r)) if (function(e) {
                    const t = e._controlledReadableByteStream._reader;
                    for(; t._readRequests.length > 0;){
                        if (0 === e._queueTotalSize) return;
                        Oe(e, t._readRequests.shift());
                    }
                }(e), 0 === J(r)) ye(e, i, n, a);
                else {
                    e._pendingPullIntos.length > 0 && Pe(e);
                    X(r, new Uint8Array(i, n, a), !1);
                }
                else Fe(r) ? (ye(e, i, n, a), qe(e)) : ye(e, i, n, a);
                he(e);
            }(this, e);
        }
        error(e) {
            if (!fe(this)) throw je("error");
            We(this, e);
        }
        [q](e) {
            _e(this), de(this);
            const t = this._cancelAlgorithm(e);
            return Ee(this), t;
        }
        [C](e) {
            const t = this._controlledReadableByteStream;
            if (this._queueTotalSize > 0) return void Oe(this, e);
            const r = this._autoAllocateChunkSize;
            if (void 0 !== r) {
                let t;
                try {
                    t = new ArrayBuffer(r);
                } catch (t) {
                    return void e._errorSteps(t);
                }
                const o = {
                    buffer: t,
                    bufferByteLength: r,
                    byteOffset: 0,
                    byteLength: r,
                    bytesFilled: 0,
                    elementSize: 1,
                    viewConstructor: Uint8Array,
                    readerType: "default"
                };
                this._pendingPullIntos.push(o);
            }
            G(t, e), he(this);
        }
        [P]() {
            if (this._pendingPullIntos.length > 0) {
                const e = this._pendingPullIntos.peek();
                e.readerType = "none", this._pendingPullIntos = new v, this._pendingPullIntos.push(e);
            }
        }
    }
    function fe(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_controlledReadableByteStream") && e instanceof ReadableByteStreamController;
    }
    function be(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_associatedReadableByteStreamController") && e instanceof ReadableStreamBYOBRequest;
    }
    function he(e) {
        const t = function(e) {
            const t = e._controlledReadableByteStream;
            if ("readable" !== t._state) return !1;
            if (e._closeRequested) return !1;
            if (!e._started) return !1;
            if (K(t) && J(t) > 0) return !0;
            if (Fe(t) && Le(t) > 0) return !0;
            if (ke(e) > 0) return !0;
            return !1;
        }(e);
        if (!t) return;
        if (e._pulling) return void (e._pullAgain = !0);
        e._pulling = !0;
        h(e._pullAlgorithm(), ()=>(e._pulling = !1, e._pullAgain && (e._pullAgain = !1, he(e)), null), (t)=>(We(e, t), null));
    }
    function _e(e) {
        Te(e), e._pendingPullIntos = new v;
    }
    function pe(e, t) {
        let r = !1;
        "closed" === e._state && (r = !0);
        const o = me(t);
        "default" === t.readerType ? X(e, o, r) : function(e, t, r) {
            const o = e._reader._readIntoRequests.shift();
            r ? o._closeSteps(t) : o._chunkSteps(t);
        }(e, o, r);
    }
    function me(e) {
        const t = e.bytesFilled, r = e.elementSize;
        return new e.viewConstructor(e.buffer, e.byteOffset, t / r);
    }
    function ye(e, t, r, o) {
        e._queue.push({
            buffer: t,
            byteOffset: r,
            byteLength: o
        }), e._queueTotalSize += o;
    }
    function ge(e, t, r, o) {
        let n;
        try {
            n = t.slice(r, r + o);
        } catch (t) {
            throw We(e, t), t;
        }
        ye(e, n, 0, o);
    }
    function Se(e, t) {
        t.bytesFilled > 0 && ge(e, t.buffer, t.byteOffset, t.bytesFilled), Pe(e);
    }
    function we(e, t) {
        const r = t.elementSize, o = t.bytesFilled - t.bytesFilled % r, n = Math.min(e._queueTotalSize, t.byteLength - t.bytesFilled), a = t.bytesFilled + n, i = a - a % r;
        let l = n, s = !1;
        i > o && (l = i - t.bytesFilled, s = !0);
        const u = e._queue;
        for(; l > 0;){
            const r = u.peek(), o = Math.min(l, r.byteLength), n = t.byteOffset + t.bytesFilled;
            le(t.buffer, n, r.buffer, r.byteOffset, o), r.byteLength === o ? u.shift() : (r.byteOffset += o, r.byteLength -= o), e._queueTotalSize -= o, ve(e, o, t), l -= o;
        }
        return s;
    }
    function ve(e, t, r) {
        r.bytesFilled += t;
    }
    function Re(e) {
        0 === e._queueTotalSize && e._closeRequested ? (Ee(e), Jt(e._controlledReadableByteStream)) : he(e);
    }
    function Te(e) {
        null !== e._byobRequest && (e._byobRequest._associatedReadableByteStreamController = void 0, e._byobRequest._view = null, e._byobRequest = null);
    }
    function qe(e) {
        for(; e._pendingPullIntos.length > 0;){
            if (0 === e._queueTotalSize) return;
            const t = e._pendingPullIntos.peek();
            we(e, t) && (Pe(e), pe(e._controlledReadableByteStream, t));
        }
    }
    function Ce(e, t) {
        const r = e._pendingPullIntos.peek();
        Te(e);
        "closed" === e._controlledReadableByteStream._state ? function(e, t) {
            "none" === t.readerType && Pe(e);
            const r = e._controlledReadableByteStream;
            if (Fe(r)) for(; Le(r) > 0;)pe(r, Pe(e));
        }(e, r) : function(e, t, r) {
            if (ve(0, t, r), "none" === r.readerType) return Se(e, r), void qe(e);
            if (r.bytesFilled < r.elementSize) return;
            Pe(e);
            const o = r.bytesFilled % r.elementSize;
            if (o > 0) {
                const t = r.byteOffset + r.bytesFilled;
                ge(e, r.buffer, t - o, o);
            }
            r.bytesFilled -= o, pe(e._controlledReadableByteStream, r), qe(e);
        }(e, t, r), he(e);
    }
    function Pe(e) {
        return e._pendingPullIntos.shift();
    }
    function Ee(e) {
        e._pullAlgorithm = void 0, e._cancelAlgorithm = void 0;
    }
    function We(e, t) {
        const r = e._controlledReadableByteStream;
        "readable" === r._state && (_e(e), de(e), Ee(e), Kt(r, t));
    }
    function Oe(e, t) {
        const r = e._queue.shift();
        e._queueTotalSize -= r.byteLength, Re(e);
        const o = new Uint8Array(r.buffer, r.byteOffset, r.byteLength);
        t._chunkSteps(o);
    }
    function ke(e) {
        const t = e._controlledReadableByteStream._state;
        return "errored" === t ? null : "closed" === t ? 0 : e._strategyHWM - e._queueTotalSize;
    }
    function Be(e, t, r) {
        const o = Object.create(ReadableByteStreamController.prototype);
        let n, a, i;
        n = void 0 !== t.start ? ()=>t.start(o) : ()=>{}, a = void 0 !== t.pull ? ()=>t.pull(o) : ()=>d(void 0), i = void 0 !== t.cancel ? (e)=>t.cancel(e) : ()=>d(void 0);
        const l = t.autoAllocateChunkSize;
        if (0 === l) throw new TypeError("autoAllocateChunkSize must be greater than 0");
        !function(e, t, r, o, n, a, i) {
            t._controlledReadableByteStream = e, t._pullAgain = !1, t._pulling = !1, t._byobRequest = null, t._queue = t._queueTotalSize = void 0, de(t), t._closeRequested = !1, t._started = !1, t._strategyHWM = a, t._pullAlgorithm = o, t._cancelAlgorithm = n, t._autoAllocateChunkSize = i, t._pendingPullIntos = new v, e._readableStreamController = t, h(d(r()), ()=>(t._started = !0, he(t), null), (e)=>(We(t, e), null));
        }(e, o, n, a, i, r, l);
    }
    function Ae(e) {
        return new TypeError(`ReadableStreamBYOBRequest.prototype.${e} can only be used on a ReadableStreamBYOBRequest`);
    }
    function je(e) {
        return new TypeError(`ReadableByteStreamController.prototype.${e} can only be used on a ReadableByteStreamController`);
    }
    function ze(e, t) {
        e._reader._readIntoRequests.push(t);
    }
    function Le(e) {
        return e._reader._readIntoRequests.length;
    }
    function Fe(e) {
        const t = e._reader;
        return void 0 !== t && !!De(t);
    }
    Object.defineProperties(ReadableByteStreamController.prototype, {
        close: {
            enumerable: !0
        },
        enqueue: {
            enumerable: !0
        },
        error: {
            enumerable: !0
        },
        byobRequest: {
            enumerable: !0
        },
        desiredSize: {
            enumerable: !0
        }
    }), a(ReadableByteStreamController.prototype.close, "close"), a(ReadableByteStreamController.prototype.enqueue, "enqueue"), a(ReadableByteStreamController.prototype.error, "error"), "symbol" == typeof t.toStringTag && Object.defineProperty(ReadableByteStreamController.prototype, t.toStringTag, {
        value: "ReadableByteStreamController",
        configurable: !0
    });
    class ReadableStreamBYOBReader {
        constructor(e){
            if (M(e, 1, "ReadableStreamBYOBReader"), U(e, "First parameter"), Gt(e)) throw new TypeError("This stream has already been locked for exclusive reading by another reader");
            if (!fe(e._readableStreamController)) throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");
            E(this, e), this._readIntoRequests = new v;
        }
        get closed() {
            return De(this) ? this._closedPromise : f($e("closed"));
        }
        cancel(e) {
            return De(this) ? void 0 === this._ownerReadableStream ? f(k("cancel")) : W(this, e) : f($e("cancel"));
        }
        read(e) {
            if (!De(this)) return f($e("read"));
            if (!ArrayBuffer.isView(e)) return f(new TypeError("view must be an array buffer view"));
            if (0 === e.byteLength) return f(new TypeError("view must have non-zero byteLength"));
            if (0 === e.buffer.byteLength) return f(new TypeError("view's buffer must have non-zero byteLength"));
            if (e.buffer, void 0 === this._ownerReadableStream) return f(k("read from"));
            let t, r;
            const o = c((e, o)=>{
                t = e, r = o;
            });
            return function(e, t, r) {
                const o = e._ownerReadableStream;
                o._disturbed = !0, "errored" === o._state ? r._errorSteps(o._storedError) : function(e, t, r) {
                    const o = e._controlledReadableByteStream;
                    let n = 1;
                    t.constructor !== DataView && (n = t.constructor.BYTES_PER_ELEMENT);
                    const a = t.constructor, i = t.buffer, l = {
                        buffer: i,
                        bufferByteLength: i.byteLength,
                        byteOffset: t.byteOffset,
                        byteLength: t.byteLength,
                        bytesFilled: 0,
                        elementSize: n,
                        viewConstructor: a,
                        readerType: "byob"
                    };
                    if (e._pendingPullIntos.length > 0) return e._pendingPullIntos.push(l), void ze(o, r);
                    if ("closed" !== o._state) {
                        if (e._queueTotalSize > 0) {
                            if (we(e, l)) {
                                const t = me(l);
                                return Re(e), void r._chunkSteps(t);
                            }
                            if (e._closeRequested) {
                                const t = new TypeError("Insufficient bytes to fill elements in the given buffer");
                                return We(e, t), void r._errorSteps(t);
                            }
                        }
                        e._pendingPullIntos.push(l), ze(o, r), he(e);
                    } else {
                        const e = new a(l.buffer, l.byteOffset, 0);
                        r._closeSteps(e);
                    }
                }(o._readableStreamController, t, r);
            }(this, e, {
                _chunkSteps: (e)=>t({
                        value: e,
                        done: !1
                    }),
                _closeSteps: (e)=>t({
                        value: e,
                        done: !0
                    }),
                _errorSteps: (e)=>r(e)
            }), o;
        }
        releaseLock() {
            if (!De(this)) throw $e("releaseLock");
            void 0 !== this._ownerReadableStream && function(e) {
                O(e);
                const t = new TypeError("Reader was released");
                Ie(e, t);
            }(this);
        }
    }
    function De(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_readIntoRequests") && e instanceof ReadableStreamBYOBReader;
    }
    function Ie(e, t) {
        const r = e._readIntoRequests;
        e._readIntoRequests = new v, r.forEach((e)=>{
            e._errorSteps(t);
        });
    }
    function $e(e) {
        return new TypeError(`ReadableStreamBYOBReader.prototype.${e} can only be used on a ReadableStreamBYOBReader`);
    }
    function Me(e, t) {
        const { highWaterMark: r } = e;
        if (void 0 === r) return t;
        if (ie(r) || r < 0) throw new RangeError("Invalid highWaterMark");
        return r;
    }
    function Ye(e) {
        const { size: t } = e;
        return t || (()=>1);
    }
    function Qe(e, t) {
        D(e, t);
        const r = null == e ? void 0 : e.highWaterMark, o = null == e ? void 0 : e.size;
        return {
            highWaterMark: void 0 === r ? void 0 : Q(r),
            size: void 0 === o ? void 0 : Ne(o, `${t} has member 'size' that`)
        };
    }
    function Ne(e, t) {
        return I(e, t), (t)=>Q(e(t));
    }
    function xe(e, t, r) {
        return I(e, r), (r)=>w(e, t, [
                r
            ]);
    }
    function He(e, t, r) {
        return I(e, r), ()=>w(e, t, []);
    }
    function Ve(e, t, r) {
        return I(e, r), (r)=>S(e, t, [
                r
            ]);
    }
    function Ue(e, t, r) {
        return I(e, r), (r, o)=>w(e, t, [
                r,
                o
            ]);
    }
    Object.defineProperties(ReadableStreamBYOBReader.prototype, {
        cancel: {
            enumerable: !0
        },
        read: {
            enumerable: !0
        },
        releaseLock: {
            enumerable: !0
        },
        closed: {
            enumerable: !0
        }
    }), a(ReadableStreamBYOBReader.prototype.cancel, "cancel"), a(ReadableStreamBYOBReader.prototype.read, "read"), a(ReadableStreamBYOBReader.prototype.releaseLock, "releaseLock"), "symbol" == typeof t.toStringTag && Object.defineProperty(ReadableStreamBYOBReader.prototype, t.toStringTag, {
        value: "ReadableStreamBYOBReader",
        configurable: !0
    });
    const Ge = "function" == typeof AbortController;
    class WritableStream {
        constructor(e = {}, t = {}){
            void 0 === e ? e = null : $(e, "First parameter");
            const r = Qe(t, "Second parameter"), o = function(e, t) {
                D(e, t);
                const r = null == e ? void 0 : e.abort, o = null == e ? void 0 : e.close, n = null == e ? void 0 : e.start, a = null == e ? void 0 : e.type, i = null == e ? void 0 : e.write;
                return {
                    abort: void 0 === r ? void 0 : xe(r, e, `${t} has member 'abort' that`),
                    close: void 0 === o ? void 0 : He(o, e, `${t} has member 'close' that`),
                    start: void 0 === n ? void 0 : Ve(n, e, `${t} has member 'start' that`),
                    write: void 0 === i ? void 0 : Ue(i, e, `${t} has member 'write' that`),
                    type: a
                };
            }(e, "First parameter");
            var n;
            (n = this)._state = "writable", n._storedError = void 0, n._writer = void 0, n._writableStreamController = void 0, n._writeRequests = new v, n._inFlightWriteRequest = void 0, n._closeRequest = void 0, n._inFlightCloseRequest = void 0, n._pendingAbortRequest = void 0, n._backpressure = !1;
            if (void 0 !== o.type) throw new RangeError("Invalid type is specified");
            const a = Ye(r);
            !function(e, t, r, o) {
                const n = Object.create(WritableStreamDefaultController.prototype);
                let a, i, l, s;
                a = void 0 !== t.start ? ()=>t.start(n) : ()=>{};
                i = void 0 !== t.write ? (e)=>t.write(e, n) : ()=>d(void 0);
                l = void 0 !== t.close ? ()=>t.close() : ()=>d(void 0);
                s = void 0 !== t.abort ? (e)=>t.abort(e) : ()=>d(void 0);
                !function(e, t, r, o, n, a, i, l) {
                    t._controlledWritableStream = e, e._writableStreamController = t, t._queue = void 0, t._queueTotalSize = void 0, de(t), t._abortReason = void 0, t._abortController = function() {
                        if (Ge) return new AbortController;
                    }(), t._started = !1, t._strategySizeAlgorithm = l, t._strategyHWM = i, t._writeAlgorithm = o, t._closeAlgorithm = n, t._abortAlgorithm = a;
                    const s = ht(t);
                    at(e, s);
                    const u = r();
                    h(d(u), ()=>(t._started = !0, ft(t), null), (r)=>(t._started = !0, et(e, r), null));
                }(e, n, a, i, l, s, r, o);
            }(this, o, Me(r, 1), a);
        }
        get locked() {
            if (!Xe(this)) throw pt("locked");
            return Je(this);
        }
        abort(e) {
            return Xe(this) ? Je(this) ? f(new TypeError("Cannot abort a stream that already has a writer")) : Ke(this, e) : f(pt("abort"));
        }
        close() {
            return Xe(this) ? Je(this) ? f(new TypeError("Cannot close a stream that already has a writer")) : ot(this) ? f(new TypeError("Cannot close an already-closing stream")) : Ze(this) : f(pt("close"));
        }
        getWriter() {
            if (!Xe(this)) throw pt("getWriter");
            return new WritableStreamDefaultWriter(this);
        }
    }
    function Xe(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_writableStreamController") && e instanceof WritableStream;
    }
    function Je(e) {
        return void 0 !== e._writer;
    }
    function Ke(e, t) {
        var r;
        if ("closed" === e._state || "errored" === e._state) return d(void 0);
        e._writableStreamController._abortReason = t, null === (r = e._writableStreamController._abortController) || void 0 === r || r.abort(t);
        const o = e._state;
        if ("closed" === o || "errored" === o) return d(void 0);
        if (void 0 !== e._pendingAbortRequest) return e._pendingAbortRequest._promise;
        let n = !1;
        "erroring" === o && (n = !0, t = void 0);
        const a = c((r, o)=>{
            e._pendingAbortRequest = {
                _promise: void 0,
                _resolve: r,
                _reject: o,
                _reason: t,
                _wasAlreadyErroring: n
            };
        });
        return e._pendingAbortRequest._promise = a, n || tt(e, t), a;
    }
    function Ze(e) {
        const t = e._state;
        if ("closed" === t || "errored" === t) return f(new TypeError(`The stream (in ${t} state) is not in the writable state and cannot be closed`));
        const r = c((t, r)=>{
            const o = {
                _resolve: t,
                _reject: r
            };
            e._closeRequest = o;
        }), o = e._writer;
        var n;
        return void 0 !== o && e._backpressure && "writable" === t && Et(o), ce(n = e._writableStreamController, st, 0), ft(n), r;
    }
    function et(e, t) {
        "writable" !== e._state ? rt(e) : tt(e, t);
    }
    function tt(e, t) {
        const r = e._writableStreamController;
        e._state = "erroring", e._storedError = t;
        const o = e._writer;
        void 0 !== o && lt(o, t), !function(e) {
            if (void 0 === e._inFlightWriteRequest && void 0 === e._inFlightCloseRequest) return !1;
            return !0;
        }(e) && r._started && rt(e);
    }
    function rt(e) {
        e._state = "errored", e._writableStreamController[T]();
        const t = e._storedError;
        if (e._writeRequests.forEach((e)=>{
            e._reject(t);
        }), e._writeRequests = new v, void 0 === e._pendingAbortRequest) return void nt(e);
        const r = e._pendingAbortRequest;
        if (e._pendingAbortRequest = void 0, r._wasAlreadyErroring) return r._reject(t), void nt(e);
        h(e._writableStreamController[R](r._reason), ()=>(r._resolve(), nt(e), null), (t)=>(r._reject(t), nt(e), null));
    }
    function ot(e) {
        return void 0 !== e._closeRequest || void 0 !== e._inFlightCloseRequest;
    }
    function nt(e) {
        void 0 !== e._closeRequest && (e._closeRequest._reject(e._storedError), e._closeRequest = void 0);
        const t = e._writer;
        void 0 !== t && vt(t, e._storedError);
    }
    function at(e, t) {
        const r = e._writer;
        void 0 !== r && t !== e._backpressure && (t ? function(e) {
            Tt(e);
        }(r) : Et(r)), e._backpressure = t;
    }
    Object.defineProperties(WritableStream.prototype, {
        abort: {
            enumerable: !0
        },
        close: {
            enumerable: !0
        },
        getWriter: {
            enumerable: !0
        },
        locked: {
            enumerable: !0
        }
    }), a(WritableStream.prototype.abort, "abort"), a(WritableStream.prototype.close, "close"), a(WritableStream.prototype.getWriter, "getWriter"), "symbol" == typeof t.toStringTag && Object.defineProperty(WritableStream.prototype, t.toStringTag, {
        value: "WritableStream",
        configurable: !0
    });
    class WritableStreamDefaultWriter {
        constructor(e){
            if (M(e, 1, "WritableStreamDefaultWriter"), function(e, t) {
                if (!Xe(e)) throw new TypeError(`${t} is not a WritableStream.`);
            }(e, "First parameter"), Je(e)) throw new TypeError("This stream has already been locked for exclusive writing by another writer");
            this._ownerWritableStream = e, e._writer = this;
            const t = e._state;
            if ("writable" === t) !ot(e) && e._backpressure ? Tt(this) : Ct(this), St(this);
            else if ("erroring" === t) qt(this, e._storedError), St(this);
            else if ("closed" === t) Ct(this), St(r = this), Rt(r);
            else {
                const t = e._storedError;
                qt(this, t), wt(this, t);
            }
            var r;
        }
        get closed() {
            return it(this) ? this._closedPromise : f(yt("closed"));
        }
        get desiredSize() {
            if (!it(this)) throw yt("desiredSize");
            if (void 0 === this._ownerWritableStream) throw gt("desiredSize");
            return function(e) {
                const t = e._ownerWritableStream, r = t._state;
                if ("errored" === r || "erroring" === r) return null;
                if ("closed" === r) return 0;
                return dt(t._writableStreamController);
            }(this);
        }
        get ready() {
            return it(this) ? this._readyPromise : f(yt("ready"));
        }
        abort(e) {
            return it(this) ? void 0 === this._ownerWritableStream ? f(gt("abort")) : function(e, t) {
                return Ke(e._ownerWritableStream, t);
            }(this, e) : f(yt("abort"));
        }
        close() {
            if (!it(this)) return f(yt("close"));
            const e = this._ownerWritableStream;
            return void 0 === e ? f(gt("close")) : ot(e) ? f(new TypeError("Cannot close an already-closing stream")) : Ze(this._ownerWritableStream);
        }
        releaseLock() {
            if (!it(this)) throw yt("releaseLock");
            void 0 !== this._ownerWritableStream && function(e) {
                const t = e._ownerWritableStream, r = new TypeError("Writer was released and can no longer be used to monitor the stream's closedness");
                lt(e, r), function(e, t) {
                    "pending" === e._closedPromiseState ? vt(e, t) : function(e, t) {
                        wt(e, t);
                    }(e, t);
                }(e, r), t._writer = void 0, e._ownerWritableStream = void 0;
            }(this);
        }
        write(e) {
            return it(this) ? void 0 === this._ownerWritableStream ? f(gt("write to")) : function(e, t) {
                const r = e._ownerWritableStream, o = r._writableStreamController, n = function(e, t) {
                    try {
                        return e._strategySizeAlgorithm(t);
                    } catch (t) {
                        return bt(e, t), 1;
                    }
                }(o, t);
                if (r !== e._ownerWritableStream) return f(gt("write to"));
                const a = r._state;
                if ("errored" === a) return f(r._storedError);
                if (ot(r) || "closed" === a) return f(new TypeError("The stream is closing or closed and cannot be written to"));
                if ("erroring" === a) return f(r._storedError);
                const i = function(e) {
                    return c((t, r)=>{
                        const o = {
                            _resolve: t,
                            _reject: r
                        };
                        e._writeRequests.push(o);
                    });
                }(r);
                return function(e, t, r) {
                    try {
                        ce(e, t, r);
                    } catch (t) {
                        return void bt(e, t);
                    }
                    const o = e._controlledWritableStream;
                    if (!ot(o) && "writable" === o._state) {
                        at(o, ht(e));
                    }
                    ft(e);
                }(o, t, n), i;
            }(this, e) : f(yt("write"));
        }
    }
    function it(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_ownerWritableStream") && e instanceof WritableStreamDefaultWriter;
    }
    function lt(e, t) {
        "pending" === e._readyPromiseState ? Pt(e, t) : function(e, t) {
            qt(e, t);
        }(e, t);
    }
    Object.defineProperties(WritableStreamDefaultWriter.prototype, {
        abort: {
            enumerable: !0
        },
        close: {
            enumerable: !0
        },
        releaseLock: {
            enumerable: !0
        },
        write: {
            enumerable: !0
        },
        closed: {
            enumerable: !0
        },
        desiredSize: {
            enumerable: !0
        },
        ready: {
            enumerable: !0
        }
    }), a(WritableStreamDefaultWriter.prototype.abort, "abort"), a(WritableStreamDefaultWriter.prototype.close, "close"), a(WritableStreamDefaultWriter.prototype.releaseLock, "releaseLock"), a(WritableStreamDefaultWriter.prototype.write, "write"), "symbol" == typeof t.toStringTag && Object.defineProperty(WritableStreamDefaultWriter.prototype, t.toStringTag, {
        value: "WritableStreamDefaultWriter",
        configurable: !0
    });
    const st = {};
    class WritableStreamDefaultController {
        constructor(){
            throw new TypeError("Illegal constructor");
        }
        get abortReason() {
            if (!ut(this)) throw mt("abortReason");
            return this._abortReason;
        }
        get signal() {
            if (!ut(this)) throw mt("signal");
            if (void 0 === this._abortController) throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");
            return this._abortController.signal;
        }
        error(e) {
            if (!ut(this)) throw mt("error");
            "writable" === this._controlledWritableStream._state && _t(this, e);
        }
        [R](e) {
            const t = this._abortAlgorithm(e);
            return ct(this), t;
        }
        [T]() {
            de(this);
        }
    }
    function ut(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_controlledWritableStream") && e instanceof WritableStreamDefaultController;
    }
    function ct(e) {
        e._writeAlgorithm = void 0, e._closeAlgorithm = void 0, e._abortAlgorithm = void 0, e._strategySizeAlgorithm = void 0;
    }
    function dt(e) {
        return e._strategyHWM - e._queueTotalSize;
    }
    function ft(e) {
        const t = e._controlledWritableStream;
        if (!e._started) return;
        if (void 0 !== t._inFlightWriteRequest) return;
        if ("erroring" === t._state) return void rt(t);
        if (0 === e._queue.length) return;
        const r = e._queue.peek().value;
        r === st ? function(e) {
            const t = e._controlledWritableStream;
            (function(e) {
                e._inFlightCloseRequest = e._closeRequest, e._closeRequest = void 0;
            })(t), ue(e);
            const r = e._closeAlgorithm();
            ct(e), h(r, ()=>((function(e) {
                    e._inFlightCloseRequest._resolve(void 0), e._inFlightCloseRequest = void 0, "erroring" === e._state && (e._storedError = void 0, void 0 !== e._pendingAbortRequest && (e._pendingAbortRequest._resolve(), e._pendingAbortRequest = void 0)), e._state = "closed";
                    const t = e._writer;
                    void 0 !== t && Rt(t);
                })(t), null), (e)=>((function(e, t) {
                    e._inFlightCloseRequest._reject(t), e._inFlightCloseRequest = void 0, void 0 !== e._pendingAbortRequest && (e._pendingAbortRequest._reject(t), e._pendingAbortRequest = void 0), et(e, t);
                })(t, e), null));
        }(e) : function(e, t) {
            const r = e._controlledWritableStream;
            !function(e) {
                e._inFlightWriteRequest = e._writeRequests.shift();
            }(r);
            h(e._writeAlgorithm(t), ()=>{
                !function(e) {
                    e._inFlightWriteRequest._resolve(void 0), e._inFlightWriteRequest = void 0;
                }(r);
                const t = r._state;
                if (ue(e), !ot(r) && "writable" === t) {
                    const t = ht(e);
                    at(r, t);
                }
                return ft(e), null;
            }, (t)=>("writable" === r._state && ct(e), function(e, t) {
                    e._inFlightWriteRequest._reject(t), e._inFlightWriteRequest = void 0, et(e, t);
                }(r, t), null));
        }(e, r);
    }
    function bt(e, t) {
        "writable" === e._controlledWritableStream._state && _t(e, t);
    }
    function ht(e) {
        return dt(e) <= 0;
    }
    function _t(e, t) {
        const r = e._controlledWritableStream;
        ct(e), tt(r, t);
    }
    function pt(e) {
        return new TypeError(`WritableStream.prototype.${e} can only be used on a WritableStream`);
    }
    function mt(e) {
        return new TypeError(`WritableStreamDefaultController.prototype.${e} can only be used on a WritableStreamDefaultController`);
    }
    function yt(e) {
        return new TypeError(`WritableStreamDefaultWriter.prototype.${e} can only be used on a WritableStreamDefaultWriter`);
    }
    function gt(e) {
        return new TypeError("Cannot " + e + " a stream using a released writer");
    }
    function St(e) {
        e._closedPromise = c((t, r)=>{
            e._closedPromise_resolve = t, e._closedPromise_reject = r, e._closedPromiseState = "pending";
        });
    }
    function wt(e, t) {
        St(e), vt(e, t);
    }
    function vt(e, t) {
        void 0 !== e._closedPromise_reject && (y(e._closedPromise), e._closedPromise_reject(t), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0, e._closedPromiseState = "rejected");
    }
    function Rt(e) {
        void 0 !== e._closedPromise_resolve && (e._closedPromise_resolve(void 0), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0, e._closedPromiseState = "resolved");
    }
    function Tt(e) {
        e._readyPromise = c((t, r)=>{
            e._readyPromise_resolve = t, e._readyPromise_reject = r;
        }), e._readyPromiseState = "pending";
    }
    function qt(e, t) {
        Tt(e), Pt(e, t);
    }
    function Ct(e) {
        Tt(e), Et(e);
    }
    function Pt(e, t) {
        void 0 !== e._readyPromise_reject && (y(e._readyPromise), e._readyPromise_reject(t), e._readyPromise_resolve = void 0, e._readyPromise_reject = void 0, e._readyPromiseState = "rejected");
    }
    function Et(e) {
        void 0 !== e._readyPromise_resolve && (e._readyPromise_resolve(void 0), e._readyPromise_resolve = void 0, e._readyPromise_reject = void 0, e._readyPromiseState = "fulfilled");
    }
    Object.defineProperties(WritableStreamDefaultController.prototype, {
        abortReason: {
            enumerable: !0
        },
        signal: {
            enumerable: !0
        },
        error: {
            enumerable: !0
        }
    }), "symbol" == typeof t.toStringTag && Object.defineProperty(WritableStreamDefaultController.prototype, t.toStringTag, {
        value: "WritableStreamDefaultController",
        configurable: !0
    });
    const Wt = "undefined" != typeof DOMException ? DOMException : void 0;
    const Ot = function(e) {
        if ("function" != typeof e && "object" != typeof e) return !1;
        try {
            return new e, !0;
        } catch (e) {
            return !1;
        }
    }(Wt) ? Wt : function() {
        const e = function(e, t) {
            this.message = e || "", this.name = t || "Error", Error.captureStackTrace && Error.captureStackTrace(this, this.constructor);
        };
        return e.prototype = Object.create(Error.prototype), Object.defineProperty(e.prototype, "constructor", {
            value: e,
            writable: !0,
            configurable: !0
        }), e;
    }();
    function kt(e, t, r, o, n, a) {
        const i = e.getReader(), l = t.getWriter();
        Ut(e) && (e._disturbed = !0);
        let s, u, p, S = !1, w = !1, v = "readable", R = "writable", T = !1, q = !1;
        const C = c((e)=>{
            p = e;
        });
        let P = Promise.resolve(void 0);
        return c((E, W)=>{
            let O;
            function k() {
                if (S) return;
                const e = c((e, t)=>{
                    !function r(o) {
                        ("TURBOPACK compile-time falsy", 0) ? ("TURBOPACK unreachable", undefined) : b(function() {
                            if (S) return d(!0);
                            return b(l.ready, ()=>b(i.read(), (e)=>!!e.done || (P = l.write(e.value), y(P), !1)));
                        }(), r, t);
                    }(!1);
                });
                y(e);
            }
            function B() {
                return v = "closed", r ? L() : z(()=>(Xe(t) && (T = ot(t), R = t._state), T || "closed" === R ? d(void 0) : "erroring" === R || "errored" === R ? f(u) : (T = !0, l.close())), !1, void 0), null;
            }
            function A(e) {
                return S || (v = "errored", s = e, o ? L(!0, e) : z(()=>l.abort(e), !0, e)), null;
            }
            function j(e) {
                return w || (R = "errored", u = e, n ? L(!0, e) : z(()=>i.cancel(e), !0, e)), null;
            }
            if (void 0 !== a && (O = ()=>{
                const e = void 0 !== a.reason ? a.reason : new Ot("Aborted", "AbortError"), t = [];
                o || t.push(()=>"writable" === R ? l.abort(e) : d(void 0)), n || t.push(()=>"readable" === v ? i.cancel(e) : d(void 0)), z(()=>Promise.all(t.map((e)=>e())), !0, e);
            }, a.aborted ? O() : a.addEventListener("abort", O)), Ut(e) && (v = e._state, s = e._storedError), Xe(t) && (R = t._state, u = t._storedError, T = ot(t)), Ut(e) && Xe(t) && (q = !0, p()), "errored" === v) A(s);
            else if ("erroring" === R || "errored" === R) j(u);
            else if ("closed" === v) B();
            else if (T || "closed" === R) {
                const e = new TypeError("the destination writable stream closed before all data could be piped to it");
                n ? L(!0, e) : z(()=>i.cancel(e), !0, e);
            }
            function z(e, t, r) {
                function o() {
                    return "writable" !== R || T ? n() : _(function() {
                        let e;
                        return d(function t() {
                            if (e !== P) return e = P, m(P, t, t);
                        }());
                    }(), n), null;
                }
                function n() {
                    return e ? h(e(), ()=>F(t, r), (e)=>F(!0, e)) : F(t, r), null;
                }
                S || (S = !0, q ? o() : _(C, o));
            }
            function L(e, t) {
                z(void 0, e, t);
            }
            function F(e, t) {
                return w = !0, l.releaseLock(), i.releaseLock(), void 0 !== a && a.removeEventListener("abort", O), e ? W(t) : E(void 0), null;
            }
            S || (h(i.closed, B, A), h(l.closed, function() {
                return w || (R = "closed"), null;
            }, j)), q ? k() : g(()=>{
                q = !0, p(), k();
            });
        });
    }
    function Bt(e, t) {
        return function(e) {
            try {
                return e.getReader({
                    mode: "byob"
                }).releaseLock(), !0;
            } catch (e) {
                return !1;
            }
        }(e) ? function(e) {
            let t, r, o, n, a, i = e.getReader(), l = !1, s = !1, u = !1, f = !1, b = !1, _ = !1;
            const m = c((e)=>{
                a = e;
            });
            function y(e) {
                p(e.closed, (t)=>(e !== i || (o.error(t), n.error(t), b && _ || a(void 0)), null));
            }
            function g() {
                l && (i.releaseLock(), i = e.getReader(), y(i), l = !1), h(i.read(), (e)=>{
                    var t, r;
                    if (u = !1, f = !1, e.done) return b || o.close(), _ || n.close(), null === (t = o.byobRequest) || void 0 === t || t.respond(0), null === (r = n.byobRequest) || void 0 === r || r.respond(0), b && _ || a(void 0), null;
                    const l = e.value, c = l;
                    let d = l;
                    if (!b && !_) try {
                        d = se(l);
                    } catch (e) {
                        return o.error(e), n.error(e), a(i.cancel(e)), null;
                    }
                    return b || o.enqueue(c), _ || n.enqueue(d), s = !1, u ? w() : f && v(), null;
                }, ()=>(s = !1, null));
            }
            function S(t, r) {
                l || (i.releaseLock(), i = e.getReader({
                    mode: "byob"
                }), y(i), l = !0);
                const c = r ? n : o, d = r ? o : n;
                h(i.read(t), (e)=>{
                    var t;
                    u = !1, f = !1;
                    const o = r ? _ : b, n = r ? b : _;
                    if (e.done) {
                        o || c.close(), n || d.close();
                        const r = e.value;
                        return void 0 !== r && (o || c.byobRequest.respondWithNewView(r), n || null === (t = d.byobRequest) || void 0 === t || t.respond(0)), o && n || a(void 0), null;
                    }
                    const l = e.value;
                    if (n) o || c.byobRequest.respondWithNewView(l);
                    else {
                        let e;
                        try {
                            e = se(l);
                        } catch (e) {
                            return c.error(e), d.error(e), a(i.cancel(e)), null;
                        }
                        o || c.byobRequest.respondWithNewView(l), d.enqueue(e);
                    }
                    return s = !1, u ? w() : f && v(), null;
                }, ()=>(s = !1, null));
            }
            function w() {
                if (s) return u = !0, d(void 0);
                s = !0;
                const e = o.byobRequest;
                return null === e ? g() : S(e.view, !1), d(void 0);
            }
            function v() {
                if (s) return f = !0, d(void 0);
                s = !0;
                const e = n.byobRequest;
                return null === e ? g() : S(e.view, !0), d(void 0);
            }
            function R(e) {
                if (b = !0, t = e, _) {
                    const e = [
                        t,
                        r
                    ], o = i.cancel(e);
                    a(o);
                }
                return m;
            }
            function T(e) {
                if (_ = !0, r = e, b) {
                    const e = [
                        t,
                        r
                    ], o = i.cancel(e);
                    a(o);
                }
                return m;
            }
            const q = new ReadableStream({
                type: "bytes",
                start (e) {
                    o = e;
                },
                pull: w,
                cancel: R
            }), C = new ReadableStream({
                type: "bytes",
                start (e) {
                    n = e;
                },
                pull: v,
                cancel: T
            });
            return y(i), [
                q,
                C
            ];
        }(e) : function(e, t) {
            const r = e.getReader();
            let o, n, a, i, l, s = !1, u = !1, f = !1, b = !1;
            const _ = c((e)=>{
                l = e;
            });
            function m() {
                return s ? (u = !0, d(void 0)) : (s = !0, h(r.read(), (e)=>{
                    if (u = !1, e.done) return f || a.close(), b || i.close(), f && b || l(void 0), null;
                    const t = e.value, r = t, o = t;
                    return f || a.enqueue(r), b || i.enqueue(o), s = !1, u && m(), null;
                }, ()=>(s = !1, null)), d(void 0));
            }
            function y(e) {
                if (f = !0, o = e, b) {
                    const e = [
                        o,
                        n
                    ], t = r.cancel(e);
                    l(t);
                }
                return _;
            }
            function g(e) {
                if (b = !0, n = e, f) {
                    const e = [
                        o,
                        n
                    ], t = r.cancel(e);
                    l(t);
                }
                return _;
            }
            const S = new ReadableStream({
                start (e) {
                    a = e;
                },
                pull: m,
                cancel: y
            }), w = new ReadableStream({
                start (e) {
                    i = e;
                },
                pull: m,
                cancel: g
            });
            return p(r.closed, (e)=>(a.error(e), i.error(e), f && b || l(void 0), null)), [
                S,
                w
            ];
        }(e);
    }
    class ReadableStreamDefaultController {
        constructor(){
            throw new TypeError("Illegal constructor");
        }
        get desiredSize() {
            if (!At(this)) throw $t("desiredSize");
            return Ft(this);
        }
        close() {
            if (!At(this)) throw $t("close");
            if (!Dt(this)) throw new TypeError("The stream is not in a state that permits close");
            !function(e) {
                if (!Dt(e)) return;
                const t = e._controlledReadableStream;
                e._closeRequested = !0, 0 === e._queue.length && (zt(e), Jt(t));
            }(this);
        }
        enqueue(e) {
            if (!At(this)) throw $t("enqueue");
            if (!Dt(this)) throw new TypeError("The stream is not in a state that permits enqueue");
            return function(e, t) {
                if (!Dt(e)) return;
                const r = e._controlledReadableStream;
                if (Gt(r) && J(r) > 0) X(r, t, !1);
                else {
                    let r;
                    try {
                        r = e._strategySizeAlgorithm(t);
                    } catch (t) {
                        throw Lt(e, t), t;
                    }
                    try {
                        ce(e, t, r);
                    } catch (t) {
                        throw Lt(e, t), t;
                    }
                }
                jt(e);
            }(this, e);
        }
        error(e) {
            if (!At(this)) throw $t("error");
            Lt(this, e);
        }
        [q](e) {
            de(this);
            const t = this._cancelAlgorithm(e);
            return zt(this), t;
        }
        [C](e) {
            const t = this._controlledReadableStream;
            if (this._queue.length > 0) {
                const r = ue(this);
                this._closeRequested && 0 === this._queue.length ? (zt(this), Jt(t)) : jt(this), e._chunkSteps(r);
            } else G(t, e), jt(this);
        }
        [P]() {}
    }
    function At(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_controlledReadableStream") && e instanceof ReadableStreamDefaultController;
    }
    function jt(e) {
        const t = function(e) {
            const t = e._controlledReadableStream;
            if (!Dt(e)) return !1;
            if (!e._started) return !1;
            if (Gt(t) && J(t) > 0) return !0;
            if (Ft(e) > 0) return !0;
            return !1;
        }(e);
        if (!t) return;
        if (e._pulling) return void (e._pullAgain = !0);
        e._pulling = !0;
        h(e._pullAlgorithm(), ()=>(e._pulling = !1, e._pullAgain && (e._pullAgain = !1, jt(e)), null), (t)=>(Lt(e, t), null));
    }
    function zt(e) {
        e._pullAlgorithm = void 0, e._cancelAlgorithm = void 0, e._strategySizeAlgorithm = void 0;
    }
    function Lt(e, t) {
        const r = e._controlledReadableStream;
        "readable" === r._state && (de(e), zt(e), Kt(r, t));
    }
    function Ft(e) {
        const t = e._controlledReadableStream._state;
        return "errored" === t ? null : "closed" === t ? 0 : e._strategyHWM - e._queueTotalSize;
    }
    function Dt(e) {
        return !e._closeRequested && "readable" === e._controlledReadableStream._state;
    }
    function It(e, t, r, o) {
        const n = Object.create(ReadableStreamDefaultController.prototype);
        let a, i, l;
        a = void 0 !== t.start ? ()=>t.start(n) : ()=>{}, i = void 0 !== t.pull ? ()=>t.pull(n) : ()=>d(void 0), l = void 0 !== t.cancel ? (e)=>t.cancel(e) : ()=>d(void 0), function(e, t, r, o, n, a, i) {
            t._controlledReadableStream = e, t._queue = void 0, t._queueTotalSize = void 0, de(t), t._started = !1, t._closeRequested = !1, t._pullAgain = !1, t._pulling = !1, t._strategySizeAlgorithm = i, t._strategyHWM = a, t._pullAlgorithm = o, t._cancelAlgorithm = n, e._readableStreamController = t, h(d(r()), ()=>(t._started = !0, jt(t), null), (e)=>(Lt(t, e), null));
        }(e, n, a, i, l, r, o);
    }
    function $t(e) {
        return new TypeError(`ReadableStreamDefaultController.prototype.${e} can only be used on a ReadableStreamDefaultController`);
    }
    function Mt(e, t, r) {
        return I(e, r), (r)=>w(e, t, [
                r
            ]);
    }
    function Yt(e, t, r) {
        return I(e, r), (r)=>w(e, t, [
                r
            ]);
    }
    function Qt(e, t, r) {
        return I(e, r), (r)=>S(e, t, [
                r
            ]);
    }
    function Nt(e, t) {
        if ("bytes" !== (e = `${e}`)) throw new TypeError(`${t} '${e}' is not a valid enumeration value for ReadableStreamType`);
        return e;
    }
    function xt(e, t) {
        if ("byob" !== (e = `${e}`)) throw new TypeError(`${t} '${e}' is not a valid enumeration value for ReadableStreamReaderMode`);
        return e;
    }
    function Ht(e, t) {
        D(e, t);
        const r = null == e ? void 0 : e.preventAbort, o = null == e ? void 0 : e.preventCancel, n = null == e ? void 0 : e.preventClose, a = null == e ? void 0 : e.signal;
        return void 0 !== a && function(e, t) {
            if (!function(e) {
                if ("object" != typeof e || null === e) return !1;
                try {
                    return "boolean" == typeof e.aborted;
                } catch (e) {
                    return !1;
                }
            }(e)) throw new TypeError(`${t} is not an AbortSignal.`);
        }(a, `${t} has member 'signal' that`), {
            preventAbort: Boolean(r),
            preventCancel: Boolean(o),
            preventClose: Boolean(n),
            signal: a
        };
    }
    function Vt(e, t) {
        D(e, t);
        const r = null == e ? void 0 : e.readable;
        Y(r, "readable", "ReadableWritablePair"), function(e, t) {
            if (!H(e)) throw new TypeError(`${t} is not a ReadableStream.`);
        }(r, `${t} has member 'readable' that`);
        const o = null == e ? void 0 : e.writable;
        return Y(o, "writable", "ReadableWritablePair"), function(e, t) {
            if (!V(e)) throw new TypeError(`${t} is not a WritableStream.`);
        }(o, `${t} has member 'writable' that`), {
            readable: r,
            writable: o
        };
    }
    Object.defineProperties(ReadableStreamDefaultController.prototype, {
        close: {
            enumerable: !0
        },
        enqueue: {
            enumerable: !0
        },
        error: {
            enumerable: !0
        },
        desiredSize: {
            enumerable: !0
        }
    }), a(ReadableStreamDefaultController.prototype.close, "close"), a(ReadableStreamDefaultController.prototype.enqueue, "enqueue"), a(ReadableStreamDefaultController.prototype.error, "error"), "symbol" == typeof t.toStringTag && Object.defineProperty(ReadableStreamDefaultController.prototype, t.toStringTag, {
        value: "ReadableStreamDefaultController",
        configurable: !0
    });
    class ReadableStream {
        constructor(e = {}, t = {}){
            void 0 === e ? e = null : $(e, "First parameter");
            const r = Qe(t, "Second parameter"), o = function(e, t) {
                D(e, t);
                const r = e, o = null == r ? void 0 : r.autoAllocateChunkSize, n = null == r ? void 0 : r.cancel, a = null == r ? void 0 : r.pull, i = null == r ? void 0 : r.start, l = null == r ? void 0 : r.type;
                return {
                    autoAllocateChunkSize: void 0 === o ? void 0 : x(o, `${t} has member 'autoAllocateChunkSize' that`),
                    cancel: void 0 === n ? void 0 : Mt(n, r, `${t} has member 'cancel' that`),
                    pull: void 0 === a ? void 0 : Yt(a, r, `${t} has member 'pull' that`),
                    start: void 0 === i ? void 0 : Qt(i, r, `${t} has member 'start' that`),
                    type: void 0 === l ? void 0 : Nt(l, `${t} has member 'type' that`)
                };
            }(e, "First parameter");
            var n;
            if ((n = this)._state = "readable", n._reader = void 0, n._storedError = void 0, n._disturbed = !1, "bytes" === o.type) {
                if (void 0 !== r.size) throw new RangeError("The strategy for a byte stream cannot have a size function");
                Be(this, o, Me(r, 0));
            } else {
                const e = Ye(r);
                It(this, o, Me(r, 1), e);
            }
        }
        get locked() {
            if (!Ut(this)) throw Zt("locked");
            return Gt(this);
        }
        cancel(e) {
            return Ut(this) ? Gt(this) ? f(new TypeError("Cannot cancel a stream that already has a reader")) : Xt(this, e) : f(Zt("cancel"));
        }
        getReader(e) {
            if (!Ut(this)) throw Zt("getReader");
            return void 0 === function(e, t) {
                D(e, t);
                const r = null == e ? void 0 : e.mode;
                return {
                    mode: void 0 === r ? void 0 : xt(r, `${t} has member 'mode' that`)
                };
            }(e, "First parameter").mode ? new ReadableStreamDefaultReader(this) : function(e) {
                return new ReadableStreamBYOBReader(e);
            }(this);
        }
        pipeThrough(e, t = {}) {
            if (!H(this)) throw Zt("pipeThrough");
            M(e, 1, "pipeThrough");
            const r = Vt(e, "First parameter"), o = Ht(t, "Second parameter");
            if (this.locked) throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");
            if (r.writable.locked) throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");
            return y(kt(this, r.writable, o.preventClose, o.preventAbort, o.preventCancel, o.signal)), r.readable;
        }
        pipeTo(e, t = {}) {
            if (!H(this)) return f(Zt("pipeTo"));
            if (void 0 === e) return f("Parameter 1 is required in 'pipeTo'.");
            if (!V(e)) return f(new TypeError("ReadableStream.prototype.pipeTo's first argument must be a WritableStream"));
            let r;
            try {
                r = Ht(t, "Second parameter");
            } catch (e) {
                return f(e);
            }
            return this.locked ? f(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream")) : e.locked ? f(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream")) : kt(this, e, r.preventClose, r.preventAbort, r.preventCancel, r.signal);
        }
        tee() {
            if (!H(this)) throw Zt("tee");
            if (this.locked) throw new TypeError("Cannot tee a stream that already has a reader");
            return Bt(this);
        }
        values(e) {
            if (!H(this)) throw Zt("values");
            return function(e, t) {
                const r = e.getReader(), o = new re(r, t), n = Object.create(oe);
                return n._asyncIteratorImpl = o, n;
            }(this, function(e, t) {
                D(e, t);
                const r = null == e ? void 0 : e.preventCancel;
                return {
                    preventCancel: Boolean(r)
                };
            }(e, "First parameter").preventCancel);
        }
    }
    function Ut(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_readableStreamController") && e instanceof ReadableStream;
    }
    function Gt(e) {
        return void 0 !== e._reader;
    }
    function Xt(e, t) {
        if (e._disturbed = !0, "closed" === e._state) return d(void 0);
        if ("errored" === e._state) return f(e._storedError);
        Jt(e);
        const o = e._reader;
        if (void 0 !== o && De(o)) {
            const e = o._readIntoRequests;
            o._readIntoRequests = new v, e.forEach((e)=>{
                e._closeSteps(void 0);
            });
        }
        return m(e._readableStreamController[q](t), r);
    }
    function Jt(e) {
        e._state = "closed";
        const t = e._reader;
        if (void 0 !== t && (z(t), Z(t))) {
            const e = t._readRequests;
            t._readRequests = new v, e.forEach((e)=>{
                e._closeSteps();
            });
        }
    }
    function Kt(e, t) {
        e._state = "errored", e._storedError = t;
        const r = e._reader;
        void 0 !== r && (j(r, t), Z(r) ? ee(r, t) : Ie(r, t));
    }
    function Zt(e) {
        return new TypeError(`ReadableStream.prototype.${e} can only be used on a ReadableStream`);
    }
    function er(e, t) {
        D(e, t);
        const r = null == e ? void 0 : e.highWaterMark;
        return Y(r, "highWaterMark", "QueuingStrategyInit"), {
            highWaterMark: Q(r)
        };
    }
    Object.defineProperties(ReadableStream.prototype, {
        cancel: {
            enumerable: !0
        },
        getReader: {
            enumerable: !0
        },
        pipeThrough: {
            enumerable: !0
        },
        pipeTo: {
            enumerable: !0
        },
        tee: {
            enumerable: !0
        },
        values: {
            enumerable: !0
        },
        locked: {
            enumerable: !0
        }
    }), a(ReadableStream.prototype.cancel, "cancel"), a(ReadableStream.prototype.getReader, "getReader"), a(ReadableStream.prototype.pipeThrough, "pipeThrough"), a(ReadableStream.prototype.pipeTo, "pipeTo"), a(ReadableStream.prototype.tee, "tee"), a(ReadableStream.prototype.values, "values"), "symbol" == typeof t.toStringTag && Object.defineProperty(ReadableStream.prototype, t.toStringTag, {
        value: "ReadableStream",
        configurable: !0
    }), "symbol" == typeof t.asyncIterator && Object.defineProperty(ReadableStream.prototype, t.asyncIterator, {
        value: ReadableStream.prototype.values,
        writable: !0,
        configurable: !0
    });
    const tr = (e)=>e.byteLength;
    a(tr, "size");
    class ByteLengthQueuingStrategy {
        constructor(e){
            M(e, 1, "ByteLengthQueuingStrategy"), e = er(e, "First parameter"), this._byteLengthQueuingStrategyHighWaterMark = e.highWaterMark;
        }
        get highWaterMark() {
            if (!or(this)) throw rr("highWaterMark");
            return this._byteLengthQueuingStrategyHighWaterMark;
        }
        get size() {
            if (!or(this)) throw rr("size");
            return tr;
        }
    }
    function rr(e) {
        return new TypeError(`ByteLengthQueuingStrategy.prototype.${e} can only be used on a ByteLengthQueuingStrategy`);
    }
    function or(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_byteLengthQueuingStrategyHighWaterMark") && e instanceof ByteLengthQueuingStrategy;
    }
    Object.defineProperties(ByteLengthQueuingStrategy.prototype, {
        highWaterMark: {
            enumerable: !0
        },
        size: {
            enumerable: !0
        }
    }), "symbol" == typeof t.toStringTag && Object.defineProperty(ByteLengthQueuingStrategy.prototype, t.toStringTag, {
        value: "ByteLengthQueuingStrategy",
        configurable: !0
    });
    const nr = ()=>1;
    a(nr, "size");
    class CountQueuingStrategy {
        constructor(e){
            M(e, 1, "CountQueuingStrategy"), e = er(e, "First parameter"), this._countQueuingStrategyHighWaterMark = e.highWaterMark;
        }
        get highWaterMark() {
            if (!ir(this)) throw ar("highWaterMark");
            return this._countQueuingStrategyHighWaterMark;
        }
        get size() {
            if (!ir(this)) throw ar("size");
            return nr;
        }
    }
    function ar(e) {
        return new TypeError(`CountQueuingStrategy.prototype.${e} can only be used on a CountQueuingStrategy`);
    }
    function ir(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_countQueuingStrategyHighWaterMark") && e instanceof CountQueuingStrategy;
    }
    function lr(e, t, r) {
        return I(e, r), (r)=>w(e, t, [
                r
            ]);
    }
    function sr(e, t, r) {
        return I(e, r), (r)=>S(e, t, [
                r
            ]);
    }
    function ur(e, t, r) {
        return I(e, r), (r, o)=>w(e, t, [
                r,
                o
            ]);
    }
    Object.defineProperties(CountQueuingStrategy.prototype, {
        highWaterMark: {
            enumerable: !0
        },
        size: {
            enumerable: !0
        }
    }), "symbol" == typeof t.toStringTag && Object.defineProperty(CountQueuingStrategy.prototype, t.toStringTag, {
        value: "CountQueuingStrategy",
        configurable: !0
    });
    class TransformStream {
        constructor(e = {}, t = {}, r = {}){
            void 0 === e && (e = null);
            const o = Qe(t, "Second parameter"), n = Qe(r, "Third parameter"), a = function(e, t) {
                D(e, t);
                const r = null == e ? void 0 : e.flush, o = null == e ? void 0 : e.readableType, n = null == e ? void 0 : e.start, a = null == e ? void 0 : e.transform, i = null == e ? void 0 : e.writableType;
                return {
                    flush: void 0 === r ? void 0 : lr(r, e, `${t} has member 'flush' that`),
                    readableType: o,
                    start: void 0 === n ? void 0 : sr(n, e, `${t} has member 'start' that`),
                    transform: void 0 === a ? void 0 : ur(a, e, `${t} has member 'transform' that`),
                    writableType: i
                };
            }(e, "First parameter");
            if (void 0 !== a.readableType) throw new RangeError("Invalid readableType specified");
            if (void 0 !== a.writableType) throw new RangeError("Invalid writableType specified");
            const i = Me(n, 0), l = Ye(n), s = Me(o, 1), u = Ye(o);
            let b;
            !function(e, t, r, o, n, a) {
                function i() {
                    return t;
                }
                function l(t) {
                    return function(e, t) {
                        const r = e._transformStreamController;
                        if (e._backpressure) {
                            return m(e._backpressureChangePromise, ()=>{
                                if ("erroring" === (Xe(e._writable) ? e._writable._state : e._writableState)) throw Xe(e._writable) ? e._writable._storedError : e._writableStoredError;
                                return mr(r, t);
                            });
                        }
                        return mr(r, t);
                    }(e, t);
                }
                function s(t) {
                    return function(e, t) {
                        return dr(e, t), d(void 0);
                    }(e, t);
                }
                function u() {
                    return function(e) {
                        const t = e._transformStreamController, r = t._flushAlgorithm();
                        return _r(t), m(r, ()=>{
                            if ("errored" === e._readableState) throw e._readableStoredError;
                            Sr(e) && wr(e);
                        }, (t)=>{
                            throw dr(e, t), e._readableStoredError;
                        });
                    }(e);
                }
                function c() {
                    return function(e) {
                        return br(e, !1), e._backpressureChangePromise;
                    }(e);
                }
                function f(t) {
                    return fr(e, t), d(void 0);
                }
                e._writableState = "writable", e._writableStoredError = void 0, e._writableHasInFlightOperation = !1, e._writableStarted = !1, e._writable = function(e, t, r, o, n, a, i) {
                    return new WritableStream({
                        start (r) {
                            e._writableController = r;
                            try {
                                const t = r.signal;
                                void 0 !== t && t.addEventListener("abort", ()=>{
                                    "writable" === e._writableState && (e._writableState = "erroring", t.reason && (e._writableStoredError = t.reason));
                                });
                            } catch (e) {}
                            return m(t(), ()=>(e._writableStarted = !0, Pr(e), null), (t)=>{
                                throw e._writableStarted = !0, Tr(e, t), t;
                            });
                        },
                        write: (t)=>((function(e) {
                                e._writableHasInFlightOperation = !0;
                            })(e), m(r(t), ()=>((function(e) {
                                    e._writableHasInFlightOperation = !1;
                                })(e), Pr(e), null), (t)=>{
                                throw function(e, t) {
                                    e._writableHasInFlightOperation = !1, Tr(e, t);
                                }(e, t), t;
                            })),
                        close: ()=>((function(e) {
                                e._writableHasInFlightOperation = !0;
                            })(e), m(o(), ()=>((function(e) {
                                    e._writableHasInFlightOperation = !1;
                                    "erroring" === e._writableState && (e._writableStoredError = void 0);
                                    e._writableState = "closed";
                                })(e), null), (t)=>{
                                throw function(e, t) {
                                    e._writableHasInFlightOperation = !1, e._writableState, Tr(e, t);
                                }(e, t), t;
                            })),
                        abort: (t)=>(e._writableState = "errored", e._writableStoredError = t, n(t))
                    }, {
                        highWaterMark: a,
                        size: i
                    });
                }(e, i, l, u, s, r, o), e._readableState = "readable", e._readableStoredError = void 0, e._readableCloseRequested = !1, e._readablePulling = !1, e._readable = function(e, t, r, o, n, a) {
                    return new ReadableStream({
                        start: (r)=>(e._readableController = r, t().catch((t)=>{
                                vr(e, t);
                            })),
                        pull: ()=>(e._readablePulling = !0, r().catch((t)=>{
                                vr(e, t);
                            })),
                        cancel: (t)=>(e._readableState = "closed", o(t))
                    }, {
                        highWaterMark: n,
                        size: a
                    });
                }(e, i, c, f, n, a), e._backpressure = void 0, e._backpressureChangePromise = void 0, e._backpressureChangePromise_resolve = void 0, br(e, !0), e._transformStreamController = void 0;
            }(this, c((e)=>{
                b = e;
            }), s, u, i, l), function(e, t) {
                const r = Object.create(TransformStreamDefaultController.prototype);
                let o, n;
                o = void 0 !== t.transform ? (e)=>t.transform(e, r) : (e)=>{
                    try {
                        return pr(r, e), d(void 0);
                    } catch (e) {
                        return f(e);
                    }
                };
                n = void 0 !== t.flush ? ()=>t.flush(r) : ()=>d(void 0);
                !function(e, t, r, o) {
                    t._controlledTransformStream = e, e._transformStreamController = t, t._transformAlgorithm = r, t._flushAlgorithm = o;
                }(e, r, o, n);
            }(this, a), void 0 !== a.start ? b(a.start(this._transformStreamController)) : b(void 0);
        }
        get readable() {
            if (!cr(this)) throw gr("readable");
            return this._readable;
        }
        get writable() {
            if (!cr(this)) throw gr("writable");
            return this._writable;
        }
    }
    function cr(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_transformStreamController") && e instanceof TransformStream;
    }
    function dr(e, t) {
        vr(e, t), fr(e, t);
    }
    function fr(e, t) {
        _r(e._transformStreamController), function(e, t) {
            e._writableController.error(t);
            "writable" === e._writableState && qr(e, t);
        }(e, t), e._backpressure && br(e, !1);
    }
    function br(e, t) {
        void 0 !== e._backpressureChangePromise && e._backpressureChangePromise_resolve(), e._backpressureChangePromise = c((t)=>{
            e._backpressureChangePromise_resolve = t;
        }), e._backpressure = t;
    }
    Object.defineProperties(TransformStream.prototype, {
        readable: {
            enumerable: !0
        },
        writable: {
            enumerable: !0
        }
    }), "symbol" == typeof t.toStringTag && Object.defineProperty(TransformStream.prototype, t.toStringTag, {
        value: "TransformStream",
        configurable: !0
    });
    class TransformStreamDefaultController {
        constructor(){
            throw new TypeError("Illegal constructor");
        }
        get desiredSize() {
            if (!hr(this)) throw yr("desiredSize");
            return Rr(this._controlledTransformStream);
        }
        enqueue(e) {
            if (!hr(this)) throw yr("enqueue");
            pr(this, e);
        }
        error(e) {
            if (!hr(this)) throw yr("error");
            var t;
            t = e, dr(this._controlledTransformStream, t);
        }
        terminate() {
            if (!hr(this)) throw yr("terminate");
            !function(e) {
                const t = e._controlledTransformStream;
                Sr(t) && wr(t);
                const r = new TypeError("TransformStream terminated");
                fr(t, r);
            }(this);
        }
    }
    function hr(e) {
        return !!o(e) && !!Object.prototype.hasOwnProperty.call(e, "_controlledTransformStream") && e instanceof TransformStreamDefaultController;
    }
    function _r(e) {
        e._transformAlgorithm = void 0, e._flushAlgorithm = void 0;
    }
    function pr(e, t) {
        const r = e._controlledTransformStream;
        if (!Sr(r)) throw new TypeError("Readable side is not in a state that permits enqueue");
        try {
            !function(e, t) {
                e._readablePulling = !1;
                try {
                    e._readableController.enqueue(t);
                } catch (t) {
                    throw vr(e, t), t;
                }
            }(r, t);
        } catch (e) {
            throw fr(r, e), r._readableStoredError;
        }
        const o = function(e) {
            return !function(e) {
                if (!Sr(e)) return !1;
                if (e._readablePulling) return !0;
                if (Rr(e) > 0) return !0;
                return !1;
            }(e);
        }(r);
        o !== r._backpressure && br(r, !0);
    }
    function mr(e, t) {
        return m(e._transformAlgorithm(t), void 0, (t)=>{
            throw dr(e._controlledTransformStream, t), t;
        });
    }
    function yr(e) {
        return new TypeError(`TransformStreamDefaultController.prototype.${e} can only be used on a TransformStreamDefaultController`);
    }
    function gr(e) {
        return new TypeError(`TransformStream.prototype.${e} can only be used on a TransformStream`);
    }
    function Sr(e) {
        return !e._readableCloseRequested && "readable" === e._readableState;
    }
    function wr(e) {
        e._readableState = "closed", e._readableCloseRequested = !0, e._readableController.close();
    }
    function vr(e, t) {
        "readable" === e._readableState && (e._readableState = "errored", e._readableStoredError = t), e._readableController.error(t);
    }
    function Rr(e) {
        return e._readableController.desiredSize;
    }
    function Tr(e, t) {
        "writable" !== e._writableState ? Cr(e) : qr(e, t);
    }
    function qr(e, t) {
        e._writableState = "erroring", e._writableStoredError = t, !function(e) {
            return e._writableHasInFlightOperation;
        }(e) && e._writableStarted && Cr(e);
    }
    function Cr(e) {
        e._writableState = "errored";
    }
    function Pr(e) {
        "erroring" === e._writableState && Cr(e);
    }
    Object.defineProperties(TransformStreamDefaultController.prototype, {
        enqueue: {
            enumerable: !0
        },
        error: {
            enumerable: !0
        },
        terminate: {
            enumerable: !0
        },
        desiredSize: {
            enumerable: !0
        }
    }), a(TransformStreamDefaultController.prototype.enqueue, "enqueue"), a(TransformStreamDefaultController.prototype.error, "error"), a(TransformStreamDefaultController.prototype.terminate, "terminate"), "symbol" == typeof t.toStringTag && Object.defineProperty(TransformStreamDefaultController.prototype, t.toStringTag, {
        value: "TransformStreamDefaultController",
        configurable: !0
    }), e.ByteLengthQueuingStrategy = ByteLengthQueuingStrategy, e.CountQueuingStrategy = CountQueuingStrategy, e.ReadableByteStreamController = ReadableByteStreamController, e.ReadableStream = ReadableStream, e.ReadableStreamBYOBReader = ReadableStreamBYOBReader, e.ReadableStreamBYOBRequest = ReadableStreamBYOBRequest, e.ReadableStreamDefaultController = ReadableStreamDefaultController, e.ReadableStreamDefaultReader = ReadableStreamDefaultReader, e.TransformStream = TransformStream, e.TransformStreamDefaultController = TransformStreamDefaultController, e.WritableStream = WritableStream, e.WritableStreamDefaultController = WritableStreamDefaultController, e.WritableStreamDefaultWriter = WritableStreamDefaultWriter, Object.defineProperty(e, "__esModule", {
        value: !0
    });
});
}}),
"[project]/node_modules/.pnpm/web-streams-polyfill@3.3.3/node_modules/web-streams-polyfill/dist/ponyfill.es2018.js [app-rsc] (ecmascript)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
/**
 * @license
 * web-streams-polyfill v3.3.3
 * Copyright 2024 Mattias Buelens, Diwank Singh Tomer and other contributors.
 * This code is released under the MIT license.
 * SPDX-License-Identifier: MIT
 */ (function(global1, factory) {
    ("TURBOPACK compile-time truthy", 1) ? factory(exports) : ("TURBOPACK unreachable", undefined);
})(this, function(exports1) {
    'use strict';
    function noop() {
        return undefined;
    }
    function typeIsObject(x) {
        return typeof x === 'object' && x !== null || typeof x === 'function';
    }
    const rethrowAssertionErrorRejection = noop;
    function setFunctionName(fn, name) {
        try {
            Object.defineProperty(fn, 'name', {
                value: name,
                configurable: true
            });
        } catch (_a) {
        // This property is non-configurable in older browsers, so ignore if this throws.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name#browser_compatibility
        }
    }
    const originalPromise = Promise;
    const originalPromiseThen = Promise.prototype.then;
    const originalPromiseReject = Promise.reject.bind(originalPromise);
    // https://webidl.spec.whatwg.org/#a-new-promise
    function newPromise(executor) {
        return new originalPromise(executor);
    }
    // https://webidl.spec.whatwg.org/#a-promise-resolved-with
    function promiseResolvedWith(value) {
        return newPromise((resolve)=>resolve(value));
    }
    // https://webidl.spec.whatwg.org/#a-promise-rejected-with
    function promiseRejectedWith(reason) {
        return originalPromiseReject(reason);
    }
    function PerformPromiseThen(promise, onFulfilled, onRejected) {
        // There doesn't appear to be any way to correctly emulate the behaviour from JavaScript, so this is just an
        // approximation.
        return originalPromiseThen.call(promise, onFulfilled, onRejected);
    }
    // Bluebird logs a warning when a promise is created within a fulfillment handler, but then isn't returned
    // from that handler. To prevent this, return null instead of void from all handlers.
    // http://bluebirdjs.com/docs/warning-explanations.html#warning-a-promise-was-created-in-a-handler-but-was-not-returned-from-it
    function uponPromise(promise, onFulfilled, onRejected) {
        PerformPromiseThen(PerformPromiseThen(promise, onFulfilled, onRejected), undefined, rethrowAssertionErrorRejection);
    }
    function uponFulfillment(promise, onFulfilled) {
        uponPromise(promise, onFulfilled);
    }
    function uponRejection(promise, onRejected) {
        uponPromise(promise, undefined, onRejected);
    }
    function transformPromiseWith(promise, fulfillmentHandler, rejectionHandler) {
        return PerformPromiseThen(promise, fulfillmentHandler, rejectionHandler);
    }
    function setPromiseIsHandledToTrue(promise) {
        PerformPromiseThen(promise, undefined, rethrowAssertionErrorRejection);
    }
    let _queueMicrotask = (callback)=>{
        if (typeof queueMicrotask === 'function') {
            _queueMicrotask = queueMicrotask;
        } else {
            const resolvedPromise = promiseResolvedWith(undefined);
            _queueMicrotask = (cb)=>PerformPromiseThen(resolvedPromise, cb);
        }
        return _queueMicrotask(callback);
    };
    function reflectCall(F, V, args) {
        if (typeof F !== 'function') {
            throw new TypeError('Argument is not a function');
        }
        return Function.prototype.apply.call(F, V, args);
    }
    function promiseCall(F, V, args) {
        try {
            return promiseResolvedWith(reflectCall(F, V, args));
        } catch (value) {
            return promiseRejectedWith(value);
        }
    }
    // Original from Chromium
    // https://chromium.googlesource.com/chromium/src/+/0aee4434a4dba42a42abaea9bfbc0cd196a63bc1/third_party/blink/renderer/core/streams/SimpleQueue.js
    const QUEUE_MAX_ARRAY_SIZE = 16384;
    /**
     * Simple queue structure.
     *
     * Avoids scalability issues with using a packed array directly by using
     * multiple arrays in a linked list and keeping the array size bounded.
     */ class SimpleQueue {
        constructor(){
            this._cursor = 0;
            this._size = 0;
            // _front and _back are always defined.
            this._front = {
                _elements: [],
                _next: undefined
            };
            this._back = this._front;
            // The cursor is used to avoid calling Array.shift().
            // It contains the index of the front element of the array inside the
            // front-most node. It is always in the range [0, QUEUE_MAX_ARRAY_SIZE).
            this._cursor = 0;
            // When there is only one node, size === elements.length - cursor.
            this._size = 0;
        }
        get length() {
            return this._size;
        }
        // For exception safety, this method is structured in order:
        // 1. Read state
        // 2. Calculate required state mutations
        // 3. Perform state mutations
        push(element) {
            const oldBack = this._back;
            let newBack = oldBack;
            if (oldBack._elements.length === QUEUE_MAX_ARRAY_SIZE - 1) {
                newBack = {
                    _elements: [],
                    _next: undefined
                };
            }
            // push() is the mutation most likely to throw an exception, so it
            // goes first.
            oldBack._elements.push(element);
            if (newBack !== oldBack) {
                this._back = newBack;
                oldBack._next = newBack;
            }
            ++this._size;
        }
        // Like push(), shift() follows the read -> calculate -> mutate pattern for
        // exception safety.
        shift() {
            const oldFront = this._front;
            let newFront = oldFront;
            const oldCursor = this._cursor;
            let newCursor = oldCursor + 1;
            const elements = oldFront._elements;
            const element = elements[oldCursor];
            if (newCursor === QUEUE_MAX_ARRAY_SIZE) {
                newFront = oldFront._next;
                newCursor = 0;
            }
            // No mutations before this point.
            --this._size;
            this._cursor = newCursor;
            if (oldFront !== newFront) {
                this._front = newFront;
            }
            // Permit shifted element to be garbage collected.
            elements[oldCursor] = undefined;
            return element;
        }
        // The tricky thing about forEach() is that it can be called
        // re-entrantly. The queue may be mutated inside the callback. It is easy to
        // see that push() within the callback has no negative effects since the end
        // of the queue is checked for on every iteration. If shift() is called
        // repeatedly within the callback then the next iteration may return an
        // element that has been removed. In this case the callback will be called
        // with undefined values until we either "catch up" with elements that still
        // exist or reach the back of the queue.
        forEach(callback) {
            let i = this._cursor;
            let node = this._front;
            let elements = node._elements;
            while(i !== elements.length || node._next !== undefined){
                if (i === elements.length) {
                    node = node._next;
                    elements = node._elements;
                    i = 0;
                    if (elements.length === 0) {
                        break;
                    }
                }
                callback(elements[i]);
                ++i;
            }
        }
        // Return the element that would be returned if shift() was called now,
        // without modifying the queue.
        peek() {
            const front = this._front;
            const cursor = this._cursor;
            return front._elements[cursor];
        }
    }
    const AbortSteps = Symbol('[[AbortSteps]]');
    const ErrorSteps = Symbol('[[ErrorSteps]]');
    const CancelSteps = Symbol('[[CancelSteps]]');
    const PullSteps = Symbol('[[PullSteps]]');
    const ReleaseSteps = Symbol('[[ReleaseSteps]]');
    function ReadableStreamReaderGenericInitialize(reader, stream) {
        reader._ownerReadableStream = stream;
        stream._reader = reader;
        if (stream._state === 'readable') {
            defaultReaderClosedPromiseInitialize(reader);
        } else if (stream._state === 'closed') {
            defaultReaderClosedPromiseInitializeAsResolved(reader);
        } else {
            defaultReaderClosedPromiseInitializeAsRejected(reader, stream._storedError);
        }
    }
    // A client of ReadableStreamDefaultReader and ReadableStreamBYOBReader may use these functions directly to bypass state
    // check.
    function ReadableStreamReaderGenericCancel(reader, reason) {
        const stream = reader._ownerReadableStream;
        return ReadableStreamCancel(stream, reason);
    }
    function ReadableStreamReaderGenericRelease(reader) {
        const stream = reader._ownerReadableStream;
        if (stream._state === 'readable') {
            defaultReaderClosedPromiseReject(reader, new TypeError(`Reader was released and can no longer be used to monitor the stream's closedness`));
        } else {
            defaultReaderClosedPromiseResetToRejected(reader, new TypeError(`Reader was released and can no longer be used to monitor the stream's closedness`));
        }
        stream._readableStreamController[ReleaseSteps]();
        stream._reader = undefined;
        reader._ownerReadableStream = undefined;
    }
    // Helper functions for the readers.
    function readerLockException(name) {
        return new TypeError('Cannot ' + name + ' a stream using a released reader');
    }
    // Helper functions for the ReadableStreamDefaultReader.
    function defaultReaderClosedPromiseInitialize(reader) {
        reader._closedPromise = newPromise((resolve, reject)=>{
            reader._closedPromise_resolve = resolve;
            reader._closedPromise_reject = reject;
        });
    }
    function defaultReaderClosedPromiseInitializeAsRejected(reader, reason) {
        defaultReaderClosedPromiseInitialize(reader);
        defaultReaderClosedPromiseReject(reader, reason);
    }
    function defaultReaderClosedPromiseInitializeAsResolved(reader) {
        defaultReaderClosedPromiseInitialize(reader);
        defaultReaderClosedPromiseResolve(reader);
    }
    function defaultReaderClosedPromiseReject(reader, reason) {
        if (reader._closedPromise_reject === undefined) {
            return;
        }
        setPromiseIsHandledToTrue(reader._closedPromise);
        reader._closedPromise_reject(reason);
        reader._closedPromise_resolve = undefined;
        reader._closedPromise_reject = undefined;
    }
    function defaultReaderClosedPromiseResetToRejected(reader, reason) {
        defaultReaderClosedPromiseInitializeAsRejected(reader, reason);
    }
    function defaultReaderClosedPromiseResolve(reader) {
        if (reader._closedPromise_resolve === undefined) {
            return;
        }
        reader._closedPromise_resolve(undefined);
        reader._closedPromise_resolve = undefined;
        reader._closedPromise_reject = undefined;
    }
    /// <reference lib="es2015.core" />
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite#Polyfill
    const NumberIsFinite = Number.isFinite || function(x) {
        return typeof x === 'number' && isFinite(x);
    };
    /// <reference lib="es2015.core" />
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc#Polyfill
    const MathTrunc = Math.trunc || function(v) {
        return v < 0 ? Math.ceil(v) : Math.floor(v);
    };
    // https://heycam.github.io/webidl/#idl-dictionaries
    function isDictionary(x) {
        return typeof x === 'object' || typeof x === 'function';
    }
    function assertDictionary(obj, context) {
        if (obj !== undefined && !isDictionary(obj)) {
            throw new TypeError(`${context} is not an object.`);
        }
    }
    // https://heycam.github.io/webidl/#idl-callback-functions
    function assertFunction(x, context) {
        if (typeof x !== 'function') {
            throw new TypeError(`${context} is not a function.`);
        }
    }
    // https://heycam.github.io/webidl/#idl-object
    function isObject(x) {
        return typeof x === 'object' && x !== null || typeof x === 'function';
    }
    function assertObject(x, context) {
        if (!isObject(x)) {
            throw new TypeError(`${context} is not an object.`);
        }
    }
    function assertRequiredArgument(x, position, context) {
        if (x === undefined) {
            throw new TypeError(`Parameter ${position} is required in '${context}'.`);
        }
    }
    function assertRequiredField(x, field, context) {
        if (x === undefined) {
            throw new TypeError(`${field} is required in '${context}'.`);
        }
    }
    // https://heycam.github.io/webidl/#idl-unrestricted-double
    function convertUnrestrictedDouble(value) {
        return Number(value);
    }
    function censorNegativeZero(x) {
        return x === 0 ? 0 : x;
    }
    function integerPart(x) {
        return censorNegativeZero(MathTrunc(x));
    }
    // https://heycam.github.io/webidl/#idl-unsigned-long-long
    function convertUnsignedLongLongWithEnforceRange(value, context) {
        const lowerBound = 0;
        const upperBound = Number.MAX_SAFE_INTEGER;
        let x = Number(value);
        x = censorNegativeZero(x);
        if (!NumberIsFinite(x)) {
            throw new TypeError(`${context} is not a finite number`);
        }
        x = integerPart(x);
        if (x < lowerBound || x > upperBound) {
            throw new TypeError(`${context} is outside the accepted range of ${lowerBound} to ${upperBound}, inclusive`);
        }
        if (!NumberIsFinite(x) || x === 0) {
            return 0;
        }
        // TODO Use BigInt if supported?
        // let xBigInt = BigInt(integerPart(x));
        // xBigInt = BigInt.asUintN(64, xBigInt);
        // return Number(xBigInt);
        return x;
    }
    function assertReadableStream(x, context) {
        if (!IsReadableStream(x)) {
            throw new TypeError(`${context} is not a ReadableStream.`);
        }
    }
    // Abstract operations for the ReadableStream.
    function AcquireReadableStreamDefaultReader(stream) {
        return new ReadableStreamDefaultReader(stream);
    }
    // ReadableStream API exposed for controllers.
    function ReadableStreamAddReadRequest(stream, readRequest) {
        stream._reader._readRequests.push(readRequest);
    }
    function ReadableStreamFulfillReadRequest(stream, chunk, done) {
        const reader = stream._reader;
        const readRequest = reader._readRequests.shift();
        if (done) {
            readRequest._closeSteps();
        } else {
            readRequest._chunkSteps(chunk);
        }
    }
    function ReadableStreamGetNumReadRequests(stream) {
        return stream._reader._readRequests.length;
    }
    function ReadableStreamHasDefaultReader(stream) {
        const reader = stream._reader;
        if (reader === undefined) {
            return false;
        }
        if (!IsReadableStreamDefaultReader(reader)) {
            return false;
        }
        return true;
    }
    /**
     * A default reader vended by a {@link ReadableStream}.
     *
     * @public
     */ class ReadableStreamDefaultReader {
        constructor(stream){
            assertRequiredArgument(stream, 1, 'ReadableStreamDefaultReader');
            assertReadableStream(stream, 'First parameter');
            if (IsReadableStreamLocked(stream)) {
                throw new TypeError('This stream has already been locked for exclusive reading by another reader');
            }
            ReadableStreamReaderGenericInitialize(this, stream);
            this._readRequests = new SimpleQueue();
        }
        /**
         * Returns a promise that will be fulfilled when the stream becomes closed,
         * or rejected if the stream ever errors or the reader's lock is released before the stream finishes closing.
         */ get closed() {
            if (!IsReadableStreamDefaultReader(this)) {
                return promiseRejectedWith(defaultReaderBrandCheckException('closed'));
            }
            return this._closedPromise;
        }
        /**
         * If the reader is active, behaves the same as {@link ReadableStream.cancel | stream.cancel(reason)}.
         */ cancel(reason = undefined) {
            if (!IsReadableStreamDefaultReader(this)) {
                return promiseRejectedWith(defaultReaderBrandCheckException('cancel'));
            }
            if (this._ownerReadableStream === undefined) {
                return promiseRejectedWith(readerLockException('cancel'));
            }
            return ReadableStreamReaderGenericCancel(this, reason);
        }
        /**
         * Returns a promise that allows access to the next chunk from the stream's internal queue, if available.
         *
         * If reading a chunk causes the queue to become empty, more data will be pulled from the underlying source.
         */ read() {
            if (!IsReadableStreamDefaultReader(this)) {
                return promiseRejectedWith(defaultReaderBrandCheckException('read'));
            }
            if (this._ownerReadableStream === undefined) {
                return promiseRejectedWith(readerLockException('read from'));
            }
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve, reject)=>{
                resolvePromise = resolve;
                rejectPromise = reject;
            });
            const readRequest = {
                _chunkSteps: (chunk)=>resolvePromise({
                        value: chunk,
                        done: false
                    }),
                _closeSteps: ()=>resolvePromise({
                        value: undefined,
                        done: true
                    }),
                _errorSteps: (e)=>rejectPromise(e)
            };
            ReadableStreamDefaultReaderRead(this, readRequest);
            return promise;
        }
        /**
         * Releases the reader's lock on the corresponding stream. After the lock is released, the reader is no longer active.
         * If the associated stream is errored when the lock is released, the reader will appear errored in the same way
         * from now on; otherwise, the reader will appear closed.
         *
         * A reader's lock cannot be released while it still has a pending read request, i.e., if a promise returned by
         * the reader's {@link ReadableStreamDefaultReader.read | read()} method has not yet been settled. Attempting to
         * do so will throw a `TypeError` and leave the reader locked to the stream.
         */ releaseLock() {
            if (!IsReadableStreamDefaultReader(this)) {
                throw defaultReaderBrandCheckException('releaseLock');
            }
            if (this._ownerReadableStream === undefined) {
                return;
            }
            ReadableStreamDefaultReaderRelease(this);
        }
    }
    Object.defineProperties(ReadableStreamDefaultReader.prototype, {
        cancel: {
            enumerable: true
        },
        read: {
            enumerable: true
        },
        releaseLock: {
            enumerable: true
        },
        closed: {
            enumerable: true
        }
    });
    setFunctionName(ReadableStreamDefaultReader.prototype.cancel, 'cancel');
    setFunctionName(ReadableStreamDefaultReader.prototype.read, 'read');
    setFunctionName(ReadableStreamDefaultReader.prototype.releaseLock, 'releaseLock');
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(ReadableStreamDefaultReader.prototype, Symbol.toStringTag, {
            value: 'ReadableStreamDefaultReader',
            configurable: true
        });
    }
    // Abstract operations for the readers.
    function IsReadableStreamDefaultReader(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_readRequests')) {
            return false;
        }
        return x instanceof ReadableStreamDefaultReader;
    }
    function ReadableStreamDefaultReaderRead(reader, readRequest) {
        const stream = reader._ownerReadableStream;
        stream._disturbed = true;
        if (stream._state === 'closed') {
            readRequest._closeSteps();
        } else if (stream._state === 'errored') {
            readRequest._errorSteps(stream._storedError);
        } else {
            stream._readableStreamController[PullSteps](readRequest);
        }
    }
    function ReadableStreamDefaultReaderRelease(reader) {
        ReadableStreamReaderGenericRelease(reader);
        const e = new TypeError('Reader was released');
        ReadableStreamDefaultReaderErrorReadRequests(reader, e);
    }
    function ReadableStreamDefaultReaderErrorReadRequests(reader, e) {
        const readRequests = reader._readRequests;
        reader._readRequests = new SimpleQueue();
        readRequests.forEach((readRequest)=>{
            readRequest._errorSteps(e);
        });
    }
    // Helper functions for the ReadableStreamDefaultReader.
    function defaultReaderBrandCheckException(name) {
        return new TypeError(`ReadableStreamDefaultReader.prototype.${name} can only be used on a ReadableStreamDefaultReader`);
    }
    /// <reference lib="es2018.asynciterable" />
    /* eslint-disable @typescript-eslint/no-empty-function */ const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function*() {}).prototype);
    /// <reference lib="es2018.asynciterable" />
    class ReadableStreamAsyncIteratorImpl {
        constructor(reader, preventCancel){
            this._ongoingPromise = undefined;
            this._isFinished = false;
            this._reader = reader;
            this._preventCancel = preventCancel;
        }
        next() {
            const nextSteps = ()=>this._nextSteps();
            this._ongoingPromise = this._ongoingPromise ? transformPromiseWith(this._ongoingPromise, nextSteps, nextSteps) : nextSteps();
            return this._ongoingPromise;
        }
        return(value) {
            const returnSteps = ()=>this._returnSteps(value);
            return this._ongoingPromise ? transformPromiseWith(this._ongoingPromise, returnSteps, returnSteps) : returnSteps();
        }
        _nextSteps() {
            if (this._isFinished) {
                return Promise.resolve({
                    value: undefined,
                    done: true
                });
            }
            const reader = this._reader;
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve, reject)=>{
                resolvePromise = resolve;
                rejectPromise = reject;
            });
            const readRequest = {
                _chunkSteps: (chunk)=>{
                    this._ongoingPromise = undefined;
                    // This needs to be delayed by one microtask, otherwise we stop pulling too early which breaks a test.
                    // FIXME Is this a bug in the specification, or in the test?
                    _queueMicrotask(()=>resolvePromise({
                            value: chunk,
                            done: false
                        }));
                },
                _closeSteps: ()=>{
                    this._ongoingPromise = undefined;
                    this._isFinished = true;
                    ReadableStreamReaderGenericRelease(reader);
                    resolvePromise({
                        value: undefined,
                        done: true
                    });
                },
                _errorSteps: (reason)=>{
                    this._ongoingPromise = undefined;
                    this._isFinished = true;
                    ReadableStreamReaderGenericRelease(reader);
                    rejectPromise(reason);
                }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
            return promise;
        }
        _returnSteps(value) {
            if (this._isFinished) {
                return Promise.resolve({
                    value,
                    done: true
                });
            }
            this._isFinished = true;
            const reader = this._reader;
            if (!this._preventCancel) {
                const result = ReadableStreamReaderGenericCancel(reader, value);
                ReadableStreamReaderGenericRelease(reader);
                return transformPromiseWith(result, ()=>({
                        value,
                        done: true
                    }));
            }
            ReadableStreamReaderGenericRelease(reader);
            return promiseResolvedWith({
                value,
                done: true
            });
        }
    }
    const ReadableStreamAsyncIteratorPrototype = {
        next () {
            if (!IsReadableStreamAsyncIterator(this)) {
                return promiseRejectedWith(streamAsyncIteratorBrandCheckException('next'));
            }
            return this._asyncIteratorImpl.next();
        },
        return (value) {
            if (!IsReadableStreamAsyncIterator(this)) {
                return promiseRejectedWith(streamAsyncIteratorBrandCheckException('return'));
            }
            return this._asyncIteratorImpl.return(value);
        }
    };
    Object.setPrototypeOf(ReadableStreamAsyncIteratorPrototype, AsyncIteratorPrototype);
    // Abstract operations for the ReadableStream.
    function AcquireReadableStreamAsyncIterator(stream, preventCancel) {
        const reader = AcquireReadableStreamDefaultReader(stream);
        const impl = new ReadableStreamAsyncIteratorImpl(reader, preventCancel);
        const iterator = Object.create(ReadableStreamAsyncIteratorPrototype);
        iterator._asyncIteratorImpl = impl;
        return iterator;
    }
    function IsReadableStreamAsyncIterator(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_asyncIteratorImpl')) {
            return false;
        }
        try {
            // noinspection SuspiciousTypeOfGuard
            return x._asyncIteratorImpl instanceof ReadableStreamAsyncIteratorImpl;
        } catch (_a) {
            return false;
        }
    }
    // Helper functions for the ReadableStream.
    function streamAsyncIteratorBrandCheckException(name) {
        return new TypeError(`ReadableStreamAsyncIterator.${name} can only be used on a ReadableSteamAsyncIterator`);
    }
    /// <reference lib="es2015.core" />
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN#Polyfill
    const NumberIsNaN = Number.isNaN || function(x) {
        // eslint-disable-next-line no-self-compare
        return x !== x;
    };
    var _a, _b, _c;
    function CreateArrayFromList(elements) {
        // We use arrays to represent lists, so this is basically a no-op.
        // Do a slice though just in case we happen to depend on the unique-ness.
        return elements.slice();
    }
    function CopyDataBlockBytes(dest, destOffset, src, srcOffset, n) {
        new Uint8Array(dest).set(new Uint8Array(src, srcOffset, n), destOffset);
    }
    let TransferArrayBuffer = (O)=>{
        if (typeof O.transfer === 'function') {
            TransferArrayBuffer = (buffer)=>buffer.transfer();
        } else if (typeof structuredClone === 'function') {
            TransferArrayBuffer = (buffer)=>structuredClone(buffer, {
                    transfer: [
                        buffer
                    ]
                });
        } else {
            // Not implemented correctly
            TransferArrayBuffer = (buffer)=>buffer;
        }
        return TransferArrayBuffer(O);
    };
    let IsDetachedBuffer = (O)=>{
        if (typeof O.detached === 'boolean') {
            IsDetachedBuffer = (buffer)=>buffer.detached;
        } else {
            // Not implemented correctly
            IsDetachedBuffer = (buffer)=>buffer.byteLength === 0;
        }
        return IsDetachedBuffer(O);
    };
    function ArrayBufferSlice(buffer, begin, end) {
        // ArrayBuffer.prototype.slice is not available on IE10
        // https://www.caniuse.com/mdn-javascript_builtins_arraybuffer_slice
        if (buffer.slice) {
            return buffer.slice(begin, end);
        }
        const length = end - begin;
        const slice = new ArrayBuffer(length);
        CopyDataBlockBytes(slice, 0, buffer, begin, length);
        return slice;
    }
    function GetMethod(receiver, prop) {
        const func = receiver[prop];
        if (func === undefined || func === null) {
            return undefined;
        }
        if (typeof func !== 'function') {
            throw new TypeError(`${String(prop)} is not a function`);
        }
        return func;
    }
    function CreateAsyncFromSyncIterator(syncIteratorRecord) {
        // Instead of re-implementing CreateAsyncFromSyncIterator and %AsyncFromSyncIteratorPrototype%,
        // we use yield* inside an async generator function to achieve the same result.
        // Wrap the sync iterator inside a sync iterable, so we can use it with yield*.
        const syncIterable = {
            [Symbol.iterator]: ()=>syncIteratorRecord.iterator
        };
        // Create an async generator function and immediately invoke it.
        const asyncIterator = async function*() {
            return yield* syncIterable;
        }();
        // Return as an async iterator record.
        const nextMethod = asyncIterator.next;
        return {
            iterator: asyncIterator,
            nextMethod,
            done: false
        };
    }
    // Aligns with core-js/modules/es.symbol.async-iterator.js
    const SymbolAsyncIterator = (_c = (_a = Symbol.asyncIterator) !== null && _a !== void 0 ? _a : (_b = Symbol.for) === null || _b === void 0 ? void 0 : _b.call(Symbol, 'Symbol.asyncIterator')) !== null && _c !== void 0 ? _c : '@@asyncIterator';
    function GetIterator(obj, hint = 'sync', method) {
        if (method === undefined) {
            if (hint === 'async') {
                method = GetMethod(obj, SymbolAsyncIterator);
                if (method === undefined) {
                    const syncMethod = GetMethod(obj, Symbol.iterator);
                    const syncIteratorRecord = GetIterator(obj, 'sync', syncMethod);
                    return CreateAsyncFromSyncIterator(syncIteratorRecord);
                }
            } else {
                method = GetMethod(obj, Symbol.iterator);
            }
        }
        if (method === undefined) {
            throw new TypeError('The object is not iterable');
        }
        const iterator = reflectCall(method, obj, []);
        if (!typeIsObject(iterator)) {
            throw new TypeError('The iterator method must return an object');
        }
        const nextMethod = iterator.next;
        return {
            iterator,
            nextMethod,
            done: false
        };
    }
    function IteratorNext(iteratorRecord) {
        const result = reflectCall(iteratorRecord.nextMethod, iteratorRecord.iterator, []);
        if (!typeIsObject(result)) {
            throw new TypeError('The iterator.next() method must return an object');
        }
        return result;
    }
    function IteratorComplete(iterResult) {
        return Boolean(iterResult.done);
    }
    function IteratorValue(iterResult) {
        return iterResult.value;
    }
    function IsNonNegativeNumber(v) {
        if (typeof v !== 'number') {
            return false;
        }
        if (NumberIsNaN(v)) {
            return false;
        }
        if (v < 0) {
            return false;
        }
        return true;
    }
    function CloneAsUint8Array(O) {
        const buffer = ArrayBufferSlice(O.buffer, O.byteOffset, O.byteOffset + O.byteLength);
        return new Uint8Array(buffer);
    }
    function DequeueValue(container) {
        const pair = container._queue.shift();
        container._queueTotalSize -= pair.size;
        if (container._queueTotalSize < 0) {
            container._queueTotalSize = 0;
        }
        return pair.value;
    }
    function EnqueueValueWithSize(container, value, size) {
        if (!IsNonNegativeNumber(size) || size === Infinity) {
            throw new RangeError('Size must be a finite, non-NaN, non-negative number.');
        }
        container._queue.push({
            value,
            size
        });
        container._queueTotalSize += size;
    }
    function PeekQueueValue(container) {
        const pair = container._queue.peek();
        return pair.value;
    }
    function ResetQueue(container) {
        container._queue = new SimpleQueue();
        container._queueTotalSize = 0;
    }
    function isDataViewConstructor(ctor) {
        return ctor === DataView;
    }
    function isDataView(view) {
        return isDataViewConstructor(view.constructor);
    }
    function arrayBufferViewElementSize(ctor) {
        if (isDataViewConstructor(ctor)) {
            return 1;
        }
        return ctor.BYTES_PER_ELEMENT;
    }
    /**
     * A pull-into request in a {@link ReadableByteStreamController}.
     *
     * @public
     */ class ReadableStreamBYOBRequest {
        constructor(){
            throw new TypeError('Illegal constructor');
        }
        /**
         * Returns the view for writing in to, or `null` if the BYOB request has already been responded to.
         */ get view() {
            if (!IsReadableStreamBYOBRequest(this)) {
                throw byobRequestBrandCheckException('view');
            }
            return this._view;
        }
        respond(bytesWritten) {
            if (!IsReadableStreamBYOBRequest(this)) {
                throw byobRequestBrandCheckException('respond');
            }
            assertRequiredArgument(bytesWritten, 1, 'respond');
            bytesWritten = convertUnsignedLongLongWithEnforceRange(bytesWritten, 'First parameter');
            if (this._associatedReadableByteStreamController === undefined) {
                throw new TypeError('This BYOB request has been invalidated');
            }
            if (IsDetachedBuffer(this._view.buffer)) {
                throw new TypeError(`The BYOB request's buffer has been detached and so cannot be used as a response`);
            }
            ReadableByteStreamControllerRespond(this._associatedReadableByteStreamController, bytesWritten);
        }
        respondWithNewView(view) {
            if (!IsReadableStreamBYOBRequest(this)) {
                throw byobRequestBrandCheckException('respondWithNewView');
            }
            assertRequiredArgument(view, 1, 'respondWithNewView');
            if (!ArrayBuffer.isView(view)) {
                throw new TypeError('You can only respond with array buffer views');
            }
            if (this._associatedReadableByteStreamController === undefined) {
                throw new TypeError('This BYOB request has been invalidated');
            }
            if (IsDetachedBuffer(view.buffer)) {
                throw new TypeError('The given view\'s buffer has been detached and so cannot be used as a response');
            }
            ReadableByteStreamControllerRespondWithNewView(this._associatedReadableByteStreamController, view);
        }
    }
    Object.defineProperties(ReadableStreamBYOBRequest.prototype, {
        respond: {
            enumerable: true
        },
        respondWithNewView: {
            enumerable: true
        },
        view: {
            enumerable: true
        }
    });
    setFunctionName(ReadableStreamBYOBRequest.prototype.respond, 'respond');
    setFunctionName(ReadableStreamBYOBRequest.prototype.respondWithNewView, 'respondWithNewView');
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(ReadableStreamBYOBRequest.prototype, Symbol.toStringTag, {
            value: 'ReadableStreamBYOBRequest',
            configurable: true
        });
    }
    /**
     * Allows control of a {@link ReadableStream | readable byte stream}'s state and internal queue.
     *
     * @public
     */ class ReadableByteStreamController {
        constructor(){
            throw new TypeError('Illegal constructor');
        }
        /**
         * Returns the current BYOB pull request, or `null` if there isn't one.
         */ get byobRequest() {
            if (!IsReadableByteStreamController(this)) {
                throw byteStreamControllerBrandCheckException('byobRequest');
            }
            return ReadableByteStreamControllerGetBYOBRequest(this);
        }
        /**
         * Returns the desired size to fill the controlled stream's internal queue. It can be negative, if the queue is
         * over-full. An underlying byte source ought to use this information to determine when and how to apply backpressure.
         */ get desiredSize() {
            if (!IsReadableByteStreamController(this)) {
                throw byteStreamControllerBrandCheckException('desiredSize');
            }
            return ReadableByteStreamControllerGetDesiredSize(this);
        }
        /**
         * Closes the controlled readable stream. Consumers will still be able to read any previously-enqueued chunks from
         * the stream, but once those are read, the stream will become closed.
         */ close() {
            if (!IsReadableByteStreamController(this)) {
                throw byteStreamControllerBrandCheckException('close');
            }
            if (this._closeRequested) {
                throw new TypeError('The stream has already been closed; do not close it again!');
            }
            const state = this._controlledReadableByteStream._state;
            if (state !== 'readable') {
                throw new TypeError(`The stream (in ${state} state) is not in the readable state and cannot be closed`);
            }
            ReadableByteStreamControllerClose(this);
        }
        enqueue(chunk) {
            if (!IsReadableByteStreamController(this)) {
                throw byteStreamControllerBrandCheckException('enqueue');
            }
            assertRequiredArgument(chunk, 1, 'enqueue');
            if (!ArrayBuffer.isView(chunk)) {
                throw new TypeError('chunk must be an array buffer view');
            }
            if (chunk.byteLength === 0) {
                throw new TypeError('chunk must have non-zero byteLength');
            }
            if (chunk.buffer.byteLength === 0) {
                throw new TypeError(`chunk's buffer must have non-zero byteLength`);
            }
            if (this._closeRequested) {
                throw new TypeError('stream is closed or draining');
            }
            const state = this._controlledReadableByteStream._state;
            if (state !== 'readable') {
                throw new TypeError(`The stream (in ${state} state) is not in the readable state and cannot be enqueued to`);
            }
            ReadableByteStreamControllerEnqueue(this, chunk);
        }
        /**
         * Errors the controlled readable stream, making all future interactions with it fail with the given error `e`.
         */ error(e = undefined) {
            if (!IsReadableByteStreamController(this)) {
                throw byteStreamControllerBrandCheckException('error');
            }
            ReadableByteStreamControllerError(this, e);
        }
        /** @internal */ [CancelSteps](reason) {
            ReadableByteStreamControllerClearPendingPullIntos(this);
            ResetQueue(this);
            const result = this._cancelAlgorithm(reason);
            ReadableByteStreamControllerClearAlgorithms(this);
            return result;
        }
        /** @internal */ [PullSteps](readRequest) {
            const stream = this._controlledReadableByteStream;
            if (this._queueTotalSize > 0) {
                ReadableByteStreamControllerFillReadRequestFromQueue(this, readRequest);
                return;
            }
            const autoAllocateChunkSize = this._autoAllocateChunkSize;
            if (autoAllocateChunkSize !== undefined) {
                let buffer;
                try {
                    buffer = new ArrayBuffer(autoAllocateChunkSize);
                } catch (bufferE) {
                    readRequest._errorSteps(bufferE);
                    return;
                }
                const pullIntoDescriptor = {
                    buffer,
                    bufferByteLength: autoAllocateChunkSize,
                    byteOffset: 0,
                    byteLength: autoAllocateChunkSize,
                    bytesFilled: 0,
                    minimumFill: 1,
                    elementSize: 1,
                    viewConstructor: Uint8Array,
                    readerType: 'default'
                };
                this._pendingPullIntos.push(pullIntoDescriptor);
            }
            ReadableStreamAddReadRequest(stream, readRequest);
            ReadableByteStreamControllerCallPullIfNeeded(this);
        }
        /** @internal */ [ReleaseSteps]() {
            if (this._pendingPullIntos.length > 0) {
                const firstPullInto = this._pendingPullIntos.peek();
                firstPullInto.readerType = 'none';
                this._pendingPullIntos = new SimpleQueue();
                this._pendingPullIntos.push(firstPullInto);
            }
        }
    }
    Object.defineProperties(ReadableByteStreamController.prototype, {
        close: {
            enumerable: true
        },
        enqueue: {
            enumerable: true
        },
        error: {
            enumerable: true
        },
        byobRequest: {
            enumerable: true
        },
        desiredSize: {
            enumerable: true
        }
    });
    setFunctionName(ReadableByteStreamController.prototype.close, 'close');
    setFunctionName(ReadableByteStreamController.prototype.enqueue, 'enqueue');
    setFunctionName(ReadableByteStreamController.prototype.error, 'error');
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(ReadableByteStreamController.prototype, Symbol.toStringTag, {
            value: 'ReadableByteStreamController',
            configurable: true
        });
    }
    // Abstract operations for the ReadableByteStreamController.
    function IsReadableByteStreamController(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_controlledReadableByteStream')) {
            return false;
        }
        return x instanceof ReadableByteStreamController;
    }
    function IsReadableStreamBYOBRequest(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_associatedReadableByteStreamController')) {
            return false;
        }
        return x instanceof ReadableStreamBYOBRequest;
    }
    function ReadableByteStreamControllerCallPullIfNeeded(controller) {
        const shouldPull = ReadableByteStreamControllerShouldCallPull(controller);
        if (!shouldPull) {
            return;
        }
        if (controller._pulling) {
            controller._pullAgain = true;
            return;
        }
        controller._pulling = true;
        // TODO: Test controller argument
        const pullPromise = controller._pullAlgorithm();
        uponPromise(pullPromise, ()=>{
            controller._pulling = false;
            if (controller._pullAgain) {
                controller._pullAgain = false;
                ReadableByteStreamControllerCallPullIfNeeded(controller);
            }
            return null;
        }, (e)=>{
            ReadableByteStreamControllerError(controller, e);
            return null;
        });
    }
    function ReadableByteStreamControllerClearPendingPullIntos(controller) {
        ReadableByteStreamControllerInvalidateBYOBRequest(controller);
        controller._pendingPullIntos = new SimpleQueue();
    }
    function ReadableByteStreamControllerCommitPullIntoDescriptor(stream, pullIntoDescriptor) {
        let done = false;
        if (stream._state === 'closed') {
            done = true;
        }
        const filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor);
        if (pullIntoDescriptor.readerType === 'default') {
            ReadableStreamFulfillReadRequest(stream, filledView, done);
        } else {
            ReadableStreamFulfillReadIntoRequest(stream, filledView, done);
        }
    }
    function ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor) {
        const bytesFilled = pullIntoDescriptor.bytesFilled;
        const elementSize = pullIntoDescriptor.elementSize;
        return new pullIntoDescriptor.viewConstructor(pullIntoDescriptor.buffer, pullIntoDescriptor.byteOffset, bytesFilled / elementSize);
    }
    function ReadableByteStreamControllerEnqueueChunkToQueue(controller, buffer, byteOffset, byteLength) {
        controller._queue.push({
            buffer,
            byteOffset,
            byteLength
        });
        controller._queueTotalSize += byteLength;
    }
    function ReadableByteStreamControllerEnqueueClonedChunkToQueue(controller, buffer, byteOffset, byteLength) {
        let clonedChunk;
        try {
            clonedChunk = ArrayBufferSlice(buffer, byteOffset, byteOffset + byteLength);
        } catch (cloneE) {
            ReadableByteStreamControllerError(controller, cloneE);
            throw cloneE;
        }
        ReadableByteStreamControllerEnqueueChunkToQueue(controller, clonedChunk, 0, byteLength);
    }
    function ReadableByteStreamControllerEnqueueDetachedPullIntoToQueue(controller, firstDescriptor) {
        if (firstDescriptor.bytesFilled > 0) {
            ReadableByteStreamControllerEnqueueClonedChunkToQueue(controller, firstDescriptor.buffer, firstDescriptor.byteOffset, firstDescriptor.bytesFilled);
        }
        ReadableByteStreamControllerShiftPendingPullInto(controller);
    }
    function ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor) {
        const maxBytesToCopy = Math.min(controller._queueTotalSize, pullIntoDescriptor.byteLength - pullIntoDescriptor.bytesFilled);
        const maxBytesFilled = pullIntoDescriptor.bytesFilled + maxBytesToCopy;
        let totalBytesToCopyRemaining = maxBytesToCopy;
        let ready = false;
        const remainderBytes = maxBytesFilled % pullIntoDescriptor.elementSize;
        const maxAlignedBytes = maxBytesFilled - remainderBytes;
        // A descriptor for a read() request that is not yet filled up to its minimum length will stay at the head
        // of the queue, so the underlying source can keep filling it.
        if (maxAlignedBytes >= pullIntoDescriptor.minimumFill) {
            totalBytesToCopyRemaining = maxAlignedBytes - pullIntoDescriptor.bytesFilled;
            ready = true;
        }
        const queue = controller._queue;
        while(totalBytesToCopyRemaining > 0){
            const headOfQueue = queue.peek();
            const bytesToCopy = Math.min(totalBytesToCopyRemaining, headOfQueue.byteLength);
            const destStart = pullIntoDescriptor.byteOffset + pullIntoDescriptor.bytesFilled;
            CopyDataBlockBytes(pullIntoDescriptor.buffer, destStart, headOfQueue.buffer, headOfQueue.byteOffset, bytesToCopy);
            if (headOfQueue.byteLength === bytesToCopy) {
                queue.shift();
            } else {
                headOfQueue.byteOffset += bytesToCopy;
                headOfQueue.byteLength -= bytesToCopy;
            }
            controller._queueTotalSize -= bytesToCopy;
            ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesToCopy, pullIntoDescriptor);
            totalBytesToCopyRemaining -= bytesToCopy;
        }
        return ready;
    }
    function ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, size, pullIntoDescriptor) {
        pullIntoDescriptor.bytesFilled += size;
    }
    function ReadableByteStreamControllerHandleQueueDrain(controller) {
        if (controller._queueTotalSize === 0 && controller._closeRequested) {
            ReadableByteStreamControllerClearAlgorithms(controller);
            ReadableStreamClose(controller._controlledReadableByteStream);
        } else {
            ReadableByteStreamControllerCallPullIfNeeded(controller);
        }
    }
    function ReadableByteStreamControllerInvalidateBYOBRequest(controller) {
        if (controller._byobRequest === null) {
            return;
        }
        controller._byobRequest._associatedReadableByteStreamController = undefined;
        controller._byobRequest._view = null;
        controller._byobRequest = null;
    }
    function ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller) {
        while(controller._pendingPullIntos.length > 0){
            if (controller._queueTotalSize === 0) {
                return;
            }
            const pullIntoDescriptor = controller._pendingPullIntos.peek();
            if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor)) {
                ReadableByteStreamControllerShiftPendingPullInto(controller);
                ReadableByteStreamControllerCommitPullIntoDescriptor(controller._controlledReadableByteStream, pullIntoDescriptor);
            }
        }
    }
    function ReadableByteStreamControllerProcessReadRequestsUsingQueue(controller) {
        const reader = controller._controlledReadableByteStream._reader;
        while(reader._readRequests.length > 0){
            if (controller._queueTotalSize === 0) {
                return;
            }
            const readRequest = reader._readRequests.shift();
            ReadableByteStreamControllerFillReadRequestFromQueue(controller, readRequest);
        }
    }
    function ReadableByteStreamControllerPullInto(controller, view, min, readIntoRequest) {
        const stream = controller._controlledReadableByteStream;
        const ctor = view.constructor;
        const elementSize = arrayBufferViewElementSize(ctor);
        const { byteOffset, byteLength } = view;
        const minimumFill = min * elementSize;
        let buffer;
        try {
            buffer = TransferArrayBuffer(view.buffer);
        } catch (e) {
            readIntoRequest._errorSteps(e);
            return;
        }
        const pullIntoDescriptor = {
            buffer,
            bufferByteLength: buffer.byteLength,
            byteOffset,
            byteLength,
            bytesFilled: 0,
            minimumFill,
            elementSize,
            viewConstructor: ctor,
            readerType: 'byob'
        };
        if (controller._pendingPullIntos.length > 0) {
            controller._pendingPullIntos.push(pullIntoDescriptor);
            // No ReadableByteStreamControllerCallPullIfNeeded() call since:
            // - No change happens on desiredSize
            // - The source has already been notified of that there's at least 1 pending read(view)
            ReadableStreamAddReadIntoRequest(stream, readIntoRequest);
            return;
        }
        if (stream._state === 'closed') {
            const emptyView = new ctor(pullIntoDescriptor.buffer, pullIntoDescriptor.byteOffset, 0);
            readIntoRequest._closeSteps(emptyView);
            return;
        }
        if (controller._queueTotalSize > 0) {
            if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor)) {
                const filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor);
                ReadableByteStreamControllerHandleQueueDrain(controller);
                readIntoRequest._chunkSteps(filledView);
                return;
            }
            if (controller._closeRequested) {
                const e = new TypeError('Insufficient bytes to fill elements in the given buffer');
                ReadableByteStreamControllerError(controller, e);
                readIntoRequest._errorSteps(e);
                return;
            }
        }
        controller._pendingPullIntos.push(pullIntoDescriptor);
        ReadableStreamAddReadIntoRequest(stream, readIntoRequest);
        ReadableByteStreamControllerCallPullIfNeeded(controller);
    }
    function ReadableByteStreamControllerRespondInClosedState(controller, firstDescriptor) {
        if (firstDescriptor.readerType === 'none') {
            ReadableByteStreamControllerShiftPendingPullInto(controller);
        }
        const stream = controller._controlledReadableByteStream;
        if (ReadableStreamHasBYOBReader(stream)) {
            while(ReadableStreamGetNumReadIntoRequests(stream) > 0){
                const pullIntoDescriptor = ReadableByteStreamControllerShiftPendingPullInto(controller);
                ReadableByteStreamControllerCommitPullIntoDescriptor(stream, pullIntoDescriptor);
            }
        }
    }
    function ReadableByteStreamControllerRespondInReadableState(controller, bytesWritten, pullIntoDescriptor) {
        ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesWritten, pullIntoDescriptor);
        if (pullIntoDescriptor.readerType === 'none') {
            ReadableByteStreamControllerEnqueueDetachedPullIntoToQueue(controller, pullIntoDescriptor);
            ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
            return;
        }
        if (pullIntoDescriptor.bytesFilled < pullIntoDescriptor.minimumFill) {
            // A descriptor for a read() request that is not yet filled up to its minimum length will stay at the head
            // of the queue, so the underlying source can keep filling it.
            return;
        }
        ReadableByteStreamControllerShiftPendingPullInto(controller);
        const remainderSize = pullIntoDescriptor.bytesFilled % pullIntoDescriptor.elementSize;
        if (remainderSize > 0) {
            const end = pullIntoDescriptor.byteOffset + pullIntoDescriptor.bytesFilled;
            ReadableByteStreamControllerEnqueueClonedChunkToQueue(controller, pullIntoDescriptor.buffer, end - remainderSize, remainderSize);
        }
        pullIntoDescriptor.bytesFilled -= remainderSize;
        ReadableByteStreamControllerCommitPullIntoDescriptor(controller._controlledReadableByteStream, pullIntoDescriptor);
        ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
    }
    function ReadableByteStreamControllerRespondInternal(controller, bytesWritten) {
        const firstDescriptor = controller._pendingPullIntos.peek();
        ReadableByteStreamControllerInvalidateBYOBRequest(controller);
        const state = controller._controlledReadableByteStream._state;
        if (state === 'closed') {
            ReadableByteStreamControllerRespondInClosedState(controller, firstDescriptor);
        } else {
            ReadableByteStreamControllerRespondInReadableState(controller, bytesWritten, firstDescriptor);
        }
        ReadableByteStreamControllerCallPullIfNeeded(controller);
    }
    function ReadableByteStreamControllerShiftPendingPullInto(controller) {
        const descriptor = controller._pendingPullIntos.shift();
        return descriptor;
    }
    function ReadableByteStreamControllerShouldCallPull(controller) {
        const stream = controller._controlledReadableByteStream;
        if (stream._state !== 'readable') {
            return false;
        }
        if (controller._closeRequested) {
            return false;
        }
        if (!controller._started) {
            return false;
        }
        if (ReadableStreamHasDefaultReader(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            return true;
        }
        if (ReadableStreamHasBYOBReader(stream) && ReadableStreamGetNumReadIntoRequests(stream) > 0) {
            return true;
        }
        const desiredSize = ReadableByteStreamControllerGetDesiredSize(controller);
        if (desiredSize > 0) {
            return true;
        }
        return false;
    }
    function ReadableByteStreamControllerClearAlgorithms(controller) {
        controller._pullAlgorithm = undefined;
        controller._cancelAlgorithm = undefined;
    }
    // A client of ReadableByteStreamController may use these functions directly to bypass state check.
    function ReadableByteStreamControllerClose(controller) {
        const stream = controller._controlledReadableByteStream;
        if (controller._closeRequested || stream._state !== 'readable') {
            return;
        }
        if (controller._queueTotalSize > 0) {
            controller._closeRequested = true;
            return;
        }
        if (controller._pendingPullIntos.length > 0) {
            const firstPendingPullInto = controller._pendingPullIntos.peek();
            if (firstPendingPullInto.bytesFilled % firstPendingPullInto.elementSize !== 0) {
                const e = new TypeError('Insufficient bytes to fill elements in the given buffer');
                ReadableByteStreamControllerError(controller, e);
                throw e;
            }
        }
        ReadableByteStreamControllerClearAlgorithms(controller);
        ReadableStreamClose(stream);
    }
    function ReadableByteStreamControllerEnqueue(controller, chunk) {
        const stream = controller._controlledReadableByteStream;
        if (controller._closeRequested || stream._state !== 'readable') {
            return;
        }
        const { buffer, byteOffset, byteLength } = chunk;
        if (IsDetachedBuffer(buffer)) {
            throw new TypeError('chunk\'s buffer is detached and so cannot be enqueued');
        }
        const transferredBuffer = TransferArrayBuffer(buffer);
        if (controller._pendingPullIntos.length > 0) {
            const firstPendingPullInto = controller._pendingPullIntos.peek();
            if (IsDetachedBuffer(firstPendingPullInto.buffer)) {
                throw new TypeError('The BYOB request\'s buffer has been detached and so cannot be filled with an enqueued chunk');
            }
            ReadableByteStreamControllerInvalidateBYOBRequest(controller);
            firstPendingPullInto.buffer = TransferArrayBuffer(firstPendingPullInto.buffer);
            if (firstPendingPullInto.readerType === 'none') {
                ReadableByteStreamControllerEnqueueDetachedPullIntoToQueue(controller, firstPendingPullInto);
            }
        }
        if (ReadableStreamHasDefaultReader(stream)) {
            ReadableByteStreamControllerProcessReadRequestsUsingQueue(controller);
            if (ReadableStreamGetNumReadRequests(stream) === 0) {
                ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
            } else {
                if (controller._pendingPullIntos.length > 0) {
                    ReadableByteStreamControllerShiftPendingPullInto(controller);
                }
                const transferredView = new Uint8Array(transferredBuffer, byteOffset, byteLength);
                ReadableStreamFulfillReadRequest(stream, transferredView, false);
            }
        } else if (ReadableStreamHasBYOBReader(stream)) {
            // TODO: Ideally in this branch detaching should happen only if the buffer is not consumed fully.
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
            ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
        } else {
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
        }
        ReadableByteStreamControllerCallPullIfNeeded(controller);
    }
    function ReadableByteStreamControllerError(controller, e) {
        const stream = controller._controlledReadableByteStream;
        if (stream._state !== 'readable') {
            return;
        }
        ReadableByteStreamControllerClearPendingPullIntos(controller);
        ResetQueue(controller);
        ReadableByteStreamControllerClearAlgorithms(controller);
        ReadableStreamError(stream, e);
    }
    function ReadableByteStreamControllerFillReadRequestFromQueue(controller, readRequest) {
        const entry = controller._queue.shift();
        controller._queueTotalSize -= entry.byteLength;
        ReadableByteStreamControllerHandleQueueDrain(controller);
        const view = new Uint8Array(entry.buffer, entry.byteOffset, entry.byteLength);
        readRequest._chunkSteps(view);
    }
    function ReadableByteStreamControllerGetBYOBRequest(controller) {
        if (controller._byobRequest === null && controller._pendingPullIntos.length > 0) {
            const firstDescriptor = controller._pendingPullIntos.peek();
            const view = new Uint8Array(firstDescriptor.buffer, firstDescriptor.byteOffset + firstDescriptor.bytesFilled, firstDescriptor.byteLength - firstDescriptor.bytesFilled);
            const byobRequest = Object.create(ReadableStreamBYOBRequest.prototype);
            SetUpReadableStreamBYOBRequest(byobRequest, controller, view);
            controller._byobRequest = byobRequest;
        }
        return controller._byobRequest;
    }
    function ReadableByteStreamControllerGetDesiredSize(controller) {
        const state = controller._controlledReadableByteStream._state;
        if (state === 'errored') {
            return null;
        }
        if (state === 'closed') {
            return 0;
        }
        return controller._strategyHWM - controller._queueTotalSize;
    }
    function ReadableByteStreamControllerRespond(controller, bytesWritten) {
        const firstDescriptor = controller._pendingPullIntos.peek();
        const state = controller._controlledReadableByteStream._state;
        if (state === 'closed') {
            if (bytesWritten !== 0) {
                throw new TypeError('bytesWritten must be 0 when calling respond() on a closed stream');
            }
        } else {
            if (bytesWritten === 0) {
                throw new TypeError('bytesWritten must be greater than 0 when calling respond() on a readable stream');
            }
            if (firstDescriptor.bytesFilled + bytesWritten > firstDescriptor.byteLength) {
                throw new RangeError('bytesWritten out of range');
            }
        }
        firstDescriptor.buffer = TransferArrayBuffer(firstDescriptor.buffer);
        ReadableByteStreamControllerRespondInternal(controller, bytesWritten);
    }
    function ReadableByteStreamControllerRespondWithNewView(controller, view) {
        const firstDescriptor = controller._pendingPullIntos.peek();
        const state = controller._controlledReadableByteStream._state;
        if (state === 'closed') {
            if (view.byteLength !== 0) {
                throw new TypeError('The view\'s length must be 0 when calling respondWithNewView() on a closed stream');
            }
        } else {
            if (view.byteLength === 0) {
                throw new TypeError('The view\'s length must be greater than 0 when calling respondWithNewView() on a readable stream');
            }
        }
        if (firstDescriptor.byteOffset + firstDescriptor.bytesFilled !== view.byteOffset) {
            throw new RangeError('The region specified by view does not match byobRequest');
        }
        if (firstDescriptor.bufferByteLength !== view.buffer.byteLength) {
            throw new RangeError('The buffer of view has different capacity than byobRequest');
        }
        if (firstDescriptor.bytesFilled + view.byteLength > firstDescriptor.byteLength) {
            throw new RangeError('The region specified by view is larger than byobRequest');
        }
        const viewByteLength = view.byteLength;
        firstDescriptor.buffer = TransferArrayBuffer(view.buffer);
        ReadableByteStreamControllerRespondInternal(controller, viewByteLength);
    }
    function SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, autoAllocateChunkSize) {
        controller._controlledReadableByteStream = stream;
        controller._pullAgain = false;
        controller._pulling = false;
        controller._byobRequest = null;
        // Need to set the slots so that the assert doesn't fire. In the spec the slots already exist implicitly.
        controller._queue = controller._queueTotalSize = undefined;
        ResetQueue(controller);
        controller._closeRequested = false;
        controller._started = false;
        controller._strategyHWM = highWaterMark;
        controller._pullAlgorithm = pullAlgorithm;
        controller._cancelAlgorithm = cancelAlgorithm;
        controller._autoAllocateChunkSize = autoAllocateChunkSize;
        controller._pendingPullIntos = new SimpleQueue();
        stream._readableStreamController = controller;
        const startResult = startAlgorithm();
        uponPromise(promiseResolvedWith(startResult), ()=>{
            controller._started = true;
            ReadableByteStreamControllerCallPullIfNeeded(controller);
            return null;
        }, (r)=>{
            ReadableByteStreamControllerError(controller, r);
            return null;
        });
    }
    function SetUpReadableByteStreamControllerFromUnderlyingSource(stream, underlyingByteSource, highWaterMark) {
        const controller = Object.create(ReadableByteStreamController.prototype);
        let startAlgorithm;
        let pullAlgorithm;
        let cancelAlgorithm;
        if (underlyingByteSource.start !== undefined) {
            startAlgorithm = ()=>underlyingByteSource.start(controller);
        } else {
            startAlgorithm = ()=>undefined;
        }
        if (underlyingByteSource.pull !== undefined) {
            pullAlgorithm = ()=>underlyingByteSource.pull(controller);
        } else {
            pullAlgorithm = ()=>promiseResolvedWith(undefined);
        }
        if (underlyingByteSource.cancel !== undefined) {
            cancelAlgorithm = (reason)=>underlyingByteSource.cancel(reason);
        } else {
            cancelAlgorithm = ()=>promiseResolvedWith(undefined);
        }
        const autoAllocateChunkSize = underlyingByteSource.autoAllocateChunkSize;
        if (autoAllocateChunkSize === 0) {
            throw new TypeError('autoAllocateChunkSize must be greater than 0');
        }
        SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, autoAllocateChunkSize);
    }
    function SetUpReadableStreamBYOBRequest(request, controller, view) {
        request._associatedReadableByteStreamController = controller;
        request._view = view;
    }
    // Helper functions for the ReadableStreamBYOBRequest.
    function byobRequestBrandCheckException(name) {
        return new TypeError(`ReadableStreamBYOBRequest.prototype.${name} can only be used on a ReadableStreamBYOBRequest`);
    }
    // Helper functions for the ReadableByteStreamController.
    function byteStreamControllerBrandCheckException(name) {
        return new TypeError(`ReadableByteStreamController.prototype.${name} can only be used on a ReadableByteStreamController`);
    }
    function convertReaderOptions(options, context) {
        assertDictionary(options, context);
        const mode = options === null || options === void 0 ? void 0 : options.mode;
        return {
            mode: mode === undefined ? undefined : convertReadableStreamReaderMode(mode, `${context} has member 'mode' that`)
        };
    }
    function convertReadableStreamReaderMode(mode, context) {
        mode = `${mode}`;
        if (mode !== 'byob') {
            throw new TypeError(`${context} '${mode}' is not a valid enumeration value for ReadableStreamReaderMode`);
        }
        return mode;
    }
    function convertByobReadOptions(options, context) {
        var _a;
        assertDictionary(options, context);
        const min = (_a = options === null || options === void 0 ? void 0 : options.min) !== null && _a !== void 0 ? _a : 1;
        return {
            min: convertUnsignedLongLongWithEnforceRange(min, `${context} has member 'min' that`)
        };
    }
    // Abstract operations for the ReadableStream.
    function AcquireReadableStreamBYOBReader(stream) {
        return new ReadableStreamBYOBReader(stream);
    }
    // ReadableStream API exposed for controllers.
    function ReadableStreamAddReadIntoRequest(stream, readIntoRequest) {
        stream._reader._readIntoRequests.push(readIntoRequest);
    }
    function ReadableStreamFulfillReadIntoRequest(stream, chunk, done) {
        const reader = stream._reader;
        const readIntoRequest = reader._readIntoRequests.shift();
        if (done) {
            readIntoRequest._closeSteps(chunk);
        } else {
            readIntoRequest._chunkSteps(chunk);
        }
    }
    function ReadableStreamGetNumReadIntoRequests(stream) {
        return stream._reader._readIntoRequests.length;
    }
    function ReadableStreamHasBYOBReader(stream) {
        const reader = stream._reader;
        if (reader === undefined) {
            return false;
        }
        if (!IsReadableStreamBYOBReader(reader)) {
            return false;
        }
        return true;
    }
    /**
     * A BYOB reader vended by a {@link ReadableStream}.
     *
     * @public
     */ class ReadableStreamBYOBReader {
        constructor(stream){
            assertRequiredArgument(stream, 1, 'ReadableStreamBYOBReader');
            assertReadableStream(stream, 'First parameter');
            if (IsReadableStreamLocked(stream)) {
                throw new TypeError('This stream has already been locked for exclusive reading by another reader');
            }
            if (!IsReadableByteStreamController(stream._readableStreamController)) {
                throw new TypeError('Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte ' + 'source');
            }
            ReadableStreamReaderGenericInitialize(this, stream);
            this._readIntoRequests = new SimpleQueue();
        }
        /**
         * Returns a promise that will be fulfilled when the stream becomes closed, or rejected if the stream ever errors or
         * the reader's lock is released before the stream finishes closing.
         */ get closed() {
            if (!IsReadableStreamBYOBReader(this)) {
                return promiseRejectedWith(byobReaderBrandCheckException('closed'));
            }
            return this._closedPromise;
        }
        /**
         * If the reader is active, behaves the same as {@link ReadableStream.cancel | stream.cancel(reason)}.
         */ cancel(reason = undefined) {
            if (!IsReadableStreamBYOBReader(this)) {
                return promiseRejectedWith(byobReaderBrandCheckException('cancel'));
            }
            if (this._ownerReadableStream === undefined) {
                return promiseRejectedWith(readerLockException('cancel'));
            }
            return ReadableStreamReaderGenericCancel(this, reason);
        }
        read(view, rawOptions = {}) {
            if (!IsReadableStreamBYOBReader(this)) {
                return promiseRejectedWith(byobReaderBrandCheckException('read'));
            }
            if (!ArrayBuffer.isView(view)) {
                return promiseRejectedWith(new TypeError('view must be an array buffer view'));
            }
            if (view.byteLength === 0) {
                return promiseRejectedWith(new TypeError('view must have non-zero byteLength'));
            }
            if (view.buffer.byteLength === 0) {
                return promiseRejectedWith(new TypeError(`view's buffer must have non-zero byteLength`));
            }
            if (IsDetachedBuffer(view.buffer)) {
                return promiseRejectedWith(new TypeError('view\'s buffer has been detached'));
            }
            let options;
            try {
                options = convertByobReadOptions(rawOptions, 'options');
            } catch (e) {
                return promiseRejectedWith(e);
            }
            const min = options.min;
            if (min === 0) {
                return promiseRejectedWith(new TypeError('options.min must be greater than 0'));
            }
            if (!isDataView(view)) {
                if (min > view.length) {
                    return promiseRejectedWith(new RangeError('options.min must be less than or equal to view\'s length'));
                }
            } else if (min > view.byteLength) {
                return promiseRejectedWith(new RangeError('options.min must be less than or equal to view\'s byteLength'));
            }
            if (this._ownerReadableStream === undefined) {
                return promiseRejectedWith(readerLockException('read from'));
            }
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve, reject)=>{
                resolvePromise = resolve;
                rejectPromise = reject;
            });
            const readIntoRequest = {
                _chunkSteps: (chunk)=>resolvePromise({
                        value: chunk,
                        done: false
                    }),
                _closeSteps: (chunk)=>resolvePromise({
                        value: chunk,
                        done: true
                    }),
                _errorSteps: (e)=>rejectPromise(e)
            };
            ReadableStreamBYOBReaderRead(this, view, min, readIntoRequest);
            return promise;
        }
        /**
         * Releases the reader's lock on the corresponding stream. After the lock is released, the reader is no longer active.
         * If the associated stream is errored when the lock is released, the reader will appear errored in the same way
         * from now on; otherwise, the reader will appear closed.
         *
         * A reader's lock cannot be released while it still has a pending read request, i.e., if a promise returned by
         * the reader's {@link ReadableStreamBYOBReader.read | read()} method has not yet been settled. Attempting to
         * do so will throw a `TypeError` and leave the reader locked to the stream.
         */ releaseLock() {
            if (!IsReadableStreamBYOBReader(this)) {
                throw byobReaderBrandCheckException('releaseLock');
            }
            if (this._ownerReadableStream === undefined) {
                return;
            }
            ReadableStreamBYOBReaderRelease(this);
        }
    }
    Object.defineProperties(ReadableStreamBYOBReader.prototype, {
        cancel: {
            enumerable: true
        },
        read: {
            enumerable: true
        },
        releaseLock: {
            enumerable: true
        },
        closed: {
            enumerable: true
        }
    });
    setFunctionName(ReadableStreamBYOBReader.prototype.cancel, 'cancel');
    setFunctionName(ReadableStreamBYOBReader.prototype.read, 'read');
    setFunctionName(ReadableStreamBYOBReader.prototype.releaseLock, 'releaseLock');
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(ReadableStreamBYOBReader.prototype, Symbol.toStringTag, {
            value: 'ReadableStreamBYOBReader',
            configurable: true
        });
    }
    // Abstract operations for the readers.
    function IsReadableStreamBYOBReader(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_readIntoRequests')) {
            return false;
        }
        return x instanceof ReadableStreamBYOBReader;
    }
    function ReadableStreamBYOBReaderRead(reader, view, min, readIntoRequest) {
        const stream = reader._ownerReadableStream;
        stream._disturbed = true;
        if (stream._state === 'errored') {
            readIntoRequest._errorSteps(stream._storedError);
        } else {
            ReadableByteStreamControllerPullInto(stream._readableStreamController, view, min, readIntoRequest);
        }
    }
    function ReadableStreamBYOBReaderRelease(reader) {
        ReadableStreamReaderGenericRelease(reader);
        const e = new TypeError('Reader was released');
        ReadableStreamBYOBReaderErrorReadIntoRequests(reader, e);
    }
    function ReadableStreamBYOBReaderErrorReadIntoRequests(reader, e) {
        const readIntoRequests = reader._readIntoRequests;
        reader._readIntoRequests = new SimpleQueue();
        readIntoRequests.forEach((readIntoRequest)=>{
            readIntoRequest._errorSteps(e);
        });
    }
    // Helper functions for the ReadableStreamBYOBReader.
    function byobReaderBrandCheckException(name) {
        return new TypeError(`ReadableStreamBYOBReader.prototype.${name} can only be used on a ReadableStreamBYOBReader`);
    }
    function ExtractHighWaterMark(strategy, defaultHWM) {
        const { highWaterMark } = strategy;
        if (highWaterMark === undefined) {
            return defaultHWM;
        }
        if (NumberIsNaN(highWaterMark) || highWaterMark < 0) {
            throw new RangeError('Invalid highWaterMark');
        }
        return highWaterMark;
    }
    function ExtractSizeAlgorithm(strategy) {
        const { size } = strategy;
        if (!size) {
            return ()=>1;
        }
        return size;
    }
    function convertQueuingStrategy(init, context) {
        assertDictionary(init, context);
        const highWaterMark = init === null || init === void 0 ? void 0 : init.highWaterMark;
        const size = init === null || init === void 0 ? void 0 : init.size;
        return {
            highWaterMark: highWaterMark === undefined ? undefined : convertUnrestrictedDouble(highWaterMark),
            size: size === undefined ? undefined : convertQueuingStrategySize(size, `${context} has member 'size' that`)
        };
    }
    function convertQueuingStrategySize(fn, context) {
        assertFunction(fn, context);
        return (chunk)=>convertUnrestrictedDouble(fn(chunk));
    }
    function convertUnderlyingSink(original, context) {
        assertDictionary(original, context);
        const abort = original === null || original === void 0 ? void 0 : original.abort;
        const close = original === null || original === void 0 ? void 0 : original.close;
        const start = original === null || original === void 0 ? void 0 : original.start;
        const type = original === null || original === void 0 ? void 0 : original.type;
        const write = original === null || original === void 0 ? void 0 : original.write;
        return {
            abort: abort === undefined ? undefined : convertUnderlyingSinkAbortCallback(abort, original, `${context} has member 'abort' that`),
            close: close === undefined ? undefined : convertUnderlyingSinkCloseCallback(close, original, `${context} has member 'close' that`),
            start: start === undefined ? undefined : convertUnderlyingSinkStartCallback(start, original, `${context} has member 'start' that`),
            write: write === undefined ? undefined : convertUnderlyingSinkWriteCallback(write, original, `${context} has member 'write' that`),
            type
        };
    }
    function convertUnderlyingSinkAbortCallback(fn, original, context) {
        assertFunction(fn, context);
        return (reason)=>promiseCall(fn, original, [
                reason
            ]);
    }
    function convertUnderlyingSinkCloseCallback(fn, original, context) {
        assertFunction(fn, context);
        return ()=>promiseCall(fn, original, []);
    }
    function convertUnderlyingSinkStartCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller)=>reflectCall(fn, original, [
                controller
            ]);
    }
    function convertUnderlyingSinkWriteCallback(fn, original, context) {
        assertFunction(fn, context);
        return (chunk, controller)=>promiseCall(fn, original, [
                chunk,
                controller
            ]);
    }
    function assertWritableStream(x, context) {
        if (!IsWritableStream(x)) {
            throw new TypeError(`${context} is not a WritableStream.`);
        }
    }
    function isAbortSignal(value) {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        try {
            return typeof value.aborted === 'boolean';
        } catch (_a) {
            // AbortSignal.prototype.aborted throws if its brand check fails
            return false;
        }
    }
    const supportsAbortController = typeof AbortController === 'function';
    /**
     * Construct a new AbortController, if supported by the platform.
     *
     * @internal
     */ function createAbortController() {
        if (supportsAbortController) {
            return new AbortController();
        }
        return undefined;
    }
    /**
     * A writable stream represents a destination for data, into which you can write.
     *
     * @public
     */ class WritableStream {
        constructor(rawUnderlyingSink = {}, rawStrategy = {}){
            if (rawUnderlyingSink === undefined) {
                rawUnderlyingSink = null;
            } else {
                assertObject(rawUnderlyingSink, 'First parameter');
            }
            const strategy = convertQueuingStrategy(rawStrategy, 'Second parameter');
            const underlyingSink = convertUnderlyingSink(rawUnderlyingSink, 'First parameter');
            InitializeWritableStream(this);
            const type = underlyingSink.type;
            if (type !== undefined) {
                throw new RangeError('Invalid type is specified');
            }
            const sizeAlgorithm = ExtractSizeAlgorithm(strategy);
            const highWaterMark = ExtractHighWaterMark(strategy, 1);
            SetUpWritableStreamDefaultControllerFromUnderlyingSink(this, underlyingSink, highWaterMark, sizeAlgorithm);
        }
        /**
         * Returns whether or not the writable stream is locked to a writer.
         */ get locked() {
            if (!IsWritableStream(this)) {
                throw streamBrandCheckException$2('locked');
            }
            return IsWritableStreamLocked(this);
        }
        /**
         * Aborts the stream, signaling that the producer can no longer successfully write to the stream and it is to be
         * immediately moved to an errored state, with any queued-up writes discarded. This will also execute any abort
         * mechanism of the underlying sink.
         *
         * The returned promise will fulfill if the stream shuts down successfully, or reject if the underlying sink signaled
         * that there was an error doing so. Additionally, it will reject with a `TypeError` (without attempting to cancel
         * the stream) if the stream is currently locked.
         */ abort(reason = undefined) {
            if (!IsWritableStream(this)) {
                return promiseRejectedWith(streamBrandCheckException$2('abort'));
            }
            if (IsWritableStreamLocked(this)) {
                return promiseRejectedWith(new TypeError('Cannot abort a stream that already has a writer'));
            }
            return WritableStreamAbort(this, reason);
        }
        /**
         * Closes the stream. The underlying sink will finish processing any previously-written chunks, before invoking its
         * close behavior. During this time any further attempts to write will fail (without erroring the stream).
         *
         * The method returns a promise that will fulfill if all remaining chunks are successfully written and the stream
         * successfully closes, or rejects if an error is encountered during this process. Additionally, it will reject with
         * a `TypeError` (without attempting to cancel the stream) if the stream is currently locked.
         */ close() {
            if (!IsWritableStream(this)) {
                return promiseRejectedWith(streamBrandCheckException$2('close'));
            }
            if (IsWritableStreamLocked(this)) {
                return promiseRejectedWith(new TypeError('Cannot close a stream that already has a writer'));
            }
            if (WritableStreamCloseQueuedOrInFlight(this)) {
                return promiseRejectedWith(new TypeError('Cannot close an already-closing stream'));
            }
            return WritableStreamClose(this);
        }
        /**
         * Creates a {@link WritableStreamDefaultWriter | writer} and locks the stream to the new writer. While the stream
         * is locked, no other writer can be acquired until this one is released.
         *
         * This functionality is especially useful for creating abstractions that desire the ability to write to a stream
         * without interruption or interleaving. By getting a writer for the stream, you can ensure nobody else can write at
         * the same time, which would cause the resulting written data to be unpredictable and probably useless.
         */ getWriter() {
            if (!IsWritableStream(this)) {
                throw streamBrandCheckException$2('getWriter');
            }
            return AcquireWritableStreamDefaultWriter(this);
        }
    }
    Object.defineProperties(WritableStream.prototype, {
        abort: {
            enumerable: true
        },
        close: {
            enumerable: true
        },
        getWriter: {
            enumerable: true
        },
        locked: {
            enumerable: true
        }
    });
    setFunctionName(WritableStream.prototype.abort, 'abort');
    setFunctionName(WritableStream.prototype.close, 'close');
    setFunctionName(WritableStream.prototype.getWriter, 'getWriter');
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(WritableStream.prototype, Symbol.toStringTag, {
            value: 'WritableStream',
            configurable: true
        });
    }
    // Abstract operations for the WritableStream.
    function AcquireWritableStreamDefaultWriter(stream) {
        return new WritableStreamDefaultWriter(stream);
    }
    // Throws if and only if startAlgorithm throws.
    function CreateWritableStream(startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark = 1, sizeAlgorithm = ()=>1) {
        const stream = Object.create(WritableStream.prototype);
        InitializeWritableStream(stream);
        const controller = Object.create(WritableStreamDefaultController.prototype);
        SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm);
        return stream;
    }
    function InitializeWritableStream(stream) {
        stream._state = 'writable';
        // The error that will be reported by new method calls once the state becomes errored. Only set when [[state]] is
        // 'erroring' or 'errored'. May be set to an undefined value.
        stream._storedError = undefined;
        stream._writer = undefined;
        // Initialize to undefined first because the constructor of the controller checks this
        // variable to validate the caller.
        stream._writableStreamController = undefined;
        // This queue is placed here instead of the writer class in order to allow for passing a writer to the next data
        // producer without waiting for the queued writes to finish.
        stream._writeRequests = new SimpleQueue();
        // Write requests are removed from _writeRequests when write() is called on the underlying sink. This prevents
        // them from being erroneously rejected on error. If a write() call is in-flight, the request is stored here.
        stream._inFlightWriteRequest = undefined;
        // The promise that was returned from writer.close(). Stored here because it may be fulfilled after the writer
        // has been detached.
        stream._closeRequest = undefined;
        // Close request is removed from _closeRequest when close() is called on the underlying sink. This prevents it
        // from being erroneously rejected on error. If a close() call is in-flight, the request is stored here.
        stream._inFlightCloseRequest = undefined;
        // The promise that was returned from writer.abort(). This may also be fulfilled after the writer has detached.
        stream._pendingAbortRequest = undefined;
        // The backpressure signal set by the controller.
        stream._backpressure = false;
    }
    function IsWritableStream(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_writableStreamController')) {
            return false;
        }
        return x instanceof WritableStream;
    }
    function IsWritableStreamLocked(stream) {
        if (stream._writer === undefined) {
            return false;
        }
        return true;
    }
    function WritableStreamAbort(stream, reason) {
        var _a;
        if (stream._state === 'closed' || stream._state === 'errored') {
            return promiseResolvedWith(undefined);
        }
        stream._writableStreamController._abortReason = reason;
        (_a = stream._writableStreamController._abortController) === null || _a === void 0 ? void 0 : _a.abort(reason);
        // TypeScript narrows the type of `stream._state` down to 'writable' | 'erroring',
        // but it doesn't know that signaling abort runs author code that might have changed the state.
        // Widen the type again by casting to WritableStreamState.
        const state = stream._state;
        if (state === 'closed' || state === 'errored') {
            return promiseResolvedWith(undefined);
        }
        if (stream._pendingAbortRequest !== undefined) {
            return stream._pendingAbortRequest._promise;
        }
        let wasAlreadyErroring = false;
        if (state === 'erroring') {
            wasAlreadyErroring = true;
            // reason will not be used, so don't keep a reference to it.
            reason = undefined;
        }
        const promise = newPromise((resolve, reject)=>{
            stream._pendingAbortRequest = {
                _promise: undefined,
                _resolve: resolve,
                _reject: reject,
                _reason: reason,
                _wasAlreadyErroring: wasAlreadyErroring
            };
        });
        stream._pendingAbortRequest._promise = promise;
        if (!wasAlreadyErroring) {
            WritableStreamStartErroring(stream, reason);
        }
        return promise;
    }
    function WritableStreamClose(stream) {
        const state = stream._state;
        if (state === 'closed' || state === 'errored') {
            return promiseRejectedWith(new TypeError(`The stream (in ${state} state) is not in the writable state and cannot be closed`));
        }
        const promise = newPromise((resolve, reject)=>{
            const closeRequest = {
                _resolve: resolve,
                _reject: reject
            };
            stream._closeRequest = closeRequest;
        });
        const writer = stream._writer;
        if (writer !== undefined && stream._backpressure && state === 'writable') {
            defaultWriterReadyPromiseResolve(writer);
        }
        WritableStreamDefaultControllerClose(stream._writableStreamController);
        return promise;
    }
    // WritableStream API exposed for controllers.
    function WritableStreamAddWriteRequest(stream) {
        const promise = newPromise((resolve, reject)=>{
            const writeRequest = {
                _resolve: resolve,
                _reject: reject
            };
            stream._writeRequests.push(writeRequest);
        });
        return promise;
    }
    function WritableStreamDealWithRejection(stream, error) {
        const state = stream._state;
        if (state === 'writable') {
            WritableStreamStartErroring(stream, error);
            return;
        }
        WritableStreamFinishErroring(stream);
    }
    function WritableStreamStartErroring(stream, reason) {
        const controller = stream._writableStreamController;
        stream._state = 'erroring';
        stream._storedError = reason;
        const writer = stream._writer;
        if (writer !== undefined) {
            WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, reason);
        }
        if (!WritableStreamHasOperationMarkedInFlight(stream) && controller._started) {
            WritableStreamFinishErroring(stream);
        }
    }
    function WritableStreamFinishErroring(stream) {
        stream._state = 'errored';
        stream._writableStreamController[ErrorSteps]();
        const storedError = stream._storedError;
        stream._writeRequests.forEach((writeRequest)=>{
            writeRequest._reject(storedError);
        });
        stream._writeRequests = new SimpleQueue();
        if (stream._pendingAbortRequest === undefined) {
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
            return;
        }
        const abortRequest = stream._pendingAbortRequest;
        stream._pendingAbortRequest = undefined;
        if (abortRequest._wasAlreadyErroring) {
            abortRequest._reject(storedError);
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
            return;
        }
        const promise = stream._writableStreamController[AbortSteps](abortRequest._reason);
        uponPromise(promise, ()=>{
            abortRequest._resolve();
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
            return null;
        }, (reason)=>{
            abortRequest._reject(reason);
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
            return null;
        });
    }
    function WritableStreamFinishInFlightWrite(stream) {
        stream._inFlightWriteRequest._resolve(undefined);
        stream._inFlightWriteRequest = undefined;
    }
    function WritableStreamFinishInFlightWriteWithError(stream, error) {
        stream._inFlightWriteRequest._reject(error);
        stream._inFlightWriteRequest = undefined;
        WritableStreamDealWithRejection(stream, error);
    }
    function WritableStreamFinishInFlightClose(stream) {
        stream._inFlightCloseRequest._resolve(undefined);
        stream._inFlightCloseRequest = undefined;
        const state = stream._state;
        if (state === 'erroring') {
            // The error was too late to do anything, so it is ignored.
            stream._storedError = undefined;
            if (stream._pendingAbortRequest !== undefined) {
                stream._pendingAbortRequest._resolve();
                stream._pendingAbortRequest = undefined;
            }
        }
        stream._state = 'closed';
        const writer = stream._writer;
        if (writer !== undefined) {
            defaultWriterClosedPromiseResolve(writer);
        }
    }
    function WritableStreamFinishInFlightCloseWithError(stream, error) {
        stream._inFlightCloseRequest._reject(error);
        stream._inFlightCloseRequest = undefined;
        // Never execute sink abort() after sink close().
        if (stream._pendingAbortRequest !== undefined) {
            stream._pendingAbortRequest._reject(error);
            stream._pendingAbortRequest = undefined;
        }
        WritableStreamDealWithRejection(stream, error);
    }
    // TODO(ricea): Fix alphabetical order.
    function WritableStreamCloseQueuedOrInFlight(stream) {
        if (stream._closeRequest === undefined && stream._inFlightCloseRequest === undefined) {
            return false;
        }
        return true;
    }
    function WritableStreamHasOperationMarkedInFlight(stream) {
        if (stream._inFlightWriteRequest === undefined && stream._inFlightCloseRequest === undefined) {
            return false;
        }
        return true;
    }
    function WritableStreamMarkCloseRequestInFlight(stream) {
        stream._inFlightCloseRequest = stream._closeRequest;
        stream._closeRequest = undefined;
    }
    function WritableStreamMarkFirstWriteRequestInFlight(stream) {
        stream._inFlightWriteRequest = stream._writeRequests.shift();
    }
    function WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream) {
        if (stream._closeRequest !== undefined) {
            stream._closeRequest._reject(stream._storedError);
            stream._closeRequest = undefined;
        }
        const writer = stream._writer;
        if (writer !== undefined) {
            defaultWriterClosedPromiseReject(writer, stream._storedError);
        }
    }
    function WritableStreamUpdateBackpressure(stream, backpressure) {
        const writer = stream._writer;
        if (writer !== undefined && backpressure !== stream._backpressure) {
            if (backpressure) {
                defaultWriterReadyPromiseReset(writer);
            } else {
                defaultWriterReadyPromiseResolve(writer);
            }
        }
        stream._backpressure = backpressure;
    }
    /**
     * A default writer vended by a {@link WritableStream}.
     *
     * @public
     */ class WritableStreamDefaultWriter {
        constructor(stream){
            assertRequiredArgument(stream, 1, 'WritableStreamDefaultWriter');
            assertWritableStream(stream, 'First parameter');
            if (IsWritableStreamLocked(stream)) {
                throw new TypeError('This stream has already been locked for exclusive writing by another writer');
            }
            this._ownerWritableStream = stream;
            stream._writer = this;
            const state = stream._state;
            if (state === 'writable') {
                if (!WritableStreamCloseQueuedOrInFlight(stream) && stream._backpressure) {
                    defaultWriterReadyPromiseInitialize(this);
                } else {
                    defaultWriterReadyPromiseInitializeAsResolved(this);
                }
                defaultWriterClosedPromiseInitialize(this);
            } else if (state === 'erroring') {
                defaultWriterReadyPromiseInitializeAsRejected(this, stream._storedError);
                defaultWriterClosedPromiseInitialize(this);
            } else if (state === 'closed') {
                defaultWriterReadyPromiseInitializeAsResolved(this);
                defaultWriterClosedPromiseInitializeAsResolved(this);
            } else {
                const storedError = stream._storedError;
                defaultWriterReadyPromiseInitializeAsRejected(this, storedError);
                defaultWriterClosedPromiseInitializeAsRejected(this, storedError);
            }
        }
        /**
         * Returns a promise that will be fulfilled when the stream becomes closed, or rejected if the stream ever errors or
         * the writer’s lock is released before the stream finishes closing.
         */ get closed() {
            if (!IsWritableStreamDefaultWriter(this)) {
                return promiseRejectedWith(defaultWriterBrandCheckException('closed'));
            }
            return this._closedPromise;
        }
        /**
         * Returns the desired size to fill the stream’s internal queue. It can be negative, if the queue is over-full.
         * A producer can use this information to determine the right amount of data to write.
         *
         * It will be `null` if the stream cannot be successfully written to (due to either being errored, or having an abort
         * queued up). It will return zero if the stream is closed. And the getter will throw an exception if invoked when
         * the writer’s lock is released.
         */ get desiredSize() {
            if (!IsWritableStreamDefaultWriter(this)) {
                throw defaultWriterBrandCheckException('desiredSize');
            }
            if (this._ownerWritableStream === undefined) {
                throw defaultWriterLockException('desiredSize');
            }
            return WritableStreamDefaultWriterGetDesiredSize(this);
        }
        /**
         * Returns a promise that will be fulfilled when the desired size to fill the stream’s internal queue transitions
         * from non-positive to positive, signaling that it is no longer applying backpressure. Once the desired size dips
         * back to zero or below, the getter will return a new promise that stays pending until the next transition.
         *
         * If the stream becomes errored or aborted, or the writer’s lock is released, the returned promise will become
         * rejected.
         */ get ready() {
            if (!IsWritableStreamDefaultWriter(this)) {
                return promiseRejectedWith(defaultWriterBrandCheckException('ready'));
            }
            return this._readyPromise;
        }
        /**
         * If the reader is active, behaves the same as {@link WritableStream.abort | stream.abort(reason)}.
         */ abort(reason = undefined) {
            if (!IsWritableStreamDefaultWriter(this)) {
                return promiseRejectedWith(defaultWriterBrandCheckException('abort'));
            }
            if (this._ownerWritableStream === undefined) {
                return promiseRejectedWith(defaultWriterLockException('abort'));
            }
            return WritableStreamDefaultWriterAbort(this, reason);
        }
        /**
         * If the reader is active, behaves the same as {@link WritableStream.close | stream.close()}.
         */ close() {
            if (!IsWritableStreamDefaultWriter(this)) {
                return promiseRejectedWith(defaultWriterBrandCheckException('close'));
            }
            const stream = this._ownerWritableStream;
            if (stream === undefined) {
                return promiseRejectedWith(defaultWriterLockException('close'));
            }
            if (WritableStreamCloseQueuedOrInFlight(stream)) {
                return promiseRejectedWith(new TypeError('Cannot close an already-closing stream'));
            }
            return WritableStreamDefaultWriterClose(this);
        }
        /**
         * Releases the writer’s lock on the corresponding stream. After the lock is released, the writer is no longer active.
         * If the associated stream is errored when the lock is released, the writer will appear errored in the same way from
         * now on; otherwise, the writer will appear closed.
         *
         * Note that the lock can still be released even if some ongoing writes have not yet finished (i.e. even if the
         * promises returned from previous calls to {@link WritableStreamDefaultWriter.write | write()} have not yet settled).
         * It’s not necessary to hold the lock on the writer for the duration of the write; the lock instead simply prevents
         * other producers from writing in an interleaved manner.
         */ releaseLock() {
            if (!IsWritableStreamDefaultWriter(this)) {
                throw defaultWriterBrandCheckException('releaseLock');
            }
            const stream = this._ownerWritableStream;
            if (stream === undefined) {
                return;
            }
            WritableStreamDefaultWriterRelease(this);
        }
        write(chunk = undefined) {
            if (!IsWritableStreamDefaultWriter(this)) {
                return promiseRejectedWith(defaultWriterBrandCheckException('write'));
            }
            if (this._ownerWritableStream === undefined) {
                return promiseRejectedWith(defaultWriterLockException('write to'));
            }
            return WritableStreamDefaultWriterWrite(this, chunk);
        }
    }
    Object.defineProperties(WritableStreamDefaultWriter.prototype, {
        abort: {
            enumerable: true
        },
        close: {
            enumerable: true
        },
        releaseLock: {
            enumerable: true
        },
        write: {
            enumerable: true
        },
        closed: {
            enumerable: true
        },
        desiredSize: {
            enumerable: true
        },
        ready: {
            enumerable: true
        }
    });
    setFunctionName(WritableStreamDefaultWriter.prototype.abort, 'abort');
    setFunctionName(WritableStreamDefaultWriter.prototype.close, 'close');
    setFunctionName(WritableStreamDefaultWriter.prototype.releaseLock, 'releaseLock');
    setFunctionName(WritableStreamDefaultWriter.prototype.write, 'write');
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(WritableStreamDefaultWriter.prototype, Symbol.toStringTag, {
            value: 'WritableStreamDefaultWriter',
            configurable: true
        });
    }
    // Abstract operations for the WritableStreamDefaultWriter.
    function IsWritableStreamDefaultWriter(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_ownerWritableStream')) {
            return false;
        }
        return x instanceof WritableStreamDefaultWriter;
    }
    // A client of WritableStreamDefaultWriter may use these functions directly to bypass state check.
    function WritableStreamDefaultWriterAbort(writer, reason) {
        const stream = writer._ownerWritableStream;
        return WritableStreamAbort(stream, reason);
    }
    function WritableStreamDefaultWriterClose(writer) {
        const stream = writer._ownerWritableStream;
        return WritableStreamClose(stream);
    }
    function WritableStreamDefaultWriterCloseWithErrorPropagation(writer) {
        const stream = writer._ownerWritableStream;
        const state = stream._state;
        if (WritableStreamCloseQueuedOrInFlight(stream) || state === 'closed') {
            return promiseResolvedWith(undefined);
        }
        if (state === 'errored') {
            return promiseRejectedWith(stream._storedError);
        }
        return WritableStreamDefaultWriterClose(writer);
    }
    function WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer, error) {
        if (writer._closedPromiseState === 'pending') {
            defaultWriterClosedPromiseReject(writer, error);
        } else {
            defaultWriterClosedPromiseResetToRejected(writer, error);
        }
    }
    function WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, error) {
        if (writer._readyPromiseState === 'pending') {
            defaultWriterReadyPromiseReject(writer, error);
        } else {
            defaultWriterReadyPromiseResetToRejected(writer, error);
        }
    }
    function WritableStreamDefaultWriterGetDesiredSize(writer) {
        const stream = writer._ownerWritableStream;
        const state = stream._state;
        if (state === 'errored' || state === 'erroring') {
            return null;
        }
        if (state === 'closed') {
            return 0;
        }
        return WritableStreamDefaultControllerGetDesiredSize(stream._writableStreamController);
    }
    function WritableStreamDefaultWriterRelease(writer) {
        const stream = writer._ownerWritableStream;
        const releasedError = new TypeError(`Writer was released and can no longer be used to monitor the stream's closedness`);
        WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, releasedError);
        // The state transitions to "errored" before the sink abort() method runs, but the writer.closed promise is not
        // rejected until afterwards. This means that simply testing state will not work.
        WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer, releasedError);
        stream._writer = undefined;
        writer._ownerWritableStream = undefined;
    }
    function WritableStreamDefaultWriterWrite(writer, chunk) {
        const stream = writer._ownerWritableStream;
        const controller = stream._writableStreamController;
        const chunkSize = WritableStreamDefaultControllerGetChunkSize(controller, chunk);
        if (stream !== writer._ownerWritableStream) {
            return promiseRejectedWith(defaultWriterLockException('write to'));
        }
        const state = stream._state;
        if (state === 'errored') {
            return promiseRejectedWith(stream._storedError);
        }
        if (WritableStreamCloseQueuedOrInFlight(stream) || state === 'closed') {
            return promiseRejectedWith(new TypeError('The stream is closing or closed and cannot be written to'));
        }
        if (state === 'erroring') {
            return promiseRejectedWith(stream._storedError);
        }
        const promise = WritableStreamAddWriteRequest(stream);
        WritableStreamDefaultControllerWrite(controller, chunk, chunkSize);
        return promise;
    }
    const closeSentinel = {};
    /**
     * Allows control of a {@link WritableStream | writable stream}'s state and internal queue.
     *
     * @public
     */ class WritableStreamDefaultController {
        constructor(){
            throw new TypeError('Illegal constructor');
        }
        /**
         * The reason which was passed to `WritableStream.abort(reason)` when the stream was aborted.
         *
         * @deprecated
         *  This property has been removed from the specification, see https://github.com/whatwg/streams/pull/1177.
         *  Use {@link WritableStreamDefaultController.signal}'s `reason` instead.
         */ get abortReason() {
            if (!IsWritableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$2('abortReason');
            }
            return this._abortReason;
        }
        /**
         * An `AbortSignal` that can be used to abort the pending write or close operation when the stream is aborted.
         */ get signal() {
            if (!IsWritableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$2('signal');
            }
            if (this._abortController === undefined) {
                // Older browsers or older Node versions may not support `AbortController` or `AbortSignal`.
                // We don't want to bundle and ship an `AbortController` polyfill together with our polyfill,
                // so instead we only implement support for `signal` if we find a global `AbortController` constructor.
                throw new TypeError('WritableStreamDefaultController.prototype.signal is not supported');
            }
            return this._abortController.signal;
        }
        /**
         * Closes the controlled writable stream, making all future interactions with it fail with the given error `e`.
         *
         * This method is rarely used, since usually it suffices to return a rejected promise from one of the underlying
         * sink's methods. However, it can be useful for suddenly shutting down a stream in response to an event outside the
         * normal lifecycle of interactions with the underlying sink.
         */ error(e = undefined) {
            if (!IsWritableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$2('error');
            }
            const state = this._controlledWritableStream._state;
            if (state !== 'writable') {
                // The stream is closed, errored or will be soon. The sink can't do anything useful if it gets an error here, so
                // just treat it as a no-op.
                return;
            }
            WritableStreamDefaultControllerError(this, e);
        }
        /** @internal */ [AbortSteps](reason) {
            const result = this._abortAlgorithm(reason);
            WritableStreamDefaultControllerClearAlgorithms(this);
            return result;
        }
        /** @internal */ [ErrorSteps]() {
            ResetQueue(this);
        }
    }
    Object.defineProperties(WritableStreamDefaultController.prototype, {
        abortReason: {
            enumerable: true
        },
        signal: {
            enumerable: true
        },
        error: {
            enumerable: true
        }
    });
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(WritableStreamDefaultController.prototype, Symbol.toStringTag, {
            value: 'WritableStreamDefaultController',
            configurable: true
        });
    }
    // Abstract operations implementing interface required by the WritableStream.
    function IsWritableStreamDefaultController(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_controlledWritableStream')) {
            return false;
        }
        return x instanceof WritableStreamDefaultController;
    }
    function SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm) {
        controller._controlledWritableStream = stream;
        stream._writableStreamController = controller;
        // Need to set the slots so that the assert doesn't fire. In the spec the slots already exist implicitly.
        controller._queue = undefined;
        controller._queueTotalSize = undefined;
        ResetQueue(controller);
        controller._abortReason = undefined;
        controller._abortController = createAbortController();
        controller._started = false;
        controller._strategySizeAlgorithm = sizeAlgorithm;
        controller._strategyHWM = highWaterMark;
        controller._writeAlgorithm = writeAlgorithm;
        controller._closeAlgorithm = closeAlgorithm;
        controller._abortAlgorithm = abortAlgorithm;
        const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
        WritableStreamUpdateBackpressure(stream, backpressure);
        const startResult = startAlgorithm();
        const startPromise = promiseResolvedWith(startResult);
        uponPromise(startPromise, ()=>{
            controller._started = true;
            WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
            return null;
        }, (r)=>{
            controller._started = true;
            WritableStreamDealWithRejection(stream, r);
            return null;
        });
    }
    function SetUpWritableStreamDefaultControllerFromUnderlyingSink(stream, underlyingSink, highWaterMark, sizeAlgorithm) {
        const controller = Object.create(WritableStreamDefaultController.prototype);
        let startAlgorithm;
        let writeAlgorithm;
        let closeAlgorithm;
        let abortAlgorithm;
        if (underlyingSink.start !== undefined) {
            startAlgorithm = ()=>underlyingSink.start(controller);
        } else {
            startAlgorithm = ()=>undefined;
        }
        if (underlyingSink.write !== undefined) {
            writeAlgorithm = (chunk)=>underlyingSink.write(chunk, controller);
        } else {
            writeAlgorithm = ()=>promiseResolvedWith(undefined);
        }
        if (underlyingSink.close !== undefined) {
            closeAlgorithm = ()=>underlyingSink.close();
        } else {
            closeAlgorithm = ()=>promiseResolvedWith(undefined);
        }
        if (underlyingSink.abort !== undefined) {
            abortAlgorithm = (reason)=>underlyingSink.abort(reason);
        } else {
            abortAlgorithm = ()=>promiseResolvedWith(undefined);
        }
        SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm);
    }
    // ClearAlgorithms may be called twice. Erroring the same stream in multiple ways will often result in redundant calls.
    function WritableStreamDefaultControllerClearAlgorithms(controller) {
        controller._writeAlgorithm = undefined;
        controller._closeAlgorithm = undefined;
        controller._abortAlgorithm = undefined;
        controller._strategySizeAlgorithm = undefined;
    }
    function WritableStreamDefaultControllerClose(controller) {
        EnqueueValueWithSize(controller, closeSentinel, 0);
        WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
    }
    function WritableStreamDefaultControllerGetChunkSize(controller, chunk) {
        try {
            return controller._strategySizeAlgorithm(chunk);
        } catch (chunkSizeE) {
            WritableStreamDefaultControllerErrorIfNeeded(controller, chunkSizeE);
            return 1;
        }
    }
    function WritableStreamDefaultControllerGetDesiredSize(controller) {
        return controller._strategyHWM - controller._queueTotalSize;
    }
    function WritableStreamDefaultControllerWrite(controller, chunk, chunkSize) {
        try {
            EnqueueValueWithSize(controller, chunk, chunkSize);
        } catch (enqueueE) {
            WritableStreamDefaultControllerErrorIfNeeded(controller, enqueueE);
            return;
        }
        const stream = controller._controlledWritableStream;
        if (!WritableStreamCloseQueuedOrInFlight(stream) && stream._state === 'writable') {
            const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
            WritableStreamUpdateBackpressure(stream, backpressure);
        }
        WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
    }
    // Abstract operations for the WritableStreamDefaultController.
    function WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller) {
        const stream = controller._controlledWritableStream;
        if (!controller._started) {
            return;
        }
        if (stream._inFlightWriteRequest !== undefined) {
            return;
        }
        const state = stream._state;
        if (state === 'erroring') {
            WritableStreamFinishErroring(stream);
            return;
        }
        if (controller._queue.length === 0) {
            return;
        }
        const value = PeekQueueValue(controller);
        if (value === closeSentinel) {
            WritableStreamDefaultControllerProcessClose(controller);
        } else {
            WritableStreamDefaultControllerProcessWrite(controller, value);
        }
    }
    function WritableStreamDefaultControllerErrorIfNeeded(controller, error) {
        if (controller._controlledWritableStream._state === 'writable') {
            WritableStreamDefaultControllerError(controller, error);
        }
    }
    function WritableStreamDefaultControllerProcessClose(controller) {
        const stream = controller._controlledWritableStream;
        WritableStreamMarkCloseRequestInFlight(stream);
        DequeueValue(controller);
        const sinkClosePromise = controller._closeAlgorithm();
        WritableStreamDefaultControllerClearAlgorithms(controller);
        uponPromise(sinkClosePromise, ()=>{
            WritableStreamFinishInFlightClose(stream);
            return null;
        }, (reason)=>{
            WritableStreamFinishInFlightCloseWithError(stream, reason);
            return null;
        });
    }
    function WritableStreamDefaultControllerProcessWrite(controller, chunk) {
        const stream = controller._controlledWritableStream;
        WritableStreamMarkFirstWriteRequestInFlight(stream);
        const sinkWritePromise = controller._writeAlgorithm(chunk);
        uponPromise(sinkWritePromise, ()=>{
            WritableStreamFinishInFlightWrite(stream);
            const state = stream._state;
            DequeueValue(controller);
            if (!WritableStreamCloseQueuedOrInFlight(stream) && state === 'writable') {
                const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
                WritableStreamUpdateBackpressure(stream, backpressure);
            }
            WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
            return null;
        }, (reason)=>{
            if (stream._state === 'writable') {
                WritableStreamDefaultControllerClearAlgorithms(controller);
            }
            WritableStreamFinishInFlightWriteWithError(stream, reason);
            return null;
        });
    }
    function WritableStreamDefaultControllerGetBackpressure(controller) {
        const desiredSize = WritableStreamDefaultControllerGetDesiredSize(controller);
        return desiredSize <= 0;
    }
    // A client of WritableStreamDefaultController may use these functions directly to bypass state check.
    function WritableStreamDefaultControllerError(controller, error) {
        const stream = controller._controlledWritableStream;
        WritableStreamDefaultControllerClearAlgorithms(controller);
        WritableStreamStartErroring(stream, error);
    }
    // Helper functions for the WritableStream.
    function streamBrandCheckException$2(name) {
        return new TypeError(`WritableStream.prototype.${name} can only be used on a WritableStream`);
    }
    // Helper functions for the WritableStreamDefaultController.
    function defaultControllerBrandCheckException$2(name) {
        return new TypeError(`WritableStreamDefaultController.prototype.${name} can only be used on a WritableStreamDefaultController`);
    }
    // Helper functions for the WritableStreamDefaultWriter.
    function defaultWriterBrandCheckException(name) {
        return new TypeError(`WritableStreamDefaultWriter.prototype.${name} can only be used on a WritableStreamDefaultWriter`);
    }
    function defaultWriterLockException(name) {
        return new TypeError('Cannot ' + name + ' a stream using a released writer');
    }
    function defaultWriterClosedPromiseInitialize(writer) {
        writer._closedPromise = newPromise((resolve, reject)=>{
            writer._closedPromise_resolve = resolve;
            writer._closedPromise_reject = reject;
            writer._closedPromiseState = 'pending';
        });
    }
    function defaultWriterClosedPromiseInitializeAsRejected(writer, reason) {
        defaultWriterClosedPromiseInitialize(writer);
        defaultWriterClosedPromiseReject(writer, reason);
    }
    function defaultWriterClosedPromiseInitializeAsResolved(writer) {
        defaultWriterClosedPromiseInitialize(writer);
        defaultWriterClosedPromiseResolve(writer);
    }
    function defaultWriterClosedPromiseReject(writer, reason) {
        if (writer._closedPromise_reject === undefined) {
            return;
        }
        setPromiseIsHandledToTrue(writer._closedPromise);
        writer._closedPromise_reject(reason);
        writer._closedPromise_resolve = undefined;
        writer._closedPromise_reject = undefined;
        writer._closedPromiseState = 'rejected';
    }
    function defaultWriterClosedPromiseResetToRejected(writer, reason) {
        defaultWriterClosedPromiseInitializeAsRejected(writer, reason);
    }
    function defaultWriterClosedPromiseResolve(writer) {
        if (writer._closedPromise_resolve === undefined) {
            return;
        }
        writer._closedPromise_resolve(undefined);
        writer._closedPromise_resolve = undefined;
        writer._closedPromise_reject = undefined;
        writer._closedPromiseState = 'resolved';
    }
    function defaultWriterReadyPromiseInitialize(writer) {
        writer._readyPromise = newPromise((resolve, reject)=>{
            writer._readyPromise_resolve = resolve;
            writer._readyPromise_reject = reject;
        });
        writer._readyPromiseState = 'pending';
    }
    function defaultWriterReadyPromiseInitializeAsRejected(writer, reason) {
        defaultWriterReadyPromiseInitialize(writer);
        defaultWriterReadyPromiseReject(writer, reason);
    }
    function defaultWriterReadyPromiseInitializeAsResolved(writer) {
        defaultWriterReadyPromiseInitialize(writer);
        defaultWriterReadyPromiseResolve(writer);
    }
    function defaultWriterReadyPromiseReject(writer, reason) {
        if (writer._readyPromise_reject === undefined) {
            return;
        }
        setPromiseIsHandledToTrue(writer._readyPromise);
        writer._readyPromise_reject(reason);
        writer._readyPromise_resolve = undefined;
        writer._readyPromise_reject = undefined;
        writer._readyPromiseState = 'rejected';
    }
    function defaultWriterReadyPromiseReset(writer) {
        defaultWriterReadyPromiseInitialize(writer);
    }
    function defaultWriterReadyPromiseResetToRejected(writer, reason) {
        defaultWriterReadyPromiseInitializeAsRejected(writer, reason);
    }
    function defaultWriterReadyPromiseResolve(writer) {
        if (writer._readyPromise_resolve === undefined) {
            return;
        }
        writer._readyPromise_resolve(undefined);
        writer._readyPromise_resolve = undefined;
        writer._readyPromise_reject = undefined;
        writer._readyPromiseState = 'fulfilled';
    }
    /// <reference lib="dom" />
    function getGlobals() {
        if (typeof globalThis !== 'undefined') {
            return globalThis;
        } else if (typeof self !== 'undefined') {
            return self;
        } else if (typeof global !== 'undefined') {
            return global;
        }
        return undefined;
    }
    const globals = getGlobals();
    /// <reference types="node" />
    function isDOMExceptionConstructor(ctor) {
        if (!(typeof ctor === 'function' || typeof ctor === 'object')) {
            return false;
        }
        if (ctor.name !== 'DOMException') {
            return false;
        }
        try {
            new ctor();
            return true;
        } catch (_a) {
            return false;
        }
    }
    /**
     * Support:
     * - Web browsers
     * - Node 18 and higher (https://github.com/nodejs/node/commit/e4b1fb5e6422c1ff151234bb9de792d45dd88d87)
     */ function getFromGlobal() {
        const ctor = globals === null || globals === void 0 ? void 0 : globals.DOMException;
        return isDOMExceptionConstructor(ctor) ? ctor : undefined;
    }
    /**
     * Support:
     * - All platforms
     */ function createPolyfill() {
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const ctor = function DOMException(message, name) {
            this.message = message || '';
            this.name = name || 'Error';
            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, this.constructor);
            }
        };
        setFunctionName(ctor, 'DOMException');
        ctor.prototype = Object.create(Error.prototype);
        Object.defineProperty(ctor.prototype, 'constructor', {
            value: ctor,
            writable: true,
            configurable: true
        });
        return ctor;
    }
    // eslint-disable-next-line @typescript-eslint/no-redeclare
    const DOMException = getFromGlobal() || createPolyfill();
    function ReadableStreamPipeTo(source, dest, preventClose, preventAbort, preventCancel, signal) {
        const reader = AcquireReadableStreamDefaultReader(source);
        const writer = AcquireWritableStreamDefaultWriter(dest);
        source._disturbed = true;
        let shuttingDown = false;
        // This is used to keep track of the spec's requirement that we wait for ongoing writes during shutdown.
        let currentWrite = promiseResolvedWith(undefined);
        return newPromise((resolve, reject)=>{
            let abortAlgorithm;
            if (signal !== undefined) {
                abortAlgorithm = ()=>{
                    const error = signal.reason !== undefined ? signal.reason : new DOMException('Aborted', 'AbortError');
                    const actions = [];
                    if (!preventAbort) {
                        actions.push(()=>{
                            if (dest._state === 'writable') {
                                return WritableStreamAbort(dest, error);
                            }
                            return promiseResolvedWith(undefined);
                        });
                    }
                    if (!preventCancel) {
                        actions.push(()=>{
                            if (source._state === 'readable') {
                                return ReadableStreamCancel(source, error);
                            }
                            return promiseResolvedWith(undefined);
                        });
                    }
                    shutdownWithAction(()=>Promise.all(actions.map((action)=>action())), true, error);
                };
                if (signal.aborted) {
                    abortAlgorithm();
                    return;
                }
                signal.addEventListener('abort', abortAlgorithm);
            }
            // Using reader and writer, read all chunks from this and write them to dest
            // - Backpressure must be enforced
            // - Shutdown must stop all activity
            function pipeLoop() {
                return newPromise((resolveLoop, rejectLoop)=>{
                    function next(done) {
                        if (done) {
                            resolveLoop();
                        } else {
                            // Use `PerformPromiseThen` instead of `uponPromise` to avoid
                            // adding unnecessary `.catch(rethrowAssertionErrorRejection)` handlers
                            PerformPromiseThen(pipeStep(), next, rejectLoop);
                        }
                    }
                    next(false);
                });
            }
            function pipeStep() {
                if (shuttingDown) {
                    return promiseResolvedWith(true);
                }
                return PerformPromiseThen(writer._readyPromise, ()=>{
                    return newPromise((resolveRead, rejectRead)=>{
                        ReadableStreamDefaultReaderRead(reader, {
                            _chunkSteps: (chunk)=>{
                                currentWrite = PerformPromiseThen(WritableStreamDefaultWriterWrite(writer, chunk), undefined, noop);
                                resolveRead(false);
                            },
                            _closeSteps: ()=>resolveRead(true),
                            _errorSteps: rejectRead
                        });
                    });
                });
            }
            // Errors must be propagated forward
            isOrBecomesErrored(source, reader._closedPromise, (storedError)=>{
                if (!preventAbort) {
                    shutdownWithAction(()=>WritableStreamAbort(dest, storedError), true, storedError);
                } else {
                    shutdown(true, storedError);
                }
                return null;
            });
            // Errors must be propagated backward
            isOrBecomesErrored(dest, writer._closedPromise, (storedError)=>{
                if (!preventCancel) {
                    shutdownWithAction(()=>ReadableStreamCancel(source, storedError), true, storedError);
                } else {
                    shutdown(true, storedError);
                }
                return null;
            });
            // Closing must be propagated forward
            isOrBecomesClosed(source, reader._closedPromise, ()=>{
                if (!preventClose) {
                    shutdownWithAction(()=>WritableStreamDefaultWriterCloseWithErrorPropagation(writer));
                } else {
                    shutdown();
                }
                return null;
            });
            // Closing must be propagated backward
            if (WritableStreamCloseQueuedOrInFlight(dest) || dest._state === 'closed') {
                const destClosed = new TypeError('the destination writable stream closed before all data could be piped to it');
                if (!preventCancel) {
                    shutdownWithAction(()=>ReadableStreamCancel(source, destClosed), true, destClosed);
                } else {
                    shutdown(true, destClosed);
                }
            }
            setPromiseIsHandledToTrue(pipeLoop());
            function waitForWritesToFinish() {
                // Another write may have started while we were waiting on this currentWrite, so we have to be sure to wait
                // for that too.
                const oldCurrentWrite = currentWrite;
                return PerformPromiseThen(currentWrite, ()=>oldCurrentWrite !== currentWrite ? waitForWritesToFinish() : undefined);
            }
            function isOrBecomesErrored(stream, promise, action) {
                if (stream._state === 'errored') {
                    action(stream._storedError);
                } else {
                    uponRejection(promise, action);
                }
            }
            function isOrBecomesClosed(stream, promise, action) {
                if (stream._state === 'closed') {
                    action();
                } else {
                    uponFulfillment(promise, action);
                }
            }
            function shutdownWithAction(action, originalIsError, originalError) {
                if (shuttingDown) {
                    return;
                }
                shuttingDown = true;
                if (dest._state === 'writable' && !WritableStreamCloseQueuedOrInFlight(dest)) {
                    uponFulfillment(waitForWritesToFinish(), doTheRest);
                } else {
                    doTheRest();
                }
                function doTheRest() {
                    uponPromise(action(), ()=>finalize(originalIsError, originalError), (newError)=>finalize(true, newError));
                    return null;
                }
            }
            function shutdown(isError, error) {
                if (shuttingDown) {
                    return;
                }
                shuttingDown = true;
                if (dest._state === 'writable' && !WritableStreamCloseQueuedOrInFlight(dest)) {
                    uponFulfillment(waitForWritesToFinish(), ()=>finalize(isError, error));
                } else {
                    finalize(isError, error);
                }
            }
            function finalize(isError, error) {
                WritableStreamDefaultWriterRelease(writer);
                ReadableStreamReaderGenericRelease(reader);
                if (signal !== undefined) {
                    signal.removeEventListener('abort', abortAlgorithm);
                }
                if (isError) {
                    reject(error);
                } else {
                    resolve(undefined);
                }
                return null;
            }
        });
    }
    /**
     * Allows control of a {@link ReadableStream | readable stream}'s state and internal queue.
     *
     * @public
     */ class ReadableStreamDefaultController {
        constructor(){
            throw new TypeError('Illegal constructor');
        }
        /**
         * Returns the desired size to fill the controlled stream's internal queue. It can be negative, if the queue is
         * over-full. An underlying source ought to use this information to determine when and how to apply backpressure.
         */ get desiredSize() {
            if (!IsReadableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$1('desiredSize');
            }
            return ReadableStreamDefaultControllerGetDesiredSize(this);
        }
        /**
         * Closes the controlled readable stream. Consumers will still be able to read any previously-enqueued chunks from
         * the stream, but once those are read, the stream will become closed.
         */ close() {
            if (!IsReadableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$1('close');
            }
            if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(this)) {
                throw new TypeError('The stream is not in a state that permits close');
            }
            ReadableStreamDefaultControllerClose(this);
        }
        enqueue(chunk = undefined) {
            if (!IsReadableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$1('enqueue');
            }
            if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(this)) {
                throw new TypeError('The stream is not in a state that permits enqueue');
            }
            return ReadableStreamDefaultControllerEnqueue(this, chunk);
        }
        /**
         * Errors the controlled readable stream, making all future interactions with it fail with the given error `e`.
         */ error(e = undefined) {
            if (!IsReadableStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException$1('error');
            }
            ReadableStreamDefaultControllerError(this, e);
        }
        /** @internal */ [CancelSteps](reason) {
            ResetQueue(this);
            const result = this._cancelAlgorithm(reason);
            ReadableStreamDefaultControllerClearAlgorithms(this);
            return result;
        }
        /** @internal */ [PullSteps](readRequest) {
            const stream = this._controlledReadableStream;
            if (this._queue.length > 0) {
                const chunk = DequeueValue(this);
                if (this._closeRequested && this._queue.length === 0) {
                    ReadableStreamDefaultControllerClearAlgorithms(this);
                    ReadableStreamClose(stream);
                } else {
                    ReadableStreamDefaultControllerCallPullIfNeeded(this);
                }
                readRequest._chunkSteps(chunk);
            } else {
                ReadableStreamAddReadRequest(stream, readRequest);
                ReadableStreamDefaultControllerCallPullIfNeeded(this);
            }
        }
        /** @internal */ [ReleaseSteps]() {
        // Do nothing.
        }
    }
    Object.defineProperties(ReadableStreamDefaultController.prototype, {
        close: {
            enumerable: true
        },
        enqueue: {
            enumerable: true
        },
        error: {
            enumerable: true
        },
        desiredSize: {
            enumerable: true
        }
    });
    setFunctionName(ReadableStreamDefaultController.prototype.close, 'close');
    setFunctionName(ReadableStreamDefaultController.prototype.enqueue, 'enqueue');
    setFunctionName(ReadableStreamDefaultController.prototype.error, 'error');
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(ReadableStreamDefaultController.prototype, Symbol.toStringTag, {
            value: 'ReadableStreamDefaultController',
            configurable: true
        });
    }
    // Abstract operations for the ReadableStreamDefaultController.
    function IsReadableStreamDefaultController(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_controlledReadableStream')) {
            return false;
        }
        return x instanceof ReadableStreamDefaultController;
    }
    function ReadableStreamDefaultControllerCallPullIfNeeded(controller) {
        const shouldPull = ReadableStreamDefaultControllerShouldCallPull(controller);
        if (!shouldPull) {
            return;
        }
        if (controller._pulling) {
            controller._pullAgain = true;
            return;
        }
        controller._pulling = true;
        const pullPromise = controller._pullAlgorithm();
        uponPromise(pullPromise, ()=>{
            controller._pulling = false;
            if (controller._pullAgain) {
                controller._pullAgain = false;
                ReadableStreamDefaultControllerCallPullIfNeeded(controller);
            }
            return null;
        }, (e)=>{
            ReadableStreamDefaultControllerError(controller, e);
            return null;
        });
    }
    function ReadableStreamDefaultControllerShouldCallPull(controller) {
        const stream = controller._controlledReadableStream;
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return false;
        }
        if (!controller._started) {
            return false;
        }
        if (IsReadableStreamLocked(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            return true;
        }
        const desiredSize = ReadableStreamDefaultControllerGetDesiredSize(controller);
        if (desiredSize > 0) {
            return true;
        }
        return false;
    }
    function ReadableStreamDefaultControllerClearAlgorithms(controller) {
        controller._pullAlgorithm = undefined;
        controller._cancelAlgorithm = undefined;
        controller._strategySizeAlgorithm = undefined;
    }
    // A client of ReadableStreamDefaultController may use these functions directly to bypass state check.
    function ReadableStreamDefaultControllerClose(controller) {
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return;
        }
        const stream = controller._controlledReadableStream;
        controller._closeRequested = true;
        if (controller._queue.length === 0) {
            ReadableStreamDefaultControllerClearAlgorithms(controller);
            ReadableStreamClose(stream);
        }
    }
    function ReadableStreamDefaultControllerEnqueue(controller, chunk) {
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return;
        }
        const stream = controller._controlledReadableStream;
        if (IsReadableStreamLocked(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            ReadableStreamFulfillReadRequest(stream, chunk, false);
        } else {
            let chunkSize;
            try {
                chunkSize = controller._strategySizeAlgorithm(chunk);
            } catch (chunkSizeE) {
                ReadableStreamDefaultControllerError(controller, chunkSizeE);
                throw chunkSizeE;
            }
            try {
                EnqueueValueWithSize(controller, chunk, chunkSize);
            } catch (enqueueE) {
                ReadableStreamDefaultControllerError(controller, enqueueE);
                throw enqueueE;
            }
        }
        ReadableStreamDefaultControllerCallPullIfNeeded(controller);
    }
    function ReadableStreamDefaultControllerError(controller, e) {
        const stream = controller._controlledReadableStream;
        if (stream._state !== 'readable') {
            return;
        }
        ResetQueue(controller);
        ReadableStreamDefaultControllerClearAlgorithms(controller);
        ReadableStreamError(stream, e);
    }
    function ReadableStreamDefaultControllerGetDesiredSize(controller) {
        const state = controller._controlledReadableStream._state;
        if (state === 'errored') {
            return null;
        }
        if (state === 'closed') {
            return 0;
        }
        return controller._strategyHWM - controller._queueTotalSize;
    }
    // This is used in the implementation of TransformStream.
    function ReadableStreamDefaultControllerHasBackpressure(controller) {
        if (ReadableStreamDefaultControllerShouldCallPull(controller)) {
            return false;
        }
        return true;
    }
    function ReadableStreamDefaultControllerCanCloseOrEnqueue(controller) {
        const state = controller._controlledReadableStream._state;
        if (!controller._closeRequested && state === 'readable') {
            return true;
        }
        return false;
    }
    function SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm) {
        controller._controlledReadableStream = stream;
        controller._queue = undefined;
        controller._queueTotalSize = undefined;
        ResetQueue(controller);
        controller._started = false;
        controller._closeRequested = false;
        controller._pullAgain = false;
        controller._pulling = false;
        controller._strategySizeAlgorithm = sizeAlgorithm;
        controller._strategyHWM = highWaterMark;
        controller._pullAlgorithm = pullAlgorithm;
        controller._cancelAlgorithm = cancelAlgorithm;
        stream._readableStreamController = controller;
        const startResult = startAlgorithm();
        uponPromise(promiseResolvedWith(startResult), ()=>{
            controller._started = true;
            ReadableStreamDefaultControllerCallPullIfNeeded(controller);
            return null;
        }, (r)=>{
            ReadableStreamDefaultControllerError(controller, r);
            return null;
        });
    }
    function SetUpReadableStreamDefaultControllerFromUnderlyingSource(stream, underlyingSource, highWaterMark, sizeAlgorithm) {
        const controller = Object.create(ReadableStreamDefaultController.prototype);
        let startAlgorithm;
        let pullAlgorithm;
        let cancelAlgorithm;
        if (underlyingSource.start !== undefined) {
            startAlgorithm = ()=>underlyingSource.start(controller);
        } else {
            startAlgorithm = ()=>undefined;
        }
        if (underlyingSource.pull !== undefined) {
            pullAlgorithm = ()=>underlyingSource.pull(controller);
        } else {
            pullAlgorithm = ()=>promiseResolvedWith(undefined);
        }
        if (underlyingSource.cancel !== undefined) {
            cancelAlgorithm = (reason)=>underlyingSource.cancel(reason);
        } else {
            cancelAlgorithm = ()=>promiseResolvedWith(undefined);
        }
        SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm);
    }
    // Helper functions for the ReadableStreamDefaultController.
    function defaultControllerBrandCheckException$1(name) {
        return new TypeError(`ReadableStreamDefaultController.prototype.${name} can only be used on a ReadableStreamDefaultController`);
    }
    function ReadableStreamTee(stream, cloneForBranch2) {
        if (IsReadableByteStreamController(stream._readableStreamController)) {
            return ReadableByteStreamTee(stream);
        }
        return ReadableStreamDefaultTee(stream);
    }
    function ReadableStreamDefaultTee(stream, cloneForBranch2) {
        const reader = AcquireReadableStreamDefaultReader(stream);
        let reading = false;
        let readAgain = false;
        let canceled1 = false;
        let canceled2 = false;
        let reason1;
        let reason2;
        let branch1;
        let branch2;
        let resolveCancelPromise;
        const cancelPromise = newPromise((resolve)=>{
            resolveCancelPromise = resolve;
        });
        function pullAlgorithm() {
            if (reading) {
                readAgain = true;
                return promiseResolvedWith(undefined);
            }
            reading = true;
            const readRequest = {
                _chunkSteps: (chunk)=>{
                    // This needs to be delayed a microtask because it takes at least a microtask to detect errors (using
                    // reader._closedPromise below), and we want errors in stream to error both branches immediately. We cannot let
                    // successful synchronously-available reads get ahead of asynchronously-available errors.
                    _queueMicrotask(()=>{
                        readAgain = false;
                        const chunk1 = chunk;
                        const chunk2 = chunk;
                        // There is no way to access the cloning code right now in the reference implementation.
                        // If we add one then we'll need an implementation for serializable objects.
                        // if (!canceled2 && cloneForBranch2) {
                        //   chunk2 = StructuredDeserialize(StructuredSerialize(chunk2));
                        // }
                        if (!canceled1) {
                            ReadableStreamDefaultControllerEnqueue(branch1._readableStreamController, chunk1);
                        }
                        if (!canceled2) {
                            ReadableStreamDefaultControllerEnqueue(branch2._readableStreamController, chunk2);
                        }
                        reading = false;
                        if (readAgain) {
                            pullAlgorithm();
                        }
                    });
                },
                _closeSteps: ()=>{
                    reading = false;
                    if (!canceled1) {
                        ReadableStreamDefaultControllerClose(branch1._readableStreamController);
                    }
                    if (!canceled2) {
                        ReadableStreamDefaultControllerClose(branch2._readableStreamController);
                    }
                    if (!canceled1 || !canceled2) {
                        resolveCancelPromise(undefined);
                    }
                },
                _errorSteps: ()=>{
                    reading = false;
                }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
            return promiseResolvedWith(undefined);
        }
        function cancel1Algorithm(reason) {
            canceled1 = true;
            reason1 = reason;
            if (canceled2) {
                const compositeReason = CreateArrayFromList([
                    reason1,
                    reason2
                ]);
                const cancelResult = ReadableStreamCancel(stream, compositeReason);
                resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
        }
        function cancel2Algorithm(reason) {
            canceled2 = true;
            reason2 = reason;
            if (canceled1) {
                const compositeReason = CreateArrayFromList([
                    reason1,
                    reason2
                ]);
                const cancelResult = ReadableStreamCancel(stream, compositeReason);
                resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
        }
        function startAlgorithm() {
        // do nothing
        }
        branch1 = CreateReadableStream(startAlgorithm, pullAlgorithm, cancel1Algorithm);
        branch2 = CreateReadableStream(startAlgorithm, pullAlgorithm, cancel2Algorithm);
        uponRejection(reader._closedPromise, (r)=>{
            ReadableStreamDefaultControllerError(branch1._readableStreamController, r);
            ReadableStreamDefaultControllerError(branch2._readableStreamController, r);
            if (!canceled1 || !canceled2) {
                resolveCancelPromise(undefined);
            }
            return null;
        });
        return [
            branch1,
            branch2
        ];
    }
    function ReadableByteStreamTee(stream) {
        let reader = AcquireReadableStreamDefaultReader(stream);
        let reading = false;
        let readAgainForBranch1 = false;
        let readAgainForBranch2 = false;
        let canceled1 = false;
        let canceled2 = false;
        let reason1;
        let reason2;
        let branch1;
        let branch2;
        let resolveCancelPromise;
        const cancelPromise = newPromise((resolve)=>{
            resolveCancelPromise = resolve;
        });
        function forwardReaderError(thisReader) {
            uponRejection(thisReader._closedPromise, (r)=>{
                if (thisReader !== reader) {
                    return null;
                }
                ReadableByteStreamControllerError(branch1._readableStreamController, r);
                ReadableByteStreamControllerError(branch2._readableStreamController, r);
                if (!canceled1 || !canceled2) {
                    resolveCancelPromise(undefined);
                }
                return null;
            });
        }
        function pullWithDefaultReader() {
            if (IsReadableStreamBYOBReader(reader)) {
                ReadableStreamReaderGenericRelease(reader);
                reader = AcquireReadableStreamDefaultReader(stream);
                forwardReaderError(reader);
            }
            const readRequest = {
                _chunkSteps: (chunk)=>{
                    // This needs to be delayed a microtask because it takes at least a microtask to detect errors (using
                    // reader._closedPromise below), and we want errors in stream to error both branches immediately. We cannot let
                    // successful synchronously-available reads get ahead of asynchronously-available errors.
                    _queueMicrotask(()=>{
                        readAgainForBranch1 = false;
                        readAgainForBranch2 = false;
                        const chunk1 = chunk;
                        let chunk2 = chunk;
                        if (!canceled1 && !canceled2) {
                            try {
                                chunk2 = CloneAsUint8Array(chunk);
                            } catch (cloneE) {
                                ReadableByteStreamControllerError(branch1._readableStreamController, cloneE);
                                ReadableByteStreamControllerError(branch2._readableStreamController, cloneE);
                                resolveCancelPromise(ReadableStreamCancel(stream, cloneE));
                                return;
                            }
                        }
                        if (!canceled1) {
                            ReadableByteStreamControllerEnqueue(branch1._readableStreamController, chunk1);
                        }
                        if (!canceled2) {
                            ReadableByteStreamControllerEnqueue(branch2._readableStreamController, chunk2);
                        }
                        reading = false;
                        if (readAgainForBranch1) {
                            pull1Algorithm();
                        } else if (readAgainForBranch2) {
                            pull2Algorithm();
                        }
                    });
                },
                _closeSteps: ()=>{
                    reading = false;
                    if (!canceled1) {
                        ReadableByteStreamControllerClose(branch1._readableStreamController);
                    }
                    if (!canceled2) {
                        ReadableByteStreamControllerClose(branch2._readableStreamController);
                    }
                    if (branch1._readableStreamController._pendingPullIntos.length > 0) {
                        ReadableByteStreamControllerRespond(branch1._readableStreamController, 0);
                    }
                    if (branch2._readableStreamController._pendingPullIntos.length > 0) {
                        ReadableByteStreamControllerRespond(branch2._readableStreamController, 0);
                    }
                    if (!canceled1 || !canceled2) {
                        resolveCancelPromise(undefined);
                    }
                },
                _errorSteps: ()=>{
                    reading = false;
                }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
        }
        function pullWithBYOBReader(view, forBranch2) {
            if (IsReadableStreamDefaultReader(reader)) {
                ReadableStreamReaderGenericRelease(reader);
                reader = AcquireReadableStreamBYOBReader(stream);
                forwardReaderError(reader);
            }
            const byobBranch = forBranch2 ? branch2 : branch1;
            const otherBranch = forBranch2 ? branch1 : branch2;
            const readIntoRequest = {
                _chunkSteps: (chunk)=>{
                    // This needs to be delayed a microtask because it takes at least a microtask to detect errors (using
                    // reader._closedPromise below), and we want errors in stream to error both branches immediately. We cannot let
                    // successful synchronously-available reads get ahead of asynchronously-available errors.
                    _queueMicrotask(()=>{
                        readAgainForBranch1 = false;
                        readAgainForBranch2 = false;
                        const byobCanceled = forBranch2 ? canceled2 : canceled1;
                        const otherCanceled = forBranch2 ? canceled1 : canceled2;
                        if (!otherCanceled) {
                            let clonedChunk;
                            try {
                                clonedChunk = CloneAsUint8Array(chunk);
                            } catch (cloneE) {
                                ReadableByteStreamControllerError(byobBranch._readableStreamController, cloneE);
                                ReadableByteStreamControllerError(otherBranch._readableStreamController, cloneE);
                                resolveCancelPromise(ReadableStreamCancel(stream, cloneE));
                                return;
                            }
                            if (!byobCanceled) {
                                ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                            }
                            ReadableByteStreamControllerEnqueue(otherBranch._readableStreamController, clonedChunk);
                        } else if (!byobCanceled) {
                            ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                        }
                        reading = false;
                        if (readAgainForBranch1) {
                            pull1Algorithm();
                        } else if (readAgainForBranch2) {
                            pull2Algorithm();
                        }
                    });
                },
                _closeSteps: (chunk)=>{
                    reading = false;
                    const byobCanceled = forBranch2 ? canceled2 : canceled1;
                    const otherCanceled = forBranch2 ? canceled1 : canceled2;
                    if (!byobCanceled) {
                        ReadableByteStreamControllerClose(byobBranch._readableStreamController);
                    }
                    if (!otherCanceled) {
                        ReadableByteStreamControllerClose(otherBranch._readableStreamController);
                    }
                    if (chunk !== undefined) {
                        if (!byobCanceled) {
                            ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                        }
                        if (!otherCanceled && otherBranch._readableStreamController._pendingPullIntos.length > 0) {
                            ReadableByteStreamControllerRespond(otherBranch._readableStreamController, 0);
                        }
                    }
                    if (!byobCanceled || !otherCanceled) {
                        resolveCancelPromise(undefined);
                    }
                },
                _errorSteps: ()=>{
                    reading = false;
                }
            };
            ReadableStreamBYOBReaderRead(reader, view, 1, readIntoRequest);
        }
        function pull1Algorithm() {
            if (reading) {
                readAgainForBranch1 = true;
                return promiseResolvedWith(undefined);
            }
            reading = true;
            const byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch1._readableStreamController);
            if (byobRequest === null) {
                pullWithDefaultReader();
            } else {
                pullWithBYOBReader(byobRequest._view, false);
            }
            return promiseResolvedWith(undefined);
        }
        function pull2Algorithm() {
            if (reading) {
                readAgainForBranch2 = true;
                return promiseResolvedWith(undefined);
            }
            reading = true;
            const byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch2._readableStreamController);
            if (byobRequest === null) {
                pullWithDefaultReader();
            } else {
                pullWithBYOBReader(byobRequest._view, true);
            }
            return promiseResolvedWith(undefined);
        }
        function cancel1Algorithm(reason) {
            canceled1 = true;
            reason1 = reason;
            if (canceled2) {
                const compositeReason = CreateArrayFromList([
                    reason1,
                    reason2
                ]);
                const cancelResult = ReadableStreamCancel(stream, compositeReason);
                resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
        }
        function cancel2Algorithm(reason) {
            canceled2 = true;
            reason2 = reason;
            if (canceled1) {
                const compositeReason = CreateArrayFromList([
                    reason1,
                    reason2
                ]);
                const cancelResult = ReadableStreamCancel(stream, compositeReason);
                resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
        }
        function startAlgorithm() {
            return;
        }
        branch1 = CreateReadableByteStream(startAlgorithm, pull1Algorithm, cancel1Algorithm);
        branch2 = CreateReadableByteStream(startAlgorithm, pull2Algorithm, cancel2Algorithm);
        forwardReaderError(reader);
        return [
            branch1,
            branch2
        ];
    }
    function isReadableStreamLike(stream) {
        return typeIsObject(stream) && typeof stream.getReader !== 'undefined';
    }
    function ReadableStreamFrom(source) {
        if (isReadableStreamLike(source)) {
            return ReadableStreamFromDefaultReader(source.getReader());
        }
        return ReadableStreamFromIterable(source);
    }
    function ReadableStreamFromIterable(asyncIterable) {
        let stream;
        const iteratorRecord = GetIterator(asyncIterable, 'async');
        const startAlgorithm = noop;
        function pullAlgorithm() {
            let nextResult;
            try {
                nextResult = IteratorNext(iteratorRecord);
            } catch (e) {
                return promiseRejectedWith(e);
            }
            const nextPromise = promiseResolvedWith(nextResult);
            return transformPromiseWith(nextPromise, (iterResult)=>{
                if (!typeIsObject(iterResult)) {
                    throw new TypeError('The promise returned by the iterator.next() method must fulfill with an object');
                }
                const done = IteratorComplete(iterResult);
                if (done) {
                    ReadableStreamDefaultControllerClose(stream._readableStreamController);
                } else {
                    const value = IteratorValue(iterResult);
                    ReadableStreamDefaultControllerEnqueue(stream._readableStreamController, value);
                }
            });
        }
        function cancelAlgorithm(reason) {
            const iterator = iteratorRecord.iterator;
            let returnMethod;
            try {
                returnMethod = GetMethod(iterator, 'return');
            } catch (e) {
                return promiseRejectedWith(e);
            }
            if (returnMethod === undefined) {
                return promiseResolvedWith(undefined);
            }
            let returnResult;
            try {
                returnResult = reflectCall(returnMethod, iterator, [
                    reason
                ]);
            } catch (e) {
                return promiseRejectedWith(e);
            }
            const returnPromise = promiseResolvedWith(returnResult);
            return transformPromiseWith(returnPromise, (iterResult)=>{
                if (!typeIsObject(iterResult)) {
                    throw new TypeError('The promise returned by the iterator.return() method must fulfill with an object');
                }
                return undefined;
            });
        }
        stream = CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, 0);
        return stream;
    }
    function ReadableStreamFromDefaultReader(reader) {
        let stream;
        const startAlgorithm = noop;
        function pullAlgorithm() {
            let readPromise;
            try {
                readPromise = reader.read();
            } catch (e) {
                return promiseRejectedWith(e);
            }
            return transformPromiseWith(readPromise, (readResult)=>{
                if (!typeIsObject(readResult)) {
                    throw new TypeError('The promise returned by the reader.read() method must fulfill with an object');
                }
                if (readResult.done) {
                    ReadableStreamDefaultControllerClose(stream._readableStreamController);
                } else {
                    const value = readResult.value;
                    ReadableStreamDefaultControllerEnqueue(stream._readableStreamController, value);
                }
            });
        }
        function cancelAlgorithm(reason) {
            try {
                return promiseResolvedWith(reader.cancel(reason));
            } catch (e) {
                return promiseRejectedWith(e);
            }
        }
        stream = CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, 0);
        return stream;
    }
    function convertUnderlyingDefaultOrByteSource(source, context) {
        assertDictionary(source, context);
        const original = source;
        const autoAllocateChunkSize = original === null || original === void 0 ? void 0 : original.autoAllocateChunkSize;
        const cancel = original === null || original === void 0 ? void 0 : original.cancel;
        const pull = original === null || original === void 0 ? void 0 : original.pull;
        const start = original === null || original === void 0 ? void 0 : original.start;
        const type = original === null || original === void 0 ? void 0 : original.type;
        return {
            autoAllocateChunkSize: autoAllocateChunkSize === undefined ? undefined : convertUnsignedLongLongWithEnforceRange(autoAllocateChunkSize, `${context} has member 'autoAllocateChunkSize' that`),
            cancel: cancel === undefined ? undefined : convertUnderlyingSourceCancelCallback(cancel, original, `${context} has member 'cancel' that`),
            pull: pull === undefined ? undefined : convertUnderlyingSourcePullCallback(pull, original, `${context} has member 'pull' that`),
            start: start === undefined ? undefined : convertUnderlyingSourceStartCallback(start, original, `${context} has member 'start' that`),
            type: type === undefined ? undefined : convertReadableStreamType(type, `${context} has member 'type' that`)
        };
    }
    function convertUnderlyingSourceCancelCallback(fn, original, context) {
        assertFunction(fn, context);
        return (reason)=>promiseCall(fn, original, [
                reason
            ]);
    }
    function convertUnderlyingSourcePullCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller)=>promiseCall(fn, original, [
                controller
            ]);
    }
    function convertUnderlyingSourceStartCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller)=>reflectCall(fn, original, [
                controller
            ]);
    }
    function convertReadableStreamType(type, context) {
        type = `${type}`;
        if (type !== 'bytes') {
            throw new TypeError(`${context} '${type}' is not a valid enumeration value for ReadableStreamType`);
        }
        return type;
    }
    function convertIteratorOptions(options, context) {
        assertDictionary(options, context);
        const preventCancel = options === null || options === void 0 ? void 0 : options.preventCancel;
        return {
            preventCancel: Boolean(preventCancel)
        };
    }
    function convertPipeOptions(options, context) {
        assertDictionary(options, context);
        const preventAbort = options === null || options === void 0 ? void 0 : options.preventAbort;
        const preventCancel = options === null || options === void 0 ? void 0 : options.preventCancel;
        const preventClose = options === null || options === void 0 ? void 0 : options.preventClose;
        const signal = options === null || options === void 0 ? void 0 : options.signal;
        if (signal !== undefined) {
            assertAbortSignal(signal, `${context} has member 'signal' that`);
        }
        return {
            preventAbort: Boolean(preventAbort),
            preventCancel: Boolean(preventCancel),
            preventClose: Boolean(preventClose),
            signal
        };
    }
    function assertAbortSignal(signal, context) {
        if (!isAbortSignal(signal)) {
            throw new TypeError(`${context} is not an AbortSignal.`);
        }
    }
    function convertReadableWritablePair(pair, context) {
        assertDictionary(pair, context);
        const readable = pair === null || pair === void 0 ? void 0 : pair.readable;
        assertRequiredField(readable, 'readable', 'ReadableWritablePair');
        assertReadableStream(readable, `${context} has member 'readable' that`);
        const writable = pair === null || pair === void 0 ? void 0 : pair.writable;
        assertRequiredField(writable, 'writable', 'ReadableWritablePair');
        assertWritableStream(writable, `${context} has member 'writable' that`);
        return {
            readable,
            writable
        };
    }
    /**
     * A readable stream represents a source of data, from which you can read.
     *
     * @public
     */ class ReadableStream {
        constructor(rawUnderlyingSource = {}, rawStrategy = {}){
            if (rawUnderlyingSource === undefined) {
                rawUnderlyingSource = null;
            } else {
                assertObject(rawUnderlyingSource, 'First parameter');
            }
            const strategy = convertQueuingStrategy(rawStrategy, 'Second parameter');
            const underlyingSource = convertUnderlyingDefaultOrByteSource(rawUnderlyingSource, 'First parameter');
            InitializeReadableStream(this);
            if (underlyingSource.type === 'bytes') {
                if (strategy.size !== undefined) {
                    throw new RangeError('The strategy for a byte stream cannot have a size function');
                }
                const highWaterMark = ExtractHighWaterMark(strategy, 0);
                SetUpReadableByteStreamControllerFromUnderlyingSource(this, underlyingSource, highWaterMark);
            } else {
                const sizeAlgorithm = ExtractSizeAlgorithm(strategy);
                const highWaterMark = ExtractHighWaterMark(strategy, 1);
                SetUpReadableStreamDefaultControllerFromUnderlyingSource(this, underlyingSource, highWaterMark, sizeAlgorithm);
            }
        }
        /**
         * Whether or not the readable stream is locked to a {@link ReadableStreamDefaultReader | reader}.
         */ get locked() {
            if (!IsReadableStream(this)) {
                throw streamBrandCheckException$1('locked');
            }
            return IsReadableStreamLocked(this);
        }
        /**
         * Cancels the stream, signaling a loss of interest in the stream by a consumer.
         *
         * The supplied `reason` argument will be given to the underlying source's {@link UnderlyingSource.cancel | cancel()}
         * method, which might or might not use it.
         */ cancel(reason = undefined) {
            if (!IsReadableStream(this)) {
                return promiseRejectedWith(streamBrandCheckException$1('cancel'));
            }
            if (IsReadableStreamLocked(this)) {
                return promiseRejectedWith(new TypeError('Cannot cancel a stream that already has a reader'));
            }
            return ReadableStreamCancel(this, reason);
        }
        getReader(rawOptions = undefined) {
            if (!IsReadableStream(this)) {
                throw streamBrandCheckException$1('getReader');
            }
            const options = convertReaderOptions(rawOptions, 'First parameter');
            if (options.mode === undefined) {
                return AcquireReadableStreamDefaultReader(this);
            }
            return AcquireReadableStreamBYOBReader(this);
        }
        pipeThrough(rawTransform, rawOptions = {}) {
            if (!IsReadableStream(this)) {
                throw streamBrandCheckException$1('pipeThrough');
            }
            assertRequiredArgument(rawTransform, 1, 'pipeThrough');
            const transform = convertReadableWritablePair(rawTransform, 'First parameter');
            const options = convertPipeOptions(rawOptions, 'Second parameter');
            if (IsReadableStreamLocked(this)) {
                throw new TypeError('ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream');
            }
            if (IsWritableStreamLocked(transform.writable)) {
                throw new TypeError('ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream');
            }
            const promise = ReadableStreamPipeTo(this, transform.writable, options.preventClose, options.preventAbort, options.preventCancel, options.signal);
            setPromiseIsHandledToTrue(promise);
            return transform.readable;
        }
        pipeTo(destination, rawOptions = {}) {
            if (!IsReadableStream(this)) {
                return promiseRejectedWith(streamBrandCheckException$1('pipeTo'));
            }
            if (destination === undefined) {
                return promiseRejectedWith(`Parameter 1 is required in 'pipeTo'.`);
            }
            if (!IsWritableStream(destination)) {
                return promiseRejectedWith(new TypeError(`ReadableStream.prototype.pipeTo's first argument must be a WritableStream`));
            }
            let options;
            try {
                options = convertPipeOptions(rawOptions, 'Second parameter');
            } catch (e) {
                return promiseRejectedWith(e);
            }
            if (IsReadableStreamLocked(this)) {
                return promiseRejectedWith(new TypeError('ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream'));
            }
            if (IsWritableStreamLocked(destination)) {
                return promiseRejectedWith(new TypeError('ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream'));
            }
            return ReadableStreamPipeTo(this, destination, options.preventClose, options.preventAbort, options.preventCancel, options.signal);
        }
        /**
         * Tees this readable stream, returning a two-element array containing the two resulting branches as
         * new {@link ReadableStream} instances.
         *
         * Teeing a stream will lock it, preventing any other consumer from acquiring a reader.
         * To cancel the stream, cancel both of the resulting branches; a composite cancellation reason will then be
         * propagated to the stream's underlying source.
         *
         * Note that the chunks seen in each branch will be the same object. If the chunks are not immutable,
         * this could allow interference between the two branches.
         */ tee() {
            if (!IsReadableStream(this)) {
                throw streamBrandCheckException$1('tee');
            }
            const branches = ReadableStreamTee(this);
            return CreateArrayFromList(branches);
        }
        values(rawOptions = undefined) {
            if (!IsReadableStream(this)) {
                throw streamBrandCheckException$1('values');
            }
            const options = convertIteratorOptions(rawOptions, 'First parameter');
            return AcquireReadableStreamAsyncIterator(this, options.preventCancel);
        }
        [SymbolAsyncIterator](options) {
            // Stub implementation, overridden below
            return this.values(options);
        }
        /**
         * Creates a new ReadableStream wrapping the provided iterable or async iterable.
         *
         * This can be used to adapt various kinds of objects into a readable stream,
         * such as an array, an async generator, or a Node.js readable stream.
         */ static from(asyncIterable) {
            return ReadableStreamFrom(asyncIterable);
        }
    }
    Object.defineProperties(ReadableStream, {
        from: {
            enumerable: true
        }
    });
    Object.defineProperties(ReadableStream.prototype, {
        cancel: {
            enumerable: true
        },
        getReader: {
            enumerable: true
        },
        pipeThrough: {
            enumerable: true
        },
        pipeTo: {
            enumerable: true
        },
        tee: {
            enumerable: true
        },
        values: {
            enumerable: true
        },
        locked: {
            enumerable: true
        }
    });
    setFunctionName(ReadableStream.from, 'from');
    setFunctionName(ReadableStream.prototype.cancel, 'cancel');
    setFunctionName(ReadableStream.prototype.getReader, 'getReader');
    setFunctionName(ReadableStream.prototype.pipeThrough, 'pipeThrough');
    setFunctionName(ReadableStream.prototype.pipeTo, 'pipeTo');
    setFunctionName(ReadableStream.prototype.tee, 'tee');
    setFunctionName(ReadableStream.prototype.values, 'values');
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(ReadableStream.prototype, Symbol.toStringTag, {
            value: 'ReadableStream',
            configurable: true
        });
    }
    Object.defineProperty(ReadableStream.prototype, SymbolAsyncIterator, {
        value: ReadableStream.prototype.values,
        writable: true,
        configurable: true
    });
    // Abstract operations for the ReadableStream.
    // Throws if and only if startAlgorithm throws.
    function CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark = 1, sizeAlgorithm = ()=>1) {
        const stream = Object.create(ReadableStream.prototype);
        InitializeReadableStream(stream);
        const controller = Object.create(ReadableStreamDefaultController.prototype);
        SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm);
        return stream;
    }
    // Throws if and only if startAlgorithm throws.
    function CreateReadableByteStream(startAlgorithm, pullAlgorithm, cancelAlgorithm) {
        const stream = Object.create(ReadableStream.prototype);
        InitializeReadableStream(stream);
        const controller = Object.create(ReadableByteStreamController.prototype);
        SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, 0, undefined);
        return stream;
    }
    function InitializeReadableStream(stream) {
        stream._state = 'readable';
        stream._reader = undefined;
        stream._storedError = undefined;
        stream._disturbed = false;
    }
    function IsReadableStream(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_readableStreamController')) {
            return false;
        }
        return x instanceof ReadableStream;
    }
    function IsReadableStreamLocked(stream) {
        if (stream._reader === undefined) {
            return false;
        }
        return true;
    }
    // ReadableStream API exposed for controllers.
    function ReadableStreamCancel(stream, reason) {
        stream._disturbed = true;
        if (stream._state === 'closed') {
            return promiseResolvedWith(undefined);
        }
        if (stream._state === 'errored') {
            return promiseRejectedWith(stream._storedError);
        }
        ReadableStreamClose(stream);
        const reader = stream._reader;
        if (reader !== undefined && IsReadableStreamBYOBReader(reader)) {
            const readIntoRequests = reader._readIntoRequests;
            reader._readIntoRequests = new SimpleQueue();
            readIntoRequests.forEach((readIntoRequest)=>{
                readIntoRequest._closeSteps(undefined);
            });
        }
        const sourceCancelPromise = stream._readableStreamController[CancelSteps](reason);
        return transformPromiseWith(sourceCancelPromise, noop);
    }
    function ReadableStreamClose(stream) {
        stream._state = 'closed';
        const reader = stream._reader;
        if (reader === undefined) {
            return;
        }
        defaultReaderClosedPromiseResolve(reader);
        if (IsReadableStreamDefaultReader(reader)) {
            const readRequests = reader._readRequests;
            reader._readRequests = new SimpleQueue();
            readRequests.forEach((readRequest)=>{
                readRequest._closeSteps();
            });
        }
    }
    function ReadableStreamError(stream, e) {
        stream._state = 'errored';
        stream._storedError = e;
        const reader = stream._reader;
        if (reader === undefined) {
            return;
        }
        defaultReaderClosedPromiseReject(reader, e);
        if (IsReadableStreamDefaultReader(reader)) {
            ReadableStreamDefaultReaderErrorReadRequests(reader, e);
        } else {
            ReadableStreamBYOBReaderErrorReadIntoRequests(reader, e);
        }
    }
    // Helper functions for the ReadableStream.
    function streamBrandCheckException$1(name) {
        return new TypeError(`ReadableStream.prototype.${name} can only be used on a ReadableStream`);
    }
    function convertQueuingStrategyInit(init, context) {
        assertDictionary(init, context);
        const highWaterMark = init === null || init === void 0 ? void 0 : init.highWaterMark;
        assertRequiredField(highWaterMark, 'highWaterMark', 'QueuingStrategyInit');
        return {
            highWaterMark: convertUnrestrictedDouble(highWaterMark)
        };
    }
    // The size function must not have a prototype property nor be a constructor
    const byteLengthSizeFunction = (chunk)=>{
        return chunk.byteLength;
    };
    setFunctionName(byteLengthSizeFunction, 'size');
    /**
     * A queuing strategy that counts the number of bytes in each chunk.
     *
     * @public
     */ class ByteLengthQueuingStrategy {
        constructor(options){
            assertRequiredArgument(options, 1, 'ByteLengthQueuingStrategy');
            options = convertQueuingStrategyInit(options, 'First parameter');
            this._byteLengthQueuingStrategyHighWaterMark = options.highWaterMark;
        }
        /**
         * Returns the high water mark provided to the constructor.
         */ get highWaterMark() {
            if (!IsByteLengthQueuingStrategy(this)) {
                throw byteLengthBrandCheckException('highWaterMark');
            }
            return this._byteLengthQueuingStrategyHighWaterMark;
        }
        /**
         * Measures the size of `chunk` by returning the value of its `byteLength` property.
         */ get size() {
            if (!IsByteLengthQueuingStrategy(this)) {
                throw byteLengthBrandCheckException('size');
            }
            return byteLengthSizeFunction;
        }
    }
    Object.defineProperties(ByteLengthQueuingStrategy.prototype, {
        highWaterMark: {
            enumerable: true
        },
        size: {
            enumerable: true
        }
    });
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(ByteLengthQueuingStrategy.prototype, Symbol.toStringTag, {
            value: 'ByteLengthQueuingStrategy',
            configurable: true
        });
    }
    // Helper functions for the ByteLengthQueuingStrategy.
    function byteLengthBrandCheckException(name) {
        return new TypeError(`ByteLengthQueuingStrategy.prototype.${name} can only be used on a ByteLengthQueuingStrategy`);
    }
    function IsByteLengthQueuingStrategy(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_byteLengthQueuingStrategyHighWaterMark')) {
            return false;
        }
        return x instanceof ByteLengthQueuingStrategy;
    }
    // The size function must not have a prototype property nor be a constructor
    const countSizeFunction = ()=>{
        return 1;
    };
    setFunctionName(countSizeFunction, 'size');
    /**
     * A queuing strategy that counts the number of chunks.
     *
     * @public
     */ class CountQueuingStrategy {
        constructor(options){
            assertRequiredArgument(options, 1, 'CountQueuingStrategy');
            options = convertQueuingStrategyInit(options, 'First parameter');
            this._countQueuingStrategyHighWaterMark = options.highWaterMark;
        }
        /**
         * Returns the high water mark provided to the constructor.
         */ get highWaterMark() {
            if (!IsCountQueuingStrategy(this)) {
                throw countBrandCheckException('highWaterMark');
            }
            return this._countQueuingStrategyHighWaterMark;
        }
        /**
         * Measures the size of `chunk` by always returning 1.
         * This ensures that the total queue size is a count of the number of chunks in the queue.
         */ get size() {
            if (!IsCountQueuingStrategy(this)) {
                throw countBrandCheckException('size');
            }
            return countSizeFunction;
        }
    }
    Object.defineProperties(CountQueuingStrategy.prototype, {
        highWaterMark: {
            enumerable: true
        },
        size: {
            enumerable: true
        }
    });
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(CountQueuingStrategy.prototype, Symbol.toStringTag, {
            value: 'CountQueuingStrategy',
            configurable: true
        });
    }
    // Helper functions for the CountQueuingStrategy.
    function countBrandCheckException(name) {
        return new TypeError(`CountQueuingStrategy.prototype.${name} can only be used on a CountQueuingStrategy`);
    }
    function IsCountQueuingStrategy(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_countQueuingStrategyHighWaterMark')) {
            return false;
        }
        return x instanceof CountQueuingStrategy;
    }
    function convertTransformer(original, context) {
        assertDictionary(original, context);
        const cancel = original === null || original === void 0 ? void 0 : original.cancel;
        const flush = original === null || original === void 0 ? void 0 : original.flush;
        const readableType = original === null || original === void 0 ? void 0 : original.readableType;
        const start = original === null || original === void 0 ? void 0 : original.start;
        const transform = original === null || original === void 0 ? void 0 : original.transform;
        const writableType = original === null || original === void 0 ? void 0 : original.writableType;
        return {
            cancel: cancel === undefined ? undefined : convertTransformerCancelCallback(cancel, original, `${context} has member 'cancel' that`),
            flush: flush === undefined ? undefined : convertTransformerFlushCallback(flush, original, `${context} has member 'flush' that`),
            readableType,
            start: start === undefined ? undefined : convertTransformerStartCallback(start, original, `${context} has member 'start' that`),
            transform: transform === undefined ? undefined : convertTransformerTransformCallback(transform, original, `${context} has member 'transform' that`),
            writableType
        };
    }
    function convertTransformerFlushCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller)=>promiseCall(fn, original, [
                controller
            ]);
    }
    function convertTransformerStartCallback(fn, original, context) {
        assertFunction(fn, context);
        return (controller)=>reflectCall(fn, original, [
                controller
            ]);
    }
    function convertTransformerTransformCallback(fn, original, context) {
        assertFunction(fn, context);
        return (chunk, controller)=>promiseCall(fn, original, [
                chunk,
                controller
            ]);
    }
    function convertTransformerCancelCallback(fn, original, context) {
        assertFunction(fn, context);
        return (reason)=>promiseCall(fn, original, [
                reason
            ]);
    }
    // Class TransformStream
    /**
     * A transform stream consists of a pair of streams: a {@link WritableStream | writable stream},
     * known as its writable side, and a {@link ReadableStream | readable stream}, known as its readable side.
     * In a manner specific to the transform stream in question, writes to the writable side result in new data being
     * made available for reading from the readable side.
     *
     * @public
     */ class TransformStream {
        constructor(rawTransformer = {}, rawWritableStrategy = {}, rawReadableStrategy = {}){
            if (rawTransformer === undefined) {
                rawTransformer = null;
            }
            const writableStrategy = convertQueuingStrategy(rawWritableStrategy, 'Second parameter');
            const readableStrategy = convertQueuingStrategy(rawReadableStrategy, 'Third parameter');
            const transformer = convertTransformer(rawTransformer, 'First parameter');
            if (transformer.readableType !== undefined) {
                throw new RangeError('Invalid readableType specified');
            }
            if (transformer.writableType !== undefined) {
                throw new RangeError('Invalid writableType specified');
            }
            const readableHighWaterMark = ExtractHighWaterMark(readableStrategy, 0);
            const readableSizeAlgorithm = ExtractSizeAlgorithm(readableStrategy);
            const writableHighWaterMark = ExtractHighWaterMark(writableStrategy, 1);
            const writableSizeAlgorithm = ExtractSizeAlgorithm(writableStrategy);
            let startPromise_resolve;
            const startPromise = newPromise((resolve)=>{
                startPromise_resolve = resolve;
            });
            InitializeTransformStream(this, startPromise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm);
            SetUpTransformStreamDefaultControllerFromTransformer(this, transformer);
            if (transformer.start !== undefined) {
                startPromise_resolve(transformer.start(this._transformStreamController));
            } else {
                startPromise_resolve(undefined);
            }
        }
        /**
         * The readable side of the transform stream.
         */ get readable() {
            if (!IsTransformStream(this)) {
                throw streamBrandCheckException('readable');
            }
            return this._readable;
        }
        /**
         * The writable side of the transform stream.
         */ get writable() {
            if (!IsTransformStream(this)) {
                throw streamBrandCheckException('writable');
            }
            return this._writable;
        }
    }
    Object.defineProperties(TransformStream.prototype, {
        readable: {
            enumerable: true
        },
        writable: {
            enumerable: true
        }
    });
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(TransformStream.prototype, Symbol.toStringTag, {
            value: 'TransformStream',
            configurable: true
        });
    }
    function InitializeTransformStream(stream, startPromise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm) {
        function startAlgorithm() {
            return startPromise;
        }
        function writeAlgorithm(chunk) {
            return TransformStreamDefaultSinkWriteAlgorithm(stream, chunk);
        }
        function abortAlgorithm(reason) {
            return TransformStreamDefaultSinkAbortAlgorithm(stream, reason);
        }
        function closeAlgorithm() {
            return TransformStreamDefaultSinkCloseAlgorithm(stream);
        }
        stream._writable = CreateWritableStream(startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, writableHighWaterMark, writableSizeAlgorithm);
        function pullAlgorithm() {
            return TransformStreamDefaultSourcePullAlgorithm(stream);
        }
        function cancelAlgorithm(reason) {
            return TransformStreamDefaultSourceCancelAlgorithm(stream, reason);
        }
        stream._readable = CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, readableHighWaterMark, readableSizeAlgorithm);
        // The [[backpressure]] slot is set to undefined so that it can be initialised by TransformStreamSetBackpressure.
        stream._backpressure = undefined;
        stream._backpressureChangePromise = undefined;
        stream._backpressureChangePromise_resolve = undefined;
        TransformStreamSetBackpressure(stream, true);
        stream._transformStreamController = undefined;
    }
    function IsTransformStream(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_transformStreamController')) {
            return false;
        }
        return x instanceof TransformStream;
    }
    // This is a no-op if both sides are already errored.
    function TransformStreamError(stream, e) {
        ReadableStreamDefaultControllerError(stream._readable._readableStreamController, e);
        TransformStreamErrorWritableAndUnblockWrite(stream, e);
    }
    function TransformStreamErrorWritableAndUnblockWrite(stream, e) {
        TransformStreamDefaultControllerClearAlgorithms(stream._transformStreamController);
        WritableStreamDefaultControllerErrorIfNeeded(stream._writable._writableStreamController, e);
        TransformStreamUnblockWrite(stream);
    }
    function TransformStreamUnblockWrite(stream) {
        if (stream._backpressure) {
            // Pretend that pull() was called to permit any pending write() calls to complete. TransformStreamSetBackpressure()
            // cannot be called from enqueue() or pull() once the ReadableStream is errored, so this will will be the final time
            // _backpressure is set.
            TransformStreamSetBackpressure(stream, false);
        }
    }
    function TransformStreamSetBackpressure(stream, backpressure) {
        // Passes also when called during construction.
        if (stream._backpressureChangePromise !== undefined) {
            stream._backpressureChangePromise_resolve();
        }
        stream._backpressureChangePromise = newPromise((resolve)=>{
            stream._backpressureChangePromise_resolve = resolve;
        });
        stream._backpressure = backpressure;
    }
    // Class TransformStreamDefaultController
    /**
     * Allows control of the {@link ReadableStream} and {@link WritableStream} of the associated {@link TransformStream}.
     *
     * @public
     */ class TransformStreamDefaultController {
        constructor(){
            throw new TypeError('Illegal constructor');
        }
        /**
         * Returns the desired size to fill the readable side’s internal queue. It can be negative, if the queue is over-full.
         */ get desiredSize() {
            if (!IsTransformStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException('desiredSize');
            }
            const readableController = this._controlledTransformStream._readable._readableStreamController;
            return ReadableStreamDefaultControllerGetDesiredSize(readableController);
        }
        enqueue(chunk = undefined) {
            if (!IsTransformStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException('enqueue');
            }
            TransformStreamDefaultControllerEnqueue(this, chunk);
        }
        /**
         * Errors both the readable side and the writable side of the controlled transform stream, making all future
         * interactions with it fail with the given error `e`. Any chunks queued for transformation will be discarded.
         */ error(reason = undefined) {
            if (!IsTransformStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException('error');
            }
            TransformStreamDefaultControllerError(this, reason);
        }
        /**
         * Closes the readable side and errors the writable side of the controlled transform stream. This is useful when the
         * transformer only needs to consume a portion of the chunks written to the writable side.
         */ terminate() {
            if (!IsTransformStreamDefaultController(this)) {
                throw defaultControllerBrandCheckException('terminate');
            }
            TransformStreamDefaultControllerTerminate(this);
        }
    }
    Object.defineProperties(TransformStreamDefaultController.prototype, {
        enqueue: {
            enumerable: true
        },
        error: {
            enumerable: true
        },
        terminate: {
            enumerable: true
        },
        desiredSize: {
            enumerable: true
        }
    });
    setFunctionName(TransformStreamDefaultController.prototype.enqueue, 'enqueue');
    setFunctionName(TransformStreamDefaultController.prototype.error, 'error');
    setFunctionName(TransformStreamDefaultController.prototype.terminate, 'terminate');
    if (typeof Symbol.toStringTag === 'symbol') {
        Object.defineProperty(TransformStreamDefaultController.prototype, Symbol.toStringTag, {
            value: 'TransformStreamDefaultController',
            configurable: true
        });
    }
    // Transform Stream Default Controller Abstract Operations
    function IsTransformStreamDefaultController(x) {
        if (!typeIsObject(x)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(x, '_controlledTransformStream')) {
            return false;
        }
        return x instanceof TransformStreamDefaultController;
    }
    function SetUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm, cancelAlgorithm) {
        controller._controlledTransformStream = stream;
        stream._transformStreamController = controller;
        controller._transformAlgorithm = transformAlgorithm;
        controller._flushAlgorithm = flushAlgorithm;
        controller._cancelAlgorithm = cancelAlgorithm;
        controller._finishPromise = undefined;
        controller._finishPromise_resolve = undefined;
        controller._finishPromise_reject = undefined;
    }
    function SetUpTransformStreamDefaultControllerFromTransformer(stream, transformer) {
        const controller = Object.create(TransformStreamDefaultController.prototype);
        let transformAlgorithm;
        let flushAlgorithm;
        let cancelAlgorithm;
        if (transformer.transform !== undefined) {
            transformAlgorithm = (chunk)=>transformer.transform(chunk, controller);
        } else {
            transformAlgorithm = (chunk)=>{
                try {
                    TransformStreamDefaultControllerEnqueue(controller, chunk);
                    return promiseResolvedWith(undefined);
                } catch (transformResultE) {
                    return promiseRejectedWith(transformResultE);
                }
            };
        }
        if (transformer.flush !== undefined) {
            flushAlgorithm = ()=>transformer.flush(controller);
        } else {
            flushAlgorithm = ()=>promiseResolvedWith(undefined);
        }
        if (transformer.cancel !== undefined) {
            cancelAlgorithm = (reason)=>transformer.cancel(reason);
        } else {
            cancelAlgorithm = ()=>promiseResolvedWith(undefined);
        }
        SetUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm, cancelAlgorithm);
    }
    function TransformStreamDefaultControllerClearAlgorithms(controller) {
        controller._transformAlgorithm = undefined;
        controller._flushAlgorithm = undefined;
        controller._cancelAlgorithm = undefined;
    }
    function TransformStreamDefaultControllerEnqueue(controller, chunk) {
        const stream = controller._controlledTransformStream;
        const readableController = stream._readable._readableStreamController;
        if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(readableController)) {
            throw new TypeError('Readable side is not in a state that permits enqueue');
        }
        // We throttle transform invocations based on the backpressure of the ReadableStream, but we still
        // accept TransformStreamDefaultControllerEnqueue() calls.
        try {
            ReadableStreamDefaultControllerEnqueue(readableController, chunk);
        } catch (e) {
            // This happens when readableStrategy.size() throws.
            TransformStreamErrorWritableAndUnblockWrite(stream, e);
            throw stream._readable._storedError;
        }
        const backpressure = ReadableStreamDefaultControllerHasBackpressure(readableController);
        if (backpressure !== stream._backpressure) {
            TransformStreamSetBackpressure(stream, true);
        }
    }
    function TransformStreamDefaultControllerError(controller, e) {
        TransformStreamError(controller._controlledTransformStream, e);
    }
    function TransformStreamDefaultControllerPerformTransform(controller, chunk) {
        const transformPromise = controller._transformAlgorithm(chunk);
        return transformPromiseWith(transformPromise, undefined, (r)=>{
            TransformStreamError(controller._controlledTransformStream, r);
            throw r;
        });
    }
    function TransformStreamDefaultControllerTerminate(controller) {
        const stream = controller._controlledTransformStream;
        const readableController = stream._readable._readableStreamController;
        ReadableStreamDefaultControllerClose(readableController);
        const error = new TypeError('TransformStream terminated');
        TransformStreamErrorWritableAndUnblockWrite(stream, error);
    }
    // TransformStreamDefaultSink Algorithms
    function TransformStreamDefaultSinkWriteAlgorithm(stream, chunk) {
        const controller = stream._transformStreamController;
        if (stream._backpressure) {
            const backpressureChangePromise = stream._backpressureChangePromise;
            return transformPromiseWith(backpressureChangePromise, ()=>{
                const writable = stream._writable;
                const state = writable._state;
                if (state === 'erroring') {
                    throw writable._storedError;
                }
                return TransformStreamDefaultControllerPerformTransform(controller, chunk);
            });
        }
        return TransformStreamDefaultControllerPerformTransform(controller, chunk);
    }
    function TransformStreamDefaultSinkAbortAlgorithm(stream, reason) {
        const controller = stream._transformStreamController;
        if (controller._finishPromise !== undefined) {
            return controller._finishPromise;
        }
        // stream._readable cannot change after construction, so caching it across a call to user code is safe.
        const readable = stream._readable;
        // Assign the _finishPromise now so that if _cancelAlgorithm calls readable.cancel() internally,
        // we don't run the _cancelAlgorithm again.
        controller._finishPromise = newPromise((resolve, reject)=>{
            controller._finishPromise_resolve = resolve;
            controller._finishPromise_reject = reject;
        });
        const cancelPromise = controller._cancelAlgorithm(reason);
        TransformStreamDefaultControllerClearAlgorithms(controller);
        uponPromise(cancelPromise, ()=>{
            if (readable._state === 'errored') {
                defaultControllerFinishPromiseReject(controller, readable._storedError);
            } else {
                ReadableStreamDefaultControllerError(readable._readableStreamController, reason);
                defaultControllerFinishPromiseResolve(controller);
            }
            return null;
        }, (r)=>{
            ReadableStreamDefaultControllerError(readable._readableStreamController, r);
            defaultControllerFinishPromiseReject(controller, r);
            return null;
        });
        return controller._finishPromise;
    }
    function TransformStreamDefaultSinkCloseAlgorithm(stream) {
        const controller = stream._transformStreamController;
        if (controller._finishPromise !== undefined) {
            return controller._finishPromise;
        }
        // stream._readable cannot change after construction, so caching it across a call to user code is safe.
        const readable = stream._readable;
        // Assign the _finishPromise now so that if _flushAlgorithm calls readable.cancel() internally,
        // we don't also run the _cancelAlgorithm.
        controller._finishPromise = newPromise((resolve, reject)=>{
            controller._finishPromise_resolve = resolve;
            controller._finishPromise_reject = reject;
        });
        const flushPromise = controller._flushAlgorithm();
        TransformStreamDefaultControllerClearAlgorithms(controller);
        uponPromise(flushPromise, ()=>{
            if (readable._state === 'errored') {
                defaultControllerFinishPromiseReject(controller, readable._storedError);
            } else {
                ReadableStreamDefaultControllerClose(readable._readableStreamController);
                defaultControllerFinishPromiseResolve(controller);
            }
            return null;
        }, (r)=>{
            ReadableStreamDefaultControllerError(readable._readableStreamController, r);
            defaultControllerFinishPromiseReject(controller, r);
            return null;
        });
        return controller._finishPromise;
    }
    // TransformStreamDefaultSource Algorithms
    function TransformStreamDefaultSourcePullAlgorithm(stream) {
        // Invariant. Enforced by the promises returned by start() and pull().
        TransformStreamSetBackpressure(stream, false);
        // Prevent the next pull() call until there is backpressure.
        return stream._backpressureChangePromise;
    }
    function TransformStreamDefaultSourceCancelAlgorithm(stream, reason) {
        const controller = stream._transformStreamController;
        if (controller._finishPromise !== undefined) {
            return controller._finishPromise;
        }
        // stream._writable cannot change after construction, so caching it across a call to user code is safe.
        const writable = stream._writable;
        // Assign the _finishPromise now so that if _flushAlgorithm calls writable.abort() or
        // writable.cancel() internally, we don't run the _cancelAlgorithm again, or also run the
        // _flushAlgorithm.
        controller._finishPromise = newPromise((resolve, reject)=>{
            controller._finishPromise_resolve = resolve;
            controller._finishPromise_reject = reject;
        });
        const cancelPromise = controller._cancelAlgorithm(reason);
        TransformStreamDefaultControllerClearAlgorithms(controller);
        uponPromise(cancelPromise, ()=>{
            if (writable._state === 'errored') {
                defaultControllerFinishPromiseReject(controller, writable._storedError);
            } else {
                WritableStreamDefaultControllerErrorIfNeeded(writable._writableStreamController, reason);
                TransformStreamUnblockWrite(stream);
                defaultControllerFinishPromiseResolve(controller);
            }
            return null;
        }, (r)=>{
            WritableStreamDefaultControllerErrorIfNeeded(writable._writableStreamController, r);
            TransformStreamUnblockWrite(stream);
            defaultControllerFinishPromiseReject(controller, r);
            return null;
        });
        return controller._finishPromise;
    }
    // Helper functions for the TransformStreamDefaultController.
    function defaultControllerBrandCheckException(name) {
        return new TypeError(`TransformStreamDefaultController.prototype.${name} can only be used on a TransformStreamDefaultController`);
    }
    function defaultControllerFinishPromiseResolve(controller) {
        if (controller._finishPromise_resolve === undefined) {
            return;
        }
        controller._finishPromise_resolve();
        controller._finishPromise_resolve = undefined;
        controller._finishPromise_reject = undefined;
    }
    function defaultControllerFinishPromiseReject(controller, reason) {
        if (controller._finishPromise_reject === undefined) {
            return;
        }
        setPromiseIsHandledToTrue(controller._finishPromise);
        controller._finishPromise_reject(reason);
        controller._finishPromise_resolve = undefined;
        controller._finishPromise_reject = undefined;
    }
    // Helper functions for the TransformStream.
    function streamBrandCheckException(name) {
        return new TypeError(`TransformStream.prototype.${name} can only be used on a TransformStream`);
    }
    exports1.ByteLengthQueuingStrategy = ByteLengthQueuingStrategy;
    exports1.CountQueuingStrategy = CountQueuingStrategy;
    exports1.ReadableByteStreamController = ReadableByteStreamController;
    exports1.ReadableStream = ReadableStream;
    exports1.ReadableStreamBYOBReader = ReadableStreamBYOBReader;
    exports1.ReadableStreamBYOBRequest = ReadableStreamBYOBRequest;
    exports1.ReadableStreamDefaultController = ReadableStreamDefaultController;
    exports1.ReadableStreamDefaultReader = ReadableStreamDefaultReader;
    exports1.TransformStream = TransformStream;
    exports1.TransformStreamDefaultController = TransformStreamDefaultController;
    exports1.WritableStream = WritableStream;
    exports1.WritableStreamDefaultController = WritableStreamDefaultController;
    exports1.WritableStreamDefaultWriter = WritableStreamDefaultWriter;
}); //# sourceMappingURL=ponyfill.es2018.js.map
}}),

};

//# sourceMappingURL=08b5e__pnpm_0f3dd8._.js.map