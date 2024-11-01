'use client';

import { useEffect, useState } from 'react';

import { checkVectorProviderExistsAction } from '../actions';

export const useVectorProviderExists = ({ providerName }: { providerName: string }) => {
  const [exists, setExists] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const checkIfExists = async () => {
      if (!providerName) return;
      try {
        const { exists: itExists, apiKey } = await checkVectorProviderExistsAction(providerName);
        setExists(itExists);
        setApiKey(apiKey);
      } catch (err) {
        console.log(`Error checking if ${providerName} exists=`, err);
      }
    };

    checkIfExists();
  }, [providerName]);

  return { exists, apiKey };
};
