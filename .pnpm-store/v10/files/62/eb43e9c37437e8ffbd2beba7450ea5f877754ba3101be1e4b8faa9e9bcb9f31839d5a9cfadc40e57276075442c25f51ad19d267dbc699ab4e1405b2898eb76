import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_BatchExecuteStatementCommand, se_BatchExecuteStatementCommand } from "../protocols/Aws_json1_0";
export { $Command };
export class BatchExecuteStatementCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "BatchExecuteStatement", {})
    .n("DynamoDBClient", "BatchExecuteStatementCommand")
    .f(void 0, void 0)
    .ser(se_BatchExecuteStatementCommand)
    .de(de_BatchExecuteStatementCommand)
    .build() {
}
