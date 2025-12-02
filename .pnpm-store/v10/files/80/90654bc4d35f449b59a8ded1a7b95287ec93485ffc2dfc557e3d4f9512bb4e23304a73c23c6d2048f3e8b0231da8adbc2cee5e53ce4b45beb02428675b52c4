import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DeleteIndexInput, DeleteIndexOutput } from "../models/models_0";
import { S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../S3VectorsClient";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link DeleteIndexCommand}.
 */
export interface DeleteIndexCommandInput extends DeleteIndexInput {
}
/**
 * @public
 *
 * The output of {@link DeleteIndexCommand}.
 */
export interface DeleteIndexCommandOutput extends DeleteIndexOutput, __MetadataBearer {
}
declare const DeleteIndexCommand_base: {
    new (input: DeleteIndexCommandInput): import("@smithy/smithy-client").CommandImpl<DeleteIndexCommandInput, DeleteIndexCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (...[input]: [] | [DeleteIndexCommandInput]): import("@smithy/smithy-client").CommandImpl<DeleteIndexCommandInput, DeleteIndexCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <note> <p>Amazon S3 Vectors is in preview release for Amazon S3 and is subject to change.</p> </note> <p>Deletes a vector index. To specify the vector index, you can either use both the vector bucket name and vector index name, or use the vector index Amazon Resource Name (ARN). </p> <dl> <dt>Permissions</dt> <dd> <p>You must have the <code>s3vectors:DeleteIndex</code> permission to use this operation. </p> </dd> </dl>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { S3VectorsClient, DeleteIndexCommand } from "@aws-sdk/client-s3vectors"; // ES Modules import
 * // const { S3VectorsClient, DeleteIndexCommand } = require("@aws-sdk/client-s3vectors"); // CommonJS import
 * // import type { S3VectorsClientConfig } from "@aws-sdk/client-s3vectors";
 * const config = {}; // type is S3VectorsClientConfig
 * const client = new S3VectorsClient(config);
 * const input = { // DeleteIndexInput
 *   vectorBucketName: "STRING_VALUE",
 *   indexName: "STRING_VALUE",
 *   indexArn: "STRING_VALUE",
 * };
 * const command = new DeleteIndexCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param DeleteIndexCommandInput - {@link DeleteIndexCommandInput}
 * @returns {@link DeleteIndexCommandOutput}
 * @see {@link DeleteIndexCommandInput} for command's `input` shape.
 * @see {@link DeleteIndexCommandOutput} for command's `response` shape.
 * @see {@link S3VectorsClientResolvedConfig | config} for S3VectorsClient's `config` shape.
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
export declare class DeleteIndexCommand extends DeleteIndexCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: DeleteIndexInput;
            output: {};
        };
        sdk: {
            input: DeleteIndexCommandInput;
            output: DeleteIndexCommandOutput;
        };
    };
}
