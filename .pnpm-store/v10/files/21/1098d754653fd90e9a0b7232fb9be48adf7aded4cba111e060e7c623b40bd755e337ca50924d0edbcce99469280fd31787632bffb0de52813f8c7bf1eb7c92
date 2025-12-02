export * from './HeapAsync';
export type Comparator<T> = (a: T, b: T) => number;
export type IsEqual<T> = (e: T, o: T) => boolean;
export declare const toInt: (n: number) => number;
/**
 * Heap
 * @type {Class}
 */
export declare class Heap<T> implements Iterable<T> {
    compare: Comparator<T>;
    heapArray: Array<T>;
    _limit: number;
    /**
     * Alias of {@link add}
     * @see add
     */
    offer: (element: T) => boolean;
    /**
     * Alias of {@link peek}
     * @see peek
     */
    element: () => T | undefined;
    /**
     * Alias of {@link pop}
     * @see pop
     */
    poll: () => T | undefined;
    /**
     * Alias of {@link clear}
     * @see clear
     */
    removeAll: () => void;
    /**
     * Heap instance constructor.
     * @param  {Function} compare Optional comparison function, defaults to Heap.minComparator<number>
     */
    constructor(compare?: Comparator<T>);
    /**
     * Gets children indices for given index.
     * @param  {Number} idx     Parent index
     * @return {Array(Number)}  Array of children indices
     */
    static getChildrenIndexOf(idx: number): Array<number>;
    /**
     * Gets parent index for given index.
     * @param  {Number} idx  Children index
     * @return {Number | undefined}      Parent index, -1 if idx is 0
     */
    static getParentIndexOf(idx: number): number;
    /**
     * Gets sibling index for given index.
     * @param  {Number} idx  Children index
     * @return {Number | undefined}      Sibling index, -1 if idx is 0
     */
    static getSiblingIndexOf(idx: number): number;
    /**
     * Min heap comparison function, default.
     * @param  {any} a     First element
     * @param  {any} b     Second element
     * @return {Number}    0 if they're equal, positive if `a` goes up, negative if `b` goes up
     */
    static minComparator<N>(a: N, b: N): number;
    /**
     * Max heap comparison function.
     * @param  {any} a     First element
     * @param  {any} b     Second element
     * @return {Number}    0 if they're equal, positive if `a` goes up, negative if `b` goes up
     */
    static maxComparator<N>(a: N, b: N): number;
    /**
     * Min number heap comparison function, default.
     * @param  {Number} a     First element
     * @param  {Number} b     Second element
     * @return {Number}    0 if they're equal, positive if `a` goes up, negative if `b` goes up
     */
    static minComparatorNumber(a: number, b: number): number;
    /**
     * Max number heap comparison function.
     * @param  {Number} a     First element
     * @param  {Number} b     Second element
     * @return {Number}    0 if they're equal, positive if `a` goes up, negative if `b` goes up
     */
    static maxComparatorNumber(a: number, b: number): number;
    /**
     * Default equality function.
     * @param  {any} a    First element
     * @param  {any} b    Second element
     * @return {Boolean}  True if equal, false otherwise
     */
    static defaultIsEqual<N>(a: N, b: N): boolean;
    /**
     * Prints a heap.
     * @param  {Heap} heap Heap to be printed
     * @returns {String}
     */
    static print<N>(heap: Heap<N>): string;
    /**
     * Converts an array into an array-heap, in place
     * @param  {Array}    arr      Array to be modified
     * @param  {Function} compare  Optional compare function
     * @return {Heap}              For convenience, it returns a Heap instance
     */
    static heapify<N>(arr: Array<N>, compare?: Comparator<N>): Heap<N>;
    /**
     * Extract the peek of an array-heap
     * @param  {Array}    heapArr  Array to be modified, should be a heap
     * @param  {Function} compare  Optional compare function
     * @return {any}               Returns the extracted peek
     */
    static heappop<N>(heapArr: Array<N>, compare?: Comparator<N>): N | undefined;
    /**
     * Pushes a item into an array-heap
     * @param  {Array}    heapArr  Array to be modified, should be a heap
     * @param  {any}      item     Item to push
     * @param  {Function} compare  Optional compare function
     */
    static heappush<N>(heapArr: Array<N>, item: N, compare?: Comparator<N>): void;
    /**
     * Push followed by pop, faster
     * @param  {Array}    heapArr  Array to be modified, should be a heap
     * @param  {any}      item     Item to push
     * @param  {Function} compare  Optional compare function
     * @return {any}               Returns the extracted peek
     */
    static heappushpop<N>(heapArr: Array<N>, item: N, compare?: Comparator<N>): N;
    /**
     * Replace peek with item
     * @param  {Array}    heapArr  Array to be modified, should be a heap
     * @param  {any}      item     Item as replacement
     * @param  {Function} compare  Optional compare function
     * @return {any}               Returns the extracted peek
     */
    static heapreplace<N>(heapArr: Array<N>, item: N, compare?: Comparator<N>): N;
    /**
     * Return the `n` most valuable elements of a heap-like Array
     * @param  {Array}    heapArr  Array, should be an array-heap
     * @param  {number}   n        Max number of elements
     * @param  {Function} compare  Optional compare function
     * @return {any}               Elements
     */
    static heaptop<N>(heapArr: Array<N>, n?: number, compare?: Comparator<N>): Array<N>;
    /**
     * Return the `n` least valuable elements of a heap-like Array
     * @param  {Array}    heapArr  Array, should be an array-heap
     * @param  {number}   n        Max number of elements
     * @param  {Function} compare  Optional compare function
     * @return {any}               Elements
     */
    static heapbottom<N>(heapArr: Array<N>, n?: number, compare?: Comparator<N>): Array<N>;
    /**
     * Return the `n` most valuable elements of an iterable
     * @param  {number}   n        Max number of elements
     * @param  {Iterable} Iterable Iterable list of elements
     * @param  {Function} compare  Optional compare function
     * @return {any}               Elements
     */
    static nlargest<N>(n: number, iterable: Iterable<N>, compare?: Comparator<N>): Array<N>;
    /**
     * Return the `n` least valuable elements of an iterable
     * @param  {number}   n        Max number of elements
     * @param  {Iterable} Iterable Iterable list of elements
     * @param  {Function} compare  Optional compare function
     * @return {any}               Elements
     */
    static nsmallest<N>(n: number, iterable: Iterable<N>, compare?: Comparator<N>): Array<N>;
    /**
     * Adds an element to the heap. Aliases: {@link offer}.
     * Same as: {@link push}(element).
     * @param {any} element Element to be added
     * @return {Boolean} true
     */
    add(element: T): boolean;
    /**
     * Adds an array of elements to the heap.
     * Similar as: {@link push}(element, element, ...).
     * @param {Array} elements Elements to be added
     * @return {Boolean} true
     */
    addAll(elements: Array<T>): boolean;
    /**
     * Return the bottom (lowest value) N elements of the heap.
     *
     * @param  {Number} n  Number of elements.
     * @return {Array}     Array of length <= N.
     */
    bottom(n?: number): Array<T>;
    /**
     * Check if the heap is sorted, useful for testing purposes.
     * @return {Undefined | Element}  Returns an element if something wrong is found, otherwise it's undefined
     */
    check(): T | undefined;
    /**
     * Remove all of the elements from this heap.
     */
    clear(): void;
    /**
     * Clone this heap
     * @return {Heap}
     */
    clone(): Heap<T>;
    /**
     * Returns the comparison function.
     * @return {Function}
     */
    comparator(): Comparator<T>;
    /**
     * Returns true if this queue contains the specified element.
     * @param  {any}      o   Element to be found
     * @param  {Function} callbackFn  Optional comparison function, receives (element, needle)
     * @return {Boolean}
     */
    contains(o: T, callbackFn?: IsEqual<T>): boolean;
    /**
     * Initialize a heap, sorting nodes
     * @param  {Array} array Optional initial state array
     */
    init(array?: Array<T>): void;
    /**
     * Test if the heap has no elements.
     * @return {Boolean} True if no elements on the heap
     */
    isEmpty(): boolean;
    /**
     * Get the index of the first occurrence of the element in the heap (using the comparator).
     * @param  {any}      element    Element to be found
     * @param  {Function} callbackFn Optional comparison function, receives (element, needle)
     * @return {Number}              Index or -1 if not found
     */
    indexOf(element: T, callbackFn?: IsEqual<T>): number;
    /**
     * Get the indexes of the every occurrence of the element in the heap (using the comparator).
     * @param  {any}      element    Element to be found
     * @param  {Function} callbackFn Optional comparison function, receives (element, needle)
     * @return {Array}               Array of indexes or empty array if not found
     */
    indexOfEvery(element: T, callbackFn?: IsEqual<T>): number[];
    /**
     * Get the leafs of the tree (no children nodes).
     * See also: {@link getChildrenOf} and {@link bottom}.
     * @return {Array}
     * @see getChildrenOf
     * @see bottom
     */
    leafs(): Array<T>;
    /**
     * Length of the heap. Aliases: {@link size}.
     * @return {Number}
     * @see size
     */
    get length(): number;
    /**
     * Get length limit of the heap.
     * Use {@link setLimit} or {@link limit} to set the limit.
     * @return {Number}
     * @see setLimit
     */
    get limit(): number;
    /**
     * Set length limit of the heap. Same as using {@link setLimit}.
     * @description If the heap is longer than the limit, the needed amount of leafs are removed.
     * @param {Number} _l Limit, defaults to 0 (no limit). Negative, Infinity, or NaN values set the limit to 0.
     * @see setLimit
     */
    set limit(_l: number);
    /**
     * Set length limit of the heap.
     * Same as assigning to {@link limit} but returns NaN if the value was invalid.
     * @param {Number} _l Limit. Negative, Infinity, or NaN values set the limit to 0.
     * @return {Number} The limit or NaN if the value was negative, or NaN.
     * @see limit
     */
    setLimit(_l: number): number;
    /**
     * Top node. Aliases: {@link element}.
     * Same as: {@link top}(1)[0].
     * @return {any} Top node
     * @see top
     */
    peek(): T | undefined;
    /**
     * Extract the top node (root). Aliases: {@link poll}.
     * @return {any} Extracted top node, undefined if empty
     */
    pop(): T | undefined;
    /**
     * Pushes element(s) to the heap.
     * See also: {@link add} and {@link addAll}.
     * @param  {...any} elements Elements to insert
     * @return {Boolean} True if elements are present
     */
    push(...elements: Array<T>): boolean;
    /**
     * Same as push & pop in sequence, but faster
     * @param  {any} element Element to insert
     * @return {any}  Extracted top node
     */
    pushpop(element: T): T;
    /**
     * Remove the first occurrence of an element from the heap.
     * @param  {any}   o      Element to be found
     * @param  {Function} callbackFn  Optional equality function, receives (element, needle)
     * @return {Boolean}      True if the heap was modified
     */
    remove(o?: T, callbackFn?: IsEqual<T>): boolean;
    /**
     * Pop the current peek value, and add the new item.
     * @param  {any} element  Element to replace peek
     * @return {any}         Old peek
     */
    replace(element: T): T;
    /**
     * Size of the heap
     * @return {Number}
     */
    size(): number;
    /**
     * Return the top (highest value) N elements of the heap.
     *
     * @param  {Number} n  Number of elements.
     * @return {Array}    Array of length <= N.
     */
    top(n?: number): Array<T>;
    /**
     * Clone the heap's internal array
     * @return {Array}
     */
    toArray(): Array<T>;
    /**
     * String output, call to Array.prototype.toString()
     * @return {String}
     */
    toString(): string;
    /**
     * Get the element at the given index.
     * @param  {Number} i Index to get
     * @return {any}       Element at that index
     */
    get(i: number): T;
    /**
     * Get the elements of these node's children
     * @param  {Number} idx Node index
     * @return {Array(any)}  Children elements
     */
    getChildrenOf(idx: number): Array<T>;
    /**
     * Get the element of this node's parent
     * @param  {Number} idx Node index
     * @return {any}     Parent element
     */
    getParentOf(idx: number): T | undefined;
    /**
     * Iterator interface
     */
    [Symbol.iterator](): Iterator<T>;
    /**
     * Returns an iterator. To comply with Java interface.
     */
    iterator(): Iterable<T>;
    /**
     * Limit heap size if needed
     */
    _applyLimit(): void;
    /**
     * Return the bottom (lowest value) N elements of the heap, without corner cases, unsorted
     *
     * @param  {Number} n  Number of elements.
     * @return {Array}     Array of length <= N.
     */
    _bottomN_push(n: number): Array<T>;
    /**
     * Returns the inverse to the comparison function.
     * @return {Function}
     */
    _invertedCompare: (a: T, b: T) => number;
    /**
     * Move a node to a new index, switching places
     * @param  {Number} j First node index
     * @param  {Number} k Another node index
     */
    _moveNode(j: number, k: number): void;
    /**
     * Move a node down the tree (to the leaves) to find a place where the heap is sorted.
     * @param  {Number} i Index of the node
     */
    _sortNodeDown(i: number): void;
    /**
     * Move a node up the tree (to the root) to find a place where the heap is sorted.
     * @param  {Number} i Index of the node
     */
    _sortNodeUp(i: number): void;
    /**
     * Return the top (highest value) N elements of the heap, without corner cases, unsorted
     * Implementation: push.
     *
     * @param  {Number} n  Number of elements.
     * @return {Array}     Array of length <= N.
     */
    _topN_push(n: number): Array<T>;
    /**
     * Return the top (highest value) N elements of the heap, without corner cases, unsorted
     * Implementation: init + push.
     *
     * @param  {Number} n  Number of elements.
     * @return {Array}     Array of length <= N.
     */
    _topN_fill(n: number): Array<T>;
    /**
     * Return the top (highest value) N elements of the heap, without corner cases, unsorted
     * Implementation: heap.
     *
     * @param  {Number} n  Number of elements.
     * @return {Array}     Array of length <= N.
     */
    _topN_heap(n: number): Array<T>;
    /**
     * Return index of the top element
     * @param list
     */
    _topIdxOf(list: Array<T>): number;
    /**
     * Return the top element
     * @param list
     */
    _topOf(...list: Array<T>): T | undefined;
}
export default Heap;
