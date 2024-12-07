module.exports = {

"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/httpRequest.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "httpRequest": (()=>httpRequest)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.10/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$buffer$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (buffer, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$http$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (http, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$ProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.10/node_modules/@smithy/property-provider/dist-es/ProviderError.js [app-rsc] (ecmascript)");
;
;
;
function httpRequest(options) {
    return new Promise((resolve, reject)=>{
        const req = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$http$2c$__cjs$29$__["request"])({
            method: "GET",
            ...options,
            hostname: options.hostname?.replace(/^\[(.+)\]$/, "$1")
        });
        req.on("error", (err)=>{
            reject(Object.assign(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$ProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ProviderError"]("Unable to connect to instance metadata service"), err));
            req.destroy();
        });
        req.on("timeout", ()=>{
            reject(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$ProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ProviderError"]("TimeoutError from instance metadata service"));
            req.destroy();
        });
        req.on("response", (res)=>{
            const { statusCode = 400 } = res;
            if (statusCode < 200 || 300 <= statusCode) {
                reject(Object.assign(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$ProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ProviderError"]("Error response received from instance metadata service"), {
                    statusCode
                }));
                req.destroy();
            }
            const chunks = [];
            res.on("data", (chunk)=>{
                chunks.push(chunk);
            });
            res.on("end", ()=>{
                resolve(__TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$buffer$2c$__cjs$29$__["Buffer"].concat(chunks));
                req.destroy();
            });
        });
        req.end();
    });
}
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/ImdsCredentials.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromImdsCredentials": (()=>fromImdsCredentials),
    "isImdsCredentials": (()=>isImdsCredentials)
});
const isImdsCredentials = (arg)=>Boolean(arg) && typeof arg === "object" && typeof arg.AccessKeyId === "string" && typeof arg.SecretAccessKey === "string" && typeof arg.Token === "string" && typeof arg.Expiration === "string";
const fromImdsCredentials = (creds)=>({
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretAccessKey,
        sessionToken: creds.Token,
        expiration: new Date(creds.Expiration),
        ...creds.AccountId && {
            accountId: creds.AccountId
        }
    });
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/RemoteProviderInit.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "DEFAULT_MAX_RETRIES": (()=>DEFAULT_MAX_RETRIES),
    "DEFAULT_TIMEOUT": (()=>DEFAULT_TIMEOUT),
    "providerConfigFromInit": (()=>providerConfigFromInit)
});
const DEFAULT_TIMEOUT = 1000;
const DEFAULT_MAX_RETRIES = 0;
const providerConfigFromInit = ({ maxRetries = DEFAULT_MAX_RETRIES, timeout = DEFAULT_TIMEOUT })=>({
        maxRetries,
        timeout
    });
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/retry.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "retry": (()=>retry)
});
const retry = (toRetry, maxRetries)=>{
    let promise = toRetry();
    for(let i = 0; i < maxRetries; i++){
        promise = promise.catch(toRetry);
    }
    return promise;
};
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/fromContainerMetadata.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "ENV_CMDS_AUTH_TOKEN": (()=>ENV_CMDS_AUTH_TOKEN),
    "ENV_CMDS_FULL_URI": (()=>ENV_CMDS_FULL_URI),
    "ENV_CMDS_RELATIVE_URI": (()=>ENV_CMDS_RELATIVE_URI),
    "fromContainerMetadata": (()=>fromContainerMetadata)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.10/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$url$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (url, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$httpRequest$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/httpRequest.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$ImdsCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/ImdsCredentials.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$RemoteProviderInit$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/RemoteProviderInit.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$retry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/retry.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.10/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
const ENV_CMDS_FULL_URI = "AWS_CONTAINER_CREDENTIALS_FULL_URI";
const ENV_CMDS_RELATIVE_URI = "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI";
const ENV_CMDS_AUTH_TOKEN = "AWS_CONTAINER_AUTHORIZATION_TOKEN";
const fromContainerMetadata = (init = {})=>{
    const { timeout, maxRetries } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$RemoteProviderInit$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["providerConfigFromInit"])(init);
    return ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$retry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["retry"])(async ()=>{
            const requestOptions = await getCmdsUri({
                logger: init.logger
            });
            const credsResponse = JSON.parse(await requestFromEcsImds(timeout, requestOptions));
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$ImdsCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isImdsCredentials"])(credsResponse)) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"]("Invalid response received from instance metadata service.", {
                    logger: init.logger
                });
            }
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$ImdsCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromImdsCredentials"])(credsResponse);
        }, maxRetries);
};
const requestFromEcsImds = async (timeout, options)=>{
    if (process.env[ENV_CMDS_AUTH_TOKEN]) {
        options.headers = {
            ...options.headers,
            Authorization: process.env[ENV_CMDS_AUTH_TOKEN]
        };
    }
    const buffer = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$httpRequest$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["httpRequest"])({
        ...options,
        timeout
    });
    return buffer.toString();
};
const CMDS_IP = "169.254.170.2";
const GREENGRASS_HOSTS = {
    localhost: true,
    "127.0.0.1": true
};
const GREENGRASS_PROTOCOLS = {
    "http:": true,
    "https:": true
};
const getCmdsUri = async ({ logger })=>{
    if (process.env[ENV_CMDS_RELATIVE_URI]) {
        return {
            hostname: CMDS_IP,
            path: process.env[ENV_CMDS_RELATIVE_URI]
        };
    }
    if (process.env[ENV_CMDS_FULL_URI]) {
        const parsed = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$url$2c$__cjs$29$__["parse"])(process.env[ENV_CMDS_FULL_URI]);
        if (!parsed.hostname || !(parsed.hostname in GREENGRASS_HOSTS)) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`${parsed.hostname} is not a valid container metadata service hostname`, {
                tryNextLink: false,
                logger
            });
        }
        if (!parsed.protocol || !(parsed.protocol in GREENGRASS_PROTOCOLS)) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`${parsed.protocol} is not a valid container metadata service protocol`, {
                tryNextLink: false,
                logger
            });
        }
        return {
            ...parsed,
            port: parsed.port ? parseInt(parsed.port, 10) : undefined
        };
    }
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"]("The container metadata credential provider cannot be used unless" + ` the ${ENV_CMDS_RELATIVE_URI} or ${ENV_CMDS_FULL_URI} environment` + " variable is set", {
        tryNextLink: false,
        logger
    });
};
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/error/InstanceMetadataV1FallbackError.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "InstanceMetadataV1FallbackError": (()=>InstanceMetadataV1FallbackError)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.10/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.10/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
;
class InstanceMetadataV1FallbackError extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"] {
    constructor(message, tryNextLink = true){
        super(message, tryNextLink);
        this.tryNextLink = tryNextLink;
        this.name = "InstanceMetadataV1FallbackError";
        Object.setPrototypeOf(this, InstanceMetadataV1FallbackError.prototype);
    }
}
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/config/Endpoint.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "Endpoint": (()=>Endpoint)
});
var Endpoint;
(function(Endpoint) {
    Endpoint["IPv4"] = "http://169.254.169.254";
    Endpoint["IPv6"] = "http://[fd00:ec2::254]";
})(Endpoint || (Endpoint = {}));
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/config/EndpointConfigOptions.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "CONFIG_ENDPOINT_NAME": (()=>CONFIG_ENDPOINT_NAME),
    "ENDPOINT_CONFIG_OPTIONS": (()=>ENDPOINT_CONFIG_OPTIONS),
    "ENV_ENDPOINT_NAME": (()=>ENV_ENDPOINT_NAME)
});
const ENV_ENDPOINT_NAME = "AWS_EC2_METADATA_SERVICE_ENDPOINT";
const CONFIG_ENDPOINT_NAME = "ec2_metadata_service_endpoint";
const ENDPOINT_CONFIG_OPTIONS = {
    environmentVariableSelector: (env)=>env[ENV_ENDPOINT_NAME],
    configFileSelector: (profile)=>profile[CONFIG_ENDPOINT_NAME],
    default: undefined
};
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/config/EndpointMode.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "EndpointMode": (()=>EndpointMode)
});
var EndpointMode;
(function(EndpointMode) {
    EndpointMode["IPv4"] = "IPv4";
    EndpointMode["IPv6"] = "IPv6";
})(EndpointMode || (EndpointMode = {}));
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/config/EndpointModeConfigOptions.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "CONFIG_ENDPOINT_MODE_NAME": (()=>CONFIG_ENDPOINT_MODE_NAME),
    "ENDPOINT_MODE_CONFIG_OPTIONS": (()=>ENDPOINT_MODE_CONFIG_OPTIONS),
    "ENV_ENDPOINT_MODE_NAME": (()=>ENV_ENDPOINT_MODE_NAME)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$EndpointMode$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/config/EndpointMode.js [app-rsc] (ecmascript)");
