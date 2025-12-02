const t = require("./types");
const v = require("./validations");

function parseJSONPath(path = "") {
  if (typeof path !== "string") {
    throw new Error("Path must be a string");
  }
  path = path.replace(/\[/g, ".");
  path = path.replace(/\]/g, "");
  return path.split(".").filter((part) => part !== "");
}

function genericizeJSONPath(path = "") {
  return path.replace(/\[\d+\]/g, "[*]");
}

function getInstanceType(instance = {}) {
  let [isModel, errors] = v.testModel(instance);
  if (!instance || Object.keys(instance).length === 0) {
    return "";
  } else if (isModel) {
    return t.ElectroInstanceTypes.model;
  } else if (instance._instance === t.ElectroInstance.entity) {
    return t.ElectroInstanceTypes.entity;
  } else if (instance._instance === t.ElectroInstance.service) {
    return t.ElectroInstanceTypes.service;
  } else if (instance._instance === t.ElectroInstance.electro) {
    return t.ElectroInstanceTypes.electro;
  } else {
    return "";
  }
}

function getModelVersion(model = {}) {
  let nameOnRoot = model && v.isStringHasLength(model.entity);
  let nameInModelNamespace =
    model && model.model && v.isStringHasLength(model.model.entity);
  if (nameInModelNamespace) {
    return t.ModelVersions.v1;
  } else if (nameOnRoot) {
    return t.ModelVersions.beta;
  } else {
    return "";
  }
}

function applyBetaModelOverrides(
  model = {},
  { service = "", version = "", table = "" } = {},
) {
  let type = getModelVersion(model);
  if (type !== t.ModelVersions.beta) {
    throw new Error("Invalid model");
  }
  let copy = Object.assign({}, model);
  if (v.isStringHasLength(service)) {
    copy.service = service;
  }
  if (v.isStringHasLength(version)) {
    copy.version = version;
  }
  if (v.isStringHasLength(table)) {
    copy.table = table;
  }
  return copy;
}

function batchItems(arr = [], size) {
  if (isNaN(size)) {
    throw new Error("Batch size must be of type number");
  }
  let batched = [];
  for (let i = 0; i < arr.length; i++) {
    let partition = Math.floor(i / size);
    batched[partition] = batched[partition] || [];
    batched[partition].push(arr[i]);
  }
  return batched;
}

function commaSeparatedString(array = [], prefix = '"', postfix = '"') {
  return array.map((value) => `${prefix}${value}${postfix}`).join(", ");
}

function formatStringCasing(str, casing, defaultCase) {
  if (typeof str !== "string") {
    return str;
  }
  let strCase = defaultCase;
  if (v.isStringHasLength(casing) && typeof t.KeyCasing[casing] === "string") {
    strCase =
      t.KeyCasing.default === casing ? defaultCase : t.KeyCasing[casing];
  }
  switch (strCase) {
    case t.KeyCasing.upper:
      return str.toUpperCase();
    case t.KeyCasing.none:
      return str;
    case t.KeyCasing.lower:
      return str.toLowerCase();
    case t.KeyCasing.default:
    default:
      return str;
  }
}

function toKeyCasingOption(casing) {
  switch(casing) {
    case t.KeyCasing.upper:
      return t.KeyCasing.upper;
    case t.KeyCasing.none:
      return t.KeyCasing.none;
    case t.KeyCasing.lower:
      return t.KeyCasing.lower;
    case t.KeyCasing.default:
    case undefined:
      return t.DefaultKeyCasing;
    default:
      throw new Error(`Unknown casing option: ${casing}`);
  }
}

function formatKeyCasing(str, casing) {
  return formatStringCasing(str, casing, t.DefaultKeyCasing);
}

function formatAttributeCasing(str, casing) {
  return formatStringCasing(str, casing, t.KeyCasing.none);
}

function formatIndexNameForDisplay(index) {
  if (index) {
    return index;
  } else {
    return "(Primary Index)";
  }
}

class BatchGetOrderMaintainer {
  constructor({ table, enabled, keyFormatter }) {
    this.table = table;
    this.enabled = enabled;
    this.keyFormatter = keyFormatter;
    this.batchIndexMap = new Map();
    this.currentSlot = 0;
  }

  getSize() {
    return this.batchIndexMap.size;
  }

  getOrder(item) {
    const key = this.keyFormatter(item);
    const value = this.batchIndexMap.get(key);
    if (value === undefined) {
      return -1;
    }
    return value;
  }

  defineOrder(parameters = []) {
    if (this.enabled) {
      for (let i = 0; i < parameters.length; i++) {
        const batchParams = parameters[i];
        const recordKeys =
          (batchParams &&
            batchParams.RequestItems &&
            batchParams.RequestItems[this.table] &&
            batchParams.RequestItems[this.table].Keys) ||
          [];
        for (const recordKey of recordKeys) {
          const indexMapKey = this.keyFormatter(recordKey);
          this.batchIndexMap.set(indexMapKey, this.currentSlot++);
        }
      }
    }
  }
}

function getUnique(arr1, arr2) {
  return Array.from(new Set([...arr1, ...arr2]));
}

const cursorFormatter = {
  serialize: (key) => {
    if (!key) {
      return null;
    } else if (typeof val !== "string") {
      key = JSON.stringify(key);
    }
    return Buffer.from(key).toString("base64url");
  },
  deserialize: (cursor) => {
    if (!cursor) {
      return undefined;
    } else if (typeof cursor !== "string") {
      throw new Error(
        `Invalid cursor provided, expected type 'string' recieved: ${JSON.stringify(
          cursor,
        )}`,
      );
    }
    try {
      return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    } catch (err) {
      throw new Error("Unable to parse cursor");
    }
  },
};

function removeFixings({ prefix = "", postfix = "", value = "" } = {}) {
  if (prefix === "" && postfix === "") return value;

  const valueLower = value.toLowerCase();

  const start = valueLower.startsWith(prefix.toLowerCase()) ? prefix.length : 0;
  const end =
    value.length -
    (valueLower.endsWith(postfix.toLowerCase()) ? postfix.length : 0);

  return value.slice(start, end);
}

function addPadding({ padding = {}, value = "" } = {}) {
  return value.padStart(padding.length, padding.char);
}

function removePadding({ padding = {}, value = "" } = {}) {
  if (!padding.length || value.length >= padding.length) {
    return value;
  }

  let formatted = "";
  let useRemaining = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (useRemaining || i >= padding.length) {
      formatted += char;
    } else if (char !== padding.char) {
      formatted += char;
      useRemaining = true;
    }
  }

  return formatted;
}

function shiftSortOrder(str = "", codePoint) {
  let newString = "";
  for (let i = 0; i < str.length; i++) {
    const isLast = i === str.length - 1;
    let char = str[i];
    if (isLast) {
      char = String.fromCodePoint(char.codePointAt(0) + codePoint);
    }
    newString += char;
  }
  return newString;
}

function getFirstDefined(...params) {
  return params.find((val) => val !== undefined);
}

function regexpEscape(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  getUnique,
  batchItems,
  addPadding,
  regexpEscape,
  removePadding,
  removeFixings,
  parseJSONPath,
  shiftSortOrder,
  getFirstDefined,
  getInstanceType,
  getModelVersion,
  formatKeyCasing,
  cursorFormatter,
  toKeyCasingOption,
  genericizeJSONPath,
  commaSeparatedString,
  formatAttributeCasing,
  applyBetaModelOverrides,
  formatIndexNameForDisplay,
  BatchGetOrderMaintainer,
};
