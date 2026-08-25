/**
 * CODEOWNERS resolution — pure logic, no framework dependencies.
 *
 * Kept separate from index.ts (the pi wiring) so it can be exercised directly
 * with plain node and no module-resolution setup.
 *
 * GitHub applies CODEOWNERS with **last-match-wins** semantics over
 * gitignore-style patterns. Grepping is therefore unreliable: a broad early rule
 * is routinely overridden by a later narrow one, and in a large file (wandb/core
 * has ~850 rules) the override is easy to miss.
 *
 * Supported pattern syntax (GitHub's documented subset of gitignore):
 *   /foo      anchored to repo root
 *   foo/      directory, matched at any depth
 *   foo/bar   any pattern containing a slash is root-anchored
 *   *         matches within a path segment (does not cross `/`)
 *   **        crosses path separators
 *   ?         one non-separator character
 *
 * Matching is case-sensitive. A matched directory owns everything beneath it.
 * Not supported, because GitHub does not support them either: `!` negation and
 * `[]` character ranges.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve as resolvePath } from "node:path";

/** GitHub's three recognized CODEOWNERS locations, in precedence order. */
export const CODEOWNERS_LOCATIONS = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"] as const;

export interface Rule {
  line: number;
  pattern: string;
  owners: string[];
  regex: RegExp;
}

export interface MatchedRule {
  line: number;
  pattern: string;
  owners: string[];
}

export interface PathResult {
  input: string;
  path: string;
  owners: string[];
  rule?: { line: number; pattern: string };
  matchCount: number;
  chain: MatchedRule[];
}

/** Translate a single CODEOWNERS pattern into an anchored regex. */
export function patternToRegex(pattern: string): RegExp {
  let p = pattern;

  if (p.endsWith("/")) p = p.slice(0, -1);

  // gitignore rule: a slash anywhere other than the end anchors to the root.
  const anchored = p.startsWith("/") || p.replace(/\/+$/, "").includes("/");
  if (p.startsWith("/")) p = p.slice(1);

  let body = "";
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    if (c === "*") {
      if (p.slice(i, i + 2) === "**") {
        body += ".*";
        i += 2;
        // `**/` should also match zero directories
        if (p[i] === "/") {
          body += "/?";
          i += 1;
        }
        continue;
      }
      body += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?") {
      body += "[^/]";
      i += 1;
      continue;
    }
    body += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    i += 1;
  }

  const prefix = anchored ? "^" : "^(?:.*/)?";
  // A matched path owns itself and everything beneath it.
  return new RegExp(`${prefix}${body}(?:/.*)?$`);
}

export function parseCodeowners(contents: string): Rule[] {
  const rules: Rule[] = [];
  const lines = contents.split(/\r?\n/);

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx].trim();
    if (!line || line.startsWith("#")) continue;

    const fields = line.split(/\s+/);
    const pattern = fields[0];
    // Drop trailing inline comments; keep @user, @org/team, and bare emails.
    const owners: string[] = [];
    for (const field of fields.slice(1)) {
      if (field.startsWith("#")) break;
      owners.push(field);
    }
    if (!pattern || owners.length === 0) continue;

    rules.push({ line: idx + 1, pattern, owners, regex: patternToRegex(pattern) });
  }

  return rules;
}

/** Walk upward from `start` looking for a repository containing a CODEOWNERS file. */
export function locateCodeowners(start: string): { root: string; file: string } | undefined {
  let dir = resolvePath(start);
  for (;;) {
    for (const rel of CODEOWNERS_LOCATIONS) {
      const candidate = join(dir, rel);
      if (existsSync(candidate)) return { root: dir, file: candidate };
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Normalize a user- or model-supplied path into a repo-relative POSIX path. */
export function normalizeQueryPath(raw: string, root: string): string {
  // Some models prefix paths with '@'; built-in tools strip it, so we do too.
  let p = raw.trim().replace(/^@/, "");
  if (isAbsolute(p)) p = relative(root, p);
  return p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

/** Resolve the winning rule (and full match chain) for each path. */
export function resolveOwners(rules: Rule[], paths: string[], root: string): PathResult[] {
  return paths.map((raw) => {
    const path = normalizeQueryPath(raw, root);
    const matches = rules.filter((r) => r.regex.test(path));
    const winner = matches.length > 0 ? matches[matches.length - 1] : undefined;
    return {
      input: raw,
      path,
      owners: winner?.owners ?? [],
      rule: winner ? { line: winner.line, pattern: winner.pattern } : undefined,
      matchCount: matches.length,
      chain: matches.map((m) => ({ line: m.line, pattern: m.pattern, owners: m.owners })),
    };
  });
}

export interface Report {
  root: string;
  file: string;
  ruleCount: number;
  results: PathResult[];
}

/**
 * Full resolution pass. Throws if no CODEOWNERS file is found at or above `startDir`.
 */
export function report(startDir: string, paths: string[]): Report {
  const located = locateCodeowners(startDir);
  if (!located) {
    throw new Error(
      `No CODEOWNERS file found at or above ${startDir}. ` +
        `Looked for ${CODEOWNERS_LOCATIONS.join(", ")}. ` +
        `Pass repoRoot to point at the correct repository.`,
    );
  }

  const { root, file } = located;
  const rules = parseCodeowners(readFileSync(file, "utf8"));
  return { root, file, ruleCount: rules.length, results: resolveOwners(rules, paths, root) };
}

/** Render a compact human/LLM-readable summary. */
export function formatReport(r: Report, showChain: boolean): string {
  const rel = relative(r.root, r.file) || r.file;
  const lines: string[] = [`${rel} — ${r.ruleCount} rules (root: ${r.root})`, ""];

  for (const res of r.results) {
    lines.push(res.path);
    if (!res.rule) {
      lines.push("  (no matching rule — unowned)");
    } else {
      if (showChain && res.chain.length > 1) {
        for (const m of res.chain.slice(0, -1)) {
          lines.push(`  matched   L${m.line}: ${m.pattern} -> ${m.owners.join(" ")}`);
        }
      }
      const overridden =
        !showChain && res.matchCount > 1
          ? `   (${res.matchCount - 1} earlier rule(s) overridden)`
          : "";
      lines.push(
        `  owner  >> L${res.rule.line}: ${res.rule.pattern} -> ${res.owners.join(" ")}${overridden}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
