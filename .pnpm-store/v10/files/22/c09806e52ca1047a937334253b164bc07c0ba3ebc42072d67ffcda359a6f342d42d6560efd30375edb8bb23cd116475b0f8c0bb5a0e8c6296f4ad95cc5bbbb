import { z } from 'zod';
import { ProviderV1, LanguageModelV1 } from '@ai-sdk/provider';
import { FetchFunction } from '@ai-sdk/provider-utils';

type AnthropicMessagesModelId = 'claude-4-opus-20250514' | 'claude-4-sonnet-20250514' | 'claude-3-7-sonnet-20250219' | 'claude-3-5-sonnet-latest' | 'claude-3-5-sonnet-20241022' | 'claude-3-5-sonnet-20240620' | 'claude-3-5-haiku-latest' | 'claude-3-5-haiku-20241022' | 'claude-3-opus-latest' | 'claude-3-opus-20240229' | 'claude-3-sonnet-20240229' | 'claude-3-haiku-20240307' | (string & {});
interface AnthropicMessagesSettings {
    /**
  Enable Anthropic cache control. This will allow you to use provider-specific
  `cacheControl` metadata.
  
  @deprecated cache control is now enabled by default (meaning you are able to
  optionally mark content for caching) and this setting is no longer needed.
  */
    cacheControl?: boolean;
    /**
  Include reasoning content in requests sent to the model. Defaults to `true`.
  
  If you are experiencing issues with the model handling requests involving
  reasoning content, you can set this to `false` to omit them from the request.
    */
    sendReasoning?: boolean;
}

