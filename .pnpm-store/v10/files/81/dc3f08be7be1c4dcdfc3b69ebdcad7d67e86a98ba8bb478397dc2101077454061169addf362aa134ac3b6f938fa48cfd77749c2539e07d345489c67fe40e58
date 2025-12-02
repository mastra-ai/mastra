import { IJsonSchema } from "../schema";
import { ParserError } from "./parser_error";
export interface IKeyErrors {
    [key: string]: Error;
}
export declare class KeyError extends ParserError {
    keys: string[];
    errors: IKeyErrors;
    constructor(schema: IJsonSchema, keys: string[], errors?: IKeyErrors);
}
