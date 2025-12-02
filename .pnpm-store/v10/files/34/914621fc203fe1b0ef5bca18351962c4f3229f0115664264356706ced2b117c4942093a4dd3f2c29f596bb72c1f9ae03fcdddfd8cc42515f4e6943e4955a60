export type AsyncComparator<T> = (a: T, b: T) => Promise<number>;
export type AsyncIsEqual<T> = (e: T, o: T) => Promise<boolean>;
/**
 * Heap
 * @type {Class}
 */
export declare class HeapAsync<T> implements Iterable<Promise<T>> {
    compare: AsyncComparator<T>;
    heapArray: Array<T>;
    _limit: number;
    /**
     * Alias of add
     */
    offer: (element: T) => Promise<boolean>;
    /**
     * Alias of peek
     */
    element: () => T | undefined;
    /**
     * Alias of pop
     */
    poll: () => Promise<T | undefined>;
    /**
     * Heap instance constructor.
     * @param  {Function} compare Optional comparison function, defaults to Heap.minComparator<number>
     */
    constructor(compare?: AsyncComparator<T>);
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
    static minComparator<N>(a: N, b: N): Promise<number>;
    /**
     * Max heap comparison function.
     * @param  {any} a     First element
     * @param  {any} b     Second element
     * @return {Number}    0 if they're equal, positive if `a` goes up, negative if `b` goes up
     */
    static maxComparator<N>(a: N, b: N): Promise<number>;
    /**
     * Min number heap comparison function, default.
     * @param  {Number} a     First element
     * @param  {Number} b     Second element
     * @return {Number}    0 if they're equal, positive if `a` goes up, negative if `b` goes up
     */
    static minComparatorNumber(a: number, b: number): Promise<number>;
    /**
     * Max number heap comparison function.
     * @param  {Number} a     First element
     * @param  {Number} b     Second element
     * @return {Number}    0 if they're equal, positive if `a` goes up, negative if `b` goes up
     */
    static maxComparatorNumber(a: number, b: number): Promise<number>;
    /**
     * Default equality function.
     * @param  {any} a    First element
     * @param  {any} b    Second element
     * @return {Boolean}  True if equal, false otherwise
     */
    static defaultIsEqual<N>(a: N, b: N): Promise<boolean>;
    /**
     * Prints a heap.
     * @param  {HeapAsync} heap Heap to be printed
     * @returns {String}
     */
    static print<N>(heap: HeapAsync<N>): string;
    /**
     * Converts an array into an array-heap, in place
     * @param  {Array}    arr      Array to be modified
     * @param  {Function} compare  Optional compare function
     * @return {HeapAsync}              For convenience, it returns a Heap instance
     */
    static heapify<N>(arr: Array<N>, compare?: AsyncComparator<N>): Promise<HeapAsync<N>>;
    /**
     * Extract the peek of an array-heap
     * @param  {Array}    heapArr  Array to be modified, should be a heap
     * @param  {Function} compare  Optional compare function
     * @return {any}               Returns the extracted peek
     */
    static heappop<N>(heapArr: Array<N>, compare?: AsyncComparator<N>): Promise<N | undefined>;
    /**
     * Pushes a item into an array-heap
     * @param  {Array}    heapArr  Array to be modified, should be a heap
     * @param  {any}      item     Item to push
     * @param  {Function} compare  Optional compare function
     */
    static heappush<N>(heapArr: Array<N>, item: N, compare?: AsyncComparator<N>): Promise<void>;
    /**
     * Push followed by pop, faster
     * @param  {Array}    heapArr  Array to be modified, should be a heap
     * @param  {any}      item     Item to push
     * @param  {Function} compare  Optional compare function
     * @return {any}               Returns the extracted peek
     */
    static heappushpop<N>(heapArr: Array<N>, item: N, compare?: AsyncComparator<N>): Promise<N>;
    /**
     * Replace peek with item
     * @param  {Array}    heapArr  Array to be modified, should be a heap
     * @param  {any}      item     Item as replacement
     * @param  {Function} compare  Optional compare function
     * @return {any}               Returns the extracted peek
     */
    static heapreplace<N>(heapArr: Array<N>, item: N, compare?: AsyncComparator<N>): Promise<N>;
    /**
     * Return the `n` most valuable elements of a heap-like Array
     * @param  {Array}    heapArr  Array, should be an array-heap
     * @param  {number}   n        Max number of elements
     * @param  {Function} compare  Optional compare function
     * @return {any}               Elements
     */
    static heaptop<N>(heapArr: Array<N>, n?: number, compare?: AsyncComparator<N>): Promise<Array<N>>;
    /**
     * Return the `n` least valuable elements of a heap-like Array
     * @param  {Array}    heapArr  Array, should be an array-heap
     * @param  {number}   n        Max number of elements
     * @param  {Function} compare  Optional compare function
     * @return {any}               Elements
     */
    static heapbottom<N>(heapArr: Array<N>, n?: number, compare?: AsyncComparator<N>): Promise<Array<N>>;
    /**
     * Return the `n` most valuable elements of an iterable
     * @param  {number}   n        Max number of elements
     * @param  {Iterable} Iterable Iterable list of elements
     * @param  {Function} compare  Optional compare function
     * @return {any}               Elements
     */
    static nlargest<N>(n: number, iterable: Iterable<N>, compare?: AsyncComparator<N>): Promise<Array<N>>;
    /**
     * Return the `n` least valuable elements of an iterable
     * @param  {number}   n        Max number of elements
     * @param  {Iterable} Iterable Iterable list of elements
     * @param  {Function} compare  Optional compare function
     * @return {any}               Elements
     */
    static nsmallest<N>(n: number, iterable: Iterable<N>, compare?: AsyncComparator<N>): Promise<Array<N>>;
    /**
     * Adds an element to the heap. Aliases: `offer`.
     * Same as: push(element)
     * @param {any} element Element to be added
     * @return {Boolean} true
     */
    add(element: T): Promise<boolean>;
    /**
     * Adds an array of elements to the heap.
     * Similar as: push(element, element, ...).
     * @param {Array} elements Elements to be added
     * @return {Boolean} true
     */
    addAll(elements: Array<T>): Promise<boolean>;
    /**
     * Return the bottom (lowest value) N elements of the heap.
     *
     * @param  {Number} n  Number of elements.
     * @return {Array}     Array of length <= N.
     */
    bottom(n?: number): Promise<Array<T>>;
    /**
     * Check if the heap is sorted, useful for testing purposes.
     * @return {Undefined | Element}  Returns an element if something wrong is found, otherwise it's undefined
     */
    check(): Promise<T | undefined>;
    /**
     * Remove all of the elements from this heap.
     */
    clear(): void;
    /**
     * Clone this heap
     * @return {HeapAsync}
     */
    clone(): HeapAsync<T>;
    /**
     * Returns the comparison function.
     * @return {Function}
     */
    comparator(): AsyncComparator<T>;
    /**
     * Returns true if this queue contains the specified element.
     * @param  {any}      o   Element to be found
     * @param  {Function} fn  Optional comparison function, receives (element, needle)
     * @return {Boolean}
     */
    contains(o: T, fn?: AsyncIsEqual<T>): Promise<boolean>;
    /**
     * Initialise a heap, sorting nodes
     * @param  {Array} array Optional initial state array
     */
    init(array?: Array<T>): Promise<void>;
    /**
     * Test if the heap has no elements.
     * @return {Boolean} True if no elements on the heap
     */
    isEmpty(): boolean;
    /**
     * Get the leafs of the tree (no children nodes)
     */
    leafs(): Array<T>;
    /**
     * Length of the heap.
     * @return {Number}
     */
    get length(): number;
    /**
     * Get length limit of the heap.
     * @return {Number}
     */
    get limit(): number;
    /**
     * Set length limit of the heap.
     * @return {Number}
     */
    set limit(_l: number);
    /**
     * Top node. Aliases: `element`.
     * Same as: `top(1)[0]`
     * @return {any} Top node
     */
    peek(): T | undefined;
    /**
     * Extract the top node (root). Aliases: `poll`.
     * @return {any} Extracted top node, undefined if empty
     */
    pop(): Promise<T | undefined>;
    /**
     * Pushes element(s) to the heap.
     * @param  {...any} elements Elements to insert
     * @return {Boolean} True if elements are present
     */
    push(...elements: Array<T>): Promise<boolean>;
    /**
     * Same as push & pop in sequence, but faster
     * @param  {any} element Element to insert
     * @return {any}  Extracted top node
     */
    pushpop(element: T): Promise<T>;
    /**
     * Remove an element from the heap.
     * @param  {any}   o      Element to be found
     * @param  {Function} fn  Optional function to compare
     * @return {Boolean}      True if the heap was modified
     */
    remove(o?: T, fn?: AsyncIsEqual<T>): Promise<boolean>;
    /**
     * Pop the current peek value, and add the new item.
     * @param  {any} element  Element to replace peek
     * @return {any}         Old peek
     */
    replace(element: T): Promise<T>;
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
    top(n?: number): Promise<Array<T>>;
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
    [Symbol.iterator](): Iterator<Promise<T>>;
    /**
     * Returns an iterator. To comply with Java interface.
     */
    iterator(): Iterable<Promise<T>>;
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
    _bottomN_push(n: number): Promise<Array<T>>;
    /**
     * Returns the inverse to the comparison function.
     * @return {Number}
     */
    _invertedCompare: (a: T, b: T) => Promise<number>;
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
    _sortNodeDown(i: number): Promise<void>;
    /**
     * Move a node up the tree (to the root) to find a place where the heap is sorted.
     * @param  {Number} i Index of the node
     */
    _sortNodeUp(i: number): Promise<void>;
    /**
     * Return the top (highest value) N elements of the heap, without corner cases, unsorted
     * Implementation: push.
     *
     * @param  {Number} n  Number of elements.
     * @return {Array}     Array of length <= N.
     */
    _topN_push(n: number): Promise<Array<T>>;
    /**
     * Return the top (highest value) N elements of the heap, without corner cases, unsorted
     * Implementation: init + push.
     *
     * @param  {Number} n  Number of elements.
     * @return {Array}     Array of length <= N.
     */
    _topN_fill(n: number): Promise<Array<T>>;
    /**
     * Return the top (highest value) N elements of the heap, without corner cases, unsorted
     * Implementation: heap.
     *
     * @param  {Number} n  Number of elements.
     * @return {Array}     Array of length <= N.
     */
    _topN_heap(n: number): Promise<Array<T>>;
    /**
     * Return index of the top element
     * @param list
     */
    _topIdxOf(list: Array<T>): Promise<number>;
    /**
     * Return the top element
     * @param list
     */
    _topOf(...list: Array<T>): Promise<T | undefined>;
}
export default HeapAsync;
