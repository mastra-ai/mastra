var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var index_exports = {};
__export(index_exports, {
  deserializeError: () => deserializeError,
  errorConstructors: () => import_constructors.errorConstructors,
  serializeError: () => serializeError
});
module.exports = __toCommonJS(index_exports);
var import_constructors = require("./constructors");
const getErrorConstructor = (name) => {
  var _a;
  return (_a = import_constructors.errorConstructors.get(name)) != null ? _a : Error;
};
const commonProperties = [
  {
    property: "message",
    enumerable: false
  },
  {
    property: "stack",
    enumerable: false
  },
  {
    property: "code",
    enumerable: true
  },
  {
    property: "cause",
    enumerable: false
  }
];
function serializeError(subject) {
  const data = {
    name: "Error",
    message: "",
    stack: ""
  };
  for (const { property } of commonProperties) {
    if (!(property in subject)) continue;
    data[property] = subject[property];
  }
  if (globalThis.DOMException && subject instanceof globalThis.DOMException) {
    data.name = "DOMException";
  } else {
    data.name = Object.getPrototypeOf(subject).name;
  }
  return data;
}
function deserializeError(subject) {
  const fn = getErrorConstructor(subject.name);
  const output = new fn();
  for (const { property, enumerable } of commonProperties) {
    if (!(property in subject)) continue;
    Object.defineProperty(output, property, {
      value: subject[property],
      enumerable,
      configurable: true,
      writable: true
    });
  }
  return output;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  deserializeError,
  errorConstructors,
  serializeError
});
//# sourceMappingURL=index.js.map
