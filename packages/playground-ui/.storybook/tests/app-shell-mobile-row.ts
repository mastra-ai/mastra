import { expect } from 'storybook/test';

const sidebarDrawerBreakpoint = 1024;

function visibleChromeRows(canvasElement: HTMLElement) {
  return Array.from(canvasElement.querySelectorAll('[data-slot="app-shell-content"] header')).filter(
    header => !header.closest('main') && header.getBoundingClientRect().height > 0,
  );
}

export function verifyChromeRows({ desktopRows, mobileCrumbs }: { desktopRows: number; mobileCrumbs?: number }) {
  return async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const rows = visibleChromeRows(canvasElement);
    const page = canvasElement.ownerDocument.documentElement;
    await expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth);

    if (window.innerWidth >= sidebarDrawerBreakpoint) {
      await expect(rows).toHaveLength(desktopRows);
      return;
    }

    await expect(rows).toHaveLength(1);
    const [row] = rows;
    if (!row) return;
    if (mobileCrumbs !== undefined) {
      const crumbs = Array.from(row.querySelectorAll('ol > li:not([role="separator"])'));
      await expect(crumbs.filter(crumb => crumb.getBoundingClientRect().width > 0)).toHaveLength(mobileCrumbs);
    }
    const rowBox = row.getBoundingClientRect();
    const menu = row.querySelector('[aria-label="Open navigation menu"]');
    const edgeHit = canvasElement.ownerDocument.elementFromPoint(rowBox.left + 1, rowBox.top + rowBox.height / 2);
    await expect(menu?.contains(edgeHit)).toBe(true);
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    for (const part of Array.from(row.querySelectorAll('button, a, li'))) {
      const box = part.getBoundingClientRect();
      if (box.width === 0) continue;
      const frame = (part.parentElement?.closest('nav') ?? row).getBoundingClientRect();
      await expect(box.left).toBeGreaterThanOrEqual(frame.left);
      await expect(box.right).toBeLessThanOrEqual(frame.right);
    }
  };
}
