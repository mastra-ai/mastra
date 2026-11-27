import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { InMemoryFileNode } from '../../agent-edit-page/utils/form-validation';
import { SkillFileTree } from '../skill-file-tree';
import { createInitialStructure } from '../skill-file-tree-utils';

function withReference(files: InMemoryFileNode[], node: InMemoryFileNode) {
  return files.map(root => ({
    ...root,
    children: root.children?.map(child =>
      child.id === 'references' ? { ...child, children: [...(child.children ?? []), node] } : child,
    ),
  }));
}

function SkillFiles({ initial, readOnly }: { initial: InMemoryFileNode[]; readOnly?: boolean }) {
  const [files, setFiles] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <SkillFileTree
        files={files}
        onChange={setFiles}
        selectedFileId={selected}
        onSelectFile={setSelected}
        readOnly={readOnly}
      />
      <output aria-label="Open file">{selected ?? 'none'}</output>
    </>
  );
}

const row = (name: string) => screen.getByRole('treeitem', { name: new RegExp(`^${name}`) });
const rowNames = () => screen.getAllByRole('treeitem').map(item => item.textContent);

describe('SkillFileTree', () => {
  it('shows the skill’s files and folders, and opens a file when it is clicked', () => {
    render(<SkillFiles initial={createInitialStructure('Refund helper')} />);

    expect(rowNames()).toEqual(['refund-helper', 'SKILL.md', 'LICENSE.md', 'references', 'scripts', 'assets']);
    fireEvent.click(screen.getByText('SKILL.md'));
    expect(screen.getByRole('status', { name: 'Open file' }).textContent).toBe('skill-md');
    expect(row('SKILL.md').getAttribute('aria-selected')).toBe('true');
  });

  it('adds a reference file typed into the tree, under references', () => {
    render(<SkillFiles initial={createInitialStructure('Refund helper')} />);

    fireEvent.click(within(row('references')).getByRole('button', { name: 'New file' }));
    const name = screen.getByRole('textbox', { name: 'filename.ext' });
    fireEvent.change(name, { target: { value: 'policy.md' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    expect(row('policy.md').getAttribute('aria-level')).toBe('3');
    expect(rowNames().indexOf('policy.md')).toBe(rowNames().indexOf('references') + 1);
  });

  it('deletes a folder holding the open file, and closes that file', () => {
    const initial = withReference(createInitialStructure('Refund helper'), {
      id: 'guides',
      name: 'guides',
      type: 'folder',
      children: [{ id: 'faq', name: 'faq.md', type: 'file', content: '' }],
    });
    render(<SkillFiles initial={initial} />);

    fireEvent.click(screen.getByText('faq.md'));
    fireEvent.click(within(row('guides')).getByRole('button', { name: 'Delete folder' }));

    expect(screen.queryByText('faq.md')).toBeNull();
    expect(screen.getByRole('status', { name: 'Open file' }).textContent).toBe('none');
  });

  it('collapses a folder without opening anything', () => {
    const initial = withReference(createInitialStructure('Refund helper'), {
      id: 'faq',
      name: 'faq.md',
      type: 'file',
      content: '',
    });
    render(<SkillFiles initial={initial} />);

    fireEvent.click(screen.getByText('references'));

    expect(row('references').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('faq.md')).toBeNull();
    expect(screen.getByRole('status', { name: 'Open file' }).textContent).toBe('none');
  });

  it('offers no editing actions when read-only', () => {
    render(<SkillFiles initial={createInitialStructure('Refund helper')} readOnly />);

    expect(screen.queryByRole('button', { name: 'New file' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add image' })).toBeNull();
  });
});
