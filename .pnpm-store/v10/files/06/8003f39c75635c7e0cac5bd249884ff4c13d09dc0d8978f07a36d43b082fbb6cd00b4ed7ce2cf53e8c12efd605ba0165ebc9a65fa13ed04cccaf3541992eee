/**
 * The speaker diarization mode
 */
export declare enum SpeakerDiarizationMode {
    None = "None",
    Identity = "Identity",
    Anonymous = "Anonymous"
}
/**
 * The identity provider
 */
export declare enum IdentityProvider {
    CallCenter = "CallCenter"
}
/**
 * The speaker diarization configuration
 */
export interface SpeakerDiarization {
    /**
     * The mode
     */
    mode?: SpeakerDiarizationMode;
    /**
     * The identity provider
     */
    identityProvider?: IdentityProvider;
    /**
     * A token that identifies a diarization session across reconnects
     */
    audioSessionId?: string;
    /**
     * The audio offset measured in msec to apply to the audio stream in case this is a session reconnect
     */
    audioOffsetMs?: number;
    /**
     * If set to true the diarization will be performed on the intermediate results
     */
    diarizeIntermediates?: boolean;
}
