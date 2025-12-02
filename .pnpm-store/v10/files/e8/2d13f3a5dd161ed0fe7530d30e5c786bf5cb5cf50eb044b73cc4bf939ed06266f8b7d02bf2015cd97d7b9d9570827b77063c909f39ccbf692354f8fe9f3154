/**
 * Defines the payload for incoming translation messages
 */
export interface ITranslationResponsePayload {
    lang: string;
    translation: string;
}
export interface ITranslationCommandMessage {
    translations: ITranslationResponsePayload[];
    id: string;
    language: string;
    nickname: string;
    participantId: string;
    roomid: string;
    timestamp: string;
    type: string;
}
export interface ISpeechResponsePayload extends ITranslationCommandMessage {
    recognition: string;
    isFinal: boolean;
}
export interface ITextResponsePayload extends ITranslationCommandMessage {
    originalText: string;
}
export declare class SpeechResponsePayload implements ISpeechResponsePayload {
    private privSpeechResponse;
    private constructor();
    get recognition(): string;
    get translations(): ITranslationResponsePayload[];
    get id(): string;
    get language(): string;
    get nickname(): string;
    get participantId(): string;
    get roomid(): string;
    get timestamp(): string;
    get type(): string;
    get isFinal(): boolean;
    static fromJSON(json: string): SpeechResponsePayload;
}
export declare class TextResponsePayload implements ITextResponsePayload {
    private privTextResponse;
    private constructor();
    get originalText(): string;
    get translations(): ITranslationResponsePayload[];
    get id(): string;
    get language(): string;
    get nickname(): string;
    get participantId(): string;
    get roomid(): string;
    get timestamp(): string;
    get type(): string;
    static fromJSON(json: string): TextResponsePayload;
}