;
const ENV_ENDPOINT_MODE_NAME = "AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE";
const CONFIG_ENDPOINT_MODE_NAME = "ec2_metadata_service_endpoint_mode";
const ENDPOINT_MODE_CONFIG_OPTIONS = {
    environmentVariableSelector: (env)=>env[ENV_ENDPOINT_MODE_NAME],
    configFileSelector: (profile)=>profile[CONFIG_ENDPOINT_MODE_NAME],
    default: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$EndpointMode$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["EndpointMode"].IPv4
};
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/utils/getInstanceMetadataEndpoint.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "getInstanceMetadataEndpoint": (()=>getInstanceMetadataEndpoint)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-config-provider@3.1.11/node_modules/@smithy/node-config-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$url$2d$parser$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$url$2d$parser$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+url-parser@3.0.10/node_modules/@smithy/url-parser/dist-es/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$Endpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/config/Endpoint.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$EndpointConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/config/EndpointConfigOptions.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$EndpointMode$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/config/EndpointMode.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$EndpointModeConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/config/EndpointModeConfigOptions.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-config-provider@3.1.11/node_modules/@smithy/node-config-provider/dist-es/configLoader.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
const getInstanceMetadataEndpoint = async ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$url$2d$parser$40$3$2e$0$2e$10$2f$node_modules$2f40$smithy$2f$url$2d$parser$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseUrl"])(await getFromEndpointConfig() || await getFromEndpointModeConfig());
const getFromEndpointConfig = async ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$EndpointConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ENDPOINT_CONFIG_OPTIONS"])();
const getFromEndpointModeConfig = async ()=>{
    const endpointMode = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$EndpointModeConfigOptions$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ENDPOINT_MODE_CONFIG_OPTIONS"])();
    switch(endpointMode){
        case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$EndpointMode$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["EndpointMode"].IPv4:
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$Endpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Endpoint"].IPv4;
        case __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$EndpointMode$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["EndpointMode"].IPv6:
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$Endpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Endpoint"].IPv6;
        default:
            throw new Error(`Unsupported endpoint mode: ${endpointMode}.` + ` Select from ${Object.values(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$EndpointMode$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["EndpointMode"])}`);
    }
};
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/utils/getExtendedInstanceMetadataCredentials.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "getExtendedInstanceMetadataCredentials": (()=>getExtendedInstanceMetadataCredentials)
});
const STATIC_STABILITY_REFRESH_INTERVAL_SECONDS = 5 * 60;
const STATIC_STABILITY_REFRESH_INTERVAL_JITTER_WINDOW_SECONDS = 5 * 60;
const STATIC_STABILITY_DOC_URL = "https://docs.aws.amazon.com/sdkref/latest/guide/feature-static-credentials.html";
const getExtendedInstanceMetadataCredentials = (credentials, logger)=>{
    const refreshInterval = STATIC_STABILITY_REFRESH_INTERVAL_SECONDS + Math.floor(Math.random() * STATIC_STABILITY_REFRESH_INTERVAL_JITTER_WINDOW_SECONDS);
    const newExpiration = new Date(Date.now() + refreshInterval * 1000);
    logger.warn("Attempting credential expiration extension due to a credential service availability issue. A refresh of these " + `credentials will be attempted after ${new Date(newExpiration)}.\nFor more information, please visit: ` + STATIC_STABILITY_DOC_URL);
    const originalExpiration = credentials.originalExpiration ?? credentials.expiration;
    return {
        ...credentials,
        ...originalExpiration ? {
            originalExpiration
        } : {},
        expiration: newExpiration
    };
};
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/utils/staticStabilityProvider.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "staticStabilityProvider": (()=>staticStabilityProvider)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$utils$2f$getExtendedInstanceMetadataCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/utils/getExtendedInstanceMetadataCredentials.js [app-rsc] (ecmascript)");
;
const staticStabilityProvider = (provider, options = {})=>{
    const logger = options?.logger || console;
    let pastCredentials;
    return async ()=>{
        let credentials;
        try {
            credentials = await provider();
            if (credentials.expiration && credentials.expiration.getTime() < Date.now()) {
                credentials = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$utils$2f$getExtendedInstanceMetadataCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getExtendedInstanceMetadataCredentials"])(credentials, logger);
            }
        } catch (e) {
            if (pastCredentials) {
                logger.warn("Credential renew failed: ", e);
                credentials = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$utils$2f$getExtendedInstanceMetadataCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getExtendedInstanceMetadataCredentials"])(pastCredentials, logger);
            } else {
                throw e;
            }
        }
        pastCredentials = credentials;
        return credentials;
    };
};
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/fromInstanceMetadata.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromInstanceMetadata": (()=>fromInstanceMetadata)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-config-provider@3.1.11/node_modules/@smithy/node-config-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.10/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$error$2f$InstanceMetadataV1FallbackError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/error/InstanceMetadataV1FallbackError.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$httpRequest$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/httpRequest.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$ImdsCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/ImdsCredentials.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$RemoteProviderInit$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/RemoteProviderInit.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$retry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/retry.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$utils$2f$getInstanceMetadataEndpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/utils/getInstanceMetadataEndpoint.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$utils$2f$staticStabilityProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/utils/staticStabilityProvider.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-config-provider@3.1.11/node_modules/@smithy/node-config-provider/dist-es/configLoader.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.10/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
const IMDS_PATH = "/latest/meta-data/iam/security-credentials/";
const IMDS_TOKEN_PATH = "/latest/api/token";
const AWS_EC2_METADATA_V1_DISABLED = "AWS_EC2_METADATA_V1_DISABLED";
const PROFILE_AWS_EC2_METADATA_V1_DISABLED = "ec2_metadata_v1_disabled";
const X_AWS_EC2_METADATA_TOKEN = "x-aws-ec2-metadata-token";
const fromInstanceMetadata = (init = {})=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$utils$2f$staticStabilityProvider$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["staticStabilityProvider"])(getInstanceMetadataProvider(init), {
        logger: init.logger
    });
