export const unreadableFilesMessage = (names: string[]) =>
  `Cannot read these files in Studio: ${names.join(', ')}. Upload a text file instead.`;

export const spreadsheetUrlMessage = (url: string) =>
  `Spreadsheets can't be attached by URL: ${url}. Download the file and upload it instead.`;
