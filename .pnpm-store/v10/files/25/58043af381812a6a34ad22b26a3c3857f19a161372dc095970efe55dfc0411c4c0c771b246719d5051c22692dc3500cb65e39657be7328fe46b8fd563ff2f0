const e = require("./errors");
const { MethodTypes, ExpressionTypes } = require("./types");

class FilterFactory {
  constructor(attributes = {}, filterTypes = {}) {
    this.attributes = { ...attributes };
    this.filters = {
      ...filterTypes,
    };
  }

  getExpressionType(methodType) {
    switch (methodType) {
      case MethodTypes.put:
      case MethodTypes.create:
      case MethodTypes.update:
      case MethodTypes.patch:
      case MethodTypes.delete:
      case MethodTypes.get:
      case MethodTypes.upsert:
        return ExpressionTypes.ConditionExpression;
      default:
        return ExpressionTypes.FilterExpression;
    }
  }

  _buildFilterAttributes(setName, setValue) {
    let attributes = {};
    for (let [name, attribute] of Object.entries(this.attributes)) {
      let filterAttribute = {};
      for (let [type, { template }] of Object.entries(this.filters)) {
        Object.defineProperty(filterAttribute, type, {
          get: () => {
            return (...values) => {
              let { prop } = setName({}, name, attribute.field);
              let attrValues = [];
              for (let value of values) {
                if (template.length > 1) {
                  attrValues.push(setValue(name, value, name));
                }
              }
              let expression = template({}, attribute, prop, ...attrValues);
              return expression.trim();
            };
          },
        });
      }
      attributes[name] = filterAttribute;
    }
    return attributes;
  }

  buildClause(filterFn) {
    return (entity, state, ...params) => {
      const type = this.getExpressionType(state.query.method);
      const builder = state.query.filter[type];
      let setName = (paths, name, value) => builder.setName(paths, name, value);
      let setValue = (name, value, path) => builder.setValue(name, value, path);
      let attributes = this._buildFilterAttributes(setName, setValue);
      const expression = filterFn(attributes, ...params);
      if (typeof expression !== "string") {
        throw new e.ElectroError(
          e.ErrorCodes.InvalidFilter,
          "Invalid filter response. Expected result to be of type string",
        );
      }
      builder.add(expression);
      return state;
    };
  }

  injectFilterClauses(clauses = {}, filters = {}) {
    let injected = { ...clauses };
    let filterParents = Object.entries(injected)
      .filter((clause) => {
        let [name, { children }] = clause;
        return children.find((child) => ["go", "commit"].includes(child));
      })
      .map(([name]) => name);
    let modelFilters = Object.keys(filters);
    let filterChildren = [];
    for (let [name, filter] of Object.entries(filters)) {
      filterChildren.push(name);
      injected[name] = {
        name: name,
        action: this.buildClause(filter),
        children: ["params", "go", "commit", "filter", ...modelFilters],
      };
    }
    filterChildren.push("filter");
    injected["filter"] = {
      name: "filter",
      action: (entity, state, fn) => {
        return this.buildClause(fn)(entity, state);
      },
      children: ["params", "go", "commit", "filter", ...modelFilters],
    };
    for (let parent of filterParents) {
      injected[parent] = { ...injected[parent] };
      injected[parent].children = [
        ...filterChildren,
        ...injected[parent].children,
      ];
    }
    return injected;
  }
}

module.exports = { FilterFactory };
