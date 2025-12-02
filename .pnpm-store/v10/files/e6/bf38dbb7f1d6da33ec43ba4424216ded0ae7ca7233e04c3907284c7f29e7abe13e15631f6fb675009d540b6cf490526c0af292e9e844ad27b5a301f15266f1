import { assertNonEmptyArray, lastNonEmpty } from "../assertions/arrays.js";
export default class Context {
    setResult(result) {
        this.result = result;
        this.hasResult = true;
        return this;
    }
    exit() {
        this.exiting = true;
        return this;
    }
    push(child, name) {
        child.parent = this;
        if (typeof name !== "undefined") {
            child.childName = name;
        }
        child.root = this.root || this;
        child.options = child.options || this.options;
        if (!this.children) {
            this.children = [child];
            this.nextAfterChildren = this.next || null;
            this.next = child;
        }
        else {
            assertNonEmptyArray(this.children);
            lastNonEmpty(this.children).next = child;
            this.children.push(child);
        }
        child.next = this;
        return this;
    }
}
