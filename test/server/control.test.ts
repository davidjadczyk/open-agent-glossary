import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createControlApp } from "../../src/server/control.js";

const TEST_DIR = join(tmpdir(), "oag-test-control-" + Date.now());
const GLOBAL_DIR = join(TEST_DIR, "global");
const PROJ = join(TEST_DIR, "proj");

let app: ReturnType<typeof createControlApp>;

beforeEach(() => {
  mkdirSync(GLOBAL_DIR, { recursive: true });
  mkdirSync(join(PROJ, ".agents"), { recursive: true });
  writeFileSync(
    join(PROJ, ".agents", "glossary.json"),
    JSON.stringify([{ term: "BFF", definition: "Backend for Frontend" }])
  );
  process.env.OAG_GLOBAL_DIR = GLOBAL_DIR;
  // serveUi:false so no static middleware interferes with API routing
  app = createControlApp({ cwd: PROJ, serveUi: false });
});

afterEach(() => {
  delete process.env.OAG_GLOBAL_DIR;
  rmSync(TEST_DIR, { recursive: true, force: true });
});

async function req(path: string, init?: RequestInit) {
  const res = await app.request("http://localhost" + path, init);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe("control server", () => {
  it("health returns ok + version", async () => {
    const { status, body } = await req("/api/health");
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.name).toBe("open-agent-glossary");
  });

  it("lists entries for project scope", async () => {
    const { status, body } = await req("/api/entries?scope=project");
    expect(status).toBe(200);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].term).toBe("BFF");
    expect(body.entries[0].scope).toBe("project");
  });

  it("rejects invalid scope", async () => {
    const { status, body } = await req("/api/entries?scope=bogus");
    expect(status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("CRUD round-trip: add, list, edit, delete", async () => {
    const add = await req("/api/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ term: "DTO", definition: "Data Transfer Object", scope: "project" }),
    });
    expect(add.status).toBe(201);

    const list = await req("/api/entries?scope=project");
    expect(list.body.entries.map((e: any) => e.term)).toContain("DTO");

    const edit = await req("/api/entries/DTO", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ definition: "Updated", scope: "project" }),
    });
    expect(edit.status).toBe(200);

    const del = await req("/api/entries/DTO?scope=project", { method: "DELETE" });
    expect(del.status).toBe(200);

    const after = await req("/api/entries?scope=project");
    expect(after.body.entries.map((e: any) => e.term)).not.toContain("DTO");
  });

  it("duplicate add returns 409", async () => {
    const res = await req("/api/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ term: "BFF", definition: "dup", scope: "project" }),
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });

  it("editing a missing term returns 404", async () => {
    const res = await req("/api/entries/Nope", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ definition: "x", scope: "project" }),
    });
    expect(res.status).toBe(404);
  });

  it("discovery returns global + projects shape", async () => {
    const { status, body } = await req("/api/discovery");
    expect(status).toBe(200);
    expect(Array.isArray(body.global)).toBe(true);
    expect(Array.isArray(body.projects)).toBe(true);
  });

  it("session returns a sessionId", async () => {
    const { status, body } = await req("/api/session");
    expect(status).toBe(200);
    expect(typeof body.sessionId).toBe("string");
  });

  it("usage routes return expected shapes", async () => {
    const usage = await req("/api/usage");
    expect(usage.body.version).toBe(1);
    const top = await req("/api/usage/top?limit=5");
    expect(Array.isArray(top.body.terms)).toBe(true);
  });

  it("suggest returns scope + alias candidates", async () => {
    const { status, body } = await req("/api/suggest?term=back-end");
    expect(status).toBe(200);
    expect(["project", "global"]).toContain(body.scope);
    expect(body.aliasCandidates).toContain("back end");
    expect(body.duplicate).toBeNull();
  });

  it("suggest flags duplicates", async () => {
    const { body } = await req("/api/suggest?term=BFF");
    expect(body.duplicate).not.toBeNull();
    expect(body.duplicate.scope).toBe("project");
  });
});

describe("control server — redesign routes", () => {
  it("pattern/test returns match ranges", async () => {
    const res = await req("/api/pattern/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pattern: "v\\d+", flags: "gi", sample: "v1 v2" }),
    });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.matches).toHaveLength(2);
  });

  it("config returns resolution stack + origins", async () => {
    const res = await req("/api/config");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stack)).toBe(true);
    expect(res.body.config.glossaryMode).toBe("merge");
    expect(res.body.origins.glossaryMode).toBeTruthy();
  });

  it("tags route returns distinct tags with counts", async () => {
    await req("/api/entries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        term: "Ledger",
        definition: "money",
        scope: "project",
        tags: ["payments", "core"],
      }),
    });
    const res = await req("/api/tags");
    expect(res.status).toBe(200);
    const tags = res.body.tags.map((t: any) => t.tag);
    expect(tags).toContain("payments");
  });

  it("merged entries flag overrides + definedIn", async () => {
    const res = await req("/api/entries?scope=merged");
    const bff = res.body.entries.find((e: any) => e.term === "BFF");
    expect(bff.definedIn).toBeTruthy();
    expect(bff.definedIn.location).toBe("project");
  });

  it("usage/timeline returns events array", async () => {
    const res = await req("/api/usage/timeline");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });
});
