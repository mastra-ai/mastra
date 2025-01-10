module.exports = {

"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/endpoint/EndpointParameters.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "commonParams": (()=>commonParams),
    "resolveClientEndpointParameters": (()=>resolveClientEndpointParameters)
});
const resolveClientEndpointParameters = (options)=>{
    return {
        ...options,
        useDualstackEndpoint: options.useDualstackEndpoint ?? false,
        useFipsEndpoint: options.useFipsEndpoint ?? false,
        defaultSigningName: "bedrock"
    };
};
const commonParams = {
    UseFIPS: {
        type: "builtInParams",
        name: "useFipsEndpoint"
    },
    Endpoint: {
        type: "builtInParams",
        name: "endpoint"
    },
    Region: {
        type: "builtInParams",
        name: "region"
    },
    UseDualStack: {
        type: "builtInParams",
        name: "useDualstackEndpoint"
    }
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/models/BedrockRuntimeServiceException.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "BedrockRuntimeServiceException": (()=>BedrockRuntimeServiceException)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/exceptions.js [app-rsc] (ecmascript)");
;
;
class BedrockRuntimeServiceException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ServiceException"] {
    constructor(options){
        super(options);
        Object.setPrototypeOf(this, BedrockRuntimeServiceException.prototype);
    }
}
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/models/models_0.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "AccessDeniedException": (()=>AccessDeniedException),
    "ContentBlock": (()=>ContentBlock),
    "ContentBlockDelta": (()=>ContentBlockDelta),
    "ContentBlockStart": (()=>ContentBlockStart),
    "ConversationRole": (()=>ConversationRole),
    "ConverseOutput": (()=>ConverseOutput),
    "ConverseRequestFilterSensitiveLog": (()=>ConverseRequestFilterSensitiveLog),
    "ConverseStreamOutput": (()=>ConverseStreamOutput),
    "ConverseStreamOutputFilterSensitiveLog": (()=>ConverseStreamOutputFilterSensitiveLog),
    "ConverseStreamRequestFilterSensitiveLog": (()=>ConverseStreamRequestFilterSensitiveLog),
    "ConverseStreamResponseFilterSensitiveLog": (()=>ConverseStreamResponseFilterSensitiveLog),
    "DocumentFormat": (()=>DocumentFormat),
    "DocumentSource": (()=>DocumentSource),
    "GuardrailAction": (()=>GuardrailAction),
    "GuardrailContentBlock": (()=>GuardrailContentBlock),
    "GuardrailContentFilterConfidence": (()=>GuardrailContentFilterConfidence),
    "GuardrailContentFilterStrength": (()=>GuardrailContentFilterStrength),
    "GuardrailContentFilterType": (()=>GuardrailContentFilterType),
    "GuardrailContentPolicyAction": (()=>GuardrailContentPolicyAction),
    "GuardrailContentQualifier": (()=>GuardrailContentQualifier),
    "GuardrailContentSource": (()=>GuardrailContentSource),
    "GuardrailContextualGroundingFilterType": (()=>GuardrailContextualGroundingFilterType),
    "GuardrailContextualGroundingPolicyAction": (()=>GuardrailContextualGroundingPolicyAction),
    "GuardrailConverseContentBlock": (()=>GuardrailConverseContentBlock),
    "GuardrailConverseContentQualifier": (()=>GuardrailConverseContentQualifier),
    "GuardrailManagedWordType": (()=>GuardrailManagedWordType),
    "GuardrailPiiEntityType": (()=>GuardrailPiiEntityType),
    "GuardrailSensitiveInformationPolicyAction": (()=>GuardrailSensitiveInformationPolicyAction),
    "GuardrailStreamProcessingMode": (()=>GuardrailStreamProcessingMode),
    "GuardrailTopicPolicyAction": (()=>GuardrailTopicPolicyAction),
    "GuardrailTopicType": (()=>GuardrailTopicType),
    "GuardrailTrace": (()=>GuardrailTrace),
    "GuardrailWordPolicyAction": (()=>GuardrailWordPolicyAction),
    "ImageFormat": (()=>ImageFormat),
    "ImageSource": (()=>ImageSource),
    "InternalServerException": (()=>InternalServerException),
    "InvokeModelRequestFilterSensitiveLog": (()=>InvokeModelRequestFilterSensitiveLog),
    "InvokeModelResponseFilterSensitiveLog": (()=>InvokeModelResponseFilterSensitiveLog),
    "InvokeModelWithResponseStreamRequestFilterSensitiveLog": (()=>InvokeModelWithResponseStreamRequestFilterSensitiveLog),
    "InvokeModelWithResponseStreamResponseFilterSensitiveLog": (()=>InvokeModelWithResponseStreamResponseFilterSensitiveLog),
    "ModelErrorException": (()=>ModelErrorException),
    "ModelNotReadyException": (()=>ModelNotReadyException),
    "ModelStreamErrorException": (()=>ModelStreamErrorException),
    "ModelTimeoutException": (()=>ModelTimeoutException),
    "PayloadPartFilterSensitiveLog": (()=>PayloadPartFilterSensitiveLog),
    "PromptVariableValues": (()=>PromptVariableValues),
    "ResourceNotFoundException": (()=>ResourceNotFoundException),
    "ResponseStream": (()=>ResponseStream),
    "ResponseStreamFilterSensitiveLog": (()=>ResponseStreamFilterSensitiveLog),
    "ServiceQuotaExceededException": (()=>ServiceQuotaExceededException),
    "ServiceUnavailableException": (()=>ServiceUnavailableException),
    "StopReason": (()=>StopReason),
    "SystemContentBlock": (()=>SystemContentBlock),
    "ThrottlingException": (()=>ThrottlingException),
    "Tool": (()=>Tool),
    "ToolChoice": (()=>ToolChoice),
    "ToolInputSchema": (()=>ToolInputSchema),
    "ToolResultContentBlock": (()=>ToolResultContentBlock),
    "ToolResultStatus": (()=>ToolResultStatus),
    "Trace": (()=>Trace),
    "ValidationException": (()=>ValidationException)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/models/BedrockRuntimeServiceException.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/constants.js [app-rsc] (ecmascript)");
