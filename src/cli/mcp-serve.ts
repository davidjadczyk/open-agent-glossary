import { startMcpServer } from "../mcp/server.js";
import { startControlServer } from "../server/control.js";

interface McpServeOptions {
  ui?: boolean;
  port?: string;
  open?: boolean;
}

export function mcpServeCommand(options: McpServeOptions = {}): void {
  const startUi = options.ui !== false; // default ON

  if (startUi) {
    // Fire up the control server alongside the stdio MCP server.
    void startControlServer({
      port: options.port ? Number(options.port) : undefined,
      serveUi: true,
      open: Boolean(options.open),
    }).catch((e) => {
      process.stderr.write(
        `Failed to start control server: ${e instanceof Error ? e.message : String(e)}\n`
      );
    });
  }
  startMcpServer();
}
