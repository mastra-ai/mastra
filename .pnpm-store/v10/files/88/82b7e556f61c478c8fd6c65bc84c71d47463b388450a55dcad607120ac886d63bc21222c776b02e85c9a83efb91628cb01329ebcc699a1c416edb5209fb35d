export type EnvValue = string | undefined;
export type Env = Record<string, EnvValue>;
/**
 * allProcessEnv returns the current process environment variables, or an empty
 * object if they cannot be read, making sure we support environments other than
 * Node such as Deno, too.
 *
 * Using this ensures we don't dangerously access `process.env` in environments
 * where it may not be defined, such as Deno or the browser.
 */
export declare const allProcessEnv: () => Env;
export declare const processEnv: (key: string) => EnvValue;
export declare enum envKeys {
    OpenAiApiKey = "OPENAI_API_KEY",
    GeminiApiKey = "GEMINI_API_KEY",
    AnthropicApiKey = "ANTHROPIC_API_KEY",
    DeepSeekApiKey = "DEEPSEEK_API_KEY",
    GrokApiKey = "XAI_API_KEY",
    AzureOpenAiApiKey = "AZURE_OPENAI_API_KEY"
}
//# sourceMappingURL=env.d.ts.map