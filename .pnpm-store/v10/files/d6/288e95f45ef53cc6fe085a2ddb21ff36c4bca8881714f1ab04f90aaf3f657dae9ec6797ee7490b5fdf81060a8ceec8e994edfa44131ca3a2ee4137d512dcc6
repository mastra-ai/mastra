import ESM_COMPAT_Module from "node:module";
import { fileURLToPath as ESM_COMPAT_fileURLToPath } from 'node:url';
import { dirname as ESM_COMPAT_dirname } from 'node:path';
const __filename = ESM_COMPAT_fileURLToPath(import.meta.url);
const __dirname = ESM_COMPAT_dirname(__filename);
const require = ESM_COMPAT_Module.createRequire(import.meta.url);
var Zs = Object.create;
var Ke = Object.defineProperty;
var js = Object.getOwnPropertyDescriptor;
var Ss = Object.getOwnPropertyNames;
var Es = Object.getPrototypeOf, Ps = Object.prototype.hasOwnProperty;
var d = (r, e) => Ke(r, "name", { value: e, configurable: !0 }), ge = /* @__PURE__ */ ((r) => typeof require < "u" ? require : typeof Proxy <
"u" ? new Proxy(r, {
  get: (e, t) => (typeof require < "u" ? require : e)[t]
}) : r)(function(r) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + r + '" is not supported');
});
var T = (r, e) => () => (e || r((e = { exports: {} }).exports, e), e.exports);
var Ns = (r, e, t, s) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let i of Ss(e))
      !Ps.call(r, i) && i !== t && Ke(r, i, { get: () => e[i], enumerable: !(s = js(e, i)) || s.enumerable });
  return r;
};
var ye = (r, e, t) => (t = r != null ? Zs(Es(r)) : {}, Ns(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  e || !r || !r.__esModule ? Ke(t, "default", { value: r, enumerable: !0 }) : t,
  r
));

// ../node_modules/commander/lib/error.js
var Oe = T((Qe) => {
  var De = class extends Error {
    static {
      d(this, "CommanderError");
    }
    /**
     * Constructs the CommanderError class
     * @param {number} exitCode suggested exit code which could be used with process.exit
     * @param {string} code an id string representing the error
     * @param {string} message human-readable description of the error
     */
    constructor(e, t, s) {
      super(s), Error.captureStackTrace(this, this.constructor), this.name = this.constructor.name, this.code = t, this.exitCode = e, this.nestedError =
      void 0;
    }
  }, Xe = class extends De {
    static {
      d(this, "InvalidArgumentError");
    }
    /**
     * Constructs the InvalidArgumentError class
     * @param {string} [message] explanation of why argument is invalid
     */
    constructor(e) {
      super(1, "commander.invalidArgument", e), Error.captureStackTrace(this, this.constructor), this.name = this.constructor.name;
    }
  };
  Qe.CommanderError = De;
  Qe.InvalidArgumentError = Xe;
});

// ../node_modules/commander/lib/argument.js
var $e = T((tt) => {
  var { InvalidArgumentError: Vs } = Oe(), et = class {
    static {
      d(this, "Argument");
    }
    /**
     * Initialize a new command argument with the given name and description.
     * The default is that the argument is required, and you can explicitly
     * indicate this with <> around the name. Put [] around the name for an optional argument.
     *
     * @param {string} name
     * @param {string} [description]
     */
    constructor(e, t) {
      switch (this.description = t || "", this.variadic = !1, this.parseArg = void 0, this.defaultValue = void 0, this.defaultValueDescription =
      void 0, this.argChoices = void 0, e[0]) {
        case "<":
          this.required = !0, this._name = e.slice(1, -1);
          break;
        case "[":
          this.required = !1, this._name = e.slice(1, -1);
          break;
        default:
          this.required = !0, this._name = e;
          break;
      }
      this._name.length > 3 && this._name.slice(-3) === "..." && (this.variadic = !0, this._name = this._name.slice(0, -3));
    }
    /**
     * Return argument name.
     *
     * @return {string}
     */
    name() {
      return this._name;
    }
    /**
     * @package
     */
    _concatValue(e, t) {
      return t === this.defaultValue || !Array.isArray(t) ? [e] : t.concat(e);
    }
    /**
     * Set the default value, and optionally supply the description to be displayed in the help.
     *
     * @param {*} value
     * @param {string} [description]
     * @return {Argument}
     */
    default(e, t) {
      return this.defaultValue = e, this.defaultValueDescription = t, this;
    }
    /**
     * Set the custom handler for processing CLI command arguments into argument values.
     *
     * @param {Function} [fn]
     * @return {Argument}
     */
    argParser(e) {
      return this.parseArg = e, this;
    }
    /**
     * Only allow argument value to be one of choices.
     *
     * @param {string[]} values
     * @return {Argument}
     */
    choices(e) {
      return this.argChoices = e.slice(), this.parseArg = (t, s) => {
        if (!this.argChoices.includes(t))
          throw new Vs(
            `Allowed choices are ${this.argChoices.join(", ")}.`
          );
        return this.variadic ? this._concatValue(t, s) : t;
      }, this;
    }
    /**
     * Make argument required.
     *
     * @returns {Argument}
     */
    argRequired() {
      return this.required = !0, this;
    }
    /**
     * Make argument optional.
     *
     * @returns {Argument}
     */
    argOptional() {
      return this.required = !1, this;
    }
  };
  function Ds(r) {
    let e = r.name() + (r.variadic === !0 ? "..." : "");
    return r.required ? "<" + e + ">" : "[" + e + "]";
  }
  d(Ds, "humanReadableArgName");
  tt.Argument = et;
  tt.humanReadableArgName = Ds;
});

// ../node_modules/commander/lib/help.js
var rt = T((Et) => {
  var { humanReadableArgName: $s } = $e(), st = class {
    static {
      d(this, "Help");
    }
    constructor() {
      this.helpWidth = void 0, this.sortSubcommands = !1, this.sortOptions = !1, this.showGlobalOptions = !1;
    }
    /**
     * Get an array of the visible subcommands. Includes a placeholder for the implicit help command, if there is one.
     *
     * @param {Command} cmd
     * @returns {Command[]}
     */
    visibleCommands(e) {
      let t = e.commands.filter((i) => !i._hidden), s = e._getHelpCommand();
      return s && !s._hidden && t.push(s), this.sortSubcommands && t.sort((i, n) => i.name().localeCompare(n.name())), t;
    }
    /**
     * Compare options for sort.
     *
     * @param {Option} a
     * @param {Option} b
     * @returns {number}
     */
    compareOptions(e, t) {
      let s = /* @__PURE__ */ d((i) => i.short ? i.short.replace(/^-/, "") : i.long.replace(/^--/, ""), "getSortKey");
      return s(e).localeCompare(s(t));
    }
    /**
     * Get an array of the visible options. Includes a placeholder for the implicit help option, if there is one.
     *
     * @param {Command} cmd
     * @returns {Option[]}
     */
    visibleOptions(e) {
      let t = e.options.filter((i) => !i.hidden), s = e._getHelpOption();
      if (s && !s.hidden) {
        let i = s.short && e._findOption(s.short), n = s.long && e._findOption(s.long);
        !i && !n ? t.push(s) : s.long && !n ? t.push(
          e.createOption(s.long, s.description)
        ) : s.short && !i && t.push(
          e.createOption(s.short, s.description)
        );
      }
      return this.sortOptions && t.sort(this.compareOptions), t;
    }
    /**
     * Get an array of the visible global options. (Not including help.)
     *
     * @param {Command} cmd
     * @returns {Option[]}
     */
    visibleGlobalOptions(e) {
      if (!this.showGlobalOptions) return [];
      let t = [];
      for (let s = e.parent; s; s = s.parent) {
        let i = s.options.filter(
          (n) => !n.hidden
        );
        t.push(...i);
      }
      return this.sortOptions && t.sort(this.compareOptions), t;
    }
    /**
     * Get an array of the arguments if any have a description.
     *
     * @param {Command} cmd
     * @returns {Argument[]}
     */
    visibleArguments(e) {
      return e._argsDescription && e.registeredArguments.forEach((t) => {
        t.description = t.description || e._argsDescription[t.name()] || "";
      }), e.registeredArguments.find((t) => t.description) ? e.registeredArguments : [];
    }
    /**
     * Get the command term to show in the list of subcommands.
     *
     * @param {Command} cmd
     * @returns {string}
     */
    subcommandTerm(e) {
      let t = e.registeredArguments.map((s) => $s(s)).join(" ");
      return e._name + (e._aliases[0] ? "|" + e._aliases[0] : "") + (e.options.length ? " [options]" : "") + // simplistic check for non-help option
      (t ? " " + t : "");
    }
    /**
     * Get the option term to show in the list of options.
     *
     * @param {Option} option
     * @returns {string}
     */
    optionTerm(e) {
      return e.flags;
    }
    /**
     * Get the argument term to show in the list of arguments.
     *
     * @param {Argument} argument
     * @returns {string}
     */
    argumentTerm(e) {
      return e.name();
    }
    /**
     * Get the longest command term length.
     *
     * @param {Command} cmd
     * @param {Help} helper
     * @returns {number}
     */
    longestSubcommandTermLength(e, t) {
      return t.visibleCommands(e).reduce((s, i) => Math.max(s, t.subcommandTerm(i).length), 0);
    }
    /**
     * Get the longest option term length.
     *
     * @param {Command} cmd
     * @param {Help} helper
     * @returns {number}
     */
    longestOptionTermLength(e, t) {
      return t.visibleOptions(e).reduce((s, i) => Math.max(s, t.optionTerm(i).length), 0);
    }
    /**
     * Get the longest global option term length.
     *
     * @param {Command} cmd
     * @param {Help} helper
     * @returns {number}
     */
    longestGlobalOptionTermLength(e, t) {
      return t.visibleGlobalOptions(e).reduce((s, i) => Math.max(s, t.optionTerm(i).length), 0);
    }
    /**
     * Get the longest argument term length.
     *
     * @param {Command} cmd
     * @param {Help} helper
     * @returns {number}
     */
    longestArgumentTermLength(e, t) {
      return t.visibleArguments(e).reduce((s, i) => Math.max(s, t.argumentTerm(i).length), 0);
    }
    /**
     * Get the command usage to be displayed at the top of the built-in help.
     *
     * @param {Command} cmd
     * @returns {string}
     */
    commandUsage(e) {
      let t = e._name;
      e._aliases[0] && (t = t + "|" + e._aliases[0]);
      let s = "";
      for (let i = e.parent; i; i = i.parent)
        s = i.name() + " " + s;
      return s + t + " " + e.usage();
    }
    /**
     * Get the description for the command.
     *
     * @param {Command} cmd
     * @returns {string}
     */
    commandDescription(e) {
      return e.description();
    }
    /**
     * Get the subcommand summary to show in the list of subcommands.
     * (Fallback to description for backwards compatibility.)
     *
     * @param {Command} cmd
     * @returns {string}
     */
    subcommandDescription(e) {
      return e.summary() || e.description();
    }
    /**
     * Get the option description to show in the list of options.
     *
     * @param {Option} option
     * @return {string}
     */
    optionDescription(e) {
      let t = [];
      return e.argChoices && t.push(
        // use stringify to match the display of the default value
        `choices: ${e.argChoices.map((s) => JSON.stringify(s)).join(", ")}`
      ), e.defaultValue !== void 0 && (e.required || e.optional || e.isBoolean() && typeof e.defaultValue == "boolean") && t.push(
        `default: ${e.defaultValueDescription || JSON.stringify(e.defaultValue)}`
      ), e.presetArg !== void 0 && e.optional && t.push(`preset: ${JSON.stringify(e.presetArg)}`), e.envVar !== void 0 && t.push(`env: ${e.envVar}`),
      t.length > 0 ? `${e.description} (${t.join(", ")})` : e.description;
    }
    /**
     * Get the argument description to show in the list of arguments.
     *
     * @param {Argument} argument
     * @return {string}
     */
    argumentDescription(e) {
      let t = [];
      if (e.argChoices && t.push(
        // use stringify to match the display of the default value
        `choices: ${e.argChoices.map((s) => JSON.stringify(s)).join(", ")}`
      ), e.defaultValue !== void 0 && t.push(
        `default: ${e.defaultValueDescription || JSON.stringify(e.defaultValue)}`
      ), t.length > 0) {
        let s = `(${t.join(", ")})`;
        return e.description ? `${e.description} ${s}` : s;
      }
      return e.description;
    }
    /**
     * Generate the built-in help text.
     *
     * @param {Command} cmd
     * @param {Help} helper
     * @returns {string}
     */
    formatHelp(e, t) {
      let s = t.padWidth(e, t), i = t.helpWidth || 80, n = 2, a = 2;
      function o(I, H) {
        if (H) {
          let Ye = `${I.padEnd(s + a)}${H}`;
          return t.wrap(
            Ye,
            i - n,
            s + a
          );
        }
        return I;
      }
      d(o, "formatItem");
      function c(I) {
        return I.join(`
`).replace(/^/gm, " ".repeat(n));
      }
      d(c, "formatList");
      let h = [`Usage: ${t.commandUsage(e)}`, ""], p = t.commandDescription(e);
      p.length > 0 && (h = h.concat([
        t.wrap(p, i, 0),
        ""
      ]));
      let y = t.visibleArguments(e).map((I) => o(
        t.argumentTerm(I),
        t.argumentDescription(I)
      ));
      y.length > 0 && (h = h.concat(["Arguments:", c(y), ""]));
      let C = t.visibleOptions(e).map((I) => o(
        t.optionTerm(I),
        t.optionDescription(I)
      ));
      if (C.length > 0 && (h = h.concat(["Options:", c(C), ""])), this.showGlobalOptions) {
        let I = t.visibleGlobalOptions(e).map((H) => o(
          t.optionTerm(H),
          t.optionDescription(H)
        ));
        I.length > 0 && (h = h.concat([
          "Global Options:",
          c(I),
          ""
        ]));
      }
      let j = t.visibleCommands(e).map((I) => o(
        t.subcommandTerm(I),
        t.subcommandDescription(I)
      ));
      return j.length > 0 && (h = h.concat(["Commands:", c(j), ""])), h.join(`
`);
    }
    /**
     * Calculate the pad width from the maximum term length.
     *
     * @param {Command} cmd
     * @param {Help} helper
     * @returns {number}
     */
    padWidth(e, t) {
      return Math.max(
        t.longestOptionTermLength(e, t),
        t.longestGlobalOptionTermLength(e, t),
        t.longestSubcommandTermLength(e, t),
        t.longestArgumentTermLength(e, t)
      );
    }
    /**
     * Wrap the given string to width characters per line, with lines after the first indented.
     * Do not wrap if insufficient room for wrapping (minColumnWidth), or string is manually formatted.
     *
     * @param {string} str
     * @param {number} width
     * @param {number} indent
     * @param {number} [minColumnWidth=40]
     * @return {string}
     *
     */
    wrap(e, t, s, i = 40) {
      let n = " \\f\\t\\v\xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF", a = new RegExp(`[\\n][${n}]+`);
      if (e.match(a)) return e;
      let o = t - s;
      if (o < i) return e;
      let c = e.slice(0, s), h = e.slice(s).replace(`\r
`, `
`), p = " ".repeat(s), C = "\\s\u200B", j = new RegExp(
        `
|.{1,${o - 1}}([${C}]|$)|[^${C}]+?([${C}]|$)`,
        "g"
      ), I = h.match(j) || [];
      return c + I.map((H, Ye) => H === `
` ? "" : (Ye > 0 ? p : "") + H.trimEnd()).join(`
`);
    }
  };
  Et.Help = st;
});

// ../node_modules/commander/lib/option.js
var ot = T((at) => {
  var { InvalidArgumentError: Rs } = Oe(), it = class {
    static {
      d(this, "Option");
    }
    /**
     * Initialize a new `Option` with the given `flags` and `description`.
     *
     * @param {string} flags
     * @param {string} [description]
     */
    constructor(e, t) {
      this.flags = e, this.description = t || "", this.required = e.includes("<"), this.optional = e.includes("["), this.variadic = /\w\.\.\.[>\]]$/.
      test(e), this.mandatory = !1;
      let s = Ls(e);
      this.short = s.shortFlag, this.long = s.longFlag, this.negate = !1, this.long && (this.negate = this.long.startsWith("--no-")), this.defaultValue =
      void 0, this.defaultValueDescription = void 0, this.presetArg = void 0, this.envVar = void 0, this.parseArg = void 0, this.hidden = !1,
      this.argChoices = void 0, this.conflictsWith = [], this.implied = void 0;
    }
    /**
     * Set the default value, and optionally supply the description to be displayed in the help.
     *
     * @param {*} value
     * @param {string} [description]
     * @return {Option}
     */
    default(e, t) {
      return this.defaultValue = e, this.defaultValueDescription = t, this;
    }
    /**
     * Preset to use when option used without option-argument, especially optional but also boolean and negated.
     * The custom processing (parseArg) is called.
     *
     * @example
     * new Option('--color').default('GREYSCALE').preset('RGB');
     * new Option('--donate [amount]').preset('20').argParser(parseFloat);
     *
     * @param {*} arg
     * @return {Option}
     */
    preset(e) {
      return this.presetArg = e, this;
    }
    /**
     * Add option name(s) that conflict with this option.
     * An error will be displayed if conflicting options are found during parsing.
     *
     * @example
     * new Option('--rgb').conflicts('cmyk');
     * new Option('--js').conflicts(['ts', 'jsx']);
     *
     * @param {(string | string[])} names
     * @return {Option}
     */
    conflicts(e) {
      return this.conflictsWith = this.conflictsWith.concat(e), this;
    }
    /**
     * Specify implied option values for when this option is set and the implied options are not.
     *
     * The custom processing (parseArg) is not called on the implied values.
     *
     * @example
     * program
     *   .addOption(new Option('--log', 'write logging information to file'))
     *   .addOption(new Option('--trace', 'log extra details').implies({ log: 'trace.txt' }));
     *
     * @param {object} impliedOptionValues
     * @return {Option}
     */
    implies(e) {
      let t = e;
      return typeof e == "string" && (t = { [e]: !0 }), this.implied = Object.assign(this.implied || {}, t), this;
    }
    /**
     * Set environment variable to check for option value.
     *
     * An environment variable is only used if when processed the current option value is
     * undefined, or the source of the current value is 'default' or 'config' or 'env'.
     *
     * @param {string} name
     * @return {Option}
     */
    env(e) {
      return this.envVar = e, this;
    }
    /**
     * Set the custom handler for processing CLI option arguments into option values.
     *
     * @param {Function} [fn]
     * @return {Option}
     */
    argParser(e) {
      return this.parseArg = e, this;
    }
    /**
     * Whether the option is mandatory and must have a value after parsing.
     *
     * @param {boolean} [mandatory=true]
     * @return {Option}
     */
    makeOptionMandatory(e = !0) {
      return this.mandatory = !!e, this;
    }
    /**
     * Hide option in help.
     *
     * @param {boolean} [hide=true]
     * @return {Option}
     */
    hideHelp(e = !0) {
      return this.hidden = !!e, this;
    }
    /**
     * @package
     */
    _concatValue(e, t) {
      return t === this.defaultValue || !Array.isArray(t) ? [e] : t.concat(e);
    }
    /**
     * Only allow option value to be one of choices.
     *
     * @param {string[]} values
     * @return {Option}
     */
    choices(e) {
      return this.argChoices = e.slice(), this.parseArg = (t, s) => {
        if (!this.argChoices.includes(t))
          throw new Rs(
            `Allowed choices are ${this.argChoices.join(", ")}.`
          );
        return this.variadic ? this._concatValue(t, s) : t;
      }, this;
    }
    /**
     * Return option name.
     *
     * @return {string}
     */
    name() {
      return this.long ? this.long.replace(/^--/, "") : this.short.replace(/^-/, "");
    }
    /**
     * Return option name, in a camelcase format that can be used
     * as a object attribute key.
     *
     * @return {string}
     */
    attributeName() {
      return Ms(this.name().replace(/^no-/, ""));
    }
    /**
     * Check if `arg` matches the short or long flag.
     *
     * @param {string} arg
     * @return {boolean}
     * @package
     */
    is(e) {
      return this.short === e || this.long === e;
    }
    /**
     * Return whether a boolean option.
     *
     * Options are one of boolean, negated, required argument, or optional argument.
     *
     * @return {boolean}
     * @package
     */
    isBoolean() {
      return !this.required && !this.optional && !this.negate;
    }
  }, nt = class {
    static {
      d(this, "DualOptions");
    }
    /**
     * @param {Option[]} options
     */
    constructor(e) {
      this.positiveOptions = /* @__PURE__ */ new Map(), this.negativeOptions = /* @__PURE__ */ new Map(), this.dualOptions = /* @__PURE__ */ new Set(),
      e.forEach((t) => {
        t.negate ? this.negativeOptions.set(t.attributeName(), t) : this.positiveOptions.set(t.attributeName(), t);
      }), this.negativeOptions.forEach((t, s) => {
        this.positiveOptions.has(s) && this.dualOptions.add(s);
      });
    }
    /**
     * Did the value come from the option, and not from possible matching dual option?
     *
     * @param {*} value
     * @param {Option} option
     * @returns {boolean}
     */
    valueFromOption(e, t) {
      let s = t.attributeName();
      if (!this.dualOptions.has(s)) return !0;
      let i = this.negativeOptions.get(s).presetArg, n = i !== void 0 ? i : !1;
      return t.negate === (n === e);
    }
  };
  function Ms(r) {
    return r.split("-").reduce((e, t) => e + t[0].toUpperCase() + t.slice(1));
  }
  d(Ms, "camelcase");
  function Ls(r) {
    let e, t, s = r.split(/[ |,]+/);
    return s.length > 1 && !/^[[<]/.test(s[1]) && (e = s.shift()), t = s.shift(), !e && /^-[^-]$/.test(t) && (e = t, t = void 0), { shortFlag: e,
    longFlag: t };
  }
  d(Ls, "splitOptionFlags");
  at.Option = it;
  at.DualOptions = nt;
});

// ../node_modules/commander/lib/suggestSimilar.js
var Nt = T((Pt) => {
  function qs(r, e) {
    if (Math.abs(r.length - e.length) > 3)
      return Math.max(r.length, e.length);
    let t = [];
    for (let s = 0; s <= r.length; s++)
      t[s] = [s];
    for (let s = 0; s <= e.length; s++)
      t[0][s] = s;
    for (let s = 1; s <= e.length; s++)
      for (let i = 1; i <= r.length; i++) {
        let n = 1;
        r[i - 1] === e[s - 1] ? n = 0 : n = 1, t[i][s] = Math.min(
          t[i - 1][s] + 1,
          // deletion
          t[i][s - 1] + 1,
          // insertion
          t[i - 1][s - 1] + n
          // substitution
        ), i > 1 && s > 1 && r[i - 1] === e[s - 2] && r[i - 2] === e[s - 1] && (t[i][s] = Math.min(t[i][s], t[i - 2][s - 2] + 1));
      }
    return t[r.length][e.length];
  }
  d(qs, "editDistance");
  function Us(r, e) {
    if (!e || e.length === 0) return "";
    e = Array.from(new Set(e));
    let t = r.startsWith("--");
    t && (r = r.slice(2), e = e.map((a) => a.slice(2)));
    let s = [], i = 3, n = 0.4;
    return e.forEach((a) => {
      if (a.length <= 1) return;
      let o = qs(r, a), c = Math.max(r.length, a.length);
      (c - o) / c > n && (o < i ? (i = o, s = [a]) : o === i && s.push(a));
    }), s.sort((a, o) => a.localeCompare(o)), t && (s = s.map((a) => `--${a}`)), s.length > 1 ? `
(Did you mean one of ${s.join(", ")}?)` : s.length === 1 ? `
(Did you mean ${s[0]}?)` : "";
  }
  d(Us, "suggestSimilar");
  Pt.suggestSimilar = Us;
});

