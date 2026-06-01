import { fetchAbapSource } from "../upstream/source-fetcher.js";

export const sourceOutlineSchema = {
  name: "source_outline",
  description:
    "Returns the structural outline of an ABAP source (CLASS/INTERFACE/METHOD/FORM/FUNCTION " +
    "declarations with line numbers) WITHOUT method bodies. Use this to map a large object " +
    "before reading specific parts via source_lines.",
  inputSchema: {
    type: "object",
    properties: {
      objectUrl: { type: "string", description: "ADT object URL or object name" },
    },
    required: ["objectUrl"],
  },
} as const;

export interface SourceOutlineArgs {
  objectUrl: string;
}

export type OutlineEntryType =
  | "class"
  | "interface"
  | "method"
  | "form"
  | "function"
  | "include"
  | "program";

export interface OutlineEntry {
  line: number;
  type: OutlineEntryType;
  text: string;
}

export interface SourceOutlineResult {
  status: "success";
  totalLines: number;
  outline: OutlineEntry[];
}

export async function sourceOutline(args: SourceOutlineArgs): Promise<SourceOutlineResult> {
  const src = await fetchAbapSource(args.objectUrl);
  const lines = src.split("\n");

  const outline: OutlineEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    const upper = t.toUpperCase();
    let type: OutlineEntryType | null = null;
    if (upper.startsWith("CLASS ")) type = "class";
    else if (upper.startsWith("INTERFACE ")) type = "interface";
    else if (upper.startsWith("METHOD ") || upper.startsWith("METHODS ")) type = "method";
    else if (upper.startsWith("FORM ")) type = "form";
    else if (upper.startsWith("FUNCTION ")) type = "function";
    else if (upper.startsWith("INCLUDE ")) type = "include";
    else if (upper.startsWith("REPORT ") || upper.startsWith("PROGRAM ")) type = "program";
    if (type) {
      outline.push({ line: i + 1, type, text: t });
    }
  }

  return {
    status: "success",
    totalLines: lines.length,
    outline,
  };
}
