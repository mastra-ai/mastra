module.exports = {

"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/fromWebToken.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromWebToken": (()=>fromWebToken)
});
const fromWebToken = (init)=>async ()=>{
        init.logger?.debug("@aws-sdk/credential-provider-web-identity - fromWebToken");
        const { roleArn, roleSessionName, webIdentityToken, providerId, policyArns, policy, durationSeconds } = init;
        let { roleAssumerWithWebIdentity } = init;
        if (!roleAssumerWithWebIdentity) {
            const { getDefaultRoleAssumerWithWebIdentity } = await __turbopack_require__("[project]/node_modules/.pnpm/@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/client-sts/dist-es/index.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__);
            roleAssumerWithWebIdentity = getDefaultRoleAssumerWithWebIdentity({
                ...init.clientConfig,
                credentialProviderLogger: init.logger,
                parentClientConfig: init.parentClientConfig
            }, init.clientPlugins);
        }
        return roleAssumerWithWebIdentity({
            RoleArn: roleArn,
            RoleSessionName: roleSessionName ?? `aws-sdk-js-session-${Date.now()}`,
            WebIdentityToken: webIdentityToken,
            ProviderId: providerId,
            PolicyArns: policyArns,
            Policy: policy,
            DurationSeconds: durationSeconds
        });
    };
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/fromTokenFile.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromTokenFile": (()=>fromTokenFile)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$fromWebToken$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/fromWebToken.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-rsc] (ecmascript)");
;
;
;
;
const ENV_TOKEN_FILE = "AWS_WEB_IDENTITY_TOKEN_FILE";
const ENV_ROLE_ARN = "AWS_ROLE_ARN";
const ENV_ROLE_SESSION_NAME = "AWS_ROLE_SESSION_NAME";
const fromTokenFile = (init = {})=>async ()=>{
        init.logger?.debug("@aws-sdk/credential-provider-web-identity - fromTokenFile");
        const webIdentityTokenFile = init?.webIdentityTokenFile ?? process.env[ENV_TOKEN_FILE];
        const roleArn = init?.roleArn ?? process.env[ENV_ROLE_ARN];
        const roleSessionName = init?.roleSessionName ?? process.env[ENV_ROLE_SESSION_NAME];
        if (!webIdentityTokenFile || !roleArn) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"]("Web identity configuration not specified", {
                logger: init.logger
            });
        }
        const credentials = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$fromWebToken$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromWebToken"])({
            ...init,
            webIdentityToken: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$fs$2c$__cjs$29$__["readFileSync"])(webIdentityTokenFile, {
                encoding: "ascii"
            }),
            roleArn,
            roleSessionName
        })();
        if (webIdentityTokenFile === process.env[ENV_TOKEN_FILE]) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(credentials, "CREDENTIALS_ENV_VARS_STS_WEB_ID_TOKEN", "h");
        }
        return credentials;
    };
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/index.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({});
;
;
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$fromTokenFile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/fromTokenFile.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$fromWebToken$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/fromWebToken.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/index.js [app-rsc] (ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromTokenFile": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$fromTokenFile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromTokenFile"]),
    "fromWebToken": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$fromWebToken$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromWebToken"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$fromTokenFile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/fromTokenFile.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$fromWebToken$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/fromWebToken.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/index.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromTokenFile": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["fromTokenFile"]),
    "fromWebToken": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["fromWebToken"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$web$2d$identity$40$3$2e$696$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$web$2d$identity$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/index.js [app-rsc] (ecmascript) <exports>");
}}),

};

//# sourceMappingURL=19109_%40aws-sdk_credential-provider-web-identity_dist-es_657cd5._.js.map