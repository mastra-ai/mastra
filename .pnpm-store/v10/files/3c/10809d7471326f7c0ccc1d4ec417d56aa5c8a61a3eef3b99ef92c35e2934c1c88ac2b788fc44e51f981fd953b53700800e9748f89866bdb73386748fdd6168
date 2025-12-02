'use strict';

var Module = require('module');
var path = require('path');
var ts = require('typescript');
var fs = require('fs');

let LogLevel = /*#__PURE__*/function (LogLevel) {
  LogLevel[LogLevel["None"] = 0] = "None";
  LogLevel[LogLevel["Error"] = 1] = "Error";
  LogLevel[LogLevel["Warning"] = 2] = "Warning";
  LogLevel[LogLevel["Info"] = 3] = "Info";
  LogLevel[LogLevel["Debug"] = 4] = "Debug";
  LogLevel[LogLevel["Trace"] = 5] = "Trace";
  return LogLevel;
}({});
function convertLogLevel(level) {
  switch (level) {
    case "none":
      return LogLevel.None;
    case "error":
      return LogLevel.Error;
    case "warn":
      return LogLevel.Warning;
    case "info":
      return LogLevel.Info;
    case "debug":
      return LogLevel.Debug;
    case "trace":
      return LogLevel.Trace;
    default:
      return undefined;
  }
}
const Reset = "\x1b[0m";
const FgRed = "\x1b[31m";
const FgYellow = "\x1b[33m";
const FgBlue = "\x1b[34m";
const FgCyan = "\x1b[36m";
const FgMagenta = "\x1b[35m";
function fromTYPESCRIPT_PATHS_LOG_LEVEL() {
  const env = process.env["TYPESCRIPT_PATHS_LOG_LEVEL"];
  switch (env) {
    case "none":
      return LogLevel.None;
    case "error":
      return LogLevel.Error;
    case "warn":
      return LogLevel.Warning;
    case "info":
      return LogLevel.Info;
    case "debug":
      return LogLevel.Debug;
    case "trace":
      return LogLevel.Trace;
    default:
      return undefined;
  }
}
function createLogger({
  logLevel = fromTYPESCRIPT_PATHS_LOG_LEVEL() || LogLevel.Info,
  colors = true,
  ID = "typescript-paths"
} = {}) {
  return function log(level, ...args) {
    if (logLevel < level) {
      return;
    }
    if (ID) {
      args.unshift(`[${ID}]:`);
    }
    if (colors) {
      args = args.map(a => {
        if (typeof a !== "string") return a;
        switch (level) {
          case LogLevel.Error:
            return FgRed + a + Reset;
          case LogLevel.Warning:
            return FgYellow + a + Reset;
          case LogLevel.Info:
            return FgBlue + a + Reset;
          case LogLevel.Debug:
            return FgCyan + a + Reset;
          case LogLevel.Trace:
            return FgMagenta + a + Reset;
        }
      });
    }
    switch (level) {
      case LogLevel.Error:
        console.error(...args);
        break;
      case LogLevel.Warning:
        console.warn(...args);
        break;
      case LogLevel.Info:
        console.info(...args);
        break;
      case LogLevel.Debug:
        console.log(...args);
        break;
      case LogLevel.Trace:
        console.log(...args);
        break;
    }
  };
}

