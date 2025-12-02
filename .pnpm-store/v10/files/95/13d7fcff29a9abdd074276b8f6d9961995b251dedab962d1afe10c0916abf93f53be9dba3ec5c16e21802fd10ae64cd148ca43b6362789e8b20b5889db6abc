import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_BatchWriteItemCommand, se_BatchWriteItemCommand } from "../protocols/Aws_json1_0";
export { $Command };
export class BatchWriteItemCommand extends $Command
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
    .s("DynamoDB_20120810", "BatchWriteItem", {})
    .n("DynamoDBClient", "BatchWriteItemCommand")
    .f(void 0, void 0)
    .ser(se_BatchWriteItemCommand)
    .de(de_BatchWriteItemCommand)
    .build() {
}
