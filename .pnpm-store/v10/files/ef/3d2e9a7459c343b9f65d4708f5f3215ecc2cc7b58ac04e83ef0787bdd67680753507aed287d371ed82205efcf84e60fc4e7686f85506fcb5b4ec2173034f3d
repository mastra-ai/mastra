import { JsonPropTypes } from "./prop_types";
import { IEmptyConstructor, IJsonConverter } from "./types";
export interface IJsonPropOptions {
    type?: JsonPropTypes | IEmptyConstructor<any>;
    optional?: boolean;
    defaultValue?: any;
    converter?: IJsonConverter<any, any>;
    repeated?: boolean;
    name?: string;
    /**
     * Defines name of schema
     */
    schema?: string | string[];
    /**
     * Defines regular expression for text
     */
    pattern?: string | RegExp;
    /**
     * Defines a list of acceptable values
     */
    enumeration?: string[];
    /**
     * Specifies the exact number of characters or list items allowed. Must be equal to or greater than zero
     */
    length?: number;
    /**
     * Specifies the minimum number of characters or list items allowed. Must be equal to or greater than zero
     */
    minLength?: number;
    /**
     * Specifies the maximum number of characters or list items allowed. Must be equal to or greater than zero
     */
    maxLength?: number;
    /**
     * Specifies the lower bounds for numeric values (the value must be greater than or equal to this value)
     */
    minInclusive?: number;
    /**
     * Specifies the upper bounds for numeric values (the value must be less than or equal to this value)
     */
    maxInclusive?: number;
    /**
     * Specifies the lower bounds for numeric values (the value must be greater than this value)
     */
    minExclusive?: number;
    /**
     * Specifies the upper bounds for numeric values (the value must be less than this value)
     */
    maxExclusive?: number;
}
export declare const JsonProp: (options?: IJsonPropOptions) => (target: object, propertyKey: string) => void;
