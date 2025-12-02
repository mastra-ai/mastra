import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { GetIndexInput, GetIndexOutput } from "../models/models_0";
import { S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../S3VectorsClient";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link GetIndexCommand}.
 */
export interface GetIndexCommandInput extends GetIndexInput {
}
/**
 * @public
 *
 * The output of {@link GetIndexCommand}.
 */
export interface GetIndexCommandOutput extends GetIndexOutput, __MetadataBearer {
}
declare const GetIndexCommand_base: {
    new (input: GetIndexCommandInput): import("@smithy/smithy-client").CommandImpl<GetIndexCommandInput, GetIndexCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (...[input]: [] | [GetIndexCommandInput]): import("@smithy/smithy-client").CommandImpl<GetIndexCommandInput, GetIndexCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <note> <p>Amazon S3 Vectors is in preview release for Amazon S3 and is subject to change.</p> </note> <p>Returns vector index attributes. To specify the vector index, you can either use both the vector bucket name and the vector index name, or use the vector index Amazon Resource Name (ARN). </p> <dl> <dt>Permissions</dt> <dd> <p>You must have the <code>s3vectors:GetIndex</code> permission to use this operation. </p> </dd> </dl>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { S3VectorsClient, GetIndexCommand } from "@aws-sdk/client-s3vectors"; // ES Modules import
 * // const { S3VectorsClient, GetIndexCommand } = require("@aws-sdk/client-s3vectors"); // CommonJS import
 * // import type { S3VectorsClientConfig } from "@aws-sdk/client-s3vectors";
 * const config = {}; // type is S3VectorsClientConfig
 * const client = new S3VectorsClient(config);
 * const input = { // GetIndexInput
 *   vectorBucketName: "STRING_VALUE",
 *   indexName: "STRING_VALUE",
 *   indexArn: "STRING_VALUE",
 * };
 * const command = new GetIndexCommand(input);
 * const response = await client.send(command);
 * // { // GetIndexOutput
 * //   index: { // Index
 * //     vectorBucketName: "STRING_VALUE", // required
 * //     indexName: "STRING_VALUE", // required
 * //     indexArn: "STRING_VALUE", // required
 * //     creationTime: new Date("TIMESTAMP"), // required
 * //     dataType: "float32", // required
 * //     dimension: Number("int"), // required
 * //     distanceMetric: "euclidean" || "cosine", // required
 * //     metadataConfiguration: { // MetadataConfiguration
 * //       nonFilterableMetadataKeys: [ // NonFilterableMetadataKeys // required
 * //         "STRING_VALUE",
 * //       ],
 * //     },
 * //   },
 * // };
 *
 * ```
 *
 * @param GetIndexCommandInput - {@link GetIndexCommandInput}
 * @returns {@link GetIndexCommandOutput}
 * @see {@link GetIndexCommandInput} for command's `input` shape.
 * @see {@link GetIndexCommandOutput} for command's `response` shape.
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
export declare class GetIndexCommand extends GetIndexCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: GetIndexInput;
            output: GetIndexOutput;
        };
        sdk: {
            input: GetIndexCommandInput;
            output: GetIndexCommandOutput;
        };
    };
}
