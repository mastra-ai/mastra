import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { PutVectorsInput, PutVectorsOutput } from "../models/models_0";
import { S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from "../S3VectorsClient";
/**
 * @public
 */
export type { __MetadataBearer };
export { $Command };
/**
 * @public
 *
 * The input for {@link PutVectorsCommand}.
 */
export interface PutVectorsCommandInput extends PutVectorsInput {
}
/**
 * @public
 *
 * The output of {@link PutVectorsCommand}.
 */
export interface PutVectorsCommandOutput extends PutVectorsOutput, __MetadataBearer {
}
declare const PutVectorsCommand_base: {
    new (input: PutVectorsCommandInput): import("@smithy/smithy-client").CommandImpl<PutVectorsCommandInput, PutVectorsCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    new (input: PutVectorsCommandInput): import("@smithy/smithy-client").CommandImpl<PutVectorsCommandInput, PutVectorsCommandOutput, S3VectorsClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes>;
    getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
/**
 * <note> <p>Amazon S3 Vectors is in preview release for Amazon S3 and is subject to change.</p> </note> <p>Adds one or more vectors to a vector index. To specify the vector index, you can either use both the vector bucket name and the vector index name, or use the vector index Amazon Resource Name (ARN). </p> <p>For more information about limits, see <a href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-limitations.html">Limitations and restrictions</a> in the <i>Amazon S3 User Guide</i>.</p> <note> <p>When inserting vector data into your vector index, you must provide the vector data as <code>float32</code> (32-bit floating point) values. If you pass higher-precision values to an Amazon Web Services SDK, S3 Vectors converts the values to 32-bit floating point before storing them, and <code>GetVectors</code>, <code>ListVectors</code>, and <code>QueryVectors</code> operations return the float32 values. Different Amazon Web Services SDKs may have different default numeric types, so ensure your vectors are properly formatted as <code>float32</code> values regardless of which SDK you're using. For example, in Python, use <code>numpy.float32</code> or explicitly cast your values.</p> </note> <dl> <dt>Permissions</dt> <dd> <p>You must have the <code>s3vectors:PutVectors</code> permission to use this operation. </p> </dd> </dl>
 * @example
 * Use a bare-bones client and the command you need to make an API call.
 * ```javascript
 * import { S3VectorsClient, PutVectorsCommand } from "@aws-sdk/client-s3vectors"; // ES Modules import
 * // const { S3VectorsClient, PutVectorsCommand } = require("@aws-sdk/client-s3vectors"); // CommonJS import
 * // import type { S3VectorsClientConfig } from "@aws-sdk/client-s3vectors";
 * const config = {}; // type is S3VectorsClientConfig
 * const client = new S3VectorsClient(config);
 * const input = { // PutVectorsInput
 *   vectorBucketName: "STRING_VALUE",
 *   indexName: "STRING_VALUE",
 *   indexArn: "STRING_VALUE",
 *   vectors: [ // PutVectorsInputList // required
 *     { // PutInputVector
 *       key: "STRING_VALUE", // required
 *       data: { // VectorData Union: only one key present
 *         float32: [ // Float32VectorData
 *           Number("float"),
 *         ],
 *       },
 *       metadata: "DOCUMENT_VALUE",
 *     },
 *   ],
 * };
 * const command = new PutVectorsCommand(input);
 * const response = await client.send(command);
 * // {};
 *
 * ```
 *
 * @param PutVectorsCommandInput - {@link PutVectorsCommandInput}
 * @returns {@link PutVectorsCommandOutput}
 * @see {@link PutVectorsCommandInput} for command's `input` shape.
 * @see {@link PutVectorsCommandOutput} for command's `response` shape.
 * @see {@link S3VectorsClientResolvedConfig | config} for S3VectorsClient's `config` shape.
 *
 * @throws {@link AccessDeniedException} (client fault)
 *  <p>Access denied.</p>
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
export declare class PutVectorsCommand extends PutVectorsCommand_base {
    /** @internal type navigation helper, not in runtime. */
    protected static __types: {
        api: {
            input: PutVectorsInput;
            output: {};
        };
        sdk: {
            input: PutVectorsCommandInput;
            output: PutVectorsCommandOutput;
        };
    };
}
