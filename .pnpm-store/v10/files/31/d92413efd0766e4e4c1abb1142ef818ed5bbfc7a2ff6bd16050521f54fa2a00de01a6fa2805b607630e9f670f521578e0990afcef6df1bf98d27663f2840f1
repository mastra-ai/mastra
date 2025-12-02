"use strict"; function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }





var _chunkVGC3FXLUjs = require('./chunk-VGC3FXLU.js');


var _chunkJZ25TPTYjs = require('./chunk-JZ25TPTY.js');







var _chunkTWFEYLU4js = require('./chunk-TWFEYLU4.js');

// node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/lib/constants.js
var require_constants = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/lib/constants.js"(exports, module) {
    "use strict";
    var WIN_SLASH = "\\\\/";
    var WIN_NO_SLASH = `[^${WIN_SLASH}]`;
    var DOT_LITERAL = "\\.";
    var PLUS_LITERAL = "\\+";
    var QMARK_LITERAL = "\\?";
    var SLASH_LITERAL = "\\/";
    var ONE_CHAR = "(?=.)";
    var QMARK = "[^/]";
    var END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
    var START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
    var DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
    var NO_DOT = `(?!${DOT_LITERAL})`;
    var NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
    var NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
    var NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
    var QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
    var STAR = `${QMARK}*?`;
    var SEP = "/";
    var POSIX_CHARS = {
      DOT_LITERAL,
      PLUS_LITERAL,
      QMARK_LITERAL,
      SLASH_LITERAL,
      ONE_CHAR,
      QMARK,
      END_ANCHOR,
      DOTS_SLASH,
      NO_DOT,
      NO_DOTS,
      NO_DOT_SLASH,
      NO_DOTS_SLASH,
      QMARK_NO_DOT,
      STAR,
      START_ANCHOR,
      SEP
    };
    var WINDOWS_CHARS = {
      ...POSIX_CHARS,
      SLASH_LITERAL: `[${WIN_SLASH}]`,
      QMARK: WIN_NO_SLASH,
      STAR: `${WIN_NO_SLASH}*?`,
      DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
      NO_DOT: `(?!${DOT_LITERAL})`,
      NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
      NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
      START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
      END_ANCHOR: `(?:[${WIN_SLASH}]|$)`,
      SEP: "\\"
    };
    var POSIX_REGEX_SOURCE = {
      alnum: "a-zA-Z0-9",
      alpha: "a-zA-Z",
      ascii: "\\x00-\\x7F",
      blank: " \\t",
      cntrl: "\\x00-\\x1F\\x7F",
      digit: "0-9",
      graph: "\\x21-\\x7E",
      lower: "a-z",
      print: "\\x20-\\x7E ",
      punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
      space: " \\t\\r\\n\\v\\f",
      upper: "A-Z",
      word: "A-Za-z0-9_",
      xdigit: "A-Fa-f0-9"
    };
    module.exports = {
      MAX_LENGTH: 1024 * 64,
      POSIX_REGEX_SOURCE,
      // regular expressions
      REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
      REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
      REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
      REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
      REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
      REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
      // Replace globs with equivalent patterns to reduce parsing time.
      REPLACEMENTS: {
        "***": "*",
        "**/**": "**",
        "**/**/**": "**"
      },
      // Digits
      CHAR_0: 48,
      /* 0 */
      CHAR_9: 57,
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: 65,
      /* A */
      CHAR_LOWERCASE_A: 97,
      /* a */
      CHAR_UPPERCASE_Z: 90,
      /* Z */
      CHAR_LOWERCASE_Z: 122,
      /* z */
      CHAR_LEFT_PARENTHESES: 40,
      /* ( */
      CHAR_RIGHT_PARENTHESES: 41,
      /* ) */
      CHAR_ASTERISK: 42,
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: 38,
      /* & */
      CHAR_AT: 64,
      /* @ */
      CHAR_BACKWARD_SLASH: 92,
      /* \ */
      CHAR_CARRIAGE_RETURN: 13,
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: 94,
      /* ^ */
      CHAR_COLON: 58,
      /* : */
      CHAR_COMMA: 44,
      /* , */
      CHAR_DOT: 46,
      /* . */
      CHAR_DOUBLE_QUOTE: 34,
      /* " */
      CHAR_EQUAL: 61,
      /* = */
      CHAR_EXCLAMATION_MARK: 33,
      /* ! */
      CHAR_FORM_FEED: 12,
      /* \f */
      CHAR_FORWARD_SLASH: 47,
      /* / */
      CHAR_GRAVE_ACCENT: 96,
      /* ` */
      CHAR_HASH: 35,
      /* # */
      CHAR_HYPHEN_MINUS: 45,
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: 60,
      /* < */
      CHAR_LEFT_CURLY_BRACE: 123,
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: 91,
      /* [ */
      CHAR_LINE_FEED: 10,
      /* \n */
      CHAR_NO_BREAK_SPACE: 160,
      /* \u00A0 */
      CHAR_PERCENT: 37,
      /* % */
      CHAR_PLUS: 43,
      /* + */
      CHAR_QUESTION_MARK: 63,
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: 62,
      /* > */
      CHAR_RIGHT_CURLY_BRACE: 125,
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: 93,
      /* ] */
      CHAR_SEMICOLON: 59,
      /* ; */
      CHAR_SINGLE_QUOTE: 39,
      /* ' */
      CHAR_SPACE: 32,
      /*   */
      CHAR_TAB: 9,
      /* \t */
      CHAR_UNDERSCORE: 95,
      /* _ */
      CHAR_VERTICAL_LINE: 124,
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
      /* \uFEFF */
      /**
       * Create EXTGLOB_CHARS
       */
      extglobChars(chars) {
        return {
          "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars.STAR})` },
          "?": { type: "qmark", open: "(?:", close: ")?" },
          "+": { type: "plus", open: "(?:", close: ")+" },
          "*": { type: "star", open: "(?:", close: ")*" },
          "@": { type: "at", open: "(?:", close: ")" }
        };
      },
      /**
       * Create GLOB_CHARS
       */
      globChars(win322) {
        return win322 === true ? WINDOWS_CHARS : POSIX_CHARS;
      }
    };
  }
});

// node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/lib/utils.js
var require_utils = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/lib/utils.js"(exports) {
    "use strict";
    var {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL
    } = require_constants();
    exports.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    exports.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
    exports.isRegexChar = (str) => str.length === 1 && exports.hasRegexChars(str);
    exports.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
    exports.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
    exports.isWindows = () => {
      if (typeof navigator !== "undefined" && navigator.platform) {
        const platform = navigator.platform.toLowerCase();
        return platform === "win32" || platform === "windows";
      }
      if (typeof process !== "undefined" && process.platform) {
        return process.platform === "win32";
      }
      return false;
    };
    exports.removeBackslashes = (str) => {
      return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
        return match === "\\" ? "" : match;
      });
    };
    exports.escapeLast = (input, char, lastIdx) => {
      const idx = input.lastIndexOf(char, lastIdx);
      if (idx === -1) return input;
      if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1);
      return `${input.slice(0, idx)}\\${input.slice(idx)}`;
    };
    exports.removePrefix = (input, state = {}) => {
      let output = input;
      if (output.startsWith("./")) {
        output = output.slice(2);
        state.prefix = "./";
      }
      return output;
    };
    exports.wrapOutput = (input, state = {}, options = {}) => {
      const prepend = options.contains ? "" : "^";
      const append = options.contains ? "" : "$";
      let output = `${prepend}(?:${input})${append}`;
      if (state.negated === true) {
        output = `(?:^(?!${output}).*$)`;
      }
      return output;
    };
    exports.basename = (path3, { windows } = {}) => {
      const segs = path3.split(windows ? /[\\/]/ : "/");
      const last = segs[segs.length - 1];
      if (last === "") {
        return segs[segs.length - 2];
      }
      return last;
    };
  }
});

// node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/lib/scan.js
var require_scan = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/lib/scan.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var {
      CHAR_ASTERISK,
      /* * */
      CHAR_AT,
      /* @ */
      CHAR_BACKWARD_SLASH,
      /* \ */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_EXCLAMATION_MARK,
      /* ! */
      CHAR_FORWARD_SLASH,
      /* / */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_PLUS,
      /* + */
      CHAR_QUESTION_MARK,
      /* ? */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_RIGHT_SQUARE_BRACKET
      /* ] */
    } = require_constants();
    var isPathSeparator = (code) => {
      return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
    };
    var depth = (token) => {
      if (token.isPrefix !== true) {
        token.depth = token.isGlobstar ? Infinity : 1;
      }
    };
    var scan = (input, options) => {
      const opts = options || {};
      const length = input.length - 1;
      const scanToEnd = opts.parts === true || opts.scanToEnd === true;
      const slashes = [];
      const tokens = [];
      const parts = [];
      let str = input;
      let index = -1;
      let start = 0;
      let lastIndex = 0;
      let isBrace = false;
      let isBracket = false;
      let isGlob = false;
      let isExtglob = false;
      let isGlobstar = false;
      let braceEscaped = false;
      let backslashes = false;
      let negated = false;
      let negatedExtglob = false;
      let finished = false;
      let braces = 0;
      let prev;
      let code;
      let token = { value: "", depth: 0, isGlob: false };
      const eos = () => index >= length;
      const peek = () => str.charCodeAt(index + 1);
      const advance = () => {
        prev = code;
        return str.charCodeAt(++index);
      };
      while (index < length) {
        code = advance();
        let next;
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          code = advance();
          if (code === CHAR_LEFT_CURLY_BRACE) {
            braceEscaped = true;
          }
          continue;
        }
        if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (code === CHAR_LEFT_CURLY_BRACE) {
              braces++;
              continue;
            }
            if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (braceEscaped !== true && code === CHAR_COMMA) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (code === CHAR_RIGHT_CURLY_BRACE) {
              braces--;
              if (braces === 0) {
                braceEscaped = false;
                isBrace = token.isBrace = true;
                finished = true;
                break;
              }
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_FORWARD_SLASH) {
          slashes.push(index);
          tokens.push(token);
          token = { value: "", depth: 0, isGlob: false };
          if (finished === true) continue;
          if (prev === CHAR_DOT && index === start + 1) {
            start += 2;
            continue;
          }
          lastIndex = index + 1;
          continue;
        }
        if (opts.noext !== true) {
          const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
          if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
            isGlob = token.isGlob = true;
            isExtglob = token.isExtglob = true;
            finished = true;
            if (code === CHAR_EXCLAMATION_MARK && index === start) {
              negatedExtglob = true;
            }
            if (scanToEnd === true) {
              while (eos() !== true && (code = advance())) {
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  code = advance();
                  continue;
                }
                if (code === CHAR_RIGHT_PARENTHESES) {
                  isGlob = token.isGlob = true;
                  finished = true;
                  break;
                }
              }
              continue;
            }
            break;
          }
        }
        if (code === CHAR_ASTERISK) {
          if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_QUESTION_MARK) {
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_LEFT_SQUARE_BRACKET) {
          while (eos() !== true && (next = advance())) {
            if (next === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              isBracket = token.isBracket = true;
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
          negated = token.negated = true;
          start++;
          continue;
        }
        if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
          isGlob = token.isGlob = true;
          if (scanToEnd === true) {
            while (eos() !== true && (code = advance())) {
              if (code === CHAR_LEFT_PARENTHESES) {
                backslashes = token.backslashes = true;
                code = advance();
                continue;
              }
              if (code === CHAR_RIGHT_PARENTHESES) {
                finished = true;
                break;
              }
            }
            continue;
          }
          break;
        }
        if (isGlob === true) {
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
      }
      if (opts.noext === true) {
        isExtglob = false;
        isGlob = false;
      }
      let base = str;
      let prefix = "";
      let glob = "";
      if (start > 0) {
        prefix = str.slice(0, start);
        str = str.slice(start);
        lastIndex -= start;
      }
      if (base && isGlob === true && lastIndex > 0) {
        base = str.slice(0, lastIndex);
        glob = str.slice(lastIndex);
      } else if (isGlob === true) {
        base = "";
        glob = str;
      } else {
        base = str;
      }
      if (base && base !== "" && base !== "/" && base !== str) {
        if (isPathSeparator(base.charCodeAt(base.length - 1))) {
          base = base.slice(0, -1);
        }
      }
      if (opts.unescape === true) {
        if (glob) glob = utils.removeBackslashes(glob);
        if (base && backslashes === true) {
          base = utils.removeBackslashes(base);
        }
      }
      const state = {
        prefix,
        input,
        start,
        base,
        glob,
        isBrace,
        isBracket,
        isGlob,
        isExtglob,
        isGlobstar,
        negated,
        negatedExtglob
      };
      if (opts.tokens === true) {
        state.maxDepth = 0;
        if (!isPathSeparator(code)) {
          tokens.push(token);
        }
        state.tokens = tokens;
      }
      if (opts.parts === true || opts.tokens === true) {
        let prevIndex;
        for (let idx = 0; idx < slashes.length; idx++) {
          const n = prevIndex ? prevIndex + 1 : start;
          const i = slashes[idx];
          const value = input.slice(n, i);
          if (opts.tokens) {
            if (idx === 0 && start !== 0) {
              tokens[idx].isPrefix = true;
              tokens[idx].value = prefix;
            } else {
              tokens[idx].value = value;
            }
            depth(tokens[idx]);
            state.maxDepth += tokens[idx].depth;
          }
          if (idx !== 0 || value !== "") {
            parts.push(value);
          }
          prevIndex = i;
        }
        if (prevIndex && prevIndex + 1 < input.length) {
          const value = input.slice(prevIndex + 1);
          parts.push(value);
          if (opts.tokens) {
            tokens[tokens.length - 1].value = value;
            depth(tokens[tokens.length - 1]);
            state.maxDepth += tokens[tokens.length - 1].depth;
          }
        }
        state.slashes = slashes;
        state.parts = parts;
      }
      return state;
    };
    module.exports = scan;
  }
});

// node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/lib/parse.js
var require_parse = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/lib/parse.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    var utils = require_utils();
    var {
      MAX_LENGTH,
      POSIX_REGEX_SOURCE,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS
    } = constants;
    var expandRange = (args, options) => {
      if (typeof options.expandRange === "function") {
        return options.expandRange(...args, options);
      }
      args.sort();
      const value = `[${args.join("-")}]`;
      try {
        new RegExp(value);
      } catch (ex) {
        return args.map((v) => utils.escapeRegex(v)).join("..");
      }
      return value;
    };
    var syntaxError = (type, char) => {
      return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
    };
    var parse = (input, options) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      input = REPLACEMENTS[input] || input;
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      let len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      const bos = { type: "bos", value: "", output: opts.prepend || "" };
      const tokens = [bos];
      const capture = opts.capture ? "" : "?:";
      const PLATFORM_CHARS = constants.globChars(opts.windows);
      const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
      const {
        DOT_LITERAL,
        PLUS_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOT_SLASH,
        NO_DOTS_SLASH,
        QMARK,
        QMARK_NO_DOT,
        STAR,
        START_ANCHOR
      } = PLATFORM_CHARS;
      const globstar = (opts2) => {
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const nodot = opts.dot ? "" : NO_DOT;
      const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
      let star = opts.bash === true ? globstar(opts) : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      if (typeof opts.noext === "boolean") {
        opts.noextglob = opts.noext;
      }
      const state = {
        input,
        index: -1,
        start: 0,
        dot: opts.dot === true,
        consumed: "",
        output: "",
        prefix: "",
        backtrack: false,
        negated: false,
        brackets: 0,
        braces: 0,
        parens: 0,
        quotes: 0,
        globstar: false,
        tokens
      };
      input = utils.removePrefix(input, state);
      len = input.length;
      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;
      const eos = () => state.index === len - 1;
      const peek = state.peek = (n = 1) => input[state.index + n];
      const advance = state.advance = () => input[++state.index] || "";
      const remaining = () => input.slice(state.index + 1);
      const consume = (value2 = "", num = 0) => {
        state.consumed += value2;
        state.index += num;
      };
      const append = (token) => {
        state.output += token.output != null ? token.output : token.value;
        consume(token.value);
      };
      const negate = () => {
        let count = 1;
        while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
          advance();
          state.start++;
          count++;
        }
        if (count % 2 === 0) {
          return false;
        }
        state.negated = true;
        state.start++;
        return true;
      };
      const increment = (type) => {
        state[type]++;
        stack.push(type);
      };
      const decrement = (type) => {
        state[type]--;
        stack.pop();
      };
      const push = (tok) => {
        if (prev.type === "globstar") {
          const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
          const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
          if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
            state.output = state.output.slice(0, -prev.output.length);
            prev.type = "star";
            prev.value = "*";
            prev.output = star;
            state.output += prev.output;
          }
        }
        if (extglobs.length && tok.type !== "paren") {
          extglobs[extglobs.length - 1].inner += tok.value;
        }
        if (tok.value || tok.output) append(tok);
        if (prev && prev.type === "text" && tok.type === "text") {
          prev.output = (prev.output || prev.value) + tok.value;
          prev.value += tok.value;
          return;
        }
        tok.prev = prev;
        tokens.push(tok);
        prev = tok;
      };
      const extglobOpen = (type, value2) => {
        const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
        token.prev = prev;
        token.parens = state.parens;
        token.output = state.output;
        const output = (opts.capture ? "(" : "") + token.open;
        increment("parens");
        push({ type, value: value2, output: state.output ? "" : ONE_CHAR });
        push({ type: "paren", extglob: true, value: advance(), output });
        extglobs.push(token);
      };
      const extglobClose = (token) => {
        let output = token.close + (opts.capture ? ")" : "");
        let rest;
        if (token.type === "negate") {
          let extglobStar = star;
          if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
            extglobStar = globstar(opts);
          }
          if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
            output = token.close = `)$))${extglobStar}`;
          }
          if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
            const expression = parse(rest, { ...options, fastpaths: false }).output;
            output = token.close = `)${expression})${extglobStar})`;
          }
          if (token.prev.type === "bos") {
            state.negatedExtglob = true;
          }
        }
        push({ type: "paren", extglob: true, value, output });
        decrement("parens");
      };
      if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
        let backslashes = false;
        let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
          if (first === "\\") {
            backslashes = true;
            return m;
          }
          if (first === "?") {
            if (esc) {
              return esc + first + (rest ? QMARK.repeat(rest.length) : "");
            }
            if (index === 0) {
              return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
            }
            return QMARK.repeat(chars.length);
          }
          if (first === ".") {
            return DOT_LITERAL.repeat(chars.length);
          }
          if (first === "*") {
            if (esc) {
              return esc + first + (rest ? star : "");
            }
            return star;
          }
          return esc ? m : `\\${m}`;
        });
        if (backslashes === true) {
          if (opts.unescape === true) {
            output = output.replace(/\\/g, "");
          } else {
            output = output.replace(/\\+/g, (m) => {
              return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
            });
          }
        }
        if (output === input && opts.contains === true) {
          state.output = input;
          return state;
        }
        state.output = utils.wrapOutput(output, state, options);
        return state;
      }
      while (!eos()) {
        value = advance();
        if (value === "\0") {
          continue;
        }
        if (value === "\\") {
          const next = peek();
          if (next === "/" && opts.bash !== true) {
            continue;
          }
          if (next === "." || next === ";") {
            continue;
          }
          if (!next) {
            value += "\\";
            push({ type: "text", value });
            continue;
          }
          const match = /^\\+/.exec(remaining());
          let slashes = 0;
          if (match && match[0].length > 2) {
            slashes = match[0].length;
            state.index += slashes;
            if (slashes % 2 !== 0) {
              value += "\\";
            }
          }
          if (opts.unescape === true) {
            value = advance();
          } else {
            value += advance();
          }
          if (state.brackets === 0) {
            push({ type: "text", value });
            continue;
          }
        }
        if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
          if (opts.posix !== false && value === ":") {
            const inner = prev.value.slice(1);
            if (inner.includes("[")) {
              prev.posix = true;
              if (inner.includes(":")) {
                const idx = prev.value.lastIndexOf("[");
                const pre = prev.value.slice(0, idx);
                const rest2 = prev.value.slice(idx + 2);
                const posix2 = POSIX_REGEX_SOURCE[rest2];
                if (posix2) {
                  prev.value = pre + posix2;
                  state.backtrack = true;
                  advance();
                  if (!bos.output && tokens.indexOf(prev) === 1) {
                    bos.output = ONE_CHAR;
                  }
                  continue;
                }
              }
            }
          }
          if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
            value = `\\${value}`;
          }
          if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
            value = `\\${value}`;
          }
          if (opts.posix === true && value === "!" && prev.value === "[") {
            value = "^";
          }
          prev.value += value;
          append({ value });
          continue;
        }
        if (state.quotes === 1 && value !== '"') {
          value = utils.escapeRegex(value);
          prev.value += value;
          append({ value });
          continue;
        }
        if (value === '"') {
          state.quotes = state.quotes === 1 ? 0 : 1;
          if (opts.keepQuotes === true) {
            push({ type: "text", value });
          }
          continue;
        }
        if (value === "(") {
          increment("parens");
          push({ type: "paren", value });
          continue;
        }
        if (value === ")") {
          if (state.parens === 0 && opts.strictBrackets === true) {
            throw new SyntaxError(syntaxError("opening", "("));
          }
          const extglob = extglobs[extglobs.length - 1];
          if (extglob && state.parens === extglob.parens + 1) {
            extglobClose(extglobs.pop());
            continue;
          }
          push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
          decrement("parens");
          continue;
        }
        if (value === "[") {
          if (opts.nobracket === true || !remaining().includes("]")) {
            if (opts.nobracket !== true && opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("closing", "]"));
            }
            value = `\\${value}`;
          } else {
            increment("brackets");
          }
          push({ type: "bracket", value });
          continue;
        }
        if (value === "]") {
          if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          if (state.brackets === 0) {
            if (opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("opening", "["));
            }
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          decrement("brackets");
          const prevValue = prev.value.slice(1);
          if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
            value = `/${value}`;
          }
          prev.value += value;
          append({ value });
          if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
            continue;
          }
          const escaped = utils.escapeRegex(prev.value);
          state.output = state.output.slice(0, -prev.value.length);
          if (opts.literalBrackets === true) {
            state.output += escaped;
            prev.value = escaped;
            continue;
          }
          prev.value = `(${capture}${escaped}|${prev.value})`;
          state.output += prev.value;
          continue;
        }
        if (value === "{" && opts.nobrace !== true) {
          increment("braces");
          const open = {
            type: "brace",
            value,
            output: "(",
            outputIndex: state.output.length,
            tokensIndex: state.tokens.length
          };
          braces.push(open);
          push(open);
          continue;
        }
        if (value === "}") {
          const brace = braces[braces.length - 1];
          if (opts.nobrace === true || !brace) {
            push({ type: "text", value, output: value });
            continue;
          }
          let output = ")";
          if (brace.dots === true) {
            const arr = tokens.slice();
            const range = [];
            for (let i = arr.length - 1; i >= 0; i--) {
              tokens.pop();
              if (arr[i].type === "brace") {
                break;
              }
              if (arr[i].type !== "dots") {
                range.unshift(arr[i].value);
              }
            }
            output = expandRange(range, opts);
            state.backtrack = true;
          }
          if (brace.comma !== true && brace.dots !== true) {
            const out = state.output.slice(0, brace.outputIndex);
            const toks = state.tokens.slice(brace.tokensIndex);
            brace.value = brace.output = "\\{";
            value = output = "\\}";
            state.output = out;
            for (const t of toks) {
              state.output += t.output || t.value;
            }
          }
          push({ type: "brace", value, output });
          decrement("braces");
          braces.pop();
          continue;
        }
        if (value === "|") {
          if (extglobs.length > 0) {
            extglobs[extglobs.length - 1].conditions++;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === ",") {
          let output = value;
          const brace = braces[braces.length - 1];
          if (brace && stack[stack.length - 1] === "braces") {
            brace.comma = true;
            output = "|";
          }
          push({ type: "comma", value, output });
          continue;
        }
        if (value === "/") {
          if (prev.type === "dot" && state.index === state.start + 1) {
            state.start = state.index + 1;
            state.consumed = "";
            state.output = "";
            tokens.pop();
            prev = bos;
            continue;
          }
          push({ type: "slash", value, output: SLASH_LITERAL });
          continue;
        }
        if (value === ".") {
          if (state.braces > 0 && prev.type === "dot") {
            if (prev.value === ".") prev.output = DOT_LITERAL;
            const brace = braces[braces.length - 1];
            prev.type = "dots";
            prev.output += value;
            prev.value += value;
            brace.dots = true;
            continue;
          }
          if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
            push({ type: "text", value, output: DOT_LITERAL });
            continue;
          }
          push({ type: "dot", value, output: DOT_LITERAL });
          continue;
        }
        if (value === "?") {
          const isGroup = prev && prev.value === "(";
          if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("qmark", value);
            continue;
          }
          if (prev && prev.type === "paren") {
            const next = peek();
            let output = value;
            if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
              output = `\\${value}`;
            }
            push({ type: "text", value, output });
            continue;
          }
          if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
            push({ type: "qmark", value, output: QMARK_NO_DOT });
            continue;
          }
          push({ type: "qmark", value, output: QMARK });
          continue;
        }
        if (value === "!") {
          if (opts.noextglob !== true && peek() === "(") {
            if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
              extglobOpen("negate", value);
              continue;
            }
          }
          if (opts.nonegate !== true && state.index === 0) {
            negate();
            continue;
          }
        }
        if (value === "+") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("plus", value);
            continue;
          }
          if (prev && prev.value === "(" || opts.regex === false) {
            push({ type: "plus", value, output: PLUS_LITERAL });
            continue;
          }
          if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
            push({ type: "plus", value });
            continue;
          }
          push({ type: "plus", value: PLUS_LITERAL });
          continue;
        }
        if (value === "@") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            push({ type: "at", extglob: true, value, output: "" });
            continue;
          }
          push({ type: "text", value });
          continue;
        }
        if (value !== "*") {
          if (value === "$" || value === "^") {
            value = `\\${value}`;
          }
          const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
          if (match) {
            value += match[0];
            state.index += match[0].length;
          }
          push({ type: "text", value });
          continue;
        }
        if (prev && (prev.type === "globstar" || prev.star === true)) {
          prev.type = "star";
          prev.star = true;
          prev.value += value;
          prev.output = star;
          state.backtrack = true;
          state.globstar = true;
          consume(value);
          continue;
        }
        let rest = remaining();
        if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
          extglobOpen("star", value);
          continue;
        }
        if (prev.type === "star") {
          if (opts.noglobstar === true) {
            consume(value);
            continue;
          }
          const prior = prev.prev;
          const before = prior.prev;
          const isStart = prior.type === "slash" || prior.type === "bos";
          const afterStar = before && (before.type === "star" || before.type === "globstar");
          if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
            push({ type: "star", value, output: "" });
            continue;
          }
          const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
          const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
          if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
            push({ type: "star", value, output: "" });
            continue;
          }
          while (rest.slice(0, 3) === "/**") {
            const after = input[state.index + 4];
            if (after && after !== "/") {
              break;
            }
            rest = rest.slice(3);
            consume("/**", 3);
          }
          if (prior.type === "bos" && eos()) {
            prev.type = "globstar";
            prev.value += value;
            prev.output = globstar(opts);
            state.output = prev.output;
            state.globstar = true;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
            prev.value += value;
            state.globstar = true;
            state.output += prior.output + prev.output;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
            const end = rest[1] !== void 0 ? "|$" : "";
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
            prev.value += value;
            state.output += prior.output + prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          if (prior.type === "bos" && rest[0] === "/") {
            prev.type = "globstar";
            prev.value += value;
            prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
            state.output = prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          state.output = state.output.slice(0, -prev.output.length);
          prev.type = "globstar";
          prev.output = globstar(opts);
          prev.value += value;
          state.output += prev.output;
          state.globstar = true;
          consume(value);
          continue;
        }
        const token = { type: "star", value, output: star };
        if (opts.bash === true) {
          token.output = ".*?";
          if (prev.type === "bos" || prev.type === "slash") {
            token.output = nodot + token.output;
          }
          push(token);
          continue;
        }
        if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
          token.output = value;
          push(token);
          continue;
        }
        if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
          if (prev.type === "dot") {
            state.output += NO_DOT_SLASH;
            prev.output += NO_DOT_SLASH;
          } else if (opts.dot === true) {
            state.output += NO_DOTS_SLASH;
            prev.output += NO_DOTS_SLASH;
          } else {
            state.output += nodot;
            prev.output += nodot;
          }
          if (peek() !== "*") {
            state.output += ONE_CHAR;
            prev.output += ONE_CHAR;
          }
        }
        push(token);
      }
      while (state.brackets > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
        state.output = utils.escapeLast(state.output, "[");
        decrement("brackets");
      }
      while (state.parens > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
        state.output = utils.escapeLast(state.output, "(");
        decrement("parens");
      }
      while (state.braces > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
        state.output = utils.escapeLast(state.output, "{");
        decrement("braces");
      }
      if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
        push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL}?` });
      }
      if (state.backtrack === true) {
        state.output = "";
        for (const token of state.tokens) {
          state.output += token.output != null ? token.output : token.value;
          if (token.suffix) {
            state.output += token.suffix;
          }
        }
      }
      return state;
    };
    parse.fastpaths = (input, options) => {
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      const len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      input = REPLACEMENTS[input] || input;
      const {
        DOT_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOTS,
        NO_DOTS_SLASH,
        STAR,
        START_ANCHOR
      } = constants.globChars(opts.windows);
      const nodot = opts.dot ? NO_DOTS : NO_DOT;
      const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
      const capture = opts.capture ? "" : "?:";
      const state = { negated: false, prefix: "" };
      let star = opts.bash === true ? ".*?" : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      const globstar = (opts2) => {
        if (opts2.noglobstar === true) return star;
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const create = (str) => {
        switch (str) {
          case "*":
            return `${nodot}${ONE_CHAR}${star}`;
          case ".*":
            return `${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*.*":
            return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*/*":
            return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
          case "**":
            return nodot + globstar(opts);
          case "**/*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
          case "**/*.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "**/.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
          default: {
            const match = /^(.*?)\.(\w+)$/.exec(str);
            if (!match) return;
            const source2 = create(match[1]);
            if (!source2) return;
            return source2 + DOT_LITERAL + match[2];
          }
        }
      };
      const output = utils.removePrefix(input, state);
      let source = create(output);
      if (source && opts.strictSlashes !== true) {
        source += `${SLASH_LITERAL}?`;
      }
      return source;
    };
    module.exports = parse;
  }
});

