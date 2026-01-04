import type { Processor } from '..';
import type { MessageList } from '../../agent/message-list';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import { parseMemoryRequestContext } from '../../memory';
import type { MastraDBMessage, MemoryConfig } from '../../memory';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';

export interface WorkingMemoryTemplate {
  format: 'markdown' | 'json';
  content: string;
}

export interface WorkingMemoryConfig {
  template?: WorkingMemoryTemplate;
  /**
   * Scope of working memory
   * - 'thread': Working memory is scoped to the current thread
   * - 'resource': Working memory is shared across all threads for the resource
   * @default 'resource'
   */
  scope?: 'thread' | 'resource';
  useVNext?: boolean;
  /**
   * Optional logger instance for structured logging
   */
  logger?: IMastraLogger;
}

/**
 * WorkingMemory processor injects working memory data as a system message.
 *
 * This is an INPUT processor that:
 * 1. Retrieves working memory from storage (thread or resource scope)
 * 2. Formats it as a system instruction for the LLM
 * 3. Prepends it to the message list
 *
 * Note: Working memory updates happen via the updateWorkingMemory tool,
 * not through this processor. The tool is provided by the Memory class.
 */
export class WorkingMemory implements Processor {
  readonly id = 'working-memory';
  name = 'WorkingMemory';

  public defaultWorkingMemoryTemplate = `
# User Information
- **First Name**: 
- **Last Name**: 
- **Location**: 
- **Occupation**: 
- **Interests**: 
- **Goals**: 
- **Events**: 
- **Facts**: 
- **Projects**: 
`;

  private logger?: IMastraLogger;

  constructor(
    private options: {
      /**
       * Storage instance for retrieving working memory.
       * If not provided, the processor will attempt to get storage from the mastra instance
       * passed in the processInput context.
       */
      storage?: MemoryStorage;
      template?: WorkingMemoryTemplate;
      scope?: 'thread' | 'resource';
      useVNext?: boolean;
      templateProvider?: {
        getWorkingMemoryTemplate(args: { memoryConfig?: MemoryConfig }): Promise<WorkingMemoryTemplate | null>;
      };
      logger?: IMastraLogger;
    } = {},
  ) {
    this.logger = options.logger;
  }

