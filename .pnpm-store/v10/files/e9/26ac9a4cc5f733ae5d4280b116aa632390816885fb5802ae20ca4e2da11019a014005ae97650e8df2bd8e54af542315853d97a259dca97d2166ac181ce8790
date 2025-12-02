"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Recognizer = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const Exports_js_2 = require("../common/Exports.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_3 = require("./Exports.js");
/**
 * Defines the base class Recognizer which mainly contains common event handlers.
 * @class Recognizer
 */
class Recognizer {
    /**
     * Creates and initializes an instance of a Recognizer
     * @constructor
     * @param {AudioConfig} audioInput - An optional audio input stream associated with the recognizer
     * @param {PropertyCollection} properties - A set of properties to set on the recognizer
     * @param {IConnectionFactory} connectionFactory - The factory class used to create a custom IConnection for the recognizer
     */
    constructor(audioConfig, properties, connectionFactory, tokenCredential) {
        this.audioConfig = (audioConfig !== undefined) ? audioConfig : Exports_js_3.AudioConfig.fromDefaultMicrophoneInput();
        this.privDisposed = false;
        this.privProperties = properties.clone();
        this.privConnectionFactory = connectionFactory;
        this.tokenCredential = tokenCredential;
        this.implCommonRecognizerSetup();
    }
    /**
     * Dispose of associated resources.
     * @member Recognizer.prototype.close
     * @function
     * @public
     */
    close(cb, errorCb) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposed);
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.dispose(true), cb, errorCb);
    }
    /**
     * @Internal
     * Internal data member to support fromRecognizer* pattern methods on other classes.
     * Do not use externally, object returned will change without warning or notice.
     */
    get internalData() {
        return this.privReco;
    }
    /**
     * This method performs cleanup of resources.
     * The Boolean parameter disposing indicates whether the method is called
     * from Dispose (if disposing is true) or from the finalizer (if disposing is false).
     * Derived classes should override this method to dispose resource if needed.
     * @member Recognizer.prototype.dispose
     * @function
     * @public
     * @param {boolean} disposing - Flag to request disposal.
     */
    async dispose(disposing) {
        if (this.privDisposed) {
            return;
        }
        this.privDisposed = true;
        if (disposing) {
            if (this.privReco) {
                await this.privReco.audioSource.turnOff();
                await this.privReco.dispose();
            }
        }
    }
    /**
     * This method returns the current state of the telemetry setting.
     * @member Recognizer.prototype.telemetryEnabled
     * @function
     * @public
     * @returns true if the telemetry is enabled, false otherwise.
     */
    static get telemetryEnabled() {
        return Exports_js_1.ServiceRecognizerBase.telemetryDataEnabled;
    }
    /**
     * This method globally enables or disables telemetry.
     * @member Recognizer.prototype.enableTelemetry
     * @function
     * @public
     * @param enabled - Global setting for telemetry collection.
     * If set to true, telemetry information like microphone errors,
     * recognition errors are collected and sent to Microsoft.
     * If set to false, no telemetry is sent to Microsoft.
     */
    static enableTelemetry(enabled) {
        Exports_js_1.ServiceRecognizerBase.telemetryDataEnabled = enabled;
    }
    // Does the generic recognizer setup that is common across all recognizer types.
    implCommonRecognizerSetup() {
        let osPlatform = (typeof window !== "undefined") ? "Browser" : "Node";
        let osName = "unknown";
        let osVersion = "unknown";
        if (typeof navigator !== "undefined") {
            osPlatform = osPlatform + "/" + navigator.platform;
            osName = navigator.userAgent;
            osVersion = navigator.appVersion;
        }
        const recognizerConfig = this.createRecognizerConfig(new Exports_js_1.SpeechServiceConfig(new Exports_js_1.Context(new Exports_js_1.OS(osPlatform, osName, osVersion))));
        this.privReco = this.createServiceRecognizer(Recognizer.getAuth(this.privProperties, this.tokenCredential), this.privConnectionFactory, this.audioConfig, recognizerConfig);
    }
    async recognizeOnceAsyncImpl(recognitionMode) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposed);
        const ret = new Exports_js_2.Deferred();
        await this.implRecognizerStop();
        await this.privReco.recognize(recognitionMode, ret.resolve, ret.reject);
        const result = await ret.promise;
        await this.implRecognizerStop();
        return result;
    }
    async startContinuousRecognitionAsyncImpl(recognitionMode) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposed);
        await this.implRecognizerStop();
        await this.privReco.recognize(recognitionMode, undefined, undefined);
    }
    async stopContinuousRecognitionAsyncImpl() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposed);
        await this.implRecognizerStop();
    }
    async implRecognizerStop() {
        if (this.privReco) {
            await this.privReco.stopRecognizing();
        }
        return;
    }
    static getAuth(properties, tokenCredential) {
        const subscriptionKey = properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_Key, undefined);
        if (subscriptionKey && subscriptionKey !== "") {
            return new Exports_js_1.CognitiveSubscriptionKeyAuthentication(subscriptionKey);
        }
        if (tokenCredential) {
            return new Exports_js_1.CognitiveTokenAuthentication(async () => {
                try {
                    const tokenResponse = await tokenCredential.getToken("https://cognitiveservices.azure.com/.default");
                    return tokenResponse?.token ?? "";
                }
                catch (err) {
                    throw err;
                }
            }, async () => {
                try {
                    const tokenResponse = await tokenCredential.getToken("https://cognitiveservices.azure.com/.default");
                    return tokenResponse?.token ?? "";
                }
                catch (err) {
                    throw err;
                }
            });
        }
        return new Exports_js_1.CognitiveTokenAuthentication(() => {
            const authorizationToken = properties.getProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token, undefined);
            return Promise.resolve(authorizationToken);
        }, () => {
            const authorizationToken = properties.getProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token, undefined);
            return Promise.resolve(authorizationToken);
        });
    }
}
exports.Recognizer = Recognizer;

//# sourceMappingURL=Recognizer.js.map