// node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/lib/picomatch.js
var require_picomatch = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/lib/picomatch.js"(exports, module) {
    "use strict";
    var scan = require_scan();
    var parse = require_parse();
    var utils = require_utils();
    var constants = require_constants();
    var isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
    var picomatch = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map((input) => picomatch(input, options, returnState));
        const arrayMatcher = (str) => {
          for (const isMatch of fns) {
            const state2 = isMatch(str);
            if (state2) return state2;
          }
          return false;
        };
        return arrayMatcher;
      }
      const isState = isObject(glob) && glob.tokens && glob.input;
      if (glob === "" || typeof glob !== "string" && !isState) {
        throw new TypeError("Expected pattern to be a non-empty string");
      }
      const opts = options || {};
      const posix2 = opts.windows;
      const regex = isState ? picomatch.compileRe(glob, options) : picomatch.makeRe(glob, options, false, true);
      const state = regex.state;
      delete regex.state;
      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch(opts.ignore, ignoreOpts, returnState);
      }
      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output } = picomatch.test(input, regex, options, { glob, posix: posix2 });
        const result = { glob, state, regex, posix: posix2, input, output, match, isMatch };
        if (typeof opts.onResult === "function") {
          opts.onResult(result);
        }
        if (isMatch === false) {
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (isIgnored(input)) {
          if (typeof opts.onIgnore === "function") {
            opts.onIgnore(result);
          }
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (typeof opts.onMatch === "function") {
          opts.onMatch(result);
        }
        return returnObject ? result : true;
      };
      if (returnState) {
        matcher.state = state;
      }
      return matcher;
    };
    picomatch.test = (input, regex, options, { glob, posix: posix2 } = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected input to be a string");
      }
      if (input === "") {
        return { isMatch: false, output: "" };
      }
      const opts = options || {};
      const format = opts.format || (posix2 ? utils.toPosixSlashes : null);
      let match = input === glob;
      let output = match && format ? format(input) : input;
      if (match === false) {
        output = format ? format(input) : input;
        match = output === glob;
      }
      if (match === false || opts.capture === true) {
        if (opts.matchBase === true || opts.basename === true) {
          match = picomatch.matchBase(input, regex, options, posix2);
        } else {
          match = regex.exec(output);
        }
      }
      return { isMatch: Boolean(match), match, output };
    };
    picomatch.matchBase = (input, glob, options) => {
      const regex = glob instanceof RegExp ? glob : picomatch.makeRe(glob, options);
      return regex.test(utils.basename(input));
    };
    picomatch.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);
    picomatch.parse = (pattern, options) => {
      if (Array.isArray(pattern)) return pattern.map((p) => picomatch.parse(p, options));
      return parse(pattern, { ...options, fastpaths: false });
    };
    picomatch.scan = (input, options) => scan(input, options);
    picomatch.compileRe = (state, options, returnOutput = false, returnState = false) => {
      if (returnOutput === true) {
        return state.output;
      }
      const opts = options || {};
      const prepend = opts.contains ? "" : "^";
      const append = opts.contains ? "" : "$";
      let source = `${prepend}(?:${state.output})${append}`;
      if (state && state.negated === true) {
        source = `^(?!${source}).*$`;
      }
      const regex = picomatch.toRegex(source, options);
      if (returnState === true) {
        regex.state = state;
      }
      return regex;
    };
    picomatch.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
      if (!input || typeof input !== "string") {
        throw new TypeError("Expected a non-empty string");
      }
      let parsed = { negated: false, fastpaths: true };
      if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
        parsed.output = parse.fastpaths(input, options);
      }
      if (!parsed.output) {
        parsed = parse(input, options);
      }
      return picomatch.compileRe(parsed, options, returnOutput, returnState);
    };
    picomatch.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
      } catch (err) {
        if (options && options.debug === true) throw err;
        return /$^/;
      }
    };
    picomatch.constants = constants;
    module.exports = picomatch;
  }
});

// node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/index.js
var require_picomatch2 = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/picomatch@4.0.2/node_modules/picomatch/index.js"(exports, module) {
    "use strict";
    var pico = require_picomatch();
    var utils = require_utils();
    function picomatch(glob, options, returnState = false) {
      if (options && (options.windows === null || options.windows === void 0)) {
        options = { ...options, windows: utils.isWindows() };
      }
      return pico(glob, options, returnState);
    }
    Object.assign(picomatch, pico);
    module.exports = picomatch;
  }
});

// node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/homedir.js
var require_homedir = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/homedir.js"(exports, module) {
    "use strict";
    var os = _chunkTWFEYLU4js.__require.call(void 0, "os");
    module.exports = os.homedir || function homedir() {
      var home = process.env.HOME;
      var user = process.env.LOGNAME || process.env.USER || process.env.LNAME || process.env.USERNAME;
      if (process.platform === "win32") {
        return process.env.USERPROFILE || process.env.HOMEDRIVE + process.env.HOMEPATH || home || null;
      }
      if (process.platform === "darwin") {
        return home || (user ? "/Users/" + user : null);
      }
      if (process.platform === "linux") {
        return home || (process.getuid() === 0 ? "/root" : user ? "/home/" + user : null);
      }
      return home || null;
    };
  }
});

// node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/caller.js
var require_caller = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/caller.js"(exports, module) {
    "use strict";
    module.exports = function() {
      var origPrepareStackTrace = Error.prepareStackTrace;
      Error.prepareStackTrace = function(_, stack2) {
        return stack2;
      };
      var stack = new Error().stack;
      Error.prepareStackTrace = origPrepareStackTrace;
      return stack[2].getFileName();
    };
  }
});

// node_modules/.pnpm/path-parse@1.0.7/node_modules/path-parse/index.js
var require_path_parse = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/path-parse@1.0.7/node_modules/path-parse/index.js"(exports, module) {
    "use strict";
    var isWindows = process.platform === "win32";
    var splitWindowsRe = /^(((?:[a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?[\\\/]?)(?:[^\\\/]*[\\\/])*)((\.{1,2}|[^\\\/]+?|)(\.[^.\/\\]*|))[\\\/]*$/;
    var win322 = {};
    function win32SplitPath(filename) {
      return splitWindowsRe.exec(filename).slice(1);
    }
    win322.parse = function(pathString) {
      if (typeof pathString !== "string") {
        throw new TypeError(
          "Parameter 'pathString' must be a string, not " + typeof pathString
        );
      }
      var allParts = win32SplitPath(pathString);
      if (!allParts || allParts.length !== 5) {
        throw new TypeError("Invalid path '" + pathString + "'");
      }
      return {
        root: allParts[1],
        dir: allParts[0] === allParts[1] ? allParts[0] : allParts[0].slice(0, -1),
        base: allParts[2],
        ext: allParts[4],
        name: allParts[3]
      };
    };
    var splitPathRe = /^((\/?)(?:[^\/]*\/)*)((\.{1,2}|[^\/]+?|)(\.[^.\/]*|))[\/]*$/;
    var posix2 = {};
    function posixSplitPath(filename) {
      return splitPathRe.exec(filename).slice(1);
    }
    posix2.parse = function(pathString) {
      if (typeof pathString !== "string") {
        throw new TypeError(
          "Parameter 'pathString' must be a string, not " + typeof pathString
        );
      }
      var allParts = posixSplitPath(pathString);
      if (!allParts || allParts.length !== 5) {
        throw new TypeError("Invalid path '" + pathString + "'");
      }
      return {
        root: allParts[1],
        dir: allParts[0].slice(0, -1),
        base: allParts[2],
        ext: allParts[4],
        name: allParts[3]
      };
    };
    if (isWindows)
      module.exports = win322.parse;
    else
      module.exports = posix2.parse;
    module.exports.posix = posix2.parse;
    module.exports.win32 = win322.parse;
  }
});

// node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/node-modules-paths.js
var require_node_modules_paths = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/node-modules-paths.js"(exports, module) {
    "use strict";
    var path3 = _chunkTWFEYLU4js.__require.call(void 0, "path");
    var parse = path3.parse || require_path_parse();
    var getNodeModulesDirs = function getNodeModulesDirs2(absoluteStart, modules) {
      var prefix = "/";
      if (/^([A-Za-z]:)/.test(absoluteStart)) {
        prefix = "";
      } else if (/^\\\\/.test(absoluteStart)) {
        prefix = "\\\\";
      }
      var paths = [absoluteStart];
      var parsed = parse(absoluteStart);
      while (parsed.dir !== paths[paths.length - 1]) {
        paths.push(parsed.dir);
        parsed = parse(parsed.dir);
      }
      return paths.reduce(function(dirs, aPath) {
        return dirs.concat(modules.map(function(moduleDir) {
          return path3.resolve(prefix, aPath, moduleDir);
        }));
      }, []);
    };
    module.exports = function nodeModulesPaths(start, opts, request) {
      var modules = opts && opts.moduleDirectory ? [].concat(opts.moduleDirectory) : ["node_modules"];
      if (opts && typeof opts.paths === "function") {
        return opts.paths(
          request,
          start,
          function() {
            return getNodeModulesDirs(start, modules);
          },
          opts
        );
      }
      var dirs = getNodeModulesDirs(start, modules);
      return opts && opts.paths ? dirs.concat(opts.paths) : dirs;
    };
  }
});

// node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/normalize-options.js
var require_normalize_options = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/normalize-options.js"(exports, module) {
    "use strict";
    module.exports = function(x, opts) {
      return opts || {};
    };
  }
});

// node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/implementation.js
var require_implementation = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/implementation.js"(exports, module) {
    "use strict";
    var ERROR_MESSAGE = "Function.prototype.bind called on incompatible ";
    var toStr = Object.prototype.toString;
    var max = Math.max;
    var funcType = "[object Function]";
    var concatty = function concatty2(a, b) {
      var arr = [];
      for (var i = 0; i < a.length; i += 1) {
        arr[i] = a[i];
      }
      for (var j = 0; j < b.length; j += 1) {
        arr[j + a.length] = b[j];
      }
      return arr;
    };
    var slicy = function slicy2(arrLike, offset) {
      var arr = [];
      for (var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1) {
        arr[j] = arrLike[i];
      }
      return arr;
    };
    var joiny = function(arr, joiner) {
      var str = "";
      for (var i = 0; i < arr.length; i += 1) {
        str += arr[i];
        if (i + 1 < arr.length) {
          str += joiner;
        }
      }
      return str;
    };
    module.exports = function bind(that) {
      var target = this;
      if (typeof target !== "function" || toStr.apply(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
      }
      var args = slicy(arguments, 1);
      var bound;
      var binder = function() {
        if (this instanceof bound) {
          var result = target.apply(
            this,
            concatty(args, arguments)
          );
          if (Object(result) === result) {
            return result;
          }
          return this;
        }
        return target.apply(
          that,
          concatty(args, arguments)
        );
      };
      var boundLength = max(0, target.length - args.length);
      var boundArgs = [];
      for (var i = 0; i < boundLength; i++) {
        boundArgs[i] = "$" + i;
      }
      bound = Function("binder", "return function (" + joiny(boundArgs, ",") + "){ return binder.apply(this,arguments); }")(binder);
      if (target.prototype) {
        var Empty = function Empty2() {
        };
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
      }
      return bound;
    };
  }
});

// node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/index.js
var require_function_bind = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/function-bind@1.1.2/node_modules/function-bind/index.js"(exports, module) {
    "use strict";
    var implementation = require_implementation();
    module.exports = Function.prototype.bind || implementation;
  }
});

// node_modules/.pnpm/hasown@2.0.2/node_modules/hasown/index.js
var require_hasown = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/hasown@2.0.2/node_modules/hasown/index.js"(exports, module) {
    "use strict";
    var call = Function.prototype.call;
    var $hasOwn = Object.prototype.hasOwnProperty;
    var bind = require_function_bind();
    module.exports = bind.call(call, $hasOwn);
  }
});

// node_modules/.pnpm/is-core-module@2.16.1/node_modules/is-core-module/core.json
var require_core = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/is-core-module@2.16.1/node_modules/is-core-module/core.json"(exports, module) {
    module.exports = {
      assert: true,
      "node:assert": [">= 14.18 && < 15", ">= 16"],
      "assert/strict": ">= 15",
      "node:assert/strict": ">= 16",
      async_hooks: ">= 8",
      "node:async_hooks": [">= 14.18 && < 15", ">= 16"],
      buffer_ieee754: ">= 0.5 && < 0.9.7",
      buffer: true,
      "node:buffer": [">= 14.18 && < 15", ">= 16"],
      child_process: true,
      "node:child_process": [">= 14.18 && < 15", ">= 16"],
      cluster: ">= 0.5",
      "node:cluster": [">= 14.18 && < 15", ">= 16"],
      console: true,
      "node:console": [">= 14.18 && < 15", ">= 16"],
      constants: true,
      "node:constants": [">= 14.18 && < 15", ">= 16"],
      crypto: true,
      "node:crypto": [">= 14.18 && < 15", ">= 16"],
      _debug_agent: ">= 1 && < 8",
      _debugger: "< 8",
      dgram: true,
      "node:dgram": [">= 14.18 && < 15", ">= 16"],
      diagnostics_channel: [">= 14.17 && < 15", ">= 15.1"],
      "node:diagnostics_channel": [">= 14.18 && < 15", ">= 16"],
      dns: true,
      "node:dns": [">= 14.18 && < 15", ">= 16"],
      "dns/promises": ">= 15",
      "node:dns/promises": ">= 16",
      domain: ">= 0.7.12",
      "node:domain": [">= 14.18 && < 15", ">= 16"],
      events: true,
      "node:events": [">= 14.18 && < 15", ">= 16"],
      freelist: "< 6",
      fs: true,
      "node:fs": [">= 14.18 && < 15", ">= 16"],
      "fs/promises": [">= 10 && < 10.1", ">= 14"],
      "node:fs/promises": [">= 14.18 && < 15", ">= 16"],
      _http_agent: ">= 0.11.1",
      "node:_http_agent": [">= 14.18 && < 15", ">= 16"],
      _http_client: ">= 0.11.1",
      "node:_http_client": [">= 14.18 && < 15", ">= 16"],
      _http_common: ">= 0.11.1",
      "node:_http_common": [">= 14.18 && < 15", ">= 16"],
      _http_incoming: ">= 0.11.1",
      "node:_http_incoming": [">= 14.18 && < 15", ">= 16"],
      _http_outgoing: ">= 0.11.1",
      "node:_http_outgoing": [">= 14.18 && < 15", ">= 16"],
      _http_server: ">= 0.11.1",
      "node:_http_server": [">= 14.18 && < 15", ">= 16"],
      http: true,
      "node:http": [">= 14.18 && < 15", ">= 16"],
      http2: ">= 8.8",
      "node:http2": [">= 14.18 && < 15", ">= 16"],
      https: true,
      "node:https": [">= 14.18 && < 15", ">= 16"],
      inspector: ">= 8",
      "node:inspector": [">= 14.18 && < 15", ">= 16"],
      "inspector/promises": [">= 19"],
      "node:inspector/promises": [">= 19"],
      _linklist: "< 8",
      module: true,
      "node:module": [">= 14.18 && < 15", ">= 16"],
      net: true,
      "node:net": [">= 14.18 && < 15", ">= 16"],
      "node-inspect/lib/_inspect": ">= 7.6 && < 12",
      "node-inspect/lib/internal/inspect_client": ">= 7.6 && < 12",
      "node-inspect/lib/internal/inspect_repl": ">= 7.6 && < 12",
      os: true,
      "node:os": [">= 14.18 && < 15", ">= 16"],
      path: true,
      "node:path": [">= 14.18 && < 15", ">= 16"],
      "path/posix": ">= 15.3",
      "node:path/posix": ">= 16",
      "path/win32": ">= 15.3",
      "node:path/win32": ">= 16",
      perf_hooks: ">= 8.5",
      "node:perf_hooks": [">= 14.18 && < 15", ">= 16"],
      process: ">= 1",
      "node:process": [">= 14.18 && < 15", ">= 16"],
      punycode: ">= 0.5",
      "node:punycode": [">= 14.18 && < 15", ">= 16"],
      querystring: true,
      "node:querystring": [">= 14.18 && < 15", ">= 16"],
      readline: true,
      "node:readline": [">= 14.18 && < 15", ">= 16"],
      "readline/promises": ">= 17",
      "node:readline/promises": ">= 17",
      repl: true,
      "node:repl": [">= 14.18 && < 15", ">= 16"],
      "node:sea": [">= 20.12 && < 21", ">= 21.7"],
      smalloc: ">= 0.11.5 && < 3",
      "node:sqlite": [">= 22.13 && < 23", ">= 23.4"],
      _stream_duplex: ">= 0.9.4",
      "node:_stream_duplex": [">= 14.18 && < 15", ">= 16"],
      _stream_transform: ">= 0.9.4",
      "node:_stream_transform": [">= 14.18 && < 15", ">= 16"],
      _stream_wrap: ">= 1.4.1",
      "node:_stream_wrap": [">= 14.18 && < 15", ">= 16"],
      _stream_passthrough: ">= 0.9.4",
      "node:_stream_passthrough": [">= 14.18 && < 15", ">= 16"],
      _stream_readable: ">= 0.9.4",
      "node:_stream_readable": [">= 14.18 && < 15", ">= 16"],
      _stream_writable: ">= 0.9.4",
      "node:_stream_writable": [">= 14.18 && < 15", ">= 16"],
      stream: true,
      "node:stream": [">= 14.18 && < 15", ">= 16"],
      "stream/consumers": ">= 16.7",
      "node:stream/consumers": ">= 16.7",
      "stream/promises": ">= 15",
      "node:stream/promises": ">= 16",
      "stream/web": ">= 16.5",
      "node:stream/web": ">= 16.5",
      string_decoder: true,
      "node:string_decoder": [">= 14.18 && < 15", ">= 16"],
      sys: [">= 0.4 && < 0.7", ">= 0.8"],
      "node:sys": [">= 14.18 && < 15", ">= 16"],
      "test/reporters": ">= 19.9 && < 20.2",
      "node:test/reporters": [">= 18.17 && < 19", ">= 19.9", ">= 20"],
      "test/mock_loader": ">= 22.3 && < 22.7",
      "node:test/mock_loader": ">= 22.3 && < 22.7",
      "node:test": [">= 16.17 && < 17", ">= 18"],
      timers: true,
      "node:timers": [">= 14.18 && < 15", ">= 16"],
      "timers/promises": ">= 15",
      "node:timers/promises": ">= 16",
      _tls_common: ">= 0.11.13",
      "node:_tls_common": [">= 14.18 && < 15", ">= 16"],
      _tls_legacy: ">= 0.11.3 && < 10",
      _tls_wrap: ">= 0.11.3",
      "node:_tls_wrap": [">= 14.18 && < 15", ">= 16"],
      tls: true,
      "node:tls": [">= 14.18 && < 15", ">= 16"],
      trace_events: ">= 10",
      "node:trace_events": [">= 14.18 && < 15", ">= 16"],
      tty: true,
      "node:tty": [">= 14.18 && < 15", ">= 16"],
      url: true,
      "node:url": [">= 14.18 && < 15", ">= 16"],
      util: true,
      "node:util": [">= 14.18 && < 15", ">= 16"],
      "util/types": ">= 15.3",
      "node:util/types": ">= 16",
      "v8/tools/arguments": ">= 10 && < 12",
      "v8/tools/codemap": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/consarray": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/csvparser": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/logreader": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/profile_view": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/splaytree": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      v8: ">= 1",
      "node:v8": [">= 14.18 && < 15", ">= 16"],
      vm: true,
      "node:vm": [">= 14.18 && < 15", ">= 16"],
      wasi: [">= 13.4 && < 13.5", ">= 18.17 && < 19", ">= 20"],
      "node:wasi": [">= 18.17 && < 19", ">= 20"],
      worker_threads: ">= 11.7",
      "node:worker_threads": [">= 14.18 && < 15", ">= 16"],
      zlib: ">= 0.5",
      "node:zlib": [">= 14.18 && < 15", ">= 16"]
    };
  }
});

// node_modules/.pnpm/is-core-module@2.16.1/node_modules/is-core-module/index.js
var require_is_core_module = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/is-core-module@2.16.1/node_modules/is-core-module/index.js"(exports, module) {
    "use strict";
    var hasOwn = require_hasown();
    function specifierIncluded(current, specifier) {
      var nodeParts = current.split(".");
      var parts = specifier.split(" ");
      var op = parts.length > 1 ? parts[0] : "=";
      var versionParts = (parts.length > 1 ? parts[1] : parts[0]).split(".");
      for (var i = 0; i < 3; ++i) {
        var cur = parseInt(nodeParts[i] || 0, 10);
        var ver = parseInt(versionParts[i] || 0, 10);
        if (cur === ver) {
          continue;
        }
        if (op === "<") {
          return cur < ver;
        }
        if (op === ">=") {
          return cur >= ver;
        }
        return false;
      }
      return op === ">=";
    }
    function matchesRange(current, range) {
      var specifiers = range.split(/ ?&& ?/);
      if (specifiers.length === 0) {
        return false;
      }
      for (var i = 0; i < specifiers.length; ++i) {
        if (!specifierIncluded(current, specifiers[i])) {
          return false;
        }
      }
      return true;
    }
    function versionIncluded(nodeVersion, specifierValue) {
      if (typeof specifierValue === "boolean") {
        return specifierValue;
      }
      var current = typeof nodeVersion === "undefined" ? process.versions && process.versions.node : nodeVersion;
      if (typeof current !== "string") {
        throw new TypeError(typeof nodeVersion === "undefined" ? "Unable to determine current node version" : "If provided, a valid node version is required");
      }
      if (specifierValue && typeof specifierValue === "object") {
        for (var i = 0; i < specifierValue.length; ++i) {
          if (matchesRange(current, specifierValue[i])) {
            return true;
          }
        }
        return false;
      }
      return matchesRange(current, specifierValue);
    }
    var data = require_core();
    module.exports = function isCore(x, nodeVersion) {
      return hasOwn(data, x) && versionIncluded(nodeVersion, data[x]);
    };
  }
});

