import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { ListVectorsInput, ListVectorsOutput } from "../models/models_0";
import { S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../S3VectorsClient";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link ListVectorsCommand}.
 */
export interface ListVectorsCommandInput extends ListVectorsInput {
}
/**
 * @public
 *
 * The output of {@link ListVectorsCommand}.
 */
export interface ListVectorsCommandOutput extends ListVectorsOutput, __MetadataBearer {
}
declare const ListVectorsCommand_base: {
    new (input: ListVectorsCommandInput): import("@smithy/smithy-client").CommandImpl<ListVectorsCommandInput, ListVectorsCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (...[input]: [] | [ListVectorsCommandInput]): import("@smithy/smithy-client").CommandImpl<ListVectorsCommandInput, ListVectorsCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <note> <p>Amazon S3 Vectors is in preview release for Amazon S3 and is subject to change.</p> </note> <p>List vectors in the specified vector index. To specify the vector index, you can either use both the vector bucket name and the vector index name, or use the vector index Amazon Resource Name (ARN). </p> <p> <code>ListVectors</code> operations proceed sequentially; however, for faster performance on a large number of vectors in a vector index, applications can request a parallel <code>ListVectors</code> operation by providing the <code>segmentCount</code> and <code>segmentIndex</code> parameters.</p> <dl> <dt>Permissions</dt> <dd> <p>You must have the <code>s3vectors:ListVectors</code> permission to use this operation. Additional permissions are required based on the request parameters you specify:</p> <ul> <li> <p>With only <code>s3vectors:ListVectors</code> permission, you can list vector keys when <code>returnData</code> and <code>returnMetadata</code> are both set to false or not specified..</p> </li> <li> <p>If you set <code>returnData</code> or <code>returnMetadata</code> to true, you must have both <code>s3vectors:ListVectors</code> and <code>s3vectors:GetVectors</code> permissions. The request fails with a <code>403 Forbidden</code> error if you request vector data or metadata without the <code>s3vectors:GetVectors</code> permission.</p> </li> </ul> </dd> </dl>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { S3VectorsClient, ListVectorsCommand } from "@aws-sdk/client-s3vectors"; // ES Modules import
 * // const { S3VectorsClient, ListVectorsCommand } = require("@aws-sdk/client-s3vectors"); // CommonJS import
 * // import type { S3VectorsClientConfig } from "@aws-sdk/client-s3vectors";
 * const config = {}; // type is S3VectorsClientConfig
 * const client = new S3VectorsClient(config);
 * const input = { // ListVectorsInput
 *   vectorBucketName: "STRING_VALUE",
 *   indexName: "STRING_VALUE",
 *   indexArn: "STRING_VALUE",
 *   maxResults: Number("int"),
 *   nextToken: "STRING_VALUE",
 *   segmentCount: Number("int"),
 *   segmentIndex: Number("int"),
 *   returnData: true || false,
 *   returnMetadata: true || false,
 * };
 * const command = new ListVectorsCommand(input);
 * const response = await client.send(command);
 * // { // ListVectorsOutput
 * //   nextToken: "STRING_VALUE",
 * //   vectors: [ // ListVectorsOutputList // required
 * //     { // ListOutputVector
 * //       key: "STRING_VALUE", // required
 * //       data: { // VectorData Union: only one key present
 * //         float32: [ // Float32VectorData
 * //           Number("float"),
 * //         ],
 * //       },
 * //       metadata: "DOCUMENT_VALUE",
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param ListVectorsCommandInput - {@link ListVectorsCommandInput}
 * @returns {@link ListVectorsCommandOutput}
 * @see {@link ListVectorsCommandInput} for command's `input` shape.
 * @see {@link ListVectorsCommandOutput} for command's `response` shape.
 * @see {@link S3VectorsClientResolvedConfig | config} for S3VectorsClient's `config` shape.
 *
 * @throws {@link AccessDeniedException} (client fault)
 *  <p>Access denied.</p>
 *
 * @throws {@link NotFoundException} (client fault)
 *  <p>The request was rejected because the specified resource can't be found.</p>
 *
 * @throws {@link ServiceUnavailableException} (server fault)
 *  <p>The service is unavailable. Wait briefly and retry your request. If it continues to fail, increase your waiting time between retries.</p>
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
export declare class ListVectorsCommand extends ListVectorsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: ListVectorsInput;
            output: ListVectorsOutput;
        };
        sdk: {
            input: ListVectorsCommandInput;
            output: ListVectorsCommandOutput;
        };
    };
}
