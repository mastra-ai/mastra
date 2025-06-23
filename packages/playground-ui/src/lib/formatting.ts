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
