/* eslint-disable @typescript-eslint/consistent-type-imports */

let prettierModules:
  | Promise<
      [
        typeof import('prettier/standalone'),
        typeof import('prettier/plugins/babel'),
        typeof import('prettier/plugins/estree'),
      ]
    >
  | undefined;

const loadPrettier = () =>
  (prettierModules ??= Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]).catch(error => {
    prettierModules = undefined;
    throw error;
  }));

export const formatJSON = async (code: string) => {
  const [prettier, prettierPluginBabel, prettierPluginEstree] = await loadPrettier();

  const formatted = await prettier.format(code, {
    semi: false,
    parser: 'json',
    printWidth: 80,
    tabWidth: 2,
    plugins: [prettierPluginBabel, prettierPluginEstree],
  });

  return formatted;
};

export const isValidJson = (str: string) => {
  try {
    // Attempt to parse the string as JSON
    const obj = JSON.parse(str);

    // Additionally check if the parsed result is an object
    return !!obj && typeof obj === 'object';
  } catch {
    // If parsing throws an error, it's not valid JSON
    return false;
  }
};
