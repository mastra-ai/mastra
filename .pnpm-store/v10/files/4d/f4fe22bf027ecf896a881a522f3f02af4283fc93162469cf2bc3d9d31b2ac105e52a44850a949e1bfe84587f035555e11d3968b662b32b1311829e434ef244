import { PropertyId } from "./Exports.js";
/**
 * Represents collection of properties and their values.
 * @class PropertyCollection
 */
export declare class PropertyCollection {
    private privKeys;
    private privValues;
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
    getProperty(key: PropertyId | string, def?: string | number | boolean): string;
    /**
     * Sets the String value of the parameter specified by name.
     * @member PropertyCollection.prototype.setProperty
     * @function
     * @public
     * @param {string} key - The parameter name.
     * @param {string} value - The value of the parameter.
     */
    setProperty(key: string | PropertyId, value: string): void;
    /**
     * Clones the collection.
     * @member PropertyCollection.prototype.clone
     * @function
     * @public
     * @returns {PropertyCollection} A copy of the collection.
     */
    clone(): PropertyCollection;
    /**
     * Merges this set of properties into another, no overwrites.
     * @member PropertyCollection.prototype.mergeTo
     * @function
     * @public
     * @param {PropertyCollection}  destinationCollection - The collection to merge into.
     */
    mergeTo(destinationCollection: PropertyCollection): void;
    /**
     * Get the keys in Property Collection.
     * @member PropertyCollection.prototype.keys
     * @function
     * @public
     * @returns {string []} Keys in the collection.
     */
    get keys(): string[];
}
