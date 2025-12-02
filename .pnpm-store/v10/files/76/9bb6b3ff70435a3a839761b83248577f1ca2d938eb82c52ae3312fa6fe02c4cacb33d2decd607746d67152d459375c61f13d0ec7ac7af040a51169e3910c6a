import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_DeleteVectorBucketPolicyCommand, se_DeleteVectorBucketPolicyCommand } from "../protocols/Aws_restJson1";
export { $Command };
export class DeleteVectorBucketPolicyCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("S3Vectors", "DeleteVectorBucketPolicy", {})
    .n("S3VectorsClient", "DeleteVectorBucketPolicyCommand")
    .f(void 0, void 0)
    .ser(se_DeleteVectorBucketPolicyCommand)
    .de(de_DeleteVectorBucketPolicyCommand)
    .build() {
}
