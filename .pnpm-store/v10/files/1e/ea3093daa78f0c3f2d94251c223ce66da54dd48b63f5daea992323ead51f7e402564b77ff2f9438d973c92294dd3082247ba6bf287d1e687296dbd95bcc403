import { JsonTransform } from "./transform";
import { IEmptyConstructor } from "./types";
export interface IJsonSerializerOptions {
    targetSchema?: IEmptyConstructor<any>;
    schemaName?: string;
}
export declare class JsonSerializer extends JsonTransform {
    static serialize(obj: any, options?: IJsonSerializerOptions, replacer?: (key: string, value: any) => any, space?: string | number): string;
    static toJSON(obj: any, options?: IJsonSerializerOptions): any;
}
