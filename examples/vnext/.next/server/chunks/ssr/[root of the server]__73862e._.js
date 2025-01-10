module.exports = {

"[externals]/ [external] (fs/promises, cjs)": (function(__turbopack_context__) {

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, m: module, e: exports, t: require } = __turbopack_context__;
{
const mod = __turbopack_external_require__("fs/promises");

module.exports = mod;
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/fromHttp/checkUrl.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "checkUrl": (()=>checkUrl)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
;
const LOOPBACK_CIDR_IPv4 = "127.0.0.0/8";
const LOOPBACK_CIDR_IPv6 = "::1/128";
const ECS_CONTAINER_HOST = "169.254.170.2";
const EKS_CONTAINER_HOST_IPv4 = "169.254.170.23";
const EKS_CONTAINER_HOST_IPv6 = "[fd00:ec2::23]";
const checkUrl = (url, logger)=>{
    if (url.protocol === "https:") {
        return;
    }
    if (url.hostname === ECS_CONTAINER_HOST || url.hostname === EKS_CONTAINER_HOST_IPv4 || url.hostname === EKS_CONTAINER_HOST_IPv6) {
        return;
    }
    if (url.hostname.includes("[")) {
        if (url.hostname === "[::1]" || url.hostname === "[0000:0000:0000:0000:0000:0000:0000:0001]") {
            return;
        }
    } else {
        if (url.hostname === "localhost") {
            return;
        }
        const ipComponents = url.hostname.split(".");
        const inRange = (component)=>{
            const num = parseInt(component, 10);
            return 0 <= num && num <= 255;
        };
        if (ipComponents[0] === "127" && inRange(ipComponents[1]) && inRange(ipComponents[2]) && inRange(ipComponents[3]) && ipComponents.length === 4) {
            return;
        }
    }
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`URL not accepted. It must either be HTTPS or match one of the following:
  - loopback CIDR 127.0.0.0/8 or [::1/128]
  - ECS container host 169.254.170.2
  - EKS container host 169.254.170.23 or [fd00:ec2::23]`, {
        logger
    });
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/fromHttp/requestHelpers.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "createGetRequest": (()=>createGetRequest),
    "getCredentials": (()=>getCredentials)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$protocol$2d$http$40$4$2e$1$2e$8$2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+protocol-http@4.1.8/node_modules/@smithy/protocol-http/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$stream$40$3$2e$3$2e$2$2f$node_modules$2f40$smithy$2f$util$2d$stream$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-stream@3.3.2/node_modules/@smithy/util-stream/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$protocol$2d$http$40$4$2e$1$2e$8$2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$httpRequest$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+protocol-http@4.1.8/node_modules/@smithy/protocol-http/dist-es/httpRequest.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$stream$40$3$2e$3$2e$2$2f$node_modules$2f40$smithy$2f$util$2d$stream$2f$dist$2d$es$2f$sdk$2d$stream$2d$mixin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+util-stream@3.3.2/node_modules/@smithy/util-stream/dist-es/sdk-stream-mixin.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$date$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+smithy-client@3.4.6/node_modules/@smithy/smithy-client/dist-es/date-utils.js [app-rsc] (ecmascript)");
;
;
;
;
function createGetRequest(url) {
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$protocol$2d$http$40$4$2e$1$2e$8$2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$httpRequest$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["HttpRequest"]({
        protocol: url.protocol,
        hostname: url.hostname,
        port: Number(url.port),
        path: url.pathname,
        query: Array.from(url.searchParams.entries()).reduce((acc, [k, v])=>{
            acc[k] = v;
            return acc;
        }, {}),
        fragment: url.hash
    });
}
async function getCredentials(response, logger) {
    const stream = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$util$2d$stream$40$3$2e$3$2e$2$2f$node_modules$2f40$smithy$2f$util$2d$stream$2f$dist$2d$es$2f$sdk$2d$stream$2d$mixin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sdkStreamMixin"])(response.body);
    const str = await stream.transformToString();
    if (response.statusCode === 200) {
        const parsed = JSON.parse(str);
        if (typeof parsed.AccessKeyId !== "string" || typeof parsed.SecretAccessKey !== "string" || typeof parsed.Token !== "string" || typeof parsed.Expiration !== "string") {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"]("HTTP credential provider response not of the required format, an object matching: " + "{ AccessKeyId: string, SecretAccessKey: string, Token: string, Expiration: string(rfc3339) }", {
                logger
            });
        }
        return {
            accessKeyId: parsed.AccessKeyId,
            secretAccessKey: parsed.SecretAccessKey,
            sessionToken: parsed.Token,
            expiration: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$smithy$2d$client$40$3$2e$4$2e$6$2f$node_modules$2f40$smithy$2f$smithy$2d$client$2f$dist$2d$es$2f$date$2d$utils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseRfc3339DateTime"])(parsed.Expiration)
        };
    }
    if (response.statusCode >= 400 && response.statusCode < 500) {
        let parsedBody = {};
        try {
            parsedBody = JSON.parse(str);
        } catch (e) {}
        throw Object.assign(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Server responded with status: ${response.statusCode}`, {
            logger
        }), {
            Code: parsedBody.Code,
            Message: parsedBody.Message
        });
    }
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Server responded with status: ${response.statusCode}`, {
        logger
    });
}
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/fromHttp/retry-wrapper.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "retryWrapper": (()=>retryWrapper)
});
const retryWrapper = (toRetry, maxRetries, delayMs)=>{
    return async ()=>{
        for(let i = 0; i < maxRetries; ++i){
            try {
                return await toRetry();
            } catch (e) {
                await new Promise((resolve)=>setTimeout(resolve, delayMs));
            }
        }
        return await toRetry();
    };
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/fromHttp/fromHttp.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromHttp": (()=>fromHttp)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$2$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-http-handler@3.3.2/node_modules/@smithy/node-http-handler/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$fs$2f$promises$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (fs/promises, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$fromHttp$2f$checkUrl$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/fromHttp/checkUrl.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$fromHttp$2f$requestHelpers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/fromHttp/requestHelpers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$fromHttp$2f$retry$2d$wrapper$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/fromHttp/retry-wrapper.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$2$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$node$2d$http$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+node-http-handler@3.3.2/node_modules/@smithy/node-http-handler/dist-es/node-http-handler.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
const AWS_CONTAINER_CREDENTIALS_RELATIVE_URI = "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI";
const DEFAULT_LINK_LOCAL_HOST = "http://169.254.170.2";
const AWS_CONTAINER_CREDENTIALS_FULL_URI = "AWS_CONTAINER_CREDENTIALS_FULL_URI";
const AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE = "AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE";
const AWS_CONTAINER_AUTHORIZATION_TOKEN = "AWS_CONTAINER_AUTHORIZATION_TOKEN";
const fromHttp = (options = {})=>{
    options.logger?.debug("@aws-sdk/credential-provider-http - fromHttp");
    let host;
    const relative = options.awsContainerCredentialsRelativeUri ?? process.env[AWS_CONTAINER_CREDENTIALS_RELATIVE_URI];
    const full = options.awsContainerCredentialsFullUri ?? process.env[AWS_CONTAINER_CREDENTIALS_FULL_URI];
    const token = options.awsContainerAuthorizationToken ?? process.env[AWS_CONTAINER_AUTHORIZATION_TOKEN];
    const tokenFile = options.awsContainerAuthorizationTokenFile ?? process.env[AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE];
    const warn = options.logger?.constructor?.name === "NoOpLogger" || !options.logger ? console.warn : options.logger.warn;
    if (relative && full) {
        warn("@aws-sdk/credential-provider-http: " + "you have set both awsContainerCredentialsRelativeUri and awsContainerCredentialsFullUri.");
        warn("awsContainerCredentialsFullUri will take precedence.");
    }
    if (token && tokenFile) {
        warn("@aws-sdk/credential-provider-http: " + "you have set both awsContainerAuthorizationToken and awsContainerAuthorizationTokenFile.");
        warn("awsContainerAuthorizationToken will take precedence.");
    }
    if (full) {
        host = full;
    } else if (relative) {
        host = `${DEFAULT_LINK_LOCAL_HOST}${relative}`;
    } else {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`No HTTP credential provider host provided.
Set AWS_CONTAINER_CREDENTIALS_FULL_URI or AWS_CONTAINER_CREDENTIALS_RELATIVE_URI.`, {
            logger: options.logger
        });
    }
    const url = new URL(host);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$fromHttp$2f$checkUrl$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["checkUrl"])(url, options.logger);
    const requestHandler = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$node$2d$http$2d$handler$40$3$2e$3$2e$2$2f$node_modules$2f40$smithy$2f$node$2d$http$2d$handler$2f$dist$2d$es$2f$node$2d$http$2d$handler$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NodeHttpHandler"]({
        requestTimeout: options.timeout ?? 1000,
        connectionTimeout: options.timeout ?? 1000
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$fromHttp$2f$retry$2d$wrapper$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["retryWrapper"])(async ()=>{
        const request = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$fromHttp$2f$requestHelpers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createGetRequest"])(url);
        if (token) {
            request.headers.Authorization = token;
        } else if (tokenFile) {
            request.headers.Authorization = (await __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$28$fs$2f$promises$2c$__cjs$29$__["default"].readFile(tokenFile)).toString();
        }
        try {
            const result = await requestHandler.handle(request);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$fromHttp$2f$requestHelpers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCredentials"])(result.response).then((creds)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_HTTP", "z"));
        } catch (e) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](String(e), {
                logger: options.logger
            });
        }
    }, options.maxRetries ?? 3, options.timeout ?? 1000);
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/index.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({});
;
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$fromHttp$2f$fromHttp$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/fromHttp/fromHttp.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/index.js [app-rsc] (ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromHttp": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$fromHttp$2f$fromHttp$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromHttp"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$fromHttp$2f$fromHttp$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/fromHttp/fromHttp.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/index.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromHttp": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["fromHttp"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$http$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$http$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/index.js [app-rsc] (ecmascript) <exports>");
}}),

};

//# sourceMappingURL=%5Broot%20of%20the%20server%5D__73862e._.js.map