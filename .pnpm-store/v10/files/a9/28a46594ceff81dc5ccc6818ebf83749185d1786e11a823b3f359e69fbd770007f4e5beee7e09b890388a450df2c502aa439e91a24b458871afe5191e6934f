"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var validators_exports = {};
__export(validators_exports, {
  VAny: () => VAny,
  VArray: () => VArray,
  VBoolean: () => VBoolean,
  VBytes: () => VBytes,
  VFloat64: () => VFloat64,
  VId: () => VId,
  VInt64: () => VInt64,
  VLiteral: () => VLiteral,
  VNull: () => VNull,
  VObject: () => VObject,
  VRecord: () => VRecord,
  VString: () => VString,
  VUnion: () => VUnion
});
module.exports = __toCommonJS(validators_exports);
var import_value = require("./value.js");
class BaseValidator {
  constructor({ isOptional }) {
    /**
     * Only for TypeScript, the TS type of the JS values validated
     * by this validator.
     */
    __publicField(this, "type");
    /**
     * Only for TypeScript, if this an Object validator, then
     * this is the TS type of its property names.
     */
    __publicField(this, "fieldPaths");
    /**
     * Whether this is an optional Object property value validator.
     */
    __publicField(this, "isOptional");
    /**
     * Always `"true"`.
     */
    __publicField(this, "isConvexValidator");
    this.isOptional = isOptional;
    this.isConvexValidator = true;
  }
}
class VId extends BaseValidator {
  /**
   * Usually you'd use `v.id(tableName)` instead.
   */
  constructor({
    isOptional,
    tableName
  }) {
    super({ isOptional });
    /**
     * The name of the table that the validated IDs must belong to.
     */
    __publicField(this, "tableName");
    /**
     * The kind of validator, `"id"`.
     */
    __publicField(this, "kind", "id");
    if (typeof tableName !== "string") {
      throw new Error("v.id(tableName) requires a string");
    }
    this.tableName = tableName;
  }
  /** @internal */
  get json() {
    return { type: "id", tableName: this.tableName };
  }
  /** @internal */
  asOptional() {
    return new VId({
      isOptional: "optional",
      tableName: this.tableName
    });
  }
}
class VFloat64 extends BaseValidator {
  constructor() {
    super(...arguments);
    /**
     * The kind of validator, `"float64"`.
     */
    __publicField(this, "kind", "float64");
  }
  /** @internal */
  get json() {
    return { type: "number" };
  }
  /** @internal */
  asOptional() {
    return new VFloat64({
      isOptional: "optional"
    });
  }
}
class VInt64 extends BaseValidator {
  constructor() {
    super(...arguments);
    /**
     * The kind of validator, `"int64"`.
     */
    __publicField(this, "kind", "int64");
  }
  /** @internal */
  get json() {
    return { type: "bigint" };
  }
  /** @internal */
  asOptional() {
    return new VInt64({ isOptional: "optional" });
  }
}
class VBoolean extends BaseValidator {
  constructor() {
    super(...arguments);
    /**
     * The kind of validator, `"boolean"`.
     */
    __publicField(this, "kind", "boolean");
  }
  /** @internal */
  get json() {
    return { type: this.kind };
  }
  /** @internal */
  asOptional() {
    return new VBoolean({
      isOptional: "optional"
    });
  }
}
class VBytes extends BaseValidator {
  constructor() {
    super(...arguments);
    /**
     * The kind of validator, `"bytes"`.
     */
    __publicField(this, "kind", "bytes");
  }
  /** @internal */
  get json() {
    return { type: this.kind };
  }
  /** @internal */
  asOptional() {
    return new VBytes({ isOptional: "optional" });
  }
}
class VString extends BaseValidator {
  constructor() {
    super(...arguments);
    /**
     * The kind of validator, `"string"`.
     */
    __publicField(this, "kind", "string");
  }
  /** @internal */
  get json() {
    return { type: this.kind };
  }
  /** @internal */
  asOptional() {
    return new VString({
      isOptional: "optional"
    });
  }
}
class VNull extends BaseValidator {
  constructor() {
    super(...arguments);
    /**
     * The kind of validator, `"null"`.
     */
    __publicField(this, "kind", "null");
  }
  /** @internal */
  get json() {
    return { type: this.kind };
  }
  /** @internal */
  asOptional() {
    return new VNull({ isOptional: "optional" });
  }
}
class VAny extends BaseValidator {
  constructor() {
    super(...arguments);
    /**
     * The kind of validator, `"any"`.
     */
    __publicField(this, "kind", "any");
  }
  /** @internal */
  get json() {
    return {
      type: this.kind
    };
  }
  /** @internal */
  asOptional() {
    return new VAny({
      isOptional: "optional"
    });
  }
}
class VObject extends BaseValidator {
  /**
   * Usually you'd use `v.object({ ... })` instead.
   */
  constructor({
    isOptional,
    fields
  }) {
    super({ isOptional });
    /**
     * An object with the validator for each property.
     */
    __publicField(this, "fields");
    /**
     * The kind of validator, `"object"`.
     */
    __publicField(this, "kind", "object");
    globalThis.Object.values(fields).forEach((v) => {
      if (!v.isConvexValidator) {
        throw new Error("v.object() entries must be validators");
      }
    });
    this.fields = fields;
  }
  /** @internal */
  get json() {
    return {
      type: this.kind,
      value: globalThis.Object.fromEntries(
        globalThis.Object.entries(this.fields).map(([k, v]) => [
          k,
          {
            fieldType: v.json,
            optional: v.isOptional === "optional" ? true : false
          }
        ])
      )
    };
  }
  /** @internal */
  asOptional() {
    return new VObject({
      isOptional: "optional",
      fields: this.fields
    });
  }
  /**
   * Create a new VObject with the specified fields omitted.
   * @param fields The field names to omit from this VObject.
   */
  omit(...fields) {
    const newFields = { ...this.fields };
    for (const field of fields) {
      delete newFields[field];
    }
    return new VObject({
      isOptional: this.isOptional,
      fields: newFields
    });
  }
  /**
   * Create a new VObject with only the specified fields.
   * @param fields The field names to pick from this VObject.
   */
  pick(...fields) {
    const newFields = {};
    for (const field of fields) {
      newFields[field] = this.fields[field];
    }
    return new VObject({
      isOptional: this.isOptional,
      fields: newFields
    });
  }
  /**
   * Create a new VObject with all fields marked as optional.
   */
  partial() {
    const newFields = {};
    for (const [key, validator] of globalThis.Object.entries(this.fields)) {
      newFields[key] = validator.asOptional();
    }
    return new VObject({
      isOptional: this.isOptional,
      fields: newFields
    });
  }
  /**
   * Create a new VObject with additional fields merged in.
   * @param fields An object with additional validators to merge into this VObject.
   */
  extend(fields) {
    return new VObject({
      isOptional: this.isOptional,
      fields: { ...this.fields, ...fields }
    });
  }
}
class VLiteral extends BaseValidator {
  /**
   * Usually you'd use `v.literal(value)` instead.
   */
  constructor({ isOptional, value }) {
    super({ isOptional });
    /**
     * The value that the validated values must be equal to.
     */
    __publicField(this, "value");
    /**
     * The kind of validator, `"literal"`.
     */
    __publicField(this, "kind", "literal");
    if (typeof value !== "string" && typeof value !== "boolean" && typeof value !== "number" && typeof value !== "bigint") {
      throw new Error("v.literal(value) must be a string, number, or boolean");
    }
    this.value = value;
  }
  /** @internal */
  get json() {
    return {
      type: this.kind,
      value: (0, import_value.convexToJson)(this.value)
    };
  }
  /** @internal */
  asOptional() {
    return new VLiteral({
      isOptional: "optional",
      value: this.value
    });
  }
}
class VArray extends BaseValidator {
  /**
   * Usually you'd use `v.array(element)` instead.
   */
  constructor({
    isOptional,
    element
  }) {
    super({ isOptional });
    /**
     * The validator for the elements of the array.
     */
    __publicField(this, "element");
    /**
     * The kind of validator, `"array"`.
     */
    __publicField(this, "kind", "array");
    this.element = element;
  }
  /** @internal */
  get json() {
    return {
      type: this.kind,
      value: this.element.json
    };
  }
  /** @internal */
  asOptional() {
    return new VArray({
      isOptional: "optional",
      element: this.element
    });
  }
}
class VRecord extends BaseValidator {
  /**
   * Usually you'd use `v.record(key, value)` instead.
   */
  constructor({
    isOptional,
    key,
    value
  }) {
    super({ isOptional });
    /**
     * The validator for the keys of the record.
     */
    __publicField(this, "key");
    /**
     * The validator for the values of the record.
     */
    __publicField(this, "value");
    /**
     * The kind of validator, `"record"`.
     */
    __publicField(this, "kind", "record");
    if (key.isOptional === "optional") {
      throw new Error("Record validator cannot have optional keys");
    }
    if (value.isOptional === "optional") {
      throw new Error("Record validator cannot have optional values");
    }
    if (!key.isConvexValidator || !value.isConvexValidator) {
      throw new Error("Key and value of v.record() but be validators");
    }
    this.key = key;
    this.value = value;
  }
  /** @internal */
  get json() {
    return {
      type: this.kind,
      // This cast is needed because TypeScript thinks the key type is too wide
      keys: this.key.json,
      values: {
        fieldType: this.value.json,
        optional: false
      }
    };
  }
  /** @internal */
  asOptional() {
    return new VRecord({
      isOptional: "optional",
      key: this.key,
      value: this.value
    });
  }
}
class VUnion extends BaseValidator {
  /**
   * Usually you'd use `v.union(...members)` instead.
   */
  constructor({ isOptional, members }) {
    super({ isOptional });
    /**
     * The array of validators, one of which must match the value.
     */
    __publicField(this, "members");
    /**
     * The kind of validator, `"union"`.
     */
    __publicField(this, "kind", "union");
    members.forEach((member) => {
      if (!member.isConvexValidator) {
        throw new Error("All members of v.union() must be validators");
      }
    });
    this.members = members;
  }
  /** @internal */
  get json() {
    return {
      type: this.kind,
      value: this.members.map((v) => v.json)
    };
  }
  /** @internal */
  asOptional() {
    return new VUnion({
      isOptional: "optional",
      members: this.members
    });
  }
}
//# sourceMappingURL=validators.js.map
