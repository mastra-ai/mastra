module.exports = {

"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/loadSso.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({});
;
;
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/loadSso.js [app-rsc] (ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$loadSso$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/loadSso.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/endpoint/EndpointParameters.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
        defaultSigningName: "awsssoportal"
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
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/models/SSOServiceException.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "SSOServiceException": (()=>SSOServiceException)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/exceptions.js [app-rsc] (ecmascript)");
;
;
class SSOServiceException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ServiceException"] {
    constructor(options){
        super(options);
        Object.setPrototypeOf(this, SSOServiceException.prototype);
    }
}
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/models/models_0.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "GetRoleCredentialsRequestFilterSensitiveLog": (()=>GetRoleCredentialsRequestFilterSensitiveLog),
    "GetRoleCredentialsResponseFilterSensitiveLog": (()=>GetRoleCredentialsResponseFilterSensitiveLog),
    "InvalidRequestException": (()=>InvalidRequestException),
    "ListAccountRolesRequestFilterSensitiveLog": (()=>ListAccountRolesRequestFilterSensitiveLog),
    "ListAccountsRequestFilterSensitiveLog": (()=>ListAccountsRequestFilterSensitiveLog),
    "LogoutRequestFilterSensitiveLog": (()=>LogoutRequestFilterSensitiveLog),
    "ResourceNotFoundException": (()=>ResourceNotFoundException),
    "RoleCredentialsFilterSensitiveLog": (()=>RoleCredentialsFilterSensitiveLog),
    "TooManyRequestsException": (()=>TooManyRequestsException),
    "UnauthorizedException": (()=>UnauthorizedException)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$SSOServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/models/SSOServiceException.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/constants.js [app-rsc] (ecmascript)");
;
;
class InvalidRequestException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$SSOServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["SSOServiceException"] {
    constructor(opts){
        super({
            name: "InvalidRequestException",
            $fault: "client",
            ...opts
        });
        this.name = "InvalidRequestException";
        this.$fault = "client";
        Object.setPrototypeOf(this, InvalidRequestException.prototype);
    }
}
class ResourceNotFoundException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$SSOServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["SSOServiceException"] {
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
class TooManyRequestsException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$SSOServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["SSOServiceException"] {
    constructor(opts){
        super({
            name: "TooManyRequestsException",
            $fault: "client",
            ...opts
        });
        this.name = "TooManyRequestsException";
        this.$fault = "client";
        Object.setPrototypeOf(this, TooManyRequestsException.prototype);
    }
}
class UnauthorizedException extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$SSOServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["SSOServiceException"] {
    constructor(opts){
        super({
            name: "UnauthorizedException",
            $fault: "client",
            ...opts
        });
        this.name = "UnauthorizedException";
        this.$fault = "client";
        Object.setPrototypeOf(this, UnauthorizedException.prototype);
    }
}
const GetRoleCredentialsRequestFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.accessToken && {
            accessToken: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        }
    });
const RoleCredentialsFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.secretAccessKey && {
            secretAccessKey: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        },
        ...obj.sessionToken && {
            sessionToken: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        }
    });
const GetRoleCredentialsResponseFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.roleCredentials && {
            roleCredentials: RoleCredentialsFilterSensitiveLog(obj.roleCredentials)
        }
    });
const ListAccountRolesRequestFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.accessToken && {
            accessToken: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        }
    });
const ListAccountsRequestFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.accessToken && {
            accessToken: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        }
    });
const LogoutRequestFilterSensitiveLog = (obj)=>({
        ...obj,
        ...obj.accessToken && {
            accessToken: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SENSITIVE_STRING"]
        }
    });
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/protocols/Aws_restJson1.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "de_GetRoleCredentialsCommand": (()=>de_GetRoleCredentialsCommand),
    "de_ListAccountRolesCommand": (()=>de_ListAccountRolesCommand),
    "de_ListAccountsCommand": (()=>de_ListAccountsCommand),
    "de_LogoutCommand": (()=>de_LogoutCommand),
    "se_GetRoleCredentialsCommand": (()=>se_GetRoleCredentialsCommand),
    "se_ListAccountRolesCommand": (()=>se_ListAccountRolesCommand),
    "se_ListAccountsCommand": (()=>se_ListAccountsCommand),
    "se_LogoutCommand": (()=>se_LogoutCommand)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.5/node_modules/@smithy/core/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$requestBuilder$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.5/node_modules/@smithy/core/dist-es/submodules/protocols/requestBuilder.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/object-mapping.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$is$2d$serializable$2d$header$2d$value$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/is-serializable-header-value.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/parse-utils.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/protocols/json/parseJsonBody.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/serde-json.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$collect$2d$stream$2d$body$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.5/node_modules/@smithy/core/dist-es/submodules/protocols/collect-stream-body.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$default$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/default-error-handler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$SSOServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/models/SSOServiceException.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/models/models_0.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/exceptions.js [app-rsc] (ecmascript)");
