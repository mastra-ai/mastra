import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_ListTagsOfResourceCommand, se_ListTagsOfResourceCommand } from "../protocols/Aws_json1_0";
export { $Command };
export class ListTagsOfResourceCommand extends $Command
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
    .s("DynamoDB_20120810", "ListTagsOfResource", {})
    .n("DynamoDBClient", "ListTagsOfResourceCommand")
    .f(void 0, void 0)
    .ser(se_ListTagsOfResourceCommand)
    .de(de_ListTagsOfResourceCommand)
    .build() {
}
