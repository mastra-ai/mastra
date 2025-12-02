"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AliasedJSONPathBuilder = exports.TraversedJSONPathBuilder = exports.JSONPathBuilder = void 0;
const alias_node_js_1 = require("../operation-node/alias-node.js");
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const json_operator_chain_node_js_1 = require("../operation-node/json-operator-chain-node.js");
const json_path_leg_node_js_1 = require("../operation-node/json-path-leg-node.js");
const json_path_node_js_1 = require("../operation-node/json-path-node.js");
const json_reference_node_js_1 = require("../operation-node/json-reference-node.js");
const operation_node_source_js_1 = require("../operation-node/operation-node-source.js");
const value_node_js_1 = require("../operation-node/value-node.js");
class JSONPathBuilder {
    #node;
    constructor(node) {
        this.#node = node;
    }
    /**
     * Access an element of a JSON array in a specific location.
     *
     * Since there's no guarantee an element exists in the given array location, the
     * resulting type is always nullable. If you're sure the element exists, you
     * should use {@link SelectQueryBuilder.$assertType} to narrow the type safely.
     *
     * See also {@link key} to access properties of JSON objects.
     *
     * ### Examples
     *
     * ```ts
     * await db.selectFrom('person')
     *   .select(eb =>
     *     eb.ref('nicknames', '->').at(0).as('primary_nickname')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "nicknames"->0 as "primary_nickname" from "person"
     *```
     *
     * Combined with {@link key}:
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('experience', '->').at(0).key('role').as('first_role')
     * )
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "experience"->0->'role' as "first_role" from "person"
     * ```
     *
     * You can use `'last'` to access the last element of the array in MySQL:
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('nicknames', '->$').at('last').as('last_nickname')
     * )
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * select `nicknames`->'$[last]' as `last_nickname` from `person`
     * ```
     *
     * Or `'#-1'` in SQLite:
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('nicknames', '->>$').at('#-1').as('last_nickname')
     * )
     * ```
     *
     * The generated SQL (SQLite):
     *
     * ```sql
     * select "nicknames"->>'$[#-1]' as `last_nickname` from `person`
     * ```
     */
    at(index) {
        return this.#createBuilderWithPathLeg('ArrayLocation', index);
    }
    /**
     * Access a property of a JSON object.
     *
     * If a field is optional, the resulting type will be nullable.
     *
     * See also {@link at} to access elements of JSON arrays.
     *
     * ### Examples
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('address', '->').key('city').as('city')
     * )
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "address"->'city' as "city" from "person"
     * ```
     *
     * Going deeper:
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('profile', '->$').key('website').key('url').as('website_url')
     * )
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * select `profile`->'$.website.url' as `website_url` from `person`
     * ```
     *
     * Combined with {@link at}:
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('profile', '->').key('addresses').at(0).key('city').as('city')
     * )
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "profile"->'addresses'->0->'city' as "city" from "person"
     * ```
     */
    key(key) {
        return this.#createBuilderWithPathLeg('Member', key);
    }
    #createBuilderWithPathLeg(legType, value) {
        if (json_reference_node_js_1.JSONReferenceNode.is(this.#node)) {
            return new TraversedJSONPathBuilder(json_reference_node_js_1.JSONReferenceNode.cloneWithTraversal(this.#node, json_path_node_js_1.JSONPathNode.is(this.#node.traversal)
                ? json_path_node_js_1.JSONPathNode.cloneWithLeg(this.#node.traversal, json_path_leg_node_js_1.JSONPathLegNode.create(legType, value))
                : json_operator_chain_node_js_1.JSONOperatorChainNode.cloneWithValue(this.#node.traversal, value_node_js_1.ValueNode.createImmediate(value))));
        }
        return new TraversedJSONPathBuilder(json_path_node_js_1.JSONPathNode.cloneWithLeg(this.#node, json_path_leg_node_js_1.JSONPathLegNode.create(legType, value)));
    }
}
exports.JSONPathBuilder = JSONPathBuilder;
class TraversedJSONPathBuilder extends JSONPathBuilder {
    #node;
    constructor(node) {
        super(node);
        this.#node = node;
    }
    /** @private */
    get expressionType() {
        return undefined;
    }
    as(alias) {
        return new AliasedJSONPathBuilder(this, alias);
    }
    /**
     * Change the output type of the json path.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of this `JSONPathBuilder` with a new output type.
     */
    $castTo() {
        return new TraversedJSONPathBuilder(this.#node);
    }
    $notNull() {
        return new TraversedJSONPathBuilder(this.#node);
    }
    toOperationNode() {
        return this.#node;
    }
}
exports.TraversedJSONPathBuilder = TraversedJSONPathBuilder;
class AliasedJSONPathBuilder {
    #jsonPath;
    #alias;
    constructor(jsonPath, alias) {
        this.#jsonPath = jsonPath;
        this.#alias = alias;
    }
    /** @private */
    get expression() {
        return this.#jsonPath;
    }
    /** @private */
    get alias() {
        return this.#alias;
    }
    toOperationNode() {
        return alias_node_js_1.AliasNode.create(this.#jsonPath.toOperationNode(), (0, operation_node_source_js_1.isOperationNodeSource)(this.#alias)
            ? this.#alias.toOperationNode()
            : identifier_node_js_1.IdentifierNode.create(this.#alias));
    }
}
exports.AliasedJSONPathBuilder = AliasedJSONPathBuilder;
