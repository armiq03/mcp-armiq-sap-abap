import { callUpstream, extractSourceField } from "../upstream/client.js";
import { sourceCache } from "../cache/source-cache.js";

/**
 * Fetch the full ABAP source body via the upstream MCP server, with a short TTL cache so
 * subsequent tool calls on the same object don't re-fetch.
 */
export async function fetchAbapSource(objectUrl: string): Promise<string> {
  const cached = sourceCache.get(objectUrl);
  if (cached !== undefined) return cached;

  const raw = await callUpstream("getObjectSource", { objectSourceUrl: objectUrl });
  const source = extractSourceField(raw);
  sourceCache.set(objectUrl, source);
  return source;
}
