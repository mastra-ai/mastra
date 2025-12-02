const {
  CastTypes,
  ValueTypes,
  KeyCasing,
  AttributeTypes,
  AttributeMutationMethods,
  AttributeWildCard,
  PathTypes,
  TableIndex,
  ItemOperations,
  DataOptions,
} = require("./types");
const AttributeTypeNames = Object.keys(AttributeTypes);
const ValidFacetTypes = [
  AttributeTypes.string,
  AttributeTypes.number,
  AttributeTypes.boolean,
  AttributeTypes.enum,
];
const e = require("./errors");
const u = require("./util");
const v = require("./validations");
const { DynamoDBSet } = require("./set");

function getValueType(value) {
  if (value === undefined) {
    return ValueTypes.undefined;
  } else if (value === null) {
    return ValueTypes.null;
  } else if (typeof value === "string") {
    return ValueTypes.string;
  } else if (typeof value === "number") {
    return ValueTypes.number;
  } else if (typeof value === "boolean") {
    return ValueTypes.boolean;
  } else if (Array.isArray(value)) {
    return ValueTypes.array;
  } else if (value.wrapperName === "Set") {
    return ValueTypes.aws_set;
  } else if (value.constructor.name === "Set") {
    return ValueTypes.set;
  } else if (value.constructor.name === "Map") {
    return ValueTypes.map;
  } else if (value.constructor.name === "Object") {
    return ValueTypes.object;
  } else {
    return ValueTypes.unknown;
  }
}

class AttributeTraverser {
  constructor(parentTraverser) {
    if (parentTraverser instanceof AttributeTraverser) {
      this.parent = parentTraverser;
      this.paths = this.parent.paths;
    } else {
      this.parent = null;
      this.paths = new Map();
    }
    this.children = new Map();
  }

  setChild(name, attribute) {
    this.children.set(name, attribute);
  }

  asChild(name, attribute) {
    if (this.parent) {
      this.parent.setChild(name, attribute);
    }
  }

  setPath(path, attribute) {
    if (this.parent) {
      this.parent.setPath(path, attribute);
    }
    this.paths.set(path, attribute);
  }

  getPath(path) {
    path = u.genericizeJSONPath(path);
    if (this.parent) {
      return this.parent.getPath(path);
    }
    return this.paths.get(path);
  }

  getChild(name) {
    return this.children.get(name);
  }

  getAllChildren() {
    return this.children.entries();
  }

  getAll() {
    if (this.parent) {
      return this.parent.getAll();
    }
    return this.paths.entries();
  }
}

class Attribute {
  constructor(definition = {}) {
    this.name = definition.name;
    this.field = definition.field || definition.name;
    this.label = definition.label;
    this.readOnly = !!definition.readOnly;
    this.hidden = !!definition.hidden;
    this.required = !!definition.required;
    this.cast = this._makeCast(definition.name, definition.cast);
    this.default = this._makeDefault(definition.default);
    this.validate = this._makeValidate(definition.validate);
    this.isKeyField = !!definition.isKeyField;
    this.unformat = this._makeDestructureKey(definition);
    this.format = this._makeStructureKey(definition);
    this.padding = definition.padding;
    this.applyFixings = this._makeApplyFixings(definition);
    this.applyPadding = this._makePadding(definition);
    this.indexes = [...(definition.indexes || [])];
    let { isWatched, isWatcher, watchedBy, watching, watchAll } =
      Attribute._destructureWatcher(definition);
    this._isWatched = isWatched;
    this._isWatcher = isWatcher;
    this.watchedBy = watchedBy;
    this.watching = watching;
    this.watchAll = watchAll;
    let { type, enumArray } = this._makeType(this.name, definition);
    this.type = type;
    this.enumArray = enumArray;
    this.parentType = definition.parentType;
    this.parentPath = definition.parentPath;
    const pathType = this.getPathType(this.type, this.parentType);
    const path = Attribute.buildPath(this.name, pathType, this.parentPath);
    const fieldPath = Attribute.buildPath(
      this.field,
      pathType,
      this.parentType,
    );
    this.path = path;
    this.fieldPath = fieldPath;
    this.traverser = new AttributeTraverser(definition.traverser);
    this.traverser.setPath(this.path, this);
    this.traverser.setPath(this.fieldPath, this);
    this.traverser.asChild(this.name, this);
    this.parent = { parentType: this.type, parentPath: this.path };
    this.get = this._makeGet(definition.get);
    this.set = this._makeSet(definition.set);
    this.getClient = definition.getClient;
  }

  static buildChildAttributes(type, definition, parent) {
    let items;
    let properties;
    if (type === AttributeTypes.list) {
      items = Attribute.buildChildListItems(definition, parent);
    } else if (type === AttributeTypes.set) {
      items = Attribute.buildChildSetItems(definition, parent);
    } else if (type === AttributeTypes.map) {
      properties = Attribute.buildChildMapProperties(definition, parent);
    }

    return { items, properties };
  }

  static buildChildListItems(definition, parent) {
    const { items, getClient } = definition;
    const prop = { ...items, ...parent };
    // The use of "*" is to ensure the child's name is "*" when added to the traverser and searching for the children of a list
    return Schema.normalizeAttributes(
      { "*": prop },
      {},
      { getClient, traverser: parent.traverser, parent },
    ).attributes["*"];
  }