;
;
class AccessDeniedException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"] {
    constructor(opts){
        super({
            name: "AccessDeniedException",
            $fault: "client",
            ...opts
        });
        this.name = "AccessDeniedException";
        this.$fault = "client";
        Object.setPrototypeOf(this, AccessDeniedException.prototype);
    }
}
const GuardrailContentQualifier = {
    GROUNDING_SOURCE: "grounding_source",
    GUARD_CONTENT: "guard_content",
    QUERY: "query"
};
var GuardrailContentBlock;
(function(GuardrailContentBlock) {
    GuardrailContentBlock.visit = (value, visitor)=>{
        if (value.text !== undefined) return visitor.text(value.text);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(GuardrailContentBlock || (GuardrailContentBlock = {}));
const GuardrailContentSource = {
    INPUT: "INPUT",
    OUTPUT: "OUTPUT"
};
const GuardrailAction = {
    GUARDRAIL_INTERVENED: "GUARDRAIL_INTERVENED",
    NONE: "NONE"
};
const GuardrailContentPolicyAction = {
    BLOCKED: "BLOCKED"
};
const GuardrailContentFilterConfidence = {
    HIGH: "HIGH",
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    NONE: "NONE"
};
const GuardrailContentFilterStrength = {
    HIGH: "HIGH",
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    NONE: "NONE"
};
const GuardrailContentFilterType = {
    HATE: "HATE",
    INSULTS: "INSULTS",
    MISCONDUCT: "MISCONDUCT",
    PROMPT_ATTACK: "PROMPT_ATTACK",
    SEXUAL: "SEXUAL",
    VIOLENCE: "VIOLENCE"
};
const GuardrailContextualGroundingPolicyAction = {
    BLOCKED: "BLOCKED",
    NONE: "NONE"
};
const GuardrailContextualGroundingFilterType = {
    GROUNDING: "GROUNDING",
    RELEVANCE: "RELEVANCE"
};
const GuardrailSensitiveInformationPolicyAction = {
    ANONYMIZED: "ANONYMIZED",
    BLOCKED: "BLOCKED"
};
const GuardrailPiiEntityType = {
    ADDRESS: "ADDRESS",
    AGE: "AGE",
    AWS_ACCESS_KEY: "AWS_ACCESS_KEY",
    AWS_SECRET_KEY: "AWS_SECRET_KEY",
    CA_HEALTH_NUMBER: "CA_HEALTH_NUMBER",
    CA_SOCIAL_INSURANCE_NUMBER: "CA_SOCIAL_INSURANCE_NUMBER",
    CREDIT_DEBIT_CARD_CVV: "CREDIT_DEBIT_CARD_CVV",
    CREDIT_DEBIT_CARD_EXPIRY: "CREDIT_DEBIT_CARD_EXPIRY",
    CREDIT_DEBIT_CARD_NUMBER: "CREDIT_DEBIT_CARD_NUMBER",
    DRIVER_ID: "DRIVER_ID",
    EMAIL: "EMAIL",
    INTERNATIONAL_BANK_ACCOUNT_NUMBER: "INTERNATIONAL_BANK_ACCOUNT_NUMBER",
    IP_ADDRESS: "IP_ADDRESS",
    LICENSE_PLATE: "LICENSE_PLATE",
    MAC_ADDRESS: "MAC_ADDRESS",
    NAME: "NAME",
    PASSWORD: "PASSWORD",
    PHONE: "PHONE",
    PIN: "PIN",
    SWIFT_CODE: "SWIFT_CODE",
    UK_NATIONAL_HEALTH_SERVICE_NUMBER: "UK_NATIONAL_HEALTH_SERVICE_NUMBER",
    UK_NATIONAL_INSURANCE_NUMBER: "UK_NATIONAL_INSURANCE_NUMBER",
    UK_UNIQUE_TAXPAYER_REFERENCE_NUMBER: "UK_UNIQUE_TAXPAYER_REFERENCE_NUMBER",
    URL: "URL",
    USERNAME: "USERNAME",
    US_BANK_ACCOUNT_NUMBER: "US_BANK_ACCOUNT_NUMBER",
    US_BANK_ROUTING_NUMBER: "US_BANK_ROUTING_NUMBER",
    US_INDIVIDUAL_TAX_IDENTIFICATION_NUMBER: "US_INDIVIDUAL_TAX_IDENTIFICATION_NUMBER",
    US_PASSPORT_NUMBER: "US_PASSPORT_NUMBER",
    US_SOCIAL_SECURITY_NUMBER: "US_SOCIAL_SECURITY_NUMBER",
    VEHICLE_IDENTIFICATION_NUMBER: "VEHICLE_IDENTIFICATION_NUMBER"
};
const GuardrailTopicPolicyAction = {
    BLOCKED: "BLOCKED"
};
const GuardrailTopicType = {
    DENY: "DENY"
};
const GuardrailWordPolicyAction = {
    BLOCKED: "BLOCKED"
};
const GuardrailManagedWordType = {
    PROFANITY: "PROFANITY"
};
class InternalServerException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"] {
    constructor(opts){
        super({
            name: "InternalServerException",
            $fault: "server",
            ...opts
        });
        this.name = "InternalServerException";
        this.$fault = "server";
        Object.setPrototypeOf(this, InternalServerException.prototype);
    }
}
class ResourceNotFoundException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"] {
    constructor(opts){
        super({
            name: "ResourceNotFoundException",
            $fault: "client",
            ...opts
        });
        this.name = "ResourceNotFoundException";
        this.$fault = "client";
        Object.setPrototypeOf(this, ResourceNotFoundException.prototype);
    }
}
class ServiceQuotaExceededException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"] {
    constructor(opts){
        super({
            name: "ServiceQuotaExceededException",
            $fault: "client",
            ...opts
        });
        this.name = "ServiceQuotaExceededException";
        this.$fault = "client";
        Object.setPrototypeOf(this, ServiceQuotaExceededException.prototype);
    }
}
class ThrottlingException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"] {
    constructor(opts){
        super({
            name: "ThrottlingException",
            $fault: "client",
            ...opts
        });
        this.name = "ThrottlingException";
        this.$fault = "client";
        Object.setPrototypeOf(this, ThrottlingException.prototype);
    }
}
class ValidationException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"] {
    constructor(opts){
        super({
            name: "ValidationException",
            $fault: "client",
            ...opts
        });
        this.name = "ValidationException";
        this.$fault = "client";
        Object.setPrototypeOf(this, ValidationException.prototype);
    }
}
const GuardrailTrace = {
    DISABLED: "disabled",
    ENABLED: "enabled"
};
const DocumentFormat = {
    CSV: "csv",
    DOC: "doc",
    DOCX: "docx",
    HTML: "html",
    MD: "md",
    PDF: "pdf",
    TXT: "txt",
    XLS: "xls",
    XLSX: "xlsx"
};
var DocumentSource;
(function(DocumentSource) {
    DocumentSource.visit = (value, visitor)=>{
        if (value.bytes !== undefined) return visitor.bytes(value.bytes);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(DocumentSource || (DocumentSource = {}));
const GuardrailConverseContentQualifier = {
    GROUNDING_SOURCE: "grounding_source",
    GUARD_CONTENT: "guard_content",
    QUERY: "query"
};
var GuardrailConverseContentBlock;
(function(GuardrailConverseContentBlock) {
    GuardrailConverseContentBlock.visit = (value, visitor)=>{
        if (value.text !== undefined) return visitor.text(value.text);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(GuardrailConverseContentBlock || (GuardrailConverseContentBlock = {}));
const ImageFormat = {
    GIF: "gif",
    JPEG: "jpeg",
    PNG: "png",
    WEBP: "webp"
};
var ImageSource;
(function(ImageSource) {
    ImageSource.visit = (value, visitor)=>{
        if (value.bytes !== undefined) return visitor.bytes(value.bytes);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(ImageSource || (ImageSource = {}));
var ToolResultContentBlock;
(function(ToolResultContentBlock) {
    ToolResultContentBlock.visit = (value, visitor)=>{
        if (value.json !== undefined) return visitor.json(value.json);
        if (value.text !== undefined) return visitor.text(value.text);
        if (value.image !== undefined) return visitor.image(value.image);
        if (value.document !== undefined) return visitor.document(value.document);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(ToolResultContentBlock || (ToolResultContentBlock = {}));
const ToolResultStatus = {
    ERROR: "error",
    SUCCESS: "success"
};
var ContentBlock;
(function(ContentBlock) {
    ContentBlock.visit = (value, visitor)=>{
        if (value.text !== undefined) return visitor.text(value.text);
        if (value.image !== undefined) return visitor.image(value.image);
        if (value.document !== undefined) return visitor.document(value.document);
        if (value.toolUse !== undefined) return visitor.toolUse(value.toolUse);
        if (value.toolResult !== undefined) return visitor.toolResult(value.toolResult);
        if (value.guardContent !== undefined) return visitor.guardContent(value.guardContent);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(ContentBlock || (ContentBlock = {}));
const ConversationRole = {
    ASSISTANT: "assistant",
    USER: "user"
};
var PromptVariableValues;
(function(PromptVariableValues) {
    PromptVariableValues.visit = (value, visitor)=>{
        if (value.text !== undefined) return visitor.text(value.text);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(PromptVariableValues || (PromptVariableValues = {}));
var SystemContentBlock;
(function(SystemContentBlock) {
    SystemContentBlock.visit = (value, visitor)=>{
        if (value.text !== undefined) return visitor.text(value.text);
        if (value.guardContent !== undefined) return visitor.guardContent(value.guardContent);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(SystemContentBlock || (SystemContentBlock = {}));
var ToolChoice;
(function(ToolChoice) {
    ToolChoice.visit = (value, visitor)=>{
        if (value.auto !== undefined) return visitor.auto(value.auto);
        if (value.any !== undefined) return visitor.any(value.any);
        if (value.tool !== undefined) return visitor.tool(value.tool);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(ToolChoice || (ToolChoice = {}));
var ToolInputSchema;
(function(ToolInputSchema) {
    ToolInputSchema.visit = (value, visitor)=>{
        if (value.json !== undefined) return visitor.json(value.json);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(ToolInputSchema || (ToolInputSchema = {}));
var Tool;
(function(Tool) {
    Tool.visit = (value, visitor)=>{
        if (value.toolSpec !== undefined) return visitor.toolSpec(value.toolSpec);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(Tool || (Tool = {}));
var ConverseOutput;
(function(ConverseOutput) {
    ConverseOutput.visit = (value, visitor)=>{
        if (value.message !== undefined) return visitor.message(value.message);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(ConverseOutput || (ConverseOutput = {}));
const StopReason = {
    CONTENT_FILTERED: "content_filtered",
    END_TURN: "end_turn",
    GUARDRAIL_INTERVENED: "guardrail_intervened",
    MAX_TOKENS: "max_tokens",
    STOP_SEQUENCE: "stop_sequence",
    TOOL_USE: "tool_use"
};
class ModelErrorException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"] {
    constructor(opts){
        super({
            name: "ModelErrorException",
            $fault: "client",
            ...opts
        });
        this.name = "ModelErrorException";
        this.$fault = "client";
        Object.setPrototypeOf(this, ModelErrorException.prototype);
        this.originalStatusCode = opts.originalStatusCode;
        this.resourceName = opts.resourceName;
    }
}
class ModelNotReadyException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"] {
    constructor(opts){
        super({
            name: "ModelNotReadyException",
            $fault: "client",
            ...opts
        });
        this.name = "ModelNotReadyException";
        this.$fault = "client";
        this.$retryable = {};
        Object.setPrototypeOf(this, ModelNotReadyException.prototype);
    }
}
class ModelTimeoutException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"] {
    constructor(opts){
        super({
            name: "ModelTimeoutException",
            $fault: "client",
            ...opts
        });
        this.name = "ModelTimeoutException";
        this.$fault = "client";
        Object.setPrototypeOf(this, ModelTimeoutException.prototype);
    }
}
class ServiceUnavailableException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"] {
    constructor(opts){
        super({
            name: "ServiceUnavailableException",
            $fault: "server",
            ...opts
        });
        this.name = "ServiceUnavailableException";
        this.$fault = "server";
        Object.setPrototypeOf(this, ServiceUnavailableException.prototype);
    }
}
const GuardrailStreamProcessingMode = {
    ASYNC: "async",
    SYNC: "sync"
};
var ContentBlockDelta;
(function(ContentBlockDelta) {
    ContentBlockDelta.visit = (value, visitor)=>{
        if (value.text !== undefined) return visitor.text(value.text);
        if (value.toolUse !== undefined) return visitor.toolUse(value.toolUse);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(ContentBlockDelta || (ContentBlockDelta = {}));
var ContentBlockStart;
(function(ContentBlockStart) {
    ContentBlockStart.visit = (value, visitor)=>{
        if (value.toolUse !== undefined) return visitor.toolUse(value.toolUse);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(ContentBlockStart || (ContentBlockStart = {}));
class ModelStreamErrorException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"] {
    constructor(opts){
        super({
            name: "ModelStreamErrorException",
            $fault: "client",
            ...opts
        });
        this.name = "ModelStreamErrorException";
        this.$fault = "client";
        Object.setPrototypeOf(this, ModelStreamErrorException.prototype);
        this.originalStatusCode = opts.originalStatusCode;
        this.originalMessage = opts.originalMessage;
    }
}
var ConverseStreamOutput;
(function(ConverseStreamOutput) {
    ConverseStreamOutput.visit = (value, visitor)=>{
        if (value.messageStart !== undefined) return visitor.messageStart(value.messageStart);
        if (value.contentBlockStart !== undefined) return visitor.contentBlockStart(value.contentBlockStart);
        if (value.contentBlockDelta !== undefined) return visitor.contentBlockDelta(value.contentBlockDelta);
        if (value.contentBlockStop !== undefined) return visitor.contentBlockStop(value.contentBlockStop);
        if (value.messageStop !== undefined) return visitor.messageStop(value.messageStop);
        if (value.metadata !== undefined) return visitor.metadata(value.metadata);
        if (value.internalServerException !== undefined) return visitor.internalServerException(value.internalServerException);
        if (value.modelStreamErrorException !== undefined) return visitor.modelStreamErrorException(value.modelStreamErrorException);
        if (value.validationException !== undefined) return visitor.validationException(value.validationException);
        if (value.throttlingException !== undefined) return visitor.throttlingException(value.throttlingException);
        if (value.serviceUnavailableException !== undefined) return visitor.serviceUnavailableException(value.serviceUnavailableException);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(ConverseStreamOutput || (ConverseStreamOutput = {}));
const Trace = {
    DISABLED: "DISABLED",
    ENABLED: "ENABLED"
};
var ResponseStream;
(function(ResponseStream) {
    ResponseStream.visit = (value, visitor)=>{
        if (value.chunk !== undefined) return visitor.chunk(value.chunk);
        if (value.internalServerException !== undefined) return visitor.internalServerException(value.internalServerException);
        if (value.modelStreamErrorException !== undefined) return visitor.modelStreamErrorException(value.modelStreamErrorException);
        if (value.validationException !== undefined) return visitor.validationException(value.validationException);
        if (value.throttlingException !== undefined) return visitor.throttlingException(value.throttlingException);
        if (value.modelTimeoutException !== undefined) return visitor.modelTimeoutException(value.modelTimeoutException);
        if (value.serviceUnavailableException !== undefined) return visitor.serviceUnavailableException(value.serviceUnavailableException);
        return visitor._(value.$unknown[0], value.$unknown[1]);
    };
})(ResponseStream || (ResponseStream = {}));
const ConverseRequestFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.messages && {
            messages: obj.messages.map((item)=>item)
        },
        ...obj.system && {
            system: obj.system.map((item)=>item)
        },
        ...obj.toolConfig && {
            toolConfig: obj.toolConfig
        },
        ...obj.promptVariables && {
            promptVariables: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        }
    });
const ConverseStreamRequestFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.messages && {
            messages: obj.messages.map((item)=>item)
        },
        ...obj.system && {
            system: obj.system.map((item)=>item)
        },
        ...obj.toolConfig && {
            toolConfig: obj.toolConfig
        },
        ...obj.promptVariables && {
            promptVariables: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        }
    });
const ConverseStreamOutputFilterSensitiveLog = (obj)=>{
    if (obj.messageStart !== undefined) return {
        messageStart: obj.messageStart
    };
    if (obj.contentBlockStart !== undefined) return {
        contentBlockStart: obj.contentBlockStart
    };
    if (obj.contentBlockDelta !== undefined) return {
        contentBlockDelta: obj.contentBlockDelta
    };
    if (obj.contentBlockStop !== undefined) return {
        contentBlockStop: obj.contentBlockStop
    };
    if (obj.messageStop !== undefined) return {
        messageStop: obj.messageStop
    };
    if (obj.metadata !== undefined) return {
        metadata: obj.metadata
    };
    if (obj.internalServerException !== undefined) return {
        internalServerException: obj.internalServerException
    };
    if (obj.modelStreamErrorException !== undefined) return {
        modelStreamErrorException: obj.modelStreamErrorException
    };
    if (obj.validationException !== undefined) return {
        validationException: obj.validationException
    };
    if (obj.throttlingException !== undefined) return {
        throttlingException: obj.throttlingException
    };
    if (obj.serviceUnavailableException !== undefined) return {
        serviceUnavailableException: obj.serviceUnavailableException
    };
    if (obj.$unknown !== undefined) return {
        [obj.$unknown[0]]: "UNKNOWN"
    };
};
const ConverseStreamResponseFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.stream && {
            stream: "STREAMING_CONTENT"
        }
    });
const InvokeModelRequestFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.body && {
            body: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        }
    });
const InvokeModelResponseFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.body && {
            body: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        }
    });
const InvokeModelWithResponseStreamRequestFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.body && {
            body: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        }
    });
const PayloadPartFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.bytes && {
            bytes: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        }
    });
const ResponseStreamFilterSensitiveLog = (obj)=>{
    if (obj.chunk !== undefined) return {
        chunk: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
    };
    if (obj.internalServerException !== undefined) return {
        internalServerException: obj.internalServerException
    };
    if (obj.modelStreamErrorException !== undefined) return {
        modelStreamErrorException: obj.modelStreamErrorException
    };
    if (obj.validationException !== undefined) return {
        validationException: obj.validationException
    };
    if (obj.throttlingException !== undefined) return {
        throttlingException: obj.throttlingException
    };
    if (obj.modelTimeoutException !== undefined) return {
        modelTimeoutException: obj.modelTimeoutException
    };
    if (obj.serviceUnavailableException !== undefined) return {
        serviceUnavailableException: obj.serviceUnavailableException
    };
    if (obj.$unknown !== undefined) return {
        [obj.$unknown[0]]: "UNKNOWN"
    };
};
const InvokeModelWithResponseStreamResponseFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.body && {
            body: "STREAMING_CONTENT"
        }
    });
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/protocols/Aws_restJson1.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "de_ApplyGuardrailCommand": (()=>de_ApplyGuardrailCommand),
    "de_ConverseCommand": (()=>de_ConverseCommand),
    "de_ConverseStreamCommand": (()=>de_ConverseStreamCommand),
    "de_InvokeModelCommand": (()=>de_InvokeModelCommand),
    "de_InvokeModelWithResponseStreamCommand": (()=>de_InvokeModelWithResponseStreamCommand),
    "se_ApplyGuardrailCommand": (()=>se_ApplyGuardrailCommand),
    "se_ConverseCommand": (()=>se_ConverseCommand),
    "se_ConverseStreamCommand": (()=>se_ConverseStreamCommand),
    "se_InvokeModelCommand": (()=>se_InvokeModelCommand),
    "se_InvokeModelWithResponseStreamCommand": (()=>se_InvokeModelWithResponseStreamCommand)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.4/node_modules/@smithy/core/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$requestBuilder$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.4/node_modules/@smithy/core/dist-es/submodules/protocols/requestBuilder.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/object-mapping.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/serde-json.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$is$2d$serializable$2d$header$2d$value$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/is-serializable-header-value.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/parse-utils.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/protocols/json/parseJsonBody.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$awsExpectUnion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/protocols/json/awsExpectUnion.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$collect$2d$stream$2d$body$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.4/node_modules/@smithy/core/dist-es/submodules/protocols/collect-stream-body.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$default$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/default-error-handler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/models/BedrockRuntimeServiceException.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/models/models_0.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/exceptions.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$ser$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/ser-utils.js [app-rsc] (ecmascript)");
;
;
;
;
;
const se_ApplyGuardrailCommand = async (input, context)=>{
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$requestBuilder$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestBuilder"])(input, context);
    const headers = {
        "content-type": "application/json"
    };
    b.bp("/guardrail/{guardrailIdentifier}/version/{guardrailVersion}/apply");
    b.p("guardrailIdentifier", ()=>input.guardrailIdentifier, "{guardrailIdentifier}", false);
    b.p("guardrailVersion", ()=>input.guardrailVersion, "{guardrailVersion}", false);
    let body;
    body = JSON.stringify((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(input, {
        content: (_)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(_),
        source: []
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
const se_ConverseCommand = async (input, context)=>{
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$requestBuilder$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestBuilder"])(input, context);
    const headers = {
        "content-type": "application/json"
    };
    b.bp("/model/{modelId}/converse");
    b.p("modelId", ()=>input.modelId, "{modelId}", false);
    let body;
    body = JSON.stringify((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(input, {
        additionalModelRequestFields: (_)=>se_Document(_, context),
        additionalModelResponseFieldPaths: (_)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(_),
        guardrailConfig: (_)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(_),
        inferenceConfig: (_)=>se_InferenceConfiguration(_, context),
        messages: (_)=>se_Messages(_, context),
        promptVariables: (_)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(_),
        system: (_)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(_),
        toolConfig: (_)=>se_ToolConfiguration(_, context)
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
const se_ConverseStreamCommand = async (input, context)=>{
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$requestBuilder$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestBuilder"])(input, context);
    const headers = {
        "content-type": "application/json"
    };
    b.bp("/model/{modelId}/converse-stream");
    b.p("modelId", ()=>input.modelId, "{modelId}", false);
    let body;
    body = JSON.stringify((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(input, {
        additionalModelRequestFields: (_)=>se_Document(_, context),
        additionalModelResponseFieldPaths: (_)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(_),
        guardrailConfig: (_)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(_),
        inferenceConfig: (_)=>se_InferenceConfiguration(_, context),
        messages: (_)=>se_Messages(_, context),
        promptVariables: (_)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(_),
        system: (_)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(_),
        toolConfig: (_)=>se_ToolConfiguration(_, context)
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
const se_InvokeModelCommand = async (input, context)=>{
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$requestBuilder$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestBuilder"])(input, context);
    const headers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({}, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$is$2d$serializable$2d$header$2d$value$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSerializableHeaderValue"], {
        [_ct]: input[_cT] || "application/octet-stream",
        [_a]: input[_a],
        [_xabt]: input[_t],
        [_xabg]: input[_gI],
        [_xabg_]: input[_gV]
    });
    b.bp("/model/{modelId}/invoke");
    b.p("modelId", ()=>input.modelId, "{modelId}", false);
    let body;
    if (input.body !== undefined) {
        body = input.body;
    }
    b.m("POST").h(headers).b(body);
    return b.build();
};
const se_InvokeModelWithResponseStreamCommand = async (input, context)=>{
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$requestBuilder$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestBuilder"])(input, context);
    const headers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({}, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$is$2d$serializable$2d$header$2d$value$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSerializableHeaderValue"], {
        [_ct]: input[_cT] || "application/octet-stream",
        [_xaba]: input[_a],
        [_xabt]: input[_t],
        [_xabg]: input[_gI],
        [_xabg_]: input[_gV]
    });
    b.bp("/model/{modelId}/invoke-with-response-stream");
    b.p("modelId", ()=>input.modelId, "{modelId}", false);
    let body;
    if (input.body !== undefined) {
        body = input.body;
    }
    b.m("POST").h(headers).b(body);
    return b.build();
};
const de_ApplyGuardrailCommand = async (output, context)=>{
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        $metadata: deserializeMetadata(output)
    });
    const data = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectNonNull"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectObject"])(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context)), "body");
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        action: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        assessments: (_)=>de_GuardrailAssessmentList(_, context),
        guardrailCoverage: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        outputs: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        usage: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"]
    });
    Object.assign(contents, doc);
    return contents;
};
const de_ConverseCommand = async (output, context)=>{
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        $metadata: deserializeMetadata(output)
    });
    const data = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectNonNull"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectObject"])(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context)), "body");
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        additionalModelResponseFields: (_)=>de_Document(_, context),
        metrics: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        output: (_)=>de_ConverseOutput((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$awsExpectUnion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["awsExpectUnion"])(_), context),
        stopReason: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        trace: (_)=>de_ConverseTrace(_, context),
        usage: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"]
    });
    Object.assign(contents, doc);
    return contents;
};
const de_ConverseStreamCommand = async (output, context)=>{
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        $metadata: deserializeMetadata(output)
    });
    const data = output.body;
    contents.stream = de_ConverseStreamOutput(data, context);
    return contents;
};
const de_InvokeModelCommand = async (output, context)=>{
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        $metadata: deserializeMetadata(output),
        [_cT]: [
            ,
            output.headers[_ct]
        ]
    });
    const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$collect$2d$stream$2d$body$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collectBody"])(output.body, context);
    contents.body = data;
    return contents;
};
const de_InvokeModelWithResponseStreamCommand = async (output, context)=>{
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        $metadata: deserializeMetadata(output),
        [_cT]: [
            ,
            output.headers[_xabct]
        ]
    });
    const data = output.body;
    contents.body = de_ResponseStream(data, context);
    return contents;
};
const de_CommandError = async (output, context)=>{
    const parsedOutput = {
        ...output,
        body: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonErrorBody"])(output.body, context)
    };
    const errorCode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadRestJsonErrorCode"])(output, parsedOutput.body);
    switch(errorCode){
        case "AccessDeniedException":
        case "com.amazonaws.bedrockruntime#AccessDeniedException":
            throw await de_AccessDeniedExceptionRes(parsedOutput, context);
        case "InternalServerException":
        case "com.amazonaws.bedrockruntime#InternalServerException":
            throw await de_InternalServerExceptionRes(parsedOutput, context);
        case "ResourceNotFoundException":
        case "com.amazonaws.bedrockruntime#ResourceNotFoundException":
            throw await de_ResourceNotFoundExceptionRes(parsedOutput, context);
        case "ServiceQuotaExceededException":
        case "com.amazonaws.bedrockruntime#ServiceQuotaExceededException":
            throw await de_ServiceQuotaExceededExceptionRes(parsedOutput, context);
        case "ThrottlingException":
        case "com.amazonaws.bedrockruntime#ThrottlingException":
            throw await de_ThrottlingExceptionRes(parsedOutput, context);
        case "ValidationException":
        case "com.amazonaws.bedrockruntime#ValidationException":
            throw await de_ValidationExceptionRes(parsedOutput, context);
        case "ModelErrorException":
        case "com.amazonaws.bedrockruntime#ModelErrorException":
            throw await de_ModelErrorExceptionRes(parsedOutput, context);
        case "ModelNotReadyException":
        case "com.amazonaws.bedrockruntime#ModelNotReadyException":
            throw await de_ModelNotReadyExceptionRes(parsedOutput, context);
        case "ModelTimeoutException":
        case "com.amazonaws.bedrockruntime#ModelTimeoutException":
            throw await de_ModelTimeoutExceptionRes(parsedOutput, context);
        case "ServiceUnavailableException":
        case "com.amazonaws.bedrockruntime#ServiceUnavailableException":
            throw await de_ServiceUnavailableExceptionRes(parsedOutput, context);
        case "ModelStreamErrorException":
        case "com.amazonaws.bedrockruntime#ModelStreamErrorException":
            throw await de_ModelStreamErrorExceptionRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody,
                errorCode
            });
    }
};
const throwDefaultError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$default$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["withBaseException"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$BedrockRuntimeServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["BedrockRuntimeServiceException"]);
const de_AccessDeniedExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AccessDeniedException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_InternalServerExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InternalServerException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_ModelErrorExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        originalStatusCode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectInt32"],
        resourceName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ModelErrorException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_ModelNotReadyExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ModelNotReadyException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_ModelStreamErrorExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        originalMessage: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        originalStatusCode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectInt32"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ModelStreamErrorException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_ModelTimeoutExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ModelTimeoutException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_ResourceNotFoundExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ResourceNotFoundException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_ServiceQuotaExceededExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ServiceQuotaExceededException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_ServiceUnavailableExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ServiceUnavailableException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_ThrottlingExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ThrottlingException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_ValidationExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ValidationException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_ConverseStreamOutput = (output, context)=>{
    return context.eventStreamMarshaller.deserialize(output, async (event)=>{
        if (event["messageStart"] != null) {
            return {
                messageStart: await de_MessageStartEvent_event(event["messageStart"], context)
            };
        }
        if (event["contentBlockStart"] != null) {
            return {
                contentBlockStart: await de_ContentBlockStartEvent_event(event["contentBlockStart"], context)
            };
        }
        if (event["contentBlockDelta"] != null) {
            return {
                contentBlockDelta: await de_ContentBlockDeltaEvent_event(event["contentBlockDelta"], context)
            };
        }
        if (event["contentBlockStop"] != null) {
            return {
                contentBlockStop: await de_ContentBlockStopEvent_event(event["contentBlockStop"], context)
            };
        }
        if (event["messageStop"] != null) {
            return {
                messageStop: await de_MessageStopEvent_event(event["messageStop"], context)
            };
        }
        if (event["metadata"] != null) {
            return {
                metadata: await de_ConverseStreamMetadataEvent_event(event["metadata"], context)
            };
        }
        if (event["internalServerException"] != null) {
            return {
                internalServerException: await de_InternalServerException_event(event["internalServerException"], context)
            };
        }
        if (event["modelStreamErrorException"] != null) {
            return {
                modelStreamErrorException: await de_ModelStreamErrorException_event(event["modelStreamErrorException"], context)
            };
        }
        if (event["validationException"] != null) {
            return {
                validationException: await de_ValidationException_event(event["validationException"], context)
            };
        }
        if (event["throttlingException"] != null) {
            return {
                throttlingException: await de_ThrottlingException_event(event["throttlingException"], context)
            };
        }
        if (event["serviceUnavailableException"] != null) {
            return {
                serviceUnavailableException: await de_ServiceUnavailableException_event(event["serviceUnavailableException"], context)
            };
        }
        return {
            $unknown: output
        };
    });
};
const de_ResponseStream = (output, context)=>{
    return context.eventStreamMarshaller.deserialize(output, async (event)=>{
        if (event["chunk"] != null) {
            return {
                chunk: await de_PayloadPart_event(event["chunk"], context)
            };
        }
        if (event["internalServerException"] != null) {
            return {
                internalServerException: await de_InternalServerException_event(event["internalServerException"], context)
            };
        }
        if (event["modelStreamErrorException"] != null) {
            return {
                modelStreamErrorException: await de_ModelStreamErrorException_event(event["modelStreamErrorException"], context)
            };
        }
        if (event["validationException"] != null) {
            return {
                validationException: await de_ValidationException_event(event["validationException"], context)
            };
        }
        if (event["throttlingException"] != null) {
            return {
                throttlingException: await de_ThrottlingException_event(event["throttlingException"], context)
            };
        }
        if (event["modelTimeoutException"] != null) {
            return {
                modelTimeoutException: await de_ModelTimeoutException_event(event["modelTimeoutException"], context)
            };
        }
        if (event["serviceUnavailableException"] != null) {
            return {
                serviceUnavailableException: await de_ServiceUnavailableException_event(event["serviceUnavailableException"], context)
            };
        }
        return {
            $unknown: output
        };
    });
};
const de_ContentBlockDeltaEvent_event = async (output, context)=>{
    const contents = {};
    const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context);
    Object.assign(contents, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(data));
    return contents;
};
const de_ContentBlockStartEvent_event = async (output, context)=>{
    const contents = {};
    const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context);
    Object.assign(contents, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(data));
    return contents;
};
const de_ContentBlockStopEvent_event = async (output, context)=>{
    const contents = {};
    const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context);
    Object.assign(contents, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(data));
    return contents;
};
const de_ConverseStreamMetadataEvent_event = async (output, context)=>{
    const contents = {};
    const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context);
    Object.assign(contents, de_ConverseStreamMetadataEvent(data, context));
    return contents;
};
const de_InternalServerException_event = async (output, context)=>{
    const parsedOutput = {
        ...output,
        body: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context)
    };
    return de_InternalServerExceptionRes(parsedOutput, context);
};
const de_MessageStartEvent_event = async (output, context)=>{
    const contents = {};
    const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context);
    Object.assign(contents, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(data));
    return contents;
};
const de_MessageStopEvent_event = async (output, context)=>{
    const contents = {};
    const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context);
    Object.assign(contents, de_MessageStopEvent(data, context));
    return contents;
};
const de_ModelStreamErrorException_event = async (output, context)=>{
    const parsedOutput = {
        ...output,
        body: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context)
    };
    return de_ModelStreamErrorExceptionRes(parsedOutput, context);
};
const de_ModelTimeoutException_event = async (output, context)=>{
    const parsedOutput = {
        ...output,
        body: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context)
    };
    return de_ModelTimeoutExceptionRes(parsedOutput, context);
};
const de_PayloadPart_event = async (output, context)=>{
    const contents = {};
    const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context);
    Object.assign(contents, de_PayloadPart(data, context));
    return contents;
};
const de_ServiceUnavailableException_event = async (output, context)=>{
    const parsedOutput = {
        ...output,
        body: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context)
    };
    return de_ServiceUnavailableExceptionRes(parsedOutput, context);
};
const de_ThrottlingException_event = async (output, context)=>{
    const parsedOutput = {
        ...output,
        body: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context)
    };
    return de_ThrottlingExceptionRes(parsedOutput, context);
};
const de_ValidationException_event = async (output, context)=>{
    const parsedOutput = {
        ...output,
        body: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context)
    };
    return de_ValidationExceptionRes(parsedOutput, context);
};
const se_ContentBlock = (input, context)=>{
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ContentBlock"].visit(input, {
        document: (value)=>({
                document: se_DocumentBlock(value, context)
            }),
        guardContent: (value)=>({
                guardContent: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])(value)
            }),
        image: (value)=>({
                image: se_ImageBlock(value, context)
            }),
        text: (value)=>({
                text: value
            }),
        toolResult: (value)=>({
                toolResult: se_ToolResultBlock(value, context)
            }),
        toolUse: (value)=>({
                toolUse: se_ToolUseBlock(value, context)
            }),
        _: (name, value)=>({
                name: value
            })
    });
};
const se_ContentBlocks = (input, context)=>{
    return input.filter((e)=>e != null).map((entry)=>{
        return se_ContentBlock(entry, context);
    });
};
const se_DocumentBlock = (input, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(input, {
        format: [],
        name: [],
        source: (_)=>se_DocumentSource(_, context)
    });
};
const se_DocumentSource = (input, context)=>{
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DocumentSource"].visit(input, {
        bytes: (value)=>({
                bytes: context.base64Encoder(value)
            }),
        _: (name, value)=>({
                name: value
            })
    });
};
const se_ImageBlock = (input, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(input, {
        format: [],
        source: (_)=>se_ImageSource(_, context)
    });
};
const se_ImageSource = (input, context)=>{
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ImageSource"].visit(input, {
        bytes: (value)=>({
                bytes: context.base64Encoder(value)
            }),
        _: (name, value)=>({
                name: value
            })
    });
};
const se_InferenceConfiguration = (input, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(input, {
        maxTokens: [],
        stopSequences: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        temperature: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$ser$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serializeFloat"],
        topP: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$ser$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serializeFloat"]
    });
};
const se_Message = (input, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(input, {
        content: (_)=>se_ContentBlocks(_, context),
        role: []
    });
};
const se_Messages = (input, context)=>{
    return input.filter((e)=>e != null).map((entry)=>{
        return se_Message(entry, context);
    });
};
const se_Tool = (input, context)=>{
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Tool"].visit(input, {
        toolSpec: (value)=>({
                toolSpec: se_ToolSpecification(value, context)
            }),
        _: (name, value)=>({
                name: value
            })
    });
};
const se_ToolConfiguration = (input, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(input, {
        toolChoice: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        tools: (_)=>se_Tools(_, context)
    });
};
const se_ToolInputSchema = (input, context)=>{
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ToolInputSchema"].visit(input, {
        json: (value)=>({
                json: se_Document(value, context)
            }),
        _: (name, value)=>({
                name: value
            })
    });
};
const se_ToolResultBlock = (input, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(input, {
        content: (_)=>se_ToolResultContentBlocks(_, context),
        status: [],
        toolUseId: []
    });
};
const se_ToolResultContentBlock = (input, context)=>{
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ToolResultContentBlock"].visit(input, {
        document: (value)=>({
                document: se_DocumentBlock(value, context)
            }),
        image: (value)=>({
                image: se_ImageBlock(value, context)
            }),
        json: (value)=>({
                json: se_Document(value, context)
            }),
        text: (value)=>({
                text: value
            }),
        _: (name, value)=>({
                name: value
            })
    });
};
const se_ToolResultContentBlocks = (input, context)=>{
    return input.filter((e)=>e != null).map((entry)=>{
        return se_ToolResultContentBlock(entry, context);
    });
};
const se_Tools = (input, context)=>{
    return input.filter((e)=>e != null).map((entry)=>{
        return se_Tool(entry, context);
    });
};
const se_ToolSpecification = (input, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(input, {
        description: [],
        inputSchema: (_)=>se_ToolInputSchema(_, context),
        name: []
    });
};
const se_ToolUseBlock = (input, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(input, {
        input: (_)=>se_Document(_, context),
        name: [],
        toolUseId: []
    });
};
const se_Document = (input, context)=>{
    return input;
};
const de_ContentBlock = (output, context)=>{
    if (output.document != null) {
        return {
            document: de_DocumentBlock(output.document, context)
        };
    }
    if (output.guardContent != null) {
        return {
            guardContent: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$awsExpectUnion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["awsExpectUnion"])(output.guardContent))
        };
    }
    if (output.image != null) {
        return {
            image: de_ImageBlock(output.image, context)
        };
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"])(output.text) !== undefined) {
        return {
            text: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"])(output.text)
        };
    }
    if (output.toolResult != null) {
        return {
            toolResult: de_ToolResultBlock(output.toolResult, context)
        };
    }
    if (output.toolUse != null) {
        return {
            toolUse: de_ToolUseBlock(output.toolUse, context)
        };
    }
    return {
        $unknown: Object.entries(output)[0]
    };
};
const de_ContentBlocks = (output, context)=>{
    const retVal = (output || []).filter((e)=>e != null).map((entry)=>{
        return de_ContentBlock((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$awsExpectUnion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["awsExpectUnion"])(entry), context);
    });
    return retVal;
};
const de_ConverseOutput = (output, context)=>{
    if (output.message != null) {
        return {
            message: de_Message(output.message, context)
        };
    }
    return {
        $unknown: Object.entries(output)[0]
    };
};
const de_ConverseStreamMetadataEvent = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        metrics: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        trace: (_)=>de_ConverseStreamTrace(_, context),
        usage: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"]
    });
};
const de_ConverseStreamTrace = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        guardrail: (_)=>de_GuardrailTraceAssessment(_, context)
    });
};
const de_ConverseTrace = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        guardrail: (_)=>de_GuardrailTraceAssessment(_, context)
    });
};
const de_DocumentBlock = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        format: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        name: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        source: (_)=>de_DocumentSource((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$awsExpectUnion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["awsExpectUnion"])(_), context)
    });
};
const de_DocumentSource = (output, context)=>{
    if (output.bytes != null) {
        return {
            bytes: context.base64Decoder(output.bytes)
        };
    }
    return {
        $unknown: Object.entries(output)[0]
    };
};
const de_GuardrailAssessment = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        contentPolicy: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        contextualGroundingPolicy: (_)=>de_GuardrailContextualGroundingPolicyAssessment(_, context),
        invocationMetrics: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        sensitiveInformationPolicy: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        topicPolicy: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        wordPolicy: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"]
    });
};
const de_GuardrailAssessmentList = (output, context)=>{
    const retVal = (output || []).filter((e)=>e != null).map((entry)=>{
        return de_GuardrailAssessment(entry, context);
    });
    return retVal;
};
const de_GuardrailAssessmentListMap = (output, context)=>{
    return Object.entries(output).reduce((acc, [key, value])=>{
        if (value === null) {
            return acc;
        }
        acc[key] = de_GuardrailAssessmentList(value, context);
        return acc;
    }, {});
};
const de_GuardrailAssessmentMap = (output, context)=>{
    return Object.entries(output).reduce((acc, [key, value])=>{
        if (value === null) {
            return acc;
        }
        acc[key] = de_GuardrailAssessment(value, context);
        return acc;
    }, {});
};
const de_GuardrailContextualGroundingFilter = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        action: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        score: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["limitedParseDouble"],
        threshold: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["limitedParseDouble"],
        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
};
const de_GuardrailContextualGroundingFilters = (output, context)=>{
    const retVal = (output || []).filter((e)=>e != null).map((entry)=>{
        return de_GuardrailContextualGroundingFilter(entry, context);
    });
    return retVal;
};
const de_GuardrailContextualGroundingPolicyAssessment = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        filters: (_)=>de_GuardrailContextualGroundingFilters(_, context)
    });
};
const de_GuardrailTraceAssessment = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        inputAssessment: (_)=>de_GuardrailAssessmentMap(_, context),
        modelOutput: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        outputAssessments: (_)=>de_GuardrailAssessmentListMap(_, context)
    });
};
const de_ImageBlock = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        format: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        source: (_)=>de_ImageSource((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$awsExpectUnion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["awsExpectUnion"])(_), context)
    });
};
const de_ImageSource = (output, context)=>{
    if (output.bytes != null) {
        return {
            bytes: context.base64Decoder(output.bytes)
        };
    }
    return {
        $unknown: Object.entries(output)[0]
    };
};
const de_Message = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        content: (_)=>de_ContentBlocks(_, context),
        role: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
};
const de_MessageStopEvent = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        additionalModelResponseFields: (_)=>de_Document(_, context),
        stopReason: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
};
const de_PayloadPart = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        bytes: context.base64Decoder
    });
};
const de_ToolResultBlock = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        content: (_)=>de_ToolResultContentBlocks(_, context),
        status: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        toolUseId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
};
const de_ToolResultContentBlock = (output, context)=>{
    if (output.document != null) {
        return {
            document: de_DocumentBlock(output.document, context)
        };
    }
    if (output.image != null) {
        return {
            image: de_ImageBlock(output.image, context)
        };
    }
    if (output.json != null) {
        return {
            json: de_Document(output.json, context)
        };
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"])(output.text) !== undefined) {
        return {
            text: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"])(output.text)
        };
    }
    return {
        $unknown: Object.entries(output)[0]
    };
};
const de_ToolResultContentBlocks = (output, context)=>{
    const retVal = (output || []).filter((e)=>e != null).map((entry)=>{
        return de_ToolResultContentBlock((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$awsExpectUnion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["awsExpectUnion"])(entry), context);
    });
    return retVal;
};
const de_ToolUseBlock = (output, context)=>{
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(output, {
        input: (_)=>de_Document(_, context),
        name: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        toolUseId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
};
const de_Document = (output, context)=>{
    return output;
};
const deserializeMetadata = (output)=>({
        httpStatusCode: output.statusCode,
        requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
        extendedRequestId: output.headers["x-amz-id-2"],
        cfId: output.headers["x-amz-cf-id"]
    });
const collectBodyString = (streamBody, context)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$collect$2d$stream$2d$body$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collectBody"])(streamBody, context).then((body)=>context.utf8Encoder(body));
const _a = "accept";
const _cT = "contentType";
const _ct = "content-type";
const _gI = "guardrailIdentifier";
const _gV = "guardrailVersion";
const _t = "trace";
const _xaba = "x-amzn-bedrock-accept";
const _xabct = "x-amzn-bedrock-content-type";
const _xabg = "x-amzn-bedrock-guardrailidentifier";
const _xabg_ = "x-amzn-bedrock-guardrailversion";
const _xabt = "x-amzn-bedrock-trace";
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/commands/ConverseCommand.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "ConverseCommand": (()=>ConverseCommand)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$command$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/command.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/endpoint/EndpointParameters.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$serde$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$middleware$2d$serde$2f$dist$2d$es$2f$serdePlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-serde@3.0.10/node_modules/@smithy/middleware-serde/dist-es/serdePlugin.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$4$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$getEndpointPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-endpoint@3.2.4/node_modules/@smithy/middleware-endpoint/dist-es/getEndpointPlugin.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/models/models_0.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/protocols/Aws_restJson1.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
class ConverseCommand extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$command$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Command"].classBuilder().ep(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["commonParams"]).m(function(Command, cs, config, o) {
    return [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$serde$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$middleware$2d$serde$2f$dist$2d$es$2f$serdePlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSerdePlugin"])(config, this.serialize, this.deserialize),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$4$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$getEndpointPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEndpointPlugin"])(config, Command.getEndpointParameterInstructions())
    ];
}).s("AmazonBedrockFrontendService", "Converse", {}).n("BedrockRuntimeClient", "ConverseCommand").f(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ConverseRequestFilterSensitiveLog"], void 0).ser(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["se_ConverseCommand"]).de(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["de_ConverseCommand"]).build() {
}
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/commands/ConverseStreamCommand.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "ConverseStreamCommand": (()=>ConverseStreamCommand)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$command$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/command.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/endpoint/EndpointParameters.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$serde$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$middleware$2d$serde$2f$dist$2d$es$2f$serdePlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-serde@3.0.10/node_modules/@smithy/middleware-serde/dist-es/serdePlugin.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$4$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$getEndpointPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-endpoint@3.2.4/node_modules/@smithy/middleware-endpoint/dist-es/getEndpointPlugin.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/models/models_0.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/protocols/Aws_restJson1.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
class ConverseStreamCommand extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$command$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Command"].classBuilder().ep(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["commonParams"]).m(function(Command, cs, config, o) {
    return [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$serde$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$middleware$2d$serde$2f$dist$2d$es$2f$serdePlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSerdePlugin"])(config, this.serialize, this.deserialize),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$4$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$getEndpointPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEndpointPlugin"])(config, Command.getEndpointParameterInstructions())
    ];
}).s("AmazonBedrockFrontendService", "ConverseStream", {
    eventStream: {
        output: true
    }
}).n("BedrockRuntimeClient", "ConverseStreamCommand").f(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ConverseStreamRequestFilterSensitiveLog"], __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ConverseStreamResponseFilterSensitiveLog"]).ser(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["se_ConverseStreamCommand"]).de(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["de_ConverseStreamCommand"]).build() {
}
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/commands/InvokeModelCommand.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "InvokeModelCommand": (()=>InvokeModelCommand)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$command$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/command.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/endpoint/EndpointParameters.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$serde$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$middleware$2d$serde$2f$dist$2d$es$2f$serdePlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-serde@3.0.10/node_modules/@smithy/middleware-serde/dist-es/serdePlugin.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$4$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$getEndpointPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-endpoint@3.2.4/node_modules/@smithy/middleware-endpoint/dist-es/getEndpointPlugin.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/models/models_0.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/protocols/Aws_restJson1.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
class InvokeModelCommand extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$command$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Command"].classBuilder().ep(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["commonParams"]).m(function(Command, cs, config, o) {
    return [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$serde$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$middleware$2d$serde$2f$dist$2d$es$2f$serdePlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSerdePlugin"])(config, this.serialize, this.deserialize),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$4$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$getEndpointPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEndpointPlugin"])(config, Command.getEndpointParameterInstructions())
    ];
}).s("AmazonBedrockFrontendService", "InvokeModel", {}).n("BedrockRuntimeClient", "InvokeModelCommand").f(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InvokeModelRequestFilterSensitiveLog"], __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InvokeModelResponseFilterSensitiveLog"]).ser(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["se_InvokeModelCommand"]).de(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["de_InvokeModelCommand"]).build() {
}
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/package.json (json)": ((__turbopack_context__) => {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, t: require } = __turbopack_context__;
{
__turbopack_export_value__(JSON.parse("{\"name\":\"@aws-sdk/client-bedrock-runtime\",\"description\":\"AWS SDK for JavaScript Bedrock Runtime Client for Node.js, Browser and React Native\",\"version\":\"3.699.0\",\"scripts\":{\"build\":\"concurrently 'yarn:build:cjs' 'yarn:build:es' 'yarn:build:types'\",\"build:cjs\":\"node ../../scripts/compilation/inline client-bedrock-runtime\",\"build:es\":\"tsc -p tsconfig.es.json\",\"build:include:deps\":\"lerna run --scope $npm_package_name --include-dependencies build\",\"build:types\":\"tsc -p tsconfig.types.json\",\"build:types:downlevel\":\"downlevel-dts dist-types dist-types/ts3.4\",\"clean\":\"rimraf ./dist-* && rimraf *.tsbuildinfo\",\"extract:docs\":\"api-extractor run --local\",\"generate:client\":\"node ../../scripts/generate-clients/single-service --solo bedrock-runtime\"},\"main\":\"./dist-cjs/index.js\",\"types\":\"./dist-types/index.d.ts\",\"module\":\"./dist-es/index.js\",\"sideEffects\":false,\"dependencies\":{\"@aws-crypto/sha256-browser\":\"5.2.0\",\"@aws-crypto/sha256-js\":\"5.2.0\",\"@aws-sdk/client-sso-oidc\":\"3.699.0\",\"@aws-sdk/client-sts\":\"3.699.0\",\"@aws-sdk/core\":\"3.696.0\",\"@aws-sdk/credential-provider-node\":\"3.699.0\",\"@aws-sdk/middleware-host-header\":\"3.696.0\",\"@aws-sdk/middleware-logger\":\"3.696.0\",\"@aws-sdk/middleware-recursion-detection\":\"3.696.0\",\"@aws-sdk/middleware-user-agent\":\"3.696.0\",\"@aws-sdk/region-config-resolver\":\"3.696.0\",\"@aws-sdk/types\":\"3.696.0\",\"@aws-sdk/util-endpoints\":\"3.696.0\",\"@aws-sdk/util-user-agent-browser\":\"3.696.0\",\"@aws-sdk/util-user-agent-node\":\"3.696.0\",\"@smithy/config-resolver\":\"^3.0.12\",\"@smithy/core\":\"^2.5.3\",\"@smithy/eventstream-serde-browser\":\"^3.0.13\",\"@smithy/eventstream-serde-config-resolver\":\"^3.0.10\",\"@smithy/eventstream-serde-node\":\"^3.0.12\",\"@smithy/fetch-http-handler\":\"^4.1.1\",\"@smithy/hash-node\":\"^3.0.10\",\"@smithy/invalid-dependency\":\"^3.0.10\",\"@smithy/middleware-content-length\":\"^3.0.12\",\"@smithy/middleware-endpoint\":\"^3.2.3\",\"@smithy/middleware-retry\":\"^3.0.27\",\"@smithy/middleware-serde\":\"^3.0.10\",\"@smithy/middleware-stack\":\"^3.0.10\",\"@smithy/node-config-provider\":\"^3.1.11\",\"@smithy/node-http-handler\":\"^3.3.1\",\"@smithy/protocol-http\":\"^4.1.7\",\"@smithy/smithy-client\":\"^3.4.4\",\"@smithy/types\":\"^3.7.1\",\"@smithy/url-parser\":\"^3.0.10\",\"@smithy/util-base64\":\"^3.0.0\",\"@smithy/util-body-length-browser\":\"^3.0.0\",\"@smithy/util-body-length-node\":\"^3.0.0\",\"@smithy/util-defaults-mode-browser\":\"^3.0.27\",\"@smithy/util-defaults-mode-node\":\"^3.0.27\",\"@smithy/util-endpoints\":\"^2.1.6\",\"@smithy/util-middleware\":\"^3.0.10\",\"@smithy/util-retry\":\"^3.0.10\",\"@smithy/util-stream\":\"^3.3.1\",\"@smithy/util-utf8\":\"^3.0.0\",\"tslib\":\"^2.6.2\"},\"devDependencies\":{\"@tsconfig/node16\":\"16.1.3\",\"@types/node\":\"^16.18.96\",\"concurrently\":\"7.0.0\",\"downlevel-dts\":\"0.10.1\",\"rimraf\":\"3.0.2\",\"typescript\":\"~4.9.5\"},\"engines\":{\"node\":\">=16.0.0\"},\"typesVersions\":{\"<4.0\":{\"dist-types/*\":[\"dist-types/ts3.4/*\"]}},\"files\":[\"dist-*/**\"],\"author\":{\"name\":\"AWS SDK for JavaScript Team\",\"url\":\"https://aws.amazon.com/javascript/\"},\"license\":\"Apache-2.0\",\"browser\":{\"./dist-es/runtimeConfig\":\"./dist-es/runtimeConfig.browser\"},\"react-native\":{\"./dist-es/runtimeConfig\":\"./dist-es/runtimeConfig.native\"},\"homepage\":\"https://github.com/aws/aws-sdk-js-v3/tree/main/clients/client-bedrock-runtime\",\"repository\":{\"type\":\"git\",\"url\":\"https://github.com/aws/aws-sdk-js-v3.git\",\"directory\":\"clients/client-bedrock-runtime\"}}"));}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/endpoint/ruleset.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "ruleSet": (()=>ruleSet)
});
const s = "required", t = "fn", u = "argv", v = "ref";
const a = true, b = "isSet", c = "booleanEquals", d = "error", e = "endpoint", f = "tree", g = "PartitionResult", h = {
    [s]: false,
    "type": "String"
}, i = {
    [s]: true,
    "default": false,
    "type": "Boolean"
}, j = {
    [v]: "Endpoint"
}, k = {
    [t]: c,
    [u]: [
        {
            [v]: "UseFIPS"
        },
        true
    ]
}, l = {
    [t]: c,
    [u]: [
        {
            [v]: "UseDualStack"
        },
        true
    ]
}, m = {}, n = {
    [t]: "getAttr",
    [u]: [
        {
            [v]: g
        },
        "supportsFIPS"
    ]
}, o = {
    [t]: c,
    [u]: [
        true,
        {
            [t]: "getAttr",
            [u]: [
                {
                    [v]: g
                },
                "supportsDualStack"
            ]
        }
    ]
}, p = [
    k
], q = [
    l
], r = [
    {
        [v]: "Region"
    }
];
const _data = {
    version: "1.0",
    parameters: {
        Region: h,
        UseDualStack: i,
        UseFIPS: i,
        Endpoint: h
    },
    rules: [
        {
            conditions: [
                {
                    [t]: b,
                    [u]: [
                        j
                    ]
                }
            ],
            rules: [
                {
                    conditions: p,
                    error: "Invalid Configuration: FIPS and custom endpoint are not supported",
                    type: d
                },
                {
                    rules: [
                        {
                            conditions: q,
                            error: "Invalid Configuration: Dualstack and custom endpoint are not supported",
                            type: d
                        },
                        {
                            endpoint: {
                                url: j,
                                properties: m,
                                headers: m
                            },
                            type: e
                        }
                    ],
                    type: f
                }
            ],
            type: f
        },
        {
            rules: [
                {
                    conditions: [
                        {
                            [t]: b,
                            [u]: r
                        }
                    ],
                    rules: [
                        {
                            conditions: [
                                {
                                    [t]: "aws.partition",
                                    [u]: r,
                                    assign: g
                                }
                            ],
                            rules: [
                                {
                                    conditions: [
                                        k,
                                        l
                                    ],
                                    rules: [
                                        {
                                            conditions: [
                                                {
                                                    [t]: c,
                                                    [u]: [
                                                        a,
                                                        n
                                                    ]
                                                },
                                                o
                                            ],
                                            rules: [
                                                {
                                                    rules: [
                                                        {
                                                            endpoint: {
                                                                url: "https://bedrock-runtime-fips.{Region}.{PartitionResult#dualStackDnsSuffix}",
                                                                properties: m,
                                                                headers: m
                                                            },
                                                            type: e
                                                        }
                                                    ],
                                                    type: f
                                                }
                                            ],
                                            type: f
                                        },
                                        {
                                            error: "FIPS and DualStack are enabled, but this partition does not support one or both",
                                            type: d
                                        }
                                    ],
                                    type: f
                                },
                                {
                                    conditions: p,
                                    rules: [
                                        {
                                            conditions: [
                                                {
                                                    [t]: c,
                                                    [u]: [
                                                        n,
                                                        a
                                                    ]
                                                }
                                            ],
                                            rules: [
                                                {
                                                    rules: [
                                                        {
                                                            endpoint: {
                                                                url: "https://bedrock-runtime-fips.{Region}.{PartitionResult#dnsSuffix}",
                                                                properties: m,
                                                                headers: m
                                                            },
                                                            type: e
                                                        }
                                                    ],
                                                    type: f
                                                }
                                            ],
                                            type: f
                                        },
                                        {
                                            error: "FIPS is enabled but this partition does not support FIPS",
                                            type: d
                                        }
                                    ],
                                    type: f
                                },
                                {
                                    conditions: q,
                                    rules: [
                                        {
                                            conditions: [
                                                o
                                            ],
                                            rules: [
                                                {
                                                    rules: [
                                                        {
                                                            endpoint: {
                                                                url: "https://bedrock-runtime.{Region}.{PartitionResult#dualStackDnsSuffix}",
                                                                properties: m,
                                                                headers: m
                                                            },
                                                            type: e
                                                        }
                                                    ],
                                                    type: f
                                                }
                                            ],
                                            type: f
                                        },
                                        {
                                            error: "DualStack is enabled but this partition does not support DualStack",
                                            type: d
                                        }
                                    ],
                                    type: f
                                },
                                {
                                    rules: [
                                        {
                                            endpoint: {
                                                url: "https://bedrock-runtime.{Region}.{PartitionResult#dnsSuffix}",
                                                properties: m,
                                                headers: m
                                            },
                                            type: e
                                        }
                                    ],
                                    type: f
                                }
                            ],
                            type: f
                        }
                    ],
                    type: f
                },
                {
                    error: "Invalid Configuration: Missing Region",
                    type: d
                }
            ],
            type: f
        }
    ]
};
const ruleSet = _data;
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/endpoint/endpointResolver.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "defaultEndpointResolver": (()=>defaultEndpointResolver)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$endpoints$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$endpoints$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+util-endpoints@3.696.0/node_modules/@aws-sdk/util-endpoints/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$6$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-endpoints@2.1.6/node_modules/@smithy/util-endpoints/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$6$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$cache$2f$EndpointCache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-endpoints@2.1.6/node_modules/@smithy/util-endpoints/dist-es/cache/EndpointCache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$6$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$resolveEndpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-endpoints@2.1.6/node_modules/@smithy/util-endpoints/dist-es/resolveEndpoint.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$ruleset$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/endpoint/ruleset.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$6$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$utils$2f$customEndpointFunctions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-endpoints@2.1.6/node_modules/@smithy/util-endpoints/dist-es/utils/customEndpointFunctions.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$endpoints$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$endpoints$2f$dist$2d$es$2f$aws$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+util-endpoints@3.696.0/node_modules/@aws-sdk/util-endpoints/dist-es/aws.js [app-rsc] (ecmascript)");
;
;
;
const cache = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$6$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$cache$2f$EndpointCache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["EndpointCache"]({
    size: 50,
    params: [
        "Endpoint",
        "Region",
        "UseDualStack",
        "UseFIPS"
    ]
});
const defaultEndpointResolver = (endpointParams, context = {})=>{
    return cache.get(endpointParams, ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$6$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$resolveEndpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveEndpoint"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$ruleset$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ruleSet"], {
            endpointParams: endpointParams,
            logger: context.logger
        }));
};
__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$6$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$utils$2f$customEndpointFunctions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["customEndpointFunctions"].aws = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$endpoints$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$endpoints$2f$dist$2d$es$2f$aws$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["awsEndpointFunctions"];
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/auth/httpAuthSchemeProvider.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "defaultBedrockRuntimeHttpAuthSchemeParametersProvider": (()=>defaultBedrockRuntimeHttpAuthSchemeParametersProvider),
    "defaultBedrockRuntimeHttpAuthSchemeProvider": (()=>defaultBedrockRuntimeHttpAuthSchemeProvider),
    "resolveHttpAuthSchemeConfig": (()=>resolveHttpAuthSchemeConfig)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$middleware$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$util$2d$middleware$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-middleware@3.0.10/node_modules/@smithy/util-middleware/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$httpAuthSchemes$2f$aws_sdk$2f$resolveAwsSdkSigV4Config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/aws_sdk/resolveAwsSdkSigV4Config.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$middleware$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$util$2d$middleware$2f$dist$2d$es$2f$getSmithyContext$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-middleware@3.0.10/node_modules/@smithy/util-middleware/dist-es/getSmithyContext.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$middleware$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$util$2d$middleware$2f$dist$2d$es$2f$normalizeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-middleware@3.0.10/node_modules/@smithy/util-middleware/dist-es/normalizeProvider.js [app-rsc] (ecmascript)");
