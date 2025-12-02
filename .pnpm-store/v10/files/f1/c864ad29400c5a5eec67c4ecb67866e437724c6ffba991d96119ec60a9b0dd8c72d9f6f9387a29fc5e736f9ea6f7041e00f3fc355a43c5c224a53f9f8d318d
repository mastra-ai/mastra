const { UpdateOperations } = require("./updateOperations");
const { AttributeOperationProxy, ExpressionState } = require("./operations");
const { ItemOperations, BuilderTypes } = require("./types");

class UpdateExpression extends ExpressionState {
  constructor(props = {}) {
    super({ ...props });
    this.operations = {
      set: new Set(),
      remove: new Set(),
      add: new Set(),
      subtract: new Set(),
      delete: new Set(),
    };
    this.composites = {};
    this.seen = new Map();
    this.type = BuilderTypes.update;
  }
  addComposite(attrName, value) {
    if (value !== undefined) {
      if (
        this.composites[attrName] === undefined ||
        this.composites[attrName] === value
      ) {
        this.composites[attrName] = value;
        return true;
      }
    }
    return false;
  }

  add(type, expression) {
    this.operations[type].add(expression);
  }

  unadd(type, expression) {
    this.operations[type].delete(expression);
  }

  set(name, value, operation = ItemOperations.set, attribute) {
    let operationToApply = operation;
    if (operation === ItemOperations.ifNotExists) {
      operationToApply = ItemOperations.set;
    }
    const seen = this.seen.get(name);
    let n;
    let v;
    if (seen) {
      n = seen.name;
      v = seen.value;
      this.unadd(operationToApply, seen.expression);
    } else {
      n = this.setName({}, name, name);
      v = this.setValue(name, value);
    }
    let expression = `${n.prop} = ${v}`;
    if (operation === ItemOperations.ifNotExists) {
      expression = `${n.prop} = if_not_exists(${n.prop}, ${v})`;
    }
    this.seen.set(name, {
      name: n,
      value: v,
      expression,
    });
    this.add(operationToApply, expression);
  }

  remove(name) {
    const n = this.setName({}, name, name);
    this.add(ItemOperations.remove, `${n.prop}`);
  }

  build() {
    let expressions = [];
    for (const type of Object.keys(this.operations)) {
      const operations = this.operations[type];
      if (operations.size > 0) {
        expressions.push(
          `${type.toUpperCase()} ${Array.from(operations).join(", ")}`,
        );
      }
    }
    return expressions.join(" ");
  }
}

class UpdateEntity {
  constructor(attributes = {}, operations = {}) {
    this.attributes = { ...attributes };
    this.operations = { ...operations };
  }

  buildCallbackHandler(entity, state) {
    const proxy = new AttributeOperationProxy({
      builder: state.query.update,
      attributes: this.attributes,
      operations: this.operations,
    });

    return (cb, ...params) => {
      if (typeof cb !== "function") {
        throw new Error('Update Callback must be of type "function"');
      }
      proxy.invokeCallback(cb, ...params);
    };
  }
}

module.exports = {
  UpdateEntity,
  UpdateExpression,
};
