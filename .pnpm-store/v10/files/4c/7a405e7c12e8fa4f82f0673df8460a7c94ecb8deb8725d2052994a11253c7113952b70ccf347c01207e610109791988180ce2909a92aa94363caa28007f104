import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export const readJson = async (directory: string, file: string) =>
  JSON.parse(await fsp.readFile(path.join(directory, file), "utf-8"));

export const readJsonSync = (directory: string, file: string) =>
  JSON.parse(fs.readFileSync(path.join(directory, file), "utf-8"));
