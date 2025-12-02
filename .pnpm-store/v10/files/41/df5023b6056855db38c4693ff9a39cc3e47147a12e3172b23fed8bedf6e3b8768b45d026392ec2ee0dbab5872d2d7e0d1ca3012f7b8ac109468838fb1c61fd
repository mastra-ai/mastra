import { WebSocket as WebSocket$1 } from 'ws';

declare namespace Realtime {
    type AudioFormat = 'pcm16' | 'g711_ulaw' | 'g711_alaw';
    type AudioTranscriptionModel = 'whisper-1' | (string & {});
    type ItemRole = 'user' | 'assistant' | 'system';
    type ItemType = 'message' | 'function_call' | 'function_call_output';
    type ItemStatus = 'in_progress' | 'completed' | 'incomplete';
    type ContentPartType = 'input_text' | 'input_audio' | 'text' | 'audio';
    type Voice = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse' | (string & {});
    type ToolChoice = 'auto' | 'none' | 'required' | {
        type: 'function';
        name: string;
    };
    type ObjectType = 'realtime.item' | 'realtime.response' | 'realtime.session' | 'realtime.conversation';
    type ResponseStatus = 'in_progress' | 'completed' | 'incomplete' | 'cancelled' | 'failed';
    interface BaseObject {
        /** The unique ID of the object. */
        id?: string;
        /** Discriminator for the type of this object. */
        object?: ObjectType;
    }
    interface AudioTranscription {
        model: AudioTranscriptionModel;
    }
    interface TurnDetection {
        type: 'server_vad';
        /** 0.0 to 1.0 */
        threshold?: number;
        /** How much audio to include in the audio stream before the speech starts. */
        prefix_padding_ms?: number;
        /** How long to wait to mark the speech as stopped. */
        silence_duration_ms?: number;
    }
    interface ToolDefinition {
        type: 'function';
        name: string;
        description: string;
        parameters: {
            [key: string]: any;
        };
    }
    type PartialToolDefinition = Omit<ToolDefinition, 'type'> & {
        type?: 'function';
    };
    interface SessionConfig {
        /** The default system instructions prepended to model calls. */
        instructions?: string;
        /**
         * The set of modalities the model can respond with. To disable audio, set
         * this to ["text"].
         */
        modalities?: string[];
        /**
         * The voice the model uses to respond - one of alloy, echo, or shimmer.
         *
         * Cannot be changed once the model has responded with audio at least once.
         */
        voice?: Voice;
        /** The format of input audio. */
        input_audio_format?: AudioFormat;
        /** The format of output audio. */
        output_audio_format?: AudioFormat;
        /** Configuration for input audio transcription. Can be set to null to turn off. */
        input_audio_transcription?: AudioTranscription | null;
        /** Configuration for turn detection. Can be set to null to turn off. */
        turn_detection?: TurnDetection | null;
        /** Tools (functions) available to the model. */
        tools?: ToolDefinition[];
        /** How the model chooses tools. */
        tool_choice?: ToolChoice;
        /** Sampling temperature for the model. */
        temperature?: number;
        /**
         * Maximum number of output tokens for a single assistant response, inclusive
         * of tool calls. Provide an integer between 1 and 4096 to limit output
         * tokens, or "inf" for the maximum available tokens for a given model.
         *
         * Defaults to "inf".
         */
        max_response_output_tokens?: number | 'inf';
    }
    interface Session extends BaseObject, SessionConfig {
        /** The unique ID of the session. */
        id: string;
        /** Type of object. */
        object: 'realtime.session';
    }
    interface BaseContentPart {
        /** The type of the content. */
        type: ContentPartType;
        /** Text content for "text" and "input_text" content parts. */
        text?: string;
        /** Base64-encoded audio data. */
        audio?: string;
        /** Optional text transcript. */
        transcript?: string | null;
    }
    interface InputTextContentPart extends BaseContentPart {
        type: 'input_text';
        text: string;
    }
    interface InputAudioContentPart extends BaseContentPart {
        type: 'input_audio';
        /** Base64-encoded audio data. */
        audio?: string;
        transcript?: string | null;
    }
    interface TextContentPart extends BaseContentPart {
        type: 'text';
        text: string;
    }
    interface AudioContentPart extends BaseContentPart {
        type: 'audio';
        /** Base64-encoded audio data. */
        audio?: string;
        transcript?: string | null;
    }
    type ContentPart = InputTextContentPart | InputAudioContentPart | TextContentPart | AudioContentPart;
    interface BaseItem extends BaseObject {
        /** The unique ID of the item. */
        id: string;
        /** Type of object. */
        object?: 'realtime.item';
        /** The type of the item. */
        type: ItemType;
        /** The status of the item. */
        status: ItemStatus;
        /** The role of the message sender. */
        role: ItemRole;
        /** The content of the item. */
        content: ContentPart[];
    }
    interface SystemItem {
        role: 'system';
        type: 'message';
        content: InputTextContentPart[];
    }
    interface UserItem {
        role: 'user';
        type: 'message';
        content: Array<InputTextContentPart | InputAudioContentPart>;
    }
    interface AssistantItem {
        role: 'assistant';
        type: 'message';
        content: Array<TextContentPart | AudioContentPart>;
    }
    interface FunctionCallItem {
        type: 'function_call';
        /** The ID of the function call. */
        call_id: string;
        /** The name of the function being called. */
        name: string;
        /** The arguments of the function call. */
        arguments: string;
    }
    interface FunctionCallOutputItem {
        type: 'function_call_output';
        /** The ID of the function call. */
        call_id: string;
        /** The output of the function call. */
        output: string;
    }
    type Item = BaseItem & (SystemItem | UserItem | AssistantItem | FunctionCallItem | FunctionCallOutputItem);
    type ClientItem = SystemItem | UserItem | AssistantItem | FunctionCallItem | FunctionCallOutputItem;
    interface Usage {
        total_tokens: number;
        input_tokens: number;
        output_tokens: number;
    }
    interface ResponseConfig {
        /** Instructions for the model. */
        instructions?: string;
        /**
         * The modalities for the response. To disable audio, set this to ["text"].
         */
        modalities?: string[];
        /**
         * The voice the model uses to respond - one of alloy, echo, or shimmer.
         */
        voice?: Voice;
        /** The format of output audio. */
        output_audio_format?: AudioFormat;
        /** Tools (functions) available to the model. */
        tools?: ToolDefinition[];
        /** How the model chooses tools. */
        tool_choice?: ToolChoice;
        /** Sampling temperature for the model. */
        temperature?: number;
        /**
         * Maximum number of output tokens for a single assistant response, inclusive
         * of tool calls. Provide an integer between 1 and 4096 to limit output
         * tokens, or "inf" for the maximum available tokens for a given model.
         * Defaults to "inf".
         */
        max_output_tokens?: number | 'inf';
    }
    interface Response extends BaseObject, ResponseConfig {
        /** The unique ID of the response. */
        id: string;
        /** Type of object. */
        object: 'realtime.response';
        /** Status of the response. */
        status: ResponseStatus;
        /** Additional details about the status. */
        status_details?: {
            type: 'incomplete';
            reason: 'interruption' | 'max_output_tokens' | 'content_filter';
        } | {
            type: 'failed';
            error?: Error | null;
        } | null;
        /** The list of output items generated by the response. */
        output: Item[];
        /** Usage statistics for the response. */
        usage?: Usage;
    }
    interface Error {
        /** The type of error. */
        type: string;
        /** Error code, if any. */
        code?: string;
        /** A human-readable error message. */
        message: string;
        /** Parameter related to the error, if any. */
        param?: string | null;
        /** Unique ID of the event, if any. */
        event_id?: string;
    }
    interface Conversation extends BaseObject {
        /** The unique ID of the conversation. */
        id: string;
        /** Type of object. */
        object: 'realtime.conversation';
    }
    interface RateLimit {
        name: 'requests' | 'tokens' | (string & {});
        limit: number;
        remaining: number;
        reset_seconds: number;
    }
}
type MaybePromise<T> = T | Promise<T>;
interface FormattedTool {
    type: 'function';
    name: string;
    call_id: string;
    arguments: string;
}
interface FormattedProperty {
    audio: Int16Array;
    text: string;
    transcript: string;
    tool?: FormattedTool;
    output?: string;
    file?: any;
}
/** Local item used strictly for convenience and not part of the API. */
type FormattedItem = Realtime.Item & {
    formatted: FormattedProperty;
};
/** Local item used strictly for convenience and not part of the API. */
type MaybeFormattedItem = Realtime.Item & {
    formatted?: FormattedProperty;
};
interface EventHandlerResult {
    item?: MaybeFormattedItem;
    delta?: {
        transcript?: string;
        audio?: Int16Array;
        text?: string;
        arguments?: string;
    };
    response?: Realtime.Response;
}
type ToolHandler = (params: any) => MaybePromise<any>;

