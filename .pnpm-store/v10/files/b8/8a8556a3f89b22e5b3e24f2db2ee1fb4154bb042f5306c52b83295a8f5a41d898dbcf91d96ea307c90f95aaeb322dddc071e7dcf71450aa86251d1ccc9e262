import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_PutVectorBucketPolicyCommand, se_PutVectorBucketPolicyCommand } from "../protocols/Aws_restJson1";
export { $Command };
export class PutVectorBucketPolicyCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("S3Vectors", "PutVectorBucketPolicy", {})
    .n("S3VectorsClient", "PutVectorBucketPolicyCommand")
    .f(void 0, void 0)
    .ser(se_PutVectorBucketPolicyCommand)
    .de(de_PutVectorBucketPolicyCommand)
    .build() {
}