// node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/async.js
var require_async = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/async.js"(exports, module) {
    "use strict";
    var fs2 = _chunkTWFEYLU4js.__require.call(void 0, "fs");
    var getHomedir = require_homedir();
    var path3 = _chunkTWFEYLU4js.__require.call(void 0, "path");
    var caller = require_caller();
    var nodeModulesPaths = require_node_modules_paths();
    var normalizeOptions = require_normalize_options();
    var isCore = require_is_core_module();
    var realpathFS = process.platform !== "win32" && fs2.realpath && typeof fs2.realpath.native === "function" ? fs2.realpath.native : fs2.realpath;
    var homedir = getHomedir();
    var defaultPaths = function() {
      return [
        path3.join(homedir, ".node_modules"),
        path3.join(homedir, ".node_libraries")
      ];
    };
    var defaultIsFile = function isFile(file, cb) {
      fs2.stat(file, function(err, stat) {
        if (!err) {
          return cb(null, stat.isFile() || stat.isFIFO());
        }
        if (err.code === "ENOENT" || err.code === "ENOTDIR") return cb(null, false);
        return cb(err);
      });
    };
    var defaultIsDir = function isDirectory(dir, cb) {
      fs2.stat(dir, function(err, stat) {
        if (!err) {
          return cb(null, stat.isDirectory());
        }
        if (err.code === "ENOENT" || err.code === "ENOTDIR") return cb(null, false);
        return cb(err);
      });
    };
    var defaultRealpath = function realpath(x, cb) {
      realpathFS(x, function(realpathErr, realPath) {
        if (realpathErr && realpathErr.code !== "ENOENT") cb(realpathErr);
        else cb(null, realpathErr ? x : realPath);
      });
    };
    var maybeRealpath = function maybeRealpath2(realpath, x, opts, cb) {
      if (opts && opts.preserveSymlinks === false) {
        realpath(x, cb);
      } else {
        cb(null, x);
      }
    };
    var defaultReadPackage = function defaultReadPackage2(readFile, pkgfile, cb) {
      readFile(pkgfile, function(readFileErr, body) {
        if (readFileErr) cb(readFileErr);
        else {
          try {
            var pkg = JSON.parse(body);
            cb(null, pkg);
          } catch (jsonErr) {
            cb(null);
          }
        }
      });
    };
    var getPackageCandidates = function getPackageCandidates2(x, start, opts) {
      var dirs = nodeModulesPaths(start, opts, x);
      for (var i = 0; i < dirs.length; i++) {
        dirs[i] = path3.join(dirs[i], x);
      }
      return dirs;
    };
    module.exports = function resolve2(x, options, callback) {
      var cb = callback;
      var opts = options;
      if (typeof options === "function") {
        cb = opts;
        opts = {};
      }
      if (typeof x !== "string") {
        var err = new TypeError("Path must be a string.");
        return process.nextTick(function() {
          cb(err);
        });
      }
      opts = normalizeOptions(x, opts);
      var isFile = opts.isFile || defaultIsFile;
      var isDirectory = opts.isDirectory || defaultIsDir;
      var readFile = opts.readFile || fs2.readFile;
      var realpath = opts.realpath || defaultRealpath;
      var readPackage = opts.readPackage || defaultReadPackage;
      if (opts.readFile && opts.readPackage) {
        var conflictErr = new TypeError("`readFile` and `readPackage` are mutually exclusive.");
        return process.nextTick(function() {
          cb(conflictErr);
        });
      }
      var packageIterator = opts.packageIterator;
      var extensions = opts.extensions || [".js"];
      var includeCoreModules = opts.includeCoreModules !== false;
      var basedir = opts.basedir || path3.dirname(caller());
      var parent = opts.filename || basedir;
      opts.paths = opts.paths || defaultPaths();
      var absoluteStart = path3.resolve(basedir);
      maybeRealpath(
        realpath,
        absoluteStart,
        opts,
        function(err2, realStart) {
          if (err2) cb(err2);
          else init(realStart);
        }
      );
      var res;
      function init(basedir2) {
        if (/^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[/\\])/.test(x)) {
          res = path3.resolve(basedir2, x);
          if (x === "." || x === ".." || x.slice(-1) === "/") res += "/";
          if (/\/$/.test(x) && res === basedir2) {
            loadAsDirectory(res, opts.package, onfile);
          } else loadAsFile(res, opts.package, onfile);
        } else if (includeCoreModules && isCore(x)) {
          return cb(null, x);
        } else loadNodeModules(x, basedir2, function(err2, n, pkg) {
          if (err2) cb(err2);
          else if (n) {
            return maybeRealpath(realpath, n, opts, function(err3, realN) {
              if (err3) {
                cb(err3);
              } else {
                cb(null, realN, pkg);
              }
            });
          } else {
            var moduleError = new Error("Cannot find module '" + x + "' from '" + parent + "'");
            moduleError.code = "MODULE_NOT_FOUND";
            cb(moduleError);
          }
        });
      }
      function onfile(err2, m, pkg) {
        if (err2) cb(err2);
        else if (m) cb(null, m, pkg);
        else loadAsDirectory(res, function(err3, d, pkg2) {
          if (err3) cb(err3);
          else if (d) {
            maybeRealpath(realpath, d, opts, function(err4, realD) {
              if (err4) {
                cb(err4);
              } else {
                cb(null, realD, pkg2);
              }
            });
          } else {
            var moduleError = new Error("Cannot find module '" + x + "' from '" + parent + "'");
            moduleError.code = "MODULE_NOT_FOUND";
            cb(moduleError);
          }
        });
      }
      function loadAsFile(x2, thePackage, callback2) {
        var loadAsFilePackage = thePackage;
        var cb2 = callback2;
        if (typeof loadAsFilePackage === "function") {
          cb2 = loadAsFilePackage;
          loadAsFilePackage = void 0;
        }
        var exts = [""].concat(extensions);
        load(exts, x2, loadAsFilePackage);
        function load(exts2, x3, loadPackage) {
          if (exts2.length === 0) return cb2(null, void 0, loadPackage);
          var file = x3 + exts2[0];
          var pkg = loadPackage;
          if (pkg) onpkg(null, pkg);
          else loadpkg(path3.dirname(file), onpkg);
          function onpkg(err2, pkg_, dir) {
            pkg = pkg_;
            if (err2) return cb2(err2);
            if (dir && pkg && opts.pathFilter) {
              var rfile = path3.relative(dir, file);
              var rel = rfile.slice(0, rfile.length - exts2[0].length);
              var r = opts.pathFilter(pkg, x3, rel);
              if (r) return load(
                [""].concat(extensions.slice()),
                path3.resolve(dir, r),
                pkg
              );
            }
            isFile(file, onex);
          }
          function onex(err2, ex) {
            if (err2) return cb2(err2);
            if (ex) return cb2(null, file, pkg);
            load(exts2.slice(1), x3, pkg);
          }
        }
      }
      function loadpkg(dir, cb2) {
        if (dir === "" || dir === "/") return cb2(null);
        if (process.platform === "win32" && /^\w:[/\\]*$/.test(dir)) {
          return cb2(null);
        }
        if (/[/\\]node_modules[/\\]*$/.test(dir)) return cb2(null);
        maybeRealpath(realpath, dir, opts, function(unwrapErr, pkgdir) {
          if (unwrapErr) return loadpkg(path3.dirname(dir), cb2);
          var pkgfile = path3.join(pkgdir, "package.json");
          isFile(pkgfile, function(err2, ex) {
            if (!ex) return loadpkg(path3.dirname(dir), cb2);
            readPackage(readFile, pkgfile, function(err3, pkgParam) {
              if (err3) cb2(err3);
              var pkg = pkgParam;
              if (pkg && opts.packageFilter) {
                pkg = opts.packageFilter(pkg, pkgfile);
              }
              cb2(null, pkg, dir);
            });
          });
        });
      }
      function loadAsDirectory(x2, loadAsDirectoryPackage, callback2) {
        var cb2 = callback2;
        var fpkg = loadAsDirectoryPackage;
        if (typeof fpkg === "function") {
          cb2 = fpkg;
          fpkg = opts.package;
        }
        maybeRealpath(realpath, x2, opts, function(unwrapErr, pkgdir) {
          if (unwrapErr) return cb2(unwrapErr);
          var pkgfile = path3.join(pkgdir, "package.json");
          isFile(pkgfile, function(err2, ex) {
            if (err2) return cb2(err2);
            if (!ex) return loadAsFile(path3.join(x2, "index"), fpkg, cb2);
            readPackage(readFile, pkgfile, function(err3, pkgParam) {
              if (err3) return cb2(err3);
              var pkg = pkgParam;
              if (pkg && opts.packageFilter) {
                pkg = opts.packageFilter(pkg, pkgfile);
              }
              if (pkg && pkg.main) {
                if (typeof pkg.main !== "string") {
                  var mainError = new TypeError("package \u201C" + pkg.name + "\u201D `main` must be a string");
                  mainError.code = "INVALID_PACKAGE_MAIN";
                  return cb2(mainError);
                }
                if (pkg.main === "." || pkg.main === "./") {
                  pkg.main = "index";
                }
                loadAsFile(path3.resolve(x2, pkg.main), pkg, function(err4, m, pkg2) {
                  if (err4) return cb2(err4);
                  if (m) return cb2(null, m, pkg2);
                  if (!pkg2) return loadAsFile(path3.join(x2, "index"), pkg2, cb2);
                  var dir = path3.resolve(x2, pkg2.main);
                  loadAsDirectory(dir, pkg2, function(err5, n, pkg3) {
                    if (err5) return cb2(err5);
                    if (n) return cb2(null, n, pkg3);
                    loadAsFile(path3.join(x2, "index"), pkg3, cb2);
                  });
                });
                return;
              }
              loadAsFile(path3.join(x2, "/index"), pkg, cb2);
            });
          });
        });
      }
      function processDirs(cb2, dirs) {
        if (dirs.length === 0) return cb2(null, void 0);
        var dir = dirs[0];
        isDirectory(path3.dirname(dir), isdir);
        function isdir(err2, isdir2) {
          if (err2) return cb2(err2);
          if (!isdir2) return processDirs(cb2, dirs.slice(1));
          loadAsFile(dir, opts.package, onfile2);
        }
        function onfile2(err2, m, pkg) {
          if (err2) return cb2(err2);
          if (m) return cb2(null, m, pkg);
          loadAsDirectory(dir, opts.package, ondir);
        }
        function ondir(err2, n, pkg) {
          if (err2) return cb2(err2);
          if (n) return cb2(null, n, pkg);
          processDirs(cb2, dirs.slice(1));
        }
      }
      function loadNodeModules(x2, start, cb2) {
        var thunk = function() {
          return getPackageCandidates(x2, start, opts);
        };
        processDirs(
          cb2,
          packageIterator ? packageIterator(x2, start, thunk, opts) : thunk()
        );
      }
    };
  }
});

// node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/core.json
var require_core2 = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/core.json"(exports, module) {
    module.exports = {
      assert: true,
      "node:assert": [">= 14.18 && < 15", ">= 16"],
      "assert/strict": ">= 15",
      "node:assert/strict": ">= 16",
      async_hooks: ">= 8",
      "node:async_hooks": [">= 14.18 && < 15", ">= 16"],
      buffer_ieee754: ">= 0.5 && < 0.9.7",
      buffer: true,
      "node:buffer": [">= 14.18 && < 15", ">= 16"],
      child_process: true,
      "node:child_process": [">= 14.18 && < 15", ">= 16"],
      cluster: ">= 0.5",
      "node:cluster": [">= 14.18 && < 15", ">= 16"],
      console: true,
      "node:console": [">= 14.18 && < 15", ">= 16"],
      constants: true,
      "node:constants": [">= 14.18 && < 15", ">= 16"],
      crypto: true,
      "node:crypto": [">= 14.18 && < 15", ">= 16"],
      _debug_agent: ">= 1 && < 8",
      _debugger: "< 8",
      dgram: true,
      "node:dgram": [">= 14.18 && < 15", ">= 16"],
      diagnostics_channel: [">= 14.17 && < 15", ">= 15.1"],
      "node:diagnostics_channel": [">= 14.18 && < 15", ">= 16"],
      dns: true,
      "node:dns": [">= 14.18 && < 15", ">= 16"],
      "dns/promises": ">= 15",
      "node:dns/promises": ">= 16",
      domain: ">= 0.7.12",
      "node:domain": [">= 14.18 && < 15", ">= 16"],
      events: true,
      "node:events": [">= 14.18 && < 15", ">= 16"],
      freelist: "< 6",
      fs: true,
      "node:fs": [">= 14.18 && < 15", ">= 16"],
      "fs/promises": [">= 10 && < 10.1", ">= 14"],
      "node:fs/promises": [">= 14.18 && < 15", ">= 16"],
      _http_agent: ">= 0.11.1",
      "node:_http_agent": [">= 14.18 && < 15", ">= 16"],
      _http_client: ">= 0.11.1",
      "node:_http_client": [">= 14.18 && < 15", ">= 16"],
      _http_common: ">= 0.11.1",
      "node:_http_common": [">= 14.18 && < 15", ">= 16"],
      _http_incoming: ">= 0.11.1",
      "node:_http_incoming": [">= 14.18 && < 15", ">= 16"],
      _http_outgoing: ">= 0.11.1",
      "node:_http_outgoing": [">= 14.18 && < 15", ">= 16"],
      _http_server: ">= 0.11.1",
      "node:_http_server": [">= 14.18 && < 15", ">= 16"],
      http: true,
      "node:http": [">= 14.18 && < 15", ">= 16"],
      http2: ">= 8.8",
      "node:http2": [">= 14.18 && < 15", ">= 16"],
      https: true,
      "node:https": [">= 14.18 && < 15", ">= 16"],
      inspector: ">= 8",
      "node:inspector": [">= 14.18 && < 15", ">= 16"],
      "inspector/promises": [">= 19"],
      "node:inspector/promises": [">= 19"],
      _linklist: "< 8",
      module: true,
      "node:module": [">= 14.18 && < 15", ">= 16"],
      net: true,
      "node:net": [">= 14.18 && < 15", ">= 16"],
      "node-inspect/lib/_inspect": ">= 7.6 && < 12",
      "node-inspect/lib/internal/inspect_client": ">= 7.6 && < 12",
      "node-inspect/lib/internal/inspect_repl": ">= 7.6 && < 12",
      os: true,
      "node:os": [">= 14.18 && < 15", ">= 16"],
      path: true,
      "node:path": [">= 14.18 && < 15", ">= 16"],
      "path/posix": ">= 15.3",
      "node:path/posix": ">= 16",
      "path/win32": ">= 15.3",
      "node:path/win32": ">= 16",
      perf_hooks: ">= 8.5",
      "node:perf_hooks": [">= 14.18 && < 15", ">= 16"],
      process: ">= 1",
      "node:process": [">= 14.18 && < 15", ">= 16"],
      punycode: ">= 0.5",
      "node:punycode": [">= 14.18 && < 15", ">= 16"],
      querystring: true,
      "node:querystring": [">= 14.18 && < 15", ">= 16"],
      readline: true,
      "node:readline": [">= 14.18 && < 15", ">= 16"],
      "readline/promises": ">= 17",
      "node:readline/promises": ">= 17",
      repl: true,
      "node:repl": [">= 14.18 && < 15", ">= 16"],
      "node:sea": [">= 20.12 && < 21", ">= 21.7"],
      smalloc: ">= 0.11.5 && < 3",
      "node:sqlite": ">= 23.4",
      _stream_duplex: ">= 0.9.4",
      "node:_stream_duplex": [">= 14.18 && < 15", ">= 16"],
      _stream_transform: ">= 0.9.4",
      "node:_stream_transform": [">= 14.18 && < 15", ">= 16"],
      _stream_wrap: ">= 1.4.1",
      "node:_stream_wrap": [">= 14.18 && < 15", ">= 16"],
      _stream_passthrough: ">= 0.9.4",
      "node:_stream_passthrough": [">= 14.18 && < 15", ">= 16"],
      _stream_readable: ">= 0.9.4",
      "node:_stream_readable": [">= 14.18 && < 15", ">= 16"],
      _stream_writable: ">= 0.9.4",
      "node:_stream_writable": [">= 14.18 && < 15", ">= 16"],
      stream: true,
      "node:stream": [">= 14.18 && < 15", ">= 16"],
      "stream/consumers": ">= 16.7",
      "node:stream/consumers": ">= 16.7",
      "stream/promises": ">= 15",
      "node:stream/promises": ">= 16",
      "stream/web": ">= 16.5",
      "node:stream/web": ">= 16.5",
      string_decoder: true,
      "node:string_decoder": [">= 14.18 && < 15", ">= 16"],
      sys: [">= 0.4 && < 0.7", ">= 0.8"],
      "node:sys": [">= 14.18 && < 15", ">= 16"],
      "test/reporters": ">= 19.9 && < 20.2",
      "node:test/reporters": [">= 18.17 && < 19", ">= 19.9", ">= 20"],
      "test/mock_loader": ">= 22.3 && < 22.7",
      "node:test/mock_loader": ">= 22.3 && < 22.7",
      "node:test": [">= 16.17 && < 17", ">= 18"],
      timers: true,
      "node:timers": [">= 14.18 && < 15", ">= 16"],
      "timers/promises": ">= 15",
      "node:timers/promises": ">= 16",
      _tls_common: ">= 0.11.13",
      "node:_tls_common": [">= 14.18 && < 15", ">= 16"],
      _tls_legacy: ">= 0.11.3 && < 10",
      _tls_wrap: ">= 0.11.3",
      "node:_tls_wrap": [">= 14.18 && < 15", ">= 16"],
      tls: true,
      "node:tls": [">= 14.18 && < 15", ">= 16"],
      trace_events: ">= 10",
      "node:trace_events": [">= 14.18 && < 15", ">= 16"],
      tty: true,
      "node:tty": [">= 14.18 && < 15", ">= 16"],
      url: true,
      "node:url": [">= 14.18 && < 15", ">= 16"],
      util: true,
      "node:util": [">= 14.18 && < 15", ">= 16"],
      "util/types": ">= 15.3",
      "node:util/types": ">= 16",
      "v8/tools/arguments": ">= 10 && < 12",
      "v8/tools/codemap": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/consarray": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/csvparser": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/logreader": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/profile_view": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      "v8/tools/splaytree": [">= 4.4 && < 5", ">= 5.2 && < 12"],
      v8: ">= 1",
      "node:v8": [">= 14.18 && < 15", ">= 16"],
      vm: true,
      "node:vm": [">= 14.18 && < 15", ">= 16"],
      wasi: [">= 13.4 && < 13.5", ">= 18.17 && < 19", ">= 20"],
      "node:wasi": [">= 18.17 && < 19", ">= 20"],
      worker_threads: ">= 11.7",
      "node:worker_threads": [">= 14.18 && < 15", ">= 16"],
      zlib: ">= 0.5",
      "node:zlib": [">= 14.18 && < 15", ">= 16"]
    };
  }
});

// node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/core.js
var require_core3 = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/core.js"(exports, module) {
    "use strict";
    var isCoreModule = require_is_core_module();
    var data = require_core2();
    var core = {};
    for (mod in data) {
      if (Object.prototype.hasOwnProperty.call(data, mod)) {
        core[mod] = isCoreModule(mod);
      }
    }
    var mod;
    module.exports = core;
  }
});

// node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/is-core.js
var require_is_core = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/is-core.js"(exports, module) {
    "use strict";
    var isCoreModule = require_is_core_module();
    module.exports = function isCore(x) {
      return isCoreModule(x);
    };
  }
});

// node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/sync.js
var require_sync = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/lib/sync.js"(exports, module) {
    "use strict";
    var isCore = require_is_core_module();
    var fs2 = _chunkTWFEYLU4js.__require.call(void 0, "fs");
    var path3 = _chunkTWFEYLU4js.__require.call(void 0, "path");
    var getHomedir = require_homedir();
    var caller = require_caller();
    var nodeModulesPaths = require_node_modules_paths();
    var normalizeOptions = require_normalize_options();
    var realpathFS = process.platform !== "win32" && fs2.realpathSync && typeof fs2.realpathSync.native === "function" ? fs2.realpathSync.native : fs2.realpathSync;
    var homedir = getHomedir();
    var defaultPaths = function() {
      return [
        path3.join(homedir, ".node_modules"),
        path3.join(homedir, ".node_libraries")
      ];
    };
    var defaultIsFile = function isFile(file) {
      try {
        var stat = fs2.statSync(file, { throwIfNoEntry: false });
      } catch (e) {
        if (e && (e.code === "ENOENT" || e.code === "ENOTDIR")) return false;
        throw e;
      }
      return !!stat && (stat.isFile() || stat.isFIFO());
    };
    var defaultIsDir = function isDirectory(dir) {
      try {
        var stat = fs2.statSync(dir, { throwIfNoEntry: false });
      } catch (e) {
        if (e && (e.code === "ENOENT" || e.code === "ENOTDIR")) return false;
        throw e;
      }
      return !!stat && stat.isDirectory();
    };
    var defaultRealpathSync = function realpathSync(x) {
      try {
        return realpathFS(x);
      } catch (realpathErr) {
        if (realpathErr.code !== "ENOENT") {
          throw realpathErr;
        }
      }
      return x;
    };
    var maybeRealpathSync = function maybeRealpathSync2(realpathSync, x, opts) {
      if (opts && opts.preserveSymlinks === false) {
        return realpathSync(x);
      }
      return x;
    };
    var defaultReadPackageSync = function defaultReadPackageSync2(readFileSync, pkgfile) {
      var body = readFileSync(pkgfile);
      try {
        var pkg = JSON.parse(body);
        return pkg;
      } catch (jsonErr) {
      }
    };
    var getPackageCandidates = function getPackageCandidates2(x, start, opts) {
      var dirs = nodeModulesPaths(start, opts, x);
      for (var i = 0; i < dirs.length; i++) {
        dirs[i] = path3.join(dirs[i], x);
      }
      return dirs;
    };
    module.exports = function resolveSync(x, options) {
      if (typeof x !== "string") {
        throw new TypeError("Path must be a string.");
      }
      var opts = normalizeOptions(x, options);
      var isFile = opts.isFile || defaultIsFile;
      var readFileSync = opts.readFileSync || fs2.readFileSync;
      var isDirectory = opts.isDirectory || defaultIsDir;
      var realpathSync = opts.realpathSync || defaultRealpathSync;
      var readPackageSync = opts.readPackageSync || defaultReadPackageSync;
      if (opts.readFileSync && opts.readPackageSync) {
        throw new TypeError("`readFileSync` and `readPackageSync` are mutually exclusive.");
      }
      var packageIterator = opts.packageIterator;
      var extensions = opts.extensions || [".js"];
      var includeCoreModules = opts.includeCoreModules !== false;
      var basedir = opts.basedir || path3.dirname(caller());
      var parent = opts.filename || basedir;
      opts.paths = opts.paths || defaultPaths();
      var absoluteStart = maybeRealpathSync(realpathSync, path3.resolve(basedir), opts);
      if (/^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[/\\])/.test(x)) {
        var res = path3.resolve(absoluteStart, x);
        if (x === "." || x === ".." || x.slice(-1) === "/") res += "/";
        var m = loadAsFileSync(res) || loadAsDirectorySync(res);
        if (m) return maybeRealpathSync(realpathSync, m, opts);
      } else if (includeCoreModules && isCore(x)) {
        return x;
      } else {
        var n = loadNodeModulesSync(x, absoluteStart);
        if (n) return maybeRealpathSync(realpathSync, n, opts);
      }
      var err = new Error("Cannot find module '" + x + "' from '" + parent + "'");
      err.code = "MODULE_NOT_FOUND";
      throw err;
      function loadAsFileSync(x2) {
        var pkg = loadpkg(path3.dirname(x2));
        if (pkg && pkg.dir && pkg.pkg && opts.pathFilter) {
          var rfile = path3.relative(pkg.dir, x2);
          var r = opts.pathFilter(pkg.pkg, x2, rfile);
          if (r) {
            x2 = path3.resolve(pkg.dir, r);
          }
        }
        if (isFile(x2)) {
          return x2;
        }
        for (var i = 0; i < extensions.length; i++) {
          var file = x2 + extensions[i];
          if (isFile(file)) {
            return file;
          }
        }
      }
      function loadpkg(dir) {
        if (dir === "" || dir === "/") return;
        if (process.platform === "win32" && /^\w:[/\\]*$/.test(dir)) {
          return;
        }
        if (/[/\\]node_modules[/\\]*$/.test(dir)) return;
        var pkgfile = path3.join(maybeRealpathSync(realpathSync, dir, opts), "package.json");
        if (!isFile(pkgfile)) {
          return loadpkg(path3.dirname(dir));
        }
        var pkg = readPackageSync(readFileSync, pkgfile);
        if (pkg && opts.packageFilter) {
          pkg = opts.packageFilter(
            pkg,
            /*pkgfile,*/
            dir
          );
        }
        return { pkg, dir };
      }
      function loadAsDirectorySync(x2) {
        var pkgfile = path3.join(maybeRealpathSync(realpathSync, x2, opts), "/package.json");
        if (isFile(pkgfile)) {
          try {
            var pkg = readPackageSync(readFileSync, pkgfile);
          } catch (e) {
          }
          if (pkg && opts.packageFilter) {
            pkg = opts.packageFilter(
              pkg,
              /*pkgfile,*/
              x2
            );
          }
          if (pkg && pkg.main) {
            if (typeof pkg.main !== "string") {
              var mainError = new TypeError("package \u201C" + pkg.name + "\u201D `main` must be a string");
              mainError.code = "INVALID_PACKAGE_MAIN";
              throw mainError;
            }
            if (pkg.main === "." || pkg.main === "./") {
              pkg.main = "index";
            }
            try {
              var m2 = loadAsFileSync(path3.resolve(x2, pkg.main));
              if (m2) return m2;
              var n2 = loadAsDirectorySync(path3.resolve(x2, pkg.main));
              if (n2) return n2;
            } catch (e) {
            }
          }
        }
        return loadAsFileSync(path3.join(x2, "/index"));
      }
      function loadNodeModulesSync(x2, start) {
        var thunk = function() {
          return getPackageCandidates(x2, start, opts);
        };
        var dirs = packageIterator ? packageIterator(x2, start, thunk, opts) : thunk();
        for (var i = 0; i < dirs.length; i++) {
          var dir = dirs[i];
          if (isDirectory(path3.dirname(dir))) {
            var m2 = loadAsFileSync(dir);
            if (m2) return m2;
            var n2 = loadAsDirectorySync(dir);
            if (n2) return n2;
          }
        }
      }
    };
  }
});

// node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/index.js
var require_resolve = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/resolve@1.22.10/node_modules/resolve/index.js"(exports, module) {
    "use strict";
    var async = require_async();
    async.core = require_core3();
    async.isCore = require_is_core();
    async.sync = require_sync();
    module.exports = async;
  }
});

// node_modules/.pnpm/js-tokens@4.0.0/node_modules/js-tokens/index.js
var require_js_tokens = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/js-tokens@4.0.0/node_modules/js-tokens/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = /((['"])(?:(?!\2|\\).|\\(?:\r\n|[\s\S]))*(\2)?|`(?:[^`\\$]|\\[\s\S]|\$(?!\{)|\$\{(?:[^{}]|\{[^}]*\}?)*\}?)*(`)?)|(\/\/.*)|(\/\*(?:[^*]|\*(?!\/))*(\*\/)?)|(\/(?!\*)(?:\[(?:(?![\]\\]).|\\.)*\]|(?![\/\]\\]).|\\.)+\/(?:(?!\s*(?:\b|[\u0080-\uFFFF$\\'"~({]|[+\-!](?!=)|\.?\d))|[gmiyus]{1,6}\b(?![\u0080-\uFFFF$\\]|\s*(?:[+\-*%&|^<>!=?({]|\/(?![\/*])))))|(0[xX][\da-fA-F]+|0[oO][0-7]+|0[bB][01]+|(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)|((?!\d)(?:(?!\s)[$\w\u0080-\uFFFF]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]+\})+)|(--|\+\+|&&|\|\||=>|\.{3}|(?:[+\-\/%&|^]|\*{1,2}|<{1,2}|>{1,3}|!=?|={1,2})=?|[?~.,:;[\](){}])|(\s+)|(^$|[\s\S])/g;
    exports.matchToToken = function(match) {
      var token = { type: "invalid", value: match[0], closed: void 0 };
      if (match[1]) token.type = "string", token.closed = !!(match[3] || match[4]);
      else if (match[5]) token.type = "comment";
      else if (match[6]) token.type = "comment", token.closed = !!match[7];
      else if (match[8]) token.type = "regex";
      else if (match[9]) token.type = "number";
      else if (match[10]) token.type = "name";
      else if (match[11]) token.type = "punctuator";
      else if (match[12]) token.type = "whitespace";
      return token;
    };
  }
});

// node_modules/.pnpm/@babel+helper-validator-identifier@7.25.9/node_modules/@babel/helper-validator-identifier/lib/identifier.js
var require_identifier = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/@babel+helper-validator-identifier@7.25.9/node_modules/@babel/helper-validator-identifier/lib/identifier.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isIdentifierChar = isIdentifierChar;
    exports.isIdentifierName = isIdentifierName;
    exports.isIdentifierStart = isIdentifierStart;
    var nonASCIIidentifierStartChars = "\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u0870-\u0887\u0889-\u088E\u08A0-\u08C9\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C5D\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u1711\u171F-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4C\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C8A\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7CD\uA7D0\uA7D1\uA7D3\uA7D5-\uA7DC\uA7F2-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC";
    var nonASCIIidentifierChars = "\xB7\u0300-\u036F\u0387\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0897-\u089F\u08CA-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C04\u0C3C\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0CF3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1369-\u1371\u1712-\u1715\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u180F-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19DA\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1ABF-\u1ACE\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DFF\u200C\u200D\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\u30FB\uA620-\uA629\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA8FF-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F\uFF65";
    var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
    var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");
    nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;
    var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 4, 51, 13, 310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 8, 70, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 39, 27, 10, 22, 251, 41, 7, 1, 17, 2, 60, 28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 20, 1, 64, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 31, 9, 2, 0, 3, 0, 2, 37, 2, 0, 26, 0, 2, 0, 45, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 19, 72, 200, 32, 32, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 16, 0, 2, 12, 2, 33, 125, 0, 80, 921, 103, 110, 18, 195, 2637, 96, 16, 1071, 18, 5, 26, 3994, 6, 582, 6842, 29, 1763, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18, 433, 44, 212, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 42, 9, 8936, 3, 2, 6, 2, 1, 2, 290, 16, 0, 30, 2, 3, 0, 15, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 1845, 30, 7, 5, 262, 61, 147, 44, 11, 6, 17, 0, 322, 29, 19, 43, 485, 27, 229, 29, 3, 0, 496, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4153, 7, 221, 3, 5761, 15, 7472, 16, 621, 2467, 541, 1507, 4938, 6, 4191];
    var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 7, 9, 32, 4, 318, 1, 80, 3, 71, 10, 50, 3, 123, 2, 54, 14, 32, 10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 3, 0, 158, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 68, 8, 2, 0, 3, 0, 2, 3, 2, 4, 2, 0, 15, 1, 83, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 7, 19, 58, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 343, 9, 54, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 10, 1, 2, 0, 49, 6, 4, 4, 14, 10, 5350, 0, 7, 14, 11465, 27, 2343, 9, 87, 9, 39, 4, 60, 6, 26, 9, 535, 9, 470, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4178, 9, 519, 45, 3, 22, 543, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 101, 0, 161, 6, 10, 9, 357, 0, 62, 13, 499, 13, 245, 1, 2, 9, 726, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];
    function isInAstralSet(code, set) {
      let pos = 65536;
      for (let i = 0, length = set.length; i < length; i += 2) {
        pos += set[i];
        if (pos > code) return false;
        pos += set[i + 1];
        if (pos >= code) return true;
      }
      return false;
    }
    function isIdentifierStart(code) {
      if (code < 65) return code === 36;
      if (code <= 90) return true;
      if (code < 97) return code === 95;
      if (code <= 122) return true;
      if (code <= 65535) {
        return code >= 170 && nonASCIIidentifierStart.test(String.fromCharCode(code));
      }
      return isInAstralSet(code, astralIdentifierStartCodes);
    }
    function isIdentifierChar(code) {
      if (code < 48) return code === 36;
      if (code < 58) return true;
      if (code < 65) return false;
      if (code <= 90) return true;
      if (code < 97) return code === 95;
      if (code <= 122) return true;
      if (code <= 65535) {
        return code >= 170 && nonASCIIidentifier.test(String.fromCharCode(code));
      }
      return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
    }
    function isIdentifierName(name) {
      let isFirst = true;
      for (let i = 0; i < name.length; i++) {
        let cp = name.charCodeAt(i);
        if ((cp & 64512) === 55296 && i + 1 < name.length) {
          const trail = name.charCodeAt(++i);
          if ((trail & 64512) === 56320) {
            cp = 65536 + ((cp & 1023) << 10) + (trail & 1023);
          }
        }
        if (isFirst) {
          isFirst = false;
          if (!isIdentifierStart(cp)) {
            return false;
          }
        } else if (!isIdentifierChar(cp)) {
          return false;
        }
      }
      return !isFirst;
    }
  }
});

