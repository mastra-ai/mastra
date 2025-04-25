import { format } from './format';
import type { BasePromptTemplateOptions, ChatMessage, PromptTemplateOptions } from './types';

export abstract class BasePromptTemplate<const TemplatesVar extends readonly string[] = string[]> {
  templateVars: Set<string> = new Set();
  options: Partial<Record<TemplatesVar[number] | (string & {}), string>> = {};

  protected constructor(options: BasePromptTemplateOptions<TemplatesVar>) {
    const { templateVars } = options;
    if (templateVars) {
      this.templateVars = new Set(templateVars);
    }
    if (options.options) {
      this.options = options.options;
    }
  }

  abstract partialFormat(
    options: Partial<Record<TemplatesVar[number] | (string & {}), string>>,
  ): BasePromptTemplate<TemplatesVar>;

  abstract format(options?: Partial<Record<TemplatesVar[number] | (string & {}), string>>): string;

  abstract formatMessages(options?: Partial<Record<TemplatesVar[number] | (string & {}), string>>): ChatMessage[];

  abstract get template(): string;
}

export class PromptTemplate<
  const TemplatesVar extends readonly string[] = string[],
> extends BasePromptTemplate<TemplatesVar> {
  #template: string;

  constructor(options: PromptTemplateOptions<TemplatesVar>) {
    const { template, ...rest } = options;
    super(rest);
    this.#template = template;
  }

  partialFormat(options: Partial<Record<TemplatesVar[number] | (string & {}), string>>): PromptTemplate<TemplatesVar> {
    const prompt = new PromptTemplate({
      template: this.template,
      templateVars: [...this.templateVars],
      options: this.options,
    });

    prompt.options = {
      ...prompt.options,
      ...options,
    };

    return prompt;
  }

  format(options?: Partial<Record<TemplatesVar[number] | (string & {}), string>>): string {
    const allOptions = {
      ...this.options,
      ...options,
    } as Record<TemplatesVar[number], string>;

    return format(this.template, allOptions);
  }

  formatMessages(options?: Partial<Record<TemplatesVar[number] | (string & {}), string>>): ChatMessage[] {
    const prompt = this.format(options);
    return [
      {
        role: 'user',
        content: prompt,
      },
    ];
  }

  get template(): string {
    return this.#template;
  }
}