interface Event {
    /** The event type. */
    type: string;
}
type RealtimeEvent = RealtimeCustomEvents.CustomEvent & {
    type: 'realtime.event';
    source: 'server' | 'client';
    time: string;
    event: Event;
} & ({
    source: 'server';
    event: RealtimeServerEvents.EventMap[RealtimeServerEvents.EventType];
} | {
    source: 'client';
    event: RealtimeClientEvents.EventMap[RealtimeClientEvents.EventType];
});
declare namespace RealtimeClientEvents {
    /** Event types sent by the client. */
    type EventType = 'session.update' | 'input_audio_buffer.append' | 'input_audio_buffer.commit' | 'input_audio_buffer.clear' | 'conversation.item.create' | 'conversation.item.truncate' | 'conversation.item.delete' | 'response.create' | 'response.cancel';
    type EventMap = {
        'session.update': SessionUpdateEvent;
        'input_audio_buffer.append': InputAudioBufferAppendEvent;
        'input_audio_buffer.commit': InputAudioBufferCommitEvent;
        'input_audio_buffer.clear': InputAudioBufferClearEvent;
        'conversation.item.create': ConversationItemCreateEvent;
        'conversation.item.truncate': ConversationItemTruncateEvent;
        'conversation.item.delete': ConversationItemDeleteEvent;
        'response.create': ResponseCreateEvent;
        'response.cancel': ResponseCancelEvent;
    };
    type PrefixedEventMap = {
        [K in keyof EventMap as `client.${Extract<K, string>}`]: EventMap[K];
    };
    interface ClientEvent extends Event {
        /** The event type. */
        type: EventType;
        /** Optional client-generated ID used to identify this event. */
        event_id?: string;
    }
    /** Send this event to update the session’s default configuration. */
    interface SessionUpdateEvent extends ClientEvent {
        type: 'session.update';
        /** Session configuration to update. */
        session: Realtime.SessionConfig;
    }
    /** Send this event to append audio bytes to the input audio buffer. */
    interface InputAudioBufferAppendEvent extends ClientEvent {
        type: 'input_audio_buffer.append';
        /** Base64-encoded audio bytes. */
        audio: string;
    }
    /** Send this event to commit audio bytes to a user message. */
    interface InputAudioBufferCommitEvent extends ClientEvent {
        type: 'input_audio_buffer.commit';
    }
    /** Send this event to clear the audio bytes in the buffer. */
    interface InputAudioBufferClearEvent extends ClientEvent {
        type: 'input_audio_buffer.clear';
    }
    /** Send this event when adding an item to the conversation. */
    interface ConversationItemCreateEvent extends ClientEvent {
        type: 'conversation.item.create';
        /** The ID of the preceding item after which the new item will be inserted. */
        previous_item_id?: string;
        /** The item to add to the conversation. */
        item?: Realtime.ClientItem;
    }
    /**
     * Send this event when you want to truncate a previous assistant message’s audio.
     */
    interface ConversationItemTruncateEvent extends ClientEvent {
        type: 'conversation.item.truncate';
        /** The ID of the assistant message item to truncate. */
        item_id: string;
        /** The index of the content part to truncate. */
        content_index: number;
        /** Inclusive duration up to which audio is truncated, in milliseconds. */
        audio_end_ms: number;
    }
    /**
     * Send this event when you want to remove any item from the conversation history.
     */
    interface ConversationItemDeleteEvent extends ClientEvent {
        type: 'conversation.item.delete';
        /** The ID of the item to delete. */
        item_id: string;
    }
    /** Send this event to trigger a response generation. */
    interface ResponseCreateEvent extends ClientEvent {
        type: 'response.create';
        /** Configuration for the response. */
        response: Realtime.ResponseConfig;
    }
    /** Send this event to cancel an in-progress response. */
    interface ResponseCancelEvent extends ClientEvent {
        type: 'response.cancel';
    }
}
declare namespace RealtimeServerEvents {
    /** Event types sent by the server. */
    type EventType = 'error' | 'session.created' | 'session.updated' | 'conversation.created' | 'conversation.item.created' | 'conversation.item.input_audio_transcription.completed' | 'conversation.item.input_audio_transcription.failed' | 'conversation.item.truncated' | 'conversation.item.deleted' | 'input_audio_buffer.committed' | 'input_audio_buffer.cleared' | 'input_audio_buffer.speech_started' | 'input_audio_buffer.speech_stopped' | 'response.created' | 'response.done' | 'response.output_item.added' | 'response.output_item.done' | 'response.content_part.added' | 'response.content_part.done' | 'response.text.delta' | 'response.text.done' | 'response.audio_transcript.delta' | 'response.audio_transcript.done' | 'response.audio.delta' | 'response.audio.done' | 'response.function_call_arguments.delta' | 'response.function_call_arguments.done' | 'rate_limits.updated';
    type EventMap = {
        error: ErrorEvent;
        'session.created': SessionCreatedEvent;
        'session.updated': SessionUpdatedEvent;
        'conversation.created': ConversationCreatedEvent;
        'conversation.item.created': ConversationItemCreatedEvent;
        'conversation.item.input_audio_transcription.completed': ConversationItemInputAudioTranscriptionCompletedEvent;
        'conversation.item.input_audio_transcription.failed': ConversationItemInputAudioTranscriptionFailedEvent;
        'conversation.item.truncated': ConversationItemTruncatedEvent;
        'conversation.item.deleted': ConversationItemDeletedEvent;
        'input_audio_buffer.committed': InputAudioBufferCommittedEvent;
        'input_audio_buffer.cleared': InputAudioBufferClearedEvent;
        'input_audio_buffer.speech_started': InputAudioBufferSpeechStartedEvent;
        'input_audio_buffer.speech_stopped': InputAudioBufferSpeechStoppedEvent;
        'response.created': ResponseCreatedEvent;
        'response.done': ResponseDoneEvent;
        'response.output_item.added': ResponseOutputItemAddedEvent;
        'response.output_item.done': ResponseOutputItemDoneEvent;
        'response.content_part.added': ResponseContentPartItemAddedEvent;
        'response.content_part.done': ResponseContentPartItemDoneEvent;
        'response.text.delta': ResponseTextDeltaEvent;
        'response.text.done': ResponseTextDoneEvent;
        'response.audio_transcript.delta': ResponseAudioTranscriptDeltaEvent;
        'response.audio_transcript.done': ResponseAudioTranscriptDoneEvent;
        'response.audio.delta': ResponseAudioDeltaEvent;
        'response.audio.done': ResponseAudioDoneEvent;
        'response.function_call_arguments.delta': ResponseFunctionCallArgumentsDeltaEvent;
        'response.function_call_arguments.done': ResponseFunctionCallArgumentsDoneEvent;
        'rate_limits.updated': RateLimitsUpdatedEvent;
    };
    type PrefixedEventMap = {
        [K in keyof EventMap as `server.${Extract<K, string>}`]: EventMap[K];
    };
    interface ServerEvent extends Event {
        /** The event type. */
        type: EventType;
        /** The unique ID of the server event. */
        event_id: string;
    }
    /** Returned when an error occurs. */
    interface ErrorEvent extends ServerEvent {
        type: 'error';
        /** Details of the error. */
        error: Realtime.Error;
    }
    /**
     * Returned when a session is created. Emitted automatically when a new
     * connection is established.
     */
    interface SessionCreatedEvent extends ServerEvent {
        type: 'session.created';
        /** The session resource. */
        session: Realtime.Session;
    }
    /**
     * Returned when a session is updated.
     */
    interface SessionUpdatedEvent extends ServerEvent {
        type: 'session.updated';
        /** The updated session resource. */
        session: Realtime.Session;
    }
    /**
     * Returned when a conversation is created. Emitted right after session
     * creation.
     */
    interface ConversationCreatedEvent extends ServerEvent {
        type: 'conversation.created';
        /** The conversation resource. */
        conversation: Realtime.Conversation;
    }
    /**
     * Returned when a conversation item is created.
     */
    interface ConversationItemCreatedEvent extends ServerEvent {
        type: 'conversation.item.created';
        /** The ID of the preceding item. */
        previous_item_id?: string;
        /** The item that was created. */
        item: Realtime.Item;
    }
    /**
     * Returned when input audio transcription is enabled and a transcription succeeds.
     */
    interface ConversationItemInputAudioTranscriptionCompletedEvent extends ServerEvent {
        type: 'conversation.item.input_audio_transcription.completed';
        /** The ID of the user message item. */
        item_id: string;
        /** The index of the content part containing the audio. */
        content_index: number;
        /** The transcribed text. */
        transcript: string;
    }
    /**
     * Returned when input audio transcription is configured, and a transcription
     * request for a user message failed.
     */
    interface ConversationItemInputAudioTranscriptionFailedEvent extends ServerEvent {
        type: 'conversation.item.input_audio_transcription.failed';
        /** The ID of the user message item. */
        item_id: string;
        /** The index of the content part containing the audio. */
        content_index: number;
        /** Details of the transcription error. */
        error: Realtime.Error;
    }
    /**
     * Returned when an earlier assistant audio message item is truncated by the client.
     */
    interface ConversationItemTruncatedEvent extends ServerEvent {
        type: 'conversation.item.truncated';
        /** The ID of the assistant message item that was truncated. */
        item_id: string;
        /** The index of the content part thtat was truncated. */
        content_index: number;
        /** The duration up to which the audio was truncated, in milliseconds. */
        audio_end_ms: number;
    }
    /**
     * Returned when an item in the conversation is deleted.
     */
    interface ConversationItemDeletedEvent extends ServerEvent {
        type: 'conversation.item.deleted';
        /** The ID of the item that was deleted. */
        item_id: string;
    }
    /**
     * Returned when an input audio buffer is committed, either by the client or
     * automatically in server VAD mode.
     */
    interface InputAudioBufferCommittedEvent extends ServerEvent {
        type: 'input_audio_buffer.committed';
        /** The ID of the preceding item after which the new item will be inserted. */
        previous_item_id?: string;
        /** The ID of the user message item that will be created. */
        item_id: string;
    }
    /**
     * Returned when the input audio buffer is cleared by the client.
     */
    interface InputAudioBufferClearedEvent extends ServerEvent {
        type: 'input_audio_buffer.cleared';
    }
    /**
     * Returned in server turn detection mode when speech is detected.
     */
    interface InputAudioBufferSpeechStartedEvent extends ServerEvent {
        type: 'input_audio_buffer.speech_started';
        /** The ID of the user message item that will be created when speech stops. */
        item_id: string;
        /** Milliseconds since the session started when speech was detected. */
        audio_start_ms: number;
    }
    /**
     * Returned in server turn detection mode when speech stops.
     */
    interface InputAudioBufferSpeechStoppedEvent extends ServerEvent {
        type: 'input_audio_buffer.speech_stopped';
        /** The ID of the user message item that will be created. */
        item_id: string;
        /** Milliseconds since the session started when speech stopped. */
        audio_end_ms: number;
    }
    /**
     * Returned when a new Response is created. The first event of response
     * creation, where the response is in an initial state of "in_progress".
     */
    interface ResponseCreatedEvent extends ServerEvent {
        type: 'response.created';
        /** The response resource. */
        response: Realtime.Response;
    }
    /**
     * Returned when a Response is done streaming. Always emitted, no matter the
     * final state.
     */
    interface ResponseDoneEvent extends ServerEvent {
        type: 'response.done';
        /** The response resource. */
        response: Realtime.Response;
    }
    /**
     * Returned when a new Item is created during response generation.
     */
    interface ResponseOutputItemAddedEvent extends ServerEvent {
        type: 'response.output_item.added';
        /** The ID of the response. */
        response_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The item that was added. */
        item: Realtime.Item;
    }
    /**
     * Returned when an Item is done streaming. Also emitted when a Response is
     * interrupted, incomplete, or cancelled.
     */
    interface ResponseOutputItemDoneEvent extends ServerEvent {
        type: 'response.output_item.done';
        /** The ID of the response. */
        response_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The item that was added. */
        item: Realtime.Item;
    }
    /**
     * Returned when a new content part is added to an assistant message item
     * during response generation.
     */
    interface ResponseContentPartItemAddedEvent extends ServerEvent {
        type: 'response.content_part.added';
        /** The ID of the response. */
        response_id: string;
        /** The ID of the item. */
        item_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The index of the content part in the item's content array. */
        content_index: number;
        /** The content part. */
        part: Realtime.ContentPart;
    }
    /**
     * Returned when a content part is done streaming in an assistant message item.
     * Also emitted when a Response is interrupted, incomplete, or cancelled.
     */
    interface ResponseContentPartItemDoneEvent extends ServerEvent {
        type: 'response.content_part.done';
        /** The ID of the response. */
        response_id: string;
        /** The ID of the item. */
        item_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The index of the content part in the item's content array. */
        content_index: number;
        /** The content part. */
        part: Realtime.ContentPart;
    }
    /**
     * Returned when the text value of a "text" content part is updated.
     */
    interface ResponseTextDeltaEvent extends ServerEvent {
        type: 'response.text.delta';
        /** The ID of the response. */
        response_id: string;
        /** The ID of the item. */
        item_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The index of the content part in the item's content array. */
        content_index: number;
        /** The text delta. */
        delta: string;
    }
    /**
     * Returned when the text value of a "text" content part is done streaming.
     * Also emitted when a Response is interrupted, incomplete, or cancelled.
     */
    interface ResponseTextDoneEvent extends ServerEvent {
        type: 'response.text.done';
        /** The ID of the response. */
        response_id: string;
        /** The ID of the item. */
        item_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The index of the content part in the item's content array. */
        content_index: number;
        /** The final text content. */
        text: string;
    }
    /**
     * Returned when the model-generated transcription of audio output is updated.
     */
    interface ResponseAudioTranscriptDeltaEvent extends ServerEvent {
        type: 'response.audio_transcript.delta';
        /** The ID of the response. */
        response_id: string;
        /** The ID of the item. */
        item_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The index of the content part in the item's content array. */
        content_index: number;
        /** The transcript delta. */
        delta: string;
    }
    /**
     * Returned when the model-generated transcription of audio output is done
     * streaming. Also emitted when a Response is interrupted, incomplete, or
     * cancelled.
     */
    interface ResponseAudioTranscriptDoneEvent extends ServerEvent {
        type: 'response.audio_transcript.done';
        /** The ID of the response. */
        response_id: string;
        /** The ID of the item. */
        item_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The index of the content part in the item's content array. */
        content_index: number;
        /** The final transcript. */
        transcript: string;
    }
    /**
     * Returned when the model-generated audio is updated.
     */
    interface ResponseAudioDeltaEvent extends ServerEvent {
        type: 'response.audio.delta';
        /** The ID of the response. */
        response_id: string;
        /** The ID of the item. */
        item_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The index of the content part in the item's content array. */
        content_index: number;
        /** Base64-encoded audio data delta. */
        delta: string;
    }
    /**
     * Returned when the model-generated audio is done. Also emitted when a
     * Response is interrupted, incomplete, or cancelled.
     */
    interface ResponseAudioDoneEvent extends ServerEvent {
        type: 'response.audio.done';
        /** The ID of the response. */
        response_id: string;
        /** The ID of the item. */
        item_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The index of the content part in the item's content array. */
        content_index: number;
    }
    /**
     * Returned when the model-generated function call arguments are updated.
     */
    interface ResponseFunctionCallArgumentsDeltaEvent extends ServerEvent {
        type: 'response.function_call_arguments.delta';
        /** The ID of the response. */
        response_id: string;
        /** The ID of the item. */
        item_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The index of the content part in the item's content array. */
        content_index: number;
        /** The ID of the function call. */
        call_id: string;
        /** The arguments delta as a JSON string. */
        delta: string;
    }
    /**
     * Returned when the model-generated function call arguments are done streaming.
     * Also emitted when a Response is interrupted, incomplete, or cancelled.
     */
    interface ResponseFunctionCallArgumentsDoneEvent extends ServerEvent {
        type: 'response.function_call_arguments.done';
        /** The ID of the response. */
        response_id: string;
        /** The ID of the item. */
        item_id: string;
        /** The index of the output item in the response. */
        output_index: string;
        /** The index of the content part in the item's content array. */
        content_index: number;
        /** The ID of the function call. */
        call_id: string;
        /** The final arguments as a JSON string. */
        arguments: string;
    }
    /**
     * Emitted after every `response.done` event to indicate the updated rate
     * limits.
     */
    interface RateLimitsUpdatedEvent extends ServerEvent {
        type: 'rate_limits.updated';
        /** Array of rate limit information. */
        rate_limits: Realtime.RateLimit[];
    }
}
declare namespace RealtimeCustomEvents {
    /** Custom event types that are not part of the official realtime API. */
    type EventType = 'conversation.item.appended' | 'conversation.item.completed' | 'conversation.updated' | 'conversation.interrupted' | 'realtime.event';
    type EventMap = {
        'conversation.item.appended': ConversationItemAppendedEvent;
        'conversation.item.completed': ConversationItemCompletedEvent;
        'conversation.updated': ConversationUpdatedEvent;
        'conversation.interrupted': ConversationInterruptedEvent;
        'realtime.event': CustomServerEvent<RealtimeServerEvents.EventType> | CustomClientEvent<RealtimeClientEvents.EventType>;
    };
    interface CustomEvent extends Event {
        /** The custom event type. */
        type: EventType;
    }
    type CustomServerEvent<T extends RealtimeServerEvents.EventType> = RealtimeEvent & {
        type: 'realtime.event';
        source: 'server';
        time: string;
        event: RealtimeServerEvents.EventMap[T];
    };
    type CustomClientEvent<T extends RealtimeClientEvents.EventType> = RealtimeEvent & {
        type: 'realtime.event';
        source: 'client';
        time: string;
        event: RealtimeClientEvents.EventMap[T];
    };
    interface ConversationItemAppendedEvent extends CustomEvent, Omit<EventHandlerResult, 'item'> {
        type: 'conversation.item.appended';
        item: FormattedItem;
    }
    interface ConversationItemCompletedEvent extends CustomEvent, Omit<EventHandlerResult, 'item'> {
        type: 'conversation.item.completed';
        item: FormattedItem;
    }
    interface ConversationUpdatedEvent extends CustomEvent, Omit<EventHandlerResult, 'item'> {
        type: 'conversation.updated';
        item: FormattedItem;
    }
    interface ConversationInterruptedEvent extends CustomEvent, Omit<RealtimeServerEvents.InputAudioBufferSpeechStartedEvent, 'type'> {
        type: 'conversation.interrupted';
    }
}

