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
    // If the upstream child dies (SAP session loss, crash), drop the cached client so the
    // next call reconnects instead of failing forever with "-32000 Connection closed".
    transport.onclose = () => {
      if (cached === client) cached = null;
    };
    cached = client;
    connecting = null;
    return client;
  })();

  return connecting;
}

function isConnectionClosed(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /-32000|connection closed|not connected/i.test(m);
}

/** Call an upstream MCP tool and return the parsed text content as a string. */
export async function callUpstream(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  let res;
  try {
    const client = await getUpstream();
    res = await client.callTool({ name: toolName, arguments: args });
  } catch (err) {
    if (!isConnectionClosed(err)) throw err;
    // Stale/dead upstream: reset and reconnect once.
    cached = null;
    connecting = null;
    const client = await getUpstream();
    res = await client.callTool({ name: toolName, arguments: args });
  }
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
 * Extract the ABAP source string from the upstream `getObjectSource` response.
 *
 * The text we receive is the upstream MCP envelope serialized as JSON:
 *   {"content":[{"type":"text","text":"{\"status\":\"success\",\"source\":\"...\\n...\"}"}]}
 * i.e. the inner {status,source} JSON is nested inside content[].text. We must unwrap the
 * envelope first, then parse the inner JSON to get `source` with real line breaks. Failing
 * to unwrap left the escaped "\n" literals in place, so splitLines() reported totalLines=1.
 */
export function extractSourceField(rawText: string): string {
  let text = rawText;
  // Unwrap the MCP envelope ({content:[{text}]}) if present — may be nested.
  for (let i = 0; i < 3; i++) {
    let obj: any;
    try {
      obj = JSON.parse(text);
    } catch {
      break;
    }
    if (obj && typeof obj === "object" && typeof obj.source === "string") {
      return obj.source;
    }
    if (obj && Array.isArray(obj.content) && obj.content[0]?.text != null) {
      text = String(obj.content[0].text);
      continue;
    }
    break;
  }
  return text;
}

/** For tests: reset the cached client. */
export function _resetUpstream() {
  cached = null;
  connecting = null;
}
