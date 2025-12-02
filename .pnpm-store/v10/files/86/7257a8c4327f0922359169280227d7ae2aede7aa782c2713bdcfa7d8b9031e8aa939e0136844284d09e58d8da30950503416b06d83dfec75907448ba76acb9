"use strict";
var c = Object.defineProperty;
var a = Object.getOwnPropertyDescriptor;
var e = Object.getOwnPropertyNames;
var p = Object.prototype.hasOwnProperty;
var x = (t, o) => {
  for (var n in o)
    c(t, n, { get: o[n], enumerable: !0 });
}, A = (t, o, n, r) => {
  if (o && typeof o == "object" || typeof o == "function")
    for (let s of e(o))
      !p.call(t, s) && s !== n && c(t, s, { get: () => o[s], enumerable: !(r = a(o, s)) || r.enumerable });
  return t;
};
var D = (t) => A(c({}, "__esModule", { value: !0 }), t);

// src/controls/index.ts
var _ = {};
x(_, {
  ADDON_ID: () => d,
  PARAM_KEY: () => l
});
module.exports = D(_);

// src/controls/constants.ts
var d = "addon-controls", l = "controls";
