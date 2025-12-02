"use strict";

function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
const cloneDeep = require("clone-deep");
const path = require("path");
const fs = require("fs");
const babel = require("./babel-core.cjs");
const registerCache = require("./cache.cjs");
const nmRE = escapeRegExp(path.sep + "node_modules" + path.sep);
function escapeRegExp(string) {
  return string.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}
let cache;
let transformOpts;
function setOptions(opts) {
  if (opts.cache === false && cache) {
    registerCache.clear();
    cache = null;
  } else if (opts.cache !== false && !cache) {
    registerCache.load();
    cache = registerCache.get();
  }
  delete opts.cache;
  delete opts.extensions;
  transformOpts = Object.assign({}, opts, {
    caller: Object.assign({
      name: "@babel/register"
    }, opts.caller || {})
  });
  let {
    cwd = "."
  } = transformOpts;
  cwd = transformOpts.cwd = path.resolve(cwd);
  if (transformOpts.ignore === undefined && transformOpts.only === undefined) {
    const cwdRE = escapeRegExp(cwd);
    transformOpts.only = [new RegExp("^" + cwdRE, "i")];
    transformOpts.ignore = [new RegExp(`^${cwdRE}(?:${path.sep}.*)?${nmRE}`, "i")];
  }
}
function transform(_x, _x2) {
  return _transform.apply(this, arguments);
}
function _transform() {
  _transform = _asyncToGenerator(function* (input, filename) {
    const opts = yield babel.loadOptionsAsync(Object.assign({
      sourceRoot: path.dirname(filename) + path.sep
    }, cloneDeep(transformOpts), {
      filename
    }));
    if (opts === null) return null;
    const {
      cached,
      store
    } = cacheLookup(opts, filename);
    if (cached) return cached;
    const {
      code,
      map
    } = yield babel.transformAsync(input, Object.assign({}, opts, {
      sourceMaps: opts.sourceMaps === undefined ? "both" : opts.sourceMaps,
      ast: false
    }));
    return store({
      code,
      map
    });
  });
  return _transform.apply(this, arguments);
}
module.exports = {
  setOptions,
  transform
};
{
  module.exports.transformSync = function (input, filename) {
    const opts = new babel.OptionManager().init(Object.assign({
      sourceRoot: path.dirname(filename) + path.sep
    }, cloneDeep(transformOpts), {
      filename
    }));
    if (opts === null) return null;
    const {
      cached,
      store
    } = cacheLookup(opts, filename);
    if (cached) return cached;
    const {
      code,
      map
    } = babel.transformSync(input, Object.assign({}, opts, {
      sourceMaps: opts.sourceMaps === undefined ? "both" : opts.sourceMaps,
      ast: false
    }));
    return store({
      code,
      map
    });
  };
}
const id = value => value;
function cacheLookup(opts, filename) {
  if (!cache) return {
    cached: null,
    store: id
  };
  let cacheKey = `${JSON.stringify(opts)}:${babel.version}`;
  const env = babel.getEnv();
  if (env) cacheKey += `:${env}`;
  const cached = cache[cacheKey];
  const fileMtime = +fs.statSync(filename).mtime;
  if (cached && cached.mtime === fileMtime) {
    return {
      cached: cached.value,
      store: id
    };
  }
  return {
    cached: null,
    store(value) {
      cache[cacheKey] = {
        value,
        mtime: fileMtime
      };
      registerCache.setDirty();
      return value;
    }
  };
}

//# sourceMappingURL=transform.cjs.map
