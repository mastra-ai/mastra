import { parseMemoryRuntimeContext } from '../../memory/types';
import type { MastraMessageV2 } from '../../memory/types';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage/domains/memory/base';
import type { InputProcessor } from '../index';

export interface WorkingMemoryTemplate {
  format: 'markdown' | 'json';
  content: string;
}

export interface WorkingMemoryConfig {
  template?: WorkingMemoryTemplate;
  scope?: 'thread' | 'resource';
  useVNext?: boolean;
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
export class WorkingMemory implements InputProcessor {
  name = 'WorkingMemory';

  private defaultWorkingMemoryTemplate = `# Working Memory

## User Information
- Name:
- Preferences:
- Context:

## Conversation State
- Current Topic:
- Key Points:
- Action Items:`;

  constructor(
    private options: {
      storage: MemoryStorage;
      template?: WorkingMemoryTemplate;
      scope?: 'thread' | 'resource';
      useVNext?: boolean;
    },
  ) {}

  async processInput(args: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
    runtimeContext?: RequestContext;
  }): Promise<MastraMessageV2[]> {
    const { messages, runtimeContext } = args;

    // Get threadId and resourceId from runtime context
    const memoryContext = parseMemoryRuntimeContext(runtimeContext);
    const threadId = memoryContext?.thread?.id;
    const resourceId = memoryContext?.resourceId;

    // Skip if no thread or resource context
    if (!threadId && !resourceId) {
      return messages;
    }

    try {
      // Determine scope (default to 'thread')
      const scope = this.options.scope || 'thread';

      // Retrieve working memory based on scope
      let workingMemoryData: string | null = null;

      if (scope === 'thread' && threadId) {
        // Get thread-scoped working memory
        const thread = await this.options.storage.getThreadById({ threadId });
        workingMemoryData = (thread?.metadata?.workingMemory as string) || null;
      } else if (scope === 'resource' && resourceId) {
        // Get resource-scoped working memory
        const resource = await this.options.storage.getResourceById({ resourceId });
        workingMemoryData = resource?.workingMemory || null;
      }

      // Get template (use provided or default)
      const template = this.options.template || {
        format: 'markdown' as const,
        content: this.defaultWorkingMemoryTemplate,
      };

      // Format working memory instruction
      const instruction = this.options.useVNext
        ? this.getWorkingMemoryToolInstructionVNext({ template, data: workingMemoryData })
        : this.getWorkingMemoryToolInstruction({ template, data: workingMemoryData });

      // Create system message with working memory instruction
      const workingMemoryMessage: MastraMessageV2 = {
        id: `working-memory-${Date.now()}`,
        role: 'system',
        content: {
          format: 2,
          content: instruction,
          parts: [],
        },
        createdAt: new Date(),
      };

      // Prepend working memory to messages
      return [workingMemoryMessage, ...messages];
    } catch (error) {
      // On error, return original messages
      console.error('WorkingMemory processor error:', error);
      return messages;
    }
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
${data || ''}
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
${data || ''}
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
