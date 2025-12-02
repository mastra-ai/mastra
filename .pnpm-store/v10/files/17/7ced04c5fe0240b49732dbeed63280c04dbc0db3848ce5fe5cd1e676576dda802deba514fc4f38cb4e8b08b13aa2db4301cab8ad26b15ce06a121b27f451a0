export declare enum NodeType {
    ELEMENT_NODE = 1,
    TEXT_NODE = 3,
    COMMENT_NODE = 8
}
export type Node = HTMLElement | TextNode | CommentNode;
export type ParsingOptions = {
    lowerCaseTagName?: boolean;
    script?: boolean;
    style?: boolean;
    pre?: boolean;
    comment?: boolean;
};
/**
 * Node Class as base class for TextNode and HTMLElement.
 */
export declare abstract class AbstractNode {
    /** The node type.
     * * 1 for Elements
     * * 3 for Text Nodes
     * * 8 for Comments
     */
    abstract nodeType: NodeType;
    /** Return the child nodes of this node */
    childNodes: Node[];
    /**
     * Get unescaped text value of current node and its children.
     * @return {string} text content
     */
    get text(): string;
    /** Return the raw text content of this node */
    abstract get rawText(): string;
    /** Return the html representation of this node */
    abstract toString(): string;
    /** Provide a stable JSON representation for test serializers */
    abstract toJSON(): unknown;
    /** Return the parent node or null if this node is the root of the tree */
    parentNode: HTMLElement | null;
    /**
     * Remove this node from its parent if any
     * @return {Node}      node removed
     */
    remove(): this;
}
/**
 * TextNode to contain a text element in DOM tree.
 * @param {string} value [description]
 */
export declare class TextNode extends AbstractNode {
    value: string;
    constructor(value: string);
    get rawText(): string;
    /**
     * Node Type declaration.
     * @type {Number}
     */
    nodeType: NodeType.TEXT_NODE;
    /**
     * Detect if the node contains only white space.
     * @return {bool}
     */
    get isWhitespace(): boolean;
    toString(): string;
    toJSON(): {
        type: string;
        value: string;
    };
}
export declare class CommentNode extends AbstractNode {
    value: string;
    constructor(value: string);
    /**
     * Node Type declaration.
     * @type {Number}
     */
    nodeType: NodeType.COMMENT_NODE;
    get rawText(): string;
    toString(): string;
    toJSON(): {
        type: string;
        value: string;
    };
}
export interface KeyAttributes {
    id?: string;
    class?: string;
}
export interface Attributes {
    [key: string]: string;
}
export interface RawAttributes {
    [key: string]: string;
}
/**
 * HTMLElement, which contains a set of children.
 *
 * Note: this is a minimalist implementation, no complete tree
 *   structure provided (no parentNode, nextSibling,
 *   previousSibling etc).
 * @class HTMLElement
 * @extends {AbstractNode}
 */