function getTsConfig({
  tsConfigPath,
  log = createLogger(),
  host = ts.sys
}) {
  const {
    error,
    config
  } = ts.readConfigFile(tsConfigPath, host.readFile);
  if (error) {
    let hasError = false;
    switch (error.category) {
      case ts.DiagnosticCategory.Error:
        log(LogLevel.Error, error.messageText);
        hasError = true;
        break;
    }
    if (hasError) return undefined;
  }
  let {
    options: compilerOptions,
    errors,
    fileNames,
    projectReferences
  } = ts.parseJsonConfigFileContent(config, host, path.resolve(path.dirname(tsConfigPath)));
  if (errors.length > 0) {
    let hasError = false;
    for (const error of errors) {
      switch (error.category) {
        case ts.DiagnosticCategory.Error:
          log(LogLevel.Error, error.messageText);
          hasError = true;
          break;
      }
    }
    if (hasError) return undefined;
  }
  const ret = {
    filePath: path.resolve(tsConfigPath),
    compilerOptions,
    fileNames: fileNames.map(path.normalize),
    extends: config.extends
  };
  if (projectReferences) {
    ret.references = [];
    for (const r of projectReferences) {
      let tsConfigPath = r.path;
      try {
        const stat = fs.lstatSync(tsConfigPath);
        if (stat.isDirectory()) {
          tsConfigPath = path.join(tsConfigPath, "tsconfig.json");
        }
      } catch (err) {
        const error = err;
        log(LogLevel.Error, error.message);
        return undefined;
      }
      const cfg = getTsConfig({
        tsConfigPath,
        log,
        host
      });
      if (cfg) ret.references.push(cfg);
    }
  }
  return ret;
}
function createMappings({
  paths,
  log = createLogger(),
  respectCoreModule = true
}) {
  const countWildcard = value => value.match(/\*/g)?.length ?? 0;
  const mappings = [];
  for (const pattern of Object.keys(paths)) {
    if (countWildcard(pattern) > 1) {
      log(LogLevel.Warning, `Pattern '${pattern}' can have at most one '*' character.`);
      continue;
    }
    const wildcard = pattern.indexOf("*");
    if (respectCoreModule) {
      let skip = false;
      for (const key of Module.builtinModules) {
        if (pattern === key || pattern.startsWith(key + "/")) {
          log(LogLevel.Warning, `path pattern '${pattern}' is ignored.`);
          log(LogLevel.Info, `respect core module '${key}'.`);
          skip = true;
        }
      }
      if (skip) continue;
    }
    const targets = paths[pattern].filter(target => {
      if (countWildcard(target) > 1) {
        log(LogLevel.Warning, `Substitution '${target}' in pattern '${pattern}' can have at most one '*' character.`);
        return false;
      }
      return true;
    });
    if (targets.length === 0) {
      continue;
    }
    if (pattern === "*") {
      mappings.push({
        wildcard: true,
        pattern,
        prefix: "",
        suffix: "",
        targets
      });
      continue;
    }
    mappings.push({
      wildcard: wildcard !== -1,
      pattern,
      prefix: pattern.substring(0, wildcard),
      suffix: pattern.substring(wildcard + 1),
      targets
    });
  }
  for (const mapping of mappings) {
    log(LogLevel.Debug, `pattern: '${mapping.pattern}' targets: '${mapping.targets}'`);
  }
  return mappings;
}
function isPatternMatch(prefix, suffix, candidate) {
  return candidate.length >= prefix.length + suffix.length && candidate.startsWith(prefix) && candidate.endsWith(suffix);
}
function findMatch(moduleName, mappings) {
  let longestMatchedPrefixLength = -1;
  let matched;
  for (const mapping of mappings) {
    const {
      wildcard,
      prefix,
      suffix,
      pattern
    } = mapping;
    if (wildcard && isPatternMatch(prefix, suffix, moduleName)) {
      if (longestMatchedPrefixLength < prefix.length) {
        longestMatchedPrefixLength = prefix.length;
        matched = mapping;
      }
    } else if (moduleName === pattern) {
      matched = mapping;
      break;
    }
  }
  return matched;
}
function resolveModuleName({
  mappings,
  request,
  importer,
  compilerOptions,
  host,
  falllback
}) {
  const matched = findMatch(request, mappings);
  if (!matched) {
    return undefined;
  }
  const matchedWildcard = request.slice(matched.prefix.length, request.length - matched.suffix.length);
  for (const target of matched.targets) {
    const updated = matched.wildcard ? target.replace("*", matchedWildcard) : target;
    const base = compilerOptions.baseUrl ?? compilerOptions.pathsBasePath;
    const moduleName = path.resolve(base, updated);
    const ext = path.extname(moduleName);
    switch (ext) {
      case ".ts":
      case ".tsx":
      case ".json":
        return moduleName;
      case ".js":
      case ".jsx":
        if (compilerOptions.module === ts.ModuleKind.NodeNext) {
          break;
        }
        return moduleName;
    }
    const result = ts.resolveModuleName(moduleName, importer, compilerOptions, host);
    if (result?.resolvedModule) {
      return path.normalize(result.resolvedModule.resolvedFileName);
    }
    if (falllback?.(moduleName)) return moduleName;
  }
  return undefined;
}

