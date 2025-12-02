"use strict";
var r = Object.defineProperty;
var a = Object.getOwnPropertyDescriptor;
var T = Object.getOwnPropertyNames;
var s = Object.prototype.hasOwnProperty;
var R = (o, _) => {
  for (var e in _)
    r(o, e, { get: _[e], enumerable: !0 });
}, E = (o, _, e, t) => {
  if (_ && typeof _ == "object" || typeof _ == "function")
    for (let O of T(_))
      !s.call(o, O) && O !== e && r(o, O, { get: () => _[O], enumerable: !(t = a(_, O)) || t.enumerable });
  return o;
};
var S = (o) => E(r({}, "__esModule", { value: !0 }), o);

// src/manager/globals.ts
var y = {};
R(y, {
  globalPackages: () => l,
  globalsNameReferenceMap: () => n
});
module.exports = S(y);

// src/manager/globals/globals.ts
var n = {
  react: "__REACT__",
  "react-dom": "__REACT_DOM__",
  "react-dom/client": "__REACT_DOM_CLIENT__",
  "@storybook/icons": "__STORYBOOK_ICONS__",
  "storybook/manager-api": "__STORYBOOK_API__",
  "storybook/test": "__STORYBOOK_TEST__",
  "storybook/theming": "__STORYBOOK_THEMING__",
  "storybook/theming/create": "__STORYBOOK_THEMING_CREATE__",
  "storybook/internal/channels": "__STORYBOOK_CHANNELS__",
  "storybook/internal/client-logger": "__STORYBOOK_CLIENT_LOGGER__",
  "storybook/internal/components": "__STORYBOOK_COMPONENTS__",
  "storybook/internal/core-errors": "__STORYBOOK_CORE_EVENTS__",
  "storybook/internal/core-events": "__STORYBOOK_CORE_EVENTS__",
  "storybook/internal/manager-errors": "__STORYBOOK_CORE_EVENTS_MANAGER_ERRORS__",
  "storybook/internal/router": "__STORYBOOK_ROUTER__",
  "storybook/internal/types": "__STORYBOOK_TYPES__",
  // @deprecated TODO: delete in 9.1
  "storybook/internal/manager-api": "__STORYBOOK_API__",
  "storybook/internal/theming": "__STORYBOOK_THEMING__",
  "storybook/internal/theming/create": "__STORYBOOK_THEMING_CREATE__"
}, l = Object.keys(n);
