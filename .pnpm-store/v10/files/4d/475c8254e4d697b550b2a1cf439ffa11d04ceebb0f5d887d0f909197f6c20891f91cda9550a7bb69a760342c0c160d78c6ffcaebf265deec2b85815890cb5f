import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ResponsesImageGenerationCall } from "./responsesimagegenerationcall.js";
import { ResponsesOutputItemFileSearchCall } from "./responsesoutputitemfilesearchcall.js";
import { ResponsesOutputItemFunctionCall } from "./responsesoutputitemfunctioncall.js";
import { ResponsesOutputItemReasoning } from "./responsesoutputitemreasoning.js";
import { ResponsesOutputMessage } from "./responsesoutputmessage.js";
import { ResponsesWebSearchCallOutput } from "./responseswebsearchcalloutput.js";
/**
 * An output item from the response
 */
export type ResponsesOutputItem = ResponsesOutputMessage | ResponsesOutputItemFunctionCall | ResponsesOutputItemFileSearchCall | ResponsesOutputItemReasoning | ResponsesWebSearchCallOutput | ResponsesImageGenerationCall;
/** @internal */
export declare const ResponsesOutputItem$inboundSchema: z.ZodType<ResponsesOutputItem, unknown>;
export declare function responsesOutputItemFromJSON(jsonString: string): SafeParseResult<ResponsesOutputItem, SDKValidationError>;
//# sourceMappingURL=responsesoutputitem.d.ts.map