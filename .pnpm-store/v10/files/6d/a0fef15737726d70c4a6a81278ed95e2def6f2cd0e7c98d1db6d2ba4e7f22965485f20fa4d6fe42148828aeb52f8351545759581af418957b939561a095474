import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { UpdateGlobalTableInput, UpdateGlobalTableOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link UpdateGlobalTableCommand}.
 */
export interface UpdateGlobalTableCommandInput extends UpdateGlobalTableInput {
}
/**
 * @public
 *
 * The output of {@link UpdateGlobalTableCommand}.
 */
export interface UpdateGlobalTableCommandOutput extends UpdateGlobalTableOutput, __MetadataBearer {
}
declare const UpdateGlobalTableCommand_base: {
    new (input: UpdateGlobalTableCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateGlobalTableCommandInput, UpdateGlobalTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: UpdateGlobalTableCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateGlobalTableCommandInput, UpdateGlobalTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Adds or removes replicas in the specified global table. The global table must already
 *             exist to be able to use this operation. Any replica to be added must be empty, have the
 *             same name as the global table, have the same key schema, have DynamoDB Streams enabled,
 *             and have the same provisioned and maximum write capacity units.</p>
 *          <important>
 *             <p>This documentation is for version 2017.11.29 (Legacy) of global tables, which should be avoided for new global tables. Customers should use <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html">Global Tables version 2019.11.21 (Current)</a> when possible, because it provides greater flexibility, higher efficiency, and consumes less write capacity than 2017.11.29 (Legacy).</p>
 *             <p>To determine which version you're using, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/globaltables.DetermineVersion.html">Determining the global table version you are using</a>. To update existing global tables from version 2017.11.29 (Legacy) to version 2019.11.21 (Current), see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_upgrade.html">Upgrading global tables</a>.</p>
 *          </important>
 *          <note>
 *             <p> If you are using global tables <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html">Version
 *                     2019.11.21</a> (Current) you can use <a href="https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateTable.html">UpdateTable</a> instead. </p>
 *             <p> Although you can use <code>UpdateGlobalTable</code> to add replicas and remove
 *                 replicas in a single request, for simplicity we recommend that you issue separate
 *                 requests for adding or removing replicas. </p>
 *          </note>
 *          <p> If global secondary indexes are specified, then the following conditions must also be
 *             met: </p>
 *          <ul>
 *             <li>
 *                <p> The global secondary indexes must have the same name. </p>
 *             </li>
 *             <li>
 *                <p> The global secondary indexes must have the same hash key and sort key (if
 *                     present). </p>
 *             </li>
 *             <li>
 *                <p> The global secondary indexes must have the same provisioned and maximum write
 *                     capacity units. </p>
 *             </li>
 *          </ul>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, UpdateGlobalTableCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, UpdateGlobalTableCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // UpdateGlobalTableInput
 *   GlobalTableName: "STRING_VALUE", // required
 *   ReplicaUpdates: [ // ReplicaUpdateList // required
 *     { // ReplicaUpdate
 *       Create: { // CreateReplicaAction
 *         RegionName: "STRING_VALUE", // required
 *       },
 *       Delete: { // DeleteReplicaAction
 *         RegionName: "STRING_VALUE", // required
 *       },
 *     },
 *   ],
 * };
 * const command = new UpdateGlobalTableCommand(input);
 * const response = await client.send(command);
 * // { // UpdateGlobalTableOutput
 * //   GlobalTableDescription: { // GlobalTableDescription
 * //     ReplicationGroup: [ // ReplicaDescriptionList
 * //       { // ReplicaDescription
 * //         RegionName: "STRING_VALUE",
 * //         ReplicaStatus: "CREATING" || "CREATION_FAILED" || "UPDATING" || "DELETING" || "ACTIVE" || "REGION_DISABLED" || "INACCESSIBLE_ENCRYPTION_CREDENTIALS" || "ARCHIVING" || "ARCHIVED" || "REPLICATION_NOT_AUTHORIZED",
 * //         ReplicaStatusDescription: "STRING_VALUE",
 * //         ReplicaStatusPercentProgress: "STRING_VALUE",
 * //         KMSMasterKeyId: "STRING_VALUE",
 * //         ProvisionedThroughputOverride: { // ProvisionedThroughputOverride
 * //           ReadCapacityUnits: Number("long"),
 * //         },
 * //         OnDemandThroughputOverride: { // OnDemandThroughputOverride
 * //           MaxReadRequestUnits: Number("long"),
 * //         },
 * //         WarmThroughput: { // TableWarmThroughputDescription
 * //           ReadUnitsPerSecond: Number("long"),
 * //           WriteUnitsPerSecond: Number("long"),
 * //           Status: "CREATING" || "UPDATING" || "DELETING" || "ACTIVE" || "INACCESSIBLE_ENCRYPTION_CREDENTIALS" || "ARCHIVING" || "ARCHIVED" || "REPLICATION_NOT_AUTHORIZED",
 * //         },
 * //         GlobalSecondaryIndexes: [ // ReplicaGlobalSecondaryIndexDescriptionList
 * //           { // ReplicaGlobalSecondaryIndexDescription
 * //             IndexName: "STRING_VALUE",
 * //             ProvisionedThroughputOverride: {
 * //               ReadCapacityUnits: Number("long"),
 * //             },
 * //             OnDemandThroughputOverride: {
 * //               MaxReadRequestUnits: Number("long"),
 * //             },
 * //             WarmThroughput: { // GlobalSecondaryIndexWarmThroughputDescription
 * //               ReadUnitsPerSecond: Number("long"),
 * //               WriteUnitsPerSecond: Number("long"),
 * //               Status: "CREATING" || "UPDATING" || "DELETING" || "ACTIVE",
 * //             },
 * //           },
 * //         ],
 * //         ReplicaInaccessibleDateTime: new Date("TIMESTAMP"),
 * //         ReplicaTableClassSummary: { // TableClassSummary
 * //           TableClass: "STANDARD" || "STANDARD_INFREQUENT_ACCESS",
 * //           LastUpdateDateTime: new Date("TIMESTAMP"),
 * //         },
 * //       },
 * //     ],
 * //     GlobalTableArn: "STRING_VALUE",
 * //     CreationDateTime: new Date("TIMESTAMP"),
 * //     GlobalTableStatus: "CREATING" || "ACTIVE" || "DELETING" || "UPDATING",
 * //     GlobalTableName: "STRING_VALUE",
 * //   },
 * // };
 *
 * ```
 *
 * @param UpdateGlobalTableCommandInput - {@link UpdateGlobalTableCommandInput}
 * @returns {@link UpdateGlobalTableCommandOutput}
 * @see {@link UpdateGlobalTableCommandInput} for command's `input` shape.
 * @see {@link UpdateGlobalTableCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link GlobalTableNotFoundException} (client fault)
 *  <p>The specified global table does not exist.</p>
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
 *
 * @throws {@link InvalidEndpointException} (client fault)
 *
 * @throws {@link ReplicaAlreadyExistsException} (client fault)
 *  <p>The specified replica is already part of the global table.</p>
 *
 * @throws {@link ReplicaNotFoundException} (client fault)
 *  <p>The specified replica is no longer part of the global table.</p>
 *
 * @throws {@link TableNotFoundException} (client fault)
 *  <p>A source table with the name <code>TableName</code> does not currently exist within
 *             the subscriber's account or the subscriber is operating in the wrong Amazon Web Services
 *             Region.</p>
 *
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @public
 */
export declare class UpdateGlobalTableCommand extends UpdateGlobalTableCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdateGlobalTableInput;
            output: UpdateGlobalTableOutput;
        };
        sdk: {
            input: UpdateGlobalTableCommandInput;
            output: UpdateGlobalTableCommandOutput;
        };
    };
}
