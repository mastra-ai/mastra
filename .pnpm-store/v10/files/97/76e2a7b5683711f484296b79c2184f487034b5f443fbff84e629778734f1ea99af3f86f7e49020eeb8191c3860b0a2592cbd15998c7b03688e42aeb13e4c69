import { JsonTransform } from "./transform";
import { IEmptyConstructor } from "./types";
export interface IJsonParserOptions<T> {
    targetSchema: IEmptyConstructor<T>;
    schemaName?: string;
    /**
     * Enable strict checking of properties. Throw exception if incoming JSON has odd fields
     */
    strictProperty?: boolean;
    /**
     * Checks all properties for object and throws KeyError with list of wrong keys
     */
    strictAllKeys?: boolean;
}
export declare class JsonParser extends JsonTransform {
    static parse<T>(data: string, options: IJsonParserOptions<T>): T;
    static fromJSON<T>(target: any, options: IJsonParserOptions<T>): T;
    /**
     * Checks for odd properties in target object.
     * @param target Target object
     * @param namedSchema Named schema with a list of properties
     * @param schema
     * @throws Throws ParserError exception whenever target object has odd property
     */
    private static checkStrictProperty;
}
