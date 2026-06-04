import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

export function startMcpServer(): void {
  const server = new McpServer({
    name: "open-agent-glossary",
    version: "0.1.0",
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  server.connect(transport);
}
