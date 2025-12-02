import { ConnectionMessage, IStringDictionary, MessageType } from "../common/Exports.js";
export declare class SpeechConnectionMessage extends ConnectionMessage {
    private privPath;
    private privRequestId;
    private privContentType;
    private privStreamId;
    private privAdditionalHeaders;
    constructor(messageType: MessageType, path: string, requestId: string, contentType: string, body: any, streamId?: string, additionalHeaders?: IStringDictionary<string>, id?: string);
    get path(): string;
    get requestId(): string;
    get contentType(): string;
    get streamId(): string;
    get additionalHeaders(): IStringDictionary<string>;
    static fromConnectionMessage(message: ConnectionMessage): SpeechConnectionMessage;
}
