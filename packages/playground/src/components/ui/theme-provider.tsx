import { createContext, useEffect } from 'react';
import { usePlaygroundStore } from '@/store/playground-store';

type Theme = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  attribute?: string;
};

const ThemeProviderContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: 'dark',
  setTheme: () => null,
});

const resolveTheme = (theme: Theme): ResolvedTheme => {
  if (theme !== 'system') {
    return theme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = usePlaygroundStore(state => state.theme);
  const setTheme = usePlaygroundStore(state => state.setTheme);

  const selectedTheme: Theme = theme === 'light' || theme === 'system' ? theme : 'dark';

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (nextTheme: Theme) => {
      const resolvedTheme = resolveTheme(nextTheme);
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    };

    applyTheme(selectedTheme);

    if (selectedTheme !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [selectedTheme]);

  return (
    <ThemeProviderContext.Provider value={{ theme: selectedTheme, setTheme }}>{children}</ThemeProviderContext.Provider>
  );
}
