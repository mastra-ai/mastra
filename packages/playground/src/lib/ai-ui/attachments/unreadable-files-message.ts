export const unreadableFilesMessage = (names: string[]) =>
  `Cannot read these files in Studio: ${names.join(', ')}. Export spreadsheet data as CSV or upload a text file instead.`;
