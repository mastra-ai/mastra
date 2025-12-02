const { AttributeTypes, ItemOperations } = require("./types");

const deleteOperations = {
  canNest: false,
  template: function del(options, attr, path, value) {
    let operation = "";
    let expression = "";
    switch (attr.type) {
      case AttributeTypes.any:
      case AttributeTypes.set:
        operation = ItemOperations.delete;
        expression = `${path} ${value}`;
        break;
      default:
        throw new Error(
          `Invalid Update Attribute Operation: "DELETE" Operation can only be performed on attributes with type "set" or "any".`,
        );
    }
    return { operation, expression };
  },
};

const UpdateOperations = {
  ifNotExists: {
    template: function if_not_exists(options, attr, path, value) {
      const operation = ItemOperations.set;
      const expression = `${path} = if_not_exists(${path}, ${value})`;
      return { operation, expression };
    },
  },
  name: {
    canNest: true,
    template: function name(options, attr, path) {
      return path;
    },
  },
  value: {
    canNest: true,
    template: function value(options, attr, path, value) {
      return value;
    },
  },
  append: {
    canNest: false,
    template: function append(options, attr, path, value) {
      let operation = "";
      let expression = "";
      switch (attr.type) {
        case AttributeTypes.any:
        case AttributeTypes.list:
          const defaultValue = options.createValue("default_value", []);
          expression = `${path} = list_append(if_not_exists(${path}, ${defaultValue}), ${value})`;
          operation = ItemOperations.set;
          break;
        default:
          throw new Error(
            `Invalid Update Attribute Operation: "APPEND" Operation can only be performed on attributes with type "list" or "any".`,
          );
      }
      return { operation, expression };
    },
  },
  add: {
    canNest: false,
    template: function add(options, attr, path, value, defaultValue) {
      let operation = "";
      let expression = "";
      let type = attr.type;
      if (type === AttributeTypes.any) {
        type =
          typeof value === "number"
            ? AttributeTypes.number
            : AttributeTypes.any;
      }
      switch (type) {
        case AttributeTypes.any:
        case AttributeTypes.set: {
          operation = ItemOperations.add;
          expression = `${path} ${value}`;
          break;
        }
        case AttributeTypes.number: {
          if (options.nestedValue) {
            operation = ItemOperations.set;
            expression = `${path} = ${path} + ${value}`;
          } else if (defaultValue !== undefined) {
            // const defaultValueName = options.createValue(`default_value`, defaultValue)
            operation = ItemOperations.set;
            expression = `${path} = (if_not_exists(${path}, ${defaultValue}) + ${value})`;
          } else {
            operation = ItemOperations.add;
            expression = `${path} ${value}`;
          }
          break;
        }
        default:
          throw new Error(
            `Invalid Update Attribute Operation: "ADD" Operation can only be performed on attributes with type "number", "set", or "any".`,
          );
      }
      return { operation, expression };
    },
  },
  subtract: {
    canNest: false,
    template: function subtract(options, attr, path, value, defaultValue = 0) {
      let operation = "";
      let expression = "";
      switch (attr.type) {
        case AttributeTypes.any:
        case AttributeTypes.number: {
          let resolvedDefaultValue;
          if (
            typeof defaultValue === "string" &&
            defaultValue.startsWith(":")
          ) {
            resolvedDefaultValue = defaultValue;
          } else if (defaultValue !== undefined) {
            resolvedDefaultValue = options.createValue(
              "default_value",
              defaultValue,
            );
          } else {
            resolvedDefaultValue = options.createValue("default_value", 0);
          }
          // const defaultValuePath = options.createValue('default_value', resolvedDefaultValue);
          operation = ItemOperations.set;
          expression = `${path} = (if_not_exists(${path}, ${resolvedDefaultValue}) - ${value})`;
          break;
        }
        default:
          throw new Error(
            `Invalid Update Attribute Operation: "SUBTRACT" Operation can only be performed on attributes with type "number" or "any".`,
          );
      }

      return { operation, expression };
    },
  },
  set: {
    canNest: false,
    template: function set(options, attr, path, value) {
      let operation = "";
      let expression = "";
      switch (attr.type) {
        case AttributeTypes.set:
        case AttributeTypes.list:
        case AttributeTypes.map:
        case AttributeTypes.enum:
        case AttributeTypes.string:
        case AttributeTypes.number:
        case AttributeTypes.boolean:
        case AttributeTypes.any:
          operation = ItemOperations.set;
          expression = `${path} = ${value}`;
          break;
        default:
          throw new Error(
            `Invalid Update Attribute Operation: "SET" Operation can only be performed on attributes with type "list", "map", "string", "number", "boolean", or "any".`,
          );
      }
      return { operation, expression };
    },
  },
  remove: {
    canNest: false,
    template: function remove(options, attr, ...paths) {
      let operation = "";
      let expression = "";
      switch (attr.type) {
        case AttributeTypes.set:
        case AttributeTypes.any:
        case AttributeTypes.list:
        case AttributeTypes.map:
        case AttributeTypes.string:
        case AttributeTypes.number:
        case AttributeTypes.boolean:
        case AttributeTypes.enum:
          operation = ItemOperations.remove;
          expression = paths.join(", ");
          break;
        default: {
          throw new Error(
            `Invalid Update Attribute Operation: "REMOVE" Operation can only be performed on attributes with type "map", "list", "string", "number", "boolean", or "any".`,
          );
        }
      }
      return { operation, expression };
    },
  },
  del: deleteOperations,
  delete: deleteOperations,
};

module.exports = {
  UpdateOperations,
};
