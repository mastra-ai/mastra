"use strict";

var classApi = require("./chunks/classApi.cjs"), internal = require("./chunks/internal.cjs");

Object.defineProperties(globalThis, internal.createPropDescriptors({
  Temporal: classApi.Temporal
})), Object.defineProperties(Intl, internal.createPropDescriptors({
  DateTimeFormat: classApi.DateTimeFormat
})), Object.defineProperties(Date.prototype, internal.createPropDescriptors({
  toTemporalInstant: classApi.toTemporalInstant
}));
