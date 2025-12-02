import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_ListIndexesCommand, se_ListIndexesCommand } from "../protocols/Aws_restJson1";
export { $Command };
export class ListIndexesCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("S3Vectors", "ListIndexes", {})
    .n("S3VectorsClient", "ListIndexesCommand")
    .f(void 0, void 0)
    .ser(se_ListIndexesCommand)
    .de(de_ListIndexesCommand)
    .build() {
}
