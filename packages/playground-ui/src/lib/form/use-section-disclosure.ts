import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

export function useSectionDisclosure(path: string, initiallyExpanded: boolean) {
  const { getFieldState, formState } = useFormContext();
  const [disclosure, setDisclosure] = useState({ expanded: initiallyExpanded, dismissedSubmission: 0 });
  const invalid = getFieldState(path, formState).invalid;
  const hasNewErrors = invalid && formState.submitCount > disclosure.dismissedSubmission;

  function setExpanded(expanded: boolean) {
    setDisclosure({ expanded, dismissedSubmission: formState.submitCount });
  }

  return { expanded: disclosure.expanded || hasNewErrors, invalid, setExpanded };
}
