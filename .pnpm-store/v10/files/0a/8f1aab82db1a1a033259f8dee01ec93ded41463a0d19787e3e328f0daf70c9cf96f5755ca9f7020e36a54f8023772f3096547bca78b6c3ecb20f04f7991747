export interface DoublyLinkedNode<T> {
    value: T;
    previous: DoublyLinkedNode<T> | undefined;
    next: DoublyLinkedNode<T> | undefined;
}
export declare class DoublyLinkedList<T> {
    #private;
    get length(): number;
    get head(): DoublyLinkedNode<T> | undefined;
    get tail(): DoublyLinkedNode<T> | undefined;
    push(value: T): {
        previous: DoublyLinkedNode<T> | undefined;
        next: undefined;
        value: T;
    };
    unshift(value: T): {
        previous: undefined;
        next: undefined;
        value: T;
    } | {
        previous: undefined;
        next: DoublyLinkedNode<T>;
        value: T;
    };
    add(value: T, prepend?: boolean): {
        previous: DoublyLinkedNode<T> | undefined;
        next: undefined;
        value: T;
    } | {
        previous: undefined;
        next: DoublyLinkedNode<T>;
        value: T;
    };
    shift(): T | undefined;
    remove(node: DoublyLinkedNode<T>): void;
    reset(): void;
    [Symbol.iterator](): Generator<T, void, unknown>;
}
export interface SinglyLinkedNode<T> {
    value: T;
    next: SinglyLinkedNode<T> | undefined;
    removed: boolean;
}
export declare class SinglyLinkedList<T> {
    #private;
    get length(): number;
    get head(): SinglyLinkedNode<T> | undefined;
    get tail(): SinglyLinkedNode<T> | undefined;
    push(value: T): {
        value: T;
        next: undefined;
        removed: boolean;
    };
    remove(node: SinglyLinkedNode<T>, parent: SinglyLinkedNode<T> | undefined): void;
    shift(): T | undefined;
    reset(): void;
    [Symbol.iterator](): Generator<T, void, unknown>;
}
//# sourceMappingURL=linked-list.d.ts.map