  static buildChildSetItems(definition, parent) {
    const { items, getClient } = definition;

    const allowedTypes = [
      AttributeTypes.string,
      AttributeTypes.boolean,
      AttributeTypes.number,
      AttributeTypes.enum,
    ];
    if (!Array.isArray(items) && !allowedTypes.includes(items)) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidAttributeDefinition,
        `Invalid "items" definition for Set attribute: "${
          definition.path
        }". Acceptable item types include ${u.commaSeparatedString(
          allowedTypes,
        )}`,
      );
    }
    const prop = { type: items, ...parent };
    return Schema.normalizeAttributes(
      { prop },
      {},
      { getClient, traverser: parent.traverser, parent },
    ).attributes.prop;
  }

  static buildChildMapProperties(definition, parent) {
    const { properties, getClient } = definition;
    if (!properties || typeof properties !== "object") {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidAttributeDefinition,
        `Invalid "properties" definition for Map attribute: "${definition.path}". The "properties" definition must describe the attributes that the Map will accept`,
      );
    }
    const attributes = {};
    for (let name of Object.keys(properties)) {
      attributes[name] = { ...properties[name], ...parent };
    }
    return Schema.normalizeAttributes(
      attributes,
      {},
      { getClient, traverser: parent.traverser, parent },
    );
  }

  static buildPath(name, type, parentPath) {
    if (!parentPath) return name;
    switch (type) {
      case AttributeTypes.string:
      case AttributeTypes.number:
      case AttributeTypes.boolean:
      case AttributeTypes.map:
      case AttributeTypes.set:
      case AttributeTypes.list:
      case AttributeTypes.enum:
        return `${parentPath}.${name}`;
      case PathTypes.item:
        return `${parentPath}[*]`;
      case AttributeTypes.any:
      default:
        return `${parentPath}.*`;
    }
  }

  static _destructureWatcher(definition) {
    let watchAll = !!definition.watchAll;
    let watchingArr = watchAll ? [] : [...(definition.watching || [])];
    let watchedByArr = [...(definition.watchedBy || [])];
    let isWatched = watchedByArr.length > 0;
    let isWatcher = watchingArr.length > 0;
    let watchedBy = {};
    let watching = {};

    for (let watched of watchedByArr) {
      watchedBy[watched] = watched;
    }

    for (let attribute of watchingArr) {
      watching[attribute] = attribute;
    }

    return {
      watchAll,
      watching,
      watchedBy,
      isWatched,
      isWatcher,
    };
  }

  _makeGet(get) {
    this._checkGetSet(get, "get");
    const getter = get
      ? (value, getSiblings) => get(value, getSiblings())
      : (attr) => attr;
    return (value, getSiblings) => {
      if (this.hidden) {
        return;
      }
      value = this.unformat(value);
      return getter(value, getSiblings);
    };
  }

  _makeSet(set) {
    this._checkGetSet(set, "set");
    return set
      ? (value, getSiblings) => set(value, getSiblings())
      : (attr) => attr;
  }

  _makeApplyFixings({
    prefix = "",
    postfix = "",
    casing = KeyCasing.none,
  } = {}) {
    return (value) => {
      if (value === undefined) {
        return;
      }

      if ([AttributeTypes.string, AttributeTypes.enum].includes(this.type)) {
        value = `${prefix}${value}${postfix}`;
      }

      return u.formatAttributeCasing(value, casing);
    };
  }

  _makeStructureKey() {
    return (key) => {
      return this.applyPadding(key);
    };
  }

  _isPaddingEligible(padding = {}) {
    return !!padding && padding.length && v.isStringHasLength(padding.char);
  }

  _makePadding({ padding = {} }) {
    return (value) => {
      if (typeof value !== "string") {
        return value;
      } else if (this._isPaddingEligible(padding)) {
        return u.addPadding({ padding, value });
      } else {
        return value;
      }
    };
  }

  _makeRemoveFixings({
    prefix = "",
    postfix = "",
    casing = KeyCasing.none,
  } = {}) {
    return (key) => {
      let value = "";
      if (
        ![AttributeTypes.string, AttributeTypes.enum].includes(this.type) ||
        typeof key !== "string"
      ) {
        value = key;
      } else if (prefix.length > 0 && key.length > prefix.length) {
        for (let i = prefix.length; i < key.length - postfix.length; i++) {
          value += key[i];
        }
      } else {
        value = key;
      }

      return value;
    };
  }

  _makeDestructureKey({
    prefix = "",
    postfix = "",
    casing = KeyCasing.none,
    padding = {},
  } = {}) {
    return (key) => {
      let value = "";
      if (
        ![AttributeTypes.string, AttributeTypes.enum].includes(this.type) ||
        typeof key !== "string"
      ) {
        return key;
      } else if (key.length > prefix.length) {
        value = u.removeFixings({ prefix, postfix, value: key });
      } else {
        value = key;
      }

      // todo: if an attribute is also used as a pk or sk directly in one index, but a composite in another, then padding is going to be broken
      // if (padding && padding.length) {
      // 	value = u.removePadding({padding, value});
      // }

      return value;
    };
  }

  acceptable(val) {
    return val !== undefined;
  }

  getPathType(type, parentType) {
    if (
      parentType === AttributeTypes.list ||
      parentType === AttributeTypes.set
    ) {
      return PathTypes.item;
    }
    return type;
  }

  getAttribute(path) {
    return this.traverser.getPath(path);
  }

  getChild(path) {
    if (this.type === AttributeTypes.any) {
      return this;
    } else if (
      !isNaN(path) &&
      (this.type === AttributeTypes.list || this.type === AttributeTypes.set)
    ) {
      // if they're asking for a number, and this is a list, children will be under "*"
      return this.traverser.getChild("*");
    } else {
      return this.traverser.getChild(path);
    }
  }

  _checkGetSet(val, type) {
    if (typeof val !== "function" && val !== undefined) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidAttributeDefinition,
        `Invalid "${type}" property for attribute ${this.path}. Please ensure value is a function or undefined.`,
      );
    }
  }

  _makeCast(name, cast) {
    if (cast !== undefined && !CastTypes.includes(cast)) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidAttributeDefinition,
        `Invalid "cast" property for attribute: "${name}". Acceptable types include ${CastTypes.join(
          ", ",
        )}`,
      );
    } else if (cast === AttributeTypes.string) {
      return (val) => {
        if (val === undefined) {
          // todo: #electroerror
          throw new Error(
            `Attribute ${name} is undefined and cannot be cast to type ${cast}`,
          );
        } else if (typeof val === "string") {
          return val;
        } else {
          return JSON.stringify(val);
        }
      };
    } else if (cast === AttributeTypes.number) {
      return (val) => {
        if (val === undefined) {
          // todo: #electroerror
          throw new Error(
            `Attribute ${name} is undefined and cannot be cast to type ${cast}`,
          );
        } else if (typeof val === "number") {
          return val;
        } else {
          let results = Number(val);
          if (isNaN(results)) {
            // todo: #electroerror
            throw new Error(
              `Attribute ${name} cannot be cast to type ${cast}. Doing so results in NaN`,
            );
          } else {
            return results;
          }
        }
      };
    } else {
      return (val) => val;
    }
  }

  _makeValidate(definition) {
    if (typeof definition === "function") {
      return (val) => {
        try {
          let isValid = !!definition(val);
          return [
            isValid,
            isValid
              ? []
              : [
                  new e.ElectroUserValidationError(
                    this.path,
                    "Invalid value provided",
                  ),
                ],
          ];
        } catch (err) {
          return [false, [new e.ElectroUserValidationError(this.path, err)]];
        }
      };
    } else if (definition instanceof RegExp) {
      return (val) => {
        if (val === undefined) {
          return [true, []];
        }
        let isValid = definition.test(val);
        let reason = [];
        if (!isValid) {
          reason.push(
            new e.ElectroUserValidationError(
              this.path,
              `Invalid value for attribute "${this.path}": Failed model defined regex`,
            ),
          );
        }
        return [isValid, reason];
      };
    } else {
      return () => [true, []];
    }
  }

  _makeDefault(definition) {
    if (typeof definition === "function") {
      return () => definition();
    } else {
      return () => definition;
    }
  }

  _makeType(name, definition) {
    let type = "";
    let enumArray = [];
    if (Array.isArray(definition.type)) {
      type = AttributeTypes.enum;
      enumArray = [...definition.type];
      // } else if (definition.type === AttributeTypes.set && Array.isArray(definition.items)) {
      // type = AttributeTypes.enumSet;
      // enumArray = [...definition.items];
    } else {
      type = definition.type || "string";
    }
    if (!AttributeTypeNames.includes(type)) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidAttributeDefinition,
        `Invalid "type" property for attribute: "${name}". Acceptable types include ${AttributeTypeNames.join(
          ", ",
        )}`,
      );
    }
    return { type, enumArray };
  }

  isWatcher() {
    return this._isWatcher;
  }

  isWatched() {
    return this._isWatched;
  }

  isWatching(attribute) {
    return this.watching[attribute] !== undefined;
  }

  isWatchedBy(attribute) {
    return this.watchedBy[attribute] !== undefined;
  }

  _isType(value) {
    if (value === undefined) {
      let reason = [];
      if (this.required) {
        reason.push(
          new e.ElectroAttributeValidationError(
            this.path,
            `Invalid value type at entity path: "${this.path}". Value is required.`,
          ),
        );
      }
      return [!this.required, reason];
    }
    let isTyped = false;
    let reason = [];
    switch (this.type) {
      case AttributeTypes.enum:
        // case AttributeTypes.enumSet:
        // isTyped = this.enumArray.every(enumValue => {
        // 	const val = Array.isArray(value) ? value : [value];
        // 	return val.includes(enumValue);
        // })
        isTyped = this.enumArray.includes(value);
        if (!isTyped) {
          reason.push(
            new e.ElectroAttributeValidationError(
              this.path,
              `Invalid value type at entity path: "${
                this.path
              }". Value not found in set of acceptable values: ${u.commaSeparatedString(
                this.enumArray,
              )}`,
            ),
          );
        }
        break;
      case AttributeTypes.any:
      case AttributeTypes.static:
      case AttributeTypes.custom:
        isTyped = true;
        break;
      case AttributeTypes.string:
      case AttributeTypes.number:
      case AttributeTypes.boolean:
      default:
        isTyped = typeof value === this.type;
        if (!isTyped) {
          reason.push(
            new e.ElectroAttributeValidationError(
              this.path,
              `Invalid value type at entity path: "${
                this.path
              }". Received value of type "${typeof value}", expected value of type "${
                this.type
              }"`,
            ),
          );
        }
        break;
    }
    return [isTyped, reason];
  }

  isValid(value) {
    try {
      let [isTyped, typeErrorReason] = this._isType(value);
      let [isValid, validationError] = isTyped
        ? this.validate(value)
        : [false, []];
      let errors = [...typeErrorReason, ...validationError].filter(
        (value) => value !== undefined,
      );
      return [isTyped && isValid, errors];
    } catch (err) {
      return [false, [err]];
    }
  }

  val(value) {
    value = this.cast(value);
    if (value === undefined) {
      value = this.default();
    }
    return value;
  }

  getValidate(value) {
    value = this.val(value);
    let [isValid, validationErrors] = this.isValid(value);
    if (!isValid) {
      throw new e.ElectroValidationError(validationErrors);
    }
    return value;
  }
}