type EventHandlerCallback<EventData> = (event: EventData) => MaybePromise<unknown>;
/**
 * Basic event handler.
 */
declare class RealtimeEventHandler<EventType extends string = string, EventData extends Event = Event, EventMap extends Record<EventType, EventData> = Record<EventType, EventData>> {
    eventHandlers: Record<EventType, EventHandlerCallback<EventData>[]>;
    /**
     * Clears all event handlers.
     */
    clearEventHandlers(): void;
    /**
     * Adds a listener for a specific event.
     */
    on<E extends EventType, D extends EventData = EventMap[E] extends EventData ? EventMap[E] : EventData>(eventName: E, callback: EventHandlerCallback<D>): void;
    /**
     * Adds a listener for a single occurrence of an event.
     */
    once<E extends EventType, D extends EventData = EventMap[E] extends EventData ? EventMap[E] : EventData>(eventName: E, callback: EventHandlerCallback<D>): void;
    /**
     * Removes a listener for an event.
     * Calling without a callback will remove all listeners for the event.
     */
    off<E extends EventType, D extends EventData = EventMap[E] extends EventData ? EventMap[E] : EventData>(eventName: E, callback?: EventHandlerCallback<D>): void;
    /**
     * Waits for next event of a specific type and returns the payload.
     */
    waitForNext<E extends EventType, D extends EventData = EventMap[E] extends EventData ? EventMap[E] : EventData>(eventName: E, { timeoutMs }?: {
        timeoutMs?: number;
    }): Promise<D>;
    /**
     * Executes all events handlers in the order they were added.
     */
    dispatch<E extends EventType, D extends EventData = EventMap[E] extends EventData ? EventMap[E] : EventData>(eventName: E, event: D): void;
}

