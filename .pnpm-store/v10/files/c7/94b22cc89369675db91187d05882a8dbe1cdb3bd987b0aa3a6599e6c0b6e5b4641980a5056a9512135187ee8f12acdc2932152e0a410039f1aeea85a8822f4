"use strict";
var a0 = Object.create;
var Bt = Object.defineProperty;
var l0 = Object.getOwnPropertyDescriptor;
var h0 = Object.getOwnPropertyNames;
var c0 = Object.getPrototypeOf, d0 = Object.prototype.hasOwnProperty;
var s = (t, e) => Bt(t, "name", { value: e, configurable: !0 });
var _n = (t, e) => () => (t && (e = t(t = 0)), e);
var c = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports), wt = (t, e) => {
  for (var r in e)
    Bt(t, r, { get: e[r], enumerable: !0 });
}, In = (t, e, r, u) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let n of h0(e))
      !d0.call(t, n) && n !== r && Bt(t, n, { get: () => e[n], enumerable: !(u = l0(e, n)) || u.enumerable });
  return t;
};
var v = (t, e, r) => (r = t != null ? a0(c0(t)) : {}, In(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  e || !t || !t.__esModule ? Bt(r, "default", { value: t, enumerable: !0 }) : r,
  t
)), Ln = (t) => In(Bt({}, "__esModule", { value: !0 }), t);

// ../node_modules/are-we-there-yet/lib/tracker-base.js
var bu = c((DE, kn) => {
  "use strict";
  var f0 = require("events"), p0 = 0, Eu = class extends f0 {
    static {
      s(this, "TrackerBase");
    }
    constructor(e) {
      super(), this.id = ++p0, this.name = e;
    }
  };
  kn.exports = Eu;
});

// ../node_modules/are-we-there-yet/lib/tracker.js
var ar = c((lE, Pn) => {
  "use strict";
  var m0 = bu(), xu = class extends m0 {
    static {
      s(this, "Tracker");
    }
    constructor(e, r) {
      super(e), this.workDone = 0, this.workTodo = r || 0;
    }
    completed() {
      return this.workTodo === 0 ? 0 : this.workDone / this.workTodo;
    }
    addWork(e) {
      this.workTodo += e, this.emit("change", this.name, this.completed(), this);
    }
    completeWork(e) {
      this.workDone += e, this.workDone > this.workTodo && (this.workDone = this.workTodo), this.emit("change", this.name, this.completed(),
      this);
    }
    finish() {
      this.workTodo = this.workDone = 1, this.emit("change", this.name, 1, this);
    }
  };
  Pn.exports = xu;
});

// ../node_modules/are-we-there-yet/lib/tracker-stream.js
var yu = c((cE, Mn) => {
  "use strict";
  var g0 = require("stream"), F0 = ar(), vu = class extends g0.Transform {
    static {
      s(this, "TrackerStream");
    }
    constructor(e, r, u) {
      super(u), this.tracker = new F0(e, r), this.name = e, this.id = this.tracker.id, this.tracker.on("change", this.trackerChange.bind(this));
    }
    trackerChange(e, r) {
      this.emit("change", e, r, this);
    }
    _transform(e, r, u) {
      this.tracker.completeWork(e.length ? e.length : 1), this.push(e), u();
    }
    _flush(e) {
      this.tracker.finish(), e();
    }
    completed() {
      return this.tracker.completed();
    }
    addWork(e) {
      return this.tracker.addWork(e);
    }
    finish() {
      return this.tracker.finish();
    }
  };
  Mn.exports = vu;
});

// ../node_modules/are-we-there-yet/lib/tracker-group.js
var Nn = c((fE, qn) => {
  "use strict";
  var C0 = bu(), Rn = ar(), E0 = yu(), Bu = class t extends C0 {
    static {
      s(this, "TrackerGroup");
    }
    parentGroup = null;
    trackers = [];
    completion = {};
    weight = {};
    totalWeight = 0;
    finished = !1;
    bubbleChange = b0(this);
    nameInTree() {
      for (var e = [], r = this; r; )
        e.unshift(r.name), r = r.parentGroup;
      return e.join("/");
    }
    addUnit(e, r) {
      if (e.addUnit) {
        for (var u = this; u; ) {
          if (e === u)
            throw new Error(
              "Attempted to add tracker group " + e.name + " to tree that already includes it " + this.nameInTree(this)
            );
          u = u.parentGroup;
        }
        e.parentGroup = this;
      }
      return this.weight[e.id] = r || 1, this.totalWeight += this.weight[e.id], this.trackers.push(e), this.completion[e.id] = e.completed(),
      e.on("change", this.bubbleChange), this.finished || this.emit("change", e.name, this.completion[e.id], e), e;
    }
    completed() {
      if (this.trackers.length === 0)
        return 0;
      for (var e = 1 / this.totalWeight, r = 0, u = 0; u < this.trackers.length; u++) {
        var n = this.trackers[u].id;
        r += e * this.weight[n] * this.completion[n];
      }
      return r;
    }
    newGroup(e, r) {
      return this.addUnit(new t(e), r);
    }
    newItem(e, r, u) {
      return this.addUnit(new Rn(e, r), u);
    }
    newStream(e, r, u) {
      return this.addUnit(new E0(e, r), u);
    }
    finish() {
      this.finished = !0, this.trackers.length || this.addUnit(new Rn(), 1, !0);
      for (var e = 0; e < this.trackers.length; e++) {
        var r = this.trackers[e];
        r.finish(), r.removeListener("change", this.bubbleChange);
      }
      this.emit("change", this.name, 1, this);
    }
    debug(e = 0) {
      let r = " ".repeat(e), u = `${r}${this.name || "top"}: ${this.completed()}
`;
      return this.trackers.forEach(function(n) {
        u += n instanceof t ? n.debug(e + 1) : `${r} ${n.name}: ${n.completed()}
`;
      }), u;
    }
  };
  function b0(t) {
    return function(e, r, u) {
      t.completion[u.id] = r, !t.finished && t.emit("change", e || t.name, t.completed(), t);
    };
  }
  s(b0, "bubbleChange");
  qn.exports = Bu;
});

// ../node_modules/are-we-there-yet/lib/index.js
var jn = c((lr) => {
  "use strict";
  lr.TrackerGroup = Nn();
  lr.Tracker = ar();
  lr.TrackerStream = yu();
});

// ../node_modules/console-control-strings/index.js
var hr = c((q) => {
  "use strict";
  var Y = "\x1B[";
  q.up = /* @__PURE__ */ s(function(e) {
    return Y + (e || "") + "A";
  }, "up");
  q.down = /* @__PURE__ */ s(function(e) {
    return Y + (e || "") + "B";
  }, "down");
  q.forward = /* @__PURE__ */ s(function(e) {
    return Y + (e || "") + "C";
  }, "forward");
  q.back = /* @__PURE__ */ s(function(e) {
    return Y + (e || "") + "D";
  }, "back");
  q.nextLine = /* @__PURE__ */ s(function(e) {
    return Y + (e || "") + "E";
  }, "nextLine");
  q.previousLine = /* @__PURE__ */ s(function(e) {
    return Y + (e || "") + "F";
  }, "previousLine");
  q.horizontalAbsolute = /* @__PURE__ */ s(function(e) {
    if (e == null) throw new Error("horizontalAboslute requires a column to position to");
    return Y + e + "G";
  }, "horizontalAbsolute");
  q.eraseData = /* @__PURE__ */ s(function() {
    return Y + "J";
  }, "eraseData");
  q.eraseLine = /* @__PURE__ */ s(function() {
    return Y + "K";
  }, "eraseLine");
  q.goto = function(t, e) {
    return Y + e + ";" + t + "H";
  };
  q.gotoSOL = function() {
    return "\r";
  };
  q.beep = function() {
    return "\x07";
  };
  q.hideCursor = /* @__PURE__ */ s(function() {
    return Y + "?25l";
  }, "hideCursor");
  q.showCursor = /* @__PURE__ */ s(function() {
    return Y + "?25h";
  }, "showCursor");
  var Gn = {
    reset: 0,
    // styles
    bold: 1,
    italic: 3,
    underline: 4,
    inverse: 7,
    // resets
    stopBold: 22,
    stopItalic: 23,
    stopUnderline: 24,
    stopInverse: 27,
    // colors
    white: 37,
    black: 30,
    blue: 34,
    cyan: 36,
    green: 32,
    magenta: 35,
    red: 31,
    yellow: 33,
    bgWhite: 47,
    bgBlack: 40,
    bgBlue: 44,
    bgCyan: 46,
    bgGreen: 42,
    bgMagenta: 45,
    bgRed: 41,
    bgYellow: 43,
    grey: 90,
    brightBlack: 90,
    brightRed: 91,
    brightGreen: 92,
    brightYellow: 93,
    brightBlue: 94,
    brightMagenta: 95,
    brightCyan: 96,
    brightWhite: 97,
    bgGrey: 100,
    bgBrightBlack: 100,
    bgBrightRed: 101,
    bgBrightGreen: 102,
    bgBrightYellow: 103,
    bgBrightBlue: 104,
    bgBrightMagenta: 105,
    bgBrightCyan: 106,
    bgBrightWhite: 107
  };
  q.color = /* @__PURE__ */ s(function(e) {
    return (arguments.length !== 1 || !Array.isArray(e)) && (e = Array.prototype.slice.call(arguments)), Y + e.map(x0).join(";") + "m";
  }, "color");
  function x0(t) {
    if (Gn[t] != null) return Gn[t];
    throw new Error("Unknown color or style name: " + t);
  }
  s(x0, "colorNameToCode");
});

// ../node_modules/string-width/node_modules/ansi-regex/index.js
var Vn = c((CE, Wn) => {
  "use strict";
  Wn.exports = ({ onlyFirst: t = !1 } = {}) => {
    let e = [
      "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
      "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
    ].join("|");
    return new RegExp(e, t ? void 0 : "g");
  };
});

// ../node_modules/string-width/node_modules/strip-ansi/index.js
var Yn = c((EE, Un) => {
  "use strict";
  var v0 = Vn();
  Un.exports = (t) => typeof t == "string" ? t.replace(v0(), "") : t;
});

// ../node_modules/is-fullwidth-code-point/index.js
var zn = c((bE, wu) => {
  "use strict";
  var Hn = /* @__PURE__ */ s((t) => Number.isNaN(t) ? !1 : t >= 4352 && (t <= 4447 || // Hangul Jamo
  t === 9001 || // LEFT-POINTING ANGLE BRACKET
  t === 9002 || // RIGHT-POINTING ANGLE BRACKET
  // CJK Radicals Supplement .. Enclosed CJK Letters and Months
  11904 <= t && t <= 12871 && t !== 12351 || // Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
  12880 <= t && t <= 19903 || // CJK Unified Ideographs .. Yi Radicals
  19968 <= t && t <= 42182 || // Hangul Jamo Extended-A
  43360 <= t && t <= 43388 || // Hangul Syllables
  44032 <= t && t <= 55203 || // CJK Compatibility Ideographs
  63744 <= t && t <= 64255 || // Vertical Forms
  65040 <= t && t <= 65049 || // CJK Compatibility Forms .. Small Form Variants
  65072 <= t && t <= 65131 || // Halfwidth and Fullwidth Forms
  65281 <= t && t <= 65376 || 65504 <= t && t <= 65510 || // Kana Supplement
  110592 <= t && t <= 110593 || // Enclosed Ideographic Supplement
  127488 <= t && t <= 127569 || // CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
  131072 <= t && t <= 262141), "isFullwidthCodePoint");
  wu.exports = Hn;
  wu.exports.default = Hn;
});

// ../node_modules/string-width/node_modules/emoji-regex/index.js
var Zn = c((vE, Kn) => {
  "use strict";
  Kn.exports = function() {
    return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F|\uD83D\uDC68(?:\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|[\u2695\u2696\u2708]\uFE0F|\uD83D[\uDC66\uDC67]|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708])\uFE0F|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C[\uDFFB-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)\uD83C\uDFFB|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB\uDFFC])|\uD83D\uDC69(?:\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB-\uDFFD])|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\uD83C\uDFF4\u200D\u2620)\uFE0F|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDF6\uD83C\uDDE6|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDBB\uDDD2-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5\uDEEB\uDEEC\uDEF4-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
  };
});

// ../node_modules/string-width/index.js
var Ke = c((yE, Au) => {
  "use strict";
  var y0 = Yn(), B0 = zn(), w0 = Zn(), Jn = /* @__PURE__ */ s((t) => {
    if (typeof t != "string" || t.length === 0 || (t = y0(t), t.length === 0))
      return 0;
    t = t.replace(w0(), "  ");
    let e = 0;
    for (let r = 0; r < t.length; r++) {
      let u = t.codePointAt(r);
      u <= 31 || u >= 127 && u <= 159 || u >= 768 && u <= 879 || (u > 65535 && r++, e += B0(u) ? 2 : 1);
    }
    return e;
  }, "stringWidth");
  Au.exports = Jn;
  Au.exports.default = Jn;
});

// ../node_modules/wide-align/align.js
var Xn = c((dr) => {
  "use strict";
  var Su = Ke();
  dr.center = T0;
  dr.left = A0;
  dr.right = S0;
  function cr(t) {
    var e = "", r = " ", u = t;
    do
      u % 2 && (e += r), u = Math.floor(u / 2), r += r;
    while (u);
    return e;
  }
  s(cr, "createPadding");
  function A0(t, e) {
    var r = t.trimRight();
    if (r.length === 0 && t.length >= e) return t;
    var u = "", n = Su(r);
    return n < e && (u = cr(e - n)), r + u;
  }
  s(A0, "alignLeft");
  function S0(t, e) {
    var r = t.trimLeft();
    if (r.length === 0 && t.length >= e) return t;
    var u = "", n = Su(r);
    return n < e && (u = cr(e - n)), u + r;
  }
  s(S0, "alignRight");
  function T0(t, e) {
    var r = t.trim();
    if (r.length === 0 && t.length >= e) return t;
    var u = "", n = "", o = Su(r);
    if (o < e) {
      var i = parseInt((e - o) / 2, 10);
      u = cr(i), n = cr(e - (o + i));
    }
    return u + r + n;
  }
  s(T0, "alignCenter");
});

// ../node_modules/aproba/index.js
var pr = c((SE, uo) => {
  "use strict";
  uo.exports = to;
  function $0(t) {
    return t != null && typeof t == "object" && t.hasOwnProperty("callee");
  }
  s($0, "isArguments");
  var ie = {
    "*": { label: "any", check: /* @__PURE__ */ s(() => !0, "check") },
    A: { label: "array", check: /* @__PURE__ */ s((t) => Array.isArray(t) || $0(t), "check") },
    S: { label: "string", check: /* @__PURE__ */ s((t) => typeof t == "string", "check") },
    N: { label: "number", check: /* @__PURE__ */ s((t) => typeof t == "number", "check") },
    F: { label: "function", check: /* @__PURE__ */ s((t) => typeof t == "function", "check") },
    O: { label: "object", check: /* @__PURE__ */ s((t) => typeof t == "object" && t != null && !ie.A.check(t) && !ie.E.check(t), "check") },
    B: { label: "boolean", check: /* @__PURE__ */ s((t) => typeof t == "boolean", "check") },
    E: { label: "error", check: /* @__PURE__ */ s((t) => t instanceof Error, "check") },
    Z: { label: "null", check: /* @__PURE__ */ s((t) => t == null, "check") }
  };
  function fr(t, e) {
    let r = e[t.length] = e[t.length] || [];
    r.indexOf(t) === -1 && r.push(t);
  }
  s(fr, "addSchema");
  function to(t, e) {
    if (arguments.length !== 2) throw eo(["SA"], arguments.length);
    if (!t) throw Qn(0, "rawSchemas");
    if (!e) throw Qn(1, "args");
    if (!ie.S.check(t)) throw Tu(0, ["string"], t);
    if (!ie.A.check(e)) throw Tu(1, ["array"], e);
    let r = t.split("|"), u = {};
    r.forEach((o) => {
      for (let i = 0; i < o.length; ++i) {
        let D = o[i];
        if (!ie[D]) throw O0(i, D);
      }
      if (/E.*E/.test(o)) throw _0(o);
      fr(o, u), /E/.test(o) && (fr(o.replace(/E.*$/, "E"), u), fr(o.replace(/E/, "Z"), u), o.length === 1 && fr("", u));
    });
    let n = u[e.length];
    if (!n)
      throw eo(Object.keys(u), e.length);
    for (let o = 0; o < e.length; ++o) {
      let i = n.filter((D) => {
        let a = D[o], l = ie[a].check;
        return l(e[o]);
      });
      if (!i.length) {
        let D = n.map((a) => ie[a[o]].label).filter((a) => a != null);
        throw Tu(o, D, e[o]);
      }
      n = i;
    }
  }
  s(to, "validate");
  function Qn(t) {
    return At("EMISSINGARG", "Missing required argument #" + (t + 1));
  }
  s(Qn, "missingRequiredArg");
  function O0(t, e) {
    return At("EUNKNOWNTYPE", "Unknown type " + e + " in argument #" + (t + 1));
  }
  s(O0, "unknownType");
  function Tu(t, e, r) {
    let u;
    return Object.keys(ie).forEach((n) => {
      ie[n].check(r) && (u = ie[n].label);
    }), At("EINVALIDTYPE", "Argument #" + (t + 1) + ": Expected " + ro(e) + " but got " + u);
  }
  s(Tu, "invalidType");
  function ro(t) {
    return t.join(", ").replace(/, ([^,]+)$/, " or $1");
  }
  s(ro, "englishList");
  function eo(t, e) {
    let r = ro(t), u = t.every((n) => n.length === 1) ? "argument" : "arguments";
    return At("EWRONGARGCOUNT", "Expected " + r + " " + u + " but got " + e);
  }
  s(eo, "wrongNumberOfArgs");
  function _0(t) {
    return At(
      "ETOOMANYERRORTYPES",
      'Only one error type per argument signature is allowed, more than one found in "' + t + '"'
    );
  }
  s(_0, "moreThanOneError");
  function At(t, e) {
    let r = new Error(e);
    return r.code = t, Error.captureStackTrace && Error.captureStackTrace(r, to), r;
  }
  s(At, "newException");
});

// ../node_modules/gauge/node_modules/ansi-regex/index.js
var so = c(($E, io) => {
  "use strict";
  io.exports = ({ onlyFirst: t = !1 } = {}) => {
    let e = [
      "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
      "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
    ].join("|");
    return new RegExp(e, t ? void 0 : "g");
  };
});

// ../node_modules/gauge/node_modules/strip-ansi/index.js
var oo = c((OE, no) => {
  "use strict";
  var I0 = so();
  no.exports = (t) => typeof t == "string" ? t.replace(I0(), "") : t;
});

// ../node_modules/gauge/lib/wide-truncate.js
var Ou = c((_E, Do) => {
  "use strict";
  var $u = Ke(), L0 = oo();
  Do.exports = k0;
  function k0(t, e) {
    if ($u(t) === 0)
      return t;
    if (e <= 0)
      return "";
    if ($u(t) <= e)
      return t;
    for (var r = L0(t), u = t.length + r.length, n = t.slice(0, e + u); $u(n) > e; )
      n = n.slice(0, -1);
    return n;
  }
  s(k0, "wideTruncate");
});

// ../node_modules/gauge/lib/error.js
var ao = c((mr) => {
  "use strict";
  var P0 = require("util"), M0 = mr.User = /* @__PURE__ */ s(function t(e) {
    var r = new Error(e);
    return Error.captureStackTrace(r, t), r.code = "EGAUGE", r;
  }, "User");
  mr.MissingTemplateValue = /* @__PURE__ */ s(function t(e, r) {
    var u = new M0(P0.format('Missing template value "%s"', e.type));
    return Error.captureStackTrace(u, t), u.template = e, u.values = r, u;
  }, "MissingTemplateValue");
  mr.Internal = /* @__PURE__ */ s(function t(e) {
    var r = new Error(e);
    return Error.captureStackTrace(r, t), r.code = "EGAUGEINTERNAL", r;
  }, "Internal");
});

// ../node_modules/gauge/lib/template-item.js
var ho = c((PE, lo) => {
  "use strict";
  var R0 = Ke();
  lo.exports = Ze;
  function _u(t) {
    return typeof t != "string" ? !1 : t.slice(-1) === "%";
  }
  s(_u, "isPercent");
  function Iu(t) {
    return Number(t.slice(0, -1)) / 100;
  }
  s(Iu, "percent");
  function Ze(t, e) {
    if (this.overallOutputLength = e, this.finished = !1, this.type = null, this.value = null, this.length = null, this.maxLength = null, this.
    minLength = null, this.kerning = null, this.align = "left", this.padLeft = 0, this.padRight = 0, this.index = null, this.first = null, this.
    last = null, typeof t == "string")
      this.value = t;
    else
      for (var r in t)
        this[r] = t[r];
    return _u(this.length) && (this.length = Math.round(this.overallOutputLength * Iu(this.length))), _u(this.minLength) && (this.minLength =
    Math.round(this.overallOutputLength * Iu(this.minLength))), _u(this.maxLength) && (this.maxLength = Math.round(this.overallOutputLength *
    Iu(this.maxLength))), this;
  }
  s(Ze, "TemplateItem");
  Ze.prototype = {};
  Ze.prototype.getBaseLength = function() {
    var t = this.length;
    return t == null && typeof this.value == "string" && this.maxLength == null && this.minLength == null && (t = R0(this.value)), t;
  };
  Ze.prototype.getLength = function() {
    var t = this.getBaseLength();
    return t == null ? null : t + this.padLeft + this.padRight;
  };
  Ze.prototype.getMaxLength = function() {
    return this.maxLength == null ? null : this.maxLength + this.padLeft + this.padRight;
  };
  Ze.prototype.getMinLength = function() {
    return this.minLength == null ? null : this.minLength + this.padLeft + this.padRight;
  };
});

// ../node_modules/gauge/lib/render-template.js
var Lu = c((RE, mo) => {
  "use strict";
  var St = Xn(), q0 = pr(), co = Ou(), Je = ao(), N0 = ho();
  function j0(t) {
    return function(e) {
      return H0(e, t);
    };
  }
  s(j0, "renderValueWithValues");
  var G0 = mo.exports = function(t, e, r) {
    var u = U0(t, e, r), n = u.map(j0(r)).join("");
    return St.left(co(n, t), t);
  };
  function fo(t) {
    var e = t.type[0].toUpperCase() + t.type.slice(1);
    return "pre" + e;
  }
  s(fo, "preType");
  function po(t) {
    var e = t.type[0].toUpperCase() + t.type.slice(1);
    return "post" + e;
  }
  s(po, "postType");
  function W0(t, e) {
    if (t.type)
      return e[fo(t)] || e[po(t)];
  }
  s(W0, "hasPreOrPost");
  function V0(t, e) {
    var r = Object.assign({}, t), u = Object.create(e), n = [], o = fo(r), i = po(r);
    return u[o] && (n.push({ value: u[o] }), u[o] = null), r.minLength = null, r.length = null, r.maxLength = null, n.push(r), u[r.type] = u[r.
    type], u[i] && (n.push({ value: u[i] }), u[i] = null), function(D, a, l) {
      return G0(l, n, u);
    };
  }
  s(V0, "generatePreAndPost");
  function U0(t, e, r) {
    function u(d, m, g) {
      var F = new N0(d, t), E = F.type;
      if (F.value == null)
        if (E in r)
          F.value = r[E];
        else {
          if (F.default == null)
            throw new Je.MissingTemplateValue(F, r);
          F.value = F.default;
        }
      return F.value == null || F.value === "" ? null : (F.index = m, F.first = m === 0, F.last = m === g.length - 1, W0(F, r) && (F.value =
      V0(F, r)), F);
    }
    s(u, "cloneAndObjectify");
    var n = e.map(u).filter(function(d) {
      return d != null;
    }), o = t, i = n.length;
    function D(d) {
      d > o && (d = o), o -= d;
    }
    s(D, "consumeSpace");
    function a(d, m) {
      if (d.finished)
        throw new Je.Internal("Tried to finish template item that was already finished");
      if (m === 1 / 0)
        throw new Je.Internal("Length of template item cannot be infinity");
      if (m != null && (d.length = m), d.minLength = null, d.maxLength = null, --i, d.finished = !0, d.length == null && (d.length = d.getBaseLength()),
      d.length == null)
        throw new Je.Internal("Finished template items must have a length");
      D(d.getLength());
    }
    s(a, "finishSizing"), n.forEach(function(d) {
      if (d.kerning) {
        var m = d.first ? 0 : n[d.index - 1].padRight;
        !d.first && m < d.kerning && (d.padLeft = d.kerning - m), d.last || (d.padRight = d.kerning);
      }
    }), n.forEach(function(d) {
      d.getBaseLength() != null && a(d);
    });
    var l = 0, h, p;
    do
      h = !1, p = Math.round(o / i), n.forEach(function(d) {
        d.finished || d.maxLength && d.getMaxLength() < p && (a(d, d.maxLength), h = !0);
      });
    while (h && l++ < n.length);
    if (h)
      throw new Je.Internal("Resize loop iterated too many times while determining maxLength");
    l = 0;
    do
      h = !1, p = Math.round(o / i), n.forEach(function(d) {
        d.finished || d.minLength && d.getMinLength() >= p && (a(d, d.minLength), h = !0);
      });
    while (h && l++ < n.length);
    if (h)
      throw new Je.Internal("Resize loop iterated too many times while determining minLength");
    return p = Math.round(o / i), n.forEach(function(d) {
      d.finished || a(d, p);
    }), n;
  }
  s(U0, "prepareItems");
  function Y0(t, e, r) {
    return q0("OON", arguments), t.type ? t.value(e, e[t.type + "Theme"] || {}, r) : t.value(e, {}, r);
  }
  s(Y0, "renderFunction");
  function H0(t, e) {
    var r = t.getBaseLength(), u = typeof t.value == "function" ? Y0(t, e, r) : t.value;
    if (u == null || u === "")
      return "";
    var n = St[t.align] || St.left, o = t.padLeft ? St.left("", t.padLeft) : "", i = t.padRight ? St.right("", t.padRight) : "", D = co(String(
    u), r), a = n(D, r);
    return o + a + i;
  }
  s(H0, "renderValue");
});

// ../node_modules/gauge/lib/plumbing.js
var Fo = c((NE, go) => {
  "use strict";
  var ke = hr(), z0 = Lu(), gr = pr(), Ee = go.exports = function(t, e, r) {
    r || (r = 80), gr("OAN", [t, e, r]), this.showing = !1, this.theme = t, this.width = r, this.template = e;
  };
  Ee.prototype = {};
  Ee.prototype.setTheme = function(t) {
    gr("O", [t]), this.theme = t;
  };
  Ee.prototype.setTemplate = function(t) {
    gr("A", [t]), this.template = t;
  };
  Ee.prototype.setWidth = function(t) {
    gr("N", [t]), this.width = t;
  };
  Ee.prototype.hide = function() {
    return ke.gotoSOL() + ke.eraseLine();
  };
  Ee.prototype.hideCursor = ke.hideCursor;
  Ee.prototype.showCursor = ke.showCursor;
  Ee.prototype.show = function(t) {
    var e = Object.create(this.theme);
    for (var r in t)
      e[r] = t[r];
    return z0(this.width, this.template, e).trim() + ke.color("reset") + ke.eraseLine() + ke.gotoSOL();
  };
});

// ../node_modules/has-unicode/index.js
var Eo = c((GE, Co) => {
  "use strict";
  var K0 = require("os"), jE = Co.exports = function() {
    if (K0.type() == "Windows_NT")
      return !1;
    var t = /UTF-?8$/i, e = process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG;
    return t.test(e);
  };
});

// ../node_modules/color-support/index.js
var vo = c((WE, xo) => {
  xo.exports = bo({ alwaysReturn: !0 }, bo);
  function Xe(t, e) {
    return t.level = 0, t.hasBasic = !1, t.has256 = !1, t.has16m = !1, e.alwaysReturn ? t : !1;
  }
  s(Xe, "hasNone");
  function Fr(t) {
    return t.hasBasic = !0, t.has256 = !1, t.has16m = !1, t.level = 1, t;
  }
  s(Fr, "hasBasic");
  function Qe(t) {
    return t.hasBasic = !0, t.has256 = !0, t.has16m = !1, t.level = 2, t;
  }
  s(Qe, "has256");
  function Cr(t) {
    return t.hasBasic = !0, t.has256 = !0, t.has16m = !0, t.level = 3, t;
  }
  s(Cr, "has16m");
  function bo(t, e) {
    if (t = t || {}, e = e || {}, typeof t.level == "number")
      switch (t.level) {
        case 0:
          return Xe(e, t);
        case 1:
          return Fr(e);
        case 2:
          return Qe(e);
        case 3:
          return Cr(e);
      }
    if (e.level = 0, e.hasBasic = !1, e.has256 = !1, e.has16m = !1, typeof process > "u" || !process || !process.stdout || !process.env || !process.
    platform)
      return Xe(e, t);
    var r = t.env || process.env, u = t.stream || process.stdout, n = t.term || r.TERM || "", o = t.platform || process.platform;
    if (!t.ignoreTTY && !u.isTTY || !t.ignoreDumb && n === "dumb" && !r.COLORTERM)
      return Xe(e, t);
    if (o === "win32")
      return Fr(e);
    if (r.TMUX)
      return Qe(e);
    if (!t.ignoreCI && (r.CI || r.TEAMCITY_VERSION))
      return r.TRAVIS ? Qe(e) : Xe(e, t);
    switch (r.TERM_PROGRAM) {
      case "iTerm.app":
        var i = r.TERM_PROGRAM_VERSION || "0.";
        return /^[0-2]\./.test(i) ? Qe(e) : Cr(e);
      case "HyperTerm":
      case "Hyper":
        return Cr(e);
      case "MacTerm":
        return Cr(e);
      case "Apple_Terminal":
        return Qe(e);
    }
    return /^xterm-256/.test(n) ? Qe(e) : /^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(n) || r.COLORTERM ? Fr(e) : Xe(e, t);
  }
  s(bo, "colorSupport");
});

// ../node_modules/gauge/lib/has-color.js
var Bo = c((UE, yo) => {
  "use strict";
  var Z0 = vo();
  yo.exports = Z0().hasBasic;
});

// ../node_modules/gauge/node_modules/signal-exit/dist/mjs/signals.js
var be, wo = _n(() => {
  be = [];
  be.push("SIGHUP", "SIGINT", "SIGTERM");
  process.platform !== "win32" && be.push(
    "SIGALRM",
    "SIGABRT",
    "SIGVTALRM",
    "SIGXCPU",
    "SIGXFSZ",
    "SIGUSR2",
    "SIGTRAP",
    "SIGSYS",
    "SIGQUIT",
    "SIGIOT"
    // should detect profiler and enable/disable accordingly.
    // see #21
    // 'SIGPROF'
  );
  process.platform === "linux" && be.push("SIGIO", "SIGPOLL", "SIGPWR", "SIGSTKFLT");
});

// ../node_modules/gauge/node_modules/signal-exit/dist/mjs/index.js
var Ao = {};
wt(Ao, {
  load: () => ep,
  onExit: () => Q0,
  signals: () => be,
  unload: () => tp
});
var Er, ku, Pu, J0, Mu, br, X0, Ru, qu, Nu, Q0, ep, tp, So = _n(() => {
  wo();
  Er = /* @__PURE__ */ s((t) => !!t && typeof t == "object" && typeof t.removeListener == "function" && typeof t.emit == "function" && typeof t.
  reallyExit == "function" && typeof t.listeners == "function" && typeof t.kill == "function" && typeof t.pid == "number" && typeof t.on == "\
function", "processOk"), ku = Symbol.for("signal-exit emitter"), Pu = globalThis, J0 = Object.defineProperty.bind(Object), Mu = class {
    static {
      s(this, "Emitter");
    }
    emitted = {
      afterExit: !1,
      exit: !1
    };
    listeners = {
      afterExit: [],
      exit: []
    };
    count = 0;
    id = Math.random();
    constructor() {
      if (Pu[ku])
        return Pu[ku];
      J0(Pu, ku, {
        value: this,
        writable: !1,
        enumerable: !1,
        configurable: !1
      });
    }
    on(e, r) {
      this.listeners[e].push(r);
    }
    removeListener(e, r) {
      let u = this.listeners[e], n = u.indexOf(r);
      n !== -1 && (n === 0 && u.length === 1 ? u.length = 0 : u.splice(n, 1));
    }
    emit(e, r, u) {
      if (this.emitted[e])
        return !1;
      this.emitted[e] = !0;
      let n = !1;
      for (let o of this.listeners[e])
        n = o(r, u) === !0 || n;
      return e === "exit" && (n = this.emit("afterExit", r, u) || n), n;
    }
  }, br = class {
    static {
      s(this, "SignalExitBase");
    }
  }, X0 = /* @__PURE__ */ s((t) => ({
    onExit(e, r) {
      return t.onExit(e, r);
    },
    load() {
      return t.load();
    },
    unload() {
      return t.unload();
    }
  }), "signalExitWrap"), Ru = class extends br {
    static {
      s(this, "SignalExitFallback");
    }
    onExit() {
      return () => {
      };
    }
    load() {
    }
    unload() {
    }
  }, qu = class extends br {
    static {
      s(this, "SignalExit");
    }
    // "SIGHUP" throws an `ENOSYS` error on Windows,
    // so use a supported signal instead
    /* c8 ignore start */
    #u = Nu.platform === "win32" ? "SIGINT" : "SIGHUP";
    /* c8 ignore stop */
    #t = new Mu();
    #e;
    #s;
    #n;
    #i = {};
    #r = !1;
    constructor(e) {
      super(), this.#e = e, this.#i = {};
      for (let r of be)
        this.#i[r] = () => {
          let u = this.#e.listeners(r), { count: n } = this.#t, o = e;
          if (typeof o.__signal_exit_emitter__ == "object" && typeof o.__signal_exit_emitter__.count == "number" && (n += o.__signal_exit_emitter__.
          count), u.length === n) {
            this.unload();
            let i = this.#t.emit("exit", null, r), D = r === "SIGHUP" ? this.#u : r;
            i || e.kill(e.pid, D);
          }
        };
      this.#n = e.reallyExit, this.#s = e.emit;
    }
    onExit(e, r) {
      if (!Er(this.#e))
        return () => {
        };
      this.#r === !1 && this.load();
      let u = r?.alwaysLast ? "afterExit" : "exit";
      return this.#t.on(u, e), () => {
        this.#t.removeListener(u, e), this.#t.listeners.exit.length === 0 && this.#t.listeners.afterExit.length === 0 && this.unload();
      };
    }
    load() {
      if (!this.#r) {
        this.#r = !0, this.#t.count += 1;
        for (let e of be)
          try {
            let r = this.#i[e];
            r && this.#e.on(e, r);
          } catch {
          }
        this.#e.emit = (e, ...r) => this.#D(e, ...r), this.#e.reallyExit = (e) => this.#o(e);
      }
    }
    unload() {
      this.#r && (this.#r = !1, be.forEach((e) => {
        let r = this.#i[e];
        if (!r)
          throw new Error("Listener not defined for signal: " + e);
        try {
          this.#e.removeListener(e, r);
        } catch {
        }
      }), this.#e.emit = this.#s, this.#e.reallyExit = this.#n, this.#t.count -= 1);
    }
    #o(e) {
      return Er(this.#e) ? (this.#e.exitCode = e || 0, this.#t.emit("exit", this.#e.exitCode, null), this.#n.call(this.#e, this.#e.exitCode)) :
      0;
    }
    #D(e, ...r) {
      let u = this.#s;
      if (e === "exit" && Er(this.#e)) {
        typeof r[0] == "number" && (this.#e.exitCode = r[0]);
        let n = u.call(this.#e, e, ...r);
        return this.#t.emit("exit", this.#e.exitCode, null), n;
      } else
        return u.call(this.#e, e, ...r);
    }
  }, Nu = globalThis.process, {
    onExit: (
      /**
       * Called when the process is exiting, whether via signal, explicit
       * exit, or running out of stuff to do.
       *
       * If the global process object is not suitable for instrumentation,
       * then this will be a no-op.
       *
       * Returns a function that may be used to unload signal-exit.
       */
      Q0
    ),
    load: (
      /**
       * Load the listeners.  Likely you never need to call this, unless
       * doing a rather deep integration with signal-exit functionality.
       * Mostly exposed for the benefit of testing.
       *
       * @internal
       */
      ep
    ),
    unload: (
      /**
       * Unload the listeners.  Likely you never need to call this, unless
       * doing a rather deep integration with signal-exit functionality.
       * Mostly exposed for the benefit of testing.
       *
       * @internal
       */
      tp
    )
  } = X0(Er(Nu) ? new qu(Nu) : new Ru());
});

// ../node_modules/gauge/lib/spin.js
var $o = c((KE, To) => {
  "use strict";
  To.exports = /* @__PURE__ */ s(function(e, r) {
    return e[r % e.length];
  }, "spin");
});

// ../node_modules/gauge/lib/progress-bar.js
var Io = c((JE, _o) => {
  "use strict";
  var rp = pr(), up = Lu(), ip = Ou(), sp = Ke();
  _o.exports = function(t, e, r) {
    if (rp("ONN", [t, e, r]), r < 0 && (r = 0), r > 1 && (r = 1), e <= 0)
      return "";
    var u = Math.round(e * r), n = e - u, o = [
      { type: "complete", value: Oo(t.complete, u), length: u },
      { type: "remaining", value: Oo(t.remaining, n), length: n }
    ];
    return up(e, o, t);
  };
  function Oo(t, e) {
    var r = "", u = e;
    do
      u % 2 && (r += t), u = Math.floor(u / 2), t += t;
    while (u && sp(r) < e);
    return ip(r, e);
  }
  s(Oo, "repeat");
});

// ../node_modules/gauge/lib/base-theme.js
var ko = c((QE, Lo) => {
  "use strict";
  var np = $o(), op = Io();
  Lo.exports = {
    activityIndicator: /* @__PURE__ */ s(function(t, e) {
      if (t.spun != null)
        return np(e, t.spun);
    }, "activityIndicator"),
    progressbar: /* @__PURE__ */ s(function(t, e, r) {
      if (t.completed != null)
        return op(e, r, t.completed);
    }, "progressbar")
  };
});

// ../node_modules/gauge/lib/theme-set.js
var Mo = c((t8, Po) => {
  "use strict";
  Po.exports = function() {
    return H.newThemeSet();
  };
  var H = {};
  H.baseTheme = ko();
  H.newTheme = function(t, e) {
    return e || (e = t, t = this.baseTheme), Object.assign({}, t, e);
  };
  H.getThemeNames = function() {
    return Object.keys(this.themes);
  };
  H.addTheme = function(t, e, r) {
    this.themes[t] = this.newTheme(e, r);
  };
  H.addToAllThemes = function(t) {
    var e = this.themes;
    Object.keys(e).forEach(function(r) {
      Object.assign(e[r], t);
    }), Object.assign(this.baseTheme, t);
  };
  H.getTheme = function(t) {
    if (!this.themes[t])
      throw this.newMissingThemeError(t);
    return this.themes[t];
  };
  H.setDefault = function(t, e) {
    e == null && (e = t, t = {});
    var r = t.platform == null ? "fallback" : t.platform, u = !!t.hasUnicode, n = !!t.hasColor;
    this.defaults[r] || (this.defaults[r] = { true: {}, false: {} }), this.defaults[r][u][n] = e;
  };
  H.getDefault = function(t) {
    t || (t = {});
    var e = t.platform || process.platform, r = this.defaults[e] || this.defaults.fallback, u = !!t.hasUnicode, n = !!t.hasColor;
    if (!r)
      throw this.newMissingDefaultThemeError(e, u, n);
    if (!r[u][n]) {
      if (u && n && r[!u][n])
        u = !1;
      else if (u && n && r[u][!n])
        n = !1;
      else if (u && n && r[!u][!n])
        u = !1, n = !1;
      else if (u && !n && r[!u][n])
        u = !1;
      else if (!u && n && r[u][!n])
        n = !1;
      else if (r === this.defaults.fallback)
        throw this.newMissingDefaultThemeError(e, u, n);
    }
    return r[u][n] ? this.getTheme(r[u][n]) : this.getDefault(Object.assign({}, t, { platform: "fallback" }));
  };
  H.newMissingThemeError = /* @__PURE__ */ s(function t(e) {
    var r = new Error('Could not find a gauge theme named "' + e + '"');
    return Error.captureStackTrace.call(r, t), r.theme = e, r.code = "EMISSINGTHEME", r;
  }, "newMissingThemeError");
  H.newMissingDefaultThemeError = /* @__PURE__ */ s(function t(e, r, u) {
    var n = new Error(
      `Could not find a gauge theme for your platform/unicode/color use combo:
    platform = ` + e + `
    hasUnicode = ` + r + `
    hasColor = ` + u
    );
    return Error.captureStackTrace.call(n, t), n.platform = e, n.hasUnicode = r, n.hasColor = u, n.code = "EMISSINGTHEME", n;
  }, "newMissingDefaultThemeError");
  H.newThemeSet = function() {
    var t = /* @__PURE__ */ s(function(e) {
      return t.getDefault(e);
    }, "themeset");
    return Object.assign(t, H, {
      themes: Object.assign({}, this.themes),
      baseTheme: Object.assign({}, this.baseTheme),
      defaults: JSON.parse(JSON.stringify(this.defaults || {}))
    });
  };
});

// ../node_modules/gauge/lib/themes.js
var qo = c((u8, Ro) => {
  "use strict";
  var xe = hr().color, Dp = Mo(), K = Ro.exports = new Dp();
  K.addTheme("ASCII", {
    preProgressbar: "[",
    postProgressbar: "]",
    progressbarTheme: {
      complete: "#",
      remaining: "."
    },
    activityIndicatorTheme: "-\\|/",
    preSubsection: ">"
  });
  K.addTheme("colorASCII", K.getTheme("ASCII"), {
    progressbarTheme: {
      preComplete: xe("bgBrightWhite", "brightWhite"),
      complete: "#",
      postComplete: xe("reset"),
      preRemaining: xe("bgBrightBlack", "brightBlack"),
      remaining: ".",
      postRemaining: xe("reset")
    }
  });
  K.addTheme("brailleSpinner", {
    preProgressbar: "(",
    postProgressbar: ")",
    progressbarTheme: {
      complete: "#",
      remaining: "\u2802"
    },
    activityIndicatorTheme: "\u280B\u2819\u2839\u2838\u283C\u2834\u2826\u2827\u2807\u280F",
    preSubsection: ">"
  });
  K.addTheme("colorBrailleSpinner", K.getTheme("brailleSpinner"), {
    progressbarTheme: {
      preComplete: xe("bgBrightWhite", "brightWhite"),
      complete: "#",
      postComplete: xe("reset"),
      preRemaining: xe("bgBrightBlack", "brightBlack"),
      remaining: "\u2802",
      postRemaining: xe("reset")
    }
  });
  K.setDefault({}, "ASCII");
  K.setDefault({ hasColor: !0 }, "colorASCII");
  K.setDefault({ platform: "darwin", hasUnicode: !0 }, "brailleSpinner");
  K.setDefault({ platform: "darwin", hasUnicode: !0, hasColor: !0 }, "colorBrailleSpinner");
  K.setDefault({ platform: "linux", hasUnicode: !0 }, "brailleSpinner");
  K.setDefault({ platform: "linux", hasUnicode: !0, hasColor: !0 }, "colorBrailleSpinner");
});

// ../node_modules/gauge/lib/set-interval.js
var jo = c((i8, No) => {
  "use strict";
  No.exports = setInterval;
});

// ../node_modules/gauge/lib/process.js
var ju = c((s8, Go) => {
  "use strict";
  Go.exports = process;
});

// ../node_modules/gauge/lib/set-immediate.js
var Wo = c((n8, Gu) => {
  "use strict";
  var ap = ju();
  try {
    Gu.exports = setImmediate;
  } catch {
    Gu.exports = ap.nextTick;
  }
});

// ../node_modules/gauge/lib/index.js
var Uo = c((o8, Vo) => {
  "use strict";
  var lp = Fo(), hp = Eo(), cp = Bo(), dp = (So(), Ln(Ao)).onExit, fp = qo(), pp = jo(), Pe = ju(), mp = Wo();
  Vo.exports = P;
  function xr(t, e) {
    return function() {
      return e.call(t);
    };
  }
  s(xr, "callWith");
  function P(t, e) {
    var r, u;
    t && t.write ? (u = t, r = e || {}) : e && e.write ? (u = e, r = t || {}) : (u = Pe.stderr, r = t || e || {}), this._status = {
      spun: 0,
      section: "",
      subsection: ""
    }, this._paused = !1, this._disabled = !0, this._showing = !1, this._onScreen = !1, this._needsRedraw = !1, this._hideCursor = r.hideCursor ==
    null ? !0 : r.hideCursor, this._fixedFramerate = r.fixedFramerate == null ? !/^v0\.8\./.test(Pe.version) : r.fixedFramerate, this._lastUpdateAt =
    null, this._updateInterval = r.updateInterval == null ? 50 : r.updateInterval, this._themes = r.themes || fp, this._theme = r.theme;
    var n = this._computeTheme(r.theme), o = r.template || [
      { type: "progressbar", length: 20 },
      { type: "activityIndicator", kerning: 1, length: 1 },
      { type: "section", kerning: 1, default: "" },
      { type: "subsection", kerning: 1, default: "" }
    ];
    this.setWriteTo(u, r.tty);
    var i = r.Plumbing || lp;
    this._gauge = new i(n, o, this.getWidth()), this._$$doRedraw = xr(this, this._doRedraw), this._$$handleSizeChange = xr(this, this._handleSizeChange),
    this._cleanupOnExit = r.cleanupOnExit == null || r.cleanupOnExit, this._removeOnExit = null, r.enabled || r.enabled == null && this._tty &&
    this._tty.isTTY ? this.enable() : this.disable();
  }
  s(P, "Gauge");
  P.prototype = {};
  P.prototype.isEnabled = function() {
    return !this._disabled;
  };
  P.prototype.setTemplate = function(t) {
    this._gauge.setTemplate(t), this._showing && this._requestRedraw();
  };
  P.prototype._computeTheme = function(t) {
    if (t || (t = {}), typeof t == "string")
      t = this._themes.getTheme(t);
    else if (Object.keys(t).length === 0 || t.hasUnicode != null || t.hasColor != null) {
      var e = t.hasUnicode == null ? hp() : t.hasUnicode, r = t.hasColor == null ? cp : t.hasColor;
      t = this._themes.getDefault({
        hasUnicode: e,
        hasColor: r,
        platform: t.platform
      });
    }
    return t;
  };
  P.prototype.setThemeset = function(t) {
    this._themes = t, this.setTheme(this._theme);
  };
  P.prototype.setTheme = function(t) {
    this._gauge.setTheme(this._computeTheme(t)), this._showing && this._requestRedraw(), this._theme = t;
  };
  P.prototype._requestRedraw = function() {
    this._needsRedraw = !0, this._fixedFramerate || this._doRedraw();
  };
  P.prototype.getWidth = function() {
    return (this._tty && this._tty.columns || 80) - 1;
  };
  P.prototype.setWriteTo = function(t, e) {
    var r = !this._disabled;
    r && this.disable(), this._writeTo = t, this._tty = e || t === Pe.stderr && Pe.stdout.isTTY && Pe.stdout || t.isTTY && t || this._tty, this.
    _gauge && this._gauge.setWidth(this.getWidth()), r && this.enable();
  };
  P.prototype.enable = function() {
    this._disabled && (this._disabled = !1, this._tty && this._enableEvents(), this._showing && this.show());
  };
  P.prototype.disable = function() {
    this._disabled || (this._showing && (this._lastUpdateAt = null, this._showing = !1, this._doRedraw(), this._showing = !0), this._disabled =
    !0, this._tty && this._disableEvents());
  };
  P.prototype._enableEvents = function() {
    this._cleanupOnExit && (this._removeOnExit = dp(xr(this, this.disable))), this._tty.on("resize", this._$$handleSizeChange), this._fixedFramerate &&
    (this.redrawTracker = pp(this._$$doRedraw, this._updateInterval), this.redrawTracker.unref && this.redrawTracker.unref());
  };
  P.prototype._disableEvents = function() {
    this._tty.removeListener("resize", this._$$handleSizeChange), this._fixedFramerate && clearInterval(this.redrawTracker), this._removeOnExit &&
    this._removeOnExit();
  };
  P.prototype.hide = function(t) {
    if (this._disabled || !this._showing)
      return t && Pe.nextTick(t);
    this._showing = !1, this._doRedraw(), t && mp(t);
  };
  P.prototype.show = function(t, e) {
    if (this._showing = !0, typeof t == "string")
      this._status.section = t;
    else if (typeof t == "object")
      for (var r = Object.keys(t), u = 0; u < r.length; ++u) {
        var n = r[u];
        this._status[n] = t[n];
      }
    e != null && (this._status.completed = e), !this._disabled && this._requestRedraw();
  };
  P.prototype.pulse = function(t) {
    this._status.subsection = t || "", this._status.spun++, !this._disabled && this._showing && this._requestRedraw();
  };
  P.prototype._handleSizeChange = function() {
    this._gauge.setWidth(this._tty.columns - 1), this._requestRedraw();
  };
  P.prototype._doRedraw = function() {
    if (!(this._disabled || this._paused)) {
      if (!this._fixedFramerate) {
        var t = Date.now();
        if (this._lastUpdateAt && t - this._lastUpdateAt < this._updateInterval)
          return;
        this._lastUpdateAt = t;
      }
      if (!this._showing && this._onScreen) {
        this._onScreen = !1;
        var e = this._gauge.hide();
        return this._hideCursor && (e += this._gauge.showCursor()), this._writeTo.write(e);
      }
      !this._showing && !this._onScreen || (this._showing && !this._onScreen && (this._onScreen = !0, this._needsRedraw = !0, this._hideCursor &&
      this._writeTo.write(this._gauge.hideCursor())), this._needsRedraw && (this._writeTo.write(this._gauge.show(this._status)) || (this._paused =
      !0, this._writeTo.on("drain", xr(this, function() {
        this._paused = !1, this._doRedraw();
      })))));
    }
  };
});

// ../node_modules/set-blocking/index.js
var Ho = c((a8, Yo) => {
  Yo.exports = function(t) {
    [process.stdout, process.stderr].forEach(function(e) {
      e._handle && e.isTTY && typeof e._handle.setBlocking == "function" && e._handle.setBlocking(t);
    });
  };
});

// ../node_modules/npmlog/lib/log.js
var Xo = c((Zo, Jo) => {
  "use strict";
  var zo = jn(), gp = Uo(), Fp = require("events").EventEmitter, C = Zo = Jo.exports = new Fp(), Wu = require("util"), Cp = Ho(), Vu = hr();
  Cp(!0);
  var he = process.stderr;
  Object.defineProperty(C, "stream", {
    set: /* @__PURE__ */ s(function(t) {
      he = t, this.gauge && this.gauge.setWriteTo(he, he);
    }, "set"),
    get: /* @__PURE__ */ s(function() {
      return he;
    }, "get")
  });
  var et;
  C.useColor = function() {
    return et ?? he.isTTY;
  };
  C.enableColor = function() {
    et = !0, this.gauge.setTheme({ hasColor: et, hasUnicode: tt });
  };
  C.disableColor = function() {
    et = !1, this.gauge.setTheme({ hasColor: et, hasUnicode: tt });
  };
  C.level = "info";
  C.gauge = new gp(he, {
    enabled: !1,
    // no progress bars unless asked
    theme: { hasColor: C.useColor() },
    template: [
      { type: "progressbar", length: 20 },
      { type: "activityIndicator", kerning: 1, length: 1 },
      { type: "section", default: "" },
      ":",
      { type: "logline", kerning: 1, default: "" }
    ]
  });
  C.tracker = new zo.TrackerGroup();
  C.progressEnabled = C.gauge.isEnabled();
  var tt;
  C.enableUnicode = function() {
    tt = !0, this.gauge.setTheme({ hasColor: this.useColor(), hasUnicode: tt });
  };
  C.disableUnicode = function() {
    tt = !1, this.gauge.setTheme({ hasColor: this.useColor(), hasUnicode: tt });
  };
  C.setGaugeThemeset = function(t) {
    this.gauge.setThemeset(t);
  };
  C.setGaugeTemplate = function(t) {
    this.gauge.setTemplate(t);
  };
  C.enableProgress = function() {
    this.progressEnabled || this._paused || (this.progressEnabled = !0, this.tracker.on("change", this.showProgress), this.gauge.enable());
  };
  C.disableProgress = function() {
    this.progressEnabled && (this.progressEnabled = !1, this.tracker.removeListener("change", this.showProgress), this.gauge.disable());
  };
  var Uu = ["newGroup", "newItem", "newStream"], Ko = /* @__PURE__ */ s(function(t) {
    return Object.keys(C).forEach(function(e) {
      if (e[0] !== "_" && !Uu.filter(function(u) {
        return u === e;
      }).length && !t[e] && typeof C[e] == "function") {
        var r = C[e];
        t[e] = function() {
          return r.apply(C, arguments);
        };
      }
    }), t instanceof zo.TrackerGroup && Uu.forEach(function(e) {
      var r = t[e];
      t[e] = function() {
        return Ko(r.apply(t, arguments));
      };
    }), t;
  }, "mixinLog");
  Uu.forEach(function(t) {
    C[t] = function() {
      return Ko(this.tracker[t].apply(this.tracker, arguments));
    };
  });
  C.clearProgress = function(t) {
    if (!this.progressEnabled)
      return t && process.nextTick(t);
    this.gauge.hide(t);
  };
  C.showProgress = function(t, e) {
    if (this.progressEnabled) {
      var r = {};
      t && (r.section = t);
      var u = C.record[C.record.length - 1];
      if (u) {
        r.subsection = u.prefix;
        var n = C.disp[u.level] || u.level, o = this._format(n, C.style[u.level]);
        u.prefix && (o += " " + this._format(u.prefix, this.prefixStyle)), o += " " + u.message.split(/\r?\n/)[0], r.logline = o;
      }
      r.completed = e || this.tracker.completed(), this.gauge.show(r);
    }
  }.bind(C);
  C.pause = function() {
    this._paused = !0, this.progressEnabled && this.gauge.disable();
  };
  C.resume = function() {
    if (this._paused) {
      this._paused = !1;
      var t = this._buffer;
      this._buffer = [], t.forEach(function(e) {
        this.emitLog(e);
      }, this), this.progressEnabled && this.gauge.enable();
    }
  };
  C._buffer = [];
  var Ep = 0;
  C.record = [];
  C.maxRecordSize = 1e4;
  C.log = function(t, e, r) {
    var u = this.levels[t];
    if (u === void 0)
      return this.emit("error", new Error(Wu.format(
        "Undefined log level: %j",
        t
      )));
    for (var n = new Array(arguments.length - 2), o = null, i = 2; i < arguments.length; i++) {
      var D = n[i - 2] = arguments[i];
      typeof D == "object" && D instanceof Error && D.stack && Object.defineProperty(D, "stack", {
        value: o = D.stack + "",
        enumerable: !0,
        writable: !0
      });
    }
    o && n.unshift(o + `
`), r = Wu.format.apply(Wu, n);
    var a = {
      id: Ep++,
      level: t,
      prefix: String(e || ""),
      message: r,
      messageRaw: n
    };
    this.emit("log", a), this.emit("log." + t, a), a.prefix && this.emit(a.prefix, a), this.record.push(a);
    var l = this.maxRecordSize, h = this.record.length - l;
    if (h > l / 10) {
      var p = Math.floor(l * 0.9);
      this.record = this.record.slice(-1 * p);
    }
    this.emitLog(a);
  }.bind(C);
  C.emitLog = function(t) {
    if (this._paused) {
      this._buffer.push(t);
      return;
    }
    this.progressEnabled && this.gauge.pulse(t.prefix);
    var e = this.levels[t.level];
    if (e !== void 0 && !(e < this.levels[this.level]) && !(e > 0 && !isFinite(e))) {
      var r = C.disp[t.level] != null ? C.disp[t.level] : t.level;
      this.clearProgress(), t.message.split(/\r?\n/).forEach(function(u) {
        var n = this.heading;
        n && (this.write(n, this.headingStyle), this.write(" ")), this.write(r, C.style[t.level]);
        var o = t.prefix || "";
        o && this.write(" "), this.write(o, this.prefixStyle), this.write(" " + u + `
`);
      }, this), this.showProgress();
    }
  };
  C._format = function(t, e) {
    if (he) {
      var r = "";
      if (this.useColor()) {
        e = e || {};
        var u = [];
        e.fg && u.push(e.fg), e.bg && u.push("bg" + e.bg[0].toUpperCase() + e.bg.slice(1)), e.bold && u.push("bold"), e.underline && u.push(
        "underline"), e.inverse && u.push("inverse"), u.length && (r += Vu.color(u)), e.beep && (r += Vu.beep());
      }
      return r += t, this.useColor() && (r += Vu.color("reset")), r;
    }
  };
  C.write = function(t, e) {
    he && he.write(this._format(t, e));
  };
  C.addLevel = function(t, e, r, u) {
    u == null && (u = t), this.levels[t] = e, this.style[t] = r, this[t] || (this[t] = function() {
      var n = new Array(arguments.length + 1);
      n[0] = t;
      for (var o = 0; o < arguments.length; o++)
        n[o + 1] = arguments[o];
      return this.log.apply(this, n);
    }.bind(this)), this.disp[t] = u;
  };
  C.prefixStyle = { fg: "magenta" };
  C.headingStyle = { fg: "white", bg: "black" };
  C.style = {};
  C.levels = {};
  C.disp = {};
  C.addLevel("silly", -1 / 0, { inverse: !0 }, "sill");
  C.addLevel("verbose", 1e3, { fg: "cyan", bg: "black" }, "verb");
  C.addLevel("info", 2e3, { fg: "green" });
  C.addLevel("timing", 2500, { fg: "green", bg: "black" });
  C.addLevel("http", 3e3, { fg: "green", bg: "black" });
  C.addLevel("notice", 3500, { fg: "cyan", bg: "black" });
  C.addLevel("warn", 4e3, { fg: "black", bg: "yellow" }, "WARN");
  C.addLevel("error", 5e3, { fg: "red", bg: "black" }, "ERR!");
  C.addLevel("silent", 1 / 0);
  C.on("error", function() {
  });
});

// ../node_modules/pretty-hrtime/index.js
var tD = c((h8, eD) => {
  "use strict";
  var bp = ["h", "min", "s", "ms", "\u03BCs", "ns"], xp = ["hour", "minute", "second", "millisecond", "microsecond", "nanosecond"], Qo = [3600,
  60, 1, 1e6, 1e3, 1];
  eD.exports = function(t, e) {
    var r, u, n, o, i, D, a, l, h, p;
    if (r = !1, u = !1, e && (r = e.verbose || !1, u = e.precise || !1), !Array.isArray(t) || t.length !== 2 || typeof t[0] != "number" || typeof t[1] !=
    "number")
      return "";
    for (t[1] < 0 && (p = t[0] + t[1] / 1e9, t[0] = parseInt(p), t[1] = parseFloat((p % 1).toPrecision(9)) * 1e9), h = "", n = 0; n < 6 && (o =
    n < 3 ? 0 : 1, i = t[o], n !== 3 && n !== 0 && (i = i % Qo[n - 1]), n === 2 && (i += t[1] / 1e9), D = i / Qo[n], !(D >= 1 && (r && (D = Math.
    floor(D)), u ? l = D.toString() : (a = D >= 10 ? 0 : 2, l = D.toFixed(a)), l.indexOf(".") > -1 && l[l.length - 1] === "0" && (l = l.replace(
    /\.?0+$/, "")), h && (h += " "), h += l, r ? (h += " " + xp[n], l !== "1" && (h += "s")) : h += " " + bp[n], !r))); n++)
      ;
    return h;
  };
});

// ../node_modules/sisteransi/src/index.js
var S = c((c8, rD) => {
  "use strict";
  var Yu = "\x1B", I = `${Yu}[`, vp = "\x07", Hu = {
    to(t, e) {
      return e ? `${I}${e + 1};${t + 1}H` : `${I}${t + 1}G`;
    },
    move(t, e) {
      let r = "";
      return t < 0 ? r += `${I}${-t}D` : t > 0 && (r += `${I}${t}C`), e < 0 ? r += `${I}${-e}A` : e > 0 && (r += `${I}${e}B`), r;
    },
    up: /* @__PURE__ */ s((t = 1) => `${I}${t}A`, "up"),
    down: /* @__PURE__ */ s((t = 1) => `${I}${t}B`, "down"),
    forward: /* @__PURE__ */ s((t = 1) => `${I}${t}C`, "forward"),
    backward: /* @__PURE__ */ s((t = 1) => `${I}${t}D`, "backward"),
    nextLine: /* @__PURE__ */ s((t = 1) => `${I}E`.repeat(t), "nextLine"),
    prevLine: /* @__PURE__ */ s((t = 1) => `${I}F`.repeat(t), "prevLine"),
    left: `${I}G`,
    hide: `${I}?25l`,
    show: `${I}?25h`,
    save: `${Yu}7`,
    restore: `${Yu}8`
  }, yp = {
    up: /* @__PURE__ */ s((t = 1) => `${I}S`.repeat(t), "up"),
    down: /* @__PURE__ */ s((t = 1) => `${I}T`.repeat(t), "down")
  }, Bp = {
    screen: `${I}2J`,
    up: /* @__PURE__ */ s((t = 1) => `${I}1J`.repeat(t), "up"),
    down: /* @__PURE__ */ s((t = 1) => `${I}J`.repeat(t), "down"),
    line: `${I}2K`,
    lineEnd: `${I}K`,
    lineStart: `${I}1K`,
    lines(t) {
      let e = "";
      for (let r = 0; r < t; r++)
        e += this.line + (r < t - 1 ? Hu.up() : "");
      return t && (e += Hu.left), e;
    }
  };
  rD.exports = { cursor: Hu, scroll: yp, erase: Bp, beep: vp };
});

// ../node_modules/picocolors/picocolors.js
var rt = c((f8, zu) => {
  var yr = process || {}, uD = yr.argv || [], vr = yr.env || {}, wp = !(vr.NO_COLOR || uD.includes("--no-color")) && (!!vr.FORCE_COLOR || uD.
  includes("--color") || yr.platform === "win32" || (yr.stdout || {}).isTTY && vr.TERM !== "dumb" || !!vr.CI), Ap = /* @__PURE__ */ s((t, e, r = t) => (u) => {
    let n = "" + u, o = n.indexOf(e, t.length);
    return ~o ? t + Sp(n, e, r, o) + e : t + n + e;
  }, "formatter"), Sp = /* @__PURE__ */ s((t, e, r, u) => {
    let n = "", o = 0;
    do
      n += t.substring(o, u) + r, o = u + e.length, u = t.indexOf(e, o);
    while (~u);
    return n + t.substring(o);
  }, "replaceClose"), iD = /* @__PURE__ */ s((t = wp) => {
    let e = t ? Ap : () => String;
    return {
      isColorSupported: t,
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
  zu.exports = iD();
  zu.exports.createColors = iD;
});

// ../node_modules/eastasianwidth/eastasianwidth.js
var ai = c((j8, Di) => {
  var we = {};
  typeof Di > "u" ? window.eastasianwidth = we : Di.exports = we;
  we.eastAsianWidth = function(t) {
    var e = t.charCodeAt(0), r = t.length == 2 ? t.charCodeAt(1) : 0, u = e;
    return 55296 <= e && e <= 56319 && 56320 <= r && r <= 57343 && (e &= 1023, r &= 1023, u = e << 10 | r, u += 65536), u == 12288 || 65281 <=
    u && u <= 65376 || 65504 <= u && u <= 65510 ? "F" : u == 8361 || 65377 <= u && u <= 65470 || 65474 <= u && u <= 65479 || 65482 <= u && u <=
    65487 || 65490 <= u && u <= 65495 || 65498 <= u && u <= 65500 || 65512 <= u && u <= 65518 ? "H" : 4352 <= u && u <= 4447 || 4515 <= u &&
    u <= 4519 || 4602 <= u && u <= 4607 || 9001 <= u && u <= 9002 || 11904 <= u && u <= 11929 || 11931 <= u && u <= 12019 || 12032 <= u && u <=
    12245 || 12272 <= u && u <= 12283 || 12289 <= u && u <= 12350 || 12353 <= u && u <= 12438 || 12441 <= u && u <= 12543 || 12549 <= u && u <=
    12589 || 12593 <= u && u <= 12686 || 12688 <= u && u <= 12730 || 12736 <= u && u <= 12771 || 12784 <= u && u <= 12830 || 12832 <= u && u <=
    12871 || 12880 <= u && u <= 13054 || 13056 <= u && u <= 19903 || 19968 <= u && u <= 42124 || 42128 <= u && u <= 42182 || 43360 <= u && u <=
    43388 || 44032 <= u && u <= 55203 || 55216 <= u && u <= 55238 || 55243 <= u && u <= 55291 || 63744 <= u && u <= 64255 || 65040 <= u && u <=
    65049 || 65072 <= u && u <= 65106 || 65108 <= u && u <= 65126 || 65128 <= u && u <= 65131 || 110592 <= u && u <= 110593 || 127488 <= u &&
    u <= 127490 || 127504 <= u && u <= 127546 || 127552 <= u && u <= 127560 || 127568 <= u && u <= 127569 || 131072 <= u && u <= 194367 || 177984 <=
    u && u <= 196605 || 196608 <= u && u <= 262141 ? "W" : 32 <= u && u <= 126 || 162 <= u && u <= 163 || 165 <= u && u <= 166 || u == 172 ||
    u == 175 || 10214 <= u && u <= 10221 || 10629 <= u && u <= 10630 ? "Na" : u == 161 || u == 164 || 167 <= u && u <= 168 || u == 170 || 173 <=
    u && u <= 174 || 176 <= u && u <= 180 || 182 <= u && u <= 186 || 188 <= u && u <= 191 || u == 198 || u == 208 || 215 <= u && u <= 216 ||
    222 <= u && u <= 225 || u == 230 || 232 <= u && u <= 234 || 236 <= u && u <= 237 || u == 240 || 242 <= u && u <= 243 || 247 <= u && u <=
    250 || u == 252 || u == 254 || u == 257 || u == 273 || u == 275 || u == 283 || 294 <= u && u <= 295 || u == 299 || 305 <= u && u <= 307 ||
    u == 312 || 319 <= u && u <= 322 || u == 324 || 328 <= u && u <= 331 || u == 333 || 338 <= u && u <= 339 || 358 <= u && u <= 359 || u ==
    363 || u == 462 || u == 464 || u == 466 || u == 468 || u == 470 || u == 472 || u == 474 || u == 476 || u == 593 || u == 609 || u == 708 ||
    u == 711 || 713 <= u && u <= 715 || u == 717 || u == 720 || 728 <= u && u <= 731 || u == 733 || u == 735 || 768 <= u && u <= 879 || 913 <=
    u && u <= 929 || 931 <= u && u <= 937 || 945 <= u && u <= 961 || 963 <= u && u <= 969 || u == 1025 || 1040 <= u && u <= 1103 || u == 1105 ||
    u == 8208 || 8211 <= u && u <= 8214 || 8216 <= u && u <= 8217 || 8220 <= u && u <= 8221 || 8224 <= u && u <= 8226 || 8228 <= u && u <= 8231 ||
    u == 8240 || 8242 <= u && u <= 8243 || u == 8245 || u == 8251 || u == 8254 || u == 8308 || u == 8319 || 8321 <= u && u <= 8324 || u == 8364 ||
    u == 8451 || u == 8453 || u == 8457 || u == 8467 || u == 8470 || 8481 <= u && u <= 8482 || u == 8486 || u == 8491 || 8531 <= u && u <= 8532 ||
    8539 <= u && u <= 8542 || 8544 <= u && u <= 8555 || 8560 <= u && u <= 8569 || u == 8585 || 8592 <= u && u <= 8601 || 8632 <= u && u <= 8633 ||
    u == 8658 || u == 8660 || u == 8679 || u == 8704 || 8706 <= u && u <= 8707 || 8711 <= u && u <= 8712 || u == 8715 || u == 8719 || u == 8721 ||
    u == 8725 || u == 8730 || 8733 <= u && u <= 8736 || u == 8739 || u == 8741 || 8743 <= u && u <= 8748 || u == 8750 || 8756 <= u && u <= 8759 ||
    8764 <= u && u <= 8765 || u == 8776 || u == 8780 || u == 8786 || 8800 <= u && u <= 8801 || 8804 <= u && u <= 8807 || 8810 <= u && u <= 8811 ||
    8814 <= u && u <= 8815 || 8834 <= u && u <= 8835 || 8838 <= u && u <= 8839 || u == 8853 || u == 8857 || u == 8869 || u == 8895 || u == 8978 ||
    9312 <= u && u <= 9449 || 9451 <= u && u <= 9547 || 9552 <= u && u <= 9587 || 9600 <= u && u <= 9615 || 9618 <= u && u <= 9621 || 9632 <=
    u && u <= 9633 || 9635 <= u && u <= 9641 || 9650 <= u && u <= 9651 || 9654 <= u && u <= 9655 || 9660 <= u && u <= 9661 || 9664 <= u && u <=
    9665 || 9670 <= u && u <= 9672 || u == 9675 || 9678 <= u && u <= 9681 || 9698 <= u && u <= 9701 || u == 9711 || 9733 <= u && u <= 9734 ||
    u == 9737 || 9742 <= u && u <= 9743 || 9748 <= u && u <= 9749 || u == 9756 || u == 9758 || u == 9792 || u == 9794 || 9824 <= u && u <= 9825 ||
    9827 <= u && u <= 9829 || 9831 <= u && u <= 9834 || 9836 <= u && u <= 9837 || u == 9839 || 9886 <= u && u <= 9887 || 9918 <= u && u <= 9919 ||
    9924 <= u && u <= 9933 || 9935 <= u && u <= 9953 || u == 9955 || 9960 <= u && u <= 9983 || u == 10045 || u == 10071 || 10102 <= u && u <=
    10111 || 11093 <= u && u <= 11097 || 12872 <= u && u <= 12879 || 57344 <= u && u <= 63743 || 65024 <= u && u <= 65039 || u == 65533 || 127232 <=
    u && u <= 127242 || 127248 <= u && u <= 127277 || 127280 <= u && u <= 127337 || 127344 <= u && u <= 127386 || 917760 <= u && u <= 917999 ||
    983040 <= u && u <= 1048573 || 1048576 <= u && u <= 1114109 ? "A" : "N";
  };
  we.characterLength = function(t) {
    var e = this.eastAsianWidth(t);
    return e == "F" || e == "W" || e == "A" ? 2 : 1;
  };
  function GD(t) {
    return t.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\uD800-\uDFFF]/g) || [];
  }
  s(GD, "stringToArray");
  we.length = function(t) {
    for (var e = GD(t), r = 0, u = 0; u < e.length; u++)
      r = r + this.characterLength(e[u]);
    return r;
  };
  we.slice = function(t, e, r) {
    textLen = we.length(t), e = e || 0, r = r || 1, e < 0 && (e = textLen + e), r < 0 && (r = textLen + r);
    for (var u = "", n = 0, o = GD(t), i = 0; i < o.length; i++) {
      var D = o[i], a = we.length(D);
      if (n >= e - (a == 2 ? 1 : 0))
        if (n + a <= r)
          u += D;
        else
          break;
      n += a;
    }
    return u;
  };
});

// ../node_modules/emoji-regex/index.js
var li = c((W8, WD) => {
  "use strict";
  WD.exports = function() {
    return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67)\uDB40\uDC7F|(?:\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFC-\uDFFF])|\uD83D\uDC68(?:\uD83C\uDFFB(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|[\u2695\u2696\u2708]\uFE0F|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))?|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])\uFE0F|\u200D(?:(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D[\uDC66\uDC67])|\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC)?|(?:\uD83D\uDC69(?:\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69]))|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC69(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83E\uDDD1(?:\u200D(?:\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDE36\u200D\uD83C\uDF2B|\uD83C\uDFF3\uFE0F\u200D\u26A7|\uD83D\uDC3B\u200D\u2744|(?:(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\uD83C\uDFF4\u200D\u2620|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])\u200D[\u2640\u2642]|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u2600-\u2604\u260E\u2611\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26B0\u26B1\u26C8\u26CF\u26D1\u26D3\u26E9\u26F0\u26F1\u26F4\u26F7\u26F8\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u3030\u303D\u3297\u3299]|\uD83C[\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]|\uD83D[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3])\uFE0F|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDE35\u200D\uD83D\uDCAB|\uD83D\uDE2E\u200D\uD83D\uDCA8|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83E\uDDD1(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83D\uDC69(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF6\uD83C\uDDE6|\uD83C\uDDF4\uD83C\uDDF2|\uD83D\uDC08\u200D\u2B1B|\u2764\uFE0F\u200D(?:\uD83D\uDD25|\uD83E\uDE79)|\uD83D\uDC41\uFE0F|\uD83C\uDFF3\uFE0F|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|[#\*0-9]\uFE0F\u20E3|\u2764\uFE0F|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|\uD83C\uDFF4|(?:[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270C\u270D]|\uD83D[\uDD74\uDD90])(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC08\uDC15\uDC3B\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE2E\uDE35\uDE36\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5]|\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD]|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF]|[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0D\uDD0E\uDD10-\uDD17\uDD1D\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78\uDD7A-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCB\uDDD0\uDDE0-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6]|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26A7\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5-\uDED7\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDD77\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
  };
});

// ../node_modules/cli-boxes/boxes.json
var ua = c((l1, $m) => {
  $m.exports = {
    single: {
      topLeft: "\u250C",
      top: "\u2500",
      topRight: "\u2510",
      right: "\u2502",
      bottomRight: "\u2518",
      bottom: "\u2500",
      bottomLeft: "\u2514",
      left: "\u2502"
    },
    double: {
      topLeft: "\u2554",
      top: "\u2550",
      topRight: "\u2557",
      right: "\u2551",
      bottomRight: "\u255D",
      bottom: "\u2550",
      bottomLeft: "\u255A",
      left: "\u2551"
    },
    round: {
      topLeft: "\u256D",
      top: "\u2500",
      topRight: "\u256E",
      right: "\u2502",
      bottomRight: "\u256F",
      bottom: "\u2500",
      bottomLeft: "\u2570",
      left: "\u2502"
    },
    bold: {
      topLeft: "\u250F",
      top: "\u2501",
      topRight: "\u2513",
      right: "\u2503",
      bottomRight: "\u251B",
      bottom: "\u2501",
      bottomLeft: "\u2517",
      left: "\u2503"
    },
    singleDouble: {
      topLeft: "\u2553",
      top: "\u2500",
      topRight: "\u2556",
      right: "\u2551",
      bottomRight: "\u255C",
      bottom: "\u2500",
      bottomLeft: "\u2559",
      left: "\u2551"
    },
    doubleSingle: {
      topLeft: "\u2552",
      top: "\u2550",
      topRight: "\u2555",
      right: "\u2502",
      bottomRight: "\u255B",
      bottom: "\u2550",
      bottomLeft: "\u2558",
      left: "\u2502"
    },
    classic: {
      topLeft: "+",
      top: "-",
      topRight: "+",
      right: "|",
      bottomRight: "+",
      bottom: "-",
      bottomLeft: "+",
      left: "|"
    },
    arrow: {
      topLeft: "\u2198",
      top: "\u2193",
      topRight: "\u2199",
      right: "\u2190",
      bottomRight: "\u2196",
      bottom: "\u2191",
      bottomLeft: "\u2197",
      left: "\u2192"
    }
  };
});

// ../node_modules/cli-boxes/index.js
var mi = c((h1, pi) => {
  "use strict";
  var ia = ua();
  pi.exports = ia;
  pi.exports.default = ia;
});

// ../node_modules/ansi-align/index.js
var la = c((f1, aa) => {
  "use strict";
  var Mm = Ke();
  function qe(t, e) {
    if (!t) return t;
    e = e || {};
    let r = e.align || "center";
    if (r === "left") return t;
    let u = e.split || `
`, n = e.pad || " ", o = r !== "right" ? Rm : qm, i = !1;
    Array.isArray(t) || (i = !0, t = String(t).split(u));
    let D, a = 0;
    return t = t.map(function(l) {
      return l = String(l), D = Mm(l), a = Math.max(D, a), {
        str: l,
        width: D
      };
    }).map(function(l) {
      return new Array(o(a, l.width) + 1).join(n) + l.str;
    }), i ? t.join(u) : t;
  }
  s(qe, "ansiAlign");
  qe.left = /* @__PURE__ */ s(function(e) {
    return qe(e, { align: "left" });
  }, "left");
  qe.center = /* @__PURE__ */ s(function(e) {
    return qe(e, { align: "center" });
  }, "center");
  qe.right = /* @__PURE__ */ s(function(e) {
    return qe(e, { align: "right" });
  }, "right");
  aa.exports = qe;
  function Rm(t, e) {
    return Math.floor((t - e) / 2);
  }
  s(Rm, "halfDiff");
  function qm(t, e) {
    return t - e;
  }
  s(qm, "fullDiff");
});

// ../node_modules/kleur/index.js
var L = c((z1, _a) => {
  "use strict";
  var { FORCE_COLOR: ng, NODE_DISABLE_COLORS: og, TERM: Dg } = process.env, w = {
    enabled: !og && Dg !== "dumb" && ng !== "0",
    // modifiers
    reset: A(0, 0),
    bold: A(1, 22),
    dim: A(2, 22),
    italic: A(3, 23),
    underline: A(4, 24),
    inverse: A(7, 27),
    hidden: A(8, 28),
    strikethrough: A(9, 29),
    // colors
    black: A(30, 39),
    red: A(31, 39),
    green: A(32, 39),
    yellow: A(33, 39),
    blue: A(34, 39),
    magenta: A(35, 39),
    cyan: A(36, 39),
    white: A(37, 39),
    gray: A(90, 39),
    grey: A(90, 39),
    // background colors
    bgBlack: A(40, 49),
    bgRed: A(41, 49),
    bgGreen: A(42, 49),
    bgYellow: A(43, 49),
    bgBlue: A(44, 49),
    bgMagenta: A(45, 49),
    bgCyan: A(46, 49),
    bgWhite: A(47, 49)
  };
  function Oa(t, e) {
    let r = 0, u, n = "", o = "";
    for (; r < t.length; r++)
      u = t[r], n += u.open, o += u.close, e.includes(u.close) && (e = e.replace(u.rgx, u.close + u.open));
    return n + e + o;
  }
  s(Oa, "run");
  function ag(t, e) {
    let r = { has: t, keys: e };
    return r.reset = w.reset.bind(r), r.bold = w.bold.bind(r), r.dim = w.dim.bind(r), r.italic = w.italic.bind(r), r.underline = w.underline.
    bind(r), r.inverse = w.inverse.bind(r), r.hidden = w.hidden.bind(r), r.strikethrough = w.strikethrough.bind(r), r.black = w.black.bind(r),
    r.red = w.red.bind(r), r.green = w.green.bind(r), r.yellow = w.yellow.bind(r), r.blue = w.blue.bind(r), r.magenta = w.magenta.bind(r), r.
    cyan = w.cyan.bind(r), r.white = w.white.bind(r), r.gray = w.gray.bind(r), r.grey = w.grey.bind(r), r.bgBlack = w.bgBlack.bind(r), r.bgRed =
    w.bgRed.bind(r), r.bgGreen = w.bgGreen.bind(r), r.bgYellow = w.bgYellow.bind(r), r.bgBlue = w.bgBlue.bind(r), r.bgMagenta = w.bgMagenta.
    bind(r), r.bgCyan = w.bgCyan.bind(r), r.bgWhite = w.bgWhite.bind(r), r;
  }
  s(ag, "chain");
  function A(t, e) {
    let r = {
      open: `\x1B[${t}m`,
      close: `\x1B[${e}m`,
      rgx: new RegExp(`\\x1b\\[${e}m`, "g")
    };
    return function(u) {
      return this !== void 0 && this.has !== void 0 ? (this.has.includes(t) || (this.has.push(t), this.keys.push(r)), u === void 0 ? this : w.
      enabled ? Oa(this.keys, u + "") : u + "") : u === void 0 ? ag([t], [r]) : w.enabled ? Oa([r], u + "") : u + "";
    };
  }
  s(A, "init");
  _a.exports = w;
});

// ../node_modules/prompts/dist/util/action.js
var La = c((Z1, Ia) => {
  "use strict";
  Ia.exports = (t, e) => {
    if (!(t.meta && t.name !== "escape")) {
      if (t.ctrl) {
        if (t.name === "a") return "first";
        if (t.name === "c" || t.name === "d") return "abort";
        if (t.name === "e") return "last";
        if (t.name === "g") return "reset";
      }
      if (e) {
        if (t.name === "j") return "down";
        if (t.name === "k") return "up";
      }
      return t.name === "return" || t.name === "enter" ? "submit" : t.name === "backspace" ? "delete" : t.name === "delete" ? "deleteForward" :
      t.name === "abort" ? "abort" : t.name === "escape" ? "exit" : t.name === "tab" ? "next" : t.name === "pagedown" ? "nextPage" : t.name ===
      "pageup" ? "prevPage" : t.name === "home" ? "home" : t.name === "end" ? "end" : t.name === "up" ? "up" : t.name === "down" ? "down" : t.
      name === "right" ? "right" : t.name === "left" ? "left" : !1;
    }
  };
});

// ../node_modules/prompts/dist/util/strip.js
var Rr = c((J1, ka) => {
  "use strict";
  ka.exports = (t) => {
    let e = ["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))"].join("|"), r = new RegExp(e, "g");
    return typeof t == "string" ? t.replace(r, "") : t;
  };
});

// ../node_modules/prompts/dist/util/clear.js
var Na = c((X1, qa) => {
  "use strict";
  function lg(t, e) {
    var r = typeof Symbol < "u" && t[Symbol.iterator] || t["@@iterator"];
    if (!r) {
      if (Array.isArray(t) || (r = hg(t)) || e && t && typeof t.length == "number") {
        r && (t = r);
        var u = 0, n = /* @__PURE__ */ s(function() {
        }, "F");
        return { s: n, n: /* @__PURE__ */ s(function() {
          return u >= t.length ? { done: !0 } : { done: !1, value: t[u++] };
        }, "n"), e: /* @__PURE__ */ s(function(l) {
          throw l;
        }, "e"), f: n };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var o = !0, i = !1, D;
    return { s: /* @__PURE__ */ s(function() {
      r = r.call(t);
    }, "s"), n: /* @__PURE__ */ s(function() {
      var l = r.next();
      return o = l.done, l;
    }, "n"), e: /* @__PURE__ */ s(function(l) {
      i = !0, D = l;
    }, "e"), f: /* @__PURE__ */ s(function() {
      try {
        !o && r.return != null && r.return();
      } finally {
        if (i) throw D;
      }
    }, "f") };
  }
  s(lg, "_createForOfIteratorHelper");
  function hg(t, e) {
    if (t) {
      if (typeof t == "string") return Pa(t, e);
      var r = Object.prototype.toString.call(t).slice(8, -1);
      if (r === "Object" && t.constructor && (r = t.constructor.name), r === "Map" || r === "Set") return Array.from(t);
      if (r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)) return Pa(t, e);
    }
  }
  s(hg, "_unsupportedIterableToArray");
  function Pa(t, e) {
    (e == null || e > t.length) && (e = t.length);
    for (var r = 0, u = new Array(e); r < e; r++) u[r] = t[r];
    return u;
  }
  s(Pa, "_arrayLikeToArray");
  var cg = Rr(), Ra = S(), Ma = Ra.erase, dg = Ra.cursor, fg = /* @__PURE__ */ s((t) => [...cg(t)].length, "width");
  qa.exports = function(t, e) {
    if (!e) return Ma.line + dg.to(0);
    let r = 0, u = t.split(/\r?\n/);
    var n = lg(u), o;
    try {
      for (n.s(); !(o = n.n()).done; ) {
        let i = o.value;
        r += 1 + Math.floor(Math.max(fg(i) - 1, 0) / e);
      }
    } catch (i) {
      n.e(i);
    } finally {
      n.f();
    }
    return Ma.lines(r);
  };
});

// ../node_modules/prompts/dist/util/figures.js
var wi = c((e6, ja) => {
  "use strict";
  var Rt = {
    arrowUp: "\u2191",
    arrowDown: "\u2193",
    arrowLeft: "\u2190",
    arrowRight: "\u2192",
    radioOn: "\u25C9",
    radioOff: "\u25EF",
    tick: "\u2714",
    cross: "\u2716",
    ellipsis: "\u2026",
    pointerSmall: "\u203A",
    line: "\u2500",
    pointer: "\u276F"
  }, pg = {
    arrowUp: Rt.arrowUp,
    arrowDown: Rt.arrowDown,
    arrowLeft: Rt.arrowLeft,
    arrowRight: Rt.arrowRight,
    radioOn: "(*)",
    radioOff: "( )",
    tick: "\u221A",
    cross: "\xD7",
    ellipsis: "...",
    pointerSmall: "\xBB",
    line: "\u2500",
    pointer: ">"
  }, mg = process.platform === "win32" ? pg : Rt;
  ja.exports = mg;
});

// ../node_modules/prompts/dist/util/style.js
var Wa = c((t6, Ga) => {
  "use strict";
  var ht = L(), je = wi(), Ai = Object.freeze({
    password: {
      scale: 1,
      render: /* @__PURE__ */ s((t) => "*".repeat(t.length), "render")
    },
    emoji: {
      scale: 2,
      render: /* @__PURE__ */ s((t) => "\u{1F603}".repeat(t.length), "render")
    },
    invisible: {
      scale: 0,
      render: /* @__PURE__ */ s((t) => "", "render")
    },
    default: {
      scale: 1,
      render: /* @__PURE__ */ s((t) => `${t}`, "render")
    }
  }), gg = /* @__PURE__ */ s((t) => Ai[t] || Ai.default, "render"), qt = Object.freeze({
    aborted: ht.red(je.cross),
    done: ht.green(je.tick),
    exited: ht.yellow(je.cross),
    default: ht.cyan("?")
  }), Fg = /* @__PURE__ */ s((t, e, r) => e ? qt.aborted : r ? qt.exited : t ? qt.done : qt.default, "symbol"), Cg = /* @__PURE__ */ s((t) => ht.
  gray(t ? je.ellipsis : je.pointerSmall), "delimiter"), Eg = /* @__PURE__ */ s((t, e) => ht.gray(t ? e ? je.pointerSmall : "+" : je.line), "\
item");
  Ga.exports = {
    styles: Ai,
    render: gg,
    symbols: qt,
    symbol: Fg,
    delimiter: Cg,
    item: Eg
  };
});

// ../node_modules/prompts/dist/util/lines.js
var Ua = c((u6, Va) => {
  "use strict";
  var bg = Rr();
  Va.exports = function(t, e) {
    let r = String(bg(t) || "").split(/\r?\n/);
    return e ? r.map((u) => Math.ceil(u.length / e)).reduce((u, n) => u + n) : r.length;
  };
});

// ../node_modules/prompts/dist/util/wrap.js
var Ha = c((i6, Ya) => {
  "use strict";
  Ya.exports = (t, e = {}) => {
    let r = Number.isSafeInteger(parseInt(e.margin)) ? new Array(parseInt(e.margin)).fill(" ").join("") : e.margin || "", u = e.width;
    return (t || "").split(/\r?\n/g).map((n) => n.split(/\s+/g).reduce((o, i) => (i.length + r.length >= u || o[o.length - 1].length + i.length +
    1 < u ? o[o.length - 1] += ` ${i}` : o.push(`${r}${i}`), o), [r]).join(`
`)).join(`
`);
  };
});

// ../node_modules/prompts/dist/util/entriesToDisplay.js
var Ka = c((s6, za) => {
  "use strict";
  za.exports = (t, e, r) => {
    r = r || e;
    let u = Math.min(e - r, t - Math.floor(r / 2));
    u < 0 && (u = 0);
    let n = Math.min(u + r, e);
    return {
      startIndex: u,
      endIndex: n
    };
  };
});

// ../node_modules/prompts/dist/util/index.js
var ee = c((n6, Za) => {
  "use strict";
  Za.exports = {
    action: La(),
    clear: Na(),
    style: Wa(),
    strip: Rr(),
    figures: wi(),
    lines: Ua(),
    wrap: Ha(),
    entriesToDisplay: Ka()
  };
});

// ../node_modules/prompts/dist/elements/prompt.js
var ce = c((o6, Qa) => {
  "use strict";
  var Ja = require("readline"), xg = ee(), vg = xg.action, yg = require("events"), Xa = S(), Bg = Xa.beep, wg = Xa.cursor, Ag = L(), Si = class extends yg {
    static {
      s(this, "Prompt");
    }
    constructor(e = {}) {
      super(), this.firstRender = !0, this.in = e.stdin || process.stdin, this.out = e.stdout || process.stdout, this.onRender = (e.onRender ||
      (() => {
      })).bind(this);
      let r = Ja.createInterface({
        input: this.in,
        escapeCodeTimeout: 50
      });
      Ja.emitKeypressEvents(this.in, r), this.in.isTTY && this.in.setRawMode(!0);
      let u = ["SelectPrompt", "MultiselectPrompt"].indexOf(this.constructor.name) > -1, n = /* @__PURE__ */ s((o, i) => {
        let D = vg(i, u);
        D === !1 ? this._ && this._(o, i) : typeof this[D] == "function" ? this[D](i) : this.bell();
      }, "keypress");
      this.close = () => {
        this.out.write(wg.show), this.in.removeListener("keypress", n), this.in.isTTY && this.in.setRawMode(!1), r.close(), this.emit(this.aborted ?
        "abort" : this.exited ? "exit" : "submit", this.value), this.closed = !0;
      }, this.in.on("keypress", n);
    }
    fire() {
      this.emit("state", {
        value: this.value,
        aborted: !!this.aborted,
        exited: !!this.exited
      });
    }
    bell() {
      this.out.write(Bg);
    }
    render() {
      this.onRender(Ag), this.firstRender && (this.firstRender = !1);
    }
  };
  Qa.exports = Si;
});

// ../node_modules/prompts/dist/elements/text.js
var il = c((a6, ul) => {
  "use strict";
  function el(t, e, r, u, n, o, i) {
    try {
      var D = t[o](i), a = D.value;
    } catch (l) {
      r(l);
      return;
    }
    D.done ? e(a) : Promise.resolve(a).then(u, n);
  }
  s(el, "asyncGeneratorStep");
  function tl(t) {
    return function() {
      var e = this, r = arguments;
      return new Promise(function(u, n) {
        var o = t.apply(e, r);
        function i(a) {
          el(o, u, n, i, D, "next", a);
        }
        s(i, "_next");
        function D(a) {
          el(o, u, n, i, D, "throw", a);
        }
        s(D, "_throw"), i(void 0);
      });
    };
  }
  s(tl, "_asyncToGenerator");
  var qr = L(), Sg = ce(), rl = S(), Tg = rl.erase, Nt = rl.cursor, Nr = ee(), Ti = Nr.style, $i = Nr.clear, $g = Nr.lines, Og = Nr.figures,
  Oi = class extends Sg {
    static {
      s(this, "TextPrompt");
    }
    constructor(e = {}) {
      super(e), this.transform = Ti.render(e.style), this.scale = this.transform.scale, this.msg = e.message, this.initial = e.initial || "",
      this.validator = e.validate || (() => !0), this.value = "", this.errorMsg = e.error || "Please Enter A Valid Value", this.cursor = +!!this.
      initial, this.cursorOffset = 0, this.clear = $i("", this.out.columns), this.render();
    }
    set value(e) {
      !e && this.initial ? (this.placeholder = !0, this.rendered = qr.gray(this.transform.render(this.initial))) : (this.placeholder = !1, this.
      rendered = this.transform.render(e)), this._value = e, this.fire();
    }
    get value() {
      return this._value;
    }
    reset() {
      this.value = "", this.cursor = +!!this.initial, this.cursorOffset = 0, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.value = this.value || this.initial, this.done = this.aborted = !0, this.error = !1, this.red = !1, this.fire(), this.render(), this.
      out.write(`
`), this.close();
    }
    validate() {
      var e = this;
      return tl(function* () {
        let r = yield e.validator(e.value);
        typeof r == "string" && (e.errorMsg = r, r = !1), e.error = !r;
      })();
    }
    submit() {
      var e = this;
      return tl(function* () {
        if (e.value = e.value || e.initial, e.cursorOffset = 0, e.cursor = e.rendered.length, yield e.validate(), e.error) {
          e.red = !0, e.fire(), e.render();
          return;
        }
        e.done = !0, e.aborted = !1, e.fire(), e.render(), e.out.write(`
`), e.close();
      })();
    }
    next() {
      if (!this.placeholder) return this.bell();
      this.value = this.initial, this.cursor = this.rendered.length, this.fire(), this.render();
    }
    moveCursor(e) {
      this.placeholder || (this.cursor = this.cursor + e, this.cursorOffset += e);
    }
    _(e, r) {
      let u = this.value.slice(0, this.cursor), n = this.value.slice(this.cursor);
      this.value = `${u}${e}${n}`, this.red = !1, this.cursor = this.placeholder ? 0 : u.length + 1, this.render();
    }
    delete() {
      if (this.isCursorAtStart()) return this.bell();
      let e = this.value.slice(0, this.cursor - 1), r = this.value.slice(this.cursor);
      this.value = `${e}${r}`, this.red = !1, this.isCursorAtStart() ? this.cursorOffset = 0 : (this.cursorOffset++, this.moveCursor(-1)), this.
      render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length || this.placeholder) return this.bell();
      let e = this.value.slice(0, this.cursor), r = this.value.slice(this.cursor + 1);
      this.value = `${e}${r}`, this.red = !1, this.isCursorAtEnd() ? this.cursorOffset = 0 : this.cursorOffset++, this.render();
    }
    first() {
      this.cursor = 0, this.render();
    }
    last() {
      this.cursor = this.value.length, this.render();
    }
    left() {
      if (this.cursor <= 0 || this.placeholder) return this.bell();
      this.moveCursor(-1), this.render();
    }
    right() {
      if (this.cursor * this.scale >= this.rendered.length || this.placeholder) return this.bell();
      this.moveCursor(1), this.render();
    }
    isCursorAtStart() {
      return this.cursor === 0 || this.placeholder && this.cursor === 1;
    }
    isCursorAtEnd() {
      return this.cursor === this.rendered.length || this.placeholder && this.cursor === this.rendered.length + 1;
    }
    render() {
      this.closed || (this.firstRender || (this.outputError && this.out.write(Nt.down($g(this.outputError, this.out.columns) - 1) + $i(this.
      outputError, this.out.columns)), this.out.write($i(this.outputText, this.out.columns))), super.render(), this.outputError = "", this.outputText =
      [Ti.symbol(this.done, this.aborted), qr.bold(this.msg), Ti.delimiter(this.done), this.red ? qr.red(this.rendered) : this.rendered].join(
      " "), this.error && (this.outputError += this.errorMsg.split(`
`).reduce((e, r, u) => e + `
${u ? " " : Og.pointerSmall} ${qr.red().italic(r)}`, "")), this.out.write(Tg.line + Nt.to(0) + this.outputText + Nt.save + this.outputError +
      Nt.restore + Nt.move(this.cursorOffset, 0)));
    }
  };
  ul.exports = Oi;
});

// ../node_modules/prompts/dist/elements/select.js
var Dl = c((h6, ol) => {
  "use strict";
  var de = L(), _g = ce(), jt = ee(), sl = jt.style, nl = jt.clear, jr = jt.figures, Ig = jt.wrap, Lg = jt.entriesToDisplay, kg = S(), Pg = kg.
  cursor, _i = class extends _g {
    static {
      s(this, "SelectPrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.hint = e.hint || "- Use arrow-keys. Return to submit.", this.warn = e.warn || "- This option is d\
isabled", this.cursor = e.initial || 0, this.choices = e.choices.map((r, u) => (typeof r == "string" && (r = {
        title: r,
        value: u
      }), {
        title: r && (r.title || r.value || r),
        value: r && (r.value === void 0 ? u : r.value),
        description: r && r.description,
        selected: r && r.selected,
        disabled: r && r.disabled
      })), this.optionsPerPage = e.optionsPerPage || 10, this.value = (this.choices[this.cursor] || {}).value, this.clear = nl("", this.out.
      columns), this.render();
    }
    moveCursor(e) {
      this.cursor = e, this.value = this.choices[e].value, this.fire();
    }
    reset() {
      this.moveCursor(0), this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.selection.disabled ? this.bell() : (this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close());
    }
    first() {
      this.moveCursor(0), this.render();
    }
    last() {
      this.moveCursor(this.choices.length - 1), this.render();
    }
    up() {
      this.cursor === 0 ? this.moveCursor(this.choices.length - 1) : this.moveCursor(this.cursor - 1), this.render();
    }
    down() {
      this.cursor === this.choices.length - 1 ? this.moveCursor(0) : this.moveCursor(this.cursor + 1), this.render();
    }
    next() {
      this.moveCursor((this.cursor + 1) % this.choices.length), this.render();
    }
    _(e, r) {
      if (e === " ") return this.submit();
    }
    get selection() {
      return this.choices[this.cursor];
    }
    render() {
      if (this.closed) return;
      this.firstRender ? this.out.write(Pg.hide) : this.out.write(nl(this.outputText, this.out.columns)), super.render();
      let e = Lg(this.cursor, this.choices.length, this.optionsPerPage), r = e.startIndex, u = e.endIndex;
      if (this.outputText = [sl.symbol(this.done, this.aborted), de.bold(this.msg), sl.delimiter(!1), this.done ? this.selection.title : this.
      selection.disabled ? de.yellow(this.warn) : de.gray(this.hint)].join(" "), !this.done) {
        this.outputText += `
`;
        for (let n = r; n < u; n++) {
          let o, i, D = "", a = this.choices[n];
          n === r && r > 0 ? i = jr.arrowUp : n === u - 1 && u < this.choices.length ? i = jr.arrowDown : i = " ", a.disabled ? (o = this.cursor ===
          n ? de.gray().underline(a.title) : de.strikethrough().gray(a.title), i = (this.cursor === n ? de.bold().gray(jr.pointer) + " " : "\
  ") + i) : (o = this.cursor === n ? de.cyan().underline(a.title) : a.title, i = (this.cursor === n ? de.cyan(jr.pointer) + " " : "  ") + i,
          a.description && this.cursor === n && (D = ` - ${a.description}`, (i.length + o.length + D.length >= this.out.columns || a.description.
          split(/\r?\n/).length > 1) && (D = `
` + Ig(a.description, {
            margin: 3,
            width: this.out.columns
          })))), this.outputText += `${i} ${o}${de.gray(D)}
`;
        }
      }
      this.out.write(this.outputText);
    }
  };
  ol.exports = _i;
});

// ../node_modules/prompts/dist/elements/toggle.js
var fl = c((d6, dl) => {
  "use strict";
  var Gr = L(), Mg = ce(), hl = ee(), al = hl.style, Rg = hl.clear, cl = S(), ll = cl.cursor, qg = cl.erase, Ii = class extends Mg {
    static {
      s(this, "TogglePrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.value = !!e.initial, this.active = e.active || "on", this.inactive = e.inactive || "off", this.initialValue =
      this.value, this.render();
    }
    reset() {
      this.value = this.initialValue, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    deactivate() {
      if (this.value === !1) return this.bell();
      this.value = !1, this.render();
    }
    activate() {
      if (this.value === !0) return this.bell();
      this.value = !0, this.render();
    }
    delete() {
      this.deactivate();
    }
    left() {
      this.deactivate();
    }
    right() {
      this.activate();
    }
    down() {
      this.deactivate();
    }
    up() {
      this.activate();
    }
    next() {
      this.value = !this.value, this.fire(), this.render();
    }
    _(e, r) {
      if (e === " ")
        this.value = !this.value;
      else if (e === "1")
        this.value = !0;
      else if (e === "0")
        this.value = !1;
      else return this.bell();
      this.render();
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(ll.hide) : this.out.write(Rg(this.outputText, this.out.columns)), super.render(), this.
      outputText = [al.symbol(this.done, this.aborted), Gr.bold(this.msg), al.delimiter(this.done), this.value ? this.inactive : Gr.cyan().underline(
      this.inactive), Gr.gray("/"), this.value ? Gr.cyan().underline(this.active) : this.active].join(" "), this.out.write(qg.line + ll.to(0) +
      this.outputText));
    }
  };
  dl.exports = Ii;
});

// ../node_modules/prompts/dist/dateparts/datepart.js
var se = c((p6, pl) => {
  "use strict";
  var Li = class t {
    static {
      s(this, "DatePart");
    }
    constructor({
      token: e,
      date: r,
      parts: u,
      locales: n
    }) {
      this.token = e, this.date = r || /* @__PURE__ */ new Date(), this.parts = u || [this], this.locales = n || {};
    }
    up() {
    }
    down() {
    }
    next() {
      let e = this.parts.indexOf(this);
      return this.parts.find((r, u) => u > e && r instanceof t);
    }
    setTo(e) {
    }
    prev() {
      let e = [].concat(this.parts).reverse(), r = e.indexOf(this);
      return e.find((u, n) => n > r && u instanceof t);
    }
    toString() {
      return String(this.date);
    }
  };
  pl.exports = Li;
});

// ../node_modules/prompts/dist/dateparts/meridiem.js
var gl = c((g6, ml) => {
  "use strict";
  var Ng = se(), ki = class extends Ng {
    static {
      s(this, "Meridiem");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setHours((this.date.getHours() + 12) % 24);
    }
    down() {
      this.up();
    }
    toString() {
      let e = this.date.getHours() > 12 ? "pm" : "am";
      return /\A/.test(this.token) ? e.toUpperCase() : e;
    }
  };
  ml.exports = ki;
});

// ../node_modules/prompts/dist/dateparts/day.js
var Cl = c((C6, Fl) => {
  "use strict";
  var jg = se(), Gg = /* @__PURE__ */ s((t) => (t = t % 10, t === 1 ? "st" : t === 2 ? "nd" : t === 3 ? "rd" : "th"), "pos"), Pi = class extends jg {
    static {
      s(this, "Day");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setDate(this.date.getDate() + 1);
    }
    down() {
      this.date.setDate(this.date.getDate() - 1);
    }
    setTo(e) {
      this.date.setDate(parseInt(e.substr(-2)));
    }
    toString() {
      let e = this.date.getDate(), r = this.date.getDay();
      return this.token === "DD" ? String(e).padStart(2, "0") : this.token === "Do" ? e + Gg(e) : this.token === "d" ? r + 1 : this.token ===
      "ddd" ? this.locales.weekdaysShort[r] : this.token === "dddd" ? this.locales.weekdays[r] : e;
    }
  };
  Fl.exports = Pi;
});

// ../node_modules/prompts/dist/dateparts/hours.js
var bl = c((b6, El) => {
  "use strict";
  var Wg = se(), Mi = class extends Wg {
    static {
      s(this, "Hours");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setHours(this.date.getHours() + 1);
    }
    down() {
      this.date.setHours(this.date.getHours() - 1);
    }
    setTo(e) {
      this.date.setHours(parseInt(e.substr(-2)));
    }
    toString() {
      let e = this.date.getHours();
      return /h/.test(this.token) && (e = e % 12 || 12), this.token.length > 1 ? String(e).padStart(2, "0") : e;
    }
  };
  El.exports = Mi;
});

// ../node_modules/prompts/dist/dateparts/milliseconds.js
var vl = c((v6, xl) => {
  "use strict";
  var Vg = se(), Ri = class extends Vg {
    static {
      s(this, "Milliseconds");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setMilliseconds(this.date.getMilliseconds() + 1);
    }
    down() {
      this.date.setMilliseconds(this.date.getMilliseconds() - 1);
    }
    setTo(e) {
      this.date.setMilliseconds(parseInt(e.substr(-this.token.length)));
    }
    toString() {
      return String(this.date.getMilliseconds()).padStart(4, "0").substr(0, this.token.length);
    }
  };
  xl.exports = Ri;
});

// ../node_modules/prompts/dist/dateparts/minutes.js
var Bl = c((B6, yl) => {
  "use strict";
  var Ug = se(), qi = class extends Ug {
    static {
      s(this, "Minutes");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setMinutes(this.date.getMinutes() + 1);
    }
    down() {
      this.date.setMinutes(this.date.getMinutes() - 1);
    }
    setTo(e) {
      this.date.setMinutes(parseInt(e.substr(-2)));
    }
    toString() {
      let e = this.date.getMinutes();
      return this.token.length > 1 ? String(e).padStart(2, "0") : e;
    }
  };
  yl.exports = qi;
});

// ../node_modules/prompts/dist/dateparts/month.js
var Al = c((A6, wl) => {
  "use strict";
  var Yg = se(), Ni = class extends Yg {
    static {
      s(this, "Month");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setMonth(this.date.getMonth() + 1);
    }
    down() {
      this.date.setMonth(this.date.getMonth() - 1);
    }
    setTo(e) {
      e = parseInt(e.substr(-2)) - 1, this.date.setMonth(e < 0 ? 0 : e);
    }
    toString() {
      let e = this.date.getMonth(), r = this.token.length;
      return r === 2 ? String(e + 1).padStart(2, "0") : r === 3 ? this.locales.monthsShort[e] : r === 4 ? this.locales.months[e] : String(e +
      1);
    }
  };
  wl.exports = Ni;
});

// ../node_modules/prompts/dist/dateparts/seconds.js
var Tl = c((T6, Sl) => {
  "use strict";
  var Hg = se(), ji = class extends Hg {
    static {
      s(this, "Seconds");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setSeconds(this.date.getSeconds() + 1);
    }
    down() {
      this.date.setSeconds(this.date.getSeconds() - 1);
    }
    setTo(e) {
      this.date.setSeconds(parseInt(e.substr(-2)));
    }
    toString() {
      let e = this.date.getSeconds();
      return this.token.length > 1 ? String(e).padStart(2, "0") : e;
    }
  };
  Sl.exports = ji;
});

// ../node_modules/prompts/dist/dateparts/year.js
var Ol = c((O6, $l) => {
  "use strict";
  var zg = se(), Gi = class extends zg {
    static {
      s(this, "Year");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setFullYear(this.date.getFullYear() + 1);
    }
    down() {
      this.date.setFullYear(this.date.getFullYear() - 1);
    }
    setTo(e) {
      this.date.setFullYear(e.substr(-4));
    }
    toString() {
      let e = String(this.date.getFullYear()).padStart(4, "0");
      return this.token.length === 2 ? e.substr(-2) : e;
    }
  };
  $l.exports = Gi;
});

// ../node_modules/prompts/dist/dateparts/index.js
var Il = c((I6, _l) => {
  "use strict";
  _l.exports = {
    DatePart: se(),
    Meridiem: gl(),
    Day: Cl(),
    Hours: bl(),
    Milliseconds: vl(),
    Minutes: Bl(),
    Month: Al(),
    Seconds: Tl(),
    Year: Ol()
  };
});

// ../node_modules/prompts/dist/elements/date.js
var Wl = c((L6, Gl) => {
  "use strict";
  function Ll(t, e, r, u, n, o, i) {
    try {
      var D = t[o](i), a = D.value;
    } catch (l) {
      r(l);
      return;
    }
    D.done ? e(a) : Promise.resolve(a).then(u, n);
  }
  s(Ll, "asyncGeneratorStep");
  function kl(t) {
    return function() {
      var e = this, r = arguments;
      return new Promise(function(u, n) {
        var o = t.apply(e, r);
        function i(a) {
          Ll(o, u, n, i, D, "next", a);
        }
        s(i, "_next");
        function D(a) {
          Ll(o, u, n, i, D, "throw", a);
        }
        s(D, "_throw"), i(void 0);
      });
    };
  }
  s(kl, "_asyncToGenerator");
  var Wi = L(), Kg = ce(), Ui = ee(), Pl = Ui.style, Ml = Ui.clear, Zg = Ui.figures, jl = S(), Jg = jl.erase, Rl = jl.cursor, fe = Il(), ql = fe.
  DatePart, Xg = fe.Meridiem, Qg = fe.Day, eF = fe.Hours, tF = fe.Milliseconds, rF = fe.Minutes, uF = fe.Month, iF = fe.Seconds, sF = fe.Year,
  nF = /\\(.)|"((?:\\["\\]|[^"])+)"|(D[Do]?|d{3,4}|d)|(M{1,4})|(YY(?:YY)?)|([aA])|([Hh]{1,2})|(m{1,2})|(s{1,2})|(S{1,4})|./g, Nl = {
    1: ({
      token: t
    }) => t.replace(/\\(.)/g, "$1"),
    2: (t) => new Qg(t),
    // Day // TODO
    3: (t) => new uF(t),
    // Month
    4: (t) => new sF(t),
    // Year
    5: (t) => new Xg(t),
    // AM/PM // TODO (special)
    6: (t) => new eF(t),
    // Hours
    7: (t) => new rF(t),
    // Minutes
    8: (t) => new iF(t),
    // Seconds
    9: (t) => new tF(t)
    // Fractional seconds
  }, oF = {
    months: "January,February,March,April,May,June,July,August,September,October,November,December".split(","),
    monthsShort: "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(","),
    weekdays: "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday".split(","),
    weekdaysShort: "Sun,Mon,Tue,Wed,Thu,Fri,Sat".split(",")
  }, Vi = class extends Kg {
    static {
      s(this, "DatePrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.cursor = 0, this.typed = "", this.locales = Object.assign(oF, e.locales), this._date = e.initial ||
      /* @__PURE__ */ new Date(), this.errorMsg = e.error || "Please Enter A Valid Value", this.validator = e.validate || (() => !0), this.mask =
      e.mask || "YYYY-MM-DD HH:mm:ss", this.clear = Ml("", this.out.columns), this.render();
    }
    get value() {
      return this.date;
    }
    get date() {
      return this._date;
    }
    set date(e) {
      e && this._date.setTime(e.getTime());
    }
    set mask(e) {
      let r;
      for (this.parts = []; r = nF.exec(e); ) {
        let n = r.shift(), o = r.findIndex((i) => i != null);
        this.parts.push(o in Nl ? Nl[o]({
          token: r[o] || n,
          date: this.date,
          parts: this.parts,
          locales: this.locales
        }) : r[o] || n);
      }
      let u = this.parts.reduce((n, o) => (typeof o == "string" && typeof n[n.length - 1] == "string" ? n[n.length - 1] += o : n.push(o), n),
      []);
      this.parts.splice(0), this.parts.push(...u), this.reset();
    }
    moveCursor(e) {
      this.typed = "", this.cursor = e, this.fire();
    }
    reset() {
      this.moveCursor(this.parts.findIndex((e) => e instanceof ql)), this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.error = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    validate() {
      var e = this;
      return kl(function* () {
        let r = yield e.validator(e.value);
        typeof r == "string" && (e.errorMsg = r, r = !1), e.error = !r;
      })();
    }
    submit() {
      var e = this;
      return kl(function* () {
        if (yield e.validate(), e.error) {
          e.color = "red", e.fire(), e.render();
          return;
        }
        e.done = !0, e.aborted = !1, e.fire(), e.render(), e.out.write(`
`), e.close();
      })();
    }
    up() {
      this.typed = "", this.parts[this.cursor].up(), this.render();
    }
    down() {
      this.typed = "", this.parts[this.cursor].down(), this.render();
    }
    left() {
      let e = this.parts[this.cursor].prev();
      if (e == null) return this.bell();
      this.moveCursor(this.parts.indexOf(e)), this.render();
    }
    right() {
      let e = this.parts[this.cursor].next();
      if (e == null) return this.bell();
      this.moveCursor(this.parts.indexOf(e)), this.render();
    }
    next() {
      let e = this.parts[this.cursor].next();
      this.moveCursor(e ? this.parts.indexOf(e) : this.parts.findIndex((r) => r instanceof ql)), this.render();
    }
    _(e) {
      /\d/.test(e) && (this.typed += e, this.parts[this.cursor].setTo(this.typed), this.render());
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(Rl.hide) : this.out.write(Ml(this.outputText, this.out.columns)), super.render(), this.
      outputText = [Pl.symbol(this.done, this.aborted), Wi.bold(this.msg), Pl.delimiter(!1), this.parts.reduce((e, r, u) => e.concat(u === this.
      cursor && !this.done ? Wi.cyan().underline(r.toString()) : r), []).join("")].join(" "), this.error && (this.outputText += this.errorMsg.
      split(`
`).reduce((e, r, u) => e + `
${u ? " " : Zg.pointerSmall} ${Wi.red().italic(r)}`, "")), this.out.write(Jg.line + Rl.to(0) + this.outputText));
    }
  };
  Gl.exports = Vi;
});

// ../node_modules/prompts/dist/elements/number.js
var Zl = c((P6, Kl) => {
  "use strict";
  function Vl(t, e, r, u, n, o, i) {
    try {
      var D = t[o](i), a = D.value;
    } catch (l) {
      r(l);
      return;
    }
    D.done ? e(a) : Promise.resolve(a).then(u, n);
  }
  s(Vl, "asyncGeneratorStep");
  function Ul(t) {
    return function() {
      var e = this, r = arguments;
      return new Promise(function(u, n) {
        var o = t.apply(e, r);
        function i(a) {
          Vl(o, u, n, i, D, "next", a);
        }
        s(i, "_next");
        function D(a) {
          Vl(o, u, n, i, D, "throw", a);
        }
        s(D, "_throw"), i(void 0);
      });
    };
  }
  s(Ul, "_asyncToGenerator");
  var Wr = L(), DF = ce(), zl = S(), Vr = zl.cursor, aF = zl.erase, Ur = ee(), Yi = Ur.style, lF = Ur.figures, Yl = Ur.clear, hF = Ur.lines,
  cF = /[0-9]/, Hi = /* @__PURE__ */ s((t) => t !== void 0, "isDef"), Hl = /* @__PURE__ */ s((t, e) => {
    let r = Math.pow(10, e);
    return Math.round(t * r) / r;
  }, "round"), zi = class extends DF {
    static {
      s(this, "NumberPrompt");
    }
    constructor(e = {}) {
      super(e), this.transform = Yi.render(e.style), this.msg = e.message, this.initial = Hi(e.initial) ? e.initial : "", this.float = !!e.float,
      this.round = e.round || 2, this.inc = e.increment || 1, this.min = Hi(e.min) ? e.min : -1 / 0, this.max = Hi(e.max) ? e.max : 1 / 0, this.
      errorMsg = e.error || "Please Enter A Valid Value", this.validator = e.validate || (() => !0), this.color = "cyan", this.value = "", this.
      typed = "", this.lastHit = 0, this.render();
    }
    set value(e) {
      !e && e !== 0 ? (this.placeholder = !0, this.rendered = Wr.gray(this.transform.render(`${this.initial}`)), this._value = "") : (this.placeholder =
      !1, this.rendered = this.transform.render(`${Hl(e, this.round)}`), this._value = Hl(e, this.round)), this.fire();
    }
    get value() {
      return this._value;
    }
    parse(e) {
      return this.float ? parseFloat(e) : parseInt(e);
    }
    valid(e) {
      return e === "-" || e === "." && this.float || cF.test(e);
    }
    reset() {
      this.typed = "", this.value = "", this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      let e = this.value;
      this.value = e !== "" ? e : this.initial, this.done = this.aborted = !0, this.error = !1, this.fire(), this.render(), this.out.write(`\

`), this.close();
    }
    validate() {
      var e = this;
      return Ul(function* () {
        let r = yield e.validator(e.value);
        typeof r == "string" && (e.errorMsg = r, r = !1), e.error = !r;
      })();
    }
    submit() {
      var e = this;
      return Ul(function* () {
        if (yield e.validate(), e.error) {
          e.color = "red", e.fire(), e.render();
          return;
        }
        let r = e.value;
        e.value = r !== "" ? r : e.initial, e.done = !0, e.aborted = !1, e.error = !1, e.fire(), e.render(), e.out.write(`
`), e.close();
      })();
    }
    up() {
      if (this.typed = "", this.value === "" && (this.value = this.min - this.inc), this.value >= this.max) return this.bell();
      this.value += this.inc, this.color = "cyan", this.fire(), this.render();
    }
    down() {
      if (this.typed = "", this.value === "" && (this.value = this.min + this.inc), this.value <= this.min) return this.bell();
      this.value -= this.inc, this.color = "cyan", this.fire(), this.render();
    }
    delete() {
      let e = this.value.toString();
      if (e.length === 0) return this.bell();
      this.value = this.parse(e = e.slice(0, -1)) || "", this.value !== "" && this.value < this.min && (this.value = this.min), this.color =
      "cyan", this.fire(), this.render();
    }
    next() {
      this.value = this.initial, this.fire(), this.render();
    }
    _(e, r) {
      if (!this.valid(e)) return this.bell();
      let u = Date.now();
      if (u - this.lastHit > 1e3 && (this.typed = ""), this.typed += e, this.lastHit = u, this.color = "cyan", e === ".") return this.fire();
      this.value = Math.min(this.parse(this.typed), this.max), this.value > this.max && (this.value = this.max), this.value < this.min && (this.
      value = this.min), this.fire(), this.render();
    }
    render() {
      this.closed || (this.firstRender || (this.outputError && this.out.write(Vr.down(hF(this.outputError, this.out.columns) - 1) + Yl(this.
      outputError, this.out.columns)), this.out.write(Yl(this.outputText, this.out.columns))), super.render(), this.outputError = "", this.outputText =
      [Yi.symbol(this.done, this.aborted), Wr.bold(this.msg), Yi.delimiter(this.done), !this.done || !this.done && !this.placeholder ? Wr[this.
      color]().underline(this.rendered) : this.rendered].join(" "), this.error && (this.outputError += this.errorMsg.split(`
`).reduce((e, r, u) => e + `
${u ? " " : lF.pointerSmall} ${Wr.red().italic(r)}`, "")), this.out.write(aF.line + Vr.to(0) + this.outputText + Vr.save + this.outputError +
      Vr.restore));
    }
  };
  Kl.exports = zi;
});

// ../node_modules/prompts/dist/elements/multiselect.js
var Zi = c((R6, Ql) => {
  "use strict";
  var ne = L(), dF = S(), fF = dF.cursor, pF = ce(), Gt = ee(), Jl = Gt.clear, Te = Gt.figures, Xl = Gt.style, mF = Gt.wrap, gF = Gt.entriesToDisplay,
  Ki = class extends pF {
    static {
      s(this, "MultiselectPrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.cursor = e.cursor || 0, this.scrollIndex = e.cursor || 0, this.hint = e.hint || "", this.warn = e.
      warn || "- This option is disabled -", this.minSelected = e.min, this.showMinError = !1, this.maxChoices = e.max, this.instructions = e.
      instructions, this.optionsPerPage = e.optionsPerPage || 10, this.value = e.choices.map((r, u) => (typeof r == "string" && (r = {
        title: r,
        value: u
      }), {
        title: r && (r.title || r.value || r),
        description: r && r.description,
        value: r && (r.value === void 0 ? u : r.value),
        selected: r && r.selected,
        disabled: r && r.disabled
      })), this.clear = Jl("", this.out.columns), e.overrideRender || this.render();
    }
    reset() {
      this.value.map((e) => !e.selected), this.cursor = 0, this.fire(), this.render();
    }
    selected() {
      return this.value.filter((e) => e.selected);
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      let e = this.value.filter((r) => r.selected);
      this.minSelected && e.length < this.minSelected ? (this.showMinError = !0, this.render()) : (this.done = !0, this.aborted = !1, this.fire(),
      this.render(), this.out.write(`
`), this.close());
    }
    first() {
      this.cursor = 0, this.render();
    }
    last() {
      this.cursor = this.value.length - 1, this.render();
    }
    next() {
      this.cursor = (this.cursor + 1) % this.value.length, this.render();
    }
    up() {
      this.cursor === 0 ? this.cursor = this.value.length - 1 : this.cursor--, this.render();
    }
    down() {
      this.cursor === this.value.length - 1 ? this.cursor = 0 : this.cursor++, this.render();
    }
    left() {
      this.value[this.cursor].selected = !1, this.render();
    }
    right() {
      if (this.value.filter((e) => e.selected).length >= this.maxChoices) return this.bell();
      this.value[this.cursor].selected = !0, this.render();
    }
    handleSpaceToggle() {
      let e = this.value[this.cursor];
      if (e.selected)
        e.selected = !1, this.render();
      else {
        if (e.disabled || this.value.filter((r) => r.selected).length >= this.maxChoices)
          return this.bell();
        e.selected = !0, this.render();
      }
    }
    toggleAll() {
      if (this.maxChoices !== void 0 || this.value[this.cursor].disabled)
        return this.bell();
      let e = !this.value[this.cursor].selected;
      this.value.filter((r) => !r.disabled).forEach((r) => r.selected = e), this.render();
    }
    _(e, r) {
      if (e === " ")
        this.handleSpaceToggle();
      else if (e === "a")
        this.toggleAll();
      else
        return this.bell();
    }
    renderInstructions() {
      return this.instructions === void 0 || this.instructions ? typeof this.instructions == "string" ? this.instructions : `
Instructions:
    ${Te.arrowUp}/${Te.arrowDown}: Highlight option
    ${Te.arrowLeft}/${Te.arrowRight}/[space]: Toggle selection
` + (this.maxChoices === void 0 ? `    a: Toggle all
` : "") + "    enter/return: Complete answer" : "";
    }
    renderOption(e, r, u, n) {
      let o = (r.selected ? ne.green(Te.radioOn) : Te.radioOff) + " " + n + " ", i, D;
      return r.disabled ? i = e === u ? ne.gray().underline(r.title) : ne.strikethrough().gray(r.title) : (i = e === u ? ne.cyan().underline(
      r.title) : r.title, e === u && r.description && (D = ` - ${r.description}`, (o.length + i.length + D.length >= this.out.columns || r.description.
      split(/\r?\n/).length > 1) && (D = `
` + mF(r.description, {
        margin: o.length,
        width: this.out.columns
      })))), o + i + ne.gray(D || "");
    }
    // shared with autocompleteMultiselect
    paginateOptions(e) {
      if (e.length === 0)
        return ne.red("No matches for this query.");
      let r = gF(this.cursor, e.length, this.optionsPerPage), u = r.startIndex, n = r.endIndex, o, i = [];
      for (let D = u; D < n; D++)
        D === u && u > 0 ? o = Te.arrowUp : D === n - 1 && n < e.length ? o = Te.arrowDown : o = " ", i.push(this.renderOption(this.cursor, e[D],
        D, o));
      return `
` + i.join(`
`);
    }
    // shared with autocomleteMultiselect
    renderOptions(e) {
      return this.done ? "" : this.paginateOptions(e);
    }
    renderDoneOrInstructions() {
      if (this.done)
        return this.value.filter((r) => r.selected).map((r) => r.title).join(", ");
      let e = [ne.gray(this.hint), this.renderInstructions()];
      return this.value[this.cursor].disabled && e.push(ne.yellow(this.warn)), e.join(" ");
    }
    render() {
      if (this.closed) return;
      this.firstRender && this.out.write(fF.hide), super.render();
      let e = [Xl.symbol(this.done, this.aborted), ne.bold(this.msg), Xl.delimiter(!1), this.renderDoneOrInstructions()].join(" ");
      this.showMinError && (e += ne.red(`You must select a minimum of ${this.minSelected} choices.`), this.showMinError = !1), e += this.renderOptions(
      this.value), this.out.write(this.clear + e), this.clear = Jl(e, this.out.columns);
    }
  };
  Ql.exports = Ki;
});

// ../node_modules/prompts/dist/elements/autocomplete.js
var nh = c((N6, sh) => {
  "use strict";
  function eh(t, e, r, u, n, o, i) {
    try {
      var D = t[o](i), a = D.value;
    } catch (l) {
      r(l);
      return;
    }
    D.done ? e(a) : Promise.resolve(a).then(u, n);
  }
  s(eh, "asyncGeneratorStep");
  function FF(t) {
    return function() {
      var e = this, r = arguments;
      return new Promise(function(u, n) {
        var o = t.apply(e, r);
        function i(a) {
          eh(o, u, n, i, D, "next", a);
        }
        s(i, "_next");
        function D(a) {
          eh(o, u, n, i, D, "throw", a);
        }
        s(D, "_throw"), i(void 0);
      });
    };
  }
  s(FF, "_asyncToGenerator");
  var Wt = L(), CF = ce(), ih = S(), EF = ih.erase, th = ih.cursor, Vt = ee(), Ji = Vt.style, rh = Vt.clear, Xi = Vt.figures, bF = Vt.wrap, xF = Vt.
  entriesToDisplay, uh = /* @__PURE__ */ s((t, e) => t[e] && (t[e].value || t[e].title || t[e]), "getVal"), vF = /* @__PURE__ */ s((t, e) => t[e] &&
  (t[e].title || t[e].value || t[e]), "getTitle"), yF = /* @__PURE__ */ s((t, e) => {
    let r = t.findIndex((u) => u.value === e || u.title === e);
    return r > -1 ? r : void 0;
  }, "getIndex"), Qi = class extends CF {
    static {
      s(this, "AutocompletePrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.suggest = e.suggest, this.choices = e.choices, this.initial = typeof e.initial == "number" ? e.initial :
      yF(e.choices, e.initial), this.select = this.initial || e.cursor || 0, this.i18n = {
        noMatches: e.noMatches || "no matches found"
      }, this.fallback = e.fallback || this.initial, this.clearFirst = e.clearFirst || !1, this.suggestions = [], this.input = "", this.limit =
      e.limit || 10, this.cursor = 0, this.transform = Ji.render(e.style), this.scale = this.transform.scale, this.render = this.render.bind(
      this), this.complete = this.complete.bind(this), this.clear = rh("", this.out.columns), this.complete(this.render), this.render();
    }
    set fallback(e) {
      this._fb = Number.isSafeInteger(parseInt(e)) ? parseInt(e) : e;
    }
    get fallback() {
      let e;
      return typeof this._fb == "number" ? e = this.choices[this._fb] : typeof this._fb == "string" && (e = {
        title: this._fb
      }), e || this._fb || {
        title: this.i18n.noMatches
      };
    }
    moveSelect(e) {
      this.select = e, this.suggestions.length > 0 ? this.value = uh(this.suggestions, e) : this.value = this.fallback.value, this.fire();
    }
    complete(e) {
      var r = this;
      return FF(function* () {
        let u = r.completing = r.suggest(r.input, r.choices), n = yield u;
        if (r.completing !== u) return;
        r.suggestions = n.map((i, D, a) => ({
          title: vF(a, D),
          value: uh(a, D),
          description: i.description
        })), r.completing = !1;
        let o = Math.max(n.length - 1, 0);
        r.moveSelect(Math.min(o, r.select)), e && e();
      })();
    }
    reset() {
      this.input = "", this.complete(() => {
        this.moveSelect(this.initial !== void 0 ? this.initial : 0), this.render();
      }), this.render();
    }
    exit() {
      this.clearFirst && this.input.length > 0 ? this.reset() : (this.done = this.exited = !0, this.aborted = !1, this.fire(), this.render(),
      this.out.write(`
`), this.close());
    }
    abort() {
      this.done = this.aborted = !0, this.exited = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.done = !0, this.aborted = this.exited = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    _(e, r) {
      let u = this.input.slice(0, this.cursor), n = this.input.slice(this.cursor);
      this.input = `${u}${e}${n}`, this.cursor = u.length + 1, this.complete(this.render), this.render();
    }
    delete() {
      if (this.cursor === 0) return this.bell();
      let e = this.input.slice(0, this.cursor - 1), r = this.input.slice(this.cursor);
      this.input = `${e}${r}`, this.complete(this.render), this.cursor = this.cursor - 1, this.render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length) return this.bell();
      let e = this.input.slice(0, this.cursor), r = this.input.slice(this.cursor + 1);
      this.input = `${e}${r}`, this.complete(this.render), this.render();
    }
    first() {
      this.moveSelect(0), this.render();
    }
    last() {
      this.moveSelect(this.suggestions.length - 1), this.render();
    }
    up() {
      this.select === 0 ? this.moveSelect(this.suggestions.length - 1) : this.moveSelect(this.select - 1), this.render();
    }
    down() {
      this.select === this.suggestions.length - 1 ? this.moveSelect(0) : this.moveSelect(this.select + 1), this.render();
    }
    next() {
      this.select === this.suggestions.length - 1 ? this.moveSelect(0) : this.moveSelect(this.select + 1), this.render();
    }
    nextPage() {
      this.moveSelect(Math.min(this.select + this.limit, this.suggestions.length - 1)), this.render();
    }
    prevPage() {
      this.moveSelect(Math.max(this.select - this.limit, 0)), this.render();
    }
    left() {
      if (this.cursor <= 0) return this.bell();
      this.cursor = this.cursor - 1, this.render();
    }
    right() {
      if (this.cursor * this.scale >= this.rendered.length) return this.bell();
      this.cursor = this.cursor + 1, this.render();
    }
    renderOption(e, r, u, n) {
      let o, i = u ? Xi.arrowUp : n ? Xi.arrowDown : " ", D = r ? Wt.cyan().underline(e.title) : e.title;
      return i = (r ? Wt.cyan(Xi.pointer) + " " : "  ") + i, e.description && (o = ` - ${e.description}`, (i.length + D.length + o.length >=
      this.out.columns || e.description.split(/\r?\n/).length > 1) && (o = `
` + bF(e.description, {
        margin: 3,
        width: this.out.columns
      }))), i + " " + D + Wt.gray(o || "");
    }
    render() {
      if (this.closed) return;
      this.firstRender ? this.out.write(th.hide) : this.out.write(rh(this.outputText, this.out.columns)), super.render();
      let e = xF(this.select, this.choices.length, this.limit), r = e.startIndex, u = e.endIndex;
      if (this.outputText = [Ji.symbol(this.done, this.aborted, this.exited), Wt.bold(this.msg), Ji.delimiter(this.completing), this.done &&
      this.suggestions[this.select] ? this.suggestions[this.select].title : this.rendered = this.transform.render(this.input)].join(" "), !this.
      done) {
        let n = this.suggestions.slice(r, u).map((o, i) => this.renderOption(o, this.select === i + r, i === 0 && r > 0, i + r === u - 1 && u <
        this.choices.length)).join(`
`);
        this.outputText += `
` + (n || Wt.gray(this.fallback.title));
      }
      this.out.write(EF.line + th.to(0) + this.outputText);
    }
  };
  sh.exports = Qi;
});

// ../node_modules/prompts/dist/elements/autocompleteMultiselect.js
var lh = c((G6, ah) => {
  "use strict";
  var pe = L(), BF = S(), wF = BF.cursor, AF = Zi(), ts = ee(), oh = ts.clear, Dh = ts.style, ct = ts.figures, es = class extends AF {
    static {
      s(this, "AutocompleteMultiselectPrompt");
    }
    constructor(e = {}) {
      e.overrideRender = !0, super(e), this.inputValue = "", this.clear = oh("", this.out.columns), this.filteredOptions = this.value, this.
      render();
    }
    last() {
      this.cursor = this.filteredOptions.length - 1, this.render();
    }
    next() {
      this.cursor = (this.cursor + 1) % this.filteredOptions.length, this.render();
    }
    up() {
      this.cursor === 0 ? this.cursor = this.filteredOptions.length - 1 : this.cursor--, this.render();
    }
    down() {
      this.cursor === this.filteredOptions.length - 1 ? this.cursor = 0 : this.cursor++, this.render();
    }
    left() {
      this.filteredOptions[this.cursor].selected = !1, this.render();
    }
    right() {
      if (this.value.filter((e) => e.selected).length >= this.maxChoices) return this.bell();
      this.filteredOptions[this.cursor].selected = !0, this.render();
    }
    delete() {
      this.inputValue.length && (this.inputValue = this.inputValue.substr(0, this.inputValue.length - 1), this.updateFilteredOptions());
    }
    updateFilteredOptions() {
      let e = this.filteredOptions[this.cursor];
      this.filteredOptions = this.value.filter((u) => this.inputValue ? !!(typeof u.title == "string" && u.title.toLowerCase().includes(this.
      inputValue.toLowerCase()) || typeof u.value == "string" && u.value.toLowerCase().includes(this.inputValue.toLowerCase())) : !0);
      let r = this.filteredOptions.findIndex((u) => u === e);
      this.cursor = r < 0 ? 0 : r, this.render();
    }
    handleSpaceToggle() {
      let e = this.filteredOptions[this.cursor];
      if (e.selected)
        e.selected = !1, this.render();
      else {
        if (e.disabled || this.value.filter((r) => r.selected).length >= this.maxChoices)
          return this.bell();
        e.selected = !0, this.render();
      }
    }
    handleInputChange(e) {
      this.inputValue = this.inputValue + e, this.updateFilteredOptions();
    }
    _(e, r) {
      e === " " ? this.handleSpaceToggle() : this.handleInputChange(e);
    }
    renderInstructions() {
      return this.instructions === void 0 || this.instructions ? typeof this.instructions == "string" ? this.instructions : `
Instructions:
    ${ct.arrowUp}/${ct.arrowDown}: Highlight option
    ${ct.arrowLeft}/${ct.arrowRight}/[space]: Toggle selection
    [a,b,c]/delete: Filter choices
    enter/return: Complete answer
` : "";
    }
    renderCurrentInput() {
      return `
Filtered results for: ${this.inputValue ? this.inputValue : pe.gray("Enter something to filter")}
`;
    }
    renderOption(e, r, u) {
      let n;
      return r.disabled ? n = e === u ? pe.gray().underline(r.title) : pe.strikethrough().gray(r.title) : n = e === u ? pe.cyan().underline(
      r.title) : r.title, (r.selected ? pe.green(ct.radioOn) : ct.radioOff) + "  " + n;
    }
    renderDoneOrInstructions() {
      if (this.done)
        return this.value.filter((r) => r.selected).map((r) => r.title).join(", ");
      let e = [pe.gray(this.hint), this.renderInstructions(), this.renderCurrentInput()];
      return this.filteredOptions.length && this.filteredOptions[this.cursor].disabled && e.push(pe.yellow(this.warn)), e.join(" ");
    }
    render() {
      if (this.closed) return;
      this.firstRender && this.out.write(wF.hide), super.render();
      let e = [Dh.symbol(this.done, this.aborted), pe.bold(this.msg), Dh.delimiter(!1), this.renderDoneOrInstructions()].join(" ");
      this.showMinError && (e += pe.red(`You must select a minimum of ${this.minSelected} choices.`), this.showMinError = !1), e += this.renderOptions(
      this.filteredOptions), this.out.write(this.clear + e), this.clear = oh(e, this.out.columns);
    }
  };
  ah.exports = es;
});

// ../node_modules/prompts/dist/elements/confirm.js
var gh = c((V6, mh) => {
  "use strict";
  var hh = L(), SF = ce(), fh = ee(), ch = fh.style, TF = fh.clear, ph = S(), $F = ph.erase, dh = ph.cursor, rs = class extends SF {
    static {
      s(this, "ConfirmPrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.value = e.initial, this.initialValue = !!e.initial, this.yesMsg = e.yes || "yes", this.yesOption =
      e.yesOption || "(Y/n)", this.noMsg = e.no || "no", this.noOption = e.noOption || "(y/N)", this.render();
    }
    reset() {
      this.value = this.initialValue, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.value = this.value || !1, this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    _(e, r) {
      return e.toLowerCase() === "y" ? (this.value = !0, this.submit()) : e.toLowerCase() === "n" ? (this.value = !1, this.submit()) : this.
      bell();
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(dh.hide) : this.out.write(TF(this.outputText, this.out.columns)), super.render(), this.
      outputText = [ch.symbol(this.done, this.aborted), hh.bold(this.msg), ch.delimiter(this.done), this.done ? this.value ? this.yesMsg : this.
      noMsg : hh.gray(this.initialValue ? this.yesOption : this.noOption)].join(" "), this.out.write($F.line + dh.to(0) + this.outputText));
    }
  };
  mh.exports = rs;
});

// ../node_modules/prompts/dist/elements/index.js
var Ch = c((Y6, Fh) => {
  "use strict";
  Fh.exports = {
    TextPrompt: il(),
    SelectPrompt: Dl(),
    TogglePrompt: fl(),
    DatePrompt: Wl(),
    NumberPrompt: Zl(),
    MultiselectPrompt: Zi(),
    AutocompletePrompt: nh(),
    AutocompleteMultiselectPrompt: lh(),
    ConfirmPrompt: gh()
  };
});

// ../node_modules/prompts/dist/prompts.js
var bh = c((Eh) => {
  "use strict";
  var V = Eh, OF = Ch(), Yr = /* @__PURE__ */ s((t) => t, "noop");
  function oe(t, e, r = {}) {
    return new Promise((u, n) => {
      let o = new OF[t](e), i = r.onAbort || Yr, D = r.onSubmit || Yr, a = r.onExit || Yr;
      o.on("state", e.onState || Yr), o.on("submit", (l) => u(D(l))), o.on("exit", (l) => u(a(l))), o.on("abort", (l) => n(i(l)));
    });
  }
  s(oe, "toPrompt");
  V.text = (t) => oe("TextPrompt", t);
  V.password = (t) => (t.style = "password", V.text(t));
  V.invisible = (t) => (t.style = "invisible", V.text(t));
  V.number = (t) => oe("NumberPrompt", t);
  V.date = (t) => oe("DatePrompt", t);
  V.confirm = (t) => oe("ConfirmPrompt", t);
  V.list = (t) => {
    let e = t.separator || ",";
    return oe("TextPrompt", t, {
      onSubmit: /* @__PURE__ */ s((r) => r.split(e).map((u) => u.trim()), "onSubmit")
    });
  };
  V.toggle = (t) => oe("TogglePrompt", t);
  V.select = (t) => oe("SelectPrompt", t);
  V.multiselect = (t) => {
    t.choices = [].concat(t.choices || []);
    let e = /* @__PURE__ */ s((r) => r.filter((u) => u.selected).map((u) => u.value), "toSelected");
    return oe("MultiselectPrompt", t, {
      onAbort: e,
      onSubmit: e
    });
  };
  V.autocompleteMultiselect = (t) => {
    t.choices = [].concat(t.choices || []);
    let e = /* @__PURE__ */ s((r) => r.filter((u) => u.selected).map((u) => u.value), "toSelected");
    return oe("AutocompleteMultiselectPrompt", t, {
      onAbort: e,
      onSubmit: e
    });
  };
  var _F = /* @__PURE__ */ s((t, e) => Promise.resolve(e.filter((r) => r.title.slice(0, t.length).toLowerCase() === t.toLowerCase())), "byTi\
tle");
  V.autocomplete = (t) => (t.suggest = t.suggest || _F, t.choices = [].concat(t.choices || []), oe("AutocompletePrompt", t));
});

// ../node_modules/prompts/dist/index.js
var Th = c((K6, Sh) => {
  "use strict";
  function xh(t, e) {
    var r = Object.keys(t);
    if (Object.getOwnPropertySymbols) {
      var u = Object.getOwnPropertySymbols(t);
      e && (u = u.filter(function(n) {
        return Object.getOwnPropertyDescriptor(t, n).enumerable;
      })), r.push.apply(r, u);
    }
    return r;
  }
  s(xh, "ownKeys");
  function vh(t) {
    for (var e = 1; e < arguments.length; e++) {
      var r = arguments[e] != null ? arguments[e] : {};
      e % 2 ? xh(Object(r), !0).forEach(function(u) {
        IF(t, u, r[u]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(t, Object.getOwnPropertyDescriptors(r)) : xh(Object(r)).forEach(function(u) {
        Object.defineProperty(t, u, Object.getOwnPropertyDescriptor(r, u));
      });
    }
    return t;
  }
  s(vh, "_objectSpread");
  function IF(t, e, r) {
    return e in t ? Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }) : t[e] = r, t;
  }
  s(IF, "_defineProperty");
  function LF(t, e) {
    var r = typeof Symbol < "u" && t[Symbol.iterator] || t["@@iterator"];
    if (!r) {
      if (Array.isArray(t) || (r = kF(t)) || e && t && typeof t.length == "number") {
        r && (t = r);
        var u = 0, n = /* @__PURE__ */ s(function() {
        }, "F");
        return { s: n, n: /* @__PURE__ */ s(function() {
          return u >= t.length ? { done: !0 } : { done: !1, value: t[u++] };
        }, "n"), e: /* @__PURE__ */ s(function(l) {
          throw l;
        }, "e"), f: n };
      }
      throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
    }
    var o = !0, i = !1, D;
    return { s: /* @__PURE__ */ s(function() {
      r = r.call(t);
    }, "s"), n: /* @__PURE__ */ s(function() {
      var l = r.next();
      return o = l.done, l;
    }, "n"), e: /* @__PURE__ */ s(function(l) {
      i = !0, D = l;
    }, "e"), f: /* @__PURE__ */ s(function() {
      try {
        !o && r.return != null && r.return();
      } finally {
        if (i) throw D;
      }
    }, "f") };
  }
  s(LF, "_createForOfIteratorHelper");
  function kF(t, e) {
    if (t) {
      if (typeof t == "string") return yh(t, e);
      var r = Object.prototype.toString.call(t).slice(8, -1);
      if (r === "Object" && t.constructor && (r = t.constructor.name), r === "Map" || r === "Set") return Array.from(t);
      if (r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)) return yh(t, e);
    }
  }
  s(kF, "_unsupportedIterableToArray");
  function yh(t, e) {
    (e == null || e > t.length) && (e = t.length);
    for (var r = 0, u = new Array(e); r < e; r++) u[r] = t[r];
    return u;
  }
  s(yh, "_arrayLikeToArray");
  function Bh(t, e, r, u, n, o, i) {
    try {
      var D = t[o](i), a = D.value;
    } catch (l) {
      r(l);
      return;
    }
    D.done ? e(a) : Promise.resolve(a).then(u, n);
  }
  s(Bh, "asyncGeneratorStep");
  function wh(t) {
    return function() {
      var e = this, r = arguments;
      return new Promise(function(u, n) {
        var o = t.apply(e, r);
        function i(a) {
          Bh(o, u, n, i, D, "next", a);
        }
        s(i, "_next");
        function D(a) {
          Bh(o, u, n, i, D, "throw", a);
        }
        s(D, "_throw"), i(void 0);
      });
    };
  }
  s(wh, "_asyncToGenerator");
  var us = bh(), PF = ["suggest", "format", "onState", "validate", "onRender", "type"], Ah = /* @__PURE__ */ s(() => {
  }, "noop");
  function $e() {
    return is.apply(this, arguments);
  }
  s($e, "prompt");
  function is() {
    return is = wh(function* (t = [], {
      onSubmit: e = Ah,
      onCancel: r = Ah
    } = {}) {
      let u = {}, n = $e._override || {};
      t = [].concat(t);
      let o, i, D, a, l, h, p = /* @__PURE__ */ function() {
        var E = wh(function* (b, B, M = !1) {
          if (!(!M && b.validate && b.validate(B) !== !0))
            return b.format ? yield b.format(B, u) : B;
        });
        return /* @__PURE__ */ s(function(B, M) {
          return E.apply(this, arguments);
        }, "getFormattedAnswer");
      }();
      var d = LF(t), m;
      try {
        for (d.s(); !(m = d.n()).done; ) {
          i = m.value;
          var g = i;
          if (a = g.name, l = g.type, typeof l == "function" && (l = yield l(o, vh({}, u), i), i.type = l), !!l) {
            for (let E in i) {
              if (PF.includes(E)) continue;
              let b = i[E];
              i[E] = typeof b == "function" ? yield b(o, vh({}, u), h) : b;
            }
            if (h = i, typeof i.message != "string")
              throw new Error("prompt message is required");
            var F = i;
            if (a = F.name, l = F.type, us[l] === void 0)
              throw new Error(`prompt type (${l}) is not defined`);
            if (n[i.name] !== void 0 && (o = yield p(i, n[i.name]), o !== void 0)) {
              u[a] = o;
              continue;
            }
            try {
              o = $e._injected ? MF($e._injected, i.initial) : yield us[l](i), u[a] = o = yield p(i, o, !0), D = yield e(i, o, u);
            } catch {
              D = !(yield r(i, u));
            }
            if (D) return u;
          }
        }
      } catch (E) {
        d.e(E);
      } finally {
        d.f();
      }
      return u;
    }), is.apply(this, arguments);
  }
  s(is, "_prompt");
  function MF(t, e) {
    let r = t.shift();
    if (r instanceof Error)
      throw r;
    return r === void 0 ? e : r;
  }
  s(MF, "getInjectedAnswer");
  function RF(t) {
    $e._injected = ($e._injected || []).concat(t);
  }
  s(RF, "inject");
  function qF(t) {
    $e._override = Object.assign({}, t);
  }
  s(qF, "override");
  Sh.exports = Object.assign($e, {
    prompt: $e,
    prompts: us,
    inject: RF,
    override: qF
  });
});

// ../node_modules/prompts/lib/util/action.js
var Oh = c((J6, $h) => {
  "use strict";
  $h.exports = (t, e) => {
    if (!(t.meta && t.name !== "escape")) {
      if (t.ctrl) {
        if (t.name === "a") return "first";
        if (t.name === "c" || t.name === "d") return "abort";
        if (t.name === "e") return "last";
        if (t.name === "g") return "reset";
      }
      if (e) {
        if (t.name === "j") return "down";
        if (t.name === "k") return "up";
      }
      return t.name === "return" || t.name === "enter" ? "submit" : t.name === "backspace" ? "delete" : t.name === "delete" ? "deleteForward" :
      t.name === "abort" ? "abort" : t.name === "escape" ? "exit" : t.name === "tab" ? "next" : t.name === "pagedown" ? "nextPage" : t.name ===
      "pageup" ? "prevPage" : t.name === "home" ? "home" : t.name === "end" ? "end" : t.name === "up" ? "up" : t.name === "down" ? "down" : t.
      name === "right" ? "right" : t.name === "left" ? "left" : !1;
    }
  };
});

// ../node_modules/prompts/lib/util/strip.js
var Hr = c((X6, _h) => {
  "use strict";
  _h.exports = (t) => {
    let e = [
      "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
      "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))"
    ].join("|"), r = new RegExp(e, "g");
    return typeof t == "string" ? t.replace(r, "") : t;
  };
});

// ../node_modules/prompts/lib/util/clear.js
var kh = c((Q6, Lh) => {
  "use strict";
  var NF = Hr(), { erase: Ih, cursor: jF } = S(), GF = /* @__PURE__ */ s((t) => [...NF(t)].length, "width");
  Lh.exports = function(t, e) {
    if (!e) return Ih.line + jF.to(0);
    let r = 0, u = t.split(/\r?\n/);
    for (let n of u)
      r += 1 + Math.floor(Math.max(GF(n) - 1, 0) / e);
    return Ih.lines(r);
  };
});

// ../node_modules/prompts/lib/util/figures.js
var ss = c((tb, Ph) => {
  "use strict";
  var Ut = {
    arrowUp: "\u2191",
    arrowDown: "\u2193",
    arrowLeft: "\u2190",
    arrowRight: "\u2192",
    radioOn: "\u25C9",
    radioOff: "\u25EF",
    tick: "\u2714",
    cross: "\u2716",
    ellipsis: "\u2026",
    pointerSmall: "\u203A",
    line: "\u2500",
    pointer: "\u276F"
  }, WF = {
    arrowUp: Ut.arrowUp,
    arrowDown: Ut.arrowDown,
    arrowLeft: Ut.arrowLeft,
    arrowRight: Ut.arrowRight,
    radioOn: "(*)",
    radioOff: "( )",
    tick: "\u221A",
    cross: "\xD7",
    ellipsis: "...",
    pointerSmall: "\xBB",
    line: "\u2500",
    pointer: ">"
  }, VF = process.platform === "win32" ? WF : Ut;
  Ph.exports = VF;
});

// ../node_modules/prompts/lib/util/style.js
var Rh = c((rb, Mh) => {
  "use strict";
  var dt = L(), Ge = ss(), ns = Object.freeze({
    password: { scale: 1, render: /* @__PURE__ */ s((t) => "*".repeat(t.length), "render") },
    emoji: { scale: 2, render: /* @__PURE__ */ s((t) => "\u{1F603}".repeat(t.length), "render") },
    invisible: { scale: 0, render: /* @__PURE__ */ s((t) => "", "render") },
    default: { scale: 1, render: /* @__PURE__ */ s((t) => `${t}`, "render") }
  }), UF = /* @__PURE__ */ s((t) => ns[t] || ns.default, "render"), Yt = Object.freeze({
    aborted: dt.red(Ge.cross),
    done: dt.green(Ge.tick),
    exited: dt.yellow(Ge.cross),
    default: dt.cyan("?")
  }), YF = /* @__PURE__ */ s((t, e, r) => e ? Yt.aborted : r ? Yt.exited : t ? Yt.done : Yt.default, "symbol"), HF = /* @__PURE__ */ s((t) => dt.
  gray(t ? Ge.ellipsis : Ge.pointerSmall), "delimiter"), zF = /* @__PURE__ */ s((t, e) => dt.gray(t ? e ? Ge.pointerSmall : "+" : Ge.line), "\
item");
  Mh.exports = {
    styles: ns,
    render: UF,
    symbols: Yt,
    symbol: YF,
    delimiter: HF,
    item: zF
  };
});

// ../node_modules/prompts/lib/util/lines.js
var Nh = c((ib, qh) => {
  "use strict";
  var KF = Hr();
  qh.exports = function(t, e) {
    let r = String(KF(t) || "").split(/\r?\n/);
    return e ? r.map((u) => Math.ceil(u.length / e)).reduce((u, n) => u + n) : r.length;
  };
});

// ../node_modules/prompts/lib/util/wrap.js
var Gh = c((sb, jh) => {
  "use strict";
  jh.exports = (t, e = {}) => {
    let r = Number.isSafeInteger(parseInt(e.margin)) ? new Array(parseInt(e.margin)).fill(" ").join("") : e.margin || "", u = e.width;
    return (t || "").split(/\r?\n/g).map((n) => n.split(/\s+/g).reduce((o, i) => (i.length + r.length >= u || o[o.length - 1].length + i.length +
    1 < u ? o[o.length - 1] += ` ${i}` : o.push(`${r}${i}`), o), [r]).join(`
`)).join(`
`);
  };
});

// ../node_modules/prompts/lib/util/entriesToDisplay.js
var Vh = c((nb, Wh) => {
  "use strict";
  Wh.exports = (t, e, r) => {
    r = r || e;
    let u = Math.min(e - r, t - Math.floor(r / 2));
    u < 0 && (u = 0);
    let n = Math.min(u + r, e);
    return { startIndex: u, endIndex: n };
  };
});

// ../node_modules/prompts/lib/util/index.js
var te = c((ob, Uh) => {
  "use strict";
  Uh.exports = {
    action: Oh(),
    clear: kh(),
    style: Rh(),
    strip: Hr(),
    figures: ss(),
    lines: Nh(),
    wrap: Gh(),
    entriesToDisplay: Vh()
  };
});

// ../node_modules/prompts/lib/elements/prompt.js
var me = c((Db, Hh) => {
  "use strict";
  var Yh = require("readline"), { action: ZF } = te(), JF = require("events"), { beep: XF, cursor: QF } = S(), e2 = L(), os = class extends JF {
    static {
      s(this, "Prompt");
    }
    constructor(e = {}) {
      super(), this.firstRender = !0, this.in = e.stdin || process.stdin, this.out = e.stdout || process.stdout, this.onRender = (e.onRender ||
      (() => {
      })).bind(this);
      let r = Yh.createInterface({ input: this.in, escapeCodeTimeout: 50 });
      Yh.emitKeypressEvents(this.in, r), this.in.isTTY && this.in.setRawMode(!0);
      let u = ["SelectPrompt", "MultiselectPrompt"].indexOf(this.constructor.name) > -1, n = /* @__PURE__ */ s((o, i) => {
        let D = ZF(i, u);
        D === !1 ? this._ && this._(o, i) : typeof this[D] == "function" ? this[D](i) : this.bell();
      }, "keypress");
      this.close = () => {
        this.out.write(QF.show), this.in.removeListener("keypress", n), this.in.isTTY && this.in.setRawMode(!1), r.close(), this.emit(this.aborted ?
        "abort" : this.exited ? "exit" : "submit", this.value), this.closed = !0;
      }, this.in.on("keypress", n);
    }
    fire() {
      this.emit("state", {
        value: this.value,
        aborted: !!this.aborted,
        exited: !!this.exited
      });
    }
    bell() {
      this.out.write(XF);
    }
    render() {
      this.onRender(e2), this.firstRender && (this.firstRender = !1);
    }
  };
  Hh.exports = os;
});

// ../node_modules/prompts/lib/elements/text.js
var Kh = c((lb, zh) => {
  var zr = L(), t2 = me(), { erase: r2, cursor: Ht } = S(), { style: Ds, clear: as, lines: u2, figures: i2 } = te(), ls = class extends t2 {
    static {
      s(this, "TextPrompt");
    }
    constructor(e = {}) {
      super(e), this.transform = Ds.render(e.style), this.scale = this.transform.scale, this.msg = e.message, this.initial = e.initial || "",
      this.validator = e.validate || (() => !0), this.value = "", this.errorMsg = e.error || "Please Enter A Valid Value", this.cursor = +!!this.
      initial, this.cursorOffset = 0, this.clear = as("", this.out.columns), this.render();
    }
    set value(e) {
      !e && this.initial ? (this.placeholder = !0, this.rendered = zr.gray(this.transform.render(this.initial))) : (this.placeholder = !1, this.
      rendered = this.transform.render(e)), this._value = e, this.fire();
    }
    get value() {
      return this._value;
    }
    reset() {
      this.value = "", this.cursor = +!!this.initial, this.cursorOffset = 0, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.value = this.value || this.initial, this.done = this.aborted = !0, this.error = !1, this.red = !1, this.fire(), this.render(), this.
      out.write(`
`), this.close();
    }
    async validate() {
      let e = await this.validator(this.value);
      typeof e == "string" && (this.errorMsg = e, e = !1), this.error = !e;
    }
    async submit() {
      if (this.value = this.value || this.initial, this.cursorOffset = 0, this.cursor = this.rendered.length, await this.validate(), this.error) {
        this.red = !0, this.fire(), this.render();
        return;
      }
      this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    next() {
      if (!this.placeholder) return this.bell();
      this.value = this.initial, this.cursor = this.rendered.length, this.fire(), this.render();
    }
    moveCursor(e) {
      this.placeholder || (this.cursor = this.cursor + e, this.cursorOffset += e);
    }
    _(e, r) {
      let u = this.value.slice(0, this.cursor), n = this.value.slice(this.cursor);
      this.value = `${u}${e}${n}`, this.red = !1, this.cursor = this.placeholder ? 0 : u.length + 1, this.render();
    }
    delete() {
      if (this.isCursorAtStart()) return this.bell();
      let e = this.value.slice(0, this.cursor - 1), r = this.value.slice(this.cursor);
      this.value = `${e}${r}`, this.red = !1, this.isCursorAtStart() ? this.cursorOffset = 0 : (this.cursorOffset++, this.moveCursor(-1)), this.
      render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length || this.placeholder) return this.bell();
      let e = this.value.slice(0, this.cursor), r = this.value.slice(this.cursor + 1);
      this.value = `${e}${r}`, this.red = !1, this.isCursorAtEnd() ? this.cursorOffset = 0 : this.cursorOffset++, this.render();
    }
    first() {
      this.cursor = 0, this.render();
    }
    last() {
      this.cursor = this.value.length, this.render();
    }
    left() {
      if (this.cursor <= 0 || this.placeholder) return this.bell();
      this.moveCursor(-1), this.render();
    }
    right() {
      if (this.cursor * this.scale >= this.rendered.length || this.placeholder) return this.bell();
      this.moveCursor(1), this.render();
    }
    isCursorAtStart() {
      return this.cursor === 0 || this.placeholder && this.cursor === 1;
    }
    isCursorAtEnd() {
      return this.cursor === this.rendered.length || this.placeholder && this.cursor === this.rendered.length + 1;
    }
    render() {
      this.closed || (this.firstRender || (this.outputError && this.out.write(Ht.down(u2(this.outputError, this.out.columns) - 1) + as(this.
      outputError, this.out.columns)), this.out.write(as(this.outputText, this.out.columns))), super.render(), this.outputError = "", this.outputText =
      [
        Ds.symbol(this.done, this.aborted),
        zr.bold(this.msg),
        Ds.delimiter(this.done),
        this.red ? zr.red(this.rendered) : this.rendered
      ].join(" "), this.error && (this.outputError += this.errorMsg.split(`
`).reduce((e, r, u) => e + `
${u ? " " : i2.pointerSmall} ${zr.red().italic(r)}`, "")), this.out.write(r2.line + Ht.to(0) + this.outputText + Ht.save + this.outputError +
      Ht.restore + Ht.move(this.cursorOffset, 0)));
    }
  };
  zh.exports = ls;
});

// ../node_modules/prompts/lib/elements/select.js
var Qh = c((cb, Xh) => {
  "use strict";
  var ge = L(), s2 = me(), { style: Zh, clear: Jh, figures: Kr, wrap: n2, entriesToDisplay: o2 } = te(), { cursor: D2 } = S(), hs = class extends s2 {
    static {
      s(this, "SelectPrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.hint = e.hint || "- Use arrow-keys. Return to submit.", this.warn = e.warn || "- This option is d\
isabled", this.cursor = e.initial || 0, this.choices = e.choices.map((r, u) => (typeof r == "string" && (r = { title: r, value: u }), {
        title: r && (r.title || r.value || r),
        value: r && (r.value === void 0 ? u : r.value),
        description: r && r.description,
        selected: r && r.selected,
        disabled: r && r.disabled
      })), this.optionsPerPage = e.optionsPerPage || 10, this.value = (this.choices[this.cursor] || {}).value, this.clear = Jh("", this.out.
      columns), this.render();
    }
    moveCursor(e) {
      this.cursor = e, this.value = this.choices[e].value, this.fire();
    }
    reset() {
      this.moveCursor(0), this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.selection.disabled ? this.bell() : (this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close());
    }
    first() {
      this.moveCursor(0), this.render();
    }
    last() {
      this.moveCursor(this.choices.length - 1), this.render();
    }
    up() {
      this.cursor === 0 ? this.moveCursor(this.choices.length - 1) : this.moveCursor(this.cursor - 1), this.render();
    }
    down() {
      this.cursor === this.choices.length - 1 ? this.moveCursor(0) : this.moveCursor(this.cursor + 1), this.render();
    }
    next() {
      this.moveCursor((this.cursor + 1) % this.choices.length), this.render();
    }
    _(e, r) {
      if (e === " ") return this.submit();
    }
    get selection() {
      return this.choices[this.cursor];
    }
    render() {
      if (this.closed) return;
      this.firstRender ? this.out.write(D2.hide) : this.out.write(Jh(this.outputText, this.out.columns)), super.render();
      let { startIndex: e, endIndex: r } = o2(this.cursor, this.choices.length, this.optionsPerPage);
      if (this.outputText = [
        Zh.symbol(this.done, this.aborted),
        ge.bold(this.msg),
        Zh.delimiter(!1),
        this.done ? this.selection.title : this.selection.disabled ? ge.yellow(this.warn) : ge.gray(this.hint)
      ].join(" "), !this.done) {
        this.outputText += `
`;
        for (let u = e; u < r; u++) {
          let n, o, i = "", D = this.choices[u];
          u === e && e > 0 ? o = Kr.arrowUp : u === r - 1 && r < this.choices.length ? o = Kr.arrowDown : o = " ", D.disabled ? (n = this.cursor ===
          u ? ge.gray().underline(D.title) : ge.strikethrough().gray(D.title), o = (this.cursor === u ? ge.bold().gray(Kr.pointer) + " " : "\
  ") + o) : (n = this.cursor === u ? ge.cyan().underline(D.title) : D.title, o = (this.cursor === u ? ge.cyan(Kr.pointer) + " " : "  ") + o,
          D.description && this.cursor === u && (i = ` - ${D.description}`, (o.length + n.length + i.length >= this.out.columns || D.description.
          split(/\r?\n/).length > 1) && (i = `
` + n2(D.description, { margin: 3, width: this.out.columns })))), this.outputText += `${o} ${n}${ge.gray(i)}
`;
        }
      }
      this.out.write(this.outputText);
    }
  };
  Xh.exports = hs;
});

// ../node_modules/prompts/lib/elements/toggle.js
var uc = c((fb, rc) => {
  var Zr = L(), a2 = me(), { style: ec, clear: l2 } = te(), { cursor: tc, erase: h2 } = S(), cs = class extends a2 {
    static {
      s(this, "TogglePrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.value = !!e.initial, this.active = e.active || "on", this.inactive = e.inactive || "off", this.initialValue =
      this.value, this.render();
    }
    reset() {
      this.value = this.initialValue, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    deactivate() {
      if (this.value === !1) return this.bell();
      this.value = !1, this.render();
    }
    activate() {
      if (this.value === !0) return this.bell();
      this.value = !0, this.render();
    }
    delete() {
      this.deactivate();
    }
    left() {
      this.deactivate();
    }
    right() {
      this.activate();
    }
    down() {
      this.deactivate();
    }
    up() {
      this.activate();
    }
    next() {
      this.value = !this.value, this.fire(), this.render();
    }
    _(e, r) {
      if (e === " ")
        this.value = !this.value;
      else if (e === "1")
        this.value = !0;
      else if (e === "0")
        this.value = !1;
      else return this.bell();
      this.render();
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(tc.hide) : this.out.write(l2(this.outputText, this.out.columns)), super.render(), this.
      outputText = [
        ec.symbol(this.done, this.aborted),
        Zr.bold(this.msg),
        ec.delimiter(this.done),
        this.value ? this.inactive : Zr.cyan().underline(this.inactive),
        Zr.gray("/"),
        this.value ? Zr.cyan().underline(this.active) : this.active
      ].join(" "), this.out.write(h2.line + tc.to(0) + this.outputText));
    }
  };
  rc.exports = cs;
});

// ../node_modules/prompts/lib/dateparts/datepart.js
var De = c((mb, ic) => {
  "use strict";
  var ds = class t {
    static {
      s(this, "DatePart");
    }
    constructor({ token: e, date: r, parts: u, locales: n }) {
      this.token = e, this.date = r || /* @__PURE__ */ new Date(), this.parts = u || [this], this.locales = n || {};
    }
    up() {
    }
    down() {
    }
    next() {
      let e = this.parts.indexOf(this);
      return this.parts.find((r, u) => u > e && r instanceof t);
    }
    setTo(e) {
    }
    prev() {
      let e = [].concat(this.parts).reverse(), r = e.indexOf(this);
      return e.find((u, n) => n > r && u instanceof t);
    }
    toString() {
      return String(this.date);
    }
  };
  ic.exports = ds;
});

// ../node_modules/prompts/lib/dateparts/meridiem.js
var nc = c((Fb, sc) => {
  "use strict";
  var c2 = De(), fs = class extends c2 {
    static {
      s(this, "Meridiem");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setHours((this.date.getHours() + 12) % 24);
    }
    down() {
      this.up();
    }
    toString() {
      let e = this.date.getHours() > 12 ? "pm" : "am";
      return /\A/.test(this.token) ? e.toUpperCase() : e;
    }
  };
  sc.exports = fs;
});

// ../node_modules/prompts/lib/dateparts/day.js
var Dc = c((Eb, oc) => {
  "use strict";
  var d2 = De(), f2 = /* @__PURE__ */ s((t) => (t = t % 10, t === 1 ? "st" : t === 2 ? "nd" : t === 3 ? "rd" : "th"), "pos"), ps = class extends d2 {
    static {
      s(this, "Day");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setDate(this.date.getDate() + 1);
    }
    down() {
      this.date.setDate(this.date.getDate() - 1);
    }
    setTo(e) {
      this.date.setDate(parseInt(e.substr(-2)));
    }
    toString() {
      let e = this.date.getDate(), r = this.date.getDay();
      return this.token === "DD" ? String(e).padStart(2, "0") : this.token === "Do" ? e + f2(e) : this.token === "d" ? r + 1 : this.token ===
      "ddd" ? this.locales.weekdaysShort[r] : this.token === "dddd" ? this.locales.weekdays[r] : e;
    }
  };
  oc.exports = ps;
});

// ../node_modules/prompts/lib/dateparts/hours.js
var lc = c((xb, ac) => {
  "use strict";
  var p2 = De(), ms = class extends p2 {
    static {
      s(this, "Hours");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setHours(this.date.getHours() + 1);
    }
    down() {
      this.date.setHours(this.date.getHours() - 1);
    }
    setTo(e) {
      this.date.setHours(parseInt(e.substr(-2)));
    }
    toString() {
      let e = this.date.getHours();
      return /h/.test(this.token) && (e = e % 12 || 12), this.token.length > 1 ? String(e).padStart(2, "0") : e;
    }
  };
  ac.exports = ms;
});

// ../node_modules/prompts/lib/dateparts/milliseconds.js
var cc = c((yb, hc) => {
  "use strict";
  var m2 = De(), gs = class extends m2 {
    static {
      s(this, "Milliseconds");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setMilliseconds(this.date.getMilliseconds() + 1);
    }
    down() {
      this.date.setMilliseconds(this.date.getMilliseconds() - 1);
    }
    setTo(e) {
      this.date.setMilliseconds(parseInt(e.substr(-this.token.length)));
    }
    toString() {
      return String(this.date.getMilliseconds()).padStart(4, "0").substr(0, this.token.length);
    }
  };
  hc.exports = gs;
});

// ../node_modules/prompts/lib/dateparts/minutes.js
var fc = c((wb, dc) => {
  "use strict";
  var g2 = De(), Fs = class extends g2 {
    static {
      s(this, "Minutes");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setMinutes(this.date.getMinutes() + 1);
    }
    down() {
      this.date.setMinutes(this.date.getMinutes() - 1);
    }
    setTo(e) {
      this.date.setMinutes(parseInt(e.substr(-2)));
    }
    toString() {
      let e = this.date.getMinutes();
      return this.token.length > 1 ? String(e).padStart(2, "0") : e;
    }
  };
  dc.exports = Fs;
});

// ../node_modules/prompts/lib/dateparts/month.js
var mc = c((Sb, pc) => {
  "use strict";
  var F2 = De(), Cs = class extends F2 {
    static {
      s(this, "Month");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setMonth(this.date.getMonth() + 1);
    }
    down() {
      this.date.setMonth(this.date.getMonth() - 1);
    }
    setTo(e) {
      e = parseInt(e.substr(-2)) - 1, this.date.setMonth(e < 0 ? 0 : e);
    }
    toString() {
      let e = this.date.getMonth(), r = this.token.length;
      return r === 2 ? String(e + 1).padStart(2, "0") : r === 3 ? this.locales.monthsShort[e] : r === 4 ? this.locales.months[e] : String(e +
      1);
    }
  };
  pc.exports = Cs;
});

// ../node_modules/prompts/lib/dateparts/seconds.js
var Fc = c(($b, gc) => {
  "use strict";
  var C2 = De(), Es = class extends C2 {
    static {
      s(this, "Seconds");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setSeconds(this.date.getSeconds() + 1);
    }
    down() {
      this.date.setSeconds(this.date.getSeconds() - 1);
    }
    setTo(e) {
      this.date.setSeconds(parseInt(e.substr(-2)));
    }
    toString() {
      let e = this.date.getSeconds();
      return this.token.length > 1 ? String(e).padStart(2, "0") : e;
    }
  };
  gc.exports = Es;
});

// ../node_modules/prompts/lib/dateparts/year.js
var Ec = c((_b, Cc) => {
  "use strict";
  var E2 = De(), bs = class extends E2 {
    static {
      s(this, "Year");
    }
    constructor(e = {}) {
      super(e);
    }
    up() {
      this.date.setFullYear(this.date.getFullYear() + 1);
    }
    down() {
      this.date.setFullYear(this.date.getFullYear() - 1);
    }
    setTo(e) {
      this.date.setFullYear(e.substr(-4));
    }
    toString() {
      let e = String(this.date.getFullYear()).padStart(4, "0");
      return this.token.length === 2 ? e.substr(-2) : e;
    }
  };
  Cc.exports = bs;
});

// ../node_modules/prompts/lib/dateparts/index.js
var xc = c((Lb, bc) => {
  "use strict";
  bc.exports = {
    DatePart: De(),
    Meridiem: nc(),
    Day: Dc(),
    Hours: lc(),
    Milliseconds: cc(),
    Minutes: fc(),
    Month: mc(),
    Seconds: Fc(),
    Year: Ec()
  };
});

// ../node_modules/prompts/lib/elements/date.js
var Tc = c((kb, Sc) => {
  "use strict";
  var xs = L(), b2 = me(), { style: vc, clear: yc, figures: x2 } = te(), { erase: v2, cursor: Bc } = S(), { DatePart: wc, Meridiem: y2, Day: B2,
  Hours: w2, Milliseconds: A2, Minutes: S2, Month: T2, Seconds: $2, Year: O2 } = xc(), _2 = /\\(.)|"((?:\\["\\]|[^"])+)"|(D[Do]?|d{3,4}|d)|(M{1,4})|(YY(?:YY)?)|([aA])|([Hh]{1,2})|(m{1,2})|(s{1,2})|(S{1,4})|./g,
  Ac = {
    1: ({ token: t }) => t.replace(/\\(.)/g, "$1"),
    2: (t) => new B2(t),
    // Day // TODO
    3: (t) => new T2(t),
    // Month
    4: (t) => new O2(t),
    // Year
    5: (t) => new y2(t),
    // AM/PM // TODO (special)
    6: (t) => new w2(t),
    // Hours
    7: (t) => new S2(t),
    // Minutes
    8: (t) => new $2(t),
    // Seconds
    9: (t) => new A2(t)
    // Fractional seconds
  }, I2 = {
    months: "January,February,March,April,May,June,July,August,September,October,November,December".split(","),
    monthsShort: "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(","),
    weekdays: "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday".split(","),
    weekdaysShort: "Sun,Mon,Tue,Wed,Thu,Fri,Sat".split(",")
  }, vs = class extends b2 {
    static {
      s(this, "DatePrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.cursor = 0, this.typed = "", this.locales = Object.assign(I2, e.locales), this._date = e.initial ||
      /* @__PURE__ */ new Date(), this.errorMsg = e.error || "Please Enter A Valid Value", this.validator = e.validate || (() => !0), this.mask =
      e.mask || "YYYY-MM-DD HH:mm:ss", this.clear = yc("", this.out.columns), this.render();
    }
    get value() {
      return this.date;
    }
    get date() {
      return this._date;
    }
    set date(e) {
      e && this._date.setTime(e.getTime());
    }
    set mask(e) {
      let r;
      for (this.parts = []; r = _2.exec(e); ) {
        let n = r.shift(), o = r.findIndex((i) => i != null);
        this.parts.push(o in Ac ? Ac[o]({ token: r[o] || n, date: this.date, parts: this.parts, locales: this.locales }) : r[o] || n);
      }
      let u = this.parts.reduce((n, o) => (typeof o == "string" && typeof n[n.length - 1] == "string" ? n[n.length - 1] += o : n.push(o), n),
      []);
      this.parts.splice(0), this.parts.push(...u), this.reset();
    }
    moveCursor(e) {
      this.typed = "", this.cursor = e, this.fire();
    }
    reset() {
      this.moveCursor(this.parts.findIndex((e) => e instanceof wc)), this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.error = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    async validate() {
      let e = await this.validator(this.value);
      typeof e == "string" && (this.errorMsg = e, e = !1), this.error = !e;
    }
    async submit() {
      if (await this.validate(), this.error) {
        this.color = "red", this.fire(), this.render();
        return;
      }
      this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    up() {
      this.typed = "", this.parts[this.cursor].up(), this.render();
    }
    down() {
      this.typed = "", this.parts[this.cursor].down(), this.render();
    }
    left() {
      let e = this.parts[this.cursor].prev();
      if (e == null) return this.bell();
      this.moveCursor(this.parts.indexOf(e)), this.render();
    }
    right() {
      let e = this.parts[this.cursor].next();
      if (e == null) return this.bell();
      this.moveCursor(this.parts.indexOf(e)), this.render();
    }
    next() {
      let e = this.parts[this.cursor].next();
      this.moveCursor(e ? this.parts.indexOf(e) : this.parts.findIndex((r) => r instanceof wc)), this.render();
    }
    _(e) {
      /\d/.test(e) && (this.typed += e, this.parts[this.cursor].setTo(this.typed), this.render());
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(Bc.hide) : this.out.write(yc(this.outputText, this.out.columns)), super.render(), this.
      outputText = [
        vc.symbol(this.done, this.aborted),
        xs.bold(this.msg),
        vc.delimiter(!1),
        this.parts.reduce((e, r, u) => e.concat(u === this.cursor && !this.done ? xs.cyan().underline(r.toString()) : r), []).join("")
      ].join(" "), this.error && (this.outputText += this.errorMsg.split(`
`).reduce(
        (e, r, u) => e + `
${u ? " " : x2.pointerSmall} ${xs.red().italic(r)}`,
        ""
      )), this.out.write(v2.line + Bc.to(0) + this.outputText));
    }
  };
  Sc.exports = vs;
});

// ../node_modules/prompts/lib/elements/number.js
var Ic = c((Mb, _c) => {
  var Jr = L(), L2 = me(), { cursor: Xr, erase: k2 } = S(), { style: ys, figures: P2, clear: $c, lines: M2 } = te(), R2 = /[0-9]/, Bs = /* @__PURE__ */ s(
  (t) => t !== void 0, "isDef"), Oc = /* @__PURE__ */ s((t, e) => {
    let r = Math.pow(10, e);
    return Math.round(t * r) / r;
  }, "round"), ws = class extends L2 {
    static {
      s(this, "NumberPrompt");
    }
    constructor(e = {}) {
      super(e), this.transform = ys.render(e.style), this.msg = e.message, this.initial = Bs(e.initial) ? e.initial : "", this.float = !!e.float,
      this.round = e.round || 2, this.inc = e.increment || 1, this.min = Bs(e.min) ? e.min : -1 / 0, this.max = Bs(e.max) ? e.max : 1 / 0, this.
      errorMsg = e.error || "Please Enter A Valid Value", this.validator = e.validate || (() => !0), this.color = "cyan", this.value = "", this.
      typed = "", this.lastHit = 0, this.render();
    }
    set value(e) {
      !e && e !== 0 ? (this.placeholder = !0, this.rendered = Jr.gray(this.transform.render(`${this.initial}`)), this._value = "") : (this.placeholder =
      !1, this.rendered = this.transform.render(`${Oc(e, this.round)}`), this._value = Oc(e, this.round)), this.fire();
    }
    get value() {
      return this._value;
    }
    parse(e) {
      return this.float ? parseFloat(e) : parseInt(e);
    }
    valid(e) {
      return e === "-" || e === "." && this.float || R2.test(e);
    }
    reset() {
      this.typed = "", this.value = "", this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      let e = this.value;
      this.value = e !== "" ? e : this.initial, this.done = this.aborted = !0, this.error = !1, this.fire(), this.render(), this.out.write(`\

`), this.close();
    }
    async validate() {
      let e = await this.validator(this.value);
      typeof e == "string" && (this.errorMsg = e, e = !1), this.error = !e;
    }
    async submit() {
      if (await this.validate(), this.error) {
        this.color = "red", this.fire(), this.render();
        return;
      }
      let e = this.value;
      this.value = e !== "" ? e : this.initial, this.done = !0, this.aborted = !1, this.error = !1, this.fire(), this.render(), this.out.write(
      `
`), this.close();
    }
    up() {
      if (this.typed = "", this.value === "" && (this.value = this.min - this.inc), this.value >= this.max) return this.bell();
      this.value += this.inc, this.color = "cyan", this.fire(), this.render();
    }
    down() {
      if (this.typed = "", this.value === "" && (this.value = this.min + this.inc), this.value <= this.min) return this.bell();
      this.value -= this.inc, this.color = "cyan", this.fire(), this.render();
    }
    delete() {
      let e = this.value.toString();
      if (e.length === 0) return this.bell();
      this.value = this.parse(e = e.slice(0, -1)) || "", this.value !== "" && this.value < this.min && (this.value = this.min), this.color =
      "cyan", this.fire(), this.render();
    }
    next() {
      this.value = this.initial, this.fire(), this.render();
    }
    _(e, r) {
      if (!this.valid(e)) return this.bell();
      let u = Date.now();
      if (u - this.lastHit > 1e3 && (this.typed = ""), this.typed += e, this.lastHit = u, this.color = "cyan", e === ".") return this.fire();
      this.value = Math.min(this.parse(this.typed), this.max), this.value > this.max && (this.value = this.max), this.value < this.min && (this.
      value = this.min), this.fire(), this.render();
    }
    render() {
      this.closed || (this.firstRender || (this.outputError && this.out.write(Xr.down(M2(this.outputError, this.out.columns) - 1) + $c(this.
      outputError, this.out.columns)), this.out.write($c(this.outputText, this.out.columns))), super.render(), this.outputError = "", this.outputText =
      [
        ys.symbol(this.done, this.aborted),
        Jr.bold(this.msg),
        ys.delimiter(this.done),
        !this.done || !this.done && !this.placeholder ? Jr[this.color]().underline(this.rendered) : this.rendered
      ].join(" "), this.error && (this.outputError += this.errorMsg.split(`
`).reduce((e, r, u) => e + `
${u ? " " : P2.pointerSmall} ${Jr.red().italic(r)}`, "")), this.out.write(k2.line + Xr.to(0) + this.outputText + Xr.save + this.outputError +
      Xr.restore));
    }
  };
  _c.exports = ws;
});

// ../node_modules/prompts/lib/elements/multiselect.js
var Ss = c((qb, Pc) => {
  "use strict";
  var ae = L(), { cursor: q2 } = S(), N2 = me(), { clear: Lc, figures: Oe, style: kc, wrap: j2, entriesToDisplay: G2 } = te(), As = class extends N2 {
    static {
      s(this, "MultiselectPrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.cursor = e.cursor || 0, this.scrollIndex = e.cursor || 0, this.hint = e.hint || "", this.warn = e.
      warn || "- This option is disabled -", this.minSelected = e.min, this.showMinError = !1, this.maxChoices = e.max, this.instructions = e.
      instructions, this.optionsPerPage = e.optionsPerPage || 10, this.value = e.choices.map((r, u) => (typeof r == "string" && (r = { title: r,
      value: u }), {
        title: r && (r.title || r.value || r),
        description: r && r.description,
        value: r && (r.value === void 0 ? u : r.value),
        selected: r && r.selected,
        disabled: r && r.disabled
      })), this.clear = Lc("", this.out.columns), e.overrideRender || this.render();
    }
    reset() {
      this.value.map((e) => !e.selected), this.cursor = 0, this.fire(), this.render();
    }
    selected() {
      return this.value.filter((e) => e.selected);
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      let e = this.value.filter((r) => r.selected);
      this.minSelected && e.length < this.minSelected ? (this.showMinError = !0, this.render()) : (this.done = !0, this.aborted = !1, this.fire(),
      this.render(), this.out.write(`
`), this.close());
    }
    first() {
      this.cursor = 0, this.render();
    }
    last() {
      this.cursor = this.value.length - 1, this.render();
    }
    next() {
      this.cursor = (this.cursor + 1) % this.value.length, this.render();
    }
    up() {
      this.cursor === 0 ? this.cursor = this.value.length - 1 : this.cursor--, this.render();
    }
    down() {
      this.cursor === this.value.length - 1 ? this.cursor = 0 : this.cursor++, this.render();
    }
    left() {
      this.value[this.cursor].selected = !1, this.render();
    }
    right() {
      if (this.value.filter((e) => e.selected).length >= this.maxChoices) return this.bell();
      this.value[this.cursor].selected = !0, this.render();
    }
    handleSpaceToggle() {
      let e = this.value[this.cursor];
      if (e.selected)
        e.selected = !1, this.render();
      else {
        if (e.disabled || this.value.filter((r) => r.selected).length >= this.maxChoices)
          return this.bell();
        e.selected = !0, this.render();
      }
    }
    toggleAll() {
      if (this.maxChoices !== void 0 || this.value[this.cursor].disabled)
        return this.bell();
      let e = !this.value[this.cursor].selected;
      this.value.filter((r) => !r.disabled).forEach((r) => r.selected = e), this.render();
    }
    _(e, r) {
      if (e === " ")
        this.handleSpaceToggle();
      else if (e === "a")
        this.toggleAll();
      else
        return this.bell();
    }
    renderInstructions() {
      return this.instructions === void 0 || this.instructions ? typeof this.instructions == "string" ? this.instructions : `
Instructions:
    ${Oe.arrowUp}/${Oe.arrowDown}: Highlight option
    ${Oe.arrowLeft}/${Oe.arrowRight}/[space]: Toggle selection
` + (this.maxChoices === void 0 ? `    a: Toggle all
` : "") + "    enter/return: Complete answer" : "";
    }
    renderOption(e, r, u, n) {
      let o = (r.selected ? ae.green(Oe.radioOn) : Oe.radioOff) + " " + n + " ", i, D;
      return r.disabled ? i = e === u ? ae.gray().underline(r.title) : ae.strikethrough().gray(r.title) : (i = e === u ? ae.cyan().underline(
      r.title) : r.title, e === u && r.description && (D = ` - ${r.description}`, (o.length + i.length + D.length >= this.out.columns || r.description.
      split(/\r?\n/).length > 1) && (D = `
` + j2(r.description, { margin: o.length, width: this.out.columns })))), o + i + ae.gray(D || "");
    }
    // shared with autocompleteMultiselect
    paginateOptions(e) {
      if (e.length === 0)
        return ae.red("No matches for this query.");
      let { startIndex: r, endIndex: u } = G2(this.cursor, e.length, this.optionsPerPage), n, o = [];
      for (let i = r; i < u; i++)
        i === r && r > 0 ? n = Oe.arrowUp : i === u - 1 && u < e.length ? n = Oe.arrowDown : n = " ", o.push(this.renderOption(this.cursor, e[i],
        i, n));
      return `
` + o.join(`
`);
    }
    // shared with autocomleteMultiselect
    renderOptions(e) {
      return this.done ? "" : this.paginateOptions(e);
    }
    renderDoneOrInstructions() {
      if (this.done)
        return this.value.filter((r) => r.selected).map((r) => r.title).join(", ");
      let e = [ae.gray(this.hint), this.renderInstructions()];
      return this.value[this.cursor].disabled && e.push(ae.yellow(this.warn)), e.join(" ");
    }
    render() {
      if (this.closed) return;
      this.firstRender && this.out.write(q2.hide), super.render();
      let e = [
        kc.symbol(this.done, this.aborted),
        ae.bold(this.msg),
        kc.delimiter(!1),
        this.renderDoneOrInstructions()
      ].join(" ");
      this.showMinError && (e += ae.red(`You must select a minimum of ${this.minSelected} choices.`), this.showMinError = !1), e += this.renderOptions(
      this.value), this.out.write(this.clear + e), this.clear = Lc(e, this.out.columns);
    }
  };
  Pc.exports = As;
});

// ../node_modules/prompts/lib/elements/autocomplete.js
var jc = c((jb, Nc) => {
  "use strict";
  var zt = L(), W2 = me(), { erase: V2, cursor: Mc } = S(), { style: Ts, clear: Rc, figures: $s, wrap: U2, entriesToDisplay: Y2 } = te(), qc = /* @__PURE__ */ s(
  (t, e) => t[e] && (t[e].value || t[e].title || t[e]), "getVal"), H2 = /* @__PURE__ */ s((t, e) => t[e] && (t[e].title || t[e].value || t[e]),
  "getTitle"), z2 = /* @__PURE__ */ s((t, e) => {
    let r = t.findIndex((u) => u.value === e || u.title === e);
    return r > -1 ? r : void 0;
  }, "getIndex"), Os = class extends W2 {
    static {
      s(this, "AutocompletePrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.suggest = e.suggest, this.choices = e.choices, this.initial = typeof e.initial == "number" ? e.initial :
      z2(e.choices, e.initial), this.select = this.initial || e.cursor || 0, this.i18n = { noMatches: e.noMatches || "no matches found" }, this.
      fallback = e.fallback || this.initial, this.clearFirst = e.clearFirst || !1, this.suggestions = [], this.input = "", this.limit = e.limit ||
      10, this.cursor = 0, this.transform = Ts.render(e.style), this.scale = this.transform.scale, this.render = this.render.bind(this), this.
      complete = this.complete.bind(this), this.clear = Rc("", this.out.columns), this.complete(this.render), this.render();
    }
    set fallback(e) {
      this._fb = Number.isSafeInteger(parseInt(e)) ? parseInt(e) : e;
    }
    get fallback() {
      let e;
      return typeof this._fb == "number" ? e = this.choices[this._fb] : typeof this._fb == "string" && (e = { title: this._fb }), e || this.
      _fb || { title: this.i18n.noMatches };
    }
    moveSelect(e) {
      this.select = e, this.suggestions.length > 0 ? this.value = qc(this.suggestions, e) : this.value = this.fallback.value, this.fire();
    }
    async complete(e) {
      let r = this.completing = this.suggest(this.input, this.choices), u = await r;
      if (this.completing !== r) return;
      this.suggestions = u.map((o, i, D) => ({ title: H2(D, i), value: qc(D, i), description: o.description })), this.completing = !1;
      let n = Math.max(u.length - 1, 0);
      this.moveSelect(Math.min(n, this.select)), e && e();
    }
    reset() {
      this.input = "", this.complete(() => {
        this.moveSelect(this.initial !== void 0 ? this.initial : 0), this.render();
      }), this.render();
    }
    exit() {
      this.clearFirst && this.input.length > 0 ? this.reset() : (this.done = this.exited = !0, this.aborted = !1, this.fire(), this.render(),
      this.out.write(`
`), this.close());
    }
    abort() {
      this.done = this.aborted = !0, this.exited = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.done = !0, this.aborted = this.exited = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    _(e, r) {
      let u = this.input.slice(0, this.cursor), n = this.input.slice(this.cursor);
      this.input = `${u}${e}${n}`, this.cursor = u.length + 1, this.complete(this.render), this.render();
    }
    delete() {
      if (this.cursor === 0) return this.bell();
      let e = this.input.slice(0, this.cursor - 1), r = this.input.slice(this.cursor);
      this.input = `${e}${r}`, this.complete(this.render), this.cursor = this.cursor - 1, this.render();
    }
    deleteForward() {
      if (this.cursor * this.scale >= this.rendered.length) return this.bell();
      let e = this.input.slice(0, this.cursor), r = this.input.slice(this.cursor + 1);
      this.input = `${e}${r}`, this.complete(this.render), this.render();
    }
    first() {
      this.moveSelect(0), this.render();
    }
    last() {
      this.moveSelect(this.suggestions.length - 1), this.render();
    }
    up() {
      this.select === 0 ? this.moveSelect(this.suggestions.length - 1) : this.moveSelect(this.select - 1), this.render();
    }
    down() {
      this.select === this.suggestions.length - 1 ? this.moveSelect(0) : this.moveSelect(this.select + 1), this.render();
    }
    next() {
      this.select === this.suggestions.length - 1 ? this.moveSelect(0) : this.moveSelect(this.select + 1), this.render();
    }
    nextPage() {
      this.moveSelect(Math.min(this.select + this.limit, this.suggestions.length - 1)), this.render();
    }
    prevPage() {
      this.moveSelect(Math.max(this.select - this.limit, 0)), this.render();
    }
    left() {
      if (this.cursor <= 0) return this.bell();
      this.cursor = this.cursor - 1, this.render();
    }
    right() {
      if (this.cursor * this.scale >= this.rendered.length) return this.bell();
      this.cursor = this.cursor + 1, this.render();
    }
    renderOption(e, r, u, n) {
      let o, i = u ? $s.arrowUp : n ? $s.arrowDown : " ", D = r ? zt.cyan().underline(e.title) : e.title;
      return i = (r ? zt.cyan($s.pointer) + " " : "  ") + i, e.description && (o = ` - ${e.description}`, (i.length + D.length + o.length >=
      this.out.columns || e.description.split(/\r?\n/).length > 1) && (o = `
` + U2(e.description, { margin: 3, width: this.out.columns }))), i + " " + D + zt.gray(o || "");
    }
    render() {
      if (this.closed) return;
      this.firstRender ? this.out.write(Mc.hide) : this.out.write(Rc(this.outputText, this.out.columns)), super.render();
      let { startIndex: e, endIndex: r } = Y2(this.select, this.choices.length, this.limit);
      if (this.outputText = [
        Ts.symbol(this.done, this.aborted, this.exited),
        zt.bold(this.msg),
        Ts.delimiter(this.completing),
        this.done && this.suggestions[this.select] ? this.suggestions[this.select].title : this.rendered = this.transform.render(this.input)
      ].join(" "), !this.done) {
        let u = this.suggestions.slice(e, r).map((n, o) => this.renderOption(
          n,
          this.select === o + e,
          o === 0 && e > 0,
          o + e === r - 1 && r < this.choices.length
        )).join(`
`);
        this.outputText += `
` + (u || zt.gray(this.fallback.title));
      }
      this.out.write(V2.line + Mc.to(0) + this.outputText);
    }
  };
  Nc.exports = Os;
});

// ../node_modules/prompts/lib/elements/autocompleteMultiselect.js
var Uc = c((Wb, Vc) => {
  "use strict";
  var Fe = L(), { cursor: K2 } = S(), Z2 = Ss(), { clear: Gc, style: Wc, figures: ft } = te(), _s = class extends Z2 {
    static {
      s(this, "AutocompleteMultiselectPrompt");
    }
    constructor(e = {}) {
      e.overrideRender = !0, super(e), this.inputValue = "", this.clear = Gc("", this.out.columns), this.filteredOptions = this.value, this.
      render();
    }
    last() {
      this.cursor = this.filteredOptions.length - 1, this.render();
    }
    next() {
      this.cursor = (this.cursor + 1) % this.filteredOptions.length, this.render();
    }
    up() {
      this.cursor === 0 ? this.cursor = this.filteredOptions.length - 1 : this.cursor--, this.render();
    }
    down() {
      this.cursor === this.filteredOptions.length - 1 ? this.cursor = 0 : this.cursor++, this.render();
    }
    left() {
      this.filteredOptions[this.cursor].selected = !1, this.render();
    }
    right() {
      if (this.value.filter((e) => e.selected).length >= this.maxChoices) return this.bell();
      this.filteredOptions[this.cursor].selected = !0, this.render();
    }
    delete() {
      this.inputValue.length && (this.inputValue = this.inputValue.substr(0, this.inputValue.length - 1), this.updateFilteredOptions());
    }
    updateFilteredOptions() {
      let e = this.filteredOptions[this.cursor];
      this.filteredOptions = this.value.filter((u) => this.inputValue ? !!(typeof u.title == "string" && u.title.toLowerCase().includes(this.
      inputValue.toLowerCase()) || typeof u.value == "string" && u.value.toLowerCase().includes(this.inputValue.toLowerCase())) : !0);
      let r = this.filteredOptions.findIndex((u) => u === e);
      this.cursor = r < 0 ? 0 : r, this.render();
    }
    handleSpaceToggle() {
      let e = this.filteredOptions[this.cursor];
      if (e.selected)
        e.selected = !1, this.render();
      else {
        if (e.disabled || this.value.filter((r) => r.selected).length >= this.maxChoices)
          return this.bell();
        e.selected = !0, this.render();
      }
    }
    handleInputChange(e) {
      this.inputValue = this.inputValue + e, this.updateFilteredOptions();
    }
    _(e, r) {
      e === " " ? this.handleSpaceToggle() : this.handleInputChange(e);
    }
    renderInstructions() {
      return this.instructions === void 0 || this.instructions ? typeof this.instructions == "string" ? this.instructions : `
Instructions:
    ${ft.arrowUp}/${ft.arrowDown}: Highlight option
    ${ft.arrowLeft}/${ft.arrowRight}/[space]: Toggle selection
    [a,b,c]/delete: Filter choices
    enter/return: Complete answer
` : "";
    }
    renderCurrentInput() {
      return `
Filtered results for: ${this.inputValue ? this.inputValue : Fe.gray("Enter something to filter")}
`;
    }
    renderOption(e, r, u) {
      let n;
      return r.disabled ? n = e === u ? Fe.gray().underline(r.title) : Fe.strikethrough().gray(r.title) : n = e === u ? Fe.cyan().underline(
      r.title) : r.title, (r.selected ? Fe.green(ft.radioOn) : ft.radioOff) + "  " + n;
    }
    renderDoneOrInstructions() {
      if (this.done)
        return this.value.filter((r) => r.selected).map((r) => r.title).join(", ");
      let e = [Fe.gray(this.hint), this.renderInstructions(), this.renderCurrentInput()];
      return this.filteredOptions.length && this.filteredOptions[this.cursor].disabled && e.push(Fe.yellow(this.warn)), e.join(" ");
    }
    render() {
      if (this.closed) return;
      this.firstRender && this.out.write(K2.hide), super.render();
      let e = [
        Wc.symbol(this.done, this.aborted),
        Fe.bold(this.msg),
        Wc.delimiter(!1),
        this.renderDoneOrInstructions()
      ].join(" ");
      this.showMinError && (e += Fe.red(`You must select a minimum of ${this.minSelected} choices.`), this.showMinError = !1), e += this.renderOptions(
      this.filteredOptions), this.out.write(this.clear + e), this.clear = Gc(e, this.out.columns);
    }
  };
  Vc.exports = _s;
});

// ../node_modules/prompts/lib/elements/confirm.js
var Zc = c((Ub, Kc) => {
  var Yc = L(), J2 = me(), { style: Hc, clear: X2 } = te(), { erase: Q2, cursor: zc } = S(), Is = class extends J2 {
    static {
      s(this, "ConfirmPrompt");
    }
    constructor(e = {}) {
      super(e), this.msg = e.message, this.value = e.initial, this.initialValue = !!e.initial, this.yesMsg = e.yes || "yes", this.yesOption =
      e.yesOption || "(Y/n)", this.noMsg = e.no || "no", this.noOption = e.noOption || "(y/N)", this.render();
    }
    reset() {
      this.value = this.initialValue, this.fire(), this.render();
    }
    exit() {
      this.abort();
    }
    abort() {
      this.done = this.aborted = !0, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    submit() {
      this.value = this.value || !1, this.done = !0, this.aborted = !1, this.fire(), this.render(), this.out.write(`
`), this.close();
    }
    _(e, r) {
      return e.toLowerCase() === "y" ? (this.value = !0, this.submit()) : e.toLowerCase() === "n" ? (this.value = !1, this.submit()) : this.
      bell();
    }
    render() {
      this.closed || (this.firstRender ? this.out.write(zc.hide) : this.out.write(X2(this.outputText, this.out.columns)), super.render(), this.
      outputText = [
        Hc.symbol(this.done, this.aborted),
        Yc.bold(this.msg),
        Hc.delimiter(this.done),
        this.done ? this.value ? this.yesMsg : this.noMsg : Yc.gray(this.initialValue ? this.yesOption : this.noOption)
      ].join(" "), this.out.write(Q2.line + zc.to(0) + this.outputText));
    }
  };
  Kc.exports = Is;
});

// ../node_modules/prompts/lib/elements/index.js
var Xc = c((Hb, Jc) => {
  "use strict";
  Jc.exports = {
    TextPrompt: Kh(),
    SelectPrompt: Qh(),
    TogglePrompt: uc(),
    DatePrompt: Tc(),
    NumberPrompt: Ic(),
    MultiselectPrompt: Ss(),
    AutocompletePrompt: jc(),
    AutocompleteMultiselectPrompt: Uc(),
    ConfirmPrompt: Zc()
  };
});

// ../node_modules/prompts/lib/prompts.js
var ed = c((Qc) => {
  "use strict";
  var U = Qc, eC = Xc(), Qr = /* @__PURE__ */ s((t) => t, "noop");
  function le(t, e, r = {}) {
    return new Promise((u, n) => {
      let o = new eC[t](e), i = r.onAbort || Qr, D = r.onSubmit || Qr, a = r.onExit || Qr;
      o.on("state", e.onState || Qr), o.on("submit", (l) => u(D(l))), o.on("exit", (l) => u(a(l))), o.on("abort", (l) => n(i(l)));
    });
  }
  s(le, "toPrompt");
  U.text = (t) => le("TextPrompt", t);
  U.password = (t) => (t.style = "password", U.text(t));
  U.invisible = (t) => (t.style = "invisible", U.text(t));
  U.number = (t) => le("NumberPrompt", t);
  U.date = (t) => le("DatePrompt", t);
  U.confirm = (t) => le("ConfirmPrompt", t);
  U.list = (t) => {
    let e = t.separator || ",";
    return le("TextPrompt", t, {
      onSubmit: /* @__PURE__ */ s((r) => r.split(e).map((u) => u.trim()), "onSubmit")
    });
  };
  U.toggle = (t) => le("TogglePrompt", t);
  U.select = (t) => le("SelectPrompt", t);
  U.multiselect = (t) => {
    t.choices = [].concat(t.choices || []);
    let e = /* @__PURE__ */ s((r) => r.filter((u) => u.selected).map((u) => u.value), "toSelected");
    return le("MultiselectPrompt", t, {
      onAbort: e,
      onSubmit: e
    });
  };
  U.autocompleteMultiselect = (t) => {
    t.choices = [].concat(t.choices || []);
    let e = /* @__PURE__ */ s((r) => r.filter((u) => u.selected).map((u) => u.value), "toSelected");
    return le("AutocompleteMultiselectPrompt", t, {
      onAbort: e,
      onSubmit: e
    });
  };
  var tC = /* @__PURE__ */ s((t, e) => Promise.resolve(
    e.filter((r) => r.title.slice(0, t.length).toLowerCase() === t.toLowerCase())
  ), "byTitle");
  U.autocomplete = (t) => (t.suggest = t.suggest || tC, t.choices = [].concat(t.choices || []), le("AutocompletePrompt", t));
});

// ../node_modules/prompts/lib/index.js
var ud = c((Zb, rd) => {
  "use strict";
  var Ls = ed(), rC = ["suggest", "format", "onState", "validate", "onRender", "type"], td = /* @__PURE__ */ s(() => {
  }, "noop");
  async function _e(t = [], { onSubmit: e = td, onCancel: r = td } = {}) {
    let u = {}, n = _e._override || {};
    t = [].concat(t);
    let o, i, D, a, l, h, p = /* @__PURE__ */ s(async (d, m, g = !1) => {
      if (!(!g && d.validate && d.validate(m) !== !0))
        return d.format ? await d.format(m, u) : m;
    }, "getFormattedAnswer");
    for (i of t)
      if ({ name: a, type: l } = i, typeof l == "function" && (l = await l(o, { ...u }, i), i.type = l), !!l) {
        for (let d in i) {
          if (rC.includes(d)) continue;
          let m = i[d];
          i[d] = typeof m == "function" ? await m(o, { ...u }, h) : m;
        }
        if (h = i, typeof i.message != "string")
          throw new Error("prompt message is required");
        if ({ name: a, type: l } = i, Ls[l] === void 0)
          throw new Error(`prompt type (${l}) is not defined`);
        if (n[i.name] !== void 0 && (o = await p(i, n[i.name]), o !== void 0)) {
          u[a] = o;
          continue;
        }
        try {
          o = _e._injected ? uC(_e._injected, i.initial) : await Ls[l](i), u[a] = o = await p(i, o, !0), D = await e(i, o, u);
        } catch {
          D = !await r(i, u);
        }
        if (D) return u;
      }
    return u;
  }
  s(_e, "prompt");
  function uC(t, e) {
    let r = t.shift();
    if (r instanceof Error)
      throw r;
    return r === void 0 ? e : r;
  }
  s(uC, "getInjectedAnswer");
  function iC(t) {
    _e._injected = (_e._injected || []).concat(t);
  }
  s(iC, "inject");
  function sC(t) {
    _e._override = Object.assign({}, t);
  }
  s(sC, "override");
  rd.exports = Object.assign(_e, { prompt: _e, prompts: Ls, inject: iC, override: sC });
});

// ../node_modules/prompts/index.js
var sd = c((Xb, id) => {
  function nC(t) {
    t = (Array.isArray(t) ? t : t.split(".")).map(Number);
    let e = 0, r = process.versions.node.split(".").map(Number);
    for (; e < t.length; e++) {
      if (r[e] > t[e]) return !1;
      if (t[e] > r[e]) return !0;
    }
    return !1;
  }
  s(nC, "isNodeLT");
  id.exports = nC("8.6.0") ? Th() : ud();
});

// ../node_modules/isexe/windows.js
var ld = c((Dx, ad) => {
  ad.exports = Dd;
  Dd.sync = dC;
  var nd = require("fs");
  function cC(t, e) {
    var r = e.pathExt !== void 0 ? e.pathExt : process.env.PATHEXT;
    if (!r || (r = r.split(";"), r.indexOf("") !== -1))
      return !0;
    for (var u = 0; u < r.length; u++) {
      var n = r[u].toLowerCase();
      if (n && t.substr(-n.length).toLowerCase() === n)
        return !0;
    }
    return !1;
  }
  s(cC, "checkPathExt");
  function od(t, e, r) {
    return !t.isSymbolicLink() && !t.isFile() ? !1 : cC(e, r);
  }
  s(od, "checkStat");
  function Dd(t, e, r) {
    nd.stat(t, function(u, n) {
      r(u, u ? !1 : od(n, t, e));
    });
  }
  s(Dd, "isexe");
  function dC(t, e) {
    return od(nd.statSync(t), t, e);
  }
  s(dC, "sync");
});

// ../node_modules/isexe/mode.js
var pd = c((lx, fd) => {
  fd.exports = cd;
  cd.sync = fC;
  var hd = require("fs");
  function cd(t, e, r) {
    hd.stat(t, function(u, n) {
      r(u, u ? !1 : dd(n, e));
    });
  }
  s(cd, "isexe");
  function fC(t, e) {
    return dd(hd.statSync(t), e);
  }
  s(fC, "sync");
  function dd(t, e) {
    return t.isFile() && pC(t, e);
  }
  s(dd, "checkStat");
  function pC(t, e) {
    var r = t.mode, u = t.uid, n = t.gid, o = e.uid !== void 0 ? e.uid : process.getuid && process.getuid(), i = e.gid !== void 0 ? e.gid : process.
    getgid && process.getgid(), D = parseInt("100", 8), a = parseInt("010", 8), l = parseInt("001", 8), h = D | a, p = r & l || r & a && n ===
    i || r & D && u === o || r & h && o === 0;
    return p;
  }
  s(pC, "checkMode");
});

// ../node_modules/isexe/index.js
var gd = c((dx, md) => {
  var cx = require("fs"), tu;
  process.platform === "win32" || global.TESTING_WINDOWS ? tu = ld() : tu = pd();
  md.exports = Ps;
  Ps.sync = mC;
  function Ps(t, e, r) {
    if (typeof e == "function" && (r = e, e = {}), !r) {
      if (typeof Promise != "function")
        throw new TypeError("callback not provided");
      return new Promise(function(u, n) {
        Ps(t, e || {}, function(o, i) {
          o ? n(o) : u(i);
        });
      });
    }
    tu(t, e || {}, function(u, n) {
      u && (u.code === "EACCES" || e && e.ignoreErrors) && (u = null, n = !1), r(u, n);
    });
  }
  s(Ps, "isexe");
  function mC(t, e) {
    try {
      return tu.sync(t, e || {});
    } catch (r) {
      if (e && e.ignoreErrors || r.code === "EACCES")
        return !1;
      throw r;
    }
  }
  s(mC, "sync");
});

// ../node_modules/which/which.js
var yd = c((px, vd) => {
  var mt = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys", Fd = require("path"), gC = mt ?
  ";" : ":", Cd = gd(), Ed = /* @__PURE__ */ s((t) => Object.assign(new Error(`not found: ${t}`), { code: "ENOENT" }), "getNotFoundError"), bd = /* @__PURE__ */ s(
  (t, e) => {
    let r = e.colon || gC, u = t.match(/\//) || mt && t.match(/\\/) ? [""] : [
      // windows always checks the cwd first
      ...mt ? [process.cwd()] : [],
      ...(e.path || process.env.PATH || /* istanbul ignore next: very unusual */
      "").split(r)
    ], n = mt ? e.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "", o = mt ? n.split(r) : [""];
    return mt && t.indexOf(".") !== -1 && o[0] !== "" && o.unshift(""), {
      pathEnv: u,
      pathExt: o,
      pathExtExe: n
    };
  }, "getPathInfo"), xd = /* @__PURE__ */ s((t, e, r) => {
    typeof e == "function" && (r = e, e = {}), e || (e = {});
    let { pathEnv: u, pathExt: n, pathExtExe: o } = bd(t, e), i = [], D = /* @__PURE__ */ s((l) => new Promise((h, p) => {
      if (l === u.length)
        return e.all && i.length ? h(i) : p(Ed(t));
      let d = u[l], m = /^".*"$/.test(d) ? d.slice(1, -1) : d, g = Fd.join(m, t), F = !m && /^\.[\\\/]/.test(t) ? t.slice(0, 2) + g : g;
      h(a(F, l, 0));
    }), "step"), a = /* @__PURE__ */ s((l, h, p) => new Promise((d, m) => {
      if (p === n.length)
        return d(D(h + 1));
      let g = n[p];
      Cd(l + g, { pathExt: o }, (F, E) => {
        if (!F && E)
          if (e.all)
            i.push(l + g);
          else
            return d(l + g);
        return d(a(l, h, p + 1));
      });
    }), "subStep");
    return r ? D(0).then((l) => r(null, l), r) : D(0);
  }, "which"), FC = /* @__PURE__ */ s((t, e) => {
    e = e || {};
    let { pathEnv: r, pathExt: u, pathExtExe: n } = bd(t, e), o = [];
    for (let i = 0; i < r.length; i++) {
      let D = r[i], a = /^".*"$/.test(D) ? D.slice(1, -1) : D, l = Fd.join(a, t), h = !a && /^\.[\\\/]/.test(t) ? t.slice(0, 2) + l : l;
      for (let p = 0; p < u.length; p++) {
        let d = h + u[p];
        try {
          if (Cd.sync(d, { pathExt: n }))
            if (e.all)
              o.push(d);
            else
              return d;
        } catch {
        }
      }
    }
    if (e.all && o.length)
      return o;
    if (e.nothrow)
      return null;
    throw Ed(t);
  }, "whichSync");
  vd.exports = xd;
  xd.sync = FC;
});

// ../node_modules/path-key/index.js
var wd = c((gx, Ms) => {
  "use strict";
  var Bd = /* @__PURE__ */ s((t = {}) => {
    let e = t.env || process.env;
    return (t.platform || process.platform) !== "win32" ? "PATH" : Object.keys(e).reverse().find((u) => u.toUpperCase() === "PATH") || "Path";
  }, "pathKey");
  Ms.exports = Bd;
  Ms.exports.default = Bd;
});

// ../node_modules/cross-spawn/lib/util/resolveCommand.js
var $d = c((Cx, Td) => {
  "use strict";
  var Ad = require("path"), CC = yd(), EC = wd();
  function Sd(t, e) {
    let r = t.options.env || process.env, u = process.cwd(), n = t.options.cwd != null, o = n && process.chdir !== void 0 && !process.chdir.
    disabled;
    if (o)
      try {
        process.chdir(t.options.cwd);
      } catch {
      }
    let i;
    try {
      i = CC.sync(t.command, {
        path: r[EC({ env: r })],
        pathExt: e ? Ad.delimiter : void 0
      });
    } catch {
    } finally {
      o && process.chdir(u);
    }
    return i && (i = Ad.resolve(n ? t.options.cwd : "", i)), i;
  }
  s(Sd, "resolveCommandAttempt");
  function bC(t) {
    return Sd(t) || Sd(t, !0);
  }
  s(bC, "resolveCommand");
  Td.exports = bC;
});

// ../node_modules/cross-spawn/lib/util/escape.js
var Od = c((bx, qs) => {
  "use strict";
  var Rs = /([()\][%!^"`<>&|;, *?])/g;
  function xC(t) {
    return t = t.replace(Rs, "^$1"), t;
  }
  s(xC, "escapeCommand");
  function vC(t, e) {
    return t = `${t}`, t = t.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"'), t = t.replace(/(?=(\\+?)?)\1$/, "$1$1"), t = `"${t}"`, t = t.replace(Rs,
    "^$1"), e && (t = t.replace(Rs, "^$1")), t;
  }
  s(vC, "escapeArgument");
  qs.exports.command = xC;
  qs.exports.argument = vC;
});

// ../node_modules/shebang-regex/index.js
var Id = c((vx, _d) => {
  "use strict";
  _d.exports = /^#!(.*)/;
});

// ../node_modules/shebang-command/index.js
var kd = c((yx, Ld) => {
  "use strict";
  var yC = Id();
  Ld.exports = (t = "") => {
    let e = t.match(yC);
    if (!e)
      return null;
    let [r, u] = e[0].replace(/#! ?/, "").split(" "), n = r.split("/").pop();
    return n === "env" ? u : u ? `${n} ${u}` : n;
  };
});

// ../node_modules/cross-spawn/lib/util/readShebang.js
var Md = c((Bx, Pd) => {
  "use strict";
  var Ns = require("fs"), BC = kd();
  function wC(t) {
    let r = Buffer.alloc(150), u;
    try {
      u = Ns.openSync(t, "r"), Ns.readSync(u, r, 0, 150, 0), Ns.closeSync(u);
    } catch {
    }
    return BC(r.toString());
  }
  s(wC, "readShebang");
  Pd.exports = wC;
});

// ../node_modules/cross-spawn/lib/parse.js
var jd = c((Ax, Nd) => {
  "use strict";
  var AC = require("path"), Rd = $d(), qd = Od(), SC = Md(), TC = process.platform === "win32", $C = /\.(?:com|exe)$/i, OC = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
  function _C(t) {
    t.file = Rd(t);
    let e = t.file && SC(t.file);
    return e ? (t.args.unshift(t.file), t.command = e, Rd(t)) : t.file;
  }
  s(_C, "detectShebang");
  function IC(t) {
    if (!TC)
      return t;
    let e = _C(t), r = !$C.test(e);
    if (t.options.forceShell || r) {
      let u = OC.test(e);
      t.command = AC.normalize(t.command), t.command = qd.command(t.command), t.args = t.args.map((o) => qd.argument(o, u));
      let n = [t.command].concat(t.args).join(" ");
      t.args = ["/d", "/s", "/c", `"${n}"`], t.command = process.env.comspec || "cmd.exe", t.options.windowsVerbatimArguments = !0;
    }
    return t;
  }
  s(IC, "parseNonShell");
  function LC(t, e, r) {
    e && !Array.isArray(e) && (r = e, e = null), e = e ? e.slice(0) : [], r = Object.assign({}, r);
    let u = {
      command: t,
      args: e,
      options: r,
      file: void 0,
      original: {
        command: t,
        args: e
      }
    };
    return r.shell ? u : IC(u);
  }
  s(LC, "parse");
  Nd.exports = LC;
});

// ../node_modules/cross-spawn/lib/enoent.js
var Vd = c((Tx, Wd) => {
  "use strict";
  var js = process.platform === "win32";
  function Gs(t, e) {
    return Object.assign(new Error(`${e} ${t.command} ENOENT`), {
      code: "ENOENT",
      errno: "ENOENT",
      syscall: `${e} ${t.command}`,
      path: t.command,
      spawnargs: t.args
    });
  }
  s(Gs, "notFoundError");
  function kC(t, e) {
    if (!js)
      return;
    let r = t.emit;
    t.emit = function(u, n) {
      if (u === "exit") {
        let o = Gd(n, e);
        if (o)
          return r.call(t, "error", o);
      }
      return r.apply(t, arguments);
    };
  }
  s(kC, "hookChildProcess");
  function Gd(t, e) {
    return js && t === 1 && !e.file ? Gs(e.original, "spawn") : null;
  }
  s(Gd, "verifyENOENT");
  function PC(t, e) {
    return js && t === 1 && !e.file ? Gs(e.original, "spawnSync") : null;
  }
  s(PC, "verifyENOENTSync");
  Wd.exports = {
    hookChildProcess: kC,
    verifyENOENT: Gd,
    verifyENOENTSync: PC,
    notFoundError: Gs
  };
});

// ../node_modules/cross-spawn/index.js
var Hd = c((Ox, gt) => {
  "use strict";
  var Ud = require("child_process"), Ws = jd(), Vs = Vd();
  function Yd(t, e, r) {
    let u = Ws(t, e, r), n = Ud.spawn(u.command, u.args, u.options);
    return Vs.hookChildProcess(n, u), n;
  }
  s(Yd, "spawn");
  function MC(t, e, r) {
    let u = Ws(t, e, r), n = Ud.spawnSync(u.command, u.args, u.options);
    return n.error = n.error || Vs.verifyENOENTSync(n.status, u), n;
  }
  s(MC, "spawnSync");
  gt.exports = Yd;
  gt.exports.spawn = Yd;
  gt.exports.sync = MC;
  gt.exports._parse = Ws;
  gt.exports._enoent = Vs;
});

// ../node_modules/merge-stream/index.js
var wf = c((zv, Bf) => {
  "use strict";
  var { PassThrough: T3 } = require("stream");
  Bf.exports = function() {
    var t = [], e = new T3({ objectMode: !0 });
    return e.setMaxListeners(0), e.add = r, e.isEmpty = u, e.on("unpipe", n), Array.prototype.slice.call(arguments).forEach(r), e;
    function r(o) {
      return Array.isArray(o) ? (o.forEach(r), this) : (t.push(o), o.once("end", n.bind(null, o)), o.once("error", e.emit.bind(e, "error")),
      o.pipe(e, { end: !1 }), this);
    }
    s(r, "add");
    function u() {
      return t.length == 0;
    }
    s(u, "isEmpty");
    function n(o) {
      t = t.filter(function(i) {
        return i !== o;
      }), !t.length && e.readable && e.end();
    }
    s(n, "remove");
  };
});

// src/node-logger/index.ts
var nE = {};
wt(nE, {
  CLI_COLORS: () => ir,
  colors: () => Tn,
  createHyperlink: () => Jf,
  deprecate: () => sE,
  instance: () => or.default,
  logTracker: () => x,
  logger: () => o0,
  once: () => re,
  prompt: () => s0,
  protectUrls: () => rr
});
module.exports = Ln(nE);
var or = v(Xo(), 1), n0 = v(tD(), 1);

// src/node-logger/logger/logger.ts
var yn = {};
wt(yn, {
  SYMBOLS: () => eE,
  debug: () => Cu,
  error: () => vn,
  getLogLevel: () => H3,
  info: () => bn,
  intro: () => J3,
  log: () => Ct,
  logBox: () => Z3,
  outro: () => X3,
  setLogLevel: () => En,
  shouldLog: () => Fu,
  step: () => Q3,
  warn: () => xn,
  wrapTextForClack: () => ur
});

// ../node_modules/@clack/core/dist/index.mjs
var N = v(S(), 1), st = require("node:process"), ye = v(require("node:readline"), 1), fD = v(require("node:readline"), 1), $t = require("node:tty"),
pD = v(rt(), 1);
function Tp({ onlyFirst: t = !1 } = {}) {
  let e = ["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?(?:\\u0007|\\u001B\\u00\
5C|\\u009C))", "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))"].join("|");
  return new RegExp(e, t ? void 0 : "g");
}
s(Tp, "hu");
var $p = Tp();
function mD(t) {
  if (typeof t != "string") throw new TypeError(`Expected a \`string\`, got \`${typeof t}\``);
  return t.replace($p, "");
}
s(mD, "Y");
function gD(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
s(gD, "Z");
var FD = { exports: {} };
(function(t) {
  var e = {};
  t.exports = e, e.eastAsianWidth = function(u) {
    var n = u.charCodeAt(0), o = u.length == 2 ? u.charCodeAt(1) : 0, i = n;
    return 55296 <= n && n <= 56319 && 56320 <= o && o <= 57343 && (n &= 1023, o &= 1023, i = n << 10 | o, i += 65536), i == 12288 || 65281 <=
    i && i <= 65376 || 65504 <= i && i <= 65510 ? "F" : i == 8361 || 65377 <= i && i <= 65470 || 65474 <= i && i <= 65479 || 65482 <= i && i <=
    65487 || 65490 <= i && i <= 65495 || 65498 <= i && i <= 65500 || 65512 <= i && i <= 65518 ? "H" : 4352 <= i && i <= 4447 || 4515 <= i &&
    i <= 4519 || 4602 <= i && i <= 4607 || 9001 <= i && i <= 9002 || 11904 <= i && i <= 11929 || 11931 <= i && i <= 12019 || 12032 <= i && i <=
    12245 || 12272 <= i && i <= 12283 || 12289 <= i && i <= 12350 || 12353 <= i && i <= 12438 || 12441 <= i && i <= 12543 || 12549 <= i && i <=
    12589 || 12593 <= i && i <= 12686 || 12688 <= i && i <= 12730 || 12736 <= i && i <= 12771 || 12784 <= i && i <= 12830 || 12832 <= i && i <=
    12871 || 12880 <= i && i <= 13054 || 13056 <= i && i <= 19903 || 19968 <= i && i <= 42124 || 42128 <= i && i <= 42182 || 43360 <= i && i <=
    43388 || 44032 <= i && i <= 55203 || 55216 <= i && i <= 55238 || 55243 <= i && i <= 55291 || 63744 <= i && i <= 64255 || 65040 <= i && i <=
    65049 || 65072 <= i && i <= 65106 || 65108 <= i && i <= 65126 || 65128 <= i && i <= 65131 || 110592 <= i && i <= 110593 || 127488 <= i &&
    i <= 127490 || 127504 <= i && i <= 127546 || 127552 <= i && i <= 127560 || 127568 <= i && i <= 127569 || 131072 <= i && i <= 194367 || 177984 <=
    i && i <= 196605 || 196608 <= i && i <= 262141 ? "W" : 32 <= i && i <= 126 || 162 <= i && i <= 163 || 165 <= i && i <= 166 || i == 172 ||
    i == 175 || 10214 <= i && i <= 10221 || 10629 <= i && i <= 10630 ? "Na" : i == 161 || i == 164 || 167 <= i && i <= 168 || i == 170 || 173 <=
    i && i <= 174 || 176 <= i && i <= 180 || 182 <= i && i <= 186 || 188 <= i && i <= 191 || i == 198 || i == 208 || 215 <= i && i <= 216 ||
    222 <= i && i <= 225 || i == 230 || 232 <= i && i <= 234 || 236 <= i && i <= 237 || i == 240 || 242 <= i && i <= 243 || 247 <= i && i <=
    250 || i == 252 || i == 254 || i == 257 || i == 273 || i == 275 || i == 283 || 294 <= i && i <= 295 || i == 299 || 305 <= i && i <= 307 ||
    i == 312 || 319 <= i && i <= 322 || i == 324 || 328 <= i && i <= 331 || i == 333 || 338 <= i && i <= 339 || 358 <= i && i <= 359 || i ==
    363 || i == 462 || i == 464 || i == 466 || i == 468 || i == 470 || i == 472 || i == 474 || i == 476 || i == 593 || i == 609 || i == 708 ||
    i == 711 || 713 <= i && i <= 715 || i == 717 || i == 720 || 728 <= i && i <= 731 || i == 733 || i == 735 || 768 <= i && i <= 879 || 913 <=
    i && i <= 929 || 931 <= i && i <= 937 || 945 <= i && i <= 961 || 963 <= i && i <= 969 || i == 1025 || 1040 <= i && i <= 1103 || i == 1105 ||
    i == 8208 || 8211 <= i && i <= 8214 || 8216 <= i && i <= 8217 || 8220 <= i && i <= 8221 || 8224 <= i && i <= 8226 || 8228 <= i && i <= 8231 ||
    i == 8240 || 8242 <= i && i <= 8243 || i == 8245 || i == 8251 || i == 8254 || i == 8308 || i == 8319 || 8321 <= i && i <= 8324 || i == 8364 ||
    i == 8451 || i == 8453 || i == 8457 || i == 8467 || i == 8470 || 8481 <= i && i <= 8482 || i == 8486 || i == 8491 || 8531 <= i && i <= 8532 ||
    8539 <= i && i <= 8542 || 8544 <= i && i <= 8555 || 8560 <= i && i <= 8569 || i == 8585 || 8592 <= i && i <= 8601 || 8632 <= i && i <= 8633 ||
    i == 8658 || i == 8660 || i == 8679 || i == 8704 || 8706 <= i && i <= 8707 || 8711 <= i && i <= 8712 || i == 8715 || i == 8719 || i == 8721 ||
    i == 8725 || i == 8730 || 8733 <= i && i <= 8736 || i == 8739 || i == 8741 || 8743 <= i && i <= 8748 || i == 8750 || 8756 <= i && i <= 8759 ||
    8764 <= i && i <= 8765 || i == 8776 || i == 8780 || i == 8786 || 8800 <= i && i <= 8801 || 8804 <= i && i <= 8807 || 8810 <= i && i <= 8811 ||
    8814 <= i && i <= 8815 || 8834 <= i && i <= 8835 || 8838 <= i && i <= 8839 || i == 8853 || i == 8857 || i == 8869 || i == 8895 || i == 8978 ||
    9312 <= i && i <= 9449 || 9451 <= i && i <= 9547 || 9552 <= i && i <= 9587 || 9600 <= i && i <= 9615 || 9618 <= i && i <= 9621 || 9632 <=
    i && i <= 9633 || 9635 <= i && i <= 9641 || 9650 <= i && i <= 9651 || 9654 <= i && i <= 9655 || 9660 <= i && i <= 9661 || 9664 <= i && i <=
    9665 || 9670 <= i && i <= 9672 || i == 9675 || 9678 <= i && i <= 9681 || 9698 <= i && i <= 9701 || i == 9711 || 9733 <= i && i <= 9734 ||
    i == 9737 || 9742 <= i && i <= 9743 || 9748 <= i && i <= 9749 || i == 9756 || i == 9758 || i == 9792 || i == 9794 || 9824 <= i && i <= 9825 ||
    9827 <= i && i <= 9829 || 9831 <= i && i <= 9834 || 9836 <= i && i <= 9837 || i == 9839 || 9886 <= i && i <= 9887 || 9918 <= i && i <= 9919 ||
    9924 <= i && i <= 9933 || 9935 <= i && i <= 9953 || i == 9955 || 9960 <= i && i <= 9983 || i == 10045 || i == 10071 || 10102 <= i && i <=
    10111 || 11093 <= i && i <= 11097 || 12872 <= i && i <= 12879 || 57344 <= i && i <= 63743 || 65024 <= i && i <= 65039 || i == 65533 || 127232 <=
    i && i <= 127242 || 127248 <= i && i <= 127277 || 127280 <= i && i <= 127337 || 127344 <= i && i <= 127386 || 917760 <= i && i <= 917999 ||
    983040 <= i && i <= 1048573 || 1048576 <= i && i <= 1114109 ? "A" : "N";
  }, e.characterLength = function(u) {
    var n = this.eastAsianWidth(u);
    return n == "F" || n == "W" || n == "A" ? 2 : 1;
  };
  function r(u) {
    return u.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[^\uD800-\uDFFF]/g) || [];
  }
  s(r, "t"), e.length = function(u) {
    for (var n = r(u), o = 0, i = 0; i < n.length; i++) o = o + this.characterLength(n[i]);
    return o;
  }, e.slice = function(u, n, o) {
    textLen = e.length(u), n = n || 0, o = o || 1, n < 0 && (n = textLen + n), o < 0 && (o = textLen + o);
    for (var i = "", D = 0, a = r(u), l = 0; l < a.length; l++) {
      var h = a[l], p = e.length(h);
      if (D >= n - (p == 2 ? 1 : 0)) if (D + p <= o) i += h;
      else break;
      D += p;
    }
    return i;
  };
})(FD);
var Op = FD.exports, _p = gD(Op), Ip = /* @__PURE__ */ s(function() {
  return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67)\uDB40\uDC7F|(?:\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFC-\uDFFF])|\uD83D\uDC68(?:\uD83C\uDFFB(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|[\u2695\u2696\u2708]\uFE0F|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))?|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])\uFE0F|\u200D(?:(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D[\uDC66\uDC67])|\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC)?|(?:\uD83D\uDC69(?:\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69]))|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC69(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83E\uDDD1(?:\u200D(?:\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDE36\u200D\uD83C\uDF2B|\uD83C\uDFF3\uFE0F\u200D\u26A7|\uD83D\uDC3B\u200D\u2744|(?:(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\uD83C\uDFF4\u200D\u2620|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])\u200D[\u2640\u2642]|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u2600-\u2604\u260E\u2611\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26B0\u26B1\u26C8\u26CF\u26D1\u26D3\u26E9\u26F0\u26F1\u26F4\u26F7\u26F8\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u3030\u303D\u3297\u3299]|\uD83C[\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]|\uD83D[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3])\uFE0F|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDE35\u200D\uD83D\uDCAB|\uD83D\uDE2E\u200D\uD83D\uDCA8|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83E\uDDD1(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83D\uDC69(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF6\uD83C\uDDE6|\uD83C\uDDF4\uD83C\uDDF2|\uD83D\uDC08\u200D\u2B1B|\u2764\uFE0F\u200D(?:\uD83D\uDD25|\uD83E\uDE79)|\uD83D\uDC41\uFE0F|\uD83C\uDFF3\uFE0F|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|[#\*0-9]\uFE0F\u20E3|\u2764\uFE0F|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|\uD83C\uDFF4|(?:[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270C\u270D]|\uD83D[\uDD74\uDD90])(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC08\uDC15\uDC3B\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE2E\uDE35\uDE36\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5]|\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD]|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF]|[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0D\uDD0E\uDD10-\uDD17\uDD1D\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78\uDD7A-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCB\uDDD0\uDDE0-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6]|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26A7\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5-\uDED7\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDD77\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
}, "Au"), Lp = gD(Ip);
function Ot(t, e = {}) {
  if (typeof t != "string" || t.length === 0 || (e = { ambiguousIsNarrow: !0, ...e }, t = mD(t), t.length === 0)) return 0;
  t = t.replace(Lp(), "  ");
  let r = e.ambiguousIsNarrow ? 1 : 2, u = 0;
  for (let n of t) {
    let o = n.codePointAt(0);
    if (!(o <= 31 || o >= 127 && o <= 159 || o >= 768 && o <= 879))
      switch (_p.eastAsianWidth(n)) {
        case "F":
        case "W":
          u += 2;
          break;
        case "A":
          u += r;
          break;
        default:
          u += 1;
      }
  }
  return u;
}
s(Ot, "m");
var Ku = 10, sD = /* @__PURE__ */ s((t = 0) => (e) => `\x1B[${e + t}m`, "H"), nD = /* @__PURE__ */ s((t = 0) => (e) => `\x1B[${38 + t};5;${e}\
m`, "U"), oD = /* @__PURE__ */ s((t = 0) => (e, r, u) => `\x1B[${38 + t};2;${e};${r};${u}m`, "J"), T = { modifier: { reset: [0, 0], bold: [1,
22], dim: [2, 22], italic: [3, 23], underline: [4, 24], overline: [53, 55], inverse: [7, 27], hidden: [8, 28], strikethrough: [9, 29] }, color: {
black: [30, 39], red: [31, 39], green: [32, 39], yellow: [33, 39], blue: [34, 39], magenta: [35, 39], cyan: [36, 39], white: [37, 39], blackBright: [
90, 39], gray: [90, 39], grey: [90, 39], redBright: [91, 39], greenBright: [92, 39], yellowBright: [93, 39], blueBright: [94, 39], magentaBright: [
95, 39], cyanBright: [96, 39], whiteBright: [97, 39] }, bgColor: { bgBlack: [40, 49], bgRed: [41, 49], bgGreen: [42, 49], bgYellow: [43, 49],
bgBlue: [44, 49], bgMagenta: [45, 49], bgCyan: [46, 49], bgWhite: [47, 49], bgBlackBright: [100, 49], bgGray: [100, 49], bgGrey: [100, 49], bgRedBright: [
101, 49], bgGreenBright: [102, 49], bgYellowBright: [103, 49], bgBlueBright: [104, 49], bgMagentaBright: [105, 49], bgCyanBright: [106, 49],
bgWhiteBright: [107, 49] } };
Object.keys(T.modifier);
var kp = Object.keys(T.color), Pp = Object.keys(T.bgColor);
[...kp, ...Pp];
function Mp() {
  let t = /* @__PURE__ */ new Map();
  for (let [e, r] of Object.entries(T)) {
    for (let [u, n] of Object.entries(r)) T[u] = { open: `\x1B[${n[0]}m`, close: `\x1B[${n[1]}m` }, r[u] = T[u], t.set(n[0], n[1]);
    Object.defineProperty(T, e, { value: r, enumerable: !1 });
  }
  return Object.defineProperty(T, "codes", { value: t, enumerable: !1 }), T.color.close = "\x1B[39m", T.bgColor.close = "\x1B[49m", T.color.
  ansi = sD(), T.color.ansi256 = nD(), T.color.ansi16m = oD(), T.bgColor.ansi = sD(Ku), T.bgColor.ansi256 = nD(Ku), T.bgColor.ansi16m = oD(Ku),
  Object.defineProperties(T, { rgbToAnsi256: { value: /* @__PURE__ */ s((e, r, u) => e === r && r === u ? e < 8 ? 16 : e > 248 ? 231 : Math.
  round((e - 8) / 247 * 24) + 232 : 16 + 36 * Math.round(e / 255 * 5) + 6 * Math.round(r / 255 * 5) + Math.round(u / 255 * 5), "value"), enumerable: !1 },
  hexToRgb: { value: /* @__PURE__ */ s((e) => {
    let r = /[a-f\d]{6}|[a-f\d]{3}/i.exec(e.toString(16));
    if (!r) return [0, 0, 0];
    let [u] = r;
    u.length === 3 && (u = [...u].map((o) => o + o).join(""));
    let n = Number.parseInt(u, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }, "value"), enumerable: !1 }, hexToAnsi256: { value: /* @__PURE__ */ s((e) => T.rgbToAnsi256(...T.hexToRgb(e)), "value"), enumerable: !1 },
  ansi256ToAnsi: { value: /* @__PURE__ */ s((e) => {
    if (e < 8) return 30 + e;
    if (e < 16) return 90 + (e - 8);
    let r, u, n;
    if (e >= 232) r = ((e - 232) * 10 + 8) / 255, u = r, n = r;
    else {
      e -= 16;
      let D = e % 36;
      r = Math.floor(e / 36) / 5, u = Math.floor(D / 6) / 5, n = D % 6 / 5;
    }
    let o = Math.max(r, u, n) * 2;
    if (o === 0) return 30;
    let i = 30 + (Math.round(n) << 2 | Math.round(u) << 1 | Math.round(r));
    return o === 2 && (i += 60), i;
  }, "value"), enumerable: !1 }, rgbToAnsi: { value: /* @__PURE__ */ s((e, r, u) => T.ansi256ToAnsi(T.rgbToAnsi256(e, r, u)), "value"), enumerable: !1 },
  hexToAnsi: { value: /* @__PURE__ */ s((e) => T.ansi256ToAnsi(T.hexToAnsi256(e)), "value"), enumerable: !1 } }), T;
}
s(Mp, "gu");
var Rp = Mp(), Ar = /* @__PURE__ */ new Set(["\x1B", "\x9B"]), qp = 39, ei = "\x07", CD = "[", Np = "]", ED = "m", ti = `${Np}8;;`, DD = /* @__PURE__ */ s(
(t) => `${Ar.values().next().value}${CD}${t}${ED}`, "uu"), aD = /* @__PURE__ */ s((t) => `${Ar.values().next().value}${ti}${t}${ei}`, "Du"),
jp = /* @__PURE__ */ s((t) => t.split(" ").map((e) => Ot(e)), "wu"), Zu = /* @__PURE__ */ s((t, e, r) => {
  let u = [...e], n = !1, o = !1, i = Ot(mD(t[t.length - 1]));
  for (let [D, a] of u.entries()) {
    let l = Ot(a);
    if (i + l <= r ? t[t.length - 1] += a : (t.push(a), i = 0), Ar.has(a) && (n = !0, o = u.slice(D + 1).join("").startsWith(ti)), n) {
      o ? a === ei && (n = !1, o = !1) : a === ED && (n = !1);
      continue;
    }
    i += l, i === r && D < u.length - 1 && (t.push(""), i = 0);
  }
  !i && t[t.length - 1].length > 0 && t.length > 1 && (t[t.length - 2] += t.pop());
}, "j"), Gp = /* @__PURE__ */ s((t) => {
  let e = t.split(" "), r = e.length;
  for (; r > 0 && !(Ot(e[r - 1]) > 0); ) r--;
  return r === e.length ? t : e.slice(0, r).join(" ") + e.slice(r).join("");
}, "yu"), Wp = /* @__PURE__ */ s((t, e, r = {}) => {
  if (r.trim !== !1 && t.trim() === "") return "";
  let u = "", n, o, i = jp(t), D = [""];
  for (let [l, h] of t.split(" ").entries()) {
    r.trim !== !1 && (D[D.length - 1] = D[D.length - 1].trimStart());
    let p = Ot(D[D.length - 1]);
    if (l !== 0 && (p >= e && (r.wordWrap === !1 || r.trim === !1) && (D.push(""), p = 0), (p > 0 || r.trim === !1) && (D[D.length - 1] += "\
 ", p++)), r.hard && i[l] > e) {
      let d = e - p, m = 1 + Math.floor((i[l] - d - 1) / e);
      Math.floor((i[l] - 1) / e) < m && D.push(""), Zu(D, h, e);
      continue;
    }
    if (p + i[l] > e && p > 0 && i[l] > 0) {
      if (r.wordWrap === !1 && p < e) {
        Zu(D, h, e);
        continue;
      }
      D.push("");
    }
    if (p + i[l] > e && r.wordWrap === !1) {
      Zu(D, h, e);
      continue;
    }
    D[D.length - 1] += h;
  }
  r.trim !== !1 && (D = D.map((l) => Gp(l)));
  let a = [...D.join(`
`)];
  for (let [l, h] of a.entries()) {
    if (u += h, Ar.has(h)) {
      let { groups: d } = new RegExp(`(?:\\${CD}(?<code>\\d+)m|\\${ti}(?<uri>.*)${ei})`).exec(a.slice(l).join("")) || { groups: {} };
      if (d.code !== void 0) {
        let m = Number.parseFloat(d.code);
        n = m === qp ? void 0 : m;
      } else d.uri !== void 0 && (o = d.uri.length === 0 ? void 0 : d.uri);
    }
    let p = Rp.codes.get(Number(n));
    a[l + 1] === `
` ? (o && (u += aD("")), n && p && (u += DD(p))) : h === `
` && (n && p && (u += DD(n)), o && (u += aD(o)));
  }
  return u;
}, "_u");
function lD(t, e, r) {
  return String(t).normalize().replace(/\r\n/g, `
`).split(`
`).map((u) => Wp(u, e, r)).join(`
`);
}
s(lD, "tu");
var Vp = ["up", "down", "left", "right", "space", "enter", "cancel"], ve = { actions: new Set(Vp), aliases: /* @__PURE__ */ new Map([["k", "\
up"], ["j", "down"], ["h", "left"], ["l", "right"], ["", "cancel"], ["escape", "cancel"]]), messages: { cancel: "Canceled", error: "Somethi\
ng went wrong" } };
function ri(t, e) {
  if (typeof t == "string") return ve.aliases.get(t) === e;
  for (let r of t) if (r !== void 0 && ri(r, e)) return !0;
  return !1;
}
s(ri, "P");
function Up(t, e) {
  if (t === e) return;
  let r = t.split(`
`), u = e.split(`
`), n = [];
  for (let o = 0; o < Math.max(r.length, u.length); o++) r[o] !== u[o] && n.push(o);
  return n;
}
s(Up, "Su");
var Yp = globalThis.process.platform.startsWith("win"), Qu = Symbol("clack:cancel");
function Sr(t) {
  return t === Qu;
}
s(Sr, "Ou");
function Br(t, e) {
  let r = t;
  r.isTTY && r.setRawMode(e);
}
s(Br, "$");
function bD({ input: t = st.stdin, output: e = st.stdout, overwrite: r = !0, hideCursor: u = !0 } = {}) {
  let n = ye.createInterface({ input: t, output: e, prompt: "", tabSize: 1 });
  ye.emitKeypressEvents(t, n), t instanceof $t.ReadStream && t.isTTY && t.setRawMode(!0);
  let o = /* @__PURE__ */ s((i, { name: D, sequence: a }) => {
    let l = String(i);
    if (ri([l, D, a], "cancel")) {
      u && e.write(N.cursor.show), process.exit(0);
      return;
    }
    if (!r) return;
    ye.moveCursor(e, D === "return" ? 0 : -1, D === "return" ? -1 : 0, () => {
      ye.clearLine(e, 1, () => {
        t.once("keypress", o);
      });
    });
  }, "F");
  return u && e.write(N.cursor.hide), t.once("keypress", o), () => {
    t.off("keypress", o), u && e.write(N.cursor.show), t instanceof $t.ReadStream && t.isTTY && !Yp && t.setRawMode(!1), n.terminal = !1, n.
    close();
  };
}
s(bD, "Mu");
var xD = /* @__PURE__ */ s((t) => t instanceof $t.WriteStream && t.columns ? t.columns : 80, "Tu"), Hp = Object.defineProperty, zp = /* @__PURE__ */ s(
(t, e, r) => e in t ? Hp(t, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) : t[e] = r, "Pu"), W = /* @__PURE__ */ s((t, e, r) => (zp(
t, typeof e != "symbol" ? e + "" : e, r), r), "E"), it = class {
  static {
    s(this, "B");
  }
  constructor(e, r = !0) {
    W(this, "input"), W(this, "output"), W(this, "_abortSignal"), W(this, "rl"), W(this, "opts"), W(this, "_render"), W(this, "_track", !1),
    W(this, "_prevFrame", ""), W(this, "_subscribers", /* @__PURE__ */ new Map()), W(this, "_cursor", 0), W(this, "_usePlaceholderAsValue", !0),
    W(this, "state", "initial"), W(this, "error", ""), W(this, "value");
    let { input: u = st.stdin, output: n = st.stdout, render: o, signal: i, ...D } = e;
    this.opts = D, this.onKeypress = this.onKeypress.bind(this), this.close = this.close.bind(this), this.render = this.render.bind(this), this.
    _render = o.bind(this), this._track = r, this._abortSignal = i, this.input = u, this.output = n;
  }
  unsubscribe() {
    this._subscribers.clear();
  }
  setSubscriber(e, r) {
    let u = this._subscribers.get(e) ?? [];
    u.push(r), this._subscribers.set(e, u);
  }
  on(e, r) {
    this.setSubscriber(e, { cb: r });
  }
  once(e, r) {
    this.setSubscriber(e, { cb: r, once: !0 });
  }
  emit(e, ...r) {
    let u = this._subscribers.get(e) ?? [], n = [];
    for (let o of u) o.cb(...r), o.once && n.push(() => u.splice(u.indexOf(o), 1));
    for (let o of n) o();
  }
  prompt() {
    return new Promise((e, r) => {
      if (this._abortSignal) {
        if (this._abortSignal.aborted) return this.state = "cancel", this.close(), e(Qu);
        this._abortSignal.addEventListener("abort", () => {
          this.state = "cancel", this.close();
        }, { once: !0 });
      }
      this.rl = fD.default.createInterface({ input: this.input, tabSize: 2, prompt: "", escapeCodeTimeout: 50, terminal: !0 }), this.rl.prompt(),
      this.opts.initialValue !== void 0 && (this._track && this.rl.write(this.opts.initialValue), this._setValue(this.opts.initialValue)), this.
      input.on("keypress", this.onKeypress), Br(this.input, !0), this.output.on("resize", this.render), this.render(), this.once("submit", () => {
        this.output.write(N.cursor.show), this.output.off("resize", this.render), Br(this.input, !1), e(this.value);
      }), this.once("cancel", () => {
        this.output.write(N.cursor.show), this.output.off("resize", this.render), Br(this.input, !1), e(Qu);
      });
    });
  }
  _isActionKey(e, r) {
    return e === "	";
  }
  _setValue(e) {
    this.value = e, this.emit("value", this.value);
  }
  onKeypress(e, r) {
    if (this._track && r.name !== "return" && (r.name && this._isActionKey(e, r) && this.rl?.write(null, { ctrl: !0, name: "h" }), this._cursor =
    this.rl?.cursor ?? 0, this._setValue(this.rl?.line)), this.state === "error" && (this.state = "active"), r?.name && (!this._track && ve.
    aliases.has(r.name) && this.emit("cursor", ve.aliases.get(r.name)), ve.actions.has(r.name) && this.emit("cursor", r.name)), e && (e.toLowerCase() ===
    "y" || e.toLowerCase() === "n") && this.emit("confirm", e.toLowerCase() === "y"), this._usePlaceholderAsValue && e === "	" && this.opts.
    placeholder && (this.value || (this.rl?.write(this.opts.placeholder), this._setValue(this.opts.placeholder))), this.emit("key", e?.toLowerCase(),
    r), r?.name === "return") {
      if (!this.value && this.opts.placeholder && (this.rl?.write(this.opts.placeholder), this._setValue(this.opts.placeholder)), this.opts.
      validate) {
        let u = this.opts.validate(this.value);
        u && (this.error = u instanceof Error ? u.message : u, this.state = "error", this.rl?.write(this.value));
      }
      this.state !== "error" && (this.state = "submit");
    }
    ri([e, r?.name, r?.sequence], "cancel") && (this.state = "cancel"), (this.state === "submit" || this.state === "cancel") && this.emit("f\
inalize"), this.render(), (this.state === "submit" || this.state === "cancel") && this.close();
  }
  close() {
    this.input.unpipe(), this.input.removeListener("keypress", this.onKeypress), this.output.write(`
`), Br(this.input, !1), this.rl?.close(), this.rl = void 0, this.emit(`${this.state}`, this.value), this.unsubscribe();
  }
  restoreCursor() {
    let e = lD(this._prevFrame, process.stdout.columns, { hard: !0 }).split(`
`).length - 1;
    this.output.write(N.cursor.move(-999, e * -1));
  }
  render() {
    let e = lD(this._render(this) ?? "", process.stdout.columns, { hard: !0 });
    if (e !== this._prevFrame) {
      if (this.state === "initial") this.output.write(N.cursor.hide);
      else {
        let r = Up(this._prevFrame, e);
        if (this.restoreCursor(), r && r?.length === 1) {
          let u = r[0];
          this.output.write(N.cursor.move(0, u)), this.output.write(N.erase.lines(1));
          let n = e.split(`
`);
          this.output.write(n[u]), this._prevFrame = e, this.output.write(N.cursor.move(0, n.length - u - 1));
          return;
        }
        if (r && r?.length > 1) {
          let u = r[0];
          this.output.write(N.cursor.move(0, u)), this.output.write(N.erase.down());
          let n = e.split(`
`).slice(u);
          this.output.write(n.join(`
`)), this._prevFrame = e;
          return;
        }
        this.output.write(N.erase.down());
      }
      this.output.write(e), this.state === "initial" && (this.state = "active"), this._prevFrame = e;
    }
  }
}, wr = class extends it {
  static {
    s(this, "Nu");
  }
  get cursor() {
    return this.value ? 0 : 1;
  }
  get _value() {
    return this.cursor === 0;
  }
  constructor(e) {
    super(e, !1), this.value = !!e.initialValue, this.on("value", () => {
      this.value = this._value;
    }), this.on("confirm", (r) => {
      this.output.write(N.cursor.move(0, -1)), this.value = r, this.state = "submit", this.close();
    }), this.on("cursor", () => {
      this.value = !this.value;
    });
  }
};
var Kp;
Kp = /* @__PURE__ */ new WeakMap();
var Zp = Object.defineProperty, Jp = /* @__PURE__ */ s((t, e, r) => e in t ? Zp(t, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) :
t[e] = r, "zu"), hD = /* @__PURE__ */ s((t, e, r) => (Jp(t, typeof e != "symbol" ? e + "" : e, r), r), "iu"), vD = class extends it {
  static {
    s(this, "Yu");
  }
  constructor(t) {
    super(t, !1), hD(this, "options"), hD(this, "cursor", 0), this.options = t.options, this.value = [...t.initialValues ?? []], this.cursor =
    Math.max(this.options.findIndex(({ value: e }) => e === t.cursorAt), 0), this.on("key", (e) => {
      e === "a" && this.toggleAll();
    }), this.on("cursor", (e) => {
      switch (e) {
        case "left":
        case "up":
          this.cursor = this.cursor === 0 ? this.options.length - 1 : this.cursor - 1;
          break;
        case "down":
        case "right":
          this.cursor = this.cursor === this.options.length - 1 ? 0 : this.cursor + 1;
          break;
        case "space":
          this.toggleValue();
          break;
      }
    });
  }
  get _value() {
    return this.options[this.cursor].value;
  }
  toggleAll() {
    let t = this.value.length === this.options.length;
    this.value = t ? [] : this.options.map((e) => e.value);
  }
  toggleValue() {
    let t = this.value.includes(this._value);
    this.value = t ? this.value.filter((e) => e !== this._value) : [...this.value, this._value];
  }
};
var Xp = Object.defineProperty, Qp = /* @__PURE__ */ s((t, e, r) => e in t ? Xp(t, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) :
t[e] = r, "Qu"), cD = /* @__PURE__ */ s((t, e, r) => (Qp(t, typeof e != "symbol" ? e + "" : e, r), r), "Fu"), yD = class extends it {
  static {
    s(this, "Xu");
  }
  constructor(t) {
    super(t, !1), cD(this, "options"), cD(this, "cursor", 0), this.options = t.options, this.cursor = this.options.findIndex(({ value: e }) => e ===
    t.initialValue), this.cursor === -1 && (this.cursor = 0), this.changeValue(), this.on("cursor", (e) => {
      switch (e) {
        case "left":
        case "up":
          this.cursor = this.cursor === 0 ? this.options.length - 1 : this.cursor - 1;
          break;
        case "down":
        case "right":
          this.cursor = this.cursor === this.options.length - 1 ? 0 : this.cursor + 1;
          break;
      }
      this.changeValue();
    });
  }
  get _value() {
    return this.options[this.cursor];
  }
  changeValue() {
    this.value = this._value.value;
  }
};
var BD = class extends it {
  static {
    s(this, "eD");
  }
  get valueWithCursor() {
    if (this.state === "submit") return this.value;
    let t = this.value ?? "";
    if (this.cursor >= t.length) return `${this.value}\u2588`;
    let e = t.slice(0, this.cursor), [r, ...u] = t.slice(this.cursor);
    return `${e}${pD.default.inverse(r)}${u.join("")}`;
  }
  get cursor() {
    return this._cursor;
  }
  constructor(t) {
    super(t), this.on("finalize", () => {
      this.value || (this.value = t.defaultValue);
    });
  }
};
var wD = /* @__PURE__ */ s((t, e, r) => {
  if (!e.has(t)) throw TypeError("Cannot " + r);
}, "L"), Tt = /* @__PURE__ */ s((t, e, r) => (wD(t, e, "read from private field"), r ? r.call(t) : e.get(t)), "f");
var Ju = /* @__PURE__ */ s((t, e, r, u) => (wD(t, e, "write to private field"), u ? u.call(t, r) : e.set(t, r), r), "b");
var ut, Xu, dD, em, tm, rm, um;
function im(t, e) {
  if (t === void 0 || e.length === 0) return 0;
  let r = e.findIndex((u) => u.value === t);
  return r !== -1 ? r : 0;
}
s(im, "FD");
ut = /* @__PURE__ */ new WeakMap(), Xu = /* @__PURE__ */ new WeakMap(), dD = /* @__PURE__ */ new WeakMap(), em = /* @__PURE__ */ new WeakSet(),
tm = /* @__PURE__ */ s(function(t, e) {
  let r = e.name === "up", u = e.name === "down";
  r || u ? (Ju(this, ut, Math.max(0, Math.min(Tt(this, ut) + (r ? -1 : 1), this.filteredOptions.length - 1))), this.focusedValue = this.filteredOptions[Tt(
  this, ut)]?.value, this.multiple || (this.selectedValues = [this.focusedValue]), this.isNavigating = !0) : this.multiple && this.focusedValue !==
  void 0 && (e.name === "tab" || this.isNavigating && e.name === "space") ? this.toggleSelected(this.focusedValue) : this.isNavigating = !1;
}, "nu"), rm = /* @__PURE__ */ new WeakSet(), um = /* @__PURE__ */ s(function(t) {
  t !== Tt(this, Xu) && (Ju(this, Xu, t), t ? this.filteredOptions = this.options.filter((e) => Tt(this, dD).call(this, t, e)) : this.filteredOptions =
  [...this.options], Ju(this, ut, im(this.focusedValue, this.filteredOptions)), this.focusedValue = this.filteredOptions[Tt(this, ut)]?.value);
}, "ou");

// ../node_modules/@clack/prompts/dist/index.mjs
var nt = v(rt(), 1), f = v(rt(), 1), Z = v(require("node:process"), 1), SD = require("node:tty"), sm = require("node:util"), _t = v(S(), 1);
function nm() {
  return Z.default.platform !== "win32" ? Z.default.env.TERM !== "linux" : !!Z.default.env.CI || !!Z.default.env.WT_SESSION || !!Z.default.env.
  TERMINUS_SUBLIME || Z.default.env.ConEmuTask === "{cmd::Cmder}" || Z.default.env.TERM_PROGRAM === "Terminus-Sublime" || Z.default.env.TERM_PROGRAM ===
  "vscode" || Z.default.env.TERM === "xterm-256color" || Z.default.env.TERM === "alacritty" || Z.default.env.TERMINAL_EMULATOR === "JetBrain\
s-JediTerm";
}
s(nm, "Me");
var ui = nm(), TD = /* @__PURE__ */ s(() => process.env.CI === "true", "W"), $ = /* @__PURE__ */ s((t, e) => ui ? t : e, "h"), om = $("\u25C6",
"*"), $D = $("\u25A0", "x"), OD = $("\u25B2", "x"), Tr = $("\u25C7", "o"), Dm = $("\u250C", "T"), y = $("\u2502", "|"), Be = $("\u2514", "\u2014"),
ii = $("\u25CF", ">"), si = $("\u25CB", " "), am = $("\u25FB", "[\u2022]"), AD = $("\u25FC", "[+]"), lm = $("\u25FB", "[ ]"), A8 = $("\u25AA",
"\u2022"), S8 = $("\u2500", "-"), T8 = $("\u256E", "+"), $8 = $("\u251C", "+"), O8 = $("\u256F", "+"), hm = $("\u25CF", "\u2022"), cm = $("\u25C6",
"*"), dm = $("\u25B2", "!"), fm = $("\u25A0", "x"), $r = /* @__PURE__ */ s((t) => {
  switch (t) {
    case "initial":
    case "active":
      return f.default.cyan(om);
    case "cancel":
      return f.default.red($D);
    case "error":
      return f.default.yellow(OD);
    case "submit":
      return f.default.green(Tr);
  }
}, "T"), ni = /* @__PURE__ */ s((t) => {
  let { cursor: e, options: r, style: u } = t, n = t.output ?? process.stdout, o = n instanceof SD.WriteStream && n.rows !== void 0 ? n.rows :
  10, i = f.default.dim("..."), D = t.maxItems ?? Number.POSITIVE_INFINITY, a = Math.max(o - 4, 0), l = Math.min(a, Math.max(D, 5)), h = 0;
  e >= h + l - 3 ? h = Math.max(Math.min(e - l + 3, r.length - l), 0) : e < h + 2 && (h = Math.max(e - 2, 0));
  let p = l < r.length && h > 0, d = l < r.length && h + l < r.length;
  return r.slice(h, h + l).map((m, g, F) => {
    let E = g === 0 && p, b = g === F.length - 1 && d;
    return E || b ? i : u(m, g + h === e);
  });
}, "A");
var _D = /* @__PURE__ */ s((t) => {
  let e = t.active ?? "Yes", r = t.inactive ?? "No";
  return new wr({ active: e, inactive: r, input: t.input, output: t.output, initialValue: t.initialValue ?? !0, render() {
    let u = `${f.default.gray(y)}
${$r(this.state)}  ${t.message}
`, n = this.value ? e : r;
    switch (this.state) {
      case "submit":
        return `${u}${f.default.gray(y)}  ${f.default.dim(n)}`;
      case "cancel":
        return `${u}${f.default.gray(y)}  ${f.default.strikethrough(f.default.dim(n))}
${f.default.gray(y)}`;
      default:
        return `${u}${f.default.cyan(y)}  ${this.value ? `${f.default.green(ii)} ${e}` : `${f.default.dim(si)} ${f.default.dim(e)}`} ${f.default.
        dim("/")} ${this.value ? `${f.default.dim(si)} ${f.default.dim(r)}` : `${f.default.green(ii)} ${r}`}
${f.default.cyan(Be)}
`;
    }
  } }).prompt();
}, "Ve");
var j = { message: /* @__PURE__ */ s((t = [], { symbol: e = f.default.gray(y), secondarySymbol: r = f.default.gray(y), output: u = process.stdout,
spacing: n = 1 } = {}) => {
  let o = [];
  for (let D = 0; D < n; D++) o.push(`${r}`);
  let i = Array.isArray(t) ? t : t.split(`
`);
  if (i.length > 0) {
    let [D, ...a] = i;
    D.length > 0 ? o.push(`${e}  ${D}`) : o.push(e);
    for (let l of a) l.length > 0 ? o.push(`${r}  ${l}`) : o.push(r);
  }
  u.write(`${o.join(`
`)}
`);
}, "message"), info: /* @__PURE__ */ s((t, e) => {
  j.message(t, { ...e, symbol: f.default.blue(hm) });
}, "info"), success: /* @__PURE__ */ s((t, e) => {
  j.message(t, { ...e, symbol: f.default.green(cm) });
}, "success"), step: /* @__PURE__ */ s((t, e) => {
  j.message(t, { ...e, symbol: f.default.green(Tr) });
}, "step"), warn: /* @__PURE__ */ s((t, e) => {
  j.message(t, { ...e, symbol: f.default.yellow(dm) });
}, "warn"), warning: /* @__PURE__ */ s((t, e) => {
  j.warn(t, e);
}, "warning"), error: /* @__PURE__ */ s((t, e) => {
  j.message(t, { ...e, symbol: f.default.red(fm) });
}, "error") }, ID = /* @__PURE__ */ s((t = "", e) => {
  (e?.output ?? process.stdout).write(`${f.default.gray(Be)}  ${f.default.red(t)}

`);
}, "Ne"), LD = /* @__PURE__ */ s((t = "", e) => {
  (e?.output ?? process.stdout).write(`${f.default.gray(Dm)}  ${t}
`);
}, "Pe"), kD = /* @__PURE__ */ s((t = "", e) => {
  (e?.output ?? process.stdout).write(`${f.default.gray(y)}
${f.default.gray(Be)}  ${t}

`);
}, "Le"), PD = /* @__PURE__ */ s((t) => {
  let e = /* @__PURE__ */ s((r, u) => {
    let n = r.label ?? String(r.value);
    return u === "active" ? `${f.default.cyan(am)} ${n} ${r.hint ? f.default.dim(`(${r.hint})`) : ""}` : u === "selected" ? `${f.default.green(
    AD)} ${f.default.dim(n)} ${r.hint ? f.default.dim(`(${r.hint})`) : ""}` : u === "cancelled" ? `${f.default.strikethrough(f.default.dim(n))}` :
    u === "active-selected" ? `${f.default.green(AD)} ${n} ${r.hint ? f.default.dim(`(${r.hint})`) : ""}` : u === "submitted" ? `${f.default.
    dim(n)}` : `${f.default.dim(lm)} ${f.default.dim(n)}`;
  }, "r");
  return new vD({ options: t.options, input: t.input, output: t.output, initialValues: t.initialValues, required: t.required ?? !0, cursorAt: t.
  cursorAt, validate(r) {
    if (this.required && r.length === 0) return `Please select at least one option.
${f.default.reset(f.default.dim(`Press ${f.default.gray(f.default.bgWhite(f.default.inverse(" space ")))} to select, ${f.default.gray(f.default.
    bgWhite(f.default.inverse(" enter ")))} to submit`))}`;
  }, render() {
    let r = `${f.default.gray(y)}
${$r(this.state)}  ${t.message}
`, u = /* @__PURE__ */ s((n, o) => {
      let i = this.value.includes(n.value);
      return o && i ? e(n, "active-selected") : i ? e(n, "selected") : e(n, o ? "active" : "inactive");
    }, "i");
    switch (this.state) {
      case "submit":
        return `${r}${f.default.gray(y)}  ${this.options.filter(({ value: n }) => this.value.includes(n)).map((n) => e(n, "submitted")).join(
        f.default.dim(", ")) || f.default.dim("none")}`;
      case "cancel": {
        let n = this.options.filter(({ value: o }) => this.value.includes(o)).map((o) => e(o, "cancelled")).join(f.default.dim(", "));
        return `${r}${f.default.gray(y)}  ${n.trim() ? `${n}
${f.default.gray(y)}` : ""}`;
      }
      case "error": {
        let n = this.error.split(`
`).map((o, i) => i === 0 ? `${f.default.yellow(Be)}  ${f.default.yellow(o)}` : `   ${o}`).join(`
`);
        return `${r + f.default.yellow(y)}  ${ni({ output: t.output, options: this.options, cursor: this.cursor, maxItems: t.maxItems, style: u }).
        join(`
${f.default.yellow(y)}  `)}
${n}
`;
      }
      default:
        return `${r}${f.default.cyan(y)}  ${ni({ output: t.output, options: this.options, cursor: this.cursor, maxItems: t.maxItems, style: u }).
        join(`
${f.default.cyan(y)}  `)}
${f.default.cyan(Be)}
`;
    }
  } }).prompt();
}, "ke");
var MD = /* @__PURE__ */ s(({ indicator: t = "dots", onCancel: e, output: r = process.stdout, cancelMessage: u, errorMessage: n, frames: o = ui ?
["\u25D2", "\u25D0", "\u25D3", "\u25D1"] : ["\u2022", "o", "O", "0"], delay: i = ui ? 80 : 120 } = {}) => {
  let D = TD(), a, l, h = !1, p = !1, d = "", m, g = performance.now(), F = /* @__PURE__ */ s((R) => {
    let z = R > 1 ? n ?? ve.messages.error : u ?? ve.messages.cancel;
    p = R === 1, h && (On(z, R), p && typeof e == "function" && e());
  }, "v"), E = /* @__PURE__ */ s(() => F(2), "S"), b = /* @__PURE__ */ s(() => F(1), "b"), B = /* @__PURE__ */ s(() => {
    process.on("uncaughtExceptionMonitor", E), process.on("unhandledRejection", E), process.on("SIGINT", b), process.on("SIGTERM", b), process.
    on("exit", F);
  }, "B"), M = /* @__PURE__ */ s(() => {
    process.removeListener("uncaughtExceptionMonitor", E), process.removeListener("unhandledRejection", E), process.removeListener("SIGINT",
    b), process.removeListener("SIGTERM", b), process.removeListener("exit", F);
  }, "me"), xt = /* @__PURE__ */ s(() => {
    if (m === void 0) return;
    D && r.write(`
`);
    let R = m.split(`
`);
    r.write(_t.cursor.move(-999, R.length - 1)), r.write(_t.erase.down(R.length));
  }, "Y"), vt = /* @__PURE__ */ s((R) => R.replace(/\.+$/, ""), "z"), yt = /* @__PURE__ */ s((R) => {
    let z = (performance.now() - R) / 1e3, ue = Math.floor(z / 60), ze = Math.floor(z % 60);
    return ue > 0 ? `[${ue}m ${ze}s]` : `[${ze}s]`;
  }, "Q"), Dr = /* @__PURE__ */ s((R = "") => {
    h = !0, a = bD({ output: r }), d = vt(R), g = performance.now(), r.write(`${f.default.gray(y)}
`);
    let z = 0, ue = 0;
    B(), l = setInterval(() => {
      if (D && d === m) return;
      xt(), m = d;
      let ze = f.default.magenta(o[z]);
      if (D) r.write(`${ze}  ${d}...`);
      else if (t === "timer") r.write(`${ze}  ${d} ${yt(g)}`);
      else {
        let D0 = ".".repeat(Math.floor(ue)).slice(0, 3);
        r.write(`${ze}  ${d}${D0}`);
      }
      z = z + 1 < o.length ? z + 1 : 0, ue = ue < 4 ? ue + 0.125 : 0;
    }, i);
  }, "de"), On = /* @__PURE__ */ s((R = "", z = 0) => {
    h = !1, clearInterval(l), xt();
    let ue = z === 0 ? f.default.green(Tr) : z === 1 ? f.default.red($D) : f.default.red(OD);
    d = R ?? d, t === "timer" ? r.write(`${ue}  ${d} ${yt(g)}
`) : r.write(`${ue}  ${d}
`), M(), a();
  }, "Z");
  return { start: Dr, stop: On, message: /* @__PURE__ */ s((R = "") => {
    d = vt(R ?? d);
  }, "message"), get isCancelled() {
    return p;
  } };
}, "J"), _8 = { light: $("\u2500", "-"), heavy: $("\u2501", "="), block: $("\u2588", "#") };
var RD = /* @__PURE__ */ s((t) => {
  let e = /* @__PURE__ */ s((r, u) => {
    let n = r.label ?? String(r.value);
    switch (u) {
      case "selected":
        return `${f.default.dim(n)}`;
      case "active":
        return `${f.default.green(ii)} ${n} ${r.hint ? f.default.dim(`(${r.hint})`) : ""}`;
      case "cancelled":
        return `${f.default.strikethrough(f.default.dim(n))}`;
      default:
        return `${f.default.dim(si)} ${f.default.dim(n)}`;
    }
  }, "r");
  return new yD({ options: t.options, input: t.input, output: t.output, initialValue: t.initialValue, render() {
    let r = `${f.default.gray(y)}
${$r(this.state)}  ${t.message}
`;
    switch (this.state) {
      case "submit":
        return `${r}${f.default.gray(y)}  ${e(this.options[this.cursor], "selected")}`;
      case "cancel":
        return `${r}${f.default.gray(y)}  ${e(this.options[this.cursor], "cancelled")}
${f.default.gray(y)}`;
      default:
        return `${r}${f.default.cyan(y)}  ${ni({ output: t.output, cursor: this.cursor, options: this.options, maxItems: t.maxItems, style: /* @__PURE__ */ s(
        (u, n) => e(u, n ? "active" : "inactive"), "style") }).join(`
${f.default.cyan(y)}  `)}
${f.default.cyan(Be)}
`;
    }
  } }).prompt();
}, "qe"), I8 = `${f.default.gray(y)}  `;
var qD = /* @__PURE__ */ s((t) => {
  let e = t.output ?? process.stdout, r = xD(e), u = nt.gray(y), n = t.spacing ?? 1, o = 3, i = t.retainLog === !0, D = TD();
  e.write(`${u}
`), e.write(`${nt.green(Tr)}  ${t.title}
`);
  for (let g = 0; g < n; g++) e.write(`${u}
`);
  let a = "", l = "", h = !1, p = /* @__PURE__ */ s((g) => {
    if (a.length === 0) return;
    let F = a.split(`
`).reduce((E, b) => b === "" ? E + 1 : E + Math.ceil((b.length + o) / r), 0) + 1 + (g ? n + 2 : 0);
    e.write(_t.erase.lines(F));
  }, "g"), d = /* @__PURE__ */ s((g, F) => {
    j.message(g.split(`
`).map(nt.dim), { output: e, secondarySymbol: u, symbol: u, spacing: F ?? n });
  }, "m"), m = /* @__PURE__ */ s(() => {
    i === !0 && l.length > 0 ? d(`${l}
${a}`) : d(a);
  }, "y");
  return { message(g, F) {
    if (p(!1), (F?.raw !== !0 || !h) && a !== "" && (a += `
`), a += g, h = F?.raw === !0, t.limit !== void 0) {
      let E = a.split(`
`), b = E.length - t.limit;
      if (b > 0) {
        let B = E.splice(0, b);
        i && (l += (l === "" ? "" : `
`) + B.join(`
`));
      }
      a = E.join(`
`);
    }
    D || d(a, 0);
  }, error(g, F) {
    p(!0), j.error(g, { output: e, secondarySymbol: u, spacing: 1 }), F?.showLog !== !1 && m(), a = l = "";
  }, success(g, F) {
    p(!0), j.success(g, { output: e, secondarySymbol: u, spacing: 1 }), F?.showLog === !0 && m(), a = l = "";
  } };
}, "Ke"), ND = /* @__PURE__ */ s((t) => new BD({ validate: t.validate, placeholder: t.placeholder, defaultValue: t.defaultValue, initialValue: t.
initialValue, output: t.output, input: t.input, render() {
  let e = `${f.default.gray(y)}
${$r(this.state)}  ${t.message}
`, r = t.placeholder ? f.default.inverse(t.placeholder[0]) + f.default.dim(t.placeholder.slice(1)) : f.default.inverse(f.default.hidden("_")),
  u = this.value ? this.valueWithCursor : r;
  switch (this.state) {
    case "error":
      return `${e.trim()}
${f.default.yellow(y)}  ${u}
${f.default.yellow(Be)}  ${f.default.yellow(this.error)}
`;
    case "submit":
      return `${e}${f.default.gray(y)}  ${f.default.dim(this.value || t.placeholder)}`;
    case "cancel":
      return `${e}${f.default.gray(y)}  ${f.default.strikethrough(f.default.dim(this.value ?? ""))}${this.value?.trim() ? `
${f.default.gray(y)}` : ""}`;
    default:
      return `${e}${f.default.cyan(y)}  ${u}
${f.default.cyan(Be)}
`;
  }
} }).prompt(), "Ue");

// ../node_modules/boxen/index.js
var kt = v(require("node:process"), 1);

// ../node_modules/ansi-regex/index.js
function oi({ onlyFirst: t = !1 } = {}) {
  let r = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?(?:\\u0007|\\u001B\\u005C|\\u00\
9C))",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))"
  ].join("|");
  return new RegExp(r, t ? void 0 : "g");
}
s(oi, "ansiRegex");

// ../node_modules/strip-ansi/index.js
var pm = oi();
function Me(t) {
  if (typeof t != "string")
    throw new TypeError(`Expected a \`string\`, got \`${typeof t}\``);
  return t.replace(pm, "");
}
s(Me, "stripAnsi");

// ../node_modules/boxen/node_modules/string-width/index.js
var VD = v(ai(), 1), UD = v(li(), 1);
function J(t, e = {}) {
  if (typeof t != "string" || t.length === 0 || (e = {
    ambiguousIsNarrow: !0,
    ...e
  }, t = Me(t), t.length === 0))
    return 0;
  t = t.replace((0, UD.default)(), "  ");
  let r = e.ambiguousIsNarrow ? 1 : 2, u = 0;
  for (let n of t) {
    let o = n.codePointAt(0);
    if (o <= 31 || o >= 127 && o <= 159 || o >= 768 && o <= 879)
      continue;
    switch (VD.default.eastAsianWidth(n)) {
      case "F":
      case "W":
        u += 2;
        break;
      case "A":
        u += r;
        break;
      default:
        u += 1;
    }
  }
  return u;
}
s(J, "stringWidth");

// ../node_modules/boxen/node_modules/chalk/source/vendor/ansi-styles/index.js
var YD = /* @__PURE__ */ s((t = 0) => (e) => `\x1B[${e + t}m`, "wrapAnsi16"), HD = /* @__PURE__ */ s((t = 0) => (e) => `\x1B[${38 + t};5;${e}\
m`, "wrapAnsi256"), zD = /* @__PURE__ */ s((t = 0) => (e, r, u) => `\x1B[${38 + t};2;${e};${r};${u}m`, "wrapAnsi16m"), O = {
  modifier: {
    reset: [0, 0],
    // 21 isn't widely supported and 22 does the same thing
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29]
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    // Bright color
    blackBright: [90, 39],
    gray: [90, 39],
    // Alias of `blackBright`
    grey: [90, 39],
    // Alias of `blackBright`
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39]
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    // Bright color
    bgBlackBright: [100, 49],
    bgGray: [100, 49],
    // Alias of `bgBlackBright`
    bgGrey: [100, 49],
    // Alias of `bgBlackBright`
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49]
  }
}, H8 = Object.keys(O.modifier), mm = Object.keys(O.color), gm = Object.keys(O.bgColor), z8 = [...mm, ...gm];
function Fm() {
  let t = /* @__PURE__ */ new Map();
  for (let [e, r] of Object.entries(O)) {
    for (let [u, n] of Object.entries(r))
      O[u] = {
        open: `\x1B[${n[0]}m`,
        close: `\x1B[${n[1]}m`
      }, r[u] = O[u], t.set(n[0], n[1]);
    Object.defineProperty(O, e, {
      value: r,
      enumerable: !1
    });
  }
  return Object.defineProperty(O, "codes", {
    value: t,
    enumerable: !1
  }), O.color.close = "\x1B[39m", O.bgColor.close = "\x1B[49m", O.color.ansi = YD(), O.color.ansi256 = HD(), O.color.ansi16m = zD(), O.bgColor.
  ansi = YD(10), O.bgColor.ansi256 = HD(10), O.bgColor.ansi16m = zD(10), Object.defineProperties(O, {
    rgbToAnsi256: {
      value(e, r, u) {
        return e === r && r === u ? e < 8 ? 16 : e > 248 ? 231 : Math.round((e - 8) / 247 * 24) + 232 : 16 + 36 * Math.round(e / 255 * 5) + 6 *
        Math.round(r / 255 * 5) + Math.round(u / 255 * 5);
      },
      enumerable: !1
    },
    hexToRgb: {
      value(e) {
        let r = /[a-f\d]{6}|[a-f\d]{3}/i.exec(e.toString(16));
        if (!r)
          return [0, 0, 0];
        let [u] = r;
        u.length === 3 && (u = [...u].map((o) => o + o).join(""));
        let n = Number.parseInt(u, 16);
        return [
          /* eslint-disable no-bitwise */
          n >> 16 & 255,
          n >> 8 & 255,
          n & 255
          /* eslint-enable no-bitwise */
        ];
      },
      enumerable: !1
    },
    hexToAnsi256: {
      value: /* @__PURE__ */ s((e) => O.rgbToAnsi256(...O.hexToRgb(e)), "value"),
      enumerable: !1
    },
    ansi256ToAnsi: {
      value(e) {
        if (e < 8)
          return 30 + e;
        if (e < 16)
          return 90 + (e - 8);
        let r, u, n;
        if (e >= 232)
          r = ((e - 232) * 10 + 8) / 255, u = r, n = r;
        else {
          e -= 16;
          let D = e % 36;
          r = Math.floor(e / 36) / 5, u = Math.floor(D / 6) / 5, n = D % 6 / 5;
        }
        let o = Math.max(r, u, n) * 2;
        if (o === 0)
          return 30;
        let i = 30 + (Math.round(n) << 2 | Math.round(u) << 1 | Math.round(r));
        return o === 2 && (i += 60), i;
      },
      enumerable: !1
    },
    rgbToAnsi: {
      value: /* @__PURE__ */ s((e, r, u) => O.ansi256ToAnsi(O.rgbToAnsi256(e, r, u)), "value"),
      enumerable: !1
    },
    hexToAnsi: {
      value: /* @__PURE__ */ s((e) => O.ansi256ToAnsi(O.hexToAnsi256(e)), "value"),
      enumerable: !1
    }
  }), O;
}
s(Fm, "assembleStyles");
var Cm = Fm(), Q = Cm;

// ../node_modules/boxen/node_modules/chalk/source/vendor/supports-color/index.js
var _r = v(require("node:process"), 1), ZD = v(require("node:os"), 1), hi = v(require("node:tty"), 1);
function X(t, e = globalThis.Deno ? globalThis.Deno.args : _r.default.argv) {
  let r = t.startsWith("-") ? "" : t.length === 1 ? "-" : "--", u = e.indexOf(r + t), n = e.indexOf("--");
  return u !== -1 && (n === -1 || u < n);
}
s(X, "hasFlag");
var { env: k } = _r.default, Or;
X("no-color") || X("no-colors") || X("color=false") || X("color=never") ? Or = 0 : (X("color") || X("colors") || X("color=true") || X("color\
=always")) && (Or = 1);
function Em() {
  if ("FORCE_COLOR" in k)
    return k.FORCE_COLOR === "true" ? 1 : k.FORCE_COLOR === "false" ? 0 : k.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(k.FORCE_COLOR,
    10), 3);
}
s(Em, "envForceColor");
function bm(t) {
  return t === 0 ? !1 : {
    level: t,
    hasBasic: !0,
    has256: t >= 2,
    has16m: t >= 3
  };
}
s(bm, "translateLevel");
function xm(t, { streamIsTTY: e, sniffFlags: r = !0 } = {}) {
  let u = Em();
  u !== void 0 && (Or = u);
  let n = r ? Or : u;
  if (n === 0)
    return 0;
  if (r) {
    if (X("color=16m") || X("color=full") || X("color=truecolor"))
      return 3;
    if (X("color=256"))
      return 2;
  }
  if ("TF_BUILD" in k && "AGENT_NAME" in k)
    return 1;
  if (t && !e && n === void 0)
    return 0;
  let o = n || 0;
  if (k.TERM === "dumb")
    return o;
  if (_r.default.platform === "win32") {
    let i = ZD.default.release().split(".");
    return Number(i[0]) >= 10 && Number(i[2]) >= 10586 ? Number(i[2]) >= 14931 ? 3 : 2 : 1;
  }
  if ("CI" in k)
    return ["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((i) => i in k) ? 3 : ["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].
    some((i) => i in k) || k.CI_NAME === "codeship" ? 1 : o;
  if ("TEAMCITY_VERSION" in k)
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(k.TEAMCITY_VERSION) ? 1 : 0;
  if (k.COLORTERM === "truecolor" || k.TERM === "xterm-kitty")
    return 3;
  if ("TERM_PROGRAM" in k) {
    let i = Number.parseInt((k.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
    switch (k.TERM_PROGRAM) {
      case "iTerm.app":
        return i >= 3 ? 3 : 2;
      case "Apple_Terminal":
        return 2;
    }
  }
  return /-256(color)?$/i.test(k.TERM) ? 2 : /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(k.TERM) || "COLORTERM" in k ?
  1 : o;
}
s(xm, "_supportsColor");
function KD(t, e = {}) {
  let r = xm(t, {
    streamIsTTY: t && t.isTTY,
    ...e
  });
  return bm(r);
}
s(KD, "createSupportsColor");
var vm = {
  stdout: KD({ isTTY: hi.default.isatty(1) }),
  stderr: KD({ isTTY: hi.default.isatty(2) })
}, JD = vm;

// ../node_modules/boxen/node_modules/chalk/source/utilities.js
function XD(t, e, r) {
  let u = t.indexOf(e);
  if (u === -1)
    return t;
  let n = e.length, o = 0, i = "";
  do
    i += t.slice(o, u) + e + r, o = u + n, u = t.indexOf(e, o);
  while (u !== -1);
  return i += t.slice(o), i;
}
s(XD, "stringReplaceAll");
function QD(t, e, r, u) {
  let n = 0, o = "";
  do {
    let i = t[u - 1] === "\r";
    o += t.slice(n, i ? u - 1 : u) + e + (i ? `\r
` : `
`) + r, n = u + 1, u = t.indexOf(`
`, n);
  } while (u !== -1);
  return o += t.slice(n), o;
}
s(QD, "stringEncaseCRLFWithFirstIndex");

// ../node_modules/boxen/node_modules/chalk/source/index.js
var { stdout: ea, stderr: ta } = JD, ci = Symbol("GENERATOR"), ot = Symbol("STYLER"), It = Symbol("IS_EMPTY"), ra = [
  "ansi",
  "ansi",
  "ansi256",
  "ansi16m"
], Dt = /* @__PURE__ */ Object.create(null), ym = /* @__PURE__ */ s((t, e = {}) => {
  if (e.level && !(Number.isInteger(e.level) && e.level >= 0 && e.level <= 3))
    throw new Error("The `level` option should be an integer from 0 to 3");
  let r = ea ? ea.level : 0;
  t.level = e.level === void 0 ? r : e.level;
}, "applyOptions");
var Bm = /* @__PURE__ */ s((t) => {
  let e = /* @__PURE__ */ s((...r) => r.join(" "), "chalk");
  return ym(e, t), Object.setPrototypeOf(e, Lt.prototype), e;
}, "chalkFactory");
function Lt(t) {
  return Bm(t);
}
s(Lt, "createChalk");
Object.setPrototypeOf(Lt.prototype, Function.prototype);
for (let [t, e] of Object.entries(Q))
  Dt[t] = {
    get() {
      let r = Ir(this, fi(e.open, e.close, this[ot]), this[It]);
      return Object.defineProperty(this, t, { value: r }), r;
    }
  };
Dt.visible = {
  get() {
    let t = Ir(this, this[ot], !0);
    return Object.defineProperty(this, "visible", { value: t }), t;
  }
};
var di = /* @__PURE__ */ s((t, e, r, ...u) => t === "rgb" ? e === "ansi16m" ? Q[r].ansi16m(...u) : e === "ansi256" ? Q[r].ansi256(Q.rgbToAnsi256(
...u)) : Q[r].ansi(Q.rgbToAnsi(...u)) : t === "hex" ? di("rgb", e, r, ...Q.hexToRgb(...u)) : Q[r][t](...u), "getModelAnsi"), wm = ["rgb", "h\
ex", "ansi256"];
for (let t of wm) {
  Dt[t] = {
    get() {
      let { level: r } = this;
      return function(...u) {
        let n = fi(di(t, ra[r], "color", ...u), Q.color.close, this[ot]);
        return Ir(this, n, this[It]);
      };
    }
  };
  let e = "bg" + t[0].toUpperCase() + t.slice(1);
  Dt[e] = {
    get() {
      let { level: r } = this;
      return function(...u) {
        let n = fi(di(t, ra[r], "bgColor", ...u), Q.bgColor.close, this[ot]);
        return Ir(this, n, this[It]);
      };
    }
  };
}
var Am = Object.defineProperties(() => {
}, {
  ...Dt,
  level: {
    enumerable: !0,
    get() {
      return this[ci].level;
    },
    set(t) {
      this[ci].level = t;
    }
  }
}), fi = /* @__PURE__ */ s((t, e, r) => {
  let u, n;
  return r === void 0 ? (u = t, n = e) : (u = r.openAll + t, n = e + r.closeAll), {
    open: t,
    close: e,
    openAll: u,
    closeAll: n,
    parent: r
  };
}, "createStyler"), Ir = /* @__PURE__ */ s((t, e, r) => {
  let u = /* @__PURE__ */ s((...n) => Sm(u, n.length === 1 ? "" + n[0] : n.join(" ")), "builder");
  return Object.setPrototypeOf(u, Am), u[ci] = t, u[ot] = e, u[It] = r, u;
}, "createBuilder"), Sm = /* @__PURE__ */ s((t, e) => {
  if (t.level <= 0 || !e)
    return t[It] ? "" : e;
  let r = t[ot];
  if (r === void 0)
    return e;
  let { openAll: u, closeAll: n } = r;
  if (e.includes("\x1B"))
    for (; r !== void 0; )
      e = XD(e, r.close, r.open), r = r.parent;
  let o = e.indexOf(`
`);
  return o !== -1 && (e = QD(e, n, u, o)), u + e + n;
}, "applyStyle");
Object.defineProperties(Lt.prototype, Dt);
var Tm = Lt(), i1 = Lt({ level: ta ? ta.level : 0 });
var Re = Tm;

// ../node_modules/boxen/node_modules/widest-line/index.js
function Lr(t) {
  let e = 0;
  for (let r of t.split(`
`))
    e = Math.max(e, J(r));
  return e;
}
s(Lr, "widestLine");

// ../node_modules/boxen/index.js
var ya = v(mi(), 1);

// ../node_modules/boxen/node_modules/camelcase/index.js
var Om = /[\p{Lu}]/u, _m = /[\p{Ll}]/u, sa = /^[\p{Lu}](?![\p{Lu}])/gu, Da = /([\p{Alpha}\p{N}_]|$)/u, gi = /[_.\- ]+/, Im = new RegExp("^" +
gi.source), na = new RegExp(gi.source + Da.source, "gu"), oa = new RegExp("\\d+" + Da.source, "gu"), Lm = /* @__PURE__ */ s((t, e, r, u) => {
  let n = !1, o = !1, i = !1, D = !1;
  for (let a = 0; a < t.length; a++) {
    let l = t[a];
    D = a > 2 ? t[a - 3] === "-" : !0, n && Om.test(l) ? (t = t.slice(0, a) + "-" + t.slice(a), n = !1, i = o, o = !0, a++) : o && i && _m.test(
    l) && (!D || u) ? (t = t.slice(0, a - 1) + "-" + t.slice(a - 1), i = o, o = !1, n = !0) : (n = e(l) === l && r(l) !== l, i = o, o = r(l) ===
    l && e(l) !== l);
  }
  return t;
}, "preserveCamelCase"), km = /* @__PURE__ */ s((t, e) => (sa.lastIndex = 0, t.replace(sa, (r) => e(r))), "preserveConsecutiveUppercase"), Pm = /* @__PURE__ */ s(
(t, e) => (na.lastIndex = 0, oa.lastIndex = 0, t.replace(na, (r, u) => e(u)).replace(oa, (r) => e(r))), "postProcess");
function Fi(t, e) {
  if (!(typeof t == "string" || Array.isArray(t)))
    throw new TypeError("Expected the input to be `string | string[]`");
  if (e = {
    pascalCase: !1,
    preserveConsecutiveUppercase: !1,
    ...e
  }, Array.isArray(t) ? t = t.map((o) => o.trim()).filter((o) => o.length).join("-") : t = t.trim(), t.length === 0)
    return "";
  let r = e.locale === !1 ? (o) => o.toLowerCase() : (o) => o.toLocaleLowerCase(e.locale), u = e.locale === !1 ? (o) => o.toUpperCase() : (o) => o.
  toLocaleUpperCase(e.locale);
  return t.length === 1 ? gi.test(t) ? "" : e.pascalCase ? u(t) : r(t) : (t !== r(t) && (t = Lm(t, r, u, e.preserveConsecutiveUppercase)), t =
  t.replace(Im, ""), t = e.preserveConsecutiveUppercase ? km(t, r) : r(t), e.pascalCase && (t = u(t.charAt(0)) + t.slice(1)), Pm(t, u));
}
s(Fi, "camelCase");

// ../node_modules/boxen/index.js
var xi = v(la(), 1);

// ../node_modules/wrap-ansi/node_modules/string-width/index.js
var ha = v(ai(), 1), ca = v(li(), 1);
function Ne(t, e = {}) {
  if (typeof t != "string" || t.length === 0 || (e = {
    ambiguousIsNarrow: !0,
    ...e
  }, t = Me(t), t.length === 0))
    return 0;
  t = t.replace((0, ca.default)(), "  ");
  let r = e.ambiguousIsNarrow ? 1 : 2, u = 0;
  for (let n of t) {
    let o = n.codePointAt(0);
    if (o <= 31 || o >= 127 && o <= 159 || o >= 768 && o <= 879)
      continue;
    switch (ha.default.eastAsianWidth(n)) {
      case "F":
      case "W":
        u += 2;
        break;
      case "A":
        u += r;
        break;
      default:
        u += 1;
    }
  }
  return u;
}
s(Ne, "stringWidth");

// ../node_modules/wrap-ansi/node_modules/ansi-styles/index.js
var da = /* @__PURE__ */ s((t = 0) => (e) => `\x1B[${e + t}m`, "wrapAnsi16"), fa = /* @__PURE__ */ s((t = 0) => (e) => `\x1B[${38 + t};5;${e}\
m`, "wrapAnsi256"), pa = /* @__PURE__ */ s((t = 0) => (e, r, u) => `\x1B[${38 + t};2;${e};${r};${u}m`, "wrapAnsi16m"), _ = {
  modifier: {
    reset: [0, 0],
    // 21 isn't widely supported and 22 does the same thing
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29]
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    // Bright color
    blackBright: [90, 39],
    gray: [90, 39],
    // Alias of `blackBright`
    grey: [90, 39],
    // Alias of `blackBright`
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39]
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    // Bright color
    bgBlackBright: [100, 49],
    bgGray: [100, 49],
    // Alias of `bgBlackBright`
    bgGrey: [100, 49],
    // Alias of `bgBlackBright`
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49]
  }
}, C1 = Object.keys(_.modifier), Nm = Object.keys(_.color), jm = Object.keys(_.bgColor), E1 = [...Nm, ...jm];
function Gm() {
  let t = /* @__PURE__ */ new Map();
  for (let [e, r] of Object.entries(_)) {
    for (let [u, n] of Object.entries(r))
      _[u] = {
        open: `\x1B[${n[0]}m`,
        close: `\x1B[${n[1]}m`
      }, r[u] = _[u], t.set(n[0], n[1]);
    Object.defineProperty(_, e, {
      value: r,
      enumerable: !1
    });
  }
  return Object.defineProperty(_, "codes", {
    value: t,
    enumerable: !1
  }), _.color.close = "\x1B[39m", _.bgColor.close = "\x1B[49m", _.color.ansi = da(), _.color.ansi256 = fa(), _.color.ansi16m = pa(), _.bgColor.
  ansi = da(10), _.bgColor.ansi256 = fa(10), _.bgColor.ansi16m = pa(10), Object.defineProperties(_, {
    rgbToAnsi256: {
      value: /* @__PURE__ */ s((e, r, u) => e === r && r === u ? e < 8 ? 16 : e > 248 ? 231 : Math.round((e - 8) / 247 * 24) + 232 : 16 + 36 *
      Math.round(e / 255 * 5) + 6 * Math.round(r / 255 * 5) + Math.round(u / 255 * 5), "value"),
      enumerable: !1
    },
    hexToRgb: {
      value: /* @__PURE__ */ s((e) => {
        let r = /[a-f\d]{6}|[a-f\d]{3}/i.exec(e.toString(16));
        if (!r)
          return [0, 0, 0];
        let [u] = r;
        u.length === 3 && (u = [...u].map((o) => o + o).join(""));
        let n = Number.parseInt(u, 16);
        return [
          /* eslint-disable no-bitwise */
          n >> 16 & 255,
          n >> 8 & 255,
          n & 255
          /* eslint-enable no-bitwise */
        ];
      }, "value"),
      enumerable: !1
    },
    hexToAnsi256: {
      value: /* @__PURE__ */ s((e) => _.rgbToAnsi256(..._.hexToRgb(e)), "value"),
      enumerable: !1
    },
    ansi256ToAnsi: {
      value: /* @__PURE__ */ s((e) => {
        if (e < 8)
          return 30 + e;
        if (e < 16)
          return 90 + (e - 8);
        let r, u, n;
        if (e >= 232)
          r = ((e - 232) * 10 + 8) / 255, u = r, n = r;
        else {
          e -= 16;
          let D = e % 36;
          r = Math.floor(e / 36) / 5, u = Math.floor(D / 6) / 5, n = D % 6 / 5;
        }
        let o = Math.max(r, u, n) * 2;
        if (o === 0)
          return 30;
        let i = 30 + (Math.round(n) << 2 | Math.round(u) << 1 | Math.round(r));
        return o === 2 && (i += 60), i;
      }, "value"),
      enumerable: !1
    },
    rgbToAnsi: {
      value: /* @__PURE__ */ s((e, r, u) => _.ansi256ToAnsi(_.rgbToAnsi256(e, r, u)), "value"),
      enumerable: !1
    },
    hexToAnsi: {
      value: /* @__PURE__ */ s((e) => _.ansi256ToAnsi(_.hexToAnsi256(e)), "value"),
      enumerable: !1
    }
  }), _;
}
s(Gm, "assembleStyles");
var Wm = Gm(), ma = Wm;

// ../node_modules/wrap-ansi/index.js
var kr = /* @__PURE__ */ new Set([
  "\x1B",
  "\x9B"
]), Vm = 39, Ei = "\x07", Ca = "[", Um = "]", Ea = "m", bi = `${Um}8;;`, ga = /* @__PURE__ */ s((t) => `${kr.values().next().value}${Ca}${t}${Ea}`,
"wrapAnsiCode"), Fa = /* @__PURE__ */ s((t) => `${kr.values().next().value}${bi}${t}${Ei}`, "wrapAnsiHyperlink"), Ym = /* @__PURE__ */ s((t) => t.
split(" ").map((e) => Ne(e)), "wordLengths"), Ci = /* @__PURE__ */ s((t, e, r) => {
  let u = [...e], n = !1, o = !1, i = Ne(Me(t[t.length - 1]));
  for (let [D, a] of u.entries()) {
    let l = Ne(a);
    if (i + l <= r ? t[t.length - 1] += a : (t.push(a), i = 0), kr.has(a) && (n = !0, o = u.slice(D + 1).join("").startsWith(bi)), n) {
      o ? a === Ei && (n = !1, o = !1) : a === Ea && (n = !1);
      continue;
    }
    i += l, i === r && D < u.length - 1 && (t.push(""), i = 0);
  }
  !i && t[t.length - 1].length > 0 && t.length > 1 && (t[t.length - 2] += t.pop());
}, "wrapWord"), Hm = /* @__PURE__ */ s((t) => {
  let e = t.split(" "), r = e.length;
  for (; r > 0 && !(Ne(e[r - 1]) > 0); )
    r--;
  return r === e.length ? t : e.slice(0, r).join(" ") + e.slice(r).join("");
}, "stringVisibleTrimSpacesRight"), zm = /* @__PURE__ */ s((t, e, r = {}) => {
  if (r.trim !== !1 && t.trim() === "")
    return "";
  let u = "", n, o, i = Ym(t), D = [""];
  for (let [l, h] of t.split(" ").entries()) {
    r.trim !== !1 && (D[D.length - 1] = D[D.length - 1].trimStart());
    let p = Ne(D[D.length - 1]);
    if (l !== 0 && (p >= e && (r.wordWrap === !1 || r.trim === !1) && (D.push(""), p = 0), (p > 0 || r.trim === !1) && (D[D.length - 1] += "\
 ", p++)), r.hard && i[l] > e) {
      let d = e - p, m = 1 + Math.floor((i[l] - d - 1) / e);
      Math.floor((i[l] - 1) / e) < m && D.push(""), Ci(D, h, e);
      continue;
    }
    if (p + i[l] > e && p > 0 && i[l] > 0) {
      if (r.wordWrap === !1 && p < e) {
        Ci(D, h, e);
        continue;
      }
      D.push("");
    }
    if (p + i[l] > e && r.wordWrap === !1) {
      Ci(D, h, e);
      continue;
    }
    D[D.length - 1] += h;
  }
  r.trim !== !1 && (D = D.map((l) => Hm(l)));
  let a = [...D.join(`
`)];
  for (let [l, h] of a.entries()) {
    if (u += h, kr.has(h)) {
      let { groups: d } = new RegExp(`(?:\\${Ca}(?<code>\\d+)m|\\${bi}(?<uri>.*)${Ei})`).exec(a.slice(l).join("")) || { groups: {} };
      if (d.code !== void 0) {
        let m = Number.parseFloat(d.code);
        n = m === Vm ? void 0 : m;
      } else d.uri !== void 0 && (o = d.uri.length === 0 ? void 0 : d.uri);
    }
    let p = ma.codes.get(Number(n));
    a[l + 1] === `
` ? (o && (u += Fa("")), n && p && (u += ga(p))) : h === `
` && (n && p && (u += ga(n)), o && (u += Fa(o)));
  }
  return u;
}, "exec");
function Ae(t, e, r) {
  return String(t).normalize().replace(/\r\n/g, `
`).split(`
`).map((u) => zm(u, e, r)).join(`
`);
}
s(Ae, "wrapAnsi");

// ../node_modules/boxen/index.js
var ug = v(mi(), 1);
var Se = `
`, G = " ", Pt = "none", Ba = /* @__PURE__ */ s(() => {
  let { env: t, stdout: e, stderr: r } = kt.default;
  return e?.columns ? e.columns : r?.columns ? r.columns : t.COLUMNS ? Number.parseInt(t.COLUMNS, 10) : 80;
}, "terminalColumns"), ba = /* @__PURE__ */ s((t) => typeof t == "number" ? {
  top: t,
  right: t * 3,
  bottom: t,
  left: t * 3
} : {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  ...t
}, "getObject"), Mt = /* @__PURE__ */ s((t) => t === Pt ? 0 : 2, "getBorderWidth"), Km = /* @__PURE__ */ s((t) => {
  let e = [
    "topLeft",
    "topRight",
    "bottomRight",
    "bottomLeft",
    "left",
    "right",
    "top",
    "bottom"
  ], r;
  if (t === Pt) {
    t = {};
    for (let u of e)
      t[u] = "";
  }
  if (typeof t == "string") {
    if (r = ya.default[t], !r)
      throw new TypeError(`Invalid border style: ${t}`);
  } else {
    typeof t?.vertical == "string" && (t.left = t.vertical, t.right = t.vertical), typeof t?.horizontal == "string" && (t.top = t.horizontal,
    t.bottom = t.horizontal);
    for (let u of e)
      if (t[u] === null || typeof t[u] != "string")
        throw new TypeError(`Invalid border style: ${u}`);
    r = t;
  }
  return r;
}, "getBorderChars"), Zm = /* @__PURE__ */ s((t, e, r) => {
  let u = "", n = J(t);
  switch (r) {
    case "left": {
      u = t + e.slice(n);
      break;
    }
    case "right": {
      u = e.slice(n) + t;
      break;
    }
    default: {
      e = e.slice(n), e.length % 2 === 1 ? (e = e.slice(Math.floor(e.length / 2)), u = e.slice(1) + t + e) : (e = e.slice(e.length / 2), u =
      e + t + e);
      break;
    }
  }
  return u;
}, "makeTitle"), Jm = /* @__PURE__ */ s((t, { padding: e, width: r, textAlignment: u, height: n }) => {
  t = (0, xi.default)(t, { align: u });
  let o = t.split(Se), i = Lr(t), D = r - e.left - e.right;
  if (i > D) {
    let h = [];
    for (let p of o) {
      let d = Ae(p, D, { hard: !0 }), g = (0, xi.default)(d, { align: u }).split(`
`), F = Math.max(...g.map((E) => J(E)));
      for (let E of g) {
        let b;
        switch (u) {
          case "center": {
            b = G.repeat((D - F) / 2) + E;
            break;
          }
          case "right": {
            b = G.repeat(D - F) + E;
            break;
          }
          default: {
            b = E;
            break;
          }
        }
        h.push(b);
      }
    }
    o = h;
  }
  u === "center" && i < D ? o = o.map((h) => G.repeat((D - i) / 2) + h) : u === "right" && i < D && (o = o.map((h) => G.repeat(D - i) + h));
  let a = G.repeat(e.left), l = G.repeat(e.right);
  return o = o.map((h) => a + h + l), o = o.map((h) => {
    if (r - J(h) > 0)
      switch (u) {
        case "center":
          return h + G.repeat(r - J(h));
        case "right":
          return h + G.repeat(r - J(h));
        default:
          return h + G.repeat(r - J(h));
      }
    return h;
  }), e.top > 0 && (o = [...Array.from({ length: e.top }).fill(G.repeat(r)), ...o]), e.bottom > 0 && (o = [...o, ...Array.from({ length: e.bottom }).
  fill(G.repeat(r))]), n && o.length > n ? o = o.slice(0, n) : n && o.length < n && (o = [...o, ...Array.from({ length: n - o.length }).fill(
  G.repeat(r))]), o.join(Se);
}, "makeContentText"), Xm = /* @__PURE__ */ s((t, e, r) => {
  let u = /* @__PURE__ */ s((h) => {
    let p = r.borderColor ? tg(r.borderColor)(h) : h;
    return r.dimBorder ? Re.dim(p) : p;
  }, "colorizeBorder"), n = /* @__PURE__ */ s((h) => r.backgroundColor ? rg(r.backgroundColor)(h) : h, "colorizeContent"), o = Km(r.borderStyle),
  i = Ba(), D = G.repeat(r.margin.left);
  if (r.float === "center") {
    let h = Math.max((i - e - Mt(r.borderStyle)) / 2, 0);
    D = G.repeat(h);
  } else if (r.float === "right") {
    let h = Math.max(i - e - r.margin.right - Mt(r.borderStyle), 0);
    D = G.repeat(h);
  }
  let a = "";
  r.margin.top && (a += Se.repeat(r.margin.top)), (r.borderStyle !== Pt || r.title) && (a += u(D + o.topLeft + (r.title ? Zm(r.title, o.top.
  repeat(e), r.titleAlignment) : o.top.repeat(e)) + o.topRight) + Se);
  let l = t.split(Se);
  return a += l.map((h) => D + u(o.left) + n(h) + u(o.right)).join(Se), r.borderStyle !== Pt && (a += Se + u(D + o.bottomLeft + o.bottom.repeat(
  e) + o.bottomRight)), r.margin.bottom && (a += Se.repeat(r.margin.bottom)), a;
}, "boxContent"), Qm = /* @__PURE__ */ s((t) => {
  if (t.fullscreen && kt.default?.stdout) {
    let e = [kt.default.stdout.columns, kt.default.stdout.rows];
    typeof t.fullscreen == "function" && (e = t.fullscreen(...e)), t.width || (t.width = e[0]), t.height || (t.height = e[1]);
  }
  return t.width && (t.width = Math.max(1, t.width - Mt(t.borderStyle))), t.height && (t.height = Math.max(1, t.height - Mt(t.borderStyle))),
  t;
}, "sanitizeOptions"), xa = /* @__PURE__ */ s((t, e) => e === Pt ? t : ` ${t} `, "formatTitle"), eg = /* @__PURE__ */ s((t, e) => {
  e = Qm(e);
  let r = e.width !== void 0, u = Ba(), n = Mt(e.borderStyle), o = u - e.margin.left - e.margin.right - n, i = Lr(Ae(t, u - n, { hard: !0, trim: !1 })) +
  e.padding.left + e.padding.right;
  if (e.title && r ? (e.title = e.title.slice(0, Math.max(0, e.width - 2)), e.title && (e.title = xa(e.title, e.borderStyle))) : e.title && (e.
  title = e.title.slice(0, Math.max(0, o - 2)), e.title && (e.title = xa(e.title, e.borderStyle), J(e.title) > i && (e.width = J(e.title)))),
  e.width = e.width ? e.width : i, !r) {
    if (e.margin.left && e.margin.right && e.width > o) {
      let a = (u - e.width - n) / (e.margin.left + e.margin.right);
      e.margin.left = Math.max(0, Math.floor(e.margin.left * a)), e.margin.right = Math.max(0, Math.floor(e.margin.right * a));
    }
    e.width = Math.min(e.width, u - n - e.margin.left - e.margin.right);
  }
  return e.width - (e.padding.left + e.padding.right) <= 0 && (e.padding.left = 0, e.padding.right = 0), e.height && e.height - (e.padding.top +
  e.padding.bottom) <= 0 && (e.padding.top = 0, e.padding.bottom = 0), e;
}, "determineDimensions"), vi = /* @__PURE__ */ s((t) => t.match(/^#(?:[0-f]{3}){1,2}$/i), "isHex"), va = /* @__PURE__ */ s((t) => typeof t ==
"string" && (Re[t] ?? vi(t)), "isColorValid"), tg = /* @__PURE__ */ s((t) => vi(t) ? Re.hex(t) : Re[t], "getColorFn"), rg = /* @__PURE__ */ s(
(t) => vi(t) ? Re.bgHex(t) : Re[Fi(["bg", t])], "getBGColorFn");
function yi(t, e) {
  if (e = {
    padding: 0,
    borderStyle: "single",
    dimBorder: !1,
    textAlignment: "left",
    float: "left",
    titleAlignment: "left",
    ...e
  }, e.align && (e.textAlignment = e.align), e.borderColor && !va(e.borderColor))
    throw new Error(`${e.borderColor} is not a valid borderColor`);
  if (e.backgroundColor && !va(e.backgroundColor))
    throw new Error(`${e.backgroundColor} is not a valid backgroundColor`);
  return e.padding = ba(e.padding), e.margin = ba(e.margin), e = eg(t, e), t = Jm(t, e), Xm(t, e.width, e);
}
s(yi, "boxen");

// src/node-logger/prompts/prompt-config.ts
var ks = {};
wt(ks, {
  getPreferredStdio: () => hC,
  getPromptLibrary: () => aC,
  getPromptProvider: () => Ie,
  isClackEnabled: () => We,
  isPromptsEnabled: () => lC,
  setPromptLibrary: () => DC
});

// src/common/utils/envs.ts
var wa = /* @__PURE__ */ s((t) => {
  if (t !== void 0)
    return t.toUpperCase() === "FALSE" || t === "0" ? !1 : t.toUpperCase() === "TRUE" || t === "1" ? !0 : !!t;
}, "optionalEnvToBoolean");

// src/node-logger/logger/log-tracker.ts
var Ta = require("node:fs"), Pr = v(require("node:path"), 1), $a = require("storybook/internal/common");

// ../lib/cli-storybook/src/automigrate/helpers/cleanLog.ts
var Aa = require("node:os");
var ig = /* @__PURE__ */ s(({ onlyFirst: t = !1 } = {}) => {
  let e = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
  ].join("|");
  return new RegExp(e, t ? void 0 : "g");
}, "ansiRegex"), Sa = /* @__PURE__ */ s((t) => t.replace(ig(), "").replace(/╮│/g, `\u256E
\u2502`).replace(/││/g, `\u2502
\u2502`).replace(/│╰/g, `\u2502
\u2570`).replace(/⚠️ {2}failed to check/g, `${Aa.EOL}\u26A0\uFE0F  failed to check`), "cleanLog");

// src/node-logger/logger/log-tracker.ts
var sg = "debug-storybook.log", Bi = class {
  static {
    s(this, "LogTracker");
  }
  /** Array to store log entries */
  #u = [];
  /** Path where log file will be written */
  #t = "";
  /**
   * Flag indicating if logs should be written to file it is enabled either by users providing the
   * `--write-logs` flag to a CLI command or when we explicitly enable it by calling
   * `logTracker.enableLogWriting()` e.g. in automigrate or doctor command when there are issues
   */
  #e = !1;
  constructor() {
    this.#t = (0, Pr.join)(process.cwd(), sg);
  }
  /** Enables writing logs to file. */
  enableLogWriting() {
    this.#e = !0;
  }
  /** Returns whether logs should be written to file. */
  get shouldWriteLogsToFile() {
    return this.#e;
  }
  /** Returns the configured log file path. */
  get logFilePath() {
    return this.#t;
  }
  /** Returns a copy of all stored logs. */
  get logs() {
    return [...this.#u];
  }
  /**
   * Adds a new log entry.
   *
   * @param level - The log level
   * @param message - The log message
   * @param metadata - Optional metadata to attach to the log, can be any JSON serializable value
   */
  addLog(e, r, u) {
    this.#u.push({
      timestamp: /* @__PURE__ */ new Date(),
      level: e,
      message: Sa(r),
      metadata: u
    });
  }
  /** Clears all stored logs. */
  clear() {
    this.#u = [];
  }
  /**
   * Writes all stored logs to a file and clears the log store.
   *
   * @param filePath - Optional custom file path to write logs to
   * @returns The path where logs were written, by default is debug-storybook.log in current working
   *   directory
   */
  async writeToFile(e = this.#t) {
    let r = this.#u.map((u) => {
      let n = u.timestamp.toLocaleTimeString("en-US", { hour12: !1 }) + `.${u.timestamp.getMilliseconds().toString().padStart(3, "0")}`, o = u.
      metadata ? ` ${JSON.stringify(u.metadata)}` : "";
      return `[${n}] [${u.level.toUpperCase()}] ${u.message}${o}`;
    }).join(`
`);
    return await Ta.promises.writeFile(e, r, "utf-8"), this.#u = [], (0, $a.isCI)() ? e : Pr.default.relative(process.cwd(), e);
  }
}, x = new Bi();

// src/node-logger/prompts/prompt-provider-base.ts
var at = class {
  static {
    s(this, "PromptProvider");
  }
};

// src/node-logger/prompts/prompt-provider-clack.ts
var lt = null, Mr = class extends at {
  static {
    s(this, "ClackPromptProvider");
  }
  handleCancel(e, r) {
    Sr(e) && (r?.onCancel ? r.onCancel() : (ID("Operation canceled."), process.exit(0)));
  }
  async text(e, r) {
    let u = await ND(e);
    return this.handleCancel(u, r), x.addLog("prompt", e.message, { choice: u }), u.toString();
  }
  async confirm(e, r) {
    let u = await _D(e);
    return this.handleCancel(u, r), x.addLog("prompt", e.message, { choice: u }), !!u;
  }
  async select(e, r) {
    let u = await RD(e);
    return this.handleCancel(u, r), x.addLog("prompt", e.message, { choice: u }), u;
  }
  async multiselect(e, r) {
    let u = await PD(e);
    return this.handleCancel(u, r), x.addLog("prompt", e.message, { choice: u }), u;
  }
  spinner(e) {
    let r = MD(), u = `${e.id}-spinner`;
    return {
      start: /* @__PURE__ */ s((n) => {
        x.addLog("info", `${u}-start: ${n}`), r.start(n);
      }, "start"),
      message: /* @__PURE__ */ s((n) => {
        x.addLog("info", `${u}: ${n}`), r.message(n);
      }, "message"),
      stop: /* @__PURE__ */ s((n) => {
        x.addLog("info", `${u}-stop: ${n}`), r.stop(n);
      }, "stop")
    };
  }
  taskLog(e) {
    let r = qD(e), u = `${e.id}-task`;
    return x.addLog("info", `${u}-start: ${e.title}`), lt = r, {
      message: /* @__PURE__ */ s((n) => {
        x.addLog("info", `${u}: ${n}`), r.message(n);
      }, "message"),
      error: /* @__PURE__ */ s((n) => {
        x.addLog("error", `${u}-error: ${n}`), r.error(n, { showLog: !0 }), lt = null;
      }, "error"),
      success: /* @__PURE__ */ s((n, o) => {
        x.addLog("info", `${u}-success: ${n}`), r.success(n, o), lt = null;
      }, "success")
    };
  }
};

// src/node-logger/prompts/prompt-provider-prompts.ts
var pt = require("storybook/internal/node-logger"), Kt = v(sd(), 1);
var eu = class extends at {
  static {
    s(this, "PromptsPromptProvider");
  }
  getBaseOptions(e) {
    return {
      onCancel: /* @__PURE__ */ s(() => {
        e?.onCancel ? e.onCancel() : (pt.logger.info("Operation canceled."), process.exit(0));
      }, "onCancel")
    };
  }
  async text(e, r) {
    let u = e.validate ? (o) => {
      let i = e.validate(o);
      return i instanceof Error ? i.message : typeof i == "string" ? i : !0;
    } : void 0, n = await (0, Kt.default)(
      {
        type: "text",
        name: "value",
        message: e.message,
        initial: e.initialValue,
        validate: u
      },
      { ...this.getBaseOptions(r) }
    );
    return x.addLog("prompt", e.message, { choice: n.value }), n.value;
  }
  async confirm(e, r) {
    let u = await (0, Kt.default)(
      {
        type: "confirm",
        name: "value",
        message: e.message,
        initial: e.initialValue,
        active: e.active,
        inactive: e.inactive
      },
      { ...this.getBaseOptions(r) }
    );
    return x.addLog("prompt", e.message, { choice: u.value }), u.value;
  }
  async select(e, r) {
    let u = await (0, Kt.default)(
      {
        type: "select",
        name: "value",
        message: e.message,
        choices: e.options.map((n) => ({
          title: n.label || String(n.value),
          value: n.value,
          description: n.hint,
          selected: n.value === e.initialValue
        }))
      },
      { ...this.getBaseOptions(r) }
    );
    return x.addLog("prompt", e.message, { choice: u.value }), u.value;
  }
  async multiselect(e, r) {
    let u = await (0, Kt.default)(
      {
        type: "multiselect",
        name: "value",
        message: e.message,
        choices: e.options.map((n) => ({
          title: n.label || String(n.value),
          value: n.value,
          description: n.hint,
          selected: e.initialValues?.includes(n.value)
        })),
        min: e.required ? 1 : 0
      },
      { ...this.getBaseOptions(r) }
    );
    return x.addLog("prompt", e.message, { choice: u.value }), u.value;
  }
  spinner(e) {
    let r, u = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"], n = 0, o = `${e.id}-spi\
nner`;
    return {
      start: /* @__PURE__ */ s((i) => {
        x.addLog("info", `${o}-start: ${i}`), process.stdout.write("\x1B[?25l"), r = setInterval(() => {
          process.stdout.write(`\r${u[n]} ${i || "Loading..."}`), n = (n + 1) % u.length;
        }, 100);
      }, "start"),
      stop: /* @__PURE__ */ s((i) => {
        x.addLog("info", `${o}-stop: ${i}`), clearInterval(r), process.stdout.write("\x1B[?25h"), i ? process.stdout.write(`\r\u2713 ${i}
`) : process.stdout.write("\r\x1B[K");
      }, "stop"),
      message: /* @__PURE__ */ s((i) => {
        x.addLog("info", `${o}: ${i}`), process.stdout.write(`\r${i}`);
      }, "message")
    };
  }
  taskLog(e) {
    pt.logger.info(`${e.title}
`);
    let r = `${e.id}-task`;
    return x.addLog("info", `${r}-start: ${e.title}`), {
      message: /* @__PURE__ */ s((u) => {
        pt.logger.info(u), x.addLog("info", `${r}: ${u}`);
      }, "message"),
      success: /* @__PURE__ */ s((u) => {
        pt.logger.info(u), x.addLog("info", `${r}-success: ${u}`);
      }, "success"),
      error: /* @__PURE__ */ s((u) => {
        pt.logger.error(u), x.addLog("error", `${r}-error: ${u}`);
      }, "error")
    };
  }
};

// src/node-logger/prompts/prompt-config.ts
var oC = {
  clack: new Mr(),
  prompts: new eu()
}, Zt = wa(process.env.USE_CLACK) ? "clack" : "prompts", DC = /* @__PURE__ */ s((t) => {
  Zt = t;
}, "setPromptLibrary"), aC = /* @__PURE__ */ s(() => Zt, "getPromptLibrary"), Ie = /* @__PURE__ */ s(() => oC[Zt], "getPromptProvider"), We = /* @__PURE__ */ s(
() => Zt === "clack", "isClackEnabled"), lC = /* @__PURE__ */ s(() => Zt === "prompts", "isPromptsEnabled"), hC = /* @__PURE__ */ s(() => We() ?
"pipe" : "inherit", "getPreferredStdio");

// node_modules/execa/index.js
var Vf = require("node:buffer"), Uf = v(require("node:path"), 1), pu = v(require("node:child_process"), 1), er = v(require("node:process"), 1),
Yf = v(Hd(), 1);

// ../node_modules/strip-final-newline/index.js
function Us(t) {
  let e = typeof t == "string" ? `
` : 10, r = typeof t == "string" ? "\r" : 13;
  return t[t.length - 1] === e && (t = t.slice(0, -1)), t[t.length - 1] === r && (t = t.slice(0, -1)), t;
}
s(Us, "stripFinalNewline");

// node_modules/npm-run-path/index.js
var Jt = v(require("node:process"), 1), Ft = v(require("node:path"), 1), Ys = require("node:url");

// node_modules/path-key/index.js
function ru(t = {}) {
  let {
    env: e = process.env,
    platform: r = process.platform
  } = t;
  return r !== "win32" ? "PATH" : Object.keys(e).reverse().find((u) => u.toUpperCase() === "PATH") || "Path";
}
s(ru, "pathKey");

// node_modules/npm-run-path/index.js
var RC = /* @__PURE__ */ s(({
  cwd: t = Jt.default.cwd(),
  path: e = Jt.default.env[ru()],
  preferLocal: r = !0,
  execPath: u = Jt.default.execPath,
  addExecPath: n = !0
} = {}) => {
  let o = t instanceof URL ? (0, Ys.fileURLToPath)(t) : t, i = Ft.default.resolve(o), D = [];
  return r && qC(D, i), n && NC(D, u, i), [...D, e].join(Ft.default.delimiter);
}, "npmRunPath"), qC = /* @__PURE__ */ s((t, e) => {
  let r;
  for (; r !== e; )
    t.push(Ft.default.join(e, "node_modules/.bin")), r = e, e = Ft.default.resolve(e, "..");
}, "applyPreferLocal"), NC = /* @__PURE__ */ s((t, e, r) => {
  let u = e instanceof URL ? (0, Ys.fileURLToPath)(e) : e;
  t.push(Ft.default.resolve(r, u, ".."));
}, "applyExecPath"), zd = /* @__PURE__ */ s(({ env: t = Jt.default.env, ...e } = {}) => {
  t = { ...t };
  let r = ru({ env: t });
  return e.path = t[r], t[r] = RC(e), t;
}, "npmRunPathEnv");

// node_modules/mimic-fn/index.js
var jC = /* @__PURE__ */ s((t, e, r, u) => {
  if (r === "length" || r === "prototype" || r === "arguments" || r === "caller")
    return;
  let n = Object.getOwnPropertyDescriptor(t, r), o = Object.getOwnPropertyDescriptor(e, r);
  !GC(n, o) && u || Object.defineProperty(t, r, o);
}, "copyProperty"), GC = /* @__PURE__ */ s(function(t, e) {
  return t === void 0 || t.configurable || t.writable === e.writable && t.enumerable === e.enumerable && t.configurable === e.configurable &&
  (t.writable || t.value === e.value);
}, "canCopyProperty"), WC = /* @__PURE__ */ s((t, e) => {
  let r = Object.getPrototypeOf(e);
  r !== Object.getPrototypeOf(t) && Object.setPrototypeOf(t, r);
}, "changePrototype"), VC = /* @__PURE__ */ s((t, e) => `/* Wrapped ${t}*/
${e}`, "wrappedToString"), UC = Object.getOwnPropertyDescriptor(Function.prototype, "toString"), YC = Object.getOwnPropertyDescriptor(Function.
prototype.toString, "name"), HC = /* @__PURE__ */ s((t, e, r) => {
  let u = r === "" ? "" : `with ${r.trim()}() `, n = VC.bind(null, u, e.toString());
  Object.defineProperty(n, "name", YC), Object.defineProperty(t, "toString", { ...UC, value: n });
}, "changeToString");
function Hs(t, e, { ignoreNonConfigurable: r = !1 } = {}) {
  let { name: u } = t;
  for (let n of Reflect.ownKeys(e))
    jC(t, e, n, r);
  return WC(t, e), HC(t, e, u), t;
}
s(Hs, "mimicFunction");

// node_modules/onetime/index.js
var uu = /* @__PURE__ */ new WeakMap(), Kd = /* @__PURE__ */ s((t, e = {}) => {
  if (typeof t != "function")
    throw new TypeError("Expected a function");
  let r, u = 0, n = t.displayName || t.name || "<anonymous>", o = /* @__PURE__ */ s(function(...i) {
    if (uu.set(o, ++u), u === 1)
      r = t.apply(this, i), t = null;
    else if (e.throw === !0)
      throw new Error(`Function \`${n}\` can only be called once`);
    return r;
  }, "onetime");
  return Hs(o, t), uu.set(o, u), o;
}, "onetime");
Kd.callCount = (t) => {
  if (!uu.has(t))
    throw new Error(`The given function \`${t.name}\` is not wrapped by the \`onetime\` package`);
  return uu.get(t);
};
var Zd = Kd;

// node_modules/execa/lib/error.js
var uf = v(require("node:process"), 1);

// node_modules/human-signals/build/src/main.js
var tf = require("node:os");

// node_modules/human-signals/build/src/realtime.js
var Jd = /* @__PURE__ */ s(() => {
  let t = zs - Xd + 1;
  return Array.from({ length: t }, zC);
}, "getRealtimeSignals"), zC = /* @__PURE__ */ s((t, e) => ({
  name: `SIGRT${e + 1}`,
  number: Xd + e,
  action: "terminate",
  description: "Application-specific signal (realtime)",
  standard: "posix"
}), "getRealtimeSignal"), Xd = 34, zs = 64;

// node_modules/human-signals/build/src/signals.js
var ef = require("node:os");

// node_modules/human-signals/build/src/core.js
var Qd = [
  {
    name: "SIGHUP",
    number: 1,
    action: "terminate",
    description: "Terminal closed",
    standard: "posix"
  },
  {
    name: "SIGINT",
    number: 2,
    action: "terminate",
    description: "User interruption with CTRL-C",
    standard: "ansi"
  },
  {
    name: "SIGQUIT",
    number: 3,
    action: "core",
    description: "User interruption with CTRL-\\",
    standard: "posix"
  },
  {
    name: "SIGILL",
    number: 4,
    action: "core",
    description: "Invalid machine instruction",
    standard: "ansi"
  },
  {
    name: "SIGTRAP",
    number: 5,
    action: "core",
    description: "Debugger breakpoint",
    standard: "posix"
  },
  {
    name: "SIGABRT",
    number: 6,
    action: "core",
    description: "Aborted",
    standard: "ansi"
  },
  {
    name: "SIGIOT",
    number: 6,
    action: "core",
    description: "Aborted",
    standard: "bsd"
  },
  {
    name: "SIGBUS",
    number: 7,
    action: "core",
    description: "Bus error due to misaligned, non-existing address or paging error",
    standard: "bsd"
  },
  {
    name: "SIGEMT",
    number: 7,
    action: "terminate",
    description: "Command should be emulated but is not implemented",
    standard: "other"
  },
  {
    name: "SIGFPE",
    number: 8,
    action: "core",
    description: "Floating point arithmetic error",
    standard: "ansi"
  },
  {
    name: "SIGKILL",
    number: 9,
    action: "terminate",
    description: "Forced termination",
    standard: "posix",
    forced: !0
  },
  {
    name: "SIGUSR1",
    number: 10,
    action: "terminate",
    description: "Application-specific signal",
    standard: "posix"
  },
  {
    name: "SIGSEGV",
    number: 11,
    action: "core",
    description: "Segmentation fault",
    standard: "ansi"
  },
  {
    name: "SIGUSR2",
    number: 12,
    action: "terminate",
    description: "Application-specific signal",
    standard: "posix"
  },
  {
    name: "SIGPIPE",
    number: 13,
    action: "terminate",
    description: "Broken pipe or socket",
    standard: "posix"
  },
  {
    name: "SIGALRM",
    number: 14,
    action: "terminate",
    description: "Timeout or timer",
    standard: "posix"
  },
  {
    name: "SIGTERM",
    number: 15,
    action: "terminate",
    description: "Termination",
    standard: "ansi"
  },
  {
    name: "SIGSTKFLT",
    number: 16,
    action: "terminate",
    description: "Stack is empty or overflowed",
    standard: "other"
  },
  {
    name: "SIGCHLD",
    number: 17,
    action: "ignore",
    description: "Child process terminated, paused or unpaused",
    standard: "posix"
  },
  {
    name: "SIGCLD",
    number: 17,
    action: "ignore",
    description: "Child process terminated, paused or unpaused",
    standard: "other"
  },
  {
    name: "SIGCONT",
    number: 18,
    action: "unpause",
    description: "Unpaused",
    standard: "posix",
    forced: !0
  },
  {
    name: "SIGSTOP",
    number: 19,
    action: "pause",
    description: "Paused",
    standard: "posix",
    forced: !0
  },
  {
    name: "SIGTSTP",
    number: 20,
    action: "pause",
    description: 'Paused using CTRL-Z or "suspend"',
    standard: "posix"
  },
  {
    name: "SIGTTIN",
    number: 21,
    action: "pause",
    description: "Background process cannot read terminal input",
    standard: "posix"
  },
  {
    name: "SIGBREAK",
    number: 21,
    action: "terminate",
    description: "User interruption with CTRL-BREAK",
    standard: "other"
  },
  {
    name: "SIGTTOU",
    number: 22,
    action: "pause",
    description: "Background process cannot write to terminal output",
    standard: "posix"
  },
  {
    name: "SIGURG",
    number: 23,
    action: "ignore",
    description: "Socket received out-of-band data",
    standard: "bsd"
  },
  {
    name: "SIGXCPU",
    number: 24,
    action: "core",
    description: "Process timed out",
    standard: "bsd"
  },
  {
    name: "SIGXFSZ",
    number: 25,
    action: "core",
    description: "File too big",
    standard: "bsd"
  },
  {
    name: "SIGVTALRM",
    number: 26,
    action: "terminate",
    description: "Timeout or timer",
    standard: "bsd"
  },
  {
    name: "SIGPROF",
    number: 27,
    action: "terminate",
    description: "Timeout or timer",
    standard: "bsd"
  },
  {
    name: "SIGWINCH",
    number: 28,
    action: "ignore",
    description: "Terminal window size changed",
    standard: "bsd"
  },
  {
    name: "SIGIO",
    number: 29,
    action: "terminate",
    description: "I/O is available",
    standard: "other"
  },
  {
    name: "SIGPOLL",
    number: 29,
    action: "terminate",
    description: "Watched event",
    standard: "other"
  },
  {
    name: "SIGINFO",
    number: 29,
    action: "ignore",
    description: "Request for process information",
    standard: "other"
  },
  {
    name: "SIGPWR",
    number: 30,
    action: "terminate",
    description: "Device running out of power",
    standard: "systemv"
  },
  {
    name: "SIGSYS",
    number: 31,
    action: "core",
    description: "Invalid system call",
    standard: "other"
  },
  {
    name: "SIGUNUSED",
    number: 31,
    action: "terminate",
    description: "Invalid system call",
    standard: "other"
  }
];

// node_modules/human-signals/build/src/signals.js
var Ks = /* @__PURE__ */ s(() => {
  let t = Jd();
  return [...Qd, ...t].map(KC);
}, "getSignals"), KC = /* @__PURE__ */ s(({
  name: t,
  number: e,
  description: r,
  action: u,
  forced: n = !1,
  standard: o
}) => {
  let {
    signals: { [t]: i }
  } = ef.constants, D = i !== void 0;
  return { name: t, number: D ? i : e, description: r, supported: D, action: u, forced: n, standard: o };
}, "normalizeSignal");

// node_modules/human-signals/build/src/main.js
var ZC = /* @__PURE__ */ s(() => {
  let t = Ks();
  return Object.fromEntries(t.map(JC));
}, "getSignalsByName"), JC = /* @__PURE__ */ s(({
  name: t,
  number: e,
  description: r,
  supported: u,
  action: n,
  forced: o,
  standard: i
}) => [t, { name: t, number: e, description: r, supported: u, action: n, forced: o, standard: i }], "getSignalByName"), rf = ZC(), XC = /* @__PURE__ */ s(
() => {
  let t = Ks(), e = zs + 1, r = Array.from(
    { length: e },
    (u, n) => QC(n, t)
  );
  return Object.assign({}, ...r);
}, "getSignalsByNumber"), QC = /* @__PURE__ */ s((t, e) => {
  let r = e3(t, e);
  if (r === void 0)
    return {};
  let { name: u, description: n, supported: o, action: i, forced: D, standard: a } = r;
  return {
    [t]: {
      name: u,
      number: t,
      description: n,
      supported: o,
      action: i,
      forced: D,
      standard: a
    }
  };
}, "getSignalByNumber"), e3 = /* @__PURE__ */ s((t, e) => {
  let r = e.find(({ name: u }) => tf.constants.signals[u] === t);
  return r !== void 0 ? r : e.find((u) => u.number === t);
}, "findSignalByNumber"), ev = XC();

// node_modules/execa/lib/error.js
var t3 = /* @__PURE__ */ s(({ timedOut: t, timeout: e, errorCode: r, signal: u, signalDescription: n, exitCode: o, isCanceled: i }) => t ? `\
timed out after ${e} milliseconds` : i ? "was canceled" : r !== void 0 ? `failed with ${r}` : u !== void 0 ? `was killed with ${u} (${n})` :
o !== void 0 ? `failed with exit code ${o}` : "failed", "getErrorPrefix"), Xt = /* @__PURE__ */ s(({
  stdout: t,
  stderr: e,
  all: r,
  error: u,
  signal: n,
  exitCode: o,
  command: i,
  escapedCommand: D,
  timedOut: a,
  isCanceled: l,
  killed: h,
  parsed: { options: { timeout: p, cwd: d = uf.default.cwd() } }
}) => {
  o = o === null ? void 0 : o, n = n === null ? void 0 : n;
  let m = n === void 0 ? void 0 : rf[n].description, g = u && u.code, E = `Command ${t3({ timedOut: a, timeout: p, errorCode: g, signal: n, signalDescription: m,
  exitCode: o, isCanceled: l })}: ${i}`, b = Object.prototype.toString.call(u) === "[object Error]", B = b ? `${E}
${u.message}` : E, M = [B, e, t].filter(Boolean).join(`
`);
  return b ? (u.originalMessage = u.message, u.message = M) : u = new Error(M), u.shortMessage = B, u.command = i, u.escapedCommand = D, u.exitCode =
  o, u.signal = n, u.signalDescription = m, u.stdout = t, u.stderr = e, u.cwd = d, r !== void 0 && (u.all = r), "bufferedData" in u && delete u.
  bufferedData, u.failed = !0, u.timedOut = !!a, u.isCanceled = l, u.killed = h && !a, u;
}, "makeError");

// node_modules/execa/lib/stdio.js
var iu = ["stdin", "stdout", "stderr"], r3 = /* @__PURE__ */ s((t) => iu.some((e) => t[e] !== void 0), "hasAlias"), sf = /* @__PURE__ */ s((t) => {
  if (!t)
    return;
  let { stdio: e } = t;
  if (e === void 0)
    return iu.map((u) => t[u]);
  if (r3(t))
    throw new Error(`It's not possible to provide \`stdio\` in combination with one of ${iu.map((u) => `\`${u}\``).join(", ")}`);
  if (typeof e == "string")
    return e;
  if (!Array.isArray(e))
    throw new TypeError(`Expected \`stdio\` to be of type \`string\` or \`Array\`, got \`${typeof e}\``);
  let r = Math.max(e.length, iu.length);
  return Array.from({ length: r }, (u, n) => e[n]);
}, "normalizeStdio");

// node_modules/execa/lib/kill.js
var of = v(require("node:os"), 1);

// node_modules/signal-exit/dist/mjs/signals.js
var Ve = [];
Ve.push("SIGHUP", "SIGINT", "SIGTERM");
process.platform !== "win32" && Ve.push(
  "SIGALRM",
  "SIGABRT",
  "SIGVTALRM",
  "SIGXCPU",
  "SIGXFSZ",
  "SIGUSR2",
  "SIGTRAP",
  "SIGSYS",
  "SIGQUIT",
  "SIGIOT"
  // should detect profiler and enable/disable accordingly.
  // see #21
  // 'SIGPROF'
);
process.platform === "linux" && Ve.push("SIGIO", "SIGPOLL", "SIGPWR", "SIGSTKFLT");

// node_modules/signal-exit/dist/mjs/index.js
var su = /* @__PURE__ */ s((t) => !!t && typeof t == "object" && typeof t.removeListener == "function" && typeof t.emit == "function" && typeof t.
reallyExit == "function" && typeof t.listeners == "function" && typeof t.kill == "function" && typeof t.pid == "number" && typeof t.on == "f\
unction", "processOk"), Zs = Symbol.for("signal-exit emitter"), Js = globalThis, u3 = Object.defineProperty.bind(Object), Xs = class {
  static {
    s(this, "Emitter");
  }
  emitted = {
    afterExit: !1,
    exit: !1
  };
  listeners = {
    afterExit: [],
    exit: []
  };
  count = 0;
  id = Math.random();
  constructor() {
    if (Js[Zs])
      return Js[Zs];
    u3(Js, Zs, {
      value: this,
      writable: !1,
      enumerable: !1,
      configurable: !1
    });
  }
  on(e, r) {
    this.listeners[e].push(r);
  }
  removeListener(e, r) {
    let u = this.listeners[e], n = u.indexOf(r);
    n !== -1 && (n === 0 && u.length === 1 ? u.length = 0 : u.splice(n, 1));
  }
  emit(e, r, u) {
    if (this.emitted[e])
      return !1;
    this.emitted[e] = !0;
    let n = !1;
    for (let o of this.listeners[e])
      n = o(r, u) === !0 || n;
    return e === "exit" && (n = this.emit("afterExit", r, u) || n), n;
  }
}, nu = class {
  static {
    s(this, "SignalExitBase");
  }
}, i3 = /* @__PURE__ */ s((t) => ({
  onExit(e, r) {
    return t.onExit(e, r);
  },
  load() {
    return t.load();
  },
  unload() {
    return t.unload();
  }
}), "signalExitWrap"), Qs = class extends nu {
  static {
    s(this, "SignalExitFallback");
  }
  onExit() {
    return () => {
    };
  }
  load() {
  }
  unload() {
  }
}, en = class extends nu {
  static {
    s(this, "SignalExit");
  }
  // "SIGHUP" throws an `ENOSYS` error on Windows,
  // so use a supported signal instead
  /* c8 ignore start */
  #u = tn.platform === "win32" ? "SIGINT" : "SIGHUP";
  /* c8 ignore stop */
  #t = new Xs();
  #e;
  #s;
  #n;
  #i = {};
  #r = !1;
  constructor(e) {
    super(), this.#e = e, this.#i = {};
    for (let r of Ve)
      this.#i[r] = () => {
        let u = this.#e.listeners(r), { count: n } = this.#t, o = e;
        if (typeof o.__signal_exit_emitter__ == "object" && typeof o.__signal_exit_emitter__.count == "number" && (n += o.__signal_exit_emitter__.
        count), u.length === n) {
          this.unload();
          let i = this.#t.emit("exit", null, r), D = r === "SIGHUP" ? this.#u : r;
          i || e.kill(e.pid, D);
        }
      };
    this.#n = e.reallyExit, this.#s = e.emit;
  }
  onExit(e, r) {
    if (!su(this.#e))
      return () => {
      };
    this.#r === !1 && this.load();
    let u = r?.alwaysLast ? "afterExit" : "exit";
    return this.#t.on(u, e), () => {
      this.#t.removeListener(u, e), this.#t.listeners.exit.length === 0 && this.#t.listeners.afterExit.length === 0 && this.unload();
    };
  }
  load() {
    if (!this.#r) {
      this.#r = !0, this.#t.count += 1;
      for (let e of Ve)
        try {
          let r = this.#i[e];
          r && this.#e.on(e, r);
        } catch {
        }
      this.#e.emit = (e, ...r) => this.#D(e, ...r), this.#e.reallyExit = (e) => this.#o(e);
    }
  }
  unload() {
    this.#r && (this.#r = !1, Ve.forEach((e) => {
      let r = this.#i[e];
      if (!r)
        throw new Error("Listener not defined for signal: " + e);
      try {
        this.#e.removeListener(e, r);
      } catch {
      }
    }), this.#e.emit = this.#s, this.#e.reallyExit = this.#n, this.#t.count -= 1);
  }
  #o(e) {
    return su(this.#e) ? (this.#e.exitCode = e || 0, this.#t.emit("exit", this.#e.exitCode, null), this.#n.call(this.#e, this.#e.exitCode)) :
    0;
  }
  #D(e, ...r) {
    let u = this.#s;
    if (e === "exit" && su(this.#e)) {
      typeof r[0] == "number" && (this.#e.exitCode = r[0]);
      let n = u.call(this.#e, e, ...r);
      return this.#t.emit("exit", this.#e.exitCode, null), n;
    } else
      return u.call(this.#e, e, ...r);
  }
}, tn = globalThis.process, {
  /**
   * Called when the process is exiting, whether via signal, explicit
   * exit, or running out of stuff to do.
   *
   * If the global process object is not suitable for instrumentation,
   * then this will be a no-op.
   *
   * Returns a function that may be used to unload signal-exit.
   */
  onExit: nf,
  /**
   * Load the listeners.  Likely you never need to call this, unless
   * doing a rather deep integration with signal-exit functionality.
   * Mostly exposed for the benefit of testing.
   *
   * @internal
   */
  load: lv,
  /**
   * Unload the listeners.  Likely you never need to call this, unless
   * doing a rather deep integration with signal-exit functionality.
   * Mostly exposed for the benefit of testing.
   *
   * @internal
   */
  unload: hv
} = i3(su(tn) ? new en(tn) : new Qs());

// node_modules/execa/lib/kill.js
var s3 = 1e3 * 5, Df = /* @__PURE__ */ s((t, e = "SIGTERM", r = {}) => {
  let u = t(e);
  return n3(t, e, r, u), u;
}, "spawnedKill"), n3 = /* @__PURE__ */ s((t, e, r, u) => {
  if (!o3(e, r, u))
    return;
  let n = a3(r), o = setTimeout(() => {
    t("SIGKILL");
  }, n);
  o.unref && o.unref();
}, "setKillTimeout"), o3 = /* @__PURE__ */ s((t, { forceKillAfterTimeout: e }, r) => D3(t) && e !== !1 && r, "shouldForceKill"), D3 = /* @__PURE__ */ s(
(t) => t === of.default.constants.signals.SIGTERM || typeof t == "string" && t.toUpperCase() === "SIGTERM", "isSigterm"), a3 = /* @__PURE__ */ s(
({ forceKillAfterTimeout: t = !0 }) => {
  if (t === !0)
    return s3;
  if (!Number.isFinite(t) || t < 0)
    throw new TypeError(`Expected the \`forceKillAfterTimeout\` option to be a non-negative integer, got \`${t}\` (${typeof t})`);
  return t;
}, "getForceKillAfterTimeout"), af = /* @__PURE__ */ s((t, e) => {
  t.kill() && (e.isCanceled = !0);
}, "spawnedCancel"), l3 = /* @__PURE__ */ s((t, e, r) => {
  t.kill(e), r(Object.assign(new Error("Timed out"), { timedOut: !0, signal: e }));
}, "timeoutKill"), lf = /* @__PURE__ */ s((t, { timeout: e, killSignal: r = "SIGTERM" }, u) => {
  if (e === 0 || e === void 0)
    return u;
  let n, o = new Promise((D, a) => {
    n = setTimeout(() => {
      l3(t, r, a);
    }, e);
  }), i = u.finally(() => {
    clearTimeout(n);
  });
  return Promise.race([o, i]);
}, "setupTimeout"), hf = /* @__PURE__ */ s(({ timeout: t }) => {
  if (t !== void 0 && (!Number.isFinite(t) || t < 0))
    throw new TypeError(`Expected the \`timeout\` option to be a non-negative integer, got \`${t}\` (${typeof t})`);
}, "validateTimeout"), cf = /* @__PURE__ */ s(async (t, { cleanup: e, detached: r }, u) => {
  if (!e || r)
    return u;
  let n = nf(() => {
    t.kill();
  });
  return u.finally(() => {
    n();
  });
}, "setExitHandler");

// node_modules/execa/lib/pipe.js
var df = require("node:fs"), ff = require("node:child_process");

// node_modules/is-stream/index.js
function ou(t) {
  return t !== null && typeof t == "object" && typeof t.pipe == "function";
}
s(ou, "isStream");
function rn(t) {
  return ou(t) && t.writable !== !1 && typeof t._write == "function" && typeof t._writableState == "object";
}
s(rn, "isWritableStream");

// node_modules/execa/lib/pipe.js
var h3 = /* @__PURE__ */ s((t) => t instanceof ff.ChildProcess && typeof t.then == "function", "isExecaChildProcess"), un = /* @__PURE__ */ s(
(t, e, r) => {
  if (typeof r == "string")
    return t[e].pipe((0, df.createWriteStream)(r)), t;
  if (rn(r))
    return t[e].pipe(r), t;
  if (!h3(r))
    throw new TypeError("The second argument must be a string, a stream or an Execa child process.");
  if (!rn(r.stdin))
    throw new TypeError("The target child process's stdin must be available.");
  return t[e].pipe(r.stdin), r;
}, "pipeToTarget"), pf = /* @__PURE__ */ s((t) => {
  t.stdout !== null && (t.pipeStdout = un.bind(void 0, t, "stdout")), t.stderr !== null && (t.pipeStderr = un.bind(void 0, t, "stderr")), t.
  all !== void 0 && (t.pipeAll = un.bind(void 0, t, "all"));
}, "addPipeMethods");

// node_modules/execa/lib/stream.js
var du = require("node:fs"), Af = require("node:timers/promises");

// node_modules/get-stream/source/contents.js
var Qt = /* @__PURE__ */ s(async (t, { init: e, convertChunk: r, getSize: u, truncateChunk: n, addChunk: o, getFinalChunk: i, finalize: D }, {
maxBuffer: a = Number.POSITIVE_INFINITY } = {}) => {
  if (!d3(t))
    throw new Error("The first argument must be a Readable, a ReadableStream, or an async iterable.");
  let l = e();
  l.length = 0;
  try {
    for await (let h of t) {
      let p = f3(h), d = r[p](h, l);
      Ff({ convertedChunk: d, state: l, getSize: u, truncateChunk: n, addChunk: o, maxBuffer: a });
    }
    return c3({ state: l, convertChunk: r, getSize: u, truncateChunk: n, addChunk: o, getFinalChunk: i, maxBuffer: a }), D(l);
  } catch (h) {
    throw h.bufferedData = D(l), h;
  }
}, "getStreamContents"), c3 = /* @__PURE__ */ s(({ state: t, getSize: e, truncateChunk: r, addChunk: u, getFinalChunk: n, maxBuffer: o }) => {
  let i = n(t);
  i !== void 0 && Ff({ convertedChunk: i, state: t, getSize: e, truncateChunk: r, addChunk: u, maxBuffer: o });
}, "appendFinalChunk"), Ff = /* @__PURE__ */ s(({ convertedChunk: t, state: e, getSize: r, truncateChunk: u, addChunk: n, maxBuffer: o }) => {
  let i = r(t), D = e.length + i;
  if (D <= o) {
    mf(t, e, n, D);
    return;
  }
  let a = u(t, o - e.length);
  throw a !== void 0 && mf(a, e, n, o), new Du();
}, "appendChunk"), mf = /* @__PURE__ */ s((t, e, r, u) => {
  e.contents = r(t, e, u), e.length = u;
}, "addNewChunk"), d3 = /* @__PURE__ */ s((t) => typeof t == "object" && t !== null && typeof t[Symbol.asyncIterator] == "function", "isAsyn\
cIterable"), f3 = /* @__PURE__ */ s((t) => {
  let e = typeof t;
  if (e === "string")
    return "string";
  if (e !== "object" || t === null)
    return "others";
  if (globalThis.Buffer?.isBuffer(t))
    return "buffer";
  let r = gf.call(t);
  return r === "[object ArrayBuffer]" ? "arrayBuffer" : r === "[object DataView]" ? "dataView" : Number.isInteger(t.byteLength) && Number.isInteger(
  t.byteOffset) && gf.call(t.buffer) === "[object ArrayBuffer]" ? "typedArray" : "others";
}, "getChunkType"), { toString: gf } = Object.prototype, Du = class extends Error {
  static {
    s(this, "MaxBufferError");
  }
  name = "MaxBufferError";
  constructor() {
    super("maxBuffer exceeded");
  }
};

// node_modules/get-stream/source/utils.js
var sn = /* @__PURE__ */ s((t) => t, "identity"), nn = /* @__PURE__ */ s(() => {
}, "noop"), on = /* @__PURE__ */ s(({ contents: t }) => t, "getContentsProp"), au = /* @__PURE__ */ s((t) => {
  throw new Error(`Streams in object mode are not supported: ${String(t)}`);
}, "throwObjectStream"), lu = /* @__PURE__ */ s((t) => t.length, "getLengthProp");

// node_modules/get-stream/source/array-buffer.js
async function Dn(t, e) {
  return Qt(t, v3, e);
}
s(Dn, "getStreamAsArrayBuffer");
var p3 = /* @__PURE__ */ s(() => ({ contents: new ArrayBuffer(0) }), "initArrayBuffer"), m3 = /* @__PURE__ */ s((t) => g3.encode(t), "useTex\
tEncoder"), g3 = new TextEncoder(), Cf = /* @__PURE__ */ s((t) => new Uint8Array(t), "useUint8Array"), Ef = /* @__PURE__ */ s((t) => new Uint8Array(
t.buffer, t.byteOffset, t.byteLength), "useUint8ArrayWithOffset"), F3 = /* @__PURE__ */ s((t, e) => t.slice(0, e), "truncateArrayBufferChunk"),
C3 = /* @__PURE__ */ s((t, { contents: e, length: r }, u) => {
  let n = vf() ? b3(e, u) : E3(e, u);
  return new Uint8Array(n).set(t, r), n;
}, "addArrayBufferChunk"), E3 = /* @__PURE__ */ s((t, e) => {
  if (e <= t.byteLength)
    return t;
  let r = new ArrayBuffer(xf(e));
  return new Uint8Array(r).set(new Uint8Array(t), 0), r;
}, "resizeArrayBufferSlow"), b3 = /* @__PURE__ */ s((t, e) => {
  if (e <= t.maxByteLength)
    return t.resize(e), t;
  let r = new ArrayBuffer(e, { maxByteLength: xf(e) });
  return new Uint8Array(r).set(new Uint8Array(t), 0), r;
}, "resizeArrayBuffer"), xf = /* @__PURE__ */ s((t) => bf ** Math.ceil(Math.log(t) / Math.log(bf)), "getNewContentsLength"), bf = 2, x3 = /* @__PURE__ */ s(
({ contents: t, length: e }) => vf() ? t : t.slice(0, e), "finalizeArrayBuffer"), vf = /* @__PURE__ */ s(() => "resize" in ArrayBuffer.prototype,
"hasArrayBufferResize"), v3 = {
  init: p3,
  convertChunk: {
    string: m3,
    buffer: Cf,
    arrayBuffer: Cf,
    dataView: Ef,
    typedArray: Ef,
    others: au
  },
  getSize: lu,
  truncateChunk: F3,
  addChunk: C3,
  getFinalChunk: nn,
  finalize: x3
};

// node_modules/get-stream/source/buffer.js
async function hu(t, e) {
  if (!("Buffer" in globalThis))
    throw new Error("getStreamAsBuffer() is only supported in Node.js");
  try {
    return yf(await Dn(t, e));
  } catch (r) {
    throw r.bufferedData !== void 0 && (r.bufferedData = yf(r.bufferedData)), r;
  }
}
s(hu, "getStreamAsBuffer");
var yf = /* @__PURE__ */ s((t) => globalThis.Buffer.from(t), "arrayBufferToNodeBuffer");

// node_modules/get-stream/source/string.js
async function an(t, e) {
  return Qt(t, S3, e);
}
s(an, "getStreamAsString");
var y3 = /* @__PURE__ */ s(() => ({ contents: "", textDecoder: new TextDecoder() }), "initString"), cu = /* @__PURE__ */ s((t, { textDecoder: e }) => e.
decode(t, { stream: !0 }), "useTextDecoder"), B3 = /* @__PURE__ */ s((t, { contents: e }) => e + t, "addStringChunk"), w3 = /* @__PURE__ */ s(
(t, e) => t.slice(0, e), "truncateStringChunk"), A3 = /* @__PURE__ */ s(({ textDecoder: t }) => {
  let e = t.decode();
  return e === "" ? void 0 : e;
}, "getFinalStringChunk"), S3 = {
  init: y3,
  convertChunk: {
    string: sn,
    buffer: cu,
    arrayBuffer: cu,
    dataView: cu,
    typedArray: cu,
    others: au
  },
  getSize: lu,
  truncateChunk: w3,
  addChunk: B3,
  getFinalChunk: A3,
  finalize: on
};

// node_modules/execa/lib/stream.js
var Sf = v(wf(), 1);
var Tf = /* @__PURE__ */ s((t) => {
  if (t !== void 0)
    throw new TypeError("The `input` and `inputFile` options cannot be both set.");
}, "validateInputOptions"), $3 = /* @__PURE__ */ s(({ input: t, inputFile: e }) => typeof e != "string" ? t : (Tf(t), (0, du.readFileSync)(e)),
"getInputSync"), $f = /* @__PURE__ */ s((t) => {
  let e = $3(t);
  if (ou(e))
    throw new TypeError("The `input` option cannot be a stream in sync mode");
  return e;
}, "handleInputSync"), O3 = /* @__PURE__ */ s(({ input: t, inputFile: e }) => typeof e != "string" ? t : (Tf(t), (0, du.createReadStream)(e)),
"getInput"), Of = /* @__PURE__ */ s((t, e) => {
  let r = O3(e);
  r !== void 0 && (ou(r) ? r.pipe(t.stdin) : t.stdin.end(r));
}, "handleInput"), _f = /* @__PURE__ */ s((t, { all: e }) => {
  if (!e || !t.stdout && !t.stderr)
    return;
  let r = (0, Sf.default)();
  return t.stdout && r.add(t.stdout), t.stderr && r.add(t.stderr), r;
}, "makeAllStream"), ln = /* @__PURE__ */ s(async (t, e) => {
  if (!(!t || e === void 0)) {
    await (0, Af.setTimeout)(0), t.destroy();
    try {
      return await e;
    } catch (r) {
      return r.bufferedData;
    }
  }
}, "getBufferedData"), hn = /* @__PURE__ */ s((t, { encoding: e, buffer: r, maxBuffer: u }) => {
  if (!(!t || !r))
    return e === "utf8" || e === "utf-8" ? an(t, { maxBuffer: u }) : e === null || e === "buffer" ? hu(t, { maxBuffer: u }) : _3(t, u, e);
}, "getStreamPromise"), _3 = /* @__PURE__ */ s(async (t, e, r) => (await hu(t, { maxBuffer: e })).toString(r), "applyEncoding"), If = /* @__PURE__ */ s(
async ({ stdout: t, stderr: e, all: r }, { encoding: u, buffer: n, maxBuffer: o }, i) => {
  let D = hn(t, { encoding: u, buffer: n, maxBuffer: o }), a = hn(e, { encoding: u, buffer: n, maxBuffer: o }), l = hn(r, { encoding: u, buffer: n,
  maxBuffer: o * 2 });
  try {
    return await Promise.all([i, D, a, l]);
  } catch (h) {
    return Promise.all([
      { error: h, signal: h.signal, timedOut: h.timedOut },
      ln(t, D),
      ln(e, a),
      ln(r, l)
    ]);
  }
}, "getSpawnedResult");

// node_modules/execa/lib/promise.js
var I3 = (async () => {
})().constructor.prototype, L3 = ["then", "catch", "finally"].map((t) => [
  t,
  Reflect.getOwnPropertyDescriptor(I3, t)
]), cn = /* @__PURE__ */ s((t, e) => {
  for (let [r, u] of L3) {
    let n = typeof e == "function" ? (...o) => Reflect.apply(u.value, e(), o) : u.value.bind(e);
    Reflect.defineProperty(t, r, { ...u, value: n });
  }
}, "mergePromise"), Lf = /* @__PURE__ */ s((t) => new Promise((e, r) => {
  t.on("exit", (u, n) => {
    e({ exitCode: u, signal: n });
  }), t.on("error", (u) => {
    r(u);
  }), t.stdin && t.stdin.on("error", (u) => {
    r(u);
  });
}), "getSpawnedPromise");

// node_modules/execa/lib/command.js
var Mf = require("node:buffer"), Rf = require("node:child_process");
var qf = /* @__PURE__ */ s((t, e = []) => Array.isArray(e) ? [t, ...e] : [t], "normalizeArgs"), k3 = /^[\w.-]+$/, P3 = /* @__PURE__ */ s((t) => typeof t !=
"string" || k3.test(t) ? t : `"${t.replaceAll('"', '\\"')}"`, "escapeArg"), dn = /* @__PURE__ */ s((t, e) => qf(t, e).join(" "), "joinComman\
d"), fn = /* @__PURE__ */ s((t, e) => qf(t, e).map((r) => P3(r)).join(" "), "getEscapedCommand"), M3 = / +/g;
var kf = /* @__PURE__ */ s((t) => {
  let e = typeof t;
  if (e === "string")
    return t;
  if (e === "number")
    return String(t);
  if (e === "object" && t !== null && !(t instanceof Rf.ChildProcess) && "stdout" in t) {
    let r = typeof t.stdout;
    if (r === "string")
      return t.stdout;
    if (Mf.Buffer.isBuffer(t.stdout))
      return t.stdout.toString();
    throw new TypeError(`Unexpected "${r}" stdout in template expression`);
  }
  throw new TypeError(`Unexpected "${e}" in template expression`);
}, "parseExpression"), Pf = /* @__PURE__ */ s((t, e, r) => r || t.length === 0 || e.length === 0 ? [...t, ...e] : [
  ...t.slice(0, -1),
  `${t.at(-1)}${e[0]}`,
  ...e.slice(1)
], "concatTokens"), R3 = /* @__PURE__ */ s(({ templates: t, expressions: e, tokens: r, index: u, template: n }) => {
  let o = n ?? t.raw[u], i = o.split(M3).filter(Boolean), D = Pf(
    r,
    i,
    o.startsWith(" ")
  );
  if (u === e.length)
    return D;
  let a = e[u], l = Array.isArray(a) ? a.map((h) => kf(h)) : [kf(a)];
  return Pf(
    D,
    l,
    o.endsWith(" ")
  );
}, "parseTemplate"), pn = /* @__PURE__ */ s((t, e) => {
  let r = [];
  for (let [u, n] of t.entries())
    r = R3({ templates: t, expressions: e, tokens: r, index: u, template: n });
  return r;
}, "parseTemplates");

// node_modules/execa/lib/verbose.js
var Nf = require("node:util"), jf = v(require("node:process"), 1);
var Gf = (0, Nf.debuglog)("execa").enabled, fu = /* @__PURE__ */ s((t, e) => String(t).padStart(e, "0"), "padField"), q3 = /* @__PURE__ */ s(
() => {
  let t = /* @__PURE__ */ new Date();
  return `${fu(t.getHours(), 2)}:${fu(t.getMinutes(), 2)}:${fu(t.getSeconds(), 2)}.${fu(t.getMilliseconds(), 3)}`;
}, "getTimestamp"), mn = /* @__PURE__ */ s((t, { verbose: e }) => {
  e && jf.default.stderr.write(`[${q3()}] ${t}
`);
}, "logCommand");

// node_modules/execa/index.js
var N3 = 1e3 * 1e3 * 100, j3 = /* @__PURE__ */ s(({ env: t, extendEnv: e, preferLocal: r, localDir: u, execPath: n }) => {
  let o = e ? { ...er.default.env, ...t } : t;
  return r ? zd({ env: o, cwd: u, execPath: n }) : o;
}, "getEnv"), Hf = /* @__PURE__ */ s((t, e, r = {}) => {
  let u = Yf.default._parse(t, e, r);
  return t = u.command, e = u.args, r = u.options, r = {
    maxBuffer: N3,
    buffer: !0,
    stripFinalNewline: !0,
    extendEnv: !0,
    preferLocal: !1,
    localDir: r.cwd || er.default.cwd(),
    execPath: er.default.execPath,
    encoding: "utf8",
    reject: !0,
    cleanup: !0,
    all: !1,
    windowsHide: !0,
    verbose: Gf,
    ...r
  }, r.env = j3(r), r.stdio = sf(r), er.default.platform === "win32" && Uf.default.basename(t, ".exe") === "cmd" && e.unshift("/q"), { file: t,
  args: e, options: r, parsed: u };
}, "handleArguments"), tr = /* @__PURE__ */ s((t, e, r) => typeof e != "string" && !Vf.Buffer.isBuffer(e) ? r === void 0 ? void 0 : "" : t.stripFinalNewline ?
Us(e) : e, "handleOutput");
function G3(t, e, r) {
  let u = Hf(t, e, r), n = dn(t, e), o = fn(t, e);
  mn(o, u.options), hf(u.options);
  let i;
  try {
    i = pu.default.spawn(u.file, u.args, u.options);
  } catch (m) {
    let g = new pu.default.ChildProcess(), F = Promise.reject(Xt({
      error: m,
      stdout: "",
      stderr: "",
      all: "",
      command: n,
      escapedCommand: o,
      parsed: u,
      timedOut: !1,
      isCanceled: !1,
      killed: !1
    }));
    return cn(g, F), g;
  }
  let D = Lf(i), a = lf(i, u.options, D), l = cf(i, u.options, a), h = { isCanceled: !1 };
  i.kill = Df.bind(null, i.kill.bind(i)), i.cancel = af.bind(null, i, h);
  let d = Zd(/* @__PURE__ */ s(async () => {
    let [{ error: m, exitCode: g, signal: F, timedOut: E }, b, B, M] = await If(i, u.options, l), xt = tr(u.options, b), vt = tr(u.options, B),
    yt = tr(u.options, M);
    if (m || g !== 0 || F !== null) {
      let Dr = Xt({
        error: m,
        exitCode: g,
        signal: F,
        stdout: xt,
        stderr: vt,
        all: yt,
        command: n,
        escapedCommand: o,
        parsed: u,
        timedOut: E,
        isCanceled: h.isCanceled || (u.options.signal ? u.options.signal.aborted : !1),
        killed: i.killed
      });
      if (!u.options.reject)
        return Dr;
      throw Dr;
    }
    return {
      command: n,
      escapedCommand: o,
      exitCode: 0,
      stdout: xt,
      stderr: vt,
      all: yt,
      failed: !1,
      timedOut: !1,
      isCanceled: !1,
      killed: !1
    };
  }, "handlePromise"));
  return Of(i, u.options), i.all = _f(i, u.options), pf(i), cn(i, d), i;
}
s(G3, "execa");
function gn(t, e, r) {
  let u = Hf(t, e, r), n = dn(t, e), o = fn(t, e);
  mn(o, u.options);
  let i = $f(u.options), D;
  try {
    D = pu.default.spawnSync(u.file, u.args, { ...u.options, input: i });
  } catch (h) {
    throw Xt({
      error: h,
      stdout: "",
      stderr: "",
      all: "",
      command: n,
      escapedCommand: o,
      parsed: u,
      timedOut: !1,
      isCanceled: !1,
      killed: !1
    });
  }
  let a = tr(u.options, D.stdout, D.error), l = tr(u.options, D.stderr, D.error);
  if (D.error || D.status !== 0 || D.signal !== null) {
    let h = Xt({
      stdout: a,
      stderr: l,
      error: D.error,
      signal: D.signal,
      exitCode: D.status,
      command: n,
      escapedCommand: o,
      parsed: u,
      timedOut: D.error && D.error.code === "ETIMEDOUT",
      isCanceled: !1,
      killed: D.signal !== null
    });
    if (!u.options.reject)
      return h;
    throw h;
  }
  return {
    command: n,
    escapedCommand: o,
    exitCode: 0,
    stdout: a,
    stderr: l,
    failed: !1,
    timedOut: !1,
    isCanceled: !1,
    killed: !1
  };
}
s(gn, "execaSync");
var W3 = /* @__PURE__ */ s(({ input: t, inputFile: e, stdio: r }) => t === void 0 && e === void 0 && r === void 0 ? { stdin: "inherit" } : {},
"normalizeScriptStdin"), Wf = /* @__PURE__ */ s((t = {}) => ({
  preferLocal: !0,
  ...W3(t),
  ...t
}), "normalizeScriptOptions");
function zf(t) {
  function e(r, ...u) {
    if (!Array.isArray(r))
      return zf({ ...t, ...r });
    let [n, ...o] = pn(r, u);
    return G3(n, o, Wf(t));
  }
  return s(e, "$"), e.sync = (r, ...u) => {
    if (!Array.isArray(r))
      throw new TypeError("Please use $(options).sync`command` instead of $.sync(options)`command`.");
    let [n, ...o] = pn(r, u);
    return gn(n, o, Wf(t));
  }, e;
}
s(zf, "create$");
var Cy = zf();

// src/node-logger/wrap-utils.ts
var Ce = v(rt(), 1);
function gu() {
  try {
    return process.stdout.columns || 80;
  } catch {
    return 80;
  }
}
s(gu, "getTerminalWidth");
var V3 = /\u001b\[[0-9;]*m|\u001b\]8;;[^\u0007]*\u0007|\u001b\]8;;\u0007/g, Fn = /(https?:\/\/[^\s\u0000-\u001F\u007F]+)/g;
function U3(t) {
  return t.replace(V3, "");
}
s(U3, "stripAnsi");
function mu(t) {
  return U3(t).length;
}
s(mu, "getVisibleLength");
function Kf(t) {
  return gn("echo", [`$${t}`], { shell: !0 }).stdout.trim();
}
s(Kf, "getEnvFromTerminal");
function Zf() {
  try {
    let t = Kf("TERM_PROGRAM"), e = Kf("TERM_PROGRAM_VERSION");
    switch (t) {
      case "iTerm.app":
        if (e.trim()) {
          let r = e.trim().split(".").map(Number);
          return r[0] > 3 || r[0] === 3 && r[1] >= 1;
        }
        return !0;
      // Assume recent version
      case "Apple_Terminal":
        return !1;
      default:
        return !0;
    }
  } catch {
    return !1;
  }
}
s(Zf, "supportsHyperlinks");
function rr(t, e) {
  let r = Math.floor(gu() * 0.8), u = e?.maxLineWidth ?? gu(), n = Zf();
  return t.replace(Fn, (o, i, D) => {
    if (!n)
      return o;
    let a = 0;
    for (; ; ) {
      let b = t.indexOf("\x1B]8;;", a);
      if (b === -1)
        break;
      let B = t.indexOf("\x1B]8;;\x07", b);
      if (B === -1) {
        a = b + 1;
        continue;
      }
      if (D >= b && D < B + 7)
        return o;
      a = B + 1;
    }
    let l = t.substring(0, D), h = l.lastIndexOf(`
`), p = h === -1 ? l : l.substring(h + 1), d = mu(p), m = u - d, g = 20, F = e?.maxUrlLength ?? r, E = Math.min(F, r, m);
    if ((i.length <= g || E < g) && (E = i.length), i.length > E) {
      let b = i.substring(0, E - 3) + "...";
      return `\x1B]8;;${i}\x07${b}\x1B]8;;\x07`;
    }
    return `\x1B]8;;${i}\x07${i}\x1B]8;;\x07`;
  });
}
s(rr, "protectUrls");
function Jf(t, e) {
  return Zf() ? `\x1B]8;;${e}\x07${t}\x1B]8;;\x07` : `${t}: ${e}`;
}
s(Jf, "createHyperlink");
function Y3(t) {
  let e = [], r = 0, u;
  for (Fn.lastIndex = 0; (u = Fn.exec(t)) !== null; ) {
    if (u.index > r) {
      let n = t.slice(r, u.index);
      e.push(...n.split(" ").filter((o) => o.length > 0));
    }
    e.push(u[0]), r = u.index + u[0].length;
  }
  if (r < t.length) {
    let n = t.slice(r);
    e.push(...n.split(" ").filter((o) => o.length > 0));
  }
  return e;
}
s(Y3, "splitTextPreservingUrls");
var Xf = 80;
function Qf(t) {
  return Math.min(t, Xf);
}
s(Qf, "getOptimalWidth");
function ur(t, e) {
  let r = e || gu(), u = Math.max(r - 10, 40), n = Qf(u), o = rr(t, { maxLineWidth: n });
  return Ae(o, n);
}
s(ur, "wrapTextForClack");
function e0(t, e, r) {
  let u = e || gu(), o = 8 + (r ? mu(r) : 0), i = Math.min(
    Xf - o,
    Math.max(u - o, 30)
  ), D = 4, a = Qf(Math.max(u - D, 30)), l = rr(t, { maxLineWidth: a }), h = Ae(l, a), p = h.split(`
`);
  if (p.length > 0 && mu(p[0]) > i) {
    let m = Y3(t), g = "", F = "";
    for (let B = 0; B < m.length; B++) {
      let M = B === 0 ? m[B] : g + " " + m[B];
      if (mu(M) <= i)
        g = M;
      else {
        F = m.slice(B).join(" ");
        break;
      }
    }
    !g && m.length > 0 && (g = m[0], F = m.slice(1).join(" "));
    let E = [g];
    if (F.trim()) {
      let B = rr(F.trim(), {
        maxLineWidth: a
      }), M = Ae(B, a);
      E = E.concat(M.split(`
`));
    }
    if (E.length <= 1)
      return E[0] || "";
    let b = (0, Ce.reset)((0, Ce.cyan)(y)) + " ".repeat(D);
    return E.map((B, M) => M === 0 ? B : `${b}${(0, Ce.dim)(B)}`).join(`
`);
  }
  if (p.length <= 1)
    return h;
  let d = (0, Ce.reset)((0, Ce.cyan)(y)) + " ".repeat(D);
  return p.map((m, g) => g === 0 ? m : `${d}${(0, Ce.dim)(m)}`).join(`
`);
}
s(e0, "wrapTextForClackHint");

// src/node-logger/logger/colors.ts
var Ue = v(rt(), 1), ir = {
  success: Ue.default.green,
  error: Ue.default.red,
  warning: Ue.default.yellow,
  info: Ue.default.blue,
  debug: Ue.default.gray,
  // Only color a link if it is the primary call to action, otherwise links shouldn't be colored
  cta: Ue.default.cyan
};

// src/node-logger/logger/logger.ts
var Ye = /* @__PURE__ */ s((t, e) => () => We() ? (r) => {
  lt ? lt.message(r) : t(ur(r));
} : e, "createLogFunction"), Le = {
  log: Ye(j.message, console.log),
  info: Ye(j.info, console.log),
  warn: Ye(j.warn, console.warn),
  error: Ye(j.error, console.error),
  intro: Ye(LD, console.log),
  outro: Ye(kD, console.log),
  step: Ye(j.step, console.log)
}, t0 = {
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  silent: 10
}, Cn = "info", En = /* @__PURE__ */ s((t) => {
  Cn = t;
}, "setLogLevel"), H3 = /* @__PURE__ */ s(() => Cn, "getLogLevel"), Fu = /* @__PURE__ */ s((t) => t0[Cn] <= t0[t], "shouldLog");
function z3() {
  let t = new Error().stack;
  if (!t)
    return;
  let r = t.split(`
`).slice(1).filter(
    (n) => !["getMinimalTrace", "createLogger", "logFunction"].some((o) => n.includes(o))
  );
  return r.length === 0 ? void 0 : `
` + r.slice(0, 2).join(`
`);
}
s(z3, "getMinimalTrace");
var K3 = /* @__PURE__ */ s((t) => t.map((e) => typeof e == "string" ? e : typeof e == "object" ? JSON.stringify(e, null, 2) : String(e)).join(
" "), "formatLogMessage");
function sr(t, e, r) {
  return /* @__PURE__ */ s(function(...n) {
    let o = K3(n);
    if (x.addLog(t, o), t === "prompt" && (t = "info"), Fu(t)) {
      let i = r ? `${r} ${o}` : o;
      e(i);
    }
  }, "logFunction");
}
s(sr, "createLogger");
var Cu = sr(
  "debug",
  /* @__PURE__ */ s(function(e) {
    Fu("trace") && (e += z3()), Le.log()(e);
  }, "logFunction"),
  "[DEBUG]"
), Ct = sr("info", (...t) => Le.log()(...t)), bn = sr("info", (...t) => Le.info()(...t)), xn = sr("warn", (...t) => Le.warn()(...t)), vn = sr(
"error", (...t) => Le.error()(...t)), Z3 = /* @__PURE__ */ s((t, e) => {
  Fu("info") && (x.addLog("info", t), We() ? (e?.title && Ct(e.title), Ct(t)) : console.log(
    yi(t, {
      borderStyle: "round",
      padding: 1,
      borderColor: "#F1618C",
      // pink
      ...e
    })
  ));
}, "logBox"), J3 = /* @__PURE__ */ s((t) => {
  x.addLog("info", t), console.log(`
`), Le.intro()(t);
}, "intro"), X3 = /* @__PURE__ */ s((t) => {
  x.addLog("info", t), Le.outro()(t), console.log(`
`);
}, "outro"), Q3 = /* @__PURE__ */ s((t) => {
  x.addLog("info", t), Le.step()(t);
}, "step"), eE = {
  success: ir.success("\u2714"),
  error: ir.error("\u2715")
};

// src/node-logger/prompts/prompt-functions.ts
var Sn = {};
wt(Sn, {
  confirm: () => rE,
  multiselect: () => iE,
  select: () => uE,
  spinner: () => wn,
  taskLog: () => An,
  text: () => tE
});
var nr = null, Et = null, bt = null, r0 = /* @__PURE__ */ s(() => {
  bt || (bt = console.log, console.log = (...t) => {
    let e = t.map((r) => typeof r == "string" ? r : JSON.stringify(r)).join(" ");
    Et ? Et.message(e) : nr ? nr.message(e) : bt(...t);
  });
}, "patchConsoleLog"), Bn = /* @__PURE__ */ s(() => {
  bt && !nr && !Et && (console.log = bt, bt = null);
}, "restoreConsoleLog"), tE = /* @__PURE__ */ s(async (t, e) => Ie().text(t, e), "text"), rE = /* @__PURE__ */ s(async (t, e) => Ie().confirm(
t, e), "confirm"), uE = /* @__PURE__ */ s(async (t, e) => Ie().select(t, e), "select"), iE = /* @__PURE__ */ s(async (t, e) => Ie().multiselect(
  {
    ...t,
    options: t.options.map((r) => ({
      ...r,
      hint: r.hint ? e0(r.hint, void 0, r.label || String(r.value)) : void 0
    }))
  },
  e
), "multiselect"), wn = /* @__PURE__ */ s((t) => {
  let e = Ie().spinner(t), r = {
    start: /* @__PURE__ */ s((u) => {
      nr = r, r0(), e.start(u);
    }, "start"),
    stop: /* @__PURE__ */ s((u) => {
      nr = null, Bn(), e.stop(u);
    }, "stop"),
    message: /* @__PURE__ */ s((u) => {
      e.message(u);
    }, "message")
  };
  return r;
}, "spinner"), An = /* @__PURE__ */ s((t) => {
  let e = Ie().taskLog(t), r = {
    message: /* @__PURE__ */ s((u) => {
      e.message(ur(u));
    }, "message"),
    success: /* @__PURE__ */ s((u, n) => {
      Et = null, Bn(), e.success(u, n);
    }, "success"),
    error: /* @__PURE__ */ s((u) => {
      Et = null, Bn(), e.error(u);
    }, "error")
  };
  return Et = r, r0(), r;
}, "taskLog");

// src/node-logger/tasks.ts
var u0 = /* @__PURE__ */ s(async (t, {
  id: e,
  intro: r,
  error: u,
  success: n,
  limitLines: o = 4
}) => {
  x.addLog("info", r);
  let i = An({
    id: e,
    title: r,
    retainLog: !1,
    limit: o
  }), D = Array.isArray(t) ? t : [t];
  try {
    for (let a of D) {
      let l = a();
      l.stdout?.on("data", (h) => {
        let p = h.toString().trim();
        x.addLog("info", p), i.message(p);
      }), await l;
    }
    x.addLog("info", n), i.success(n);
  } catch (a) {
    let l = a instanceof Error ? a.stack ?? a.message : String(a);
    throw x.addLog("error", u, { error: l }), i.error(u), a;
  }
}, "executeTask"), i0 = /* @__PURE__ */ s(async (t, { id: e, intro: r, error: u, success: n }) => {
  x.addLog("info", r);
  let o = wn({ id: e });
  o.start(r);
  let i = Array.isArray(t) ? t : [t];
  try {
    for (let D of i) {
      let a = D();
      a.stdout?.on("data", (l) => {
        let h = l.toString().trim().slice(0, 25);
        x.addLog("info", `${r}: ${l.toString()}`), o.message(`${r}: ${h}`);
      }), await a;
    }
    x.addLog("info", n), o.stop(n);
  } catch (D) {
    throw x.addLog("error", u, { error: D }), o.stop(u), D;
  }
}, "executeTaskWithSpinner");

// src/node-logger/prompts/index.ts
var s0 = {
  ...Sn,
  ...ks,
  executeTask: u0,
  executeTaskWithSpinner: i0
};

// src/node-logger/index.ts
or.default.stream = process.stdout;
function He(t) {
  if (!/^#?[0-9A-Fa-f]{6}$/.test(t))
    throw new Error("Invalid hex color. It must be a 6-character hex code.");
  t.startsWith("#") && (t = t.slice(1));
  let e = parseInt(t.slice(0, 2), 16), r = parseInt(t.slice(2, 4), 16), u = parseInt(t.slice(4, 6), 16);
  return (n) => `\x1B[38;2;${e};${r};${u}m${n}\x1B[39m`;
}
s(He, "hex");
var Tn = {
  pink: He("#F1618C"),
  purple: He("#B57EE5"),
  orange: He("#F3AD38"),
  green: He("#A2E05E"),
  blue: He("#6DABF5"),
  red: He("#F16161"),
  gray: He("#B8C2CC")
}, o0 = {
  ...yn,
  verbose: /* @__PURE__ */ s((t) => Cu(t), "verbose"),
  info: /* @__PURE__ */ s((t) => We() ? bn(t) : or.default.info("", t), "info"),
  plain: /* @__PURE__ */ s((t) => Ct(t), "plain"),
  line: /* @__PURE__ */ s((t = 1) => Ct(`${Array(t - 1).fill(`
`)}`), "line"),
  warn: /* @__PURE__ */ s((t) => xn(t), "warn"),
  trace: /* @__PURE__ */ s(({ message: t, time: e }) => Cu(`${t} (${Tn.purple((0, n0.default)(e))})`), "trace"),
  setLevel: /* @__PURE__ */ s((t = "info") => {
    or.default.level = t, En(t);
  }, "setLevel"),
  error: /* @__PURE__ */ s((t) => {
    let e;
    t instanceof Error && t.stack ? e = t.stack.toString() : e = t.toString(), vn(
      e.replace(t.toString(), Tn.red(t.toString())).replaceAll(process.cwd(), ".")
    );
  }, "error")
};
var $n = /* @__PURE__ */ new Set(), re = /* @__PURE__ */ s((t) => (e) => {
  if (!$n.has(e))
    return $n.add(e), o0[t](e);
}, "once");
re.clear = () => $n.clear();
re.verbose = re("verbose");
re.info = re("info");
re.warn = re("warn");
re.error = re("error");
var sE = re("warn");
