import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_BatchGetItemCommand, se_BatchGetItemCommand } from "../protocols/Aws_json1_0";
export { $Command };
export class BatchGetItemCommand extends $Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArnList: { type: "operationContextParams", get: (input) => Object.keys(input?.RequestItems ?? {}) },
})
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "BatchGetItem", {})
    .n("DynamoDBClient", "BatchGetItemCommand")
    .f(void 0, void 0)
    .ser(se_BatchGetItemCommand)
    .de(de_BatchGetItemCommand)
    .build() {
}
