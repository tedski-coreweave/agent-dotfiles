#!/usr/bin/env node
// Skill corpus validator. Plain node, zero dependencies, so it runs on a
// fresh machine before npm install. Frontmatter parsing is deliberately a
// small hand parser: our frontmatter is a controlled dialect (flat keys
// plus one metadata block), and a YAML library would be the only dep.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(repo, "skills");
const errors = [];
const warnings = [];

// Legacy `refs:` hardens from warning to error once the provenance
// migration lands; CREDITS.md at the repo root is that migration's own
// marker, so the check flips itself and nobody has to remember to.
const migrationLanded = existsSync(join(repo, "CREDITS.md"));

// Matches git's author format: Name <email>.
const AUTHOR_RE = /^[^<>]+ <[^\s@<>]+@[^\s@<>]+>$/;

function parseFrontmatter(text, file) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") {
    errors.push(`${file}: missing frontmatter opening delimiter`);
    return null;
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) {
    errors.push(`${file}: unterminated frontmatter`);
    return null;
  }
  const fm = { keys: new Set(), name: "", description: "", author: "" };
  let inMetadata = false;
  for (const line of lines.slice(1, end)) {
    const top = line.match(/^([A-Za-z][\w-]*):(.*)$/);
    if (top) {
      fm.keys.add(top[1]);
      inMetadata = top[1] === "metadata";
      const value = top[2].trim().replace(/^["']|["']$/g, "");
      if (top[1] === "name") fm.name = value;
      if (top[1] === "description") fm.description = value;
      continue;
    }
    if (inMetadata) {
      const sub = line.match(/^\s+author:(.*)$/);
      if (sub) fm.author = sub[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return { fm, body: lines.slice(end + 1).join("\n") };
}

function checkBodyLinks(body, dir, file) {
  // Relative markdown links must resolve against the skill dir; a broken
  // one is a dangling pointer the agent will chase at the worst moment.
  for (const m of body.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    if (!existsSync(join(dir, target.split("#")[0]))) {
      errors.push(`${file}: broken relative reference: ${target}`);
    }
  }
}

const names = new Map();
const dirs = readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

for (const dir of dirs) {
  const file = join("skills", dir, "SKILL.md");
  const abs = join(skillsDir, dir, "SKILL.md");
  if (!existsSync(abs)) {
    errors.push(`${file}: missing SKILL.md`);
    continue;
  }
  const parsed = parseFrontmatter(readFileSync(abs, "utf8"), file);
  if (!parsed) continue;
  const { fm, body } = parsed;

  if (!fm.name) errors.push(`${file}: frontmatter name missing or empty`);
  else if (fm.name !== dir) {
    errors.push(`${file}: name '${fm.name}' != directory '${dir}'`);
  }
  if (!fm.description) {
    errors.push(`${file}: frontmatter description missing or empty`);
  } else if (/^[>|]/.test(fm.description)) {
    // A block scalar would pass the emptiness check as the literal '>-'
    // while hiding the real content from this parser. Inline strings only.
    errors.push(`${file}: block-scalar description unsupported; inline it`);
  }
  if (fm.keys.has("refs")) {
    const msg = `${file}: legacy 'refs:' key (use metadata.author or CREDITS.md)`;
    if (migrationLanded) errors.push(msg);
    else warnings.push(`${msg} [error once CREDITS.md lands]`);
  }
  if (fm.author && !AUTHOR_RE.test(fm.author)) {
    errors.push(`${file}: metadata.author '${fm.author}' is not 'Name <email>'`);
  }
  if (fm.name) {
    if (names.has(fm.name)) {
      errors.push(`${file}: duplicate name '${fm.name}' (also ${names.get(fm.name)})`);
    }
    names.set(fm.name, file);
  }
  checkBodyLinks(body, join(skillsDir, dir), file);

  // Cross-scope collision: pi keeps the first skill found on a name
  // collision, so a same-named vault skill silently shadows or drifts.
  // Warning-only, and silent when the vault is absent (fresh machines).
  const vaultSkill = join(
    process.env.HOME ?? "",
    "obsidian/.agents/skills",
    dir,
    "SKILL.md",
  );
  if (existsSync(vaultSkill)) {
    warnings.push(`${file}: name collides with vault skill ${vaultSkill}`);
  }
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
console.log(
  `check-skills: ${dirs.length} skills, ${errors.length} error(s), ${warnings.length} warning(s)`,
);
process.exit(errors.length ? 1 : 0);
