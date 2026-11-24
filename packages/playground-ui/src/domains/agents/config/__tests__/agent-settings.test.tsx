// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WORKSPACE_TOOLS_PREFIX } from '../../../chat/tools/workspace-tool-constants';
import { AgentMemorySettings } from '../agent-memory-settings';
import { AgentMetadataWorkspaceToolsList } from '../agent-workspace-tools-list';

const tools = Array.from({ length: 12 }, (_, index) => `${WORKSPACE_TOOLS_PREFIX}_tool_${index + 1}`);

describe('AgentMetadataWorkspaceToolsList', () => {
  it('shows the empty state without tools', () => {
    render(<AgentMetadataWorkspaceToolsList tools={[]} />);
    expect(screen.getByText('No workspace tools')).toBeTruthy();
  });

  it('shows names and expands the remaining tools', () => {
    render(<AgentMetadataWorkspaceToolsList tools={tools} />);
    expect(screen.getByText('tool_1')).toBeTruthy();
    expect(screen.queryByText('tool_12')).toBeNull();
    fireEvent.click(screen.getByTestId('agent-metadata-expandable-toggle'));
    expect(screen.getByText('tool_12')).toBeTruthy();
  });
});

describe('AgentMemorySettings', () => {
  it('renders general settings and semantic recall from injected configuration', () => {
    render(<AgentMemorySettings config={{ lastMessages: 12, semanticRecall: true }} />);
    expect(screen.getByText('Last Messages')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Semantic Recall')).toBeTruthy();
    expect(screen.getByText('Top K Results')).toBeTruthy();
  });
});
