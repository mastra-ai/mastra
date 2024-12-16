'use client';

import { createContext, ReactNode, SetStateAction, useContext, useState } from 'react';

import { VectorEntity } from '../types';

interface VectorFormContextProps {
  vectorProvider: string;
  setVectorProvider: React.Dispatch<SetStateAction<string>>;

  apiKey: string;
  setApiKey: React.Dispatch<SetStateAction<string>>;

  // resyncingInterval: string;
  // setApiKey: React.Dispatch<SetStateAction<string>>;

  entities: VectorEntity[];
  setEntities: React.Dispatch<SetStateAction<VectorEntity[]>>;

  indexName: string;
  setIndexName: React.Dispatch<SetStateAction<string>>;
}

export const VectorFormContext = createContext({} as VectorFormContextProps);

export const useVectorFormContext = () => {
  const context = useContext(VectorFormContext);
  if (!context) {
    throw new Error('useVectorFormContext must be used within a VectorFormProvider');
  }
  return context;
};

export const VectorFormProvider = ({ children }: { children: ReactNode }) => {
  const [apiKey, setApiKey] = useState('');
  const [vectorProvider, setVectorProvider] = useState('');
  const [entities, setEntities] = useState<VectorEntity[]>([{ integration: '', data: [] }]);
  const [indexName, setIndexName] = useState('');
  return (
    <VectorFormContext.Provider
      value={{
        apiKey,
        setApiKey,

        vectorProvider,
        setVectorProvider,

        entities,
        setEntities,

        indexName,
        setIndexName,
      }}
    >
      {children}
    </VectorFormContext.Provider>
  );
};
