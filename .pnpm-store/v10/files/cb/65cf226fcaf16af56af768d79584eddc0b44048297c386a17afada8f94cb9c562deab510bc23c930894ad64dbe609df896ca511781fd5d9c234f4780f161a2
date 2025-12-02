import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_TransactGetItemsCommand, se_TransactGetItemsCommand } from "../protocols/Aws_json1_0";
export { $Command };
export class TransactGetItemsCommand extends $Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArnList: {
        type: "operationContextParams",
        get: (input) => input?.TransactItems?.map((obj) => obj?.Get?.TableName),
    },
})
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "TransactGetItems", {})
    .n("DynamoDBClient", "TransactGetItemsCommand")
    .f(void 0, void 0)
    .ser(se_TransactGetItemsCommand)
    .de(de_TransactGetItemsCommand)
    .build() {
}
