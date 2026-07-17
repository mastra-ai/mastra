import { expect, test } from '@playwright/test';

/**
 * USER STORY: A form inside an app-owned scroll container must not add a second browser scrollbar.
 * BEHAVIOR UNDER TEST: Base UI's hidden named-select input stays clipped by the app scroller.
 */
test.describe('FieldBlock layout', () => {
  test.describe('when a named select is below the fold in an app scroll container', () => {
    test('keeps the overflow in the app scroller instead of the browser document', async ({ page }) => {
      await page.goto('/');

      const scroller = page.getByTestId('page-scroller');
      await expect
        .poll(async () => {
          const height = await scroller.evaluate(element => ({
            client: element.clientHeight,
            scroll: element.scrollHeight,
          }));
          return height.scroll > height.client;
        })
        .toBe(true);

      const documentHasOverflow = await page.evaluate(() => {
        const documentScroller = document.scrollingElement;
        if (!documentScroller) throw new Error('Expected a document scrolling element');
        return documentScroller.scrollHeight > documentScroller.clientHeight;
      });

      expect(documentHasOverflow).toBe(false);
    });
  });
});
