/**
 * Core component configuration for prompt template sections.
 * Defines the structure and behavior of individual prompt components
 * including constraints, examples, and various thinking approaches.
 *
 */
interface PromptTemplateComponent {
  /**
   * Input data for the propmt component, add variables here like so {{variable}}
   */
  text: string;

  /**
   * Response limitations/requirements
   */
  constraints: string[];

  /**
   * Few-shot learning examples
   */
  examples: {
    input: string | Record<string, any>;
    output: string | Record<string, any>;
  }[];

  /**
   * Cognitive enhancement configurations
   */
  thinking: {
    /**
     * Step-by-step reasoning
     */
    autoChainOfThought?: boolean;

    /**
     * Multiple approach exploration
     */
    autoTreeOfThought?: boolean;

    /**
     * Self-questioning mechanism
     */
    autoSelfAsk?: boolean;

    /**
     * Solution verification
     */
    autoVerification?: boolean;

    /**
     * Explicit reasoning steps
     */
    steps?: string[];

    /**
     * Tree-of-thought branches
     */
    branches?: {
      [key: string]: string[];
    };

    /**
     * Verification process steps
     */
    verificationSteps?: string[];
  };
  /**
   * Emphasis configurations
   */
  emphasis: { type: 'IMPORTANT !!!' } | { type: 'CALLOUT' } | { type: 'CUSTOM'; text: string };
  /**
   * Contextual information
   */
  context: string;
}

/**
 * Configuration for prompt template construction.
 * Supports various prompting techniques and formatting options
 * that have shown to improve model performance in research.
 */
interface PromptTemplateConstructor {
  /**
   * Professional role/persona to guide response style
   */
  persona?: string;

  /**
   * Response style (analytical, creative, etc.)
   */
  style?: string;

  /**
   * Communication tone affecting response formality
   */
  tone?: string;

  /**
   * Output structure specification
   */
  outputFormat?: string;

  /**
   * Point of view for response
   */
  perspective?: string;

  /**
   * Message role designation
   */
  as?: 'system' | 'user';
}

export class PromptTemplate<TVariables extends Record<string, any> | undefined = undefined> {
  private intent: string;
  private config: PromptTemplateConstructor;
  private components: Partial<PromptTemplateComponent>[] = [];

  constructor(intent: string, config?: PromptTemplateConstructor) {
    this.intent = intent;
    this.config = config ?? {};
  }

  text(text: PromptTemplateComponent['text']) {
    this.components.push({ text });
    return this;
  }

  constraints(constraints: PromptTemplateComponent['constraints']) {
    this.components.push({ constraints });
    return this;
  }

  examples(examples: PromptTemplateComponent['examples']) {
    this.components.push({ examples });
    return this;
  }

  thinking(config: PromptTemplateComponent['thinking']) {
    this.components.push({ thinking: config });
    return this;
  }

  emphasis(emphasis: PromptTemplateComponent['emphasis']) {
    this.components.push({ emphasis });
    return this;
  }

  context(context: PromptTemplateComponent['context']) {
    this.components.push({ context });
    return this;
  }