function fromTS_NODE_PROJECT() {
  const env = process.env["TS_NODE_PROJECT"];
  if (env) return env.split(path.delimiter).filter(Boolean);
  return undefined;
}
function createHandler({
  searchPath,
  tsConfigPath = fromTS_NODE_PROJECT(),
  respectCoreModule = true,
  log = createLogger(),
  falllback
} = {}) {
  if (!tsConfigPath) {
    if (searchPath && searchPath instanceof Array) {
      tsConfigPath = searchPath.map(p => ts.findConfigFile(p, ts.sys.fileExists)).filter(v => Boolean(v));
    } else {
      tsConfigPath = ts.findConfigFile(searchPath || ts.sys.getCurrentDirectory(), ts.sys.fileExists) || [];
    }
  }
  const host = {
    ...ts.sys,
    fileExists(filename) {
      if (filename.endsWith(ts.Extension.Dts)) return false;
      return ts.sys.fileExists(filename);
    }
  };
  const services = [];
  const configs = spreadTsConfig(tsConfigPath);
  if (!configs) {
    // can't read tsconfig files
    return undefined;
  }
  for (const config of configs) {
    addServices(config);
  }
  return (request, importer) => services.reduce((result, srv) => {
    if (result) {
      return result;
    }
    const {
      compilerOptions,
      cache,
      fileNames,
      mappings
    } = srv;
    const exist = cache.get(importer);
    if (exist !== undefined) {
      cache.delete(importer);
      cache.set(importer, exist);
      if (!exist) return undefined;
    } else if (fileNames.indexOf(importer) === -1) {
      if (cache.size === 1 << 8) cache.delete(cache.keys().next().value);
      cache.set(importer, false);
      return undefined;
    } else {
      if (cache.size === 1 << 8) cache.delete(cache.keys().next().value);
      cache.set(importer, true);
    }
    return resolveModuleName({
      compilerOptions,
      host,
      importer,
      request,
      mappings,
      falllback
    });
  }, undefined);
  function addServices(config) {
    const {
      compilerOptions,
      fileNames,
      references
    } = config;
    if (!compilerOptions.paths || compilerOptions.paths instanceof Array) return;
    services.push({
      compilerOptions,
      fileNames,
      mappings: createMappings({
        log,
        respectCoreModule,
        paths: compilerOptions.paths
      }),
      cache: new Map()
    });
    if (references) {
      for (const config of references) {
        addServices(config);
      }
    }
  }
  function spreadTsConfig(tsConfigPath) {
    if (typeof tsConfigPath === "string") {
      tsConfigPath = [tsConfigPath];
    } else if (!(tsConfigPath instanceof Array)) {
      tsConfigPath = [tsConfigPath];
    }
    const configs = [];
    for (const configPayloadOrPath of tsConfigPath) {
      if (typeof configPayloadOrPath === "string") {
        log(LogLevel.Trace, `loading: ${configPayloadOrPath}`);
      }
      const config = typeof configPayloadOrPath === "string" ? getTsConfig({
        tsConfigPath: configPayloadOrPath,
        host: ts.sys,
        log
      }) : configPayloadOrPath;
      if (!config) {
        return undefined;
      }
      configs.push(config);
    }

    // const resolvedConfigs = configs
    // 	.map(c => {
    // 		if (c.filePath && c.extends) {
    // 			let tsconfigPath = path.join(path.dirname(c.filePath), c.extends)
    // 			if (!tsconfigPath.endsWith(".json")) {
    // 				tsconfigPath = tsconfigPath + ".json"
    // 			}
    // 			const exts = spreadTsConfig(tsconfigPath)
    // 			if (exts) {
    // 				return [c, ...exts]
    // 			}
    // 		}
    // 		return c
    // 	})
    // 	.flat()
    // for (const v of resolvedConfigs) {
    // 	if (v == undefined) {
    // 		return undefined
    // 	}
    // }

    return configs;
  }
}

function register({
  tsConfigPath,
  respectCoreModule,
  logLevel,
  colors,
  loggerID,
  falllback
} = {}) {
  const log = createLogger({
    logLevel: convertLogLevel(logLevel),
    colors,
    ID: loggerID
  });
  const handler = createHandler({
    tsConfigPath,
    respectCoreModule,
    log,
    falllback
  });
  if (!handler) {
    return () => {};
  }
  const originalResolveFilename = Module["_resolveFilename"];
  Module["_resolveFilename"] = function (request, parent, ...args) {
    if (!parent) return originalResolveFilename.apply(this, arguments);
    const moduleName = handler(request, parent.filename);
    if (moduleName) {
      log(LogLevel.Debug, `${request} -> ${moduleName}`);
      return originalResolveFilename.apply(this, [moduleName, parent, ...args]);
    }
    return originalResolveFilename.apply(this, arguments);
  };
  return () => {
    Module["_resolveFilename"] = originalResolveFilename;
  };
}

exports.LogLevel = LogLevel;
exports.convertLogLevel = convertLogLevel;
exports.createHandler = createHandler;
exports.createLogger = createLogger;
exports.createMappings = createMappings;
exports.findMatch = findMatch;
exports.fromTS_NODE_PROJECT = fromTS_NODE_PROJECT;
exports.fromTYPESCRIPT_PATHS_LOG_LEVEL = fromTYPESCRIPT_PATHS_LOG_LEVEL;
exports.getTsConfig = getTsConfig;
exports.isPatternMatch = isPatternMatch;
exports.register = register;
exports.resolveModuleName = resolveModuleName;
