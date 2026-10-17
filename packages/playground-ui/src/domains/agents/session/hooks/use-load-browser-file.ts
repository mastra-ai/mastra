import { useEffect, useState } from 'react';

export const useLoadBrowserFile = (file?: File) => {
  const [state, setState] = useState({ isLoading: false, text: '' });

  useEffect(() => {
    if (!file) return;
    let isCanceled = false;

    const run = async () => {
      setState(s => ({ ...s, isLoading: true }));
      try {
        const text = await file.text();
        if (!isCanceled) setState(s => ({ ...s, text }));
      } finally {
        if (!isCanceled) setState(s => ({ ...s, isLoading: false }));
      }
    };

    run().catch(() => {});
    return () => {
      isCanceled = true;
    };
  }, [file]);

  return state;
};
