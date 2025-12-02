// ../../node_modules/.pnpm/capnweb@0.1.0/node_modules/capnweb/dist/index.js
Symbol.dispose || (Symbol.dispose = Symbol.for("dispose"));
Symbol.asyncDispose || (Symbol.asyncDispose = Symbol.for("asyncDispose"));
var workersModuleName = navigator.userAgent === "Cloudflare-Workers" ? "cloudflare:workers" : null, workersModule;
workersModuleName && (workersModule = await import(
  /* @vite-ignore */
  workersModuleName
));
var RpcTarget = workersModule ? workersModule.RpcTarget : class {
};
function typeForRpc(value) {
  switch (typeof value) {
    case "boolean":
    case "number":
    case "string":
      return "primitive";
    case "undefined":
      return "undefined";
    case "object":
    case "function":
      break;
    case "bigint":
      return "bigint";
    default:
      return "unsupported";
  }
  if (value === null)
    return "primitive";
  let prototype = Object.getPrototypeOf(value);
  switch (prototype) {
    case Object.prototype:
      return "object";
    case Function.prototype:
      return "function";
    case Array.prototype:
      return "array";
    case Date.prototype:
      return "date";
    case Uint8Array.prototype:
      return "bytes";
    // TODO: All other structured clone types.
    case RpcStub.prototype:
      return "stub";
    case RpcPromise.prototype:
      return "rpc-promise";
    // TODO: Promise<T> or thenable
    default:
      if (workersModule) {
        if (prototype == workersModule.RpcStub.prototype || value instanceof workersModule.ServiceStub)
          return "rpc-target";
        if (prototype == workersModule.RpcPromise.prototype || prototype == workersModule.RpcProperty.prototype)
          return "rpc-thenable";
      }
      return value instanceof RpcTarget ? "rpc-target" : value instanceof Error ? "error" : "unsupported";
  }
}
function mapNotLoaded() {
  throw new Error("RPC map() implementation was not loaded.");
}
var mapImpl = { applyMap: mapNotLoaded, sendMap: mapNotLoaded }, StubHook = class {
}, ErrorStubHook = class extends StubHook {
  constructor(error) {
    super(), this.error = error;
  }
  call(path, args) {
    return this;
  }
  map(path, captures, instructions) {
    return this;
  }
  get(path) {
    return this;
  }
  dup() {
    return this;
  }
  pull() {
    return Promise.reject(this.error);
  }
  ignoreUnhandledRejections() {
  }
  dispose() {
  }
  onBroken(callback) {
    try {
      callback(this.error);
    } catch (err) {
      Promise.resolve(err);
    }
  }
}, DISPOSED_HOOK = new ErrorStubHook(
  new Error("Attempted to use RPC stub after it has been disposed.")
), doCall = (hook, path, params) => hook.call(path, params);
function withCallInterceptor(interceptor, callback) {
  let oldValue = doCall;
  doCall = interceptor;
  try {
    return callback();
  } finally {
    doCall = oldValue;
  }
}
var RAW_STUB = Symbol("realStub"), PROXY_HANDLERS = {
  apply(target, thisArg, argumentsList) {
    let stub = target.raw;
    return new RpcPromise(doCall(
      stub.hook,
      stub.pathIfPromise || [],
      RpcPayload.fromAppParams(argumentsList)
    ), []);
  },
  get(target, prop, receiver) {
    let stub = target.raw;
    return prop === RAW_STUB ? stub : prop in RpcPromise.prototype ? stub[prop] : typeof prop == "string" ? new RpcPromise(
      stub.hook,
      stub.pathIfPromise ? [...stub.pathIfPromise, prop] : [prop]
    ) : prop === Symbol.dispose && (!stub.pathIfPromise || stub.pathIfPromise.length == 0) ? () => {
      stub.hook.dispose(), stub.hook = DISPOSED_HOOK;
    } : void 0;
  },
  has(target, prop) {
    let stub = target.raw;
    return prop === RAW_STUB ? !0 : prop in RpcPromise.prototype ? prop in stub : typeof prop == "string" ? !0 : prop === Symbol.dispose && (!stub.pathIfPromise || stub.pathIfPromise.length == 0);
  },
  construct(target, args) {
    throw new Error("An RPC stub cannot be used as a constructor.");
  },
  defineProperty(target, property, attributes) {
    throw new Error("Can't define properties on RPC stubs.");
  },
  deleteProperty(target, p) {
    throw new Error("Can't delete properties on RPC stubs.");
  },
  getOwnPropertyDescriptor(target, p) {
  },
  getPrototypeOf(target) {
    return Object.getPrototypeOf(target.raw);
  },
  isExtensible(target) {
    return !1;
  },
  ownKeys(target) {
    return [];
  },
  preventExtensions(target) {
    return !0;
  },
  set(target, p, newValue, receiver) {
    throw new Error("Can't assign properties on RPC stubs.");
  },
  setPrototypeOf(target, v) {
    throw new Error("Can't override prototype of RPC stubs.");
  }
}, RpcStub = class _RpcStub extends RpcTarget {
  // Although `hook` and `path` are declared `public` here, they are effectively hidden by the
  // proxy.
  constructor(hook, pathIfPromise) {
    if (super(), !(hook instanceof StubHook)) {
      let value = hook;
      if (value instanceof RpcTarget || value instanceof Function ? hook = TargetStubHook.create(value, void 0) : hook = new PayloadStubHook(RpcPayload.fromAppReturn(value)), pathIfPromise)
        throw new TypeError("RpcStub constructor expected one argument, received two.");
    }
    this.hook = hook, this.pathIfPromise = pathIfPromise;
    let func = () => {
    };
    return func.raw = this, new Proxy(func, PROXY_HANDLERS);
  }
  hook;
  pathIfPromise;
  dup() {
    let target = this[RAW_STUB];
    return target.pathIfPromise ? new _RpcStub(target.hook.get(target.pathIfPromise)) : new _RpcStub(target.hook.dup());
  }
  onRpcBroken(callback) {
    this[RAW_STUB].hook.onBroken(callback);
  }
  map(func) {
    let { hook, pathIfPromise } = this[RAW_STUB];
    return mapImpl.sendMap(hook, pathIfPromise || [], func);
  }
}, RpcPromise = class extends RpcStub {
  // TODO: Support passing target value or promise to constructor.
  constructor(hook, pathIfPromise) {
    super(hook, pathIfPromise);
  }
  then(onfulfilled, onrejected) {
    return pullPromise(this).then(...arguments);
  }
  catch(onrejected) {
    return pullPromise(this).catch(...arguments);
  }
  finally(onfinally) {
    return pullPromise(this).finally(...arguments);
  }
};
function unwrapStubTakingOwnership(stub) {
  let { hook, pathIfPromise } = stub[RAW_STUB];
  return pathIfPromise && pathIfPromise.length > 0 ? hook.get(pathIfPromise) : hook;
}
function unwrapStubAndDup(stub) {
  let { hook, pathIfPromise } = stub[RAW_STUB];
  return pathIfPromise ? hook.get(pathIfPromise) : hook.dup();
}
function unwrapStubNoProperties(stub) {
  let { hook, pathIfPromise } = stub[RAW_STUB];
  if (!(pathIfPromise && pathIfPromise.length > 0))
    return hook;
}
function unwrapStubOrParent(stub) {
  return stub[RAW_STUB].hook;
}
function unwrapStubAndPath(stub) {
  return stub[RAW_STUB];
}
async function pullPromise(promise) {
  let { hook, pathIfPromise } = promise[RAW_STUB];
  return pathIfPromise.length > 0 && (hook = hook.get(pathIfPromise)), (await hook.pull()).deliverResolve();
}
var RpcPayload = class _RpcPayload {
  // Private constructor; use factory functions above to construct.
  constructor(value, source, stubs, promises) {
    this.value = value, this.source = source, this.stubs = stubs, this.promises = promises;
  }
  // Create a payload from a value passed as params to an RPC from the app.
  //
  // The payload does NOT take ownership of any stubs in `value`, and but promises not to modify
  // `value`. If the payload is delivered locally, `value` will be deep-copied first, so as not
  // to have the sender and recipient end up sharing the same mutable object. `value` will not be
  // touched again after the call returns synchronously (returns a promise) -- by that point,
  // the value has either been copied or serialized to the wire.
  static fromAppParams(value) {
    return new _RpcPayload(value, "params");
  }
  // Create a payload from a value return from an RPC implementation by the app.
  //
  // Unlike fromAppParams(), in this case the payload takes ownership of all stubs in `value`, and
  // may hold onto `value` for an arbitarily long time (e.g. to serve pipelined requests). It
  // will still avoid modifying `value` and will make a deep copy if it is delivered locally.
  static fromAppReturn(value) {
    return new _RpcPayload(value, "return");
  }
  // Combine an array of payloads into a single payload whose value is an array. Ownership of all
  // stubs is transferred from the inputs to the outputs, hence if the output is disposed, the
  // inputs should not be. (In case of exception, nothing is disposed, though.)
  static fromArray(array) {
    let stubs = [], promises = [], resultArray = [];
    for (let payload of array) {
      payload.ensureDeepCopied();
      for (let stub of payload.stubs)
        stubs.push(stub);
      for (let promise of payload.promises)
        promise.parent === payload && (promise = {
          parent: resultArray,
          property: resultArray.length,
          promise: promise.promise
        }), promises.push(promise);
      resultArray.push(payload.value);
    }
    return new _RpcPayload(resultArray, "owned", stubs, promises);
  }
  // Create a payload from a value parsed off the wire using Evaluator.evaluate().
  //
  // A payload is constructed with a null value and the given stubs and promises arrays. The value
  // is expected to be filled in by the evaluator, and the stubs and promises arrays are expected
  // to be extended with stubs found during parsing. (This weird usage model is necessary so that
  // if the root value turns out to be a promise, its `parent` in `promises` can be the payload
  // object itself.)
  //
  // When done, the payload takes ownership of the final value and all the stubs within. It may
  // modify the value in preparation for delivery, and may deliver the value directly to the app
  // without copying.
  static forEvaluate(stubs, promises) {
    return new _RpcPayload(null, "owned", stubs, promises);
  }
  // Deep-copy the given value, including dup()ing all stubs.
  //
  // If `value` is a function, it should be bound to `oldParent` as its `this`.
  //
  // If deep-copying from a branch of some other RpcPayload, it must be provided, to make sure
  // RpcTargets found within don't get duplicate stubs.
  static deepCopyFrom(value, oldParent, owner) {
    let result = new _RpcPayload(null, "owned", [], []);
    return result.value = result.deepCopy(
      value,
      oldParent,
      "value",
      result,
      /*dupStubs=*/
      !0,
      owner
    ), result;
  }
  // For `soruce === "return"` payloads only, this tracks any StubHooks created around RpcTargets
  // found in the payload at the time that it is serialized (or deep-copied) for return, so that we
  // can make sure they are not disposed before the pipeline ends.
  //
  // This is initialized on first use.
  rpcTargets;
  // Get the StubHook representing the given RpcTarget found inside this payload.
  getHookForRpcTarget(target, parent, dupStubs = !0) {
    if (this.source === "params")
      return TargetStubHook.create(target, parent);
    if (this.source === "return") {
      let hook = this.rpcTargets?.get(target);
      return hook ? dupStubs ? hook.dup() : (this.rpcTargets?.delete(target), hook) : (hook = TargetStubHook.create(target, parent), dupStubs ? (this.rpcTargets || (this.rpcTargets = /* @__PURE__ */ new Map()), this.rpcTargets.set(target, hook), hook.dup()) : hook);
    } else
      throw new Error("owned payload shouldn't contain raw RpcTargets");
  }
  deepCopy(value, oldParent, property, parent, dupStubs, owner) {
    switch (typeForRpc(value)) {
      case "unsupported":
        return value;
      case "primitive":
      case "bigint":
      case "date":
      case "bytes":
      case "error":
      case "undefined":
        return value;
      case "array": {
        let array = value, len = array.length, result = new Array(len);
        for (let i = 0; i < len; i++)
          result[i] = this.deepCopy(array[i], array, i, result, dupStubs, owner);
        return result;
      }
      case "object": {
        let result = {}, object = value;
        for (let i in object)
          result[i] = this.deepCopy(object[i], object, i, result, dupStubs, owner);
        return result;
      }
      case "stub":
      case "rpc-promise": {
        let stub = value, hook;
        if (dupStubs ? hook = unwrapStubAndDup(stub) : hook = unwrapStubTakingOwnership(stub), stub instanceof RpcPromise) {
          let promise = new RpcPromise(hook, []);
          return this.promises.push({ parent, property, promise }), promise;
        } else {
          let newStub = new RpcStub(hook);
          return this.stubs.push(newStub), newStub;
        }
      }
      case "function":
      case "rpc-target": {
        let target = value, stub;
        return owner ? stub = new RpcStub(owner.getHookForRpcTarget(target, oldParent, dupStubs)) : stub = new RpcStub(TargetStubHook.create(target, oldParent)), this.stubs.push(stub), stub;
      }
      case "rpc-thenable": {
        let target = value, promise;
        return owner ? promise = new RpcPromise(owner.getHookForRpcTarget(target, oldParent, dupStubs), []) : promise = new RpcPromise(TargetStubHook.create(target, oldParent), []), this.promises.push({ parent, property, promise }), promise;
      }
      default:
        throw new Error("unreachable");
    }
  }
  // Ensures that if the value originally came from an unowned source, we have replaced it with a
  // deep copy.
  ensureDeepCopied() {
    if (this.source !== "owned") {
      let dupStubs = this.source === "params";
      this.stubs = [], this.promises = [];
      try {
        this.value = this.deepCopy(this.value, void 0, "value", this, dupStubs, this);
      } catch (err) {
        throw this.stubs = void 0, this.promises = void 0, err;
      }
      if (this.source = "owned", this.rpcTargets && this.rpcTargets.size > 0)
        throw new Error("Not all rpcTargets were accounted for in deep-copy?");
      this.rpcTargets = void 0;
    }
  }
  // Resolve all promises in this payload and then assign the final value into `parent[property]`.
  deliverTo(parent, property, promises) {
    if (this.ensureDeepCopied(), this.value instanceof RpcPromise)
      _RpcPayload.deliverRpcPromiseTo(this.value, parent, property, promises);
    else {
      parent[property] = this.value;
      for (let record of this.promises)
        _RpcPayload.deliverRpcPromiseTo(record.promise, record.parent, record.property, promises);
    }
  }
  static deliverRpcPromiseTo(promise, parent, property, promises) {
    let hook = unwrapStubNoProperties(promise);
    if (!hook)
      throw new Error("property promises should have been resolved earlier");
    let inner = hook.pull();
    inner instanceof _RpcPayload ? inner.deliverTo(parent, property, promises) : promises.push(inner.then((payload) => {
      let subPromises = [];
      if (payload.deliverTo(parent, property, subPromises), subPromises.length > 0)
        return Promise.all(subPromises);
    }));
  }
  // Call the given function with the payload as an argument. The call is made synchronously if
  // possible, in order to maintain e-order. However, if any RpcPromises exist in the payload,
  // they are awaited and substituted before calling the function. The result of the call is
  // wrapped into another payload.
  //
  // The payload is automatically disposed after the call completes. The caller should not call
  // dispose().
  async deliverCall(func, thisArg) {
    try {
      let promises = [];
      this.deliverTo(this, "value", promises), promises.length > 0 && await Promise.all(promises);
      let result = Function.prototype.apply.call(func, thisArg, this.value);
      return result instanceof RpcPromise ? _RpcPayload.fromAppReturn(result) : _RpcPayload.fromAppReturn(await result);
    } finally {
      this.dispose();
    }
  }
  // Produce a promise for this payload for return to the application. Any RpcPromises in the
  // payload are awaited and substituted with their results first.
  //
  // The returned object will have a disposer which disposes the payload. The caller should not
  // separately dispose it.
  async deliverResolve() {
    try {
      let promises = [];
      this.deliverTo(this, "value", promises), promises.length > 0 && await Promise.all(promises);
      let result = this.value;
      return result instanceof Object && (Symbol.dispose in result || Object.defineProperty(result, Symbol.dispose, {
        // NOTE: Using `this.dispose.bind(this)` here causes Playwright's build of
        //   Chromium 140.0.7339.16 to fail when the object is assigned to a `using` variable,
        //   with the error:
        //       TypeError: Symbol(Symbol.dispose) is not a function
        //   I cannot reproduce this problem in Chrome 140.0.7339.127 nor in Node or workerd,
        //   so maybe it was a short-lived V8 bug or something. To be safe, though, we use
        //   `() => this.dispose()`, which seems to always work.
        value: () => this.dispose(),
        writable: !0,
        enumerable: !1,
        configurable: !0
      })), result;
    } catch (err) {
      throw this.dispose(), err;
    }
  }
  dispose() {
    if (this.source === "owned")
      this.stubs.forEach((stub) => stub[Symbol.dispose]()), this.promises.forEach((promise) => promise.promise[Symbol.dispose]());
    else if (this.source === "return" && (this.disposeImpl(this.value, void 0), this.rpcTargets && this.rpcTargets.size > 0))
      throw new Error("Not all rpcTargets were accounted for in disposeImpl()?");
    this.source = "owned", this.stubs = [], this.promises = [];
  }
  // Recursive dispose, called only when `source` is "return".
  disposeImpl(value, parent) {
    switch (typeForRpc(value)) {
      case "unsupported":
      case "primitive":
      case "bigint":
      case "bytes":
      case "date":
      case "error":
      case "undefined":
        return;
      case "array": {
        let array = value, len = array.length;
        for (let i = 0; i < len; i++)
          this.disposeImpl(array[i], array);
        return;
      }
      case "object": {
        let object = value;
        for (let i in object)
          this.disposeImpl(object[i], object);
        return;
      }
      case "stub":
      case "rpc-promise": {
        let hook = unwrapStubNoProperties(value);
        hook && hook.dispose();
        return;
      }
      case "function":
      case "rpc-target": {
        let target = value, hook = this.rpcTargets?.get(target);
        hook ? (hook.dispose(), this.rpcTargets.delete(target)) : disposeRpcTarget(target);
        return;
      }
      case "rpc-thenable":
        return;
      default:
        return;
    }
  }
  // Ignore unhandled rejections in all promises in this payload -- that is, all promises that
  // *would* be awaited if this payload were to be delivered. See the similarly-named method of
  // StubHook for explanation.
  ignoreUnhandledRejections() {
    this.stubs ? (this.stubs.forEach((stub) => {
      unwrapStubOrParent(stub).ignoreUnhandledRejections();
    }), this.promises.forEach(
      (promise) => unwrapStubOrParent(promise.promise).ignoreUnhandledRejections()
    )) : this.ignoreUnhandledRejectionsImpl(this.value);
  }
  ignoreUnhandledRejectionsImpl(value) {
    switch (typeForRpc(value)) {
      case "unsupported":
      case "primitive":
      case "bigint":
      case "bytes":
      case "date":
      case "error":
      case "undefined":
      case "function":
      case "rpc-target":
        return;
      case "array": {
        let array = value, len = array.length;
        for (let i = 0; i < len; i++)
          this.ignoreUnhandledRejectionsImpl(array[i]);
        return;
      }
      case "object": {
        let object = value;
        for (let i in object)
          this.ignoreUnhandledRejectionsImpl(object[i]);
        return;
      }
      case "stub":
      case "rpc-promise":
        unwrapStubOrParent(value).ignoreUnhandledRejections();
        return;
      case "rpc-thenable":
        value.then((_) => {
        }, (_) => {
        });
        return;
      default:
        return;
    }
  }
};
function followPath(value, parent, path, owner) {
  for (let i = 0; i < path.length; i++) {
    parent = value;
    let part = path[i];
    if (part in Object.prototype) {
      value = void 0;
      continue;
    }
    switch (typeForRpc(value)) {
      case "object":
      case "function":
        Object.hasOwn(value, part) ? value = value[part] : value = void 0;
        break;
      case "array":
        Number.isInteger(part) && part >= 0 ? value = value[part] : value = void 0;
        break;
      case "rpc-target":
      case "rpc-thenable": {
        Object.hasOwn(value, part) ? value = void 0 : value = value[part], owner = null;
        break;
      }
      case "stub":
      case "rpc-promise": {
        let { hook, pathIfPromise } = unwrapStubAndPath(value);
        return { hook, remainingPath: pathIfPromise ? pathIfPromise.concat(path.slice(i)) : path.slice(i) };
      }
      case "primitive":
      case "bigint":
      case "bytes":
      case "date":
      case "error":
        value = void 0;
        break;
      case "undefined":
        value = value[part];
        break;
      case "unsupported": {
        if (i === 0)
          throw new TypeError("RPC stub points at a non-serializable type.");
        {
          let prefix = path.slice(0, i).join("."), remainder = path.slice(0, i).join(".");
          throw new TypeError(
            `'${prefix}' is not a serializable type, so property ${remainder} cannot be accessed.`
          );
        }
      }
      default:
        throw new TypeError("unreachable");
    }
  }
  if (value instanceof RpcPromise) {
    let { hook, pathIfPromise } = unwrapStubAndPath(value);
    return { hook, remainingPath: pathIfPromise || [] };
  }
  return {
    value,
    parent,
    owner
  };
}
var ValueStubHook = class extends StubHook {
  call(path, args) {
    try {
      let { value, owner } = this.getValue(), followResult = followPath(value, void 0, path, owner);
      if (followResult.hook)
        return followResult.hook.call(followResult.remainingPath, args);
      if (typeof followResult.value != "function")
        throw new TypeError(`'${path.join(".")}' is not a function.`);
      let promise = args.deliverCall(followResult.value, followResult.parent);
      return new PromiseStubHook(promise.then((payload) => new PayloadStubHook(payload)));
    } catch (err) {
      return new ErrorStubHook(err);
    }
  }
  map(path, captures, instructions) {
    try {
      let followResult;
      try {
        let { value, owner } = this.getValue();
        followResult = followPath(value, void 0, path, owner);
      } catch (err) {
        for (let cap of captures)
          cap.dispose();
        throw err;
      }
      return followResult.hook ? followResult.hook.map(followResult.remainingPath, captures, instructions) : mapImpl.applyMap(
        followResult.value,
        followResult.parent,
        followResult.owner,
        captures,
        instructions
      );
    } catch (err) {
      return new ErrorStubHook(err);
    }
  }
  get(path) {
    try {
      let { value, owner } = this.getValue();
      if (path.length === 0 && owner === null)
        throw new Error("Can't dup an RpcTarget stub as a promise.");
      let followResult = followPath(value, void 0, path, owner);
      return followResult.hook ? followResult.hook.get(followResult.remainingPath) : new PayloadStubHook(RpcPayload.deepCopyFrom(
        followResult.value,
        followResult.parent,
        followResult.owner
      ));
    } catch (err) {
      return new ErrorStubHook(err);
    }
  }
}, PayloadStubHook = class _PayloadStubHook extends ValueStubHook {
  constructor(payload) {
    super(), this.payload = payload;
  }
  payload;
  // cleared when disposed
  getPayload() {
    if (this.payload)
      return this.payload;
    throw new Error("Attempted to use an RPC StubHook after it was disposed.");
  }
  getValue() {
    let payload = this.getPayload();
    return { value: payload.value, owner: payload };
  }
  dup() {
    let thisPayload = this.getPayload();
    return new _PayloadStubHook(RpcPayload.deepCopyFrom(
      thisPayload.value,
      void 0,
      thisPayload
    ));
  }
  pull() {
    return this.getPayload();
  }
  ignoreUnhandledRejections() {
    this.payload && this.payload.ignoreUnhandledRejections();
  }
  dispose() {
    this.payload && (this.payload.dispose(), this.payload = void 0);
  }
  onBroken(callback) {
    this.payload && this.payload.value instanceof RpcStub && this.payload.value.onRpcBroken(callback);
  }
};
function disposeRpcTarget(target) {
  if (Symbol.dispose in target)
    try {
      target[Symbol.dispose]();
    } catch (err) {
      Promise.reject(err);
    }
}
var TargetStubHook = class _TargetStubHook extends ValueStubHook {
  // Constructs a TargetStubHook that is not duplicated from an existing hook.
  //
  // If `value` is a function, `parent` is bound as its "this".
  static create(value, parent) {
    return typeof value != "function" && (parent = void 0), new _TargetStubHook(value, parent);
  }
  constructor(target, parent, dupFrom) {
    super(), this.target = target, this.parent = parent, dupFrom ? dupFrom.refcount && (this.refcount = dupFrom.refcount, ++this.refcount.count) : Symbol.dispose in target && (this.refcount = { count: 1 });
  }
  target;
  // cleared when disposed
  parent;
  // `this` parameter when calling `target`
  refcount;
  // undefined if not needed (because target has no disposer)
  getTarget() {
    if (this.target)
      return this.target;
    throw new Error("Attempted to use an RPC StubHook after it was disposed.");
  }
  getValue() {
    return { value: this.getTarget(), owner: null };
  }
  dup() {
    return new _TargetStubHook(this.getTarget(), this.parent, this);
  }
  pull() {
    let target = this.getTarget();
    return "then" in target ? Promise.resolve(target).then((resolution) => RpcPayload.fromAppReturn(resolution)) : Promise.reject(new Error("Tried to resolve a non-promise stub."));
  }
  ignoreUnhandledRejections() {
  }
  dispose() {
    this.target && (this.refcount && --this.refcount.count == 0 && disposeRpcTarget(this.target), this.target = void 0);
  }
  onBroken(callback) {
  }
}, PromiseStubHook = class _PromiseStubHook extends StubHook {
  promise;
  resolution;
  constructor(promise) {
    super(), this.promise = promise.then((res) => (this.resolution = res, res));
  }
  call(path, args) {
    return args.ensureDeepCopied(), new _PromiseStubHook(this.promise.then((hook) => hook.call(path, args)));
  }
  map(path, captures, instructions) {
    return new _PromiseStubHook(this.promise.then(
      (hook) => hook.map(path, captures, instructions),
      (err) => {
        for (let cap of captures)
          cap.dispose();
        throw err;
      }
    ));
  }
  get(path) {
    return new _PromiseStubHook(this.promise.then((hook) => hook.get(path)));
  }
  dup() {
    return this.resolution ? this.resolution.dup() : new _PromiseStubHook(this.promise.then((hook) => hook.dup()));
  }
  pull() {
    return this.resolution ? this.resolution.pull() : this.promise.then((hook) => hook.pull());
  }
  ignoreUnhandledRejections() {
    this.resolution ? this.resolution.ignoreUnhandledRejections() : this.promise.then((res) => {
      res.ignoreUnhandledRejections();
    }, (err) => {
    });
  }
  dispose() {
    this.resolution ? this.resolution.dispose() : this.promise.then((hook) => {
      hook.dispose();
    }, (err) => {
    });
  }
  onBroken(callback) {
    this.resolution ? this.resolution.onBroken(callback) : this.promise.then((hook) => {
      hook.onBroken(callback);
    }, callback);
  }
}, NullExporter = class {
  exportStub(stub) {
    throw new Error("Cannot serialize RPC stubs without an RPC session.");
  }
  exportPromise(stub) {
    throw new Error("Cannot serialize RPC stubs without an RPC session.");
  }
  getImport(hook) {
  }
  unexport(ids) {
  }
  onSendError(error) {
  }
}, NULL_EXPORTER = new NullExporter(), ERROR_TYPES = {
  Error,
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
  AggregateError
  // TODO: DOMError? Others?
}, Devaluator = class _Devaluator {
  constructor(exporter, source) {
    this.exporter = exporter, this.source = source;
  }
  // Devaluate the given value.
  // * value: The value to devaluate.
  // * parent: The value's parent object, which would be used as `this` if the value were called
  //     as a function.
  // * exporter: Callbacks to the RPC session for exporting capabilities found in this message.
  // * source: The RpcPayload which contains the value, and therefore owns stubs within.
  //
  // Returns: The devaluated value, ready to be JSON-serialized.
  static devaluate(value, parent, exporter = NULL_EXPORTER, source) {
    let devaluator = new _Devaluator(exporter, source);
    try {
      return devaluator.devaluateImpl(value, parent, 0);
    } catch (err) {
      if (devaluator.exports)
        try {
          exporter.unexport(devaluator.exports);
        } catch {
        }
      throw err;
    }
  }
  exports;
  devaluateImpl(value, parent, depth) {
    if (depth >= 64)
      throw new Error(
        "Serialization exceeded maximum allowed depth. (Does the message contain cycles?)"
      );
    switch (typeForRpc(value)) {
      case "unsupported": {
        let msg;
        try {
          msg = `Cannot serialize value: ${value}`;
        } catch {
          msg = "Cannot serialize value: (couldn't stringify value)";
        }
        throw new TypeError(msg);
      }
      case "primitive":
        return value;
      case "object": {
        let object = value, result = {};
        for (let key in object)
          result[key] = this.devaluateImpl(object[key], object, depth + 1);
        return result;
      }
      case "array": {
        let array = value, len = array.length, result = new Array(len);
        for (let i = 0; i < len; i++)
          result[i] = this.devaluateImpl(array[i], array, depth + 1);
        return [result];
      }
      case "bigint":
        return ["bigint", value.toString()];
      case "date":
        return ["date", value.getTime()];
      case "bytes": {
        let bytes = value;
        return bytes.toBase64 ? ["bytes", bytes.toBase64({ omitPadding: !0 })] : [
          "bytes",
          btoa(String.fromCharCode.apply(null, bytes).replace(/=*$/, ""))
        ];
      }
      case "error": {
        let e = value, rewritten = this.exporter.onSendError(e);
        rewritten && (e = rewritten);
        let result = ["error", e.name, e.message];
        return rewritten && rewritten.stack && result.push(rewritten.stack), result;
      }
      case "undefined":
        return ["undefined"];
      case "stub":
      case "rpc-promise": {
        if (!this.source)
          throw new Error("Can't serialize RPC stubs in this context.");
        let { hook, pathIfPromise } = unwrapStubAndPath(value), importId = this.exporter.getImport(hook);
        return importId !== void 0 ? pathIfPromise ? pathIfPromise.length > 0 ? ["pipeline", importId, pathIfPromise] : ["pipeline", importId] : ["import", importId] : (pathIfPromise ? hook = hook.get(pathIfPromise) : hook = hook.dup(), this.devaluateHook(pathIfPromise ? "promise" : "export", hook));
      }
      case "function":
      case "rpc-target": {
        if (!this.source)
          throw new Error("Can't serialize RPC stubs in this context.");
        let hook = this.source.getHookForRpcTarget(value, parent);
        return this.devaluateHook("export", hook);
      }
      case "rpc-thenable": {
        if (!this.source)
          throw new Error("Can't serialize RPC stubs in this context.");
        let hook = this.source.getHookForRpcTarget(value, parent);
        return this.devaluateHook("promise", hook);
      }
      default:
        throw new Error("unreachable");
    }
  }
  devaluateHook(type, hook) {
    this.exports || (this.exports = []);
    let exportId = type === "promise" ? this.exporter.exportPromise(hook) : this.exporter.exportStub(hook);
    return this.exports.push(exportId), [type, exportId];
  }
};
var NullImporter = class {
  importStub(idx) {
    throw new Error("Cannot deserialize RPC stubs without an RPC session.");
  }
  importPromise(idx) {
    throw new Error("Cannot deserialize RPC stubs without an RPC session.");
  }
  getExport(idx) {
  }
}, NULL_IMPORTER = new NullImporter(), Evaluator = class _Evaluator {
  constructor(importer) {
    this.importer = importer;
  }
  stubs = [];
  promises = [];
  evaluate(value) {
    let payload = RpcPayload.forEvaluate(this.stubs, this.promises);
    try {
      return payload.value = this.evaluateImpl(value, payload, "value"), payload;
    } catch (err) {
      throw payload.dispose(), err;
    }
  }
  // Evaluate the value without destroying it.
  evaluateCopy(value) {
    return this.evaluate(structuredClone(value));
  }
  evaluateImpl(value, parent, property) {
    if (value instanceof Array) {
      if (value.length == 1 && value[0] instanceof Array) {
        let result = value[0];
        for (let i = 0; i < result.length; i++)
          result[i] = this.evaluateImpl(result[i], result, i);
        return result;
      } else switch (value[0]) {
        case "bigint":
          if (typeof value[1] == "string")
            return BigInt(value[1]);
          break;
        case "date":
          if (typeof value[1] == "number")
            return new Date(value[1]);
          break;
        case "bytes": {
          let b64 = Uint8Array;
          if (typeof value[1] == "string") {
            if (b64.fromBase64)
              return b64.fromBase64(value[1]);
            {
              let bs = atob(value[1]), len = bs.length, bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++)
                bytes[i] = bs.charCodeAt(i);
              return bytes;
            }
          }
          break;
        }
        case "error":
          if (value.length >= 3 && typeof value[1] == "string" && typeof value[2] == "string") {
            let cls = ERROR_TYPES[value[1]] || Error, result = new cls(value[2]);
            return typeof value[3] == "string" && (result.stack = value[3]), result;
          }
          break;
        case "undefined":
          if (value.length === 1)
            return;
          break;
        case "import":
        case "pipeline": {
          if (value.length < 2 || value.length > 4 || typeof value[1] != "number")
            break;
          let hook = this.importer.getExport(value[1]);
          if (!hook)
            throw new Error(`no such entry on exports table: ${value[1]}`);
          let isPromise = value[0] == "pipeline", addStub = (hook2) => {
            if (isPromise) {
              let promise = new RpcPromise(hook2, []);
              return this.promises.push({ promise, parent, property }), promise;
            } else {
              let stub = new RpcPromise(hook2, []);
              return this.stubs.push(stub), stub;
            }
          };
          if (value.length == 2)
            return addStub(isPromise ? hook.get([]) : hook.dup());
          let path = value[2];
          if (!(path instanceof Array) || !path.every(
            (part) => typeof part == "string" || typeof part == "number"
          ))
            break;
          if (value.length == 3)
            return addStub(hook.get(path));
          let args = value[3];
          if (!(args instanceof Array))
            break;
          return args = new _Evaluator(this.importer).evaluate([args]), addStub(hook.call(path, args));
        }
        case "remap": {
          if (value.length !== 5 || typeof value[1] != "number" || !(value[2] instanceof Array) || !(value[3] instanceof Array) || !(value[4] instanceof Array))
            break;
          let hook = this.importer.getExport(value[1]);
          if (!hook)
            throw new Error(`no such entry on exports table: ${value[1]}`);
          let path = value[2];
          if (!path.every(
            (part) => typeof part == "string" || typeof part == "number"
          ))
            break;
          let captures = value[3].map((cap) => {
            if (!(cap instanceof Array) || cap.length !== 2 || cap[0] !== "import" && cap[0] !== "export" || typeof cap[1] != "number")
              throw new TypeError(`unknown map capture: ${JSON.stringify(cap)}`);
            if (cap[0] === "export")
              return this.importer.importStub(cap[1]);
            {
              let exp = this.importer.getExport(cap[1]);
              if (!exp)
                throw new Error(`no such entry on exports table: ${cap[1]}`);
              return exp.dup();
            }
          }), instructions = value[4], resultHook = hook.map(path, captures, instructions), promise = new RpcPromise(resultHook, []);
          return this.promises.push({ promise, parent, property }), promise;
        }
        case "export":
        case "promise":
          if (typeof value[1] == "number")
            if (value[0] == "promise") {
              let hook = this.importer.importPromise(value[1]), promise = new RpcPromise(hook, []);
              return this.promises.push({ parent, property, promise }), promise;
            } else {
              let hook = this.importer.importStub(value[1]), stub = new RpcStub(hook);
              return this.stubs.push(stub), stub;
            }
          break;
      }
      throw new TypeError(`unknown special value: ${JSON.stringify(value)}`);
    } else if (value instanceof Object) {
      let result = value;
      for (let key in result)
        key in Object.prototype || key === "toJSON" ? (this.evaluateImpl(result[key], result, key), delete result[key]) : result[key] = this.evaluateImpl(result[key], result, key);
      return result;
    } else
      return value;
  }
};
var ImportTableEntry = class {
  constructor(session, importId, pulling) {
    this.session = session, this.importId = importId, pulling && (this.activePull = Promise.withResolvers());
  }
  localRefcount = 0;
  remoteRefcount = 1;
  activePull;
  resolution;
  // List of integer indexes into session.onBrokenCallbacks which are callbacks registered on
  // this import. Initialized on first use (so `undefined` is the same as an empty list).
  onBrokenRegistrations;
  resolve(resolution) {
    if (this.localRefcount == 0) {
      resolution.dispose();
      return;
    }
    if (this.resolution = resolution, this.sendRelease(), this.onBrokenRegistrations) {
      for (let i of this.onBrokenRegistrations) {
        let callback = this.session.onBrokenCallbacks[i], endIndex = this.session.onBrokenCallbacks.length;
        resolution.onBroken(callback), this.session.onBrokenCallbacks[endIndex] === callback ? delete this.session.onBrokenCallbacks[endIndex] : delete this.session.onBrokenCallbacks[i];
      }
      this.onBrokenRegistrations = void 0;
    }
    this.activePull && (this.activePull.resolve(), this.activePull = void 0);
  }
  async awaitResolution() {
    return this.activePull || (this.session.sendPull(this.importId), this.activePull = Promise.withResolvers()), await this.activePull.promise, this.resolution.pull();
  }
  dispose() {
    this.resolution ? this.resolution.dispose() : (this.abort(new Error("RPC was canceled because the RpcPromise was disposed.")), this.sendRelease());
  }
  abort(error) {
    this.resolution || (this.resolution = new ErrorStubHook(error), this.activePull && (this.activePull.reject(error), this.activePull = void 0), this.onBrokenRegistrations = void 0);
  }
  onBroken(callback) {
    if (this.resolution)
      this.resolution.onBroken(callback);
    else {
      let index = this.session.onBrokenCallbacks.length;
      this.session.onBrokenCallbacks.push(callback), this.onBrokenRegistrations || (this.onBrokenRegistrations = []), this.onBrokenRegistrations.push(index);
    }
  }
  sendRelease() {
    this.remoteRefcount > 0 && (this.session.sendRelease(this.importId, this.remoteRefcount), this.remoteRefcount = 0);
  }
}, RpcImportHook = class _RpcImportHook extends StubHook {
  // undefined when we're disposed
  // `pulling` is true if we already expect that this import is going to be resolved later, and
  // null if this import is not allowed to be pulled (i.e. it's a stub not a promise).
  constructor(isPromise, entry) {
    super(), this.isPromise = isPromise, ++entry.localRefcount, this.entry = entry;
  }
  entry;
  collectPath(path) {
    return this;
  }
  getEntry() {
    if (this.entry)
      return this.entry;
    throw new Error("This RpcImportHook was already disposed.");
  }
  // -------------------------------------------------------------------------------------
  // implements StubHook
  call(path, args) {
    let entry = this.getEntry();
    return entry.resolution ? entry.resolution.call(path, args) : entry.session.sendCall(entry.importId, path, args);
  }
  map(path, captures, instructions) {
    let entry;
    try {
      entry = this.getEntry();
    } catch (err) {
      for (let cap of captures)
        cap.dispose();
      throw err;
    }
    return entry.resolution ? entry.resolution.map(path, captures, instructions) : entry.session.sendMap(entry.importId, path, captures, instructions);
  }
  get(path) {
    let entry = this.getEntry();
    return entry.resolution ? entry.resolution.get(path) : entry.session.sendCall(entry.importId, path);
  }
  dup() {
    return new _RpcImportHook(!1, this.getEntry());
  }
  pull() {
    let entry = this.getEntry();
    if (!this.isPromise)
      throw new Error("Can't pull this hook because it's not a promise hook.");
    return entry.resolution ? entry.resolution.pull() : entry.awaitResolution();
  }
  ignoreUnhandledRejections() {
  }
  dispose() {
    let entry = this.entry;
    this.entry = void 0, entry && --entry.localRefcount === 0 && entry.dispose();
  }
  onBroken(callback) {
    this.entry && this.entry.onBroken(callback);
  }
}, RpcMainHook = class extends RpcImportHook {
  session;
  constructor(entry) {
    super(!1, entry), this.session = entry.session;
  }
  dispose() {
    if (this.session) {
      let session = this.session;
      this.session = void 0, session.shutdown();
    }
  }
}, RpcSessionImpl = class {
  constructor(transport, mainHook, options) {
    this.transport = transport, this.options = options, this.exports.push({ hook: mainHook, refcount: 1 }), this.imports.push(new ImportTableEntry(this, 0, !1));
    let rejectFunc, abortPromise = new Promise((resolve, reject) => {
      rejectFunc = reject;
    });
    this.cancelReadLoop = rejectFunc, this.readLoop(abortPromise).catch((err) => this.abort(err));
  }
  exports = [];
  reverseExports = /* @__PURE__ */ new Map();
  imports = [];
  abortReason;
  cancelReadLoop;
  // We assign positive numbers to imports we initiate, and negative numbers to exports we
  // initiate. So the next import ID is just `imports.length`, but the next export ID needs
  // to be tracked explicitly.
  nextExportId = -1;
  // If set, call this when all incoming calls are complete.
  onBatchDone;
  // How many promises is our peer expecting us to resolve?
  pullCount = 0;
  // Sparse array of onBrokenCallback registrations. Items are strictly appended to the end but
  // may be deleted from the middle (hence leaving the array sparse).
  onBrokenCallbacks = [];
  // Should only be called once immediately after construction.
  getMainImport() {
    return new RpcMainHook(this.imports[0]);
  }
  shutdown() {
    this.abort(new Error("RPC session was shut down by disposing the main stub"), !1);
  }
  exportStub(hook) {
    if (this.abortReason) throw this.abortReason;
    let existingExportId = this.reverseExports.get(hook);
    if (existingExportId !== void 0)
      return ++this.exports[existingExportId].refcount, existingExportId;
    {
      let exportId = this.nextExportId--;
      return this.exports[exportId] = { hook, refcount: 1 }, this.reverseExports.set(hook, exportId), exportId;
    }
  }
  exportPromise(hook) {
    if (this.abortReason) throw this.abortReason;
    let exportId = this.nextExportId--;
    return this.exports[exportId] = { hook, refcount: 1 }, this.reverseExports.set(hook, exportId), this.ensureResolvingExport(exportId), exportId;
  }
  unexport(ids) {
    for (let id of ids)
      this.releaseExport(id, 1);
  }
  releaseExport(exportId, refcount) {
    let entry = this.exports[exportId];
    if (!entry)
      throw new Error(`no such export ID: ${exportId}`);
    if (entry.refcount < refcount)
      throw new Error(`refcount would go negative: ${entry.refcount} < ${refcount}`);
    entry.refcount -= refcount, entry.refcount === 0 && (delete this.exports[exportId], this.reverseExports.delete(entry.hook), entry.hook.dispose());
  }
  onSendError(error) {
    if (this.options.onSendError)
      return this.options.onSendError(error);
  }
  ensureResolvingExport(exportId) {
    let exp = this.exports[exportId];
    if (!exp)
      throw new Error(`no such export ID: ${exportId}`);
    if (!exp.pull) {
      let resolve = async () => {
        let hook = exp.hook;
        for (; ; ) {
          let payload = await hook.pull();
          if (payload.value instanceof RpcStub) {
            let { hook: inner, pathIfPromise } = unwrapStubAndPath(payload.value);
            if (pathIfPromise && pathIfPromise.length == 0 && this.getImport(hook) === void 0) {
              hook = inner;
              continue;
            }
          }
          return payload;
        }
      };
      ++this.pullCount, exp.pull = resolve().then(
        (payload) => {
          let value = Devaluator.devaluate(payload.value, void 0, this, payload);
          this.send(["resolve", exportId, value]);
        },
        (error) => {
          this.send(["reject", exportId, Devaluator.devaluate(error, void 0, this)]);
        }
      ).catch(
        (error) => {
          try {
            this.send(["reject", exportId, Devaluator.devaluate(error, void 0, this)]);
          } catch (error2) {
            this.abort(error2);
          }
        }
      ).finally(() => {
        --this.pullCount === 0 && this.onBatchDone && this.onBatchDone.resolve();
      });
    }
  }
  getImport(hook) {
    if (hook instanceof RpcImportHook && hook.entry && hook.entry.session === this)
      return hook.entry.importId;
  }
  importStub(idx) {
    if (this.abortReason) throw this.abortReason;
    let entry = this.imports[idx];
    return entry || (entry = new ImportTableEntry(this, idx, !1), this.imports[idx] = entry), new RpcImportHook(
      /*isPromise=*/
      !1,
      entry
    );
  }
  importPromise(idx) {
    if (this.abortReason) throw this.abortReason;
    if (this.imports[idx])
      return new ErrorStubHook(new Error(
        "Bug in RPC system: The peer sent a promise reusing an existing export ID."
      ));
    let entry = new ImportTableEntry(this, idx, !0);
    return this.imports[idx] = entry, new RpcImportHook(
      /*isPromise=*/
      !0,
      entry
    );
  }
  getExport(idx) {
    return this.exports[idx]?.hook;
  }
  send(msg) {
    if (this.abortReason !== void 0)
      return;
    let msgText;
    try {
      msgText = JSON.stringify(msg);
    } catch (err) {
      try {
        this.abort(err);
      } catch {
      }
      throw err;
    }
    this.transport.send(msgText).catch((err) => this.abort(err, !1));
  }
  sendCall(id, path, args) {
    if (this.abortReason) throw this.abortReason;
    let value = ["pipeline", id, path];
    if (args) {
      let devalue = Devaluator.devaluate(args.value, void 0, this, args);
      value.push(devalue[0]);
    }
    this.send(["push", value]);
    let entry = new ImportTableEntry(this, this.imports.length, !1);
    return this.imports.push(entry), new RpcImportHook(
      /*isPromise=*/
      !0,
      entry
    );
  }
  sendMap(id, path, captures, instructions) {
    if (this.abortReason) {
      for (let cap of captures)
        cap.dispose();
      throw this.abortReason;
    }
    let devaluedCaptures = captures.map((hook) => {
      let importId = this.getImport(hook);
      return importId !== void 0 ? ["import", importId] : ["export", this.exportStub(hook)];
    }), value = ["remap", id, path, devaluedCaptures, instructions];
    this.send(["push", value]);
    let entry = new ImportTableEntry(this, this.imports.length, !1);
    return this.imports.push(entry), new RpcImportHook(
      /*isPromise=*/
      !0,
      entry
    );
  }
  sendPull(id) {
    if (this.abortReason) throw this.abortReason;
    this.send(["pull", id]);
  }
  sendRelease(id, remoteRefcount) {
    this.abortReason || (this.send(["release", id, remoteRefcount]), delete this.imports[id]);
  }
  abort(error, trySendAbortMessage = !0) {
    if (this.abortReason === void 0) {
      if (this.cancelReadLoop(error), trySendAbortMessage)
        try {
          this.transport.send(JSON.stringify(["abort", Devaluator.devaluate(error, void 0, this)])).catch((err) => {
          });
        } catch {
        }
      if (error === void 0 && (error = "undefined"), this.abortReason = error, this.onBatchDone && this.onBatchDone.reject(error), this.transport.abort)
        try {
          this.transport.abort(error);
        } catch (err) {
          Promise.resolve(err);
        }
      for (let i in this.onBrokenCallbacks)
        try {
          this.onBrokenCallbacks[i](error);
        } catch (err) {
          Promise.resolve(err);
        }
      for (let i in this.imports)
        this.imports[i].abort(error);
      for (let i in this.exports)
        this.exports[i].hook.dispose();
    }
  }
  async readLoop(abortPromise) {
    for (; !this.abortReason; ) {
      let msg = JSON.parse(await Promise.race([this.transport.receive(), abortPromise]));
      if (this.abortReason) break;
      if (msg instanceof Array)
        switch (msg[0]) {
          case "push":
            if (msg.length > 1) {
              let payload = new Evaluator(this).evaluate(msg[1]), hook = new PayloadStubHook(payload);
              hook.ignoreUnhandledRejections(), this.exports.push({ hook, refcount: 1 });
              continue;
            }
            break;
          case "pull": {
            let exportId = msg[1];
            if (typeof exportId == "number") {
              this.ensureResolvingExport(exportId);
              continue;
            }
            break;
          }
          case "resolve":
          // ["resolve", ExportId, Expression]
          case "reject": {
            let importId = msg[1];
            if (typeof importId == "number" && msg.length > 2) {
              let imp = this.imports[importId];
              if (imp)
                if (msg[0] == "resolve")
                  imp.resolve(new PayloadStubHook(new Evaluator(this).evaluate(msg[2])));
                else {
                  let payload = new Evaluator(this).evaluate(msg[2]);
                  payload.dispose(), imp.resolve(new ErrorStubHook(payload.value));
                }
              else
                msg[0] == "resolve" && new Evaluator(this).evaluate(msg[2]).dispose();
              continue;
            }
            break;
          }
          case "release": {
            let exportId = msg[1], refcount = msg[2];
            if (typeof exportId == "number" && typeof refcount == "number") {
              this.releaseExport(exportId, refcount);
              continue;
            }
            break;
          }
          case "abort": {
            let payload = new Evaluator(this).evaluate(msg[1]);
            payload.dispose(), this.abort(payload, !1);
            break;
          }
        }
      throw new Error(`bad RPC message: ${JSON.stringify(msg)}`);
    }
  }
  async drain() {
    if (this.abortReason)
      throw this.abortReason;
    if (this.pullCount > 0) {
      let { promise, resolve, reject } = Promise.withResolvers();
      this.onBatchDone = { resolve, reject }, await promise;
    }
  }
  getStats() {
    let result = { imports: 0, exports: 0 };
    for (let i in this.imports)
      ++result.imports;
    for (let i in this.exports)
      ++result.exports;
    return result;
  }
}, RpcSession = class {
  #session;
  #mainStub;
  constructor(transport, localMain, options = {}) {
    let mainHook;
    localMain ? mainHook = new PayloadStubHook(RpcPayload.fromAppReturn(localMain)) : mainHook = new ErrorStubHook(new Error("This connection has no main object.")), this.#session = new RpcSessionImpl(transport, mainHook, options), this.#mainStub = new RpcStub(this.#session.getMainImport());
  }
  getRemoteMain() {
    return this.#mainStub;
  }
  getStats() {
    return this.#session.getStats();
  }
  drain() {
    return this.#session.drain();
  }
};
function newWebSocketRpcSession(webSocket, localMain, options) {
  typeof webSocket == "string" && (webSocket = new WebSocket(webSocket));
  let transport = new WebSocketTransport(webSocket);
  return new RpcSession(transport, localMain, options).getRemoteMain();
}
var WebSocketTransport = class {
  constructor(webSocket) {
    this.#webSocket = webSocket, webSocket.readyState === WebSocket.CONNECTING && (this.#sendQueue = [], webSocket.addEventListener("open", (event) => {
      try {
        for (let message of this.#sendQueue)
          webSocket.send(message);
      } catch (err) {
        this.#receivedError(err);
      }
      this.#sendQueue = void 0;
    })), webSocket.addEventListener("message", (event) => {
      this.#error || (typeof event.data == "string" ? this.#receiveResolver ? (this.#receiveResolver(event.data), this.#receiveResolver = void 0, this.#receiveRejecter = void 0) : this.#receiveQueue.push(event.data) : this.#receivedError(new TypeError("Received non-string message from WebSocket.")));
    }), webSocket.addEventListener("close", (event) => {
      this.#receivedError(new Error(`Peer closed WebSocket: ${event.code} ${event.reason}`));
    }), webSocket.addEventListener("error", (event) => {
      this.#receivedError(new Error("WebSocket connection failed."));
    });
  }
  #webSocket;
  #sendQueue;
  // only if not opened yet
  #receiveResolver;
  #receiveRejecter;
  #receiveQueue = [];
  #error;
  async send(message) {
    this.#sendQueue === void 0 ? this.#webSocket.send(message) : this.#sendQueue.push(message);
  }
  async receive() {
    if (this.#receiveQueue.length > 0)
      return this.#receiveQueue.shift();
    if (this.#error)
      throw this.#error;
    return new Promise((resolve, reject) => {
      this.#receiveResolver = resolve, this.#receiveRejecter = reject;
    });
  }
  abort(reason) {
    let message;
    reason instanceof Error ? message = reason.message : message = `${reason}`, this.#webSocket.close(3e3, message), this.#error || (this.#error = reason);
  }
  #receivedError(reason) {
    this.#error || (this.#error = reason, this.#receiveRejecter && (this.#receiveRejecter(reason), this.#receiveResolver = void 0, this.#receiveRejecter = void 0));
  }
};
var currentMapBuilder, MapBuilder = class {
  context;
  captureMap = /* @__PURE__ */ new Map();
  instructions = [];
  constructor(subject, path) {
    currentMapBuilder ? this.context = {
      parent: currentMapBuilder,
      captures: [],
      subject: currentMapBuilder.capture(subject),
      path
    } : this.context = {
      parent: void 0,
      captures: [],
      subject,
      path
    }, currentMapBuilder = this;
  }
  unregister() {
    currentMapBuilder = this.context.parent;
  }
  makeInput() {
    return new MapVariableHook(this, 0);
  }
  makeOutput(result) {
    let devalued;
    try {
      devalued = Devaluator.devaluate(result.value, void 0, this, result);
    } finally {
      result.dispose();
    }
    return this.instructions.push(devalued), this.context.parent ? (this.context.parent.instructions.push(
      [
        "remap",
        this.context.subject,
        this.context.path,
        this.context.captures.map((cap) => ["import", cap]),
        this.instructions
      ]
    ), new MapVariableHook(this.context.parent, this.context.parent.instructions.length)) : this.context.subject.map(this.context.path, this.context.captures, this.instructions);
  }
  pushCall(hook, path, params) {
    let devalued = Devaluator.devaluate(params.value, void 0, this, params);
    devalued = devalued[0];
    let subject = this.capture(hook.dup());
    return this.instructions.push(["pipeline", subject, path, devalued]), new MapVariableHook(this, this.instructions.length);
  }
  pushGet(hook, path) {
    let subject = this.capture(hook.dup());
    return this.instructions.push(["pipeline", subject, path]), new MapVariableHook(this, this.instructions.length);
  }
  capture(hook) {
    if (hook instanceof MapVariableHook && hook.mapper === this)
      return hook.idx;
    let result = this.captureMap.get(hook);
    if (result === void 0) {
      if (this.context.parent) {
        let parentIdx = this.context.parent.capture(hook);
        this.context.captures.push(parentIdx);
      } else
        this.context.captures.push(hook);
      result = -this.context.captures.length, this.captureMap.set(hook, result);
    }
    return result;
  }
  // ---------------------------------------------------------------------------
  // implements Exporter
  exportStub(hook) {
    throw new Error(
      "Can't construct an RpcTarget or RPC callback inside a mapper function. Try creating a new RpcStub outside the callback first, then using it inside the callback."
    );
  }
  exportPromise(hook) {
    return this.exportStub(hook);
  }
  getImport(hook) {
    return this.capture(hook);
  }
  unexport(ids) {
  }
  onSendError(error) {
  }
};
mapImpl.sendMap = (hook, path, func) => {
  let builder = new MapBuilder(hook, path), result;
  try {
    result = RpcPayload.fromAppReturn(withCallInterceptor(builder.pushCall.bind(builder), () => func(new RpcPromise(builder.makeInput(), []))));
  } finally {
    builder.unregister();
  }
  if (result instanceof Promise)
    throw result.catch((err) => {
    }), new Error("RPC map() callbacks cannot be async.");
  return new RpcPromise(builder.makeOutput(result), []);
};
function throwMapperBuilderUseError() {
  throw new Error(
    "Attempted to use an abstract placeholder from a mapper function. Please make sure your map function has no side effects."
  );
}
var MapVariableHook = class extends StubHook {
  constructor(mapper, idx) {
    super(), this.mapper = mapper, this.idx = idx;
  }
  // We don't have anything we actually need to dispose, so dup() can just return the same hook.
  dup() {
    return this;
  }
  dispose() {
  }
  get(path) {
    if (path.length == 0)
      return this;
    if (currentMapBuilder)
      return currentMapBuilder.pushGet(this, path);
    throwMapperBuilderUseError();
  }
  // Other methods should never be called.
  call(path, args) {
    throwMapperBuilderUseError();
  }
  map(path, captures, instructions) {
    throwMapperBuilderUseError();
  }
  pull() {
    throwMapperBuilderUseError();
  }
  ignoreUnhandledRejections() {
  }
  onBroken(callback) {
    throwMapperBuilderUseError();
  }
}, MapApplicator = class {
  constructor(captures, input) {
    this.captures = captures, this.variables = [input];
  }
  variables;
  dispose() {
    for (let variable of this.variables)
      variable.dispose();
  }
  apply(instructions) {
    try {
      if (instructions.length < 1)
        throw new Error("Invalid empty mapper function.");
      for (let instruction of instructions.slice(0, -1)) {
        let payload = new Evaluator(this).evaluateCopy(instruction);
        if (payload.value instanceof RpcStub) {
          let hook = unwrapStubNoProperties(payload.value);
          if (hook) {
            this.variables.push(hook);
            continue;
          }
        }
        this.variables.push(new PayloadStubHook(payload));
      }
      return new Evaluator(this).evaluateCopy(instructions[instructions.length - 1]);
    } finally {
      for (let variable of this.variables)
        variable.dispose();
    }
  }
  importStub(idx) {
    throw new Error("A mapper function cannot refer to exports.");
  }
  importPromise(idx) {
    return this.importStub(idx);
  }
  getExport(idx) {
    return idx < 0 ? this.captures[-idx - 1] : this.variables[idx];
  }
};
function applyMapToElement(input, parent, owner, captures, instructions) {
  let inputHook = new PayloadStubHook(RpcPayload.deepCopyFrom(input, parent, owner)), mapper = new MapApplicator(captures, inputHook);
  try {
    return mapper.apply(instructions);
  } finally {
    mapper.dispose();
  }
}
mapImpl.applyMap = (input, parent, owner, captures, instructions) => {
  try {
    let result;
    if (input instanceof RpcPromise)
      throw new Error("applyMap() can't be called on RpcPromise");
    if (input instanceof Array) {
      let payloads = [];
      try {
        for (let elem of input)
          payloads.push(applyMapToElement(elem, input, owner, captures, instructions));
      } catch (err) {
        for (let payload of payloads)
          payload.dispose();
        throw err;
      }
      result = RpcPayload.fromArray(payloads);
    } else input == null ? result = RpcPayload.fromAppReturn(input) : result = applyMapToElement(input, parent, owner, captures, instructions);
    return new PayloadStubHook(result);
  } finally {
    for (let cap of captures)
      cap.dispose();
  }
};
var newWebSocketRpcSession2 = newWebSocketRpcSession;

