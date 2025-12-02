import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { ListIndexesInput, ListIndexesOutput } from "../models/models_0";
import { S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../S3VectorsClient";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link ListIndexesCommand}.
 */
export interface ListIndexesCommandInput extends ListIndexesInput {
}
/**
 * @public
 *
 * The output of {@link ListIndexesCommand}.
 */
export interface ListIndexesCommandOutput extends ListIndexesOutput, __MetadataBearer {
}
declare const ListIndexesCommand_base: {
    new (input: ListIndexesCommandInput): import("@smithy/smithy-client").CommandImpl<ListIndexesCommandInput, ListIndexesCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (...[input]: [] | [ListIndexesCommandInput]): import("@smithy/smithy-client").CommandImpl<ListIndexesCommandInput, ListIndexesCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <note> <p>Amazon S3 Vectors is in preview release for Amazon S3 and is subject to change.</p> </note> <p>Returns a list of all the vector indexes within the specified vector bucket. To specify the bucket, you must use either the vector bucket name or the vector bucket Amazon Resource Name (ARN). </p> <dl> <dt>Permissions</dt> <dd> <p>You must have the <code>s3vectors:ListIndexes</code> permission to use this operation. </p> </dd> </dl>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { S3VectorsClient, ListIndexesCommand } from "@aws-sdk/client-s3vectors"; // ES Modules import
 * // const { S3VectorsClient, ListIndexesCommand } = require("@aws-sdk/client-s3vectors"); // CommonJS import
 * // import type { S3VectorsClientConfig } from "@aws-sdk/client-s3vectors";
 * const config = {}; // type is S3VectorsClientConfig
 * const client = new S3VectorsClient(config);
 * const input = { // ListIndexesInput
 *   vectorBucketName: "STRING_VALUE",
 *   vectorBucketArn: "STRING_VALUE",
 *   maxResults: Number("int"),
 *   nextToken: "STRING_VALUE",
 *   prefix: "STRING_VALUE",
 * };
 * const command = new ListIndexesCommand(input);
 * const response = await client.send(command);
 * // { // ListIndexesOutput
 * //   nextToken: "STRING_VALUE",
 * //   indexes: [ // ListIndexesOutputList // required
 * //     { // IndexSummary
 * //       vectorBucketName: "STRING_VALUE", // required
 * //       indexName: "STRING_VALUE", // required
 * //       indexArn: "STRING_VALUE", // required
 * //       creationTime: new Date("TIMESTAMP"), // required
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param ListIndexesCommandInput - {@link ListIndexesCommandInput}
 * @returns {@link ListIndexesCommandOutput}
 * @see {@link ListIndexesCommandInput} for command's `input` shape.
 * @see {@link ListIndexesCommandOutput} for command's `response` shape.
 * @see {@link S3VectorsClientResolvedConfig | config} for S3VectorsClient's `config` shape.
 *
 * @throws {@link NotFoundException} (client fault)
 *  <p>The request was rejected because the specified resource can't be found.</p>
 *
 * @throws {@link ServiceUnavailableException} (server fault)
 *  <p>The service is unavailable. Wait briefly and retry your request. If it continues to fail, increase your waiting time between retries.</p>
 *
 * @throws {@link AccessDeniedException} (client fault)
 *  <p>Access denied.</p>
 *
 * @throws {@link InternalServerException} (server fault)
 *  <p>The request failed due to an internal server error.</p>
 *
 * @throws {@link ServiceQuotaExceededException} (client fault)
 *  <p>Your request exceeds a service quota. </p>
 *
 * @throws {@link TooManyRequestsException} (client fault)
 *  <p>The request was denied due to request throttling.</p>
 *
 * @throws {@link ValidationException} (client fault)
 *  <p>The requested action isn't valid.</p>
 *
 * @throws {@link S3VectorsServiceException}
 * <p>Base exception class for all service exceptions from S3Vectors service.</p>
 *
 *
 * @public
 */
export declare class ListIndexesCommand extends ListIndexesCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ListIndexesInput;
            output: ListIndexesOutput;
        };
        sdk: {
            input: ListIndexesCommandInput;
            output: ListIndexesCommandOutput;
        };
    };
}
