import fs from 'fs';

export function replaceValuesInFile({
  filePath,
  replacements,
}: {
  filePath: string;
  replacements: { search: string; replace: string }[];
}) {
  let fileContent = fs.readFileSync(filePath, 'utf8');
  replacements.forEach(({ search, replace }) => {
    fileContent = fileContent.replaceAll(search, replace);
  });

  fs.writeFileSync(filePath, fileContent);
}
