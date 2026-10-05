import { collect, describeError, describeFile, FILE_UPLOAD_ERROR_CODES, failed, ok } from './file-upload-errors';
import type { Result } from './file-upload-errors';
import { fileInfoOf } from './file-upload-file-info';
import type { FileUploadFileInfo } from './file-upload-file-info';

/** Returns `true` to upload the file, `false` to leave it to the model. */
export type FileUploadFilter = (file: FileUploadFileInfo) => boolean | Promise<boolean>;

interface FilterableFile {
  fileName?: string;
  mimeType: string;
}

/** Keeps the files the filter accepts; without a filter, every file is kept. */
export async function selectFiles<T extends FilterableFile>(
  files: T[],
  filter?: FileUploadFilter,
): Promise<Result<T[]>> {
  if (!filter || files.length === 0) return ok(files);
  const verdicts = collect(await Promise.all(files.map(file => askFilter(filter, file))));
  if (!verdicts.ok) return verdicts;
  return ok(files.filter((_, index) => verdicts.value[index]));
}

// `filter` is user code: an answer that is not a boolean must stop the turn, not decide for it.
async function askFilter(filter: FileUploadFilter, { fileName, mimeType }: FilterableFile): Promise<Result<boolean>> {
  const invalid = (cause: string) =>
    failed(
      FILE_UPLOAD_ERROR_CODES.INVALID_FILTER,
      `filter must return true or false; it did not for ${describeFile(fileName)}.`,
      { fileName, mimeType, cause },
    );
  try {
    const verdict: unknown = await filter(fileInfoOf({ fileName, mimeType }));
    return typeof verdict === 'boolean' ? ok(verdict) : invalid(String(verdict));
  } catch (error) {
    return invalid(describeError(error));
  }
}
