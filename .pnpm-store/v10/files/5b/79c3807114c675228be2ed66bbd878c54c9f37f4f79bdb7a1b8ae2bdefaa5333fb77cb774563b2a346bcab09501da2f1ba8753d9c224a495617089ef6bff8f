import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_RestoreTableToPointInTimeCommand, se_RestoreTableToPointInTimeCommand } from "../protocols/Aws_json1_0";
export { $Command };
export class RestoreTableToPointInTimeCommand extends $Command
    .classBuilder()
    .ep({
    ...commonParams,
    ResourceArn: { type: "contextParams", name: "TargetTableName" },
})
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "RestoreTableToPointInTime", {})
    .n("DynamoDBClient", "RestoreTableToPointInTimeCommand")
    .f(void 0, void 0)
    .ser(se_RestoreTableToPointInTimeCommand)
    .de(de_RestoreTableToPointInTimeCommand)
    .build() {
}
