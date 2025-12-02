import { AudioOutputFormatImpl } from "../sdk/Audio/AudioOutputFormat.js";
import { PullAudioOutputStreamImpl } from "../sdk/Audio/AudioOutputStream.js";
import { DialogServiceTurnStateManager } from "./DialogServiceTurnStateManager.js";
import { ActivityPayloadResponse } from "./ServiceMessages/ActivityResponsePayload.js";
export declare class DialogServiceTurnState {
    private privRequestId;
    private privIsCompleted;
    private privAudioStream;
    private privTimeoutToken;
    private privTurnManager;
    constructor(manager: DialogServiceTurnStateManager, requestId: string);
    get audioStream(): PullAudioOutputStreamImpl;
    processActivityPayload(payload: ActivityPayloadResponse, audioFormat?: AudioOutputFormatImpl): PullAudioOutputStreamImpl;
    endAudioStream(): void;
    complete(): void;
    private resetTurnEndTimeout;
}
