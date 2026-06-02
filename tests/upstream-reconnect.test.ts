import { describe, expect, it, vi, beforeEach } from "vitest";

// Track constructed clients and how each callTool behaves.
let connectCount = 0;
const callBehaviors: Array<() => any> = [];

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => {
  class Client {
    async connect() { connectCount++; }
    async callTool() {
      const fn = callBehaviors.shift();
      if (!fn) throw new Error("no behavior queued");
      return fn();
    }
  }
  return { Client };
});

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => {
  class StdioClientTransport {
    onclose?: () => void;
  }
  return { StdioClientTransport };
});

import { callUpstream, _resetUpstream } from "../src/upstream/client.js";

beforeEach(() => {
  connectCount = 0;
  callBehaviors.length = 0;
  _resetUpstream();
});

describe("callUpstream reconnect", () => {
  it("reconnects once after a -32000 Connection closed error", async () => {
    callBehaviors.push(() => { throw new Error("MCP error -32000: Connection closed"); });
    callBehaviors.push(() => ({ content: [{ type: "text", text: "ok" }] }));

    const out = await callUpstream("getObjectSource", { objectSourceUrl: "/x" });
    expect(out).toBe("ok");
    expect(connectCount).toBe(2); // initial + reconnect
  });

  it("does not retry on non-connection errors", async () => {
    callBehaviors.push(() => { throw new Error("boom"); });
    await expect(callUpstream("getObjectSource", { objectSourceUrl: "/x" })).rejects.toThrow("boom");
    expect(connectCount).toBe(1);
  });
});
