const { MethodTypes, ExpressionTypes, BuilderTypes } = require("./types");
const {
  AttributeOperationProxy,
  ExpressionState,
  FilterOperations,
} = require("./operations");
const e = require("./errors");

class FilterExpression extends ExpressionState {
  constructor(props) {
    super(props);
    this.expression = "";
    this.type = BuilderTypes.filter;
  }

  _trim(expression) {
    if (typeof expression === "string" && expression.length > 0) {
      return expression.replace(/\n|\r/g, "").trim();
    }
    return "";
  }

  _isEmpty(expression) {
    if (typeof expression !== "string") {
      throw new Error("Invalid expression value type. Expected type string.");
    }
    return !expression.replace(/\n|\r|\w/g, "").trim();
  }

  add(newExpression, filterOptions = {}) {
    const asPrefix = !!filterOptions.asPrefix;
    let expression = "";
    let existingExpression = this.expression;
    if (
      typeof existingExpression === "string" &&
      existingExpression.length > 0
    ) {
      newExpression = this._trim(newExpression);
      let isEmpty = this._isEmpty(newExpression);
      if (isEmpty) {
        return existingExpression;
      }

      if (
        !asPrefix &&
        !existingExpression.startsWith("(") &&
        !existingExpression.endsWith(")")
      ) {
        existingExpression = `(${existingExpression})`;
      }
      if (asPrefix) {
        expression = `(${newExpression}) AND ${existingExpression}`;
      } else {
        expression = `${existingExpression} AND ${newExpression}`;
      }
    } else {
      expression = this._trim(newExpression);
    }
    this.expression = expression;
  }

  // applies operations without verifying them against known attributes. Used internally for key conditions.
  unsafeSet(filterOptions, operation, name, ...values) {
    const { template } = FilterOperations[operation] || {};
    if (template === undefined) {
      throw new Error(
        `Invalid operation: "${operation}". Please report this issue via a bug ticket.`,
      );
    }
    const names = this.setName({}, name, name);
    const valueExpressions = values.map((value) => this.setValue(name, value));
    const condition = template(
      {},
      names.expression,
      names.prop,
      ...valueExpressions,
    );
    this.add(condition, filterOptions);
  }

  build() {
    return this.expression;
  }
}

class WhereFactory {
  constructor(attributes = {}, operations = {}) {
    this.attributes = { ...attributes };
    this.operations = { ...operations };
  }

  getExpressionType(methodType) {
    switch (methodType) {
      case MethodTypes.put:
      case MethodTypes.create:
      case MethodTypes.update:
      case MethodTypes.patch:
      case MethodTypes.delete:
      case MethodTypes.remove:
      case MethodTypes.upsert:
      case MethodTypes.get:
      case MethodTypes.check:
        return ExpressionTypes.ConditionExpression;
      default:
        return ExpressionTypes.FilterExpression;
    }
  }

  buildClause(cb) {
    if (typeof cb !== "function") {
      throw new e.ElectroError(
        e.ErrorCodes.InvalidWhere,
        'Where callback must be of type "function"',
      );
    }
    return (entity, state, ...params) => {
      const type = this.getExpressionType(state.query.method);
      const builder = state.query.filter[type];
      const proxy = new AttributeOperationProxy({
        builder,
        attributes: this.attributes,
        operations: this.operations,
      });
      const expression = proxy.invokeCallback(cb, ...params);
      if (typeof expression !== "string") {
        throw new e.ElectroError(
          e.ErrorCodes.InvalidWhere,
          "Invalid response from where clause callback. Expected return result to be of type string",
        );
      }
      builder.add(expression);
      return state;
    };
  }

  injectWhereClauses(clauses = {}, filters = {}) {
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
        name,
        action: this.buildClause(filter),
        children: ["params", "go", "commit", "where", ...modelFilters],
      };
    }
    filterChildren.push("where");
    injected["where"] = {
      name: "where",
      action: (entity, state, fn) => {
        return this.buildClause(fn)(entity, state);
      },
      children: ["params", "go", "commit", "where", ...modelFilters],
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

module.exports = {
  WhereFactory,
  FilterExpression,
};
