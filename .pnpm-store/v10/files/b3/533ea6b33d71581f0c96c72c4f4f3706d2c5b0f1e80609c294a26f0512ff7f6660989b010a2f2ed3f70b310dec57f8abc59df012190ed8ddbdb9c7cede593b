import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../DynamoDBClient";
import { UpdateContinuousBackupsInput, UpdateContinuousBackupsOutput } from "../models/models_0";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link UpdateContinuousBackupsCommand}.
 */
export interface UpdateContinuousBackupsCommandInput extends UpdateContinuousBackupsInput {
}
/**
 * @public
 *
 * The output of {@link UpdateContinuousBackupsCommand}.
 */
export interface UpdateContinuousBackupsCommandOutput extends UpdateContinuousBackupsOutput, __MetadataBearer {
}
declare const UpdateContinuousBackupsCommand_base: {
    new (input: UpdateContinuousBackupsCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateContinuousBackupsCommandInput, UpdateContinuousBackupsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: UpdateContinuousBackupsCommandInput): import("@smithy/smithy-client").CommandImpl<UpdateContinuousBackupsCommandInput, UpdateContinuousBackupsCommandOutput, DynamoDBClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <p>
 *             <code>UpdateContinuousBackups</code> enables or disables point in time recovery for
 *             the specified table. A successful <code>UpdateContinuousBackups</code> call returns the
 *             current <code>ContinuousBackupsDescription</code>. Continuous backups are
 *                 <code>ENABLED</code> on all tables at table creation. If point in time recovery is
 *             enabled, <code>PointInTimeRecoveryStatus</code> will be set to ENABLED.</p>
 *          <p> Once continuous backups and point in time recovery are enabled, you can restore to
 *             any point in time within <code>EarliestRestorableDateTime</code> and
 *                 <code>LatestRestorableDateTime</code>. </p>
 *          <p>
 *             <code>LatestRestorableDateTime</code> is typically 5 minutes before the current time.
 *             You can restore your table to any point in time in the last 35 days. You can set the
 *                 <code>RecoveryPeriodInDays</code> to any value between 1 and 35 days.</p>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { DynamoDBClient, UpdateContinuousBackupsCommand } from "@aws-sdk/client-dynamodb"; // ES Modules import
 * // const { DynamoDBClient, UpdateContinuousBackupsCommand } = require("@aws-sdk/client-dynamodb"); // CommonJS import
 * // import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
 * const config = {}; // type is DynamoDBClientConfig
 * const client = new DynamoDBClient(config);
 * const input = { // UpdateContinuousBackupsInput
 *   TableName: "STRING_VALUE", // required
 *   PointInTimeRecoverySpecification: { // PointInTimeRecoverySpecification
 *     PointInTimeRecoveryEnabled: true || false, // required
 *     RecoveryPeriodInDays: Number("int"),
 *   },
 * };
 * const command = new UpdateContinuousBackupsCommand(input);
 * const response = await client.send(command);
 * // { // UpdateContinuousBackupsOutput
 * //   ContinuousBackupsDescription: { // ContinuousBackupsDescription
 * //     ContinuousBackupsStatus: "ENABLED" || "DISABLED", // required
 * //     PointInTimeRecoveryDescription: { // PointInTimeRecoveryDescription
 * //       PointInTimeRecoveryStatus: "ENABLED" || "DISABLED",
 * //       RecoveryPeriodInDays: Number("int"),
 * //       EarliestRestorableDateTime: new Date("TIMESTAMP"),
 * //       LatestRestorableDateTime: new Date("TIMESTAMP"),
 * //     },
 * //   },
 * // };
 *
 * ```
 *
 * @param UpdateContinuousBackupsCommandInput - {@link UpdateContinuousBackupsCommandInput}
 * @returns {@link UpdateContinuousBackupsCommandOutput}
 * @see {@link UpdateContinuousBackupsCommandInput} for command's `input` shape.
 * @see {@link UpdateContinuousBackupsCommandOutput} for command's `response` shape.
 * @see {@link DynamoDBClientResolvedConfig | config} for DynamoDBClient's `config` shape.
 *
 * @throws {@link ContinuousBackupsUnavailableException} (client fault)
 *  <p>Backups have not yet been enabled for this table.</p>
 *
 * @throws {@link InternalServerError} (server fault)
 *  <p>An error occurred on the server side.</p>
 *
 * @throws {@link InvalidEndpointException} (client fault)
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
export declare class UpdateContinuousBackupsCommand extends UpdateContinuousBackupsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: UpdateContinuousBackupsInput;
            output: UpdateContinuousBackupsOutput;
        };
        sdk: {
            input: UpdateContinuousBackupsCommandInput;
            output: UpdateContinuousBackupsCommandOutput;
        };
    };
}
