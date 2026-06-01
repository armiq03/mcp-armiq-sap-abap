import { fetchAbapSource } from "../upstream/source-fetcher.js";
import { splitLines } from "../util/lines.js";

export const sourceInfoSchema = {
  name: "source_info",
  description:
    "Returns metadata about an ABAP object's source (totalLines, totalChars, structure summary) " +
    "WITHOUT returning the source body. Call this FIRST before reading large objects to decide " +
    "on a chunked reading strategy. Internally fetches the source from the upstream " +
    "mcp-abap-abap-adt-api server and post-processes it.",
  inputSchema: {
    type: "object",
    properties: {
      objectUrl: {
        type: "string",
        description: "ADT object URL or object name. Auto-resolved by the upstream server.",
      },
    },
    required: ["objectUrl"],
  },
} as const;

export interface SourceInfoArgs {
  objectUrl: string;
}

export interface SourceInfoResult {
  status: "success";
  totalLines: number;
  totalChars: number;
  structure: {
    classCount: number;
    methodCount: number;
    formCount: number;
    functionCount: number;
    includeCount: number;
  };
  suggestion: string;
}

export async function sourceInfo(args: SourceInfoArgs): Promise<SourceInfoResult> {
  const src = await fetchAbapSource(args.objectUrl);
  const lines = splitLines(src);

  let classCount = 0,
    methodCount = 0,
    formCount = 0,
    functionCount = 0,
    includeCount = 0;
  for (const raw of lines) {
    const t = raw.trim().toUpperCase();
    if (t.startsWith("CLASS ") && !t.startsWith("CLASS-")) classCount++;
    else if (t.startsWith("METHOD ")) methodCount++;
    else if (t.startsWith("FORM ")) formCount++;
    else if (t.startsWith("FUNCTION ")) functionCount++;
    else if (t.startsWith("INCLUDE ")) includeCount++;
  }

  const suggestion =
    lines.length > 500
      ? `Source is ${lines.length} lines. Use source_lines (chunks of 500-1000), source_outline (structure only), or source_search (specific patterns) to keep token usage low.`
      : "Small source — safe to read fully via the upstream getObjectSource tool.";

  return {
    status: "success",
    totalLines: lines.length,
    totalChars: src.length,
    structure: { classCount, methodCount, formCount, functionCount, includeCount },
    suggestion,
  };
}
