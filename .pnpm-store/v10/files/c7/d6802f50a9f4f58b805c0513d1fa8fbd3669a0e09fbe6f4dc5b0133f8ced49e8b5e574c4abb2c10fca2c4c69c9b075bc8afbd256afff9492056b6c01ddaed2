"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationServiceAdapter = void 0;
const Exports_js_1 = require("../../common/Exports.js");
const Exports_js_2 = require("../../sdk/Exports.js");
const Exports_js_3 = require("../Exports.js");
const ConversationConnectionMessage_js_1 = require("./ConversationConnectionMessage.js");
const ConversationRequestSession_js_1 = require("./ConversationRequestSession.js");
const ConversationTranslatorEventArgs_js_1 = require("./ConversationTranslatorEventArgs.js");
const ConversationTranslatorInterfaces_js_1 = require("./ConversationTranslatorInterfaces.js");
const Exports_js_4 = require("./ServiceMessages/Exports.js");
/**
 * The service adapter handles sending and receiving messages to the Conversation Translator websocket.
 */
class ConversationServiceAdapter extends Exports_js_3.ServiceRecognizerBase {
    constructor(authentication, connectionFactory, audioSource, recognizerConfig, conversationServiceConnector) {
        super(authentication, connectionFactory, audioSource, recognizerConfig, conversationServiceConnector);
        this.privConnectionConfigPromise = undefined;
        this.privLastPartialUtteranceId = "";
        this.privConversationServiceConnector = conversationServiceConnector;
        this.privConversationAuthentication = authentication;
        this.receiveMessageOverride = () => this.receiveConversationMessageOverride();
        this.recognizeOverride = () => this.noOp();
        this.postConnectImplOverride = (connection) => this.conversationConnectImpl(connection);
        this.configConnectionOverride = () => this.configConnection();
        this.disconnectOverride = () => this.privDisconnect();
        this.privConversationRequestSession = new ConversationRequestSession_js_1.ConversationRequestSession((0, Exports_js_1.createNoDashGuid)());
        this.privConversationConnectionFactory = connectionFactory;
        this.privConversationIsDisposed = false;
    }
    isDisposed() {
        return super.isDisposed() || this.privConversationIsDisposed;
    }
    async dispose(reason) {
        this.privConversationIsDisposed = true;
        if (this.privConnectionConfigPromise !== undefined) {
            const connection = await this.privConnectionConfigPromise;
            await connection.dispose(reason);
        }
        await super.dispose(reason);
    }
    async sendMessage(message) {
        const connection = await this.fetchConnection();
        return connection.send(new ConversationConnectionMessage_js_1.ConversationConnectionMessage(Exports_js_1.MessageType.Text, message));
    }
    async sendMessageAsync(message) {
        const connection = await this.fetchConnection();
        await connection.send(new ConversationConnectionMessage_js_1.ConversationConnectionMessage(Exports_js_1.MessageType.Text, message));
    }
    privDisconnect() {
        if (this.terminateMessageLoop) {
            return;
        }
        this.cancelRecognition(this.privConversationRequestSession.sessionId, this.privConversationRequestSession.requestId, Exports_js_2.CancellationReason.Error, Exports_js_2.CancellationErrorCode.NoError, "Disconnecting");
        this.terminateMessageLoop = true;
        return Promise.resolve();
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    async processTypeSpecificMessages() {
        return true;
    }
    // Cancels recognition.
    cancelRecognition(sessionId, requestId, cancellationReason, errorCode, error) {
        this.terminateMessageLoop = true;
        const cancelEvent = new Exports_js_2.ConversationTranslationCanceledEventArgs(cancellationReason, error, errorCode, undefined, sessionId);
        try {
            if (!!this.privConversationServiceConnector.canceled) {
                this.privConversationServiceConnector.canceled(this.privConversationServiceConnector, cancelEvent);
            }
        }
        catch {
            // continue on error
        }
    }
    /**
     * Establishes a websocket connection to the end point.
     */
    async conversationConnectImpl(connection) {
        this.privConnectionLoop = this.startMessageLoop();
        return connection;
    }
    /**
     * Process incoming websocket messages
     */
    async receiveConversationMessageOverride() {
        if (this.isDisposed() || this.terminateMessageLoop) {
            return Promise.resolve();
        }
        // we won't rely on the cascading promises of the connection since we want to continually be available to receive messages
        const communicationCustodian = new Exports_js_1.Deferred();
        try {
            const connection = await this.fetchConnection();
            const message = await connection.read();
            if (this.isDisposed() || this.terminateMessageLoop) {
                // We're done.
                communicationCustodian.resolve();
                return Promise.resolve();
            }
            if (!message) {
                return this.receiveConversationMessageOverride();
            }
            const sessionId = this.privConversationRequestSession.sessionId;
            const conversationMessageType = message.conversationMessageType.toLowerCase();
            let sendFinal = false;
            try {
                switch (conversationMessageType) {
                    case "info":
                    case "participant_command":
                    case "command":
                        const commandPayload = Exports_js_4.CommandResponsePayload.fromJSON(message.textBody);
                        switch (commandPayload.command.toLowerCase()) {
                            /**
                             * 'ParticpantList' is the first message sent to the user after the websocket connection has opened.
                             * The consuming client must wait for this message to arrive
                             * before starting to send their own data.
                             */
                            case "participantlist":
                                const participantsPayload = Exports_js_4.ParticipantsListPayloadResponse.fromJSON(message.textBody);
                                const participantsResult = participantsPayload.participants.map((p) => {
                                    const participant = {
                                        avatar: p.avatar,
                                        displayName: p.nickname,
                                        id: p.participantId,
                                        isHost: p.ishost,
                                        isMuted: p.ismuted,
                                        isUsingTts: p.usetts,
                                        preferredLanguage: p.locale
                                    };
                                    return participant;
                                });
                                if (!!this.privConversationServiceConnector.participantsListReceived) {
                                    this.privConversationServiceConnector.participantsListReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.ParticipantsListEventArgs(participantsPayload.roomid, participantsPayload.token, participantsPayload.translateTo, participantsPayload.profanityFilter, participantsPayload.roomProfanityFilter, participantsPayload.roomLocked, participantsPayload.muteAll, participantsResult, sessionId));
                                }
                                break;
                            /**
                             * 'SetTranslateToLanguages' represents the list of languages being used in the Conversation by all users(?).
                             * This is sent at the start of the Conversation
                             */
                            case "settranslatetolanguages":
                                if (!!this.privConversationServiceConnector.participantUpdateCommandReceived) {
                                    this.privConversationServiceConnector.participantUpdateCommandReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.ParticipantAttributeEventArgs(commandPayload.participantId, ConversationTranslatorInterfaces_js_1.ConversationTranslatorCommandTypes.setTranslateToLanguages, commandPayload.value, sessionId));
                                }
                                break;
                            /**
                             * 'SetProfanityFiltering' lets the client set the level of profanity filtering.
                             * If sent by the participant the setting will effect only their own profanity level.
                             * If sent by the host, the setting will effect all participants including the host.
                             * Note: the profanity filters differ from Speech Service (?): 'marked', 'raw', 'removed', 'tagged'
                             */
                            case "setprofanityfiltering":
                                if (!!this.privConversationServiceConnector.participantUpdateCommandReceived) {
                                    this.privConversationServiceConnector.participantUpdateCommandReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.ParticipantAttributeEventArgs(commandPayload.participantId, ConversationTranslatorInterfaces_js_1.ConversationTranslatorCommandTypes.setProfanityFiltering, commandPayload.value, sessionId));
                                }
                                break;
                            /**
                             * 'SetMute' is sent if the participant has been muted by the host.
                             * Check the 'participantId' to determine if the current user has been muted.
                             */
                            case "setmute":
                                if (!!this.privConversationServiceConnector.participantUpdateCommandReceived) {
                                    this.privConversationServiceConnector.participantUpdateCommandReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.ParticipantAttributeEventArgs(commandPayload.participantId, ConversationTranslatorInterfaces_js_1.ConversationTranslatorCommandTypes.setMute, commandPayload.value, sessionId));
                                }
                                break;
                            /**
                             * 'SetMuteAll' is sent if the Conversation has been muted by the host.
                             */
                            case "setmuteall":
                                if (!!this.privConversationServiceConnector.muteAllCommandReceived) {
                                    this.privConversationServiceConnector.muteAllCommandReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.MuteAllEventArgs(commandPayload.value, sessionId));
                                }
                                break;
                            /**
                             * 'RoomExpirationWarning' is sent towards the end of the Conversation session to give a timeout warning.
                             */
                            case "roomexpirationwarning":
                                if (!!this.privConversationServiceConnector.conversationExpiration) {
                                    this.privConversationServiceConnector.conversationExpiration(this.privConversationServiceConnector, new Exports_js_2.ConversationExpirationEventArgs(commandPayload.value, this.privConversationRequestSession.sessionId));
                                }
                                break;
                            /**
                             * 'SetUseTts' is sent as a confirmation if the user requests TTS to be turned on or off.
                             */
                            case "setusetts":
                                if (!!this.privConversationServiceConnector.participantUpdateCommandReceived) {
                                    this.privConversationServiceConnector.participantUpdateCommandReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.ParticipantAttributeEventArgs(commandPayload.participantId, ConversationTranslatorInterfaces_js_1.ConversationTranslatorCommandTypes.setUseTTS, commandPayload.value, sessionId));
                                }
                                break;
                            /**
                             * 'SetLockState' is set if the host has locked or unlocked the Conversation.
                             */
                            case "setlockstate":
                                if (!!this.privConversationServiceConnector.lockRoomCommandReceived) {
                                    this.privConversationServiceConnector.lockRoomCommandReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.LockRoomEventArgs(commandPayload.value, sessionId));
                                }
                                break;
                            /**
                             * 'ChangeNickname' is received if a user changes their display name.
                             * Any cached particpiants list should be updated to reflect the display name.
                             */
                            case "changenickname":
                                if (!!this.privConversationServiceConnector.participantUpdateCommandReceived) {
                                    this.privConversationServiceConnector.participantUpdateCommandReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.ParticipantAttributeEventArgs(commandPayload.participantId, ConversationTranslatorInterfaces_js_1.ConversationTranslatorCommandTypes.changeNickname, commandPayload.value, sessionId));
                                }
                                break;
                            /**
                             * 'JoinSession' is sent when a user joins the Conversation.
                             */
                            case "joinsession":
                                const joinParticipantPayload = Exports_js_4.ParticipantPayloadResponse.fromJSON(message.textBody);
                                const joiningParticipant = {
                                    avatar: joinParticipantPayload.avatar,
                                    displayName: joinParticipantPayload.nickname,
                                    id: joinParticipantPayload.participantId,
                                    isHost: joinParticipantPayload.ishost,
                                    isMuted: joinParticipantPayload.ismuted,
                                    isUsingTts: joinParticipantPayload.usetts,
                                    preferredLanguage: joinParticipantPayload.locale,
                                };
                                if (!!this.privConversationServiceConnector.participantJoinCommandReceived) {
                                    this.privConversationServiceConnector.participantJoinCommandReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.ParticipantEventArgs(joiningParticipant, sessionId));
                                }
                                break;
                            /**
                             * 'LeaveSession' is sent when a user leaves the Conversation'.
                             */
                            case "leavesession":
                                const leavingParticipant = {
                                    id: commandPayload.participantId
                                };
                                if (!!this.privConversationServiceConnector.participantLeaveCommandReceived) {
                                    this.privConversationServiceConnector.participantLeaveCommandReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.ParticipantEventArgs(leavingParticipant, sessionId));
                                }
                                break;
                            /**
                             * 'DisconnectSession' is sent when a user is disconnected from the session (e.g. network problem).
                             * Check the 'ParticipantId' to check whether the message is for the current user.
                             */
                            case "disconnectsession":
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const disconnectParticipant = {
                                    id: commandPayload.participantId
                                };
                                break;
                            case "token":
                                const token = new Exports_js_3.CognitiveTokenAuthentication(() => {
                                    const authorizationToken = commandPayload.token;
                                    return Promise.resolve(authorizationToken);
                                }, () => {
                                    const authorizationToken = commandPayload.token;
                                    return Promise.resolve(authorizationToken);
                                });
                                this.authentication = token;
                                this.privConversationServiceConnector.onToken(token);
                                break;
                            /**
                             * Message not recognized.
                             */
                            default:
                                break;
                        }
                        break;
                    /**
                     * 'partial' (or 'hypothesis') represents a unfinalized speech message.
                     */
                    case "partial":
                    /**
                     * 'final' (or 'phrase') represents a finalized speech message.
                     */
                    case "final":
                        const speechPayload = Exports_js_4.SpeechResponsePayload.fromJSON(message.textBody);
                        const conversationResultReason = (conversationMessageType === "final") ? Exports_js_2.ResultReason.TranslatedParticipantSpeech : Exports_js_2.ResultReason.TranslatingParticipantSpeech;
                        const speechResult = new Exports_js_2.ConversationTranslationResult(speechPayload.participantId, this.getTranslations(speechPayload.translations), speechPayload.language, speechPayload.id, conversationResultReason, speechPayload.recognition, undefined, undefined, message.textBody, undefined);
                        if (speechPayload.isFinal) {
                            // check the length, sometimes empty finals are returned
                            if (speechResult.text !== undefined && speechResult.text.length > 0) {
                                sendFinal = true;
                            }
                            else if (speechPayload.id === this.privLastPartialUtteranceId) {
                                // send final as normal. We had a non-empty partial for this same utterance
                                // so sending the empty final is important
                                sendFinal = true;
                            }
                            else {
                                // suppress unneeded final
                            }
                            if (sendFinal) {
                                if (!!this.privConversationServiceConnector.translationReceived) {
                                    this.privConversationServiceConnector.translationReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.ConversationReceivedTranslationEventArgs(ConversationTranslatorInterfaces_js_1.ConversationTranslatorMessageTypes.final, speechResult, sessionId));
                                }
                            }
                        }
                        else if (speechResult.text !== undefined) {
                            this.privLastPartialUtteranceId = speechPayload.id;
                            if (!!this.privConversationServiceConnector.translationReceived) {
                                this.privConversationServiceConnector.translationReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.ConversationReceivedTranslationEventArgs(ConversationTranslatorInterfaces_js_1.ConversationTranslatorMessageTypes.partial, speechResult, sessionId));
                            }
                        }
                        break;
                    /**
                     * "translated_message" is a text message or instant message (IM).
                     */
                    case "translated_message":
                        const textPayload = Exports_js_4.TextResponsePayload.fromJSON(message.textBody);
                        // TODO: (Native parity) a result reason should be set based whether the participantId is ours or not
                        const textResult = new Exports_js_2.ConversationTranslationResult(textPayload.participantId, this.getTranslations(textPayload.translations), textPayload.language, undefined, undefined, textPayload.originalText, undefined, undefined, undefined, message.textBody, undefined);
                        if (!!this.privConversationServiceConnector.translationReceived) {
                            this.privConversationServiceConnector.translationReceived(this.privConversationServiceConnector, new ConversationTranslatorEventArgs_js_1.ConversationReceivedTranslationEventArgs(ConversationTranslatorInterfaces_js_1.ConversationTranslatorMessageTypes.instantMessage, textResult, sessionId));
                        }
                        break;
                    default:
                        // ignore any unsupported message types
                        break;
                }
            }
            catch (e) {
                // continue
            }
            return this.receiveConversationMessageOverride();
        }
        catch (e) {
            this.terminateMessageLoop = true;
        }
        return communicationCustodian.promise;
    }
    async startMessageLoop() {
        if (this.isDisposed()) {
            return Promise.resolve();
        }
        this.terminateMessageLoop = false;
        const messageRetrievalPromise = this.receiveConversationMessageOverride();
        try {
            const r = await messageRetrievalPromise;
            return r;
        }
        catch (error) {
            this.cancelRecognition(this.privRequestSession ? this.privRequestSession.sessionId : "", this.privRequestSession ? this.privRequestSession.requestId : "", Exports_js_2.CancellationReason.Error, Exports_js_2.CancellationErrorCode.RuntimeError, error);
            return null;
        }
    }
    // Takes an established websocket connection to the endpoint
    configConnection() {
        if (this.isDisposed()) {
            return Promise.resolve(undefined);
        }
        if (this.privConnectionConfigPromise !== undefined) {
            return this.privConnectionConfigPromise.then((connection) => {
                if (connection.state() === Exports_js_1.ConnectionState.Disconnected) {
                    this.privConnectionId = null;
                    this.privConnectionConfigPromise = undefined;
                    return this.configConnection();
                }
                return this.privConnectionConfigPromise;
            }, () => {
                this.privConnectionId = null;
                this.privConnectionConfigPromise = undefined;
                return this.configConnection();
            });
        }
        if (this.terminateMessageLoop) {
            return Promise.resolve(undefined);
        }
        this.privConnectionConfigPromise = this.connectImpl().then((connection) => connection);
        return this.privConnectionConfigPromise;
    }
    getTranslations(serviceResultTranslations) {
        let translations;
        if (undefined !== serviceResultTranslations) {
            translations = new Exports_js_2.Translations();
            for (const translation of serviceResultTranslations) {
                translations.set(translation.lang, translation.translation);
            }
        }
        return translations;
    }
}
exports.ConversationServiceAdapter = ConversationServiceAdapter;

//# sourceMappingURL=ConversationServiceAdapter.js.map