// src/workers/shared/remote-bindings-utils.ts
function makeFetch(remoteProxyConnectionString, bindingName, extraHeaders) {
  return (input, init) => {
    if (!remoteProxyConnectionString)
      throw new Error(`Binding ${bindingName} needs to be run remotely`);
    let request = new Request(input, init), proxiedHeaders = new Headers(extraHeaders);
    for (let [name, value] of request.headers)
      name === "upgrade" ? proxiedHeaders.set(name, value) : proxiedHeaders.set(`MF-Header-${name}`, value);
    proxiedHeaders.set("MF-URL", request.url), proxiedHeaders.set("MF-Binding", bindingName);
    let req = new Request(request, {
      headers: proxiedHeaders
    });
    return fetch(remoteProxyConnectionString, req);
  };
}

// src/workers/dispatch-namespace/dispatch-namespace.worker.ts
function dispatch_namespace_worker_default(env) {
  return {
    get(name, args, options) {
      if (!env.remoteProxyConnectionString)
        throw new Error(`Binding ${env.binding} needs to be run remotely`);
      let url = new URL(env.remoteProxyConnectionString);
      url.protocol = "ws:", url.searchParams.set("MF-Binding", env.binding), url.searchParams.set(
        "MF-Dispatch-Namespace-Options",
        JSON.stringify({ name, args, options })
      );
      let stub = newWebSocketRpcSession2(url.href);
      return new Proxy(stub, {
        get(_, p) {
          return p === "fetch" ? makeFetch(
            env.remoteProxyConnectionString,
            env.binding,
            new Headers({
              "MF-Dispatch-Namespace-Options": JSON.stringify({
                name,
                args,
                options
              })
            })
          ) : Reflect.get(stub, p);
        }
      });
    }
  };
}
export {
  dispatch_namespace_worker_default as default
};
//# sourceMappingURL=dispatch-namespace.worker.js.map
