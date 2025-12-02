import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_GetIndexCommand, se_GetIndexCommand } from "../protocols/Aws_restJson1";
export { $Command };
export class GetIndexCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("S3Vectors", "GetIndex", {})
    .n("S3VectorsClient", "GetIndexCommand")
    .f(void 0, void 0)
    .ser(se_GetIndexCommand)
    .de(de_GetIndexCommand)
    .build() {
}
