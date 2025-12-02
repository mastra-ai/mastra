import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_DescribeLimitsCommand, se_DescribeLimitsCommand } from "../protocols/Aws_json1_0";
export { $Command };
export class DescribeLimitsCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("DynamoDB_20120810", "DescribeLimits", {})
    .n("DynamoDBClient", "DescribeLimitsCommand")
    .f(void 0, void 0)
    .ser(se_DescribeLimitsCommand)
    .de(de_DescribeLimitsCommand)
    .build() {
}
