// src/underscore.ts
var toSentence = (items) => {
  if (items.length == 0) {
    return "";
  }
  if (items.length == 1) {
    return items[0];
  }
  let sentence = items.slice(0, -1).join(", ");
  sentence += `, or ${items.slice(-1)}`;
  return sentence;
};
var IP_V4_ADDRESS_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
function isIPV4Address(str) {
  return IP_V4_ADDRESS_REGEX.test(str || "");
}
function titleize(str) {
  const s = str || "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function snakeToCamel(str) {
  return str ? str.replace(/([-_][a-z])/g, (match) => match.toUpperCase().replace(/-|_/, "")) : "";
}
function camelToSnake(str) {
  return str ? str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) : "";
}
var createDeepObjectTransformer = (transform) => {
  const deepTransform = (obj) => {
    if (!obj) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((el) => {
        if (typeof el === "object" || Array.isArray(el)) {
          return deepTransform(el);
        }
        return el;
      });
    }
    const copy = { ...obj };
    const keys = Object.keys(copy);
    for (const oldName of keys) {
      const newName = transform(oldName.toString());
      if (newName !== oldName) {
        copy[newName] = copy[oldName];
        delete copy[oldName];
      }
      if (typeof copy[newName] === "object") {
        copy[newName] = deepTransform(copy[newName]);
      }
    }
    return copy;
  };
  return deepTransform;
};
var deepCamelToSnake = createDeepObjectTransformer(camelToSnake);
var deepSnakeToCamel = createDeepObjectTransformer(snakeToCamel);
function isTruthy(value) {
  if (typeof value === `boolean`) {
    return value;
  }
  if (value === void 0 || value === null) {
    return false;
  }
  if (typeof value === `string`) {
    if (value.toLowerCase() === `true`) {
      return true;
    }
    if (value.toLowerCase() === `false`) {
      return false;
    }
  }
  const number = parseInt(value, 10);
  if (isNaN(number)) {
    return false;
  }
  if (number > 0) {
    return true;
  }
  return false;
}
function getNonUndefinedValues(obj) {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== void 0) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export {
  toSentence,
  isIPV4Address,
  titleize,
  snakeToCamel,
  camelToSnake,
  deepCamelToSnake,
  deepSnakeToCamel,
  isTruthy,
  getNonUndefinedValues
};
//# sourceMappingURL=chunk-GGFRMWFO.mjs.map