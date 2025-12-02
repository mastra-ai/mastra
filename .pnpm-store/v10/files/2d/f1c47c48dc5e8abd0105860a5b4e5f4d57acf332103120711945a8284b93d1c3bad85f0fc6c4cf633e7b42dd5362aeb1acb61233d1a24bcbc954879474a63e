const {
  AttributeTypes,
  ItemOperations,
  AttributeProxySymbol,
  BuilderTypes,
} = require("./types");
const { UpdateOperations } = require("./updateOperations");
const { FilterOperations } = require("./filterOperations");
const e = require("./errors");
const u = require("./util");

class ExpressionState {
  constructor({ prefix } = {}) {
    this.names = {};
    this.values = {};
    this.paths = {};
    this.counts = {};
    this.impacted = {};
    this.expression = "";
    this.prefix = prefix || "";
    this.refs = {};
    this.formattedNameToOriginalNameMap = new Map();
  }

  incrementName(name) {
    if (this.counts[name] === undefined) {
      this.counts[name] = 0;
    }
    return `${this.prefix}${this.counts[name]++}`;
  }

  formatName(name = "") {
    const nameWasNotANumber = isNaN(name);
    const originalName = `${name}`;
    let formattedName = originalName.replaceAll(/[^\w]/g, "");

    if (formattedName.length === 0) {
      formattedName = "p";
    } else if (nameWasNotANumber !== isNaN(formattedName)) {
      // name became number due to replace
      formattedName = `p${formattedName}`;
    }

    const originalFormattedName = formattedName;
    let nameSuffix = 1;

    while (
      this.formattedNameToOriginalNameMap.has(formattedName) &&
      this.formattedNameToOriginalNameMap.get(formattedName) !== originalName
    ) {
      formattedName = `${originalFormattedName}_${++nameSuffix}`;
    }

    this.formattedNameToOriginalNameMap.set(formattedName, originalName);
    return formattedName;
  }

  // todo: make the structure: name, value, paths
  setName(paths, name, value) {
    name = this.formatName(name);
    let json = "";
    let expression = "";
    const prop = `#${name}`;
    if (Object.keys(paths).length === 0) {
      json = `${name}`;
      expression = `${prop}`;
      this.names[prop] = value;
    } else if (isNaN(name)) {
      json = `${paths.json}.${name}`;
      expression = `${paths.expression}.${prop}`;
      this.names[prop] = value;
    } else {
      json = `${paths.json}[${name}]`;
      expression = `${paths.expression}[${name}]`;
    }
    return { json, expression, prop };
  }

  getNames() {
    return this.names;
  }

  setValue(name, value) {
    name = this.formatName(name);
    let valueCount = this.incrementName(name);
    let expression = `:${name}${valueCount}`;
    this.values[expression] = value;
    return expression;
  }

  updateValue(name, value) {
    this.values[name] = value;
  }

  getValues() {
    return this.values;
  }

  setPath(path, value) {
    this.paths[path] = value;
  }

  setExpression(expression) {
    this.expression = expression;
  }

  getExpression() {
    return this.expression;
  }

  setImpacted(operation, path, ref) {
    this.impacted[path] = operation;
    this.refs[path] = ref;
  }
}

class AttributeOperationProxy {
  constructor({ builder, attributes = {}, operations = {} }) {
    this.ref = {
      attributes,
      operations,
    };
    this.attributes = AttributeOperationProxy.buildAttributes(
      builder,
      attributes,
    );
    this.operations = AttributeOperationProxy.buildOperations(
      builder,
      operations,
    );
  }

  invokeCallback(op, ...params) {
    return op(this.attributes, this.operations, ...params);
  }

  performOperation({ operation, path, value, force = false }) {
    if (value === undefined) {
      return;
    }
    const parts = u.parseJSONPath(path);
    let attribute = this.attributes;
    for (let part of parts) {
      attribute = attribute[part];
    }
    if (attribute) {
      this.operations[operation](attribute, value);
      const { target } = attribute();
      if (target.readOnly && !force) {
        throw new Error(
          `Attribute "${target.path}" is Read-Only and cannot be updated`,
        );
      }
    }
  }

  fromObject(operation, record) {
    for (let path of Object.keys(record)) {
      this.performOperation({
        operation,
        path,
        value: record[path],
      });
    }
  }

  fromArray(operation, paths) {
    for (let path of paths) {
      const parts = u.parseJSONPath(path);
      let attribute = this.attributes;
      for (let part of parts) {
        attribute = attribute[part];
      }
      if (attribute) {
        this.operations[operation](attribute);
        const { target } = attribute();
        if (target.readOnly) {
          throw new Error(
            `Attribute "${target.path}" is Read-Only and cannot be updated`,
          );
        } else if (operation === ItemOperations.remove && target.required) {
          throw new Error(
            `Attribute "${target.path}" is Required and cannot be removed`,
          );
        }
      }
    }
  }