// node_modules/.pnpm/@babel+helper-validator-identifier@7.25.9/node_modules/@babel/helper-validator-identifier/lib/keyword.js
var require_keyword = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/@babel+helper-validator-identifier@7.25.9/node_modules/@babel/helper-validator-identifier/lib/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.isKeyword = isKeyword;
    exports.isReservedWord = isReservedWord;
    exports.isStrictBindOnlyReservedWord = isStrictBindOnlyReservedWord;
    exports.isStrictBindReservedWord = isStrictBindReservedWord;
    exports.isStrictReservedWord = isStrictReservedWord;
    var reservedWords2 = {
      keyword: ["break", "case", "catch", "continue", "debugger", "default", "do", "else", "finally", "for", "function", "if", "return", "switch", "throw", "try", "var", "const", "while", "with", "new", "this", "super", "class", "extends", "export", "import", "null", "true", "false", "in", "instanceof", "typeof", "void", "delete"],
      strict: ["implements", "interface", "let", "package", "private", "protected", "public", "static", "yield"],
      strictBind: ["eval", "arguments"]
    };
    var keywords = new Set(reservedWords2.keyword);
    var reservedWordsStrictSet = new Set(reservedWords2.strict);
    var reservedWordsStrictBindSet = new Set(reservedWords2.strictBind);
    function isReservedWord(word, inModule) {
      return inModule && word === "await" || word === "enum";
    }
    function isStrictReservedWord(word, inModule) {
      return isReservedWord(word, inModule) || reservedWordsStrictSet.has(word);
    }
    function isStrictBindOnlyReservedWord(word) {
      return reservedWordsStrictBindSet.has(word);
    }
    function isStrictBindReservedWord(word, inModule) {
      return isStrictReservedWord(word, inModule) || isStrictBindOnlyReservedWord(word);
    }
    function isKeyword(word) {
      return keywords.has(word);
    }
  }
});

// node_modules/.pnpm/@babel+helper-validator-identifier@7.25.9/node_modules/@babel/helper-validator-identifier/lib/index.js
var require_lib = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/@babel+helper-validator-identifier@7.25.9/node_modules/@babel/helper-validator-identifier/lib/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    Object.defineProperty(exports, "isIdentifierChar", {
      enumerable: true,
      get: function() {
        return _identifier.isIdentifierChar;
      }
    });
    Object.defineProperty(exports, "isIdentifierName", {
      enumerable: true,
      get: function() {
        return _identifier.isIdentifierName;
      }
    });
    Object.defineProperty(exports, "isIdentifierStart", {
      enumerable: true,
      get: function() {
        return _identifier.isIdentifierStart;
      }
    });
    Object.defineProperty(exports, "isKeyword", {
      enumerable: true,
      get: function() {
        return _keyword.isKeyword;
      }
    });
    Object.defineProperty(exports, "isReservedWord", {
      enumerable: true,
      get: function() {
        return _keyword.isReservedWord;
      }
    });
    Object.defineProperty(exports, "isStrictBindOnlyReservedWord", {
      enumerable: true,
      get: function() {
        return _keyword.isStrictBindOnlyReservedWord;
      }
    });
    Object.defineProperty(exports, "isStrictBindReservedWord", {
      enumerable: true,
      get: function() {
        return _keyword.isStrictBindReservedWord;
      }
    });
    Object.defineProperty(exports, "isStrictReservedWord", {
      enumerable: true,
      get: function() {
        return _keyword.isStrictReservedWord;
      }
    });
    var _identifier = require_identifier();
    var _keyword = require_keyword();
  }
});

// node_modules/.pnpm/@babel+code-frame@7.26.2/node_modules/@babel/code-frame/lib/index.js
var require_lib2 = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/@babel+code-frame@7.26.2/node_modules/@babel/code-frame/lib/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var picocolors = _chunkTWFEYLU4js.__require.call(void 0, "picocolors");
    var jsTokens = require_js_tokens();
    var helperValidatorIdentifier = require_lib();
    function isColorSupported() {
      return typeof process === "object" && (process.env.FORCE_COLOR === "0" || process.env.FORCE_COLOR === "false") ? false : picocolors.isColorSupported;
    }
    var compose = (f, g) => (v) => f(g(v));
    function buildDefs(colors) {
      return {
        keyword: colors.cyan,
        capitalized: colors.yellow,
        jsxIdentifier: colors.yellow,
        punctuator: colors.yellow,
        number: colors.magenta,
        string: colors.green,
        regex: colors.magenta,
        comment: colors.gray,
        invalid: compose(compose(colors.white, colors.bgRed), colors.bold),
        gutter: colors.gray,
        marker: compose(colors.red, colors.bold),
        message: compose(colors.red, colors.bold),
        reset: colors.reset
      };
    }
    var defsOn = buildDefs(picocolors.createColors(true));
    var defsOff = buildDefs(picocolors.createColors(false));
    function getDefs(enabled) {
      return enabled ? defsOn : defsOff;
    }
    var sometimesKeywords = /* @__PURE__ */ new Set(["as", "async", "from", "get", "of", "set"]);
    var NEWLINE$1 = /\r\n|[\n\r\u2028\u2029]/;
    var BRACKET = /^[()[\]{}]$/;
    var tokenize;
    {
      const JSX_TAG = /^[a-z][\w-]*$/i;
      const getTokenType = function(token, offset, text) {
        if (token.type === "name") {
          if (helperValidatorIdentifier.isKeyword(token.value) || helperValidatorIdentifier.isStrictReservedWord(token.value, true) || sometimesKeywords.has(token.value)) {
            return "keyword";
          }
          if (JSX_TAG.test(token.value) && (text[offset - 1] === "<" || text.slice(offset - 2, offset) === "</")) {
            return "jsxIdentifier";
          }
          if (token.value[0] !== token.value[0].toLowerCase()) {
            return "capitalized";
          }
        }
        if (token.type === "punctuator" && BRACKET.test(token.value)) {
          return "bracket";
        }
        if (token.type === "invalid" && (token.value === "@" || token.value === "#")) {
          return "punctuator";
        }
        return token.type;
      };
      tokenize = function* (text) {
        let match;
        while (match = jsTokens.default.exec(text)) {
          const token = jsTokens.matchToToken(match);
          yield {
            type: getTokenType(token, match.index, text),
            value: token.value
          };
        }
      };
    }
    function highlight(text) {
      if (text === "") return "";
      const defs = getDefs(true);
      let highlighted = "";
      for (const {
        type,
        value
      } of tokenize(text)) {
        if (type in defs) {
          highlighted += value.split(NEWLINE$1).map((str) => defs[type](str)).join("\n");
        } else {
          highlighted += value;
        }
      }
      return highlighted;
    }
    var deprecationWarningShown = false;
    var NEWLINE = /\r\n|[\n\r\u2028\u2029]/;
    function getMarkerLines(loc, source, opts) {
      const startLoc = Object.assign({
        column: 0,
        line: -1
      }, loc.start);
      const endLoc = Object.assign({}, startLoc, loc.end);
      const {
        linesAbove = 2,
        linesBelow = 3
      } = opts || {};
      const startLine = startLoc.line;
      const startColumn = startLoc.column;
      const endLine = endLoc.line;
      const endColumn = endLoc.column;
      let start = Math.max(startLine - (linesAbove + 1), 0);
      let end = Math.min(source.length, endLine + linesBelow);
      if (startLine === -1) {
        start = 0;
      }
      if (endLine === -1) {
        end = source.length;
      }
      const lineDiff = endLine - startLine;
      const markerLines = {};
      if (lineDiff) {
        for (let i = 0; i <= lineDiff; i++) {
          const lineNumber = i + startLine;
          if (!startColumn) {
            markerLines[lineNumber] = true;
          } else if (i === 0) {
            const sourceLength = source[lineNumber - 1].length;
            markerLines[lineNumber] = [startColumn, sourceLength - startColumn + 1];
          } else if (i === lineDiff) {
            markerLines[lineNumber] = [0, endColumn];
          } else {
            const sourceLength = source[lineNumber - i].length;
            markerLines[lineNumber] = [0, sourceLength];
          }
        }
      } else {
        if (startColumn === endColumn) {
          if (startColumn) {
            markerLines[startLine] = [startColumn, 0];
          } else {
            markerLines[startLine] = true;
          }
        } else {
          markerLines[startLine] = [startColumn, endColumn - startColumn];
        }
      }
      return {
        start,
        end,
        markerLines
      };
    }
    function codeFrameColumns(rawLines, loc, opts = {}) {
      const shouldHighlight = opts.forceColor || isColorSupported() && opts.highlightCode;
      const defs = getDefs(shouldHighlight);
      const lines = rawLines.split(NEWLINE);
      const {
        start,
        end,
        markerLines
      } = getMarkerLines(loc, lines, opts);
      const hasColumns = loc.start && typeof loc.start.column === "number";
      const numberMaxWidth = String(end).length;
      const highlightedLines = shouldHighlight ? highlight(rawLines) : rawLines;
      let frame = highlightedLines.split(NEWLINE, end).slice(start, end).map((line, index2) => {
        const number = start + 1 + index2;
        const paddedNumber = ` ${number}`.slice(-numberMaxWidth);
        const gutter = ` ${paddedNumber} |`;
        const hasMarker = markerLines[number];
        const lastMarkerLine = !markerLines[number + 1];
        if (hasMarker) {
          let markerLine = "";
          if (Array.isArray(hasMarker)) {
            const markerSpacing = line.slice(0, Math.max(hasMarker[0] - 1, 0)).replace(/[^\t]/g, " ");
            const numberOfMarkers = hasMarker[1] || 1;
            markerLine = ["\n ", defs.gutter(gutter.replace(/\d/g, " ")), " ", markerSpacing, defs.marker("^").repeat(numberOfMarkers)].join("");
            if (lastMarkerLine && opts.message) {
              markerLine += " " + defs.message(opts.message);
            }
          }
          return [defs.marker(">"), defs.gutter(gutter), line.length > 0 ? ` ${line}` : "", markerLine].join("");
        } else {
          return ` ${defs.gutter(gutter)}${line.length > 0 ? ` ${line}` : ""}`;
        }
      }).join("\n");
      if (opts.message && !hasColumns) {
        frame = `${" ".repeat(numberMaxWidth + 1)}${opts.message}
${frame}`;
      }
      if (shouldHighlight) {
        return defs.reset(frame);
      } else {
        return frame;
      }
    }
    function index(rawLines, lineNumber, colNumber, opts = {}) {
      if (!deprecationWarningShown) {
        deprecationWarningShown = true;
        const message = "Passing lineNumber and colNumber is deprecated to @babel/code-frame. Please use `codeFrameColumns`.";
        if (process.emitWarning) {
          process.emitWarning(message, "DeprecationWarning");
        } else {
          const deprecationError = new Error(message);
          deprecationError.name = "DeprecationWarning";
          console.warn(new Error(message));
        }
      }
      colNumber = Math.max(colNumber, 0);
      const location = {
        start: {
          column: colNumber,
          line: lineNumber
        }
      };
      return codeFrameColumns(rawLines, location, opts);
    }
    exports.codeFrameColumns = codeFrameColumns;
    exports.default = index;
    exports.highlight = highlight;
  }
});

// node_modules/.pnpm/@jridgewell+sourcemap-codec@1.5.0/node_modules/@jridgewell/sourcemap-codec/dist/sourcemap-codec.umd.js
var require_sourcemap_codec_umd = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/@jridgewell+sourcemap-codec@1.5.0/node_modules/@jridgewell/sourcemap-codec/dist/sourcemap-codec.umd.js"(exports, module) {
    "use strict";
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.sourcemapCodec = {}));
    })(exports, function(exports2) {
      "use strict";
      const comma = ",".charCodeAt(0);
      const semicolon = ";".charCodeAt(0);
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      const intToChar = new Uint8Array(64);
      const charToInt = new Uint8Array(128);
      for (let i = 0; i < chars.length; i++) {
        const c = chars.charCodeAt(i);
        intToChar[i] = c;
        charToInt[c] = i;
      }
      function decodeInteger(reader, relative) {
        let value = 0;
        let shift = 0;
        let integer = 0;
        do {
          const c = reader.next();
          integer = charToInt[c];
          value |= (integer & 31) << shift;
          shift += 5;
        } while (integer & 32);
        const shouldNegate = value & 1;
        value >>>= 1;
        if (shouldNegate) {
          value = -2147483648 | -value;
        }
        return relative + value;
      }
      function encodeInteger(builder, num, relative) {
        let delta = num - relative;
        delta = delta < 0 ? -delta << 1 | 1 : delta << 1;
        do {
          let clamped = delta & 31;
          delta >>>= 5;
          if (delta > 0)
            clamped |= 32;
          builder.write(intToChar[clamped]);
        } while (delta > 0);
        return num;
      }
      function hasMoreVlq(reader, max) {
        if (reader.pos >= max)
          return false;
        return reader.peek() !== comma;
      }
      const bufLength = 1024 * 16;
      const td = typeof TextDecoder !== "undefined" ? /* @__PURE__ */ new TextDecoder() : typeof Buffer !== "undefined" ? {
        decode(buf) {
          const out = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
          return out.toString();
        }
      } : {
        decode(buf) {
          let out = "";
          for (let i = 0; i < buf.length; i++) {
            out += String.fromCharCode(buf[i]);
          }
          return out;
        }
      };
      class StringWriter {
        constructor() {
          this.pos = 0;
          this.out = "";
          this.buffer = new Uint8Array(bufLength);
        }
        write(v) {
          const { buffer } = this;
          buffer[this.pos++] = v;
          if (this.pos === bufLength) {
            this.out += td.decode(buffer);
            this.pos = 0;
          }
        }
        flush() {
          const { buffer, out, pos } = this;
          return pos > 0 ? out + td.decode(buffer.subarray(0, pos)) : out;
        }
      }
      class StringReader {
        constructor(buffer) {
          this.pos = 0;
          this.buffer = buffer;
        }
        next() {
          return this.buffer.charCodeAt(this.pos++);
        }
        peek() {
          return this.buffer.charCodeAt(this.pos);
        }
        indexOf(char) {
          const { buffer, pos } = this;
          const idx = buffer.indexOf(char, pos);
          return idx === -1 ? buffer.length : idx;
        }
      }
      const EMPTY = [];
      function decodeOriginalScopes(input) {
        const { length } = input;
        const reader = new StringReader(input);
        const scopes = [];
        const stack = [];
        let line = 0;
        for (; reader.pos < length; reader.pos++) {
          line = decodeInteger(reader, line);
          const column = decodeInteger(reader, 0);
          if (!hasMoreVlq(reader, length)) {
            const last = stack.pop();
            last[2] = line;
            last[3] = column;
            continue;
          }
          const kind = decodeInteger(reader, 0);
          const fields = decodeInteger(reader, 0);
          const hasName = fields & 1;
          const scope = hasName ? [line, column, 0, 0, kind, decodeInteger(reader, 0)] : [line, column, 0, 0, kind];
          let vars = EMPTY;
          if (hasMoreVlq(reader, length)) {
            vars = [];
            do {
              const varsIndex = decodeInteger(reader, 0);
              vars.push(varsIndex);
            } while (hasMoreVlq(reader, length));
          }
          scope.vars = vars;
          scopes.push(scope);
          stack.push(scope);
        }
        return scopes;
      }
      function encodeOriginalScopes(scopes) {
        const writer = new StringWriter();
        for (let i = 0; i < scopes.length; ) {
          i = _encodeOriginalScopes(scopes, i, writer, [0]);
        }
        return writer.flush();
      }
      function _encodeOriginalScopes(scopes, index, writer, state) {
        const scope = scopes[index];
        const { 0: startLine, 1: startColumn, 2: endLine, 3: endColumn, 4: kind, vars } = scope;
        if (index > 0)
          writer.write(comma);
        state[0] = encodeInteger(writer, startLine, state[0]);
        encodeInteger(writer, startColumn, 0);
        encodeInteger(writer, kind, 0);
        const fields = scope.length === 6 ? 1 : 0;
        encodeInteger(writer, fields, 0);
        if (scope.length === 6)
          encodeInteger(writer, scope[5], 0);
        for (const v of vars) {
          encodeInteger(writer, v, 0);
        }
        for (index++; index < scopes.length; ) {
          const next = scopes[index];
          const { 0: l, 1: c } = next;
          if (l > endLine || l === endLine && c >= endColumn) {
            break;
          }
          index = _encodeOriginalScopes(scopes, index, writer, state);
        }
        writer.write(comma);
        state[0] = encodeInteger(writer, endLine, state[0]);
        encodeInteger(writer, endColumn, 0);
        return index;
      }
      function decodeGeneratedRanges(input) {
        const { length } = input;
        const reader = new StringReader(input);
        const ranges = [];
        const stack = [];
        let genLine = 0;
        let definitionSourcesIndex = 0;
        let definitionScopeIndex = 0;
        let callsiteSourcesIndex = 0;
        let callsiteLine = 0;
        let callsiteColumn = 0;
        let bindingLine = 0;
        let bindingColumn = 0;
        do {
          const semi = reader.indexOf(";");
          let genColumn = 0;
          for (; reader.pos < semi; reader.pos++) {
            genColumn = decodeInteger(reader, genColumn);
            if (!hasMoreVlq(reader, semi)) {
              const last = stack.pop();
              last[2] = genLine;
              last[3] = genColumn;
              continue;
            }
            const fields = decodeInteger(reader, 0);
            const hasDefinition = fields & 1;
            const hasCallsite = fields & 2;
            const hasScope = fields & 4;
            let callsite = null;
            let bindings = EMPTY;
            let range;
            if (hasDefinition) {
              const defSourcesIndex = decodeInteger(reader, definitionSourcesIndex);
              definitionScopeIndex = decodeInteger(reader, definitionSourcesIndex === defSourcesIndex ? definitionScopeIndex : 0);
              definitionSourcesIndex = defSourcesIndex;
              range = [genLine, genColumn, 0, 0, defSourcesIndex, definitionScopeIndex];
            } else {
              range = [genLine, genColumn, 0, 0];
            }
            range.isScope = !!hasScope;
            if (hasCallsite) {
              const prevCsi = callsiteSourcesIndex;
              const prevLine = callsiteLine;
              callsiteSourcesIndex = decodeInteger(reader, callsiteSourcesIndex);
              const sameSource = prevCsi === callsiteSourcesIndex;
              callsiteLine = decodeInteger(reader, sameSource ? callsiteLine : 0);
              callsiteColumn = decodeInteger(reader, sameSource && prevLine === callsiteLine ? callsiteColumn : 0);
              callsite = [callsiteSourcesIndex, callsiteLine, callsiteColumn];
            }
            range.callsite = callsite;
            if (hasMoreVlq(reader, semi)) {
              bindings = [];
              do {
                bindingLine = genLine;
                bindingColumn = genColumn;
                const expressionsCount = decodeInteger(reader, 0);
                let expressionRanges;
                if (expressionsCount < -1) {
                  expressionRanges = [[decodeInteger(reader, 0)]];
                  for (let i = -1; i > expressionsCount; i--) {
                    const prevBl = bindingLine;
                    bindingLine = decodeInteger(reader, bindingLine);
                    bindingColumn = decodeInteger(reader, bindingLine === prevBl ? bindingColumn : 0);
                    const expression = decodeInteger(reader, 0);
                    expressionRanges.push([expression, bindingLine, bindingColumn]);
                  }
                } else {
                  expressionRanges = [[expressionsCount]];
                }
                bindings.push(expressionRanges);
              } while (hasMoreVlq(reader, semi));
            }
            range.bindings = bindings;
            ranges.push(range);
            stack.push(range);
          }
          genLine++;
          reader.pos = semi + 1;
        } while (reader.pos < length);
        return ranges;
      }
      function encodeGeneratedRanges(ranges) {
        if (ranges.length === 0)
          return "";
        const writer = new StringWriter();
        for (let i = 0; i < ranges.length; ) {
          i = _encodeGeneratedRanges(ranges, i, writer, [0, 0, 0, 0, 0, 0, 0]);
        }
        return writer.flush();
      }
      function _encodeGeneratedRanges(ranges, index, writer, state) {
        const range = ranges[index];
        const { 0: startLine, 1: startColumn, 2: endLine, 3: endColumn, isScope, callsite, bindings } = range;
        if (state[0] < startLine) {
          catchupLine(writer, state[0], startLine);
          state[0] = startLine;
          state[1] = 0;
        } else if (index > 0) {
          writer.write(comma);
        }
        state[1] = encodeInteger(writer, range[1], state[1]);
        const fields = (range.length === 6 ? 1 : 0) | (callsite ? 2 : 0) | (isScope ? 4 : 0);
        encodeInteger(writer, fields, 0);
        if (range.length === 6) {
          const { 4: sourcesIndex, 5: scopesIndex } = range;
          if (sourcesIndex !== state[2]) {
            state[3] = 0;
          }
          state[2] = encodeInteger(writer, sourcesIndex, state[2]);
          state[3] = encodeInteger(writer, scopesIndex, state[3]);
        }
        if (callsite) {
          const { 0: sourcesIndex, 1: callLine, 2: callColumn } = range.callsite;
          if (sourcesIndex !== state[4]) {
            state[5] = 0;
            state[6] = 0;
          } else if (callLine !== state[5]) {
            state[6] = 0;
          }
          state[4] = encodeInteger(writer, sourcesIndex, state[4]);
          state[5] = encodeInteger(writer, callLine, state[5]);
          state[6] = encodeInteger(writer, callColumn, state[6]);
        }
        if (bindings) {
          for (const binding of bindings) {
            if (binding.length > 1)
              encodeInteger(writer, -binding.length, 0);
            const expression = binding[0][0];
            encodeInteger(writer, expression, 0);
            let bindingStartLine = startLine;
            let bindingStartColumn = startColumn;
            for (let i = 1; i < binding.length; i++) {
              const expRange = binding[i];
              bindingStartLine = encodeInteger(writer, expRange[1], bindingStartLine);
              bindingStartColumn = encodeInteger(writer, expRange[2], bindingStartColumn);
              encodeInteger(writer, expRange[0], 0);
            }
          }
        }
        for (index++; index < ranges.length; ) {
          const next = ranges[index];
          const { 0: l, 1: c } = next;
          if (l > endLine || l === endLine && c >= endColumn) {
            break;
          }
          index = _encodeGeneratedRanges(ranges, index, writer, state);
        }
        if (state[0] < endLine) {
          catchupLine(writer, state[0], endLine);
          state[0] = endLine;
          state[1] = 0;
        } else {
          writer.write(comma);
        }
        state[1] = encodeInteger(writer, endColumn, state[1]);
        return index;
      }
      function catchupLine(writer, lastLine, line) {
        do {
          writer.write(semicolon);
        } while (++lastLine < line);
      }
      function decode(mappings) {
        const { length } = mappings;
        const reader = new StringReader(mappings);
        const decoded = [];
        let genColumn = 0;
        let sourcesIndex = 0;
        let sourceLine = 0;
        let sourceColumn = 0;
        let namesIndex = 0;
        do {
          const semi = reader.indexOf(";");
          const line = [];
          let sorted = true;
          let lastCol = 0;
          genColumn = 0;
          while (reader.pos < semi) {
            let seg;
            genColumn = decodeInteger(reader, genColumn);
            if (genColumn < lastCol)
              sorted = false;
            lastCol = genColumn;
            if (hasMoreVlq(reader, semi)) {
              sourcesIndex = decodeInteger(reader, sourcesIndex);
              sourceLine = decodeInteger(reader, sourceLine);
              sourceColumn = decodeInteger(reader, sourceColumn);
              if (hasMoreVlq(reader, semi)) {
                namesIndex = decodeInteger(reader, namesIndex);
                seg = [genColumn, sourcesIndex, sourceLine, sourceColumn, namesIndex];
              } else {
                seg = [genColumn, sourcesIndex, sourceLine, sourceColumn];
              }
            } else {
              seg = [genColumn];
            }
            line.push(seg);
            reader.pos++;
          }
          if (!sorted)
            sort(line);
          decoded.push(line);
          reader.pos = semi + 1;
        } while (reader.pos <= length);
        return decoded;
      }
      function sort(line) {
        line.sort(sortComparator);
      }
      function sortComparator(a, b) {
        return a[0] - b[0];
      }
      function encode(decoded) {
        const writer = new StringWriter();
        let sourcesIndex = 0;
        let sourceLine = 0;
        let sourceColumn = 0;
        let namesIndex = 0;
        for (let i = 0; i < decoded.length; i++) {
          const line = decoded[i];
          if (i > 0)
            writer.write(semicolon);
          if (line.length === 0)
            continue;
          let genColumn = 0;
          for (let j = 0; j < line.length; j++) {
            const segment = line[j];
            if (j > 0)
              writer.write(comma);
            genColumn = encodeInteger(writer, segment[0], genColumn);
            if (segment.length === 1)
              continue;
            sourcesIndex = encodeInteger(writer, segment[1], sourcesIndex);
            sourceLine = encodeInteger(writer, segment[2], sourceLine);
            sourceColumn = encodeInteger(writer, segment[3], sourceColumn);
            if (segment.length === 4)
              continue;
            namesIndex = encodeInteger(writer, segment[4], namesIndex);
          }
        }
        return writer.flush();
      }
      exports2.decode = decode;
      exports2.decodeGeneratedRanges = decodeGeneratedRanges;
      exports2.decodeOriginalScopes = decodeOriginalScopes;
      exports2.encode = encode;
      exports2.encodeGeneratedRanges = encodeGeneratedRanges;
      exports2.encodeOriginalScopes = encodeOriginalScopes;
      Object.defineProperty(exports2, "__esModule", { value: true });
    });
  }
});

