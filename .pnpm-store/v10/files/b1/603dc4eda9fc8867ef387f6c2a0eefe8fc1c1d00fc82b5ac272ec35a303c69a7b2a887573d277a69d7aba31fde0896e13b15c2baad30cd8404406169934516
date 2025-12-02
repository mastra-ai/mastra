import { Readable } from "stream";

export type PrerecordedSource = UrlSource | Buffer | Readable;

export type FileSource = Buffer | Readable;

export interface UrlSource {
  url: string;
}

export interface TextSource {
  text: string;
}

export type AnalyzeSource = UrlSource | TextSource;
