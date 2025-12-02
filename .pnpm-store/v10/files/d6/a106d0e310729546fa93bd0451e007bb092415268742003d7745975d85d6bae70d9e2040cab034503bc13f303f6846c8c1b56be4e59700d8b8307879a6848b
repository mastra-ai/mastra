import { customRender } from 'test/render';
import { getTableFooter, queryTableFooter } from 'test/selectors';

import { Footer } from './Footer';

customRender(
  <table role="grid">
    <Footer />
  </table>
);
test('should not render anything as default', () => {
  expect(queryTableFooter()).toBeNull();
});

describe('when using the `footer` prop', () => {
  beforeEach(() => {
    customRender(
      <table role="grid">
        <Footer />
      </table>,
      { footer: 'footer_foo' }
    );
  });
  test('should render the table footer', () => {
    expect(getTableFooter()).toHaveTextContent('footer_foo');
  });
});
