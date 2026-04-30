import { createTool } from '@mastra/client-js';
import { useMemo, useRef } from 'react';
import { z } from 'zod-v4';

export const SKILL_BUILDER_TOOL_NAME = 'skillBuilderTool';

export const SKILL_BUILDER_INSTRUCTIONS = `# Role
You help a user build a skill: a focused set of instructions that gives an agent expertise in a specific area.

Use simple, kind words. Avoid jargon.

# Goal
Help the user create a skill that is clear, useful, and well-defined.

A good skill has:
- a short, descriptive name
- a clear one-line description
- detailed markdown instructions covering purpose, inputs, outputs, rules, and workflow

# How you work
A form on the screen describes the skill being built.
Use your client tool to update that form.
Do the work instead of explaining the work.

Do not show:
- code
- raw configuration
- tool inputs or outputs
- hidden reasoning
- long explanations

# Skill design checklist
When creating or improving a skill, define:

1. Purpose — What expertise does this skill provide?
2. Inputs — What information does the skill work with?
3. Outputs — What should the agent produce when using this skill?
4. Rules — What must the agent always or never do?
5. Workflow — What steps should the agent follow?
6. Tone — How should the agent communicate?

# Instructions format
Write the instructions field in markdown. Structure it with clear headings:
- Purpose
- Actions / Workflow
- Inputs / Outputs
- Rules / Boundaries
- Tone / Style

# How you speak
Stay brief.
Prefer doing over explaining.
When speaking, say what the skill now does or what changed.

Good examples:
- Your skill is ready — it helps summarize long articles.
- Updated the instructions to include source citation rules.
- Added boundaries to prevent hallucinating facts.

Ask only when you cannot safely continue.
Ask one simple question at a time.`;

export interface SkillBuilderCallbacks {
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onInstructionsChange: (instructions: string) => void;
  onVisibilityChange: (visibility: 'private' | 'public') => void;
}

export function useSkillBuilderTool(callbacks: SkillBuilderCallbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  return useMemo(
    () =>
      createTool({
        id: SKILL_BUILDER_TOOL_NAME,
        description:
          'Update the skill form fields. Call this tool to set or change the name, description, instructions, or visibility of the skill being created or edited. ' +
          'You can update any combination of fields in a single call — omit fields you do not want to change. ' +
          'The "instructions" field should be detailed markdown content describing the skill\'s purpose, workflow, rules, and tone.',
        inputSchema: z.object({
          name: z.string().optional().describe('Short, descriptive skill name (e.g. "article-summarizer")'),
          description: z.string().optional().describe('One-line description of what the skill does'),
          instructions: z
            .string()
            .optional()
            .describe('Detailed markdown instructions for the skill (purpose, workflow, rules, tone)'),
          visibility: z.enum(['private', 'public']).optional().describe('Skill visibility — defaults to private'),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: async (input: any) => {
          const cb = callbacksRef.current;
          if (typeof input?.name === 'string') cb.onNameChange(input.name);
          if (typeof input?.description === 'string') cb.onDescriptionChange(input.description);
          if (typeof input?.instructions === 'string') cb.onInstructionsChange(input.instructions);
          if (input?.visibility === 'private' || input?.visibility === 'public')
            cb.onVisibilityChange(input.visibility);
          return { success: true };
        },
      }),
    [], // callbacks accessed via ref, stable tool identity
  );
}
