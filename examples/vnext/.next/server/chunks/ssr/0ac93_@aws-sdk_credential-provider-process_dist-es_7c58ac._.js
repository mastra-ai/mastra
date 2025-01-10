module.exports = {

"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/getValidatedProcessCredentials.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "getValidatedProcessCredentials": (()=>getValidatedProcessCredentials)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-rsc] (ecmascript)");
;
const getValidatedProcessCredentials = (profileName, data, profiles)=>{
    if (data.Version !== 1) {
        throw Error(`Profile ${profileName} credential_process did not return Version 1.`);
    }
    if (data.AccessKeyId === undefined || data.SecretAccessKey === undefined) {
        throw Error(`Profile ${profileName} credential_process returned invalid credentials.`);
    }
    if (data.Expiration) {
        const currentTime = new Date();
        const expireTime = new Date(data.Expiration);
        if (expireTime < currentTime) {
            throw Error(`Profile ${profileName} credential_process returned expired credentials.`);
        }
    }
    let accountId = data.AccountId;
    if (!accountId && profiles?.[profileName]?.aws_account_id) {
        accountId = profiles[profileName].aws_account_id;
    }
    const credentials = {
        accessKeyId: data.AccessKeyId,
        secretAccessKey: data.SecretAccessKey,
        ...data.SessionToken && {
            sessionToken: data.SessionToken
        },
        ...data.Expiration && {
            expiration: new Date(data.Expiration)
        },
        ...data.CredentialScope && {
            credentialScope: data.CredentialScope
        },
        ...accountId && {
            accountId
        }
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(credentials, "CREDENTIALS_PROCESS", "w");
    return credentials;
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/resolveProcessCredentials.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "resolveProcessCredentials": (()=>resolveProcessCredentials)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$child_process$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (child_process, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$util$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (util, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$getValidatedProcessCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/getValidatedProcessCredentials.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
;
;
;
;
const resolveProcessCredentials = async (profileName, profiles, logger)=>{
    const profile = profiles[profileName];
    if (profiles[profileName]) {
        const credentialProcess = profile["credential_process"];
        if (credentialProcess !== undefined) {
            const execPromise = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$util$2c$__cjs$29$__["promisify"])(__TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$child_process$2c$__cjs$29$__["exec"]);
            try {
                const { stdout } = await execPromise(credentialProcess);
                let data;
                try {
                    data = JSON.parse(stdout.trim());
                } catch  {
                    throw Error(`Profile ${profileName} credential_process returned invalid JSON.`);
                }
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$getValidatedProcessCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getValidatedProcessCredentials"])(profileName, data, profiles);
            } catch (error) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](error.message, {
                    logger
                });
            }
        } else {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Profile ${profileName} did not contain credential_process.`, {
                logger
            });
        }
    } else {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Profile ${profileName} could not be found in shared credentials file.`, {
            logger
        });
    }
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/fromProcess.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromProcess": (()=>fromProcess)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$resolveProcessCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/resolveProcessCredentials.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/parseKnownFiles.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/getProfileName.js [app-rsc] (ecmascript)");
;
;
const fromProcess = (init = {})=>async ()=>{
        init.logger?.debug("@aws-sdk/credential-provider-process - fromProcess");
        const profiles = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseKnownFiles"])(init);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$resolveProcessCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveProcessCredentials"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getProfileName"])(init), profiles, init.logger);
    };
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/index.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({});
;
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$fromProcess$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/fromProcess.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/index.js [app-rsc] (ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromProcess": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$fromProcess$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromProcess"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$fromProcess$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/fromProcess.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/index.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromProcess": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["fromProcess"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$process$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$process$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/index.js [app-rsc] (ecmascript) <exports>");
}}),

};

//# sourceMappingURL=0ac93_%40aws-sdk_credential-provider-process_dist-es_7c58ac._.js.map