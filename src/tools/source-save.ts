import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fetchAbapSource } from "../upstream/source-fetcher.js";
import { splitLines } from "../util/lines.js";

export const sourceSaveSchema = {
  name: "source_save",
  description:
    "Writes an ABAP object's source to a local file LOSSLESS. The source never passes " +
    "through the LLM (no truncation): the server fetches it from upstream and writes it " +
    "directly to disk. Saves the FULL source by default, or a line range if fromLine/toLine " +
    "are given. Use this for any save — never paste source through the LLM. Returns a small summary.",
  inputSchema: {
    type: "object",
    properties: {
      objectUrl: { type: "string", description: "ADT object URL or object name" },
      filePath: { type: "string", description: "Absolute local file path to write" },
      fromLine: { type: "number", description: "Optional 1-based start line (inclusive). Omit for full source." },
      toLine: { type: "number", description: "Optional 1-based end line (inclusive). Omit for full source." },
    },
    required: ["objectUrl", "filePath"],
  },
} as const;

export interface SourceSaveArgs {
  objectUrl: string;
  filePath: string;
  fromLine?: number;
  toLine?: number;
}

export interface SourceSaveResult {
  status: "success";
  savedTo: string;
  savedLines: number;
  totalLines: number;
  bytes: number;
}

export async function sourceSave(args: SourceSaveArgs): Promise<SourceSaveResult> {
  const src = await fetchAbapSource(args.objectUrl);
  const lines = splitLines(src);
  let out = src;
  if (args.fromLine != null || args.toLine != null) {
    const from = Math.max(1, args.fromLine ?? 1);
    const to = Math.min(lines.length, args.toLine ?? lines.length);
    out = lines.slice(from - 1, Math.max(from, to)).join("\n");
  }
  mkdirSync(dirname(args.filePath), { recursive: true });
  writeFileSync(args.filePath, out, "utf8");
  return {
    status: "success",
    savedTo: args.filePath,
    savedLines: splitLines(out).length,
    totalLines: lines.length,
    bytes: Buffer.byteLength(out, "utf8"),
  };
}
