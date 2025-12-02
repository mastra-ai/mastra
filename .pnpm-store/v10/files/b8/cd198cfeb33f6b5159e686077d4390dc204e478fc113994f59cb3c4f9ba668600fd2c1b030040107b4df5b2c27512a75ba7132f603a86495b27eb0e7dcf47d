import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { CreateGlobalTableInput, CreateGlobalTableOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link CreateGlobalTableCommand}.
 */
export interface CreateGlobalTableCommandInput extends CreateGlobalTableInput {
}
/**
 * @public
 *
 * The output of {@link CreateGlobalTableCommand}.
 */
export interface CreateGlobalTableCommandOutput extends CreateGlobalTableOutput, __MetadataBearer {
}
declare const CreateGlobalTableCommand_base: {
    new (input: CreateGlobalTableCommandInput): import("@smithy/smithy-client").CommandImpl<CreateGlobalTableCommandInput, CreateGlobalTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: CreateGlobalTableCommandInput): import("@smithy/smithy-client").CommandImpl<CreateGlobalTableCommandInput, CreateGlobalTableCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Creates a global table from an existing table. A global table creates a replication
 *             relationship between two or more DynamoDB tables with the same table name in the
 *             provided Regions. </p>
 *          <important>
 *             <p>This documentation is for version 2017.11.29 (Legacy) of global tables, which should be avoided for new global tables. Customers should use <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html">Global Tables version 2019.11.21 (Current)</a> when possible, because it provides greater flexibility, higher efficiency, and consumes less write capacity than 2017.11.29 (Legacy).</p>
 *             <p>To determine which version you're using, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/globaltables.DetermineVersion.html">Determining the global table version you are using</a>. To update existing global tables from version 2017.11.29 (Legacy) to version 2019.11.21 (Current), see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_upgrade.html">Upgrading global tables</a>.</p>
 *          </important>
 *          <p>If you want to add a new replica table to a global table, each of the following
 *             conditions must be true:</p>
 *          <ul>
 *             <li>
 *                <p>The table must have the same primary key as all of the other replicas.</p>
 *             </li>
 *             <li>
 *                <p>The table must have the same name as all of the other replicas.</p>
 *             </li>
 *             <li>
 *                <p>The table must have DynamoDB Streams enabled, with the stream containing both
 *                     the new and the old images of the item.</p>
 *             </li>
 *             <li>
 *                <p>None of the replica tables in the global table can contain any data.</p>
 *             </li>
 *          </ul>
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
 *          </ul>
 *          <p> If local secondary indexes are specified, then the following conditions must also be
 *             met: </p>
 *          <ul>
 *             <li>
 *                <p> The local secondary indexes must have the same name. </p>
 *             </li>
 *             <li>
 *                <p> The local secondary indexes must have the same hash key and sort key (if
 *                     present). </p>
 *             </li>
 *          </ul>
 *          <important>
 *             <p> Write capacity settings should be set consistently across your replica tables and
 *                 secondary indexes. DynamoDB strongly recommends enabling auto scaling to manage the
 *                 write capacity settings for all of your global tables replicas and indexes. </p>
 *             <p> If you prefer to manage write capacity settings manually, you should provision
 *                 equal replicated write capacity units to your replica tables. You should also
 *                 provision equal replicated write capacity units to matching secondary indexes across
 *                 your global table. </p>
 *          </important>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, CreateGlobalTableCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, CreateGlobalTableCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // CreateGlobalTableInput
 *   GlobalTableName: "STRING_VALUE", // required
 *   ReplicationGroup: [ // ReplicaList // required
 *     { // Replica
 *       RegionName: "STRING_VALUE",
 *     },
 *   ],
 * };
 * const command = new CreateGlobalTableCommand(input);
 * const response = await client.send(command);
 * // { // CreateGlobalTableOutput
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
 * @param CreateGlobalTableCommandInput - {@link CreateGlobalTableCommandInput}
 * @returns {@link CreateGlobalTableCommandOutput}
 * @see {@link CreateGlobalTableCommandInput} for command's `input` shape.
 * @see {@link CreateGlobalTableCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link GlobalTableAlreadyExistsException} (client fault)
 *  <p>The specified global table already exists.</p>
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
 *
 * @throws {@link InvalidEndpointException} (client fault)
 *
 * @throws {@link LimitExceededException} (client fault)
 *  <p>There is no limit to the number of daily on-demand backups that can be taken. </p>
 *          <p>For most purposes, up to 500 simultaneous table operations are allowed per account.
 *             These operations include <code>CreateTable</code>, <code>UpdateTable</code>,
 *                 <code>DeleteTable</code>,<code>UpdateTimeToLive</code>,
 *                 <code>RestoreTableFromBackup</code>, and <code>RestoreTableToPointInTime</code>. </p>
 *          <p>When you are creating a table with one or more secondary indexes, you can have up
 *             to 250 such requests running at a time. However, if the table or index specifications
 *             are complex, then DynamoDB might temporarily reduce the number of concurrent
 *             operations.</p>
 *          <p>When importing into DynamoDB, up to 50 simultaneous import table operations are
 *             allowed per account.</p>
 *          <p>There is a soft account quota of 2,500 tables.</p>
 *          <p>GetRecords was called with a value of more than 1000 for the limit request
 *             parameter.</p>
 *          <p>More than 2 processes are reading from the same streams shard at the same time.
 *             Exceeding this limit may result in request throttling.</p>
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
export declare class CreateGlobalTableCommand extends CreateGlobalTableCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateGlobalTableInput;
            output: CreateGlobalTableOutput;
        };
        sdk: {
            input: CreateGlobalTableCommandInput;
            output: CreateGlobalTableCommandOutput;
        };
    };
}
