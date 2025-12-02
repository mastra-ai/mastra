import {
  PendingAttachment,
  CompleteAttachment,
} from "../../../types/AttachmentTypes";
import { AttachmentAdapter } from "./AttachmentAdapter";

export class SimpleImageAttachmentAdapter implements AttachmentAdapter {
  public accept = "image/*";

  public async add(state: { file: File }): Promise<PendingAttachment> {
    return {
      id: state.file.name,
      type: "image",
      name: state.file.name,
      contentType: state.file.type,
      file: state.file,
      status: { type: "requires-action", reason: "composer-send" },
    };
  }

  public async send(
    attachment: PendingAttachment,
  ): Promise<CompleteAttachment> {
    return {
      ...attachment,
      status: { type: "complete" },
      content: [
        {
          type: "image",
          image: await getFileDataURL(attachment.file),
        },
      ],
    };
  }

  public async remove() {
    // noop
  }
}

const getFileDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);

    reader.readAsDataURL(file);
  });
