"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesisRequest = exports.Synthesizer = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const Exports_js_2 = require("../common/Exports.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_3 = require("./Exports.js");
class Synthesizer {
    /**
     * Creates and initializes an instance of a Recognizer
     * @constructor
     * @param {SpeechConfig} speechConfig - The speech config to initialize the synthesizer.
     */
    constructor(speechConfig) {
        const speechConfigImpl = speechConfig;
        Contracts_js_1.Contracts.throwIfNull(speechConfigImpl, "speechConfig");
        this.privProperties = speechConfigImpl.properties.clone();
        this.privDisposed = false;
        this.privSynthesizing = false;
        this.synthesisRequestQueue = new Exports_js_2.Queue();
        this.tokenCredential = speechConfig.tokenCredential;
    }
    /**
     * Gets the authorization token used to communicate with the service.
     * @member Synthesizer.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken() {
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token);
    }
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member Synthesizer.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(token, "token");
        this.properties.setProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token, token);
    }
    /**
     * The collection of properties and their values defined for this Synthesizer.
     * @member Synthesizer.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this SpeechSynthesizer.
     */
    get properties() {
        return this.privProperties;
    }
    /**
     * Indicates if auto detect source language is enabled
     * @member Synthesizer.prototype.autoDetectSourceLanguage
     * @function
     * @public
     * @returns {boolean} if auto detect source language is enabled
     */
    get autoDetectSourceLanguage() {
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguages) === Exports_js_1.AutoDetectSourceLanguagesOpenRangeOptionName;
    }
    buildSsml(text) {
        const languageToDefaultVoice = {
            ["af-ZA"]: "af-ZA-AdriNeural",
            ["am-ET"]: "am-ET-AmehaNeural",
            ["ar-AE"]: "ar-AE-FatimaNeural",
            ["ar-BH"]: "ar-BH-AliNeural",
            ["ar-DZ"]: "ar-DZ-AminaNeural",
            ["ar-EG"]: "ar-EG-SalmaNeural",
            ["ar-IQ"]: "ar-IQ-BasselNeural",
            ["ar-JO"]: "ar-JO-SanaNeural",
            ["ar-KW"]: "ar-KW-FahedNeural",
            ["ar-LY"]: "ar-LY-ImanNeural",
            ["ar-MA"]: "ar-MA-JamalNeural",
            ["ar-QA"]: "ar-QA-AmalNeural",
            ["ar-SA"]: "ar-SA-HamedNeural",
            ["ar-SY"]: "ar-SY-AmanyNeural",
            ["ar-TN"]: "ar-TN-HediNeural",
            ["ar-YE"]: "ar-YE-MaryamNeural",
            ["bg-BG"]: "bg-BG-BorislavNeural",
            ["bn-BD"]: "bn-BD-NabanitaNeural",
            ["bn-IN"]: "bn-IN-BashkarNeural",
            ["ca-ES"]: "ca-ES-JoanaNeural",
            ["cs-CZ"]: "cs-CZ-AntoninNeural",
            ["cy-GB"]: "cy-GB-AledNeural",
            ["da-DK"]: "da-DK-ChristelNeural",
            ["de-AT"]: "de-AT-IngridNeural",
            ["de-CH"]: "de-CH-JanNeural",
            ["de-DE"]: "de-DE-KatjaNeural",
            ["el-GR"]: "el-GR-AthinaNeural",
            ["en-AU"]: "en-AU-NatashaNeural",
            ["en-CA"]: "en-CA-ClaraNeural",
            ["en-GB"]: "en-GB-LibbyNeural",
            ["en-HK"]: "en-HK-SamNeural",
            ["en-IE"]: "en-IE-ConnorNeural",
            ["en-IN"]: "en-IN-NeerjaNeural",
            ["en-KE"]: "en-KE-AsiliaNeural",
            ["en-NG"]: "en-NG-AbeoNeural",
            ["en-NZ"]: "en-NZ-MitchellNeural",
            ["en-PH"]: "en-PH-JamesNeural",
            ["en-SG"]: "en-SG-LunaNeural",
            ["en-TZ"]: "en-TZ-ElimuNeural",
            ["en-US"]: "en-US-AvaMultilingualNeural",
            ["en-ZA"]: "en-ZA-LeahNeural",
            ["es-AR"]: "es-AR-ElenaNeural",
            ["es-BO"]: "es-BO-MarceloNeural",
            ["es-CL"]: "es-CL-CatalinaNeural",
            ["es-CO"]: "es-CO-GonzaloNeural",
            ["es-CR"]: "es-CR-JuanNeural",
            ["es-CU"]: "es-CU-BelkysNeural",
            ["es-DO"]: "es-DO-EmilioNeural",
            ["es-EC"]: "es-EC-AndreaNeural",
            ["es-ES"]: "es-ES-AlvaroNeural",
            ["es-GQ"]: "es-GQ-JavierNeural",
            ["es-GT"]: "es-GT-AndresNeural",
            ["es-HN"]: "es-HN-CarlosNeural",
            ["es-MX"]: "es-MX-DaliaNeural",
            ["es-NI"]: "es-NI-FedericoNeural",
            ["es-PA"]: "es-PA-MargaritaNeural",
            ["es-PE"]: "es-PE-AlexNeural",
            ["es-PR"]: "es-PR-KarinaNeural",
            ["es-PY"]: "es-PY-MarioNeural",
            ["es-SV"]: "es-SV-LorenaNeural",
            ["es-US"]: "es-US-AlonsoNeural",
            ["es-UY"]: "es-UY-MateoNeural",
            ["es-VE"]: "es-VE-PaolaNeural",
            ["et-EE"]: "et-EE-AnuNeural",
            ["fa-IR"]: "fa-IR-DilaraNeural",
            ["fi-FI"]: "fi-FI-SelmaNeural",
            ["fil-PH"]: "fil-PH-AngeloNeural",
            ["fr-BE"]: "fr-BE-CharlineNeural",
            ["fr-CA"]: "fr-CA-SylvieNeural",
            ["fr-CH"]: "fr-CH-ArianeNeural",
            ["fr-FR"]: "fr-FR-DeniseNeural",
            ["ga-IE"]: "ga-IE-ColmNeural",
            ["gl-ES"]: "gl-ES-RoiNeural",
            ["gu-IN"]: "gu-IN-DhwaniNeural",
            ["he-IL"]: "he-IL-AvriNeural",
            ["hi-IN"]: "hi-IN-MadhurNeural",
            ["hr-HR"]: "hr-HR-GabrijelaNeural",
            ["hu-HU"]: "hu-HU-NoemiNeural",
            ["id-ID"]: "id-ID-ArdiNeural",
            ["is-IS"]: "is-IS-GudrunNeural",
            ["it-IT"]: "it-IT-IsabellaNeural",
            ["ja-JP"]: "ja-JP-NanamiNeural",
            ["jv-ID"]: "jv-ID-DimasNeural",
            ["kk-KZ"]: "kk-KZ-AigulNeural",
            ["km-KH"]: "km-KH-PisethNeural",
            ["kn-IN"]: "kn-IN-GaganNeural",
            ["ko-KR"]: "ko-KR-SunHiNeural",
            ["lo-LA"]: "lo-LA-ChanthavongNeural",
            ["lt-LT"]: "lt-LT-LeonasNeural",
            ["lv-LV"]: "lv-LV-EveritaNeural",
            ["mk-MK"]: "mk-MK-AleksandarNeural",
            ["ml-IN"]: "ml-IN-MidhunNeural",
            ["mr-IN"]: "mr-IN-AarohiNeural",
            ["ms-MY"]: "ms-MY-OsmanNeural",
            ["mt-MT"]: "mt-MT-GraceNeural",
            ["my-MM"]: "my-MM-NilarNeural",
            ["nb-NO"]: "nb-NO-PernilleNeural",
            ["nl-BE"]: "nl-BE-ArnaudNeural",
            ["nl-NL"]: "nl-NL-ColetteNeural",
            ["pl-PL"]: "pl-PL-AgnieszkaNeural",
            ["ps-AF"]: "ps-AF-GulNawazNeural",
            ["pt-BR"]: "pt-BR-FranciscaNeural",
            ["pt-PT"]: "pt-PT-DuarteNeural",
            ["ro-RO"]: "ro-RO-AlinaNeural",
            ["ru-RU"]: "ru-RU-SvetlanaNeural",
            ["si-LK"]: "si-LK-SameeraNeural",
            ["sk-SK"]: "sk-SK-LukasNeural",
            ["sl-SI"]: "sl-SI-PetraNeural",
            ["so-SO"]: "so-SO-MuuseNeural",
            ["sr-RS"]: "sr-RS-NicholasNeural",
            ["su-ID"]: "su-ID-JajangNeural",
            ["sv-SE"]: "sv-SE-SofieNeural",
            ["sw-KE"]: "sw-KE-RafikiNeural",
            ["sw-TZ"]: "sw-TZ-DaudiNeural",
            ["ta-IN"]: "ta-IN-PallaviNeural",
            ["ta-LK"]: "ta-LK-KumarNeural",
            ["ta-SG"]: "ta-SG-AnbuNeural",
            ["te-IN"]: "te-IN-MohanNeural",
            ["th-TH"]: "th-TH-PremwadeeNeural",
            ["tr-TR"]: "tr-TR-AhmetNeural",
            ["uk-UA"]: "uk-UA-OstapNeural",
            ["ur-IN"]: "ur-IN-GulNeural",
            ["ur-PK"]: "ur-PK-AsadNeural",
            ["uz-UZ"]: "uz-UZ-MadinaNeural",
            ["vi-VN"]: "vi-VN-HoaiMyNeural",
            ["zh-CN"]: "zh-CN-XiaoxiaoNeural",
            ["zh-HK"]: "zh-HK-HiuMaanNeural",
            ["zh-TW"]: "zh-TW-HsiaoChenNeural",
            ["zu-ZA"]: "zu-ZA-ThandoNeural",
        };
        let language = this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_SynthLanguage, "en-US");
        let voice = this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_SynthVoice, "");
        let ssml = Synthesizer.XMLEncode(text);
        if (this.autoDetectSourceLanguage) {
            language = "en-US";
        }
        else {
            voice = voice || languageToDefaultVoice[language];
        }
        if (voice) {
            ssml = `<voice name='${voice}'>${ssml}</voice>`;
        }
        ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xmlns:emo='http://www.w3.org/2009/10/emotionml' xml:lang='${language}'>${ssml}</speak>`;
        return ssml;
    }
    /**
     * This method performs cleanup of resources.
     * The Boolean parameter disposing indicates whether the method is called
     * from Dispose (if disposing is true) or from the finalizer (if disposing is false).
     * Derived classes should override this method to dispose resource if needed.
     * @member Synthesizer.prototype.dispose
     * @function
     * @public
     * @param {boolean} disposing - Flag to request disposal.
     */
    async dispose(disposing) {
        if (this.privDisposed) {
            return;
        }
        if (disposing) {
            if (this.privAdapter) {
                await this.privAdapter.dispose();
            }
        }
        this.privDisposed = true;
    }
    async adapterSpeak() {
        if (!this.privDisposed && !this.privSynthesizing) {
            this.privSynthesizing = true;
            const request = await this.synthesisRequestQueue.dequeue();
            return this.privAdapter.Speak(request.text, request.isSSML, request.requestId, request.cb, request.err, request.dataStream);
        }
    }
    createSynthesizerConfig(speechConfig) {
        return new Exports_js_1.SynthesizerConfig(speechConfig, this.privProperties);
    }
    // Does the generic synthesizer setup that is common across all synthesizer types.
    implCommonSynthesizeSetup() {
        let osPlatform = (typeof window !== "undefined") ? "Browser" : "Node";
        let osName = "unknown";
        let osVersion = "unknown";
        if (typeof navigator !== "undefined") {
            osPlatform = osPlatform + "/" + navigator.platform;
            osName = navigator.userAgent;
            osVersion = navigator.appVersion;
        }
        const synthesizerConfig = this.createSynthesizerConfig(new Exports_js_1.SpeechServiceConfig(new Exports_js_1.Context(new Exports_js_1.OS(osPlatform, osName, osVersion))));
        const subscriptionKey = this.privProperties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_Key, undefined);
        const authentication = (subscriptionKey && subscriptionKey !== "")
            ? new Exports_js_1.CognitiveSubscriptionKeyAuthentication(subscriptionKey)
            : (this.tokenCredential)
                ? new Exports_js_1.CognitiveTokenAuthentication(async () => {
                    try {
                        const tokenResponse = await this.tokenCredential.getToken("https://cognitiveservices.azure.com/.default");
                        return tokenResponse?.token ?? "";
                    }
                    catch (err) {
                        throw err;
                    }
                }, async () => {
                    try {
                        const tokenResponse = await this.tokenCredential.getToken("https://cognitiveservices.azure.com/.default");
                        return tokenResponse?.token ?? "";
                    }
                    catch (err) {
                        throw err;
                    }
                })
                : new Exports_js_1.CognitiveTokenAuthentication(() => {
                    const authorizationToken = this.privProperties.getProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token, undefined);
                    return Promise.resolve(authorizationToken);
                }, () => {
                    const authorizationToken = this.privProperties.getProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token, undefined);
                    return Promise.resolve(authorizationToken);
                });
        this.privAdapter = this.createSynthesisAdapter(authentication, this.privConnectionFactory, synthesizerConfig);
        this.privRestAdapter = this.createRestSynthesisAdapter(authentication, synthesizerConfig);
    }
    static XMLEncode(text) {
        return text.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }
}
exports.Synthesizer = Synthesizer;
class SynthesisRequest {
    constructor(requestId, text, isSSML, cb, err, dataStream) {
        this.requestId = requestId;
        this.text = text;
        this.isSSML = isSSML;
        this.cb = cb;
        this.err = err;
        this.dataStream = dataStream;
    }
}
exports.SynthesisRequest = SynthesisRequest;

//# sourceMappingURL=Synthesizer.js.map
