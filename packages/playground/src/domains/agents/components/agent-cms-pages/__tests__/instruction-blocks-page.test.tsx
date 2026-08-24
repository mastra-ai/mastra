import { cleanup, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentEditFormProvider } from '../../../context/agent-edit-form-context';
import type { AgentEditorConfig } from '../../../context/agent-edit-form-context';
import type { AgentFormValues } from '../../agent-edit-page/utils/form-validation';
import { InstructionBlocksPage } from '../instruction-blocks-page';

vi.mock('../../agent-cms-blocks', () => ({
  AgentCMSBlocks: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="cms-blocks" data-readonly={String(!!readOnly)} />
  ),
}));

function Harness({
  readOnly,
  isCodeAgentOverride,
  editorConfig,
}: {
  readOnly?: boolean;
  isCodeAgentOverride?: boolean;
  editorConfig?: AgentEditorConfig;
}) {
  const form = useForm<AgentFormValues>({
    defaultValues: {
      name: 'Chef Agent',
      instructionBlocks: [{ id: 'block-1', type: 'prompt_block', content: 'Cook with care.' }],
    },
  });

  return (
    <AgentEditFormProvider
      form={form}
      mode="edit"
      isSubmitting={false}
      handlePublish={async () => {}}
      readOnly={readOnly}
      isCodeAgentOverride={isCodeAgentOverride}
      editorConfig={editorConfig}
    >
      <InstructionBlocksPage />
    </AgentEditFormProvider>
  );
}

afterEach(() => {
  cleanup();
});

describe('InstructionBlocksPage', () => {
  it('renders blocks read-only with a notice when the code agent owns instructions', () => {
    render(<Harness isCodeAgentOverride editorConfig={{ instructions: false }} />);

    expect(screen.getByTestId('cms-blocks').getAttribute('data-readonly')).toBe('true');
    expect(screen.getByText('Instructions are owned by code')).not.toBeNull();
  });

  it('renders blocks editable when the user owns instructions', () => {
    render(<Harness isCodeAgentOverride editorConfig={{ instructions: true }} />);

    expect(screen.getByTestId('cms-blocks').getAttribute('data-readonly')).toBe('false');
    expect(screen.queryByText('Instructions are owned by code')).toBeNull();
  });

  it('renders blocks editable for a code agent with no editor config (legacy default)', () => {
    render(<Harness isCodeAgentOverride />);

    expect(screen.getByTestId('cms-blocks').getAttribute('data-readonly')).toBe('false');
  });

  it('stays read-only without the lock notice when the whole editor is read-only', () => {
    render(<Harness readOnly />);

    expect(screen.getByTestId('cms-blocks').getAttribute('data-readonly')).toBe('true');
    expect(screen.queryByText('Instructions are owned by code')).toBeNull();
  });
});
