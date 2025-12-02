export const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to convert file to base64.'));
      }
    };

    reader.onerror = error => {
      reject(error);
    };

    reader.readAsDataURL(file);
  });
};
