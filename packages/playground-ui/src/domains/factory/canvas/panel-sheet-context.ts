import { createContext, useContext } from 'react';

/** Set inside the phone's bottom sheet. */
export const InSheet = createContext(false);

/** Whether a side panel sits in a phone's bottom sheet, which brings its own surface. */
export function useInSheet() {
  return useContext(InSheet);
}
