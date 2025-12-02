import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_DeleteVectorBucketCommand, se_DeleteVectorBucketCommand } from "../protocols/Aws_restJson1";
export { $Command };
export class DeleteVectorBucketCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("S3Vectors", "DeleteVectorBucket", {})
    .n("S3VectorsClient", "DeleteVectorBucketCommand")
    .f(void 0, void 0)
    .ser(se_DeleteVectorBucketCommand)
    .de(de_DeleteVectorBucketCommand)
    .build() {
}
