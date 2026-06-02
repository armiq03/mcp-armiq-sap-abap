#!/usr/bin/env node
/**
 * mcp-armiq-sap-abap — ABAP analysis & exploration tools layered on top of
 * mcp-abap-abap-adt-api.
 *
 * This server does not talk to SAP directly. It spawns mcp-abap-abap-adt-api as a child
 * MCP server and post-processes the source bodies it returns.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { sourceInfoSchema, sourceInfo } from "./tools/source-info.js";
import { sourceLinesSchema, sourceLines } from "./tools/source-lines.js";
import { sourceOutlineSchema, sourceOutline } from "./tools/source-outline.js";
import { sourceSearchSchema, sourceSearch } from "./tools/source-search.js";
import { sourceSaveSchema, sourceSave } from "./tools/source-save.js";

const server = new Server(
  { name: "mcp-armiq-sap-abap", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const tools = [sourceInfoSchema, sourceLinesSchema, sourceOutlineSchema, sourceSearchSchema, sourceSaveSchema];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    let result: unknown;
    switch (name) {
      case "source_info":
        result = await sourceInfo(args as any);
        break;
      case "source_lines":
        result = await sourceLines(args as any);
        break;
      case "source_outline":
        result = await sourceOutline(args as any);
        break;
      case "source_search":
        result = await sourceSearch(args as any);
        break;
      case "source_save":
        result = await sourceSave(args as any);
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Note: do not log to stdout — that channel is reserved for JSON-RPC messages.
  console.error("[mcp-armiq-sap-abap] ready");
}

main().catch((e) => {
  console.error("[mcp-armiq-sap-abap] fatal:", e);
  process.exit(1);
});
