module.exports = {

"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveCredentialSource.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "resolveCredentialSource": (()=>resolveCredentialSource)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$chain$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/chain.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-rsc] (ecmascript)");
;
;
const resolveCredentialSource = (credentialSource, profileName, logger)=>{
    const sourceProvidersMap = {
        EcsContainer: async (options)=>{
            const { fromHttp } = await __turbopack_require__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-http@3.696.0/node_modules/@aws-sdk/credential-provider-http/dist-es/index.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__);
            const { fromContainerMetadata } = await __turbopack_require__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.8/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__);
            logger?.debug("@aws-sdk/credential-provider-ini - credential_source is EcsContainer");
            return async ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$chain$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["chain"])(fromHttp(options ?? {}), fromContainerMetadata(options))().then(setNamedProvider);
        },
        Ec2InstanceMetadata: async (options)=>{
            logger?.debug("@aws-sdk/credential-provider-ini - credential_source is Ec2InstanceMetadata");
            const { fromInstanceMetadata } = await __turbopack_require__("[project]/node_modules/.pnpm/@smithy+credential-provider-imds@3.2.8/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__);
            return async ()=>fromInstanceMetadata(options)().then(setNamedProvider);
        },
        Environment: async (options)=>{
            logger?.debug("@aws-sdk/credential-provider-ini - credential_source is Environment");
            const { fromEnv } = await __turbopack_require__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-env@3.696.0/node_modules/@aws-sdk/credential-provider-env/dist-es/index.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__);
            return async ()=>fromEnv(options)().then(setNamedProvider);
        }
    };
    if (credentialSource in sourceProvidersMap) {
        return sourceProvidersMap[credentialSource];
    } else {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Unsupported credential source in profile ${profileName}. Got ${credentialSource}, ` + `expected EcsContainer or Ec2InstanceMetadata or Environment.`, {
            logger
        });
    }
};
const setNamedProvider = (creds)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_NAMED_PROVIDER", "p");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveAssumeRoleCredentials.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "isAssumeRoleProfile": (()=>isAssumeRoleProfile),
    "resolveAssumeRoleCredentials": (()=>resolveAssumeRoleCredentials)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveCredentialSource$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveCredentialSource.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProfileData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveProfileData.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/getProfileName.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-rsc] (ecmascript)");
;
;
;
;
;
const isAssumeRoleProfile = (arg, { profile = "default", logger } = {})=>{
    return Boolean(arg) && typeof arg === "object" && typeof arg.role_arn === "string" && [
        "undefined",
        "string"
    ].indexOf(typeof arg.role_session_name) > -1 && [
        "undefined",
        "string"
    ].indexOf(typeof arg.external_id) > -1 && [
        "undefined",
        "string"
    ].indexOf(typeof arg.mfa_serial) > -1 && (isAssumeRoleWithSourceProfile(arg, {
        profile,
        logger
    }) || isCredentialSourceProfile(arg, {
        profile,
        logger
    }));
};
const isAssumeRoleWithSourceProfile = (arg, { profile, logger })=>{
    const withSourceProfile = typeof arg.source_profile === "string" && typeof arg.credential_source === "undefined";
    if (withSourceProfile) {
        logger?.debug?.(`    ${profile} isAssumeRoleWithSourceProfile source_profile=${arg.source_profile}`);
    }
    return withSourceProfile;
};
const isCredentialSourceProfile = (arg, { profile, logger })=>{
    const withProviderProfile = typeof arg.credential_source === "string" && typeof arg.source_profile === "undefined";
    if (withProviderProfile) {
        logger?.debug?.(`    ${profile} isCredentialSourceProfile credential_source=${arg.credential_source}`);
    }
    return withProviderProfile;
};
const resolveAssumeRoleCredentials = async (profileName, profiles, options, visitedProfiles = {})=>{
    options.logger?.debug("@aws-sdk/credential-provider-ini - resolveAssumeRoleCredentials (STS)");
    const data = profiles[profileName];
    if (!options.roleAssumer) {
        const { getDefaultRoleAssumer } = await __turbopack_require__("[project]/node_modules/.pnpm/@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/client-sts/dist-es/index.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__);
        options.roleAssumer = getDefaultRoleAssumer({
            ...options.clientConfig,
            credentialProviderLogger: options.logger,
            parentClientConfig: options?.parentClientConfig
        }, options.clientPlugins);
    }
    const { source_profile } = data;
    if (source_profile && source_profile in visitedProfiles) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Detected a cycle attempting to resolve credentials for profile` + ` ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getProfileName"])(options)}. Profiles visited: ` + Object.keys(visitedProfiles).join(", "), {
            logger: options.logger
        });
    }
    options.logger?.debug(`@aws-sdk/credential-provider-ini - finding credential resolver using ${source_profile ? `source_profile=[${source_profile}]` : `profile=[${profileName}]`}`);
    const sourceCredsProvider = source_profile ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProfileData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveProfileData"])(source_profile, profiles, options, {
        ...visitedProfiles,
        [source_profile]: true
    }, isCredentialSourceWithoutRoleArn(profiles[source_profile] ?? {})) : (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveCredentialSource$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveCredentialSource"])(data.credential_source, profileName, options.logger)(options))();
    if (isCredentialSourceWithoutRoleArn(data)) {
        return sourceCredsProvider.then((creds)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_SOURCE_PROFILE", "o"));
    } else {
        const params = {
            RoleArn: data.role_arn,
            RoleSessionName: data.role_session_name || `aws-sdk-js-${Date.now()}`,
            ExternalId: data.external_id,
            DurationSeconds: parseInt(data.duration_seconds || "3600", 10)
        };
        const { mfa_serial } = data;
        if (mfa_serial) {
            if (!options.mfaCodeProvider) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Profile ${profileName} requires multi-factor authentication, but no MFA code callback was provided.`, {
                    logger: options.logger,
                    tryNextLink: false
                });
            }
            params.SerialNumber = mfa_serial;
            params.TokenCode = await options.mfaCodeProvider(mfa_serial);
        }
        const sourceCreds = await sourceCredsProvider;
        return options.roleAssumer(sourceCreds, params).then((creds)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_SOURCE_PROFILE", "o"));
    }
};
const isCredentialSourceWithoutRoleArn = (section)=>{
    return !section.role_arn && !!section.credential_source;
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveProcessCredentials.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "isProcessProfile": (()=>isProcessProfile),
    "resolveProcessCredentials": (()=>resolveProcessCredentials)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-rsc] (ecmascript)");
;
const isProcessProfile = (arg)=>Boolean(arg) && typeof arg === "object" && typeof arg.credential_process === "string";
const resolveProcessCredentials = async (options, profile)=>__turbopack_require__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-process@3.696.0/node_modules/@aws-sdk/credential-provider-process/dist-es/index.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__).then(({ fromProcess })=>fromProcess({
            ...options,
            profile
        })().then((creds)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_PROCESS", "v")));
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveSsoCredentials.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "isSsoProfile": (()=>isSsoProfile),
    "resolveSsoCredentials": (()=>resolveSsoCredentials)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-rsc] (ecmascript)");
;
const resolveSsoCredentials = async (profile, profileData, options = {})=>{
    const { fromSSO } = await __turbopack_require__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-sso@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts@3.699.0_/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__);
    return fromSSO({
        profile,
        logger: options.logger,
        parentClientConfig: options.parentClientConfig,
        clientConfig: options.clientConfig
    })().then((creds)=>{
        if (profileData.sso_session) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_SSO", "r");
        } else {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_SSO_LEGACY", "t");
        }
    });
};
const isSsoProfile = (arg)=>arg && (typeof arg.sso_start_url === "string" || typeof arg.sso_account_id === "string" || typeof arg.sso_session === "string" || typeof arg.sso_region === "string" || typeof arg.sso_role_name === "string");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveStaticCredentials.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "isStaticCredsProfile": (()=>isStaticCredsProfile),
    "resolveStaticCredentials": (()=>resolveStaticCredentials)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-rsc] (ecmascript)");
;
const isStaticCredsProfile = (arg)=>Boolean(arg) && typeof arg === "object" && typeof arg.aws_access_key_id === "string" && typeof arg.aws_secret_access_key === "string" && [
        "undefined",
        "string"
    ].indexOf(typeof arg.aws_session_token) > -1 && [
        "undefined",
        "string"
    ].indexOf(typeof arg.aws_account_id) > -1;
const resolveStaticCredentials = async (profile, options)=>{
    options?.logger?.debug("@aws-sdk/credential-provider-ini - resolveStaticCredentials");
    const credentials = {
        accessKeyId: profile.aws_access_key_id,
        secretAccessKey: profile.aws_secret_access_key,
        sessionToken: profile.aws_session_token,
        ...profile.aws_credential_scope && {
            credentialScope: profile.aws_credential_scope
        },
        ...profile.aws_account_id && {
            accountId: profile.aws_account_id
        }
    };
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(credentials, "CREDENTIALS_PROFILE", "n");
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveWebIdentityCredentials.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "isWebIdentityProfile": (()=>isWebIdentityProfile),
    "resolveWebIdentityCredentials": (()=>resolveWebIdentityCredentials)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+core@3.696.0/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-rsc] (ecmascript)");
;
const isWebIdentityProfile = (arg)=>Boolean(arg) && typeof arg === "object" && typeof arg.web_identity_token_file === "string" && typeof arg.role_arn === "string" && [
        "undefined",
        "string"
    ].indexOf(typeof arg.role_session_name) > -1;
const resolveWebIdentityCredentials = async (profile, options)=>__turbopack_require__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-web-identity@3.696.0_@aws-sdk+client-sts@3.699.0/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/index.js [app-rsc] (ecmascript, async loader)")(__turbopack_import__).then(({ fromTokenFile })=>fromTokenFile({
            webIdentityTokenFile: profile.web_identity_token_file,
            roleArn: profile.role_arn,
            roleSessionName: profile.role_session_name,
            roleAssumerWithWebIdentity: options.roleAssumerWithWebIdentity,
            logger: options.logger,
            parentClientConfig: options.parentClientConfig
        })().then((creds)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$core$40$3$2e$696$2e$0$2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_STS_WEB_ID_TOKEN", "q")));
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveProfileData.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "resolveProfileData": (()=>resolveProfileData)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveAssumeRoleCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveAssumeRoleCredentials.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProcessCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveProcessCredentials.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveSsoCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveSsoCredentials.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveStaticCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveStaticCredentials.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveWebIdentityCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveWebIdentityCredentials.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+property-provider@3.1.11/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
const resolveProfileData = async (profileName, profiles, options, visitedProfiles = {}, isAssumeRoleRecursiveCall = false)=>{
    const data = profiles[profileName];
    if (Object.keys(visitedProfiles).length > 0 && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveStaticCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isStaticCredsProfile"])(data)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveStaticCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveStaticCredentials"])(data, options);
    }
    if (isAssumeRoleRecursiveCall || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveAssumeRoleCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isAssumeRoleProfile"])(data, {
        profile: profileName,
        logger: options.logger
    })) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveAssumeRoleCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveAssumeRoleCredentials"])(profileName, profiles, options, visitedProfiles);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveStaticCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isStaticCredsProfile"])(data)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveStaticCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveStaticCredentials"])(data, options);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveWebIdentityCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isWebIdentityProfile"])(data)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveWebIdentityCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveWebIdentityCredentials"])(data, options);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProcessCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isProcessProfile"])(data)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProcessCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveProcessCredentials"])(options, profileName);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveSsoCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSsoProfile"])(data)) {
        return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveSsoCredentials$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveSsoCredentials"])(profileName, data, options);
    }
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$property$2d$provider$40$3$2e$1$2e$11$2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Could not resolve credentials using profile: [${profileName}] in configuration/credentials file(s).`, {
        logger: options.logger
    });
};
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/fromIni.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromIni": (()=>fromIni)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProfileData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveProfileData.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/parseKnownFiles.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@smithy+shared-ini-file-loader@3.1.12/node_modules/@smithy/shared-ini-file-loader/dist-es/getProfileName.js [app-rsc] (ecmascript)");
;
;
const fromIni = (init = {})=>async ()=>{
        init.logger?.debug("@aws-sdk/credential-provider-ini - fromIni");
        const profiles = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseKnownFiles"])(init);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProfileData$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["resolveProfileData"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$smithy$2b$shared$2d$ini$2d$file$2d$loader$40$3$2e$1$2e$12$2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getProfileName"])(init), profiles, init);
    };
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/index.js [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({});
;
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$fromIni$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/fromIni.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/index.js [app-rsc] (ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromIni": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$fromIni$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fromIni"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$fromIni$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/fromIni.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/index.js [app-rsc] (ecmascript) <locals>");
}}),
"[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/index.js [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, t: require } = __turbopack_context__;
{
__turbopack_esm__({
    "fromIni": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__["fromIni"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/index.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$aws$2d$sdk$2b$credential$2d$provider$2d$ini$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sso$2d$oidc$40$3$2e$699$2e$0_$40$aws$2d$sdk$2b$client$2d$sts_2guavycxfirw3d2d2k6433ciba$2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$exports$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@aws-sdk+credential-provider-ini@3.699.0_@aws-sdk+client-sso-oidc@3.699.0_@aws-sdk+client-sts_2guavycxfirw3d2d2k6433ciba/node_modules/@aws-sdk/credential-provider-ini/dist-es/index.js [app-rsc] (ecmascript) <exports>");
}}),

};

//# sourceMappingURL=e529b_%40aws-sdk_credential-provider-ini_dist-es_063893._.js.map