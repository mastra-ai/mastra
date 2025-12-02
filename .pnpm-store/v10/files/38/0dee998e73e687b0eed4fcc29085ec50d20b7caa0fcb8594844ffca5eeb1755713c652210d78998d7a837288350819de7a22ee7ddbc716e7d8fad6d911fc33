export declare type IEmptyConstructor<T> = new () => T;
export interface IJsonConverter<T, S> {
    fromJSON(value: S, target: any): T;
    toJSON(value: T, target: any): S;
}
export interface IJsonConvertible<T = any> {
    fromJSON(json: T): this;
    toJSON(): T;
}
export interface IValidation {
    validate(value: any): void;
}
