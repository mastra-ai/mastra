import { JsonPropTypes } from "./prop_types";
import { IEmptyConstructor, IJsonConverter, IValidation } from "./types";
export interface IValidationEvent {
    propName: string;
    value: any;
}
export interface IJsonSchemaItem {
    type: JsonPropTypes | IEmptyConstructor<any>;
    optional?: boolean;
    defaultValue?: any;
    converter?: IJsonConverter<any, any>;
    repeated?: boolean;
    name?: string;
    validations: IValidation[];
}
export interface IJsonSchema {
    target: IEmptyConstructor<any>;
    names: {
        [key: string]: {
            [key: string]: IJsonSchemaItem;
        };
    };
}
export declare class JsonSchemaStorage {
    protected items: Map<object, IJsonSchema>;
    has(target: object): boolean;
    get(target: object): IJsonSchema;
    /**
     * Creates new schema
     * @param target Target object
     */
    create(target: object): IJsonSchema;
    set(target: object, schema: IJsonSchema): this;
    protected findParentSchema(target: object): IJsonSchema | null;
}
