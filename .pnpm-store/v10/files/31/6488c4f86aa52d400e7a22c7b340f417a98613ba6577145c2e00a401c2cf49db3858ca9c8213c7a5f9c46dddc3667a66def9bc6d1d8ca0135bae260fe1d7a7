import { IJsonSchema, IJsonSchemaItem } from "./schema";
export interface IJsonNamedSchema {
    [key: string]: IJsonSchemaItem;
}
export declare class JsonTransform {
    protected static checkValues(data: any, schemaItem: IJsonSchemaItem): void;
    protected static checkTypes(value: any, schemaItem: IJsonSchemaItem): void;
    protected static getSchemaByName(schema: IJsonSchema, name?: string): IJsonNamedSchema;
}
