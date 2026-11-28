// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentEditor } from './index';

afterEach(cleanup);

describe('DocumentEditor details composition', () => {
  it('keeps the merged editor parts usable through their existing public names', () => {
    const onClose = vi.fn();
    render(
      <DocumentEditor.Details onClose={onClose}>
        <DocumentEditor.Section label="Configuration">
          <DocumentEditor.Fact label="Model" value="GPT-5 mini" />
        </DocumentEditor.Section>
      </DocumentEditor.Details>,
    );

    expect(screen.getByRole('complementary', { name: 'Details' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Configuration' })).toBeTruthy();
    expect(screen.getByText('Model')).toBeTruthy();
    expect(screen.getByText('GPT-5 mini')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide details' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
