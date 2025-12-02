function chain(...funcs) {
  return (...args) => {
    return funcs.slice(1).reduce((acc, fn) => fn(acc), funcs[0](...args));
  };
}
function compose(...funcs) {
  return funcs.reverse().reduce((acc, fn) => fn(acc));
}
const partial = (fn, ...args) => {
  return (...rest) => fn(...[...args, ...rest]);
};
const partob = (fn, argobj) => {
  return (restobj) => fn({
    ...argobj,
    ...restobj
  });
};
const proxied = (handler) => {
  return new Proxy(
    {},
    {
      get: (target, propertyName) => handler(propertyName)
    }
  );
};
const memoize = (cache, func, keyFunc, ttl) => {
  return function callWithMemo(...args) {
    const key = keyFunc ? keyFunc(...args) : JSON.stringify({ args });
    const existing = cache[key];
    if (existing !== void 0) {
      if (!existing.exp)
        return existing.value;
      if (existing.exp > new Date().getTime()) {
        return existing.value;
      }
    }
    const result = func(...args);
    cache[key] = {
      exp: ttl ? new Date().getTime() + ttl : null,
      value: result
    };
    return result;
  };
};
const memo = (func, options = {}) => {
  return memoize({}, func, options.key ?? null, options.ttl ?? null);
};
const debounce = ({ delay }, func) => {
  let timer = void 0;
  let active = true;
  const debounced = (...args) => {
    if (active) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        active && func(...args);
        timer = void 0;
      }, delay);
    } else {
      func(...args);
    }
  };
  debounced.isPending = () => {
    return timer !== void 0;
  };
  debounced.cancel = () => {
    active = false;
  };
  debounced.flush = (...args) => func(...args);
  return debounced;
};
const throttle = ({ interval }, func) => {
  let ready = true;
  let timer = void 0;
  const throttled = (...args) => {
    if (!ready)
      return;
    func(...args);
    ready = false;
    timer = setTimeout(() => {
      ready = true;
      timer = void 0;
    }, interval);
  };
  throttled.isThrottled = () => {
    return timer !== void 0;
  };
  return throttled;
};
const callable = (obj, fn) => {
  const FUNC = () => {
  };
  return new Proxy(Object.assign(FUNC, obj), {
    get: (target, key) => target[key],
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
    apply: (target, self, args) => fn(Object.assign({}, target))(...args)
  });
};

export { callable, chain, compose, debounce, memo, partial, partob, proxied, throttle };
//# sourceMappingURL=curry.mjs.map
