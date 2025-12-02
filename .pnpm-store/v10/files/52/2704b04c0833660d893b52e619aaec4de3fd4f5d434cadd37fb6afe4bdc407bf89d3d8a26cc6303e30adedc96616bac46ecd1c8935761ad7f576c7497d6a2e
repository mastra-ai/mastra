var Ct = Object.defineProperty;
var s = (r, e) => Ct(r, "name", { value: e, configurable: !0 });

// src/channels/index.ts
import { global as Wo } from "@storybook/global";

// ../node_modules/ts-dedent/esm/index.js
function L(r) {
  for (var e = [], t = 1; t < arguments.length; t++)
    e[t - 1] = arguments[t];
  var n = Array.from(typeof r == "string" ? [r] : r);
  n[n.length - 1] = n[n.length - 1].replace(/\r?\n([\t ]*)$/, "");
  var o = n.reduce(function(c, i) {
    var u = i.match(/\n([\t ]+|(?!\s).)/g);
    return u ? c.concat(u.map(function(y) {
      var f, h;
      return (h = (f = y.match(/[\t ]/g)) === null || f === void 0 ? void 0 : f.length) !== null && h !== void 0 ? h : 0;
    })) : c;
  }, []);
  if (o.length) {
    var p = new RegExp(`
[	 ]{` + Math.min.apply(Math, o) + "}", "g");
    n = n.map(function(c) {
      return c.replace(p, `
`);
    });
  }
  n[0] = n[0].replace(/^\r?\n/, "");
  var a = n[0];
  return e.forEach(function(c, i) {
    var u = a.match(/(?:^|\n)( *)$/), y = u ? u[1] : "", f = c;
    typeof c == "string" && c.includes(`
`) && (f = String(c).split(`
`).map(function(h, m) {
      return m === 0 ? h : "" + y + h;
    }).join(`
`)), a += f + n[i + 1];
  }), a;
}
s(L, "dedent");

// src/shared/universal-store/instances.ts
var ge = /* @__PURE__ */ new Map();

// src/shared/universal-store/index.ts
var Nt = "UNIVERSAL_STORE:", w = {
  PENDING: "PENDING",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED"
}, l = class l {
  constructor(e, t) {
    /** Enable debug logs for this store */
    this.debugging = !1;
    // TODO: narrow type of listeners based on event type
    this.listeners = /* @__PURE__ */ new Map([["*", /* @__PURE__ */ new Set()]]);
    /** Gets the current state */
    this.getState = /* @__PURE__ */ s(() => (this.debug("getState", { state: this.state }), this.state), "getState");
    /**
     * Subscribes to store events
     *
     * @returns A function to unsubscribe
     */
    this.subscribe = /* @__PURE__ */ s((e, t) => {
      let n = typeof e == "function", o = n ? "*" : e, p = n ? e : t;
      if (this.debug("subscribe", { eventType: o, listener: p }), !p)
        throw new TypeError(
          `Missing first subscribe argument, or second if first is the event type, when subscribing to a UniversalStore with id '${this.id}'`
        );
      return this.listeners.has(o) || this.listeners.set(o, /* @__PURE__ */ new Set()), this.listeners.get(o).add(p), () => {
        this.debug("unsubscribe", { eventType: o, listener: p }), this.listeners.has(o) && (this.listeners.get(o).delete(p), this.listeners.
        get(o)?.size === 0 && this.listeners.delete(o));
      };
    }, "subscribe");
    /** Sends a custom event to the other stores */
    this.send = /* @__PURE__ */ s((e) => {
      if (this.debug("send", { event: e }), this.status !== l.Status.READY)
        throw new TypeError(
          L`Cannot send event before store is ready. You can get the current status with store.status,
        or await store.readyPromise to wait for the store to be ready before sending events.
        ${JSON.stringify(
            {
              event: e,
              id: this.id,
              actor: this.actor,
              environment: this.environment
            },
            null,
            2
          )}`
        );
      this.emitToListeners(e, { actor: this.actor }), this.emitToChannel(e, { actor: this.actor });
    }, "send");
    if (this.debugging = e.debug ?? !1, !l.isInternalConstructing)
      throw new TypeError(
        "UniversalStore is not constructable - use UniversalStore.create() instead"
      );
    if (l.isInternalConstructing = !1, this.id = e.id, this.actorId = Date.now().toString(36) + Math.random().toString(36).substring(2), this.
    actorType = e.leader ? l.ActorType.LEADER : l.ActorType.FOLLOWER, this.state = e.initialState, this.channelEventName = `${Nt}${this.id}`,
    this.debug("constructor", {
      options: e,
      environmentOverrides: t,
      channelEventName: this.channelEventName
    }), this.actor.type === l.ActorType.LEADER)
      this.syncing = {
        state: w.RESOLVED,
        promise: Promise.resolve()
      };
    else {
      let n, o, p = new Promise((a, c) => {
        n = /* @__PURE__ */ s(() => {
          this.syncing.state === w.PENDING && (this.syncing.state = w.RESOLVED, a());
        }, "syncingResolve"), o = /* @__PURE__ */ s((i) => {
          this.syncing.state === w.PENDING && (this.syncing.state = w.REJECTED, c(i));
        }, "syncingReject");
      });
      this.syncing = {
        state: w.PENDING,
        promise: p,
        resolve: n,
        reject: o
      };
    }
    this.getState = this.getState.bind(this), this.setState = this.setState.bind(this), this.subscribe = this.subscribe.bind(this), this.onStateChange =
    this.onStateChange.bind(this), this.send = this.send.bind(this), this.emitToChannel = this.emitToChannel.bind(this), this.prepareThis = this.
    prepareThis.bind(this), this.emitToListeners = this.emitToListeners.bind(this), this.handleChannelEvents = this.handleChannelEvents.bind(
    this), this.debug = this.debug.bind(this), this.channel = t?.channel ?? l.preparation.channel, this.environment = t?.environment ?? l.preparation.
    environment, this.channel && this.environment ? (l.preparation.resolve({ channel: this.channel, environment: this.environment }), this.prepareThis(
    { channel: this.channel, environment: this.environment })) : l.preparation.promise.then(this.prepareThis);
  }
  static setupPreparationPromise() {
    let e, t, n = new Promise(
      (o, p) => {
        e = /* @__PURE__ */ s((a) => {
          o(a);
        }, "resolveRef"), t = /* @__PURE__ */ s((...a) => {
          p(a);
        }, "rejectRef");
      }
    );
    l.preparation = {
      resolve: e,
      reject: t,
      promise: n
    };
  }
  /** The actor object representing the store instance with a unique ID and a type */
  get actor() {
    return Object.freeze({
      id: this.actorId,
      type: this.actorType,
      environment: this.environment ?? l.Environment.UNKNOWN
    });
  }
  /**
   * The current state of the store, that signals both if the store is prepared by Storybook and
   * also - in the case of a follower - if the state has been synced with the leader's state.
   */
  get status() {
    if (!this.channel || !this.environment)
      return l.Status.UNPREPARED;
    switch (this.syncing?.state) {
      case w.PENDING:
      case void 0:
        return l.Status.SYNCING;
      case w.REJECTED:
        return l.Status.ERROR;
      case w.RESOLVED:
      default:
        return l.Status.READY;
    }
  }
  /**
   * A promise that resolves when the store is fully ready. A leader will be ready when the store
   * has been prepared by Storybook, which is almost instantly.
   *
   * A follower will be ready when the state has been synced with the leader's state, within a few
   * hundred milliseconds.
   */
  untilReady() {
    return Promise.all([l.preparation.promise, this.syncing?.promise]);
  }
  /** Creates a new instance of UniversalStore */
  static create(e) {
    if (!e || typeof e?.id != "string")
      throw new TypeError("id is required and must be a string, when creating a UniversalStore");
    e.debug && console.debug(
      L`[UniversalStore]
        create`,
      { options: e }
    );
    let t = ge.get(e.id);
    if (t)
      return console.warn(L`UniversalStore with id "${e.id}" already exists in this environment, re-using existing.
        You should reuse the existing instance instead of trying to create a new one.`), t;
    l.isInternalConstructing = !0;
    let n = new l(e);
    return ge.set(e.id, n), n;
  }
  /**
   * Used by Storybook to set the channel for all instances of UniversalStore in the given
   * environment.
   *
   * @internal
   */
  static __prepare(e, t) {
    l.preparation.channel = e, l.preparation.environment = t, l.preparation.resolve({ channel: e, environment: t });
  }
  /**
   * Updates the store's state
   *
   * Either a new state or a state updater function can be passed to the method.
   */
  setState(e) {
    let t = this.state, n = typeof e == "function" ? e(t) : e;
    if (this.debug("setState", { newState: n, previousState: t, updater: e }), this.status !== l.Status.READY)
      throw new TypeError(
        L`Cannot set state before store is ready. You can get the current status with store.status,
        or await store.readyPromise to wait for the store to be ready before sending events.
        ${JSON.stringify(
          {
            newState: n,
            id: this.id,
            actor: this.actor,
            environment: this.environment
          },
          null,
          2
        )}`
      );
    this.state = n;
    let o = {
      type: l.InternalEventType.SET_STATE,
      payload: {
        state: n,
        previousState: t
      }
    };
    this.emitToChannel(o, { actor: this.actor }), this.emitToListeners(o, { actor: this.actor });
  }
  /**
   * Subscribes to state changes
   *
   * @returns Unsubscribe function
   */
  onStateChange(e) {
    return this.debug("onStateChange", { listener: e }), this.subscribe(
      l.InternalEventType.SET_STATE,
      ({ payload: t }, n) => {
        e(t.state, t.previousState, n);
      }
    );
  }
  emitToChannel(e, t) {
    this.debug("emitToChannel", { event: e, eventInfo: t, channel: !!this.channel }), this.channel?.emit(this.channelEventName, {
      event: e,
      eventInfo: t
    });
  }
  prepareThis({
    channel: e,
    environment: t
  }) {
    this.channel = e, this.environment = t, this.debug("prepared", { channel: !!e, environment: t }), this.channel.on(this.channelEventName,
    this.handleChannelEvents), this.actor.type === l.ActorType.LEADER ? this.emitToChannel(
      { type: l.InternalEventType.LEADER_CREATED },
      { actor: this.actor }
    ) : (this.emitToChannel(
      { type: l.InternalEventType.FOLLOWER_CREATED },
      { actor: this.actor }
    ), this.emitToChannel(
      { type: l.InternalEventType.EXISTING_STATE_REQUEST },
      { actor: this.actor }
    ), setTimeout(() => {
      this.syncing.reject(
        new TypeError(
          `No existing state found for follower with id: '${this.id}'. Make sure a leader with the same id exists before creating a follower\
.`
        )
      );
    }, 1e3));
  }
  emitToListeners(e, t) {
    let n = this.listeners.get(e.type), o = this.listeners.get("*");
    this.debug("emitToListeners", {
      event: e,
      eventInfo: t,
      eventTypeListeners: n,
      everythingListeners: o
    }), [...n ?? [], ...o ?? []].forEach(
      (p) => p(e, t)
    );
  }
  handleChannelEvents(e) {
    let { event: t, eventInfo: n } = e;
    if ([n.actor.id, n.forwardingActor?.id].includes(this.actor.id)) {
      this.debug("handleChannelEvents: Ignoring event from self", { channelEvent: e });
      return;
    } else if (this.syncing?.state === w.PENDING && t.type !== l.InternalEventType.EXISTING_STATE_RESPONSE) {
      this.debug("handleChannelEvents: Ignoring event while syncing", { channelEvent: e });
      return;
    }
    if (this.debug("handleChannelEvents", { channelEvent: e }), this.actor.type === l.ActorType.LEADER) {
      let o = !0;
      switch (t.type) {
        case l.InternalEventType.EXISTING_STATE_REQUEST:
          o = !1;
          let p = {
            type: l.InternalEventType.EXISTING_STATE_RESPONSE,
            payload: this.state
          };
          this.debug("handleChannelEvents: responding to existing state request", {
            responseEvent: p
          }), this.emitToChannel(p, { actor: this.actor }), this.emitToListeners(p, { actor: this.actor });
          break;
        case l.InternalEventType.LEADER_CREATED:
          o = !1, this.syncing.state = w.REJECTED, this.debug("handleChannelEvents: erroring due to second leader being created", {
            event: t
          }), console.error(
            L`Detected multiple UniversalStore leaders created with the same id "${this.id}".
            Only one leader can exists at a time, your stores are now in an invalid state.
            Leaders detected:
            this: ${JSON.stringify(this.actor, null, 2)}
            other: ${JSON.stringify(n.actor, null, 2)}`
          );
          break;
      }
      o && (this.debug("handleChannelEvents: forwarding event", { channelEvent: e }), this.emitToChannel(t, { actor: n.actor, forwardingActor: this.
      actor }));
    }
    if (this.actor.type === l.ActorType.FOLLOWER)
      switch (t.type) {
        case l.InternalEventType.EXISTING_STATE_RESPONSE:
          if (this.debug("handleChannelEvents: Setting state from leader's existing state response", {
            event: t
          }), this.syncing?.state !== w.PENDING)
            break;
          this.syncing.resolve?.();
          let o = {
            type: l.InternalEventType.SET_STATE,
            payload: {
              state: t.payload,
              previousState: this.state
            }
          };
          this.state = t.payload, this.emitToListeners(o, n);
          break;
      }
    switch (t.type) {
      case l.InternalEventType.SET_STATE:
        this.debug("handleChannelEvents: Setting state", { event: t }), this.state = t.payload.state;
        break;
    }
    this.emitToListeners(t, { actor: n.actor });
  }
  debug(e, t) {
    this.debugging && console.debug(
      L`[UniversalStore::${this.id}::${this.environment ?? l.Environment.UNKNOWN}]
        ${e}`,
      JSON.stringify(
        {
          data: t,
          actor: this.actor,
          state: this.state,
          status: this.status
        },
        null,
        2
      )
    );
  }
  /**
   * Used to reset the static fields of the UniversalStore class when cleaning up tests
   *
   * @internal
   */
  static __reset() {
    l.preparation.reject(new Error("reset")), l.setupPreparationPromise(), l.isInternalConstructing = !1;
  }
};
s(l, "UniversalStore"), /**
 * Defines the possible actor types in the store system
 *
 * @readonly
 */