class MapAttribute extends Attribute {
  constructor(definition) {
    super(definition);
    const properties = Attribute.buildChildMapProperties(definition, {
      parentType: this.type,
      parentPath: this.path,
      traverser: this.traverser,
    });
    this.properties = properties;
    this.isRoot = !!definition.isRoot;
    this.get = this._makeGet(definition.get, properties);
    this.set = this._makeSet(definition.set, properties);
  }

  _makeGet(get, properties) {
    this._checkGetSet(get, "get");
    const getter = get
      ? (value, getSiblings) => get(value, getSiblings())
      : (val) => {
          const isEmpty = !val || Object.keys(val).length === 0;
          const isNotRequired = !this.required;
          const doesNotHaveDefault = this.default === undefined;
          const isRoot = this.isRoot;
          if (isEmpty && isRoot && isNotRequired && doesNotHaveDefault) {
            return undefined;
          }
          return val;
        };
    return (values, getSiblings) => {
      const data = {};

      if (this.hidden) {
        return;
      }

      if (values === undefined) {
        if (!get) {
          return undefined;
        }
        return getter(data, getSiblings);
      }

      for (const name of Object.keys(properties.attributes)) {
        const attribute = properties.attributes[name];
        if (values[attribute.field] !== undefined) {
          let results = attribute.get(values[attribute.field], () => ({
            ...values,
          }));
          if (results !== undefined) {
            data[name] = results;
          }
        }
      }

      return getter(data, getSiblings);
    };
  }

  _makeSet(set, properties) {
    this._checkGetSet(set, "set");
    const setter = set
      ? (val, getSiblings) => set(val, getSiblings())
      : (val) => {
          const isEmpty = !val || Object.keys(val).length === 0;
          const isNotRequired = !this.required;
          const doesNotHaveDefault = this.default === undefined;
          const defaultIsValue = this.default === val;
          const isRoot = this.isRoot;
          if (defaultIsValue) {
            return val;
          } else if (isEmpty && isRoot && isNotRequired && doesNotHaveDefault) {
            return undefined;
          } else {
            return val;
          }
        };

    return (values, getSiblings) => {
      const data = {};
      if (values === undefined) {
        if (!set) {
          return undefined;
        }
        return setter(values, getSiblings);
      }
      for (const name of Object.keys(properties.attributes)) {
        const attribute = properties.attributes[name];
        if (values[name] !== undefined) {
          const results = attribute.set(values[name], () => ({ ...values }));
          if (results !== undefined) {
            data[attribute.field] = results;
          }
        }
      }
      return setter(data, getSiblings);
    };
  }

