/**
 * Core component configuration for prompt template sections.
 * Defines the structure and behavior of individual prompt components
 * including constraints, examples, and various thinking approaches.
 */
interface PromptTemplateComponent {
  /**
   * Response limitations/requirements
   */
  constraints: string[];

  /**
   * Few-shot learning examples
   */
  examples: {
    input: string;
    output: string;
  }[];

  /**
   * Text delimiter options for structure
   */
  delimiters:
    | 'OFF'
    | 'QUOTES'
    | {
        type: 'XML';
        tag: string;
      };

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
}

/**
 * Configuration for prompt template construction.
 * Supports various prompting techniques and formatting options
 * that have shown to improve model performance in research.
 */
interface PromptTemplateConstructor extends Partial<PromptTemplateComponent> {
  /**
   * Primary instruction/goal
   */
  intent: string;

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

export class PromptTemplate {
  config: PromptTemplateConstructor;
  prompt: string[] = [];
  components: Partial<PromptTemplateComponent>[] = [];

  constructor(config: PromptTemplateConstructor) {
    this.config = config;
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
     * Add examples if specified
     */
    if (config.examples?.length) {
      component.push('\nEXAMPLES:');
      config.examples.forEach(example => {
        component.push(`Input: ${example.input}`);
        component.push(`Output: ${example.output}\n`);
      });
    }

    /*
     * Add thinking steps if auto-thinking is enabled
     */
    if (config.thinking) {
      /*
       * Add chain of thought if enabled
       */
      if (config.thinking.autoChainOfThought) {
        component.push("Let's solve this step by step");
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

      if (config.thinking.autoSelfAsk) {
        component.push("\nLet's self-ask and verify our solution");
      }

      if (config.thinking.autoVerification) {
        component.push("\nLet's verify our solution");
      }

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

    intro.push(`${this.config.intent} \n`);

    /*
     * Main
     */
    const main = this.buildPromptComponent(this.config);

    /*
     * Outro
     */
    if (this.config.outputFormat) {
      outro.push(`Please output your response in the following format: ${this.config.outputFormat} \n`);
    }

    return {
      intro,
      main,
      outro,
    };
  }

  component(config: Partial<PromptTemplateComponent>) {
    this.components.push(config);
  }

  toString(): string {
    const { intro, main, outro } = this.layout;
    const components = this.components.flatMap(component => this.buildPromptComponent(component));

    const prompt = [intro, main, components, outro].join('\n');
    return prompt;
  }

  toMessage() {
    return {
      role: this.config.as || 'system',
      content: this.toString(),
    };
  }
}