// node_modules/.pnpm/magic-string@0.30.17/node_modules/magic-string/dist/magic-string.cjs.js
var require_magic_string_cjs = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/magic-string@0.30.17/node_modules/magic-string/dist/magic-string.cjs.js"(exports, module) {
    "use strict";
    var sourcemapCodec = require_sourcemap_codec_umd();
    var BitSet = class _BitSet {
      constructor(arg) {
        this.bits = arg instanceof _BitSet ? arg.bits.slice() : [];
      }
      add(n2) {
        this.bits[n2 >> 5] |= 1 << (n2 & 31);
      }
      has(n2) {
        return !!(this.bits[n2 >> 5] & 1 << (n2 & 31));
      }
    };
    var Chunk = class _Chunk {
      constructor(start, end, content) {
        this.start = start;
        this.end = end;
        this.original = content;
        this.intro = "";
        this.outro = "";
        this.content = content;
        this.storeName = false;
        this.edited = false;
        {
          this.previous = null;
          this.next = null;
        }
      }
      appendLeft(content) {
        this.outro += content;
      }
      appendRight(content) {
        this.intro = this.intro + content;
      }
      clone() {
        const chunk = new _Chunk(this.start, this.end, this.original);
        chunk.intro = this.intro;
        chunk.outro = this.outro;
        chunk.content = this.content;
        chunk.storeName = this.storeName;
        chunk.edited = this.edited;
        return chunk;
      }
      contains(index) {
        return this.start < index && index < this.end;
      }
      eachNext(fn) {
        let chunk = this;
        while (chunk) {
          fn(chunk);
          chunk = chunk.next;
        }
      }
      eachPrevious(fn) {
        let chunk = this;
        while (chunk) {
          fn(chunk);
          chunk = chunk.previous;
        }
      }
      edit(content, storeName, contentOnly) {
        this.content = content;
        if (!contentOnly) {
          this.intro = "";
          this.outro = "";
        }
        this.storeName = storeName;
        this.edited = true;
        return this;
      }
      prependLeft(content) {
        this.outro = content + this.outro;
      }
      prependRight(content) {
        this.intro = content + this.intro;
      }
      reset() {
        this.intro = "";
        this.outro = "";
        if (this.edited) {
          this.content = this.original;
          this.storeName = false;
          this.edited = false;
        }
      }
      split(index) {
        const sliceIndex = index - this.start;
        const originalBefore = this.original.slice(0, sliceIndex);
        const originalAfter = this.original.slice(sliceIndex);
        this.original = originalBefore;
        const newChunk = new _Chunk(index, this.end, originalAfter);
        newChunk.outro = this.outro;
        this.outro = "";
        this.end = index;
        if (this.edited) {
          newChunk.edit("", false);
          this.content = "";
        } else {
          this.content = originalBefore;
        }
        newChunk.next = this.next;
        if (newChunk.next) newChunk.next.previous = newChunk;
        newChunk.previous = this;
        this.next = newChunk;
        return newChunk;
      }
      toString() {
        return this.intro + this.content + this.outro;
      }
      trimEnd(rx) {
        this.outro = this.outro.replace(rx, "");
        if (this.outro.length) return true;
        const trimmed = this.content.replace(rx, "");
        if (trimmed.length) {
          if (trimmed !== this.content) {
            this.split(this.start + trimmed.length).edit("", void 0, true);
            if (this.edited) {
              this.edit(trimmed, this.storeName, true);
            }
          }
          return true;
        } else {
          this.edit("", void 0, true);
          this.intro = this.intro.replace(rx, "");
          if (this.intro.length) return true;
        }
      }
      trimStart(rx) {
        this.intro = this.intro.replace(rx, "");
        if (this.intro.length) return true;
        const trimmed = this.content.replace(rx, "");
        if (trimmed.length) {
          if (trimmed !== this.content) {
            const newChunk = this.split(this.end - trimmed.length);
            if (this.edited) {
              newChunk.edit(trimmed, this.storeName, true);
            }
            this.edit("", void 0, true);
          }
          return true;
        } else {
          this.edit("", void 0, true);
          this.outro = this.outro.replace(rx, "");
          if (this.outro.length) return true;
        }
      }
    };
    function getBtoa() {
      if (typeof globalThis !== "undefined" && typeof globalThis.btoa === "function") {
        return (str) => globalThis.btoa(unescape(encodeURIComponent(str)));
      } else if (typeof Buffer === "function") {
        return (str) => Buffer.from(str, "utf-8").toString("base64");
      } else {
        return () => {
          throw new Error("Unsupported environment: `window.btoa` or `Buffer` should be supported.");
        };
      }
    }
    var btoa = /* @__PURE__ */ getBtoa();
    var SourceMap = class {
      constructor(properties) {
        this.version = 3;
        this.file = properties.file;
        this.sources = properties.sources;
        this.sourcesContent = properties.sourcesContent;
        this.names = properties.names;
        this.mappings = sourcemapCodec.encode(properties.mappings);
        if (typeof properties.x_google_ignoreList !== "undefined") {
          this.x_google_ignoreList = properties.x_google_ignoreList;
        }
        if (typeof properties.debugId !== "undefined") {
          this.debugId = properties.debugId;
        }
      }
      toString() {
        return JSON.stringify(this);
      }
      toUrl() {
        return "data:application/json;charset=utf-8;base64," + btoa(this.toString());
      }
    };
    function guessIndent(code) {
      const lines = code.split("\n");
      const tabbed = lines.filter((line) => /^\t+/.test(line));
      const spaced = lines.filter((line) => /^ {2,}/.test(line));
      if (tabbed.length === 0 && spaced.length === 0) {
        return null;
      }
      if (tabbed.length >= spaced.length) {
        return "	";
      }
      const min = spaced.reduce((previous, current) => {
        const numSpaces = /^ +/.exec(current)[0].length;
        return Math.min(numSpaces, previous);
      }, Infinity);
      return new Array(min + 1).join(" ");
    }
    function getRelativePath(from, to) {
      const fromParts = from.split(/[/\\]/);
      const toParts = to.split(/[/\\]/);
      fromParts.pop();
      while (fromParts[0] === toParts[0]) {
        fromParts.shift();
        toParts.shift();
      }
      if (fromParts.length) {
        let i = fromParts.length;
        while (i--) fromParts[i] = "..";
      }
      return fromParts.concat(toParts).join("/");
    }
    var toString = Object.prototype.toString;
    function isObject(thing) {
      return toString.call(thing) === "[object Object]";
    }
    function getLocator(source) {
      const originalLines = source.split("\n");
      const lineOffsets = [];
      for (let i = 0, pos = 0; i < originalLines.length; i++) {
        lineOffsets.push(pos);
        pos += originalLines[i].length + 1;
      }
      return function locate(index) {
        let i = 0;
        let j = lineOffsets.length;
        while (i < j) {
          const m = i + j >> 1;
          if (index < lineOffsets[m]) {
            j = m;
          } else {
            i = m + 1;
          }
        }
        const line = i - 1;
        const column = index - lineOffsets[line];
        return { line, column };
      };
    }
    var wordRegex = /\w/;
    var Mappings = class {
      constructor(hires) {
        this.hires = hires;
        this.generatedCodeLine = 0;
        this.generatedCodeColumn = 0;
        this.raw = [];
        this.rawSegments = this.raw[this.generatedCodeLine] = [];
        this.pending = null;
      }
      addEdit(sourceIndex, content, loc, nameIndex) {
        if (content.length) {
          const contentLengthMinusOne = content.length - 1;
          let contentLineEnd = content.indexOf("\n", 0);
          let previousContentLineEnd = -1;
          while (contentLineEnd >= 0 && contentLengthMinusOne > contentLineEnd) {
            const segment2 = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
            if (nameIndex >= 0) {
              segment2.push(nameIndex);
            }
            this.rawSegments.push(segment2);
            this.generatedCodeLine += 1;
            this.raw[this.generatedCodeLine] = this.rawSegments = [];
            this.generatedCodeColumn = 0;
            previousContentLineEnd = contentLineEnd;
            contentLineEnd = content.indexOf("\n", contentLineEnd + 1);
          }
          const segment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
          if (nameIndex >= 0) {
            segment.push(nameIndex);
          }
          this.rawSegments.push(segment);
          this.advance(content.slice(previousContentLineEnd + 1));
        } else if (this.pending) {
          this.rawSegments.push(this.pending);
          this.advance(content);
        }
        this.pending = null;
      }
      addUneditedChunk(sourceIndex, chunk, original, loc, sourcemapLocations) {
        let originalCharIndex = chunk.start;
        let first = true;
        let charInHiresBoundary = false;
        while (originalCharIndex < chunk.end) {
          if (original[originalCharIndex] === "\n") {
            loc.line += 1;
            loc.column = 0;
            this.generatedCodeLine += 1;
            this.raw[this.generatedCodeLine] = this.rawSegments = [];
            this.generatedCodeColumn = 0;
            first = true;
            charInHiresBoundary = false;
          } else {
            if (this.hires || first || sourcemapLocations.has(originalCharIndex)) {
              const segment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
              if (this.hires === "boundary") {
                if (wordRegex.test(original[originalCharIndex])) {
                  if (!charInHiresBoundary) {
                    this.rawSegments.push(segment);
                    charInHiresBoundary = true;
                  }
                } else {
                  this.rawSegments.push(segment);
                  charInHiresBoundary = false;
                }
              } else {
                this.rawSegments.push(segment);
              }
            }
            loc.column += 1;
            this.generatedCodeColumn += 1;
            first = false;
          }
          originalCharIndex += 1;
        }
        this.pending = null;
      }
      advance(str) {
        if (!str) return;
        const lines = str.split("\n");
        if (lines.length > 1) {
          for (let i = 0; i < lines.length - 1; i++) {
            this.generatedCodeLine++;
            this.raw[this.generatedCodeLine] = this.rawSegments = [];
          }
          this.generatedCodeColumn = 0;
        }
        this.generatedCodeColumn += lines[lines.length - 1].length;
      }
    };
    var n = "\n";
    var warned = {
      insertLeft: false,
      insertRight: false,
      storeName: false
    };
    var MagicString = class _MagicString {
      constructor(string, options = {}) {
        const chunk = new Chunk(0, string.length, string);
        Object.defineProperties(this, {
          original: { writable: true, value: string },
          outro: { writable: true, value: "" },
          intro: { writable: true, value: "" },
          firstChunk: { writable: true, value: chunk },
          lastChunk: { writable: true, value: chunk },
          lastSearchedChunk: { writable: true, value: chunk },
          byStart: { writable: true, value: {} },
          byEnd: { writable: true, value: {} },
          filename: { writable: true, value: options.filename },
          indentExclusionRanges: { writable: true, value: options.indentExclusionRanges },
          sourcemapLocations: { writable: true, value: new BitSet() },
          storedNames: { writable: true, value: {} },
          indentStr: { writable: true, value: void 0 },
          ignoreList: { writable: true, value: options.ignoreList },
          offset: { writable: true, value: options.offset || 0 }
        });
        this.byStart[0] = chunk;
        this.byEnd[string.length] = chunk;
      }
      addSourcemapLocation(char) {
        this.sourcemapLocations.add(char);
      }
      append(content) {
        if (typeof content !== "string") throw new TypeError("outro content must be a string");
        this.outro += content;
        return this;
      }
      appendLeft(index, content) {
        index = index + this.offset;
        if (typeof content !== "string") throw new TypeError("inserted content must be a string");
        this._split(index);
        const chunk = this.byEnd[index];
        if (chunk) {
          chunk.appendLeft(content);
        } else {
          this.intro += content;
        }
        return this;
      }
      appendRight(index, content) {
        index = index + this.offset;
        if (typeof content !== "string") throw new TypeError("inserted content must be a string");
        this._split(index);
        const chunk = this.byStart[index];
        if (chunk) {
          chunk.appendRight(content);
        } else {
          this.outro += content;
        }
        return this;
      }
      clone() {
        const cloned = new _MagicString(this.original, { filename: this.filename, offset: this.offset });
        let originalChunk = this.firstChunk;
        let clonedChunk = cloned.firstChunk = cloned.lastSearchedChunk = originalChunk.clone();
        while (originalChunk) {
          cloned.byStart[clonedChunk.start] = clonedChunk;
          cloned.byEnd[clonedChunk.end] = clonedChunk;
          const nextOriginalChunk = originalChunk.next;
          const nextClonedChunk = nextOriginalChunk && nextOriginalChunk.clone();
          if (nextClonedChunk) {
            clonedChunk.next = nextClonedChunk;
            nextClonedChunk.previous = clonedChunk;
            clonedChunk = nextClonedChunk;
          }
          originalChunk = nextOriginalChunk;
        }
        cloned.lastChunk = clonedChunk;
        if (this.indentExclusionRanges) {
          cloned.indentExclusionRanges = this.indentExclusionRanges.slice();
        }
        cloned.sourcemapLocations = new BitSet(this.sourcemapLocations);
        cloned.intro = this.intro;
        cloned.outro = this.outro;
        return cloned;
      }
      generateDecodedMap(options) {
        options = options || {};
        const sourceIndex = 0;
        const names = Object.keys(this.storedNames);
        const mappings = new Mappings(options.hires);
        const locate = getLocator(this.original);
        if (this.intro) {
          mappings.advance(this.intro);
        }
        this.firstChunk.eachNext((chunk) => {
          const loc = locate(chunk.start);
          if (chunk.intro.length) mappings.advance(chunk.intro);
          if (chunk.edited) {
            mappings.addEdit(
              sourceIndex,
              chunk.content,
              loc,
              chunk.storeName ? names.indexOf(chunk.original) : -1
            );
          } else {
            mappings.addUneditedChunk(sourceIndex, chunk, this.original, loc, this.sourcemapLocations);
          }
          if (chunk.outro.length) mappings.advance(chunk.outro);
        });
        return {
          file: options.file ? options.file.split(/[/\\]/).pop() : void 0,
          sources: [
            options.source ? getRelativePath(options.file || "", options.source) : options.file || ""
          ],
          sourcesContent: options.includeContent ? [this.original] : void 0,
          names,
          mappings: mappings.raw,
          x_google_ignoreList: this.ignoreList ? [sourceIndex] : void 0
        };
      }
      generateMap(options) {
        return new SourceMap(this.generateDecodedMap(options));
      }
      _ensureindentStr() {
        if (this.indentStr === void 0) {
          this.indentStr = guessIndent(this.original);
        }
      }
      _getRawIndentString() {
        this._ensureindentStr();
        return this.indentStr;
      }
      getIndentString() {
        this._ensureindentStr();
        return this.indentStr === null ? "	" : this.indentStr;
      }
      indent(indentStr, options) {
        const pattern = /^[^\r\n]/gm;
        if (isObject(indentStr)) {
          options = indentStr;
          indentStr = void 0;
        }
        if (indentStr === void 0) {
          this._ensureindentStr();
          indentStr = this.indentStr || "	";
        }
        if (indentStr === "") return this;
        options = options || {};
        const isExcluded = {};
        if (options.exclude) {
          const exclusions = typeof options.exclude[0] === "number" ? [options.exclude] : options.exclude;
          exclusions.forEach((exclusion) => {
            for (let i = exclusion[0]; i < exclusion[1]; i += 1) {
              isExcluded[i] = true;
            }
          });
        }
        let shouldIndentNextCharacter = options.indentStart !== false;
        const replacer = (match) => {
          if (shouldIndentNextCharacter) return `${indentStr}${match}`;
          shouldIndentNextCharacter = true;
          return match;
        };
        this.intro = this.intro.replace(pattern, replacer);
        let charIndex = 0;
        let chunk = this.firstChunk;
        while (chunk) {
          const end = chunk.end;
          if (chunk.edited) {
            if (!isExcluded[charIndex]) {
              chunk.content = chunk.content.replace(pattern, replacer);
              if (chunk.content.length) {
                shouldIndentNextCharacter = chunk.content[chunk.content.length - 1] === "\n";
              }
            }
          } else {
            charIndex = chunk.start;
            while (charIndex < end) {
              if (!isExcluded[charIndex]) {
                const char = this.original[charIndex];
                if (char === "\n") {
                  shouldIndentNextCharacter = true;
                } else if (char !== "\r" && shouldIndentNextCharacter) {
                  shouldIndentNextCharacter = false;
                  if (charIndex === chunk.start) {
                    chunk.prependRight(indentStr);
                  } else {
                    this._splitChunk(chunk, charIndex);
                    chunk = chunk.next;
                    chunk.prependRight(indentStr);
                  }
                }
              }
              charIndex += 1;
            }
          }
          charIndex = chunk.end;
          chunk = chunk.next;
        }
        this.outro = this.outro.replace(pattern, replacer);
        return this;
      }
      insert() {
        throw new Error(
          "magicString.insert(...) is deprecated. Use prependRight(...) or appendLeft(...)"
        );
      }
      insertLeft(index, content) {
        if (!warned.insertLeft) {
          console.warn(
            "magicString.insertLeft(...) is deprecated. Use magicString.appendLeft(...) instead"
          );
          warned.insertLeft = true;
        }
        return this.appendLeft(index, content);
      }
      insertRight(index, content) {
        if (!warned.insertRight) {
          console.warn(
            "magicString.insertRight(...) is deprecated. Use magicString.prependRight(...) instead"
          );
          warned.insertRight = true;
        }
        return this.prependRight(index, content);
      }
      move(start, end, index) {
        start = start + this.offset;
        end = end + this.offset;
        index = index + this.offset;
        if (index >= start && index <= end) throw new Error("Cannot move a selection inside itself");
        this._split(start);
        this._split(end);
        this._split(index);
        const first = this.byStart[start];
        const last = this.byEnd[end];
        const oldLeft = first.previous;
        const oldRight = last.next;
        const newRight = this.byStart[index];
        if (!newRight && last === this.lastChunk) return this;
        const newLeft = newRight ? newRight.previous : this.lastChunk;
        if (oldLeft) oldLeft.next = oldRight;
        if (oldRight) oldRight.previous = oldLeft;
        if (newLeft) newLeft.next = first;
        if (newRight) newRight.previous = last;
        if (!first.previous) this.firstChunk = last.next;
        if (!last.next) {
          this.lastChunk = first.previous;
          this.lastChunk.next = null;
        }
        first.previous = newLeft;
        last.next = newRight || null;
        if (!newLeft) this.firstChunk = first;
        if (!newRight) this.lastChunk = last;
        return this;
      }
      overwrite(start, end, content, options) {
        options = options || {};
        return this.update(start, end, content, { ...options, overwrite: !options.contentOnly });
      }
      update(start, end, content, options) {
        start = start + this.offset;
        end = end + this.offset;
        if (typeof content !== "string") throw new TypeError("replacement content must be a string");
        if (this.original.length !== 0) {
          while (start < 0) start += this.original.length;
          while (end < 0) end += this.original.length;
        }
        if (end > this.original.length) throw new Error("end is out of bounds");
        if (start === end)
          throw new Error(
            "Cannot overwrite a zero-length range \u2013 use appendLeft or prependRight instead"
          );
        this._split(start);
        this._split(end);
        if (options === true) {
          if (!warned.storeName) {
            console.warn(
              "The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string"
            );
            warned.storeName = true;
          }
          options = { storeName: true };
        }
        const storeName = options !== void 0 ? options.storeName : false;
        const overwrite = options !== void 0 ? options.overwrite : false;
        if (storeName) {
          const original = this.original.slice(start, end);
          Object.defineProperty(this.storedNames, original, {
            writable: true,
            value: true,
            enumerable: true
          });
        }
        const first = this.byStart[start];
        const last = this.byEnd[end];
        if (first) {
          let chunk = first;
          while (chunk !== last) {
            if (chunk.next !== this.byStart[chunk.end]) {
              throw new Error("Cannot overwrite across a split point");
            }
            chunk = chunk.next;
            chunk.edit("", false);
          }
          first.edit(content, storeName, !overwrite);
        } else {
          const newChunk = new Chunk(start, end, "").edit(content, storeName);
          last.next = newChunk;
          newChunk.previous = last;
        }
        return this;
      }
      prepend(content) {
        if (typeof content !== "string") throw new TypeError("outro content must be a string");
        this.intro = content + this.intro;
        return this;
      }
      prependLeft(index, content) {
        index = index + this.offset;
        if (typeof content !== "string") throw new TypeError("inserted content must be a string");
        this._split(index);
        const chunk = this.byEnd[index];
        if (chunk) {
          chunk.prependLeft(content);
        } else {
          this.intro = content + this.intro;
        }
        return this;
      }
      prependRight(index, content) {
        index = index + this.offset;
        if (typeof content !== "string") throw new TypeError("inserted content must be a string");
        this._split(index);
        const chunk = this.byStart[index];
        if (chunk) {
          chunk.prependRight(content);
        } else {
          this.outro = content + this.outro;
        }
        return this;
      }
      remove(start, end) {
        start = start + this.offset;
        end = end + this.offset;
        if (this.original.length !== 0) {
          while (start < 0) start += this.original.length;
          while (end < 0) end += this.original.length;
        }
        if (start === end) return this;
        if (start < 0 || end > this.original.length) throw new Error("Character is out of bounds");
        if (start > end) throw new Error("end must be greater than start");
        this._split(start);
        this._split(end);
        let chunk = this.byStart[start];
        while (chunk) {
          chunk.intro = "";
          chunk.outro = "";
          chunk.edit("");
          chunk = end > chunk.end ? this.byStart[chunk.end] : null;
        }
        return this;
      }
      reset(start, end) {
        start = start + this.offset;
        end = end + this.offset;
        if (this.original.length !== 0) {
          while (start < 0) start += this.original.length;
          while (end < 0) end += this.original.length;
        }
        if (start === end) return this;
        if (start < 0 || end > this.original.length) throw new Error("Character is out of bounds");
        if (start > end) throw new Error("end must be greater than start");
        this._split(start);
        this._split(end);
        let chunk = this.byStart[start];
        while (chunk) {
          chunk.reset();
          chunk = end > chunk.end ? this.byStart[chunk.end] : null;
        }
        return this;
      }
      lastChar() {
        if (this.outro.length) return this.outro[this.outro.length - 1];
        let chunk = this.lastChunk;
        do {
          if (chunk.outro.length) return chunk.outro[chunk.outro.length - 1];
          if (chunk.content.length) return chunk.content[chunk.content.length - 1];
          if (chunk.intro.length) return chunk.intro[chunk.intro.length - 1];
        } while (chunk = chunk.previous);
        if (this.intro.length) return this.intro[this.intro.length - 1];
        return "";
      }
      lastLine() {
        let lineIndex = this.outro.lastIndexOf(n);
        if (lineIndex !== -1) return this.outro.substr(lineIndex + 1);
        let lineStr = this.outro;
        let chunk = this.lastChunk;
        do {
          if (chunk.outro.length > 0) {
            lineIndex = chunk.outro.lastIndexOf(n);
            if (lineIndex !== -1) return chunk.outro.substr(lineIndex + 1) + lineStr;
            lineStr = chunk.outro + lineStr;
          }
          if (chunk.content.length > 0) {
            lineIndex = chunk.content.lastIndexOf(n);
            if (lineIndex !== -1) return chunk.content.substr(lineIndex + 1) + lineStr;
            lineStr = chunk.content + lineStr;
          }
          if (chunk.intro.length > 0) {
            lineIndex = chunk.intro.lastIndexOf(n);
            if (lineIndex !== -1) return chunk.intro.substr(lineIndex + 1) + lineStr;
            lineStr = chunk.intro + lineStr;
          }
        } while (chunk = chunk.previous);
        lineIndex = this.intro.lastIndexOf(n);
        if (lineIndex !== -1) return this.intro.substr(lineIndex + 1) + lineStr;
        return this.intro + lineStr;
      }
      slice(start = 0, end = this.original.length - this.offset) {
        start = start + this.offset;
        end = end + this.offset;
        if (this.original.length !== 0) {
          while (start < 0) start += this.original.length;
          while (end < 0) end += this.original.length;
        }
        let result = "";
        let chunk = this.firstChunk;
        while (chunk && (chunk.start > start || chunk.end <= start)) {
          if (chunk.start < end && chunk.end >= end) {
            return result;
          }
          chunk = chunk.next;
        }
        if (chunk && chunk.edited && chunk.start !== start)
          throw new Error(`Cannot use replaced character ${start} as slice start anchor.`);
        const startChunk = chunk;
        while (chunk) {
          if (chunk.intro && (startChunk !== chunk || chunk.start === start)) {
            result += chunk.intro;
          }
          const containsEnd = chunk.start < end && chunk.end >= end;
          if (containsEnd && chunk.edited && chunk.end !== end)
            throw new Error(`Cannot use replaced character ${end} as slice end anchor.`);
          const sliceStart = startChunk === chunk ? start - chunk.start : 0;
          const sliceEnd = containsEnd ? chunk.content.length + end - chunk.end : chunk.content.length;
          result += chunk.content.slice(sliceStart, sliceEnd);
          if (chunk.outro && (!containsEnd || chunk.end === end)) {
            result += chunk.outro;
          }
          if (containsEnd) {
            break;
          }
          chunk = chunk.next;
        }
        return result;
      }
      // TODO deprecate this? not really very useful
      snip(start, end) {
        const clone = this.clone();
        clone.remove(0, start);
        clone.remove(end, clone.original.length);
        return clone;
      }
      _split(index) {
        if (this.byStart[index] || this.byEnd[index]) return;
        let chunk = this.lastSearchedChunk;
        const searchForward = index > chunk.end;
        while (chunk) {
          if (chunk.contains(index)) return this._splitChunk(chunk, index);
          chunk = searchForward ? this.byStart[chunk.end] : this.byEnd[chunk.start];
        }
      }
      _splitChunk(chunk, index) {
        if (chunk.edited && chunk.content.length) {
          const loc = getLocator(this.original)(index);
          throw new Error(
            `Cannot split a chunk that has already been edited (${loc.line}:${loc.column} \u2013 "${chunk.original}")`
          );
        }
        const newChunk = chunk.split(index);
        this.byEnd[index] = chunk;
        this.byStart[index] = newChunk;
        this.byEnd[newChunk.end] = newChunk;
        if (chunk === this.lastChunk) this.lastChunk = newChunk;
        this.lastSearchedChunk = chunk;
        return true;
      }
      toString() {
        let str = this.intro;
        let chunk = this.firstChunk;
        while (chunk) {
          str += chunk.toString();
          chunk = chunk.next;
        }
        return str + this.outro;
      }
      isEmpty() {
        let chunk = this.firstChunk;
        do {
          if (chunk.intro.length && chunk.intro.trim() || chunk.content.length && chunk.content.trim() || chunk.outro.length && chunk.outro.trim())
            return false;
        } while (chunk = chunk.next);
        return true;
      }
      length() {
        let chunk = this.firstChunk;
        let length = 0;
        do {
          length += chunk.intro.length + chunk.content.length + chunk.outro.length;
        } while (chunk = chunk.next);
        return length;
      }
      trimLines() {
        return this.trim("[\\r\\n]");
      }
      trim(charType) {
        return this.trimStart(charType).trimEnd(charType);
      }
      trimEndAborted(charType) {
        const rx = new RegExp((charType || "\\s") + "+$");
        this.outro = this.outro.replace(rx, "");
        if (this.outro.length) return true;
        let chunk = this.lastChunk;
        do {
          const end = chunk.end;
          const aborted = chunk.trimEnd(rx);
          if (chunk.end !== end) {
            if (this.lastChunk === chunk) {
              this.lastChunk = chunk.next;
            }
            this.byEnd[chunk.end] = chunk;
            this.byStart[chunk.next.start] = chunk.next;
            this.byEnd[chunk.next.end] = chunk.next;
          }
          if (aborted) return true;
          chunk = chunk.previous;
        } while (chunk);
        return false;
      }
      trimEnd(charType) {
        this.trimEndAborted(charType);
        return this;
      }
      trimStartAborted(charType) {
        const rx = new RegExp("^" + (charType || "\\s") + "+");
        this.intro = this.intro.replace(rx, "");
        if (this.intro.length) return true;
        let chunk = this.firstChunk;
        do {
          const end = chunk.end;
          const aborted = chunk.trimStart(rx);
          if (chunk.end !== end) {
            if (chunk === this.lastChunk) this.lastChunk = chunk.next;
            this.byEnd[chunk.end] = chunk;
            this.byStart[chunk.next.start] = chunk.next;
            this.byEnd[chunk.next.end] = chunk.next;
          }
          if (aborted) return true;
          chunk = chunk.next;
        } while (chunk);
        return false;
      }
      trimStart(charType) {
        this.trimStartAborted(charType);
        return this;
      }
      hasChanged() {
        return this.original !== this.toString();
      }
      _replaceRegexp(searchValue, replacement) {
        function getReplacement(match, str) {
          if (typeof replacement === "string") {
            return replacement.replace(/\$(\$|&|\d+)/g, (_, i) => {
              if (i === "$") return "$";
              if (i === "&") return match[0];
              const num = +i;
              if (num < match.length) return match[+i];
              return `$${i}`;
            });
          } else {
            return replacement(...match, match.index, str, match.groups);
          }
        }
        function matchAll(re, str) {
          let match;
          const matches = [];
          while (match = re.exec(str)) {
            matches.push(match);
          }
          return matches;
        }
        if (searchValue.global) {
          const matches = matchAll(searchValue, this.original);
          matches.forEach((match) => {
            if (match.index != null) {
              const replacement2 = getReplacement(match, this.original);
              if (replacement2 !== match[0]) {
                this.overwrite(match.index, match.index + match[0].length, replacement2);
              }
            }
          });
        } else {
          const match = this.original.match(searchValue);
          if (match && match.index != null) {
            const replacement2 = getReplacement(match, this.original);
            if (replacement2 !== match[0]) {
              this.overwrite(match.index, match.index + match[0].length, replacement2);
            }
          }
        }
        return this;
      }
      _replaceString(string, replacement) {
        const { original } = this;
        const index = original.indexOf(string);
        if (index !== -1) {
          this.overwrite(index, index + string.length, replacement);
        }
        return this;
      }
      replace(searchValue, replacement) {
        if (typeof searchValue === "string") {
          return this._replaceString(searchValue, replacement);
        }
        return this._replaceRegexp(searchValue, replacement);
      }
      _replaceAllString(string, replacement) {
        const { original } = this;
        const stringLength = string.length;
        for (let index = original.indexOf(string); index !== -1; index = original.indexOf(string, index + stringLength)) {
          const previous = original.slice(index, index + stringLength);
          if (previous !== replacement) this.overwrite(index, index + stringLength, replacement);
        }
        return this;
      }
      replaceAll(searchValue, replacement) {
        if (typeof searchValue === "string") {
          return this._replaceAllString(searchValue, replacement);
        }
        if (!searchValue.global) {
          throw new TypeError(
            "MagicString.prototype.replaceAll called with a non-global RegExp argument"
          );
        }
        return this._replaceRegexp(searchValue, replacement);
      }
    };
    var hasOwnProp = Object.prototype.hasOwnProperty;
    var Bundle = class _Bundle {
      constructor(options = {}) {
        this.intro = options.intro || "";
        this.separator = options.separator !== void 0 ? options.separator : "\n";
        this.sources = [];
        this.uniqueSources = [];
        this.uniqueSourceIndexByFilename = {};
      }
      addSource(source) {
        if (source instanceof MagicString) {
          return this.addSource({
            content: source,
            filename: source.filename,
            separator: this.separator
          });
        }
        if (!isObject(source) || !source.content) {
          throw new Error(
            "bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`"
          );
        }
        ["filename", "ignoreList", "indentExclusionRanges", "separator"].forEach((option) => {
          if (!hasOwnProp.call(source, option)) source[option] = source.content[option];
        });
        if (source.separator === void 0) {
          source.separator = this.separator;
        }
        if (source.filename) {
          if (!hasOwnProp.call(this.uniqueSourceIndexByFilename, source.filename)) {
            this.uniqueSourceIndexByFilename[source.filename] = this.uniqueSources.length;
            this.uniqueSources.push({ filename: source.filename, content: source.content.original });
          } else {
            const uniqueSource = this.uniqueSources[this.uniqueSourceIndexByFilename[source.filename]];
            if (source.content.original !== uniqueSource.content) {
              throw new Error(`Illegal source: same filename (${source.filename}), different contents`);
            }
          }
        }
        this.sources.push(source);
        return this;
      }
      append(str, options) {
        this.addSource({
          content: new MagicString(str),
          separator: options && options.separator || ""
        });
        return this;
      }
      clone() {
        const bundle = new _Bundle({
          intro: this.intro,
          separator: this.separator
        });
        this.sources.forEach((source) => {
          bundle.addSource({
            filename: source.filename,
            content: source.content.clone(),
            separator: source.separator
          });
        });
        return bundle;
      }
      generateDecodedMap(options = {}) {
        const names = [];
        let x_google_ignoreList = void 0;
        this.sources.forEach((source) => {
          Object.keys(source.content.storedNames).forEach((name) => {
            if (!~names.indexOf(name)) names.push(name);
          });
        });
        const mappings = new Mappings(options.hires);
        if (this.intro) {
          mappings.advance(this.intro);
        }
        this.sources.forEach((source, i) => {
          if (i > 0) {
            mappings.advance(this.separator);
          }
          const sourceIndex = source.filename ? this.uniqueSourceIndexByFilename[source.filename] : -1;
          const magicString = source.content;
          const locate = getLocator(magicString.original);
          if (magicString.intro) {
            mappings.advance(magicString.intro);
          }
          magicString.firstChunk.eachNext((chunk) => {
            const loc = locate(chunk.start);
            if (chunk.intro.length) mappings.advance(chunk.intro);
            if (source.filename) {
              if (chunk.edited) {
                mappings.addEdit(
                  sourceIndex,
                  chunk.content,
                  loc,
                  chunk.storeName ? names.indexOf(chunk.original) : -1
                );
              } else {
                mappings.addUneditedChunk(
                  sourceIndex,
                  chunk,
                  magicString.original,
                  loc,
                  magicString.sourcemapLocations
                );
              }
            } else {
              mappings.advance(chunk.content);
            }
            if (chunk.outro.length) mappings.advance(chunk.outro);
          });
          if (magicString.outro) {
            mappings.advance(magicString.outro);
          }
          if (source.ignoreList && sourceIndex !== -1) {
            if (x_google_ignoreList === void 0) {
              x_google_ignoreList = [];
            }
            x_google_ignoreList.push(sourceIndex);
          }
        });
        return {
          file: options.file ? options.file.split(/[/\\]/).pop() : void 0,
          sources: this.uniqueSources.map((source) => {
            return options.file ? getRelativePath(options.file, source.filename) : source.filename;
          }),
          sourcesContent: this.uniqueSources.map((source) => {
            return options.includeContent ? source.content : null;
          }),
          names,
          mappings: mappings.raw,
          x_google_ignoreList
        };
      }
      generateMap(options) {
        return new SourceMap(this.generateDecodedMap(options));
      }
      getIndentString() {
        const indentStringCounts = {};
        this.sources.forEach((source) => {
          const indentStr = source.content._getRawIndentString();
          if (indentStr === null) return;
          if (!indentStringCounts[indentStr]) indentStringCounts[indentStr] = 0;
          indentStringCounts[indentStr] += 1;
        });
        return Object.keys(indentStringCounts).sort((a, b) => {
          return indentStringCounts[a] - indentStringCounts[b];
        })[0] || "	";
      }
      indent(indentStr) {
        if (!arguments.length) {
          indentStr = this.getIndentString();
        }
        if (indentStr === "") return this;
        let trailingNewline = !this.intro || this.intro.slice(-1) === "\n";
        this.sources.forEach((source, i) => {
          const separator = source.separator !== void 0 ? source.separator : this.separator;
          const indentStart = trailingNewline || i > 0 && /\r?\n$/.test(separator);
          source.content.indent(indentStr, {
            exclude: source.indentExclusionRanges,
            indentStart
            //: trailingNewline || /\r?\n$/.test( separator )  //true///\r?\n/.test( separator )
          });
          trailingNewline = source.content.lastChar() === "\n";
        });
        if (this.intro) {
          this.intro = indentStr + this.intro.replace(/^[^\n]/gm, (match, index) => {
            return index > 0 ? indentStr + match : match;
          });
        }
        return this;
      }
      prepend(str) {
        this.intro = str + this.intro;
        return this;
      }
      toString() {
        const body = this.sources.map((source, i) => {
          const separator = source.separator !== void 0 ? source.separator : this.separator;
          const str = (i > 0 ? separator : "") + source.content.toString();
          return str;
        }).join("");
        return this.intro + body;
      }
      isEmpty() {
        if (this.intro.length && this.intro.trim()) return false;
        if (this.sources.some((source) => !source.content.isEmpty())) return false;
        return true;
      }
      length() {
        return this.sources.reduce(
          (length, source) => length + source.content.length(),
          this.intro.length
        );
      }
      trimLines() {
        return this.trim("[\\r\\n]");
      }
      trim(charType) {
        return this.trimStart(charType).trimEnd(charType);
      }
      trimStart(charType) {
        const rx = new RegExp("^" + (charType || "\\s") + "+");
        this.intro = this.intro.replace(rx, "");
        if (!this.intro) {
          let source;
          let i = 0;
          do {
            source = this.sources[i++];
            if (!source) {
              break;
            }
          } while (!source.content.trimStartAborted(charType));
        }
        return this;
      }
      trimEnd(charType) {
        const rx = new RegExp((charType || "\\s") + "+$");
        let source;
        let i = this.sources.length - 1;
        do {
          source = this.sources[i--];
          if (!source) {
            this.intro = this.intro.replace(rx, "");
            break;
          }
        } while (!source.content.trimEndAborted(charType));
        return this;
      }
    };
    MagicString.Bundle = Bundle;
    MagicString.SourceMap = SourceMap;
    MagicString.default = MagicString;
    module.exports = MagicString;
  }
});

