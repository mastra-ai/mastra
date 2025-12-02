"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyCollection = void 0;
const Exports_js_1 = require("./Exports.js");
/**
 * Represents collection of properties and their values.
 * @class PropertyCollection
 */
class PropertyCollection {
    constructor() {
        this.privKeys = [];
        this.privValues = [];
    }
    /**
     * Returns the property value in type String.
     * Currently only String, int and bool are allowed.
     * If the name is not available, the specified defaultValue is returned.
     * @member PropertyCollection.prototype.getProperty
     * @function
     * @public
     * @param {string} key - The parameter name.
     * @param {string | number | boolean} def - The default value which is returned if the parameter
     * is not available in the collection.
     * @returns {string} value of the parameter.
     */
    getProperty(key, def) {
        let keyToUse;
        if (typeof key === "string") {
            keyToUse = key;
        }
        else {
            keyToUse = Exports_js_1.PropertyId[key];
        }
        for (let n = 0; n < this.privKeys.length; n++) {
            if (this.privKeys[n] === keyToUse) {
                return this.privValues[n];
            }
        }
        if (def === undefined) {
            return undefined;
        }
        return String(def);
    }
    /**
     * Sets the String value of the parameter specified by name.
     * @member PropertyCollection.prototype.setProperty
     * @function
     * @public
     * @param {string} key - The parameter name.
     * @param {string} value - The value of the parameter.
     */
    setProperty(key, value) {
        let keyToUse;
        if (typeof key === "string") {
            keyToUse = key;
        }
        else {
            keyToUse = Exports_js_1.PropertyId[key];
        }
        for (let n = 0; n < this.privKeys.length; n++) {
            if (this.privKeys[n] === keyToUse) {
                this.privValues[n] = value;
                return;
            }
        }
        this.privKeys.push(keyToUse);
        this.privValues.push(value);
    }
    /**
     * Clones the collection.
     * @member PropertyCollection.prototype.clone
     * @function
     * @public
     * @returns {PropertyCollection} A copy of the collection.
     */
    clone() {
        const clonedMap = new PropertyCollection();
        for (let n = 0; n < this.privKeys.length; n++) {
            clonedMap.privKeys.push(this.privKeys[n]);
            clonedMap.privValues.push(this.privValues[n]);
        }
        return clonedMap;
    }
    /**
     * Merges this set of properties into another, no overwrites.
     * @member PropertyCollection.prototype.mergeTo
     * @function
     * @public
     * @param {PropertyCollection}  destinationCollection - The collection to merge into.
     */
    mergeTo(destinationCollection) {
        this.privKeys.forEach((key) => {
            if (destinationCollection.getProperty(key, undefined) === undefined) {
                const value = this.getProperty(key);
                destinationCollection.setProperty(key, value);
            }
        });
    }
    /**
     * Get the keys in Property Collection.
     * @member PropertyCollection.prototype.keys
     * @function
     * @public
     * @returns {string []} Keys in the collection.
     */
    get keys() {
        return this.privKeys;
    }
}
exports.PropertyCollection = PropertyCollection;

//# sourceMappingURL=PropertyCollection.js.map
