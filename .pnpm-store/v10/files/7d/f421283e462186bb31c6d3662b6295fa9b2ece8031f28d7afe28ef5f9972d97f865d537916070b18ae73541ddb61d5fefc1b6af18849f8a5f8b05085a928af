export enum AgentEvents {
  /**
   * Built in socket events.
   */
  Open = "Open",
  Close = "Close",
  Error = "Error",
  /**
   * Audio event?
   */
  Audio = "Audio",
  /**
   * Confirms the successful connection to the websocket.
   * { type: "Welcome", request_id: "String"}
   */
  Welcome = "Welcome",
  /**
   * Confirms that your `configure` request was successful.
   * { type: "SettingsApplied" }
   */
  SettingsApplied = "SettingsApplied",
  /**
   * Triggered when the agent "hears" the user say something.
   * { type: "ConversationText", role: string, content: string }
   */
  ConversationText = "ConversationText",
  /**
   * Triggered when the agent begins receiving user audio.
   * { type: "UserStartedSpeaking" }
   */
  UserStartedSpeaking = "UserStartedSpeaking",
  /**
   * Triggered when the user has stopped speaking and the agent is processing the audio.
   * { type: "AgentThinking", content: string }
   */
  AgentThinking = "AgentThinking",
  /**
   * A request to call client-side functions.
   * { type: "FunctionCallRequest", functions: { id: string; name: string; arguments: string; client_side: boolean}[] }
   */
  FunctionCallRequest = "FunctionCallRequest",
  /**
   * Triggered when the agent begins streaming an audio response.
   * YOU WILL ONLY RECEIVE THIS EVENT IF YOU HAVE ENABLED `experimental` IN YOUR CONFIG.
   * { type: "AgentStartedSpeaking", total_latency: number, tts_latency: number, ttt_latency: number }
   */
  AgentStartedSpeaking = "AgentStartedSpeaking",
  /**
   * Triggered when the agent has finished streaming an audio response.
   * { type: "AgentAudioDone" }
   */
  AgentAudioDone = "AgentAudioDone",
  /**
   * This event is only emitted when you send an `InjectAgentMessage` request while
   * the user is currently speaking or the server is processing user audio.
   * { type: "InjectionRefused", message: string }
   */
  InjectionRefused = "InjectionRefused",
  /**
   * A successful response to the `UpdateInstructions` request.
   * { type: "PromptUpdated" }
   */
  PromptUpdated = "PromptUpdated",
  /**
   * A successful response to the `UpdateSpeak` request.
   * { type: "SpeakUpdated" }
   */
  SpeakUpdated = "SpeakUpdated",

  /**
   * Catch all for any other message event
   */
  Unhandled = "Unhandled",
}