// node_modules/.pnpm/rollup-plugin-dts@6.1.1_rollup@4.34.8_typescript@5.7.3/node_modules/rollup-plugin-dts/dist/rollup-plugin-dts.cjs
var require_rollup_plugin_dts = _chunkTWFEYLU4js.__commonJS.call(void 0, {
  "node_modules/.pnpm/rollup-plugin-dts@6.1.1_rollup@4.34.8_typescript@5.7.3/node_modules/rollup-plugin-dts/dist/rollup-plugin-dts.cjs"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var path3 = _chunkTWFEYLU4js.__require.call(void 0, "path");
    var ts2 = _chunkTWFEYLU4js.__require.call(void 0, "typescript");
    require_lib2();
    var module$1 = _chunkTWFEYLU4js.__require.call(void 0, "module");
    var MagicString = require_magic_string_cjs();
    var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
    function _interopNamespaceDefault(e) {
      var n = /* @__PURE__ */ Object.create(null);
      if (e) {
        Object.keys(e).forEach(function(k) {
          if (k !== "default") {
            var d = Object.getOwnPropertyDescriptor(e, k);
            Object.defineProperty(n, k, d.get ? d : {
              enumerable: true,
              get: function() {
                return e[k];
              }
            });
          }
        });
      }
      n.default = e;
      return Object.freeze(n);
    }
    var path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path3);
    function resolveDefaultOptions(options) {
      return {
        ...options,
        compilerOptions: _nullishCoalesce(options.compilerOptions, () => ( {})),
        respectExternal: _nullishCoalesce(options.respectExternal, () => ( false))
      };
    }
    var DTS_EXTENSIONS = /\.d\.(c|m)?tsx?$/;
    var dts = ".d.ts";
    var formatHost = {
      getCurrentDirectory: () => ts2.sys.getCurrentDirectory(),
      getNewLine: () => ts2.sys.newLine,
      getCanonicalFileName: ts2.sys.useCaseSensitiveFileNames ? (f) => f : (f) => f.toLowerCase()
    };
    var DEFAULT_OPTIONS = {
      // Ensure ".d.ts" modules are generated
      declaration: true,
      // Skip ".js" generation
      noEmit: false,
      emitDeclarationOnly: true,
      // Skip code generation when error occurs
      noEmitOnError: true,
      // Avoid extra work
      checkJs: false,
      declarationMap: false,
      skipLibCheck: true,
      // Ensure TS2742 errors are visible
      preserveSymlinks: true,
      // Ensure we can parse the latest code
      target: ts2.ScriptTarget.ESNext
    };
    var configByPath = /* @__PURE__ */ new Map();
    var logCache = (...args) => process.env.DTS_LOG_CACHE ? console.log("[cache]", ...args) : null;
    function cacheConfig([fromPath, toPath], config) {
      logCache(fromPath);
      configByPath.set(fromPath, config);
      while (fromPath !== toPath && // make sure we're not stuck in an infinite loop
      fromPath !== path__namespace.dirname(fromPath)) {
        fromPath = path__namespace.dirname(fromPath);
        logCache("up", fromPath);
        if (configByPath.has(fromPath))
          return logCache("has", fromPath);
        configByPath.set(fromPath, config);
      }
    }
    function getCompilerOptions(input, overrideOptions, overrideConfigPath) {
      const compilerOptions = { ...DEFAULT_OPTIONS, ...overrideOptions };
      let dirName = path__namespace.dirname(input);
      let dtsFiles = [];
      const cacheKey = overrideConfigPath || dirName;
      if (!configByPath.has(cacheKey)) {
        logCache("miss", cacheKey);
        const configPath = overrideConfigPath ? path__namespace.resolve(process.cwd(), overrideConfigPath) : ts2.findConfigFile(dirName, ts2.sys.fileExists);
        if (!configPath) {
          return { dtsFiles, dirName, compilerOptions };
        }
        let inputDirName = dirName;
        dirName = path__namespace.dirname(configPath);
        const { config, error } = ts2.readConfigFile(configPath, ts2.sys.readFile);
        if (error) {
          console.error(ts2.formatDiagnostic(error, formatHost));
          return { dtsFiles, dirName, compilerOptions };
        }
        logCache("tsconfig", config);
        const configContents = ts2.parseJsonConfigFileContent(config, ts2.sys, dirName);
        if (overrideConfigPath) {
          cacheConfig([overrideConfigPath, overrideConfigPath], configContents);
        } else {
          cacheConfig([inputDirName, dirName], configContents);
        }
      } else {
        logCache("HIT", cacheKey);
      }
      const { fileNames, options, errors } = configByPath.get(cacheKey);
      dtsFiles = fileNames.filter((name) => DTS_EXTENSIONS.test(name));
      if (errors.length) {
        console.error(ts2.formatDiagnostics(errors, formatHost));
        return { dtsFiles, dirName, compilerOptions };
      }
      return {
        dtsFiles,
        dirName,
        compilerOptions: {
          ...options,
          ...compilerOptions
        }
      };
    }
    function createProgram$1(fileName, overrideOptions, tsconfig) {
      const { dtsFiles, compilerOptions } = getCompilerOptions(fileName, overrideOptions, tsconfig);
      return ts2.createProgram([fileName].concat(Array.from(dtsFiles)), compilerOptions, ts2.createCompilerHost(compilerOptions, true));
    }
    function createPrograms(input, overrideOptions, tsconfig) {
      const programs = [];
      let inputs = [];
      let dtsFiles = /* @__PURE__ */ new Set();
      let dirName = "";
      let compilerOptions = {};
      for (let main of input) {
        if (DTS_EXTENSIONS.test(main)) {
          continue;
        }
        main = path__namespace.resolve(main);
        const options = getCompilerOptions(main, overrideOptions, tsconfig);
        options.dtsFiles.forEach(dtsFiles.add, dtsFiles);
        if (!inputs.length) {
          inputs.push(main);
          ({ dirName, compilerOptions } = options);
          continue;
        }
        if (options.dirName === dirName) {
          inputs.push(main);
        } else {
          const host = ts2.createCompilerHost(compilerOptions, true);
          const program = ts2.createProgram(inputs.concat(Array.from(dtsFiles)), compilerOptions, host);
          programs.push(program);
          inputs = [main];
          ({ dirName, compilerOptions } = options);
        }
      }
      if (inputs.length) {
        const host = ts2.createCompilerHost(compilerOptions, true);
        const program = ts2.createProgram(inputs.concat(Array.from(dtsFiles)), compilerOptions, host);
        programs.push(program);
      }
      return programs;
    }
    function getCodeFrame() {
      let codeFrameColumns = void 0;
      try {
        ({ codeFrameColumns } = require_lib2());
        return codeFrameColumns;
      } catch (e2) {
        try {
          const esmRequire = module$1.createRequire(typeof document === "undefined" ? _chunkTWFEYLU4js.__require.call(void 0, "url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.src || new URL("rollup-plugin-dts.cjs", document.baseURI).href);
          ({ codeFrameColumns } = esmRequire("@babel/code-frame"));
          return codeFrameColumns;
        } catch (e3) {
        }
      }
      return void 0;
    }
    function getLocation(node) {
      const sourceFile = node.getSourceFile();
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      return {
        start: { line: start.line + 1, column: start.character + 1 },
        end: { line: end.line + 1, column: end.character + 1 }
      };
    }
    function frameNode(node) {
      const codeFrame = getCodeFrame();
      const sourceFile = node.getSourceFile();
      const code = sourceFile.getFullText();
      const location = getLocation(node);
      if (codeFrame) {
        return "\n" + codeFrame(code, location, {
          highlightCode: true
        });
      } else {
        return `
${location.start.line}:${location.start.column}: \`${node.getFullText().trim()}\``;
      }
    }
    var UnsupportedSyntaxError = class extends Error {
      constructor(node, message = "Syntax not yet supported") {
        super(`${message}
${frameNode(node)}`);
      }
    };
    var NamespaceFixer = class {
      constructor(sourceFile) {
        this.sourceFile = sourceFile;
      }
      findNamespaces() {
        const namespaces = [];
        const items = {};
        for (const node of this.sourceFile.statements) {
          const location = {
            start: node.getStart(),
            end: node.getEnd()
          };
          if (ts2.isEmptyStatement(node)) {
            namespaces.unshift({
              name: "",
              exports: [],
              location
            });
            continue;
          }
          if ((ts2.isImportDeclaration(node) || ts2.isExportDeclaration(node)) && node.moduleSpecifier && ts2.isStringLiteral(node.moduleSpecifier)) {
            let { text } = node.moduleSpecifier;
            if (text.startsWith(".") && (text.endsWith(".d.ts") || text.endsWith(".d.cts") || text.endsWith(".d.mts"))) {
              let start = node.moduleSpecifier.getStart() + 1;
              let end = node.moduleSpecifier.getEnd() - 1;
              namespaces.unshift({
                name: "",
                exports: [],
                location: {
                  start,
                  end
                },
                textBeforeCodeAfter: text.replace(/\.d\.ts$/, ".js").replace(/\.d\.cts$/, ".cjs").replace(/\.d\.mts$/, ".mjs")
              });
            }
          }
          if (ts2.isModuleDeclaration(node) && node.body && ts2.isModuleBlock(node.body)) {
            for (const stmt of node.body.statements) {
              if (ts2.isExportDeclaration(stmt) && stmt.exportClause) {
                if (ts2.isNamespaceExport(stmt.exportClause)) {
                  continue;
                }
                for (const decl2 of stmt.exportClause.elements) {
                  if (decl2.propertyName && decl2.propertyName.getText() == decl2.name.getText()) {
                    namespaces.unshift({
                      name: "",
                      exports: [],
                      location: {
                        start: decl2.propertyName.getEnd(),
                        end: decl2.name.getEnd()
                      }
                    });
                  }
                }
              }
            }
          }
          if (ts2.isClassDeclaration(node)) {
            items[node.name.getText()] = { type: "class", generics: node.typeParameters };
          } else if (ts2.isFunctionDeclaration(node)) {
            items[node.name.getText()] = { type: "function" };
          } else if (ts2.isInterfaceDeclaration(node)) {
            items[node.name.getText()] = { type: "interface", generics: node.typeParameters };
          } else if (ts2.isTypeAliasDeclaration(node)) {
            items[node.name.getText()] = { type: "type", generics: node.typeParameters };
          } else if (ts2.isModuleDeclaration(node) && ts2.isIdentifier(node.name)) {
            items[node.name.getText()] = { type: "namespace" };
          } else if (ts2.isEnumDeclaration(node)) {
            items[node.name.getText()] = { type: "enum" };
          }
          if (!ts2.isVariableStatement(node)) {
            continue;
          }
          const { declarations } = node.declarationList;
          if (declarations.length !== 1) {
            continue;
          }
          const decl = declarations[0];
          const name = decl.name.getText();
          if (!decl.initializer || !ts2.isCallExpression(decl.initializer)) {
            items[name] = { type: "var" };
            continue;
          }
          const obj = decl.initializer.arguments[0];
          if (!decl.initializer.expression.getFullText().includes("/*#__PURE__*/Object.freeze") || !ts2.isObjectLiteralExpression(obj)) {
            continue;
          }
          const exports2 = [];
          for (const prop of obj.properties) {
            if (!ts2.isPropertyAssignment(prop) || !(ts2.isIdentifier(prop.name) || ts2.isStringLiteral(prop.name)) || prop.name.text !== "__proto__" && !ts2.isIdentifier(prop.initializer)) {
              throw new UnsupportedSyntaxError(prop, "Expected a property assignment");
            }
            if (prop.name.text === "__proto__") {
              continue;
            }
            exports2.push({
              exportedName: prop.name.text,
              localName: prop.initializer.getText()
            });
          }
          namespaces.unshift({
            name,
            exports: exports2,
            location
          });
        }
        return { namespaces, itemTypes: items };
      }
      fix() {
        let code = this.sourceFile.getFullText();
        const { namespaces, itemTypes } = this.findNamespaces();
        for (const ns of namespaces) {
          const codeAfter = code.slice(ns.location.end);
          code = code.slice(0, ns.location.start);
          for (const { exportedName, localName } of ns.exports) {
            if (exportedName === localName) {
              const { type, generics } = itemTypes[localName] || {};
              if (type === "interface" || type === "type") {
                const typeParams = renderTypeParams(generics);
                code += `type ${ns.name}_${exportedName}${typeParams.in} = ${localName}${typeParams.out};
`;
              } else if (type === "enum" || type === "class") {
                const typeParams = renderTypeParams(generics);
                code += `type ${ns.name}_${exportedName}${typeParams.in} = ${localName}${typeParams.out};
`;
                code += `declare const ${ns.name}_${exportedName}: typeof ${localName};
`;
              } else {
                code += `declare const ${ns.name}_${exportedName}: typeof ${localName};
`;
              }
            }
          }
          if (ns.name) {
            code += `declare namespace ${ns.name} {
`;
            code += `  export {
`;
            for (const { exportedName, localName } of ns.exports) {
              if (exportedName === localName) {
                code += `    ${ns.name}_${exportedName} as ${exportedName},
`;
              } else {
                code += `    ${localName} as ${exportedName},
`;
              }
            }
            code += `  };
`;
            code += `}`;
          }
          code += _nullishCoalesce(ns.textBeforeCodeAfter, () => ( ""));
          code += codeAfter;
        }
        return code;
      }
    };
    function renderTypeParams(typeParameters) {
      if (!typeParameters || !typeParameters.length) {
        return { in: "", out: "" };
      }
      return {
        in: `<${typeParameters.map((param) => param.getText()).join(", ")}>`,
        out: `<${typeParameters.map((param) => param.name.getText()).join(", ")}>`
      };
    }
    var IDs = 1;
    function createProgram(node) {
      return withStartEnd({
        type: "Program",
        sourceType: "module",
        body: []
      }, { start: node.getFullStart(), end: node.getEnd() });
    }
    function createReference(id) {
      const ident = {
        type: "Identifier",
        name: String(IDs++)
      };
      return {
        ident,
        expr: {
          type: "AssignmentPattern",
          left: ident,
          right: id
        }
      };
    }
    function createIdentifier(node) {
      return withStartEnd({
        type: "Identifier",
        name: node.getText()
      }, node);
    }
    function createIIFE(range) {
      const fn = withStartEnd({
        type: "FunctionExpression",
        id: null,
        params: [],
        body: { type: "BlockStatement", body: [] }
      }, range);
      const iife = withStartEnd({
        type: "ExpressionStatement",
        expression: {
          type: "CallExpression",
          callee: { type: "Identifier", name: String(IDs++) },
          arguments: [fn],
          optional: false
        }
      }, range);
      return { fn, iife };
    }
    function createReturn() {
      const expr = {
        type: "ArrayExpression",
        elements: []
      };
      return {
        expr,
        stmt: {
          type: "ReturnStatement",
          argument: expr
        }
      };
    }
    function createDeclaration(id, range) {
      return withStartEnd({
        type: "FunctionDeclaration",
        id: withStartEnd({
          type: "Identifier",
          name: ts2.idText(id)
        }, id),
        params: [],
        body: { type: "BlockStatement", body: [] }
      }, range);
    }
    function convertExpression(node) {
      if (ts2.isLiteralExpression(node)) {
        return { type: "Literal", value: node.text };
      }
      if (ts2.isPropertyAccessExpression(node)) {
        if (ts2.isPrivateIdentifier(node.name)) {
          throw new UnsupportedSyntaxError(node.name);
        }
        return withStartEnd({
          type: "MemberExpression",
          computed: false,
          optional: false,
          object: convertExpression(node.expression),
          property: convertExpression(node.name)
        }, {
          start: node.expression.getStart(),
          end: node.name.getEnd()
        });
      }
      if (ts2.isIdentifier(node)) {
        return createIdentifier(node);
      } else if (node.kind == ts2.SyntaxKind.NullKeyword) {
        return { type: "Literal", value: null };
      } else {
        throw new UnsupportedSyntaxError(node);
      }
    }
    function withStartEnd(esNode, nodeOrRange) {
      let range = "start" in nodeOrRange ? nodeOrRange : { start: nodeOrRange.getStart(), end: nodeOrRange.getEnd() };
      return Object.assign(esNode, range);
    }
    function matchesModifier(node, flags) {
      const nodeFlags = ts2.getCombinedModifierFlags(node);
      return (nodeFlags & flags) === flags;
    }
    function preProcess({ sourceFile }) {
      const code = new MagicString(sourceFile.getFullText());
      const declaredNames = /* @__PURE__ */ new Set();
      const exportedNames = /* @__PURE__ */ new Set();
      let defaultExport = "";
      const inlineImports = /* @__PURE__ */ new Map();
      const nameRanges = /* @__PURE__ */ new Map();
      for (const node of sourceFile.statements) {
        if (ts2.isEmptyStatement(node)) {
          code.remove(node.getStart(), node.getEnd());
          continue;
        }
        if (ts2.isEnumDeclaration(node) || ts2.isFunctionDeclaration(node) || ts2.isInterfaceDeclaration(node) || ts2.isClassDeclaration(node) || ts2.isTypeAliasDeclaration(node) || ts2.isModuleDeclaration(node)) {
          if (node.name) {
            const name = node.name.getText();
            declaredNames.add(name);
            if (matchesModifier(node, ts2.ModifierFlags.ExportDefault)) {
              defaultExport = name;
            } else if (matchesModifier(node, ts2.ModifierFlags.Export)) {
              exportedNames.add(name);
            }
            if (!(node.flags & ts2.NodeFlags.GlobalAugmentation)) {
              pushNamedNode(name, [getStart(node), getEnd(node)]);
            }
          }
          if (ts2.isModuleDeclaration(node)) {
            duplicateExports(code, node);
          }
          fixModifiers(code, node);
        } else if (ts2.isVariableStatement(node)) {
          const { declarations } = node.declarationList;
          const isExport = matchesModifier(node, ts2.ModifierFlags.Export);
          for (const decl of node.declarationList.declarations) {
            if (ts2.isIdentifier(decl.name)) {
              const name = decl.name.getText();
              declaredNames.add(name);
              if (isExport) {
                exportedNames.add(name);
              }
            }
          }
          fixModifiers(code, node);
          if (declarations.length == 1) {
            const decl = declarations[0];
            if (ts2.isIdentifier(decl.name)) {
              pushNamedNode(decl.name.getText(), [getStart(node), getEnd(node)]);
            }
          } else {
            const decls = declarations.slice();
            const first = decls.shift();
            pushNamedNode(first.name.getText(), [getStart(node), first.getEnd()]);
            for (const decl of decls) {
              if (ts2.isIdentifier(decl.name)) {
                pushNamedNode(decl.name.getText(), [decl.getFullStart(), decl.getEnd()]);
              }
            }
          }
          const { flags } = node.declarationList;
          const type = flags & ts2.NodeFlags.Let ? "let" : flags & ts2.NodeFlags.Const ? "const" : "var";
          const prefix = `declare ${type} `;
          const list = node.declarationList.getChildren().find((c) => c.kind === ts2.SyntaxKind.SyntaxList).getChildren();
          let commaPos = 0;
          for (const node2 of list) {
            if (node2.kind === ts2.SyntaxKind.CommaToken) {
              commaPos = node2.getStart();
              code.remove(commaPos, node2.getEnd());
            } else if (commaPos) {
              code.appendLeft(commaPos, ";\n");
              const start = node2.getFullStart();
              const slice = code.slice(start, node2.getStart());
              let whitespace = slice.length - slice.trimStart().length;
              if (whitespace) {
                code.overwrite(start, start + whitespace, prefix);
              } else {
                code.appendLeft(start, prefix);
              }
            }
          }
        }
      }
      for (const node of sourceFile.statements) {
        checkInlineImport(node);
        if (!matchesModifier(node, ts2.ModifierFlags.ExportDefault)) {
          continue;
        }
        if (ts2.isFunctionDeclaration(node) || ts2.isClassDeclaration(node)) {
          if (node.name) {
            continue;
          }
          if (!defaultExport) {
            defaultExport = uniqName("export_default");
          }
          const children = node.getChildren();
          const idx = children.findIndex((node2) => node2.kind === ts2.SyntaxKind.ClassKeyword || node2.kind === ts2.SyntaxKind.FunctionKeyword);
          const token = children[idx];
          const nextToken = children[idx + 1];
          const isPunctuation = nextToken.kind >= ts2.SyntaxKind.FirstPunctuation && nextToken.kind <= ts2.SyntaxKind.LastPunctuation;
          if (isPunctuation) {
            const addSpace = code.slice(token.getEnd(), nextToken.getStart()) != " ";
            code.appendLeft(nextToken.getStart(), `${addSpace ? " " : ""}${defaultExport}`);
          } else {
            code.appendRight(token.getEnd(), ` ${defaultExport}`);
          }
        }
      }
      for (const ranges of nameRanges.values()) {
        const last = ranges.pop();
        const start = last[0];
        for (const node of ranges) {
          code.move(node[0], node[1], start);
        }
      }
      if (defaultExport) {
        code.append(`
export default ${defaultExport};
`);
      }
      if (exportedNames.size) {
        code.append(`
export { ${[...exportedNames].join(", ")} };
`);
      }
      for (const [fileId, importName] of inlineImports.entries()) {
        code.prepend(`import * as ${importName} from "${fileId}";
`);
      }
      const lineStarts = sourceFile.getLineStarts();
      const typeReferences = /* @__PURE__ */ new Set();
      for (const ref of sourceFile.typeReferenceDirectives) {
        typeReferences.add(ref.fileName);
        const { line } = sourceFile.getLineAndCharacterOfPosition(ref.pos);
        const start = lineStarts[line];
        let end = sourceFile.getLineEndOfPosition(ref.pos);
        if (code.slice(end, end + 1) == "\n") {
          end += 1;
        }
        code.remove(start, end);
      }
      const fileReferences = /* @__PURE__ */ new Set();
      for (const ref of sourceFile.referencedFiles) {
        fileReferences.add(ref.fileName);
        const { line } = sourceFile.getLineAndCharacterOfPosition(ref.pos);
        const start = lineStarts[line];
        let end = sourceFile.getLineEndOfPosition(ref.pos);
        if (code.slice(end, end + 1) == "\n") {
          end += 1;
        }
        code.remove(start, end);
      }
      return {
        code,
        typeReferences,
        fileReferences
      };
      function checkInlineImport(node) {
        ts2.forEachChild(node, checkInlineImport);
        if (ts2.isImportTypeNode(node)) {
          if (!ts2.isLiteralTypeNode(node.argument) || !ts2.isStringLiteral(node.argument.literal)) {
            throw new UnsupportedSyntaxError(node, "inline imports should have a literal argument");
          }
          const fileId = node.argument.literal.text;
          const children = node.getChildren();
          const start = children.find((t) => t.kind === ts2.SyntaxKind.ImportKeyword).getStart();
          let end = node.getEnd();
          const token = children.find((t) => t.kind === ts2.SyntaxKind.DotToken || t.kind === ts2.SyntaxKind.LessThanToken);
          if (token) {
            end = token.getStart();
          }
          const importName = createNamespaceImport(fileId);
          code.overwrite(start, end, importName);
        }
      }
      function createNamespaceImport(fileId) {
        let importName = inlineImports.get(fileId);
        if (!importName) {
          importName = uniqName(fileId.replace(/[^a-zA-Z0-9_$]/g, () => "_"));
          inlineImports.set(fileId, importName);
        }
        return importName;
      }
      function uniqName(hint) {
        let name = hint;
        while (declaredNames.has(name)) {
          name = `_${name}`;
        }
        declaredNames.add(name);
        return name;
      }
      function pushNamedNode(name, range) {
        let nodes = nameRanges.get(name);
        if (!nodes) {
          nodes = [range];
          nameRanges.set(name, nodes);
        } else {
          const last = nodes[nodes.length - 1];
          if (last[1] === range[0]) {
            last[1] = range[1];
          } else {
            nodes.push(range);
          }
        }
      }
    }
    function fixModifiers(code, node) {
      if (!ts2.canHaveModifiers(node)) {
        return;
      }
      let hasDeclare = false;
      const needsDeclare = ts2.isEnumDeclaration(node) || ts2.isClassDeclaration(node) || ts2.isFunctionDeclaration(node) || ts2.isModuleDeclaration(node) || ts2.isVariableStatement(node);
      for (const mod of _nullishCoalesce(node.modifiers, () => ( []))) {
        switch (mod.kind) {
          case ts2.SyntaxKind.ExportKeyword:
          // fall through
          case ts2.SyntaxKind.DefaultKeyword:
            code.remove(mod.getStart(), mod.getEnd() + 1);
            break;
          case ts2.SyntaxKind.DeclareKeyword:
            hasDeclare = true;
        }
      }
      if (needsDeclare && !hasDeclare) {
        code.appendRight(node.getStart(), "declare ");
      }
    }
    function duplicateExports(code, module2) {
      if (!module2.body || !ts2.isModuleBlock(module2.body)) {
        return;
      }
      for (const node of module2.body.statements) {
        if (ts2.isExportDeclaration(node) && node.exportClause) {
          if (ts2.isNamespaceExport(node.exportClause)) {
            continue;
          }
          for (const decl of node.exportClause.elements) {
            if (!decl.propertyName) {
              code.appendLeft(decl.name.getEnd(), ` as ${decl.name.getText()}`);
            }
          }
        }
      }
    }
    function getStart(node) {
      const start = node.getFullStart();
      return start + (newlineAt(node, start) ? 1 : 0);
    }
    function getEnd(node) {
      const end = node.getEnd();
      return end + (newlineAt(node, end) ? 1 : 0);
    }
    function newlineAt(node, idx) {
      return node.getSourceFile().getFullText()[idx] == "\n";
    }
    var IGNORE_TYPENODES = /* @__PURE__ */ new Set([
      ts2.SyntaxKind.LiteralType,
      ts2.SyntaxKind.VoidKeyword,
      ts2.SyntaxKind.UnknownKeyword,
      ts2.SyntaxKind.AnyKeyword,
      ts2.SyntaxKind.BooleanKeyword,
      ts2.SyntaxKind.NumberKeyword,
      ts2.SyntaxKind.StringKeyword,
      ts2.SyntaxKind.ObjectKeyword,
      ts2.SyntaxKind.NullKeyword,
      ts2.SyntaxKind.UndefinedKeyword,
      ts2.SyntaxKind.SymbolKeyword,
      ts2.SyntaxKind.NeverKeyword,
      ts2.SyntaxKind.ThisKeyword,
      ts2.SyntaxKind.ThisType,
      ts2.SyntaxKind.BigIntKeyword
    ]);
    var DeclarationScope = class {
      constructor({ id, range }) {
        this.scopes = [];
        if (id) {
          this.declaration = createDeclaration(id, range);
        } else {
          const { iife, fn } = createIIFE(range);
          this.iife = iife;
          this.declaration = fn;
        }
        const ret = createReturn();
        this.declaration.body.body.push(ret.stmt);
        this.returnExpr = ret.expr;
      }
      pushScope() {
        this.scopes.push(/* @__PURE__ */ new Set());
      }
      popScope(n = 1) {
        for (let i = 0; i < n; i++) {
          this.scopes.pop();
        }
      }
      pushTypeVariable(id) {
        const name = id.getText();
        _optionalChain([this, 'access', _2 => _2.scopes, 'access', _3 => _3[this.scopes.length - 1], 'optionalAccess', _4 => _4.add, 'call', _5 => _5(name)]);
      }
      pushReference(id) {
        let name;
        if (id.type === "Identifier") {
          name = id.name;
        } else if (id.type === "MemberExpression") {
          if (id.object.type === "Identifier") {
            name = id.object.name;
          }
        }
        if (name) {
          for (const scope of this.scopes) {
            if (scope.has(name)) {
              return;
            }
          }
        }
        if (name === "this")
          return;
        const { ident, expr } = createReference(id);
        this.declaration.params.push(expr);
        this.returnExpr.elements.push(ident);
      }
      pushIdentifierReference(id) {
        this.pushReference(createIdentifier(id));
      }
      convertEntityName(node) {
        if (ts2.isIdentifier(node)) {
          return createIdentifier(node);
        }
        return withStartEnd({
          type: "MemberExpression",
          computed: false,
          optional: false,
          object: this.convertEntityName(node.left),
          property: createIdentifier(node.right)
        }, node);
      }
      convertPropertyAccess(node) {
        if (!ts2.isIdentifier(node.expression) && !ts2.isPropertyAccessExpression(node.expression)) {
          throw new UnsupportedSyntaxError(node.expression);
        }
        if (ts2.isPrivateIdentifier(node.name)) {
          throw new UnsupportedSyntaxError(node.name);
        }
        let object = ts2.isIdentifier(node.expression) ? createIdentifier(node.expression) : this.convertPropertyAccess(node.expression);
        return withStartEnd({
          type: "MemberExpression",
          computed: false,
          optional: false,
          object,
          property: createIdentifier(node.name)
        }, node);
      }
      convertComputedPropertyName(node) {
        if (!node.name || !ts2.isComputedPropertyName(node.name)) {
          return;
        }
        const { expression } = node.name;
        if (ts2.isLiteralExpression(expression) || ts2.isPrefixUnaryExpression(expression)) {
          return;
        }
        if (ts2.isIdentifier(expression)) {
          return this.pushReference(createIdentifier(expression));
        }
        if (ts2.isPropertyAccessExpression(expression)) {
          return this.pushReference(this.convertPropertyAccess(expression));
        }
        throw new UnsupportedSyntaxError(expression);
      }
      convertParametersAndType(node) {
        this.convertComputedPropertyName(node);
        const typeVariables = this.convertTypeParameters(node.typeParameters);
        for (const param of node.parameters) {
          this.convertTypeNode(param.type);
        }
        this.convertTypeNode(node.type);
        this.popScope(typeVariables);
      }
      convertHeritageClauses(node) {
        for (const heritage of node.heritageClauses || []) {
          for (const type of heritage.types) {
            this.pushReference(convertExpression(type.expression));
            this.convertTypeArguments(type);
          }
        }
      }
      convertTypeArguments(node) {
        if (!node.typeArguments) {
          return;
        }
        for (const arg of node.typeArguments) {
          this.convertTypeNode(arg);
        }
      }
      convertMembers(members) {
        for (const node of members) {
          if (ts2.isPropertyDeclaration(node) || ts2.isPropertySignature(node) || ts2.isIndexSignatureDeclaration(node)) {
            if (ts2.isPropertyDeclaration(node) && node.initializer && ts2.isPropertyAccessExpression(node.initializer)) {
              this.pushReference(this.convertPropertyAccess(node.initializer));
            }
            this.convertComputedPropertyName(node);
            this.convertTypeNode(node.type);
            continue;
          }
          if (ts2.isMethodDeclaration(node) || ts2.isMethodSignature(node) || ts2.isConstructorDeclaration(node) || ts2.isConstructSignatureDeclaration(node) || ts2.isCallSignatureDeclaration(node) || ts2.isGetAccessorDeclaration(node) || ts2.isSetAccessorDeclaration(node)) {
            this.convertParametersAndType(node);
          } else {
            throw new UnsupportedSyntaxError(node);
          }
        }
      }
      convertTypeParameters(params) {
        if (!params) {
          return 0;
        }
        for (const node of params) {
          this.convertTypeNode(node.constraint);
          this.convertTypeNode(node.default);
          this.pushScope();
          this.pushTypeVariable(node.name);
        }
        return params.length;
      }
      convertTypeNode(node) {
        if (!node) {
          return;
        }
        if (IGNORE_TYPENODES.has(node.kind)) {
          return;
        }
        if (ts2.isTypeReferenceNode(node)) {
          this.pushReference(this.convertEntityName(node.typeName));
          this.convertTypeArguments(node);
          return;
        }
        if (ts2.isTypeLiteralNode(node)) {
          return this.convertMembers(node.members);
        }
        if (ts2.isArrayTypeNode(node)) {
          return this.convertTypeNode(node.elementType);
        }
        if (ts2.isTupleTypeNode(node)) {
          for (const type of node.elements) {
            this.convertTypeNode(type);
          }
          return;
        }
        if (ts2.isNamedTupleMember(node) || ts2.isParenthesizedTypeNode(node) || ts2.isTypeOperatorNode(node) || ts2.isTypePredicateNode(node)) {
          return this.convertTypeNode(node.type);
        }
        if (ts2.isUnionTypeNode(node) || ts2.isIntersectionTypeNode(node)) {
          for (const type of node.types) {
            this.convertTypeNode(type);
          }
          return;
        }
        if (ts2.isMappedTypeNode(node)) {
          const { typeParameter, type, nameType } = node;
          this.convertTypeNode(typeParameter.constraint);
          this.pushScope();
          this.pushTypeVariable(typeParameter.name);
          this.convertTypeNode(type);
          if (nameType) {
            this.convertTypeNode(nameType);
          }
          this.popScope();
          return;
        }
        if (ts2.isConditionalTypeNode(node)) {
          this.convertTypeNode(node.checkType);
          this.pushScope();
          this.convertTypeNode(node.extendsType);
          this.convertTypeNode(node.trueType);
          this.convertTypeNode(node.falseType);
          this.popScope();
          return;
        }
        if (ts2.isIndexedAccessTypeNode(node)) {
          this.convertTypeNode(node.objectType);
          this.convertTypeNode(node.indexType);
          return;
        }
        if (ts2.isFunctionOrConstructorTypeNode(node)) {
          this.convertParametersAndType(node);
          return;
        }
        if (ts2.isTypeQueryNode(node)) {
          this.pushReference(this.convertEntityName(node.exprName));
          return;
        }
        if (ts2.isRestTypeNode(node)) {
          this.convertTypeNode(node.type);
          return;
        }
        if (ts2.isOptionalTypeNode(node)) {
          this.convertTypeNode(node.type);
          return;
        }
        if (ts2.isTemplateLiteralTypeNode(node)) {
          for (const span of node.templateSpans) {
            this.convertTypeNode(span.type);
          }
          return;
        }
        if (ts2.isInferTypeNode(node)) {
          const { typeParameter } = node;
          this.convertTypeNode(typeParameter.constraint);
          this.pushTypeVariable(typeParameter.name);
          return;
        } else {
          throw new UnsupportedSyntaxError(node);
        }
      }
      convertNamespace(node, relaxedModuleBlock = false) {
        this.pushScope();
        if (relaxedModuleBlock && node.body && ts2.isModuleDeclaration(node.body)) {
          this.convertNamespace(node.body, true);
          return;
        }
        if (!node.body || !ts2.isModuleBlock(node.body)) {
          throw new UnsupportedSyntaxError(node, `namespace must have a "ModuleBlock" body.`);
        }
        const { statements } = node.body;
        for (const stmt of statements) {
          if (ts2.isEnumDeclaration(stmt) || ts2.isFunctionDeclaration(stmt) || ts2.isClassDeclaration(stmt) || ts2.isInterfaceDeclaration(stmt) || ts2.isTypeAliasDeclaration(stmt) || ts2.isModuleDeclaration(stmt)) {
            if (stmt.name && ts2.isIdentifier(stmt.name)) {
              this.pushTypeVariable(stmt.name);
            } else {
              throw new UnsupportedSyntaxError(stmt, `non-Identifier name not supported`);
            }
            continue;
          }
          if (ts2.isVariableStatement(stmt)) {
            for (const decl of stmt.declarationList.declarations) {
              if (ts2.isIdentifier(decl.name)) {
                this.pushTypeVariable(decl.name);
              } else {
                throw new UnsupportedSyntaxError(decl, `non-Identifier name not supported`);
              }
            }
            continue;
          }
          if (ts2.isExportDeclaration(stmt)) ;
          else {
            throw new UnsupportedSyntaxError(stmt, `namespace child (hoisting) not supported yet`);
          }
        }
        for (const stmt of statements) {
          if (ts2.isVariableStatement(stmt)) {
            for (const decl of stmt.declarationList.declarations) {
              if (decl.type) {
                this.convertTypeNode(decl.type);
              }
            }
            continue;
          }
          if (ts2.isFunctionDeclaration(stmt)) {
            this.convertParametersAndType(stmt);
            continue;
          }
          if (ts2.isInterfaceDeclaration(stmt) || ts2.isClassDeclaration(stmt)) {
            const typeVariables = this.convertTypeParameters(stmt.typeParameters);
            this.convertHeritageClauses(stmt);
            this.convertMembers(stmt.members);
            this.popScope(typeVariables);
            continue;
          }
          if (ts2.isTypeAliasDeclaration(stmt)) {
            const typeVariables = this.convertTypeParameters(stmt.typeParameters);
            this.convertTypeNode(stmt.type);
            this.popScope(typeVariables);
            continue;
          }
          if (ts2.isModuleDeclaration(stmt)) {
            this.convertNamespace(stmt, relaxedModuleBlock);
            continue;
          }
          if (ts2.isEnumDeclaration(stmt)) {
            continue;
          }
          if (ts2.isExportDeclaration(stmt)) {
            if (stmt.exportClause) {
              if (ts2.isNamespaceExport(stmt.exportClause)) {
                throw new UnsupportedSyntaxError(stmt.exportClause);
              }
              for (const decl of stmt.exportClause.elements) {
                const id = decl.propertyName || decl.name;
                this.pushIdentifierReference(id);
              }
            }
          } else {
            throw new UnsupportedSyntaxError(stmt, `namespace child (walking) not supported yet`);
          }
        }
        this.popScope();
      }
    };
    function convert({ sourceFile }) {
      const transformer = new Transformer(sourceFile);
      return transformer.transform();
    }
    var Transformer = class {
      constructor(sourceFile) {
        this.sourceFile = sourceFile;
        this.declarations = /* @__PURE__ */ new Map();
        this.ast = createProgram(sourceFile);
        for (const stmt of sourceFile.statements) {
          this.convertStatement(stmt);
        }
      }
      transform() {
        return {
          ast: this.ast
        };
      }
      pushStatement(node) {
        this.ast.body.push(node);
      }
      createDeclaration(node, id) {
        const range = { start: node.getFullStart(), end: node.getEnd() };
        if (!id) {
          const scope2 = new DeclarationScope({ range });
          this.pushStatement(scope2.iife);
          return scope2;
        }
        const name = id.getText();
        const scope = new DeclarationScope({ id, range });
        const existingScope = this.declarations.get(name);
        if (existingScope) {
          existingScope.pushIdentifierReference(id);
          existingScope.declaration.end = range.end;
          let selfIdx = this.ast.body.findIndex((node2) => node2 == existingScope.declaration);
          for (let i = selfIdx + 1; i < this.ast.body.length; i++) {
            const decl = this.ast.body[i];
            decl.start = decl.end = range.end;
          }
        } else {
          this.pushStatement(scope.declaration);
          this.declarations.set(name, scope);
        }
        return existingScope || scope;
      }
      convertStatement(node) {
        if (ts2.isEnumDeclaration(node)) {
          return this.convertEnumDeclaration(node);
        }
        if (ts2.isFunctionDeclaration(node)) {
          return this.convertFunctionDeclaration(node);
        }
        if (ts2.isInterfaceDeclaration(node) || ts2.isClassDeclaration(node)) {
          return this.convertClassOrInterfaceDeclaration(node);
        }
        if (ts2.isTypeAliasDeclaration(node)) {
          return this.convertTypeAliasDeclaration(node);
        }
        if (ts2.isVariableStatement(node)) {
          return this.convertVariableStatement(node);
        }
        if (ts2.isExportDeclaration(node) || ts2.isExportAssignment(node)) {
          return this.convertExportDeclaration(node);
        }
        if (ts2.isModuleDeclaration(node)) {
          return this.convertNamespaceDeclaration(node);
        }
        if (node.kind == ts2.SyntaxKind.NamespaceExportDeclaration) {
          return this.removeStatement(node);
        }
        if (ts2.isImportDeclaration(node) || ts2.isImportEqualsDeclaration(node)) {
          return this.convertImportDeclaration(node);
        } else {
          throw new UnsupportedSyntaxError(node);
        }
      }
      removeStatement(node) {
        this.pushStatement(withStartEnd({
          type: "ExpressionStatement",
          expression: { type: "Literal", value: "pls remove me" }
        }, node));
      }
      convertNamespaceDeclaration(node) {
        const isGlobalAugmentation = node.flags & ts2.NodeFlags.GlobalAugmentation;
        if (isGlobalAugmentation || !ts2.isIdentifier(node.name)) {
          const scope2 = this.createDeclaration(node);
          scope2.convertNamespace(node, true);
          return;
        }
        const scope = this.createDeclaration(node, node.name);
        scope.pushIdentifierReference(node.name);
        scope.convertNamespace(node);
      }
      convertEnumDeclaration(node) {
        const scope = this.createDeclaration(node, node.name);
        scope.pushIdentifierReference(node.name);
      }
      convertFunctionDeclaration(node) {
        if (!node.name) {
          throw new UnsupportedSyntaxError(node, `FunctionDeclaration should have a name`);
        }
        const scope = this.createDeclaration(node, node.name);
        scope.pushIdentifierReference(node.name);
        scope.convertParametersAndType(node);
      }
      convertClassOrInterfaceDeclaration(node) {
        if (!node.name) {
          throw new UnsupportedSyntaxError(node, `ClassDeclaration / InterfaceDeclaration should have a name`);
        }
        const scope = this.createDeclaration(node, node.name);
        const typeVariables = scope.convertTypeParameters(node.typeParameters);
        scope.convertHeritageClauses(node);
        scope.convertMembers(node.members);
        scope.popScope(typeVariables);
      }
      convertTypeAliasDeclaration(node) {
        const scope = this.createDeclaration(node, node.name);
        const typeVariables = scope.convertTypeParameters(node.typeParameters);
        scope.convertTypeNode(node.type);
        scope.popScope(typeVariables);
      }
      convertVariableStatement(node) {
        const { declarations } = node.declarationList;
        if (declarations.length !== 1) {
          throw new UnsupportedSyntaxError(node, `VariableStatement with more than one declaration not yet supported`);
        }
        for (const decl of declarations) {
          if (!ts2.isIdentifier(decl.name)) {
            throw new UnsupportedSyntaxError(node, `VariableDeclaration must have a name`);
          }
          const scope = this.createDeclaration(node, decl.name);
          scope.convertTypeNode(decl.type);
        }
      }
      convertExportDeclaration(node) {
        if (ts2.isExportAssignment(node)) {
          this.pushStatement(withStartEnd({
            type: "ExportDefaultDeclaration",
            declaration: convertExpression(node.expression)
          }, node));
          return;
        }
        const source = node.moduleSpecifier ? convertExpression(node.moduleSpecifier) : void 0;
        if (!node.exportClause) {
          this.pushStatement(withStartEnd({
            type: "ExportAllDeclaration",
            source,
            exported: null
          }, node));
        } else if (ts2.isNamespaceExport(node.exportClause)) {
          this.pushStatement(withStartEnd({
            type: "ExportAllDeclaration",
            source,
            exported: createIdentifier(node.exportClause.name)
          }, node));
        } else {
          const specifiers = [];
          for (const elem of node.exportClause.elements) {
            specifiers.push(this.convertExportSpecifier(elem));
          }
          this.pushStatement(withStartEnd({
            type: "ExportNamedDeclaration",
            declaration: null,
            specifiers,
            source
          }, node));
        }
      }
      convertImportDeclaration(node) {
        if (ts2.isImportEqualsDeclaration(node)) {
          if (!ts2.isExternalModuleReference(node.moduleReference)) {
            throw new UnsupportedSyntaxError(node, "ImportEquals should have a literal source.");
          }
          this.pushStatement(withStartEnd({
            type: "ImportDeclaration",
            specifiers: [
              {
                type: "ImportDefaultSpecifier",
                local: createIdentifier(node.name)
              }
            ],
            source: convertExpression(node.moduleReference.expression)
          }, node));
          return;
        }
        const source = convertExpression(node.moduleSpecifier);
        const specifiers = node.importClause && node.importClause.namedBindings ? this.convertNamedImportBindings(node.importClause.namedBindings) : [];
        if (node.importClause && node.importClause.name) {
          specifiers.push({
            type: "ImportDefaultSpecifier",
            local: createIdentifier(node.importClause.name)
          });
        }
        this.pushStatement(withStartEnd({
          type: "ImportDeclaration",
          specifiers,
          source
        }, node));
      }
      convertNamedImportBindings(node) {
        if (ts2.isNamedImports(node)) {
          return node.elements.map((el) => {
            const local = createIdentifier(el.name);
            const imported = el.propertyName ? createIdentifier(el.propertyName) : local;
            return {
              type: "ImportSpecifier",
              local,
              imported
            };
          });
        }
        return [
          {
            type: "ImportNamespaceSpecifier",
            local: createIdentifier(node.name)
          }
        ];
      }
      convertExportSpecifier(node) {
        const exported = createIdentifier(node.name);
        return {
          type: "ExportSpecifier",
          exported,
          local: node.propertyName ? createIdentifier(node.propertyName) : exported
        };
      }
    };
    var ExportsFixer = class {
      constructor(source) {
        this.source = source;
        this.DEBUG = !!process.env.DTS_EXPORTS_FIXER_DEBUG;
      }
      fix() {
        const exports2 = this.findExports();
        exports2.sort((a, b) => a.location.start - b.location.start);
        return this.getCodeParts(exports2).join("");
      }
      findExports() {
        const { rawExports, values, types } = this.getExportsAndLocals();
        return rawExports.map((rawExport) => {
          const elements = rawExport.elements.map((e) => {
            const exportedName = e.name.text;
            const localName = _nullishCoalesce(_optionalChain([e, 'access', _6 => _6.propertyName, 'optionalAccess', _7 => _7.text]), () => ( e.name.text));
            const kind = types.some((node) => node.getText() === localName) && !values.some((node) => node.getText() === localName) ? "type" : "value";
            this.DEBUG && console.log(`export ${localName} as ${exportedName} is a ${kind}`);
            return {
              exportedName,
              localName,
              kind
            };
          });
          return {
            location: {
              start: rawExport.getStart(),
              end: rawExport.getEnd()
            },
            exports: elements
          };
        });
      }
      getExportsAndLocals(statements = this.source.statements) {
        const rawExports = [];
        const values = [];
        const types = [];
        const recurseInto = (subStatements) => {
          const { rawExports: subExports, values: subValues, types: subTypes } = this.getExportsAndLocals(subStatements);
          rawExports.push(...subExports);
          values.push(...subValues);
          types.push(...subTypes);
        };
        for (const statement of statements) {
          this.DEBUG && console.log(statement.getText(), statement.kind);
          if (ts2.isImportDeclaration(statement)) {
            continue;
          }
          if (ts2.isInterfaceDeclaration(statement) || ts2.isTypeAliasDeclaration(statement)) {
            this.DEBUG && console.log(`${statement.name.getFullText()} is a type`);
            types.push(statement.name);
            continue;
          }
          if (ts2.isEnumDeclaration(statement) || ts2.isFunctionDeclaration(statement) || ts2.isClassDeclaration(statement) || ts2.isVariableStatement(statement)) {
            if (ts2.isVariableStatement(statement)) {
              for (const declaration of statement.declarationList.declarations) {
                if (ts2.isIdentifier(declaration.name)) {
                  this.DEBUG && console.log(`${declaration.name.getFullText()} is a value (from var statement)`);
                  values.push(declaration.name);
                }
              }
            } else {
              if (statement.name) {
                this.DEBUG && console.log(`${statement.name.getFullText()} is a value (from declaration)`);
                values.push(statement.name);
              }
            }
            continue;
          }
          if (ts2.isModuleBlock(statement)) {
            const subStatements = statement.statements;
            recurseInto(subStatements);
            continue;
          }
          if (ts2.isModuleDeclaration(statement)) {
            if (statement.name && ts2.isIdentifier(statement.name)) {
              this.DEBUG && console.log(`${statement.name.getFullText()} is a value (from module declaration)`);
              values.push(statement.name);
            }
            recurseInto(statement.getChildren());
            continue;
          }
          if (ts2.isExportDeclaration(statement)) {
            if (statement.moduleSpecifier) {
              continue;
            }
            if (statement.isTypeOnly) {
              continue;
            }
            const exportClause = statement.exportClause;
            if (!exportClause || !ts2.isNamedExports(exportClause)) {
              continue;
            }
            rawExports.push(exportClause);
            continue;
          }
          this.DEBUG && console.log("unhandled statement", statement.getFullText(), statement.kind);
        }
        return { rawExports, values, types };
      }
      createNamedExport(exportSpec, elideType = false) {
        return `${!elideType && exportSpec.kind === "type" ? "type " : ""}${exportSpec.localName}${exportSpec.localName === exportSpec.exportedName ? "" : ` as ${exportSpec.exportedName}`}`;
      }
      getCodeParts(exports2) {
        let cursor = 0;
        const code = this.source.getFullText();
        const parts = [];
        for (const exportDeclaration of exports2) {
          const head = code.slice(cursor, exportDeclaration.location.start);
          if (head.length > 0) {
            parts.push(head);
          }
          parts.push(this.getExportStatement(exportDeclaration));
          cursor = exportDeclaration.location.end;
        }
        if (cursor < code.length) {
          parts.push(code.slice(cursor));
        }
        return parts;
      }
      getExportStatement(exportDeclaration) {
        const isTypeOnly = exportDeclaration.exports.every((e) => e.kind === "type") && exportDeclaration.exports.length > 0;
        return `${isTypeOnly ? "type " : ""}{ ${exportDeclaration.exports.map((exp) => this.createNamedExport(exp, isTypeOnly)).join(", ")} }`;
      }
    };
    function parse(fileName, code) {
      return ts2.createSourceFile(fileName, code, ts2.ScriptTarget.Latest, true);
    }
    var transform = () => {
      const allTypeReferences = /* @__PURE__ */ new Map();
      const allFileReferences = /* @__PURE__ */ new Map();
      return {
        name: "dts-transform",
        options({ onLog, ...options }) {
          return {
            ...options,
            onLog(level, log, defaultHandler) {
              if (level === "warn" && log.code == "CIRCULAR_DEPENDENCY") {
                return;
              }
              if (onLog) {
                onLog(level, log, defaultHandler);
              } else {
                defaultHandler(level, log);
              }
            },
            treeshake: {
              moduleSideEffects: "no-external",
              propertyReadSideEffects: true,
              unknownGlobalSideEffects: false
            }
          };
        },
        outputOptions(options) {
          return {
            ...options,
            chunkFileNames: options.chunkFileNames || "[name]-[hash].d.ts",
            entryFileNames: options.entryFileNames || "[name].d.ts",
            format: "es",
            exports: "named",
            compact: false,
            freeze: true,
            interop: "esModule",
            generatedCode: Object.assign({ symbols: false }, options.generatedCode),
            strict: false
          };
        },
        transform(code, fileName) {
          let sourceFile = parse(fileName, code);
          const preprocessed = preProcess({ sourceFile });
          allTypeReferences.set(sourceFile.fileName, preprocessed.typeReferences);
          allFileReferences.set(sourceFile.fileName, preprocessed.fileReferences);
          code = preprocessed.code.toString();
          sourceFile = parse(fileName, code);
          const converted = convert({ sourceFile });
          if (process.env.DTS_DUMP_AST) {
            console.log(fileName);
            console.log(code);
            console.log(JSON.stringify(converted.ast.body, void 0, 2));
          }
          return { code, ast: converted.ast, map: preprocessed.code.generateMap() };
        },
        renderChunk(inputCode, chunk, options) {
          const source = parse(chunk.fileName, inputCode);
          const fixer = new NamespaceFixer(source);
          const typeReferences = /* @__PURE__ */ new Set();
          const fileReferences = /* @__PURE__ */ new Set();
          for (const fileName of Object.keys(chunk.modules)) {
            for (const ref of allTypeReferences.get(fileName.split("\\").join("/")) || []) {
              typeReferences.add(ref);
            }
            for (const ref of allFileReferences.get(fileName.split("\\").join("/")) || []) {
              if (ref.startsWith(".")) {
                const absolutePathToOriginal = path__namespace.join(path__namespace.dirname(fileName), ref);
                const chunkFolder = options.file && path__namespace.dirname(options.file) || chunk.facadeModuleId && path__namespace.dirname(chunk.facadeModuleId) || ".";
                let targetRelPath = path__namespace.relative(chunkFolder, absolutePathToOriginal).split("\\").join("/");
                if (targetRelPath[0] !== ".") {
                  targetRelPath = "./" + targetRelPath;
                }
                fileReferences.add(targetRelPath);
              } else {
                fileReferences.add(ref);
              }
            }
          }
          let code = writeBlock(Array.from(fileReferences, (ref) => `/// <reference path="${ref}" />`));
          code += writeBlock(Array.from(typeReferences, (ref) => `/// <reference types="${ref}" />`));
          code += fixer.fix();
          if (!code) {
            code += "\nexport { }";
          }
          const exportsFixer = new ExportsFixer(parse(chunk.fileName, code));
          return { code: exportsFixer.fix(), map: { mappings: "" } };
        }
      };
    };
    function writeBlock(codes) {
      if (codes.length) {
        return codes.join("\n") + "\n";
      }
      return "";
    }
    var TS_EXTENSIONS = /\.([cm]ts|[tj]sx?)$/;
    function getModule({ programs, resolvedOptions: { compilerOptions, tsconfig } }, fileName, code) {
      if (!programs.length && DTS_EXTENSIONS.test(fileName)) {
        return { code };
      }
      const existingProgram = programs.find((p) => !!p.getSourceFile(fileName));
      if (existingProgram) {
        const source = existingProgram.getSourceFile(fileName);
        return {
          code: _optionalChain([source, 'optionalAccess', _8 => _8.getFullText, 'call', _9 => _9()]),
          source,
          program: existingProgram
        };
      } else if (ts2.sys.fileExists(fileName)) {
        const newProgram = createProgram$1(fileName, compilerOptions, tsconfig);
        programs.push(newProgram);
        const source = newProgram.getSourceFile(fileName);
        return {
          code: _optionalChain([source, 'optionalAccess', _10 => _10.getFullText, 'call', _11 => _11()]),
          source,
          program: newProgram
        };
      } else {
        return null;
      }
    }
    var plugin = (options = {}) => {
      const transformPlugin = transform();
      const ctx = { programs: [], resolvedOptions: resolveDefaultOptions(options) };
      return {
        name: "dts",
        // pass outputOptions & renderChunk hooks to the inner transform plugin
        outputOptions: transformPlugin.outputOptions,
        renderChunk: transformPlugin.renderChunk,
        options(options2) {
          let { input = [] } = options2;
          if (!Array.isArray(input)) {
            input = typeof input === "string" ? [input] : Object.values(input);
          } else if (input.length > 1) {
            options2.input = {};
            for (const filename of input) {
              let name = filename.replace(/((\.d)?\.(c|m)?(t|j)sx?)$/, "");
              if (path__namespace.isAbsolute(filename)) {
                name = path__namespace.basename(name);
              } else {
                name = path__namespace.normalize(name);
              }
              options2.input[name] = filename;
            }
          }
          ctx.programs = createPrograms(Object.values(input), ctx.resolvedOptions.compilerOptions, ctx.resolvedOptions.tsconfig);
          return transformPlugin.options.call(this, options2);
        },
        transform(code, id) {
          if (!TS_EXTENSIONS.test(id)) {
            return null;
          }
          const watchFiles = (module2) => {
            if (module2.program) {
              const sourceDirectory = path__namespace.dirname(id);
              const sourceFilesInProgram = module2.program.getSourceFiles().map((sourceFile) => sourceFile.fileName).filter((fileName) => fileName.startsWith(sourceDirectory));
              sourceFilesInProgram.forEach(this.addWatchFile);
            }
          };
          const handleDtsFile = () => {
            const module2 = getModule(ctx, id, code);
            if (module2) {
              watchFiles(module2);
              return transformPlugin.transform.call(this, module2.code, id);
            }
            return null;
          };
          const treatTsAsDts = () => {
            const declarationId = id.replace(TS_EXTENSIONS, dts);
            let module2 = getModule(ctx, declarationId, code);
            if (module2) {
              watchFiles(module2);
              return transformPlugin.transform.call(this, module2.code, declarationId);
            }
            return null;
          };
          const generateDtsFromTs = () => {
            const module2 = getModule(ctx, id, code);
            if (!module2 || !module2.source || !module2.program)
              return null;
            watchFiles(module2);
            const declarationId = id.replace(TS_EXTENSIONS, dts);
            let generated;
            const { emitSkipped, diagnostics } = module2.program.emit(
              module2.source,
              (_, declarationText) => {
                generated = transformPlugin.transform.call(this, declarationText, declarationId);
              },
              void 0,
              // cancellationToken
              true
            );
            if (emitSkipped) {
              const errors = diagnostics.filter((diag) => diag.category === ts2.DiagnosticCategory.Error);
              if (errors.length) {
                console.error(ts2.formatDiagnostics(errors, formatHost));
                this.error("Failed to compile. Check the logs above.");
              }
            }
            return generated;
          };
          if (DTS_EXTENSIONS.test(id))
            return handleDtsFile();
          return _nullishCoalesce(treatTsAsDts(), () => ( generateDtsFromTs()));
        },
        resolveId(source, importer) {
          if (!importer) {
            return;
          }
          importer = importer.split("\\").join("/");
          let resolvedCompilerOptions = ctx.resolvedOptions.compilerOptions;
          if (ctx.resolvedOptions.tsconfig) {
            const resolvedSource = source.startsWith(".") ? path__namespace.resolve(path__namespace.dirname(importer), source) : source;
            resolvedCompilerOptions = getCompilerOptions(resolvedSource, ctx.resolvedOptions.compilerOptions, ctx.resolvedOptions.tsconfig).compilerOptions;
          }
          const { resolvedModule } = ts2.resolveModuleName(source, importer, resolvedCompilerOptions, ts2.sys);
          if (!resolvedModule) {
            return;
          }
          if (!ctx.resolvedOptions.respectExternal && resolvedModule.isExternalLibraryImport) {
            return { id: source, external: true };
          } else {
            return { id: path__namespace.resolve(resolvedModule.resolvedFileName) };
          }
        }
      };
    };
    exports.default = plugin;
    exports.dts = plugin;
  }
});

