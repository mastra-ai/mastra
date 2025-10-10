import { createContext, useContext } from 'react';
import { EntityVariant } from './types';

export type EntityContextType = {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  variant: EntityVariant;
  disabled: boolean;
};

export const EntityContext = createContext<EntityContextType>({
  expanded: false,
  setExpanded: () => {},
  variant: 'initial',
  disabled: false,
});

export const EntityProvider = EntityContext.Provider;

export const useEntity = () => useContext(EntityContext);
