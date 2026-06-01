import { fetchAbapSource } from "../upstream/source-fetcher.js";

export const sourceSearchSchema = {
  name: "source_search",
  description:
    "Searches for a regex pattern (case-insensitive) in an ABAP object's source and returns " +
    "matches with surrounding context. Use to find specific statements (SELECT, AUTHORITY-CHECK, " +
    "CALL FUNCTION, etc.) in large objects without reading the full source.",
  inputSchema: {
    type: "object",
    properties: {
      objectUrl: { type: "string", description: "ADT object URL or object name" },
      pattern: { type: "string", description: "Regex pattern (case-insensitive)" },
      contextLines: {
        type: "number",
        description: "Lines of context before/after each match. Default: 2",
      },
      maxMatches: { type: "number", description: "Max matches to return. Default: 50" },
    },
    required: ["objectUrl", "pattern"],
  },
} as const;

export interface SourceSearchArgs {
  objectUrl: string;
  pattern: string;
  contextLines?: number;
  maxMatches?: number;
}

export interface SourceSearchMatch {
  lineNumber: number;
  line: string;
  before: string[];
  after: string[];
}

export interface SourceSearchResult {
  status: "success";
  pattern: string;
  totalLines: number;
  matchCount: number;
  truncated: boolean;
  matches: SourceSearchMatch[];
}

export async function sourceSearch(args: SourceSearchArgs): Promise<SourceSearchResult> {
  const contextLines = args.contextLines ?? 2;
  const maxMatches = args.maxMatches ?? 50;

  let regex: RegExp;
  try {
    regex = new RegExp(args.pattern, "i");
  } catch (e) {
    throw new Error(`Invalid regex pattern: ${(e as Error).message}`);
  }

  const src = await fetchAbapSource(args.objectUrl);
  const lines = src.split("\n");

  const matches: SourceSearchMatch[] = [];
  for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
    if (regex.test(lines[i])) {
      const before = lines.slice(Math.max(0, i - contextLines), i);
      const after = lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines));
      matches.push({ lineNumber: i + 1, line: lines[i], before, after });
    }
  }

  return {
    status: "success",
    pattern: args.pattern,
    totalLines: lines.length,
    matchCount: matches.length,
    truncated: matches.length >= maxMatches,
    matches,
  };
}
