import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { QueryVectorsInput, QueryVectorsOutput } from "../models/models_0";
import { S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../S3VectorsClient";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link QueryVectorsCommand}.
 */
export interface QueryVectorsCommandInput extends QueryVectorsInput {
}
/**
 * @public
 *
 * The output of {@link QueryVectorsCommand}.
 */
export interface QueryVectorsCommandOutput extends QueryVectorsOutput, __MetadataBearer {
}
declare const QueryVectorsCommand_base: {
    new (input: QueryVectorsCommandInput): import("@smithy/smithy-client").CommandImpl<QueryVectorsCommandInput, QueryVectorsCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: QueryVectorsCommandInput): import("@smithy/smithy-client").CommandImpl<QueryVectorsCommandInput, QueryVectorsCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <note> <p>Amazon S3 Vectors is in preview release for Amazon S3 and is subject to change.</p> </note> <p>Performs an approximate nearest neighbor search query in a vector index using a query vector. By default, it returns the keys of approximate nearest neighbors. You can optionally include the computed distance (between the query vector and each vector in the response), the vector data, and metadata of each vector in the response. </p> <p>To specify the vector index, you can either use both the vector bucket name and the vector index name, or use the vector index Amazon Resource Name (ARN). </p> <dl> <dt>Permissions</dt> <dd> <p>You must have the <code>s3vectors:QueryVectors</code> permission to use this operation. Additional permissions are required based on the request parameters you specify:</p> <ul> <li> <p>With only <code>s3vectors:QueryVectors</code> permission, you can retrieve vector keys of approximate nearest neighbors and computed distances between these vectors. This permission is sufficient only when you don't set any metadata filters and don't request vector data or metadata (by keeping the <code>returnMetadata</code> parameter set to <code>false</code> or not specified).</p> </li> <li> <p>If you specify a metadata filter or set <code>returnMetadata</code> to true, you must have both <code>s3vectors:QueryVectors</code> and <code>s3vectors:GetVectors</code> permissions. The request fails with a <code>403 Forbidden error</code> if you request metadata filtering, vector data, or metadata without the <code>s3vectors:GetVectors</code> permission.</p> </li> </ul> </dd> </dl>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { S3VectorsClient, QueryVectorsCommand } from "@aws-sdk/client-s3vectors"; // ES Modules import
 * // const { S3VectorsClient, QueryVectorsCommand } = require("@aws-sdk/client-s3vectors"); // CommonJS import
 * // import type { S3VectorsClientConfig } from "@aws-sdk/client-s3vectors";
 * const config = {}; // type is S3VectorsClientConfig
 * const client = new S3VectorsClient(config);
 * const input = { // QueryVectorsInput
 *   vectorBucketName: "STRING_VALUE",
 *   indexName: "STRING_VALUE",
 *   indexArn: "STRING_VALUE",
 *   topK: Number("int"), // required
 *   queryVector: { // VectorData Union: only one key present
 *     float32: [ // Float32VectorData
 *       Number("float"),
 *     ],
 *   },
 *   filter: "DOCUMENT_VALUE",
 *   returnMetadata: true || false,
 *   returnDistance: true || false,
 * };
 * const command = new QueryVectorsCommand(input);
 * const response = await client.send(command);
 * // { // QueryVectorsOutput
 * //   vectors: [ // QueryVectorsOutputList // required
 * //     { // QueryOutputVector
 * //       key: "STRING_VALUE", // required
 * //       data: { // VectorData Union: only one key present
 * //         float32: [ // Float32VectorData
 * //           Number("float"),
 * //         ],
 * //       },
 * //       metadata: "DOCUMENT_VALUE",
 * //       distance: Number("float"),
 * //     },
 * //   ],
 * // };
 *
 * ```
 *
 * @param QueryVectorsCommandInput - {@link QueryVectorsCommandInput}
 * @returns {@link QueryVectorsCommandOutput}
 * @see {@link QueryVectorsCommandInput} for command's `input` shape.
 * @see {@link QueryVectorsCommandOutput} for command's `response` shape.
 * @see {@link S3VectorsClientResolvedConfig | config} for S3VectorsClient's `config` shape.
 *
 * @throws {@link KmsDisabledException} (client fault)
 *  <p>The specified Amazon Web Services KMS key isn't enabled.</p>
 *
 * @throws {@link KmsInvalidKeyUsageException} (client fault)
 *  <p>The request was rejected for one of the following reasons: </p> <ul> <li> <p>The <code>KeyUsage</code> value of the KMS key is incompatible with the API operation.</p> </li> <li> <p>The encryption algorithm or signing algorithm specified for the operation is incompatible with the type of key material in the KMS key (<code>KeySpec</code>).</p> </li> </ul> <p>For more information, see <a href="https://docs.aws.amazon.com/kms/latest/APIReference/API_Encrypt.html#API_Encrypt_Errors">InvalidKeyUsageException</a> in the <i>Amazon Web Services Key Management Service API Reference</i>.</p>
 *
 * @throws {@link KmsInvalidStateException} (client fault)
 *  <p>The key state of the KMS key isn't compatible with the operation.</p> <p>For more information, see <a href="https://docs.aws.amazon.com/kms/latest/APIReference/API_Encrypt.html#API_Encrypt_Errors">KMSInvalidStateException</a> in the <i>Amazon Web Services Key Management Service API Reference</i>.</p>
 *
 * @throws {@link KmsNotFoundException} (client fault)
 *  <p>The KMS key can't be found.</p>
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
export declare class QueryVectorsCommand extends QueryVectorsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: QueryVectorsInput;
            output: QueryVectorsOutput;
        };
        sdk: {
            input: QueryVectorsCommandInput;
            output: QueryVectorsCommandOutput;
        };
    };
}