// src/rollup.ts
var _worker_threads = require('worker_threads');
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _typescript = require('typescript'); var _typescript2 = _interopRequireDefault(_typescript);

// node_modules/.pnpm/@rollup+pluginutils@5.1.4_rollup@4.34.8/node_modules/@rollup/pluginutils/dist/es/index.js

var import_picomatch = _chunkTWFEYLU4js.__toESM.call(void 0, require_picomatch2(), 1);
function isArray(arg) {
  return Array.isArray(arg);
}
function ensureArray(thing) {
  if (isArray(thing))
    return thing;
  if (thing == null)
    return [];
  return [thing];
}
var normalizePathRegExp = new RegExp(`\\${_path.win32.sep}`, "g");
var normalizePath = function normalizePath2(filename) {
  return filename.replace(normalizePathRegExp, _path.posix.sep);
};
function getMatcherString(id, resolutionBase) {
  if (resolutionBase === false || _path.isAbsolute.call(void 0, id) || id.startsWith("**")) {
    return normalizePath(id);
  }
  const basePath = normalizePath(_path.resolve.call(void 0, resolutionBase || "")).replace(/[-^$*+?.()|[\]{}]/g, "\\$&");
  return _path.posix.join(basePath, normalizePath(id));
}
var createFilter = function createFilter2(include, exclude, options) {
  const resolutionBase = options && options.resolve;
  const getMatcher = (id) => id instanceof RegExp ? id : {
    test: (what) => {
      const pattern = getMatcherString(id, resolutionBase);
      const fn = (0, import_picomatch.default)(pattern, { dot: true });
      const result = fn(what);
      return result;
    }
  };
  const includeMatchers = ensureArray(include).map(getMatcher);
  const excludeMatchers = ensureArray(exclude).map(getMatcher);
  if (!includeMatchers.length && !excludeMatchers.length)
    return (id) => typeof id === "string" && !id.includes("\0");
  return function result(id) {
    if (typeof id !== "string")
      return false;
    if (id.includes("\0"))
      return false;
    const pathId = normalizePath(id);
    for (let i = 0; i < excludeMatchers.length; ++i) {
      const matcher = excludeMatchers[i];
      if (matcher instanceof RegExp) {
        matcher.lastIndex = 0;
      }
      if (matcher.test(pathId))
        return false;
    }
    for (let i = 0; i < includeMatchers.length; ++i) {
      const matcher = includeMatchers[i];
      if (matcher instanceof RegExp) {
        matcher.lastIndex = 0;
      }
      if (matcher.test(pathId))
        return true;
    }
    return !includeMatchers.length;
  };
};
var reservedWords = "break case class catch const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield enum await implements package protected static interface private public";
var builtins = "arguments Infinity NaN undefined null true false eval uneval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Symbol Error EvalError InternalError RangeError ReferenceError SyntaxError TypeError URIError Number Math Date String RegExp Array Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array Map Set WeakMap WeakSet SIMD ArrayBuffer DataView JSON Promise Generator GeneratorFunction Reflect Proxy Intl";
var forbiddenIdentifiers = new Set(`${reservedWords} ${builtins}`.split(" "));
forbiddenIdentifiers.add("");
var makeLegalIdentifier = function makeLegalIdentifier2(str) {
  let identifier = str.replace(/-(\w)/g, (_, letter) => letter.toUpperCase()).replace(/[^$_a-zA-Z0-9]/g, "_");
  if (/\d/.test(identifier[0]) || forbiddenIdentifiers.has(identifier)) {
    identifier = `_${identifier}`;
  }
  return identifier || "_";
};
function stringify(obj) {
  return (JSON.stringify(obj) || "undefined").replace(/[\u2028\u2029]/g, (char) => `\\u${`000${char.charCodeAt(0).toString(16)}`.slice(-4)}`);
}
function serializeArray(arr, indent, baseIndent) {
  let output = "[";
  const separator = indent ? `
${baseIndent}${indent}` : "";
  for (let i = 0; i < arr.length; i++) {
    const key = arr[i];
    output += `${i > 0 ? "," : ""}${separator}${serialize(key, indent, baseIndent + indent)}`;
  }
  return `${output}${indent ? `
${baseIndent}` : ""}]`;
}
function serializeObject(obj, indent, baseIndent) {
  let output = "{";
  const separator = indent ? `
${baseIndent}${indent}` : "";
  const entries = Object.entries(obj);
  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    const stringKey = makeLegalIdentifier(key) === key ? key : stringify(key);
    output += `${i > 0 ? "," : ""}${separator}${stringKey}:${indent ? " " : ""}${serialize(value, indent, baseIndent + indent)}`;
  }
  return `${output}${indent ? `
