import type { AgentEditorConfig } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { getEditorOwnership } from '../editor-ownership';

describe('getEditorOwnership', () => {
  const cases: {
    name: string;
    isCodeAgentOverride: boolean;
    editorConfig: AgentEditorConfig | undefined;
    expected: {
      ownsInstructions: boolean;
      ownsTools: boolean;
      ownsToolDescriptions: boolean;
      isInstructionsLocked: boolean;
      isToolsLocked: boolean;
      toolDescriptionsOnly: boolean;
      isFullyLocked: boolean;
    };
  }[] = [
    {
      // A stored (non-code) agent is always fully editable, whatever editorConfig says.
      name: 'not a code agent override',
      isCodeAgentOverride: false,
      editorConfig: false,
      expected: {
        ownsInstructions: true,
        ownsTools: true,
        ownsToolDescriptions: true,
        isInstructionsLocked: false,
        isToolsLocked: false,
        toolDescriptionsOnly: false,
        isFullyLocked: false,
      },
    },
    {
      // Legacy default: an editor-unset code agent stays fully editable.
      name: 'editor unset',
      isCodeAgentOverride: true,
      editorConfig: undefined,
      expected: {
        ownsInstructions: true,
        ownsTools: true,
        ownsToolDescriptions: true,
        isInstructionsLocked: false,
        isToolsLocked: false,
        toolDescriptionsOnly: false,
        isFullyLocked: false,
      },
    },
    {
      name: 'editor: false',
      isCodeAgentOverride: true,
      editorConfig: false,
      expected: {
        ownsInstructions: false,
        ownsTools: false,
        ownsToolDescriptions: false,
        isInstructionsLocked: true,
        isToolsLocked: true,
        toolDescriptionsOnly: false,
        isFullyLocked: true,
      },
    },
    {
      // An empty object opts in to per-field ownership and grants nothing.
      name: 'editor: {}',
      isCodeAgentOverride: true,
      editorConfig: {},
      expected: {
        ownsInstructions: false,
        ownsTools: false,
        ownsToolDescriptions: false,
        isInstructionsLocked: true,
        isToolsLocked: true,
        toolDescriptionsOnly: false,
        isFullyLocked: true,
      },
    },
    {
      name: 'editor: { instructions: true }',
      isCodeAgentOverride: true,
      editorConfig: { instructions: true },
      expected: {
        ownsInstructions: true,
        ownsTools: false,
        ownsToolDescriptions: false,
        isInstructionsLocked: false,
        isToolsLocked: true,
        toolDescriptionsOnly: false,
        isFullyLocked: false,
      },
    },
    {
      name: 'editor: { instructions: false }',
      isCodeAgentOverride: true,
      editorConfig: { instructions: false },
      expected: {
        ownsInstructions: false,
        ownsTools: false,
        ownsToolDescriptions: false,
        isInstructionsLocked: true,
        isToolsLocked: true,
        toolDescriptionsOnly: false,
        isFullyLocked: true,
      },
    },
    {
      name: 'editor: { tools: true }',
      isCodeAgentOverride: true,
      editorConfig: { tools: true },
      expected: {
        ownsInstructions: false,
        ownsTools: true,
        ownsToolDescriptions: true,
        isInstructionsLocked: true,
        isToolsLocked: false,
        toolDescriptionsOnly: false,
        isFullyLocked: false,
      },
    },
    {
      name: 'editor: { tools: { description: true } }',
      isCodeAgentOverride: true,
      editorConfig: { tools: { description: true } },
      expected: {
        ownsInstructions: false,
        ownsTools: false,
        ownsToolDescriptions: true,
        isInstructionsLocked: true,
        isToolsLocked: false,
        toolDescriptionsOnly: true,
        isFullyLocked: false,
      },
    },
    {
      // A tools object that grants nothing owns neither membership nor descriptions.
      name: 'editor: { tools: {} }',
      isCodeAgentOverride: true,
      editorConfig: { tools: {} },
      expected: {
        ownsInstructions: false,
        ownsTools: false,
        ownsToolDescriptions: false,
        isInstructionsLocked: true,
        isToolsLocked: true,
        toolDescriptionsOnly: false,
        isFullyLocked: true,
      },
    },
    {
      name: 'editor: { tools: { description: false } }',
      isCodeAgentOverride: true,
      editorConfig: { tools: { description: false } },
      expected: {
        ownsInstructions: false,
        ownsTools: false,
        ownsToolDescriptions: false,
        isInstructionsLocked: true,
        isToolsLocked: true,
        toolDescriptionsOnly: false,
        isFullyLocked: true,
      },
    },
    {
      // The reported bug: an object locking every field must behave like `editor: false`.
      name: 'editor: { instructions: false, tools: false }',
      isCodeAgentOverride: true,
      editorConfig: { instructions: false, tools: false },
      expected: {
        ownsInstructions: false,
        ownsTools: false,
        ownsToolDescriptions: false,
        isInstructionsLocked: true,
        isToolsLocked: true,
        toolDescriptionsOnly: false,
        isFullyLocked: true,
      },
    },
    {
      name: 'editor: { instructions: true, tools: true }',
      isCodeAgentOverride: true,
      editorConfig: { instructions: true, tools: true },
      expected: {
        ownsInstructions: true,
        ownsTools: true,
        ownsToolDescriptions: true,
        isInstructionsLocked: false,
        isToolsLocked: false,
        toolDescriptionsOnly: false,
        isFullyLocked: false,
      },
    },
  ];

  for (const { name, isCodeAgentOverride, editorConfig, expected } of cases) {
    it(name, () => {
      expect(getEditorOwnership(isCodeAgentOverride, editorConfig)).toEqual(expected);
    });
  }

  it('locks everything when the server sends a null editor config', () => {
    // `editor` is typed as object | boolean | undefined, but a server sending an
    // explicit null must not crash the editor — it locks, like `editor: false`.
    expect(getEditorOwnership(true, null as never)).toEqual(getEditorOwnership(true, false));
  });

  it('treats editor: false and an all-locked editor object identically', () => {
    expect(getEditorOwnership(true, { instructions: false, tools: false })).toEqual(getEditorOwnership(true, false));
  });
});
