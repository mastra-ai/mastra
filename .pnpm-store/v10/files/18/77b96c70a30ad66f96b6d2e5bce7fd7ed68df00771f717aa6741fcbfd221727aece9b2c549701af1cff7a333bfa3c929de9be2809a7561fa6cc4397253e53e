// src/file.ts
function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", function() {
      const result = JSON.parse(reader.result);
      resolve(result);
    });
    reader.addEventListener("error", reject);
    reader.readAsText(file);
  });
}
var MimeTypeToExtensionMap = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico"
});
var extension = (mimeType) => {
  return MimeTypeToExtensionMap[mimeType];
};

export {
  readJSONFile,
  extension
};
//# sourceMappingURL=chunk-5JU2E5TY.mjs.map