  _isType(value) {
    if (value === undefined) {
      let reason = [];
      if (this.required) {
        reason.push(
          new e.ElectroAttributeValidationError(
            this.path,
            `Invalid value type at entity path: "${this.path}". Value is required.`,
          ),
        );
      }
      return [!this.required, reason];
    }
    const valueType = getValueType(value);
    if (valueType !== ValueTypes.object) {
      return [
        false,
        [
          new e.ElectroAttributeValidationError(
            this.path,
            `Invalid value type at entity path "${this.path}. Received value of type "${valueType}", expected value of type "object"`,
          ),
        ],
      ];
    }
    let reason = [];
    const [childrenAreValid, childErrors] = this._validateChildren(value);
    if (!childrenAreValid) {
      reason = childErrors;
    }
    return [childrenAreValid, reason];
  }

  _validateChildren(value) {
    const valueType = getValueType(value);
    const attributes = this.properties.attributes;
    let errors = [];
    if (valueType === ValueTypes.object) {
      for (const child of Object.keys(attributes)) {
        const [isValid, errorValues] = attributes[child].isValid(
          value === undefined ? value : value[child],
        );
        if (!isValid) {
          errors = [...errors, ...errorValues];
        }
      }
    } else if (valueType !== ValueTypes.object) {
      errors.push(
        new e.ElectroAttributeValidationError(
          this.path,
          `Invalid value type at entity path: "${this.path}". Expected value to be an object to fulfill attribute type "${this.type}"`,
        ),
      );
    } else if (this.properties.hasRequiredAttributes) {
      errors.push(
        new e.ElectroAttributeValidationError(
          this.path,
          `Invalid value type at entity path: "${
            this.path
          }". Map attribute requires at least the properties ${u.commaSeparatedString(
            Object.keys(attributes),
          )}`,
        ),
      );
    }
    return [errors.length === 0, errors];
  }

  val(value) {
    const incomingIsEmpty = value === undefined;
    let fromDefault = false;
    let data;
    if (value === undefined) {
      data = this.default();
      if (data !== undefined) {
        fromDefault = true;
      }
    } else {
      data = value;
    }

    const valueType = getValueType(data);

    if (data === undefined) {
      return data;
    } else if (valueType !== "object") {
      throw new e.ElectroAttributeValidationError(
        this.path,
        `Invalid value type at entity path: "${this.path}". Expected value to be an object to fulfill attribute type "${this.type}"`,
      );
    }

    const response = {};

    for (const name of Object.keys(this.properties.attributes)) {
      const attribute = this.properties.attributes[name];
      const results = attribute.val(data[attribute.name]);
      if (results !== undefined) {
        response[name] = results;
      }
    }

    if (
      Object.keys(response).length === 0 &&
      !fromDefault &&
      this.isRoot &&
      !this.required &&
      incomingIsEmpty
    ) {
      return undefined;
    }

    return response;
  }
}

class ListAttribute extends Attribute {
  constructor(definition) {
    super(definition);
    const items = Attribute.buildChildListItems(definition, {
      parentType: this.type,
      parentPath: this.path,
      traverser: this.traverser,
    });
    this.items = items;
    this.get = this._makeGet(definition.get, items);
    this.set = this._makeSet(definition.set, items);
  }

  _makeGet(get, items) {
    this._checkGetSet(get, "get");

    const getter = get
      ? (value, getSiblings) => get(value, getSiblings())
      : (attr) => attr;

    return (values, getSiblings) => {
      const data = [];

      if (this.hidden) {
        return;
      }

      if (values === undefined) {
        return getter(data, getSiblings);
      }

      for (let value of values) {
        const results = items.get(value, () => [...values]);
        if (results !== undefined) {
          data.push(results);
        }
      }

      return getter(data, getSiblings);
    };
  }

  _makeSet(set, items) {
    this._checkGetSet(set, "set");
    const setter = set
      ? (value, getSiblings) => set(value, getSiblings())
      : (attr) => attr;
    return (values, getSiblings) => {
      const data = [];

      if (values === undefined) {
        return setter(values, getSiblings);
      }

      for (const value of values) {
        const results = items.set(value, () => [...values]);
        if (results !== undefined) {
          data.push(results);
        }
      }

      return setter(data, getSiblings);
    };
  }

  _validateArrayValue(value) {
    const reason = [];
    const valueType = getValueType(value);
    if (value !== undefined && valueType !== ValueTypes.array) {
      return [
        false,
        [
          new e.ElectroAttributeValidationError(
            this.path,
            `Invalid value type at entity path "${this.path}. Received value of type "${valueType}", expected value of type "array"`,
          ),
        ],
      ];
    } else {
      return [true, []];
    }
  }

  _isType(value) {
    if (value === undefined) {
      let reason = [];
      if (this.required) {
        reason.push(
          new e.ElectroAttributeValidationError(
            this.path,
            `Invalid value type at entity path: "${this.path}". Value is required.`,
          ),
        );
      }
      return [!this.required, reason];
    }

    const [isValidArray, errors] = this._validateArrayValue(value);
    if (!isValidArray) {
      return [isValidArray, errors];
    }
    let reason = [];
    const [childrenAreValid, childErrors] = this._validateChildren(value);
    if (!childrenAreValid) {
      reason = childErrors;
    }
    return [childrenAreValid, reason];
  }

  _validateChildren(value) {
    const valueType = getValueType(value);
    const errors = [];
    if (valueType === ValueTypes.array) {
      for (const i in value) {
        const [isValid, errorValues] = this.items.isValid(value[i]);
        if (!isValid) {
          for (const err of errorValues) {
            if (
              err instanceof e.ElectroAttributeValidationError ||
              err instanceof e.ElectroUserValidationError
            ) {
              err.index = parseInt(i);
            }
            errors.push(err);
          }
        }
      }
    } else {
      errors.push(
        new e.ElectroAttributeValidationError(
          this.path,
          `Invalid value type at entity path: "${this.path}". Expected value to be an Array to fulfill attribute type "${this.type}"`,
        ),
      );
    }
    return [errors.length === 0, errors];
  }