// ../node_modules/commander/lib/command.js
var Mt = T((Rt) => {
  var Fs = ge("node:events").EventEmitter, dt = ge("node:child_process"), L = ge("node:path"), lt = ge("node:fs"), k = ge("node:process"), {
  Argument: Hs, humanReadableArgName: Bs } = $e(), { CommanderError: ut } = Oe(), { Help: Ws } = rt(), { Option: Vt, DualOptions: zs } = ot(),
  { suggestSimilar: Dt } = Nt(), ct = class r extends Fs {
    static {
      d(this, "Command");
    }
    /**
     * Initialize a new `Command`.
     *
     * @param {string} [name]
     */
    constructor(e) {
      super(), this.commands = [], this.options = [], this.parent = null, this._allowUnknownOption = !1, this._allowExcessArguments = !0, this.
      registeredArguments = [], this._args = this.registeredArguments, this.args = [], this.rawArgs = [], this.processedArgs = [], this._scriptPath =
      null, this._name = e || "", this._optionValues = {}, this._optionValueSources = {}, this._storeOptionsAsProperties = !1, this._actionHandler =
      null, this._executableHandler = !1, this._executableFile = null, this._executableDir = null, this._defaultCommandName = null, this._exitCallback =
      null, this._aliases = [], this._combineFlagAndOptionalValue = !0, this._description = "", this._summary = "", this._argsDescription = void 0,
      this._enablePositionalOptions = !1, this._passThroughOptions = !1, this._lifeCycleHooks = {}, this._showHelpAfterError = !1, this._showSuggestionAfterError =
      !0, this._outputConfiguration = {
        writeOut: /* @__PURE__ */ d((t) => k.stdout.write(t), "writeOut"),
        writeErr: /* @__PURE__ */ d((t) => k.stderr.write(t), "writeErr"),
        getOutHelpWidth: /* @__PURE__ */ d(() => k.stdout.isTTY ? k.stdout.columns : void 0, "getOutHelpWidth"),
        getErrHelpWidth: /* @__PURE__ */ d(() => k.stderr.isTTY ? k.stderr.columns : void 0, "getErrHelpWidth"),
        outputError: /* @__PURE__ */ d((t, s) => s(t), "outputError")
      }, this._hidden = !1, this._helpOption = void 0, this._addImplicitHelpCommand = void 0, this._helpCommand = void 0, this._helpConfiguration =
      {};
    }
    /**
     * Copy settings that are useful to have in common across root command and subcommands.
     *
     * (Used internally when adding a command using `.command()` so subcommands inherit parent settings.)
     *
     * @param {Command} sourceCommand
     * @return {Command} `this` command for chaining
     */
    copyInheritedSettings(e) {
      return this._outputConfiguration = e._outputConfiguration, this._helpOption = e._helpOption, this._helpCommand = e._helpCommand, this.
      _helpConfiguration = e._helpConfiguration, this._exitCallback = e._exitCallback, this._storeOptionsAsProperties = e._storeOptionsAsProperties,
      this._combineFlagAndOptionalValue = e._combineFlagAndOptionalValue, this._allowExcessArguments = e._allowExcessArguments, this._enablePositionalOptions =
      e._enablePositionalOptions, this._showHelpAfterError = e._showHelpAfterError, this._showSuggestionAfterError = e._showSuggestionAfterError,
      this;
    }
    /**
     * @returns {Command[]}
     * @private
     */
    _getCommandAndAncestors() {
      let e = [];
      for (let t = this; t; t = t.parent)
        e.push(t);
      return e;
    }
    /**
     * Define a command.
     *
     * There are two styles of command: pay attention to where to put the description.
     *
     * @example
     * // Command implemented using action handler (description is supplied separately to `.command`)
     * program
     *   .command('clone <source> [destination]')
     *   .description('clone a repository into a newly created directory')
     *   .action((source, destination) => {
     *     console.log('clone command called');
     *   });
     *
     * // Command implemented using separate executable file (description is second parameter to `.command`)
     * program
     *   .command('start <service>', 'start named service')
     *   .command('stop [service]', 'stop named service, or all if no name supplied');
     *
     * @param {string} nameAndArgs - command name and arguments, args are `<required>` or `[optional]` and last may also be `variadic...`
     * @param {(object | string)} [actionOptsOrExecDesc] - configuration options (for action), or description (for executable)
     * @param {object} [execOpts] - configuration options (for executable)
     * @return {Command} returns new command for action handler, or `this` for executable command
     */
    command(e, t, s) {
      let i = t, n = s;
      typeof i == "object" && i !== null && (n = i, i = null), n = n || {};
      let [, a, o] = e.match(/([^ ]+) *(.*)/), c = this.createCommand(a);
      return i && (c.description(i), c._executableHandler = !0), n.isDefault && (this._defaultCommandName = c._name), c._hidden = !!(n.noHelp ||
      n.hidden), c._executableFile = n.executableFile || null, o && c.arguments(o), this._registerCommand(c), c.parent = this, c.copyInheritedSettings(
      this), i ? this : c;
    }
    /**
     * Factory routine to create a new unattached command.
     *
     * See .command() for creating an attached subcommand, which uses this routine to
     * create the command. You can override createCommand to customise subcommands.
     *
     * @param {string} [name]
     * @return {Command} new command
     */
    createCommand(e) {
      return new r(e);
    }
    /**
     * You can customise the help with a subclass of Help by overriding createHelp,
     * or by overriding Help properties using configureHelp().
     *
     * @return {Help}
     */
    createHelp() {
      return Object.assign(new Ws(), this.configureHelp());
    }
    /**
     * You can customise the help by overriding Help properties using configureHelp(),
     * or with a subclass of Help by overriding createHelp().
     *
     * @param {object} [configuration] - configuration options
     * @return {(Command | object)} `this` command for chaining, or stored configuration
     */
    configureHelp(e) {
      return e === void 0 ? this._helpConfiguration : (this._helpConfiguration = e, this);
    }
    /**
     * The default output goes to stdout and stderr. You can customise this for special
     * applications. You can also customise the display of errors by overriding outputError.
     *
     * The configuration properties are all functions:
     *
     *     // functions to change where being written, stdout and stderr
     *     writeOut(str)
     *     writeErr(str)
     *     // matching functions to specify width for wrapping help
     *     getOutHelpWidth()
     *     getErrHelpWidth()
     *     // functions based on what is being written out
     *     outputError(str, write) // used for displaying errors, and not used for displaying help
     *
     * @param {object} [configuration] - configuration options
     * @return {(Command | object)} `this` command for chaining, or stored configuration
     */
    configureOutput(e) {
      return e === void 0 ? this._outputConfiguration : (Object.assign(this._outputConfiguration, e), this);
    }
    /**
     * Display the help or a custom message after an error occurs.
     *
     * @param {(boolean|string)} [displayHelp]
     * @return {Command} `this` command for chaining
     */
    showHelpAfterError(e = !0) {
      return typeof e != "string" && (e = !!e), this._showHelpAfterError = e, this;
    }
    /**
     * Display suggestion of similar commands for unknown commands, or options for unknown options.
     *
     * @param {boolean} [displaySuggestion]
     * @return {Command} `this` command for chaining
     */
    showSuggestionAfterError(e = !0) {
      return this._showSuggestionAfterError = !!e, this;
    }
    /**
     * Add a prepared subcommand.
     *
     * See .command() for creating an attached subcommand which inherits settings from its parent.
     *
     * @param {Command} cmd - new subcommand
     * @param {object} [opts] - configuration options
     * @return {Command} `this` command for chaining
     */
    addCommand(e, t) {
      if (!e._name)
        throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
      return t = t || {}, t.isDefault && (this._defaultCommandName = e._name), (t.noHelp || t.hidden) && (e._hidden = !0), this._registerCommand(
      e), e.parent = this, e._checkForBrokenPassThrough(), this;
    }
    /**
     * Factory routine to create a new unattached argument.
     *
     * See .argument() for creating an attached argument, which uses this routine to
     * create the argument. You can override createArgument to return a custom argument.
     *
     * @param {string} name
     * @param {string} [description]
     * @return {Argument} new argument
     */
    createArgument(e, t) {
      return new Hs(e, t);
    }
    /**
     * Define argument syntax for command.
     *
     * The default is that the argument is required, and you can explicitly
     * indicate this with <> around the name. Put [] around the name for an optional argument.
     *
     * @example
     * program.argument('<input-file>');
     * program.argument('[output-file]');
     *
     * @param {string} name
     * @param {string} [description]
     * @param {(Function|*)} [fn] - custom argument processing function
     * @param {*} [defaultValue]
     * @return {Command} `this` command for chaining
     */
    argument(e, t, s, i) {
      let n = this.createArgument(e, t);
      return typeof s == "function" ? n.default(i).argParser(s) : n.default(s), this.addArgument(n), this;
    }
    /**
     * Define argument syntax for command, adding multiple at once (without descriptions).
     *
     * See also .argument().
     *
     * @example
     * program.arguments('<cmd> [env]');
     *
     * @param {string} names
     * @return {Command} `this` command for chaining
     */
    arguments(e) {
      return e.trim().split(/ +/).forEach((t) => {
        this.argument(t);
      }), this;
    }
    /**
     * Define argument syntax for command, adding a prepared argument.
     *
     * @param {Argument} argument
     * @return {Command} `this` command for chaining
     */
    addArgument(e) {
      let t = this.registeredArguments.slice(-1)[0];
      if (t && t.variadic)
        throw new Error(
          `only the last argument can be variadic '${t.name()}'`
        );
      if (e.required && e.defaultValue !== void 0 && e.parseArg === void 0)
        throw new Error(
          `a default value for a required argument is never used: '${e.name()}'`
        );
      return this.registeredArguments.push(e), this;
    }
    /**
     * Customise or override default help command. By default a help command is automatically added if your command has subcommands.
     *
     * @example
     *    program.helpCommand('help [cmd]');
     *    program.helpCommand('help [cmd]', 'show help');
     *    program.helpCommand(false); // suppress default help command
     *    program.helpCommand(true); // add help command even if no subcommands
     *
     * @param {string|boolean} enableOrNameAndArgs - enable with custom name and/or arguments, or boolean to override whether added
     * @param {string} [description] - custom description
     * @return {Command} `this` command for chaining
     */
    helpCommand(e, t) {
      if (typeof e == "boolean")
        return this._addImplicitHelpCommand = e, this;
      e = e ?? "help [command]";
      let [, s, i] = e.match(/([^ ]+) *(.*)/), n = t ?? "display help for command", a = this.createCommand(s);
      return a.helpOption(!1), i && a.arguments(i), n && a.description(n), this._addImplicitHelpCommand = !0, this._helpCommand = a, this;
    }
    /**
     * Add prepared custom help command.
     *
     * @param {(Command|string|boolean)} helpCommand - custom help command, or deprecated enableOrNameAndArgs as for `.helpCommand()`
     * @param {string} [deprecatedDescription] - deprecated custom description used with custom name only
     * @return {Command} `this` command for chaining
     */
    addHelpCommand(e, t) {
      return typeof e != "object" ? (this.helpCommand(e, t), this) : (this._addImplicitHelpCommand = !0, this._helpCommand = e, this);
    }
    /**
     * Lazy create help command.
     *
     * @return {(Command|null)}
     * @package
     */
    _getHelpCommand() {
      return this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help")) ? (this._helpCommand ===
      void 0 && this.helpCommand(void 0, void 0), this._helpCommand) : null;
    }
    /**
     * Add hook for life cycle event.
     *
     * @param {string} event
     * @param {Function} listener
     * @return {Command} `this` command for chaining
     */
    hook(e, t) {
      let s = ["preSubcommand", "preAction", "postAction"];
      if (!s.includes(e))
        throw new Error(`Unexpected value for event passed to hook : '${e}'.
Expecting one of '${s.join("', '")}'`);
      return this._lifeCycleHooks[e] ? this._lifeCycleHooks[e].push(t) : this._lifeCycleHooks[e] = [t], this;
    }
    /**
     * Register callback to use as replacement for calling process.exit.
     *
     * @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
     * @return {Command} `this` command for chaining
     */
    exitOverride(e) {
      return e ? this._exitCallback = e : this._exitCallback = (t) => {
        if (t.code !== "commander.executeSubCommandAsync")
          throw t;
      }, this;
    }
    /**
     * Call process.exit, and _exitCallback if defined.
     *
     * @param {number} exitCode exit code for using with process.exit
     * @param {string} code an id string representing the error
     * @param {string} message human-readable description of the error
     * @return never
     * @private
     */
    _exit(e, t, s) {
      this._exitCallback && this._exitCallback(new ut(e, t, s)), k.exit(e);
    }
    /**
     * Register callback `fn` for the command.
     *
     * @example
     * program
     *   .command('serve')
     *   .description('start service')
     *   .action(function() {
     *      // do work here
     *   });
     *
     * @param {Function} fn
     * @return {Command} `this` command for chaining
     */
    action(e) {
      let t = /* @__PURE__ */ d((s) => {
        let i = this.registeredArguments.length, n = s.slice(0, i);
        return this._storeOptionsAsProperties ? n[i] = this : n[i] = this.opts(), n.push(this), e.apply(this, n);
      }, "listener");
      return this._actionHandler = t, this;
    }
    /**
     * Factory routine to create a new unattached option.
     *
     * See .option() for creating an attached option, which uses this routine to
     * create the option. You can override createOption to return a custom option.
     *
     * @param {string} flags
     * @param {string} [description]
     * @return {Option} new option
     */
    createOption(e, t) {
      return new Vt(e, t);
    }
    /**
     * Wrap parseArgs to catch 'commander.invalidArgument'.
     *
     * @param {(Option | Argument)} target
     * @param {string} value
     * @param {*} previous
     * @param {string} invalidArgumentMessage
     * @private
     */
    _callParseArg(e, t, s, i) {
      try {
        return e.parseArg(t, s);
      } catch (n) {
        if (n.code === "commander.invalidArgument") {
          let a = `${i} ${n.message}`;
          this.error(a, { exitCode: n.exitCode, code: n.code });
        }
        throw n;
      }
    }
    /**
     * Check for option flag conflicts.
     * Register option if no conflicts found, or throw on conflict.
     *
     * @param {Option} option
     * @private
     */
    _registerOption(e) {
      let t = e.short && this._findOption(e.short) || e.long && this._findOption(e.long);
      if (t) {
        let s = e.long && this._findOption(e.long) ? e.long : e.short;
        throw new Error(`Cannot add option '${e.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${s}'
-  already used by option '${t.flags}'`);
      }
      this.options.push(e);
    }
    /**
     * Check for command name and alias conflicts with existing commands.
     * Register command if no conflicts found, or throw on conflict.
     *
     * @param {Command} command
     * @private
     */
    _registerCommand(e) {
      let t = /* @__PURE__ */ d((i) => [i.name()].concat(i.aliases()), "knownBy"), s = t(e).find(
        (i) => this._findCommand(i)
      );
      if (s) {
        let i = t(this._findCommand(s)).join("|"), n = t(e).join("|");
        throw new Error(
          `cannot add command '${n}' as already have command '${i}'`
        );
      }
      this.commands.push(e);
    }
    /**
     * Add an option.
     *
     * @param {Option} option
     * @return {Command} `this` command for chaining
     */
    addOption(e) {
      this._registerOption(e);
      let t = e.name(), s = e.attributeName();
      if (e.negate) {
        let n = e.long.replace(/^--no-/, "--");
        this._findOption(n) || this.setOptionValueWithSource(
          s,
          e.defaultValue === void 0 ? !0 : e.defaultValue,
          "default"
        );
      } else e.defaultValue !== void 0 && this.setOptionValueWithSource(s, e.defaultValue, "default");
      let i = /* @__PURE__ */ d((n, a, o) => {
        n == null && e.presetArg !== void 0 && (n = e.presetArg);
        let c = this.getOptionValue(s);
        n !== null && e.parseArg ? n = this._callParseArg(e, n, c, a) : n !== null && e.variadic && (n = e._concatValue(n, c)), n == null &&
        (e.negate ? n = !1 : e.isBoolean() || e.optional ? n = !0 : n = ""), this.setOptionValueWithSource(s, n, o);
      }, "handleOptionValue");
      return this.on("option:" + t, (n) => {
        let a = `error: option '${e.flags}' argument '${n}' is invalid.`;
        i(n, a, "cli");
      }), e.envVar && this.on("optionEnv:" + t, (n) => {
        let a = `error: option '${e.flags}' value '${n}' from env '${e.envVar}' is invalid.`;
        i(n, a, "env");
      }), this;
    }
    /**
     * Internal implementation shared by .option() and .requiredOption()
     *
     * @return {Command} `this` command for chaining
     * @private
     */
    _optionEx(e, t, s, i, n) {
      if (typeof t == "object" && t instanceof Vt)
        throw new Error(
          "To add an Option object use addOption() instead of option() or requiredOption()"
        );
      let a = this.createOption(t, s);
      if (a.makeOptionMandatory(!!e.mandatory), typeof i == "function")
        a.default(n).argParser(i);
      else if (i instanceof RegExp) {
        let o = i;
        i = /* @__PURE__ */ d((c, h) => {
          let p = o.exec(c);
          return p ? p[0] : h;
        }, "fn"), a.default(n).argParser(i);
      } else
        a.default(i);
      return this.addOption(a);
    }
    /**
     * Define option with `flags`, `description`, and optional argument parsing function or `defaultValue` or both.
     *
     * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space. A required
     * option-argument is indicated by `<>` and an optional option-argument by `[]`.
     *
     * See the README for more details, and see also addOption() and requiredOption().
     *
     * @example
     * program
     *     .option('-p, --pepper', 'add pepper')
     *     .option('-p, --pizza-type <TYPE>', 'type of pizza') // required option-argument
     *     .option('-c, --cheese [CHEESE]', 'add extra cheese', 'mozzarella') // optional option-argument with default
     *     .option('-t, --tip <VALUE>', 'add tip to purchase cost', parseFloat) // custom parse function
     *
     * @param {string} flags
     * @param {string} [description]
     * @param {(Function|*)} [parseArg] - custom option processing function or default value
     * @param {*} [defaultValue]
     * @return {Command} `this` command for chaining
     */
    option(e, t, s, i) {
      return this._optionEx({}, e, t, s, i);
    }
    /**
     * Add a required option which must have a value after parsing. This usually means
     * the option must be specified on the command line. (Otherwise the same as .option().)
     *
     * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space.
     *
     * @param {string} flags
     * @param {string} [description]
     * @param {(Function|*)} [parseArg] - custom option processing function or default value
     * @param {*} [defaultValue]
     * @return {Command} `this` command for chaining
     */
    requiredOption(e, t, s, i) {
      return this._optionEx(
        { mandatory: !0 },
        e,
        t,
        s,
        i
      );
    }
    /**
     * Alter parsing of short flags with optional values.
     *
     * @example
     * // for `.option('-f,--flag [value]'):
     * program.combineFlagAndOptionalValue(true);  // `-f80` is treated like `--flag=80`, this is the default behaviour
     * program.combineFlagAndOptionalValue(false) // `-fb` is treated like `-f -b`
     *
     * @param {boolean} [combine] - if `true` or omitted, an optional value can be specified directly after the flag.
     * @return {Command} `this` command for chaining
     */
    combineFlagAndOptionalValue(e = !0) {
      return this._combineFlagAndOptionalValue = !!e, this;
    }
    /**
     * Allow unknown options on the command line.
     *
     * @param {boolean} [allowUnknown] - if `true` or omitted, no error will be thrown for unknown options.
     * @return {Command} `this` command for chaining
     */
    allowUnknownOption(e = !0) {
      return this._allowUnknownOption = !!e, this;
    }
    /**
     * Allow excess command-arguments on the command line. Pass false to make excess arguments an error.
     *
     * @param {boolean} [allowExcess] - if `true` or omitted, no error will be thrown for excess arguments.
     * @return {Command} `this` command for chaining
     */
    allowExcessArguments(e = !0) {
      return this._allowExcessArguments = !!e, this;
    }
    /**
     * Enable positional options. Positional means global options are specified before subcommands which lets
     * subcommands reuse the same option names, and also enables subcommands to turn on passThroughOptions.
     * The default behaviour is non-positional and global options may appear anywhere on the command line.
     *
     * @param {boolean} [positional]
     * @return {Command} `this` command for chaining
     */
    enablePositionalOptions(e = !0) {
      return this._enablePositionalOptions = !!e, this;
    }
    /**
     * Pass through options that come after command-arguments rather than treat them as command-options,
     * so actual command-options come before command-arguments. Turning this on for a subcommand requires
     * positional options to have been enabled on the program (parent commands).
     * The default behaviour is non-positional and options may appear before or after command-arguments.
     *
     * @param {boolean} [passThrough] for unknown options.
     * @return {Command} `this` command for chaining
     */
    passThroughOptions(e = !0) {
      return this._passThroughOptions = !!e, this._checkForBrokenPassThrough(), this;
    }
    /**
     * @private
     */
    _checkForBrokenPassThrough() {
      if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions)
        throw new Error(
          `passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`
        );
    }
    /**
     * Whether to store option values as properties on command object,
     * or store separately (specify false). In both cases the option values can be accessed using .opts().
     *
     * @param {boolean} [storeAsProperties=true]
     * @return {Command} `this` command for chaining
     */
    storeOptionsAsProperties(e = !0) {
      if (this.options.length)
        throw new Error("call .storeOptionsAsProperties() before adding options");
      if (Object.keys(this._optionValues).length)
        throw new Error(
          "call .storeOptionsAsProperties() before setting option values"
        );
      return this._storeOptionsAsProperties = !!e, this;
    }
    /**
     * Retrieve option value.
     *
     * @param {string} key
     * @return {object} value
     */
    getOptionValue(e) {
      return this._storeOptionsAsProperties ? this[e] : this._optionValues[e];
    }
    /**
     * Store option value.
     *
     * @param {string} key
     * @param {object} value
     * @return {Command} `this` command for chaining
     */
    setOptionValue(e, t) {
      return this.setOptionValueWithSource(e, t, void 0);
    }
    /**
     * Store option value and where the value came from.
     *
     * @param {string} key
     * @param {object} value
     * @param {string} source - expected values are default/config/env/cli/implied
     * @return {Command} `this` command for chaining
     */
    setOptionValueWithSource(e, t, s) {
      return this._storeOptionsAsProperties ? this[e] = t : this._optionValues[e] = t, this._optionValueSources[e] = s, this;
    }
    /**
     * Get source of option value.
     * Expected values are default | config | env | cli | implied
     *
     * @param {string} key
     * @return {string}
     */
    getOptionValueSource(e) {
      return this._optionValueSources[e];
    }
    /**
     * Get source of option value. See also .optsWithGlobals().
     * Expected values are default | config | env | cli | implied
     *
     * @param {string} key
     * @return {string}
     */
    getOptionValueSourceWithGlobals(e) {
      let t;
      return this._getCommandAndAncestors().forEach((s) => {
        s.getOptionValueSource(e) !== void 0 && (t = s.getOptionValueSource(e));
      }), t;
    }
    /**
     * Get user arguments from implied or explicit arguments.
     * Side-effects: set _scriptPath if args included script. Used for default program name, and subcommand searches.
     *
     * @private
     */
    _prepareUserArgs(e, t) {
      if (e !== void 0 && !Array.isArray(e))
        throw new Error("first parameter to parse must be array or undefined");
      if (t = t || {}, e === void 0 && t.from === void 0) {
        k.versions?.electron && (t.from = "electron");
        let i = k.execArgv ?? [];
        (i.includes("-e") || i.includes("--eval") || i.includes("-p") || i.includes("--print")) && (t.from = "eval");
      }
      e === void 0 && (e = k.argv), this.rawArgs = e.slice();
      let s;
      switch (t.from) {
        case void 0:
        case "node":
          this._scriptPath = e[1], s = e.slice(2);
          break;
        case "electron":
          k.defaultApp ? (this._scriptPath = e[1], s = e.slice(2)) : s = e.slice(1);
          break;
        case "user":
          s = e.slice(0);
          break;
        case "eval":
          s = e.slice(1);
          break;
        default:
          throw new Error(
            `unexpected parse option { from: '${t.from}' }`
          );
      }
      return !this._name && this._scriptPath && this.nameFromFilename(this._scriptPath), this._name = this._name || "program", s;
    }
    /**
     * Parse `argv`, setting options and invoking commands when defined.
     *
     * Use parseAsync instead of parse if any of your action handlers are async.
     *
     * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
     *
     * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
     * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
     * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
     * - `'user'`: just user arguments
     *
     * @example
     * program.parse(); // parse process.argv and auto-detect electron and special node flags
     * program.parse(process.argv); // assume argv[0] is app and argv[1] is script
     * program.parse(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
     *
     * @param {string[]} [argv] - optional, defaults to process.argv
     * @param {object} [parseOptions] - optionally specify style of options with from: node/user/electron
     * @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
     * @return {Command} `this` command for chaining
     */
    parse(e, t) {
      let s = this._prepareUserArgs(e, t);
      return this._parseCommand([], s), this;
    }
    /**
     * Parse `argv`, setting options and invoking commands when defined.
     *
     * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
     *
     * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
     * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
     * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
     * - `'user'`: just user arguments
     *
     * @example
     * await program.parseAsync(); // parse process.argv and auto-detect electron and special node flags
     * await program.parseAsync(process.argv); // assume argv[0] is app and argv[1] is script
     * await program.parseAsync(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
     *
     * @param {string[]} [argv]
     * @param {object} [parseOptions]
     * @param {string} parseOptions.from - where the args are from: 'node', 'user', 'electron'
     * @return {Promise}
     */
    async parseAsync(e, t) {
      let s = this._prepareUserArgs(e, t);
      return await this._parseCommand([], s), this;
    }
    /**
     * Execute a sub-command executable.
     *
     * @private
     */
    _executeSubCommand(e, t) {
      t = t.slice();
      let s = !1, i = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
      function n(p, y) {
        let C = L.resolve(p, y);
        if (lt.existsSync(C)) return C;
        if (i.includes(L.extname(y))) return;
        let j = i.find(
          (I) => lt.existsSync(`${C}${I}`)
        );
        if (j) return `${C}${j}`;
      }
      d(n, "findFile"), this._checkForMissingMandatoryOptions(), this._checkForConflictingOptions();
      let a = e._executableFile || `${this._name}-${e._name}`, o = this._executableDir || "";
      if (this._scriptPath) {
        let p;
        try {
          p = lt.realpathSync(this._scriptPath);
        } catch {
          p = this._scriptPath;
        }
        o = L.resolve(
          L.dirname(p),
          o
        );
      }
      if (o) {
        let p = n(o, a);
        if (!p && !e._executableFile && this._scriptPath) {
          let y = L.basename(
            this._scriptPath,
            L.extname(this._scriptPath)
          );
          y !== this._name && (p = n(
            o,
            `${y}-${e._name}`
          ));
        }
        a = p || a;
      }
      s = i.includes(L.extname(a));
      let c;
      k.platform !== "win32" ? s ? (t.unshift(a), t = $t(k.execArgv).concat(t), c = dt.spawn(k.argv[0], t, { stdio: "inherit" })) : c = dt.spawn(
      a, t, { stdio: "inherit" }) : (t.unshift(a), t = $t(k.execArgv).concat(t), c = dt.spawn(k.execPath, t, { stdio: "inherit" })), c.killed ||
      ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"].forEach((y) => {
        k.on(y, () => {
          c.killed === !1 && c.exitCode === null && c.kill(y);
        });
      });
      let h = this._exitCallback;
      c.on("close", (p) => {
        p = p ?? 1, h ? h(
          new ut(
            p,
            "commander.executeSubCommandAsync",
            "(close)"
          )
        ) : k.exit(p);
      }), c.on("error", (p) => {
        if (p.code === "ENOENT") {
          let y = o ? `searched for local subcommand relative to directory '${o}'` : "no directory for search for local subcommand, use .exe\
cutableDir() to supply a custom directory", C = `'${a}' does not exist
 - if '${e._name}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead\

 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${y}`;
          throw new Error(C);
        } else if (p.code === "EACCES")
          throw new Error(`'${a}' not executable`);
        if (!h)
          k.exit(1);
        else {
          let y = new ut(
            1,
            "commander.executeSubCommandAsync",
            "(error)"
          );
          y.nestedError = p, h(y);
        }
      }), this.runningCommand = c;
    }
    /**
     * @private
     */
    _dispatchSubcommand(e, t, s) {
      let i = this._findCommand(e);
      i || this.help({ error: !0 });
      let n;
      return n = this._chainOrCallSubCommandHook(
        n,
        i,
        "preSubcommand"
      ), n = this._chainOrCall(n, () => {
        if (i._executableHandler)
          this._executeSubCommand(i, t.concat(s));
        else
          return i._parseCommand(t, s);
      }), n;
    }
    /**
     * Invoke help directly if possible, or dispatch if necessary.
     * e.g. help foo
     *
     * @private
     */
    _dispatchHelpCommand(e) {
      e || this.help();
      let t = this._findCommand(e);
      return t && !t._executableHandler && t.help(), this._dispatchSubcommand(
        e,
        [],
        [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]
      );
    }
    /**
     * Check this.args against expected this.registeredArguments.
     *
     * @private
     */
    _checkNumberOfArguments() {
      this.registeredArguments.forEach((e, t) => {
        e.required && this.args[t] == null && this.missingArgument(e.name());
      }), !(this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) && this.args.length >
      this.registeredArguments.length && this._excessArguments(this.args);
    }
    /**
     * Process this.args using this.registeredArguments and save as this.processedArgs!
     *
     * @private
     */
    _processArguments() {
      let e = /* @__PURE__ */ d((s, i, n) => {
        let a = i;
        if (i !== null && s.parseArg) {
          let o = `error: command-argument value '${i}' is invalid for argument '${s.name()}'.`;
          a = this._callParseArg(
            s,
            i,
            n,
            o
          );
        }
        return a;
      }, "myParseArg");
      this._checkNumberOfArguments();
      let t = [];
      this.registeredArguments.forEach((s, i) => {
        let n = s.defaultValue;
        s.variadic ? i < this.args.length ? (n = this.args.slice(i), s.parseArg && (n = n.reduce((a, o) => e(s, o, a), s.defaultValue))) : n ===
        void 0 && (n = []) : i < this.args.length && (n = this.args[i], s.parseArg && (n = e(s, n, s.defaultValue))), t[i] = n;
      }), this.processedArgs = t;
    }
    /**
     * Once we have a promise we chain, but call synchronously until then.
     *
     * @param {(Promise|undefined)} promise
     * @param {Function} fn
     * @return {(Promise|undefined)}
     * @private
     */
    _chainOrCall(e, t) {
      return e && e.then && typeof e.then == "function" ? e.then(() => t()) : t();
    }
    /**
     *
     * @param {(Promise|undefined)} promise
     * @param {string} event
     * @return {(Promise|undefined)}
     * @private
     */
    _chainOrCallHooks(e, t) {
      let s = e, i = [];
      return this._getCommandAndAncestors().reverse().filter((n) => n._lifeCycleHooks[t] !== void 0).forEach((n) => {
        n._lifeCycleHooks[t].forEach((a) => {
          i.push({ hookedCommand: n, callback: a });
        });
      }), t === "postAction" && i.reverse(), i.forEach((n) => {
        s = this._chainOrCall(s, () => n.callback(n.hookedCommand, this));
      }), s;
    }
    /**
     *
     * @param {(Promise|undefined)} promise
     * @param {Command} subCommand
     * @param {string} event
     * @return {(Promise|undefined)}
     * @private
     */
    _chainOrCallSubCommandHook(e, t, s) {
      let i = e;
      return this._lifeCycleHooks[s] !== void 0 && this._lifeCycleHooks[s].forEach((n) => {
        i = this._chainOrCall(i, () => n(this, t));
      }), i;
    }
    /**
     * Process arguments in context of this command.
     * Returns action result, in case it is a promise.
     *
     * @private
     */
    _parseCommand(e, t) {
      let s = this.parseOptions(t);
      if (this._parseOptionsEnv(), this._parseOptionsImplied(), e = e.concat(s.operands), t = s.unknown, this.args = e.concat(t), e && this.
      _findCommand(e[0]))
        return this._dispatchSubcommand(e[0], e.slice(1), t);
      if (this._getHelpCommand() && e[0] === this._getHelpCommand().name())
        return this._dispatchHelpCommand(e[1]);
      if (this._defaultCommandName)
        return this._outputHelpIfRequested(t), this._dispatchSubcommand(
          this._defaultCommandName,
          e,
          t
        );
      this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName && this.help({ error: !0 }), this.
      _outputHelpIfRequested(s.unknown), this._checkForMissingMandatoryOptions(), this._checkForConflictingOptions();
      let i = /* @__PURE__ */ d(() => {
        s.unknown.length > 0 && this.unknownOption(s.unknown[0]);
      }, "checkForUnknownOptions"), n = `command:${this.name()}`;
      if (this._actionHandler) {
        i(), this._processArguments();
        let a;
        return a = this._chainOrCallHooks(a, "preAction"), a = this._chainOrCall(
          a,
          () => this._actionHandler(this.processedArgs)
        ), this.parent && (a = this._chainOrCall(a, () => {
          this.parent.emit(n, e, t);
        })), a = this._chainOrCallHooks(a, "postAction"), a;
      }
      if (this.parent && this.parent.listenerCount(n))
        i(), this._processArguments(), this.parent.emit(n, e, t);
      else if (e.length) {
        if (this._findCommand("*"))
          return this._dispatchSubcommand("*", e, t);
        this.listenerCount("command:*") ? this.emit("command:*", e, t) : this.commands.length ? this.unknownCommand() : (i(), this._processArguments());
      } else this.commands.length ? (i(), this.help({ error: !0 })) : (i(), this._processArguments());
    }
    /**
     * Find matching command.
     *
     * @private
     * @return {Command | undefined}
     */
    _findCommand(e) {
      if (e)
        return this.commands.find(
          (t) => t._name === e || t._aliases.includes(e)
        );
    }
    /**
     * Return an option matching `arg` if any.
     *
     * @param {string} arg
     * @return {Option}
     * @package
     */
    _findOption(e) {
      return this.options.find((t) => t.is(e));
    }
    /**
     * Display an error message if a mandatory option does not have a value.
     * Called after checking for help flags in leaf subcommand.
     *
     * @private
     */
    _checkForMissingMandatoryOptions() {
      this._getCommandAndAncestors().forEach((e) => {
        e.options.forEach((t) => {
          t.mandatory && e.getOptionValue(t.attributeName()) === void 0 && e.missingMandatoryOptionValue(t);
        });
      });
    }
    /**
     * Display an error message if conflicting options are used together in this.
     *
     * @private
     */
    _checkForConflictingLocalOptions() {
      let e = this.options.filter((s) => {
        let i = s.attributeName();
        return this.getOptionValue(i) === void 0 ? !1 : this.getOptionValueSource(i) !== "default";
      });
      e.filter(
        (s) => s.conflictsWith.length > 0
      ).forEach((s) => {
        let i = e.find(
          (n) => s.conflictsWith.includes(n.attributeName())
        );
        i && this._conflictingOption(s, i);
      });
    }
    /**
     * Display an error message if conflicting options are used together.
     * Called after checking for help flags in leaf subcommand.
     *
     * @private
     */
    _checkForConflictingOptions() {
      this._getCommandAndAncestors().forEach((e) => {
        e._checkForConflictingLocalOptions();
      });
    }
    /**
     * Parse options from `argv` removing known options,
     * and return argv split into operands and unknown arguments.
     *
     * Examples:
     *
     *     argv => operands, unknown
     *     --known kkk op => [op], []
     *     op --known kkk => [op], []
     *     sub --unknown uuu op => [sub], [--unknown uuu op]
     *     sub -- --unknown uuu op => [sub --unknown uuu op], []
     *
     * @param {string[]} argv
     * @return {{operands: string[], unknown: string[]}}
     */
    parseOptions(e) {
      let t = [], s = [], i = t, n = e.slice();
      function a(c) {
        return c.length > 1 && c[0] === "-";
      }
      d(a, "maybeOption");
      let o = null;
      for (; n.length; ) {
        let c = n.shift();
        if (c === "--") {
          i === s && i.push(c), i.push(...n);
          break;
        }
        if (o && !a(c)) {
          this.emit(`option:${o.name()}`, c);
          continue;
        }
        if (o = null, a(c)) {
          let h = this._findOption(c);
          if (h) {
            if (h.required) {
              let p = n.shift();
              p === void 0 && this.optionMissingArgument(h), this.emit(`option:${h.name()}`, p);
            } else if (h.optional) {
              let p = null;
              n.length > 0 && !a(n[0]) && (p = n.shift()), this.emit(`option:${h.name()}`, p);
            } else
              this.emit(`option:${h.name()}`);
            o = h.variadic ? h : null;
            continue;
          }
        }
        if (c.length > 2 && c[0] === "-" && c[1] !== "-") {
          let h = this._findOption(`-${c[1]}`);
          if (h) {
            h.required || h.optional && this._combineFlagAndOptionalValue ? this.emit(`option:${h.name()}`, c.slice(2)) : (this.emit(`option\
:${h.name()}`), n.unshift(`-${c.slice(2)}`));
            continue;
          }
        }
        if (/^--[^=]+=/.test(c)) {
          let h = c.indexOf("="), p = this._findOption(c.slice(0, h));
          if (p && (p.required || p.optional)) {
            this.emit(`option:${p.name()}`, c.slice(h + 1));
            continue;
          }
        }
        if (a(c) && (i = s), (this._enablePositionalOptions || this._passThroughOptions) && t.length === 0 && s.length === 0) {
          if (this._findCommand(c)) {
            t.push(c), n.length > 0 && s.push(...n);
            break;
          } else if (this._getHelpCommand() && c === this._getHelpCommand().name()) {
            t.push(c), n.length > 0 && t.push(...n);
            break;
          } else if (this._defaultCommandName) {
            s.push(c), n.length > 0 && s.push(...n);
            break;
          }
        }
        if (this._passThroughOptions) {
          i.push(c), n.length > 0 && i.push(...n);
          break;
        }
        i.push(c);
      }
      return { operands: t, unknown: s };
    }
    /**
     * Return an object containing local option values as key-value pairs.
     *
     * @return {object}
     */
    opts() {
      if (this._storeOptionsAsProperties) {
        let e = {}, t = this.options.length;
        for (let s = 0; s < t; s++) {
          let i = this.options[s].attributeName();
          e[i] = i === this._versionOptionName ? this._version : this[i];
        }
        return e;
      }
      return this._optionValues;
    }
    /**
     * Return an object containing merged local and global option values as key-value pairs.
     *
     * @return {object}
     */
    optsWithGlobals() {
      return this._getCommandAndAncestors().reduce(
        (e, t) => Object.assign(e, t.opts()),
        {}
      );
    }
    /**
     * Display error message and exit (or call exitOverride).
     *
     * @param {string} message
     * @param {object} [errorOptions]
     * @param {string} [errorOptions.code] - an id string representing the error
     * @param {number} [errorOptions.exitCode] - used with process.exit
     */
    error(e, t) {
      this._outputConfiguration.outputError(
        `${e}
`,
        this._outputConfiguration.writeErr
      ), typeof this._showHelpAfterError == "string" ? this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`) : this._showHelpAfterError && (this._outputConfiguration.writeErr(`
`), this.outputHelp({ error: !0 }));
      let s = t || {}, i = s.exitCode || 1, n = s.code || "commander.error";
      this._exit(i, n, e);
    }
    /**
     * Apply any option related environment variables, if option does
     * not have a value from cli or client code.
     *
     * @private
     */
    _parseOptionsEnv() {
      this.options.forEach((e) => {
        if (e.envVar && e.envVar in k.env) {
          let t = e.attributeName();
          (this.getOptionValue(t) === void 0 || ["default", "config", "env"].includes(
            this.getOptionValueSource(t)
          )) && (e.required || e.optional ? this.emit(`optionEnv:${e.name()}`, k.env[e.envVar]) : this.emit(`optionEnv:${e.name()}`));
        }
      });
    }
    /**
     * Apply any implied option values, if option is undefined or default value.
     *
     * @private
     */
    _parseOptionsImplied() {
      let e = new zs(this.options), t = /* @__PURE__ */ d((s) => this.getOptionValue(s) !== void 0 && !["default", "implied"].includes(this.
      getOptionValueSource(s)), "hasCustomOptionValue");
      this.options.filter(
        (s) => s.implied !== void 0 && t(s.attributeName()) && e.valueFromOption(
          this.getOptionValue(s.attributeName()),
          s
        )
      ).forEach((s) => {
        Object.keys(s.implied).filter((i) => !t(i)).forEach((i) => {
          this.setOptionValueWithSource(
            i,
            s.implied[i],
            "implied"
          );
        });
      });
    }
    /**
     * Argument `name` is missing.
     *
     * @param {string} name
     * @private
     */
    missingArgument(e) {
      let t = `error: missing required argument '${e}'`;
      this.error(t, { code: "commander.missingArgument" });
    }
    /**
     * `Option` is missing an argument.
     *
     * @param {Option} option
     * @private
     */
    optionMissingArgument(e) {
      let t = `error: option '${e.flags}' argument missing`;
      this.error(t, { code: "commander.optionMissingArgument" });
    }
    /**
     * `Option` does not have a value, and is a mandatory option.
     *
     * @param {Option} option
     * @private
     */
    missingMandatoryOptionValue(e) {
      let t = `error: required option '${e.flags}' not specified`;
      this.error(t, { code: "commander.missingMandatoryOptionValue" });
    }
    /**
     * `Option` conflicts with another option.
     *
     * @param {Option} option
     * @param {Option} conflictingOption
     * @private
     */
    _conflictingOption(e, t) {
      let s = /* @__PURE__ */ d((a) => {
        let o = a.attributeName(), c = this.getOptionValue(o), h = this.options.find(
          (y) => y.negate && o === y.attributeName()
        ), p = this.options.find(
          (y) => !y.negate && o === y.attributeName()
        );
        return h && (h.presetArg === void 0 && c === !1 || h.presetArg !== void 0 && c === h.presetArg) ? h : p || a;
      }, "findBestOptionFromValue"), i = /* @__PURE__ */ d((a) => {
        let o = s(a), c = o.attributeName();
        return this.getOptionValueSource(c) === "env" ? `environment variable '${o.envVar}'` : `option '${o.flags}'`;
      }, "getErrorMessage"), n = `error: ${i(e)} cannot be used with ${i(t)}`;
      this.error(n, { code: "commander.conflictingOption" });
    }
    /**
     * Unknown option `flag`.
     *
     * @param {string} flag
     * @private
     */
    unknownOption(e) {
      if (this._allowUnknownOption) return;
      let t = "";
      if (e.startsWith("--") && this._showSuggestionAfterError) {
        let i = [], n = this;
        do {
          let a = n.createHelp().visibleOptions(n).filter((o) => o.long).map((o) => o.long);
          i = i.concat(a), n = n.parent;
        } while (n && !n._enablePositionalOptions);
        t = Dt(e, i);
      }
      let s = `error: unknown option '${e}'${t}`;
      this.error(s, { code: "commander.unknownOption" });
    }
    /**
     * Excess arguments, more than expected.
     *
     * @param {string[]} receivedArgs
     * @private
     */
    _excessArguments(e) {
      if (this._allowExcessArguments) return;
      let t = this.registeredArguments.length, s = t === 1 ? "" : "s", n = `error: too many arguments${this.parent ? ` for '${this.name()}'` :
      ""}. Expected ${t} argument${s} but got ${e.length}.`;
      this.error(n, { code: "commander.excessArguments" });
    }
    /**
     * Unknown command.
     *
     * @private
     */
    unknownCommand() {
      let e = this.args[0], t = "";
      if (this._showSuggestionAfterError) {
        let i = [];
        this.createHelp().visibleCommands(this).forEach((n) => {
          i.push(n.name()), n.alias() && i.push(n.alias());
        }), t = Dt(e, i);
      }
      let s = `error: unknown command '${e}'${t}`;
      this.error(s, { code: "commander.unknownCommand" });
    }
    /**
     * Get or set the program version.
     *
     * This method auto-registers the "-V, --version" option which will print the version number.
     *
     * You can optionally supply the flags and description to override the defaults.
     *
     * @param {string} [str]
     * @param {string} [flags]
     * @param {string} [description]
     * @return {(this | string | undefined)} `this` command for chaining, or version string if no arguments
     */
    version(e, t, s) {
      if (e === void 0) return this._version;
      this._version = e, t = t || "-V, --version", s = s || "output the version number";
      let i = this.createOption(t, s);
      return this._versionOptionName = i.attributeName(), this._registerOption(i), this.on("option:" + i.name(), () => {
        this._outputConfiguration.writeOut(`${e}
`), this._exit(0, "commander.version", e);
      }), this;
    }
    /**
     * Set the description.
     *
     * @param {string} [str]
     * @param {object} [argsDescription]
     * @return {(string|Command)}
     */
    description(e, t) {
      return e === void 0 && t === void 0 ? this._description : (this._description = e, t && (this._argsDescription = t), this);
    }
    /**
     * Set the summary. Used when listed as subcommand of parent.
     *
     * @param {string} [str]
     * @return {(string|Command)}
     */
    summary(e) {
      return e === void 0 ? this._summary : (this._summary = e, this);
    }
    /**
     * Set an alias for the command.
     *
     * You may call more than once to add multiple aliases. Only the first alias is shown in the auto-generated help.
     *
     * @param {string} [alias]
     * @return {(string|Command)}
     */
    alias(e) {
      if (e === void 0) return this._aliases[0];
      let t = this;
      if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler && (t = this.commands[this.commands.length -
      1]), e === t._name)
        throw new Error("Command alias can't be the same as its name");
      let s = this.parent?._findCommand(e);
      if (s) {
        let i = [s.name()].concat(s.aliases()).join("|");
        throw new Error(
          `cannot add alias '${e}' to command '${this.name()}' as already have command '${i}'`
        );
      }
      return t._aliases.push(e), this;
    }
    /**
     * Set aliases for the command.
     *
     * Only the first alias is shown in the auto-generated help.
     *
     * @param {string[]} [aliases]
     * @return {(string[]|Command)}
     */
    aliases(e) {
      return e === void 0 ? this._aliases : (e.forEach((t) => this.alias(t)), this);
    }
    /**
     * Set / get the command usage `str`.
     *
     * @param {string} [str]
     * @return {(string|Command)}
     */
    usage(e) {
      if (e === void 0) {
        if (this._usage) return this._usage;
        let t = this.registeredArguments.map((s) => Bs(s));
        return [].concat(
          this.options.length || this._helpOption !== null ? "[options]" : [],
          this.commands.length ? "[command]" : [],
          this.registeredArguments.length ? t : []
        ).join(" ");
      }
      return this._usage = e, this;
    }
    /**
     * Get or set the name of the command.
     *
     * @param {string} [str]
     * @return {(string|Command)}
     */
    name(e) {
      return e === void 0 ? this._name : (this._name = e, this);
    }
    /**
     * Set the name of the command from script filename, such as process.argv[1],
     * or require.main.filename, or __filename.
     *
     * (Used internally and public although not documented in README.)
     *
     * @example
     * program.nameFromFilename(require.main.filename);
     *
     * @param {string} filename
     * @return {Command}
     */
    nameFromFilename(e) {
      return this._name = L.basename(e, L.extname(e)), this;
    }
    /**
     * Get or set the directory for searching for executable subcommands of this command.
     *
     * @example
     * program.executableDir(__dirname);
     * // or
     * program.executableDir('subcommands');
     *
     * @param {string} [path]
     * @return {(string|null|Command)}
     */
    executableDir(e) {
      return e === void 0 ? this._executableDir : (this._executableDir = e, this);
    }
    /**
     * Return program help documentation.
     *
     * @param {{ error: boolean }} [contextOptions] - pass {error:true} to wrap for stderr instead of stdout
     * @return {string}
     */
    helpInformation(e) {
      let t = this.createHelp();
      return t.helpWidth === void 0 && (t.helpWidth = e && e.error ? this._outputConfiguration.getErrHelpWidth() : this._outputConfiguration.
      getOutHelpWidth()), t.formatHelp(this, t);
    }
    /**
     * @private
     */
    _getHelpContext(e) {
      e = e || {};
      let t = { error: !!e.error }, s;
      return t.error ? s = /* @__PURE__ */ d((i) => this._outputConfiguration.writeErr(i), "write") : s = /* @__PURE__ */ d((i) => this._outputConfiguration.
      writeOut(i), "write"), t.write = e.write || s, t.command = this, t;
    }
    /**
     * Output help information for this command.
     *
     * Outputs built-in help, and custom text added using `.addHelpText()`.
     *
     * @param {{ error: boolean } | Function} [contextOptions] - pass {error:true} to write to stderr instead of stdout
     */
    outputHelp(e) {
      let t;
      typeof e == "function" && (t = e, e = void 0);
      let s = this._getHelpContext(e);
      this._getCommandAndAncestors().reverse().forEach((n) => n.emit("beforeAllHelp", s)), this.emit("beforeHelp", s);
      let i = this.helpInformation(s);
      if (t && (i = t(i), typeof i != "string" && !Buffer.isBuffer(i)))
        throw new Error("outputHelp callback must return a string or a Buffer");
      s.write(i), this._getHelpOption()?.long && this.emit(this._getHelpOption().long), this.emit("afterHelp", s), this._getCommandAndAncestors().
      forEach(
        (n) => n.emit("afterAllHelp", s)
      );
    }
    /**
     * You can pass in flags and a description to customise the built-in help option.
     * Pass in false to disable the built-in help option.
     *
     * @example
     * program.helpOption('-?, --help' 'show help'); // customise
     * program.helpOption(false); // disable
     *
     * @param {(string | boolean)} flags
     * @param {string} [description]
     * @return {Command} `this` command for chaining
     */
    helpOption(e, t) {
      return typeof e == "boolean" ? (e ? this._helpOption = this._helpOption ?? void 0 : this._helpOption = null, this) : (e = e ?? "-h, --\
help", t = t ?? "display help for command", this._helpOption = this.createOption(e, t), this);
    }
    /**
     * Lazy create help option.
     * Returns null if has been disabled with .helpOption(false).
     *
     * @returns {(Option | null)} the help option
     * @package
     */
    _getHelpOption() {
      return this._helpOption === void 0 && this.helpOption(void 0, void 0), this._helpOption;
    }
    /**
     * Supply your own option to use for the built-in help option.
     * This is an alternative to using helpOption() to customise the flags and description etc.
     *
     * @param {Option} option
     * @return {Command} `this` command for chaining
     */
    addHelpOption(e) {
      return this._helpOption = e, this;
    }
    /**
     * Output help information and exit.
     *
     * Outputs built-in help, and custom text added using `.addHelpText()`.
     *
     * @param {{ error: boolean }} [contextOptions] - pass {error:true} to write to stderr instead of stdout
     */
    help(e) {
      this.outputHelp(e);
      let t = k.exitCode || 0;
      t === 0 && e && typeof e != "function" && e.error && (t = 1), this._exit(t, "commander.help", "(outputHelp)");
    }
    /**
     * Add additional text to be displayed with the built-in help.
     *
     * Position is 'before' or 'after' to affect just this command,
     * and 'beforeAll' or 'afterAll' to affect this command and all its subcommands.
     *
     * @param {string} position - before or after built-in help
     * @param {(string | Function)} text - string to add, or a function returning a string
     * @return {Command} `this` command for chaining
     */
    addHelpText(e, t) {
      let s = ["beforeAll", "before", "after", "afterAll"];
      if (!s.includes(e))
        throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${s.join("', '")}'`);
      let i = `${e}Help`;
      return this.on(i, (n) => {
        let a;
        typeof t == "function" ? a = t({ error: n.error, command: n.command }) : a = t, a && n.write(`${a}
`);
      }), this;
    }
    /**
     * Output help information if help flags specified
     *
     * @param {Array} args - array of options to search for help flags
     * @private
     */
    _outputHelpIfRequested(e) {
      let t = this._getHelpOption();
      t && e.find((i) => t.is(i)) && (this.outputHelp(), this._exit(0, "commander.helpDisplayed", "(outputHelp)"));
    }
  };
  function $t(r) {
    return r.map((e) => {
      if (!e.startsWith("--inspect"))
        return e;
      let t, s = "127.0.0.1", i = "9229", n;
      return (n = e.match(/^(--inspect(-brk)?)$/)) !== null ? t = n[1] : (n = e.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null ? (t =
      n[1], /^\d+$/.test(n[3]) ? i = n[3] : s = n[3]) : (n = e.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null && (t = n[1], s =
      n[3], i = n[4]), t && i !== "0" ? `${t}=${s}:${parseInt(i) + 1}` : e;
    });
  }
  d($t, "incrementNodeInspectorPort");
  Rt.Command = ct;
});

