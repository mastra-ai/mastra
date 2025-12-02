"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceServiceRecognizer = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../common/Exports.js");
const Exports_js_3 = require("../sdk/Exports.js");
const Exports_js_4 = require("./Exports.js");
const SpeechConnectionMessage_Internal_js_1 = require("./SpeechConnectionMessage.Internal.js");
// eslint-disable-next-line max-classes-per-file
class VoiceServiceRecognizer extends Exports_js_4.ServiceRecognizerBase {
    constructor(authentication, connectionFactory, audioSource, recognizerConfig, recognizer) {
        super(authentication, connectionFactory, audioSource, recognizerConfig, recognizer);
        this.privDeferralMap = new Exports_js_2.DeferralMap();
        this.privSpeakerAudioSource = audioSource;
        this.sendPrePayloadJSONOverride = () => this.noOp();
    }
    set SpeakerAudioSource(audioSource) {
        this.privSpeakerAudioSource = audioSource;
    }
    processTypeSpecificMessages(connectionMessage) {
        let processed = false;
        const resultProps = new Exports_js_3.PropertyCollection();
        if (connectionMessage.messageType === Exports_js_2.MessageType.Text) {
            resultProps.setProperty(Exports_js_3.PropertyId.SpeechServiceResponse_JsonResult, connectionMessage.textBody);
        }
        switch (connectionMessage.path.toLowerCase()) {
            // Profile management response for create, fetch, delete, reset
            case "speaker.profiles":
                const response = JSON.parse(connectionMessage.textBody);
                switch (response.operation.toLowerCase()) {
                    case "create":
                        this.handleCreateResponse(response, connectionMessage.requestId);
                        break;
                    case "delete":
                    case "reset":
                        this.handleResultResponse(response, connectionMessage.requestId);
                        break;
                    case "fetch":
                        const enrollmentResponse = JSON.parse(connectionMessage.textBody);
                        this.handleFetchResponse(enrollmentResponse, connectionMessage.requestId);
                        break;
                    default:
                        break;
                }
                processed = true;
                break;
            // Activation and authorization phrase response
            case "speaker.phrases":
                const phraseResponse = JSON.parse(connectionMessage.textBody);
                this.handlePhrasesResponse(phraseResponse, connectionMessage.requestId);
                processed = true;
                break;
            // Enrollment response
            case "speaker.profile.enrollment":
                const enrollmentResponse = JSON.parse(connectionMessage.textBody);
                const result = new Exports_js_3.VoiceProfileEnrollmentResult(this.enrollmentReasonFrom(!!enrollmentResponse.enrollment ? enrollmentResponse.enrollment.enrollmentStatus : enrollmentResponse.status.statusCode), !!enrollmentResponse.enrollment ? JSON.stringify(enrollmentResponse.enrollment) : undefined, enrollmentResponse.status.reason);
                if (!!this.privDeferralMap.getId(connectionMessage.requestId)) {
                    this.privDeferralMap.complete(connectionMessage.requestId, result);
                }
                this.privRequestSession.onSpeechEnded();
                processed = true;
                break;
            default:
                break;
        }
        const defferal = new Exports_js_2.Deferred();
        defferal.resolve(processed);
        return defferal.promise;
    }
    // Cancels recognition.
    cancelRecognition(sessionId, requestId, cancellationReason, errorCode, error) {
        const properties = new Exports_js_3.PropertyCollection();
        // const enrollmentResponse: EnrollmentResponse = JSON.parse(connectionMessage.textBody) as EnrollmentResponse;
        properties.setProperty(Exports_js_4.CancellationErrorCodePropertyName, Exports_js_3.CancellationErrorCode[errorCode]);
        const result = new Exports_js_3.VoiceProfileEnrollmentResult(Exports_js_3.ResultReason.Canceled, error, error);
        if (!!this.privDeferralMap.getId(requestId)) {
            this.privDeferralMap.complete(requestId, result);
        }
    }
    async createProfile(profileType, locale) {
        // Start the connection to the service. The promise this will create is stored and will be used by configureConnection().
        this.voiceProfileType = profileType.toString();
        const conPromise = this.connectImpl();
        try {
            const createProfileDeferral = new Exports_js_2.Deferred();
            await conPromise;
            await this.sendCreateProfile(createProfileDeferral, profileType, locale);
            void this.receiveMessage();
            return createProfileDeferral.promise;
        }
        catch (err) {
            throw err;
        }
    }
    async resetProfile(profile) {
        this.voiceProfileType = profile.profileType.toString();
        return this.sendCommonRequest("reset", profile.profileType, profile);
    }
    async deleteProfile(profile) {
        this.voiceProfileType = profile.profileType.toString();
        return this.sendCommonRequest("delete", profile.profileType, profile);
    }
    async retrieveEnrollmentResult(profile) {
        this.voiceProfileType = profile.profileType.toString();
        this.privExpectedProfileId = profile.profileId;
        return this.sendCommonRequest("fetch", profile.profileType, profile);
    }
    async getAllProfiles(profileType) {
        this.voiceProfileType = profileType.toString();
        return this.sendCommonRequest("fetch", profileType);
    }
    async getActivationPhrases(profileType, lang) {
        this.voiceProfileType = profileType.toString();
        // Start the connection to the service. The promise this will create is stored and will be used by configureConnection().
        const conPromise = this.connectImpl();
        try {
            const getPhrasesDeferral = new Exports_js_2.Deferred();
            await conPromise;
            await this.sendPhrasesRequest(getPhrasesDeferral, profileType, lang);
            void this.receiveMessage();
            return getPhrasesDeferral.promise;
        }
        catch (err) {
            throw err;
        }
    }
    async enrollProfile(profile) {
        this.voiceProfileType = profile.profileType.toString();
        const enrollmentDeferral = new Exports_js_2.Deferred();
        this.privRequestSession.startNewRecognition();
        this.privRequestSession.listenForServiceTelemetry(this.privSpeakerAudioSource.events);
        this.privRecognizerConfig.parameters.setProperty(Exports_js_3.PropertyId.Speech_SessionId, this.privRequestSession.sessionId);
        // Start the connection to the service. The promise this will create is stored and will be used by configureConnection().
        const conPromise = this.connectImpl();
        const preAudioPromise = this.sendPreAudioMessages(profile, enrollmentDeferral);
        const node = await this.privSpeakerAudioSource.attach(this.privRequestSession.audioNodeId);
        const format = await this.privSpeakerAudioSource.format;
        const deviceInfo = await this.privSpeakerAudioSource.deviceInfo;
        const audioNode = new Exports_js_1.ReplayableAudioNode(node, format.avgBytesPerSec);
        await this.privRequestSession.onAudioSourceAttachCompleted(audioNode, false);
        this.privRecognizerConfig.SpeechServiceConfig.Context.audio = { source: deviceInfo };
        try {
            await conPromise;
            await preAudioPromise;
        }
        catch (err) {
            this.cancelRecognition(this.privRequestSession.sessionId, this.privRequestSession.requestId, Exports_js_3.CancellationReason.Error, Exports_js_3.CancellationErrorCode.ConnectionFailure, err);
        }
        const sessionStartEventArgs = new Exports_js_3.SessionEventArgs(this.privRequestSession.sessionId);
        if (!!this.privRecognizer.sessionStarted) {
            this.privRecognizer.sessionStarted(this.privRecognizer, sessionStartEventArgs);
        }
        void this.receiveMessage();
        const audioSendPromise = this.sendAudio(audioNode);
        // /* eslint-disable no-empty */
        audioSendPromise.then(() => { }, (error) => {
            this.cancelRecognition(this.privRequestSession.sessionId, this.privRequestSession.requestId, Exports_js_3.CancellationReason.Error, Exports_js_3.CancellationErrorCode.RuntimeError, error);
        });
        return enrollmentDeferral.promise;
    }
    async sendPreAudioMessages(profile, enrollmentDeferral) {
        const connection = await this.fetchConnection();
        this.privRequestSession.onSpeechContext();
        this.privDeferralMap.add(this.privRequestSession.requestId, enrollmentDeferral);
        await this.sendBaseRequest(connection, "enroll", this.scenarioFrom(profile.profileType), profile);
    }
    async sendPhrasesRequest(getPhrasesDeferral, profileType, locale) {
        const connection = await this.fetchConnection();
        this.privRequestSession.onSpeechContext();
        this.privDeferralMap.add(this.privRequestSession.requestId, getPhrasesDeferral);
        const scenario = this.scenarioFrom(profileType);
        const profileCreateRequest = {
            locale,
            scenario,
        };
        return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Text, "speaker.profile.phrases", this.privRequestSession.requestId, "application/json; charset=utf-8", JSON.stringify(profileCreateRequest)));
    }
    async sendCreateProfile(createProfileDeferral, profileType, locale) {
        const connection = await this.fetchConnection();
        this.privRequestSession.onSpeechContext();
        this.privDeferralMap.add(this.privRequestSession.requestId, createProfileDeferral);
        const scenario = profileType === Exports_js_3.VoiceProfileType.TextIndependentIdentification ? "TextIndependentIdentification" :
            profileType === Exports_js_3.VoiceProfileType.TextIndependentVerification ? "TextIndependentVerification" : "TextDependentVerification";
        const profileCreateRequest = {
            locale,
            number: "1",
            scenario,
        };
        return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Text, "speaker.profile.create", this.privRequestSession.requestId, "application/json; charset=utf-8", JSON.stringify(profileCreateRequest)));
    }
    async sendCommonRequest(operation, profileType, profile = undefined) {
        // Start the connection to the service. The promise this will create is stored and will be used by configureConnection().
        const conPromise = this.connectImpl();
        try {
            const deferral = new Exports_js_2.Deferred();
            this.privRequestSession.onSpeechContext();
            await conPromise;
            const connection = await this.fetchConnection();
            this.privDeferralMap.add(this.privRequestSession.requestId, deferral);
            await this.sendBaseRequest(connection, operation, this.scenarioFrom(profileType), profile);
            void this.receiveMessage();
            return deferral.promise;
        }
        catch (err) {
            throw err;
        }
    }
    async sendBaseRequest(connection, operation, scenario, profile) {
        const profileRequest = {
            scenario
        };
        if (!!profile) {
            profileRequest.profileIds = [profile.profileId];
        }
        else {
            profileRequest.maxPageSize = -1;
        }
        return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_2.MessageType.Text, `speaker.profile.${operation}`, this.privRequestSession.requestId, "application/json; charset=utf-8", JSON.stringify(profileRequest)));
    }
    extractSpeakerContext(model) {
        return {
            features: {
                interimResult: "enabled",
                progressiveDetection: "disabled",
            },
            profileIds: model.profileIds,
            scenario: model.scenario,
        };
    }
    handlePhrasesResponse(response, requestId) {
        if (!!this.privDeferralMap.getId(requestId)) {
            if (response.status.statusCode.toLowerCase() !== "success") {
                const reason = Exports_js_3.ResultReason.Canceled;
                const result = new Exports_js_3.VoiceProfilePhraseResult(reason, response.status.statusCode, response.passPhraseType, []);
                this.privDeferralMap.complete(requestId, result);
            }
            else if (!!response.phrases && response.phrases.length > 0) {
                const reason = Exports_js_3.ResultReason.EnrollingVoiceProfile;
                const result = new Exports_js_3.VoiceProfilePhraseResult(reason, response.status.statusCode, response.passPhraseType, response.phrases);
                this.privDeferralMap.complete(requestId, result);
            }
            else {
                throw new Error("Voice Profile get activation phrases failed, no phrases received");
            }
        }
        else {
            throw new Error(`Voice Profile get activation phrases request for requestID ${requestId} not found`);
        }
    }
    handleCreateResponse(response, requestId) {
        if (!!response.profiles && response.profiles.length > 0) {
            if (!!this.privDeferralMap.getId(requestId)) {
                const profileIds = response.profiles.map((profile) => profile.profileId);
                this.privDeferralMap.complete(requestId, profileIds);
            }
            else {
                throw new Error(`Voice Profile create request for requestID ${requestId} not found`);
            }
        }
        else {
            throw new Error("Voice Profile create failed, no profile id received");
        }
    }
    handleResultResponse(response, requestId) {
        if (!!this.privDeferralMap.getId(requestId)) {
            const successReason = response.operation.toLowerCase() === "delete" ? Exports_js_3.ResultReason.DeletedVoiceProfile : Exports_js_3.ResultReason.ResetVoiceProfile;
            const reason = response.status.statusCode.toLowerCase() === "success" ? successReason : Exports_js_3.ResultReason.Canceled;
            const result = new Exports_js_3.VoiceProfileResult(reason, `statusCode: ${response.status.statusCode}, errorDetails: ${response.status.reason}`);
            this.privDeferralMap.complete(requestId, result);
        }
        else {
            throw new Error(`Voice Profile create request for requestID ${requestId} not found`);
        }
    }
    handleFetchResponse(enrollmentResponse, requestId) {
        if (!!this.privDeferralMap.getId(requestId) && !!enrollmentResponse.profiles[0]) {
            if (!!this.privExpectedProfileId && enrollmentResponse.profiles.length === 1 && enrollmentResponse.profiles[0].profileId === this.privExpectedProfileId) {
                this.privExpectedProfileId = undefined;
                const profileInfo = enrollmentResponse.profiles[0];
                const result = new Exports_js_3.VoiceProfileEnrollmentResult(this.enrollmentReasonFrom(profileInfo.enrollmentStatus), JSON.stringify(profileInfo), enrollmentResponse.status.reason);
                this.privDeferralMap.complete(requestId, result);
            }
            else if (enrollmentResponse.profiles.length > 0) {
                const iProfiles = enrollmentResponse.profiles;
                const profileResults = [];
                for (const profile of iProfiles) {
                    profileResults.push(new Exports_js_3.VoiceProfileEnrollmentResult(this.enrollmentReasonFrom(profile.enrollmentStatus), JSON.stringify(profile), enrollmentResponse.status.reason));
                }
                this.privDeferralMap.complete(requestId, profileResults);
            }
        }
        else {
            throw new Error(`Voice Profile fetch request for requestID ${requestId} not found`);
        }
    }
    enrollmentReasonFrom(statusCode) {
        switch (statusCode.toLowerCase()) {
            case "enrolled":
                return Exports_js_3.ResultReason.EnrolledVoiceProfile;
            case "invalidlocale":
            case "invalidphrase":
            case "invalidaudioformat":
            case "invalidscenario":
            case "invalidprofilecount":
            case "invalidoperation":
            case "audiotooshort":
            case "audiotoolong":
            case "toomanyenrollments":
            case "storageconflict":
            case "profilenotfound":
            case "incompatibleprofiles":
            case "incompleteenrollment":
                return Exports_js_3.ResultReason.Canceled;
            default:
                return Exports_js_3.ResultReason.EnrollingVoiceProfile;
        }
    }
    scenarioFrom(profileType) {
        return profileType === Exports_js_3.VoiceProfileType.TextIndependentIdentification ? "TextIndependentIdentification" :
            profileType === Exports_js_3.VoiceProfileType.TextIndependentVerification ? "TextIndependentVerification" : "TextDependentVerification";
    }
}
exports.VoiceServiceRecognizer = VoiceServiceRecognizer;

//# sourceMappingURL=VoiceServiceRecognizer.js.map
