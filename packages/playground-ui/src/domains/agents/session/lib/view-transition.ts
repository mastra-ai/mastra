import { flushSync } from 'react-dom';

export const startViewTransition = (callback: () => void) => {
  if ('startViewTransition' in document) {
    document.startViewTransition(() => {
      flushSync(() => {
        callback();
      });
    });
  } else {
    callback();
  }
};