;
;
const defaultBedrockRuntimeHttpAuthSchemeParametersProvider = async (config, context, input)=>{
    return {
        operation: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$middleware$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$util$2d$middleware$2f$dist$2d$es$2f$getSmithyContext$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSmithyContext"])(context).operation,
        region: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$middleware$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$util$2d$middleware$2f$dist$2d$es$2f$normalizeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["normalizeProvider"])(config.region)() || (()=>{
            throw new Error("expected `region` to be configured for `aws.auth#sigv4`");
        })()
    };
};
function createAwsAuthSigv4HttpAuthOption(authParameters) {
    return {
        schemeId: "aws.auth#sigv4",
        signingProperties: {
            name: "bedrock",
            region: authParameters.region
        },
        propertiesExtractor: (config, context)=>({
                signingProperties: {
                    config,
                    context
                }
            })
    };
}
const defaultBedrockRuntimeHttpAuthSchemeProvider = (authParameters)=>{
    const options = [];
    switch(authParameters.operation){
        default:
            {
                options.push(createAwsAuthSigv4HttpAuthOption(authParameters));
            }
    }
    return options;
};
const resolveHttpAuthSchemeConfig = (config)=>{
    const config_0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$httpAuthSchemes$2f$aws_sdk$2f$resolveAwsSdkSigV4Config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveAwsSdkSigV4Config"])(config);
    return {
        ...config_0
    };
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/runtimeConfig.shared.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "getRuntimeConfig": (()=>getRuntimeConfig)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$url$2d$parser$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$url$2d$parser$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+url-parser@3.0.10/node_modules/@smithy/url-parser/dist-es/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$base64$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$base64$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-base64@3.0.0/node_modules/@smithy/util-base64/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$utf8$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$utf8$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-utf8@3.0.0/node_modules/@smithy/util-utf8/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$base64$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$base64$2f$dist$2d$es$2f$fromBase64$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-base64@3.0.0/node_modules/@smithy/util-base64/dist-es/fromBase64.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$base64$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$base64$2f$dist$2d$es$2f$toBase64$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-base64@3.0.0/node_modules/@smithy/util-base64/dist-es/toBase64.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$endpointResolver$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/endpoint/endpointResolver.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$auth$2f$httpAuthSchemeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/auth/httpAuthSchemeProvider.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$httpAuthSchemes$2f$aws_sdk$2f$AwsSdkSigV4Signer$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/aws_sdk/AwsSdkSigV4Signer.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$NoOpLogger$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/NoOpLogger.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$utf8$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$utf8$2f$dist$2d$es$2f$fromUtf8$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-utf8@3.0.0/node_modules/@smithy/util-utf8/dist-es/fromUtf8.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$utf8$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$utf8$2f$dist$2d$es$2f$toUtf8$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-utf8@3.0.0/node_modules/@smithy/util-utf8/dist-es/toUtf8.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
const getRuntimeConfig = (config)=>{
    return {
        apiVersion: "2023-09-30",
        base64Decoder: config?.base64Decoder ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$base64$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$base64$2f$dist$2d$es$2f$fromBase64$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromBase64"],
        base64Encoder: config?.base64Encoder ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$base64$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$base64$2f$dist$2d$es$2f$toBase64$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toBase64"],
        disableHostPrefix: config?.disableHostPrefix ?? false,
        endpointProvider: config?.endpointProvider ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$endpointResolver$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["defaultEndpointResolver"],
        extensions: config?.extensions ?? [],
        httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$auth$2f$httpAuthSchemeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["defaultBedrockRuntimeHttpAuthSchemeProvider"],
        httpAuthSchemes: config?.httpAuthSchemes ?? [
            {
                schemeId: "aws.auth#sigv4",
                identityProvider: (ipc)=>ipc.getIdentityProvider("aws.auth#sigv4"),
                signer: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$httpAuthSchemes$2f$aws_sdk$2f$AwsSdkSigV4Signer$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AwsSdkSigV4Signer"]()
            }
        ],
        logger: config?.logger ?? new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$NoOpLogger$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NoOpLogger"](),
        serviceId: config?.serviceId ?? "Bedrock Runtime",
        urlParser: config?.urlParser ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$url$2d$parser$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$url$2d$parser$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseUrl"],
        utf8Decoder: config?.utf8Decoder ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$utf8$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$utf8$2f$dist$2d$es$2f$fromUtf8$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromUtf8"],
        utf8Encoder: config?.utf8Encoder ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$utf8$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$utf8$2f$dist$2d$es$2f$toUtf8$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toUtf8"]
    };
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/runtimeConfig.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "getRuntimeConfig": (()=>getRuntimeConfig)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$package$2e$json__$28$json$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/package.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$node$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$st_wniir447b4d6bdscdohi7gdupy$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-node@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-st_wniir447b4d6bdscdohi7gdupy/node_modules/@aws-sdk/credential-provider-node/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$user$2d$agent$2d$node$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$user$2d$agent$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+util-user-agent-node@3.696.0/node_modules/@aws-sdk/util-user-agent-node/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+config-resolver@3.0.12/node_modules/@smithy/config-resolver/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$eventstream$2d$serde$2d$node$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$eventstream$2d$serde$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+eventstream-serde-node@3.0.12/node_modules/@smithy/eventstream-serde-node/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$hash$2d$node$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$hash$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+hash-node@3.0.10/node_modules/@smithy/hash-node/dist-es/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$28$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-retry@3.0.28/node_modules/@smithy/middleware-retry/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-config-provider@3.1.11/node_modules/@smithy/node-config-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$1$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-http-handler@3.3.1/node_modules/@smithy/node-http-handler/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$body$2d$length$2d$node$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$body$2d$length$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-body-length-node@3.0.0/node_modules/@smithy/util-body-length-node/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$retry$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$util$2d$retry$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-retry@3.0.10/node_modules/@smithy/util-retry/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$defaults$2d$mode$2d$node$40$3$2e$0$2e$28$2f$node_modules$2f40$smithy$2f$util$2d$defaults$2d$mode$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-defaults-mode-node@3.0.28/node_modules/@smithy/util-defaults-mode-node/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$emitWarningIfUnsupportedVersion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/emitWarningIfUnsupportedVersion.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$defaults$2d$mode$2d$node$40$3$2e$0$2e$28$2f$node_modules$2f40$smithy$2f$util$2d$defaults$2d$mode$2d$node$2f$dist$2d$es$2f$resolveDefaultsModeConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-defaults-mode-node@3.0.28/node_modules/@smithy/util-defaults-mode-node/dist-es/resolveDefaultsModeConfig.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$defaults$2d$mode$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/defaults-mode.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$runtimeConfig$2e$shared$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/runtimeConfig.shared.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$emitWarningIfUnsupportedVersion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/emitWarningIfUnsupportedVersion.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$body$2d$length$2d$node$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$body$2d$length$2d$node$2f$dist$2d$es$2f$calculateBodyLength$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-body-length-node@3.0.0/node_modules/@smithy/util-body-length-node/dist-es/calculateBodyLength.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$node$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$st_wniir447b4d6bdscdohi7gdupy$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$node$2f$dist$2d$es$2f$defaultProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-node@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-st_wniir447b4d6bdscdohi7gdupy/node_modules/@aws-sdk/credential-provider-node/dist-es/defaultProvider.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$user$2d$agent$2d$node$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$user$2d$agent$2d$node$2f$dist$2d$es$2f$defaultUserAgent$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+util-user-agent-node@3.696.0/node_modules/@aws-sdk/util-user-agent-node/dist-es/defaultUserAgent.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$eventstream$2d$serde$2d$node$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$eventstream$2d$serde$2d$node$2f$dist$2d$es$2f$provider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+eventstream-serde-node@3.0.12/node_modules/@smithy/eventstream-serde-node/dist-es/provider.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-config-provider@3.1.11/node_modules/@smithy/node-config-provider/dist-es/configLoader.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$28$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-retry@3.0.28/node_modules/@smithy/middleware-retry/dist-es/configurations.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$regionConfig$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+config-resolver@3.0.12/node_modules/@smithy/config-resolver/dist-es/regionConfig/config.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$1$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$node$2d$http$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-http-handler@3.3.1/node_modules/@smithy/node-http-handler/dist-es/node-http-handler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$retry$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$util$2d$retry$2f$dist$2d$es$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-retry@3.0.10/node_modules/@smithy/util-retry/dist-es/config.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$1$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$stream$2d$collector$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-http-handler@3.3.1/node_modules/@smithy/node-http-handler/dist-es/stream-collector/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$endpointsConfig$2f$NodeUseDualstackEndpointConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+config-resolver@3.0.12/node_modules/@smithy/config-resolver/dist-es/endpointsConfig/NodeUseDualstackEndpointConfigOptions.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$endpointsConfig$2f$NodeUseFipsEndpointConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+config-resolver@3.0.12/node_modules/@smithy/config-resolver/dist-es/endpointsConfig/NodeUseFipsEndpointConfigOptions.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$user$2d$agent$2d$node$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$user$2d$agent$2d$node$2f$dist$2d$es$2f$nodeAppIdConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+util-user-agent-node@3.696.0/node_modules/@aws-sdk/util-user-agent-node/dist-es/nodeAppIdConfigOptions.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
const getRuntimeConfig = (config)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$emitWarningIfUnsupportedVersion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["emitWarningIfUnsupportedVersion"])(process.version);
    const defaultsMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$defaults$2d$mode$2d$node$40$3$2e$0$2e$28$2f$node_modules$2f40$smithy$2f$util$2d$defaults$2d$mode$2d$node$2f$dist$2d$es$2f$resolveDefaultsModeConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveDefaultsModeConfig"])(config);
    const defaultConfigProvider = ()=>defaultsMode().then(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$defaults$2d$mode$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfigsForDefaultMode"]);
    const clientSharedValues = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$runtimeConfig$2e$shared$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getRuntimeConfig"])(config);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$emitWarningIfUnsupportedVersion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["emitWarningIfUnsupportedVersion"])(process.version);
    return {
        ...clientSharedValues,
        ...config,
        runtime: "node",
        defaultsMode,
        bodyLengthChecker: config?.bodyLengthChecker ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$body$2d$length$2d$node$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$body$2d$length$2d$node$2f$dist$2d$es$2f$calculateBodyLength$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["calculateBodyLength"],
        credentialDefaultProvider: config?.credentialDefaultProvider ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$node$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$st_wniir447b4d6bdscdohi7gdupy$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$node$2f$dist$2d$es$2f$defaultProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["defaultProvider"],
        defaultUserAgentProvider: config?.defaultUserAgentProvider ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$user$2d$agent$2d$node$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$user$2d$agent$2d$node$2f$dist$2d$es$2f$defaultUserAgent$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createDefaultUserAgentProvider"])({
            serviceId: clientSharedValues.serviceId,
            clientVersion: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$package$2e$json__$28$json$29$__["default"].version
        }),
        eventStreamSerdeProvider: config?.eventStreamSerdeProvider ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$eventstream$2d$serde$2d$node$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$eventstream$2d$serde$2d$node$2f$dist$2d$es$2f$provider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["eventStreamSerdeProvider"],
        maxAttempts: config?.maxAttempts ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$28$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_MAX_ATTEMPT_CONFIG_OPTIONS"]),
        region: config?.region ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$regionConfig$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_REGION_CONFIG_OPTIONS"], __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$regionConfig$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_REGION_CONFIG_FILE_OPTIONS"]),
        requestHandler: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$1$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$node$2d$http$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NodeHttpHandler"].create(config?.requestHandler ?? defaultConfigProvider),
        retryMode: config?.retryMode ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])({
            ...__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$28$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_RETRY_MODE_CONFIG_OPTIONS"],
            default: async ()=>(await defaultConfigProvider()).retryMode || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$retry$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$util$2d$retry$2f$dist$2d$es$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_RETRY_MODE"]
        }),
        sha256: config?.sha256 ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$hash$2d$node$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$hash$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Hash"].bind(null, "sha256"),
        streamCollector: config?.streamCollector ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$1$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$stream$2d$collector$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["streamCollector"],
        useDualstackEndpoint: config?.useDualstackEndpoint ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$endpointsConfig$2f$NodeUseDualstackEndpointConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS"]),
        useFipsEndpoint: config?.useFipsEndpoint ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$endpointsConfig$2f$NodeUseFipsEndpointConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_USE_FIPS_ENDPOINT_CONFIG_OPTIONS"]),
        userAgentAppId: config?.userAgentAppId ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$user$2d$agent$2d$node$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$user$2d$agent$2d$node$2f$dist$2d$es$2f$nodeAppIdConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_APP_ID_CONFIG_OPTIONS"])
    };
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/auth/httpAuthExtensionConfiguration.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "getHttpAuthExtensionConfiguration": (()=>getHttpAuthExtensionConfiguration),
    "resolveHttpAuthRuntimeConfig": (()=>resolveHttpAuthRuntimeConfig)
});
const getHttpAuthExtensionConfiguration = (runtimeConfig)=>{
    const _httpAuthSchemes = runtimeConfig.httpAuthSchemes;
    let _httpAuthSchemeProvider = runtimeConfig.httpAuthSchemeProvider;
    let _credentials = runtimeConfig.credentials;
    return {
        setHttpAuthScheme (httpAuthScheme) {
            const index = _httpAuthSchemes.findIndex((scheme)=>scheme.schemeId === httpAuthScheme.schemeId);
            if (index === -1) {
                _httpAuthSchemes.push(httpAuthScheme);
            } else {
                _httpAuthSchemes.splice(index, 1, httpAuthScheme);
            }
        },
        httpAuthSchemes () {
            return _httpAuthSchemes;
        },
        setHttpAuthSchemeProvider (httpAuthSchemeProvider) {
            _httpAuthSchemeProvider = httpAuthSchemeProvider;
        },
        httpAuthSchemeProvider () {
            return _httpAuthSchemeProvider;
        },
        setCredentials (credentials) {
            _credentials = credentials;
        },
        credentials () {
            return _credentials;
        }
    };
};
const resolveHttpAuthRuntimeConfig = (config)=>{
    return {
        httpAuthSchemes: config.httpAuthSchemes(),
        httpAuthSchemeProvider: config.httpAuthSchemeProvider(),
        credentials: config.credentials()
    };
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/runtimeExtensions.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "resolveRuntimeExtensions": (()=>resolveRuntimeExtensions)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$region$2d$config$2d$resolver$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$region$2d$config$2d$resolver$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+region-config-resolver@3.696.0/node_modules/@aws-sdk/region-config-resolver/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$protocol$2d$http$40$4$2e$1$2e$7$2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+protocol-http@4.1.7/node_modules/@smithy/protocol-http/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$region$2d$config$2d$resolver$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$region$2d$config$2d$resolver$2f$dist$2d$es$2f$extensions$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+region-config-resolver@3.696.0/node_modules/@aws-sdk/region-config-resolver/dist-es/extensions/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$extensions$2f$defaultExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/extensions/defaultExtensionConfiguration.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$protocol$2d$http$40$4$2e$1$2e$7$2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$extensions$2f$httpExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+protocol-http@4.1.7/node_modules/@smithy/protocol-http/dist-es/extensions/httpExtensionConfiguration.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$auth$2f$httpAuthExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/auth/httpAuthExtensionConfiguration.js [app-rsc] (ecmascript)");
;
;
;
;
const asPartial = (t)=>t;
const resolveRuntimeExtensions = (runtimeConfig, extensions)=>{
    const extensionConfiguration = {
        ...asPartial((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$region$2d$config$2d$resolver$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$region$2d$config$2d$resolver$2f$dist$2d$es$2f$extensions$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAwsRegionExtensionConfiguration"])(runtimeConfig)),
        ...asPartial((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$extensions$2f$defaultExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDefaultExtensionConfiguration"])(runtimeConfig)),
        ...asPartial((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$protocol$2d$http$40$4$2e$1$2e$7$2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$extensions$2f$httpExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getHttpHandlerExtensionConfiguration"])(runtimeConfig)),
        ...asPartial((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$auth$2f$httpAuthExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getHttpAuthExtensionConfiguration"])(runtimeConfig))
    };
    extensions.forEach((extension)=>extension.configure(extensionConfiguration));
    return {
        ...runtimeConfig,
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$region$2d$config$2d$resolver$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$region$2d$config$2d$resolver$2f$dist$2d$es$2f$extensions$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveAwsRegionExtensionConfiguration"])(extensionConfiguration),
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$extensions$2f$defaultExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveDefaultRuntimeConfig"])(extensionConfiguration),
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$protocol$2d$http$40$4$2e$1$2e$7$2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$extensions$2f$httpExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveHttpHandlerRuntimeConfig"])(extensionConfiguration),
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$auth$2f$httpAuthExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveHttpAuthRuntimeConfig"])(extensionConfiguration)
    };
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/BedrockRuntimeClient.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "BedrockRuntimeClient": (()=>BedrockRuntimeClient)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$runtimeConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/runtimeConfig.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/endpoint/EndpointParameters.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$user$2d$agent$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$user$2d$agent$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+middleware-user-agent@3.696.0/node_modules/@aws-sdk/middleware-user-agent/dist-es/configurations.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$28$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-retry@3.0.28/node_modules/@smithy/middleware-retry/dist-es/configurations.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$regionConfig$2f$resolveRegionConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+config-resolver@3.0.12/node_modules/@smithy/config-resolver/dist-es/regionConfig/resolveRegionConfig.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$host$2d$header$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$host$2d$header$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+middleware-host-header@3.696.0/node_modules/@aws-sdk/middleware-host-header/dist-es/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$4$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$resolveEndpointConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-endpoint@3.2.4/node_modules/@smithy/middleware-endpoint/dist-es/resolveEndpointConfig.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$eventstream$2d$serde$2d$config$2d$resolver$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$eventstream$2d$serde$2d$config$2d$resolver$2f$dist$2d$es$2f$EventStreamSerdeConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+eventstream-serde-config-resolver@3.0.10/node_modules/@smithy/eventstream-serde-config-resolver/dist-es/EventStreamSerdeConfig.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$auth$2f$httpAuthSchemeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/auth/httpAuthSchemeProvider.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$runtimeExtensions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-bedrock-runtime@3.699.0/node_modules/@aws-sdk/client-bedrock-runtime/dist-es/runtimeExtensions.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$user$2d$agent$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$user$2d$agent$2f$dist$2d$es$2f$user$2d$agent$2d$middleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+middleware-user-agent@3.696.0/node_modules/@aws-sdk/middleware-user-agent/dist-es/user-agent-middleware.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$28$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$retryMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-retry@3.0.28/node_modules/@smithy/middleware-retry/dist-es/retryMiddleware.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$content$2d$length$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$middleware$2d$content$2d$length$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-content-length@3.0.12/node_modules/@smithy/middleware-content-length/dist-es/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$logger$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$logger$2f$dist$2d$es$2f$loggerMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+middleware-logger@3.696.0/node_modules/@aws-sdk/middleware-logger/dist-es/loggerMiddleware.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$recursion$2d$detection$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$recursion$2d$detection$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+middleware-recursion-detection@3.696.0/node_modules/@aws-sdk/middleware-recursion-detection/dist-es/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$middleware$2d$http$2d$auth$2d$scheme$2f$getHttpAuthSchemeEndpointRuleSetPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.4/node_modules/@smithy/core/dist-es/middleware-http-auth-scheme/getHttpAuthSchemeEndpointRuleSetPlugin.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$util$2d$identity$2d$and$2d$auth$2f$DefaultIdentityProviderConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.4/node_modules/@smithy/core/dist-es/util-identity-and-auth/DefaultIdentityProviderConfig.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$middleware$2d$http$2d$signing$2f$getHttpSigningMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.4/node_modules/@smithy/core/dist-es/middleware-http-signing/getHttpSigningMiddleware.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$client$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.5/node_modules/@smithy/smithy-client/dist-es/client.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
class BedrockRuntimeClient extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$5$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$client$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Client"] {
    constructor(...[configuration]){
        const _config_0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$runtimeConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getRuntimeConfig"])(configuration || {});
        const _config_1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveClientEndpointParameters"])(_config_0);
        const _config_2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$user$2d$agent$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$user$2d$agent$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveUserAgentConfig"])(_config_1);
        const _config_3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$28$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveRetryConfig"])(_config_2);
        const _config_4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$regionConfig$2f$resolveRegionConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveRegionConfig"])(_config_3);
        const _config_5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$host$2d$header$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$host$2d$header$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveHostHeaderConfig"])(_config_4);
        const _config_6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$4$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$resolveEndpointConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveEndpointConfig"])(_config_5);
        const _config_7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$eventstream$2d$serde$2d$config$2d$resolver$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$eventstream$2d$serde$2d$config$2d$resolver$2f$dist$2d$es$2f$EventStreamSerdeConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveEventStreamSerdeConfig"])(_config_6);
        const _config_8 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$auth$2f$httpAuthSchemeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveHttpAuthSchemeConfig"])(_config_7);
        const _config_9 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$runtimeExtensions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveRuntimeExtensions"])(_config_8, configuration?.extensions || []);
        super(_config_9);
        this.config = _config_9;
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$user$2d$agent$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$user$2d$agent$2f$dist$2d$es$2f$user$2d$agent$2d$middleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getUserAgentPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$28$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$retryMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getRetryPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$content$2d$length$40$3$2e$0$2e$12$2f$node_modules$2f40$smithy$2f$middleware$2d$content$2d$length$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getContentLengthPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$host$2d$header$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$host$2d$header$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getHostHeaderPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$logger$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$logger$2f$dist$2d$es$2f$loggerMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getLoggerPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$recursion$2d$detection$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$recursion$2d$detection$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getRecursionDetectionPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$middleware$2d$http$2d$auth$2d$scheme$2f$getHttpAuthSchemeEndpointRuleSetPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getHttpAuthSchemeEndpointRuleSetPlugin"])(this.config, {
            httpAuthSchemeParametersProvider: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$bedrock$2d$runtime$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$bedrock$2d$runtime$2f$dist$2d$es$2f$auth$2f$httpAuthSchemeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["defaultBedrockRuntimeHttpAuthSchemeParametersProvider"],
            identityProviderConfigProvider: async (config)=>new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$util$2d$identity$2d$and$2d$auth$2f$DefaultIdentityProviderConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DefaultIdentityProviderConfig"]({
                    "aws.auth#sigv4": config.credentials
                })
        }));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$4$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$middleware$2d$http$2d$signing$2f$getHttpSigningMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getHttpSigningPlugin"])(this.config));
    }
    destroy() {
        super.destroy();
    }
}
}}),

};

//# sourceMappingURL=387ae_%40aws-sdk_client-bedrock-runtime_8e0e95._.js.map