const getInstanceMetadataProvider = (init = {})=>{
    let disableFetchToken = false;
    const { logger, profile } = init;
    const { timeout, maxRetries } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$RemoteProviderInit$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["providerConfigFromInit"])(init);
    const getCredentials = async (maxRetries, options)=>{
        const isImdsV1Fallback = disableFetchToken || options.headers?.[X_AWS_EC2_METADATA_TOKEN] == null;
        if (isImdsV1Fallback) {
            let fallbackBlockedFromProfile = false;
            let fallbackBlockedFromProcessEnv = false;
            const configValue = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$config$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$node$2d$config$2d$provider$2f$dist$2d$es$2f$configLoader$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["loadConfig"])({
                environmentVariableSelector: (env)=>{
                    const envValue = env[AWS_EC2_METADATA_V1_DISABLED];
                    fallbackBlockedFromProcessEnv = !!envValue && envValue !== "false";
                    if (envValue === undefined) {
                        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`${AWS_EC2_METADATA_V1_DISABLED} not set in env, checking config file next.`, {
                            logger: init.logger
                        });
                    }
                    return fallbackBlockedFromProcessEnv;
                },
                configFileSelector: (profile)=>{
                    const profileValue = profile[PROFILE_AWS_EC2_METADATA_V1_DISABLED];
                    fallbackBlockedFromProfile = !!profileValue && profileValue !== "false";
                    return fallbackBlockedFromProfile;
                },
                default: false
            }, {
                profile
            })();
            if (init.ec2MetadataV1Disabled || configValue) {
                const causes = [];
                if (init.ec2MetadataV1Disabled) causes.push("credential provider initialization (runtime option ec2MetadataV1Disabled)");
                if (fallbackBlockedFromProfile) causes.push(`config file profile (${PROFILE_AWS_EC2_METADATA_V1_DISABLED})`);
                if (fallbackBlockedFromProcessEnv) causes.push(`process environment variable (${AWS_EC2_METADATA_V1_DISABLED})`);
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$error$2f$InstanceMetadataV1FallbackError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InstanceMetadataV1FallbackError"](`AWS EC2 Metadata v1 fallback has been blocked by AWS SDK configuration in the following: [${causes.join(", ")}].`);
            }
        }
        const imdsProfile = (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$retry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["retry"])(async ()=>{
            let profile;
            try {
                profile = await getProfile(options);
            } catch (err) {
                if (err.statusCode === 401) {
                    disableFetchToken = false;
                }
                throw err;
            }
            return profile;
        }, maxRetries)).trim();
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$retry$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["retry"])(async ()=>{
            let creds;
            try {
                creds = await getCredentialsFromProfile(imdsProfile, options, init);
            } catch (err) {
                if (err.statusCode === 401) {
                    disableFetchToken = false;
                }
                throw err;
            }
            return creds;
        }, maxRetries);
    };
    return async ()=>{
        const endpoint = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$utils$2f$getInstanceMetadataEndpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getInstanceMetadataEndpoint"])();
        if (disableFetchToken) {
            logger?.debug("AWS SDK Instance Metadata", "using v1 fallback (no token fetch)");
            return getCredentials(maxRetries, {
                ...endpoint,
                timeout
            });
        } else {
            let token;
            try {
                token = (await getMetadataToken({
                    ...endpoint,
                    timeout
                })).toString();
            } catch (error) {
                if (error?.statusCode === 400) {
                    throw Object.assign(error, {
                        message: "EC2 Metadata token request returned error"
                    });
                } else if (error.message === "TimeoutError" || [
                    403,
                    404,
                    405
                ].includes(error.statusCode)) {
                    disableFetchToken = true;
                }
                logger?.debug("AWS SDK Instance Metadata", "using v1 fallback (initial)");
                return getCredentials(maxRetries, {
                    ...endpoint,
                    timeout
                });
            }
            return getCredentials(maxRetries, {
                ...endpoint,
                headers: {
                    [X_AWS_EC2_METADATA_TOKEN]: token
                },
                timeout
            });
        }
    };
};
const getMetadataToken = async (options)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$httpRequest$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["httpRequest"])({
        ...options,
        path: IMDS_TOKEN_PATH,
        method: "PUT",
        headers: {
            "x-aws-ec2-metadata-token-ttl-seconds": "21600"
        }
    });
