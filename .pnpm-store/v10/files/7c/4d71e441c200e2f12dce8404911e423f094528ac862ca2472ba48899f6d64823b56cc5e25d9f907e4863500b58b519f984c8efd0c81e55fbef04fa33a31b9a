"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitQueue = void 0;
const linked_list_1 = require("../client/linked-list");
class WaitQueue {
    #list = new linked_list_1.SinglyLinkedList();
    #queue = new linked_list_1.SinglyLinkedList();
    push(value) {
        const resolve = this.#queue.shift();
        if (resolve !== undefined) {
            resolve(value);
            return;
        }
        this.#list.push(value);
    }
    shift() {
        return this.#list.shift();
    }
    wait() {
        return new Promise(resolve => this.#queue.push(resolve));
    }
}
exports.WaitQueue = WaitQueue;
//# sourceMappingURL=wait-queue.js.map