  val(value) {
    const getValue = (v) => {
      v = this.cast(v);
      if (v === undefined) {
        v = this.default();
      }
      return v;
    };

    const data = value === undefined ? getValue(value) : value;

    if (data === undefined) {
      return data;
    } else if (!Array.isArray(data)) {
      throw new e.ElectroAttributeValidationError(
        this.path,
        `Invalid value type at entity path "${
          this.path
        }. Received value of type "${getValueType(
          value,
        )}", expected value of type "array"`,
      );
    }

    const response = [];
    for (const d of data) {
      const results = this.items.val(d);
      if (results !== undefined) {
        response.push(results);
      }
    }

    return response;
  }
}

class SetAttribute extends Attribute {
  constructor(definition) {
    super(definition);
    const items = Attribute.buildChildSetItems(definition, {
      parentType: this.type,
      parentPath: this.path,
      traverser: this.traverser,
    });
    this.items = items;
    this.get = this._makeGet(definition.get, items);
    this.set = this._makeSet(definition.set, items);
    this.validate = this._makeSetValidate(definition);
  }

  _makeSetValidate(definition) {
    const validate = this._makeValidate(definition.validate);
    return (value) => {
      switch (getValueType(value)) {
        case ValueTypes.array:
          return validate([...value]);
        case ValueTypes.aws_set:
          return validate([...value.values]);
        case ValueTypes.set:
          return validate(Array.from(value));
        default:
          return validate(value);
      }
    };
  }

  fromDDBSet(value) {
    switch (getValueType(value)) {
      case ValueTypes.aws_set:
        return [...value.values];
      case ValueTypes.set:
        return Array.from(value);
      default:
        return value;
    }
  }

  _createDDBSet(value) {
    const client = this.getClient();
    if (client && typeof client.createSet === "function") {
      value = Array.isArray(value) ? Array.from(new Set(value)) : value;
      return client.createSet(value, { validate: true });
    } else {
      return new DynamoDBSet(value, this.items.type);
    }
  }

  acceptable(val) {
    return Array.isArray(val) ? val.length > 0 : this.items.acceptable(val);
  }

  toDDBSet(value) {
    const valueType = getValueType(value);
    let array;
    switch (valueType) {
      case ValueTypes.set:
        array = Array.from(value);
        return this._createDDBSet(array);
      case ValueTypes.aws_set:
        return value;
      case ValueTypes.array:
        return this._createDDBSet(value);
      case ValueTypes.string:
      case ValueTypes.number: {
        this.items.getValidate(value);
        return this._createDDBSet(value);
      }
      default:
        throw new e.ElectroAttributeValidationError(
          this.path,
          `Invalid attribute value supplied to "set" attribute "${this.path}". Received value of type "${valueType}". Set values must be supplied as either Arrays, native JavaScript Set objects, DocumentClient Set objects, strings, or numbers.`,
        );
    }
  }

  _makeGet(get, items) {
    this._checkGetSet(get, "get");
    const getter = get
      ? (value, getSiblings) => get(value, getSiblings())
      : (attr) => attr;
    return (values, getSiblings) => {
      if (values !== undefined) {
        const data = this.fromDDBSet(values);
        return getter(data, getSiblings);
      }
      const data = this.fromDDBSet(values);
      const results = getter(data, getSiblings);
      if (results !== undefined) {
        // if not undefined, try to convert, else no need to return
        return this.fromDDBSet(results);
      }
    };
  }

  _makeSet(set, items) {
    this._checkGetSet(set, "set");
    const setter = set
      ? (value, getSiblings) => set(value, getSiblings())
      : (attr) => attr;
    return (values, getSiblings) => {
      const results = setter(this.fromDDBSet(values), getSiblings);
      if (results !== undefined) {
        return this.toDDBSet(results);
      }
    };
  }

  _isType(value) {
    if (value === undefined) {
      const reason = [];
      if (this.required) {
        reason.push(
          new e.ElectroAttributeValidationError(
            this.path,
            `Invalid value type at entity path: "${this.path}". Value is required.`,
          ),
        );
      }
      return [!this.required, reason];
    }

    let reason = [];
    const [childrenAreValid, childErrors] = this._validateChildren(value);
    if (!childrenAreValid) {
      reason = childErrors;
    }
    return [childrenAreValid, reason];
  }

  _validateChildren(value) {
    const valueType = getValueType(value);
    let errors = [];
    let arr = [];
    if (valueType === ValueTypes.array) {
      arr = value;
    } else if (valueType === ValueTypes.set) {
      arr = Array.from(value);
    } else if (valueType === ValueTypes.aws_set) {
      arr = value.values;
    } else {
      errors.push(
        new e.ElectroAttributeValidationError(
          this.path,
          `Invalid value type at attribute path: "${this.path}". Expected value to be an Expected value to be an Array, native JavaScript Set objects, or DocumentClient Set objects to fulfill attribute type "${this.type}"`,
        ),
      );
    }
    for (const item of arr) {
      const [isValid, errorValues] = this.items.isValid(item);
      if (!isValid) {
        errors = [...errors, ...errorValues];
      }
    }
    return [errors.length === 0, errors];
  }

  val(value) {
    if (value === undefined) {
      value = this.default();
    }

    if (value !== undefined) {
      return this.toDDBSet(value);
    }
  }
}

class Schema {
  constructor(
    properties = {},
    facets = {},
    { traverser = new AttributeTraverser(), getClient, parent, isRoot } = {},
  ) {
    this._validateProperties(properties, parent);
    let schema = Schema.normalizeAttributes(properties, facets, {
      traverser,
      getClient,
      parent,
      isRoot,
    });
    this.getClient = getClient;
    this.attributes = schema.attributes;
    this.enums = schema.enums;
    this.translationForTable = schema.translationForTable;
    this.translationForRetrieval = schema.translationForRetrieval;
    this.hiddenAttributes = schema.hiddenAttributes;
    this.readOnlyAttributes = schema.readOnlyAttributes;
    this.requiredAttributes = schema.requiredAttributes;
    this.translationForWatching = this._formatWatchTranslations(
      this.attributes,
    );
    this.traverser = traverser;
    this.isRoot = !!isRoot;
  }

