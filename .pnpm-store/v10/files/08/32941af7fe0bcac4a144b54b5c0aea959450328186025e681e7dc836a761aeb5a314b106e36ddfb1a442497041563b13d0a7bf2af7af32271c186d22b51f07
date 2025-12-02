import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { FileCitation, FileCitation$Outbound } from "./filecitation.js";
import { FilePath, FilePath$Outbound } from "./filepath.js";
import { URLCitation, URLCitation$Outbound } from "./urlcitation.js";
export type OpenAIResponsesAnnotation = URLCitation | FileCitation | FilePath;
/** @internal */
export declare const OpenAIResponsesAnnotation$inboundSchema: z.ZodType<OpenAIResponsesAnnotation, unknown>;
/** @internal */
export type OpenAIResponsesAnnotation$Outbound = URLCitation$Outbound | FileCitation$Outbound | FilePath$Outbound;
/** @internal */
export declare const OpenAIResponsesAnnotation$outboundSchema: z.ZodType<OpenAIResponsesAnnotation$Outbound, OpenAIResponsesAnnotation>;
export declare function openAIResponsesAnnotationToJSON(openAIResponsesAnnotation: OpenAIResponsesAnnotation): string;
export declare function openAIResponsesAnnotationFromJSON(jsonString: string): SafeParseResult<OpenAIResponsesAnnotation, SDKValidationError>;
//# sourceMappingURL=openairesponsesannotation.d.ts.map