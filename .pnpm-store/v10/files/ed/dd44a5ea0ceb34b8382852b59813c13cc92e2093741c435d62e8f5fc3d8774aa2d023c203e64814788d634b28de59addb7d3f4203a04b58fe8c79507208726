import { IStringDictionary } from "./IDictionary.js";
export declare enum EventType {
    Debug = 0,
    Info = 1,
    Warning = 2,
    Error = 3,
    None = 4
}
export declare class PlatformEvent {
    private privName;
    private privEventId;
    private privEventTime;
    private privEventType;
    private privMetadata;
    constructor(eventName: string, eventType: EventType);
    get name(): string;
    get eventId(): string;
    get eventTime(): string;
    get eventType(): EventType;
    get metadata(): IStringDictionary<string>;
}
