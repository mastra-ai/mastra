const e = require("./errors");
const { KeyCasing } = require("./types");

const Validator = require("jsonschema").Validator;
Validator.prototype.customFormats.isFunction = function (input) {
  return typeof input === "function";
};
Validator.prototype.customFormats.isFunctionOrString = function (input) {
  return typeof input === "function" || typeof input === "string";
};
Validator.prototype.customFormats.isFunctionOrRegexp = function (input) {
  return typeof input === "function" || input instanceof RegExp;
};

let v = new Validator();

const Attribute = {
  id: "/Attribute",
  type: ["object", "string", "array"],
  required: ["type"],
  properties: {
    type: {
      // todo: only specific values
      type: ["string", "array"],
      // enum: ["string", "number", "boolean", "enum"],
    },
    field: {
      type: "string",
    },
    hidden: {
      type: "boolean",
    },
    watch: {
      type: ["array", "string"],
      items: {
        type: "string",
      },
    },
    label: {
      type: "string",
    },
    readOnly: {
      type: "boolean",
    },
    required: {
      type: "boolean",
    },
    cast: {
      type: "string",
      enum: ["string", "number"],
    },
    default: {
      type: "any",
    },
    validate: {
      type: "any",
      format: "isFunctionOrRegexp",
    },
    get: {
      type: "any",
      format: "isFunction",
    },
    set: {
      type: "any",
      format: "isFunction",
    },
    padding: {
      type: "object",
      required: ["length", "char"],
      properties: {
        length: {
          type: "number",
        },
        char: {
          type: "string",
        },
      },
    },
  },
};

const Index = {
  id: "/Index",
  type: "object",
  properties: {
    pk: {
      type: "object",
      required: true,
      properties: {
        field: {
          type: "string",
          required: true,
        },
        facets: {
          type: ["array", "string"],
          items: {
            type: "string",
          },
          required: false,
        },
        composite: {
          type: ["array"],
          items: {
            type: "string",
          },
          required: false,
        },
        template: {
          type: "string",
          required: false,
        },
        casing: {
          type: "string",
          enum: ["upper", "lower", "none", "default"],
          required: false,
        },
        cast: {
          type: "string",
          enum: ["string", "number"],
          required: false,
        },
        scope: {
          type: "string",
          required: false,
        },
      },
    },
    sk: {
      type: "object",
      required: ["field"],
      properties: {
        field: {
          type: "string",
          required: true,
        },
        facets: {
          type: ["array", "string"],
          required: false,
          items: {
            type: "string",
          },
        },
        composite: {
          type: ["array"],
          required: false,
          items: {
            type: "string",
          },
        },
        template: {
          type: "string",
          required: false,
        },
        casing: {
          type: "string",
          enum: ["upper", "lower", "none", "default"],
          required: false,
        },
        cast: {
          type: "string",
          enum: ["string", "number"],
          required: false,
        },
      },
    },
    index: {
      type: "string",
    },
    collection: {
      type: ["array", "string"],
    },
    type: {
      type: "string",
      enum: ["clustered", "isolated"],
      required: false,
    },
    condition: {
      type: "any",
      required: false,
      format: "isFunction",
    },
  },
};

const Modelv1 = {
  type: "object",
  required: true,
  properties: {
    model: {
      type: "object",
      required: true,
      properties: {
        entity: {
          type: "string",
          required: true,
        },
        version: {
          type: "string",
          required: true,
        },
        service: {
          type: "string",
          required: true,
        },
      },
    },
    table: {
      type: "string",
    },
    attributes: {
      type: "object",
      patternProperties: {
        ["."]: { $ref: "/Attribute" },
      },
    },
    indexes: {
      type: "object",
      minProperties: 1,
      patternProperties: {
        ["."]: { $ref: "/Index" },
      },
    },
    filters: { $ref: "/Filters" },
  },
  required: ["model", "attributes", "indexes"],
};

const ModelBeta = {
  type: "object",
  required: true,
  properties: {
    service: {
      type: "string",
      required: true,
    },
    entity: {
      type: "string",
      required: true,
    },
    table: {
      type: "string",
    },
    version: {
      type: "string",
    },
    attributes: {
      type: "object",
      patternProperties: {
        ["."]: { $ref: "/Attribute" },
      },
    },
    indexes: {
      type: "object",
      minProperties: 1,
      patternProperties: {
        ["."]: { $ref: "/Index" },
      },
    },
    filters: { $ref: "/Filters" },
  },
  required: ["attributes", "indexes"],
};

