import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_ListTablesCommand, se_ListTablesCommand } from "../protocols/Aws_json1_0";
export { $Command };
export class ListTablesCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "ListTables", {})
    .n("DynamoDBClient", "ListTablesCommand")
    .f(void 0, void 0)
    .ser(se_ListTablesCommand)
    .de(de_ListTablesCommand)
    .build() {
}
