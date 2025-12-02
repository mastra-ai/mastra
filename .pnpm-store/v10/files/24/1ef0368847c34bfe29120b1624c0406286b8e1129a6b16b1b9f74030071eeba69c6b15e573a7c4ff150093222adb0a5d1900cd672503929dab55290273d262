"use strict";
/* eslint jsdoc/require-jsdoc: off */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateSearchFacet = exports.NumericSearchFacet = exports.TermSearchFacet = exports.SearchFacet = void 0;
/**
 * Provides the ability to specify facets for a search query.
 *
 * @category Full Text Search
 */
class SearchFacet {
    constructor(data) {
        if (!data) {
            data = {};
        }
        this._data = data;
    }
    toJSON() {
        return this._data;
    }
    static term(field, size) {
        return new TermSearchFacet(field, size);
    }
    static numeric(field, size) {
        return new NumericSearchFacet(field, size);
    }
    static date(field, size) {
        return new DateSearchFacet(field, size);
    }
}
exports.SearchFacet = SearchFacet;
/**
 * Provides ability to request a term facet.
 *
 * @category Full Text Search
 */
class TermSearchFacet extends SearchFacet {
    /**
     * @internal
     */
    constructor(field, size) {
        super({
            field: field,
            size: size,
        });
    }
}
exports.TermSearchFacet = TermSearchFacet;
/**
 * Provides ability to request a numeric facet.
 *
 * @category Full Text Search
 */
class NumericSearchFacet extends SearchFacet {
    /**
     * @internal
     */
    constructor(field, size) {
        super({
            field: field,
            size: size,
            numeric_ranges: [],
        });
    }
    addRange(name, min, max) {
        this._data.numeric_ranges.push({
            name: name,
            min: min,
            max: max,
        });
        return this;
    }
}
exports.NumericSearchFacet = NumericSearchFacet;
/**
 * Provides ability to request a date facet.
 *
 * @category Full Text Search
 */
class DateSearchFacet extends SearchFacet {
    /**
     * @internal
     */
    constructor(field, size) {
        super({
            field: field,
            size: size,
            date_ranges: [],
        });
    }
    addRange(name, start, end) {
        this._data.date_ranges.push({
            name: name,
            start: start,
            end: end,
        });
        return this;
    }
}
exports.DateSearchFacet = DateSearchFacet;