/**
 * The RealtimeAPI class handles low-level communication with the OpenAI
 * Realtime API via WebSockets.
 */
declare class RealtimeAPI extends RealtimeEventHandler<RealtimeClientEvents.EventType | RealtimeServerEvents.EventType | 'close' | `client.${RealtimeClientEvents.EventType}` | `server.${RealtimeServerEvents.EventType}` | 'client.*' | 'server.*', Event, RealtimeClientEvents.EventMap & RealtimeServerEvents.EventMap & RealtimeClientEvents.PrefixedEventMap & RealtimeServerEvents.PrefixedEventMap & {
    'client.*': RealtimeClientEvents.ClientEvent;
} & {
    'server.*': RealtimeServerEvents.ServerEvent;
} & {
    close: {
        type: 'close';
        error: boolean;
    };
}> {
    readonly model: string;
    readonly url: string;
    readonly apiKey?: string;
    readonly debug: boolean;
    ws?: WebSocket | WebSocket$1;
    /**
     * Creates a new RealtimeAPI instance.
     */
    constructor({ model, url, apiKey, dangerouslyAllowAPIKeyInBrowser, debug }?: {
        model?: string;
        url?: string;
        apiKey?: string;
        dangerouslyAllowAPIKeyInBrowser?: boolean;
        debug?: boolean;
    });
    /**
     * Whether or not the WebSocket is connected.
     */
    get isConnected(): boolean;
    /**
     * Connects to Realtime API WebSocket Server.
     */
    connect(): Promise<unknown>;
    /**
     * Disconnects from the Realtime API server.
     */
    disconnect(ws?: WebSocket | WebSocket$1): void;
    /**
     * Receives an event from WebSocket and dispatches related events.
     */
    receive<E extends RealtimeServerEvents.EventType, D extends RealtimeServerEvents.ServerEvent = RealtimeServerEvents.EventMap[E] extends RealtimeServerEvents.ServerEvent ? RealtimeServerEvents.EventMap[E] : RealtimeServerEvents.ServerEvent>(eventName: E, event: D): void;
    /**
     * Sends an event to the underlying WebSocket and dispatches related events.
     */
    send<E extends RealtimeClientEvents.EventType, D extends RealtimeClientEvents.ClientEvent = RealtimeClientEvents.EventMap[E] extends RealtimeClientEvents.ClientEvent ? RealtimeClientEvents.EventMap[E] : RealtimeClientEvents.ClientEvent>(eventName: E, data?: Omit<D, 'type'>): void;
    /**
     * Writes WebSocket logs to the console if `debug` is enabled.
     */
    protected _log(...args: any[]): void;
}

