import type { BasePromptTemplateOptions, ChatMessage, PromptTemplateOptions } from './types.js';
export declare abstract class BasePromptTemplate<const TemplatesVar extends readonly string[] = string[]> {
    templateVars: Set<string>;
    options: Partial<Record<TemplatesVar[number] | (string & {}), string>>;
    protected constructor(options: BasePromptTemplateOptions<TemplatesVar>);
    abstract partialFormat(options: Partial<Record<TemplatesVar[number] | (string & {}), string>>): BasePromptTemplate<TemplatesVar>;
    abstract format(options?: Partial<Record<TemplatesVar[number] | (string & {}), string>>): string;
    abstract formatMessages(options?: Partial<Record<TemplatesVar[number] | (string & {}), string>>): ChatMessage[];
    abstract get template(): string;
}
export declare class PromptTemplate<const TemplatesVar extends readonly string[] = string[]> extends BasePromptTemplate<TemplatesVar> {
    #private;
    constructor(options: PromptTemplateOptions<TemplatesVar>);
    partialFormat(options: Partial<Record<TemplatesVar[number] | (string & {}), string>>): PromptTemplate<TemplatesVar>;
    format(options?: Partial<Record<TemplatesVar[number] | (string & {}), string>>): string;
    formatMessages(options?: Partial<Record<TemplatesVar[number] | (string & {}), string>>): ChatMessage[];
    get template(): string;
}
//# sourceMappingURL=base.d.ts.map