// ../node_modules/commander/index.js
var Ft = T((E) => {
  var { Argument: Lt } = $e(), { Command: ht } = Mt(), { CommanderError: Gs, InvalidArgumentError: qt } = Oe(), { Help: Js } = rt(), { Option: Ut } = ot();
  E.program = new ht();
  E.createCommand = (r) => new ht(r);
  E.createOption = (r, e) => new Ut(r, e);
  E.createArgument = (r, e) => new Lt(r, e);
  E.Command = ht;
  E.Option = Ut;
  E.Argument = Lt;
  E.Help = Js;
  E.CommanderError = Gs;
  E.InvalidArgumentError = qt;
  E.InvalidOptionArgumentError = qt;
});

// ../node_modules/walk-up-path/dist/cjs/index.js
var Bt = T((Re) => {
  "use strict";
  Object.defineProperty(Re, "__esModule", { value: !0 });
  Re.walkUp = void 0;
  var Ht = ge("path"), Ys = /* @__PURE__ */ d(function* (r) {
    for (r = (0, Ht.resolve)(r); r; ) {
      yield r;
      let e = (0, Ht.dirname)(r);
      if (e === r)
        break;
      r = e;
    }
  }, "walkUp");
  Re.walkUp = Ys;
});

// ../node_modules/picocolors/picocolors.js
var Yt = T((vn, mt) => {
  var Le = process || {}, Gt = Le.argv || [], Me = Le.env || {}, sr = !(Me.NO_COLOR || Gt.includes("--no-color")) && (!!Me.FORCE_COLOR || Gt.
  includes("--color") || Le.platform === "win32" || (Le.stdout || {}).isTTY && Me.TERM !== "dumb" || !!Me.CI), rr = /* @__PURE__ */ d((r, e, t = r) => (s) => {
    let i = "" + s, n = i.indexOf(e, r.length);
    return ~n ? r + ir(i, e, t, n) + e : r + i + e;
  }, "formatter"), ir = /* @__PURE__ */ d((r, e, t, s) => {
    let i = "", n = 0;
    do
      i += r.substring(n, s) + t, n = s + e.length, s = r.indexOf(e, n);
    while (~s);
    return i + r.substring(n);
  }, "replaceClose"), Jt = /* @__PURE__ */ d((r = sr) => {
    let e = r ? rr : () => String;
    return {
      isColorSupported: r,
      reset: e("\x1B[0m", "\x1B[0m"),
      bold: e("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
      dim: e("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
      italic: e("\x1B[3m", "\x1B[23m"),
      underline: e("\x1B[4m", "\x1B[24m"),
      inverse: e("\x1B[7m", "\x1B[27m"),
      hidden: e("\x1B[8m", "\x1B[28m"),
      strikethrough: e("\x1B[9m", "\x1B[29m"),
      black: e("\x1B[30m", "\x1B[39m"),
      red: e("\x1B[31m", "\x1B[39m"),
      green: e("\x1B[32m", "\x1B[39m"),
      yellow: e("\x1B[33m", "\x1B[39m"),
      blue: e("\x1B[34m", "\x1B[39m"),
      magenta: e("\x1B[35m", "\x1B[39m"),
      cyan: e("\x1B[36m", "\x1B[39m"),
      white: e("\x1B[37m", "\x1B[39m"),
      gray: e("\x1B[90m", "\x1B[39m"),
      bgBlack: e("\x1B[40m", "\x1B[49m"),
      bgRed: e("\x1B[41m", "\x1B[49m"),
      bgGreen: e("\x1B[42m", "\x1B[49m"),
      bgYellow: e("\x1B[43m", "\x1B[49m"),
      bgBlue: e("\x1B[44m", "\x1B[49m"),
      bgMagenta: e("\x1B[45m", "\x1B[49m"),
      bgCyan: e("\x1B[46m", "\x1B[49m"),
      bgWhite: e("\x1B[47m", "\x1B[49m"),
      blackBright: e("\x1B[90m", "\x1B[39m"),
      redBright: e("\x1B[91m", "\x1B[39m"),
      greenBright: e("\x1B[92m", "\x1B[39m"),
      yellowBright: e("\x1B[93m", "\x1B[39m"),
      blueBright: e("\x1B[94m", "\x1B[39m"),
      magentaBright: e("\x1B[95m", "\x1B[39m"),
      cyanBright: e("\x1B[96m", "\x1B[39m"),
      whiteBright: e("\x1B[97m", "\x1B[39m"),
      bgBlackBright: e("\x1B[100m", "\x1B[49m"),
      bgRedBright: e("\x1B[101m", "\x1B[49m"),
      bgGreenBright: e("\x1B[102m", "\x1B[49m"),
      bgYellowBright: e("\x1B[103m", "\x1B[49m"),
      bgBlueBright: e("\x1B[104m", "\x1B[49m"),
      bgMagentaBright: e("\x1B[105m", "\x1B[49m"),
      bgCyanBright: e("\x1B[106m", "\x1B[49m"),
      bgWhiteBright: e("\x1B[107m", "\x1B[49m")
    };
  }, "createColors");
  mt.exports = Jt();
  mt.exports.createColors = Jt;
});

// ../node_modules/ts-dedent/dist/index.js
var _t = T((Ae) => {
  "use strict";
  Object.defineProperty(Ae, "__esModule", { value: !0 });
  Ae.dedent = void 0;
  function Qt(r) {
    for (var e = [], t = 1; t < arguments.length; t++)
      e[t - 1] = arguments[t];
    var s = Array.from(typeof r == "string" ? [r] : r);
    s[s.length - 1] = s[s.length - 1].replace(/\r?\n([\t ]*)$/, "");
    var i = s.reduce(function(o, c) {
      var h = c.match(/\n([\t ]+|(?!\s).)/g);
      return h ? o.concat(h.map(function(p) {
        var y, C;
        return (C = (y = p.match(/[\t ]/g)) === null || y === void 0 ? void 0 : y.length) !== null && C !== void 0 ? C : 0;
      })) : o;
    }, []);
    if (i.length) {
      var n = new RegExp(`
[	 ]{` + Math.min.apply(Math, i) + "}", "g");
      s = s.map(function(o) {
        return o.replace(n, `
`);
      });
    }
    s[0] = s[0].replace(/^\r?\n/, "");
    var a = s[0];
    return e.forEach(function(o, c) {
      var h = a.match(/(?:^|\n)( *)$/), p = h ? h[1] : "", y = o;
      typeof o == "string" && o.includes(`
`) && (y = String(o).split(`
`).map(function(C, j) {
        return j === 0 ? C : "" + p + C;
      }).join(`
`)), a += y + s[c + 1];
    }), a;
  }
  d(Qt, "dedent");
  Ae.dedent = Qt;
  Ae.default = Qt;
});

// ../node_modules/zod/lib/helpers/util.js
var Ze = T((w) => {
  "use strict";
  Object.defineProperty(w, "__esModule", { value: !0 });
  w.getParsedType = w.ZodParsedType = w.objectUtil = w.util = void 0;
  var bt;
  (function(r) {
    r.assertEqual = (i) => i;
    function e(i) {
    }
    d(e, "assertIs"), r.assertIs = e;
    function t(i) {
      throw new Error();
    }
    d(t, "assertNever"), r.assertNever = t, r.arrayToEnum = (i) => {
      let n = {};
      for (let a of i)
        n[a] = a;
      return n;
    }, r.getValidEnumValues = (i) => {
      let n = r.objectKeys(i).filter((o) => typeof i[i[o]] != "number"), a = {};
      for (let o of n)
        a[o] = i[o];
      return r.objectValues(a);
    }, r.objectValues = (i) => r.objectKeys(i).map(function(n) {
      return i[n];
    }), r.objectKeys = typeof Object.keys == "function" ? (i) => Object.keys(i) : (i) => {
      let n = [];
      for (let a in i)
        Object.prototype.hasOwnProperty.call(i, a) && n.push(a);
      return n;
    }, r.find = (i, n) => {
      for (let a of i)
        if (n(a))
          return a;
    }, r.isInteger = typeof Number.isInteger == "function" ? (i) => Number.isInteger(i) : (i) => typeof i == "number" && isFinite(i) && Math.
    floor(i) === i;
    function s(i, n = " | ") {
      return i.map((a) => typeof a == "string" ? `'${a}'` : a).join(n);
    }
    d(s, "joinValues"), r.joinValues = s, r.jsonStringifyReplacer = (i, n) => typeof n == "bigint" ? n.toString() : n;
  })(bt || (w.util = bt = {}));
  var ts;
  (function(r) {
    r.mergeShapes = (e, t) => ({
      ...e,
      ...t
      // second overwrites first
    });
  })(ts || (w.objectUtil = ts = {}));
  w.ZodParsedType = bt.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set"
  ]);
  var _r = /* @__PURE__ */ d((r) => {
    switch (typeof r) {
      case "undefined":
        return w.ZodParsedType.undefined;
      case "string":
        return w.ZodParsedType.string;
      case "number":
        return isNaN(r) ? w.ZodParsedType.nan : w.ZodParsedType.number;
      case "boolean":
        return w.ZodParsedType.boolean;
      case "function":
        return w.ZodParsedType.function;
      case "bigint":
        return w.ZodParsedType.bigint;
      case "symbol":
        return w.ZodParsedType.symbol;
      case "object":
        return Array.isArray(r) ? w.ZodParsedType.array : r === null ? w.ZodParsedType.null : r.then && typeof r.then == "function" && r.catch &&
        typeof r.catch == "function" ? w.ZodParsedType.promise : typeof Map < "u" && r instanceof Map ? w.ZodParsedType.map : typeof Set < "\
u" && r instanceof Set ? w.ZodParsedType.set : typeof Date < "u" && r instanceof Date ? w.ZodParsedType.date : w.ZodParsedType.object;
      default:
        return w.ZodParsedType.unknown;
    }
  }, "getParsedType");
  w.getParsedType = _r;
});

