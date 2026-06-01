import { fetchAbapSource } from "../upstream/source-fetcher.js";
import { splitLines } from "../util/lines.js";

export const sourceLinesSchema = {
  name: "source_lines",
  description:
    "Reads a specific line range of an ABAP object's source. Use after source_info to page " +
    "through large objects in chunks. Recommended chunk size: 500-1000 lines.",
  inputSchema: {
    type: "object",
    properties: {
      objectUrl: { type: "string", description: "ADT object URL or object name" },
      fromLine: { type: "number", description: "1-based starting line (inclusive). Default: 1" },
      toLine: {
        type: "number",
        description: "1-based ending line (inclusive). Default: fromLine + 500",
      },
    },
    required: ["objectUrl"],
  },
} as const;

export interface SourceLinesArgs {
  objectUrl: string;
  fromLine?: number;
  toLine?: number;
}

export interface SourceLinesResult {
  status: "success";
  source: string;
  fromLine: number;
  toLine: number;
  totalLines: number;
  hasMore: boolean;
}

export async function sourceLines(args: SourceLinesArgs): Promise<SourceLinesResult> {
  const src = await fetchAbapSource(args.objectUrl);
  const lines = splitLines(src);

  const fromLine = Math.max(1, args.fromLine ?? 1);
  const defaultTo = fromLine + 500 - 1;
  let toLine = args.toLine ?? defaultTo;
  if (toLine > lines.length) toLine = lines.length;
  if (toLine < fromLine) toLine = fromLine;

  const chunk = lines.slice(fromLine - 1, toLine).join("\n");

  return {
    status: "success",
    source: chunk,
    fromLine,
    toLine,
    totalLines: lines.length,
    hasMore: toLine < lines.length,
  };
}
