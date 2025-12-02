"use strict";
/* eslint jsdoc/require-jsdoc: off */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoDistanceSearchSort = exports.FieldSearchSort = exports.IdSearchSort = exports.ScoreSearchSort = exports.SearchSort = void 0;
/**
 * Provides the ability to specify sorting for a search query.
 *
 * @category Full Text Search
 */
class SearchSort {
    constructor(data) {
        if (!data) {
            data = {};
        }
        this._data = data;
    }
    toJSON() {
        return this._data;
    }
    static score() {
        return new ScoreSearchSort();
    }
    static id() {
        return new IdSearchSort();
    }
    static field(field) {
        return new FieldSearchSort(field);
    }
    static geoDistance(field, lat, lon) {
        return new GeoDistanceSearchSort(field, lat, lon);
    }
}
exports.SearchSort = SearchSort;
/**
 * Provides sorting for a search query by score.
 *
 * @category Full Text Search
 */
class ScoreSearchSort extends SearchSort {
    /**
     * @internal
     */
    constructor() {
        super({
            by: 'score',
        });
    }
    descending(descending) {
        this._data.desc = descending;
        return this;
    }
}
exports.ScoreSearchSort = ScoreSearchSort;
/**
 *  Provides sorting for a search query by document id.
 *
 * @category Full Text Search
 */
class IdSearchSort extends SearchSort {
    /**
     * @internal
     */
    constructor() {
        super({
            by: 'id',
        });
    }
    descending(descending) {
        this._data.desc = descending;
        return this;
    }
}
exports.IdSearchSort = IdSearchSort;
/**
 *  Provides sorting for a search query by a specified field.
 *
 * @category Full Text Search
 */
class FieldSearchSort extends SearchSort {
    /**
     * @internal
     */
    constructor(field) {
        super({
            by: 'field',
            field: field,
        });
    }
    type(type) {
        this._data.type = type;
        return this;
    }
    mode(mode) {
        this._data.mode = mode;
        return this;
    }
    missing(missing) {
        this._data.missing = missing;
        return this;
    }
    descending(descending) {
        this._data.desc = descending;
        return this;
    }
}
exports.FieldSearchSort = FieldSearchSort;
/**
 *  Provides sorting for a search query by geographic distance from a point.
 *
 * @category Full Text Search
 */
class GeoDistanceSearchSort extends SearchSort {
    /**
     * @internal
     */
    constructor(field, lat, lon) {
        super({
            by: 'geo_distance',
            field: field,
            location: [lon, lat],
        });
    }
    unit(unit) {
        this._data.unit = unit;
        return this;
    }
    descending(descending) {
        this._data.desc = descending;
        return this;
    }
}
exports.GeoDistanceSearchSort = GeoDistanceSearchSort;
