import { useContext } from 'react';

import { AppContext } from '@/components/AppContext';

export const useAppContext = () => {
  return useContext(AppContext);
};