// ../node_modules/zod/lib/ZodError.js
var qe = T((z) => {
  "use strict";
  Object.defineProperty(z, "__esModule", { value: !0 });
  z.ZodError = z.quotelessJson = z.ZodIssueCode = void 0;
  var ss = Ze();
  z.ZodIssueCode = ss.util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite"
  ]);
  var vr = /* @__PURE__ */ d((r) => JSON.stringify(r, null, 2).replace(/"([^"]+)":/g, "$1:"), "quotelessJson");
  z.quotelessJson = vr;
  var je = class r extends Error {
    static {
      d(this, "ZodError");
    }
    get errors() {
      return this.issues;
    }
    constructor(e) {
      super(), this.issues = [], this.addIssue = (s) => {
        this.issues = [...this.issues, s];
      }, this.addIssues = (s = []) => {
        this.issues = [...this.issues, ...s];
      };
      let t = new.target.prototype;
      Object.setPrototypeOf ? Object.setPrototypeOf(this, t) : this.__proto__ = t, this.name = "ZodError", this.issues = e;
    }
    format(e) {
      let t = e || function(n) {
        return n.message;
      }, s = { _errors: [] }, i = /* @__PURE__ */ d((n) => {
        for (let a of n.issues)
          if (a.code === "invalid_union")
            a.unionErrors.map(i);
          else if (a.code === "invalid_return_type")
            i(a.returnTypeError);
          else if (a.code === "invalid_arguments")
            i(a.argumentsError);
          else if (a.path.length === 0)
            s._errors.push(t(a));
          else {
            let o = s, c = 0;
            for (; c < a.path.length; ) {
              let h = a.path[c];
              c === a.path.length - 1 ? (o[h] = o[h] || { _errors: [] }, o[h]._errors.push(t(a))) : o[h] = o[h] || { _errors: [] }, o = o[h],
              c++;
            }
          }
      }, "processError");
      return i(this), s;
    }
    static assert(e) {
      if (!(e instanceof r))
        throw new Error(`Not a ZodError: ${e}`);
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, ss.util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(e = (t) => t.message) {
      let t = {}, s = [];
      for (let i of this.issues)
        i.path.length > 0 ? (t[i.path[0]] = t[i.path[0]] || [], t[i.path[0]].push(e(i))) : s.push(e(i));
      return { formErrors: s, fieldErrors: t };
    }
    get formErrors() {
      return this.flatten();
    }
  };
  z.ZodError = je;
  je.create = (r) => new je(r);
});

// ../node_modules/zod/lib/locales/en.js
var wt = T((xt) => {
  "use strict";
  Object.defineProperty(xt, "__esModule", { value: !0 });
  var X = Ze(), O = qe(), br = /* @__PURE__ */ d((r, e) => {
    let t;
    switch (r.code) {
      case O.ZodIssueCode.invalid_type:
        r.received === X.ZodParsedType.undefined ? t = "Required" : t = `Expected ${r.expected}, received ${r.received}`;
        break;
      case O.ZodIssueCode.invalid_literal:
        t = `Invalid literal value, expected ${JSON.stringify(r.expected, X.util.jsonStringifyReplacer)}`;
        break;
      case O.ZodIssueCode.unrecognized_keys:
        t = `Unrecognized key(s) in object: ${X.util.joinValues(r.keys, ", ")}`;
        break;
      case O.ZodIssueCode.invalid_union:
        t = "Invalid input";
        break;
      case O.ZodIssueCode.invalid_union_discriminator:
        t = `Invalid discriminator value. Expected ${X.util.joinValues(r.options)}`;
        break;
      case O.ZodIssueCode.invalid_enum_value:
        t = `Invalid enum value. Expected ${X.util.joinValues(r.options)}, received '${r.received}'`;
        break;
      case O.ZodIssueCode.invalid_arguments:
        t = "Invalid function arguments";
        break;
      case O.ZodIssueCode.invalid_return_type:
        t = "Invalid function return type";
        break;
      case O.ZodIssueCode.invalid_date:
        t = "Invalid date";
        break;
      case O.ZodIssueCode.invalid_string:
        typeof r.validation == "object" ? "includes" in r.validation ? (t = `Invalid input: must include "${r.validation.includes}"`, typeof r.
        validation.position == "number" && (t = `${t} at one or more positions greater than or equal to ${r.validation.position}`)) : "start\
sWith" in r.validation ? t = `Invalid input: must start with "${r.validation.startsWith}"` : "endsWith" in r.validation ? t = `Invalid input\
: must end with "${r.validation.endsWith}"` : X.util.assertNever(r.validation) : r.validation !== "regex" ? t = `Invalid ${r.validation}` : t =
        "Invalid";
        break;
      case O.ZodIssueCode.too_small:
        r.type === "array" ? t = `Array must contain ${r.exact ? "exactly" : r.inclusive ? "at least" : "more than"} ${r.minimum} element(s)` :
        r.type === "string" ? t = `String must contain ${r.exact ? "exactly" : r.inclusive ? "at least" : "over"} ${r.minimum} character(s)` :
        r.type === "number" ? t = `Number must be ${r.exact ? "exactly equal to " : r.inclusive ? "greater than or equal to " : "greater tha\
n "}${r.minimum}` : r.type === "date" ? t = `Date must be ${r.exact ? "exactly equal to " : r.inclusive ? "greater than or equal to " : "gre\
ater than "}${new Date(Number(r.minimum))}` : t = "Invalid input";
        break;
      case O.ZodIssueCode.too_big:
        r.type === "array" ? t = `Array must contain ${r.exact ? "exactly" : r.inclusive ? "at most" : "less than"} ${r.maximum} element(s)` :
        r.type === "string" ? t = `String must contain ${r.exact ? "exactly" : r.inclusive ? "at most" : "under"} ${r.maximum} character(s)` :
        r.type === "number" ? t = `Number must be ${r.exact ? "exactly" : r.inclusive ? "less than or equal to" : "less than"} ${r.maximum}` :
        r.type === "bigint" ? t = `BigInt must be ${r.exact ? "exactly" : r.inclusive ? "less than or equal to" : "less than"} ${r.maximum}` :
        r.type === "date" ? t = `Date must be ${r.exact ? "exactly" : r.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(
        Number(r.maximum))}` : t = "Invalid input";
        break;
      case O.ZodIssueCode.custom:
        t = "Invalid input";
        break;
      case O.ZodIssueCode.invalid_intersection_types:
        t = "Intersection results could not be merged";
        break;
      case O.ZodIssueCode.not_multiple_of:
        t = `Number must be a multiple of ${r.multipleOf}`;
        break;
      case O.ZodIssueCode.not_finite:
        t = "Number must be finite";
        break;
      default:
        t = e.defaultError, X.util.assertNever(r);
    }
    return { message: t };
  }, "errorMap");
  xt.default = br;
});

// ../node_modules/zod/lib/errors.js
var Ue = T(($) => {
  "use strict";
  var xr = $ && $.__importDefault || function(r) {
    return r && r.__esModule ? r : { default: r };
  };
  Object.defineProperty($, "__esModule", { value: !0 });
  $.getErrorMap = $.setErrorMap = $.defaultErrorMap = void 0;
  var rs = xr(wt());
  $.defaultErrorMap = rs.default;
  var is = rs.default;
  function wr(r) {
    is = r;
  }
  d(wr, "setErrorMap");
  $.setErrorMap = wr;
  function Cr() {
    return is;
  }
  d(Cr, "getErrorMap");
  $.getErrorMap = Cr;
});

// ../node_modules/zod/lib/helpers/parseUtil.js
var kt = T((x) => {
  "use strict";
  var kr = x && x.__importDefault || function(r) {
    return r && r.__esModule ? r : { default: r };
  };
  Object.defineProperty(x, "__esModule", { value: !0 });
  x.isAsync = x.isValid = x.isDirty = x.isAborted = x.OK = x.DIRTY = x.INVALID = x.ParseStatus = x.addIssueToContext = x.EMPTY_PATH = x.makeIssue =
  void 0;
  var Ir = Ue(), ns = kr(wt()), Tr = /* @__PURE__ */ d((r) => {
    let { data: e, path: t, errorMaps: s, issueData: i } = r, n = [...t, ...i.path || []], a = {
      ...i,
      path: n
    };
    if (i.message !== void 0)
      return {
        ...i,
        path: n,
        message: i.message
      };
    let o = "", c = s.filter((h) => !!h).slice().reverse();
    for (let h of c)
      o = h(a, { data: e, defaultError: o }).message;
    return {
      ...i,
      path: n,
      message: o
    };
  }, "makeIssue");
  x.makeIssue = Tr;
  x.EMPTY_PATH = [];
  function Or(r, e) {
    let t = (0, Ir.getErrorMap)(), s = (0, x.makeIssue)({
      issueData: e,
      data: r.data,
      path: r.path,
      errorMaps: [
        r.common.contextualErrorMap,
        // contextual error map is first priority
        r.schemaErrorMap,
        // then schema-bound map if available
        t,
        // then global override map
        t === ns.default ? void 0 : ns.default
        // then global default map
      ].filter((i) => !!i)
    });
    r.common.issues.push(s);
  }
  d(Or, "addIssueToContext");
  x.addIssueToContext = Or;
  var Ct = class r {
    static {
      d(this, "ParseStatus");
    }
    constructor() {
      this.value = "valid";
    }
    dirty() {
      this.value === "valid" && (this.value = "dirty");
    }
    abort() {
      this.value !== "aborted" && (this.value = "aborted");
    }
    static mergeArray(e, t) {
      let s = [];
      for (let i of t) {
        if (i.status === "aborted")
          return x.INVALID;
        i.status === "dirty" && e.dirty(), s.push(i.value);
      }
      return { status: e.value, value: s };
    }
    static async mergeObjectAsync(e, t) {
      let s = [];
      for (let i of t) {
        let n = await i.key, a = await i.value;
        s.push({
          key: n,
          value: a
        });
      }
      return r.mergeObjectSync(e, s);
    }
    static mergeObjectSync(e, t) {
      let s = {};
      for (let i of t) {
        let { key: n, value: a } = i;
        if (n.status === "aborted" || a.status === "aborted")
          return x.INVALID;
        n.status === "dirty" && e.dirty(), a.status === "dirty" && e.dirty(), n.value !== "__proto__" && (typeof a.value < "u" || i.alwaysSet) &&
        (s[n.value] = a.value);
      }
      return { status: e.value, value: s };
    }
  };
  x.ParseStatus = Ct;
  x.INVALID = Object.freeze({
    status: "aborted"
  });
  var Ar = /* @__PURE__ */ d((r) => ({ status: "dirty", value: r }), "DIRTY");
  x.DIRTY = Ar;
  var Zr = /* @__PURE__ */ d((r) => ({ status: "valid", value: r }), "OK");
  x.OK = Zr;
  var jr = /* @__PURE__ */ d((r) => r.status === "aborted", "isAborted");
  x.isAborted = jr;
  var Sr = /* @__PURE__ */ d((r) => r.status === "dirty", "isDirty");
  x.isDirty = Sr;
  var Er = /* @__PURE__ */ d((r) => r.status === "valid", "isValid");
  x.isValid = Er;
  var Pr = /* @__PURE__ */ d((r) => typeof Promise < "u" && r instanceof Promise, "isAsync");
  x.isAsync = Pr;
});

