"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SinglyLinkedList = exports.DoublyLinkedList = void 0;
class DoublyLinkedList {
    #length = 0;
    get length() {
        return this.#length;
    }
    #head;
    get head() {
        return this.#head;
    }
    #tail;
    get tail() {
        return this.#tail;
    }
    push(value) {
        ++this.#length;
        if (this.#tail === undefined) {
            return this.#tail = this.#head = {
                previous: this.#head,
                next: undefined,
                value
            };
        }
        return this.#tail = this.#tail.next = {
            previous: this.#tail,
            next: undefined,
            value
        };
    }
    unshift(value) {
        ++this.#length;
        if (this.#head === undefined) {
            return this.#head = this.#tail = {
                previous: undefined,
                next: undefined,
                value
            };
        }
        return this.#head = this.#head.previous = {
            previous: undefined,
            next: this.#head,
            value
        };
    }
    add(value, prepend = false) {
        return prepend ?
            this.unshift(value) :
            this.push(value);
    }
    shift() {
        if (this.#head === undefined)
            return undefined;
        --this.#length;
        const node = this.#head;
        if (node.next) {
            node.next.previous = node.previous;
            this.#head = node.next;
            node.next = undefined;
        }
        else {
            this.#head = this.#tail = undefined;
        }
        return node.value;
    }
    remove(node) {
        --this.#length;
        if (this.#tail === node) {
            this.#tail = node.previous;
        }
        if (this.#head === node) {
            this.#head = node.next;
        }
        else {
            node.previous.next = node.next;
            node.previous = undefined;
        }
        node.next = undefined;
    }
    reset() {
        this.#length = 0;
        this.#head = this.#tail = undefined;
    }
    *[Symbol.iterator]() {
        let node = this.#head;
        while (node !== undefined) {
            yield node.value;
            node = node.next;
        }
    }
}
exports.DoublyLinkedList = DoublyLinkedList;
class SinglyLinkedList {
    #length = 0;
    get length() {
        return this.#length;
    }
    #head;
    get head() {
        return this.#head;
    }
    #tail;
    get tail() {
        return this.#tail;
    }
    push(value) {
        ++this.#length;
        const node = {
            value,
            next: undefined,
            removed: false
        };
        if (this.#head === undefined) {
            return this.#head = this.#tail = node;
        }
        return this.#tail.next = this.#tail = node;
    }
    remove(node, parent) {
        if (node.removed) {
            throw new Error("node already removed");
        }
        --this.#length;
        if (this.#head === node) {
            if (this.#tail === node) {
                this.#head = this.#tail = undefined;
            }
            else {
                this.#head = node.next;
            }
        }
        else if (this.#tail === node) {
            this.#tail = parent;
            parent.next = undefined;
        }
        else {
            parent.next = node.next;
        }
        node.removed = true;
    }
    shift() {
        if (this.#head === undefined)
            return undefined;
        const node = this.#head;
        if (--this.#length === 0) {
            this.#head = this.#tail = undefined;
        }
        else {
            this.#head = node.next;
        }
        node.removed = true;
        return node.value;
    }
    reset() {
        this.#length = 0;
        this.#head = this.#tail = undefined;
    }
    *[Symbol.iterator]() {
        let node = this.#head;
        while (node !== undefined) {
            yield node.value;
            node = node.next;
        }
    }
}
exports.SinglyLinkedList = SinglyLinkedList;
//# sourceMappingURL=linked-list.js.map