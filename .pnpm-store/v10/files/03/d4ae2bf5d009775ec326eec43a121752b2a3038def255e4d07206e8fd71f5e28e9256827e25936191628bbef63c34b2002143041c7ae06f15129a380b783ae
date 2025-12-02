export interface IActivityPayloadResponse {
    conversationId: string;
    messageDataStreamType: number;
    messagePayload: string | object;
    version: number;
}
export declare class ActivityPayloadResponse implements IActivityPayloadResponse {
    private privActivityResponse;
    private constructor();
    static fromJSON(json: string): ActivityPayloadResponse;
    get conversationId(): string;
    get messageDataStreamType(): number;
    get messagePayload(): string | object;
    get version(): number;
}
export declare enum MessageDataStreamType {
    None = 0,
    TextToSpeechAudio = 1
}
