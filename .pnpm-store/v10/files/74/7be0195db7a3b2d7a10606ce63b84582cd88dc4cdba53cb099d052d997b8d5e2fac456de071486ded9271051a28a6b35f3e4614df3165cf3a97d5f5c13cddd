import PostgrestError from '../PostgrestError';
import { ContainsNull } from '../select-query-parser/types';
import { SelectQueryError } from '../select-query-parser/utils';
import { ClientServerOptions } from './common/common';
/**
 * Response format
 *
 * {@link https://github.com/supabase/supabase-js/issues/32}
 */
interface PostgrestResponseBase {
    status: number;
    statusText: string;
}
export interface PostgrestResponseSuccess<T> extends PostgrestResponseBase {
    error: null;
    data: T;
    count: number | null;
}
export interface PostgrestResponseFailure extends PostgrestResponseBase {
    error: PostgrestError;
    data: null;
    count: null;
}
export type PostgrestSingleResponse<T> = PostgrestResponseSuccess<T> | PostgrestResponseFailure;
export type PostgrestMaybeSingleResponse<T> = PostgrestSingleResponse<T | null>;
export type PostgrestResponse<T> = PostgrestSingleResponse<T[]>;
export type DatabaseWithOptions<Database, Options extends ClientServerOptions> = {
    db: Database;
    options: Options;
};
export type MaxAffectedEnabled<PostgrestVersion extends string | undefined> = PostgrestVersion extends `13${string}` ? true : false;
export type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};
export type SimplifyDeep<Type, ExcludeType = never> = ConditionalSimplifyDeep<Type, ExcludeType | NonRecursiveType | Set<unknown> | Map<unknown, unknown>, object>;
type ConditionalSimplifyDeep<Type, ExcludeType = never, IncludeType = unknown> = Type extends ExcludeType ? Type : Type extends IncludeType ? {
    [TypeKey in keyof Type]: ConditionalSimplifyDeep<Type[TypeKey], ExcludeType, IncludeType>;
} : Type;
type NonRecursiveType = BuiltIns | Function | (new (...arguments_: any[]) => unknown);
type BuiltIns = Primitive | void | Date | RegExp;
type Primitive = null | undefined | string | number | boolean | symbol | bigint;
export type IsValidResultOverride<Result, NewResult, ErrorResult, ErrorNewResult> = Result extends any[] ? NewResult extends any[] ? true : ErrorResult : NewResult extends any[] ? ErrorNewResult : true;
/**
 * Utility type to check if array types match between Result and NewResult.
 * Returns either the valid NewResult type or an error message type.
 */
export type CheckMatchingArrayTypes<Result, NewResult> = Result extends SelectQueryError<string> ? NewResult : IsValidResultOverride<Result, NewResult, {
    Error: 'Type mismatch: Cannot cast array result to a single object. Use .overrideTypes<Array<YourType>> or .returns<Array<YourType>> (deprecated) for array results or .single() to convert the result to a single object';
}, {
    Error: 'Type mismatch: Cannot cast single object to array type. Remove Array wrapper from return type or make sure you are not using .single() up in the calling chain';
}> extends infer ValidationResult ? ValidationResult extends true ? ContainsNull<Result> extends true ? NewResult | null : NewResult : ValidationResult : never;
type Simplify<T> = T extends object ? {
    [K in keyof T]: T[K];
} : T;
type ExplicitKeys<T> = {
    [K in keyof T]: string extends K ? never : K;
}[keyof T];
type MergeExplicit<New, Row> = {
    [K in ExplicitKeys<New> | ExplicitKeys<Row>]: K extends keyof New ? K extends keyof Row ? Row[K] extends SelectQueryError<string> ? New[K] : New[K] extends any[] ? Row[K] extends any[] ? Array<Simplify<MergeDeep<NonNullable<New[K][number]>, NonNullable<Row[K][number]>>>> : New[K] : IsPlainObject<NonNullable<New[K]>> extends true ? IsPlainObject<NonNullable<Row[K]>> extends true ? ContainsNull<New[K]> extends true ? // If the override wants to preserve optionality
    Simplify<MergeDeep<NonNullable<New[K]>, NonNullable<Row[K]>>> | null : Simplify<MergeDeep<New[K], NonNullable<Row[K]>>> : New[K] : New[K] : New[K] : K extends keyof Row ? Row[K] : never;
};
type MergeDeep<New, Row> = Simplify<MergeExplicit<New, Row> & (string extends keyof Row ? {
    [K: string]: Row[string];
} : {})>;
type IsPlainObject<T> = T extends any[] ? false : T extends object ? true : false;
export type MergePartialResult<NewResult, Result, Options> = Options extends {
    merge: true;
} ? Result extends any[] ? NewResult extends any[] ? Array<Simplify<MergeDeep<NewResult[number], Result[number]>>> : never : Simplify<MergeDeep<NewResult, Result>> : NewResult;
export {};
//# sourceMappingURL=types.d.ts.map