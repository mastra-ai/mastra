"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/.pnpm/clone@2.1.2/node_modules/clone/clone.js
var require_clone = __commonJS({
  "node_modules/.pnpm/clone@2.1.2/node_modules/clone/clone.js"(exports2, module2) {
    "use strict";
    var clone2 = function() {
      "use strict";
      function _instanceof(obj, type) {
        return type != null && obj instanceof type;
      }
      var nativeMap;
      try {
        nativeMap = Map;
      } catch (_) {
        nativeMap = function() {
        };
      }
      var nativeSet;
      try {
        nativeSet = Set;
      } catch (_) {
        nativeSet = function() {
        };
      }
      var nativePromise;
      try {
        nativePromise = Promise;
      } catch (_) {
        nativePromise = function() {
        };
      }
      function clone3(parent, circular, depth, prototype, includeNonEnumerable) {
        if (typeof circular === "object") {
          depth = circular.depth;
          prototype = circular.prototype;
          includeNonEnumerable = circular.includeNonEnumerable;
          circular = circular.circular;
        }
        var allParents = [];
        var allChildren = [];
        var useBuffer = typeof Buffer != "undefined";
        if (typeof circular == "undefined")
          circular = true;
        if (typeof depth == "undefined")
          depth = Infinity;
        function _clone(parent2, depth2) {
          if (parent2 === null)
            return null;
          if (depth2 === 0)
            return parent2;
          var child;
          var proto;
          if (typeof parent2 != "object") {
            return parent2;
          }
          if (_instanceof(parent2, nativeMap)) {
            child = new nativeMap();
          } else if (_instanceof(parent2, nativeSet)) {
            child = new nativeSet();
          } else if (_instanceof(parent2, nativePromise)) {
            child = new nativePromise(function(resolve, reject) {
              parent2.then(function(value) {
                resolve(_clone(value, depth2 - 1));
              }, function(err) {
                reject(_clone(err, depth2 - 1));
              });
            });
          } else if (clone3.__isArray(parent2)) {
            child = [];
          } else if (clone3.__isRegExp(parent2)) {
            child = new RegExp(parent2.source, __getRegExpFlags(parent2));
            if (parent2.lastIndex) child.lastIndex = parent2.lastIndex;
          } else if (clone3.__isDate(parent2)) {
            child = new Date(parent2.getTime());
          } else if (useBuffer && Buffer.isBuffer(parent2)) {
            if (Buffer.allocUnsafe) {
              child = Buffer.allocUnsafe(parent2.length);
            } else {
              child = new Buffer(parent2.length);
            }
            parent2.copy(child);
            return child;
          } else if (_instanceof(parent2, Error)) {
            child = Object.create(parent2);
          } else {
            if (typeof prototype == "undefined") {
              proto = Object.getPrototypeOf(parent2);
              child = Object.create(proto);
            } else {
              child = Object.create(prototype);
              proto = prototype;
            }
          }
          if (circular) {
            var index = allParents.indexOf(parent2);
            if (index != -1) {
              return allChildren[index];
            }
            allParents.push(parent2);
            allChildren.push(child);
          }
          if (_instanceof(parent2, nativeMap)) {
            parent2.forEach(function(value, key) {
              var keyChild = _clone(key, depth2 - 1);
              var valueChild = _clone(value, depth2 - 1);
              child.set(keyChild, valueChild);
            });
          }
          if (_instanceof(parent2, nativeSet)) {
            parent2.forEach(function(value) {
              var entryChild = _clone(value, depth2 - 1);
              child.add(entryChild);
            });
          }
          for (var i in parent2) {
            var attrs;
            if (proto) {
              attrs = Object.getOwnPropertyDescriptor(proto, i);
            }
            if (attrs && attrs.set == null) {
              continue;
            }
            child[i] = _clone(parent2[i], depth2 - 1);
          }
          if (Object.getOwnPropertySymbols) {
            var symbols = Object.getOwnPropertySymbols(parent2);
            for (var i = 0; i < symbols.length; i++) {
              var symbol = symbols[i];
              var descriptor = Object.getOwnPropertyDescriptor(parent2, symbol);
              if (descriptor && !descriptor.enumerable && !includeNonEnumerable) {
                continue;
              }
              child[symbol] = _clone(parent2[symbol], depth2 - 1);
              if (!descriptor.enumerable) {
                Object.defineProperty(child, symbol, {
                  enumerable: false
                });
              }
            }
          }
          if (includeNonEnumerable) {
            var allPropertyNames = Object.getOwnPropertyNames(parent2);
            for (var i = 0; i < allPropertyNames.length; i++) {
              var propertyName = allPropertyNames[i];
              var descriptor = Object.getOwnPropertyDescriptor(parent2, propertyName);
              if (descriptor && descriptor.enumerable) {
                continue;
              }
              child[propertyName] = _clone(parent2[propertyName], depth2 - 1);
              Object.defineProperty(child, propertyName, {
                enumerable: false
              });
            }
          }
          return child;
        }
        return _clone(parent, depth);
      }
      clone3.clonePrototype = function clonePrototype(parent) {
        if (parent === null)
          return null;
        var c = function() {
        };
        c.prototype = parent;
        return new c();
      };
      function __objToStr(o) {
        return Object.prototype.toString.call(o);
      }
      clone3.__objToStr = __objToStr;
      function __isDate(o) {
        return typeof o === "object" && __objToStr(o) === "[object Date]";
      }
      clone3.__isDate = __isDate;
      function __isArray(o) {
        return typeof o === "object" && __objToStr(o) === "[object Array]";
      }
      clone3.__isArray = __isArray;
      function __isRegExp(o) {
        return typeof o === "object" && __objToStr(o) === "[object RegExp]";
      }
      clone3.__isRegExp = __isRegExp;
      function __getRegExpFlags(re) {
        var flags = "";
        if (re.global) flags += "g";
        if (re.ignoreCase) flags += "i";
        if (re.multiline) flags += "m";
        return flags;
      }
      clone3.__getRegExpFlags = __getRegExpFlags;
      return clone3;
    }();
    if (typeof module2 === "object" && module2.exports) {
      module2.exports = clone2;
    }
  }
});

