import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { UpdateTableReplicaAutoScalingInput, UpdateTableReplicaAutoScalingOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link UpdateTableReplicaAutoScalingCommand}.
 */
export interface UpdateTableReplicaAutoScalingCommandInput extends UpdateTableReplicaAutoScalingInput {
}
/**
 * @public
 *
 * The output of {@link UpdateTableReplicaAutoScalingCommand}.
 */
export interface UpdateTableReplicaAutoScalingCommandOutput extends UpdateTableReplicaAutoScalingOutput, __MetadataBearer {
}
declare const UpdateTableReplicaAutoScalingCommand_base: {
    new (input: UpdateTableReplicaAutoScalingCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateTableReplicaAutoScalingCommandInput, UpdateTableReplicaAutoScalingCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: UpdateTableReplicaAutoScalingCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateTableReplicaAutoScalingCommandInput, UpdateTableReplicaAutoScalingCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Updates auto scaling settings on your global tables at once.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, UpdateTableReplicaAutoScalingCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, UpdateTableReplicaAutoScalingCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // UpdateTableReplicaAutoScalingInput
 *   GlobalSecondaryIndexUpdates: [ // GlobalSecondaryIndexAutoScalingUpdateList
 *     { // GlobalSecondaryIndexAutoScalingUpdate
 *       IndexName: "STRING_VALUE",
 *       ProvisionedWriteCapacityAutoScalingUpdate: { // AutoScalingSettingsUpdate
 *         MinimumUnits: Number("long"),
 *         MaximumUnits: Number("long"),
 *         AutoScalingDisabled: true || false,
 *         AutoScalingRoleArn: "STRING_VALUE",
 *         ScalingPolicyUpdate: { // AutoScalingPolicyUpdate
 *           PolicyName: "STRING_VALUE",
 *           TargetTrackingScalingPolicyConfiguration: { // AutoScalingTargetTrackingScalingPolicyConfigurationUpdate
 *             DisableScaleIn: true || false,
 *             ScaleInCooldown: Number("int"),
 *             ScaleOutCooldown: Number("int"),
 *             TargetValue: Number("double"), // required
 *           },
 *         },
 *       },
 *     },
 *   ],
 *   TableName: "STRING_VALUE", // required
 *   ProvisionedWriteCapacityAutoScalingUpdate: {
 *     MinimumUnits: Number("long"),
 *     MaximumUnits: Number("long"),
 *     AutoScalingDisabled: true || false,
 *     AutoScalingRoleArn: "STRING_VALUE",
 *     ScalingPolicyUpdate: {
 *       PolicyName: "STRING_VALUE",
 *       TargetTrackingScalingPolicyConfiguration: {
 *         DisableScaleIn: true || false,
 *         ScaleInCooldown: Number("int"),
 *         ScaleOutCooldown: Number("int"),
 *         TargetValue: Number("double"), // required
 *       },
 *     },
 *   },
 *   ReplicaUpdates: [ // ReplicaAutoScalingUpdateList
 *     { // ReplicaAutoScalingUpdate
 *       RegionName: "STRING_VALUE", // required
 *       ReplicaGlobalSecondaryIndexUpdates: [ // ReplicaGlobalSecondaryIndexAutoScalingUpdateList
 *         { // ReplicaGlobalSecondaryIndexAutoScalingUpdate
 *           IndexName: "STRING_VALUE",
 *           ProvisionedReadCapacityAutoScalingUpdate: "<AutoScalingSettingsUpdate>",
 *         },
 *       ],
 *       ReplicaProvisionedReadCapacityAutoScalingUpdate: "<AutoScalingSettingsUpdate>",
 *     },
 *   ],
 * };
 * const command = new UpdateTableReplicaAutoScalingCommand(input);
 * const response = await client.send(command);
 * // { // UpdateTableReplicaAutoScalingOutput
 * //   TableAutoScalingDescription: { // TableAutoScalingDescription
 * //     TableName: "STRING_VALUE",
 * //     TableStatus: "CREATING" || "UPDATING" || "DELETING" || "ACTIVE" || "INACCESSIBLE_ENCRYPTION_CREDENTIALS" || "ARCHIVING" || "ARCHIVED" || "REPLICATION_NOT_AUTHORIZED",
 * //     Replicas: [ // ReplicaAutoScalingDescriptionList
 * //       { // ReplicaAutoScalingDescription
 * //         RegionName: "STRING_VALUE",
 * //         GlobalSecondaryIndexes: [ // ReplicaGlobalSecondaryIndexAutoScalingDescriptionList
 * //           { // ReplicaGlobalSecondaryIndexAutoScalingDescription
 * //             IndexName: "STRING_VALUE",
 * //             IndexStatus: "CREATING" || "UPDATING" || "DELETING" || "ACTIVE",
 * //             ProvisionedReadCapacityAutoScalingSettings: { // AutoScalingSettingsDescription
 * //               MinimumUnits: Number("long"),
 * //               MaximumUnits: Number("long"),
 * //               AutoScalingDisabled: true || false,
 * //               AutoScalingRoleArn: "STRING_VALUE",
 * //               ScalingPolicies: [ // AutoScalingPolicyDescriptionList
 * //                 { // AutoScalingPolicyDescription
 * //                   PolicyName: "STRING_VALUE",
 * //                   TargetTrackingScalingPolicyConfiguration: { // AutoScalingTargetTrackingScalingPolicyConfigurationDescription
 * //                     DisableScaleIn: true || false,
 * //                     ScaleInCooldown: Number("int"),
 * //                     ScaleOutCooldown: Number("int"),
 * //                     TargetValue: Number("double"), // required
 * //                   },
 * //                 },
 * //               ],
 * //             },
 * //             ProvisionedWriteCapacityAutoScalingSettings: {
 * //               MinimumUnits: Number("long"),
 * //               MaximumUnits: Number("long"),
 * //               AutoScalingDisabled: true || false,
 * //               AutoScalingRoleArn: "STRING_VALUE",
 * //               ScalingPolicies: [
 * //                 {
 * //                   PolicyName: "STRING_VALUE",
 * //                   TargetTrackingScalingPolicyConfiguration: {
 * //                     DisableScaleIn: true || false,
 * //                     ScaleInCooldown: Number("int"),
 * //                     ScaleOutCooldown: Number("int"),
 * //                     TargetValue: Number("double"), // required
 * //                   },
 * //                 },
 * //               ],
 * //             },
 * //           },
 * //         ],
 * //         ReplicaProvisionedReadCapacityAutoScalingSettings: {
 * //           MinimumUnits: Number("long"),
 * //           MaximumUnits: Number("long"),
 * //           AutoScalingDisabled: true || false,
 * //           AutoScalingRoleArn: "STRING_VALUE",
 * //           ScalingPolicies: [
 * //             {
 * //               PolicyName: "STRING_VALUE",
 * //               TargetTrackingScalingPolicyConfiguration: {
 * //                 DisableScaleIn: true || false,
 * //                 ScaleInCooldown: Number("int"),
 * //                 ScaleOutCooldown: Number("int"),
 * //                 TargetValue: Number("double"), // required
 * //               },
 * //             },
 * //           ],
 * //         },
 * //         ReplicaProvisionedWriteCapacityAutoScalingSettings: {
 * //           MinimumUnits: Number("long"),
 * //           MaximumUnits: Number("long"),
 * //           AutoScalingDisabled: true || false,
 * //           AutoScalingRoleArn: "STRING_VALUE",
 * //           ScalingPolicies: [
 * //             {
 * //               PolicyName: "STRING_VALUE",
 * //               TargetTrackingScalingPolicyConfiguration: {
 * //                 DisableScaleIn: true || false,
 * //                 ScaleInCooldown: Number("int"),
 * //                 ScaleOutCooldown: Number("int"),
 * //                 TargetValue: Number("double"), // required
 * //               },
 * //             },
 * //           ],
 * //         },
 * //         ReplicaStatus: "CREATING" || "CREATION_FAILED" || "UPDATING" || "DELETING" || "ACTIVE" || "REGION_DISABLED" || "INACCESSIBLE_ENCRYPTION_CREDENTIALS" || "ARCHIVING" || "ARCHIVED" || "REPLICATION_NOT_AUTHORIZED",
 * //       },
 * //     ],
 * //   },
 * // };
 *
 * ```
 *
 * @param UpdateTableReplicaAutoScalingCommandInput - {@link UpdateTableReplicaAutoScalingCommandInput}
 * @returns {@link UpdateTableReplicaAutoScalingCommandOutput}
 * @see {@link UpdateTableReplicaAutoScalingCommandInput} for command's `input` shape.
 * @see {@link UpdateTableReplicaAutoScalingCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
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
 * @throws {@link ResourceInUseException} (client fault)
 *  <p>The operation conflicts with the resource's availability. For example:</p>
 *          <ul>
 *             <li>
 *                <p>You attempted to recreate an existing table.</p>
 *             </li>
 *             <li>
 *                <p>You tried to delete a table currently in the <code>CREATING</code>
 *                     state.</p>
 *             </li>
 *             <li>
 *                <p>You tried to update a resource that was already being updated.</p>
 *             </li>
 *          </ul>
 *          <p>When appropriate, wait for the ongoing update to complete and attempt the request
 *             again.</p>
 *
 * @throws {@link ResourceNotFoundException} (client fault)
 *  <p>The operation tried to access a nonexistent table or index. The resource might not
 *             be specified correctly, or its status might not be <code>ACTIVE</code>.</p>
 *
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @public
 */
export declare class UpdateTableReplicaAutoScalingCommand extends UpdateTableReplicaAutoScalingCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdateTableReplicaAutoScalingInput;
            output: UpdateTableReplicaAutoScalingOutput;
        };
        sdk: {
            input: UpdateTableReplicaAutoScalingCommandInput;
            output: UpdateTableReplicaAutoScalingCommandOutput;
        };
    };
}
