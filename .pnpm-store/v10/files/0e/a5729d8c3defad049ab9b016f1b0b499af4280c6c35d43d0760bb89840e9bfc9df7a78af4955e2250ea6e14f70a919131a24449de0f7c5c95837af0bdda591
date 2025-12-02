import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_ListVectorBucketsCommand, se_ListVectorBucketsCommand } from "../protocols/Aws_restJson1";
export { $Command };
export class ListVectorBucketsCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("S3Vectors", "ListVectorBuckets", {})
    .n("S3VectorsClient", "ListVectorBucketsCommand")
    .f(void 0, void 0)
    .ser(se_ListVectorBucketsCommand)
    .de(de_ListVectorBucketsCommand)
    .build() {
}
