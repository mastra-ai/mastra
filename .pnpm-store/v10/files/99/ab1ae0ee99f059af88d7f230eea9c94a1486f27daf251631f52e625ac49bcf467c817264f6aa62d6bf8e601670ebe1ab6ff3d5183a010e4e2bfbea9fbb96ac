import { IStringDictionary } from "./IDictionary.js";
export declare enum MessageType {
    Text = 0,
    Binary = 1
}
export declare class ConnectionMessage {
    private privMessageType;
    private privHeaders;
    private privBody;
    private privSize;
    private privId;
    constructor(messageType: MessageType, body: any, headers?: IStringDictionary<string>, id?: string);
    get messageType(): MessageType;
    get headers(): IStringDictionary<string>;
    get body(): any;
    get textBody(): string;
    get binaryBody(): ArrayBuffer;
    get id(): string;
}
