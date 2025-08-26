import { BaseFilterTranslator } from '@mastra/core/vector/filter';
import type {
  VectorFilter,
  LogicalOperator,
  OperatorSupport,
  OperatorValueMap,
  LogicalOperatorValueMap,
  BlacklistedRootOperators,
} from '@mastra/core/vector/filter';
import { GetTypeOfField, OperatorHandler, LogicalHandler, IsLogicalOperator } from './operators';

type CouchbaseOperatorValueMap = Omit<
  OperatorValueMap,
  '$all' | '$in' | '$nin' | '$elemMatch' | '$exists' | '$regex' | '$options' | '$not'
> & {
  $gt: number | Date;
  $gte: number | Date;
  $lt: number | Date;
  $lte: number | Date;
};

type CouchbaseLogicalOperatorValueMap = LogicalOperatorValueMap;

type CouchbaseBlacklistedRootOperators = BlacklistedRootOperators;

type CouchbaseVectorFilter = VectorFilter<
  keyof CouchbaseOperatorValueMap,
  CouchbaseOperatorValueMap,
  CouchbaseLogicalOperatorValueMap,
  CouchbaseBlacklistedRootOperators
>;

/**
 * Translates Mastra-style filters to Couchbase compatible filters.
 */
class CouchbaseFilterTranslator extends BaseFilterTranslator<CouchbaseVectorFilter, CouchbaseVectorFilter> {
  /**
   * Override getSupportedOperators to customize which operators are supported
   * This aligns with the CouchbaseOperatorValueMap and CouchbaseLogicalOperatorValueMap types
   */
  protected getSupportedOperators(): OperatorSupport {
    // Get default operators from base class
    const baseOperators = BaseFilterTranslator.DEFAULT_OPERATORS;

    return {
      // Include only the logical operators we support
      logical: ['$and', '$or', '$not', '$nor'] as LogicalOperator[],

      // Include basic operators
      basic: baseOperators.basic,

      // Include numeric operators
      numeric: baseOperators.numeric,

      // Array operators that are supported by Couchbase
      array: [],

      // Element operators
      element: [],

      // Regex operators
      regex: [],

      // Any custom operators would go here
      custom: [],
    };
  }

  translate(filter: CouchbaseVectorFilter): any {
    /**
     * Steps to translate a filter in Mastra format with features which Couchbase supports to a format which Couchbase SQL++ query actually understands:
     * 1. Validate the filter
     *      - Check if the filter is empty
     *      - Check if the mastra filter only has the operators which Couchbase supports                                         <-|
     *      - Check, if the operators are in the correct shape                                                                   <-|
     *      - Check, if the operators have the correct value types                                                               <-|==> These are done by the BaseFilterTranslator class
     *      - Check, if the operators values are on the correct fields [Optional, but then more robust error handling is needed] <-|
     *      - If any of the above checks fail, throw an error indicating where all the format was wrong, or what was expected    <-|
     * 2. Translate the filter
     */

    // Step 1
    if (this.isEmpty(filter)) {
      return filter;
    }
    this.validateFilter(filter);

    // Step 2
    return CouchbaseFilterTranslator.translateNode(filter);
  }

  static translateNode(node: any): any {
    const result: { conjuncts: any[] } = { conjuncts: [] };
    for (const key in node) {
      if (IsLogicalOperator(key)) {
        const [logicalOperatorHandler, lowerLevelHandler] = LogicalHandler(
          key,
          CouchbaseFilterTranslator.translateNode,
        );
        const lowerLevelResult = lowerLevelHandler(node[key]);
        result.conjuncts.push(logicalOperatorHandler(lowerLevelResult));
      } else if (!key.startsWith('$')) {
        const typeOfField = GetTypeOfField(node[key]);
        const basicOperatorHandler = OperatorHandler(typeOfField);
        result.conjuncts.push(basicOperatorHandler(key, node[key]));
      } else {
        throw new Error(`Invalid filter: ${key} is not a valid operator`);
      }
    }
    return result;
  }
}

export { CouchbaseFilterTranslator, type CouchbaseVectorFilter };
