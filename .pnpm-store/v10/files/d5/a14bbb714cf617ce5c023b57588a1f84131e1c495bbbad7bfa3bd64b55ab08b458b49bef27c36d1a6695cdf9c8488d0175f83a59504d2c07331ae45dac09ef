import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { CreateIndexInput, CreateIndexOutput } from "../models/models_0";
import { S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../S3VectorsClient";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link CreateIndexCommand}.
 */
export interface CreateIndexCommandInput extends CreateIndexInput {
}
/**
 * @public
 *
 * The output of {@link CreateIndexCommand}.
 */
export interface CreateIndexCommandOutput extends CreateIndexOutput, __MetadataBearer {
}
declare const CreateIndexCommand_base: {
    new (input: CreateIndexCommandInput): import("@smithy/smithy-client").CommandImpl<CreateIndexCommandInput, CreateIndexCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: CreateIndexCommandInput): import("@smithy/smithy-client").CommandImpl<CreateIndexCommandInput, CreateIndexCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <note> <p>Amazon S3 Vectors is in preview release for Amazon S3 and is subject to change.</p> </note> <p>Creates a vector index within a vector bucket. To specify the vector bucket, you must use either the vector bucket name or the vector bucket Amazon Resource Name (ARN).</p> <dl> <dt>Permissions</dt> <dd> <p>You must have the <code>s3vectors:CreateIndex</code> permission to use this operation. </p> </dd> </dl>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { S3VectorsClient, CreateIndexCommand } from "@aws-sdk/client-s3vectors"; // ES Modules import
 * // const { S3VectorsClient, CreateIndexCommand } = require("@aws-sdk/client-s3vectors"); // CommonJS import
 * // import type { S3VectorsClientConfig } from "@aws-sdk/client-s3vectors";
 * const config = {}; // type is S3VectorsClientConfig
 * const client = new S3VectorsClient(config);
 * const input = { // CreateIndexInput
 *   vectorBucketName: "STRING_VALUE",
 *   vectorBucketArn: "STRING_VALUE",
 *   indexName: "STRING_VALUE", // required
 *   dataType: "float32", // required
 *   dimension: Number("int"), // required
 *   distanceMetric: "euclidean" || "cosine", // required
 *   metadataConfiguration: { // MetadataConfiguration
 *     nonFilterableMetadataKeys: [ // NonFilterableMetadataKeys // required
 *       "STRING_VALUE",
 *     ],
 *   },
 * };
 * const command = new CreateIndexCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param CreateIndexCommandInput - {@link CreateIndexCommandInput}
 * @returns {@link CreateIndexCommandOutput}
 * @see {@link CreateIndexCommandInput} for command's `input` shape.
 * @see {@link CreateIndexCommandOutput} for command's `response` shape.
 * @see {@link S3VectorsClientResolvedConfig | config} for S3VectorsClient's `config` shape.
 *
 * @throws {@link ConflictException} (client fault)
 *  <p>The request failed because a vector bucket name or a vector index name already exists. Vector bucket names must be unique within your Amazon Web Services account for each Amazon Web Services Region. Vector index names must be unique within your vector bucket. Choose a different vector bucket name or vector index name, and try again.</p>
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
export declare class CreateIndexCommand extends CreateIndexCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: CreateIndexInput;
            output: {};
        };
        sdk: {
            input: CreateIndexCommandInput;
            output: CreateIndexCommandOutput;
        };
    };
}