l.ActorType = {
  LEADER: "LEADER",
  FOLLOWER: "FOLLOWER"
}, /**
 * Defines the possible environments the store can run in
 *
 * @readonly
 */
l.Environment = {
  SERVER: "SERVER",
  MANAGER: "MANAGER",
  PREVIEW: "PREVIEW",
  UNKNOWN: "UNKNOWN",
  MOCK: "MOCK"
}, /**
 * Internal event types used for store synchronization
 *
 * @readonly
 */
l.InternalEventType = {
  EXISTING_STATE_REQUEST: "__EXISTING_STATE_REQUEST",
  EXISTING_STATE_RESPONSE: "__EXISTING_STATE_RESPONSE",
  SET_STATE: "__SET_STATE",
  LEADER_CREATED: "__LEADER_CREATED",
  FOLLOWER_CREATED: "__FOLLOWER_CREATED"
}, l.Status = {
  UNPREPARED: "UNPREPARED",
  SYNCING: "SYNCING",
  READY: "READY",
  ERROR: "ERROR"
}, // This is used to check if constructor was called from the static factory create()
l.isInternalConstructing = !1, l.setupPreparationPromise();
var U = l;

// src/channels/main.ts
var It = /* @__PURE__ */ s((r) => r.transports !== void 0, "isMulti"), Rt = /* @__PURE__ */ s(() => Math.random().toString(16).slice(2), "ge\
nerateRandomId"), me = class me {
  constructor(e = {}) {
    this.sender = Rt();
    this.events = {};
    this.data = {};
    this.transports = [];
    this.isAsync = e.async || !1, It(e) ? (this.transports = e.transports || [], this.transports.forEach((t) => {
      t.setHandler((n) => this.handleEvent(n));
    })) : this.transports = e.transport ? [e.transport] : [], this.transports.forEach((t) => {
      t.setHandler((n) => this.handleEvent(n));
    });
  }
  get hasTransport() {
    return this.transports.length > 0;
  }
  addListener(e, t) {
    this.events[e] = this.events[e] || [], this.events[e].push(t);
  }
  emit(e, ...t) {
    let n = { type: e, args: t, from: this.sender }, o = {};
    t.length >= 1 && t[0] && t[0].options && (o = t[0].options);
    let p = /* @__PURE__ */ s(() => {
      this.transports.forEach((a) => {
        a.send(n, o);
      }), this.handleEvent(n);
    }, "handler");
    this.isAsync ? setImmediate(p) : p();
  }
  last(e) {
    return this.data[e];
  }
  eventNames() {
    return Object.keys(this.events);
  }
  listenerCount(e) {
    let t = this.listeners(e);
    return t ? t.length : 0;
  }
  listeners(e) {
    return this.events[e] || void 0;
  }
  once(e, t) {
    let n = this.onceListener(e, t);
    this.addListener(e, n);
  }
  removeAllListeners(e) {
    e ? this.events[e] && delete this.events[e] : this.events = {};
  }
  removeListener(e, t) {
    let n = this.listeners(e);
    n && (this.events[e] = n.filter((o) => o !== t));
  }
  on(e, t) {
    this.addListener(e, t);
  }
  off(e, t) {
    this.removeListener(e, t);
  }
  handleEvent(e) {
    let t = this.listeners(e.type);
    t && t.length && t.forEach((n) => {
      n.apply(e, e.args);
    }), this.data[e.type] = e.args;
  }
  onceListener(e, t) {
    let n = /* @__PURE__ */ s((...o) => (this.removeListener(e, n), t(...o)), "onceListener");
    return n;
  }
};
s(me, "Channel");
var z = me;

// src/channels/postmessage/index.ts
import { logger as ct, pretty as lt } from "storybook/internal/client-logger";
import * as Uo from "storybook/internal/core-events";
import { global as S } from "@storybook/global";

