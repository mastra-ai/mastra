// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { ItemListLinkCell } from './item-list-link-cell';
import type { LinkComponentProps } from '@/ds/types/link-component';

const Link = (props: LinkComponentProps) => <a {...props} />;

afterEach(cleanup);

describe('ItemListLinkCell', () => {
  describe('when it explains linked content with a tooltip', () => {
    it('opens the tooltip from the link keyboard target', async () => {
      render(
        <TooltipProvider delay={0} timeout={0}>
          <ItemListLinkCell LinkComponent={Link} href="/versions/2" tooltip="Changed in this version">
            Version 2
          </ItemListLinkCell>
        </TooltipProvider>,
      );

      const link = screen.getByRole('link', { name: 'Version 2' });
      link.focus();

      expect(document.activeElement).toBe(link);
      expect((await screen.findByRole('tooltip')).textContent).toBe('Changed in this version');
    });
  });
});
