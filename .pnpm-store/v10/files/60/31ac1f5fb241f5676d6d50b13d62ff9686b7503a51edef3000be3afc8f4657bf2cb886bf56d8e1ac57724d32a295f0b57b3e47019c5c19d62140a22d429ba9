import { ReturnConsumedCapacity, ReturnItemCollectionMetrics, TransactWriteItem } from "./models_0";
/**
 * @public
 */
export interface TransactWriteItemsInput {
    /**
     * <p>An ordered array of up to 100 <code>TransactWriteItem</code> objects, each of which
     *             contains a <code>ConditionCheck</code>, <code>Put</code>, <code>Update</code>, or
     *                 <code>Delete</code> object. These can operate on items in different tables, but the
     *             tables must reside in the same Amazon Web Services account and Region, and no two of them
     *             can operate on the same item. </p>
     * @public
     */
    TransactItems: TransactWriteItem[] | undefined;
    /**
     * <p>Determines the level of detail about either provisioned or on-demand throughput
     *             consumption that is returned in the response:</p>
     *          <ul>
     *             <li>
     *                <p>
     *                   <code>INDEXES</code> - The response includes the aggregate
     *                         <code>ConsumedCapacity</code> for the operation, together with
     *                         <code>ConsumedCapacity</code> for each table and secondary index that was
     *                     accessed.</p>
     *                <p>Note that some operations, such as <code>GetItem</code> and
     *                         <code>BatchGetItem</code>, do not access any indexes at all. In these cases,
     *                     specifying <code>INDEXES</code> will only return <code>ConsumedCapacity</code>
     *                     information for table(s).</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>TOTAL</code> - The response includes only the aggregate
     *                         <code>ConsumedCapacity</code> for the operation.</p>
     *             </li>
     *             <li>
     *                <p>
     *                   <code>NONE</code> - No <code>ConsumedCapacity</code> details are included in the
     *                     response.</p>
     *             </li>
     *          </ul>
     * @public
     */
    ReturnConsumedCapacity?: ReturnConsumedCapacity | undefined;
    /**
     * <p>Determines whether item collection metrics are returned. If set to <code>SIZE</code>,
     *             the response includes statistics about item collections (if any), that were modified
     *             during the operation and are returned in the response. If set to <code>NONE</code> (the
     *             default), no statistics are returned. </p>
     * @public
     */
    ReturnItemCollectionMetrics?: ReturnItemCollectionMetrics | undefined;
    /**
     * <p>Providing a <code>ClientRequestToken</code> makes the call to
     *                 <code>TransactWriteItems</code> idempotent, meaning that multiple identical calls
     *             have the same effect as one single call.</p>
     *          <p>Although multiple identical calls using the same client request token produce the same
     *             result on the server (no side effects), the responses to the calls might not be the
     *             same. If the <code>ReturnConsumedCapacity</code> parameter is set, then the initial
     *                 <code>TransactWriteItems</code> call returns the amount of write capacity units
     *             consumed in making the changes. Subsequent <code>TransactWriteItems</code> calls with
     *             the same client token return the number of read capacity units consumed in reading the
     *             item.</p>
     *          <p>A client request token is valid for 10 minutes after the first request that uses it is
     *             completed. After 10 minutes, any request with the same client token is treated as a new
     *             request. Do not resubmit the same request with the same client token for more than 10
     *             minutes, or the result might not be idempotent.</p>
     *          <p>If you submit a request with the same client token but a change in other parameters
     *             within the 10-minute idempotency window, DynamoDB returns an
     *                 <code>IdempotentParameterMismatch</code> exception.</p>
     * @public
     */
    ClientRequestToken?: string | undefined;
}
