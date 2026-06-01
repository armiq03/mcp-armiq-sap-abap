/**
 * Wraps the upstream `mcp-abap-abap-adt-api` server as a child process and exposes a
 * minimal client interface that this toolkit needs.
 *
 * Auth (SAP_URL/SAP_USER/SAP_PASSWORD/SAP_CLIENT/SAP_LANGUAGE) is inherited from the
 * parent process environment, so the same credentials are used by both servers without
 * configuration duplication.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let cached: Client | null = null;
let connecting: Promise<Client> | null = null;

/** Lazy singleton — connects on first use, reuses afterwards. */
export async function getUpstream(): Promise<Client> {
  if (cached) return cached;
  if (connecting) return connecting;

  connecting = (async () => {
    const upstreamCommand = process.env.UPSTREAM_COMMAND ?? "npx";
    const upstreamArgsRaw = process.env.UPSTREAM_ARGS ?? "-y mcp-abap-abap-adt-api";
    const upstreamArgs = upstreamArgsRaw.split(/\s+/).filter(Boolean);

    const transport = new StdioClientTransport({
      command: upstreamCommand,
      args: upstreamArgs,
      env: { ...process.env } as Record<string, string>,
    });

    const client = new Client(
      { name: "mcp-armiq-sap-abap", version: "0.1.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    cached = client;
    connecting = null;
    return client;
  })();

  return connecting;
}

/** Call an upstream MCP tool and return the parsed text content as a string. */
export async function callUpstream(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const client = await getUpstream();
  const res = await client.callTool({ name: toolName, arguments: args });
  // The MCP response shape: { content: [{type: "text", text: "..."}], isError?: boolean }
  if (res.isError) {
    throw new Error(`Upstream tool ${toolName} failed: ${stringifyContent(res.content)}`);
  }
  return stringifyContent(res.content);
}

function stringifyContent(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (c && typeof c === "object" && "text" in c ? String(c.text) : ""))
      .join("");
  }
  return content == null ? "" : String(content);
}

/**
 * The upstream `getObjectSource` returns text containing JSON like
 *   {"status":"success","source":"..."}
 * Extract the source string. If parsing fails, return the raw text.
 */
export function extractSourceField(rawText: string): string {
  try {
    const obj = JSON.parse(rawText);
    if (obj && typeof obj === "object" && typeof obj.source === "string") {
      return obj.source;
    }
  } catch {
    // fall through
  }
  return rawText;
}

/** For tests: reset the cached client. */
export function _resetUpstream() {
  cached = null;
  connecting = null;
}
