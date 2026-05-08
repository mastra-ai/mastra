/**
 * SkillSearchProcessor - On-demand skill discovery for agents with many skills.
 *
 * Instead of injecting all skill metadata upfront (like SkillsProcessor),
 * this processor provides search_skills and load_skill meta-tools so skills
 * are discovered on-demand with thread-scoped state and TTL cleanup.
 *
 * Mirrors the ToolSearchProcessor pattern but for skills.
 *
 * @example
 * ```typescript
 * const skillSearch = new SkillSearchProcessor({
 *   workspace,
 *   search: { topK: 5, minScore: 0 },
 *   ttl: 3600000, // 1 hour (default)
 * });
 *
 * const agent = new Agent({
 *   workspace,
 *   inputProcessors: [skillSearch],
 * });
 * ```
 */
import { z } from 'zod/v4';
import { MASTRA_THREAD_ID_KEY } from '../../request-context';
import { createTool } from '../../tools';
import type { WorkspaceSkills } from '../../workspace/skills';
import type { Workspace } from '../../workspace/workspace';
import type { ProcessInputStepArgs, Processor } from '../index';

/**
 * Thread state with timestamp for TTL management
 */
interface ThreadState {
  /** Map of skillName → full instructions */
  skills: Map<string, string>;
  lastAccessed: number;
}

/**
 * Configuration options for SkillSearchProcessor
 */
export interface SkillSearchProcessorOptions {
  /**
   * Workspace instance containing skills.
   * Skills are accessed via workspace.skills.
   */
  workspace: Workspace;

  /**
   * Configuration for the search behavior
   */
  search?: {
    /**
     * Maximum number of skills to return in search results
     * @default 5
     */
    topK?: number;

    /**
     * Minimum relevance score for including a skill in search results
     * @default 0
     */
    minScore?: number;
  };

  /**
   * Time-to-live for thread state in milliseconds.
   * After this duration of inactivity, thread state will be eligible for cleanup.
   * Set to 0 to disable TTL cleanup.
   * @default 3600000 (1 hour)
   */
  ttl?: number;
}

/**
 * Processor that enables on-demand skill discovery and loading.
 *
 * Instead of injecting all skill metadata upfront, this processor:
 * 1. Gives the agent two meta-tools: search_skills and load_skill
 * 2. Agent searches for relevant skills using keywords
 * 3. Agent loads specific skills into the conversation on demand
 * 4. Loaded skill instructions appear as system messages
 *
 * This pattern reduces context usage when workspaces have many skills.
 */
export class SkillSearchProcessor implements Processor<'skill-search'> {
  readonly id = 'skill-search';
  readonly name = 'Skill Search Processor';
  readonly description = 'Enables on-demand skill discovery and loading via search';
  readonly providesSkillDiscovery: Processor['providesSkillDiscovery'] = 'on-demand';

  private readonly workspace: Workspace;
  private readonly searchConfig: { topK: number; minScore: number };
  private readonly ttl: number;
  private cleanupIntervalId?: ReturnType<typeof setInterval>;

  /**
   * Thread-scoped state management for loaded skills with TTL support.
   * Maps threadId -> ThreadState (skills + timestamp)
   */
  private threadLoadedSkills = new Map<string, ThreadState>();

  constructor(options: SkillSearchProcessorOptions) {
    this.workspace = options.workspace;
    this.searchConfig = {
      topK: options.search?.topK ?? 5,
      minScore: options.search?.minScore ?? 0,
    };
    this.ttl = options.ttl ?? 3600000; // Default: 1 hour

    if (this.ttl > 0) {
      this.scheduleCleanup();
    }
  }

  /**
   * Dispose of this processor, clearing the cleanup interval and all thread state.
   * Call this when the processor is no longer needed to prevent timer leaks.
   */
  public dispose(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
    this.clearAllState();
  }

  /**
   * Get the workspace skills interface
   */
  private get skills(): WorkspaceSkills | undefined {
    return this.workspace.skills;
  }

  /**
   * Get the thread ID from the request context, or use 'default' as fallback.
   */
  private getThreadId(args: ProcessInputStepArgs): string {
    return args.requestContext?.get(MASTRA_THREAD_ID_KEY) || 'default';
  }

  /**
   * Get or create thread state for the given thread.
   * Updates the lastAccessed timestamp for TTL management.
   */
  private getThreadState(threadId: string): ThreadState {
    if (!this.threadLoadedSkills.has(threadId)) {
      this.threadLoadedSkills.set(threadId, {
        skills: new Map(),
        lastAccessed: Date.now(),
      });
    }
    const state = this.threadLoadedSkills.get(threadId)!;
    state.lastAccessed = Date.now();
    return state;
  }

  /**
   * Clear loaded skills for a specific thread.
   */
  public clearState(threadId: string = 'default'): void {
    this.threadLoadedSkills.delete(threadId);
  }

  /**
   * Clear all thread state for this processor instance.
   */
  public clearAllState(): void {
    this.threadLoadedSkills.clear();
  }

