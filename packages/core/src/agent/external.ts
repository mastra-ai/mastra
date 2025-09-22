import type { MastraPrimitives } from '../action';
import { MastraBase } from '../base';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { Mastra } from "../mastra";
import { RuntimeContext } from '../runtime-context';
import type { DynamicArgument } from '../types';
import type { MastraLLM } from './agent';
import type { AgentExecutionOptions, MastraGenerateResult } from './agent.types';
import type { MessageListInput } from './message-list';

/**
 * Base class for external agents (LangChain, Anthropic, etc.) to integrate with Mastra
 */
export abstract class ExternalAgent extends MastraBase {
    public name: string;
    #mastra?: Mastra;
    protected instructions?: string;

    constructor(config: { name: string; instructions?: string }) {
        super({ name: config.name });
        this.name = config.name;
        this.instructions = config.instructions;
    }

    /**
     * Register the Mastra instance with this agent
     */
    __registerMastra(mastra: Mastra) {
        this.#mastra = mastra;
    }

    #primitives?: MastraPrimitives;

    __registerPrimitives(p: MastraPrimitives) {
        if (p.telemetry) {
            this.__setTelemetry(p.telemetry);
        }

        if (p.logger) {
            this.__setLogger(p.logger);
        }

        // Store primitives for later use when creating LLM instances
        this.#primitives = p;

        this.logger.debug(`[Agents:${this.name}] initialized.`, { name: this.name });
    }

    /**
     * Get the registered Mastra instance
     */
    protected getMastra() {
        return this.#mastra;
    }

    /**
     * Get the instructions for this agent
     */
    getInstructions() {
        return '';
    }

    /**
     * Get the tools for this agent
     */
    getTools() {
        return {};
    }

    /**
     * Get the LLM for this agent
     */
    getLLM({
        runtimeContext = new RuntimeContext(),
        model,
    }: {
        runtimeContext?: RuntimeContext;
        model?: MastraLanguageModel | DynamicArgument<MastraLanguageModel>;
    } = {}): MastraLLM | Promise<MastraLLM> {
        // Default implementation - external agents should override this if they have specific LLM needs
        // Suppress unused warnings since this is a base implementation
        void runtimeContext;
        void model;
        throw new Error(`getLLM method not implemented for external agent: ${this.name}`);
    }

    /**
     * Get default generate options for this agent
     */
    getDefaultGenerateOptions() {
        return {};
    }

    /**
     * Get default stream options for this agent
     */
    getDefaultStreamOptions() {
        return {};
    }

    /**
     * Get memory for this agent
     */
    getMemory() {
        // Default implementation - external agents don't have memory by default
        return undefined;
    }

    /**
     * Check if this agent has its own memory
     */
    hasOwnMemory() {
        return false;
    }

    /**
     * Get workflows for this agent
     */
    getWorkflows() {
        return {};
    }

    /**
     * Get description for this agent
     */
    getDescription() {
        return '';
    }

    /**
     * Get scorers for this agent
     */
    getScorers() {
        return {};
    }

    /**
     * Get voice for this agent
     */
    getVoice() {
        return undefined;
    }

    /**
     * Generate a response using the external agent
     */
    abstract generate(prompt: MessageListInput, options?: AgentExecutionOptions): Promise<MastraGenerateResult>;

    /**
     * Stream a response using the external agent
     */
    abstract stream(prompt: MessageListInput, options?: AgentExecutionOptions): AsyncIterable<string>;
}