// node_modules/.pnpm/shell-quote@1.8.1/node_modules/shell-quote/quote.js
var require_quote = __commonJS({
  "node_modules/.pnpm/shell-quote@1.8.1/node_modules/shell-quote/quote.js"(exports2, module2) {
    "use strict";
    module2.exports = function quote(xs) {
      return xs.map(function(s) {
        if (s && typeof s === "object") {
          return s.op.replace(/(.)/g, "\\$1");
        }
        if (/["\s]/.test(s) && !/'/.test(s)) {
          return "'" + s.replace(/(['\\])/g, "\\$1") + "'";
        }
        if (/["'\s]/.test(s)) {
          return '"' + s.replace(/(["\\$`!])/g, "\\$1") + '"';
        }
        return String(s).replace(/([A-Za-z]:)?([#!"$&'()*,:;<=>?@[\\\]^`{|}])/g, "$1\\$2");
      }).join(" ");
    };
  }
});

// node_modules/.pnpm/shell-quote@1.8.1/node_modules/shell-quote/parse.js
var require_parse = __commonJS({
  "node_modules/.pnpm/shell-quote@1.8.1/node_modules/shell-quote/parse.js"(exports2, module2) {
    "use strict";
    var CONTROL = "(?:" + [
      "\\|\\|",
      "\\&\\&",
      ";;",
      "\\|\\&",
      "\\<\\(",
      "\\<\\<\\<",
      ">>",
      ">\\&",
      "<\\&",
      "[&;()|<>]"
    ].join("|") + ")";
    var controlRE = new RegExp("^" + CONTROL + "$");
    var META = "|&;()<> \\t";
    var SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
    var DOUBLE_QUOTE = "'((\\\\'|[^'])*?)'";
    var hash = /^#$/;
    var SQ = "'";
    var DQ = '"';
    var DS = "$";
    var TOKEN = "";
    var mult = 4294967296;
    for (i = 0; i < 4; i++) {
      TOKEN += (mult * Math.random()).toString(16);
    }
    var i;
    var startsWithToken = new RegExp("^" + TOKEN);
    function matchAll(s, r) {
      var origIndex = r.lastIndex;
      var matches = [];
      var matchObj;
      while (matchObj = r.exec(s)) {
        matches.push(matchObj);
        if (r.lastIndex === matchObj.index) {
          r.lastIndex += 1;
        }
      }
      r.lastIndex = origIndex;
      return matches;
    }
    function getVar(env, pre, key) {
      var r = typeof env === "function" ? env(key) : env[key];
      if (typeof r === "undefined" && key != "") {
        r = "";
      } else if (typeof r === "undefined") {
        r = "$";
      }
      if (typeof r === "object") {
        return pre + TOKEN + JSON.stringify(r) + TOKEN;
      }
      return pre + r;
    }
    function parseInternal(string2, env, opts) {
      if (!opts) {
        opts = {};
      }
      var BS = opts.escape || "\\";
      var BAREWORD = "(\\" + BS + `['"` + META + `]|[^\\s'"` + META + "])+";
      var chunker = new RegExp([
        "(" + CONTROL + ")",
        // control chars
        "(" + BAREWORD + "|" + SINGLE_QUOTE + "|" + DOUBLE_QUOTE + ")+"
      ].join("|"), "g");
      var matches = matchAll(string2, chunker);
      if (matches.length === 0) {
        return [];
      }
      if (!env) {
        env = {};
      }
      var commented = false;
      return matches.map(function(match) {
        var s = match[0];
        if (!s || commented) {
          return void 0;
        }
        if (controlRE.test(s)) {
          return { op: s };
        }
        var quote = false;
        var esc = false;
        var out = "";
        var isGlob = false;
        var i2;
        function parseEnvVar() {
          i2 += 1;
          var varend;
          var varname;
          var char = s.charAt(i2);
          if (char === "{") {
            i2 += 1;
            if (s.charAt(i2) === "}") {
              throw new Error("Bad substitution: " + s.slice(i2 - 2, i2 + 1));
            }
            varend = s.indexOf("}", i2);
            if (varend < 0) {
              throw new Error("Bad substitution: " + s.slice(i2));
            }
            varname = s.slice(i2, varend);
            i2 = varend;
          } else if (/[*@#?$!_-]/.test(char)) {
            varname = char;
            i2 += 1;
          } else {
            var slicedFromI = s.slice(i2);
            varend = slicedFromI.match(/[^\w\d_]/);
            if (!varend) {
              varname = slicedFromI;
              i2 = s.length;
            } else {
              varname = slicedFromI.slice(0, varend.index);
              i2 += varend.index - 1;
            }
          }
          return getVar(env, "", varname);
        }
        for (i2 = 0; i2 < s.length; i2++) {
          var c = s.charAt(i2);
          isGlob = isGlob || !quote && (c === "*" || c === "?");
          if (esc) {
            out += c;
            esc = false;
          } else if (quote) {
            if (c === quote) {
              quote = false;
            } else if (quote == SQ) {
              out += c;
            } else {
              if (c === BS) {
                i2 += 1;
                c = s.charAt(i2);
                if (c === DQ || c === BS || c === DS) {
                  out += c;
                } else {
                  out += BS + c;
                }
              } else if (c === DS) {
                out += parseEnvVar();
              } else {
                out += c;
              }
            }
          } else if (c === DQ || c === SQ) {
            quote = c;
          } else if (controlRE.test(c)) {
            return { op: s };
          } else if (hash.test(c)) {
            commented = true;
            var commentObj = { comment: string2.slice(match.index + i2 + 1) };
            if (out.length) {
              return [out, commentObj];
            }
            return [commentObj];
          } else if (c === BS) {
            esc = true;
          } else if (c === DS) {
            out += parseEnvVar();
          } else {
            out += c;
          }
        }
        if (isGlob) {
          return { op: "glob", pattern: out };
        }
        return out;
      }).reduce(function(prev, arg) {
        return typeof arg === "undefined" ? prev : prev.concat(arg);
      }, []);
    }
    module2.exports = function parse(s, env, opts) {
      var mapped = parseInternal(s, env, opts);
      if (typeof env !== "function") {
        return mapped;
      }
      return mapped.reduce(function(acc, s2) {
        if (typeof s2 === "object") {
          return acc.concat(s2);
        }
        var xs = s2.split(RegExp("(" + TOKEN + ".*?" + TOKEN + ")", "g"));
        if (xs.length === 1) {
          return acc.concat(xs[0]);
        }
        return acc.concat(xs.filter(Boolean).map(function(x) {
          if (startsWithToken.test(x)) {
            return JSON.parse(x.split(TOKEN)[1]);
          }
          return x;
        }));
      }, []);
    };
  }
});

// node_modules/.pnpm/shell-quote@1.8.1/node_modules/shell-quote/index.js
var require_shell_quote = __commonJS({
  "node_modules/.pnpm/shell-quote@1.8.1/node_modules/shell-quote/index.js"(exports2) {
    "use strict";
    exports2.quote = require_quote();
    exports2.parse = require_parse();
  }
});

// src/index.ts
var src_exports = {};
__export(src_exports, {
  BroCliError: () => BroCliError,
  boolean: () => boolean,
  command: () => command2,
  commandsInfo: () => commandsInfo,
  getCommandNameWithParents: () => getCommandNameWithParents,
  handler: () => handler,
  number: () => number,
  positional: () => positional,
  run: () => run,
  string: () => string,
  test: () => test
});
module.exports = __toCommonJS(src_exports);

// src/brocli-error.ts
var BroCliError = class extends Error {
  constructor(message, event) {
    const errPrefix = "BroCli error: ";
    super(message === void 0 ? message : `${errPrefix}${message}`);
    this.event = event;
  }
};

// src/command-core.ts
var import_clone = __toESM(require_clone(), 1);

// src/event-handler.ts
var getOptionTypeText = (option) => {
  let result = "";
  switch (option.type) {
    case "boolean":
      result = "";
      break;
    case "number": {
      if ((option.minVal ?? option.maxVal) !== void 0) {
        let text = "";
        if (option.isInt) text = text + `integer `;
        if (option.minVal !== void 0) text = text + `[${option.minVal};`;
        else text = text + `(\u221E;`;
        if (option.maxVal !== void 0) text = text + `${option.maxVal}]`;
        else text = text + `\u221E)`;
        result = text;
        break;
      }
      if (option.isInt) {
        result = "integer";
        break;
      }
      result = "number";
      break;
    }
    case "string": {
      if (option.enumVals) {
        result = "[ " + option.enumVals.join(" | ") + " ]";
        break;
      }
      result = "string";
      break;
    }
    case "positional": {
      result = `${option.isRequired ? "<" : "["}${option.enumVals ? option.enumVals.join("|") : option.name}${option.isRequired ? ">" : "]"}`;
      break;
    }
  }
  if (option.isRequired && option.type !== "positional") result = "!" + result.length ? " " : "" + result;
  return result;
};
var defaultEventHandler = async (event) => {
  switch (event.type) {
    case "command_help": {
      const command3 = event.command;
      const commandName = getCommandNameWithParents(command3);
      const cliName = event.name;
      const desc = command3.desc ?? command3.shortDesc;
      const subs = command3.subcommands?.filter((s) => !s.hidden);
      const subcommands = subs && subs.length ? subs : void 0;
      if (desc !== void 0) {
        console.log(`
${desc}`);
      }
      const opts = Object.values(command3.options ?? {}).filter(
        (opt) => !opt.config.isHidden
      );
      const positionals = opts.filter((opt) => opt.config.type === "positional");
      const options = opts.filter((opt) => opt.config.type !== "positional");
      console.log("\nUsage:");
      if (command3.handler) {
        console.log(
          `  ${cliName ? cliName + " " : ""}${commandName}${positionals.length ? " " + positionals.map(({ config: p }) => getOptionTypeText(p)).join(" ") : ""} [flags]`
        );
      } else console.log(`  ${cliName ? cliName + " " : ""}${commandName} [command]`);
      if (command3.aliases) {
        console.log(`
Aliases:`);
        console.log(`  ${[command3.name, ...command3.aliases].join(", ")}`);
      }
      if (subcommands) {
        console.log("\nAvailable Commands:");
        const padding = 3;
        const maxLength = subcommands.reduce((p, e) => e.name.length > p ? e.name.length : p, 0);
        const paddedLength = maxLength + padding;
        const preDescPad = 2 + paddedLength;
        const data = subcommands.map(
          (s) => `  ${s.name.padEnd(paddedLength)}${(() => {
            const description = s.shortDesc ?? s.desc;
            if (!description?.length) return "";
            const split = description.split("\n");
            const first = split.shift();
            const final = [first, ...split.map((s2) => "".padEnd(preDescPad) + s2)].join("\n");
            return final;
          })()}`
        ).join("\n");
        console.log(data);
      }
      if (options.length) {
        const aliasLength = options.reduce((p, e) => {
          const currentLength = e.config.aliases.reduce((pa, a) => pa + a.length, 0) + (e.config.aliases.length - 1) * 2 + 1;
          return currentLength > p ? currentLength : p;
        }, 0);
        const paddedAliasLength = aliasLength > 0 ? aliasLength + 1 : 0;
        const nameLength = options.reduce((p, e) => {
          const typeLen = getOptionTypeText(e.config).length;
          const length = typeLen > 0 ? e.config.name.length + 1 + typeLen : e.config.name.length;
          return length > p ? length : p;
        }, 0) + 3;
        const preDescPad = paddedAliasLength + nameLength + 2;
        const data = options.map(
          ({ config: opt }) => `  ${`${opt.aliases.length ? opt.aliases.join(", ") + "," : ""}`.padEnd(paddedAliasLength)}${`${opt.name}${(() => {
            const typeText = getOptionTypeText(opt);
            return typeText.length ? " " + typeText : "";
          })()}`.padEnd(nameLength)}${(() => {
            if (!opt.description?.length) {
              return opt.default !== void 0 ? `default: ${JSON.stringify(opt.default)}` : "";
            }
            const split = opt.description.split("\n");
            const first = split.shift();
            const def = opt.default !== void 0 ? ` (default: ${JSON.stringify(opt.default)})` : "";
            const final = [first, ...split.map((s) => "".padEnd(preDescPad) + s)].join("\n") + def;
            return final;
          })()}`
        ).join("\n");
        console.log("\nFlags:");
        console.log(data);
      }
      console.log("\nGlobal flags:");
      console.log(`  -h, --help      help for ${commandName}`);
      console.log(`  -v, --version   version${cliName ? ` for ${cliName}` : ""}`);
      if (subcommands) {
        console.log(
          `
Use "${cliName ? cliName + " " : ""}${commandName} [command] --help" for more information about a command.
`
        );
      }
      return true;
    }
    case "global_help": {
      const cliName = event.name;
      const desc = event.description;
      const commands = event.commands.filter((c) => !c.hidden);
      if (desc !== void 0) {
        console.log(`${desc}
`);
      }
      console.log("Usage:");
      console.log(`  ${cliName ? cliName + " " : ""}[command]`);
      if (commands.length) {
        console.log("\nAvailable Commands:");
        const padding = 3;
        const maxLength = commands.reduce((p, e) => e.name.length > p ? e.name.length : p, 0);
        const paddedLength = maxLength + padding;
        const data = commands.map(
          (c) => `  ${c.name.padEnd(paddedLength)}${(() => {
            const desc2 = c.shortDesc ?? c.desc;
            if (!desc2?.length) return "";
            const split = desc2.split("\n");
            const first = split.shift();
            const final = [first, ...split.map((s) => "".padEnd(paddedLength + 2) + s)].join("\n");
            return final;
          })()}`
        ).join("\n");
        console.log(data);
      } else {
        console.log("\nNo available commands.");
      }
      console.log("\nFlags:");
      console.log(`  -h, --help      help${cliName ? ` for ${cliName}` : ""}`);
      console.log(`  -v, --version   version${cliName ? ` for ${cliName}` : ""}`);
      console.log("\n");
      return true;
    }
    case "version": {
      return true;
    }
    case "error": {
      let msg;
      switch (event.violation) {
        case "above_max": {
          const matchedName = event.offender.namePart;
          const data = event.offender.dataPart;
          const option = event.option;
          const max = option.maxVal;
          msg = `Invalid value: number type argument '${matchedName}' expects maximal value of ${max} as an input, got: ${data}`;
          break;
        }
        case "below_min": {
          const matchedName = event.offender.namePart;
          const data = event.offender.dataPart;
          const option = event.option;
          const min = option.minVal;
          msg = `Invalid value: number type argument '${matchedName}' expects minimal value of ${min} as an input, got: ${data}`;
          break;
        }
        case "expected_int": {
          const matchedName = event.offender.namePart;
          const data = event.offender.dataPart;
          msg = `Invalid value: number type argument '${matchedName}' expects an integer as an input, got: ${data}`;
          break;
        }
        case "invalid_boolean_syntax": {
          const matchedName = event.offender.namePart;
          const data = event.offender.dataPart;
          msg = `Invalid syntax: boolean type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value> | ${matchedName}.
Allowed values: true, false, 0, 1`;
          break;
        }
        case "invalid_string_syntax": {
          const matchedName = event.offender.namePart;
          msg = `Invalid syntax: string type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value>`;
          break;
        }
        case "invalid_number_syntax": {
          const matchedName = event.offender.namePart;
          msg = `Invalid syntax: number type argument '${matchedName}' must have it's value passed in the following formats: ${matchedName}=<value> | ${matchedName} <value>`;
          break;
        }
        case "invalid_number_value": {
          const matchedName = event.offender.namePart;
          const data = event.offender.dataPart;
          msg = `Invalid value: number type argument '${matchedName}' expects a number as an input, got: ${data}`;
          break;
        }
        case "enum_violation": {
          const matchedName = event.offender.namePart;
          const data = event.offender.dataPart;
          const option = event.option;
          const values = option.enumVals;
          msg = option.type === "positional" ? `Invalid value: value for the positional argument '${option.name}' must be either one of the following: ${values.join(", ")}; Received: ${data}` : `Invalid value: value for the argument '${matchedName}' must be either one of the following: ${values.join(", ")}; Received: ${data}`;
          break;
        }
        case "unknown_command_error": {
          const msg2 = `Unknown command: '${event.offender}'.
Type '--help' to get help on the cli.`;
          console.error(msg2);
          return true;
        }
        case "unknown_subcommand_error": {
          const cName = getCommandNameWithParents(event.command);
          const msg2 = `Unknown command: ${cName} ${event.offender}.
Type '${cName} --help' to get the help on command.`;
          console.error(msg2);
          return true;
        }
        case "missing_args_error": {
          const { missing: missingOpts, command: command3 } = event;
          msg = `Command '${command3.name}' is missing following required options: ${missingOpts.map((opt) => {
            const name = opt.shift();
            const aliases = opt;
            if (aliases.length) return `${name} [${aliases.join(", ")}]`;
            return name;
          }).join(", ")}`;
          break;
        }
        case "unrecognized_args_error": {
          const { command: command3, unrecognized } = event;
          msg = `Unrecognized options for command '${command3.name}': ${unrecognized.join(", ")}`;
          break;
        }
        case "unknown_error": {
          const e = event.error;
          console.error(typeof e === "object" && e !== null && "message" in e ? e.message : e);
          return true;
        }
      }
      console.error(msg);
      return true;
    }
  }
  return false;
};
var eventHandlerWrapper = (customEventHandler) => async (event) => await customEventHandler(event) ? true : await defaultEventHandler(event);

// src/util.ts
var import_shell_quote = __toESM(require_shell_quote(), 1);
function isInt(value) {
  return value === Math.floor(value);
}
var shellArgs = (str) => (0, import_shell_quote.parse)(str).map((e) => e.toString());
var executeOrLog = async (target) => typeof target === "string" ? console.log(target) : target ? await target() : void 0;

// src/command-core.ts
var generatePrefix = (name) => name.startsWith("-") ? name : name.length > 1 ? `--${name}` : `-${name}`;
var validateOptions = (config) => {
  const cloned = (0, import_clone.default)(config);
  const entries = [];
  const storedNames = [];
  const cfgEntries = Object.entries(cloned);
  for (const [key, value] of cfgEntries) {
    const cfg = value._.config;
    if (cfg.name === void 0) cfg.name = key;
    if (cfg.type === "positional") continue;
    if (cfg.name.includes("=")) {
      throw new BroCliError(
        `Can't define option '${generatePrefix(cfg.name)}' - option names and aliases cannot contain '='!`
      );
    }
    for (const alias of cfg.aliases) {
      if (alias.includes("=")) {
        throw new BroCliError(
          `Can't define option '${generatePrefix(cfg.name)}' - option names and aliases cannot contain '='!`
        );
      }
    }
    cfg.name = generatePrefix(cfg.name);
    cfg.aliases = cfg.aliases.map((a) => generatePrefix(a));
  }
  for (const [key, value] of cfgEntries) {
    const cfg = value._.config;
    if (cfg.type === "positional") {
      entries.push([key, { config: cfg, $output: void 0 }]);
      continue;
    }
    const reservedNames = ["--help", "-h", "--version", "-v"];
    const allNames = [cfg.name, ...cfg.aliases];
    for (const name of allNames) {
      const match = reservedNames.find((n) => n === name);
      if (match) throw new BroCliError(`Can't define option '${cfg.name}' - name '${match}' is reserved!`);
    }
    for (const storage of storedNames) {
      const nameOccupier = storage.find((e) => e === cfg.name);
      if (!nameOccupier) continue;
      throw new BroCliError(
        `Can't define option '${cfg.name}' - name is already in use by option '${storage[0]}'!`
      );
    }
    for (const alias of cfg.aliases) {
      for (const storage of storedNames) {
        const nameOccupier = storage.find((e) => e === alias);
        if (!nameOccupier) continue;
        throw new BroCliError(
          `Can't define option '${cfg.name}' - alias '${alias}' is already in use by option '${storage[0]}'!`
        );
      }
    }
    const currentNames = [cfg.name, ...cfg.aliases];
    storedNames.push(currentNames);
    currentNames.forEach((name, idx) => {
      if (currentNames.findIndex((e) => e === name) === idx) return;
      throw new BroCliError(
        `Can't define option '${cfg.name}' - duplicate alias '${name}'!`
      );
    });
    entries.push([key, { config: cfg, $output: void 0 }]);
  }
  return Object.fromEntries(entries);
};
var assignParent = (parent, subcommands) => subcommands.forEach((e) => {
  e.parent = parent;
  if (e.subcommands) assignParent(e, e.subcommands);
});
var command2 = (command3) => {
  const allNames = command3.aliases ? [command3.name, ...command3.aliases] : [command3.name];
  const cmd = (0, import_clone.default)(command3);
  if (command3.subcommands && command3.options && Object.values(command3.options).find((opt) => opt._.config.type === "positional")) {
    throw new BroCliError(
      `Can't define command '${cmd.name}' - command can't have subcommands and positional args at the same time!`
    );
  }
  if (!command3.handler && !command3.subcommands) {
    throw new BroCliError(
      `Can't define command '${cmd.name}' - command without subcommands must have a handler present!`
    );
  }
  const processedOptions = command3.options ? validateOptions(command3.options) : void 0;
  cmd.options = processedOptions;
  cmd.name = cmd.name ?? cmd.aliases?.shift();
  if (!cmd.name) throw new BroCliError(`Can't define command without name!`);
  cmd.aliases = cmd.aliases?.length ? cmd.aliases : void 0;
  if (cmd.name.startsWith("-")) {
    throw new BroCliError(`Can't define command '${cmd.name}' - command name can't start with '-'!`);
  }
  cmd.aliases?.forEach((a) => {
    if (a.startsWith("-")) {
      throw new BroCliError(`Can't define command '${cmd.name}' - command aliases can't start with '-'!`);
    }
  });
  allNames.forEach((n, i) => {
    if (n === "help") {
      throw new BroCliError(
        `Can't define command '${cmd.name}' - 'help' is a reserved name. If you want to redefine help message - do so in runCli's config.`
      );
    }
    const lCaseName = n?.toLowerCase();
    if (lCaseName === "0" || lCaseName === "1" || lCaseName === "true" || lCaseName === "false") {
      throw new BroCliError(
        `Can't define command '${cmd.name}' - '${n}' is a reserved for boolean values name!`
      );
    }
    const idx = allNames.findIndex((an) => an === n);
    if (idx !== i) throw new BroCliError(`Can't define command '${cmd.name}' - duplicate alias '${n}'!`);
  });
  if (cmd.subcommands) {
    assignParent(cmd, cmd.subcommands);
  }
  return cmd;
};
var getCommandInner = (commands, candidates, args, cliName, cliDescription) => {
  const { data: arg, originalIndex: index } = candidates.shift();
  const command3 = commands.find((c) => {
    const names = c.aliases ? [c.name, ...c.aliases] : [c.name];
    const res = names.find((name) => name === arg);
    return res;
  });
  if (!command3) {
    return {
      command: command3,
      args
    };
  }
  const newArgs = removeByIndex(args, index);
  if (!candidates.length || !command3.subcommands) {
    return {
      command: command3,
      args: newArgs
    };
  }
  const newCandidates = candidates.map((c) => ({ data: c.data, originalIndex: c.originalIndex - 1 }));
  const subcommand = getCommandInner(command3.subcommands, newCandidates, newArgs, cliName, cliDescription);
  if (!subcommand.command) {
    throw new BroCliError(void 0, {
      type: "error",
      violation: "unknown_subcommand_error",
      name: cliName,
      description: cliDescription,
      command: command3,
      offender: candidates[0].data
    });
  }
  return subcommand;
};
var getCommand = (commands, args, cliName, cliDescription) => {
  const candidates = [];
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h" || arg === "--version" || arg === "-v") {
      const lCaseNext = args[i + 1]?.toLowerCase();
      if (lCaseNext === "0" || lCaseNext === "1" || lCaseNext === "true" || lCaseNext === "false") ++i;
      continue;
    }
    if (arg?.startsWith("-")) {
      if (!arg.includes("=")) ++i;
      continue;
    }
    candidates.push({
      data: arg,
      originalIndex: i
    });
  }
  if (!candidates.length) {
    return {
      command: void 0,
      args
    };
  }
  const firstCandidate = candidates[0];
  if (firstCandidate.data === "help") {
    return {
      command: "help",
      args: removeByIndex(args, firstCandidate.originalIndex)
    };
  }
  const { command: command3, args: argsRes } = getCommandInner(commands, candidates, args, cliName, cliDescription);
  if (!command3) {
    throw new BroCliError(void 0, {
      type: "error",
      violation: "unknown_command_error",
      commands,
      name: cliName,
      description: cliDescription,
      offender: firstCandidate.data
    });
  }
  return {
    command: command3,
    args: argsRes
  };
};
var parseArg = (command3, options, positionals, arg, nextArg, cliName, cliDescription) => {
  let data = void 0;
  const argSplit = arg.split("=");
  const hasEq = arg.includes("=");
  const namePart = argSplit.shift();
  const dataPart = hasEq ? argSplit.join("=") : nextArg;
  let skipNext = !hasEq;
  if (namePart === "--help" || namePart === "-h") {
    return {
      isHelp: true
    };
  }
  if (namePart === "--version" || namePart === "-v") {
    return {
      isVersion: true
    };
  }
  if (!arg.startsWith("-")) {
    if (!positionals.length) return {};
    const pos = positionals.shift();
    if (pos[1].enumVals && !pos[1].enumVals.find((val) => val === arg)) {
      throw new BroCliError(void 0, {
        type: "error",
        name: cliName,
        description: cliDescription,
        violation: "enum_violation",
        command: command3,
        option: pos[1],
        offender: {
          dataPart: arg
        }
      });
    }
    data = arg;
    return {
      data,
      skipNext: false,
      name: pos[0],
      option: pos[1]
    };
  }
  const option = options.find(([optKey, opt]) => {
    const names = [opt.name, ...opt.aliases];
    if (opt.type === "boolean") {
      const match = names.find((name) => name === namePart);
      if (!match) return false;
      let lcaseData = dataPart?.toLowerCase();
      if (!hasEq && nextArg?.startsWith("-")) {
        data = true;
        skipNext = false;
        return true;
      }
      if (lcaseData === void 0 || lcaseData === "" || lcaseData === "true" || lcaseData === "1") {
        data = true;
        return true;
      }
      if (lcaseData === "false" || lcaseData === "0") {
        data = false;
        return true;
      }
      if (!hasEq) {
        data = true;
        skipNext = false;
        return true;
      }
      throw new BroCliError(void 0, {
        type: "error",
        name: cliName,
        description: cliDescription,
        violation: "invalid_boolean_syntax",
        option: opt,
        command: command3,
        offender: {
          namePart,
          dataPart
        }
      });
    } else {
      const match = names.find((name) => name === namePart);
      if (!match) return false;
      if (opt.type === "string") {
        if (!hasEq && nextArg === void 0) {
          throw new BroCliError(void 0, {
            type: "error",
            name: cliName,
            description: cliDescription,
            violation: "invalid_string_syntax",
            option: opt,
            command: command3,
            offender: {
              namePart,
              dataPart
            }
          });
        }
        if (opt.enumVals && !opt.enumVals.find((val) => val === dataPart)) {
          throw new BroCliError(void 0, {
            type: "error",
            name: cliName,
            description: cliDescription,
            violation: "enum_violation",
            option: opt,
            command: command3,
            offender: {
              namePart,
              dataPart
            }
          });
        }
        data = dataPart;
        return true;
      }
      if (!hasEq && nextArg === void 0) {
        throw new BroCliError(void 0, {
          type: "error",
          name: cliName,
          description: cliDescription,
          violation: "invalid_number_syntax",
          option: opt,
          command: command3,
          offender: {
            namePart,
            dataPart
          }
        });
      }
      const numData = Number(dataPart);
      if (isNaN(numData)) {
        throw new BroCliError(void 0, {
          type: "error",
          name: cliName,
          description: cliDescription,
          violation: "invalid_number_value",
          option: opt,
          command: command3,
          offender: {
            namePart,
            dataPart
          }
        });
      }
      if (opt.isInt && !isInt(numData)) {
        throw new BroCliError(void 0, {
          type: "error",
          name: cliName,
          description: cliDescription,
          violation: "expected_int",
          option: opt,
          command: command3,
          offender: {
            namePart,
            dataPart
          }
        });
      }
      if (opt.minVal !== void 0 && numData < opt.minVal) {
        throw new BroCliError(void 0, {
          type: "error",
          name: cliName,
          description: cliDescription,
          violation: "below_min",
          option: opt,
          command: command3,
          offender: {
            namePart,
            dataPart
          }
        });
      }
      if (opt.maxVal !== void 0 && numData > opt.maxVal) {
        throw new BroCliError(void 0, {
          type: "error",
          name: cliName,
          description: cliDescription,
          violation: "above_max",
          option: opt,
          command: command3,
          offender: {
            namePart,
            dataPart
          }
        });
      }
      data = numData;
      return true;
    }
  });
  return {
    data,
    skipNext,
    name: option?.[0],
    option: option?.[1]
  };
};
var parseOptions = (command3, args, cliName, cliDescription, omitKeysOfUndefinedOptions) => {
  const options = command3.options;
  const optEntries = Object.entries(options ?? {}).map(
    (opt) => [opt[0], opt[1].config]
  );
  const nonPositionalEntries = optEntries.filter(([key, opt]) => opt.type !== "positional");
  const positionalEntries = optEntries.filter(([key, opt]) => opt.type === "positional");
  const result = {};
  const missingRequiredArr = [];
  const unrecognizedArgsArr = [];
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    const nextArg = args[i + 1];
    const {
      data,
      name,
      option,
      skipNext,
      isHelp,
      isVersion
    } = parseArg(command3, nonPositionalEntries, positionalEntries, arg, nextArg, cliName, cliDescription);
    if (!option) unrecognizedArgsArr.push(arg.split("=")[0]);
    if (skipNext) ++i;
    if (isHelp) return "help";
    if (isVersion) return "version";
    result[name] = data;
  }
  for (const [optKey, option] of optEntries) {
    const data = result[optKey] ?? option.default;
    if (!omitKeysOfUndefinedOptions) {
      result[optKey] = data;
    } else {
      if (data !== void 0) result[optKey] = data;
    }
    if (option.isRequired && result[optKey] === void 0) missingRequiredArr.push([option.name, ...option.aliases]);
  }
  if (missingRequiredArr.length) {
    throw new BroCliError(void 0, {
      type: "error",
      violation: "missing_args_error",
      name: cliName,
      description: cliDescription,
      command: command3,
      missing: missingRequiredArr
    });
  }
  if (unrecognizedArgsArr.length) {
    throw new BroCliError(void 0, {
      type: "error",
      violation: "unrecognized_args_error",
      name: cliName,
      description: cliDescription,
      command: command3,
      unrecognized: unrecognizedArgsArr
    });
  }
  return Object.keys(result).length ? result : void 0;
};
var getCommandNameWithParents = (command3) => command3.parent ? `${getCommandNameWithParents(command3.parent)} ${command3.name}` : command3.name;
var validateCommands = (commands, parent) => {
  const storedNames = {};
  for (const cmd of commands) {
    const storageVals = Object.values(storedNames);
    for (const storage of storageVals) {
      const nameOccupier = storage.find((e) => e === cmd.name);
      if (!nameOccupier) continue;
      throw new BroCliError(
        `Can't define command '${getCommandNameWithParents(cmd)}': name is already in use by command '${parent ? `${getCommandNameWithParents(parent)} ` : ""}${storage[0]}'!`
      );
    }
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        for (const storage of storageVals) {
          const nameOccupier = storage.find((e) => e === alias);
          if (!nameOccupier) continue;
          throw new BroCliError(
            `Can't define command '${getCommandNameWithParents(cmd)}': alias '${alias}' is already in use by command '${parent ? `${getCommandNameWithParents(parent)} ` : ""}${storage[0]}'!`
          );
        }
      }
    }
    storedNames[cmd.name] = cmd.aliases ? [cmd.name, ...cmd.aliases] : [cmd.name];
    if (cmd.subcommands) cmd.subcommands = validateCommands(cmd.subcommands, cmd);
  }
  return commands;
};
var removeByIndex = (arr, idx) => [...arr.slice(0, idx), ...arr.slice(idx + 1, arr.length)];
var run = async (commands, config) => {
  const eventHandler = config?.theme ? eventHandlerWrapper(config.theme) : defaultEventHandler;
  const argSource = config?.argSource ?? process.argv;
  const version = config?.version;
  const help = config?.help;
  const omitKeysOfUndefinedOptions = config?.omitKeysOfUndefinedOptions ?? false;
  const cliName = config?.name;
  const cliDescription = config?.description;
  try {
    const processedCmds = validateCommands(commands);
    let args = argSource.slice(2, argSource.length);
    if (!args.length) {
      return help !== void 0 ? await executeOrLog(help) : await eventHandler({
        type: "global_help",
        description: cliDescription,
        name: cliName,
        commands: processedCmds
      });
    }
    const helpIndex = args.findIndex((arg) => arg === "--help" || arg === "-h");
    if (helpIndex !== -1 && (helpIndex > 0 ? args[helpIndex - 1]?.startsWith("-") && !args[helpIndex - 1].includes("=") ? false : true : true)) {
      const command4 = getCommand(processedCmds, args, cliName, cliDescription).command;
      if (typeof command4 === "object") {
        return command4.help !== void 0 ? await executeOrLog(command4.help) : await eventHandler({
          type: "command_help",
          description: cliDescription,
          name: cliName,
          command: command4
        });
      } else {
        return help !== void 0 ? await executeOrLog(help) : await eventHandler({
          type: "global_help",
          description: cliDescription,
          name: cliName,
          commands: processedCmds
        });
      }
    }
    const versionIndex = args.findIndex((arg) => arg === "--version" || arg === "-v");
    if (versionIndex !== -1 && (versionIndex > 0 ? args[versionIndex - 1]?.startsWith("-") ? false : true : true)) {
      return version !== void 0 ? await executeOrLog(version) : await eventHandler({
        type: "version",
        name: cliName,
        description: cliDescription
      });
    }
    const { command: command3, args: newArgs } = getCommand(processedCmds, args, cliName, cliDescription);
    if (!command3) {
      return help !== void 0 ? await executeOrLog(help) : await eventHandler({
        type: "global_help",
        description: cliDescription,
        name: cliName,
        commands: processedCmds
      });
    }
    if (command3 === "help") {
      let helpCommand;
      let newestArgs = newArgs;
      do {
        const res = getCommand(processedCmds, newestArgs, cliName, cliDescription);
        helpCommand = res.command;
        newestArgs = res.args;
      } while (helpCommand === "help");
      return helpCommand ? helpCommand.help !== void 0 ? await executeOrLog(helpCommand.help) : await eventHandler({
        type: "command_help",
        description: cliDescription,
        name: cliName,
        command: helpCommand
      }) : help !== void 0 ? await executeOrLog(help) : await eventHandler({
        type: "global_help",
        description: cliDescription,
        name: cliName,
        commands: processedCmds
      });
    }
    const optionResult = parseOptions(command3, newArgs, cliName, cliDescription, omitKeysOfUndefinedOptions);
    if (optionResult === "help") {
      return command3.help !== void 0 ? await executeOrLog(command3.help) : await eventHandler({
        type: "command_help",
        description: cliDescription,
        name: cliName,
        command: command3
      });
    }
    if (optionResult === "version") {
      return version !== void 0 ? await executeOrLog(version) : await eventHandler({
        type: "version",
        name: cliName,
        description: cliDescription
      });
    }
    if (command3.handler) {
      if (config?.hook) await config.hook("before", command3);
      await command3.handler(command3.transform ? await command3.transform(optionResult) : optionResult);
      if (config?.hook) await config.hook("after", command3);
      return;
    } else {
      return command3.help !== void 0 ? await executeOrLog(command3.help) : await eventHandler({
        type: "command_help",
        description: cliDescription,
        name: cliName,
        command: command3
      });
    }
  } catch (e) {
    if (e instanceof BroCliError) {
      if (e.event) await eventHandler(e.event);
      else {
        if (!config?.noExit) console.error(e.message);
        else return e.message;
      }
    } else {
      await eventHandler({
        type: "error",
        violation: "unknown_error",
        name: cliName,
        description: cliDescription,
        error: e
      });
    }
    if (!config?.noExit) process.exit(1);
    return;
  }
};
var handler = (options, handler2) => handler2;
var test = async (command3, args) => {
  try {
    const cliParsedArgs = shellArgs(args);
    const options = parseOptions(command3, cliParsedArgs, void 0, void 0);
    if (options === "help" || options === "version") {
      return {
        type: options
      };
    }
    return {
      options: command3.transform ? await command3.transform(options) : options,
      type: "handler"
    };
  } catch (e) {
    return {
      type: "error",
      error: e
    };
  }
};
var commandsInfo = (commands) => {
  const validated = validateCommands(commands);
  return Object.fromEntries(validated.map((c) => [c.name, {
    name: c.name,
    aliases: (0, import_clone.default)(c.aliases),
    desc: c.desc,
    shortDesc: c.shortDesc,
    isHidden: c.hidden,
    options: c.options ? Object.fromEntries(Object.entries(c.options).map(([key, opt]) => [key, (0, import_clone.default)(opt.config)])) : void 0,
    metadata: (0, import_clone.default)(c.metadata),
    subcommands: c.subcommands ? commandsInfo(c.subcommands) : void 0
  }]));
};

// src/option-builder.ts
var OptionBuilderBase = class _OptionBuilderBase {
  _;
  config = () => this._.config;
  constructor(config) {
    this._ = {
      config: config ?? {
        aliases: [],
        type: "string"
      },
      $output: void 0
    };
  }
  string(name) {
    const config = this.config();
    return new _OptionBuilderBase({ ...config, type: "string", name });
  }
  number(name) {
    const config = this.config();
    return new _OptionBuilderBase({ ...config, type: "number", name });
  }
  boolean(name) {
    const config = this.config();
    return new _OptionBuilderBase({ ...config, type: "boolean", name });
  }
  positional(displayName) {
    const config = this.config();
    return new _OptionBuilderBase({ ...config, type: "positional", name: displayName });
  }
  alias(...aliases) {
    const config = this.config();
    return new _OptionBuilderBase({ ...config, aliases });
  }
  desc(description) {
    const config = this.config();
    return new _OptionBuilderBase({ ...config, description });
  }
  hidden() {
    const config = this.config();
    return new _OptionBuilderBase({ ...config, isHidden: true });
  }
  required() {
    const config = this.config();
    return new _OptionBuilderBase({ ...config, isRequired: true });
  }
  default(value) {
    const config = this.config();
    const enums = config.enumVals;
    if (enums && !enums.find((v) => value === v)) {
      throw new Error(
        `Option enums [ ${enums.join(", ")} ] are incompatible with default value ${value}`
      );
    }
    return new _OptionBuilderBase({ ...config, default: value });
  }
  enum(...values) {
    const config = this.config();
    const defaultVal = config.default;
    if (defaultVal !== void 0 && !values.find((v) => defaultVal === v)) {
      throw new Error(
        `Option enums [ ${values.join(", ")} ] are incompatible with default value ${defaultVal}`
      );
    }
    return new _OptionBuilderBase({ ...config, enumVals: values });
  }
  min(value) {
    const config = this.config();
    const maxVal = config.maxVal;
    if (maxVal !== void 0 && maxVal < value) {
      throw new BroCliError("Unable to define option's min value to be higher than max value!");
    }
    return new _OptionBuilderBase({ ...config, minVal: value });
  }
  max(value) {
    const config = this.config();
    const minVal = config.minVal;
    if (minVal !== void 0 && minVal > value) {
      throw new BroCliError("Unable to define option's max value to be lower than min value!");
    }
    return new _OptionBuilderBase({ ...config, maxVal: value });
  }
  int() {
    const config = this.config();
    return new _OptionBuilderBase({ ...config, isInt: true });
  }
};
function string(name) {
  return typeof name === "string" ? new OptionBuilderBase().string(name) : new OptionBuilderBase().string();
}
function number(name) {
  return typeof name === "string" ? new OptionBuilderBase().number(name) : new OptionBuilderBase().number();
}
function boolean(name) {
  return typeof name === "string" ? new OptionBuilderBase().boolean(name) : new OptionBuilderBase().boolean();
}
function positional(displayName) {
  return typeof displayName === "string" ? new OptionBuilderBase().positional(displayName) : new OptionBuilderBase().positional();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BroCliError,
  boolean,
  command,
  commandsInfo,
  getCommandNameWithParents,
  handler,
  number,
  positional,
  run,
  string,
  test
});
//# sourceMappingURL=index.cjs.map