// ../node_modules/telejson/dist/chunk-EAFQLD22.mjs
var jt = Object.create, Fe = Object.defineProperty, Lt = Object.getOwnPropertyDescriptor, Me = Object.getOwnPropertyNames, Dt = Object.getPrototypeOf,
$t = Object.prototype.hasOwnProperty, d = /* @__PURE__ */ s((r, e) => /* @__PURE__ */ s(function() {
  return e || (0, r[Me(r)[0]])((e = { exports: {} }).exports, e), e.exports;
}, "__require"), "__commonJS"), Ft = /* @__PURE__ */ s((r, e, t, n) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let o of Me(e))
      !$t.call(r, o) && o !== t && Fe(r, o, { get: /* @__PURE__ */ s(() => e[o], "get"), enumerable: !(n = Lt(e, o)) || n.enumerable });
  return r;
}, "__copyProps"), pe = /* @__PURE__ */ s((r, e, t) => (t = r != null ? jt(Dt(r)) : {}, Ft(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  e || !r || !r.__esModule ? Fe(t, "default", { value: r, enumerable: !0 }) : t,
  r
)), "__toESM"), Mt = [
  "bubbles",
  "cancelBubble",
  "cancelable",
  "composed",
  "currentTarget",
  "defaultPrevented",
  "eventPhase",
  "isTrusted",
  "returnValue",
  "srcElement",
  "target",
  "timeStamp",
  "type"
], Ut = ["detail"];
function Ue(r) {
  let e = Mt.filter((t) => r[t] !== void 0).reduce((t, n) => (t[n] = r[n], t), {});
  if (r instanceof CustomEvent)
    for (let t of Ut.filter(
      (n) => r[n] !== void 0
    ))
      e[t] = r[t];
  return e;
}
s(Ue, "extractEventHiddenProperties");

