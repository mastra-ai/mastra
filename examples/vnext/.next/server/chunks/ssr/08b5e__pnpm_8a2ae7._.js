module.exports = {

"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/isSsoProfile.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "isSsoProfile": (()=>isSsoProfile)
});
const isSsoProfile = (arg)=>arg && (typeof arg.sso_start_url === "string" || typeof arg.sso_account_id === "string" || typeof arg.sso_session === "string" || typeof arg.sso_region === "string" || typeof arg.sso_role_name === "string");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/constants.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "EXPIRE_WINDOW_MS": (()=>EXPIRE_WINDOW_MS),
    "REFRESH_MESSAGE": (()=>REFRESH_MESSAGE)
});
const EXPIRE_WINDOW_MS = 5 * 60 * 1000;
const REFRESH_MESSAGE = `To refresh this SSO session run 'aws sso login' with the corresponding profile.`;
}}),
"[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/validateTokenKey.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "validateTokenKey": (()=>validateTokenKey)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/TokenProviderError.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/constants.js [app-rsc] (ecmascript)");
;
;
const validateTokenKey = (key, value, forRefresh = false)=>{
    if (typeof value === "undefined") {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TokenProviderError"](`Value not present for '${key}' in SSO Token${forRefresh ? ". Cannot refresh" : ""}. ${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["REFRESH_MESSAGE"]}`, false);
    }
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/validateTokenExpiry.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "validateTokenExpiry": (()=>validateTokenExpiry)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/TokenProviderError.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/constants.js [app-rsc] (ecmascript)");
;
;
const validateTokenExpiry = (token)=>{
    if (token.expiration && token.expiration.getTime() < Date.now()) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TokenProviderError"](`Token is expired. ${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["REFRESH_MESSAGE"]}`, false);
    }
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/getSsoOidcClient.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "getSsoOidcClient": (()=>getSsoOidcClient)
});
const getSsoOidcClient = async (ssoRegion, init = {})=>{
    const { SSOOIDCClient } = await __turbopack_require__("[project]/node_modules/.pnpm/@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/client-sso-oidc/dist-es/index.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__);
    const ssoOidcClient = new SSOOIDCClient(Object.assign({}, init.clientConfig ?? {}, {
        region: ssoRegion ?? init.clientConfig?.region,
        logger: init.clientConfig?.logger ?? init.parentClientConfig?.logger
    }));
    return ssoOidcClient;
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/getNewSsoOidcToken.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "getNewSsoOidcToken": (()=>getNewSsoOidcToken)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$getSsoOidcClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/getSsoOidcClient.js [app-rsc] (ecmascript)");
;
const getNewSsoOidcToken = async (ssoToken, ssoRegion, init = {})=>{
    const { CreateTokenCommand } = await __turbopack_require__("[project]/node_modules/.pnpm/@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/client-sso-oidc/dist-es/index.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__);
    const ssoOidcClient = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$getSsoOidcClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSsoOidcClient"])(ssoRegion, init);
    return ssoOidcClient.send(new CreateTokenCommand({
        clientId: ssoToken.clientId,
        clientSecret: ssoToken.clientSecret,
        refreshToken: ssoToken.refreshToken,
        grantType: "refresh_token"
    }));
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/writeSSOTokenToFile.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "writeSSOTokenToFile": (()=>writeSSOTokenToFile)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFilepath$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/getSSOTokenFilepath.js [app-rsc] (ecmascript)");
;
;
const { writeFile } = __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"];
const writeSSOTokenToFile = (id, ssoToken)=>{
    const tokenFilepath = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFilepath$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSSOTokenFilepath"])(id);
    const tokenString = JSON.stringify(ssoToken, null, 2);
    return writeFile(tokenFilepath, tokenString);
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/fromSso.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromSso": (()=>fromSso)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/parseKnownFiles.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/getProfileName.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/TokenProviderError.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$loadSsoSessionData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/loadSsoSessionData.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFromFile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/getSSOTokenFromFile.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/constants.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/validateTokenKey.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenExpiry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/validateTokenExpiry.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$getNewSsoOidcToken$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/getNewSsoOidcToken.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$writeSSOTokenToFile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/writeSSOTokenToFile.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
const lastRefreshAttemptTime = new Date(0);
const fromSso = (init = {})=>async ()=>{
        init.logger?.debug("@aws-sdk/token-providers - fromSso");
        const profiles = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseKnownFiles"])(init);
        const profileName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getProfileName"])(init);
        const profile = profiles[profileName];
        if (!profile) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TokenProviderError"](`Profile '${profileName}' could not be found in shared credentials file.`, false);
        } else if (!profile["sso_session"]) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TokenProviderError"](`Profile '${profileName}' is missing required property 'sso_session'.`);
        }
        const ssoSessionName = profile["sso_session"];
        const ssoSessions = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$loadSsoSessionData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadSsoSessionData"])(init);
        const ssoSession = ssoSessions[ssoSessionName];
        if (!ssoSession) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TokenProviderError"](`Sso session '${ssoSessionName}' could not be found in shared credentials file.`, false);
        }
        for (const ssoSessionRequiredKey of [
            "sso_start_url",
            "sso_region"
        ]){
            if (!ssoSession[ssoSessionRequiredKey]) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TokenProviderError"](`Sso session '${ssoSessionName}' is missing required property '${ssoSessionRequiredKey}'.`, false);
            }
        }
        const ssoStartUrl = ssoSession["sso_start_url"];
        const ssoRegion = ssoSession["sso_region"];
        let ssoToken;
        try {
            ssoToken = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFromFile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSSOTokenFromFile"])(ssoSessionName);
        } catch (e) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TokenProviderError"](`The SSO session token associated with profile=${profileName} was not found or is invalid. ${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["REFRESH_MESSAGE"]}`, false);
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateTokenKey"])("accessToken", ssoToken.accessToken);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateTokenKey"])("expiresAt", ssoToken.expiresAt);
        const { accessToken, expiresAt } = ssoToken;
        const existingToken = {
            token: accessToken,
            expiration: new Date(expiresAt)
        };
        if (existingToken.expiration.getTime() - Date.now() > __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["EXPIRE_WINDOW_MS"]) {
            return existingToken;
        }
        if (Date.now() - lastRefreshAttemptTime.getTime() < 30 * 1000) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenExpiry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateTokenExpiry"])(existingToken);
            return existingToken;
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateTokenKey"])("clientId", ssoToken.clientId, true);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateTokenKey"])("clientSecret", ssoToken.clientSecret, true);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateTokenKey"])("refreshToken", ssoToken.refreshToken, true);
        try {
            lastRefreshAttemptTime.setTime(Date.now());
            const newSsoOidcToken = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$getNewSsoOidcToken$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getNewSsoOidcToken"])(ssoToken, ssoRegion, init);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateTokenKey"])("accessToken", newSsoOidcToken.accessToken);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateTokenKey"])("expiresIn", newSsoOidcToken.expiresIn);
            const newTokenExpiration = new Date(Date.now() + newSsoOidcToken.expiresIn * 1000);
            try {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$writeSSOTokenToFile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["writeSSOTokenToFile"])(ssoSessionName, {
                    ...ssoToken,
                    accessToken: newSsoOidcToken.accessToken,
                    expiresAt: newTokenExpiration.toISOString(),
                    refreshToken: newSsoOidcToken.refreshToken
                });
            } catch (error) {}
            return {
                token: newSsoOidcToken.accessToken,
                expiration: newTokenExpiration
            };
        } catch (error) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenExpiry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateTokenExpiry"])(existingToken);
            return existingToken;
        }
    };
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/resolveSSOCredentials.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "resolveSSOCredentials": (()=>resolveSSOCredentials)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFromFile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/getSSOTokenFromFile.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$fromSso$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+token-providers@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/token-providers/dist-es/fromSso.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-rsc] (ecmascript)");
;
;
;
;
const SHOULD_FAIL_CREDENTIAL_CHAIN = false;
const resolveSSOCredentials = async ({ ssoStartUrl, ssoSession, ssoAccountId, ssoRegion, ssoRoleName, ssoClient, clientConfig, parentClientConfig, profile, logger })=>{
    let token;
    const refreshMessage = `To refresh this SSO session run aws sso login with the corresponding profile.`;
    if (ssoSession) {
        try {
            const _token = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$token$2d$providers$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$fromSso$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromSso"])({
                profile
            })();
            token = {
                accessToken: _token.token,
                expiresAt: new Date(_token.expiration).toISOString()
            };
        } catch (e) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](e.message, {
                tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
                logger
            });
        }
    } else {
        try {
            token = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFromFile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSSOTokenFromFile"])(ssoStartUrl);
        } catch (e) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`The SSO session associated with this profile is invalid. ${refreshMessage}`, {
                tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
                logger
            });
        }
    }
    if (new Date(token.expiresAt).getTime() - Date.now() <= 0) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`The SSO session associated with this profile has expired. ${refreshMessage}`, {
            tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
            logger
        });
    }
    const { accessToken } = token;
    const { SSOClient, GetRoleCredentialsCommand } = await __turbopack_require__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/loadSso.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__);
    const sso = ssoClient || new SSOClient(Object.assign({}, clientConfig ?? {}, {
        logger: clientConfig?.logger ?? parentClientConfig?.logger,
        region: clientConfig?.region ?? ssoRegion
    }));
    let ssoResp;
    try {
        ssoResp = await sso.send(new GetRoleCredentialsCommand({
            accountId: ssoAccountId,
            roleName: ssoRoleName,
            accessToken
        }));
    } catch (e) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](e, {
            tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
            logger
        });
    }
    const { roleCredentials: { accessKeyId, secretAccessKey, sessionToken, expiration, credentialScope, accountId } = {} } = ssoResp;
    if (!accessKeyId || !secretAccessKey || !sessionToken || !expiration) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"]("SSO returns an invalid temporary credential.", {
            tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
            logger
        });
    }
    const credentials = {
        accessKeyId,
        secretAccessKey,
        sessionToken,
        expiration: new Date(expiration),
        ...credentialScope && {
            credentialScope
        },
        ...accountId && {
            accountId
        }
    };
    if (ssoSession) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(credentials, "CREDENTIALS_SSO", "s");
    } else {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(credentials, "CREDENTIALS_SSO_LEGACY", "u");
    }
    return credentials;
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/validateSsoProfile.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "validateSsoProfile": (()=>validateSsoProfile)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
;
const validateSsoProfile = (profile, logger)=>{
    const { sso_start_url, sso_account_id, sso_region, sso_role_name } = profile;
    if (!sso_start_url || !sso_account_id || !sso_region || !sso_role_name) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Profile is configured with invalid SSO credentials. Required parameters "sso_account_id", ` + `"sso_region", "sso_role_name", "sso_start_url". Got ${Object.keys(profile).join(", ")}\nReference: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html`, {
            tryNextLink: false,
            logger
        });
    }
    return profile;
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/fromSSO.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromSSO": (()=>fromSSO)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$isSsoProfile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/isSsoProfile.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$resolveSSOCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/resolveSSOCredentials.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$validateSsoProfile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/validateSsoProfile.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/getProfileName.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/parseKnownFiles.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$loadSsoSessionData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/loadSsoSessionData.js [app-rsc] (ecmascript)");
;
;
;
;
;
const fromSSO = (init = {})=>async ()=>{
        init.logger?.debug("@aws-sdk/credential-provider-sso - fromSSO");
        const { ssoStartUrl, ssoAccountId, ssoRegion, ssoRoleName, ssoSession } = init;
        const { ssoClient } = init;
        const profileName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getProfileName"])(init);
        if (!ssoStartUrl && !ssoAccountId && !ssoRegion && !ssoRoleName && !ssoSession) {
            const profiles = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseKnownFiles"])(init);
            const profile = profiles[profileName];
            if (!profile) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Profile ${profileName} was not found.`, {
                    logger: init.logger
                });
            }
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$isSsoProfile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSsoProfile"])(profile)) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Profile ${profileName} is not configured with SSO credentials.`, {
                    logger: init.logger
                });
            }
            if (profile?.sso_session) {
                const ssoSessions = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$loadSsoSessionData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadSsoSessionData"])(init);
                const session = ssoSessions[profile.sso_session];
                const conflictMsg = ` configurations in profile ${profileName} and sso-session ${profile.sso_session}`;
                if (ssoRegion && ssoRegion !== session.sso_region) {
                    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Conflicting SSO region` + conflictMsg, {
                        tryNextLink: false,
                        logger: init.logger
                    });
                }
                if (ssoStartUrl && ssoStartUrl !== session.sso_start_url) {
                    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Conflicting SSO start_url` + conflictMsg, {
                        tryNextLink: false,
                        logger: init.logger
                    });
                }
                profile.sso_region = session.sso_region;
                profile.sso_start_url = session.sso_start_url;
            }
            const { sso_start_url, sso_account_id, sso_region, sso_role_name, sso_session } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$validateSsoProfile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateSsoProfile"])(profile, init.logger);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$resolveSSOCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveSSOCredentials"])({
                ssoStartUrl: sso_start_url,
                ssoSession: sso_session,
                ssoAccountId: sso_account_id,
                ssoRegion: sso_region,
                ssoRoleName: sso_role_name,
                ssoClient: ssoClient,
                clientConfig: init.clientConfig,
                parentClientConfig: init.parentClientConfig,
                profile: profileName
            });
        } else if (!ssoStartUrl || !ssoAccountId || !ssoRegion || !ssoRoleName) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"]("Incomplete configuration. The fromSSO() argument hash must include " + '"ssoStartUrl", "ssoAccountId", "ssoRegion", "ssoRoleName"', {
                tryNextLink: false,
                logger: init.logger
            });
        } else {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$resolveSSOCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveSSOCredentials"])({
                ssoStartUrl,
                ssoSession,
                ssoAccountId,
                ssoRegion,
                ssoRoleName,
                ssoClient,
                clientConfig: init.clientConfig,
                parentClientConfig: init.parentClientConfig,
                profile: profileName
            });
        }
    };
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/types.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({});
;
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({});
;
;
;
;
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$fromSSO$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/fromSSO.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$isSsoProfile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/isSsoProfile.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/types.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$validateSsoProfile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/validateSsoProfile.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-rsc] (ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromSSO": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$fromSSO$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromSSO"]),
    "isSsoProfile": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$isSsoProfile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSsoProfile"]),
    "validateSsoProfile": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$validateSsoProfile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateSsoProfile"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$fromSSO$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/fromSSO.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$isSsoProfile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/isSsoProfile.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/types.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$validateSsoProfile$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/validateSsoProfile.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromSSO": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["fromSSO"]),
    "isSsoProfile": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["isSsoProfile"]),
    "validateSsoProfile": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["validateSsoProfile"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$sso$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts$40$3$2e$699$2e$0_$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-rsc] (ecmascript) <exports>");
}}),

};

//# sourceMappingURL=08b5e__pnpm_8a2ae7._.js.map