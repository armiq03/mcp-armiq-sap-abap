import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fetchAbapSource } from "../upstream/source-fetcher.js";
import { splitLines } from "../util/lines.js";

export const sourceSaveSchema = {
  name: "source_save",
  description:
    "Writes an ABAP object's FULL source to a local file LOSSLESS. The source never passes " +
    "through the LLM (no truncation): the server fetches it from upstream and writes it " +
    "directly to disk. Use this to save large objects. Returns only a small summary.",
  inputSchema: {
    type: "object",
    properties: {
      objectUrl: { type: "string", description: "ADT object URL or object name" },
      filePath: { type: "string", description: "Absolute local file path to write" },
    },
    required: ["objectUrl", "filePath"],
  },
} as const;

export interface SourceSaveArgs {
  objectUrl: string;
  filePath: string;
}

export interface SourceSaveResult {
  status: "success";
  savedTo: string;
  totalLines: number;
  bytes: number;
}

export async function sourceSave(args: SourceSaveArgs): Promise<SourceSaveResult> {
  const src = await fetchAbapSource(args.objectUrl);
  mkdirSync(dirname(args.filePath), { recursive: true });
  writeFileSync(args.filePath, src, "utf8");
  return {
    status: "success",
    savedTo: args.filePath,
    totalLines: splitLines(src).length,
    bytes: Buffer.byteLength(src, "utf8"),
  };
}
