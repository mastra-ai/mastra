/**
 * Extract text deltas from responses stream events
 */
export async function* extractTextDeltas(stream) {
    const consumer = stream.createConsumer();
    for await (const event of consumer) {
        if ("type" in event && event.type === "response.output_text.delta") {
            const deltaEvent = event;
            if (deltaEvent.delta) {
                yield deltaEvent.delta;
            }
        }
    }
}
/**
 * Extract reasoning deltas from responses stream events
 */
export async function* extractReasoningDeltas(stream) {
    const consumer = stream.createConsumer();
    for await (const event of consumer) {
        if ("type" in event && event.type === "response.reasoning_text.delta") {
            const deltaEvent = event;
            if (deltaEvent.delta) {
                yield deltaEvent.delta;
            }
        }
    }
}
/**
 * Extract tool call argument deltas from responses stream events
 */
export async function* extractToolDeltas(stream) {
    const consumer = stream.createConsumer();
    for await (const event of consumer) {
        if ("type" in event && event.type === "response.function_call_arguments.delta") {
            const deltaEvent = event;
            if (deltaEvent.delta) {
                yield deltaEvent.delta;
            }
        }
    }
}
/**
 * Build incremental message updates from responses stream events
 * Returns AssistantMessage (chat format) instead of ResponsesOutputMessage
 */
export async function* buildMessageStream(stream) {
    const consumer = stream.createConsumer();
    // Track the accumulated text
    let currentText = "";
    let hasStarted = false;
    for await (const event of consumer) {
        if (!("type" in event))
            continue;
        switch (event.type) {
            case "response.output_item.added": {
                const itemEvent = event;
                if (itemEvent.item && "type" in itemEvent.item && itemEvent.item.type === "message") {
                    hasStarted = true;
                    currentText = "";
                }
                break;
            }
            case "response.output_text.delta": {
                const deltaEvent = event;
                if (hasStarted && deltaEvent.delta) {
                    currentText += deltaEvent.delta;
                    // Yield updated message
                    yield {
                        role: "assistant",
                        content: currentText,
                    };
                }
                break;
            }
            case "response.output_item.done": {
                const itemDoneEvent = event;
                if (itemDoneEvent.item && "type" in itemDoneEvent.item && itemDoneEvent.item.type === "message") {
                    // Yield final complete message
                    const outputMessage = itemDoneEvent.item;
                    yield convertToAssistantMessage(outputMessage);
                }
                break;
            }
        }
    }
}
/**
 * Consume stream until completion and return the complete response
 */
export async function consumeStreamForCompletion(stream) {
    const consumer = stream.createConsumer();
    for await (const event of consumer) {
        if (!("type" in event))
            continue;
        if (event.type === "response.completed") {
            const completedEvent = event;
            return completedEvent.response;
        }
        if (event.type === "response.failed") {
            const failedEvent = event;
            // The failed event contains the full response with error information
            throw new Error(`Response failed: ${JSON.stringify(failedEvent.response.error)}`);
        }
        if (event.type === "response.incomplete") {
            const incompleteEvent = event;
            // Return the incomplete response
            return incompleteEvent.response;
        }
    }
    throw new Error("Stream ended without completion event");
}
/**
 * Convert ResponsesOutputMessage to AssistantMessage (chat format)
 */
function convertToAssistantMessage(outputMessage) {
    // Extract text content
    const textContent = outputMessage.content
        .filter((part) => "type" in part && part.type === "output_text")
        .map((part) => part.text)
        .join("");
    return {
        role: "assistant",
        content: textContent || null,
    };
}
/**
 * Extract the first message from a completed response
 */
export function extractMessageFromResponse(response) {
    const messageItem = response.output.find((item) => "type" in item && item.type === "message");
    if (!messageItem) {
        throw new Error("No message found in response output");
    }
    return convertToAssistantMessage(messageItem);
}
/**
 * Extract text from a response, either from outputText or by concatenating message content
 */
