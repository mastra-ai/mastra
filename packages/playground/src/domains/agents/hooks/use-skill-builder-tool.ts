import { createTool } from '@mastra/client-js';
import { useMemo, useRef } from 'react';
import { z } from 'zod-v4';

export const SKILL_BUILDER_TOOL_NAME = 'skillBuilderTool';
export const SKILL_READER_TOOL_NAME = 'readSkillForm';

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
You have two client tools:
1. **readSkillForm** — read the current form values. Always call this before making changes so you know what's already there.
2. **skillBuilderTool** — update one or more form fields.

Do the work instead of explaining the work.

Do not show:
- code
- raw configuration
- tool inputs or outputs
- hidden reasoning
- long explanations

# Important workflow
When the user asks you to change, refine, or improve the skill:
1. First call readSkillForm to see the current state.
2. Then call skillBuilderTool with only the fields you want to change.

When creating a brand new skill from scratch, you can skip the read and go straight to skillBuilderTool.

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
}

export interface SkillFormState {
  name: string;
  description: string;
  instructions: string;
}

export function useSkillBuilderTools(callbacks: SkillBuilderCallbacks, formStateRef: React.RefObject<SkillFormState>) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const writerTool = useMemo(
    () =>
      createTool({
        id: SKILL_BUILDER_TOOL_NAME,
        description:
          'Update the skill form fields. Call this tool to set or change the name, description, or instructions of the skill being created or edited. ' +
          'You can update any combination of fields in a single call — omit fields you do not want to change. ' +
          'The "instructions" field should be detailed markdown content describing the skill\'s purpose, workflow, rules, and tone.',
        inputSchema: z.object({
          name: z.string().optional().describe('Short, descriptive skill name (e.g. "article-summarizer")'),
          description: z.string().optional().describe('One-line description of what the skill does'),
          instructions: z
            .string()
            .optional()
            .describe('Detailed markdown instructions for the skill (purpose, workflow, rules, tone)'),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: async (input: any) => {
          const cb = callbacksRef.current;
          if (typeof input?.name === 'string') cb.onNameChange(input.name);
          if (typeof input?.description === 'string') cb.onDescriptionChange(input.description);
          if (typeof input?.instructions === 'string') cb.onInstructionsChange(input.instructions);
          return { success: true };
        },
      }),
    [], // callbacks accessed via ref, stable tool identity
  );

  const readerTool = useMemo(
    () =>
      createTool({
        id: SKILL_READER_TOOL_NAME,
        description:
          'Read the current skill form values. Call this before making changes so you know what the user has on screen. ' +
          'Returns the current name, description, and instructions (markdown).',
        inputSchema: z.object({}),
        outputSchema: z.object({
          name: z.string(),
          description: z.string(),
          instructions: z.string(),
        }),
        execute: async () => {
          const state = formStateRef.current;
          return {
            name: state.name || '',
            description: state.description || '',
            instructions: state.instructions || '',
          };
        },
      }),
    [formStateRef],
  );

  return { writerTool, readerTool };
}