// ../node_modules/telejson/dist/index.mjs
var He = d({
  "node_modules/.pnpm/es-object-atoms@1.1.1/node_modules/es-object-atoms/index.js"(r, e) {
    "use strict";
    e.exports = Object;
  }
}), Gt = d({
  "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/index.js"(r, e) {
    "use strict";
    e.exports = Error;
  }
}), kt = d({
  "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/eval.js"(r, e) {
    "use strict";
    e.exports = EvalError;
  }
}), Wt = d({
  "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/range.js"(r, e) {
    "use strict";
    e.exports = RangeError;
  }
}), qt = d({
  "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/ref.js"(r, e) {
    "use strict";
    e.exports = ReferenceError;
  }
}), Bt = d({
  "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/syntax.js"(r, e) {
    "use strict";
    e.exports = SyntaxError;
  }
}), Ee = d({
  "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/type.js"(r, e) {
    "use strict";
    e.exports = TypeError;
  }
}), Ht = d({
  "node_modules/.pnpm/es-errors@1.3.0/node_modules/es-errors/uri.js"(r, e) {
    "use strict";
    e.exports = URIError;
  }
}), Vt = d({
  "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/abs.js"(r, e) {
    "use strict";
    e.exports = Math.abs;
  }
}), Jt = d({
  "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/floor.js"(r, e) {
    "use strict";
    e.exports = Math.floor;
  }
}), zt = d({
  "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/max.js"(r, e) {
    "use strict";
    e.exports = Math.max;
  }
}), Yt = d({
  "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/min.js"(r, e) {
    "use strict";
    e.exports = Math.min;
  }
}), Kt = d({
  "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/pow.js"(r, e) {
    "use strict";
    e.exports = Math.pow;
  }
}), Xt = d({
  "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/round.js"(r, e) {
    "use strict";
    e.exports = Math.round;
  }
}), Qt = d({
  "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/isNaN.js"(r, e) {
    "use strict";
    e.exports = Number.isNaN || /* @__PURE__ */ s(function(n) {
      return n !== n;
    }, "isNaN2");
  }
}), Zt = d({
  "node_modules/.pnpm/math-intrinsics@1.1.0/node_modules/math-intrinsics/sign.js"(r, e) {
    "use strict";
    var t = Qt();
    e.exports = /* @__PURE__ */ s(function(o) {
      return t(o) || o === 0 ? o : o < 0 ? -1 : 1;
    }, "sign");
  }
}), er = d({
  "node_modules/.pnpm/gopd@1.2.0/node_modules/gopd/gOPD.js"(r, e) {
    "use strict";
    e.exports = Object.getOwnPropertyDescriptor;
  }
}), _e = d({
  "node_modules/.pnpm/gopd@1.2.0/node_modules/gopd/index.js"(r, e) {
    "use strict";
    var t = er();
    if (t)
      try {
        t([], "length");
      } catch {
        t = null;
      }
    e.exports = t;
  }
}), tr = d({
  "node_modules/.pnpm/es-define-property@1.0.1/node_modules/es-define-property/index.js"(r, e) {
    "use strict";
    var t = Object.defineProperty || !1;
    if (t)
      try {
        t({}, "a", { value: 1 });
      } catch {
        t = !1;
      }
    e.exports = t;
  }
}), Ve = d({
  "node_modules/.pnpm/has-symbols@1.1.0/node_modules/has-symbols/shams.js"(r, e) {
    "use strict";
    e.exports = /* @__PURE__ */ s(function() {
      if (typeof Symbol != "function" || typeof Object.getOwnPropertySymbols != "function")
        return !1;
      if (typeof Symbol.iterator == "symbol")
        return !0;
      var n = {}, o = Symbol("test"), p = Object(o);
      if (typeof o == "string" || Object.prototype.toString.call(o) !== "[object Symbol]" || Object.prototype.toString.call(p) !== "[object \
Symbol]")
        return !1;
      var a = 42;
      n[o] = a;
      for (var c in n)
        return !1;
      if (typeof Object.keys == "function" && Object.keys(n).length !== 0 || typeof Object.getOwnPropertyNames == "function" && Object.getOwnPropertyNames(
      n).length !== 0)
        return !1;
      var i = Object.getOwnPropertySymbols(n);
      if (i.length !== 1 || i[0] !== o || !Object.prototype.propertyIsEnumerable.call(n, o))
        return !1;
      if (typeof Object.getOwnPropertyDescriptor == "function") {
        var u = (
          /** @type {PropertyDescriptor} */
          Object.getOwnPropertyDescriptor(n, o)
        );
        if (u.value !== a || u.enumerable !== !0)
          return !1;
      }
      return !0;
    }, "hasSymbols");
  }
}), Je = d({
  "node_modules/.pnpm/has-symbols@1.1.0/node_modules/has-symbols/index.js"(r, e) {
    "use strict";
    var t = typeof Symbol < "u" && Symbol, n = Ve();
    e.exports = /* @__PURE__ */ s(function() {
      return typeof t != "function" || typeof Symbol != "function" || typeof t("foo") != "symbol" || typeof Symbol("bar") != "symbol" ? !1 :
      n();
    }, "hasNativeSymbols");
  }
}), ze = d({
  "node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/Reflect.getPrototypeOf.js"(r, e) {
    "use strict";
    e.exports = typeof Reflect < "u" && Reflect.getPrototypeOf || null;
  }
}), Ye = d({
  "node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/Object.getPrototypeOf.js"(r, e) {
    "use strict";
    var t = He();
    e.exports = t.getPrototypeOf || null;
  }
}), rr = d({
  "node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/implementation.js"(r, e) {
    "use strict";
    var t = "Function.prototype.bind called on incompatible ", n = Object.prototype.toString, o = Math.max, p = "[object Function]", a = /* @__PURE__ */ s(
    function(y, f) {
      for (var h = [], m = 0; m < y.length; m += 1)
        h[m] = y[m];
      for (var g = 0; g < f.length; g += 1)
        h[g + y.length] = f[g];
      return h;
    }, "concatty2"), c = /* @__PURE__ */ s(function(y, f) {
      for (var h = [], m = f || 0, g = 0; m < y.length; m += 1, g += 1)
        h[g] = y[m];
      return h;
    }, "slicy2"), i = /* @__PURE__ */ s(function(u, y) {
      for (var f = "", h = 0; h < u.length; h += 1)
        f += u[h], h + 1 < u.length && (f += y);
      return f;
    }, "joiny");
    e.exports = /* @__PURE__ */ s(function(y) {
      var f = this;
      if (typeof f != "function" || n.apply(f) !== p)
        throw new TypeError(t + f);
      for (var h = c(arguments, 1), m, g = /* @__PURE__ */ s(function() {
        if (this instanceof m) {
          var R = f.apply(
            this,
            a(h, arguments)
          );
          return Object(R) === R ? R : this;
        }
        return f.apply(
          y,
          a(h, arguments)
        );
      }, "binder"), N = o(0, f.length - h.length), P = [], x = 0; x < N; x++)
        P[x] = "$" + x;
      if (m = Function("binder", "return function (" + i(P, ",") + "){ return binder.apply(this,arguments); }")(g), f.prototype) {
        var D = /* @__PURE__ */ s(function() {
        }, "Empty2");
        D.prototype = f.prototype, m.prototype = new D(), D.prototype = null;
      }
      return m;
    }, "bind");
  }
}), ce = d({
  "node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/index.js"(r, e) {
    "use strict";
    var t = rr();
    e.exports = Function.prototype.bind || t;
  }
}), be = d({
  "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/functionCall.js"(r, e) {
    "use strict";
    e.exports = Function.prototype.call;
  }
}), Ke = d({
  "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/functionApply.js"(r, e) {
    "use strict";
    e.exports = Function.prototype.apply;
  }
}), nr = d({
  "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/reflectApply.js"(r, e) {
    "use strict";
    e.exports = typeof Reflect < "u" && Reflect && Reflect.apply;
  }
}), or = d({
  "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/actualApply.js"(r, e) {
    "use strict";
    var t = ce(), n = Ke(), o = be(), p = nr();
    e.exports = p || t.call(o, n);
  }
}), Xe = d({
  "node_modules/.pnpm/call-bind-apply-helpers@1.0.2/node_modules/call-bind-apply-helpers/index.js"(r, e) {
    "use strict";
    var t = ce(), n = Ee(), o = be(), p = or();
    e.exports = /* @__PURE__ */ s(function(c) {
      if (c.length < 1 || typeof c[0] != "function")
        throw new n("a function is required");
      return p(t, o, c);
    }, "callBindBasic");
  }
}), sr = d({
  "node_modules/.pnpm/dunder-proto@1.0.1/node_modules/dunder-proto/get.js"(r, e) {
    "use strict";
    var t = Xe(), n = _e(), o;
    try {
      o = /** @type {{ __proto__?: typeof Array.prototype }} */
      [].__proto__ === Array.prototype;
    } catch (i) {
      if (!i || typeof i != "object" || !("code" in i) || i.code !== "ERR_PROTO_ACCESS")
        throw i;
    }
    var p = !!o && n && n(
      Object.prototype,
      /** @type {keyof typeof Object.prototype} */
      "__proto__"
    ), a = Object, c = a.getPrototypeOf;
    e.exports = p && typeof p.get == "function" ? t([p.get]) : typeof c == "function" ? (
      /** @type {import('./get')} */
      /* @__PURE__ */ s(function(u) {
        return c(u == null ? u : a(u));
      }, "getDunder")
    ) : !1;
  }
}), ir = d({
  "node_modules/.pnpm/get-proto@1.0.1/node_modules/get-proto/index.js"(r, e) {
    "use strict";
    var t = ze(), n = Ye(), o = sr();
    e.exports = t ? /* @__PURE__ */ s(function(a) {
      return t(a);
    }, "getProto") : n ? /* @__PURE__ */ s(function(a) {
      if (!a || typeof a != "object" && typeof a != "function")
        throw new TypeError("getProto: not an object");
      return n(a);
    }, "getProto") : o ? /* @__PURE__ */ s(function(a) {
      return o(a);
    }, "getProto") : null;
  }
}), Qe = d({
  "node_modules/.pnpm/hasown@2.0.2/node_modules/hasown/index.js"(r, e) {
    "use strict";
    var t = Function.prototype.call, n = Object.prototype.hasOwnProperty, o = ce();
    e.exports = o.call(t, n);
  }
}), ar = d({
  "node_modules/.pnpm/get-intrinsic@1.3.0/node_modules/get-intrinsic/index.js"(r, e) {
    "use strict";
    var t, n = He(), o = Gt(), p = kt(), a = Wt(), c = qt(), i = Bt(), u = Ee(), y = Ht(), f = Vt(), h = Jt(), m = zt(), g = Yt(), N = Kt(),
    P = Xt(), x = Zt(), D = Function, R = /* @__PURE__ */ s(function(O) {
      try {
        return D('"use strict"; return (' + O + ").constructor;")();
      } catch {
      }
    }, "getEvalledConstructor"), B = _e(), gt = tr(), ye = /* @__PURE__ */ s(function() {
      throw new u();
    }, "throwTypeError"), mt = B ? function() {
      try {
        return arguments.callee, ye;
      } catch {
        try {
          return B(arguments, "callee").get;
        } catch {
          return ye;
        }
      }
    }() : ye, $ = Je()(), _ = ir(), vt = Ye(), Et = ze(), je = Ke(), H = be(), F = {}, _t = typeof Uint8Array > "u" || !_ ? t : _(Uint8Array),
    j = {
      __proto__: null,
      "%AggregateError%": typeof AggregateError > "u" ? t : AggregateError,
      "%Array%": Array,
      "%ArrayBuffer%": typeof ArrayBuffer > "u" ? t : ArrayBuffer,
      "%ArrayIteratorPrototype%": $ && _ ? _([][Symbol.iterator]()) : t,
      "%AsyncFromSyncIteratorPrototype%": t,
      "%AsyncFunction%": F,
      "%AsyncGenerator%": F,
      "%AsyncGeneratorFunction%": F,
      "%AsyncIteratorPrototype%": F,
      "%Atomics%": typeof Atomics > "u" ? t : Atomics,
      "%BigInt%": typeof BigInt > "u" ? t : BigInt,
      "%BigInt64Array%": typeof BigInt64Array > "u" ? t : BigInt64Array,
      "%BigUint64Array%": typeof BigUint64Array > "u" ? t : BigUint64Array,
      "%Boolean%": Boolean,
      "%DataView%": typeof DataView > "u" ? t : DataView,
      "%Date%": Date,
      "%decodeURI%": decodeURI,
      "%decodeURIComponent%": decodeURIComponent,
      "%encodeURI%": encodeURI,
      "%encodeURIComponent%": encodeURIComponent,
      "%Error%": o,
      "%eval%": eval,
      // eslint-disable-line no-eval
      "%EvalError%": p,
      "%Float16Array%": typeof Float16Array > "u" ? t : Float16Array,
      "%Float32Array%": typeof Float32Array > "u" ? t : Float32Array,
      "%Float64Array%": typeof Float64Array > "u" ? t : Float64Array,
      "%FinalizationRegistry%": typeof FinalizationRegistry > "u" ? t : FinalizationRegistry,
      "%Function%": D,
      "%GeneratorFunction%": F,
      "%Int8Array%": typeof Int8Array > "u" ? t : Int8Array,
      "%Int16Array%": typeof Int16Array > "u" ? t : Int16Array,
      "%Int32Array%": typeof Int32Array > "u" ? t : Int32Array,
      "%isFinite%": isFinite,
      "%isNaN%": isNaN,
      "%IteratorPrototype%": $ && _ ? _(_([][Symbol.iterator]())) : t,
      "%JSON%": typeof JSON == "object" ? JSON : t,
      "%Map%": typeof Map > "u" ? t : Map,
      "%MapIteratorPrototype%": typeof Map > "u" || !$ || !_ ? t : _((/* @__PURE__ */ new Map())[Symbol.iterator]()),
      "%Math%": Math,
      "%Number%": Number,
      "%Object%": n,
      "%Object.getOwnPropertyDescriptor%": B,
      "%parseFloat%": parseFloat,
      "%parseInt%": parseInt,
      "%Promise%": typeof Promise > "u" ? t : Promise,
      "%Proxy%": typeof Proxy > "u" ? t : Proxy,
      "%RangeError%": a,
      "%ReferenceError%": c,
      "%Reflect%": typeof Reflect > "u" ? t : Reflect,
      "%RegExp%": RegExp,
      "%Set%": typeof Set > "u" ? t : Set,
      "%SetIteratorPrototype%": typeof Set > "u" || !$ || !_ ? t : _((/* @__PURE__ */ new Set())[Symbol.iterator]()),
      "%SharedArrayBuffer%": typeof SharedArrayBuffer > "u" ? t : SharedArrayBuffer,
      "%String%": String,
      "%StringIteratorPrototype%": $ && _ ? _(""[Symbol.iterator]()) : t,
      "%Symbol%": $ ? Symbol : t,
      "%SyntaxError%": i,
      "%ThrowTypeError%": mt,
      "%TypedArray%": _t,
      "%TypeError%": u,
      "%Uint8Array%": typeof Uint8Array > "u" ? t : Uint8Array,
      "%Uint8ClampedArray%": typeof Uint8ClampedArray > "u" ? t : Uint8ClampedArray,
      "%Uint16Array%": typeof Uint16Array > "u" ? t : Uint16Array,
      "%Uint32Array%": typeof Uint32Array > "u" ? t : Uint32Array,
      "%URIError%": y,
      "%WeakMap%": typeof WeakMap > "u" ? t : WeakMap,
      "%WeakRef%": typeof WeakRef > "u" ? t : WeakRef,
      "%WeakSet%": typeof WeakSet > "u" ? t : WeakSet,
      "%Function.prototype.call%": H,
      "%Function.prototype.apply%": je,
      "%Object.defineProperty%": gt,
      "%Object.getPrototypeOf%": vt,
      "%Math.abs%": f,
      "%Math.floor%": h,
      "%Math.max%": m,
      "%Math.min%": g,
      "%Math.pow%": N,
      "%Math.round%": P,
      "%Math.sign%": x,
      "%Reflect.getPrototypeOf%": Et
    };
    if (_)
      try {
        null.error;
      } catch (O) {
        Le = _(_(O)), j["%Error.prototype%"] = Le;
      }
    var Le, bt = /* @__PURE__ */ s(function O(v) {
      var b;
      if (v === "%AsyncFunction%")
        b = R("async function () {}");
      else if (v === "%GeneratorFunction%")
        b = R("function* () {}");
      else if (v === "%AsyncGeneratorFunction%")
        b = R("async function* () {}");
      else if (v === "%AsyncGenerator%") {
        var E = O("%AsyncGeneratorFunction%");
        E && (b = E.prototype);
      } else if (v === "%AsyncIteratorPrototype%") {
        var T = O("%AsyncGenerator%");
        T && _ && (b = _(T.prototype));
      }
      return j[v] = b, b;
    }, "doEval2"), De = {
      __proto__: null,
      "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
      "%ArrayPrototype%": ["Array", "prototype"],
      "%ArrayProto_entries%": ["Array", "prototype", "entries"],
      "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
      "%ArrayProto_keys%": ["Array", "prototype", "keys"],
      "%ArrayProto_values%": ["Array", "prototype", "values"],
      "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
      "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
      "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
      "%BooleanPrototype%": ["Boolean", "prototype"],
      "%DataViewPrototype%": ["DataView", "prototype"],
      "%DatePrototype%": ["Date", "prototype"],
      "%ErrorPrototype%": ["Error", "prototype"],
      "%EvalErrorPrototype%": ["EvalError", "prototype"],
      "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
      "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
      "%FunctionPrototype%": ["Function", "prototype"],
      "%Generator%": ["GeneratorFunction", "prototype"],
      "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
      "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
      "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
      "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
      "%JSONParse%": ["JSON", "parse"],
      "%JSONStringify%": ["JSON", "stringify"],
      "%MapPrototype%": ["Map", "prototype"],
      "%NumberPrototype%": ["Number", "prototype"],
      "%ObjectPrototype%": ["Object", "prototype"],
      "%ObjProto_toString%": ["Object", "prototype", "toString"],
      "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
      "%PromisePrototype%": ["Promise", "prototype"],
      "%PromiseProto_then%": ["Promise", "prototype", "then"],
      "%Promise_all%": ["Promise", "all"],
      "%Promise_reject%": ["Promise", "reject"],
      "%Promise_resolve%": ["Promise", "resolve"],
      "%RangeErrorPrototype%": ["RangeError", "prototype"],
      "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
      "%RegExpPrototype%": ["RegExp", "prototype"],
      "%SetPrototype%": ["Set", "prototype"],
      "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
      "%StringPrototype%": ["String", "prototype"],
      "%SymbolPrototype%": ["Symbol", "prototype"],
      "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
      "%TypedArrayPrototype%": ["TypedArray", "prototype"],
      "%TypeErrorPrototype%": ["TypeError", "prototype"],
      "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
      "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
      "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
      "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
      "%URIErrorPrototype%": ["URIError", "prototype"],
      "%WeakMapPrototype%": ["WeakMap", "prototype"],
      "%WeakSetPrototype%": ["WeakSet", "prototype"]
    }, V = ce(), te = Qe(), St = V.call(H, Array.prototype.concat), Tt = V.call(je, Array.prototype.splice), $e = V.call(H, String.prototype.
    replace), re = V.call(H, String.prototype.slice), At = V.call(H, RegExp.prototype.exec), xt = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g,
    wt = /\\(\\)?/g, Pt = /* @__PURE__ */ s(function(v) {
      var b = re(v, 0, 1), E = re(v, -1);
      if (b === "%" && E !== "%")
        throw new i("invalid intrinsic syntax, expected closing `%`");
      if (E === "%" && b !== "%")
        throw new i("invalid intrinsic syntax, expected opening `%`");
      var T = [];
      return $e(v, xt, function(C, M, A, ne) {
        T[T.length] = A ? $e(ne, wt, "$1") : M || C;
      }), T;
    }, "stringToPath3"), Ot = /* @__PURE__ */ s(function(v, b) {
      var E = v, T;
      if (te(De, E) && (T = De[E], E = "%" + T[0] + "%"), te(j, E)) {
        var C = j[E];
        if (C === F && (C = bt(E)), typeof C > "u" && !b)
          throw new u("intrinsic " + v + " exists, but is not available. Please file an issue!");
        return {
          alias: T,
          name: E,
          value: C
        };
      }
      throw new i("intrinsic " + v + " does not exist!");
    }, "getBaseIntrinsic2");
    e.exports = /* @__PURE__ */ s(function(v, b) {
      if (typeof v != "string" || v.length === 0)
        throw new u("intrinsic name must be a non-empty string");
      if (arguments.length > 1 && typeof b != "boolean")
        throw new u('"allowMissing" argument must be a boolean');
      if (At(/^%?[^%]*%?$/, v) === null)
        throw new i("`%` may not be present anywhere but at the beginning and end of the intrinsic name");
      var E = Pt(v), T = E.length > 0 ? E[0] : "", C = Ot("%" + T + "%", b), M = C.name, A = C.value, ne = !1, he = C.alias;
      he && (T = he[0], Tt(E, St([0, 1], he)));
      for (var oe = 1, J = !0; oe < E.length; oe += 1) {
        var I = E[oe], se = re(I, 0, 1), ie = re(I, -1);
        if ((se === '"' || se === "'" || se === "`" || ie === '"' || ie === "'" || ie === "`") && se !== ie)
          throw new i("property names with quotes must have matching quotes");
        if ((I === "constructor" || !J) && (ne = !0), T += "." + I, M = "%" + T + "%", te(j, M))
          A = j[M];
        else if (A != null) {
          if (!(I in A)) {
            if (!b)
              throw new u("base intrinsic for " + v + " exists, but the property is not available.");
            return;
          }
          if (B && oe + 1 >= E.length) {
            var ae = B(A, I);
            J = !!ae, J && "get" in ae && !("originalValue" in ae.get) ? A = ae.get : A = A[I];
          } else
            J = te(A, I), A = A[I];
          J && !ne && (j[M] = A);
        }
      }
      return A;
    }, "GetIntrinsic");
  }
}), Se = d({
  "node_modules/.pnpm/call-bound@1.0.4/node_modules/call-bound/index.js"(r, e) {
    "use strict";
    var t = ar(), n = Xe(), o = n([t("%String.prototype.indexOf%")]);
    e.exports = /* @__PURE__ */ s(function(a, c) {
      var i = (
        /** @type {(this: unknown, ...args: unknown[]) => unknown} */
        t(a, !!c)
      );
      return typeof i == "function" && o(a, ".prototype.") > -1 ? n(
        /** @type {const} */
        [i]
      ) : i;
    }, "callBoundIntrinsic");
  }
}), pr = d({
  "node_modules/.pnpm/has-tostringtag@1.0.2/node_modules/has-tostringtag/shams.js"(r, e) {
    "use strict";
    var t = Ve();
    e.exports = /* @__PURE__ */ s(function() {
      return t() && !!Symbol.toStringTag;
    }, "hasToStringTagShams");
  }
}), Ze = d({
  "node_modules/.pnpm/is-regex@1.2.1/node_modules/is-regex/index.js"(r, e) {
    "use strict";
    var t = Se(), n = pr()(), o = Qe(), p = _e(), a;
    n ? (c = t("RegExp.prototype.exec"), i = {}, u = /* @__PURE__ */ s(function() {
      throw i;
    }, "throwRegexMarker"), y = {
      toString: u,
      valueOf: u
    }, typeof Symbol.toPrimitive == "symbol" && (y[Symbol.toPrimitive] = u), a = /* @__PURE__ */ s(function(g) {
      if (!g || typeof g != "object")
        return !1;
      var N = (
        /** @type {NonNullable<typeof gOPD>} */
        p(
          /** @type {{ lastIndex?: unknown }} */
          g,
          "lastIndex"
        )
      ), P = N && o(N, "value");
      if (!P)
        return !1;
      try {
        c(
          g,
          /** @type {string} */
          /** @type {unknown} */
          y
        );
      } catch (x) {
        return x === i;
      }
    }, "isRegex")) : (f = t("Object.prototype.toString"), h = "[object RegExp]", a = /* @__PURE__ */ s(function(g) {
      return !g || typeof g != "object" && typeof g != "function" ? !1 : f(g) === h;
    }, "isRegex"));
    var c, i, u, y, f, h;
    e.exports = a;
  }
}), cr = d({
  "node_modules/.pnpm/is-function@1.0.2/node_modules/is-function/index.js"(r, e) {
    e.exports = n;
    var t = Object.prototype.toString;
    function n(o) {
      if (!o)
        return !1;
      var p = t.call(o);
      return p === "[object Function]" || typeof o == "function" && p !== "[object RegExp]" || typeof window < "u" && // IE8 and below
      (o === window.setTimeout || o === window.alert || o === window.confirm || o === window.prompt);
    }
    s(n, "isFunction3");
  }
}), lr = d({
  "node_modules/.pnpm/safe-regex-test@1.1.0/node_modules/safe-regex-test/index.js"(r, e) {
    "use strict";
    var t = Se(), n = Ze(), o = t("RegExp.prototype.exec"), p = Ee();
    e.exports = /* @__PURE__ */ s(function(c) {
      if (!n(c))
        throw new p("`regex` must be a RegExp");
      return /* @__PURE__ */ s(function(u) {
        return o(c, u) !== null;
      }, "test");
    }, "regexTester");
  }
}), ur = d({
  "node_modules/.pnpm/is-symbol@1.1.1/node_modules/is-symbol/index.js"(r, e) {
    "use strict";
    var t = Se(), n = t("Object.prototype.toString"), o = Je()(), p = lr();
    o ? (a = t("Symbol.prototype.toString"), c = p(/^Symbol\(.*\)$/), i = /* @__PURE__ */ s(function(y) {
      return typeof y.valueOf() != "symbol" ? !1 : c(a(y));
    }, "isRealSymbolObject"), e.exports = /* @__PURE__ */ s(function(y) {
      if (typeof y == "symbol")
        return !0;
      if (!y || typeof y != "object" || n(y) !== "[object Symbol]")
        return !1;
      try {
        return i(y);
      } catch {
        return !1;
      }
    }, "isSymbol3")) : e.exports = /* @__PURE__ */ s(function(y) {
      return !1;
    }, "isSymbol3");
    var a, c, i;
  }
}), fr = pe(Ze()), dr = pe(cr()), yr = pe(ur());
function hr(r) {
  return r != null && typeof r == "object" && Array.isArray(r) === !1;
}
s(hr, "isObject");
var gr = typeof global == "object" && global && global.Object === Object && global, mr = gr, vr = typeof self == "object" && self && self.Object ===
Object && self, Er = mr || vr || Function("return this")(), Te = Er, _r = Te.Symbol, G = _r, et = Object.prototype, br = et.hasOwnProperty, Sr = et.
toString, Y = G ? G.toStringTag : void 0;
function Tr(r) {
  var e = br.call(r, Y), t = r[Y];
  try {
    r[Y] = void 0;
    var n = !0;
  } catch {
  }
  var o = Sr.call(r);
  return n && (e ? r[Y] = t : delete r[Y]), o;
}
s(Tr, "getRawTag");
var Ar = Tr, xr = Object.prototype, wr = xr.toString;
function Pr(r) {
  return wr.call(r);
}
s(Pr, "objectToString");
var Or = Pr, Cr = "[object Null]", Nr = "[object Undefined]", Ge = G ? G.toStringTag : void 0;
function Ir(r) {
  return r == null ? r === void 0 ? Nr : Cr : Ge && Ge in Object(r) ? Ar(r) : Or(r);
}
s(Ir, "baseGetTag");
var tt = Ir;
function Rr(r) {
  return r != null && typeof r == "object";
}
s(Rr, "isObjectLike");
var jr = Rr, Lr = "[object Symbol]";
function Dr(r) {
  return typeof r == "symbol" || jr(r) && tt(r) == Lr;
}
s(Dr, "isSymbol");
var Ae = Dr;
function $r(r, e) {
  for (var t = -1, n = r == null ? 0 : r.length, o = Array(n); ++t < n; )
    o[t] = e(r[t], t, r);
  return o;
}
s($r, "arrayMap");
var Fr = $r, Mr = Array.isArray, xe = Mr, Ur = 1 / 0, ke = G ? G.prototype : void 0, We = ke ? ke.toString : void 0;
function rt(r) {
  if (typeof r == "string")
    return r;
  if (xe(r))
    return Fr(r, rt) + "";
  if (Ae(r))
    return We ? We.call(r) : "";
  var e = r + "";
  return e == "0" && 1 / r == -Ur ? "-0" : e;
}
s(rt, "baseToString");
var Gr = rt;
function kr(r) {
  var e = typeof r;
  return r != null && (e == "object" || e == "function");
}
s(kr, "isObject2");
var nt = kr, Wr = "[object AsyncFunction]", qr = "[object Function]", Br = "[object GeneratorFunction]", Hr = "[object Proxy]";
function Vr(r) {
  if (!nt(r))
    return !1;
  var e = tt(r);
  return e == qr || e == Br || e == Wr || e == Hr;
}
s(Vr, "isFunction");
var Jr = Vr, zr = Te["__core-js_shared__"], ve = zr, qe = function() {
  var r = /[^.]+$/.exec(ve && ve.keys && ve.keys.IE_PROTO || "");
  return r ? "Symbol(src)_1." + r : "";
}();
function Yr(r) {
  return !!qe && qe in r;
}
s(Yr, "isMasked");
var Kr = Yr, Xr = Function.prototype, Qr = Xr.toString;
function Zr(r) {
  if (r != null) {
    try {
      return Qr.call(r);
    } catch {
    }
    try {
      return r + "";
    } catch {
    }
  }
  return "";
}
s(Zr, "toSource");
var en = Zr, tn = /[\\^$.*+?()[\]{}|]/g, rn = /^\[object .+?Constructor\]$/, nn = Function.prototype, on = Object.prototype, sn = nn.toString,
an = on.hasOwnProperty, pn = RegExp(
  "^" + sn.call(an).replace(tn, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
);
function cn(r) {
  if (!nt(r) || Kr(r))
    return !1;
  var e = Jr(r) ? pn : rn;
  return e.test(en(r));
}
s(cn, "baseIsNative");
var ln = cn;
function un(r, e) {
  return r?.[e];
}
s(un, "getValue");
var fn = un;
function dn(r, e) {
  var t = fn(r, e);
  return ln(t) ? t : void 0;
}
s(dn, "getNative");
var ot = dn;
function yn(r, e) {
  return r === e || r !== r && e !== e;
}
s(yn, "eq");
var hn = yn, gn = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, mn = /^\w*$/;
function vn(r, e) {
  if (xe(r))
    return !1;
  var t = typeof r;
  return t == "number" || t == "symbol" || t == "boolean" || r == null || Ae(r) ? !0 : mn.test(r) || !gn.test(r) || e != null && r in Object(
  e);
}
s(vn, "isKey");
var En = vn, _n = ot(Object, "create"), K = _n;
function bn() {
  this.__data__ = K ? K(null) : {}, this.size = 0;
}
s(bn, "hashClear");
var Sn = bn;
function Tn(r) {
  var e = this.has(r) && delete this.__data__[r];
  return this.size -= e ? 1 : 0, e;
}
s(Tn, "hashDelete");
var An = Tn, xn = "__lodash_hash_undefined__", wn = Object.prototype, Pn = wn.hasOwnProperty;
function On(r) {
  var e = this.__data__;
  if (K) {
    var t = e[r];
    return t === xn ? void 0 : t;
  }
  return Pn.call(e, r) ? e[r] : void 0;
}
s(On, "hashGet");
var Cn = On, Nn = Object.prototype, In = Nn.hasOwnProperty;
function Rn(r) {
  var e = this.__data__;
  return K ? e[r] !== void 0 : In.call(e, r);
}
s(Rn, "hashHas");
var jn = Rn, Ln = "__lodash_hash_undefined__";
function Dn(r, e) {
  var t = this.__data__;
  return this.size += this.has(r) ? 0 : 1, t[r] = K && e === void 0 ? Ln : e, this;
}
s(Dn, "hashSet");
var $n = Dn;
function k(r) {
  var e = -1, t = r == null ? 0 : r.length;
  for (this.clear(); ++e < t; ) {
    var n = r[e];
    this.set(n[0], n[1]);
  }
}
s(k, "Hash");
k.prototype.clear = Sn;
k.prototype.delete = An;
k.prototype.get = Cn;
k.prototype.has = jn;
k.prototype.set = $n;
var Be = k;
function Fn() {
  this.__data__ = [], this.size = 0;
}
s(Fn, "listCacheClear");
var Mn = Fn;
function Un(r, e) {
  for (var t = r.length; t--; )
    if (hn(r[t][0], e))
      return t;
  return -1;
}
s(Un, "assocIndexOf");
var le = Un, Gn = Array.prototype, kn = Gn.splice;
function Wn(r) {
  var e = this.__data__, t = le(e, r);
  if (t < 0)
    return !1;
  var n = e.length - 1;
  return t == n ? e.pop() : kn.call(e, t, 1), --this.size, !0;
}
s(Wn, "listCacheDelete");
var qn = Wn;
function Bn(r) {
  var e = this.__data__, t = le(e, r);
  return t < 0 ? void 0 : e[t][1];
}
s(Bn, "listCacheGet");
var Hn = Bn;
function Vn(r) {
  return le(this.__data__, r) > -1;
}
s(Vn, "listCacheHas");
var Jn = Vn;
function zn(r, e) {
  var t = this.__data__, n = le(t, r);
  return n < 0 ? (++this.size, t.push([r, e])) : t[n][1] = e, this;
}
s(zn, "listCacheSet");
var Yn = zn;
function W(r) {
  var e = -1, t = r == null ? 0 : r.length;
  for (this.clear(); ++e < t; ) {
    var n = r[e];
    this.set(n[0], n[1]);
  }
}
s(W, "ListCache");
W.prototype.clear = Mn;
W.prototype.delete = qn;
W.prototype.get = Hn;
W.prototype.has = Jn;
W.prototype.set = Yn;
var Kn = W, Xn = ot(Te, "Map"), Qn = Xn;
function Zn() {
  this.size = 0, this.__data__ = {
    hash: new Be(),
    map: new (Qn || Kn)(),
    string: new Be()
  };
}
s(Zn, "mapCacheClear");
var eo = Zn;
function to(r) {
  var e = typeof r;
  return e == "string" || e == "number" || e == "symbol" || e == "boolean" ? r !== "__proto__" : r === null;
}
s(to, "isKeyable");
var ro = to;
function no(r, e) {
  var t = r.__data__;
  return ro(e) ? t[typeof e == "string" ? "string" : "hash"] : t.map;
}
s(no, "getMapData");
var ue = no;
function oo(r) {
  var e = ue(this, r).delete(r);
  return this.size -= e ? 1 : 0, e;
}
s(oo, "mapCacheDelete");
var so = oo;
function io(r) {
  return ue(this, r).get(r);
}
s(io, "mapCacheGet");
var ao = io;
function po(r) {
  return ue(this, r).has(r);
}
s(po, "mapCacheHas");
var co = po;
function lo(r, e) {
  var t = ue(this, r), n = t.size;
  return t.set(r, e), this.size += t.size == n ? 0 : 1, this;
}
s(lo, "mapCacheSet");
var uo = lo;
function q(r) {
  var e = -1, t = r == null ? 0 : r.length;
  for (this.clear(); ++e < t; ) {
    var n = r[e];
    this.set(n[0], n[1]);
  }
}
s(q, "MapCache");
q.prototype.clear = eo;
q.prototype.delete = so;
q.prototype.get = ao;
q.prototype.has = co;
q.prototype.set = uo;
var st = q, fo = "Expected a function";
function we(r, e) {
  if (typeof r != "function" || e != null && typeof e != "function")
    throw new TypeError(fo);
  var t = /* @__PURE__ */ s(function() {
    var n = arguments, o = e ? e.apply(this, n) : n[0], p = t.cache;
    if (p.has(o))
      return p.get(o);
    var a = r.apply(this, n);
    return t.cache = p.set(o, a) || p, a;
  }, "memoized");
  return t.cache = new (we.Cache || st)(), t;
}
s(we, "memoize");
we.Cache = st;
var yo = we, ho = 500;
function go(r) {
  var e = yo(r, function(n) {
    return t.size === ho && t.clear(), n;
  }), t = e.cache;
  return e;
}
s(go, "memoizeCapped");
var mo = go, vo = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g, Eo = /\\(\\)?/g, _o = mo(
function(r) {
  var e = [];
  return r.charCodeAt(0) === 46 && e.push(""), r.replace(vo, function(t, n, o, p) {
    e.push(o ? p.replace(Eo, "$1") : n || t);
  }), e;
}), bo = _o;
function So(r) {
  return r == null ? "" : Gr(r);
}
s(So, "toString");
var To = So;
function Ao(r, e) {
  return xe(r) ? r : En(r, e) ? [r] : bo(To(r));
}
s(Ao, "castPath");
var xo = Ao, wo = 1 / 0;
function Po(r) {
  if (typeof r == "string" || Ae(r))
    return r;
  var e = r + "";
  return e == "0" && 1 / r == -wo ? "-0" : e;
}
s(Po, "toKey");
var Oo = Po;
function Co(r, e) {
  e = xo(e, r);
  for (var t = 0, n = e.length; r != null && t < n; )
    r = r[Oo(e[t++])];
  return t && t == n ? r : void 0;
}
s(Co, "baseGet");
var No = Co;
function Io(r, e, t) {
  var n = r == null ? void 0 : No(r, e);
  return n === void 0 ? t : n;
}
s(Io, "get");
var Ro = Io, Pe = hr, jo = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, X = /* @__PURE__ */ s((r) => r.match(/^[\[\{\"\}].*[\]\}\"]$/),
"isJSON");
function it(r) {
  if (!Pe(r))
    return r;
  let e = r, t = !1;
  return typeof Event < "u" && r instanceof Event && (e = Ue(e), t = !0), e = Object.keys(e).reduce((n, o) => {
    try {
      e[o] && e[o].toJSON, n[o] = e[o];
    } catch {
      t = !0;
    }
    return n;
  }, {}), t ? e : r;
}
s(it, "convertUnconventionalData");
var Lo = /* @__PURE__ */ s(function(e) {
  let t, n, o, p;
  return /* @__PURE__ */ s(function(c, i) {
    try {
      if (c === "")
        return p = [], t = /* @__PURE__ */ new Map([[i, "[]"]]), n = /* @__PURE__ */ new Map(), o = [], i;
      let u = n.get(this) || this;
      for (; o.length && u !== o[0]; )
        o.shift(), p.pop();
      if (typeof i == "boolean")
        return i;
      if (i === void 0)
        return e.allowUndefined ? "_undefined_" : void 0;
      if (i === null)
        return null;
      if (typeof i == "number")
        return i === Number.NEGATIVE_INFINITY ? "_-Infinity_" : i === Number.POSITIVE_INFINITY ? "_Infinity_" : Number.isNaN(i) ? "_NaN_" : i;
      if (typeof i == "bigint")
        return `_bigint_${i.toString()}`;
      if (typeof i == "string")
        return jo.test(i) ? e.allowDate ? `_date_${i}` : void 0 : i;
      if ((0, fr.default)(i))
        return e.allowRegExp ? `_regexp_${i.flags}|${i.source}` : void 0;
      if ((0, dr.default)(i))
        return;
      if ((0, yr.default)(i)) {
        if (!e.allowSymbol)
          return;
        let f = Symbol.keyFor(i);
        return f !== void 0 ? `_gsymbol_${f}` : `_symbol_${i.toString().slice(7, -1)}`;
      }
      if (o.length >= e.maxDepth)
        return Array.isArray(i) ? `[Array(${i.length})]` : "[Object]";
      if (i === this)
        return `_duplicate_${JSON.stringify(p)}`;
      if (i instanceof Error && e.allowError)
        return {
          __isConvertedError__: !0,
          errorProperties: {
            // @ts-expect-error cause is not defined in the current tsconfig target(es2020)
            ...i.cause ? { cause: i.cause } : {},
            ...i,
            name: i.name,
            message: i.message,
            stack: i.stack,
            "_constructor-name_": i.constructor.name
          }
        };
      if (i?.constructor?.name && i.constructor.name !== "Object" && !Array.isArray(i)) {
        let f = t.get(i);
        if (!f) {
          let h = {
            __isClassInstance__: !0,
            __className__: i.constructor.name,
            ...Object.getOwnPropertyNames(i).reduce(
              (m, g) => {
                try {
                  m[g] = i[g];
                } catch {
                }
                return m;
              },
              {}
            )
          };
          return p.push(c), o.unshift(h), t.set(i, JSON.stringify(p)), i !== h && n.set(i, h), h;
        }
        return `_duplicate_${f}`;
      }
      let y = t.get(i);
      if (!y) {
        let f = Array.isArray(i) ? i : it(i);
        return p.push(c), o.unshift(f), t.set(i, JSON.stringify(p)), i !== f && n.set(i, f), f;
      }
      return `_duplicate_${y}`;
    } catch {
      return;
    }
  }, "replace");
}, "replacer2"), Do = /* @__PURE__ */ s(function(e) {
  let t = [], n;
  return /* @__PURE__ */ s(function(p, a) {
    if (p === "" && (n = a, t.forEach(({ target: c, container: i, replacement: u }) => {
      let y = X(u) ? JSON.parse(u) : u.split(".");
      y.length === 0 ? i[c] = n : i[c] = Ro(n, y);
    })), p === "_constructor-name_")
      return a;
    if (Pe(a) && a.__isConvertedError__) {
      let { message: c, ...i } = a.errorProperties, u = new Error(c);
      return Object.assign(u, i), u;
    }
    if (typeof a == "string" && a.startsWith("_regexp_") && e.allowRegExp) {
      let [, c, i] = a.match(/_regexp_([^|]*)\|(.*)/) || [];
      return new RegExp(i, c);
    }
    return typeof a == "string" && a.startsWith("_date_") && e.allowDate ? new Date(a.replace("_date_", "")) : typeof a == "string" && a.startsWith(
    "_duplicate_") ? (t.push({ target: p, container: this, replacement: a.replace(/^_duplicate_/, "") }), null) : typeof a == "string" && a.
    startsWith("_symbol_") && e.allowSymbol ? Symbol(a.replace("_symbol_", "")) : typeof a == "string" && a.startsWith("_gsymbol_") && e.allowSymbol ?
    Symbol.for(a.replace("_gsymbol_", "")) : typeof a == "string" && a === "_-Infinity_" ? Number.NEGATIVE_INFINITY : typeof a == "string" &&
    a === "_Infinity_" ? Number.POSITIVE_INFINITY : typeof a == "string" && a === "_NaN_" ? Number.NaN : typeof a == "string" && a.startsWith(
    "_bigint_") && typeof BigInt == "function" ? BigInt(a.replace("_bigint_", "")) : a;
  }, "revive");
}, "reviver2"), at = {
  maxDepth: 10,
  space: void 0,
  allowRegExp: !0,
  allowDate: !0,
  allowError: !0,
  allowUndefined: !0,
  allowSymbol: !0
}, fe = /* @__PURE__ */ s((r, e = {}) => {
  let t = { ...at, ...e };
  return JSON.stringify(it(r), Lo(t), e.space);
}, "stringify"), $o = /* @__PURE__ */ s(() => {
  let r = /* @__PURE__ */ new Map();
  return /* @__PURE__ */ s(function e(t) {
    Pe(t) && Object.entries(t).forEach(([n, o]) => {
      o === "_undefined_" ? t[n] = void 0 : r.get(o) || (r.set(o, !0), e(o));
    }), Array.isArray(t) && t.forEach((n, o) => {
      n === "_undefined_" ? (r.set(n, !0), t[o] = void 0) : r.get(n) || (r.set(n, !0), e(n));
    });
  }, "mutateUndefined");
}, "mutator"), de = /* @__PURE__ */ s((r, e = {}) => {
  let t = { ...at, ...e }, n = JSON.parse(r, Do(t));
  return $o()(n), n;
}, "parse");

// ../node_modules/tiny-invariant/dist/esm/tiny-invariant.js
var Fo = !1, Oe = "Invariant failed";
function Q(r, e) {
  if (!r) {
    if (Fo)
      throw new Error(Oe);
    var t = typeof e == "function" ? e() : e, n = t ? "".concat(Oe, ": ").concat(t) : Oe;
    throw new Error(n);
  }
}
s(Q, "invariant");

// src/channels/postmessage/getEventSourceUrl.ts
import { logger as Mo } from "storybook/internal/client-logger";
var pt = /* @__PURE__ */ s((r) => {
  let e = Array.from(
    document.querySelectorAll("iframe[data-is-storybook]")
  ), [t, ...n] = e.filter((p) => {
    try {
      return p.contentWindow?.location.origin === r.source.location.origin && p.contentWindow?.location.pathname === r.source.location.pathname;
    } catch {
    }
    try {
      return p.contentWindow === r.source;
    } catch {
    }
    let a = p.getAttribute("src"), c;
    try {
      if (!a)
        return !1;
      ({ origin: c } = new URL(a, document.location.toString()));
    } catch {
      return !1;
    }
    return c === r.origin;
  }), o = t?.getAttribute("src");
  if (o && n.length === 0) {
    let { protocol: p, host: a, pathname: c } = new URL(o, document.location.toString());
    return `${p}//${a}${c}`;
  }
  return n.length > 0 && Mo.error("found multiple candidates for event source"), null;
}, "getEventSourceUrl");

// src/channels/postmessage/index.ts
var { document: Ce, location: Ne } = S, ut = "storybook-channel", Go = { maxDepth: 25 }, Ie = class Ie {
  constructor(e) {
    this.config = e;
    this.connected = !1;
    if (this.buffer = [], typeof S?.addEventListener == "function" && S.addEventListener("message", this.handleEvent.bind(this), !1), e.page !==
    "manager" && e.page !== "preview")
      throw new Error(`postmsg-channel: "config.page" cannot be "${e.page}"`);
  }
  setHandler(e) {
    this.handler = (...t) => {
      e.apply(this, t), !this.connected && this.getLocalFrame().length && (this.flush(), this.connected = !0);
    };
  }
  /**
   * Sends `event` to the associated window. If the window does not yet exist the event will be
   * stored in a buffer and sent when the window exists.
   *
   * @param event
   */
  send(e, t) {
    let {
      target: n,
      // telejson options
      allowRegExp: o,
      allowSymbol: p,
      allowDate: a,
      allowError: c,
      allowUndefined: i,
      maxDepth: u,
      space: y
    } = t || {}, f = Object.fromEntries(
      Object.entries({
        allowRegExp: o,
        allowSymbol: p,
        allowDate: a,
        allowError: c,
        allowUndefined: i,
        maxDepth: u,
        space: y
      }).filter(([P, x]) => typeof x < "u")
    ), h = {
      ...Go,
      ...S.CHANNEL_OPTIONS || {},
      ...f
    }, m = this.getFrames(n), g = new URLSearchParams(Ne?.search || ""), N = fe(
      {
        key: ut,
        event: e,
        refId: g.get("refId")
      },
      h
    );
    return m.length ? (this.buffer.length && this.flush(), m.forEach((P) => {
      try {
        P.postMessage(N, "*");
      } catch {
        ct.error("sending over postmessage fail");
      }
    }), Promise.resolve(null)) : new Promise((P, x) => {
      this.buffer.push({ event: e, resolve: P, reject: x });
    });
  }
  flush() {
    let { buffer: e } = this;
    this.buffer = [], e.forEach((t) => {
      this.send(t.event).then(t.resolve).catch(t.reject);
    });
  }
  getFrames(e) {
    if (this.config.page === "manager") {
      let n = Array.from(
        Ce.querySelectorAll("iframe[data-is-storybook][data-is-loaded]")
      ).flatMap((o) => {
        try {
          return o.contentWindow && o.dataset.isStorybook !== void 0 && o.id === e ? [o.contentWindow] : [];
        } catch {
          return [];
        }
      });
      return n?.length ? n : this.getCurrentFrames();
    }
    return S && S.parent && S.parent !== S.self ? [S.parent] : [];
  }
  getCurrentFrames() {
    return this.config.page === "manager" ? Array.from(
      Ce.querySelectorAll('[data-is-storybook="true"]')
    ).flatMap((t) => t.contentWindow ? [t.contentWindow] : []) : S && S.parent ? [S.parent] : [];
  }
  getLocalFrame() {
    return this.config.page === "manager" ? Array.from(
      Ce.querySelectorAll("#storybook-preview-iframe")
    ).flatMap((t) => t.contentWindow ? [t.contentWindow] : []) : S && S.parent ? [S.parent] : [];
  }
  handleEvent(e) {
    try {
      let { data: t } = e, { key: n, event: o, refId: p } = typeof t == "string" && X(t) ? de(t, S.CHANNEL_OPTIONS || {}) : t;
      if (n === ut) {
        let a = this.config.page === "manager" ? '<span style="color: #37D5D3; background: black"> manager </span>' : '<span style="color: #\
1EA7FD; background: black"> preview </span>', c = Object.values(Uo).includes(o.type) ? `<span style="color: #FF4785">${o.type}</span>` : `<s\
pan style="color: #FFAE00">${o.type}</span>`;
        if (p && (o.refId = p), o.source = this.config.page === "preview" ? e.origin : pt(e), !o.source) {
          lt.error(
            `${a} received ${c} but was unable to determine the source of the event`
          );
          return;
        }
        let i = `${a} received ${c} (${t.length})`;
        lt.debug(
          Ne.origin !== o.source ? i : `${i} <span style="color: gray">(on ${Ne.origin} from ${o.source})</span>`,
          ...o.args
        ), Q(this.handler, "ChannelHandler should be set"), this.handler(o);
      }
    } catch (t) {
      ct.error(t);
    }
  }
};
s(Ie, "PostMessageTransport");
var Z = Ie;

// src/channels/websocket/index.ts
import * as ft from "storybook/internal/core-events";
import { global as dt } from "@storybook/global";
var { WebSocket: ko } = dt, yt = 15e3, ht = 5e3, Re = class Re {
  constructor({ url: e, onError: t, page: n }) {
    this.buffer = [];
    this.isReady = !1;
    this.isClosed = !1;
    this.pingTimeout = 0;
    this.socket = new ko(e), this.socket.onopen = () => {
      this.isReady = !0, this.heartbeat(), this.flush();
    }, this.socket.onmessage = ({ data: o }) => {
      let p = typeof o == "string" && X(o) ? de(o) : o;
      Q(this.handler, "WebsocketTransport handler should be set"), this.handler(p), p.type === "ping" && (this.heartbeat(), this.send({ type: "\
pong" }));
    }, this.socket.onerror = (o) => {
      t && t(o);
    }, this.socket.onclose = (o) => {
      Q(this.handler, "WebsocketTransport handler should be set"), this.handler({
        type: ft.CHANNEL_WS_DISCONNECT,
        args: [{ reason: o.reason, code: o.code }],
        from: n || "preview"
      }), this.isClosed = !0, clearTimeout(this.pingTimeout);
    };
  }
  heartbeat() {
    clearTimeout(this.pingTimeout), this.pingTimeout = setTimeout(() => {
      this.socket.close(3008, "timeout");
    }, yt + ht);
  }
  setHandler(e) {
    this.handler = e;
  }
  send(e) {
    this.isClosed || (this.isReady ? this.sendNow(e) : this.sendLater(e));
  }
  sendLater(e) {
    this.buffer.push(e);
  }
  sendNow(e) {
    let t = fe(e, {
      maxDepth: 15,
      ...dt.CHANNEL_OPTIONS
    });
    this.socket.send(t);
  }
  flush() {
    let { buffer: e } = this;
    this.buffer = [], e.forEach((t) => this.send(t));
  }
};
s(Re, "WebsocketTransport");
var ee = Re;

// src/channels/index.ts
var { CONFIG_TYPE: qo } = Wo, Ps = z;
function Os({ page: r, extraTransports: e = [] }) {
  let t = [new Z({ page: r }), ...e];
  if (qo === "DEVELOPMENT") {
    let o = window.location.protocol === "http:" ? "ws" : "wss", { hostname: p, port: a } = window.location, c = `${o}://${p}:${a}/storybook\
-server-channel`;
    t.push(new ee({ url: c, onError: /* @__PURE__ */ s(() => {
    }, "onError"), page: r }));
  }
  let n = new z({ transports: t });
  return U.__prepare(
    n,
    r === "manager" ? U.Environment.MANAGER : U.Environment.PREVIEW
  ), n;
}
s(Os, "createBrowserChannel");
export {
  z as Channel,
  yt as HEARTBEAT_INTERVAL,
  ht as HEARTBEAT_MAX_LATENCY,
  Z as PostMessageTransport,
  ee as WebsocketTransport,
  Os as createBrowserChannel,
  Ps as default
};
