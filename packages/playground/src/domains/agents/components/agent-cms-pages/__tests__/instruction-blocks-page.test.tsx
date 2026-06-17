import { cleanup, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentEditFormProvider } from '../../../context/agent-edit-form-context';
import type { AgentEditorConfig } from '../../../context/agent-edit-form-context';
import type { AgentFormValues } from '../../agent-edit-page/utils/form-validation';
import { InstructionBlocksPage } from '../instruction-blocks-page';

// Stub the presentational blocks editor so we can observe the `readOnly` prop the
// page derives. AgentCMSBlocks is pure UI (not a data hook/service/auth gate), so
// mocking it keeps the test focused on the page's lock wiring.
vi.mock('../../agent-cms-blocks', () => ({
  AgentCMSBlocks: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="cms-blocks" data-readonly={String(!!readOnly)} />
  ),
}));

afterEach(cleanup);

function Harness({
  editorConfig,
  isCodeAgentOverride = false,
  readOnly = false,
}: {
  editorConfig?: AgentEditorConfig;
  isCodeAgentOverride?: boolean;
  readOnly?: boolean;
}) {
  const form = useForm<AgentFormValues>({ defaultValues: { instructionBlocks: [] } });
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

const readOnlyAttr = () => screen.getByTestId('cms-blocks').getAttribute('data-readonly');

describe('InstructionBlocksPage instruction lock', () => {
  it('locks the blocks when a code agent does not own instructions (instructions:false, tools:false)', () => {
    render(<Harness isCodeAgentOverride editorConfig={{ instructions: false, tools: false }} />);
    expect(readOnlyAttr()).toBe('true');
  });

  it('locks the blocks when the editor config is false', () => {
    render(<Harness isCodeAgentOverride editorConfig={false} />);
    expect(readOnlyAttr()).toBe('true');
  });

  it('keeps the blocks editable when the code agent owns instructions', () => {
    render(<Harness isCodeAgentOverride editorConfig={{ instructions: true, tools: false }} />);
    expect(readOnlyAttr()).toBe('false');
  });

  it('does not lock instructions for a non-code agent even if the config says instructions:false', () => {
    render(<Harness editorConfig={{ instructions: false }} />);
    expect(readOnlyAttr()).toBe('false');
  });

  it('respects the global readOnly flag regardless of editor config', () => {
    render(<Harness readOnly editorConfig={{ instructions: true }} />);
    expect(readOnlyAttr()).toBe('true');
  });
});
