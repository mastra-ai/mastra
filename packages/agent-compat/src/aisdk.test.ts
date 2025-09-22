import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { AISDK, toMastraCompatibleAISDK } from "./aisdk";

describe("AI SDK Agent Compatibility", () => {
    describe("getInstructions", () => {
        it("should extract instructions from AI SDK agent system property", () => {
            // Mock an AI SDK agent with system instructions
            const mockAisdkAgent = {
                model: {}, // Mock model
                system: "You are a helpful weather assistant that provides accurate weather information and can help planning activities based on the weather.",
                tools: {},
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });

            const instructions = mastraAgent.getInstructions();

            expect(instructions).toBe("You are a helpful weather assistant that provides accurate weather information and can help planning activities based on the weather.");
        });

        it("should return empty string when no system property exists", () => {
            // Mock an AI SDK agent without system instructions
            const mockAisdkAgent = {
                model: {},
                tools: {},
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });

            const instructions = mastraAgent.getInstructions();

            expect(instructions).toBe("");
        });

        it("should handle empty system property", () => {
            // Mock an AI SDK agent with empty system instructions
            const mockAisdkAgent = {
                model: {},
                system: "",
                tools: {},
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });

            const instructions = mastraAgent.getInstructions();

            expect(instructions).toBe("");
        });
    });

    describe("getTools", () => {
        it("should map AI SDK tools to Mastra format", async () => {
            // Mock an AI SDK agent with tools
            const mockAisdkAgent = {
                model: {},
                system: "You are a helpful assistant",
                tools: {
                    weatherTool: {
                        description: 'Get the Weather',
                        inputSchema: z.object({
                            location: z.string(),
                        }),
                        execute: async ({ location }: { location: string }) => {
                            return { output: `The weather in ${location} is sunny` };
                        },
                    },
                    calculatorTool: {
                        description: 'Perform calculations',
                        inputSchema: z.object({
                            operation: z.string(),
                            a: z.number(),
                            b: z.number(),
                        }),
                        execute: async ({ operation, a, b }: { operation: string, a: number, b: number }) => {
                            return { result: operation === 'add' ? a + b : a * b };
                        },
                    }
                },
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });

            const tools = await mastraAgent.getTools();

            expect(tools).toBeDefined();
            expect(typeof tools).toBe("object");

            // Check weatherTool mapping
            expect(tools.weatherTool).toBeDefined();
            expect(tools.weatherTool.id).toBe("weatherTool");
            expect(tools.weatherTool.description).toBe("Get the Weather");
            expect(tools.weatherTool.inputSchema).toBeDefined();
            expect(typeof tools.weatherTool.execute).toBe("function");

            // Check calculatorTool mapping
            expect(tools.calculatorTool).toBeDefined();
            expect(tools.calculatorTool.id).toBe("calculatorTool");
            expect(tools.calculatorTool.description).toBe("Perform calculations");
            expect(typeof tools.calculatorTool.execute).toBe("function");
        });

        it("should handle empty tools object", async () => {
            const mockAisdkAgent = {
                model: {},
                tools: {},
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });

            const tools = await mastraAgent.getTools();

            expect(tools).toBeDefined();
            expect(typeof tools).toBe("object");
            expect(Object.keys(tools)).toHaveLength(0);
        });

        it("should handle missing tools property", async () => {
            const mockAisdkAgent = {
                model: {},
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });

            const tools = await mastraAgent.getTools();

            expect(tools).toBeDefined();
            expect(typeof tools).toBe("object");
            expect(Object.keys(tools)).toHaveLength(0);
        });

        it("should execute mapped tool correctly", async () => {
            const mockAisdkAgent = {
                model: {},
                tools: {
                    greetTool: {
                        description: 'Greet someone by name',
                        inputSchema: z.object({
                            name: z.string(),
                        }),
                        execute: async ({ name }: { name: string }) => {
                            return `Hello, ${name}!`;
                        },
                    }
                },
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });

            const tools = await mastraAgent.getTools();

            if (tools.greetTool && tools.greetTool.execute) {
                // Test tool execution
                const result = await tools.greetTool.execute({ name: "World" });

                expect(result).toBe("Hello, World!");
            } else {
                throw new Error("Greet tool not found or missing execute function");
            }
        });

        it("should pass parameters correctly to AI SDK tool", async () => {
            let capturedParams: any = null;

            const mockAisdkAgent = {
                model: {},
                tools: {
                    testTool: {
                        description: 'Test parameter passing',
                        inputSchema: z.object({
                            location: z.string(),
                            temperature: z.number(),
                        }),
                        execute: async (params: any) => {
                            capturedParams = params;
                            return `Weather in ${params.location}: ${params.temperature}°C`;
                        },
                    }
                },
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });
            const tools = await mastraAgent.getTools();

            // Test with context.request format (current assumption)
            await tools.testTool.execute({ location: "Tokyo", temperature: 25 });

            console.log("Captured params from context.request:", capturedParams);
            expect(capturedParams).toEqual({ location: "Tokyo", temperature: 25 });
        });

        it("should also work with direct parameter format", async () => {
            let capturedParams: any = null;

            const mockAisdkAgent = {
                model: {},
                tools: {
                    testTool: {
                        description: 'Test direct parameter passing',
                        inputSchema: z.object({
                            city: z.string(),
                        }),
                        execute: async (params: any) => {
                            capturedParams = params;
                            return `Direct params: ${params.city}`;
                        },
                    }
                },
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });
            const tools = await mastraAgent.getTools();

            // Test with direct parameter format
            await tools.testTool.execute({ city: "Paris" });

            console.log("Captured params from direct:", capturedParams);
            expect(capturedParams).toEqual({ city: "Paris" });
        });
    });

    describe("getLLM", () => {
        it("should extract model info from AI SDK agent with modelId and provider", async () => {
            const mockAisdkAgent = {
                model: {
                    modelId: "gpt-4",
                    provider: "openai"
                },
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });

            const llm = await mastraAgent.getLLM();

            expect(llm).toBeDefined();
            expect(llm.getProvider()).toBe("openai");
            expect(llm.getModelId()).toBe("gpt-4");

            const model = llm.getModel();
            expect(model.modelId).toBe("gpt-4");
            expect(model.provider).toBe("openai");
        });

        it("should handle missing model gracefully", async () => {
            const mockAisdkAgent = {
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });

            const llm = await mastraAgent.getLLM();

            expect(llm).toBeDefined();
            expect(typeof llm.getProvider).toBe("function");
            expect(typeof llm.getModelId).toBe("function");
        });

        it("should handle model without standard properties", async () => {
            const mockAisdkAgent = {
                model: "some-custom-model",
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });

            const llm = await mastraAgent.getLLM();

            expect(llm).toBeDefined();
            const model = llm.getModel();
            expect(model).toBe("some-custom-model");
        });

        it("should return model object when present", async () => {
            const mockModel = {
                modelId: "claude-3",
                provider: "anthropic",
                customProperty: "test"
            };

            const mockAisdkAgent = {
                model: mockModel,
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = new AISDK({ name: "test-agent", agent: mockAisdkAgent });

            const llm = await mastraAgent.getLLM();
            const model = llm.getModel();

            expect(model.modelId).toBe("claude-3");
            expect(model.provider).toBe("anthropic");
            expect(model.customProperty).toBe("test");
            expect(model.specificationVersion).toBe("v1");
        });
    });

    describe("toMastraCompatibleAISDK", () => {
        it("should convert AI SDK agent to Mastra compatible format", () => {
            const mockAisdkAgent = {
                model: {},
                system: "You are a helpful assistant",
                tools: {
                    testTool: {
                        description: 'Test tool',
                        inputSchema: z.object({
                            input: z.string(),
                        }),
                        execute: async () => "test result",
                    }
                },
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = toMastraCompatibleAISDK({
                agent: mockAisdkAgent,
                name: "test-aisdk-agent"
            });

            expect(mastraAgent).toBeDefined();
            expect(mastraAgent.name).toBe("test-aisdk-agent"); // Uses the provided name
            expect(mastraAgent.getInstructions()).toBe("You are a helpful assistant");
        });

        it("should use default name when none provided", () => {
            const mockAisdkAgent = {
                model: {},
                generate: async () => ({}),
                stream: async () => ({})
            } as any;

            const mastraAgent = toMastraCompatibleAISDK({
                agent: mockAisdkAgent
            });

            expect(mastraAgent.name).toBe("aisdk-agent");
        });
    });
});
