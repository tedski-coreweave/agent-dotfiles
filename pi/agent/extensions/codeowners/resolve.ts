/**
 * CODEOWNERS resolution — pure logic, no framework dependencies.
 *
 * Kept separate from index.ts (the pi wiring) so it can be exercised directly
 * with plain node. See resolve.test.ts; run it with:
 *   node --test pi/agent/extensions/codeowners/
 *
 * GitHub applies CODEOWNERS with **last-match-wins** semantics over
 * gitignore-style patterns. Grepping is therefore unreliable: a broad early rule
 * is routinely overridden by a later narrow one, and in a large file (a big
 * monorepo can run ~900 rules) the override is easy to miss.
 *
 * Behavior encoded here comes from GitHub's documentation:
 * https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
 *
 * Supported pattern syntax (GitHub's documented subset of gitignore):
 *   /foo      anchored to repo root
 *   foo/      directory, matched at any depth, owns everything beneath
 *   foo/bar   any pattern containing a mid-string slash is root-anchored
 *   *         matches within a path segment, never crosses `/`
 *   **        crosses path separators
 *   ?         one non-separator character
 *
 * Two rules that are easy to get wrong, both straight from the docs:
 *   - `docs/*` matches `docs/getting-started.md` but NOT
 *     `docs/build-app/troubleshooting.md`. A trailing `*` stops at one segment.
 *   - A pattern with no owners (`/apps/github`) is valid and CLEARS ownership
 *     when it wins. Dropping those lines silently reports the previous owner.
 *
 * Matching is case-sensitive, because GitHub evaluates these on a case-sensitive
 * filesystem even when the developer's machine is not.
 *
 * Invalid syntax is skipped, matching GitHub ("If any line in your CODEOWNERS
 * file contains invalid syntax, that line will be skipped"). That means `!`
 * negation, `[ ]` character ranges, and `\#` escapes.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve as resolvePath } from "node:path";

/**
 * GitHub's three recognized CODEOWNERS locations, in search order: ".github/",
 * repository root, then "docs/". The first file found wins; the others are
 * ignored entirely, even if the winner is empty.
 */
export const CODEOWNERS_LOCATIONS = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"] as const;

/** gitignore syntax that GitHub explicitly documents as non-functional here. */
const INVALID_PATTERN = /^!|[[\]]|^\\#/;

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

/**
 * Translate a single CODEOWNERS pattern into an anchored regex.
 *
 * The subtlety is what a match implies about descendants. `docs/` and a bare
 * `logs` name are directory-ish patterns that own their whole subtree, but
 * `docs/*` ends in a wildcard that must stay inside one path segment.
 */
export function patternToRegex(pattern: string): RegExp {
  let p = pattern;

  // A trailing slash means "directory", which owns everything beneath it.
  const trailingSlash = p.endsWith("/");
  if (trailingSlash) p = p.replace(/\/+$/, "");

  // gitignore rule: a slash anywhere but the end anchors the pattern to the root.
  const anchored = p.startsWith("/") || p.includes("/");
  if (p.startsWith("/")) p = p.slice(1);

  let body = "";
  let endsWithWildcard = false;
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    if (c === "*") {
      if (p.slice(i, i + 2) === "**") {
        // `**` crosses separators. `**/` also matches zero directories.
        i += 2;
        if (p[i] === "/") {
          body += "(?:.*/)?";
          i += 1;
        } else {
          body += ".*";
        }
        endsWithWildcard = i >= p.length;
        continue;
      }
      body += "[^/]*";
      i += 1;
      endsWithWildcard = i >= p.length;
      continue;
    }
    if (c === "?") {
      body += "[^/]";
      i += 1;
      endsWithWildcard = false;
      continue;
    }
    body += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    i += 1;
    endsWithWildcard = false;
  }

  const prefix = anchored ? "^" : "^(?:.*/)?";

  // A pattern ending in a single `*` selects entries in exactly one directory
  // level: `docs/*` covers `docs/getting-started.md` and not
  // `docs/build-app/troubleshooting.md`. Every other form (explicit directory,
  // bare name, `**`) owns the matched path and everything under it.
  const suffix = endsWithWildcard ? "$" : "(?:/.*)?$";

  return new RegExp(`${prefix}${body}${suffix}`);
}

