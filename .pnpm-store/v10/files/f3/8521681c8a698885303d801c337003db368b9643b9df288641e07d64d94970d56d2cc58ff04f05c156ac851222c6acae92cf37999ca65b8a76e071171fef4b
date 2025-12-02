import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { de_CreateIndexCommand, se_CreateIndexCommand } from "../protocols/Aws_restJson1";
export { $Command };
export class CreateIndexCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("S3Vectors", "CreateIndex", {})
    .n("S3VectorsClient", "CreateIndexCommand")
    .f(void 0, void 0)
    .ser(se_CreateIndexCommand)
    .de(de_CreateIndexCommand)
    .build() {
}
