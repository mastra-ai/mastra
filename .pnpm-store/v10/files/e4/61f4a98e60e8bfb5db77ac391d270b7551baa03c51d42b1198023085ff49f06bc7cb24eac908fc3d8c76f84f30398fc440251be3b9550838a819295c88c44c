"use strict";
var d = Object.defineProperty;
var y = Object.getOwnPropertyDescriptor;
var i = Object.getOwnPropertyNames;
var s = Object.prototype.hasOwnProperty;
var A = (r, e) => {
  for (var n in e)
    d(r, n, { get: e[n], enumerable: !0 });
}, _ = (r, e, n, a) => {
  if (e && typeof e == "object" || typeof e == "function")
    for (let o of i(e))
      !s.call(r, o) && o !== n && d(r, o, { get: () => e[o], enumerable: !(a = y(e, o)) || a.enumerable });
  return r;
};
var T = (r) => _(d({}, "__esModule", { value: !0 }), r);

// src/types/index.ts
var m = {};
A(m, {
  Addon_TypesEnum: () => p
});
module.exports = T(m);

// src/types/modules/addons.ts
var p = /* @__PURE__ */ ((t) => (t.TAB = "tab", t.PANEL = "panel", t.TOOL = "tool", t.TOOLEXTRA = "toolextra", t.PREVIEW = "preview", t.experimental_PAGE =
"page", t.experimental_TEST_PROVIDER = "test-provider", t))(p || {});