${baseIndent}` : ""}}`;
}
function serialize(obj, indent, baseIndent) {
  if (typeof obj === "object" && obj !== null) {
    if (Array.isArray(obj))
      return serializeArray(obj, indent, baseIndent);
    if (obj instanceof Date)
      return `new Date(${obj.getTime()})`;
    if (obj instanceof RegExp)
      return obj.toString();
    return serializeObject(obj, indent, baseIndent);
  }
  if (typeof obj === "number") {
    if (obj === Infinity)
      return "Infinity";
    if (obj === -Infinity)
      return "-Infinity";
    if (obj === 0)
      return 1 / obj === Infinity ? "0" : "-0";
    if (obj !== obj)
      return "NaN";
  }
  if (typeof obj === "symbol") {
    const key = Symbol.keyFor(obj);
    if (key !== void 0)
      return `Symbol.for(${stringify(key)})`;
  }
  if (typeof obj === "bigint")
    return `${obj}n`;
  return stringify(obj);
}
var hasStringIsWellFormed = "isWellFormed" in String.prototype;
function isWellFormedString(input) {
  if (hasStringIsWellFormed)
    return input.isWellFormed();
  return !new RegExp("\\p{Surrogate}", "u").test(input);
}
var dataToEsm = function dataToEsm2(data, options = {}) {
  var _a, _b;
  const t = options.compact ? "" : "indent" in options ? options.indent : "	";
  const _ = options.compact ? "" : " ";
  const n = options.compact ? "" : "\n";
  const declarationType = options.preferConst ? "const" : "var";
  if (options.namedExports === false || typeof data !== "object" || Array.isArray(data) || data instanceof Date || data instanceof RegExp || data === null) {
    const code = serialize(data, options.compact ? null : t, "");
    const magic = _ || (/^[{[\-\/]/.test(code) ? "" : " ");
    return `export default${magic}${code};`;
  }
  let maxUnderbarPrefixLength = 0;
  for (const key of Object.keys(data)) {
    const underbarPrefixLength = (_b = (_a = /^(_+)/.exec(key)) === null || _a === void 0 ? void 0 : _a[0].length) !== null && _b !== void 0 ? _b : 0;
    if (underbarPrefixLength > maxUnderbarPrefixLength) {
      maxUnderbarPrefixLength = underbarPrefixLength;
    }
  }
  const arbitraryNamePrefix = `${"_".repeat(maxUnderbarPrefixLength + 1)}arbitrary`;
  let namedExportCode = "";
  const defaultExportRows = [];
  const arbitraryNameExportRows = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === makeLegalIdentifier(key)) {
      if (options.objectShorthand)
        defaultExportRows.push(key);
      else
        defaultExportRows.push(`${key}:${_}${key}`);
      namedExportCode += `export ${declarationType} ${key}${_}=${_}${serialize(value, options.compact ? null : t, "")};${n}`;
    } else {
      defaultExportRows.push(`${stringify(key)}:${_}${serialize(value, options.compact ? null : t, "")}`);
      if (options.includeArbitraryNames && isWellFormedString(key)) {
        const variableName = `${arbitraryNamePrefix}${arbitraryNameExportRows.length}`;
        namedExportCode += `${declarationType} ${variableName}${_}=${_}${serialize(value, options.compact ? null : t, "")};${n}`;
        arbitraryNameExportRows.push(`${variableName} as ${JSON.stringify(key)}`);
      }
    }
  }
  const arbitraryExportCode = arbitraryNameExportRows.length > 0 ? `export${_}{${n}${t}${arbitraryNameExportRows.join(`,${n}${t}`)}${n}};${n}` : "";
  const defaultExportCode = `export default${_}{${n}${t}${defaultExportRows.join(`,${n}${t}`)}${n}};${n}`;
  return `${namedExportCode}${arbitraryExportCode}${defaultExportCode}`;
};

// node_modules/.pnpm/@rollup+plugin-json@6.1.0_rollup@4.34.8/node_modules/@rollup/plugin-json/dist/es/index.js
function json(options) {
  if (options === void 0) options = {};
  var filter = createFilter(options.include, options.exclude);
  var indent = "indent" in options ? options.indent : "	";
  return {
    name: "json",
    // eslint-disable-next-line no-shadow
    transform: function transform(code, id) {
      if (id.slice(-5) !== ".json" || !filter(id)) {
        return null;
      }
      try {
        var parsed = JSON.parse(code);
        return {
          code: dataToEsm(parsed, {
            preferConst: options.preferConst,
            compact: options.compact,
            namedExports: options.namedExports,
            includeArbitraryNames: options.includeArbitraryNames,
            indent
          }),
          map: { mappings: "" }
        };
      } catch (err) {
        var message = "Could not parse JSON file";
        this.error({ message, id, cause: err });
        return null;
      }
    }
  };
}

// src/rollup.ts
var _resolvefrom = require('resolve-from'); var _resolvefrom2 = _interopRequireDefault(_resolvefrom);

// src/rollup/ts-resolve.ts
var import_resolve = _chunkTWFEYLU4js.__toESM.call(void 0, require_resolve());
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);

var _module = require('module');
var _debug = require('debug'); var _debug2 = _interopRequireDefault(_debug);
var debug = _debug2.default.call(void 0, "tsup:ts-resolve");
var resolveModule = (id, opts) => new Promise((resolve2, reject) => {
  (0, import_resolve.default)(id, opts, (err, res) => {
    if (_optionalChain([err, 'optionalAccess', _12 => _12.code]) === "MODULE_NOT_FOUND") return resolve2(null);
    if (err) return reject(err);
    resolve2(res || null);
  });
});
var tsResolvePlugin = ({
  resolveOnly,
  ignore
} = {}) => {
  const resolveExtensions = [".d.ts", ".ts"];
  return {
    name: `ts-resolve`,
    async resolveId(source, importer) {
      debug("resolveId source: %s", source);
      debug("resolveId importer: %s ", importer);
      if (!importer) return null;
      if (/\0/.test(source)) return null;
      if (_module.builtinModules.includes(source)) return false;
      if (ignore && ignore(source, importer)) {
        debug("ignored %s", source);
        return null;
      }
      if (resolveOnly) {
        const shouldResolve = resolveOnly.some((v) => {
          if (typeof v === "string") return v === source;
          return v.test(source);
        });
        if (!shouldResolve) {
          debug("skipped by matching resolveOnly: %s", source);
          return null;
        }
      }
      if (_path2.default.isAbsolute(source)) {
        debug(`skipped absolute path: %s`, source);
        return null;
      }
      const basedir = importer ? await _fs2.default.promises.realpath(_path2.default.dirname(importer)) : process.cwd();
      if (source[0] === ".") {
        return resolveModule(source, {
          basedir,
          extensions: resolveExtensions
        });
      }
      let id = null;
      if (!importer) {
        id = await resolveModule(`./${source}`, {
          basedir,
          extensions: resolveExtensions
        });
      }
      if (!id) {
        id = await resolveModule(source, {
          basedir,
          extensions: resolveExtensions,
          packageFilter(pkg) {
            pkg.main = pkg.types || pkg.typings;
            return pkg;
          },
          paths: ["node_modules", "node_modules/@types"]
        });
      }
      if (id) {
        debug("resolved %s to %s", source, id);
        return id;
      }
      debug("mark %s as external", source);
      return false;
    }
  };
};

// src/rollup.ts
var _rollup = require('fix-dts-default-cjs-exports/rollup');
var logger = _chunkVGC3FXLUjs.createLogger.call(void 0, );
var parseCompilerOptions = (compilerOptions) => {
  if (!compilerOptions) return {};
  const { options } = _typescript2.default.parseJsonConfigFileContent(
    { compilerOptions },
    _typescript2.default.sys,
    "./"
  );
  return options;
};
var dtsPlugin = require_rollup_plugin_dts();
var getRollupConfig = async (options) => {
  _chunkVGC3FXLUjs.setSilent.call(void 0, options.silent);
  const compilerOptions = parseCompilerOptions(_optionalChain([options, 'access', _13 => _13.dts, 'optionalAccess', _14 => _14.compilerOptions]));
  const dtsOptions = options.dts || {};
  dtsOptions.entry = dtsOptions.entry || options.entry;
  if (Array.isArray(dtsOptions.entry) && dtsOptions.entry.length > 1) {
    dtsOptions.entry = _chunkTWFEYLU4js.toObjectEntry.call(void 0, dtsOptions.entry);
  }
  let tsResolveOptions;
  if (dtsOptions.resolve) {
    tsResolveOptions = {};
    if (Array.isArray(dtsOptions.resolve)) {
      tsResolveOptions.resolveOnly = dtsOptions.resolve;
    }
    if (compilerOptions.paths) {
      const res = Object.keys(compilerOptions.paths).map(
        (p) => new RegExp(`^${p.replace("*", ".+")}$`)
      );
      tsResolveOptions.ignore = (source) => {
        return res.some((re) => re.test(source));
      };
    }
  }
  const pkg = await _chunkVGC3FXLUjs.loadPkg.call(void 0, process.cwd());
  const deps = await _chunkVGC3FXLUjs.getProductionDeps.call(void 0, process.cwd());
  const tsupCleanPlugin = {
    name: "tsup:clean",
    async buildStart() {
      if (options.clean) {
        await _chunkTWFEYLU4js.removeFiles.call(void 0, ["**/*.d.{ts,mts,cts}"], options.outDir);
      }
    }
  };
  const ignoreFiles = {
    name: "tsup:ignore-files",
    load(id) {
      if (!/\.(js|cjs|mjs|jsx|ts|tsx|mts|json)$/.test(id)) {
        return "";
      }
    }
  };
  return {
    inputConfig: {
      input: dtsOptions.entry,
      onwarn(warning, handler) {
        if (warning.code === "UNRESOLVED_IMPORT" || warning.code === "CIRCULAR_DEPENDENCY" || warning.code === "EMPTY_BUNDLE") {
          return;
        }
        return handler(warning);
      },
      plugins: [
        tsupCleanPlugin,
        tsResolveOptions && tsResolvePlugin(tsResolveOptions),
        json(),
        ignoreFiles,
        dtsPlugin.default({
          tsconfig: options.tsconfig,
          compilerOptions: {
            ...compilerOptions,
            baseUrl: compilerOptions.baseUrl || ".",
            // Ensure ".d.ts" modules are generated
            declaration: true,
            // Skip ".js" generation
            noEmit: false,
            emitDeclarationOnly: true,
            // Skip code generation when error occurs
            noEmitOnError: true,
            // Avoid extra work
            checkJs: false,
            declarationMap: false,
            skipLibCheck: true,
            preserveSymlinks: false,
            // Ensure we can parse the latest code
            target: _typescript2.default.ScriptTarget.ESNext
          }
        })
      ].filter(Boolean),
      external: [
        // Exclude dependencies, e.g. `lodash`, `lodash/get`
        ...deps.map((dep) => new RegExp(`^${dep}($|\\/|\\\\)`)),
        ...options.external || []
      ]
    },
    outputConfig: options.format.map((format) => {
      const outputExtension = _optionalChain([options, 'access', _15 => _15.outExtension, 'optionalCall', _16 => _16({ format, options, pkgType: pkg.type }), 'access', _17 => _17.dts]) || _chunkTWFEYLU4js.defaultOutExtension.call(void 0, { format, pkgType: pkg.type }).dts;
      return {
        dir: options.outDir || "dist",
        format: "esm",
        exports: "named",
        banner: dtsOptions.banner,
        footer: dtsOptions.footer,
        entryFileNames: `[name]${outputExtension}`,
        chunkFileNames: `[name]-[hash]${outputExtension}`,
        plugins: [
          format === "cjs" && options.cjsInterop && _rollup.FixDtsDefaultCjsExportsPlugin.call(void 0, )
        ].filter(Boolean)
      };
    })
  };
};
async function runRollup(options) {
  const { rollup } = await Promise.resolve().then(() => _interopRequireWildcard(require("rollup")));
  try {
    const start = Date.now();
    const getDuration = () => {
      return `${Math.floor(Date.now() - start)}ms`;
    };
    logger.info("dts", "Build start");
    const bundle = await rollup(options.inputConfig);
    const results = await Promise.all(options.outputConfig.map(bundle.write));
    const outputs = results.flatMap((result) => result.output);
    logger.success("dts", `\u26A1\uFE0F Build success in ${getDuration()}`);
    _chunkVGC3FXLUjs.reportSize.call(void 0, 
      logger,
      "dts",
      outputs.reduce((res, info) => {
        const name = _path2.default.relative(
          process.cwd(),
          _path2.default.join(options.outputConfig[0].dir || ".", info.fileName)
        );
        return {
          ...res,
          [name]: info.type === "chunk" ? info.code.length : info.source.length
        };
      }, {})
    );
  } catch (error) {
    _chunkJZ25TPTYjs.handleError.call(void 0, error);
    logger.error("dts", "Build error");
  }
}
async function watchRollup(options) {
  const { watch } = await Promise.resolve().then(() => _interopRequireWildcard(require("rollup")));
  watch({
    ...options.inputConfig,
    plugins: options.inputConfig.plugins,
    output: options.outputConfig
  }).on("event", (event) => {
    if (event.code === "START") {
      logger.info("dts", "Build start");
    } else if (event.code === "BUNDLE_END") {
      logger.success("dts", `\u26A1\uFE0F Build success in ${event.duration}ms`);
      _optionalChain([_worker_threads.parentPort, 'optionalAccess', _18 => _18.postMessage, 'call', _19 => _19("success")]);
    } else if (event.code === "ERROR") {
      logger.error("dts", "Build failed");
      _chunkJZ25TPTYjs.handleError.call(void 0, event.error);
    }
  });
}
var startRollup = async (options) => {
  const config = await getRollupConfig(options);
  if (options.watch) {
    watchRollup(config);
  } else {
    try {
      await runRollup(config);
      _optionalChain([_worker_threads.parentPort, 'optionalAccess', _20 => _20.postMessage, 'call', _21 => _21("success")]);
    } catch (e4) {
      _optionalChain([_worker_threads.parentPort, 'optionalAccess', _22 => _22.postMessage, 'call', _23 => _23("error")]);
    }
  }
};
_optionalChain([_worker_threads.parentPort, 'optionalAccess', _24 => _24.on, 'call', _25 => _25("message", (data) => {
  logger.setName(data.configName);
  const hasTypescript = _resolvefrom2.default.silent(process.cwd(), "typescript");
  if (!hasTypescript) {
    logger.error("dts", `You need to install "typescript" in your project`);
    _optionalChain([_worker_threads.parentPort, 'optionalAccess', _26 => _26.postMessage, 'call', _27 => _27("error")]);
    return;
  }
  startRollup(data.options);
})]);