declare const anthropicProviderOptionsSchema: z.ZodObject<{
    thinking: z.ZodOptional<z.ZodObject<{
        type: z.ZodUnion<[z.ZodLiteral<"enabled">, z.ZodLiteral<"disabled">]>;
        budgetTokens: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "enabled" | "disabled";
        budgetTokens?: number | undefined;
    }, {
        type: "enabled" | "disabled";
        budgetTokens?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    thinking?: {
        type: "enabled" | "disabled";
        budgetTokens?: number | undefined;
    } | undefined;
}, {
    thinking?: {
        type: "enabled" | "disabled";
        budgetTokens?: number | undefined;
    } | undefined;
}>;
type AnthropicProviderOptions = z.infer<typeof anthropicProviderOptionsSchema>;

type ExecuteFunction<PARAMETERS, RESULT> = undefined | ((args: PARAMETERS, options: {
    abortSignal?: AbortSignal;
}) => Promise<RESULT>);
type ToolResultContent = Array<{
    type: 'text';
    text: string;
} | {
    type: 'image';
    data: string;
    mimeType?: string;
}>;
declare const Bash20241022Parameters: z.ZodObject<{
    command: z.ZodString;
    restart: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    command: string;
    restart?: boolean | undefined;
}, {
    command: string;
    restart?: boolean | undefined;
}>;
/**
 * Creates a tool for running a bash command. Must have name "bash".
 *
 * Image results are supported.
 *
 * @param execute - The function to execute the tool. Optional.
 */
declare function bashTool_20241022<RESULT>(options?: {
    execute?: ExecuteFunction<{
        /**
         * The bash command to run. Required unless the tool is being restarted.
         */
        command: string;
        /**
         * Specifying true will restart this tool. Otherwise, leave this unspecified.
         */
        restart?: boolean;
    }, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
}): {
    type: 'provider-defined';
    id: 'anthropic.bash_20241022';
    args: {};
    parameters: typeof Bash20241022Parameters;
    execute: ExecuteFunction<z.infer<typeof Bash20241022Parameters>, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
};
declare const Bash20250124Parameters: z.ZodObject<{
    command: z.ZodString;
    restart: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    command: string;
    restart?: boolean | undefined;
}, {
    command: string;
    restart?: boolean | undefined;
}>;
/**
 * Creates a tool for running a bash command. Must have name "bash".
 *
 * Image results are supported.
 *
 * @param execute - The function to execute the tool. Optional.
 */
declare function bashTool_20250124<RESULT>(options?: {
    execute?: ExecuteFunction<{
        /**
         * The bash command to run. Required unless the tool is being restarted.
         */
        command: string;
        /**
         * Specifying true will restart this tool. Otherwise, leave this unspecified.
         */
        restart?: boolean;
    }, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
}): {
    type: 'provider-defined';
    id: 'anthropic.bash_20250124';
    args: {};
    parameters: typeof Bash20250124Parameters;
    execute: ExecuteFunction<z.infer<typeof Bash20250124Parameters>, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
};
declare const TextEditor20241022Parameters: z.ZodObject<{
    command: z.ZodEnum<["view", "create", "str_replace", "insert", "undo_edit"]>;
    path: z.ZodString;
    file_text: z.ZodOptional<z.ZodString>;
    insert_line: z.ZodOptional<z.ZodNumber>;
    new_str: z.ZodOptional<z.ZodString>;
    old_str: z.ZodOptional<z.ZodString>;
    view_range: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    path: string;
    command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
    file_text?: string | undefined;
    insert_line?: number | undefined;
    new_str?: string | undefined;
    old_str?: string | undefined;
    view_range?: number[] | undefined;
}, {
    path: string;
    command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
    file_text?: string | undefined;
    insert_line?: number | undefined;
    new_str?: string | undefined;
    old_str?: string | undefined;
    view_range?: number[] | undefined;
}>;
/**
 * Creates a tool for editing text. Must have name "str_replace_editor".
 *
 * Image results are supported.
 *
 * @param execute - The function to execute the tool. Optional.
 */
declare function textEditorTool_20241022<RESULT>(options?: {
    execute?: ExecuteFunction<{
        /**
         * The commands to run. Allowed options are: `view`, `create`, `str_replace`, `insert`, `undo_edit`.
         */
        command: 'view' | 'create' | 'str_replace' | 'insert' | 'undo_edit';
        /**
         * Absolute path to file or directory, e.g. `/repo/file.py` or `/repo`.
         */
        path: string;
        /**
         * Required parameter of `create` command, with the content of the file to be created.
         */
        file_text?: string;
        /**
         * Required parameter of `insert` command. The `new_str` will be inserted AFTER the line `insert_line` of `path`.
         */
        insert_line?: number;
        /**
         * Optional parameter of `str_replace` command containing the new string (if not given, no string will be added). Required parameter of `insert` command containing the string to insert.
         */
        new_str?: string;
        /**
         * Required parameter of `str_replace` command containing the string in `path` to replace.
         */
        old_str?: string;
        /**
         * Optional parameter of `view` command when `path` points to a file. If none is given, the full file is shown. If provided, the file will be shown in the indicated line number range, e.g. [11, 12] will show lines 11 and 12. Indexing at 1 to start. Setting `[start_line, -1]` shows all lines from `start_line` to the end of the file.
         */
        view_range?: number[];
    }, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
}): {
    type: 'provider-defined';
    id: 'anthropic.text_editor_20241022';
    args: {};
    parameters: typeof TextEditor20241022Parameters;
    execute: ExecuteFunction<z.infer<typeof TextEditor20241022Parameters>, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
};
declare const TextEditor20250124Parameters: z.ZodObject<{
    command: z.ZodEnum<["view", "create", "str_replace", "insert", "undo_edit"]>;
    path: z.ZodString;
    file_text: z.ZodOptional<z.ZodString>;
    insert_line: z.ZodOptional<z.ZodNumber>;
    new_str: z.ZodOptional<z.ZodString>;
    old_str: z.ZodOptional<z.ZodString>;
    view_range: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    path: string;
    command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
    file_text?: string | undefined;
    insert_line?: number | undefined;
    new_str?: string | undefined;
    old_str?: string | undefined;
    view_range?: number[] | undefined;
}, {
    path: string;
    command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
    file_text?: string | undefined;
    insert_line?: number | undefined;
    new_str?: string | undefined;
    old_str?: string | undefined;
    view_range?: number[] | undefined;
}>;
/**
 * Creates a tool for editing text. Must have name "str_replace_editor".
 *
 * Image results are supported.
 *
 * @param execute - The function to execute the tool. Optional.
 */
declare function textEditorTool_20250124<RESULT>(options?: {
    execute?: ExecuteFunction<{
        /**
         * The commands to run. Allowed options are: `view`, `create`, `str_replace`, `insert`, `undo_edit`.
         */
        command: 'view' | 'create' | 'str_replace' | 'insert' | 'undo_edit';
        /**
         * Absolute path to file or directory, e.g. `/repo/file.py` or `/repo`.
         */
        path: string;
        /**
         * Required parameter of `create` command, with the content of the file to be created.
         */
        file_text?: string;
        /**
         * Required parameter of `insert` command. The `new_str` will be inserted AFTER the line `insert_line` of `path`.
         */
        insert_line?: number;
        /**
         * Optional parameter of `str_replace` command containing the new string (if not given, no string will be added). Required parameter of `insert` command containing the string to insert.
         */
        new_str?: string;
        /**
         * Required parameter of `str_replace` command containing the string in `path` to replace.
         */
        old_str?: string;
        /**
         * Optional parameter of `view` command when `path` points to a file. If none is given, the full file is shown. If provided, the file will be shown in the indicated line number range, e.g. [11, 12] will show lines 11 and 12. Indexing at 1 to start. Setting `[start_line, -1]` shows all lines from `start_line` to the end of the file.
         */
        view_range?: number[];
    }, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
}): {
    type: 'provider-defined';
    id: 'anthropic.text_editor_20250124';
    args: {};
    parameters: typeof TextEditor20250124Parameters;
    execute: ExecuteFunction<z.infer<typeof TextEditor20250124Parameters>, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
};
declare const Computer20241022Parameters: z.ZodObject<{
    action: z.ZodEnum<["key", "type", "mouse_move", "left_click", "left_click_drag", "right_click", "middle_click", "double_click", "screenshot", "cursor_position"]>;
    coordinate: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    text: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "type" | "key" | "mouse_move" | "left_click" | "left_click_drag" | "right_click" | "middle_click" | "double_click" | "screenshot" | "cursor_position";
    text?: string | undefined;
    coordinate?: number[] | undefined;
}, {
    action: "type" | "key" | "mouse_move" | "left_click" | "left_click_drag" | "right_click" | "middle_click" | "double_click" | "screenshot" | "cursor_position";
    text?: string | undefined;
    coordinate?: number[] | undefined;
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
declare function computerTool_20241022<RESULT>(options: {
    displayWidthPx: number;
    displayHeightPx: number;
    displayNumber?: number;
    execute?: ExecuteFunction<{
        /**
         * The action to perform. The available actions are:
         * - `key`: Press a key or key-combination on the keyboard.
         *   - This supports xdotool's `key` syntax.
         *   - Examples: "a", "Return", "alt+Tab", "ctrl+s", "Up", "KP_0" (for the numpad 0 key).
         * - `type`: Type a string of text on the keyboard.
         * - `cursor_position`: Get the current (x, y) pixel coordinate of the cursor on the screen.
         * - `mouse_move`: Move the cursor to a specified (x, y) pixel coordinate on the screen.
         * - `left_click`: Click the left mouse button.
         * - `left_click_drag`: Click and drag the cursor to a specified (x, y) pixel coordinate on the screen.
         * - `right_click`: Click the right mouse button.
         * - `middle_click`: Click the middle mouse button.
         * - `double_click`: Double-click the left mouse button.
         * - `screenshot`: Take a screenshot of the screen.
         */
        action: 'key' | 'type' | 'mouse_move' | 'left_click' | 'left_click_drag' | 'right_click' | 'middle_click' | 'double_click' | 'screenshot' | 'cursor_position';
        /**
         * (x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates to move the mouse to. Required only by `action=mouse_move` and `action=left_click_drag`.
         */
        coordinate?: number[];
        /**
         * Required only by `action=type` and `action=key`.
         */
        text?: string;
    }, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
}): {
    type: 'provider-defined';
    id: 'anthropic.computer_20241022';
    args: {};
    parameters: typeof Computer20241022Parameters;
    execute: ExecuteFunction<z.infer<typeof Computer20241022Parameters>, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
};
declare const Computer20250124Parameters: z.ZodObject<{
    action: z.ZodEnum<["key", "hold_key", "type", "cursor_position", "mouse_move", "left_mouse_down", "left_mouse_up", "left_click", "left_click_drag", "right_click", "middle_click", "double_click", "triple_click", "scroll", "wait", "screenshot"]>;
    coordinate: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    duration: z.ZodOptional<z.ZodNumber>;
    scroll_amount: z.ZodOptional<z.ZodNumber>;
    scroll_direction: z.ZodOptional<z.ZodEnum<["up", "down", "left", "right"]>>;
    start_coordinate: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    text: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "type" | "key" | "mouse_move" | "left_click" | "left_click_drag" | "right_click" | "middle_click" | "double_click" | "screenshot" | "cursor_position" | "hold_key" | "left_mouse_down" | "left_mouse_up" | "triple_click" | "scroll" | "wait";
    text?: string | undefined;
    coordinate?: [number, number] | undefined;
    duration?: number | undefined;
    scroll_amount?: number | undefined;
    scroll_direction?: "up" | "down" | "left" | "right" | undefined;
    start_coordinate?: [number, number] | undefined;
}, {
    action: "type" | "key" | "mouse_move" | "left_click" | "left_click_drag" | "right_click" | "middle_click" | "double_click" | "screenshot" | "cursor_position" | "hold_key" | "left_mouse_down" | "left_mouse_up" | "triple_click" | "scroll" | "wait";
    text?: string | undefined;
    coordinate?: [number, number] | undefined;
    duration?: number | undefined;
    scroll_amount?: number | undefined;
    scroll_direction?: "up" | "down" | "left" | "right" | undefined;
    start_coordinate?: [number, number] | undefined;
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
declare function computerTool_20250124<RESULT>(options: {
    displayWidthPx: number;
    displayHeightPx: number;
    displayNumber?: number;
    execute?: ExecuteFunction<{
        /**
         * - `key`: Press a key or key-combination on the keyboard.
         *   - This supports xdotool's `key` syntax.
         *   - Examples: "a", "Return", "alt+Tab", "ctrl+s", "Up", "KP_0" (for the numpad 0 key).
         * - `hold_key`: Hold down a key or multiple keys for a specified duration (in seconds). Supports the same syntax as `key`.
         * - `type`: Type a string of text on the keyboard.
         * - `cursor_position`: Get the current (x, y) pixel coordinate of the cursor on the screen.
         * - `mouse_move`: Move the cursor to a specified (x, y) pixel coordinate on the screen.
         * - `left_mouse_down`: Press the left mouse button.
         * - `left_mouse_up`: Release the left mouse button.
         * - `left_click`: Click the left mouse button at the specified (x, y) pixel coordinate on the screen. You can also include a key combination to hold down while clicking using the `text` parameter.
         * - `left_click_drag`: Click and drag the cursor from `start_coordinate` to a specified (x, y) pixel coordinate on the screen.
         * - `right_click`: Click the right mouse button at the specified (x, y) pixel coordinate on the screen.
         * - `middle_click`: Click the middle mouse button at the specified (x, y) pixel coordinate on the screen.
         * - `double_click`: Double-click the left mouse button at the specified (x, y) pixel coordinate on the screen.
         * - `triple_click`: Triple-click the left mouse button at the specified (x, y) pixel coordinate on the screen.
         * - `scroll`: Scroll the screen in a specified direction by a specified amount of clicks of the scroll wheel, at the specified (x, y) pixel coordinate. DO NOT use PageUp/PageDown to scroll.
         * - `wait`: Wait for a specified duration (in seconds).
         * - `screenshot`: Take a screenshot of the screen.
         */
        action: 'key' | 'hold_key' | 'type' | 'cursor_position' | 'mouse_move' | 'left_mouse_down' | 'left_mouse_up' | 'left_click' | 'left_click_drag' | 'right_click' | 'middle_click' | 'double_click' | 'triple_click' | 'scroll' | 'wait' | 'screenshot';
        /**
         * (x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates to move the mouse to. Required only by `action=mouse_move` and `action=left_click_drag`.
         */
        coordinate?: [number, number];
        /**
         * The duration to hold the key down for. Required only by `action=hold_key` and `action=wait`.
         */
        duration?: number;
        /**
         * The number of 'clicks' to scroll. Required only by `action=scroll`.
         */
        scroll_amount?: number;
        /**
         * The direction to scroll the screen. Required only by `action=scroll`.
         */
        scroll_direction?: 'up' | 'down' | 'left' | 'right';
        /**
         * (x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates to start the drag from. Required only by `action=left_click_drag`.
         */
        start_coordinate?: [number, number];
        /**
         * Required only by `action=type`, `action=key`, and `action=hold_key`. Can also be used by click or scroll actions to hold down keys while clicking or scrolling.
         */
        text?: string;
    }, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
}): {
    type: 'provider-defined';
    id: 'anthropic.computer_20250124';
    args: {};
    parameters: typeof Computer20250124Parameters;
    execute: ExecuteFunction<z.infer<typeof Computer20250124Parameters>, RESULT>;
    experimental_toToolResultContent?: (result: RESULT) => ToolResultContent;
};
declare const anthropicTools: {
    bash_20241022: typeof bashTool_20241022;
    bash_20250124: typeof bashTool_20250124;
    textEditor_20241022: typeof textEditorTool_20241022;
    textEditor_20250124: typeof textEditorTool_20250124;
    computer_20241022: typeof computerTool_20241022;
    computer_20250124: typeof computerTool_20250124;
};

interface AnthropicProvider extends ProviderV1 {
    /**
  Creates a model for text generation.
  */
    (modelId: AnthropicMessagesModelId, settings?: AnthropicMessagesSettings): LanguageModelV1;
    /**
  Creates a model for text generation.
  */
    languageModel(modelId: AnthropicMessagesModelId, settings?: AnthropicMessagesSettings): LanguageModelV1;
    /**
  @deprecated Use `.languageModel()` instead.
  */
    chat(modelId: AnthropicMessagesModelId, settings?: AnthropicMessagesSettings): LanguageModelV1;
    /**
  @deprecated Use `.languageModel()` instead.
     */
    messages(modelId: AnthropicMessagesModelId, settings?: AnthropicMessagesSettings): LanguageModelV1;
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
