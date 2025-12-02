import { A as AgentCard, M as MessageSendParams, S as SendMessageResponse, a as Message, T as Task, b as TaskStatusUpdateEvent, c as TaskArtifactUpdateEvent, d as TaskPushNotificationConfig, e as SetTaskPushNotificationConfigResponse, f as TaskIdParams, G as GetTaskPushNotificationConfigResponse, g as TaskQueryParams, h as GetTaskResponse, C as CancelTaskResponse, J as JSONRPCResponse, i as JSONRPCErrorResponse } from '../types-CcBgkR2G.js';

type A2AStreamEventData = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;
/**
 * A2AClient is a TypeScript HTTP client for interacting with A2A-compliant agents.
 */
declare class A2AClient {
    private agentBaseUrl;
    private agentCardPath;
    private agentCardPromise;
    private static readonly DEFAULT_AGENT_CARD_PATH;
    private requestIdCounter;
    private serviceEndpointUrl?;
    /**
     * Constructs an A2AClient instance.
     * It initiates fetching the agent card from the provided agent baseUrl.
     * The Agent Card is fetched from a path relative to the agentBaseUrl, which defaults to '.well-known/agent.json'.
     * The `url` field from the Agent Card will be used as the RPC service endpoint.
     * @param agentBaseUrl The base URL of the A2A agent (e.g., https://agent.example.com)
     * @param agentCardPath path to the agent card, defaults to .well-known/agent.json
     */
    constructor(agentBaseUrl: string, agentCardPath?: string);
    /**
     * Fetches the Agent Card from the agent's well-known URI and caches its service endpoint URL.
     * This method is called by the constructor.
     * @returns A Promise that resolves to the AgentCard.
     */
    private _fetchAndCacheAgentCard;
    /**
     * Retrieves the Agent Card.
     * If an `agentBaseUrl` is provided, it fetches the card from that specific URL.
     * Otherwise, it returns the card fetched and cached during client construction.
     * @param agentBaseUrl Optional. The base URL of the agent to fetch the card from.
     * @param agentCardPath path to the agent card, defaults to .well-known/agent.json
     * If provided, this will fetch a new card, not use the cached one from the constructor's URL.
     * @returns A Promise that resolves to the AgentCard.
     */
    getAgentCard(agentBaseUrl?: string, agentCardPath?: string): Promise<AgentCard>;
    /**
     * Gets the RPC service endpoint URL. Ensures the agent card has been fetched first.
     * @returns A Promise that resolves to the service endpoint URL string.
     */
    private _getServiceEndpoint;
    /**
     * Helper method to make a generic JSON-RPC POST request.
     * @param method The RPC method name.
     * @param params The parameters for the RPC method.
     * @returns A Promise that resolves to the RPC response.
     */
    private _postRpcRequest;
    /**
     * Sends a message to the agent.
     * The behavior (blocking/non-blocking) and push notification configuration
     * are specified within the `params.configuration` object.
     * Optionally, `params.message.contextId` or `params.message.taskId` can be provided.
     * @param params The parameters for sending the message, including the message content and configuration.
     * @returns A Promise resolving to SendMessageResponse, which can be a Message, Task, or an error.
     */
    sendMessage(params: MessageSendParams): Promise<SendMessageResponse>;
    /**
     * Sends a message to the agent and streams back responses using Server-Sent Events (SSE).
     * Push notification configuration can be specified in `params.configuration`.
     * Optionally, `params.message.contextId` or `params.message.taskId` can be provided.
     * Requires the agent to support streaming (`capabilities.streaming: true` in AgentCard).
     * @param params The parameters for sending the message.
     * @returns An AsyncGenerator yielding A2AStreamEventData (Message, Task, TaskStatusUpdateEvent, or TaskArtifactUpdateEvent).
     * The generator throws an error if streaming is not supported or if an HTTP/SSE error occurs.
     */
    sendMessageStream(params: MessageSendParams): AsyncGenerator<A2AStreamEventData, void, undefined>;
    /**
     * Sets or updates the push notification configuration for a given task.
     * Requires the agent to support push notifications (`capabilities.pushNotifications: true` in AgentCard).
     * @param params Parameters containing the taskId and the TaskPushNotificationConfig.
     * @returns A Promise resolving to SetTaskPushNotificationConfigResponse.
     */
    setTaskPushNotificationConfig(params: TaskPushNotificationConfig): Promise<SetTaskPushNotificationConfigResponse>;
    /**
     * Gets the push notification configuration for a given task.
     * @param params Parameters containing the taskId.
     * @returns A Promise resolving to GetTaskPushNotificationConfigResponse.
     */
    getTaskPushNotificationConfig(params: TaskIdParams): Promise<GetTaskPushNotificationConfigResponse>;
    /**
     * Retrieves a task by its ID.
     * @param params Parameters containing the taskId and optional historyLength.
     * @returns A Promise resolving to GetTaskResponse, which contains the Task object or an error.
     */
    getTask(params: TaskQueryParams): Promise<GetTaskResponse>;
    /**
     * Cancels a task by its ID.
     * @param params Parameters containing the taskId.
     * @returns A Promise resolving to CancelTaskResponse, which contains the updated Task object or an error.
     */
    cancelTask(params: TaskIdParams): Promise<CancelTaskResponse>;
    /**
     * Resubscribes to a task's event stream using Server-Sent Events (SSE).
     * This is used if a previous SSE connection for an active task was broken.
     * Requires the agent to support streaming (`capabilities.streaming: true` in AgentCard).
     * @param params Parameters containing the taskId.
     * @returns An AsyncGenerator yielding A2AStreamEventData (Message, Task, TaskStatusUpdateEvent, or TaskArtifactUpdateEvent).
     */
    resubscribeTask(params: TaskIdParams): AsyncGenerator<A2AStreamEventData, void, undefined>;
    /**
     * Parses an HTTP response body as an A2A Server-Sent Event stream.
     * Each 'data' field of an SSE event is expected to be a JSON-RPC 2.0 Response object,
     * specifically a SendStreamingMessageResponse (or similar structure for resubscribe).
     * @param response The HTTP Response object whose body is the SSE stream.
     * @param originalRequestId The ID of the client's JSON-RPC request that initiated this stream.
     * Used to validate the `id` in the streamed JSON-RPC responses.
     * @returns An AsyncGenerator yielding the `result` field of each valid JSON-RPC success response from the stream.
     */
    private _parseA2ASseStream;
    /**
     * Processes a single SSE event's data string, expecting it to be a JSON-RPC response.
     * @param jsonData The string content from one or more 'data:' lines of an SSE event.
     * @param originalRequestId The ID of the client's request that initiated the stream.
     * @returns The `result` field of the parsed JSON-RPC success response.
     * @throws Error if data is not valid JSON, not a valid JSON-RPC response, an error response, or ID mismatch.
     */
    private _processSseEventData;
    isErrorResponse(response: JSONRPCResponse): response is JSONRPCErrorResponse;
}

export { A2AClient };
