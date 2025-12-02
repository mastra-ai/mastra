import { DeleteResult } from '../query-builder/delete-result.js';
import { InsertResult } from '../query-builder/insert-result.js';
import { MergeResult } from '../query-builder/merge-result.js';
import { UpdateResult } from '../query-builder/update-result.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { Compilable } from './compilable.js';
import { Simplify } from './type-utils.js';
/**
 * A helper type that allows inferring a select/insert/update/delete query's result
 * type from a query builder or compiled query.
 *
 * ### Examples
 *
 * Infer a query builder's result type:
 *
 * ```ts
 * import { InferResult } from 'kysely'
 *
 * const query = db
 *   .selectFrom('person')
 *   .innerJoin('pet', 'pet.owner_id', 'person.id')
 *   .select(['person.first_name', 'pet.name'])
 *
 * type QueryResult = InferResult<typeof query> // { first_name: string; name: string; }[]
 * ```
 *
 * Infer a compiled query's result type:
 *
 * ```ts
 * import { InferResult } from 'kysely'
 *
 * const compiledQuery = db
 *   .insertInto('person')
 *   .values({
 *     first_name: 'Foo',
 *     last_name: 'Barson',
 *     gender: 'other',
 *     age: 15,
 *   })
 *   .returningAll()
 *   .compile()
 *
 * type QueryResult = InferResult<typeof compiledQuery> // Selectable<Person>[]
 * ```
 */
export type InferResult<C extends Compilable<any> | CompiledQuery<any>> = C extends Compilable<infer O> ? ResolveResult<O> : C extends CompiledQuery<infer O> ? ResolveResult<O> : never;
type ResolveResult<O> = O extends InsertResult | UpdateResult | DeleteResult | MergeResult ? O[] : Simplify<O>[];
export {};
