import { AgentConfig } from "../common.speech/Exports.js";
import { EventType, PlatformEvent } from "./PlatformEvent.js";
export declare class DialogEvent extends PlatformEvent {
    constructor(eventName: string, eventType?: EventType);
}
export declare class SendingAgentContextMessageEvent extends DialogEvent {
    private privAgentConfig;
    constructor(agentConfig: AgentConfig);
    get agentConfig(): AgentConfig;
}