const Filters = {
  id: "/Filters",
  type: "object",
  patternProperties: {
    ["."]: {
      type: "any",
      format: "isFunction",
      message: "Requires function",
    },
  },
};

v.addSchema(Attribute, "/Attribute");
v.addSchema(Index, "/Index");
v.addSchema(Filters, "/Filters");
v.addSchema(ModelBeta, "/ModelBeta");
v.addSchema(Modelv1, "/Modelv1");

function validateModel(model = {}) {
  /** start beta/v1 condition **/
  let betaErrors = v.validate(model, "/ModelBeta").errors;
  if (betaErrors.length) {
    /** end/v1 condition **/
    let errors = v.validate(model, "/Modelv1").errors;
    if (errors.length) {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidModel,
        errors
          .map((err) => {
            let message = `${err.property}`;
            switch (err.argument) {
              case "isFunction":
                return `${message} must be a function`;
              case "isFunctionOrString":
                return `${message} must be either a function or string`;
              case "isFunctionOrRegexp":
                return `${message} must be either a function or Regexp`;
              default:
                return `${message} ${err.message}`;
            }
          })
          .join(", "),
      );
    }
  }
}

function testModel(model) {
  let isModel = false;
  let error = "";
  try {
    validateModel(model);
    isModel = true;
  } catch (err) {
    error = err.message;
  }
  return [isModel, error];
}

function isStringHasLength(str) {
  return typeof str === "string" && str.length > 0;
}

function isObjectHasLength(obj) {
  return typeof obj === "object" && Object.keys(obj).length > 0;
}

function isArrayHasLength(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

function isNameEntityRecordType(entityRecord) {
  return (
    isObjectHasLength(entityRecord) &&
    Object.values(entityRecord).find((value) => {
      return value._instance !== undefined;
    })
  );
}

function isNameModelRecordType(modelRecord) {
  return (
    isObjectHasLength(modelRecord) &&
    Object.values(modelRecord).find((value) => {
      return (
        value.model &&
        isStringHasLength(value.model.entity) &&
        isStringHasLength(value.model.version) &&
        isStringHasLength(value.model.service)
      );
    })
  );
}

function isBetaServiceConfig(serviceConfig) {
  return (
    isObjectHasLength(serviceConfig) &&
    (isStringHasLength(serviceConfig.service) ||
      isStringHasLength(serviceConfig.name)) &&
    isStringHasLength(serviceConfig.version)
  );
}

function isFunction(value) {
  return typeof value === "function";
}

function stringArrayMatch(arr1, arr2) {
  let areArrays = Array.isArray(arr1) && Array.isArray(arr2);
  let match = areArrays && arr1.length === arr2.length;
  for (let i = 0; i < arr1.length; i++) {
    if (!match) {
      break;
    }
    match = isStringHasLength(arr1[i]) && arr1[i] === arr2[i];
  }
  return match;
}

function isMatchingCasing(casing1, casing2) {
  const equivalentCasings = [KeyCasing.default, KeyCasing.lower];
  if (isStringHasLength(casing1) && isStringHasLength(casing2)) {
    let isRealCase = KeyCasing[casing1.toLowerCase()] !== undefined;
    let casingsMatch = casing1 === casing2;
    let casingsAreEquivalent = [casing1, casing2].every((casing) => {
      return casing === KeyCasing.lower || casing === KeyCasing.default;
    });
    return isRealCase && (casingsMatch || casingsAreEquivalent);
  } else if (isStringHasLength(casing1)) {
    return equivalentCasings.includes(casing1.toLowerCase());
  } else if (isStringHasLength(casing2)) {
    return equivalentCasings.includes(casing2.toLowerCase());
  } else {
    return casing1 === undefined && casing2 === undefined;
  }
}

module.exports = {
  testModel,
  isFunction,
  stringArrayMatch,
  isMatchingCasing,
  isArrayHasLength,
  isStringHasLength,
  isObjectHasLength,
  isBetaServiceConfig,
  isNameModelRecordType,
  isNameEntityRecordType,
  model: validateModel,
};