  static buildOperations(builder, operations) {
    let ops = {};
    let seen = new Map();
    for (let operation of Object.keys(operations)) {
      let { template, canNest, rawValue, rawField } = operations[operation];
      Object.defineProperty(ops, operation, {
        get: () => {
          return (property, ...values) => {
            if (property === undefined) {
              throw new e.ElectroError(
                e.ErrorCodes.InvalidWhere,
                `Invalid/Unknown property passed in where clause passed to operation: '${operation}'`,
              );
            }
            if (property[AttributeProxySymbol]) {
              const { commit, target } = property();
              const fixedValues = values
                .map((value) => target.applyFixings(value))
                .filter((value) => value !== undefined);
              const isFilterBuilder = builder.type === BuilderTypes.filter;
              const takesValueArgument = template.length > 3;
              const isAcceptableValue = fixedValues.every((value) => {
                const seenAttributes = seen.get(value);
                if (seenAttributes) {
                  return seenAttributes.every((v) => target.acceptable(v));
                }
                return target.acceptable(value);
              });

              const shouldCommit =
                // if it is a filterBuilder than we don't care what they pass because the user needs more freedom here
                isFilterBuilder ||
                // if the operation does not take a value argument then not committing here could cause problems.
                // this should be revisited to make more robust, we could hypothetically store the commit in the
                // "seen" map for when the value is used, but that's a lot of new complexity
                !takesValueArgument ||
                // if the operation takes a value, we should determine if that value is acceptable. For
                // example, in the cases of a "set" we check to see if it is empty, or if the value is
                // undefined, we should not commit. The "fixedValues" length check is because the
                // "fixedValues" array has been filtered for undefined, so no length there indicates an
                // undefined value was passed.
                (takesValueArgument &&
                  isAcceptableValue &&
                  fixedValues.length > 0);

              if (!shouldCommit) {
                return "";
              }

              const paths = commit();
              const attributeValues = [];
              let hasNestedValue = false;
              for (let fixedValue of fixedValues) {
                if (seen.has(fixedValue)) {
                  attributeValues.push(fixedValue);
                  hasNestedValue = true;
                } else {
                  let attributeValueName = builder.setValue(
                    target.name,
                    fixedValue,
                  );
                  builder.setPath(paths.json, {
                    value: fixedValue,
                    name: attributeValueName,
                  });
                  attributeValues.push(attributeValueName);
                }
              }

              const options = {
                nestedValue: hasNestedValue,
                createValue: (name, value) =>
                  builder.setValue(`${target.name}_${name}`, value),
              };

              const formatted = template(
                options,
                target,
                paths.expression,
                ...attributeValues,
              );
              builder.setImpacted(operation, paths.json, target);
              if (canNest) {
                seen.set(paths.expression, attributeValues);
                seen.set(formatted, attributeValues);
              }

              if (
                builder.type === BuilderTypes.update &&
                formatted &&
                typeof formatted.operation === "string" &&
                typeof formatted.expression === "string"
              ) {
                builder.add(formatted.operation, formatted.expression);
                return formatted.expression;
              }

              return formatted;
            } else if (rawValue) {
              // const {json, expression} = builder.setName({}, property, property);
              let attributeValueName = builder.setValue(property, property);
              builder.setPath(property, {
                value: property,
                name: attributeValueName,
              });
              const formatted = template({}, attributeValueName);
              seen.set(attributeValueName, [property]);
              seen.set(formatted, [property]);
              return formatted;
            } else if (rawField) {
              const { prop, expression } = builder.setName(
                {},
                property,
                property,
              );
              const formatted = template({}, null, prop);
              seen.set(expression, [property]);
              seen.set(formatted, [property]);
              return formatted;
            } else {
              throw new e.ElectroError(
                e.ErrorCodes.InvalidWhere,
                `Invalid Attribute in where clause passed to operation '${operation}'. Use injected attributes only.`,
              );
            }
          };
        },
      });
    }
    return ops;
  }

  static pathProxy(build) {
    return new Proxy(() => build(), {
      get: (_, prop, o) => {
        if (prop === AttributeProxySymbol) {
          return true;
        } else {
          return AttributeOperationProxy.pathProxy(() => {
            const { commit, root, target, builder } = build();
            const attribute = target.getChild(prop);
            const nestedAny =
              attribute.type === AttributeTypes.any &&
              // if the name doesn't match that's because we are nested under 'any'
              attribute.name !== prop;
            let field;
            if (attribute === undefined) {
              throw new Error(
                `Invalid attribute "${prop}" at path "${target.path}.${prop}"`,
              );
            } else if (nestedAny) {
              field = prop;
            } else {
              field = attribute.field;
            }

            return {
              root,
              builder,
              nestedAny,
              target: attribute,
              commit: () => {
                const paths = commit();
                return builder.setName(paths, prop, field);
              },
            };
          });
        }
      },
    });
  }

  static buildAttributes(builder, attributes) {
    let attr = {};
    for (let [name, attribute] of Object.entries(attributes)) {
      Object.defineProperty(attr, name, {
        get: () => {
          return AttributeOperationProxy.pathProxy(() => {
            return {
              root: attribute,
              target: attribute,
              builder,
              commit: () =>
                builder.setName({}, attribute.name, attribute.field),
            };
          });
        },
      });
    }
    return attr;
  }
}

const FilterOperationNames = Object.keys(FilterOperations).reduce(
  (ops, name) => {
    ops[name] = name;
    return ops;
  },
  {},
);

const UpdateOperationNames = Object.keys(UpdateOperations).reduce(
  (ops, name) => {
    ops[name] = name;
    return ops;
  },
  {},
);

module.exports = {
  UpdateOperations,
  UpdateOperationNames,
  FilterOperations,
  FilterOperationNames,
  ExpressionState,
  AttributeOperationProxy,
};
