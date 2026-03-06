export const formatJSON = async (code: string) => {
  const [prettier, prettierPluginBabel, prettierPluginEstree] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]);

  const formatted = await prettier.default.format(code, {
    semi: false,
    parser: 'json',
    printWidth: 80,
    tabWidth: 2,
    plugins: [prettierPluginBabel.default, prettierPluginEstree.default],
  });

  return formatted;
};

export const isValidJson = (str: string) => {
  try {
    // Attempt to parse the string as JSON
    const obj = JSON.parse(str);

    // Additionally check if the parsed result is an object
    return !!obj && typeof obj === 'object';
  } catch (e) {
    // If parsing throws an error, it's not valid JSON
    return false;
  }
};