  private buildPromptComponent(config: Partial<PromptTemplateComponent>) {
    const component: string[] = [];

    /*
     * Add constraints if specified
     */
    if (config.constraints?.length) {
      component.push('CONSTRAINTS:');
      config.constraints.forEach(constraint => {
        component.push(`- ${constraint}`);
      });
    }

    if (config.emphasis) {
      if (config.emphasis.type === 'IMPORTANT !!!') {
        component.push('[IMPORTANT !!!] \n');
      } else if (config.emphasis.type === 'CALLOUT') {
        component.push('[CALLOUT] \n');
      } else if (config.emphasis.type === 'CUSTOM') {
        component.push(`[${config.emphasis.text}] \n`);
      }
    }

    /*
     * Add context if specified
     */
    if (config.context) {
      component.push(`[CONTEXT] \n${config.context} \n`);
    }

    /*
     * Add examples if specified
     */
    if (config.examples?.length) {
      component.push('\nEXAMPLES:');
      config.examples.forEach(example => {
        component.push(`Input: ${example.input}`);
        component.push(`Output: ${example.output}`);
      });
    }

    /*
     * Add input if specified
     */
    if (config.text) {
      component.push(`${config.text} \n`);
    }

    /*
     * Add thinking steps if auto-thinking is enabled
     */
    if (config.thinking) {
      /*
       * Add chain of thought if enabled
       */
      if (config.thinking.autoChainOfThought) {
        component.push("Let's solve this step by step \n");
      }
      /*
       * Add steps if specified
       */
      if (config.thinking.steps?.length) {
        config.thinking.steps.forEach((step, index) => {
          component.push(`${index + 1}. ${step}`);
        });
      }

      /*
       * Add tree of thought if enabled
       */
      if (config.thinking.autoTreeOfThought) {
        component.push(
          "\nLet's explore multiple ways of solving this problem and go through each approach step by step",
        );
      } else if (config.thinking.branches) {
        /*
         * Else add explicit three of thought branches
         */
        Object.entries(config.thinking.branches).forEach(([branch, thoughts]) => {
          component.push(`\n${branch} Approach:`);
          thoughts.forEach((thought, index) => {
            component.push(`  ${index + 1}. ${thought}`);
          });
        });
      }

      /*
       * Add self-ask if enabled
       */
      if (config.thinking.autoSelfAsk) {
        component.push("\nLet's break this down by asking ourselves questions \n");
      }
      /*
       * Add verification if enabled
       */
      if (config.thinking.autoVerification) {
        component.push("\nLet's verify our solution \n");
      }

      /*
       * Add verification steps if specified
       */
      if (config.thinking.verificationSteps?.length) {
        component.push("\nLet's verify our solution");
        config.thinking.verificationSteps.forEach((step, index) => {
          component.push(`${index + 1}. ${step}`);
        });
      }
    }

    return component;
  }

  get layout() {
    const intro: string[] = [];
    const outro: string[] = [];

    /*
     * Intro
     */

    /*
     * Add persona if specified
     */
    if (this.config.persona) {
      intro.push(`As a ${this.config.persona.toUpperCase()}:`);
    }

    /*
     * Add style and tone if specified
     */
    if (this.config.style || this.config.tone) {
      const styleStr = [this.config.style, this.config.tone].filter(Boolean).join(', ');
      intro.push(`Write in a ${styleStr} manner: \n`);
    }

    /*
     * Add perspective if specified
     */
    if (this.config.perspective) {
      intro.push(`From the perspective of ${this.config.perspective}: \n`);
    }

    intro.push(`${this.intent} \n`);

    /*
     * Outro
     */
    if (this.config.outputFormat) {
      outro.push(`Please output your response in the following format: ${this.config.outputFormat} \n`);
    }

    return {
      intro,
      outro,
    };
  }

  toString(variables?: TVariables): string {
    const { intro, outro } = this.layout;

    const components = this.components.flatMap(component => this.buildPromptComponent(component));

    const prompt = [intro.join('\n'), components.join('\n'), outro.join('\n')].filter(Boolean).join('\n\n');

    let hydratedPrompt = prompt;

    Object.entries(variables ?? {})?.forEach(([k, v]) => {
      hydratedPrompt = hydratedPrompt.replace(`{{${k}}}`, `${v}`);
    });

    return hydratedPrompt;
  }

  toMessage(variables?: TVariables) {
    return {
      role: this.config.as || 'system',
      content: this.toString(variables),
    };
  }
}

export function createPrompt<TVariables extends Record<string, any> | undefined = undefined>(
  intent: string,
  config?: PromptTemplateConstructor,
) {
  return new PromptTemplate<TVariables>(intent, config);
}
