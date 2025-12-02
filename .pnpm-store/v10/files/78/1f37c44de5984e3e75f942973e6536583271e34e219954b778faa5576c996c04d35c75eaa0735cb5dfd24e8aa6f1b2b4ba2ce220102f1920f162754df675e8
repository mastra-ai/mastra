// src/runtimes/adapters/attachment/SimpleImageAttachmentAdapter.ts
var SimpleImageAttachmentAdapter = class {
  accept = "image/*";
  async add(state) {
    return {
      id: state.file.name,
      type: "image",
      name: state.file.name,
      contentType: state.file.type,
      file: state.file,
      status: { type: "requires-action", reason: "composer-send" }
    };
  }
  async send(attachment) {
    return {
      ...attachment,
      status: { type: "complete" },
      content: [
        {
          type: "image",
          image: await getFileDataURL(attachment.file)
        }
      ]
    };
  }
  async remove() {
  }
};
var getFileDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
  reader.readAsDataURL(file);
});
export {
  SimpleImageAttachmentAdapter
};
//# sourceMappingURL=SimpleImageAttachmentAdapter.js.map