const getProfile = async (options)=>(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$httpRequest$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["httpRequest"])({
        ...options,
        path: IMDS_PATH
    })).toString();
const getCredentialsFromProfile = async (profile, options, init)=>{
    const credentialsResponse = JSON.parse((await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$httpRequest$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["httpRequest"])({
        ...options,
        path: IMDS_PATH + profile
    })).toString());
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$ImdsCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isImdsCredentials"])(credentialsResponse)) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$10$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"]("Invalid response received from instance metadata service.", {
            logger: init.logger
        });
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$ImdsCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromImdsCredentials"])(credentialsResponse);
};
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/types.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({});
;
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({});
;
;
;
;
;
;
;
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$fromContainerMetadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/fromContainerMetadata.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$fromInstanceMetadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/fromInstanceMetadata.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$RemoteProviderInit$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/RemoteProviderInit.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/types.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$httpRequest$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/httpRequest.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$utils$2f$getInstanceMetadataEndpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/utils/getInstanceMetadataEndpoint.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$Endpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/config/Endpoint.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-rsc] (ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "DEFAULT_MAX_RETRIES": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$RemoteProviderInit$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_MAX_RETRIES"]),
    "DEFAULT_TIMEOUT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$RemoteProviderInit$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEFAULT_TIMEOUT"]),
    "ENV_CMDS_AUTH_TOKEN": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$fromContainerMetadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ENV_CMDS_AUTH_TOKEN"]),
    "ENV_CMDS_FULL_URI": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$fromContainerMetadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ENV_CMDS_FULL_URI"]),
    "ENV_CMDS_RELATIVE_URI": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$fromContainerMetadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ENV_CMDS_RELATIVE_URI"]),
    "Endpoint": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$Endpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Endpoint"]),
    "fromContainerMetadata": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$fromContainerMetadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromContainerMetadata"]),
    "fromInstanceMetadata": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$fromInstanceMetadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromInstanceMetadata"]),
    "getInstanceMetadataEndpoint": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$utils$2f$getInstanceMetadataEndpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getInstanceMetadataEndpoint"]),
    "httpRequest": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$httpRequest$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["httpRequest"]),
    "providerConfigFromInit": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$RemoteProviderInit$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["providerConfigFromInit"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$config$2f$Endpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/config/Endpoint.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$utils$2f$getInstanceMetadataEndpoint$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/utils/getInstanceMetadataEndpoint.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$httpRequest$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/httpRequest.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$fromContainerMetadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/fromContainerMetadata.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$fromInstanceMetadata$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/fromInstanceMetadata.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$remoteProvider$2f$RemoteProviderInit$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/remoteProvider/RemoteProviderInit.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$types$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/types.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "DEFAULT_MAX_RETRIES": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["DEFAULT_MAX_RETRIES"]),
    "DEFAULT_TIMEOUT": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["DEFAULT_TIMEOUT"]),
    "ENV_CMDS_AUTH_TOKEN": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["ENV_CMDS_AUTH_TOKEN"]),
    "ENV_CMDS_FULL_URI": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["ENV_CMDS_FULL_URI"]),
    "ENV_CMDS_RELATIVE_URI": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["ENV_CMDS_RELATIVE_URI"]),
    "Endpoint": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["Endpoint"]),
    "fromContainerMetadata": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["fromContainerMetadata"]),
    "fromInstanceMetadata": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["fromInstanceMetadata"]),
    "getInstanceMetadataEndpoint": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["getInstanceMetadataEndpoint"]),
    "httpRequest": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["httpRequest"]),
    "providerConfigFromInit": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["providerConfigFromInit"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$credential$2d$provider$2d$imds$40$3$2e$2$2e$7$2f$node_modules$2f40$smithy$2f$credential$2d$provider$2d$imds$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.7/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-rsc] (ecmascript) <exports>");
}}),

};

//# sourceMappingURL=00c7c_%40smithy_credential-provider-imds_dist-es_d88792._.js.map