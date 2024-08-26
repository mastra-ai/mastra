import { useContext } from 'react';

import { AppContext } from '@/app/components/AppContext';

export const useAppContext = () => {
  return useContext(AppContext);
};
