---
'@mastra/modal': patch
---

Fixed ModalFilesystem copyFile and moveFile deleting the source when the destination is the same path. They now throw FileExistsError and leave the file untouched.
