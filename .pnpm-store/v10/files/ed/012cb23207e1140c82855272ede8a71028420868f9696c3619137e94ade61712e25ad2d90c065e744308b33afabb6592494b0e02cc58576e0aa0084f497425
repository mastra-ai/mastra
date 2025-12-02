import type * as graphqlTypes from 'graphql';
import type * as api from '@opentelemetry/api';
import type { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue';
import type { DocumentNode } from 'graphql/language/ast';
import type { GraphQLFieldResolver, GraphQLTypeResolver } from 'graphql/type/definition';
import { OTEL_GRAPHQL_DATA_SYMBOL, OTEL_PATCHED_SYMBOL } from './symbols';
export declare const OPERATION_NOT_SUPPORTED: string;
export declare type executeFunctionWithObj = (args: graphqlTypes.ExecutionArgs) => PromiseOrValue<graphqlTypes.ExecutionResult>;
export declare type executeArgumentsArray = [
    graphqlTypes.GraphQLSchema,
    graphqlTypes.DocumentNode,
    any,
    any,
    Maybe<{
        [key: string]: any;
    }>,
    Maybe<string>,
    Maybe<graphqlTypes.GraphQLFieldResolver<any, any>>,
    Maybe<graphqlTypes.GraphQLTypeResolver<any, any>>
];
export declare type executeFunctionWithArgs = (schema: graphqlTypes.GraphQLSchema, document: graphqlTypes.DocumentNode, rootValue?: any, contextValue?: any, variableValues?: Maybe<{
    [key: string]: any;
}>, operationName?: Maybe<string>, fieldResolver?: Maybe<graphqlTypes.GraphQLFieldResolver<any, any>>, typeResolver?: Maybe<graphqlTypes.GraphQLTypeResolver<any, any>>) => PromiseOrValue<graphqlTypes.ExecutionResult>;
export interface OtelExecutionArgs {
    schema: graphqlTypes.GraphQLSchema;
    document: DocumentNode & ObjectWithGraphQLData;
    rootValue?: any;
    contextValue?: any & ObjectWithGraphQLData;
    variableValues?: Maybe<{
        [key: string]: any;
    }>;
    operationName?: Maybe<string>;
    fieldResolver?: Maybe<GraphQLFieldResolver<any, any> & OtelPatched>;
    typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
}
export declare type executeType = executeFunctionWithObj | executeFunctionWithArgs;
export declare type parseType = (source: string | graphqlTypes.Source, options?: graphqlTypes.ParseOptions) => graphqlTypes.DocumentNode;
export declare type validateType = (schema: graphqlTypes.GraphQLSchema, documentAST: graphqlTypes.DocumentNode, rules?: ReadonlyArray<graphqlTypes.ValidationRule>, options?: {
    maxErrors?: number;
}, typeInfo?: graphqlTypes.TypeInfo) => ReadonlyArray<graphqlTypes.GraphQLError>;
export interface GraphQLField {
    parent: api.Span;
    span: api.Span;
    error: Error | null;
}
interface OtelGraphQLData {
    source?: any;
    span: api.Span;
    fields: {
        [key: string]: GraphQLField;
    };
}
export interface ObjectWithGraphQLData {
    [OTEL_GRAPHQL_DATA_SYMBOL]?: OtelGraphQLData;
}
export interface OtelPatched {
    [OTEL_PATCHED_SYMBOL]?: boolean;
}
export interface GraphQLPath {
    prev: GraphQLPath | undefined;
    key: string | number;
    /**
     * optional as it didn't exist yet in ver 14
     */
    typename?: string | undefined;
}
/**
 * Moving this type from ver 15 of graphql as it is nto available in ver. 14s
 * this way it can compile against ver 14.
 */
export declare type Maybe<T> = null | undefined | T;
export {};
//# sourceMappingURL=internal-types.d.ts.map