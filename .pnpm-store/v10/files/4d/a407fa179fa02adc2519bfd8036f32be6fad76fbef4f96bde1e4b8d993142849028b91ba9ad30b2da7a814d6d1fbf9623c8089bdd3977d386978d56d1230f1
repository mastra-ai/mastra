export var AgentEvents;
(function (AgentEvents) {
    /**
     * Built in socket events.
     */
    AgentEvents["Open"] = "Open";
    AgentEvents["Close"] = "Close";
    AgentEvents["Error"] = "Error";
    /**
     * Audio event?
     */
    AgentEvents["Audio"] = "Audio";
    /**
     * Confirms the successful connection to the websocket.
     * { type: "Welcome", request_id: "String"}
     */
    AgentEvents["Welcome"] = "Welcome";
    /**
     * Confirms that your `configure` request was successful.
     * { type: "SettingsApplied" }
     */
    AgentEvents["SettingsApplied"] = "SettingsApplied";
    /**
     * Triggered when the agent "hears" the user say something.
     * { type: "ConversationText", role: string, content: string }
     */
    AgentEvents["ConversationText"] = "ConversationText";
    /**
     * Triggered when the agent begins receiving user audio.
     * { type: "UserStartedSpeaking" }
     */
    AgentEvents["UserStartedSpeaking"] = "UserStartedSpeaking";
    /**
     * Triggered when the user has stopped speaking and the agent is processing the audio.
     * { type: "AgentThinking", content: string }
     */
    AgentEvents["AgentThinking"] = "AgentThinking";
    /**
     * A request to call client-side functions.
     * { type: "FunctionCallRequest", functions: { id: string; name: string; arguments: string; client_side: boolean}[] }
     */
    AgentEvents["FunctionCallRequest"] = "FunctionCallRequest";
    /**
     * Triggered when the agent begins streaming an audio response.
     * YOU WILL ONLY RECEIVE THIS EVENT IF YOU HAVE ENABLED `experimental` IN YOUR CONFIG.
     * { type: "AgentStartedSpeaking", total_latency: number, tts_latency: number, ttt_latency: number }
     */
    AgentEvents["AgentStartedSpeaking"] = "AgentStartedSpeaking";
    /**
     * Triggered when the agent has finished streaming an audio response.
     * { type: "AgentAudioDone" }
     */
    AgentEvents["AgentAudioDone"] = "AgentAudioDone";
    /**
     * This event is only emitted when you send an `InjectAgentMessage` request while
     * the user is currently speaking or the server is processing user audio.
     * { type: "InjectionRefused", message: string }
     */
    AgentEvents["InjectionRefused"] = "InjectionRefused";
    /**
     * A successful response to the `UpdateInstructions` request.
     * { type: "PromptUpdated" }
     */
    AgentEvents["PromptUpdated"] = "PromptUpdated";
    /**
     * A successful response to the `UpdateSpeak` request.
     * { type: "SpeakUpdated" }
     */
    AgentEvents["SpeakUpdated"] = "SpeakUpdated";
    /**
     * Catch all for any other message event
     */
    AgentEvents["Unhandled"] = "Unhandled";
})(AgentEvents || (AgentEvents = {}));
//# sourceMappingURL=AgentEvents.js.map