// ../node_modules/zod/lib/helpers/typeAliases.js
var os = T((as) => {
  "use strict";
  Object.defineProperty(as, "__esModule", { value: !0 });
});

// ../node_modules/zod/lib/helpers/errorUtil.js
var ls = T((Fe) => {
  "use strict";
  Object.defineProperty(Fe, "__esModule", { value: !0 });
  Fe.errorUtil = void 0;
  var ds;
  (function(r) {
    r.errToObj = (e) => typeof e == "string" ? { message: e } : e || {}, r.toString = (e) => typeof e == "string" ? e : e?.message;
  })(ds || (Fe.errorUtil = ds = {}));
});

// ../node_modules/zod/lib/types.js
var ws = T((l) => {
  "use strict";
  var Be = l && l.__classPrivateFieldGet || function(r, e, t, s) {
    if (t === "a" && !s) throw new TypeError("Private accessor was defined without a getter");
    if (typeof e == "function" ? r !== e || !s : !e.has(r)) throw new TypeError("Cannot read private member from an object whose class did n\
ot declare it");
    return t === "m" ? s : t === "a" ? s.call(r) : s ? s.value : e.get(r);
  }, hs = l && l.__classPrivateFieldSet || function(r, e, t, s, i) {
    if (s === "m") throw new TypeError("Private method is not writable");
    if (s === "a" && !i) throw new TypeError("Private accessor was defined without a setter");
    if (typeof e == "function" ? r !== e || !i : !e.has(r)) throw new TypeError("Cannot write private member to an object whose class did no\
t declare it");
    return s === "a" ? i.call(r, t) : i ? i.value = t : e.set(r, t), t;
  }, Se, Ee;
  Object.defineProperty(l, "__esModule", { value: !0 });
  l.boolean = l.bigint = l.array = l.any = l.coerce = l.ZodFirstPartyTypeKind = l.late = l.ZodSchema = l.Schema = l.custom = l.ZodReadonly =
  l.ZodPipeline = l.ZodBranded = l.BRAND = l.ZodNaN = l.ZodCatch = l.ZodDefault = l.ZodNullable = l.ZodOptional = l.ZodTransformer = l.ZodEffects =
  l.ZodPromise = l.ZodNativeEnum = l.ZodEnum = l.ZodLiteral = l.ZodLazy = l.ZodFunction = l.ZodSet = l.ZodMap = l.ZodRecord = l.ZodTuple = l.
  ZodIntersection = l.ZodDiscriminatedUnion = l.ZodUnion = l.ZodObject = l.ZodArray = l.ZodVoid = l.ZodNever = l.ZodUnknown = l.ZodAny = l.ZodNull =
  l.ZodUndefined = l.ZodSymbol = l.ZodDate = l.ZodBoolean = l.ZodBigInt = l.ZodNumber = l.ZodString = l.datetimeRegex = l.ZodType = void 0;
  l.NEVER = l.void = l.unknown = l.union = l.undefined = l.tuple = l.transformer = l.symbol = l.string = l.strictObject = l.set = l.record =
  l.promise = l.preprocess = l.pipeline = l.ostring = l.optional = l.onumber = l.oboolean = l.object = l.number = l.nullable = l.null = l.never =
  l.nativeEnum = l.nan = l.map = l.literal = l.lazy = l.intersection = l.instanceof = l.function = l.enum = l.effect = l.discriminatedUnion =
  l.date = void 0;
  var He = Ue(), g = ls(), u = kt(), m = Ze(), f = qe(), N = class {
    static {
      d(this, "ParseInputLazyPath");
    }
    constructor(e, t, s, i) {
      this._cachedPath = [], this.parent = e, this.data = t, this._path = s, this._key = i;
    }
    get path() {
      return this._cachedPath.length || (this._key instanceof Array ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.
      push(...this._path, this._key)), this._cachedPath;
    }
  }, us = /* @__PURE__ */ d((r, e) => {
    if ((0, u.isValid)(e))
      return { success: !0, data: e.value };
    if (!r.common.issues.length)
      throw new Error("Validation failed but no issues detected.");
    return {
      success: !1,
      get error() {
        if (this._error)
          return this._error;
        let t = new f.ZodError(r.common.issues);
        return this._error = t, this._error;
      }
    };
  }, "handleResult");
  function v(r) {
    if (!r)
      return {};
    let { errorMap: e, invalid_type_error: t, required_error: s, description: i } = r;
    if (e && (t || s))
      throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    return e ? { errorMap: e, description: i } : { errorMap: /* @__PURE__ */ d((a, o) => {
      var c, h;
      let { message: p } = r;
      return a.code === "invalid_enum_value" ? { message: p ?? o.defaultError } : typeof o.data > "u" ? { message: (c = p ?? s) !== null && c !==
      void 0 ? c : o.defaultError } : a.code !== "invalid_type" ? { message: o.defaultError } : { message: (h = p ?? t) !== null && h !== void 0 ?
      h : o.defaultError };
    }, "customMap"), description: i };
  }
  d(v, "processCreateParams");
  var b = class {
    static {
      d(this, "ZodType");
    }
    get description() {
      return this._def.description;
    }
    _getType(e) {
      return (0, m.getParsedType)(e.data);
    }
    _getOrReturnCtx(e, t) {
      return t || {
        common: e.parent.common,
        data: e.data,
        parsedType: (0, m.getParsedType)(e.data),
        schemaErrorMap: this._def.errorMap,
        path: e.path,
        parent: e.parent
      };
    }
    _processInputParams(e) {
      return {
        status: new u.ParseStatus(),
        ctx: {
          common: e.parent.common,
          data: e.data,
          parsedType: (0, m.getParsedType)(e.data),
          schemaErrorMap: this._def.errorMap,
          path: e.path,
          parent: e.parent
        }
      };
    }
    _parseSync(e) {
      let t = this._parse(e);
      if ((0, u.isAsync)(t))
        throw new Error("Synchronous parse encountered promise.");
      return t;
    }
    _parseAsync(e) {
      let t = this._parse(e);
      return Promise.resolve(t);
    }
    parse(e, t) {
      let s = this.safeParse(e, t);
      if (s.success)
        return s.data;
      throw s.error;
    }
    safeParse(e, t) {
      var s;
      let i = {
        common: {
          issues: [],
          async: (s = t?.async) !== null && s !== void 0 ? s : !1,
          contextualErrorMap: t?.errorMap
        },
        path: t?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data: e,
        parsedType: (0, m.getParsedType)(e)
      }, n = this._parseSync({ data: e, path: i.path, parent: i });
      return us(i, n);
    }
    "~validate"(e) {
      var t, s;
      let i = {
        common: {
          issues: [],
          async: !!this["~standard"].async
        },
        path: [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data: e,
        parsedType: (0, m.getParsedType)(e)
      };
      if (!this["~standard"].async)
        try {
          let n = this._parseSync({ data: e, path: [], parent: i });
          return (0, u.isValid)(n) ? {
            value: n.value
          } : {
            issues: i.common.issues
          };
        } catch (n) {
          !((s = (t = n?.message) === null || t === void 0 ? void 0 : t.toLowerCase()) === null || s === void 0) && s.includes("encountered") &&
          (this["~standard"].async = !0), i.common = {
            issues: [],
            async: !0
          };
        }
      return this._parseAsync({ data: e, path: [], parent: i }).then((n) => (0, u.isValid)(n) ? {
        value: n.value
      } : {
        issues: i.common.issues
      });
    }
    async parseAsync(e, t) {
      let s = await this.safeParseAsync(e, t);
      if (s.success)
        return s.data;
      throw s.error;
    }
    async safeParseAsync(e, t) {
      let s = {
        common: {
          issues: [],
          contextualErrorMap: t?.errorMap,
          async: !0
        },
        path: t?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data: e,
        parsedType: (0, m.getParsedType)(e)
      }, i = this._parse({ data: e, path: s.path, parent: s }), n = await ((0, u.isAsync)(i) ? i : Promise.resolve(i));
      return us(s, n);
    }
    refine(e, t) {
      let s = /* @__PURE__ */ d((i) => typeof t == "string" || typeof t > "u" ? { message: t } : typeof t == "function" ? t(i) : t, "getIssu\
eProperties");
      return this._refinement((i, n) => {
        let a = e(i), o = /* @__PURE__ */ d(() => n.addIssue({
          code: f.ZodIssueCode.custom,
          ...s(i)
        }), "setError");
        return typeof Promise < "u" && a instanceof Promise ? a.then((c) => c ? !0 : (o(), !1)) : a ? !0 : (o(), !1);
      });
    }
    refinement(e, t) {
      return this._refinement((s, i) => e(s) ? !0 : (i.addIssue(typeof t == "function" ? t(s, i) : t), !1));
    }
    _refinement(e) {
      return new S({
        schema: this,
        typeName: _.ZodEffects,
        effect: { type: "refinement", refinement: e }
      });
    }
    superRefine(e) {
      return this._refinement(e);
    }
    constructor(e) {
      this.spa = this.safeParseAsync, this._def = e, this.parse = this.parse.bind(this), this.safeParse = this.safeParse.bind(this), this.parseAsync =
      this.parseAsync.bind(this), this.safeParseAsync = this.safeParseAsync.bind(this), this.spa = this.spa.bind(this), this.refine = this.refine.
      bind(this), this.refinement = this.refinement.bind(this), this.superRefine = this.superRefine.bind(this), this.optional = this.optional.
      bind(this), this.nullable = this.nullable.bind(this), this.nullish = this.nullish.bind(this), this.array = this.array.bind(this), this.
      promise = this.promise.bind(this), this.or = this.or.bind(this), this.and = this.and.bind(this), this.transform = this.transform.bind(
      this), this.brand = this.brand.bind(this), this.default = this.default.bind(this), this.catch = this.catch.bind(this), this.describe =
      this.describe.bind(this), this.pipe = this.pipe.bind(this), this.readonly = this.readonly.bind(this), this.isNullable = this.isNullable.
      bind(this), this.isOptional = this.isOptional.bind(this), this["~standard"] = {
        version: 1,
        vendor: "zod",
        validate: /* @__PURE__ */ d((t) => this["~validate"](t), "validate")
      };
    }
    optional() {
      return P.create(this, this._def);
    }
    nullable() {
      return M.create(this, this._def);
    }
    nullish() {
      return this.nullable().optional();
    }
    array() {
      return F.create(this);
    }
    promise() {
      return Y.create(this, this._def);
    }
    or(e) {
      return ne.create([this, e], this._def);
    }
    and(e) {
      return ae.create(this, e, this._def);
    }
    transform(e) {
      return new S({
        ...v(this._def),
        schema: this,
        typeName: _.ZodEffects,
        effect: { type: "transform", transform: e }
      });
    }
    default(e) {
      let t = typeof e == "function" ? e : () => e;
      return new ce({
        ...v(this._def),
        innerType: this,
        defaultValue: t,
        typeName: _.ZodDefault
      });
    }
    brand() {
      return new Pe({
        typeName: _.ZodBranded,
        type: this,
        ...v(this._def)
      });
    }
    catch(e) {
      let t = typeof e == "function" ? e : () => e;
      return new he({
        ...v(this._def),
        innerType: this,
        catchValue: t,
        typeName: _.ZodCatch
      });
    }
    describe(e) {
      let t = this.constructor;
      return new t({
        ...this._def,
        description: e
      });
    }
    pipe(e) {
      return Ne.create(this, e);
    }
    readonly() {
      return pe.create(this);
    }
    isOptional() {
      return this.safeParse(void 0).success;
    }
    isNullable() {
      return this.safeParse(null).success;
    }
  };
  l.ZodType = b;
  l.Schema = b;
  l.ZodSchema = b;
  var Nr = /^c[^\s-]{8,}$/i, Vr = /^[0-9a-z]+$/, Dr = /^[0-9A-HJKMNP-TV-Z]{26}$/i, $r = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,
  Rr = /^[a-z0-9_-]{21}$/i, Mr = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, Lr = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,
  qr = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, Ur = "^(\\p{Extended_Pictographic}|\\p{Emoji_Comp\
onent})+$", It, Fr = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, Hr = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
  Br = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
  Wr = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
  zr = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, Gr = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
  ps = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469\
]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", Jr = new RegExp(`^${ps}$`);
  function fs(r) {
    let e = "([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d";
    return r.precision ? e = `${e}\\.\\d{${r.precision}}` : r.precision == null && (e = `${e}(\\.\\d+)?`), e;
  }
  d(fs, "timeRegexSource");
  function Yr(r) {
    return new RegExp(`^${fs(r)}$`);
  }
  d(Yr, "timeRegex");
  function ms(r) {
    let e = `${ps}T${fs(r)}`, t = [];
    return t.push(r.local ? "Z?" : "Z"), r.offset && t.push("([+-]\\d{2}:?\\d{2})"), e = `${e}(${t.join("|")})`, new RegExp(`^${e}$`);
  }
  d(ms, "datetimeRegex");
  l.datetimeRegex = ms;
  function Kr(r, e) {
    return !!((e === "v4" || !e) && Fr.test(r) || (e === "v6" || !e) && Br.test(r));
  }
  d(Kr, "isValidIP");
  function Xr(r, e) {
    if (!Mr.test(r))
      return !1;
    try {
      let [t] = r.split("."), s = t.replace(/-/g, "+").replace(/_/g, "/").padEnd(t.length + (4 - t.length % 4) % 4, "="), i = JSON.parse(atob(
      s));
      return !(typeof i != "object" || i === null || !i.typ || !i.alg || e && i.alg !== e);
    } catch {
      return !1;
    }
  }
  d(Xr, "isValidJWT");
  function Qr(r, e) {
    return !!((e === "v4" || !e) && Hr.test(r) || (e === "v6" || !e) && Wr.test(r));
  }
  d(Qr, "isValidCidr");
  var G = class r extends b {
    static {
      d(this, "ZodString");
    }
    _parse(e) {
      if (this._def.coerce && (e.data = String(e.data)), this._getType(e) !== m.ZodParsedType.string) {
        let n = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(n, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.string,
          received: n.parsedType
        }), u.INVALID;
      }
      let s = new u.ParseStatus(), i;
      for (let n of this._def.checks)
        if (n.kind === "min")
          e.data.length < n.value && (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
            code: f.ZodIssueCode.too_small,
            minimum: n.value,
            type: "string",
            inclusive: !0,
            exact: !1,
            message: n.message
          }), s.dirty());
        else if (n.kind === "max")
          e.data.length > n.value && (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
            code: f.ZodIssueCode.too_big,
            maximum: n.value,
            type: "string",
            inclusive: !0,
            exact: !1,
            message: n.message
          }), s.dirty());
        else if (n.kind === "length") {
          let a = e.data.length > n.value, o = e.data.length < n.value;
          (a || o) && (i = this._getOrReturnCtx(e, i), a ? (0, u.addIssueToContext)(i, {
            code: f.ZodIssueCode.too_big,
            maximum: n.value,
            type: "string",
            inclusive: !0,
            exact: !0,
            message: n.message
          }) : o && (0, u.addIssueToContext)(i, {
            code: f.ZodIssueCode.too_small,
            minimum: n.value,
            type: "string",
            inclusive: !0,
            exact: !0,
            message: n.message
          }), s.dirty());
        } else if (n.kind === "email")
          qr.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
            validation: "email",
            code: f.ZodIssueCode.invalid_string,
            message: n.message
          }), s.dirty());
        else if (n.kind === "emoji")
          It || (It = new RegExp(Ur, "u")), It.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
            validation: "emoji",
            code: f.ZodIssueCode.invalid_string,
            message: n.message
          }), s.dirty());
        else if (n.kind === "uuid")
          $r.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
            validation: "uuid",
            code: f.ZodIssueCode.invalid_string,
            message: n.message
          }), s.dirty());
        else if (n.kind === "nanoid")
          Rr.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
            validation: "nanoid",
            code: f.ZodIssueCode.invalid_string,
            message: n.message
          }), s.dirty());
        else if (n.kind === "cuid")
          Nr.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
            validation: "cuid",
            code: f.ZodIssueCode.invalid_string,
            message: n.message
          }), s.dirty());
        else if (n.kind === "cuid2")
          Vr.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
            validation: "cuid2",
            code: f.ZodIssueCode.invalid_string,
            message: n.message
          }), s.dirty());
        else if (n.kind === "ulid")
          Dr.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
            validation: "ulid",
            code: f.ZodIssueCode.invalid_string,
            message: n.message
          }), s.dirty());
        else if (n.kind === "url")
          try {
            new URL(e.data);
          } catch {
            i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
              validation: "url",
              code: f.ZodIssueCode.invalid_string,
              message: n.message
            }), s.dirty();
          }
        else n.kind === "regex" ? (n.regex.lastIndex = 0, n.regex.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(
        i, {
          validation: "regex",
          code: f.ZodIssueCode.invalid_string,
          message: n.message
        }), s.dirty())) : n.kind === "trim" ? e.data = e.data.trim() : n.kind === "includes" ? e.data.includes(n.value, n.position) || (i = this.
        _getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          code: f.ZodIssueCode.invalid_string,
          validation: { includes: n.value, position: n.position },
          message: n.message
        }), s.dirty()) : n.kind === "toLowerCase" ? e.data = e.data.toLowerCase() : n.kind === "toUpperCase" ? e.data = e.data.toUpperCase() :
        n.kind === "startsWith" ? e.data.startsWith(n.value) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          code: f.ZodIssueCode.invalid_string,
          validation: { startsWith: n.value },
          message: n.message
        }), s.dirty()) : n.kind === "endsWith" ? e.data.endsWith(n.value) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          code: f.ZodIssueCode.invalid_string,
          validation: { endsWith: n.value },
          message: n.message
        }), s.dirty()) : n.kind === "datetime" ? ms(n).test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          code: f.ZodIssueCode.invalid_string,
          validation: "datetime",
          message: n.message
        }), s.dirty()) : n.kind === "date" ? Jr.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          code: f.ZodIssueCode.invalid_string,
          validation: "date",
          message: n.message
        }), s.dirty()) : n.kind === "time" ? Yr(n).test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          code: f.ZodIssueCode.invalid_string,
          validation: "time",
          message: n.message
        }), s.dirty()) : n.kind === "duration" ? Lr.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          validation: "duration",
          code: f.ZodIssueCode.invalid_string,
          message: n.message
        }), s.dirty()) : n.kind === "ip" ? Kr(e.data, n.version) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          validation: "ip",
          code: f.ZodIssueCode.invalid_string,
          message: n.message
        }), s.dirty()) : n.kind === "jwt" ? Xr(e.data, n.alg) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          validation: "jwt",
          code: f.ZodIssueCode.invalid_string,
          message: n.message
        }), s.dirty()) : n.kind === "cidr" ? Qr(e.data, n.version) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          validation: "cidr",
          code: f.ZodIssueCode.invalid_string,
          message: n.message
        }), s.dirty()) : n.kind === "base64" ? zr.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          validation: "base64",
          code: f.ZodIssueCode.invalid_string,
          message: n.message
        }), s.dirty()) : n.kind === "base64url" ? Gr.test(e.data) || (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          validation: "base64url",
          code: f.ZodIssueCode.invalid_string,
          message: n.message
        }), s.dirty()) : m.util.assertNever(n);
      return { status: s.value, value: e.data };
    }
    _regex(e, t, s) {
      return this.refinement((i) => e.test(i), {
        validation: t,
        code: f.ZodIssueCode.invalid_string,
        ...g.errorUtil.errToObj(s)
      });
    }
    _addCheck(e) {
      return new r({
        ...this._def,
        checks: [...this._def.checks, e]
      });
    }
    email(e) {
      return this._addCheck({ kind: "email", ...g.errorUtil.errToObj(e) });
    }
    url(e) {
      return this._addCheck({ kind: "url", ...g.errorUtil.errToObj(e) });
    }
    emoji(e) {
      return this._addCheck({ kind: "emoji", ...g.errorUtil.errToObj(e) });
    }
    uuid(e) {
      return this._addCheck({ kind: "uuid", ...g.errorUtil.errToObj(e) });
    }
    nanoid(e) {
      return this._addCheck({ kind: "nanoid", ...g.errorUtil.errToObj(e) });
    }
    cuid(e) {
      return this._addCheck({ kind: "cuid", ...g.errorUtil.errToObj(e) });
    }
    cuid2(e) {
      return this._addCheck({ kind: "cuid2", ...g.errorUtil.errToObj(e) });
    }
    ulid(e) {
      return this._addCheck({ kind: "ulid", ...g.errorUtil.errToObj(e) });
    }
    base64(e) {
      return this._addCheck({ kind: "base64", ...g.errorUtil.errToObj(e) });
    }
    base64url(e) {
      return this._addCheck({
        kind: "base64url",
        ...g.errorUtil.errToObj(e)
      });
    }
    jwt(e) {
      return this._addCheck({ kind: "jwt", ...g.errorUtil.errToObj(e) });
    }
    ip(e) {
      return this._addCheck({ kind: "ip", ...g.errorUtil.errToObj(e) });
    }
    cidr(e) {
      return this._addCheck({ kind: "cidr", ...g.errorUtil.errToObj(e) });
    }
    datetime(e) {
      var t, s;
      return typeof e == "string" ? this._addCheck({
        kind: "datetime",
        precision: null,
        offset: !1,
        local: !1,
        message: e
      }) : this._addCheck({
        kind: "datetime",
        precision: typeof e?.precision > "u" ? null : e?.precision,
        offset: (t = e?.offset) !== null && t !== void 0 ? t : !1,
        local: (s = e?.local) !== null && s !== void 0 ? s : !1,
        ...g.errorUtil.errToObj(e?.message)
      });
    }
    date(e) {
      return this._addCheck({ kind: "date", message: e });
    }
    time(e) {
      return typeof e == "string" ? this._addCheck({
        kind: "time",
        precision: null,
        message: e
      }) : this._addCheck({
        kind: "time",
        precision: typeof e?.precision > "u" ? null : e?.precision,
        ...g.errorUtil.errToObj(e?.message)
      });
    }
    duration(e) {
      return this._addCheck({ kind: "duration", ...g.errorUtil.errToObj(e) });
    }
    regex(e, t) {
      return this._addCheck({
        kind: "regex",
        regex: e,
        ...g.errorUtil.errToObj(t)
      });
    }
    includes(e, t) {
      return this._addCheck({
        kind: "includes",
        value: e,
        position: t?.position,
        ...g.errorUtil.errToObj(t?.message)
      });
    }
    startsWith(e, t) {
      return this._addCheck({
        kind: "startsWith",
        value: e,
        ...g.errorUtil.errToObj(t)
      });
    }
    endsWith(e, t) {
      return this._addCheck({
        kind: "endsWith",
        value: e,
        ...g.errorUtil.errToObj(t)
      });
    }
    min(e, t) {
      return this._addCheck({
        kind: "min",
        value: e,
        ...g.errorUtil.errToObj(t)
      });
    }
    max(e, t) {
      return this._addCheck({
        kind: "max",
        value: e,
        ...g.errorUtil.errToObj(t)
      });
    }
    length(e, t) {
      return this._addCheck({
        kind: "length",
        value: e,
        ...g.errorUtil.errToObj(t)
      });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(e) {
      return this.min(1, g.errorUtil.errToObj(e));
    }
    trim() {
      return new r({
        ...this._def,
        checks: [...this._def.checks, { kind: "trim" }]
      });
    }
    toLowerCase() {
      return new r({
        ...this._def,
        checks: [...this._def.checks, { kind: "toLowerCase" }]
      });
    }
    toUpperCase() {
      return new r({
        ...this._def,
        checks: [...this._def.checks, { kind: "toUpperCase" }]
      });
    }
    get isDatetime() {
      return !!this._def.checks.find((e) => e.kind === "datetime");
    }
    get isDate() {
      return !!this._def.checks.find((e) => e.kind === "date");
    }
    get isTime() {
      return !!this._def.checks.find((e) => e.kind === "time");
    }
    get isDuration() {
      return !!this._def.checks.find((e) => e.kind === "duration");
    }
    get isEmail() {
      return !!this._def.checks.find((e) => e.kind === "email");
    }
    get isURL() {
      return !!this._def.checks.find((e) => e.kind === "url");
    }
    get isEmoji() {
      return !!this._def.checks.find((e) => e.kind === "emoji");
    }
    get isUUID() {
      return !!this._def.checks.find((e) => e.kind === "uuid");
    }
    get isNANOID() {
      return !!this._def.checks.find((e) => e.kind === "nanoid");
    }
    get isCUID() {
      return !!this._def.checks.find((e) => e.kind === "cuid");
    }
    get isCUID2() {
      return !!this._def.checks.find((e) => e.kind === "cuid2");
    }
    get isULID() {
      return !!this._def.checks.find((e) => e.kind === "ulid");
    }
    get isIP() {
      return !!this._def.checks.find((e) => e.kind === "ip");
    }
    get isCIDR() {
      return !!this._def.checks.find((e) => e.kind === "cidr");
    }
    get isBase64() {
      return !!this._def.checks.find((e) => e.kind === "base64");
    }
    get isBase64url() {
      return !!this._def.checks.find((e) => e.kind === "base64url");
    }
    get minLength() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "min" && (e === null || t.value > e) && (e = t.value);
      return e;
    }
    get maxLength() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "max" && (e === null || t.value < e) && (e = t.value);
      return e;
    }
  };
  l.ZodString = G;
  G.create = (r) => {
    var e;
    return new G({
      checks: [],
      typeName: _.ZodString,
      coerce: (e = r?.coerce) !== null && e !== void 0 ? e : !1,
      ...v(r)
    });
  };
  function ei(r, e) {
    let t = (r.toString().split(".")[1] || "").length, s = (e.toString().split(".")[1] || "").length, i = t > s ? t : s, n = parseInt(r.toFixed(
    i).replace(".", "")), a = parseInt(e.toFixed(i).replace(".", ""));
    return n % a / Math.pow(10, i);
  }
  d(ei, "floatSafeRemainder");
  var Q = class r extends b {
    static {
      d(this, "ZodNumber");
    }
    constructor() {
      super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
    }
    _parse(e) {
      if (this._def.coerce && (e.data = Number(e.data)), this._getType(e) !== m.ZodParsedType.number) {
        let n = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(n, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.number,
          received: n.parsedType
        }), u.INVALID;
      }
      let s, i = new u.ParseStatus();
      for (let n of this._def.checks)
        n.kind === "int" ? m.util.isInteger(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.invalid_type,
          expected: "integer",
          received: "float",
          message: n.message
        }), i.dirty()) : n.kind === "min" ? (n.inclusive ? e.data < n.value : e.data <= n.value) && (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(
        s, {
          code: f.ZodIssueCode.too_small,
          minimum: n.value,
          type: "number",
          inclusive: n.inclusive,
          exact: !1,
          message: n.message
        }), i.dirty()) : n.kind === "max" ? (n.inclusive ? e.data > n.value : e.data >= n.value) && (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(
        s, {
          code: f.ZodIssueCode.too_big,
          maximum: n.value,
          type: "number",
          inclusive: n.inclusive,
          exact: !1,
          message: n.message
        }), i.dirty()) : n.kind === "multipleOf" ? ei(e.data, n.value) !== 0 && (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s,
        {
          code: f.ZodIssueCode.not_multiple_of,
          multipleOf: n.value,
          message: n.message
        }), i.dirty()) : n.kind === "finite" ? Number.isFinite(e.data) || (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.not_finite,
          message: n.message
        }), i.dirty()) : m.util.assertNever(n);
      return { status: i.value, value: e.data };
    }
    gte(e, t) {
      return this.setLimit("min", e, !0, g.errorUtil.toString(t));
    }
    gt(e, t) {
      return this.setLimit("min", e, !1, g.errorUtil.toString(t));
    }
    lte(e, t) {
      return this.setLimit("max", e, !0, g.errorUtil.toString(t));
    }
    lt(e, t) {
      return this.setLimit("max", e, !1, g.errorUtil.toString(t));
    }
    setLimit(e, t, s, i) {
      return new r({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind: e,
            value: t,
            inclusive: s,
            message: g.errorUtil.toString(i)
          }
        ]
      });
    }
    _addCheck(e) {
      return new r({
        ...this._def,
        checks: [...this._def.checks, e]
      });
    }
    int(e) {
      return this._addCheck({
        kind: "int",
        message: g.errorUtil.toString(e)
      });
    }
    positive(e) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: !1,
        message: g.errorUtil.toString(e)
      });
    }
    negative(e) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: !1,
        message: g.errorUtil.toString(e)
      });
    }
    nonpositive(e) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: !0,
        message: g.errorUtil.toString(e)
      });
    }
    nonnegative(e) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: !0,
        message: g.errorUtil.toString(e)
      });
    }
    multipleOf(e, t) {
      return this._addCheck({
        kind: "multipleOf",
        value: e,
        message: g.errorUtil.toString(t)
      });
    }
    finite(e) {
      return this._addCheck({
        kind: "finite",
        message: g.errorUtil.toString(e)
      });
    }
    safe(e) {
      return this._addCheck({
        kind: "min",
        inclusive: !0,
        value: Number.MIN_SAFE_INTEGER,
        message: g.errorUtil.toString(e)
      })._addCheck({
        kind: "max",
        inclusive: !0,
        value: Number.MAX_SAFE_INTEGER,
        message: g.errorUtil.toString(e)
      });
    }
    get minValue() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "min" && (e === null || t.value > e) && (e = t.value);
      return e;
    }
    get maxValue() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "max" && (e === null || t.value < e) && (e = t.value);
      return e;
    }
    get isInt() {
      return !!this._def.checks.find((e) => e.kind === "int" || e.kind === "multipleOf" && m.util.isInteger(e.value));
    }
    get isFinite() {
      let e = null, t = null;
      for (let s of this._def.checks) {
        if (s.kind === "finite" || s.kind === "int" || s.kind === "multipleOf")
          return !0;
        s.kind === "min" ? (t === null || s.value > t) && (t = s.value) : s.kind === "max" && (e === null || s.value < e) && (e = s.value);
      }
      return Number.isFinite(t) && Number.isFinite(e);
    }
  };
  l.ZodNumber = Q;
  Q.create = (r) => new Q({
    checks: [],
    typeName: _.ZodNumber,
    coerce: r?.coerce || !1,
    ...v(r)
  });
  var ee = class r extends b {
    static {
      d(this, "ZodBigInt");
    }
    constructor() {
      super(...arguments), this.min = this.gte, this.max = this.lte;
    }
    _parse(e) {
      if (this._def.coerce)
        try {
          e.data = BigInt(e.data);
        } catch {
          return this._getInvalidInput(e);
        }
      if (this._getType(e) !== m.ZodParsedType.bigint)
        return this._getInvalidInput(e);
      let s, i = new u.ParseStatus();
      for (let n of this._def.checks)
        n.kind === "min" ? (n.inclusive ? e.data < n.value : e.data <= n.value) && (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(
        s, {
          code: f.ZodIssueCode.too_small,
          type: "bigint",
          minimum: n.value,
          inclusive: n.inclusive,
          message: n.message
        }), i.dirty()) : n.kind === "max" ? (n.inclusive ? e.data > n.value : e.data >= n.value) && (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(
        s, {
          code: f.ZodIssueCode.too_big,
          type: "bigint",
          maximum: n.value,
          inclusive: n.inclusive,
          message: n.message
        }), i.dirty()) : n.kind === "multipleOf" ? e.data % n.value !== BigInt(0) && (s = this._getOrReturnCtx(e, s), (0, u.addIssueToContext)(
        s, {
          code: f.ZodIssueCode.not_multiple_of,
          multipleOf: n.value,
          message: n.message
        }), i.dirty()) : m.util.assertNever(n);
      return { status: i.value, value: e.data };
    }
    _getInvalidInput(e) {
      let t = this._getOrReturnCtx(e);
      return (0, u.addIssueToContext)(t, {
        code: f.ZodIssueCode.invalid_type,
        expected: m.ZodParsedType.bigint,
        received: t.parsedType
      }), u.INVALID;
    }
    gte(e, t) {
      return this.setLimit("min", e, !0, g.errorUtil.toString(t));
    }
    gt(e, t) {
      return this.setLimit("min", e, !1, g.errorUtil.toString(t));
    }
    lte(e, t) {
      return this.setLimit("max", e, !0, g.errorUtil.toString(t));
    }
    lt(e, t) {
      return this.setLimit("max", e, !1, g.errorUtil.toString(t));
    }
    setLimit(e, t, s, i) {
      return new r({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind: e,
            value: t,
            inclusive: s,
            message: g.errorUtil.toString(i)
          }
        ]
      });
    }
    _addCheck(e) {
      return new r({
        ...this._def,
        checks: [...this._def.checks, e]
      });
    }
    positive(e) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: !1,
        message: g.errorUtil.toString(e)
      });
    }
    negative(e) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: !1,
        message: g.errorUtil.toString(e)
      });
    }
    nonpositive(e) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: !0,
        message: g.errorUtil.toString(e)
      });
    }
    nonnegative(e) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: !0,
        message: g.errorUtil.toString(e)
      });
    }
    multipleOf(e, t) {
      return this._addCheck({
        kind: "multipleOf",
        value: e,
        message: g.errorUtil.toString(t)
      });
    }
    get minValue() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "min" && (e === null || t.value > e) && (e = t.value);
      return e;
    }
    get maxValue() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "max" && (e === null || t.value < e) && (e = t.value);
      return e;
    }
  };
  l.ZodBigInt = ee;
  ee.create = (r) => {
    var e;
    return new ee({
      checks: [],
      typeName: _.ZodBigInt,
      coerce: (e = r?.coerce) !== null && e !== void 0 ? e : !1,
      ...v(r)
    });
  };
  var te = class extends b {
    static {
      d(this, "ZodBoolean");
    }
    _parse(e) {
      if (this._def.coerce && (e.data = !!e.data), this._getType(e) !== m.ZodParsedType.boolean) {
        let s = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.boolean,
          received: s.parsedType
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
  };
  l.ZodBoolean = te;
  te.create = (r) => new te({
    typeName: _.ZodBoolean,
    coerce: r?.coerce || !1,
    ...v(r)
  });
  var se = class r extends b {
    static {
      d(this, "ZodDate");
    }
    _parse(e) {
      if (this._def.coerce && (e.data = new Date(e.data)), this._getType(e) !== m.ZodParsedType.date) {
        let n = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(n, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.date,
          received: n.parsedType
        }), u.INVALID;
      }
      if (isNaN(e.data.getTime())) {
        let n = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(n, {
          code: f.ZodIssueCode.invalid_date
        }), u.INVALID;
      }
      let s = new u.ParseStatus(), i;
      for (let n of this._def.checks)
        n.kind === "min" ? e.data.getTime() < n.value && (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          code: f.ZodIssueCode.too_small,
          message: n.message,
          inclusive: !0,
          exact: !1,
          minimum: n.value,
          type: "date"
        }), s.dirty()) : n.kind === "max" ? e.data.getTime() > n.value && (i = this._getOrReturnCtx(e, i), (0, u.addIssueToContext)(i, {
          code: f.ZodIssueCode.too_big,
          message: n.message,
          inclusive: !0,
          exact: !1,
          maximum: n.value,
          type: "date"
        }), s.dirty()) : m.util.assertNever(n);
      return {
        status: s.value,
        value: new Date(e.data.getTime())
      };
    }
    _addCheck(e) {
      return new r({
        ...this._def,
        checks: [...this._def.checks, e]
      });
    }
    min(e, t) {
      return this._addCheck({
        kind: "min",
        value: e.getTime(),
        message: g.errorUtil.toString(t)
      });
    }
    max(e, t) {
      return this._addCheck({
        kind: "max",
        value: e.getTime(),
        message: g.errorUtil.toString(t)
      });
    }
    get minDate() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "min" && (e === null || t.value > e) && (e = t.value);
      return e != null ? new Date(e) : null;
    }
    get maxDate() {
      let e = null;
      for (let t of this._def.checks)
        t.kind === "max" && (e === null || t.value < e) && (e = t.value);
      return e != null ? new Date(e) : null;
    }
  };
  l.ZodDate = se;
  se.create = (r) => new se({
    checks: [],
    coerce: r?.coerce || !1,
    typeName: _.ZodDate,
    ...v(r)
  });
  var ve = class extends b {
    static {
      d(this, "ZodSymbol");
    }
    _parse(e) {
      if (this._getType(e) !== m.ZodParsedType.symbol) {
        let s = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.symbol,
          received: s.parsedType
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
  };
  l.ZodSymbol = ve;
  ve.create = (r) => new ve({
    typeName: _.ZodSymbol,
    ...v(r)
  });
  var re = class extends b {
    static {
      d(this, "ZodUndefined");
    }
    _parse(e) {
      if (this._getType(e) !== m.ZodParsedType.undefined) {
        let s = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.undefined,
          received: s.parsedType
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
  };
  l.ZodUndefined = re;
  re.create = (r) => new re({
    typeName: _.ZodUndefined,
    ...v(r)
  });
  var ie = class extends b {
    static {
      d(this, "ZodNull");
    }
    _parse(e) {
      if (this._getType(e) !== m.ZodParsedType.null) {
        let s = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.null,
          received: s.parsedType
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
  };
  l.ZodNull = ie;
  ie.create = (r) => new ie({
    typeName: _.ZodNull,
    ...v(r)
  });
  var J = class extends b {
    static {
      d(this, "ZodAny");
    }
    constructor() {
      super(...arguments), this._any = !0;
    }
    _parse(e) {
      return (0, u.OK)(e.data);
    }
  };
  l.ZodAny = J;
  J.create = (r) => new J({
    typeName: _.ZodAny,
    ...v(r)
  });
  var U = class extends b {
    static {
      d(this, "ZodUnknown");
    }
    constructor() {
      super(...arguments), this._unknown = !0;
    }
    _parse(e) {
      return (0, u.OK)(e.data);
    }
  };
  l.ZodUnknown = U;
  U.create = (r) => new U({
    typeName: _.ZodUnknown,
    ...v(r)
  });
  var D = class extends b {
    static {
      d(this, "ZodNever");
    }
    _parse(e) {
      let t = this._getOrReturnCtx(e);
      return (0, u.addIssueToContext)(t, {
        code: f.ZodIssueCode.invalid_type,
        expected: m.ZodParsedType.never,
        received: t.parsedType
      }), u.INVALID;
    }
  };
  l.ZodNever = D;
  D.create = (r) => new D({
    typeName: _.ZodNever,
    ...v(r)
  });
  var be = class extends b {
    static {
      d(this, "ZodVoid");
    }
    _parse(e) {
      if (this._getType(e) !== m.ZodParsedType.undefined) {
        let s = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.void,
          received: s.parsedType
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
  };
  l.ZodVoid = be;
  be.create = (r) => new be({
    typeName: _.ZodVoid,
    ...v(r)
  });
  var F = class r extends b {
    static {
      d(this, "ZodArray");
    }
    _parse(e) {
      let { ctx: t, status: s } = this._processInputParams(e), i = this._def;
      if (t.parsedType !== m.ZodParsedType.array)
        return (0, u.addIssueToContext)(t, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.array,
          received: t.parsedType
        }), u.INVALID;
      if (i.exactLength !== null) {
        let a = t.data.length > i.exactLength.value, o = t.data.length < i.exactLength.value;
        (a || o) && ((0, u.addIssueToContext)(t, {
          code: a ? f.ZodIssueCode.too_big : f.ZodIssueCode.too_small,
          minimum: o ? i.exactLength.value : void 0,
          maximum: a ? i.exactLength.value : void 0,
          type: "array",
          inclusive: !0,
          exact: !0,
          message: i.exactLength.message
        }), s.dirty());
      }
      if (i.minLength !== null && t.data.length < i.minLength.value && ((0, u.addIssueToContext)(t, {
        code: f.ZodIssueCode.too_small,
        minimum: i.minLength.value,
        type: "array",
        inclusive: !0,
        exact: !1,
        message: i.minLength.message
      }), s.dirty()), i.maxLength !== null && t.data.length > i.maxLength.value && ((0, u.addIssueToContext)(t, {
        code: f.ZodIssueCode.too_big,
        maximum: i.maxLength.value,
        type: "array",
        inclusive: !0,
        exact: !1,
        message: i.maxLength.message
      }), s.dirty()), t.common.async)
        return Promise.all([...t.data].map((a, o) => i.type._parseAsync(new N(t, a, t.path, o)))).then((a) => u.ParseStatus.mergeArray(s, a));
      let n = [...t.data].map((a, o) => i.type._parseSync(new N(t, a, t.path, o)));
      return u.ParseStatus.mergeArray(s, n);
    }
    get element() {
      return this._def.type;
    }
    min(e, t) {
      return new r({
        ...this._def,
        minLength: { value: e, message: g.errorUtil.toString(t) }
      });
    }
    max(e, t) {
      return new r({
        ...this._def,
        maxLength: { value: e, message: g.errorUtil.toString(t) }
      });
    }
    length(e, t) {
      return new r({
        ...this._def,
        exactLength: { value: e, message: g.errorUtil.toString(t) }
      });
    }
    nonempty(e) {
      return this.min(1, e);
    }
  };
  l.ZodArray = F;
  F.create = (r, e) => new F({
    type: r,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: _.ZodArray,
    ...v(e)
  });
  function _e(r) {
    if (r instanceof A) {
      let e = {};
      for (let t in r.shape) {
        let s = r.shape[t];
        e[t] = P.create(_e(s));
      }
      return new A({
        ...r._def,
        shape: /* @__PURE__ */ d(() => e, "shape")
      });
    } else return r instanceof F ? new F({
      ...r._def,
      type: _e(r.element)
    }) : r instanceof P ? P.create(_e(r.unwrap())) : r instanceof M ? M.create(_e(r.unwrap())) : r instanceof R ? R.create(r.items.map((e) => _e(
    e))) : r;
  }
  d(_e, "deepPartialify");
  var A = class r extends b {
    static {
      d(this, "ZodObject");
    }
    constructor() {
      super(...arguments), this._cached = null, this.nonstrict = this.passthrough, this.augment = this.extend;
    }
    _getCached() {
      if (this._cached !== null)
        return this._cached;
      let e = this._def.shape(), t = m.util.objectKeys(e);
      return this._cached = { shape: e, keys: t };
    }
    _parse(e) {
      if (this._getType(e) !== m.ZodParsedType.object) {
        let h = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(h, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.object,
          received: h.parsedType
        }), u.INVALID;
      }
      let { status: s, ctx: i } = this._processInputParams(e), { shape: n, keys: a } = this._getCached(), o = [];
      if (!(this._def.catchall instanceof D && this._def.unknownKeys === "strip"))
        for (let h in i.data)
          a.includes(h) || o.push(h);
      let c = [];
      for (let h of a) {
        let p = n[h], y = i.data[h];
        c.push({
          key: { status: "valid", value: h },
          value: p._parse(new N(i, y, i.path, h)),
          alwaysSet: h in i.data
        });
      }
      if (this._def.catchall instanceof D) {
        let h = this._def.unknownKeys;
        if (h === "passthrough")
          for (let p of o)
            c.push({
              key: { status: "valid", value: p },
              value: { status: "valid", value: i.data[p] }
            });
        else if (h === "strict")
          o.length > 0 && ((0, u.addIssueToContext)(i, {
            code: f.ZodIssueCode.unrecognized_keys,
            keys: o
          }), s.dirty());
        else if (h !== "strip")
          throw new Error("Internal ZodObject error: invalid unknownKeys value.");
      } else {
        let h = this._def.catchall;
        for (let p of o) {
          let y = i.data[p];
          c.push({
            key: { status: "valid", value: p },
            value: h._parse(
              new N(i, y, i.path, p)
              //, ctx.child(key), value, getParsedType(value)
            ),
            alwaysSet: p in i.data
          });
        }
      }
      return i.common.async ? Promise.resolve().then(async () => {
        let h = [];
        for (let p of c) {
          let y = await p.key, C = await p.value;
          h.push({
            key: y,
            value: C,
            alwaysSet: p.alwaysSet
          });
        }
        return h;
      }).then((h) => u.ParseStatus.mergeObjectSync(s, h)) : u.ParseStatus.mergeObjectSync(s, c);
    }
    get shape() {
      return this._def.shape();
    }
    strict(e) {
      return g.errorUtil.errToObj, new r({
        ...this._def,
        unknownKeys: "strict",
        ...e !== void 0 ? {
          errorMap: /* @__PURE__ */ d((t, s) => {
            var i, n, a, o;
            let c = (a = (n = (i = this._def).errorMap) === null || n === void 0 ? void 0 : n.call(i, t, s).message) !== null && a !== void 0 ?
            a : s.defaultError;
            return t.code === "unrecognized_keys" ? {
              message: (o = g.errorUtil.errToObj(e).message) !== null && o !== void 0 ? o : c
            } : {
              message: c
            };
          }, "errorMap")
        } : {}
      });
    }
    strip() {
      return new r({
        ...this._def,
        unknownKeys: "strip"
      });
    }
    passthrough() {
      return new r({
        ...this._def,
        unknownKeys: "passthrough"
      });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(e) {
      return new r({
        ...this._def,
        shape: /* @__PURE__ */ d(() => ({
          ...this._def.shape(),
          ...e
        }), "shape")
      });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(e) {
      return new r({
        unknownKeys: e._def.unknownKeys,
        catchall: e._def.catchall,
        shape: /* @__PURE__ */ d(() => ({
          ...this._def.shape(),
          ...e._def.shape()
        }), "shape"),
        typeName: _.ZodObject
      });
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(e, t) {
      return this.augment({ [e]: t });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(e) {
      return new r({
        ...this._def,
        catchall: e
      });
    }
    pick(e) {
      let t = {};
      return m.util.objectKeys(e).forEach((s) => {
        e[s] && this.shape[s] && (t[s] = this.shape[s]);
      }), new r({
        ...this._def,
        shape: /* @__PURE__ */ d(() => t, "shape")
      });
    }
    omit(e) {
      let t = {};
      return m.util.objectKeys(this.shape).forEach((s) => {
        e[s] || (t[s] = this.shape[s]);
      }), new r({
        ...this._def,
        shape: /* @__PURE__ */ d(() => t, "shape")
      });
    }
    /**
     * @deprecated
     */
    deepPartial() {
      return _e(this);
    }
    partial(e) {
      let t = {};
      return m.util.objectKeys(this.shape).forEach((s) => {
        let i = this.shape[s];
        e && !e[s] ? t[s] = i : t[s] = i.optional();
      }), new r({
        ...this._def,
        shape: /* @__PURE__ */ d(() => t, "shape")
      });
    }
    required(e) {
      let t = {};
      return m.util.objectKeys(this.shape).forEach((s) => {
        if (e && !e[s])
          t[s] = this.shape[s];
        else {
          let n = this.shape[s];
          for (; n instanceof P; )
            n = n._def.innerType;
          t[s] = n;
        }
      }), new r({
        ...this._def,
        shape: /* @__PURE__ */ d(() => t, "shape")
      });
    }
    keyof() {
      return gs(m.util.objectKeys(this.shape));
    }
  };
  l.ZodObject = A;
  A.create = (r, e) => new A({
    shape: /* @__PURE__ */ d(() => r, "shape"),
    unknownKeys: "strip",
    catchall: D.create(),
    typeName: _.ZodObject,
    ...v(e)
  });
  A.strictCreate = (r, e) => new A({
    shape: /* @__PURE__ */ d(() => r, "shape"),
    unknownKeys: "strict",
    catchall: D.create(),
    typeName: _.ZodObject,
    ...v(e)
  });
  A.lazycreate = (r, e) => new A({
    shape: r,
    unknownKeys: "strip",
    catchall: D.create(),
    typeName: _.ZodObject,
    ...v(e)
  });
  var ne = class extends b {
    static {
      d(this, "ZodUnion");
    }
    _parse(e) {
      let { ctx: t } = this._processInputParams(e), s = this._def.options;
      function i(n) {
        for (let o of n)
          if (o.result.status === "valid")
            return o.result;
        for (let o of n)
          if (o.result.status === "dirty")
            return t.common.issues.push(...o.ctx.common.issues), o.result;
        let a = n.map((o) => new f.ZodError(o.ctx.common.issues));
        return (0, u.addIssueToContext)(t, {
          code: f.ZodIssueCode.invalid_union,
          unionErrors: a
        }), u.INVALID;
      }
      if (d(i, "handleResults"), t.common.async)
        return Promise.all(s.map(async (n) => {
          let a = {
            ...t,
            common: {
              ...t.common,
              issues: []
            },
            parent: null
          };
          return {
            result: await n._parseAsync({
              data: t.data,
              path: t.path,
              parent: a
            }),
            ctx: a
          };
        })).then(i);
      {
        let n, a = [];
        for (let c of s) {
          let h = {
            ...t,
            common: {
              ...t.common,
              issues: []
            },
            parent: null
          }, p = c._parseSync({
            data: t.data,
            path: t.path,
            parent: h
          });
          if (p.status === "valid")
            return p;
          p.status === "dirty" && !n && (n = { result: p, ctx: h }), h.common.issues.length && a.push(h.common.issues);
        }
        if (n)
          return t.common.issues.push(...n.ctx.common.issues), n.result;
        let o = a.map((c) => new f.ZodError(c));
        return (0, u.addIssueToContext)(t, {
          code: f.ZodIssueCode.invalid_union,
          unionErrors: o
        }), u.INVALID;
      }
    }
    get options() {
      return this._def.options;
    }
  };
  l.ZodUnion = ne;
  ne.create = (r, e) => new ne({
    options: r,
    typeName: _.ZodUnion,
    ...v(e)
  });
  var q = /* @__PURE__ */ d((r) => r instanceof oe ? q(r.schema) : r instanceof S ? q(r.innerType()) : r instanceof de ? [r.value] : r instanceof
  le ? r.options : r instanceof ue ? m.util.objectValues(r.enum) : r instanceof ce ? q(r._def.innerType) : r instanceof re ? [void 0] : r instanceof
  ie ? [null] : r instanceof P ? [void 0, ...q(r.unwrap())] : r instanceof M ? [null, ...q(r.unwrap())] : r instanceof Pe || r instanceof pe ?
  q(r.unwrap()) : r instanceof he ? q(r._def.innerType) : [], "getDiscriminator"), We = class r extends b {
    static {
      d(this, "ZodDiscriminatedUnion");
    }
    _parse(e) {
      let { ctx: t } = this._processInputParams(e);
      if (t.parsedType !== m.ZodParsedType.object)
        return (0, u.addIssueToContext)(t, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.object,
          received: t.parsedType
        }), u.INVALID;
      let s = this.discriminator, i = t.data[s], n = this.optionsMap.get(i);
      return n ? t.common.async ? n._parseAsync({
        data: t.data,
        path: t.path,
        parent: t
      }) : n._parseSync({
        data: t.data,
        path: t.path,
        parent: t
      }) : ((0, u.addIssueToContext)(t, {
        code: f.ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [s]
      }), u.INVALID);
    }
    get discriminator() {
      return this._def.discriminator;
    }
    get options() {
      return this._def.options;
    }
    get optionsMap() {
      return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(e, t, s) {
      let i = /* @__PURE__ */ new Map();
      for (let n of t) {
        let a = q(n.shape[e]);
        if (!a.length)
          throw new Error(`A discriminator value for key \`${e}\` could not be extracted from all schema options`);
        for (let o of a) {
          if (i.has(o))
            throw new Error(`Discriminator property ${String(e)} has duplicate value ${String(o)}`);
          i.set(o, n);
        }
      }
      return new r({
        typeName: _.ZodDiscriminatedUnion,
        discriminator: e,
        options: t,
        optionsMap: i,
        ...v(s)
      });
    }
  };
  l.ZodDiscriminatedUnion = We;
  function Tt(r, e) {
    let t = (0, m.getParsedType)(r), s = (0, m.getParsedType)(e);
    if (r === e)
      return { valid: !0, data: r };
    if (t === m.ZodParsedType.object && s === m.ZodParsedType.object) {
      let i = m.util.objectKeys(e), n = m.util.objectKeys(r).filter((o) => i.indexOf(o) !== -1), a = { ...r, ...e };
      for (let o of n) {
        let c = Tt(r[o], e[o]);
        if (!c.valid)
          return { valid: !1 };
        a[o] = c.data;
      }
      return { valid: !0, data: a };
    } else if (t === m.ZodParsedType.array && s === m.ZodParsedType.array) {
      if (r.length !== e.length)
        return { valid: !1 };
      let i = [];
      for (let n = 0; n < r.length; n++) {
        let a = r[n], o = e[n], c = Tt(a, o);
        if (!c.valid)
          return { valid: !1 };
        i.push(c.data);
      }
      return { valid: !0, data: i };
    } else return t === m.ZodParsedType.date && s === m.ZodParsedType.date && +r == +e ? { valid: !0, data: r } : { valid: !1 };
  }
  d(Tt, "mergeValues");
  var ae = class extends b {
    static {
      d(this, "ZodIntersection");
    }
    _parse(e) {
      let { status: t, ctx: s } = this._processInputParams(e), i = /* @__PURE__ */ d((n, a) => {
        if ((0, u.isAborted)(n) || (0, u.isAborted)(a))
          return u.INVALID;
        let o = Tt(n.value, a.value);
        return o.valid ? (((0, u.isDirty)(n) || (0, u.isDirty)(a)) && t.dirty(), { status: t.value, value: o.data }) : ((0, u.addIssueToContext)(
        s, {
          code: f.ZodIssueCode.invalid_intersection_types
        }), u.INVALID);
      }, "handleParsed");
      return s.common.async ? Promise.all([
        this._def.left._parseAsync({
          data: s.data,
          path: s.path,
          parent: s
        }),
        this._def.right._parseAsync({
          data: s.data,
          path: s.path,
          parent: s
        })
      ]).then(([n, a]) => i(n, a)) : i(this._def.left._parseSync({
        data: s.data,
        path: s.path,
        parent: s
      }), this._def.right._parseSync({
        data: s.data,
        path: s.path,
        parent: s
      }));
    }
  };
  l.ZodIntersection = ae;
  ae.create = (r, e, t) => new ae({
    left: r,
    right: e,
    typeName: _.ZodIntersection,
    ...v(t)
  });
  var R = class r extends b {
    static {
      d(this, "ZodTuple");
    }
    _parse(e) {
      let { status: t, ctx: s } = this._processInputParams(e);
      if (s.parsedType !== m.ZodParsedType.array)
        return (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.array,
          received: s.parsedType
        }), u.INVALID;
      if (s.data.length < this._def.items.length)
        return (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.too_small,
          minimum: this._def.items.length,
          inclusive: !0,
          exact: !1,
          type: "array"
        }), u.INVALID;
      !this._def.rest && s.data.length > this._def.items.length && ((0, u.addIssueToContext)(s, {
        code: f.ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: !0,
        exact: !1,
        type: "array"
      }), t.dirty());
      let n = [...s.data].map((a, o) => {
        let c = this._def.items[o] || this._def.rest;
        return c ? c._parse(new N(s, a, s.path, o)) : null;
      }).filter((a) => !!a);
      return s.common.async ? Promise.all(n).then((a) => u.ParseStatus.mergeArray(t, a)) : u.ParseStatus.mergeArray(t, n);
    }
    get items() {
      return this._def.items;
    }
    rest(e) {
      return new r({
        ...this._def,
        rest: e
      });
    }
  };
  l.ZodTuple = R;
  R.create = (r, e) => {
    if (!Array.isArray(r))
      throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    return new R({
      items: r,
      typeName: _.ZodTuple,
      rest: null,
      ...v(e)
    });
  };
  var ze = class r extends b {
    static {
      d(this, "ZodRecord");
    }
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(e) {
      let { status: t, ctx: s } = this._processInputParams(e);
      if (s.parsedType !== m.ZodParsedType.object)
        return (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.object,
          received: s.parsedType
        }), u.INVALID;
      let i = [], n = this._def.keyType, a = this._def.valueType;
      for (let o in s.data)
        i.push({
          key: n._parse(new N(s, o, s.path, o)),
          value: a._parse(new N(s, s.data[o], s.path, o)),
          alwaysSet: o in s.data
        });
      return s.common.async ? u.ParseStatus.mergeObjectAsync(t, i) : u.ParseStatus.mergeObjectSync(t, i);
    }
    get element() {
      return this._def.valueType;
    }
    static create(e, t, s) {
      return t instanceof b ? new r({
        keyType: e,
        valueType: t,
        typeName: _.ZodRecord,
        ...v(s)
      }) : new r({
        keyType: G.create(),
        valueType: e,
        typeName: _.ZodRecord,
        ...v(t)
      });
    }
  };
  l.ZodRecord = ze;
  var xe = class extends b {
    static {
      d(this, "ZodMap");
    }
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(e) {
      let { status: t, ctx: s } = this._processInputParams(e);
      if (s.parsedType !== m.ZodParsedType.map)
        return (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.map,
          received: s.parsedType
        }), u.INVALID;
      let i = this._def.keyType, n = this._def.valueType, a = [...s.data.entries()].map(([o, c], h) => ({
        key: i._parse(new N(s, o, s.path, [h, "key"])),
        value: n._parse(new N(s, c, s.path, [h, "value"]))
      }));
      if (s.common.async) {
        let o = /* @__PURE__ */ new Map();
        return Promise.resolve().then(async () => {
          for (let c of a) {
            let h = await c.key, p = await c.value;
            if (h.status === "aborted" || p.status === "aborted")
              return u.INVALID;
            (h.status === "dirty" || p.status === "dirty") && t.dirty(), o.set(h.value, p.value);
          }
          return { status: t.value, value: o };
        });
      } else {
        let o = /* @__PURE__ */ new Map();
        for (let c of a) {
          let h = c.key, p = c.value;
          if (h.status === "aborted" || p.status === "aborted")
            return u.INVALID;
          (h.status === "dirty" || p.status === "dirty") && t.dirty(), o.set(h.value, p.value);
        }
        return { status: t.value, value: o };
      }
    }
  };
  l.ZodMap = xe;
  xe.create = (r, e, t) => new xe({
    valueType: e,
    keyType: r,
    typeName: _.ZodMap,
    ...v(t)
  });
  var we = class r extends b {
    static {
      d(this, "ZodSet");
    }
    _parse(e) {
      let { status: t, ctx: s } = this._processInputParams(e);
      if (s.parsedType !== m.ZodParsedType.set)
        return (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.set,
          received: s.parsedType
        }), u.INVALID;
      let i = this._def;
      i.minSize !== null && s.data.size < i.minSize.value && ((0, u.addIssueToContext)(s, {
        code: f.ZodIssueCode.too_small,
        minimum: i.minSize.value,
        type: "set",
        inclusive: !0,
        exact: !1,
        message: i.minSize.message
      }), t.dirty()), i.maxSize !== null && s.data.size > i.maxSize.value && ((0, u.addIssueToContext)(s, {
        code: f.ZodIssueCode.too_big,
        maximum: i.maxSize.value,
        type: "set",
        inclusive: !0,
        exact: !1,
        message: i.maxSize.message
      }), t.dirty());
      let n = this._def.valueType;
      function a(c) {
        let h = /* @__PURE__ */ new Set();
        for (let p of c) {
          if (p.status === "aborted")
            return u.INVALID;
          p.status === "dirty" && t.dirty(), h.add(p.value);
        }
        return { status: t.value, value: h };
      }
      d(a, "finalizeSet");
      let o = [...s.data.values()].map((c, h) => n._parse(new N(s, c, s.path, h)));
      return s.common.async ? Promise.all(o).then((c) => a(c)) : a(o);
    }
    min(e, t) {
      return new r({
        ...this._def,
        minSize: { value: e, message: g.errorUtil.toString(t) }
      });
    }
    max(e, t) {
      return new r({
        ...this._def,
        maxSize: { value: e, message: g.errorUtil.toString(t) }
      });
    }
    size(e, t) {
      return this.min(e, t).max(e, t);
    }
    nonempty(e) {
      return this.min(1, e);
    }
  };
  l.ZodSet = we;
  we.create = (r, e) => new we({
    valueType: r,
    minSize: null,
    maxSize: null,
    typeName: _.ZodSet,
    ...v(e)
  });
  var Ge = class r extends b {
    static {
      d(this, "ZodFunction");
    }
    constructor() {
      super(...arguments), this.validate = this.implement;
    }
    _parse(e) {
      let { ctx: t } = this._processInputParams(e);
      if (t.parsedType !== m.ZodParsedType.function)
        return (0, u.addIssueToContext)(t, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.function,
          received: t.parsedType
        }), u.INVALID;
      function s(o, c) {
        return (0, u.makeIssue)({
          data: o,
          path: t.path,
          errorMaps: [
            t.common.contextualErrorMap,
            t.schemaErrorMap,
            (0, He.getErrorMap)(),
            He.defaultErrorMap
          ].filter((h) => !!h),
          issueData: {
            code: f.ZodIssueCode.invalid_arguments,
            argumentsError: c
          }
        });
      }
      d(s, "makeArgsIssue");
      function i(o, c) {
        return (0, u.makeIssue)({
          data: o,
          path: t.path,
          errorMaps: [
            t.common.contextualErrorMap,
            t.schemaErrorMap,
            (0, He.getErrorMap)(),
            He.defaultErrorMap
          ].filter((h) => !!h),
          issueData: {
            code: f.ZodIssueCode.invalid_return_type,
            returnTypeError: c
          }
        });
      }
      d(i, "makeReturnsIssue");
      let n = { errorMap: t.common.contextualErrorMap }, a = t.data;
      if (this._def.returns instanceof Y) {
        let o = this;
        return (0, u.OK)(async function(...c) {
          let h = new f.ZodError([]), p = await o._def.args.parseAsync(c, n).catch((j) => {
            throw h.addIssue(s(c, j)), h;
          }), y = await Reflect.apply(a, this, p);
          return await o._def.returns._def.type.parseAsync(y, n).catch((j) => {
            throw h.addIssue(i(y, j)), h;
          });
        });
      } else {
        let o = this;
        return (0, u.OK)(function(...c) {
          let h = o._def.args.safeParse(c, n);
          if (!h.success)
            throw new f.ZodError([s(c, h.error)]);
          let p = Reflect.apply(a, this, h.data), y = o._def.returns.safeParse(p, n);
          if (!y.success)
            throw new f.ZodError([i(p, y.error)]);
          return y.data;
        });
      }
    }
    parameters() {
      return this._def.args;
    }
    returnType() {
      return this._def.returns;
    }
    args(...e) {
      return new r({
        ...this._def,
        args: R.create(e).rest(U.create())
      });
    }
    returns(e) {
      return new r({
        ...this._def,
        returns: e
      });
    }
    implement(e) {
      return this.parse(e);
    }
    strictImplement(e) {
      return this.parse(e);
    }
    static create(e, t, s) {
      return new r({
        args: e || R.create([]).rest(U.create()),
        returns: t || U.create(),
        typeName: _.ZodFunction,
        ...v(s)
      });
    }
  };
  l.ZodFunction = Ge;
  var oe = class extends b {
    static {
      d(this, "ZodLazy");
    }
    get schema() {
      return this._def.getter();
    }
    _parse(e) {
      let { ctx: t } = this._processInputParams(e);
      return this._def.getter()._parse({ data: t.data, path: t.path, parent: t });
    }
  };
  l.ZodLazy = oe;
  oe.create = (r, e) => new oe({
    getter: r,
    typeName: _.ZodLazy,
    ...v(e)
  });
  var de = class extends b {
    static {
      d(this, "ZodLiteral");
    }
    _parse(e) {
      if (e.data !== this._def.value) {
        let t = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(t, {
          received: t.data,
          code: f.ZodIssueCode.invalid_literal,
          expected: this._def.value
        }), u.INVALID;
      }
      return { status: "valid", value: e.data };
    }
    get value() {
      return this._def.value;
    }
  };
  l.ZodLiteral = de;
  de.create = (r, e) => new de({
    value: r,
    typeName: _.ZodLiteral,
    ...v(e)
  });
  function gs(r, e) {
    return new le({
      values: r,
      typeName: _.ZodEnum,
      ...v(e)
    });
  }
  d(gs, "createZodEnum");
  var le = class r extends b {
    static {
      d(this, "ZodEnum");
    }
    constructor() {
      super(...arguments), Se.set(this, void 0);
    }
    _parse(e) {
      if (typeof e.data != "string") {
        let t = this._getOrReturnCtx(e), s = this._def.values;
        return (0, u.addIssueToContext)(t, {
          expected: m.util.joinValues(s),
          received: t.parsedType,
          code: f.ZodIssueCode.invalid_type
        }), u.INVALID;
      }
      if (Be(this, Se, "f") || hs(this, Se, new Set(this._def.values), "f"), !Be(this, Se, "f").has(e.data)) {
        let t = this._getOrReturnCtx(e), s = this._def.values;
        return (0, u.addIssueToContext)(t, {
          received: t.data,
          code: f.ZodIssueCode.invalid_enum_value,
          options: s
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      let e = {};
      for (let t of this._def.values)
        e[t] = t;
      return e;
    }
    get Values() {
      let e = {};
      for (let t of this._def.values)
        e[t] = t;
      return e;
    }
    get Enum() {
      let e = {};
      for (let t of this._def.values)
        e[t] = t;
      return e;
    }
    extract(e, t = this._def) {
      return r.create(e, {
        ...this._def,
        ...t
      });
    }
    exclude(e, t = this._def) {
      return r.create(this.options.filter((s) => !e.includes(s)), {
        ...this._def,
        ...t
      });
    }
  };
  l.ZodEnum = le;
  Se = /* @__PURE__ */ new WeakMap();
  le.create = gs;
  var ue = class extends b {
    static {
      d(this, "ZodNativeEnum");
    }
    constructor() {
      super(...arguments), Ee.set(this, void 0);
    }
    _parse(e) {
      let t = m.util.getValidEnumValues(this._def.values), s = this._getOrReturnCtx(e);
      if (s.parsedType !== m.ZodParsedType.string && s.parsedType !== m.ZodParsedType.number) {
        let i = m.util.objectValues(t);
        return (0, u.addIssueToContext)(s, {
          expected: m.util.joinValues(i),
          received: s.parsedType,
          code: f.ZodIssueCode.invalid_type
        }), u.INVALID;
      }
      if (Be(this, Ee, "f") || hs(this, Ee, new Set(m.util.getValidEnumValues(this._def.values)), "f"), !Be(this, Ee, "f").has(e.data)) {
        let i = m.util.objectValues(t);
        return (0, u.addIssueToContext)(s, {
          received: s.data,
          code: f.ZodIssueCode.invalid_enum_value,
          options: i
        }), u.INVALID;
      }
      return (0, u.OK)(e.data);
    }
    get enum() {
      return this._def.values;
    }
  };
  l.ZodNativeEnum = ue;
  Ee = /* @__PURE__ */ new WeakMap();
  ue.create = (r, e) => new ue({
    values: r,
    typeName: _.ZodNativeEnum,
    ...v(e)
  });
  var Y = class extends b {
    static {
      d(this, "ZodPromise");
    }
    unwrap() {
      return this._def.type;
    }
    _parse(e) {
      let { ctx: t } = this._processInputParams(e);
      if (t.parsedType !== m.ZodParsedType.promise && t.common.async === !1)
        return (0, u.addIssueToContext)(t, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.promise,
          received: t.parsedType
        }), u.INVALID;
      let s = t.parsedType === m.ZodParsedType.promise ? t.data : Promise.resolve(t.data);
      return (0, u.OK)(s.then((i) => this._def.type.parseAsync(i, {
        path: t.path,
        errorMap: t.common.contextualErrorMap
      })));
    }
  };
  l.ZodPromise = Y;
  Y.create = (r, e) => new Y({
    type: r,
    typeName: _.ZodPromise,
    ...v(e)
  });
  var S = class extends b {
    static {
      d(this, "ZodEffects");
    }
    innerType() {
      return this._def.schema;
    }
    sourceType() {
      return this._def.schema._def.typeName === _.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
    }
    _parse(e) {
      let { status: t, ctx: s } = this._processInputParams(e), i = this._def.effect || null, n = {
        addIssue: /* @__PURE__ */ d((a) => {
          (0, u.addIssueToContext)(s, a), a.fatal ? t.abort() : t.dirty();
        }, "addIssue"),
        get path() {
          return s.path;
        }
      };
      if (n.addIssue = n.addIssue.bind(n), i.type === "preprocess") {
        let a = i.transform(s.data, n);
        if (s.common.async)
          return Promise.resolve(a).then(async (o) => {
            if (t.value === "aborted")
              return u.INVALID;
            let c = await this._def.schema._parseAsync({
              data: o,
              path: s.path,
              parent: s
            });
            return c.status === "aborted" ? u.INVALID : c.status === "dirty" || t.value === "dirty" ? (0, u.DIRTY)(c.value) : c;
          });
        {
          if (t.value === "aborted")
            return u.INVALID;
          let o = this._def.schema._parseSync({
            data: a,
            path: s.path,
            parent: s
          });
          return o.status === "aborted" ? u.INVALID : o.status === "dirty" || t.value === "dirty" ? (0, u.DIRTY)(o.value) : o;
        }
      }
      if (i.type === "refinement") {
        let a = /* @__PURE__ */ d((o) => {
          let c = i.refinement(o, n);
          if (s.common.async)
            return Promise.resolve(c);
          if (c instanceof Promise)
            throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
          return o;
        }, "executeRefinement");
        if (s.common.async === !1) {
          let o = this._def.schema._parseSync({
            data: s.data,
            path: s.path,
            parent: s
          });
          return o.status === "aborted" ? u.INVALID : (o.status === "dirty" && t.dirty(), a(o.value), { status: t.value, value: o.value });
        } else
          return this._def.schema._parseAsync({ data: s.data, path: s.path, parent: s }).then((o) => o.status === "aborted" ? u.INVALID : (o.
          status === "dirty" && t.dirty(), a(o.value).then(() => ({ status: t.value, value: o.value }))));
      }
      if (i.type === "transform")
        if (s.common.async === !1) {
          let a = this._def.schema._parseSync({
            data: s.data,
            path: s.path,
            parent: s
          });
          if (!(0, u.isValid)(a))
            return a;
          let o = i.transform(a.value, n);
          if (o instanceof Promise)
            throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
          return { status: t.value, value: o };
        } else
          return this._def.schema._parseAsync({ data: s.data, path: s.path, parent: s }).then((a) => (0, u.isValid)(a) ? Promise.resolve(i.transform(
          a.value, n)).then((o) => ({ status: t.value, value: o })) : a);
      m.util.assertNever(i);
    }
  };
  l.ZodEffects = S;
  l.ZodTransformer = S;
  S.create = (r, e, t) => new S({
    schema: r,
    typeName: _.ZodEffects,
    effect: e,
    ...v(t)
  });
  S.createWithPreprocess = (r, e, t) => new S({
    schema: e,
    effect: { type: "preprocess", transform: r },
    typeName: _.ZodEffects,
    ...v(t)
  });
  var P = class extends b {
    static {
      d(this, "ZodOptional");
    }
    _parse(e) {
      return this._getType(e) === m.ZodParsedType.undefined ? (0, u.OK)(void 0) : this._def.innerType._parse(e);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  l.ZodOptional = P;
  P.create = (r, e) => new P({
    innerType: r,
    typeName: _.ZodOptional,
    ...v(e)
  });
  var M = class extends b {
    static {
      d(this, "ZodNullable");
    }
    _parse(e) {
      return this._getType(e) === m.ZodParsedType.null ? (0, u.OK)(null) : this._def.innerType._parse(e);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  l.ZodNullable = M;
  M.create = (r, e) => new M({
    innerType: r,
    typeName: _.ZodNullable,
    ...v(e)
  });
  var ce = class extends b {
    static {
      d(this, "ZodDefault");
    }
    _parse(e) {
      let { ctx: t } = this._processInputParams(e), s = t.data;
      return t.parsedType === m.ZodParsedType.undefined && (s = this._def.defaultValue()), this._def.innerType._parse({
        data: s,
        path: t.path,
        parent: t
      });
    }
    removeDefault() {
      return this._def.innerType;
    }
  };
  l.ZodDefault = ce;
  ce.create = (r, e) => new ce({
    innerType: r,
    typeName: _.ZodDefault,
    defaultValue: typeof e.default == "function" ? e.default : () => e.default,
    ...v(e)
  });
  var he = class extends b {
    static {
      d(this, "ZodCatch");
    }
    _parse(e) {
      let { ctx: t } = this._processInputParams(e), s = {
        ...t,
        common: {
          ...t.common,
          issues: []
        }
      }, i = this._def.innerType._parse({
        data: s.data,
        path: s.path,
        parent: {
          ...s
        }
      });
      return (0, u.isAsync)(i) ? i.then((n) => ({
        status: "valid",
        value: n.status === "valid" ? n.value : this._def.catchValue({
          get error() {
            return new f.ZodError(s.common.issues);
          },
          input: s.data
        })
      })) : {
        status: "valid",
        value: i.status === "valid" ? i.value : this._def.catchValue({
          get error() {
            return new f.ZodError(s.common.issues);
          },
          input: s.data
        })
      };
    }
    removeCatch() {
      return this._def.innerType;
    }
  };
  l.ZodCatch = he;
  he.create = (r, e) => new he({
    innerType: r,
    typeName: _.ZodCatch,
    catchValue: typeof e.catch == "function" ? e.catch : () => e.catch,
    ...v(e)
  });
  var Ce = class extends b {
    static {
      d(this, "ZodNaN");
    }
    _parse(e) {
      if (this._getType(e) !== m.ZodParsedType.nan) {
        let s = this._getOrReturnCtx(e);
        return (0, u.addIssueToContext)(s, {
          code: f.ZodIssueCode.invalid_type,
          expected: m.ZodParsedType.nan,
          received: s.parsedType
        }), u.INVALID;
      }
      return { status: "valid", value: e.data };
    }
  };
  l.ZodNaN = Ce;
  Ce.create = (r) => new Ce({
    typeName: _.ZodNaN,
    ...v(r)
  });
  l.BRAND = Symbol("zod_brand");
  var Pe = class extends b {
    static {
      d(this, "ZodBranded");
    }
    _parse(e) {
      let { ctx: t } = this._processInputParams(e), s = t.data;
      return this._def.type._parse({
        data: s,
        path: t.path,
        parent: t
      });
    }
    unwrap() {
      return this._def.type;
    }
  };
  l.ZodBranded = Pe;
  var Ne = class r extends b {
    static {
      d(this, "ZodPipeline");
    }
    _parse(e) {
      let { status: t, ctx: s } = this._processInputParams(e);
      if (s.common.async)
        return (/* @__PURE__ */ d(async () => {
          let n = await this._def.in._parseAsync({
            data: s.data,
            path: s.path,
            parent: s
          });
          return n.status === "aborted" ? u.INVALID : n.status === "dirty" ? (t.dirty(), (0, u.DIRTY)(n.value)) : this._def.out._parseAsync(
          {
            data: n.value,
            path: s.path,
            parent: s
          });
        }, "handleAsync"))();
      {
        let i = this._def.in._parseSync({
          data: s.data,
          path: s.path,
          parent: s
        });
        return i.status === "aborted" ? u.INVALID : i.status === "dirty" ? (t.dirty(), {
          status: "dirty",
          value: i.value
        }) : this._def.out._parseSync({
          data: i.value,
          path: s.path,
          parent: s
        });
      }
    }
    static create(e, t) {
      return new r({
        in: e,
        out: t,
        typeName: _.ZodPipeline
      });
    }
  };
  l.ZodPipeline = Ne;
  var pe = class extends b {
    static {
      d(this, "ZodReadonly");
    }
    _parse(e) {
      let t = this._def.innerType._parse(e), s = /* @__PURE__ */ d((i) => ((0, u.isValid)(i) && (i.value = Object.freeze(i.value)), i), "fre\
eze");
      return (0, u.isAsync)(t) ? t.then((i) => s(i)) : s(t);
    }
    unwrap() {
      return this._def.innerType;
    }
  };
  l.ZodReadonly = pe;
  pe.create = (r, e) => new pe({
    innerType: r,
    typeName: _.ZodReadonly,
    ...v(e)
  });
  function cs(r, e) {
    let t = typeof r == "function" ? r(e) : typeof r == "string" ? { message: r } : r;
    return typeof t == "string" ? { message: t } : t;
  }
  d(cs, "cleanParams");
  function ys(r, e = {}, t) {
    return r ? J.create().superRefine((s, i) => {
      var n, a;
      let o = r(s);
      if (o instanceof Promise)
        return o.then((c) => {
          var h, p;
          if (!c) {
            let y = cs(e, s), C = (p = (h = y.fatal) !== null && h !== void 0 ? h : t) !== null && p !== void 0 ? p : !0;
            i.addIssue({ code: "custom", ...y, fatal: C });
          }
        });
      if (!o) {
        let c = cs(e, s), h = (a = (n = c.fatal) !== null && n !== void 0 ? n : t) !== null && a !== void 0 ? a : !0;
        i.addIssue({ code: "custom", ...c, fatal: h });
      }
    }) : J.create();
  }
  d(ys, "custom");
  l.custom = ys;
  l.late = {
    object: A.lazycreate
  };
  var _;
  (function(r) {
    r.ZodString = "ZodString", r.ZodNumber = "ZodNumber", r.ZodNaN = "ZodNaN", r.ZodBigInt = "ZodBigInt", r.ZodBoolean = "ZodBoolean", r.ZodDate =
    "ZodDate", r.ZodSymbol = "ZodSymbol", r.ZodUndefined = "ZodUndefined", r.ZodNull = "ZodNull", r.ZodAny = "ZodAny", r.ZodUnknown = "ZodUn\
known", r.ZodNever = "ZodNever", r.ZodVoid = "ZodVoid", r.ZodArray = "ZodArray", r.ZodObject = "ZodObject", r.ZodUnion = "ZodUnion", r.ZodDiscriminatedUnion =
    "ZodDiscriminatedUnion", r.ZodIntersection = "ZodIntersection", r.ZodTuple = "ZodTuple", r.ZodRecord = "ZodRecord", r.ZodMap = "ZodMap",
    r.ZodSet = "ZodSet", r.ZodFunction = "ZodFunction", r.ZodLazy = "ZodLazy", r.ZodLiteral = "ZodLiteral", r.ZodEnum = "ZodEnum", r.ZodEffects =
    "ZodEffects", r.ZodNativeEnum = "ZodNativeEnum", r.ZodOptional = "ZodOptional", r.ZodNullable = "ZodNullable", r.ZodDefault = "ZodDefaul\
t", r.ZodCatch = "ZodCatch", r.ZodPromise = "ZodPromise", r.ZodBranded = "ZodBranded", r.ZodPipeline = "ZodPipeline", r.ZodReadonly = "ZodRe\
adonly";
  })(_ || (l.ZodFirstPartyTypeKind = _ = {}));
  var ti = /* @__PURE__ */ d((r, e = {
    message: `Input not instance of ${r.name}`
  }) => ys((t) => t instanceof r, e), "instanceOfType");
  l.instanceof = ti;
  var _s = G.create;
  l.string = _s;
  var vs = Q.create;
  l.number = vs;
  var si = Ce.create;
  l.nan = si;
  var ri = ee.create;
  l.bigint = ri;
  var bs = te.create;
  l.boolean = bs;
  var ii = se.create;
  l.date = ii;
  var ni = ve.create;
  l.symbol = ni;
  var ai = re.create;
  l.undefined = ai;
  var oi = ie.create;
  l.null = oi;
  var di = J.create;
  l.any = di;
  var li = U.create;
  l.unknown = li;
  var ui = D.create;
  l.never = ui;
  var ci = be.create;
  l.void = ci;
  var hi = F.create;
  l.array = hi;
  var pi = A.create;
  l.object = pi;
  var fi = A.strictCreate;
  l.strictObject = fi;
  var mi = ne.create;
  l.union = mi;
  var gi = We.create;
  l.discriminatedUnion = gi;
  var yi = ae.create;
  l.intersection = yi;
  var _i = R.create;
  l.tuple = _i;
  var vi = ze.create;
  l.record = vi;
  var bi = xe.create;
  l.map = bi;
  var xi = we.create;
  l.set = xi;
  var wi = Ge.create;
  l.function = wi;
  var Ci = oe.create;
  l.lazy = Ci;
  var ki = de.create;
  l.literal = ki;
  var Ii = le.create;
  l.enum = Ii;
  var Ti = ue.create;
  l.nativeEnum = Ti;
  var Oi = Y.create;
  l.promise = Oi;
  var xs = S.create;
  l.effect = xs;
  l.transformer = xs;
  var Ai = P.create;
  l.optional = Ai;
  var Zi = M.create;
  l.nullable = Zi;
  var ji = S.createWithPreprocess;
  l.preprocess = ji;
  var Si = Ne.create;
  l.pipeline = Si;
  var Ei = /* @__PURE__ */ d(() => _s().optional(), "ostring");
  l.ostring = Ei;
  var Pi = /* @__PURE__ */ d(() => vs().optional(), "onumber");
  l.onumber = Pi;
  var Ni = /* @__PURE__ */ d(() => bs().optional(), "oboolean");
  l.oboolean = Ni;
  l.coerce = {
    string: /* @__PURE__ */ d((r) => G.create({ ...r, coerce: !0 }), "string"),
    number: /* @__PURE__ */ d((r) => Q.create({ ...r, coerce: !0 }), "number"),
    boolean: /* @__PURE__ */ d((r) => te.create({
      ...r,
      coerce: !0
    }), "boolean"),
    bigint: /* @__PURE__ */ d((r) => ee.create({ ...r, coerce: !0 }), "bigint"),
    date: /* @__PURE__ */ d((r) => se.create({ ...r, coerce: !0 }), "date")
  };
  l.NEVER = u.INVALID;
});

// ../node_modules/zod/lib/external.js
var Ot = T((V) => {
  "use strict";
  var Vi = V && V.__createBinding || (Object.create ? function(r, e, t, s) {
    s === void 0 && (s = t);
    var i = Object.getOwnPropertyDescriptor(e, t);
    (!i || ("get" in i ? !e.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: /* @__PURE__ */ d(function() {
      return e[t];
    }, "get") }), Object.defineProperty(r, s, i);
  } : function(r, e, t, s) {
    s === void 0 && (s = t), r[s] = e[t];
  }), ke = V && V.__exportStar || function(r, e) {
    for (var t in r) t !== "default" && !Object.prototype.hasOwnProperty.call(e, t) && Vi(e, r, t);
  };
  Object.defineProperty(V, "__esModule", { value: !0 });
  ke(Ue(), V);
  ke(kt(), V);
  ke(os(), V);
  ke(Ze(), V);
  ke(ws(), V);
  ke(qe(), V);
});

// ../node_modules/zod/lib/index.js
var Is = T((Z) => {
  "use strict";
  var Cs = Z && Z.__createBinding || (Object.create ? function(r, e, t, s) {
    s === void 0 && (s = t);
    var i = Object.getOwnPropertyDescriptor(e, t);
    (!i || ("get" in i ? !e.__esModule : i.writable || i.configurable)) && (i = { enumerable: !0, get: /* @__PURE__ */ d(function() {
      return e[t];
    }, "get") }), Object.defineProperty(r, s, i);
  } : function(r, e, t, s) {
    s === void 0 && (s = t), r[s] = e[t];
  }), Di = Z && Z.__setModuleDefault || (Object.create ? function(r, e) {
    Object.defineProperty(r, "default", { enumerable: !0, value: e });
  } : function(r, e) {
    r.default = e;
  }), $i = Z && Z.__importStar || function(r) {
    if (r && r.__esModule) return r;
    var e = {};
    if (r != null) for (var t in r) t !== "default" && Object.prototype.hasOwnProperty.call(r, t) && Cs(e, r, t);
    return Di(e, r), e;
  }, Ri = Z && Z.__exportStar || function(r, e) {
    for (var t in r) t !== "default" && !Object.prototype.hasOwnProperty.call(e, t) && Cs(e, r, t);
  };
  Object.defineProperty(Z, "__esModule", { value: !0 });
  Z.z = void 0;
  var ks = $i(Ot());
  Z.z = ks;
  Ri(Ot(), Z);
  Z.default = ks;
});

// src/cli/bin/index.ts
var Ve = ye(Ft(), 1);
import { getEnvConfig as jt, optionalEnvToBoolean as As, parseList as Bi } from "storybook/internal/common";
import { logTracker as Zt, logger as fe } from "storybook/internal/node-logger";
import { addToGlobalContext as Wi } from "storybook/internal/telemetry";

// ../node_modules/fd-package-json/dist/esm/main.js
var Wt = ye(Bt(), 1);
import { resolve as Ks } from "node:path";
import { stat as Xs, readFile as Qs } from "node:fs/promises";
import { statSync as pn, readFileSync as fn } from "node:fs";
async function er(r) {
  try {
    return (await Xs(r)).isFile();
  } catch {
    return !1;
  }
}
d(er, "fileExists");
async function tr(r) {
  for (let e of (0, Wt.walkUp)(r)) {
    let t = Ks(e, "package.json");
    if (await er(t))
      return t;
  }
  return null;
}
d(tr, "findPackagePath");
async function B(r) {
  let e = await tr(r);
  if (!e)
    return null;
  try {
    let t = await Qs(e, { encoding: "utf8" });
    return JSON.parse(t);
  } catch {
    return null;
  }
}
d(B, "findPackage");

// ../node_modules/leven/index.js
var pt = [], zt = [];
function ft(r, e) {
  if (r === e)
    return 0;
  let t = r;
  r.length > e.length && (r = e, e = t);
  let s = r.length, i = e.length;
  for (; s > 0 && r.charCodeAt(~-s) === e.charCodeAt(~-i); )
    s--, i--;
  let n = 0;
  for (; n < s && r.charCodeAt(n) === e.charCodeAt(n); )
    n++;
  if (s -= n, i -= n, s === 0)
    return i;
  let a, o, c, h, p = 0, y = 0;
  for (; p < s; )
    zt[p] = r.charCodeAt(n + p), pt[p] = ++p;
  for (; y < i; )
    for (a = e.charCodeAt(n + y), c = y++, o = y, p = 0; p < s; p++)
      h = a === zt[p] ? c : c + 1, c = pt[p], o = pt[p] = c > o ? h > o ? o + 1 : h : h > c ? c + 1 : h;
  return o;
}
d(ft, "leven");

// src/cli/bin/index.ts
var me = ye(Yt(), 1);

// ../node_modules/tiny-invariant/dist/esm/tiny-invariant.js
var nr = process.env.NODE_ENV === "production", gt = "Invariant failed";
function W(r, e) {
  if (!r) {
    if (nr)
      throw new Error(gt);
    var t = typeof e == "function" ? e() : e, s = t ? "".concat(gt, ": ").concat(t) : gt;
    throw new Error(s);
  }
}
d(W, "invariant");

// package.json
var yt = "9.1.13";

// src/cli/build.ts
import { cache as or } from "storybook/internal/common";
import { buildStaticStandalone as dr, withTelemetry as lr } from "storybook/internal/core-server";
var Kt = /* @__PURE__ */ d(async (r) => {
  let e = await B(__dirname);
  W(e, "Failed to find the closest package.json file.");
  let t = {
    ...r,
    configDir: r.configDir || "./.storybook",
    outputDir: r.outputDir || "./storybook-static",
    ignorePreview: !!r.previewUrl && !r.forceBuildPreview,
    configType: "PRODUCTION",
    cache: or,
    packageJson: e
  };
  await lr(
    "build",
    { cliOptions: r, presetOptions: t },
    () => dr(t)
  );
}, "build");

// src/cli/buildIndex.ts
import { cache as ur } from "storybook/internal/common";
import { buildIndexStandalone as cr, withTelemetry as hr } from "storybook/internal/core-server";
var Xt = /* @__PURE__ */ d(async (r) => {
  let e = {
    ...r,
    configDir: r.configDir || ".storybook",
    outputFile: r.outputFile || "index.json",
    ignorePreview: !0,
    configType: "PRODUCTION",
    cache: ur,
    packageJson: r.packageJson
  }, t = {
    ...e,
    corePresets: [],
    overridePresets: []
  };
  await hr("index", { cliOptions: r, presetOptions: t }, () => cr(e));
}, "buildIndex");

// src/cli/dev.ts
import { cache as pr } from "storybook/internal/common";
import { buildDevStandalone as fr, withTelemetry as mr } from "storybook/internal/core-server";
import { logger as K, instance as gr } from "storybook/internal/node-logger";
var vt = ye(_t(), 1);
function yr(r) {
  gr.heading = "", r instanceof Error ? r.error ? K.error(r.error) : r.stats && r.stats.compilation.errors ? r.stats.compilation.errors.forEach(
  (e) => K.plain(e)) : K.error(r) : r.compilation?.errors && r.compilation.errors.forEach((e) => K.plain(e)), K.line(), K.warn(
    r.close ? vt.dedent`
          FATAL broken build!, will close the process,
          Fix the error below and restart storybook.
        ` : vt.dedent`
          Broken build, fix the error above.
          You may need to refresh the browser.
        `
  ), K.line();
}
d(yr, "printError");
var es = /* @__PURE__ */ d(async (r) => {
  let { env: e } = process;
  e.NODE_ENV = e.NODE_ENV || "development";
  let t = await B(__dirname);
  W(t, "Failed to find the closest package.json file.");
  let s = {
    ...r,
    configDir: r.configDir || "./.storybook",
    configType: "DEVELOPMENT",
    ignorePreview: !!r.previewUrl && !r.forceBuildPreview,
    cache: pr,
    packageJson: t
  };
  await mr(
    "dev",
    {
      cliOptions: r,
      presetOptions: s,
      printError: yr
    },
    () => fr(s)
  );
}, "dev");

// src/cli/globalSettings.ts
var Ts = ye(_t(), 1), Te = ye(Is(), 1);
import At from "node:fs/promises";
import { homedir as Mi } from "node:os";
import { dirname as Li, join as qi } from "node:path";
var Ui = qi(Mi(), ".storybook", "settings.json"), Fi = 1, Hi = Te.z.object({
  version: Te.z.number(),
  // NOTE: every key (and subkey) below must be optional, for forwards compatibility reasons
  // (we can remove keys once they are deprecated)
  userSince: Te.z.number().optional(),
  init: Te.z.object({ skipOnboarding: Te.z.boolean().optional() }).optional()
}), Ie;
async function Os(r = Ui) {
  if (Ie)
    return Ie;
  try {
    let e = await At.readFile(r, "utf8"), t = Hi.parse(JSON.parse(e));
    Ie = new Je(r, t);
  } catch {
    Ie = new Je(r, { version: Fi, userSince: Date.now() }), await Ie.save();
  }
  return Ie;
}
d(Os, "globalSettings");
var Je = class {
  static {
    d(this, "Settings");
  }
  /**
   * Create a new Settings instance
   *
   * @param filePath Path to the JSON settings file
   * @param value Loaded value of settings
   */
  constructor(e, t) {
    this.filePath = e, this.value = t;
  }
  /** Save settings to the file */
  async save() {
    try {
      await At.mkdir(Li(this.filePath), { recursive: !0 }), await At.writeFile(this.filePath, JSON.stringify(this.value, null, 2));
    } catch (e) {
      console.warn(Ts.dedent`
        Unable to save global settings file to ${this.filePath}
        ${e && `Reason: ${e.message ?? e}`}`);
    }
  }
};

// src/cli/bin/index.ts
Wi("cliVersion", yt);
var St = /* @__PURE__ */ d((r) => Ve.program.command(r).option(
  "--disable-telemetry",
  "Disable sending telemetry data",
  As(process.env.STORYBOOK_DISABLE_TELEMETRY)
).option("--debug", "Get more logs in debug mode", !1).option("--enable-crash-reports", "Enable sending crash reports to telemetry data").option(
"--loglevel <trace | debug | info | warn | error | silent>", "Define log level", "info").option("--write-logs", "Write all debug logs to a f\
ile at the end of the run").hook("preAction", async (e) => {
  try {
    let t = e.opts();
    t.loglevel && fe.setLogLevel(t.loglevel), t.writeLogs && Zt.enableLogWriting(), await Os();
  } catch (t) {
    fe.error(`Error loading global settings:
` + String(t));
  }
}).hook("postAction", async () => {
  if (Zt.shouldWriteLogsToFile) {
    let e = await Zt.writeToFile();
    fe.outro(`Storybook debug logs can be found at: ${e}`);
  }
}), "command");
St("dev").option("-p, --port <number>", "Port to run Storybook", (r) => parseInt(r, 10)).option("-h, --host <string>", "Host to run Storyboo\
k").option("-c, --config-dir <dir-name>", "Directory where to load Storybook configurations from").option(
  "--https",
  "Serve Storybook over HTTPS. Note: You must provide your own certificate information."
).option(
  "--ssl-ca <ca>",
  "Provide an SSL certificate authority. (Optional with --https, required if using a self-signed certificate)",
  Bi
).option("--ssl-cert <cert>", "Provide an SSL certificate. (Required with --https)").option("--ssl-key <key>", "Provide an SSL key. (Require\
d with --https)").option("--smoke-test", "Exit after successful start").option("--ci", "CI mode (skip interactive prompts, don't open browse\
r)").option("--no-open", "Do not open Storybook automatically in the browser").option("--quiet", "Suppress verbose build output").option("--\
no-version-updates", "Suppress update check", !0).option("--debug-webpack", "Display final webpack configurations for debugging purposes").option(
  "--webpack-stats-json [directory]",
  "Write Webpack stats JSON to disk (synonym for `--stats-json`)"
).option("--stats-json [directory]", "Write stats JSON to disk").option(
  "--preview-url <string>",
  "Disables the default storybook preview and lets your use your own"
).option("--force-build-preview", "Build the preview iframe even if you are using --preview-url").option("--docs", "Build a documentation-on\
ly site using addon-docs").option("--exact-port", "Exit early if the desired port is not available").option(
  "--initial-path [path]",
  "URL path to be appended when visiting Storybook for the first time"
).option("--preview-only", "Use the preview without the manager UI").action(async (r) => {
  let e = await B(__dirname);
  W(e, "Failed to find the closest package.json file."), fe.log(me.default.bold(`${e.name} v${e.version}`) + me.default.reset(`
`)), jt(r, {
    port: "SBCONFIG_PORT",
    host: "SBCONFIG_HOSTNAME",
    staticDir: "SBCONFIG_STATIC_DIR",
    configDir: "SBCONFIG_CONFIG_DIR",
    ci: "CI"
  }), parseInt(`${r.port}`, 10) && (r.port = parseInt(`${r.port}`, 10)), await es({ ...r, packageJson: e }).catch(() => process.exit(1));
});
St("build").option("-o, --output-dir <dir-name>", "Directory where to store built files").option("-c, --config-dir <dir-name>", "Directory w\
here to load Storybook configurations from").option("--quiet", "Suppress verbose build output").option("--debug-webpack", "Display final web\
pack configurations for debugging purposes").option(
  "--webpack-stats-json [directory]",
  "Write Webpack stats JSON to disk (synonym for `--stats-json`)"
).option("--stats-json [directory]", "Write stats JSON to disk").option(
  "--preview-url <string>",
  "Disables the default storybook preview and lets your use your own"
).option("--force-build-preview", "Build the preview iframe even if you are using --preview-url").option("--docs", "Build a documentation-on\
ly site using addon-docs").option("--test", "Build stories optimized for testing purposes.").option("--preview-only", "Use the preview witho\
ut the manager UI").action(async (r) => {
  let { env: e } = process;
  e.NODE_ENV = e.NODE_ENV || "production";
  let t = await B(__dirname);
  W(t, "Failed to find the closest package.json file."), fe.log(me.default.bold(`${t.name} v${t.version}
`)), jt(r, {
    staticDir: "SBCONFIG_STATIC_DIR",
    outputDir: "SBCONFIG_OUTPUT_DIR",
    configDir: "SBCONFIG_CONFIG_DIR"
  }), await Kt({
    ...r,
    packageJson: t,
    test: !!r.test || As(process.env.SB_TESTBUILD)
  }).catch(() => process.exit(1));
});
St("index").option("-o, --output-file <file-name>", "JSON file to output index").option("-c, --config-dir <dir-name>", "Directory where to l\
oad Storybook configurations from").option("--quiet", "Suppress verbose build output").action(async (r) => {
  let { env: e } = process;
  e.NODE_ENV = e.NODE_ENV || "production";
  let t = await B(__dirname);
  W(t, "Failed to find the closest package.json file."), fe.log(me.default.bold(`${t.name} v${t.version}
`)), jt(r, {
    configDir: "SBCONFIG_CONFIG_DIR",
    outputFile: "SBCONFIG_OUTPUT_FILE"
  }), await Xt({
    ...r,
    packageJson: t
  }).catch(() => process.exit(1));
});
Ve.program.on("command:*", ([r]) => {
  let e = ` Invalid command: ${me.default.bold(r)}.
 See --help for a list of available commands.`, s = Ve.program.commands.map((i) => i.name()).find((i) => ft(i, r) < 3);
  s && (e += `
 Did you mean ${me.default.yellow(s)}?`), fe.error(e), process.exit(1);
});
Ve.program.usage("<command> [options]").version(String(yt)).parse(process.argv);
