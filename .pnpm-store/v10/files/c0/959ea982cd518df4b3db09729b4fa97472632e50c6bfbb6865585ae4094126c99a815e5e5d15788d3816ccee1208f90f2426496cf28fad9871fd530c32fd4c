const FilterOperations = {
  escape: {
    template: function escape(options, attr) {
      return `${attr}`;
    },
    rawValue: true,
  },
  size: {
    template: function size(options, attr, name) {
      return `size(${name})`;
    },
    strict: false,
  },
  type: {
    template: function attributeType(options, attr, name, value) {
      return `attribute_type(${name}, ${value})`;
    },
    strict: false,
  },
  ne: {
    template: function ne(options, attr, name, value) {
      return `${name} <> ${value}`;
    },
    strict: false,
  },
  eq: {
    template: function eq(options, attr, name, value) {
      return `${name} = ${value}`;
    },
    strict: false,
  },
  gt: {
    template: function gt(options, attr, name, value) {
      return `${name} > ${value}`;
    },
    strict: false,
  },
  lt: {
    template: function lt(options, attr, name, value) {
      return `${name} < ${value}`;
    },
    strict: false,
  },
  gte: {
    template: function gte(options, attr, name, value) {
      return `${name} >= ${value}`;
    },
    strict: false,
  },
  lte: {
    template: function lte(options, attr, name, value) {
      return `${name} <= ${value}`;
    },
    strict: false,
  },
  between: {
    template: function between(options, attr, name, value1, value2) {
      return `(${name} between ${value1} and ${value2})`;
    },
    strict: false,
  },
  begins: {
    template: function begins(options, attr, name, value) {
      return `begins_with(${name}, ${value})`;
    },
    strict: false,
  },
  exists: {
    template: function exists(options, attr, name) {
      return `attribute_exists(${name})`;
    },
    strict: false,
  },
  notExists: {
    template: function notExists(options, attr, name) {
      return `attribute_not_exists(${name})`;
    },
    strict: false,
  },
  contains: {
    template: function contains(options, attr, name, value) {
      return `contains(${name}, ${value})`;
    },
    strict: false,
  },
  notContains: {
    template: function notContains(options, attr, name, value) {
      return `not contains(${name}, ${value})`;
    },
    strict: false,
  },
  value: {
    template: function (options, attr, name, value) {
      return value;
    },
    strict: false,
    canNest: true,
  },
  name: {
    template: function (options, attr, name) {
      return name;
    },
    strict: false,
    canNest: true,
  },
  eqOrNotExists: {
    template: function eq(options, attr, name, value) {
      return `(${name} = ${value} OR attribute_not_exists(${name}))`;
    },
    strict: false,
  },
  field: {
    template: function (options, _, fieldName) {
      return fieldName !== undefined ? `${fieldName}` : "";
    },
    strict: false,
    canNest: true,
    rawField: true,
  },
};

module.exports = {
  FilterOperations,
};
