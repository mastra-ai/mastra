import type { Preview } from '@storybook/react-vite';
import { createElement, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { themes } from 'storybook/theming';
import './tailwind.css';
import { ThemeContext } from '@/ds/components/ThemeProvider/theme-context';
import type { ResolvedTheme, Theme } from '@/ds/components/ThemeProvider/theme-context';
import { Colors } from '@/ds/tokens/colors';

interface StoryThemeProviderProps {
  children: ReactNode;
  initialTheme: ResolvedTheme;
}

function StoryThemeProvider({ children, initialTheme }: StoryThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useLayoutEffect(() => {
    document.documentElement.classList.remove(resolvedTheme === 'dark' ? 'light' : 'dark');
    document.documentElement.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  return createElement(ThemeContext.Provider, { value: { theme, resolvedTheme, systemTheme, setTheme } }, children);
}

const preview: Preview = {
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      const theme = context.globals?.backgrounds?.value === 'light' ? 'light' : 'dark';
      return createElement(StoryThemeProvider, { initialTheme: theme, key: theme }, createElement(Story));
    },
  ],
  parameters: {
    docs: {
      theme: themes.dark,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: Colors.surface1 },
        light: { name: 'Light', value: Colors.surface1 },
      },
    },
  },
  initialGlobals: {
    // 👇 Set the initial background color
    backgrounds: { value: 'dark' },
  },
};

export default preview;
