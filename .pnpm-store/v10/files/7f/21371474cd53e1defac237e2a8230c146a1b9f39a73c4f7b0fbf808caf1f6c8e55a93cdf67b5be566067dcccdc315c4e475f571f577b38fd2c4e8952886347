"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckConstraintBuilder = void 0;
class CheckConstraintBuilder {
    #node;
    constructor(node) {
        this.#node = node;
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
    toOperationNode() {
        return this.#node;
    }
}
exports.CheckConstraintBuilder = CheckConstraintBuilder;
