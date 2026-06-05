import { startControlServer, resolveUiDist } from "../server/control.js";

interface UiOptions {
  port?: string;
  open?: boolean; // commander sets false via --no-open
  cwd?: string;
}

export async function uiCommand(options: UiOptions): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const port = options.port ? Number(options.port) : undefined;
  const open = options.open !== false;

  if (!resolveUiDist()) {
    process.stderr.write(
      "open-agent-glossary-ui is not installed.\n" +
        "  Install it with: npm i -g open-agent-glossary-ui\n" +
        "  Or run on demand: npx open-agent-glossary-ui\n" +
        "Starting the control server anyway (JSON API + install hint at /).\n\n"
    );
  }

  const handle = await startControlServer({
    port,
    cwd,
    serveUi: true,
    open,
  });

  process.stdout.write(`open-agent-glossary UI running at ${handle.url}\n`);
  process.stdout.write("Press Ctrl+C to stop.\n");

  const shutdown = async () => {
    await handle.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