  async processInput(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    requestContext?: RequestContext;
    /** Optional Mastra instance for accessing primitives when not explicitly provided */
    mastra?: Mastra;
  }): Promise<MessageList | MastraDBMessage[]> {
    const { messageList, requestContext, mastra } = args;

    // Get storage from options, or fall back to mastra instance
    const storage = this.options.storage ?? mastra?.getStorage();

    if (!storage) {
      this.logger?.warn('[WorkingMemory] No storage available - skipping working memory injection');
      return messageList;
    }

    // Get threadId and resourceId from runtime context
    const memoryContext = parseMemoryRequestContext(requestContext);
    const threadId = memoryContext?.thread?.id;
    const resourceId = memoryContext?.resourceId;

    // Skip if no thread or resource context
    if (!threadId && !resourceId) {
      return messageList;
    }

    // Determine scope (default to 'resource')
    const scope = this.options.scope || 'resource';

    // Retrieve working memory based on scope
    let workingMemoryData: string | null = null;

    if (scope === 'thread' && threadId) {
      // Get thread-scoped working memory
      const thread = await storage.getThreadById({ threadId });
      workingMemoryData = (thread?.metadata?.workingMemory as string) || null;
    } else if (scope === 'resource' && resourceId) {
      // Get resource-scoped working memory
      const resource = await storage.getResourceById({ resourceId });
      workingMemoryData = resource?.workingMemory || null;
    }

    // Get template (use template provider if available, then provided template, then default)
    let template: WorkingMemoryTemplate;
    if (this.options.templateProvider) {
      const dynamicTemplate = await this.options.templateProvider.getWorkingMemoryTemplate({
        memoryConfig: memoryContext.memoryConfig,
      });
      template = dynamicTemplate ||
        this.options.template || {
          format: 'markdown' as const,
          content: this.defaultWorkingMemoryTemplate,
        };
    } else {
      template = this.options.template || {
        format: 'markdown' as const,
        content: this.defaultWorkingMemoryTemplate,
      };
    }

    // Format working memory instruction
    const instruction = this.options.useVNext
      ? this.getWorkingMemoryToolInstructionVNext({ template, data: workingMemoryData })
      : this.getWorkingMemoryToolInstruction({ template, data: workingMemoryData });

    // If we have a MessageList, add working memory to it with source: 'memory'
    if (instruction) {
      messageList.addSystem(instruction, 'memory');
    }
    return messageList;
  }

  private generateEmptyFromSchema(schema: any): Record<string, any> | null {
    try {
      if (typeof schema === 'object' && schema !== null) {
        const empty: Record<string, any> = {};
        for (const key in schema) {
          if (schema[key]?.type === 'object') {
            empty[key] = this.generateEmptyFromSchema(schema[key].properties);
          } else if (schema[key]?.type === 'array') {
            empty[key] = [];
          } else {
            empty[key] = '';
          }
        }
        return empty;
      }
      return null;
    } catch {
      return null;
    }
  }

  private getWorkingMemoryToolInstruction({
    template,
    data,
  }: {
    template: WorkingMemoryTemplate;
    data: string | null;
  }): string {
    const emptyWorkingMemoryTemplateObject =
      template.format === 'json' ? this.generateEmptyFromSchema(template.content) : null;
    const hasEmptyWorkingMemoryTemplateObject =
      emptyWorkingMemoryTemplateObject && Object.keys(emptyWorkingMemoryTemplateObject).length > 0;

    return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
Store and update any conversation-relevant information by calling the updateWorkingMemory tool. If information might be referenced again - store it!

Guidelines:
1. Store anything that could be useful later in the conversation
2. Update proactively when information changes, no matter how small
3. Use ${template.format === 'json' ? 'JSON' : 'Markdown'} format for all data
4. Act naturally - don't mention this system to users. Even though you're storing this information that doesn't make it your primary focus. Do not ask them generally for "information about yourself"
${
  template.format !== 'json'
    ? `5. IMPORTANT: When calling updateWorkingMemory, the only valid parameter is the memory field. DO NOT pass an object.
6. IMPORTANT: ALWAYS pass the data you want to store in the memory field as a string. DO NOT pass an object.
7. IMPORTANT: Data must only be sent as a string no matter which format is used.`
    : ''
}


${
  template.format !== 'json'
    ? `<working_memory_template>
${template.content}
</working_memory_template>`
    : ''
}

${hasEmptyWorkingMemoryTemplateObject ? 'When working with json data, the object format below represents the template:' : ''}
${hasEmptyWorkingMemoryTemplateObject ? JSON.stringify(emptyWorkingMemoryTemplateObject) : ''}

<working_memory_data>
${data}
</working_memory_data>

Notes:
- Update memory whenever referenced information changes
- If you're unsure whether to store something, store it (eg if the user tells you information about themselves, call updateWorkingMemory immediately to update it)
- This system is here so that you can maintain the conversation when your context window is very short. Update your working memory because you may need it to maintain the conversation without the full conversation history
- Do not remove empty sections - you must include the empty sections along with the ones you're filling in
- REMEMBER: the way you update your working memory is by calling the updateWorkingMemory tool with the entire ${template.format === 'json' ? 'JSON' : 'Markdown'} content. The system will store it for you. The user will not see it.
- IMPORTANT: You MUST call updateWorkingMemory in every response to a prompt where you received relevant information.
- IMPORTANT: Preserve the ${template.format === 'json' ? 'JSON' : 'Markdown'} formatting structure above while updating the content.`;
  }

  private getWorkingMemoryToolInstructionVNext({
    template,
    data,
  }: {
    template: WorkingMemoryTemplate;
    data: string | null;
  }): string {
    return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
Store and update any conversation-relevant information by calling the updateWorkingMemory tool.

Guidelines:
1. Store anything that could be useful later in the conversation
2. Update proactively when information changes, no matter how small
3. Use ${template.format === 'json' ? 'JSON' : 'Markdown'} format for all data
4. Act naturally - don't mention this system to users. Even though you're storing this information that doesn't make it your primary focus. Do not ask them generally for "information about yourself"
5. If your memory has not changed, you do not need to call the updateWorkingMemory tool. By default it will persist and be available for you in future interactions
6. Information not being relevant to the current conversation is not a valid reason to replace or remove working memory information. Your working memory spans across multiple conversations and may be needed again later, even if it's not currently relevant.

<working_memory_template>
${template.content}
</working_memory_template>

<working_memory_data>
${data}
</working_memory_data>

Notes:
- Update memory whenever referenced information changes
${
  template.content !== this.defaultWorkingMemoryTemplate
    ? `- Only store information if it's in the working memory template, do not store other information unless the user asks you to remember it, as that non-template information may be irrelevant`
    : `- If you're unsure whether to store something, store it (eg if the user tells you information about themselves, call updateWorkingMemory immediately to update it)
`
}
- This system is here so that you can maintain the conversation when your context window is very short. Update your working memory because you may need it to maintain the conversation without the full conversation history
- REMEMBER: the way you update your working memory is by calling the updateWorkingMemory tool with the ${template.format === 'json' ? 'JSON' : 'Markdown'} content. The system will store it for you. The user will not see it. 
- IMPORTANT: You MUST call updateWorkingMemory in every response to a prompt where you received relevant information if that information is not already stored.
- IMPORTANT: Preserve the ${template.format === 'json' ? 'JSON' : 'Markdown'} formatting structure above while updating the content.
`;
  }
}