;
;
;
;
;
const se_GetRoleCredentialsCommand = async (input, context)=>{
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$requestBuilder$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestBuilder"])(input, context);
    const headers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({}, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$is$2d$serializable$2d$header$2d$value$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSerializableHeaderValue"], {
        [_xasbt]: input[_aT]
    });
    b.bp("/federation/credentials");
    const query = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        [_rn]: [
            ,
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectNonNull"])(input[_rN], `roleName`)
        ],
        [_ai]: [
            ,
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectNonNull"])(input[_aI], `accountId`)
        ]
    });
    let body;
    b.m("GET").h(headers).q(query).b(body);
    return b.build();
};
const se_ListAccountRolesCommand = async (input, context)=>{
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$requestBuilder$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestBuilder"])(input, context);
    const headers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({}, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$is$2d$serializable$2d$header$2d$value$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSerializableHeaderValue"], {
        [_xasbt]: input[_aT]
    });
    b.bp("/assignment/roles");
    const query = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        [_nt]: [
            ,
            input[_nT]
        ],
        [_mr]: [
            ()=>input.maxResults !== void 0,
            ()=>input[_mR].toString()
        ],
        [_ai]: [
            ,
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectNonNull"])(input[_aI], `accountId`)
        ]
    });
    let body;
    b.m("GET").h(headers).q(query).b(body);
    return b.build();
};
const se_ListAccountsCommand = async (input, context)=>{
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$requestBuilder$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestBuilder"])(input, context);
    const headers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({}, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$is$2d$serializable$2d$header$2d$value$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSerializableHeaderValue"], {
        [_xasbt]: input[_aT]
    });
    b.bp("/assignment/accounts");
    const query = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        [_nt]: [
            ,
            input[_nT]
        ],
        [_mr]: [
            ()=>input.maxResults !== void 0,
            ()=>input[_mR].toString()
        ]
    });
    let body;
    b.m("GET").h(headers).q(query).b(body);
    return b.build();
};
const se_LogoutCommand = async (input, context)=>{
    const b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$requestBuilder$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requestBuilder"])(input, context);
    const headers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({}, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$is$2d$serializable$2d$header$2d$value$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSerializableHeaderValue"], {
        [_xasbt]: input[_aT]
    });
    b.bp("/logout");
    let body;
    b.m("POST").h(headers).b(body);
    return b.build();
};
const de_GetRoleCredentialsCommand = async (output, context)=>{
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        $metadata: deserializeMetadata(output)
    });
    const data = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectNonNull"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectObject"])(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context)), "body");
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        roleCredentials: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"]
    });
    Object.assign(contents, doc);
    return contents;
};
const de_ListAccountRolesCommand = async (output, context)=>{
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        $metadata: deserializeMetadata(output)
    });
    const data = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectNonNull"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectObject"])(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context)), "body");
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        nextToken: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"],
        roleList: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"]
    });
    Object.assign(contents, doc);
    return contents;
};
const de_ListAccountsCommand = async (output, context)=>{
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        $metadata: deserializeMetadata(output)
    });
    const data = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectNonNull"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectObject"])(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonBody"])(output.body, context)), "body");
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        accountList: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$serde$2d$json$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["_json"],
        nextToken: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    return contents;
};
const de_LogoutCommand = async (output, context)=>{
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({
        $metadata: deserializeMetadata(output)
    });
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$collect$2d$stream$2d$body$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collectBody"])(output.body, context);
    return contents;
};
const de_CommandError = async (output, context)=>{
    const parsedOutput = {
        ...output,
        body: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJsonErrorBody"])(output.body, context)
    };
    const errorCode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$json$2f$parseJsonBody$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadRestJsonErrorCode"])(output, parsedOutput.body);
    switch(errorCode){
        case "InvalidRequestException":
        case "com.amazonaws.sso#InvalidRequestException":
            throw await de_InvalidRequestExceptionRes(parsedOutput, context);
        case "ResourceNotFoundException":
        case "com.amazonaws.sso#ResourceNotFoundException":
            throw await de_ResourceNotFoundExceptionRes(parsedOutput, context);
        case "TooManyRequestsException":
        case "com.amazonaws.sso#TooManyRequestsException":
            throw await de_TooManyRequestsExceptionRes(parsedOutput, context);
        case "UnauthorizedException":
        case "com.amazonaws.sso#UnauthorizedException":
            throw await de_UnauthorizedExceptionRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody,
                errorCode
            });
    }
};
const throwDefaultError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$default$2d$error$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["withBaseException"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$SSOServiceException$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["SSOServiceException"]);
const de_InvalidRequestExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InvalidRequestException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_ResourceNotFoundExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ResourceNotFoundException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_TooManyRequestsExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TooManyRequestsException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const de_UnauthorizedExceptionRes = async (parsedOutput, context)=>{
    const contents = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["map"])({});
    const data = parsedOutput.body;
    const doc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$object$2d$mapping$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["take"])(data, {
        message: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$parse$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["expectString"]
    });
    Object.assign(contents, doc);
    const exception = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["UnauthorizedException"]({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$exceptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["decorateServiceException"])(exception, parsedOutput.body);
};
const deserializeMetadata = (output)=>({
        httpStatusCode: output.statusCode,
        requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
        extendedRequestId: output.headers["x-amz-id-2"],
        cfId: output.headers["x-amz-cf-id"]
    });
