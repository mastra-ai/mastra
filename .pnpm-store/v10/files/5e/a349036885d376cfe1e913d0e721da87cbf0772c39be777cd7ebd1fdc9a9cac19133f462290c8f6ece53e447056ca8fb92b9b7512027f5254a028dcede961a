import { z } from 'zod/v4';
import { ProviderV2, LanguageModelV2 } from '@ai-sdk/provider';
import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { FetchFunction } from '@ai-sdk/provider-utils';

type AnthropicMessagesModelId = 'claude-opus-4-20250514' | 'claude-sonnet-4-20250514' | 'claude-3-7-sonnet-20250219' | 'claude-3-5-sonnet-latest' | 'claude-3-5-sonnet-20241022' | 'claude-3-5-sonnet-20240620' | 'claude-3-5-haiku-latest' | 'claude-3-5-haiku-20241022' | 'claude-3-opus-latest' | 'claude-3-opus-20240229' | 'claude-3-sonnet-20240229' | 'claude-3-haiku-20240307' | (string & {});
declare const anthropicProviderOptions: z.ZodObject<{
    sendReasoning: z.ZodOptional<z.ZodBoolean>;
    thinking: z.ZodOptional<z.ZodObject<{
        type: z.ZodUnion<readonly [z.ZodLiteral<"enabled">, z.ZodLiteral<"disabled">]>;
        budgetTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    disableParallelToolUse: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
type AnthropicProviderOptions = z.infer<typeof anthropicProviderOptions>;

declare const anthropicTools: {
    /**
     * Creates a tool for running a bash command. Must have name "bash".
     *
     * Image results are supported.
     *
     * @param execute - The function to execute the tool. Optional.
     */
    bash_20241022: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{
        command: string;
        restart?: boolean;
    }, {}>;
    /**
     * Creates a tool for running a bash command. Must have name "bash".
     *
     * Image results are supported.
     *
     * @param execute - The function to execute the tool. Optional.
     */
    bash_20250124: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{
        command: string;
        restart?: boolean;
    }, {}>;
    /**
     * Creates a tool for editing text. Must have name "str_replace_editor".
     */
    textEditor_20241022: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{
        command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
        path: string;
        file_text?: string;
        insert_line?: number;
        new_str?: string;
        old_str?: string;
        view_range?: number[];
    }, {}>;
    /**
     * Creates a tool for editing text. Must have name "str_replace_editor".
     */
    textEditor_20250124: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{
        command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
        path: string;
        file_text?: string;
        insert_line?: number;
        new_str?: string;
        old_str?: string;
        view_range?: number[];
    }, {}>;
    /**
     * Creates a tool for editing text. Must have name "str_replace_based_edit_tool".
     * Note: This version does not support the "undo_edit" command.
     */
    textEditor_20250429: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{
        command: "view" | "create" | "str_replace" | "insert";
        path: string;
        file_text?: string;
        insert_line?: number;
        new_str?: string;
        old_str?: string;
        view_range?: number[];
    }, {}>;
    /**
     * Creates a tool for executing actions on a computer. Must have name "computer".
     *
     * Image results are supported.
     *
     * @param displayWidthPx - The width of the display being controlled by the model in pixels.
     * @param displayHeightPx - The height of the display being controlled by the model in pixels.
     * @param displayNumber - The display number to control (only relevant for X11 environments). If specified, the tool will be provided a display number in the tool definition.
     */
    computer_20241022: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{
        action: "key" | "type" | "mouse_move" | "left_click" | "left_click_drag" | "right_click" | "middle_click" | "double_click" | "screenshot" | "cursor_position";
        coordinate?: number[];
        text?: string;
    }, {
        displayWidthPx: number;
        displayHeightPx: number;
        displayNumber?: number;
    }>;
    /**
     * Creates a tool for executing actions on a computer. Must have name "computer".
     *
     * Image results are supported.
     *
     * @param displayWidthPx - The width of the display being controlled by the model in pixels.
     * @param displayHeightPx - The height of the display being controlled by the model in pixels.
     * @param displayNumber - The display number to control (only relevant for X11 environments). If specified, the tool will be provided a display number in the tool definition.
     * @param execute - The function to execute the tool. Optional.
     */
    computer_20250124: _ai_sdk_provider_utils.ProviderDefinedToolFactory<{
        action: "key" | "hold_key" | "type" | "cursor_position" | "mouse_move" | "left_mouse_down" | "left_mouse_up" | "left_click" | "left_click_drag" | "right_click" | "middle_click" | "double_click" | "triple_click" | "scroll" | "wait" | "screenshot";
        coordinate?: [number, number];
        duration?: number;
        scroll_amount?: number;
        scroll_direction?: "up" | "down" | "left" | "right";
        start_coordinate?: [number, number];
        text?: string;
    }, {
        displayWidthPx: number;
        displayHeightPx: number;
        displayNumber?: number;
    }>;
    /**
     * Creates a web search tool that gives Claude direct access to real-time web content.
     * Must have name "web_search".
     *
     * @param maxUses - Maximum number of web searches Claude can perform during the conversation.
     * @param allowedDomains - Optional list of domains that Claude is allowed to search.
     * @param blockedDomains - Optional list of domains that Claude should avoid when searching.
     * @param userLocation - Optional user location information to provide geographically relevant search results.
     */
    webSearch_20250305: (args?: Parameters<_ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{
        query: string;
    }, {
        url: string;
        title: string;
        pageAge: string | null;
        encryptedContent: string;
        type: string;
    }[], {
        maxUses?: number;
        allowedDomains?: string[];
        blockedDomains?: string[];
        userLocation?: {
            type: "approximate";
            city?: string;
            region?: string;
            country?: string;
            timezone?: string;
        };
    }>>[0]) => _ai_sdk_provider_utils.Tool<{
        query: string;
    }, {
        url: string;
        title: string;
        pageAge: string | null;
        encryptedContent: string;
        type: string;
    }[]>;
    /**
     * Creates a tool for executing Python code. Must have name "code_execution".
     */
    codeExecution_20250522: (args?: Parameters<_ai_sdk_provider_utils.ProviderDefinedToolFactoryWithOutputSchema<{
        code: string;
    }, {
        type: "code_execution_result";
        stdout: string;
        stderr: string;
        return_code: number;
    }, {}>>[0]) => _ai_sdk_provider_utils.Tool<{
        code: string;
    }, {
        type: "code_execution_result";
        stdout: string;
        stderr: string;
        return_code: number;
    }>;
};

interface AnthropicProvider extends ProviderV2 {
    /**
  Creates a model for text generation.
  */
    (modelId: AnthropicMessagesModelId): LanguageModelV2;
    /**
  Creates a model for text generation.
  */
    languageModel(modelId: AnthropicMessagesModelId): LanguageModelV2;
    chat(modelId: AnthropicMessagesModelId): LanguageModelV2;
    messages(modelId: AnthropicMessagesModelId): LanguageModelV2;
    /**
  Anthropic-specific computer use tool.
     */
    tools: typeof anthropicTools;
}
interface AnthropicProviderSettings {
    /**
  Use a different URL prefix for API calls, e.g. to use proxy servers.
  The default prefix is `https://api.anthropic.com/v1`.
     */
    baseURL?: string;
    /**
  API key that is being send using the `x-api-key` header.
  It defaults to the `ANTHROPIC_API_KEY` environment variable.
     */
    apiKey?: string;
    /**
  Custom headers to include in the requests.
       */
    headers?: Record<string, string>;
    /**
  Custom fetch implementation. You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.
      */
    fetch?: FetchFunction;
    generateId?: () => string;
}
/**
Create an Anthropic provider instance.
 */
declare function createAnthropic(options?: AnthropicProviderSettings): AnthropicProvider;
/**
Default Anthropic provider instance.
 */
declare const anthropic: AnthropicProvider;

export { type AnthropicProvider, type AnthropicProviderOptions, type AnthropicProviderSettings, anthropic, createAnthropic };
