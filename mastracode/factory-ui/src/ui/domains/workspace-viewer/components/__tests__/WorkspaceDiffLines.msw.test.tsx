import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkspaceDiffLines } from '../WorkspaceDiffLines';

describe('WorkspaceDiffLines', () => {
  it('shows rename metadata when a patch has no text hunks', () => {
    render(
      <WorkspaceDiffLines
        patch={[
          'diff --git a/src/old.ts b/src/new.ts',
          'similarity index 100%',
          'rename from src/old.ts',
          'rename to src/new.ts',
        ].join('\n')}
      />,
    );

    expect(screen.getByText('similarity index 100%')).toBeInTheDocument();
    expect(screen.getByText('rename from src/old.ts')).toBeInTheDocument();
    expect(screen.getByText('rename to src/new.ts')).toBeInTheDocument();
  });

  it('filters headers again when a patch contains multiple file diffs', () => {
    render(
      <WorkspaceDiffLines
        patch={[
          'diff --git a/src/one.ts b/src/one.ts',
          'index 1111111..2222222 100644',
          '--- a/src/one.ts',
          '+++ b/src/one.ts',
          '@@ -1 +1 @@',
          '-one',
          '+first',
          'diff --git a/src/two.ts b/src/two.ts',
          'new file mode 100644',
          'index 0000000..3333333',
          '--- /dev/null',
          '+++ b/src/two.ts',
          '@@ -0,0 +1 @@',
          '+second',
        ].join('\n')}
      />,
    );

    expect(screen.getByText('+first')).toBeInTheDocument();
    expect(screen.getByText('+second')).toBeInTheDocument();
    expect(screen.queryByText('new file mode 100644')).not.toBeInTheDocument();
  });
});
