import { DefaultGeneratedFile, DefaultGeneratedFileWithType } from '../../stream/aisdk/v5/file';
import { registerClass } from './registry';

type GeneratedFileData = { data: string; mediaType: string };

registerClass<DefaultGeneratedFile, GeneratedFileData>('DefaultGeneratedFile', {
  toData: f => ({ data: f.base64, mediaType: f.mediaType }),
  fromData: d => new DefaultGeneratedFile({ data: d.data, mediaType: d.mediaType }),
});

registerClass<DefaultGeneratedFileWithType, GeneratedFileData>('DefaultGeneratedFileWithType', {
  toData: f => ({ data: f.base64, mediaType: f.mediaType }),
  fromData: d => new DefaultGeneratedFileWithType({ data: d.data, mediaType: d.mediaType }),
});
