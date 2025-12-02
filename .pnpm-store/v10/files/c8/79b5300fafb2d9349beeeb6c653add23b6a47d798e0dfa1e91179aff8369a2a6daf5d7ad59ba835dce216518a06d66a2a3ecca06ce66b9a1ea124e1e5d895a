import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_UntagResourceCommand, se_UntagResourceCommand } from "../protocols/Aws_json1_0";
export { $Command };
export class UntagResourceCommand extends $Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "ResourceArn" },
})
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "UntagResource", {})
    .n("DynamoDBClient", "UntagResourceCommand")
    .f(void 0, void 0)
    .ser(se_UntagResourceCommand)
    .de(de_UntagResourceCommand)
    .build() {
}
