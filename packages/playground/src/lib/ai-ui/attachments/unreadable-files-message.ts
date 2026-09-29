export const unreadableFilesMessage = (names: string[]) =>
  `Cannot read these files in Studio: ${names.join(', ')}. Upload a text file instead.`;
