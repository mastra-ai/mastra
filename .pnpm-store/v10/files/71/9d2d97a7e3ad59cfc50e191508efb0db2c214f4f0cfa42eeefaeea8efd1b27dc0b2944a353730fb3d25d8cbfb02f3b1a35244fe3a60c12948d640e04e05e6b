"use strict";
var r = Object.defineProperty;
var s = Object.getOwnPropertyDescriptor;
var a = Object.getOwnPropertyNames;
var n = Object.prototype.hasOwnProperty;
var R = (o, _) => {
  for (var e in _)
    r(o, e, { get: _[e], enumerable: !0 });
}, l = (o, _, e, t) => {
  if (_ && typeof _ == "object" || typeof _ == "function")
    for (let O of a(_))
      !n.call(o, O) && O !== e && r(o, O, { get: () => _[O], enumerable: !(t = s(_, O)) || t.enumerable });
  return o;
};
var S = (o) => l(r({}, "__esModule", { value: !0 }), o);

// src/preview/globals.ts
var b = {};
R(b, {
  globalPackages: () => T,
  globalsNameReferenceMap: () => E
});
module.exports = S(b);

// src/preview/globals/globals.ts
var E = {
  "@storybook/global": "__STORYBOOK_MODULE_GLOBAL__",
  "storybook/test": "__STORYBOOK_MODULE_TEST__",
  "storybook/actions": "__STORYBOOK_MODULE_ACTIONS__",
  "storybook/preview-api": "__STORYBOOK_MODULE_PREVIEW_API__",
  "storybook/internal/channels": "__STORYBOOK_MODULE_CHANNELS__",
  "storybook/internal/client-logger": "__STORYBOOK_MODULE_CLIENT_LOGGER__",
  "storybook/internal/core-events": "__STORYBOOK_MODULE_CORE_EVENTS__",
  "storybook/internal/preview-errors": "__STORYBOOK_MODULE_CORE_EVENTS_PREVIEW_ERRORS__",
  "storybook/internal/types": "__STORYBOOK_MODULE_TYPES__",
  // @deprecated TODO: Remove in 9.1
  "storybook/internal/preview-api": "__STORYBOOK_MODULE_PREVIEW_API__"
}, T = Object.keys(E);