  static normalizeAttributes(
    attributes = {},
    facets = {},
    { traverser, getClient, parent, isRoot } = {},
  ) {
    const attributeHasParent = !!parent;
    let invalidProperties = [];
    let normalized = {};
    let usedAttrs = {};
    let enums = {};
    let translationForTable = {};
    let translationForRetrieval = {};
    let watchedAttributes = {};
    let requiredAttributes = new Set();
    let hiddenAttributes = new Set();
    let readOnlyAttributes = new Set();
    let definitions = {};
    for (let name in attributes) {
      let attribute = attributes[name];
      if (
        typeof attribute === AttributeTypes.string ||
        Array.isArray(attribute)
      ) {
        attribute = {
          type: attribute,
        };
      }
      const field = attribute.field || name;
      let isKeyField = false;
      let prefix = "";
      let postfix = "";
      let casing = KeyCasing.none;
      if (facets.byField && facets.byField[field] !== undefined) {
        for (const indexName of Object.keys(facets.byField[field])) {
          let definition = facets.byField[field][indexName];
          if (definition.facets.length > 1) {
            throw new e.ElectroError(
              e.ErrorCodes.InvalidIndexWithAttributeName,
              `Invalid definition for "${
                definition.type
              }" field on index "${u.formatIndexNameForDisplay(
                indexName,
              )}". The ${definition.type} field "${
                definition.field
              }" shares a field name with an attribute defined on the Entity, and therefore is not allowed to contain composite references to other attributes. Please either change the field name of the attribute, or redefine the index to use only the single attribute "${
                definition.field
              }".`,
            );
          }
          if (definition.isCustom) {
            const keyFieldLabels =
              facets.labels[indexName][definition.type].labels;
            // I am not sure how more than two would happen but it would mean either
            // 1. Code prior has an unknown edge-case.
            // 2. Method is being incorrectly used.
            if (keyFieldLabels.length > 2) {
              throw new e.ElectroError(
                e.ErrorCodes.InvalidIndexWithAttributeName,
                `Unexpected definition for "${
                  definition.type
                }" field on index "${u.formatIndexNameForDisplay(
                  indexName,
                )}". The ${definition.type} field "${
                  definition.field
                }" shares a field name with an attribute defined on the Entity, and therefore is not possible to have more than two labels as part of it's template. Please either change the field name of the attribute, or reformat the key template to reduce all pre-fixing or post-fixing text around the attribute reference to two.`,
              );
            }
            isKeyField = true;
            casing = definition.casing;
            // Walk through the labels, given the above exception handling, I'd expect the first element to
            // be the prefix and the second element to be the postfix.
            for (const value of keyFieldLabels) {
              if (value.name === field) {
                prefix = value.label || "";
              } else {
                postfix = value.label || "";
              }
            }
            if (
              attribute.type !== AttributeTypes.string &&
              !Array.isArray(attribute.type)
            ) {
              if (prefix.length > 0 || postfix.length > 0) {
                throw new e.ElectroError(
                  e.ErrorCodes.InvalidIndexWithAttributeName,
                  `definition for "${
                    definition.type
                  }" field on index "${u.formatIndexNameForDisplay(
                    indexName,
                  )}". Index templates may only have prefix or postfix values on "string" or "enum" type attributes. The ${
                    definition.type
                  } field "${field}" is type "${
                    attribute.type
                  }", and therefore cannot be used with prefixes or postfixes. Please either remove the prefixed or postfixed values from the template or change the field name of the attribute.`,
                );
              }
            }
          } else {
            // Upstream middleware should have taken care of this. An error here would mean:
            // 1. Code prior has an unknown edge-case.
            // 2. Method is being incorrectly used.
            throw new e.ElectroError(
              e.ErrorCodes.InvalidIndexCompositeWithAttributeName,
              `Unexpected definition for "${
                definition.type
              }" field on index "${u.formatIndexNameForDisplay(
                indexName,
              )}". The ${definition.type} field "${
                definition.field
              }" shares a field name with an attribute defined on the Entity, and therefore must be defined with a template. Please either change the field name of the attribute, or add a key template to the "${
                definition.type
              }" field on index "${u.formatIndexNameForDisplay(
                indexName,
              )}" with the value: "\${${definition.field}}"`,
            );
          }

          if (definition.inCollection) {
            throw new e.ElectroError(
              e.ErrorCodes.InvalidCollectionOnIndexWithAttributeFieldNames,
              `Invalid use of a collection on index "${u.formatIndexNameForDisplay(
                indexName,
              )}". The ${definition.type} field "${
                definition.field
              }" shares a field name with an attribute defined on the Entity, and therefore the index is not allowed to participate in a Collection. Please either change the field name of the attribute, or remove all collection(s) from the index.`,
            );
          }

          if (definition.field === field) {
            if (attribute.padding !== undefined) {
              throw new e.ElectroError(
                e.ErrorCodes.InvalidAttributeDefinition,
                `Invalid padding definition for the attribute "${name}". Padding is not currently supported for attributes that are also defined as table indexes.`,
              );
            }
          }
        }
      }

      let isKey =
        !!facets.byIndex &&
        facets.byIndex[TableIndex].all.find((facet) => facet.name === name);
      let definition = {
        name,
        field,
        getClient,
        casing,
        prefix,
        postfix,
        traverser,
        isKeyField: isKeyField || isKey,
        isRoot: !!isRoot,
        label: attribute.label,
        required: !!attribute.required,
        default: attribute.default,
        validate: attribute.validate,
        readOnly: !!attribute.readOnly || isKey,
        hidden: !!attribute.hidden,
        indexes: (facets.byAttr && facets.byAttr[name]) || [],
        type: attribute.type,
        get: attribute.get,
        set: attribute.set,
        watching: Array.isArray(attribute.watch) ? attribute.watch : [],
        items: attribute.items,
        properties: attribute.properties,
        parentPath: attribute.parentPath,
        parentType: attribute.parentType,
        padding: attribute.padding,
      };

      if (definition.type === AttributeTypes.custom) {
        definition.type = AttributeTypes.any;
      }

      if (attribute.watch !== undefined) {
        if (attribute.watch === AttributeWildCard) {
          definition.watchAll = true;
          definition.watching = [];
        } else if (Array.isArray(attribute.watch)) {
          definition.watching = attribute.watch;
        } else {
          throw new e.ElectroError(
            e.ErrorCodes.InvalidAttributeWatchDefinition,
            `Attribute Validation Error. The attribute '${name}' is defined to "watch" an invalid value of: '${attribute.watch}'. The watch property must either be a an array of attribute names, or the single string value of "${WatchAll}".`,
          );
        }
      } else {
        definition.watching = [];
      }

      if (definition.readOnly) {
        readOnlyAttributes.add(name);
      }

      if (definition.hidden) {
        hiddenAttributes.add(name);
      }

      if (definition.required) {
        requiredAttributes.add(name);
      }

      if (
        facets.byAttr &&
        facets.byAttr[definition.name] !== undefined &&
        !ValidFacetTypes.includes(definition.type) &&
        !Array.isArray(definition.type)
      ) {
        let assignedIndexes = facets.byAttr[name].map((assigned) =>
          assigned.index === "" ? "Table Index" : assigned.index,
        );
        throw new e.ElectroError(
          e.ErrorCodes.InvalidAttributeDefinition,
          `Invalid composite attribute definition: Composite attributes must be one of the following: ${ValidFacetTypes.join(
            ", ",
          )}. The attribute "${name}" is defined as being type "${
            attribute.type
          }" but is a composite attribute of the following indexes: ${assignedIndexes.join(
            ", ",
          )}`,
        );
      }

      if (usedAttrs[definition.field] || usedAttrs[name]) {
        invalidProperties.push({
          name,
          property: "field",
          value: definition.field,
          expected: `Unique field property, already used by attribute ${
            usedAttrs[definition.field]
          }`,
        });
      } else {
        usedAttrs[definition.field] = definition.name;
      }

      translationForTable[definition.name] = definition.field;
      translationForRetrieval[definition.field] = definition.name;

      for (let watched of definition.watching) {
        watchedAttributes[watched] = watchedAttributes[watched] || [];
        watchedAttributes[watched].push(name);
      }

      definitions[name] = definition;
    }

    for (let name of Object.keys(definitions)) {
      const definition = definitions[name];

      definition.watchedBy = Array.isArray(watchedAttributes[name])
        ? watchedAttributes[name]
        : [];

      switch (definition.type) {
        case AttributeTypes.map:
          normalized[name] = new MapAttribute(definition);
          break;
        case AttributeTypes.list:
          normalized[name] = new ListAttribute(definition);
          break;
        case AttributeTypes.set:
          normalized[name] = new SetAttribute(definition);
          break;
        default:
          normalized[name] = new Attribute(definition);
      }
    }

    let watchedWatchers = [];
    let watchingUnknownAttributes = [];
    for (let watched of Object.keys(watchedAttributes)) {
      if (normalized[watched] === undefined) {
        for (let attribute of watchedAttributes[watched]) {
          watchingUnknownAttributes.push({ attribute, watched });
        }
      } else if (normalized[watched].isWatcher()) {
        for (let attribute of watchedAttributes[watched]) {
          watchedWatchers.push({ attribute, watched });
        }
      }
    }

    if (watchingUnknownAttributes.length > 0) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidAttributeWatchDefinition,
        `Attribute Validation Error. The following attributes are defined to "watch" invalid/unknown attributes: ${watchingUnknownAttributes
          .map(({ watched, attribute }) => `"${attribute}"->"${watched}"`)
          .join(", ")}.`,
      );
    }

    if (watchedWatchers.length > 0) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidAttributeWatchDefinition,
        `Attribute Validation Error. Attributes may only "watch" other attributes also watch attributes. The following attributes are defined with ineligible attributes to watch: ${watchedWatchers
          .map(({ attribute, watched }) => `"${attribute}"->"${watched}"`)
          .join(", ")}.`,
      );
    }

    let missingFacetAttributes = Array.isArray(facets.attributes)
      ? facets.attributes
          .filter(({ name }) => !normalized[name])
          .map((facet) => `"${facet.type}: ${facet.name}"`)
      : [];
    if (missingFacetAttributes.length > 0) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidKeyCompositeAttributeTemplate,
        `Invalid key composite attribute template. The following composite attribute attributes were described in the key composite attribute template but were not included model's attributes: ${missingFacetAttributes.join(
          ", ",
        )}`,
      );
    }
    if (invalidProperties.length > 0) {
      let message = invalidProperties.map(
        (prop) =>
          `Schema Validation Error. Attribute "${prop.name}" property "${prop.property}". Received: "${prop.value}", Expected: "${prop.expected}"`,
      );
      throw new e.ElectroError(
        e.ErrorCodes.InvalidAttributeDefinition,
        message,
      );
    } else {
      return {
        enums,
        hiddenAttributes,
        readOnlyAttributes,
        requiredAttributes,
        translationForTable,
        translationForRetrieval,
        attributes: normalized,
      };
    }
  }

  _validateProperties() {}

  _formatWatchTranslations(attributes) {
    let watchersToAttributes = {};
    let attributesToWatchers = {};
    let watchAllAttributes = {};
    let hasWatchers = false;
    for (let name of Object.keys(attributes)) {
      if (attributes[name].isWatcher()) {
        hasWatchers = true;
        watchersToAttributes[name] = attributes[name].watching;
      } else if (attributes[name].watchAll) {
        hasWatchers = true;
        watchAllAttributes[name] = name;
      } else {
        attributesToWatchers[name] = attributesToWatchers[name] || {};
        attributesToWatchers[name] = attributes[name].watchedBy;
      }
    }
    return {
      hasWatchers,
      watchAllAttributes,
      watchersToAttributes,
      attributesToWatchers,
    };
  }

  getAttribute(path) {
    return this.traverser.getPath(path);
  }

  getLabels() {
    let labels = {};
    for (let name of Object.keys(this.attributes)) {
      let label = this.attributes[name].label;
      if (label !== undefined) {
        labels[name] = label;
      }
    }
    return labels;
  }

  getLabels() {
    let labels = {};
    for (let name of Object.keys(this.attributes)) {
      let label = this.attributes[name].label;
      if (label !== undefined) {
        labels[name] = label;
      }
    }
    return labels;
  }

  _applyAttributeMutation(method, include, avoid, payload) {
    let data = { ...payload };
    const getSiblings = () => ({ ...payload });
    for (let path of Object.keys(include)) {
      // this.attributes[attribute] !== undefined | Attribute exists as actual attribute. If `includeKeys` is turned on for example this will include values that do not have a presence in the model and therefore will not have a `.get()` method
      // avoid[attribute] === undefined           | Attribute shouldn't be in the avoided
      const attribute = this.getAttribute(path);
      if (attribute !== undefined && avoid[path] === undefined) {
        data[path] = attribute[method](payload[path], getSiblings);
      }
    }
    return data;
  }

  _fulfillAttributeMutationMethod(method, payload) {
    let watchersToTrigger = {};
    // include: payload               | We want to hit the getters/setters for any attributes coming in to be changed
    // avoid: watchersToAttributes    | We want to avoid anything that is a watcher, even if it was included
    let avoid = {
      ...this.translationForWatching.watchersToAttributes,
      ...this.translationForWatching.watchAllAttributes,
    };
    let data = this._applyAttributeMutation(method, payload, avoid, payload);
    // `data` here will include all the original payload values, but with the mutations applied to on non-watchers
    if (!this.translationForWatching.hasWatchers) {
      // exit early, why not
      return data;
    }
    for (let attribute of Object.keys(data)) {
      let watchers =
        this.translationForWatching.attributesToWatchers[attribute];
      // Any of the attributes on data have a watcher?
      if (watchers !== undefined) {
        watchersToTrigger = { ...watchersToTrigger, ...watchers };
      }
    }

    // include: ...data, ...watchersToTrigger | We want to hit attributes that were watching an attribute included in data, and include an properties that were skipped because they were a watcher
    // avoid: attributesToWatchers            | We want to avoid hit anything that was not a watcher because they were already hit once above
    let include = {
      ...data,
      ...watchersToTrigger,
      ...this.translationForWatching.watchAllAttributes,
    };
    return this._applyAttributeMutation(
      method,
      include,
      this.translationForWatching.attributesToWatchers,
      data,
    );
  }

  applyAttributeGetters(payload = {}) {
    return this._fulfillAttributeMutationMethod(
      AttributeMutationMethods.get,
      payload,
    );
  }

  applyAttributeSetters(payload = {}) {
    return this._fulfillAttributeMutationMethod(
      AttributeMutationMethods.set,
      payload,
    );
  }

  translateFromFields(item = {}, options = {}) {
    let data = {};
    let names = this.translationForRetrieval;
    for (let [attr, value] of Object.entries(item)) {
      let name = names[attr];
      if (name) {
        data[name] = value;
      } else if (options.data === DataOptions.includeKeys) {
        data[attr] = value;
      }
    }
    return data;
  }

  translateToFields(payload = {}) {
    let record = {};
    for (let [name, value] of Object.entries(payload)) {
      let field = this.getFieldName(name);
      if (value !== undefined) {
        record[field] = value;
      }
    }
    return record;
  }

  getFieldName(name) {
    if (typeof name === "string") {
      return this.translationForTable[name];
    }
  }

  checkCreate(payload = {}) {
    let record = {};
    for (let attribute of Object.values(this.attributes)) {
      let value = payload[attribute.name];
      record[attribute.name] = attribute.getValidate(value);
    }
    return record;
  }

  checkRemove(paths = []) {
    for (const path of paths) {
      const attribute = this.traverser.getPath(path);
      if (!attribute) {
        throw new e.ElectroAttributeValidationError(
          path,
          `Attribute "${path}" does not exist on model.`,
        );
      } else if (attribute.readOnly) {
        throw new e.ElectroAttributeValidationError(
          attribute.path,
          `Attribute "${attribute.path}" is Read-Only and cannot be removed`,
        );
      } else if (attribute.required) {
        throw new e.ElectroAttributeValidationError(
          attribute.path,
          `Attribute "${attribute.path}" is Required and cannot be removed`,
        );
      }
    }
    return paths;
  }

  checkOperation(attribute, operation, value) {
    if (attribute.required && operation === ItemOperations.remove) {
      throw new e.ElectroAttributeValidationError(
        attribute.path,
        `Attribute "${attribute.path}" is Required and cannot be removed`,
      );
    } else if (attribute.readOnly) {
      throw new e.ElectroAttributeValidationError(
        attribute.path,
        `Attribute "${attribute.path}" is Read-Only and cannot be updated`,
      );
    }

    return value === undefined ? undefined : attribute.getValidate(value);
  }

  checkUpdate(payload = {}, { allowReadOnly } = {}) {
    let record = {};
    for (let [path, value] of Object.entries(payload)) {
      let attribute = this.traverser.paths.get(path);
      if (attribute === undefined) {
        continue;
      }
      if (attribute.readOnly && !allowReadOnly) {
        throw new e.ElectroAttributeValidationError(
          attribute.path,
          `Attribute "${attribute.path}" is Read-Only and cannot be updated`,
        );
      } else {
        record[path] = attribute.getValidate(value);
      }
    }
    return record;
  }

  getReadOnly() {
    return Array.from(this.readOnlyAttributes);
  }

  getRequired() {
    return Array.from(this.requiredAttributes);
  }

  formatItemForRetrieval(item, config) {
    let returnAttributes = new Set(config.attributes || []);
    let hasUserSpecifiedReturnAttributes = returnAttributes.size > 0;
    let remapped = this.translateFromFields(item, config);
    let data = this._fulfillAttributeMutationMethod("get", remapped);
    if (this.hiddenAttributes.size > 0 || hasUserSpecifiedReturnAttributes) {
      for (let attribute of Object.keys(data)) {
        if (this.hiddenAttributes.has(attribute)) {
          delete data[attribute];
        }
        if (
          hasUserSpecifiedReturnAttributes &&
          !returnAttributes.has(attribute)
        ) {
          delete data[attribute];
        }
      }
    }
    return data;
  }
}

function createCustomAttribute(definition = {}) {
  return {
    ...definition,
    type: "custom",
  };
}

function CustomAttributeType(base) {
  const supported = ["string", "number", "boolean", "any"];
  if (!supported.includes(base)) {
    throw new Error(
      `OpaquePrimitiveType only supports base types: ${u.commaSeparatedString(
        supported,
      )}`,
    );
  }
  return base;
}

function createSchema(schema) {
  v.model(schema);
  return schema;
}

module.exports = {
  Schema,
  Attribute,
  CastTypes,
  SetAttribute,
  createSchema,
  CustomAttributeType,
  createCustomAttribute,
};