/**
 * RealtimeConversation holds conversation history and performs event
 * validation for RealtimeAPI.
 */
declare class RealtimeConversation {
    readonly defaultFrequency = 24000;
    readonly frequency: number;
    readonly debug: boolean;
    itemLookup: Record<string, FormattedItem>;
    items: FormattedItem[];
    responseLookup: Record<string, Realtime.Response>;
    responses: Realtime.Response[];
    queuedSpeechItems: Record<string, {
        audio_start_ms: number;
        audio_end_ms?: number;
        audio?: Int16Array;
    }>;
    queuedTranscriptItems: Record<string, {
        transcript: string;
    }>;
    queuedInputAudio?: Int16Array;
    constructor({ frequency, debug }?: {
        frequency?: number;
        debug?: boolean;
    });
    /**
     * Clears the conversation history and resets to defaults.
     */
    clear(): void;
    /**
     * Queue input audio for manual speech event.
     */
    queueInputAudio(inputAudio: Int16Array): void;
    /**
     * Process an event from the WebSocket server and compose items.
     */
    processEvent(event: RealtimeServerEvents.ServerEvent, ...args: any[]): EventHandlerResult;
    /**
     * Retrieves an item by ID.
     */
    getItem(id: string): FormattedItem | undefined;
    /**
     * Retrieves all items in the conversation.
     */
    getItems(): FormattedItem[];
    /** Event handlers. */
    EventProcessors: Partial<{
        [K in keyof RealtimeServerEvents.EventMap]: (event: RealtimeServerEvents.EventMap[K], ...args: any[]) => EventHandlerResult;
    }>;
}