/**
 * Parse CODEOWNERS text into ordered rules.
 *
 * Ownerless rules are KEPT. GitHub treats a pattern with no owners as a valid
 * rule that clears ownership when it is the last match, which is how
 * `/apps/github` carves an exception out of `/apps/ @octocat`.
 */
export function parseCodeowners(contents: string): Rule[] {
  const rules: Rule[] = [];
  const lines = contents.split(/\r?\n/);

  for (let idx = 0; idx < lines.length; idx += 1) {
    const raw = lines[idx];
    // Check the untouched line for invalid syntax first. GitHub does not support
    // escaping `#`, so `\#foo` is a skipped line, not a pattern named `\`.
    const trimmedRaw = raw.trim();
    if (INVALID_PATTERN.test(trimmedRaw)) continue;

    // Strip inline comments, then trim.
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;

    const fields = line.split(/\s+/);
    const pattern = fields[0];
    if (!pattern) continue;
    // Skip syntax GitHub documents as invalid rather than guessing intent.
    if (INVALID_PATTERN.test(pattern)) continue;

    rules.push({
      line: idx + 1,
      pattern,
      owners: fields.slice(1),
      regex: patternToRegex(pattern),
    });
  }

  return rules;
}

/**
 * Locate the repository root containing `start`.
 *
 * Uses git so linked worktrees (where `.git` is a file, not a directory) and
 * submodules resolve correctly. Falls back to a filesystem walk only when git
 * is unavailable or `start` is not in a repository.
 */
export function findRepoRoot(start: string): string | undefined {
  try {
    // Strip inherited GIT_* vars. Under a hook runner (pre-commit sets
    // GIT_INDEX_FILE, GIT_DIR) they would redirect this lookup at the hook's
    // repository instead of the path being queried.
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith("GIT_")) delete env[key];
    }
    const out = execFileSync("git", ["-C", start, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env,
    });
    const root = out.trim();
    if (root) return root;
  } catch {
    // Not a repository, or git is missing. Fall through to the manual walk.
  }

  let dir = resolvePath(start);
  for (;;) {
    // `.git` is a directory in a normal checkout and a file in a linked worktree.
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = resolvePath(dir, "..");
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Find the CODEOWNERS file for the repository containing `start`.
 *
 * Only the three documented locations at the repository root are considered. A
 * `CODEOWNERS` file in any other directory is not used by GitHub and must not be
 * used here either, or the tool reports ownership that GitHub will never apply.
 */
export function locateCodeowners(start: string): { root: string; file: string } | undefined {
  const root = findRepoRoot(start);
  if (!root) return undefined;

  for (const rel of CODEOWNERS_LOCATIONS) {
    const candidate = join(root, rel);
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return { root, file: candidate };
    }
  }
  return undefined;
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
      // An ownerless winning rule means "explicitly unowned", not "no rule".
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
 * Full resolution pass. Throws if the repository has no CODEOWNERS file in one
 * of the three locations GitHub recognizes.
 */
export function report(startDir: string, paths: string[]): Report {
  const located = locateCodeowners(startDir);
  if (!located) {
    throw new Error(
      `No CODEOWNERS file found for the repository containing ${startDir}. ` +
        `GitHub only reads ${CODEOWNERS_LOCATIONS.join(", ")} at the repository root. ` +
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
          const owners = m.owners.length > 0 ? m.owners.join(" ") : "(no owners)";
          lines.push(`  matched   L${m.line}: ${m.pattern} -> ${owners}`);
        }
      }
      const overridden =
        !showChain && res.matchCount > 1
          ? `   (${res.matchCount - 1} earlier rule(s) overridden)`
          : "";
      if (res.owners.length === 0) {
        // Distinguish "a rule cleared ownership" from "nothing matched".
        lines.push(
          `  owner  >> L${res.rule.line}: ${res.rule.pattern} -> (owners cleared: ` +
            `any write access approves)${overridden}`,
        );
      } else {
        lines.push(
          `  owner  >> L${res.rule.line}: ${res.rule.pattern} -> ${res.owners.join(" ")}${overridden}`,
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
