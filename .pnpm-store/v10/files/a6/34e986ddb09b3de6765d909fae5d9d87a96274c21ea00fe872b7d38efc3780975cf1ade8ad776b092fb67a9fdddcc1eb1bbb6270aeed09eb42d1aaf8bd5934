import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_CreateVectorBucketCommand, se_CreateVectorBucketCommand } from "../protocols/Aws_restJson1";
export { $Command };
export class CreateVectorBucketCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("S3Vectors", "CreateVectorBucket", {})
    .n("S3VectorsClient", "CreateVectorBucketCommand")
    .f(void 0, void 0)
    .ser(se_CreateVectorBucketCommand)
    .de(de_CreateVectorBucketCommand)
    .build() {
}
