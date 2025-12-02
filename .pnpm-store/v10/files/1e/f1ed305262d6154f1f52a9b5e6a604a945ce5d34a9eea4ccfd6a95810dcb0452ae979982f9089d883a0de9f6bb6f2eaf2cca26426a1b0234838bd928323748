declare type AudioEncoding = "linear16" | "flac" | "mulaw" | "amr-nb" | "amr-wb" | "Opus" | "speex" | "g729" | string;
declare type ListenModel = "nova-3" | "nova-3-general" | "nova-3-medical" | "nova-2" | "nova-2-meeting" | "nova-2-phonecall" | "nova-2-voicemail" | "nova-2-finance" | "nova-2-conversational" | "nova-2-video" | "nova-2-medical" | "nova-2-drivethru" | "nova-2-automotive" | "nova-2-atc" | "nova" | "nova-phonecall" | "enhanced" | "enhanced-meeting" | "enhanced-phonecall" | "enhanced-finance" | "base" | "base-meeting" | "base-phonecall" | "base-voicemail" | "base-finance" | "base-conversational" | "base-video" | "whisper-tiny" | "whisper" | "whisper-small" | "whisper-medium" | "whisper-large" | string;
declare type SpeakModel = "aura-asteria-en" | "aura-luna-en" | "aura-stella-en" | "aura-athena-en" | "aura-hera-en" | "aura-orion-en" | "aura-arcas-en" | "aura-perseus-en" | "aura-angus-en" | "aura-orpheus-en" | "aura-helios-en" | "aura-zeus-en" | string;
/**
 * @see https://developers.deepgram.com/reference/voicebot-api-phase-preview#settingsconfiguration
 */
interface AgentLiveSchema extends Record<string, unknown> {
    /**
     * Set to true to enable experimental features.
     * @default false
     */
    experimental?: boolean;
    audio: {
        input?: {
            /**
             * @default "linear16"
             */
            encoding: AudioEncoding;
            /**
             * @default 16000
             */
            sample_rate: number;
        };
        /**
         * @see https://developers.deepgram.com/docs/tts-media-output-settings#audio-format-combinations
         */
        output?: {
            encoding?: string;
            sample_rate?: number;
            bitrate?: number;
            /**
             * @default "none"
             */
            container?: string;
        };
    };
    agent: {
        language?: {
            /**
             * ISO 639-1 language code for agent language.
             * @default "en"
             */
            type: string;
        };
        listen?: {
            provider: {
                type: "deepgram";
                /**
                 * @see https://developers.deepgram.com/docs/model
                 */
                model: ListenModel;
                /**
                 * Only available for Nova 3.
                 * @see https://developers.deepgram.com/docs/keyterm
                 */
                keyterms?: string[];
            };
        };
        speak?: {
            provider: {
                type: "deepgram" | "eleven_labs" | "cartesia" | "open_ai" | string;
                /**
                 * Deepgram OR OpenAI model to use.
                 */
                model?: SpeakModel;
                /**
                 * Eleven Labs OR Cartesia model to use.
                 */
                model_id?: string;
                /**
                 * Cartesia voice configuration.
                 */
                voice?: {
                    mode: string;
                    id: string;
                };
                /**
                 * Optional Cartesia language.
                 */
                language?: string;
                /**
                 * Optional Eleven Labs voice.
                 */
                language_code?: string;
            };
            endpoint?: {
                url: string;
                headers?: Record<string, string>;
            };
        };
        /**
         * @see https://developers.deepgram.com/reference/voicebot-api-phase-preview#supported-llm-providers-and-models
         */
        think?: {
            provider: {
                type: "deepgram" | "open_ai" | "anthropic" | "x_ai" | string;
                model: string;
                /**
                 * 0-2 for OpenAI, 0-1 for Anthropic.
                 */
                temperature?: number;
            };
            /**
             * Optional ONLY if LLM provider is OpenAI or Anthropic.
             */
            endpoint?: {
                url: string;
                headers?: Record<string, string>;
            };
            functions?: {
                name?: string;
                description?: string;
                parameters?: Record<string, unknown>;
                endpoint?: {
                    url?: string;
                    method?: string;
                    headers?: Record<string, string>;
                };
            }[];
            prompt?: string;
        };
    };
    /**
     * Optional message the agent will say at the start of the connection.
     */
    greeting?: string;
}
export type { AgentLiveSchema, SpeakModel };
//# sourceMappingURL=AgentLiveSchema.d.ts.map