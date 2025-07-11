import prettier from 'prettier';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';

export const formatJSON = async (code: string) => {
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
  } catch (e) {
    // If parsing throws an error, it's not valid JSON
    return false;
  }
};
