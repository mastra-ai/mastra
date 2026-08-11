import { useLocation, useNavigate } from 'react-router';

export function useGlobalSearchNavigation(closeSearch: () => void) {
  const location = useLocation();
  const navigate = useNavigate();

  const selectPath = (path: string, preserveOrigin: boolean) => {
    if (preserveOrigin) {
      void navigate(path, { state: { from: location } });
    } else {
      void navigate(path);
    }
    closeSearch();
  };

  return { selectPath };
}
