#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const bump = process.argv[2];

const allowed = new Set(["patch", "minor", "major", "prerelease", "prepatch", "preminor", "premajor"]);

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: opts.cwd ?? root });
}

function readVersion(path) {
  return JSON.parse(readFileSync(path, "utf8")).version;
}

if (!bump || !allowed.has(bump)) {
  console.error("Usage: npm run release -- <patch|minor|major|prerelease|prepatch|preminor|premajor>");
  process.exit(1);
}

try {
  // Preconditions
  const dirty = execSync("git status --porcelain", { cwd: root, encoding: "utf8" }).trim();
  if (dirty) {
    console.error("Working tree is not clean. Commit or stash changes first.");
    process.exit(1);
  }

  // Optional sanity check (no longer required for publish)
  try {
    run("npm whoami");
  } catch {
    console.warn("⚠️  npm whoami failed locally. Continuing because publishing is done by GitHub Actions Trusted Publisher.");
  }

  // Quality gates
  run("npm test");
  run("npm run typecheck");
  run("npm run build");
  run("npm --prefix ui run build");

  // Bump versions in both packages without auto-tagging
  run(`npm version ${bump} --no-git-tag-version`);
  const next = readVersion(resolve(root, "package.json"));
  run(`npm --prefix ui version ${next} --no-git-tag-version`);

  // Commit + tag
  run("git add package.json package-lock.json ui/package.json ui/package-lock.json");
  run(`git commit -m \"chore(release): v${next}\"`);
  run(`git tag v${next}`);

  // Push commit + tag (publishing is handled in GitHub Actions via Trusted Publisher)
  run("git push");
  run("git push --tags");

  // Create GitHub release (if gh is available)
  try {
    run(`gh release create v${next} --title \"v${next}\" --generate-notes`);
  } catch {
    console.warn("\n⚠️  Could not create GitHub release automatically (gh CLI missing or not authenticated).");
    console.warn(`   Create it manually: gh release create v${next} --title \"v${next}\" --generate-notes`);
  }

  console.log(`\n✅ Release complete: v${next}`);
} catch (err) {
  console.error("\n❌ Release failed.");
  process.exit(1);
}