const collectBodyString = (streamBody, context)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$submodules$2f$protocols$2f$collect$2d$stream$2d$body$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collectBody"])(streamBody, context).then((body)=>context.utf8Encoder(body));
const _aI = "accountId";
const _aT = "accessToken";
const _ai = "account_id";
const _mR = "maxResults";
const _mr = "max_result";
const _nT = "nextToken";
const _nt = "next_token";
const _rN = "roleName";
const _rn = "role_name";
const _xasbt = "x-amz-sso_bearer_token";
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/commands/GetRoleCredentialsCommand.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "GetRoleCredentialsCommand": (()=>GetRoleCredentialsCommand)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$command$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/command.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/endpoint/EndpointParameters.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$serde$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$middleware$2d$serde$2f$dist$2d$es$2f$serdePlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-serde@3.0.11/node_modules/@smithy/middleware-serde/dist-es/serdePlugin.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$5$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$getEndpointPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-endpoint@3.2.5/node_modules/@smithy/middleware-endpoint/dist-es/getEndpointPlugin.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/models/models_0.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/protocols/Aws_restJson1.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
class GetRoleCredentialsCommand extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$command$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Command"].classBuilder().ep(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["commonParams"]).m(function(Command, cs, config, o) {
    return [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$serde$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$middleware$2d$serde$2f$dist$2d$es$2f$serdePlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSerdePlugin"])(config, this.serialize, this.deserialize),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$5$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$getEndpointPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEndpointPlugin"])(config, Command.getEndpointParameterInstructions())
    ];
}).s("SWBPortalService", "GetRoleCredentials", {}).n("SSOClient", "GetRoleCredentialsCommand").f(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["GetRoleCredentialsRequestFilterSensitiveLog"], __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$models$2f$models_0$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["GetRoleCredentialsResponseFilterSensitiveLog"]).ser(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["se_GetRoleCredentialsCommand"]).de(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$protocols$2f$Aws_restJson1$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["de_GetRoleCredentialsCommand"]).build() {
}
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/package.json (json)": ((__turbopack_context__) => {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, t: require } = __turbopack_context__;
{
__turbopack_export_value__(JSON.parse("{\"name\":\"@aws-sdk/client-sso\",\"description\":\"AWS SDK for JavaScript Sso Client for Node.js, Browser and React Native\",\"version\":\"3.696.0\",\"scripts\":{\"build\":\"concurrently 'yarn:build:cjs' 'yarn:build:es' 'yarn:build:types'\",\"build:cjs\":\"node ../../scripts/compilation/inline client-sso\",\"build:es\":\"tsc -p tsconfig.es.json\",\"build:include:deps\":\"lerna run --scope $npm_package_name --include-dependencies build\",\"build:types\":\"tsc -p tsconfig.types.json\",\"build:types:downlevel\":\"downlevel-dts dist-types dist-types/ts3.4\",\"clean\":\"rimraf ./dist-* && rimraf *.tsbuildinfo\",\"extract:docs\":\"api-extractor run --local\",\"generate:client\":\"node ../../scripts/generate-clients/single-service --solo sso\"},\"main\":\"./dist-cjs/index.js\",\"types\":\"./dist-types/index.d.ts\",\"module\":\"./dist-es/index.js\",\"sideEffects\":false,\"dependencies\":{\"@aws-crypto/sha256-browser\":\"5.2.0\",\"@aws-crypto/sha256-js\":\"5.2.0\",\"@aws-sdk/core\":\"3.696.0\",\"@aws-sdk/middleware-host-header\":\"3.696.0\",\"@aws-sdk/middleware-logger\":\"3.696.0\",\"@aws-sdk/middleware-recursion-detection\":\"3.696.0\",\"@aws-sdk/middleware-user-agent\":\"3.696.0\",\"@aws-sdk/region-config-resolver\":\"3.696.0\",\"@aws-sdk/types\":\"3.696.0\",\"@aws-sdk/util-endpoints\":\"3.696.0\",\"@aws-sdk/util-user-agent-browser\":\"3.696.0\",\"@aws-sdk/util-user-agent-node\":\"3.696.0\",\"@smithy/config-resolver\":\"^3.0.12\",\"@smithy/core\":\"^2.5.3\",\"@smithy/fetch-http-handler\":\"^4.1.1\",\"@smithy/hash-node\":\"^3.0.10\",\"@smithy/invalid-dependency\":\"^3.0.10\",\"@smithy/middleware-content-length\":\"^3.0.12\",\"@smithy/middleware-endpoint\":\"^3.2.3\",\"@smithy/middleware-retry\":\"^3.0.27\",\"@smithy/middleware-serde\":\"^3.0.10\",\"@smithy/middleware-stack\":\"^3.0.10\",\"@smithy/node-config-provider\":\"^3.1.11\",\"@smithy/node-http-handler\":\"^3.3.1\",\"@smithy/protocol-http\":\"^4.1.7\",\"@smithy/smithy-client\":\"^3.4.4\",\"@smithy/types\":\"^3.7.1\",\"@smithy/url-parser\":\"^3.0.10\",\"@smithy/util-base64\":\"^3.0.0\",\"@smithy/util-body-length-browser\":\"^3.0.0\",\"@smithy/util-body-length-node\":\"^3.0.0\",\"@smithy/util-defaults-mode-browser\":\"^3.0.27\",\"@smithy/util-defaults-mode-node\":\"^3.0.27\",\"@smithy/util-endpoints\":\"^2.1.6\",\"@smithy/util-middleware\":\"^3.0.10\",\"@smithy/util-retry\":\"^3.0.10\",\"@smithy/util-utf8\":\"^3.0.0\",\"tslib\":\"^2.6.2\"},\"devDependencies\":{\"@tsconfig/node16\":\"16.1.3\",\"@types/node\":\"^16.18.96\",\"concurrently\":\"7.0.0\",\"downlevel-dts\":\"0.10.1\",\"rimraf\":\"3.0.2\",\"typescript\":\"~4.9.5\"},\"engines\":{\"node\":\">=16.0.0\"},\"typesVersions\":{\"<4.0\":{\"dist-types/*\":[\"dist-types/ts3.4/*\"]}},\"files\":[\"dist-*/**\"],\"author\":{\"name\":\"AWS SDK for JavaScript Team\",\"url\":\"https://aws.amazon.com/javascript/\"},\"license\":\"Apache-2.0\",\"browser\":{\"./dist-es/runtimeConfig\":\"./dist-es/runtimeConfig.browser\"},\"react-native\":{\"./dist-es/runtimeConfig\":\"./dist-es/runtimeConfig.native\"},\"homepage\":\"https://github.com/aws/aws-sdk-js-v3/tree/main/clients/client-sso\",\"repository\":{\"type\":\"git\",\"url\":\"https://github.com/aws/aws-sdk-js-v3.git\",\"directory\":\"clients/client-sso\"}}"));}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/endpoint/ruleset.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "ruleSet": (()=>ruleSet)
});
const u = "required", v = "fn", w = "argv", x = "ref";
const a = true, b = "isSet", c = "booleanEquals", d = "error", e = "endpoint", f = "tree", g = "PartitionResult", h = "getAttr", i = {
    [u]: false,
    "type": "String"
}, j = {
    [u]: true,
    "default": false,
    "type": "Boolean"
}, k = {
    [x]: "Endpoint"
}, l = {
    [v]: c,
    [w]: [
        {
            [x]: "UseFIPS"
        },
        true
    ]
}, m = {
    [v]: c,
    [w]: [
        {
            [x]: "UseDualStack"
        },
        true
    ]
}, n = {}, o = {
    [v]: h,
    [w]: [
        {
            [x]: g
        },
        "supportsFIPS"
    ]
}, p = {
    [x]: g
}, q = {
    [v]: c,
    [w]: [
        true,
        {
            [v]: h,
            [w]: [
                p,
                "supportsDualStack"
            ]
        }
    ]
}, r = [
    l
], s = [
    m
], t = [
    {
        [x]: "Region"
    }
];
const _data = {
    version: "1.0",
    parameters: {
        Region: i,
        UseDualStack: j,
        UseFIPS: j,
        Endpoint: i
    },
    rules: [
        {
            conditions: [
                {
                    [v]: b,
                    [w]: [
                        k
                    ]
                }
            ],
            rules: [
                {
                    conditions: r,
                    error: "Invalid Configuration: FIPS and custom endpoint are not supported",
                    type: d
                },
                {
                    conditions: s,
                    error: "Invalid Configuration: Dualstack and custom endpoint are not supported",
                    type: d
                },
                {
                    endpoint: {
                        url: k,
                        properties: n,
                        headers: n
                    },
                    type: e
                }
            ],
            type: f
        },
        {
            conditions: [
                {
                    [v]: b,
                    [w]: t
                }
            ],
            rules: [
                {
                    conditions: [
                        {
                            [v]: "aws.partition",
                            [w]: t,
                            assign: g
                        }
                    ],
                    rules: [
                        {
                            conditions: [
                                l,
                                m
                            ],
                            rules: [
                                {
                                    conditions: [
                                        {
                                            [v]: c,
                                            [w]: [
                                                a,
                                                o
                                            ]
                                        },
                                        q
                                    ],
                                    rules: [
                                        {
                                            endpoint: {
                                                url: "https://portal.sso-fips.{Region}.{PartitionResult#dualStackDnsSuffix}",
                                                properties: n,
                                                headers: n
                                            },
                                            type: e
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
                            conditions: r,
                            rules: [
                                {
                                    conditions: [
                                        {
                                            [v]: c,
                                            [w]: [
                                                o,
                                                a
                                            ]
                                        }
                                    ],
                                    rules: [
                                        {
                                            conditions: [
                                                {
                                                    [v]: "stringEquals",
                                                    [w]: [
                                                        {
                                                            [v]: h,
                                                            [w]: [
                                                                p,
                                                                "name"
                                                            ]
                                                        },
                                                        "aws-us-gov"
                                                    ]
                                                }
                                            ],
                                            endpoint: {
                                                url: "https://portal.sso.{Region}.amazonaws.com",
                                                properties: n,
                                                headers: n
                                            },
                                            type: e
                                        },
                                        {
                                            endpoint: {
                                                url: "https://portal.sso-fips.{Region}.{PartitionResult#dnsSuffix}",
                                                properties: n,
                                                headers: n
                                            },
                                            type: e
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
                            conditions: s,
                            rules: [
                                {
                                    conditions: [
                                        q
                                    ],
                                    rules: [
                                        {
                                            endpoint: {
                                                url: "https://portal.sso.{Region}.{PartitionResult#dualStackDnsSuffix}",
                                                properties: n,
                                                headers: n
                                            },
                                            type: e
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
                            endpoint: {
                                url: "https://portal.sso.{Region}.{PartitionResult#dnsSuffix}",
                                properties: n,
                                headers: n
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
            error: "Invalid Configuration: Missing Region",
            type: d
        }
    ]
};
const ruleSet = _data;
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/endpoint/endpointResolver.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "defaultEndpointResolver": (()=>defaultEndpointResolver)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$endpoints$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$endpoints$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+util-endpoints@3.696.0/node_modules/@aws-sdk/util-endpoints/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$7$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-endpoints@2.1.7/node_modules/@smithy/util-endpoints/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$7$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$cache$2f$EndpointCache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-endpoints@2.1.7/node_modules/@smithy/util-endpoints/dist-es/cache/EndpointCache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$7$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$resolveEndpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-endpoints@2.1.7/node_modules/@smithy/util-endpoints/dist-es/resolveEndpoint.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$endpoint$2f$ruleset$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/endpoint/ruleset.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$7$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$utils$2f$customEndpointFunctions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-endpoints@2.1.7/node_modules/@smithy/util-endpoints/dist-es/utils/customEndpointFunctions.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$endpoints$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$endpoints$2f$dist$2d$es$2f$aws$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+util-endpoints@3.696.0/node_modules/@aws-sdk/util-endpoints/dist-es/aws.js [app-rsc] (ecmascript)");
;
;
;
const cache = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$7$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$cache$2f$EndpointCache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["EndpointCache"]({
    size: 50,
    params: [
        "Endpoint",
        "Region",
        "UseDualStack",
        "UseFIPS"
    ]
});
const defaultEndpointResolver = (endpointParams, context = {})=>{
    return cache.get(endpointParams, ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$7$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$resolveEndpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveEndpoint"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$endpoint$2f$ruleset$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ruleSet"], {
            endpointParams: endpointParams,
            logger: context.logger
        }));
};
__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$endpoints$40$2$2e$1$2e$7$2f$node_modules$2f40$smithy$2f$util$2d$endpoints$2f$dist$2d$es$2f$utils$2f$customEndpointFunctions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["customEndpointFunctions"].aws = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$endpoints$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$endpoints$2f$dist$2d$es$2f$aws$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["awsEndpointFunctions"];
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/auth/httpAuthSchemeProvider.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "defaultSSOHttpAuthSchemeParametersProvider": (()=>defaultSSOHttpAuthSchemeParametersProvider),
    "defaultSSOHttpAuthSchemeProvider": (()=>defaultSSOHttpAuthSchemeProvider),
    "resolveHttpAuthSchemeConfig": (()=>resolveHttpAuthSchemeConfig)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$middleware$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$util$2d$middleware$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-middleware@3.0.11/node_modules/@smithy/util-middleware/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$httpAuthSchemes$2f$aws_sdk$2f$resolveAwsSdkSigV4Config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/aws_sdk/resolveAwsSdkSigV4Config.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$middleware$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$util$2d$middleware$2f$dist$2d$es$2f$getSmithyContext$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-middleware@3.0.11/node_modules/@smithy/util-middleware/dist-es/getSmithyContext.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$middleware$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$util$2d$middleware$2f$dist$2d$es$2f$normalizeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-middleware@3.0.11/node_modules/@smithy/util-middleware/dist-es/normalizeProvider.js [app-rsc] (ecmascript)");
;
;
const defaultSSOHttpAuthSchemeParametersProvider = async (config, context, input)=>{
    return {
        operation: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$middleware$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$util$2d$middleware$2f$dist$2d$es$2f$getSmithyContext$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSmithyContext"])(context).operation,
        region: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$middleware$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$util$2d$middleware$2f$dist$2d$es$2f$normalizeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["normalizeProvider"])(config.region)() || (()=>{
            throw new Error("expected `region` to be configured for `aws.auth#sigv4`");
        })()
    };
};
function createAwsAuthSigv4HttpAuthOption(authParameters) {
    return {
        schemeId: "aws.auth#sigv4",
        signingProperties: {
            name: "awsssoportal",
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
function createSmithyApiNoAuthHttpAuthOption(authParameters) {
    return {
        schemeId: "smithy.api#noAuth"
    };
}
const defaultSSOHttpAuthSchemeProvider = (authParameters)=>{
    const options = [];
    switch(authParameters.operation){
        case "GetRoleCredentials":
            {
                options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
                break;
            }
        case "ListAccountRoles":
            {
                options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
                break;
            }
        case "ListAccounts":
            {
                options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
                break;
            }
        case "Logout":
            {
                options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
                break;
            }
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
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/runtimeConfig.shared.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "getRuntimeConfig": (()=>getRuntimeConfig)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.5/node_modules/@smithy/core/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$url$2d$parser$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$url$2d$parser$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+url-parser@3.0.11/node_modules/@smithy/url-parser/dist-es/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$base64$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$base64$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-base64@3.0.0/node_modules/@smithy/util-base64/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$utf8$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$utf8$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-utf8@3.0.0/node_modules/@smithy/util-utf8/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$base64$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$base64$2f$dist$2d$es$2f$fromBase64$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-base64@3.0.0/node_modules/@smithy/util-base64/dist-es/fromBase64.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$base64$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$base64$2f$dist$2d$es$2f$toBase64$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-base64@3.0.0/node_modules/@smithy/util-base64/dist-es/toBase64.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$endpoint$2f$endpointResolver$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/endpoint/endpointResolver.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$auth$2f$httpAuthSchemeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/auth/httpAuthSchemeProvider.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$httpAuthSchemes$2f$aws_sdk$2f$AwsSdkSigV4Signer$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/aws_sdk/AwsSdkSigV4Signer.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$util$2d$identity$2d$and$2d$auth$2f$httpAuthSchemes$2f$noAuth$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.5/node_modules/@smithy/core/dist-es/util-identity-and-auth/httpAuthSchemes/noAuth.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$NoOpLogger$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/NoOpLogger.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$utf8$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$utf8$2f$dist$2d$es$2f$fromUtf8$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-utf8@3.0.0/node_modules/@smithy/util-utf8/dist-es/fromUtf8.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$utf8$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$utf8$2f$dist$2d$es$2f$toUtf8$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-utf8@3.0.0/node_modules/@smithy/util-utf8/dist-es/toUtf8.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
const getRuntimeConfig = (config)=>{
    return {
        apiVersion: "2019-06-10",
        base64Decoder: config?.base64Decoder ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$base64$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$base64$2f$dist$2d$es$2f$fromBase64$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromBase64"],
        base64Encoder: config?.base64Encoder ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$base64$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$base64$2f$dist$2d$es$2f$toBase64$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toBase64"],
        disableHostPrefix: config?.disableHostPrefix ?? false,
        endpointProvider: config?.endpointProvider ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$endpoint$2f$endpointResolver$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["defaultEndpointResolver"],
        extensions: config?.extensions ?? [],
        httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$auth$2f$httpAuthSchemeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["defaultSSOHttpAuthSchemeProvider"],
        httpAuthSchemes: config?.httpAuthSchemes ?? [
            {
                schemeId: "aws.auth#sigv4",
                identityProvider: (ipc)=>ipc.getIdentityProvider("aws.auth#sigv4"),
                signer: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$httpAuthSchemes$2f$aws_sdk$2f$AwsSdkSigV4Signer$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AwsSdkSigV4Signer"]()
            },
            {
                schemeId: "smithy.api#noAuth",
                identityProvider: (ipc)=>ipc.getIdentityProvider("smithy.api#noAuth") || (async ()=>({})),
                signer: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$util$2d$identity$2d$and$2d$auth$2f$httpAuthSchemes$2f$noAuth$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NoAuthSigner"]()
            }
        ],
        logger: config?.logger ?? new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$NoOpLogger$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NoOpLogger"](),
        serviceId: config?.serviceId ?? "SSO",
        urlParser: config?.urlParser ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$url$2d$parser$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$url$2d$parser$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseUrl"],
        utf8Decoder: config?.utf8Decoder ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$utf8$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$utf8$2f$dist$2d$es$2f$fromUtf8$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromUtf8"],
        utf8Encoder: config?.utf8Encoder ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$utf8$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$utf8$2f$dist$2d$es$2f$toUtf8$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["toUtf8"]
    };
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/runtimeConfig.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "getRuntimeConfig": (()=>getRuntimeConfig)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$package$2e$json__$28$json$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/package.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$user$2d$agent$2d$node$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$user$2d$agent$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+util-user-agent-node@3.696.0/node_modules/@aws-sdk/util-user-agent-node/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+config-resolver@3.0.13/node_modules/@smithy/config-resolver/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$hash$2d$node$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$hash$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+hash-node@3.0.11/node_modules/@smithy/hash-node/dist-es/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$29$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-retry@3.0.29/node_modules/@smithy/middleware-retry/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-config-provider@3.1.12/node_modules/@smithy/node-config-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$2$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-http-handler@3.3.2/node_modules/@smithy/node-http-handler/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$body$2d$length$2d$node$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$body$2d$length$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-body-length-node@3.0.0/node_modules/@smithy/util-body-length-node/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$retry$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$util$2d$retry$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-retry@3.0.11/node_modules/@smithy/util-retry/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$defaults$2d$mode$2d$node$40$3$2e$0$2e$29$2f$node_modules$2f40$smithy$2f$util$2d$defaults$2d$mode$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-defaults-mode-node@3.0.29/node_modules/@smithy/util-defaults-mode-node/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$emitWarningIfUnsupportedVersion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/emitWarningIfUnsupportedVersion.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$defaults$2d$mode$2d$node$40$3$2e$0$2e$29$2f$node_modules$2f40$smithy$2f$util$2d$defaults$2d$mode$2d$node$2f$dist$2d$es$2f$resolveDefaultsModeConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-defaults-mode-node@3.0.29/node_modules/@smithy/util-defaults-mode-node/dist-es/resolveDefaultsModeConfig.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$defaults$2d$mode$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/defaults-mode.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$runtimeConfig$2e$shared$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/runtimeConfig.shared.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$emitWarningIfUnsupportedVersion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/emitWarningIfUnsupportedVersion.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$body$2d$length$2d$node$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$body$2d$length$2d$node$2f$dist$2d$es$2f$calculateBodyLength$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-body-length-node@3.0.0/node_modules/@smithy/util-body-length-node/dist-es/calculateBodyLength.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$user$2d$agent$2d$node$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$user$2d$agent$2d$node$2f$dist$2d$es$2f$defaultUserAgent$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+util-user-agent-node@3.696.0/node_modules/@aws-sdk/util-user-agent-node/dist-es/defaultUserAgent.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-config-provider@3.1.12/node_modules/@smithy/node-config-provider/dist-es/configLoader.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$29$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-retry@3.0.29/node_modules/@smithy/middleware-retry/dist-es/configurations.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$regionConfig$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+config-resolver@3.0.13/node_modules/@smithy/config-resolver/dist-es/regionConfig/config.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$2$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$node$2d$http$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-http-handler@3.3.2/node_modules/@smithy/node-http-handler/dist-es/node-http-handler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$retry$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$util$2d$retry$2f$dist$2d$es$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-retry@3.0.11/node_modules/@smithy/util-retry/dist-es/config.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$2$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$stream$2d$collector$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-http-handler@3.3.2/node_modules/@smithy/node-http-handler/dist-es/stream-collector/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$endpointsConfig$2f$NodeUseDualstackEndpointConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+config-resolver@3.0.13/node_modules/@smithy/config-resolver/dist-es/endpointsConfig/NodeUseDualstackEndpointConfigOptions.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$endpointsConfig$2f$NodeUseFipsEndpointConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+config-resolver@3.0.13/node_modules/@smithy/config-resolver/dist-es/endpointsConfig/NodeUseFipsEndpointConfigOptions.js [app-rsc] (ecmascript)");
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
const getRuntimeConfig = (config)=>{
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$emitWarningIfUnsupportedVersion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["emitWarningIfUnsupportedVersion"])(process.version);
    const defaultsMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$defaults$2d$mode$2d$node$40$3$2e$0$2e$29$2f$node_modules$2f40$smithy$2f$util$2d$defaults$2d$mode$2d$node$2f$dist$2d$es$2f$resolveDefaultsModeConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveDefaultsModeConfig"])(config);
    const defaultConfigProvider = ()=>defaultsMode().then(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$defaults$2d$mode$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfigsForDefaultMode"]);
    const clientSharedValues = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$runtimeConfig$2e$shared$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getRuntimeConfig"])(config);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$emitWarningIfUnsupportedVersion$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["emitWarningIfUnsupportedVersion"])(process.version);
    return {
        ...clientSharedValues,
        ...config,
        runtime: "node",
        defaultsMode,
        bodyLengthChecker: config?.bodyLengthChecker ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$body$2d$length$2d$node$40$3$2e$0$2e$0$2f$node_modules$2f40$smithy$2f$util$2d$body$2d$length$2d$node$2f$dist$2d$es$2f$calculateBodyLength$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["calculateBodyLength"],
        defaultUserAgentProvider: config?.defaultUserAgentProvider ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$user$2d$agent$2d$node$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$user$2d$agent$2d$node$2f$dist$2d$es$2f$defaultUserAgent$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createDefaultUserAgentProvider"])({
            serviceId: clientSharedValues.serviceId,
            clientVersion: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$package$2e$json__$28$json$29$__["default"].version
        }),
        maxAttempts: config?.maxAttempts ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$29$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_MAX_ATTEMPT_CONFIG_OPTIONS"]),
        region: config?.region ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$regionConfig$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_REGION_CONFIG_OPTIONS"], __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$regionConfig$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_REGION_CONFIG_FILE_OPTIONS"]),
        requestHandler: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$2$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$node$2d$http$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NodeHttpHandler"].create(config?.requestHandler ?? defaultConfigProvider),
        retryMode: config?.retryMode ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])({
            ...__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$29$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_RETRY_MODE_CONFIG_OPTIONS"],
            default: async ()=>(await defaultConfigProvider()).retryMode || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$retry$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$util$2d$retry$2f$dist$2d$es$2f$config$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_RETRY_MODE"]
        }),
        sha256: config?.sha256 ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$hash$2d$node$40$3$2e$0$2e$11$2f$node_modules$2f40$smithy$2f$hash$2d$node$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Hash"].bind(null, "sha256"),
        streamCollector: config?.streamCollector ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$2$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$stream$2d$collector$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["streamCollector"],
        useDualstackEndpoint: config?.useDualstackEndpoint ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$endpointsConfig$2f$NodeUseDualstackEndpointConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS"]),
        useFipsEndpoint: config?.useFipsEndpoint ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$endpointsConfig$2f$NodeUseFipsEndpointConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_USE_FIPS_ENDPOINT_CONFIG_OPTIONS"]),
        userAgentAppId: config?.userAgentAppId ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$util$2d$user$2d$agent$2d$node$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$util$2d$user$2d$agent$2d$node$2f$dist$2d$es$2f$nodeAppIdConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NODE_APP_ID_CONFIG_OPTIONS"])
    };
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/auth/httpAuthExtensionConfiguration.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
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
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/runtimeExtensions.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "resolveRuntimeExtensions": (()=>resolveRuntimeExtensions)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$region$2d$config$2d$resolver$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$region$2d$config$2d$resolver$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+region-config-resolver@3.696.0/node_modules/@aws-sdk/region-config-resolver/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$protocol$2d$http$40$4$2e$1$2e$8$2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+protocol-http@4.1.8/node_modules/@smithy/protocol-http/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$region$2d$config$2d$resolver$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$region$2d$config$2d$resolver$2f$dist$2d$es$2f$extensions$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+region-config-resolver@3.696.0/node_modules/@aws-sdk/region-config-resolver/dist-es/extensions/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$extensions$2f$defaultExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/extensions/defaultExtensionConfiguration.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$protocol$2d$http$40$4$2e$1$2e$8$2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$extensions$2f$httpExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+protocol-http@4.1.8/node_modules/@smithy/protocol-http/dist-es/extensions/httpExtensionConfiguration.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$auth$2f$httpAuthExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/auth/httpAuthExtensionConfiguration.js [app-rsc] (ecmascript)");
;
;
;
;
const asPartial = (t)=>t;
const resolveRuntimeExtensions = (runtimeConfig, extensions)=>{
    const extensionConfiguration = {
        ...asPartial((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$region$2d$config$2d$resolver$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$region$2d$config$2d$resolver$2f$dist$2d$es$2f$extensions$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAwsRegionExtensionConfiguration"])(runtimeConfig)),
        ...asPartial((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$extensions$2f$defaultExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDefaultExtensionConfiguration"])(runtimeConfig)),
        ...asPartial((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$protocol$2d$http$40$4$2e$1$2e$8$2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$extensions$2f$httpExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getHttpHandlerExtensionConfiguration"])(runtimeConfig)),
        ...asPartial((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$auth$2f$httpAuthExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getHttpAuthExtensionConfiguration"])(runtimeConfig))
    };
    extensions.forEach((extension)=>extension.configure(extensionConfiguration));
    return {
        ...runtimeConfig,
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$region$2d$config$2d$resolver$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$region$2d$config$2d$resolver$2f$dist$2d$es$2f$extensions$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveAwsRegionExtensionConfiguration"])(extensionConfiguration),
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$extensions$2f$defaultExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveDefaultRuntimeConfig"])(extensionConfiguration),
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$protocol$2d$http$40$4$2e$1$2e$8$2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$extensions$2f$httpExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveHttpHandlerRuntimeConfig"])(extensionConfiguration),
        ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$auth$2f$httpAuthExtensionConfiguration$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveHttpAuthRuntimeConfig"])(extensionConfiguration)
    };
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/SSOClient.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "SSOClient": (()=>SSOClient)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$runtimeConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/runtimeConfig.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/endpoint/EndpointParameters.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$user$2d$agent$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$user$2d$agent$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+middleware-user-agent@3.696.0/node_modules/@aws-sdk/middleware-user-agent/dist-es/configurations.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$29$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-retry@3.0.29/node_modules/@smithy/middleware-retry/dist-es/configurations.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$regionConfig$2f$resolveRegionConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+config-resolver@3.0.13/node_modules/@smithy/config-resolver/dist-es/regionConfig/resolveRegionConfig.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$host$2d$header$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$host$2d$header$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+middleware-host-header@3.696.0/node_modules/@aws-sdk/middleware-host-header/dist-es/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$5$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$resolveEndpointConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-endpoint@3.2.5/node_modules/@smithy/middleware-endpoint/dist-es/resolveEndpointConfig.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$auth$2f$httpAuthSchemeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/auth/httpAuthSchemeProvider.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$runtimeExtensions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/runtimeExtensions.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$user$2d$agent$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$user$2d$agent$2f$dist$2d$es$2f$user$2d$agent$2d$middleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+middleware-user-agent@3.696.0/node_modules/@aws-sdk/middleware-user-agent/dist-es/user-agent-middleware.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$29$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$retryMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-retry@3.0.29/node_modules/@smithy/middleware-retry/dist-es/retryMiddleware.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$content$2d$length$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$middleware$2d$content$2d$length$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+middleware-content-length@3.0.13/node_modules/@smithy/middleware-content-length/dist-es/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$logger$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$logger$2f$dist$2d$es$2f$loggerMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+middleware-logger@3.696.0/node_modules/@aws-sdk/middleware-logger/dist-es/loggerMiddleware.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$recursion$2d$detection$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$recursion$2d$detection$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+middleware-recursion-detection@3.696.0/node_modules/@aws-sdk/middleware-recursion-detection/dist-es/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$middleware$2d$http$2d$auth$2d$scheme$2f$getHttpAuthSchemeEndpointRuleSetPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.5/node_modules/@smithy/core/dist-es/middleware-http-auth-scheme/getHttpAuthSchemeEndpointRuleSetPlugin.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$util$2d$identity$2d$and$2d$auth$2f$DefaultIdentityProviderConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.5/node_modules/@smithy/core/dist-es/util-identity-and-auth/DefaultIdentityProviderConfig.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$middleware$2d$http$2d$signing$2f$getHttpSigningMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+core@2.5.5/node_modules/@smithy/core/dist-es/middleware-http-signing/getHttpSigningMiddleware.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$client$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/client.js [app-rsc] (ecmascript)");
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
class SSOClient extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$client$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Client"] {
    constructor(...[configuration]){
        const _config_0 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$runtimeConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getRuntimeConfig"])(configuration || {});
        const _config_1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$endpoint$2f$EndpointParameters$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveClientEndpointParameters"])(_config_0);
        const _config_2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$user$2d$agent$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$user$2d$agent$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveUserAgentConfig"])(_config_1);
        const _config_3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$29$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$configurations$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveRetryConfig"])(_config_2);
        const _config_4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$config$2d$resolver$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$config$2d$resolver$2f$dist$2d$es$2f$regionConfig$2f$resolveRegionConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveRegionConfig"])(_config_3);
        const _config_5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$host$2d$header$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$host$2d$header$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveHostHeaderConfig"])(_config_4);
        const _config_6 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$endpoint$40$3$2e$2$2e$5$2f$node_modules$2f40$smithy$2f$middleware$2d$endpoint$2f$dist$2d$es$2f$resolveEndpointConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveEndpointConfig"])(_config_5);
        const _config_7 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$auth$2f$httpAuthSchemeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveHttpAuthSchemeConfig"])(_config_6);
        const _config_8 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$runtimeExtensions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveRuntimeExtensions"])(_config_7, configuration?.extensions || []);
        super(_config_8);
        this.config = _config_8;
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$user$2d$agent$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$user$2d$agent$2f$dist$2d$es$2f$user$2d$agent$2d$middleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getUserAgentPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$retry$40$3$2e$0$2e$29$2f$node_modules$2f40$smithy$2f$middleware$2d$retry$2f$dist$2d$es$2f$retryMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getRetryPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$middleware$2d$content$2d$length$40$3$2e$0$2e$13$2f$node_modules$2f40$smithy$2f$middleware$2d$content$2d$length$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getContentLengthPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$host$2d$header$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$host$2d$header$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getHostHeaderPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$logger$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$logger$2f$dist$2d$es$2f$loggerMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getLoggerPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$middleware$2d$recursion$2d$detection$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$middleware$2d$recursion$2d$detection$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getRecursionDetectionPlugin"])(this.config));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$middleware$2d$http$2d$auth$2d$scheme$2f$getHttpAuthSchemeEndpointRuleSetPlugin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getHttpAuthSchemeEndpointRuleSetPlugin"])(this.config, {
            httpAuthSchemeParametersProvider: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$auth$2f$httpAuthSchemeProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["defaultSSOHttpAuthSchemeParametersProvider"],
            identityProviderConfigProvider: async (config)=>new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$util$2d$identity$2d$and$2d$auth$2f$DefaultIdentityProviderConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DefaultIdentityProviderConfig"]({
                    "aws.auth#sigv4": config.credentials
                })
        }));
        this.middlewareStack.use((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$core$40$2$2e$5$2e$5$2f$node_modules$2f40$smithy$2f$core$2f$dist$2d$es$2f$middleware$2d$http$2d$signing$2f$getHttpSigningMiddleware$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getHttpSigningPlugin"])(this.config));
    }
    destroy() {
        super.destroy();
    }
}
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/loadSso.js [app-rsc] (ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "GetRoleCredentialsCommand": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$commands$2f$GetRoleCredentialsCommand$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["GetRoleCredentialsCommand"]),
    "SSOClient": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$SSOClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["SSOClient"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$commands$2f$GetRoleCredentialsCommand$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/commands/GetRoleCredentialsCommand.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$client$2d$sso$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sso$2f$dist$2d$es$2f$SSOClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+client-sso@3.696.0/node_modules/@aws-sdk/client-sso/dist-es/SSOClient.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$loadSso$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/loadSso.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/loadSso.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "GetRoleCredentialsCommand": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$loadSso$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["GetRoleCredentialsCommand"]),
    "SSOClient": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$loadSso$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["SSOClient"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$loadSso$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/loadSso.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$loadSso$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/loadSso.js [app-rsc] (ecmascript) <exports>");
}}),

};

//# sourceMappingURL=08b5e__pnpm_50bbad._.js.map