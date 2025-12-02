import { invariant } from '../invariant';

export default (): HTMLElement => {
  const doc: HTMLElement | null = document.documentElement;
  invariant(doc, 'Cannot find document.documentElement');
  return doc;
};
