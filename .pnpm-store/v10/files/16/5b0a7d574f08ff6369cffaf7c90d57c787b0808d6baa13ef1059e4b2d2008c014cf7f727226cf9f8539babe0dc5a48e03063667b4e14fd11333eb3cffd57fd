import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_TransactWriteItemsCommand, se_TransactWriteItemsCommand } from "../protocols/Aws_json1_0";
export { $Command };
export class TransactWriteItemsCommand extends $Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArnList: {
        type: "operationContextParams",
        get: (input) => input?.TransactItems?.map((obj) => [obj?.ConditionCheck?.TableName, obj?.Put?.TableName, obj?.Delete?.TableName, obj?.Update?.TableName].filter((i) => i)).flat(),
    },
})
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "TransactWriteItems", {})
    .n("DynamoDBClient", "TransactWriteItemsCommand")
    .f(void 0, void 0)
    .ser(se_TransactWriteItemsCommand)
    .de(de_TransactWriteItemsCommand)
    .build() {
}
