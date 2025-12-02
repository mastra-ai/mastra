import { invariant } from '../invariant';
import isHtmlElement from './is-type-of-element/is-html-element';

export default (ref?: unknown | null) => {
  invariant(
    ref && isHtmlElement(ref),
    `
    provided.innerRef has not been provided with a HTMLElement.

    You can find a guide on using the innerRef callback functions at:
    https://github.com/hello-pangea/dnd/blob/main/docs/guides/using-inner-ref.md
  `,
  );
};
