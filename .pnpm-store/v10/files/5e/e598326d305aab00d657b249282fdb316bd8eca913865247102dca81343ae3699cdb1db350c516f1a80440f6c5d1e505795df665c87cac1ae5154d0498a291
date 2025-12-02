// src/runtimes/adapters/attachment/SimpleTextAttachmentAdapter.ts
var SimpleTextAttachmentAdapter = class {
  accept = "text/plain,text/html,text/markdown,text/csv,text/xml,text/json,text/css";
  async add(state) {
    return {
      id: state.file.name,
      type: "document",
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
          type: "text",
          text: `<attachment name=${attachment.name}>
${await getFileText(attachment.file)}
</attachment>`
        }
      ]
    };
  }
  async remove() {
  }
};
var getFileText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
  reader.readAsText(file);
});
export {
  SimpleTextAttachmentAdapter
};
//# sourceMappingURL=SimpleTextAttachmentAdapter.js.map