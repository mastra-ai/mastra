import { useEffect, useState } from 'react';

export const useLoadBrowserFile = (file?: File) => {
  const [state, setState] = useState({ isLoading: false, text: '' });

  useEffect(() => {
    if (!file) return;

    const run = async () => {
      setState(s => ({ ...s, isLoading: true }));

      const text = await file.text();

      setState(s => ({ ...s, isLoading: false, text }));
    };

    run();
  }, [file]);

  return state;
};
