import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_ImportTableCommand, se_ImportTableCommand } from "../protocols/Aws_json1_0";
export { $Command };
export class ImportTableCommand extends $Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "operationContextParams", get: (input) => input?.TableCreationParameters?.TableName },
})
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ImportTable", {})
    .n("DynamoDBClient", "ImportTableCommand")
    .f(void 0, void 0)
    .ser(se_ImportTableCommand)
    .de(de_ImportTableCommand)
    .build() {
}
