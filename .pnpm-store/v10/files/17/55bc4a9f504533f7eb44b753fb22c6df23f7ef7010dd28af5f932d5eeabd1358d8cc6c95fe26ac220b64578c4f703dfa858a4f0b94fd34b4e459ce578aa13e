"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorSearch = exports.VectorQuery = exports.VectorQueryCombination = void 0;
const errors_1 = require("./errors");
const searchquery_1 = require("./searchquery");
/**
 * Specifies how multiple vector searches are combined.
 *
 * @category Full Text Search
 */
var VectorQueryCombination;
(function (VectorQueryCombination) {
    /**
     * Indicates that multiple vector queries should be combined with logical AND.
     */
    VectorQueryCombination["AND"] = "and";
    /**
     * Indicates that multiple vector queries should be combined with logical OR.
     */
    VectorQueryCombination["OR"] = "or";
})(VectorQueryCombination || (exports.VectorQueryCombination = VectorQueryCombination = {}));
/**
 * Represents a vector query.
 *
 * @category Full Text Search
 */
class VectorQuery {
    constructor(fieldName, vector) {
        if (!fieldName) {
            throw new errors_1.InvalidArgumentError(new Error('Must provide a field name.'));
        }
        this._fieldName = fieldName;
        if (!vector) {
            throw new errors_1.InvalidArgumentError(new Error('Provided vector cannot be empty.'));
        }
        if (Array.isArray(vector)) {
            if (vector.length == 0) {
                throw new errors_1.InvalidArgumentError(new Error('Provided vector cannot be empty.'));
            }
            this._vector = vector;
        }
        else if (typeof vector === 'string') {
            this._vectorBase64 = vector;
        }
        else {
            throw new errors_1.InvalidArgumentError(new Error('Provided vector must be either a number[] or base64 encoded string.'));
        }
    }
    /**
     * @internal
     */
    toJSON() {
        var _a;
        const output = {
            field: this._fieldName,
            k: (_a = this._numCandidates) !== null && _a !== void 0 ? _a : 3,
        };
        if (this._vector) {
            output['vector'] = this._vector;
        }
        else {
            output['vector_base64'] = this._vectorBase64;
        }
        if (this._boost) {
            output['boost'] = this._boost;
        }
        if (this._prefilter) {
            output['filter'] = this._prefilter.toJSON();
        }
        return output;
    }
    /**
     * Adds boost option to vector query.
     *
     * @param boost A floating point value.
     */
    boost(boost) {
        this._boost = boost;
        return this;
    }
    /**
     * Adds numCandidates option to vector query. Value must be >= 1.
     *
     * @param numCandidates An integer value.
     */
    numCandidates(numCandidates) {
        if (numCandidates < 1) {
            throw new errors_1.InvalidArgumentError(new Error('Provided value for numCandidates must be >= 1.'));
        }
        this._numCandidates = numCandidates;
        return this;
    }
    /**
     * Adds prefilter option to vector query.
     *
     * @param prefilter A SearchQuery.
     */
    prefilter(prefilter) {
        if (!(prefilter instanceof searchquery_1.SearchQuery)) {
            throw new errors_1.InvalidArgumentError(new Error('Provided value for prefilter must be a SearchQuery.'));
        }
        this._prefilter = prefilter;
        return this;
    }
    /**
     * Creates a vector query.
     *
     * @param fieldName The name of the field in the JSON document that holds the vector.
     * @param vector List of floating point values that represent the vector.
     */
    static create(fieldName, vector) {
        return new VectorQuery(fieldName, vector);
    }
}
exports.VectorQuery = VectorQuery;
/**
 * Represents a vector search.
 *
 * @category Full Text Search
 */
class VectorSearch {
    constructor(queries, options) {
        if (!Array.isArray(queries) || queries.length == 0) {
            throw new errors_1.InvalidArgumentError(new Error('Provided queries must be an array and cannot be empty.'));
        }
        if (!queries.every((q) => q instanceof VectorQuery)) {
            throw new errors_1.InvalidArgumentError(new Error('All provided queries must be a VectorQuery.'));
        }
        this._queries = queries;
        this._options = options;
    }
    /**
     * @internal
     */
    get queries() {
        return this._queries;
    }
    /**
     * @internal
     */
    get options() {
        return this._options;
    }
    /**
     * Creates a vector search from a single VectorQuery.
     *
     * @param query A vectory query that should be a part of the vector search.
     */
    static fromVectorQuery(query) {
        return new VectorSearch([query]);
    }
}
exports.VectorSearch = VectorSearch;
