const EmptyObject = /* @__PURE__ */ (() => {
  const C = function() {
  };
  C.prototype = /* @__PURE__ */ Object.create(null);
  return C;
})();

function createRouter() {
  const ctx = {
    root: { key: "" },
    static: new EmptyObject()
  };
  return ctx;
}

function splitPath(path) {
  return path.split("/").filter(Boolean);
}
function getMatchParams(segments, paramsMap) {
  const params = new EmptyObject();
  for (const [index, name] of paramsMap) {
    const segment = index < 0 ? segments.slice(-1 * index).join("/") : segments[index];
    if (typeof name === "string") {
      params[name] = segment;
    } else {
      const match = segment.match(name);
      if (match) {
        for (const key in match.groups) {
          params[key] = match.groups[key];
        }
      }
    }
  }
  return params;
}

function addRoute(ctx, method = "", path, data) {
  const segments = splitPath(path);
  let node = ctx.root;
  let _unnamedParamIndex = 0;
  const paramsMap = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.startsWith("**")) {
      if (!node.wildcard) {
        node.wildcard = { key: "**" };
      }
      node = node.wildcard;
      paramsMap.push([
        -i,
        segment.split(":")[1] || "_",
        segment.length === 2
      ]);
      break;
    }
    if (segment === "*" || segment.includes(":")) {
      if (!node.param) {
        node.param = { key: "*" };
      }
      node = node.param;
      const isOptional = segment === "*";
      paramsMap.push([
        i,
        isOptional ? `_${_unnamedParamIndex++}` : _getParamMatcher(segment),
        isOptional
      ]);
      continue;
    }
    const child = node.static?.[segment];
    if (child) {
      node = child;
    } else {
      const staticNode = { key: segment };
      if (!node.static) {
        node.static = new EmptyObject();
      }
      node.static[segment] = staticNode;
      node = staticNode;
    }
  }
  const hasParams = paramsMap.length > 0;
  if (!node.methods) {
    node.methods = new EmptyObject();
  }
  if (!node.methods[method]) {
    node.methods[method] = [];
  }
  node.methods[method].push({
    data: data || null,
    paramsMap: hasParams ? paramsMap : void 0
  });
  if (!hasParams) {
    ctx.static[path] = node;
  }
}
function _getParamMatcher(segment) {
  if (!segment.includes(":", 1)) {
    return segment.slice(1);
  }
  const regex = segment.replace(/:(\w+)/g, (_, id) => `(?<${id}>\\w+)`);
  return new RegExp(`^${regex}$`);
}

function findRoute(ctx, method = "", path, opts) {
  if (path[path.length - 1] === "/") {
    path = path.slice(0, -1);
  }
  const staticNode = ctx.static[path];
  if (staticNode && staticNode.methods) {
    const staticMatch = staticNode.methods[method] || staticNode.methods[""];
    if (staticMatch !== void 0) {
      return staticMatch[0];
    }
  }
  const segments = splitPath(path);
  const match = _lookupTree(ctx, ctx.root, method, segments, 0)?.[0];
  if (match === void 0) {
    return;
  }
  if (opts?.params === false) {
    return match;
  }
  return {
    data: match.data,
    params: match.paramsMap ? getMatchParams(segments, match.paramsMap) : void 0
  };
}
function _lookupTree(ctx, node, method, segments, index) {
  if (index === segments.length) {
    if (node.methods) {
      const match = node.methods[method] || node.methods[""];
      if (match) {
        return match;
      }
    }
    if (node.param && node.param.methods) {
      const match = node.param.methods[method] || node.param.methods[""];
      if (match) {
        const pMap = match[0].paramsMap;
        if (pMap?.[pMap?.length - 1]?.[2]) {
          return match;
        }
      }
    }
    if (node.wildcard && node.wildcard.methods) {
      const match = node.wildcard.methods[method] || node.wildcard.methods[""];
      if (match) {
        const pMap = match[0].paramsMap;
        if (pMap?.[pMap?.length - 1]?.[2]) {
          return match;
        }
      }
    }
    return void 0;
  }
  const segment = segments[index];
  if (node.static) {
    const staticChild = node.static[segment];
    if (staticChild) {
      const match = _lookupTree(ctx, staticChild, method, segments, index + 1);
      if (match) {
        return match;
      }
    }
  }
  if (node.param) {
    const match = _lookupTree(ctx, node.param, method, segments, index + 1);
    if (match) {
      return match;
    }
  }
  if (node.wildcard && node.wildcard.methods) {
    return node.wildcard.methods[method] || node.wildcard.methods[""];
  }
  return;
}

function removeRoute(ctx, method, path) {
  const segments = splitPath(path);
  return _remove(ctx.root, method || "", segments, 0);
}
function _remove(node, method, segments, index) {
  if (index === segments.length) {
    if (node.methods && method in node.methods) {
      delete node.methods[method];
      if (Object.keys(node.methods).length === 0) {
        node.methods = void 0;
      }
    }
    return;
  }
  const segment = segments[index];
  if (segment === "*") {
    if (node.param) {
      _remove(node.param, method, segments, index + 1);
      if (_isEmptyNode(node.param)) {
        node.param = void 0;
      }
    }
    return;
  }
  if (segment === "**") {
    if (node.wildcard) {
      _remove(node.wildcard, method, segments, index + 1);
      if (_isEmptyNode(node.wildcard)) {
        node.wildcard = void 0;
      }
    }
    return;
  }
  const childNode = node.static?.[segment];
  if (childNode) {
    _remove(childNode, method, segments, index + 1);
    if (_isEmptyNode(childNode)) {
      delete node.static[segment];
      if (Object.keys(node.static).length === 0) {
        node.static = void 0;
      }
    }
  }
}
function _isEmptyNode(node) {
  return node.methods === void 0 && node.static === void 0 && node.param === void 0 && node.wildcard === void 0;
}

function findAllRoutes(ctx, method = "", path, opts) {
  if (path[path.length - 1] === "/") {
    path = path.slice(0, -1);
  }
  const segments = splitPath(path);
  const matches = _findAll(ctx, ctx.root, method, segments, 0);
  if (opts?.params === false) {
    return matches;
  }
  return matches.map((m) => {
    return {
      data: m.data,
      params: m.paramsMap ? getMatchParams(segments, m.paramsMap) : void 0
    };
  });
}
function _findAll(ctx, node, method, segments, index, matches = []) {
  const segment = segments[index];
  if (node.wildcard && node.wildcard.methods) {
    const match = node.wildcard.methods[method] || node.wildcard.methods[""];
    if (match) {
      matches.push(...match);
    }
  }
  if (node.param) {
    _findAll(ctx, node.param, method, segments, index + 1, matches);
    if (index === segments.length && node.param.methods) {
      const match = node.param.methods[method] || node.param.methods[""];
      if (match) {
        matches.push(...match);
      }
    }
  }
  const staticChild = node.static?.[segment];
  if (staticChild) {
    _findAll(ctx, staticChild, method, segments, index + 1, matches);
  }
  if (index === segments.length && node.methods) {
    const match = node.methods[method] || node.methods[""];
    if (match) {
      matches.push(...match);
    }
  }
  return matches;
}

export { addRoute, createRouter, findAllRoutes, findRoute, removeRoute };
