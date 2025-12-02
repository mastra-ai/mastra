"use strict";
var r = Object.defineProperty;
var i = Object.getOwnPropertyDescriptor;
var n = Object.getOwnPropertyNames;
var T = Object.prototype.hasOwnProperty;
var L = (o, t) => {
  for (var I in t)
    r(o, I, { get: t[I], enumerable: !0 });
}, c = (o, t, I, E) => {
  if (t && typeof t == "object" || typeof t == "function")
    for (let H of n(t))
      !T.call(o, H) && H !== I && r(o, H, { get: () => t[H], enumerable: !(E = i(t, H)) || E.enumerable });
  return o;
};
var x = (o) => c(r({}, "__esModule", { value: !0 }), o);

// src/highlight/index.ts
var O = {};
L(O, {
  HIGHLIGHT: () => _,
  REMOVE_HIGHLIGHT: () => s,
  RESET_HIGHLIGHT: () => p,
  SCROLL_INTO_VIEW: () => G
});
module.exports = x(O);

// src/highlight/constants.ts
var e = "storybook/highlight", _ = `${e}/add`, s = `${e}/remove`, p = `${e}/reset`, G = `${e}/scroll-into-view`;
