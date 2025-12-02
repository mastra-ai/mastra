/**
 * Represents the JSON used in the agent.config message sent to the speech service.
 */
export declare class AgentConfig {
    private iPrivConfig;
    toJsonString(): string;
    get(): IAgentConfig;
    /**
     * Setter for the agent.config object.
     * @param value a JSON serializable object.
     */
    set(value: IAgentConfig): void;
}
export interface IAgentConfig {
    botInfo: {
        commType: string;
        connectionId: string;
        conversationId: string;
        fromId: string;
        commandsCulture: string;
        ttsAudioFormat: string;
    };
    version: number;
}
