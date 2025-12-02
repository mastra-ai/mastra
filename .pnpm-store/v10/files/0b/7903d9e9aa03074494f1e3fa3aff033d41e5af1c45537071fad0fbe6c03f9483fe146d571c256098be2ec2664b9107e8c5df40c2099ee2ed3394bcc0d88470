type BasicOperator = '$eq' | '$ne';
type NumericOperator = '$gt' | '$gte' | '$lt' | '$lte';
type LogicalOperator = '$and' | '$not' | '$nor' | '$or';
type ArrayOperator = '$all' | '$in' | '$nin' | '$elemMatch';
type ElementOperator = '$exists';
type RegexOperator = '$regex' | '$options';
type QueryOperator = BasicOperator | NumericOperator | LogicalOperator | ArrayOperator | ElementOperator | RegexOperator;
type EmptyObject = Record<string, never>;
type FilterValue = string | number | boolean | Date | null | undefined | EmptyObject;
type OperatorValueMap<Op extends string = string, ValueMap extends Record<string, any> = any> = {
    $eq: FilterValue;
    $ne: FilterValue;
    $gt: number | string | Date;
    $gte: number | string | Date;
    $lt: number | string | Date;
    $lte: number | string | Date;
    $all: FilterValue[];
    $in: FilterValue[];
    $nin: FilterValue[];
    $elemMatch: Record<string, unknown>;
    $exists: boolean;
    $regex: string | RegExp;
    $options: string;
    $not: OperatorCondition<Op, ValueMap> | RegExp;
};
type LogicalOperatorValueMap = {
    $and: 'array';
    $or: 'array';
    $nor: 'array';
    $not: 'object';
};
type BlacklistedRootOperators = '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' | '$in' | '$nin' | '$all' | '$exists' | '$regex' | '$options' | '$elemMatch';
type VectorFieldValue = FilterValue | FilterValue[];
type VectorFilter<Op extends keyof ValueMap = keyof OperatorValueMap, ValueMap extends Record<string, any> = OperatorValueMap, LogicalValueMap extends Record<string, any> = LogicalOperatorValueMap, Blacklisted extends string = BlacklistedRootOperators, FieldValue = VectorFieldValue> = FilterCondition<Op, ValueMap, LogicalValueMap, Blacklisted, FieldValue> | null | undefined;
type FilterCondition<Op extends keyof ValueMap = keyof OperatorValueMap, ValueMap extends Record<string, any> = OperatorValueMap, LogicalValueMap extends Record<string, any> = LogicalOperatorValueMap, Blacklisted extends string = BlacklistedRootOperators, FieldValue = VectorFieldValue> = (FieldCondition<Op, ValueMap, FieldValue> | LogicalCondition<Op, ValueMap, LogicalValueMap>) & ForbiddenRootOperators<Blacklisted>;
type FieldCondition<Op extends keyof ValueMap = keyof OperatorValueMap, ValueMap extends Record<string, any> = OperatorValueMap, FieldValue = VectorFieldValue> = {
    [field: string]: OperatorCondition<Op, ValueMap> | FieldValue;
};
type ForbiddenRootOperators<Blacklisted extends string> = {
    [K in Blacklisted]?: never;
};
type LogicalCondition<Op extends keyof ValueMap = keyof OperatorValueMap, ValueMap extends Record<string, any> = OperatorValueMap, LogicalValueMap extends Record<string, any> = LogicalOperatorValueMap> = {
    [K in keyof LogicalValueMap]: LogicalValueMap[K] extends 'array' ? {
        [P in K]: Array<LogicalBranch<Op, ValueMap, LogicalValueMap>>;
    } : {
        [P in K]: LogicalBranch<Op, ValueMap, LogicalValueMap>;
    };
}[keyof LogicalValueMap];
type LogicalBranch<Op extends keyof ValueMap = keyof OperatorValueMap, ValueMap extends Record<string, any> = OperatorValueMap, LogicalValueMap extends Record<string, any> = LogicalOperatorValueMap> = FieldCondition<Op, ValueMap> | LogicalCondition<Op, ValueMap, LogicalValueMap>;
type OperatorCondition<Op extends keyof ValueMap = keyof OperatorValueMap, ValueMap extends Record<string, any> = OperatorValueMap> = {
    [K in Exclude<Op, '$and' | '$or' | '$nor'>]?: ValueMap[K];
};
type OperatorSupport = {
    logical?: LogicalOperator[];
    array?: ArrayOperator[];
    basic?: BasicOperator[];
    numeric?: NumericOperator[];
    element?: ElementOperator[];
    regex?: RegexOperator[];
    custom?: string[];
};
declare abstract class BaseFilterTranslator<Filter = VectorFilter, Result = Filter> {
    abstract translate(filter: Filter): Result;
    /**
     * Operator type checks
     */
    protected isOperator(key: string): key is QueryOperator;
    protected static readonly BASIC_OPERATORS: BasicOperator[];
    protected static readonly NUMERIC_OPERATORS: NumericOperator[];
    protected static readonly ARRAY_OPERATORS: ArrayOperator[];
    protected static readonly LOGICAL_OPERATORS: LogicalOperator[];
    protected static readonly ELEMENT_OPERATORS: ElementOperator[];
    protected static readonly REGEX_OPERATORS: RegexOperator[];
    static readonly DEFAULT_OPERATORS: {
        logical: LogicalOperator[];
        basic: BasicOperator[];
        numeric: NumericOperator[];
        array: ArrayOperator[];
        element: "$exists"[];
        regex: RegexOperator[];
    };
    protected isLogicalOperator(key: string): key is LogicalOperator;
    protected isBasicOperator(key: string): key is BasicOperator;
    protected isNumericOperator(key: string): key is NumericOperator;
    protected isArrayOperator(key: string): key is ArrayOperator;
    protected isElementOperator(key: string): key is ElementOperator;
    protected isRegexOperator(key: string): key is RegexOperator;
    protected isFieldOperator(key: string): key is QueryOperator;
    protected isCustomOperator(key: string): boolean;
    protected getSupportedOperators(): OperatorSupport;
    protected isValidOperator(key: string): boolean;
    /**
     * Value normalization for comparison operators
     */
    protected normalizeComparisonValue(value: any): any;
    /**
     * Helper method to simulate $all operator using $and + $eq when needed.
     * Some vector stores don't support $all natively.
     */
    protected simulateAllOperator(field: string, values: any[]): VectorFilter<keyof OperatorValueMap, OperatorValueMap>;
    /**
     * Utility functions for type checking
     */
    protected isPrimitive(value: any): boolean;
    protected isRegex(value: any): boolean;
    protected isEmpty(obj: any): boolean;
    protected static readonly ErrorMessages: {
        readonly UNSUPPORTED_OPERATOR: (op: string) => string;
        readonly INVALID_LOGICAL_OPERATOR_LOCATION: (op: string, path: string) => string;
        readonly NOT_REQUIRES_OBJECT: "$not operator requires an object";
        readonly NOT_CANNOT_BE_EMPTY: "$not operator cannot be empty";
        readonly INVALID_LOGICAL_OPERATOR_CONTENT: (path: string) => string;
        readonly INVALID_TOP_LEVEL_OPERATOR: (op: string) => string;
        readonly ELEM_MATCH_REQUIRES_OBJECT: "$elemMatch requires an object with conditions";
    };
    /**
     * Helper to handle array value normalization consistently
     */
    protected normalizeArrayValues(values: any[]): any[];
    protected validateFilter(filter: Filter): void;
    /**
     * Validates if a filter structure is supported by the specific vector DB
     * and returns detailed validation information.
     */
    private validateFilterSupport;
}
export { type QueryOperator, type BasicOperator, type NumericOperator, type LogicalOperator, type ArrayOperator, type RegexOperator, type ElementOperator, type VectorFilter, type FilterValue, type VectorFieldValue, type FieldCondition, type OperatorCondition, type OperatorSupport, type OperatorValueMap, type LogicalOperatorValueMap, type BlacklistedRootOperators, BaseFilterTranslator, };
//# sourceMappingURL=base.d.ts.map