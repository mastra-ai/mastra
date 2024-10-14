'use client';

import { createContext, ReactNode, SetStateAction, useContext, useState } from 'react';

export type VectorEntityData = {
  name: string;
  fields: string[];
  syncEvent: string;
  index: string;
};

type VectorEntity = { integration: string; data: VectorEntityData[] };

interface VectorFormContextProps {
  vectorProvider: string;
  setVectorProvider: React.Dispatch<SetStateAction<string>>;

  apiKey: string;
  setApiKey: React.Dispatch<SetStateAction<string>>;

  // resyncingInterval: string;
  // setApiKey: React.Dispatch<SetStateAction<string>>;

  entities: VectorEntity[];
  setEntities: React.Dispatch<SetStateAction<VectorEntity[]>>;
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
  // const [buttonContainer, setButtonContainer] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [vectorProvider, setVectorProvider] = useState('');
  const [entities, setEntities] = useState<VectorEntity[]>([{ integration: '', data: [] }]);

  return (
    <VectorFormContext.Provider
      value={{
        apiKey,
        setApiKey,

        vectorProvider,
        setVectorProvider,

        entities,
        setEntities,

        // buttonContainer,
        // setButtonContainer,
      }}
    >
      {children}
    </VectorFormContext.Provider>
  );
};
