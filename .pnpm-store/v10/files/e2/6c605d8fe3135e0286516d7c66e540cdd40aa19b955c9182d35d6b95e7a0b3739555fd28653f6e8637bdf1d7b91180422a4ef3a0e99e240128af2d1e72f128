import type { GenericFunction, GenericSchema, GenericSetofOption } from './common'

// Functions matching utils
type IsMatchingArgs<
  FnArgs extends GenericFunction['Args'],
  PassedArgs extends GenericFunction['Args'],
> = [FnArgs] extends [Record<PropertyKey, never>]
  ? PassedArgs extends Record<PropertyKey, never>
    ? true
    : false
  : keyof PassedArgs extends keyof FnArgs
    ? PassedArgs extends FnArgs
      ? true
      : false
    : false

type MatchingFunctionArgs<
  Fn extends GenericFunction,
  Args extends GenericFunction['Args'],
> = Fn extends { Args: infer A extends GenericFunction['Args'] }
  ? IsMatchingArgs<A, Args> extends true
    ? Fn
    : never
  : false

type FindMatchingFunctionByArgs<
  FnUnion,
  Args extends GenericFunction['Args'],
> = FnUnion extends infer Fn extends GenericFunction ? MatchingFunctionArgs<Fn, Args> : false

// Types for working with database schemas
type TablesAndViews<Schema extends GenericSchema> = Schema['Tables'] & Exclude<Schema['Views'], ''>

// Utility types for working with unions
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never

type LastOf<T> =
  UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never

type IsAny<T> = 0 extends 1 & T ? true : false

type ExactMatch<T, S> = [T] extends [S] ? ([S] extends [T] ? true : false) : false

type ExtractExactFunction<Fns, Args> = Fns extends infer F
  ? F extends GenericFunction
    ? ExactMatch<F['Args'], Args> extends true
      ? F
      : never
    : never
  : never

type IsNever<T> = [T] extends [never] ? true : false

type RpcFunctionNotFound<FnName> = {
  Row: any
  Result: {
    error: true
  } & "Couldn't infer function definition matching provided arguments"
  RelationName: FnName
  Relationships: null
}

export type GetRpcFunctionFilterBuilderByArgs<
  Schema extends GenericSchema,
  FnName extends string & keyof Schema['Functions'],
  Args,
> = {
  0: Schema['Functions'][FnName]
  // If the Args is exactly never (function call without any params)
  1: IsAny<Schema> extends true
    ? any
    : IsNever<Args> extends true
      ? // This is for retro compatibility, if the funcition is defined with an single return and an union of Args
        // we fallback to the last function definition matched by name
        IsNever<ExtractExactFunction<Schema['Functions'][FnName], Args>> extends true
        ? LastOf<Schema['Functions'][FnName]>
        : ExtractExactFunction<Schema['Functions'][FnName], Args>
      : Args extends Record<PropertyKey, never>
        ? LastOf<Schema['Functions'][FnName]>
        : // Otherwise, we attempt to match with one of the function definition in the union based
          // on the function arguments provided
          Args extends GenericFunction['Args']
          ? // This is for retro compatibility, if the funcition is defined with an single return and an union of Args
            // we fallback to the last function definition matched by name
            IsNever<
              LastOf<FindMatchingFunctionByArgs<Schema['Functions'][FnName], Args>>
            > extends true
            ? LastOf<Schema['Functions'][FnName]>
            : // Otherwise, we use the arguments based function definition narrowing to get the right value
              LastOf<FindMatchingFunctionByArgs<Schema['Functions'][FnName], Args>>
          : // If we can't find a matching function by args, we try to find one by function name
            ExtractExactFunction<Schema['Functions'][FnName], Args> extends GenericFunction
            ? ExtractExactFunction<Schema['Functions'][FnName], Args>
            : any
}[1] extends infer Fn
  ? // If we are dealing with an non-typed client everything is any
    IsAny<Fn> extends true
    ? { Row: any; Result: any; RelationName: FnName; Relationships: null }
    : // Otherwise, we use the arguments based function definition narrowing to get the rigt value
      Fn extends GenericFunction
      ? {
          Row: Fn['SetofOptions'] extends GenericSetofOption
            ? Fn['SetofOptions']['isSetofReturn'] extends true
              ? TablesAndViews<Schema>[Fn['SetofOptions']['to']]['Row']
              : TablesAndViews<Schema>[Fn['SetofOptions']['to']]['Row']
            : Fn['Returns'] extends any[]
              ? Fn['Returns'][number] extends Record<string, unknown>
                ? Fn['Returns'][number]
                : never
              : Fn['Returns'] extends Record<string, unknown>
                ? Fn['Returns']
                : never
          Result: Fn['SetofOptions'] extends GenericSetofOption
            ? Fn['SetofOptions']['isSetofReturn'] extends true
              ? Fn['SetofOptions']['isOneToOne'] extends true
                ? Fn['Returns'][]
                : Fn['Returns']
              : Fn['Returns']
            : Fn['Returns']
          RelationName: Fn['SetofOptions'] extends GenericSetofOption
            ? Fn['SetofOptions']['to']
            : FnName
          Relationships: Fn['SetofOptions'] extends GenericSetofOption
            ? Fn['SetofOptions']['to'] extends keyof Schema['Tables']
              ? Schema['Tables'][Fn['SetofOptions']['to']]['Relationships']
              : Schema['Views'][Fn['SetofOptions']['to']]['Relationships']
            : null
        }
      : // If we failed to find the function by argument, we still pass with any but also add an overridable
        Fn extends false
        ? RpcFunctionNotFound<FnName>
        : RpcFunctionNotFound<FnName>
  : RpcFunctionNotFound<FnName>
