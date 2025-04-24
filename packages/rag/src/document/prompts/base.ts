import { format } from './format';
import type { ChatMessage } from './types';

export type BasePromptTemplateOptions<TemplatesVar extends readonly string[]> = {
  templateVars?:
    | TemplatesVar
    // loose type for better type inference
    | readonly string[];
  options?: Partial<Record<TemplatesVar[number] | (string & {}), string>>;
};

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

type Permutation<T, K = T> = [T] extends [never] ? [] : K extends K ? [K, ...Permutation<Exclude<T, K>>] : never;

type Join<T extends any[], U extends string> = T extends [infer F, ...infer R]
  ? R['length'] extends 0
    ? `${F & string}`
    : `${F & string}${U}${Join<R, U>}`
  : never;

type WrapStringWithBracket<T extends string> = `{${T}}`;

export type StringTemplate<Var extends readonly string[]> = Var['length'] extends 0
  ? string
  : Var['length'] extends number
    ? number extends Var['length']
      ? string
      : `${string}${Join<Permutation<WrapStringWithBracket<Var[number]>>, `${string}`>}${string}`
    : never;

export type PromptTemplateOptions<
  TemplatesVar extends readonly string[],
  Template extends StringTemplate<TemplatesVar>,
> = BasePromptTemplateOptions<TemplatesVar> & {
  template: Template;
};

export class PromptTemplate<
  const TemplatesVar extends readonly string[] = string[],
  const Template extends StringTemplate<TemplatesVar> = StringTemplate<TemplatesVar>,
> extends BasePromptTemplate<TemplatesVar> {
  #template: Template;

  constructor(options: PromptTemplateOptions<TemplatesVar, Template>) {
    const { template, ...rest } = options;
    super(rest);
    this.#template = template;
  }

  partialFormat(
    options: Partial<Record<TemplatesVar[number] | (string & {}), string>>,
  ): PromptTemplate<TemplatesVar, Template> {
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

  get template(): Template {
    return this.#template;
  }
}