  /**
   * Clean up stale thread state based on TTL.
   * @returns Number of threads cleaned up
   */
  private cleanupStaleState(): number {
    if (this.ttl <= 0) return 0;

    const now = Date.now();
    let cleanedCount = 0;

    for (const [threadId, state] of this.threadLoadedSkills.entries()) {
      if (now - state.lastAccessed > this.ttl) {
        this.threadLoadedSkills.delete(threadId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Schedule periodic cleanup of stale thread state.
   */
  private scheduleCleanup(): void {
    const cleanupInterval = Math.max(this.ttl / 2, 60000); // Minimum 1 minute
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupStaleState();
    }, cleanupInterval);

    if (this.cleanupIntervalId.unref) {
      this.cleanupIntervalId.unref();
    }
  }

  /**
   * Get statistics about current thread state.
   */
  public getStateStats(): { threadCount: number; oldestAccessTime: number | null } {
    if (this.threadLoadedSkills.size === 0) {
      return { threadCount: 0, oldestAccessTime: null };
    }

    let oldest = Date.now();
    for (const state of this.threadLoadedSkills.values()) {
      if (state.lastAccessed < oldest) {
        oldest = state.lastAccessed;
      }
    }

    return {
      threadCount: this.threadLoadedSkills.size,
      oldestAccessTime: oldest,
    };
  }

  /**
   * Manually trigger cleanup of stale state.
   * @returns Number of threads cleaned up
   */
  public cleanupNow(): number {
    return this.cleanupStaleState();
  }

  async processInputStep(args: ProcessInputStepArgs) {
    const { tools, messageList } = args;
    const threadId = this.getThreadId(args);
    const threadState = this.getThreadState(threadId);
    const skills = this.skills;

    if (!skills) {
      return { tools };
    }

    // Refresh skills on first step only
    if (args.stepNumber === 0) {
      await skills.maybeRefresh({ requestContext: args.requestContext });
    }

    // Add system instruction about the meta-tools
    messageList.addSystem(
      'To discover available skills, call search_skills with a keyword query. ' +
        "To load a skill's instructions, call load_skill with the skill name. " +
        'Loaded skills provide context and instructions for the conversation.',
    );

    // Create the search_skills meta-tool
    const searchSkillTool = createTool({
      id: 'search_skills',
      description:
        'Search for available skills by keyword. ' +
        'Returns a list of matching skills with their names and descriptions. ' +
        'After finding a useful skill, use load_skill to load its instructions.',
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .min(1, 'Query is required')
          .describe('Search keywords (e.g., "api design", "testing", "deployment")'),
      }),
      outputSchema: z.object({
        results: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
            score: z.number(),
          }),
        ),
        message: z.string(),
      }),
      execute: async ({ query }) => {
        const searchResults = await skills.search(query, {
          topK: this.searchConfig.topK,
          minScore: this.searchConfig.minScore,
        });

        if (searchResults.length === 0) {
          return {
            results: [],
            message: `No skills found matching "${query}". Try different keywords.`,
          };
        }

        // Deduplicate by skillName (search may return multiple matches per skill)
        const seen = new Set<string>();
        const uniqueResults = searchResults.filter(r => {
          if (seen.has(r.skillName)) return false;
          seen.add(r.skillName);
          return true;
        });

        // Get metadata for descriptions
        const skillList = await skills.list();
        const metaMap = new Map(skillList.map(s => [s.name, s]));

        const results = uniqueResults.map(r => {
          const meta = metaMap.get(r.skillName);
          const description = meta?.description ?? '';
          return {
            name: r.skillName,
            description: description.length > 150 ? description.slice(0, 147) + '...' : description,
            score: Math.round(r.score * 100) / 100,
          };
        });

        return {
          results,
          message: `Found ${results.length} skill(s). Use load_skill with the exact skill name to load its instructions.`,
        };
      },
    });

    // Create the load_skill meta-tool
    const loadSkillTool = createTool({
      id: 'load_skill',
      description:
        "Load a skill's full instructions into the conversation. " +
        'Call this after finding a skill with search_skills. ' +
        "The skill's instructions will be available as context.",
      inputSchema: z.object({
        skillName: z.string().describe('The exact name of the skill to load (from search results)'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        skillName: z.string().optional(),
      }),
      execute: async ({ skillName }) => {
        // Check if already loaded
        if (threadState.skills.has(skillName)) {
          return {
            success: true,
            message: `Skill "${skillName}" is already loaded.`,
            skillName,
          };
        }

        // Load the skill
        const skill = await skills.get(skillName);
        if (!skill) {
          // Suggest similar names
          const allSkills = await skills.list();
          const suggestions = allSkills
            .filter(
              s =>
                s.name.toLowerCase().includes(skillName.toLowerCase()) ||
                skillName.toLowerCase().includes(s.name.toLowerCase()),
            )
            .slice(0, 3);

          let message = `Skill "${skillName}" not found.`;
          if (suggestions.length > 0) {
            message += ` Did you mean: ${suggestions.map(s => s.name).join(', ')}?`;
          } else {
            message += ' Use search_skills to find available skills.';
          }

          return { success: false, message };
        }

        // Store in thread state
        threadState.skills.set(skillName, skill.instructions);

        return {
          success: true,
          message: `Skill "${skillName}" loaded. Its instructions are now available as context.`,
          skillName,
        };
      },
    });

    // Build system messages for loaded skills
    for (const [skillName, instructions] of threadState.skills) {
      messageList.addSystem(`[Skill: ${skillName}]\n\n${instructions}`);
    }

    const metaTools = { search_skills: searchSkillTool, load_skill: loadSkillTool };
    if (tools) {
      for (const key of Object.keys(tools)) {
        if (key in metaTools) {
          console.warn(`[SkillSearchProcessor] User tool "${key}" conflicts with meta-tool and will be shadowed.`);
        }
      }
    }

    return {
      tools: {
        ...(tools ?? {}),
        ...metaTools,
      },
    };
  }
}
