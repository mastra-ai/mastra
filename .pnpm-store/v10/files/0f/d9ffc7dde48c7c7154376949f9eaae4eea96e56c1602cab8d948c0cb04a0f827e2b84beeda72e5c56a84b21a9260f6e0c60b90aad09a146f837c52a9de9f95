import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { DescribeGlobalTableSettingsInput, DescribeGlobalTableSettingsOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link DescribeGlobalTableSettingsCommand}.
 */
export interface DescribeGlobalTableSettingsCommandInput extends DescribeGlobalTableSettingsInput {
}
/**
 * @public
 *
 * The output of {@link DescribeGlobalTableSettingsCommand}.
 */
export interface DescribeGlobalTableSettingsCommandOutput extends DescribeGlobalTableSettingsOutput, __MetadataBearer {
}
declare const DescribeGlobalTableSettingsCommand_base: {
    new (input: DescribeGlobalTableSettingsCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeGlobalTableSettingsCommandInput, DescribeGlobalTableSettingsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: DescribeGlobalTableSettingsCommandInput): import("@smithy/smithy-client").CommandImpl<DescribeGlobalTableSettingsCommandInput, DescribeGlobalTableSettingsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>Describes Region-specific settings for a global table.</p>
 *          <important>
 *             <p>This documentation is for version 2017.11.29 (Legacy) of global tables, which should be avoided for new global tables. Customers should use <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html">Global Tables version 2019.11.21 (Current)</a> when possible, because it provides greater flexibility, higher efficiency, and consumes less write capacity than 2017.11.29 (Legacy).</p>
 *             <p>To determine which version you're using, see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/globaltables.DetermineVersion.html">Determining the global table version you are using</a>. To update existing global tables from version 2017.11.29 (Legacy) to version 2019.11.21 (Current), see <a href="https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_upgrade.html">Upgrading global tables</a>.</p>
 *          </important>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, DescribeGlobalTableSettingsCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, DescribeGlobalTableSettingsCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // DescribeGlobalTableSettingsInput
 *   GlobalTableName: "STRING_VALUE", // required
 * };
 * const command = new DescribeGlobalTableSettingsCommand(input);
 * const response = await client.send(command);
 * // { // DescribeGlobalTableSettingsOutput
 * //   GlobalTableName: "STRING_VALUE",
 * //   ReplicaSettings: [ // ReplicaSettingsDescriptionList
 * //     { // ReplicaSettingsDescription
 * //       RegionName: "STRING_VALUE", // required
 * //       ReplicaStatus: "CREATING" || "CREATION_FAILED" || "UPDATING" || "DELETING" || "ACTIVE" || "REGION_DISABLED" || "INACCESSIBLE_ENCRYPTION_CREDENTIALS" || "ARCHIVING" || "ARCHIVED" || "REPLICATION_NOT_AUTHORIZED",
 * //       ReplicaBillingModeSummary: { // BillingModeSummary
 * //         BillingMode: "PROVISIONED" || "PAY_PER_REQUEST",
 * //         LastUpdateToPayPerRequestDateTime: new Date("TIMESTAMP"),
 * //       },
 * //       ReplicaProvisionedReadCapacityUnits: Number("long"),
 * //       ReplicaProvisionedReadCapacityAutoScalingSettings: { // AutoScalingSettingsDescription
 * //         MinimumUnits: Number("long"),
 * //         MaximumUnits: Number("long"),
 * //         AutoScalingDisabled: true || false,
 * //         AutoScalingRoleArn: "STRING_VALUE",
 * //         ScalingPolicies: [ // AutoScalingPolicyDescriptionList
 * //           { // AutoScalingPolicyDescription
 * //             PolicyName: "STRING_VALUE",
 * //             TargetTrackingScalingPolicyConfiguration: { // AutoScalingTargetTrackingScalingPolicyConfigurationDescription
 * //               DisableScaleIn: true || false,
 * //               ScaleInCooldown: Number("int"),
 * //               ScaleOutCooldown: Number("int"),
 * //               TargetValue: Number("double"), // required
 * //             },
 * //           },
 * //         ],
 * //       },
 * //       ReplicaProvisionedWriteCapacityUnits: Number("long"),
 * //       ReplicaProvisionedWriteCapacityAutoScalingSettings: {
 * //         MinimumUnits: Number("long"),
 * //         MaximumUnits: Number("long"),
 * //         AutoScalingDisabled: true || false,
 * //         AutoScalingRoleArn: "STRING_VALUE",
 * //         ScalingPolicies: [
 * //           {
 * //             PolicyName: "STRING_VALUE",
 * //             TargetTrackingScalingPolicyConfiguration: {
 * //               DisableScaleIn: true || false,
 * //               ScaleInCooldown: Number("int"),
 * //               ScaleOutCooldown: Number("int"),
 * //               TargetValue: Number("double"), // required
 * //             },
 * //           },
 * //         ],
 * //       },
 * //       ReplicaGlobalSecondaryIndexSettings: [ // ReplicaGlobalSecondaryIndexSettingsDescriptionList
 * //         { // ReplicaGlobalSecondaryIndexSettingsDescription
 * //           IndexName: "STRING_VALUE", // required
 * //           IndexStatus: "CREATING" || "UPDATING" || "DELETING" || "ACTIVE",
 * //           ProvisionedReadCapacityUnits: Number("long"),
 * //           ProvisionedReadCapacityAutoScalingSettings: {
 * //             MinimumUnits: Number("long"),
 * //             MaximumUnits: Number("long"),
 * //             AutoScalingDisabled: true || false,
 * //             AutoScalingRoleArn: "STRING_VALUE",
 * //             ScalingPolicies: [
 * //               {
 * //                 PolicyName: "STRING_VALUE",
 * //                 TargetTrackingScalingPolicyConfiguration: {
 * //                   DisableScaleIn: true || false,
 * //                   ScaleInCooldown: Number("int"),
 * //                   ScaleOutCooldown: Number("int"),
 * //                   TargetValue: Number("double"), // required
 * //                 },
 * //               },
 * //             ],
 * //           },
 * //           ProvisionedWriteCapacityUnits: Number("long"),
 * //           ProvisionedWriteCapacityAutoScalingSettings: {
 * //             MinimumUnits: Number("long"),
 * //             MaximumUnits: Number("long"),
 * //             AutoScalingDisabled: true || false,
 * //             AutoScalingRoleArn: "STRING_VALUE",
 * //             ScalingPolicies: [
 * //               {
 * //                 PolicyName: "STRING_VALUE",
 * //                 TargetTrackingScalingPolicyConfiguration: {
 * //                   DisableScaleIn: true || false,
 * //                   ScaleInCooldown: Number("int"),
 * //                   ScaleOutCooldown: Number("int"),
 * //                   TargetValue: Number("double"), // required
 * //                 },
 * //               },
 * //             ],
 * //           },
 * //         },
 * //       ],
 * //       ReplicaTableClassSummary: { // TableClassSummary
 * //         TableClass: "STANDARD" || "STANDARD_INFREQUENT_ACCESS",
 * //         LastUpdateDateTime: new Date("TIMESTAMP"),
 * //       },
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param DescribeGlobalTableSettingsCommandInput - {@link DescribeGlobalTableSettingsCommandInput}
 * @returns {@link DescribeGlobalTableSettingsCommandOutput}
 * @see {@link DescribeGlobalTableSettingsCommandInput} for command's `input` shape.
 * @see {@link DescribeGlobalTableSettingsCommandOutput} for command's `response` shape.
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
 * @throws {@link DynamoDBServiceException}
 * <p>Base exception class for all service exceptions from DynamoDB service.</p>
 *
 *
 * @public
 */
export declare class DescribeGlobalTableSettingsCommand extends DescribeGlobalTableSettingsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DescribeGlobalTableSettingsInput;
            output: DescribeGlobalTableSettingsOutput;
        };
        sdk: {
            input: DescribeGlobalTableSettingsCommandInput;
            output: DescribeGlobalTableSettingsCommandOutput;
        };
    };
}