/**
 * The RealtimeClient class is the main interface for interacting with the
 * OpenAI Realtime API. It handles connection, configuration, conversation
 * updates, and server event handling.
 */
declare class RealtimeClient extends RealtimeEventHandler<RealtimeClientEvents.EventType | RealtimeServerEvents.EventType | RealtimeCustomEvents.EventType, Event, RealtimeClientEvents.EventMap & RealtimeServerEvents.EventMap & RealtimeCustomEvents.EventMap> {
    readonly defaultSessionConfig: Realtime.SessionConfig;
    sessionConfig: Realtime.SessionConfig;
    readonly relay: boolean;
    realtime: RealtimeAPI;
    conversation: RealtimeConversation;
    inputAudioBuffer: Int16Array;
    sessionCreated: boolean;
    tools: Record<string, {
        definition: Realtime.ToolDefinition;
        handler: ToolHandler;
    }>;
    constructor({ sessionConfig, relay, ...apiParams }?: {
        sessionConfig?: Partial<Omit<Realtime.SessionConfig, 'tools'>>;
        apiKey?: string;
        model?: string;
        url?: string;
        dangerouslyAllowAPIKeyInBrowser?: boolean;
        debug?: boolean;
        /**
         * Relay mode disables tool use, since it will be the responsibility of the
         * upstream client to handle tool calls.
         */
        relay?: boolean;
    });
    /**
     * Resets sessionConfig and conversation to defaults.
     */
    protected _resetConfig(): void;
    /**
     * Sets up event handlers for a fully-functional application control flow.
     */
    protected _addAPIEventHandlers(): void;
    /**
     * Whether the realtime socket is connected.
     */
    get isConnected(): boolean;
    /**
     * Whether the client is in relay mode. When in relay mode, the client will
     * not attempt to invoke tools.
     */
    get isRelay(): boolean;
    /**
     * Resets the client instance entirely: disconnects and clears configs.
     */
    reset(): void;
    /**
     * Connects to the Realtime WebSocket API and updates the session config.
     */
    connect(): Promise<void>;
    /**
     * Waits for a session.created event to be executed before proceeding.
     */
    waitForSessionCreated(): Promise<void>;
    /**
     * Disconnects from the Realtime API and clears the conversation history.
     */
    disconnect(): void;
    /**
     * Gets the active turn detection mode.
     */
    getTurnDetectionType(): 'server_vad' | undefined;
    /**
     * Adds a tool to the session.
     */
    addTool(definition: Realtime.PartialToolDefinition, handler: ToolHandler): void;
    /**
     * Removes a tool from the session.
     */
    removeTool(name: string): void;
    /**
     * Deletes an item.
     */
    deleteItem(id: string): void;
    /**
     * Updates session configuration.
     *
     * If the client is not yet connected, the session will be updated upon connection.
     */
    updateSession(sessionConfig?: Realtime.SessionConfig): void;
    /**
     * Sends user message content and generates a response.
     */
    sendUserMessageContent(content: Array<Realtime.InputTextContentPart | Realtime.InputAudioContentPart>): void;
    /**
     * Appends user audio to the existing audio buffer.
     */
    appendInputAudio(arrayBuffer: Int16Array | ArrayBuffer): void;
    /**
     * Forces the model to generate a response.
     */
    createResponse(): void;
    /**
     * Cancels the ongoing server generation and truncates ongoing generation, if
     * applicable.
     *
     * If no id provided, will simply call `cancel_generation` command.
     */
    cancelResponse(
    /** The ID of the item to cancel. */
    id?: string, 
    /** The number of samples to truncate past for the ongoing generation. */
    sampleCount?: number): Realtime.AssistantItem | undefined;
    /**
     * Utility for waiting for the next `conversation.item.appended` event to be
     * triggered by the server.
     */
    waitForNextItem(): Promise<Realtime.Item>;
    /**
     * Utility for waiting for the next `conversation.item.completed` event to be
     * triggered by the server.
     */
    waitForNextCompletedItem(): Promise<Realtime.Item>;
}

export { type EventHandlerCallback as E, type FormattedTool as F, type MaybePromise as M, RealtimeAPI as R, type ToolHandler as T, RealtimeClient as a, RealtimeConversation as b, RealtimeEventHandler as c, type Event as d, type RealtimeEvent as e, RealtimeClientEvents as f, RealtimeServerEvents as g, RealtimeCustomEvents as h, Realtime as i, type FormattedProperty as j, type FormattedItem as k, type MaybeFormattedItem as l, type EventHandlerResult as m };