export function extractTextFromResponse(response) {
    // Use pre-concatenated outputText if available
    if (response.outputText) {
        return response.outputText;
    }
    // Otherwise, extract from the first message (convert to AssistantMessage which has string content)
    const message = extractMessageFromResponse(response);
    // AssistantMessage.content is string | Array | null | undefined
    if (typeof message.content === "string") {
        return message.content;
    }
    return "";
}
/**
 * Extract all tool calls from a completed response
 * Returns parsed tool calls with arguments as objects (not JSON strings)
 */
export function extractToolCallsFromResponse(response) {
    const toolCalls = [];
    for (const item of response.output) {
        if ("type" in item && item.type === "function_call") {
            const functionCallItem = item;
            try {
                const parsedArguments = JSON.parse(functionCallItem.arguments);
                toolCalls.push({
                    id: functionCallItem.callId,
                    name: functionCallItem.name,
                    arguments: parsedArguments,
                });
            }
            catch (error) {
                console.error(`Failed to parse tool call arguments for ${functionCallItem.name}:`, error);
                // Include the tool call with unparsed arguments
                toolCalls.push({
                    id: functionCallItem.callId,
                    name: functionCallItem.name,
                    arguments: functionCallItem.arguments, // Keep as string if parsing fails
                });
            }
        }
    }
    return toolCalls;
}
/**
 * Build incremental tool call updates from responses stream events
 * Yields structured tool call objects as they're built from deltas
 */
export async function* buildToolCallStream(stream) {
    const consumer = stream.createConsumer();
    // Track tool calls being built
    const toolCallsInProgress = new Map();
    for await (const event of consumer) {
        if (!("type" in event))
            continue;
        switch (event.type) {
            case "response.output_item.added": {
                const itemEvent = event;
                if (itemEvent.item &&
                    "type" in itemEvent.item &&
                    itemEvent.item.type === "function_call") {
                    const functionCallItem = itemEvent.item;
                    toolCallsInProgress.set(functionCallItem.callId, {
                        id: functionCallItem.callId,
                        name: functionCallItem.name,
                        argumentsAccumulated: "",
                    });
                }
                break;
            }
            case "response.function_call_arguments.delta": {
                const deltaEvent = event;
                const toolCall = toolCallsInProgress.get(deltaEvent.itemId);
                if (toolCall && deltaEvent.delta) {
                    toolCall.argumentsAccumulated += deltaEvent.delta;
                }
                break;
            }
            case "response.function_call_arguments.done": {
                const doneEvent = event;
                const toolCall = toolCallsInProgress.get(doneEvent.itemId);
                if (toolCall) {
                    // Parse complete arguments
                    try {
                        const parsedArguments = JSON.parse(doneEvent.arguments);
                        yield {
                            id: toolCall.id,
                            name: doneEvent.name,
                            arguments: parsedArguments,
                        };
                    }
                    catch (error) {
                        // Yield with unparsed arguments if parsing fails
                        yield {
                            id: toolCall.id,
                            name: doneEvent.name,
                            arguments: doneEvent.arguments,
                        };
                    }
                    // Clean up
                    toolCallsInProgress.delete(doneEvent.itemId);
                }
                break;
            }
            case "response.output_item.done": {
                const itemDoneEvent = event;
                if (itemDoneEvent.item &&
                    "type" in itemDoneEvent.item &&
                    itemDoneEvent.item.type === "function_call") {
                    const functionCallItem = itemDoneEvent.item;
                    // Yield final tool call if we haven't already
                    if (toolCallsInProgress.has(functionCallItem.callId)) {
                        try {
                            const parsedArguments = JSON.parse(functionCallItem.arguments);
                            yield {
                                id: functionCallItem.callId,
                                name: functionCallItem.name,
                                arguments: parsedArguments,
                            };
                        }
                        catch (error) {
                            yield {
                                id: functionCallItem.callId,
                                name: functionCallItem.name,
                                arguments: functionCallItem.arguments,
                            };
                        }
                        toolCallsInProgress.delete(functionCallItem.callId);
                    }
                }
                break;
            }
        }
    }
}
/**
 * Check if a response contains any tool calls
 */
export function responseHasToolCalls(response) {
    return response.output.some((item) => "type" in item && item.type === "function_call");
}
//# sourceMappingURL=stream-transformers.js.map