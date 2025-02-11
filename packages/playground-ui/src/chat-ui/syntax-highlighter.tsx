export async function highlight(code: string, language: string) {
  const { codeToTokens, bundledLanguages } = await import('shiki');

  if (!(language in bundledLanguages)) return null;

  const { tokens } = await codeToTokens(code, {
    lang: language as keyof typeof bundledLanguages,
    defaultColor: false,
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
  });

  return tokens;
}