export declare class HTMLElement extends AbstractNode {
    tagName: string;
    private rawAttrs;
    private _attrs;
    private _rawAttrs;
    /** This is a short hand for the id attribute of this node */
    id: string;
    /** This is a short hand to get the list of the class names attribute of this node */
    classNames: string[];
    /**
     * Node Type declaration.
     */
    nodeType: NodeType.ELEMENT_NODE;
    /**
     * Creates an instance of HTMLElement.
     * @param [rawAttrs]	attributes in string
     *
     * @memberof HTMLElement
     */
    constructor(tagName: string, rawAttrs?: string, parentNode?: HTMLElement | null);
    /**
     * Remove Child element from childNodes array
     * @param {HTMLElement} node     node to remove
     */
    removeChild(node: Node): void;
    /**
     * Exchanges given child with new child
     * @param {HTMLElement} oldNode     node to exchange
     * @param {HTMLElement} newNode     new node
     */
    exchangeChild(oldNode: Node, newNode: Node): void;
    /**
     * Get escpaed (as-it) text value of current node and its children.
     * @return {string} text content
     */
    get rawText(): string;
    /**
     * Get structured Text (with '\n' etc.)
     * @return {string} structured text
     */
    get structuredText(): string;
    /**
     * Returns the children of HTMLElement type (ignore text and comment nodes)
     * @returns {HTMLElement[]}
     */
    get children(): HTMLElement[];
    toString(): string;
    /** Retrieves the content of this node as an HTML string */
    get innerHTML(): string;
    set innerHTML(content: string);
    /** Edit the HTML content of this node */
    set_content(content: string | Node | Node[]): void;
    /** Convert this node into its HTML representation. This is an alias to toString() method. */
    get outerHTML(): string;
    /**
     * Trim element from right (in block) after seeing pattern in a TextNode.
     * @param  {RegExp} pattern pattern to find
     * @return {HTMLElement}    reference to current node
     */
    trimRight(pattern: RegExp): this;
    /**
     * Get DOM structure
     * @return {string} strucutre
     */
    get structure(): string;
    /**
     * Remove whitespaces in this sub tree.
     * @return {HTMLElement} pointer to this
     */
    removeWhitespace(): this;
    /**
     * Query CSS selector to find matching nodes.
     * @param  {string}         selector Simplified CSS selector
     * @param  {Matcher}        selector A Matcher instance
     * @return {HTMLElement[]}  matching elements
     */
    querySelectorAll(selector: string | Matcher): HTMLElement[];
    /**
     * Query CSS selector implementation
     * @param matcher The matcher to use for selection
     * @param all Whether to return all matches or just the first one
     */
    private querySelectorImpl;
    /**
     * Query CSS Selector to find matching node.
     * @param  {string}         selector Simplified CSS selector
     * @param  {Matcher}        selector A Matcher instance
     * @return {HTMLElement | null}    matching node or null if not found
     */
    querySelector(selector: string | Matcher): HTMLElement | null;
    /**
     * Append a child node to childNodes
     * @param  {Node} node node to append
     * @return {Node}      node appended
     */
    appendChild<T extends Node = Node>(node: T): T;
    /**
     * Append a child node to childNodes
     * @param  {Node} node node to prepend
     * @return {Node}      node prepended
     */
    prependChild<T extends Node = Node>(node: T): T;
    /**
     * Get first child node
     * @return {Node} first child node
     */
    get firstChild(): Node;
    /**
     * Get last child node
     * @return {Node} last child node
     */
    get lastChild(): Node;
    /**
     * Get attributes
     * @return {Object} parsed and unescaped attributes
     */
    get attributes(): Attributes;
    /**
     * Get an attribute value
     * @param {string} key The attribute name
     * @return {string | undefined} The attribute value
     */
    getAttribute(key: string): string | undefined;
    /**
     * Get escaped (as-it) attributes
     * @return {Object} parsed attributes
     */
    get rawAttributes(): RawAttributes;
    /**
     * Set an attribute value to the HTMLElement
     * @param {string} key The attribute name
     * @param {string | undefined} value The value to set, or undefined to remove an attribute
     */
    setAttribute(key: string, value: string | undefined): void;
    removeAttribute(key: string): void;
    /**
     * Replace all the attributes of the HTMLElement by the provided attributes
     * @param {Attributes} attributes the new attribute set
     */
    setAttributes(attributes: Attributes): void;
    toJSON(): {
        type: string;
        tagName: string;
        attributes: Attributes;
        children: any[];
    };
}
/**
 * Matcher class to make CSS match
 *
 * @class Matcher
 */
export declare class Matcher {
    private checkers;
    private nextMatch;
    /**
     * Creates an instance of Matcher.
     * @param {string} selector
     */
    constructor(selector: string);
    /**
     * Parse complete CSS selector using regex to extract all parts
     */
    private parseCompleteSelector;
    /**
     * Parse attributes string like "[attr1][attr2=value]" into structured data
     */
    private parseAttributes;
    /**
     * Create a checker function from parsed selector data
     */
    private createCheckerFromParsed;
    /**
     * Create attribute checker function
     */
    private createAttributeChecker;
    /**
     * Trying to advance match pointer
     * @param  {HTMLElement} el element to make the match
     * @return {bool}           true when pointer advanced.
     */
    advance(el: HTMLElement): boolean;
    /**
     * Rewind the match pointer
     */
    rewind(): void;
    /**
     * Trying to determine if match made.
     * @return {bool} true when the match is made
     */
    get matched(): boolean;
    /**
     * Reset match pointer.
     */
    reset(): void;
    /**
     * Get current match level (for debugging)
     */
    get level(): number;
    /**
     * Clone this matcher with current state
     */
    clone(): Matcher;
}
/**
 * Parses HTML and returns a root element
 * Parse a chuck of HTML source.
 * @param  {string} data      html
 * @return {HTMLElement}      root fictive element. The parsed HTML can be found inside the root.childNodes property
 */
export declare function parse(data: string, options?: ParsingOptions): HTMLElement & {
    valid: boolean;
};
/**
 * Is the provided node a block element
 * @param node The node to consider
 * @returns true if the tagname of this node is of type block (p, ol, ul, h1, etc)
 */
export declare function isBlock(node: {
    nodeType: NodeType;
    tagName: string;
}): boolean | "";
