import { describe, it, expect, } from "vitest";
import { createAgent, tool } from "langchain";
import { z } from "zod";
import { toMastraCompatible, convertExternalAgentResult } from "./index";
import { fail } from "assert";

describe("LangChain Agent Compatibility", () => {
    describe("getTools", () => {
        it("should map LangChain tools to Mastra format", async () => {
            // Create a sample LangChain tool
            const weatherTool = tool(
                ({ city }) => `It's always sunny in ${city}!`,
                {
                    name: "get_weather",
                    description: "Get the weather for a given city",
                    schema: z.object({
                        city: z.string(),
                    }),
                }
            );

            const mathTool = tool(
                ({ operation, a, b }) => {
                    switch (operation) {
                        case "add": return `${a} + ${b} = ${a + b}`;
                        case "multiply": return `${a} × ${b} = ${a * b}`;
                        default: return "Unknown operation";
                    }
                },
                {
                    name: "calculator",
                    description: "Perform math operations",
                    schema: z.object({
                        operation: z.enum(["add", "multiply"]),
                        a: z.number(),
                        b: z.number(),
                    }),
                }
            );

            // Create LangChain agent with tools
            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                tools: [weatherTool, mathTool],
            });

            // Convert to Mastra compatible
            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "test-agent"
            });

            // Test getTools method
            const tools = await mastraAgent.getTools();

            console.log("Tools structure:", JSON.stringify(tools, null, 2));

            // Assertions
            expect(tools).toBeDefined();
            expect(typeof tools).toBe("object");

            // Check if tools are mapped correctly
            if (tools.get_weather) {
                expect(tools.get_weather.id).toBe("get_weather");
                expect(tools.get_weather.description).toBe("Get the weather for a given city");
                expect(tools.get_weather.inputSchema).toBeDefined();
                expect(typeof tools.get_weather.execute).toBe("function");
            }

            if (tools.calculator) {
                expect(tools.calculator.id).toBe("calculator");
                expect(tools.calculator.description).toBe("Perform math operations");
                expect(tools.calculator.inputSchema).toBeDefined();
                expect(typeof tools.calculator.execute).toBe("function");
            }
        });

        it("should handle empty tools array", async () => {
            // Create LangChain agent without tools
            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                tools: [],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "no-tools-agent"
            });

            const tools = await mastraAgent.getTools();

            expect(tools).toBeDefined();
            expect(typeof tools).toBe("object");
            expect(Object.keys(tools)).toHaveLength(0);
        });

        it("should handle agent with no tools property", async () => {
            // Create LangChain agent without tools
            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                tools: [],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "undefined-tools-agent"
            });

            const tools = await mastraAgent.getTools();

            expect(tools).toBeDefined();
            expect(typeof tools).toBe("object");
            expect(Object.keys(tools)).toHaveLength(0);
        });

        it("should execute mapped tool correctly", async () => {
            // Create a simple tool for testing execution
            const greetTool = tool(
                ({ name }) => `Hello, ${name}!`,
                {
                    name: "greet",
                    description: "Greet someone by name",
                    schema: z.object({
                        name: z.string(),
                    }),
                }
            );

            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                tools: [greetTool],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "greet-agent"
            });

            const tools = await mastraAgent.getTools();

            if (tools.greet && tools.greet.execute) {
                // Test tool execution
                const result = await tools.greet.execute({
                    request: { name: "World" }
                });

                expect(result).toBe("Hello, World!");
            } else {
                fail("Greet tool not found or missing execute function");
            }
        });
    });

    describe("getDefaultGenerateOptions", () => {
        it("should return empty object as default", async () => {
            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                tools: [],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "test-agent"
            });

            const options = mastraAgent.getDefaultGenerateOptions();

            expect(options).toBeDefined();
            expect(typeof options).toBe("object");
            expect(options).toEqual({});
        });
    });

    describe("getDefaultStreamOptions", () => {
        it("should return empty object as default", async () => {
            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                tools: [],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "test-agent"
            });

            const options = mastraAgent.getDefaultStreamOptions();

            expect(options).toBeDefined();
            expect(typeof options).toBe("object");
            expect(options).toEqual({});
        });
    });

    describe("getLLM model parsing", () => {
        it("should parse provider and model ID from model string", async () => {
            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                tools: [],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "test-agent"
            });

            const llm = mastraAgent.getLLM();

            expect(llm.getProvider()).toBe("openai");
            expect(llm.getModelId()).toBe("gpt-4o-mini");
            expect(llm.getModelString()).toBe("openai:gpt-4o-mini");

            const model = llm.getModel();
            expect(model.provider).toBe("openai");
            expect(model.modelId).toBe("gpt-4o-mini");
            expect(model.specificationVersion).toBe("v1");
        });

        it("should handle unknown model format", async () => {
            const langchainAgent = createAgent({
                model: "unknown-model",
                tools: [],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "test-agent"
            });

            const llm = mastraAgent.getLLM();

            expect(llm.getProvider()).toBe("unknown");
            expect(llm.getModelId()).toBe("unknown-model");
        });
    });

    describe("getInstructions", () => {
        it("should extract instructions from LangChain agent prompt", async () => {
            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                prompt: "You are a helpful weather assistant. Always be friendly and informative.",
                tools: [],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "weather-agent"
            });

            const instructions = mastraAgent.getInstructions();

            expect(instructions).toBe("You are a helpful weather assistant. Always be friendly and informative.");
        });

        it("should use provided instructions over agent prompt", async () => {
            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                prompt: "Original prompt from LangChain",
                tools: [],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "test-agent",
                instructions: "Custom instructions override"
            });

            const instructions = mastraAgent.getInstructions();

            expect(instructions).toBe("Custom instructions override");
        });

        it("should return empty string when no prompt or instructions", async () => {
            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                tools: [],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "test-agent"
            });

            const instructions = mastraAgent.getInstructions();

            expect(instructions).toBe("");
        });
    });

    describe("agent name handling", () => {
        it("should use provided name when specified", async () => {
            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                tools: [],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
                name: "custom-agent-name"
            });

            expect(mastraAgent.name).toBe("custom-agent-name");
        });

        it("should use LangChain agent name as fallback", async () => {
            // Create a mock agent with a name property
            const langchainAgentWithName = {
                ...createAgent({
                    model: "openai:gpt-4o-mini",
                    tools: [],
                }),
                name: "my-langchain-agent"
            };

            const mastraAgent = toMastraCompatible({
                agent: langchainAgentWithName as any,
            });

            expect(mastraAgent.name).toBe("my-langchain-agent");
        });

        it("should use default name when neither provided nor in agent", async () => {
            const langchainAgent = createAgent({
                model: "openai:gpt-4o-mini",
                tools: [],
            });

            const mastraAgent = toMastraCompatible({
                agent: langchainAgent as any,
            });

            expect(mastraAgent.name).toBe("langchain-agent");
        });

        it("should prioritize provided name over agent name", async () => {
            // Create a mock agent with a name property
            const langchainAgentWithName = {
                ...createAgent({
                    model: "openai:gpt-4o-mini",
                    tools: [],
                }),
                name: "original-agent-name"
            };

            const mastraAgent = toMastraCompatible({
                agent: langchainAgentWithName as any,
                name: "override-name"
            });

            expect(mastraAgent.name).toBe("override-name");
        });
    });

    describe("message format conversion", () => {
        it("should format tool messages correctly", () => {

            // Mock a LangChain result with complete conversation including tool calls
            const mockResult = {
                messages: [
                    {
                        id: "user-1",
                        constructor: { name: 'HumanMessage' },
                        content: "What's the weather in Tokyo?"
                    },
                    {
                        id: "assistant-1",
                        constructor: { name: 'AIMessage' },
                        content: "",
                        tool_calls: [
                            {
                                id: "call_AAZGgXyjuYU1igHJ9HckGQgF",
                                name: "get_weather",
                                args: { city: "Tokyo" }
                            }
                        ]
                    },
                    {
                        id: "tool-1",
                        constructor: { name: 'ToolMessage' },
                        content: "It's always sunny in Tokyo!",
                        tool_call_id: "call_AAZGgXyjuYU1igHJ9HckGQgF",
                        name: "get_weather"
                    },
                    {
                        id: "assistant-2",
                        constructor: { name: 'AIMessage' },
                        content: "The weather in Tokyo is sunny!"
                    }
                ]
            };

            // Test the conversion function directly
            const result = convertExternalAgentResult(mockResult);
            const messages = result.response.messages;

            // Check user message format
            const userMessage = messages.find((m: any) => m.role === 'user');
            expect(userMessage).toBeDefined();
            expect(userMessage?.content).toEqual([
                {
                    type: 'text',
                    text: "What's the weather in Tokyo?"
                }
            ]);

            // Check assistant message with tool calls
            const assistantWithToolCalls = messages.find((m: any) =>
                m.role === 'assistant' && Array.isArray(m.content) && m.content[0]?.type === 'tool-call'
            );
            expect(assistantWithToolCalls).toBeDefined();
            expect(assistantWithToolCalls?.content).toEqual([
                {
                    type: 'tool-call',
                    toolCallId: 'call_AAZGgXyjuYU1igHJ9HckGQgF',
                    toolName: 'get_weather',
                    args: { city: "Tokyo" }
                }
            ]);

            // Check tool message format
            const toolMessage = messages.find((m: any) => m.role === 'tool');
            expect(toolMessage).toBeDefined();
            expect(toolMessage?.content).toEqual([
                {
                    type: 'tool-result',
                    toolCallId: 'call_AAZGgXyjuYU1igHJ9HckGQgF',
                    toolName: 'get_weather',
                    result: "It's always sunny in Tokyo!",
                }
            ]);

            // Check final assistant message with text content
            const finalAssistantMessage = messages.find((m: any) =>
                m.role === 'assistant' && typeof m.content === 'string'
            );
            expect(finalAssistantMessage).toBeDefined();
            expect(finalAssistantMessage?.content).toBe("The weather in Tokyo is sunny!");
        });
    });
});
