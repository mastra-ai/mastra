import { useContext } from 'react';
import { DataHooksContext } from './data-hooks-context';

export const useDataHooks = () => {
  return useContext(DataHooksContext);
};
