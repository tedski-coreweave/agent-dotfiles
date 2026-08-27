/**
 * Tests for CODEOWNERS resolution.
 *
 * Run: node --test pi/agent/extensions/codeowners/
 * (node >= 23 strips TypeScript types natively; on older node add
 * --experimental-strip-types)
 *
 * These are repo support files. They are NOT deployed, so they get no LINKS
 * entry in install.sh.
 *
 * The fixture below is GitHub's own complete example file, copied from
 * https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
 * Every assertion about it is taken from the comments in that example, so a
 * failure here means we disagree with documented GitHub behavior.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import {
  CODEOWNERS_LOCATIONS,
  findRepoRoot,
  locateCodeowners,
  parseCodeowners,
  patternToRegex,
  report,
  resolveOwners,
} from "./resolve.ts";

/** GitHub's documented example CODEOWNERS file, verbatim. */
const GITHUB_DOCS_EXAMPLE = `# This is a comment.
# Each line is a file pattern followed by one or more owners.

# These owners will be the default owners for everything in
# the repo. Unless a later match takes precedence,
# @global-owner1 and @global-owner2 will be requested for
# review when someone opens a pull request.
*       @global-owner1 @global-owner2

# Order is important; the last matching pattern takes the most
# precedence. When someone opens a pull request that only
# modifies JS files, only @js-owner and not the global
# owner(s) will be requested for a review.
*.js    @js-owner #This is an inline comment.

# You can also use email addresses if you prefer. They'll be
# used to look up users just like we do for commit author
# emails.
*.go docs@example.com

# Teams can be specified as code owners as well. Teams should
# be identified in the format @org/team-name. Teams must have
# explicit write access to the repository. In this example,
# the octocats team in the octo-org organization owns all .txt files.
*.txt @octo-org/octocats

# In this example, @doctocat owns any files in the build/logs
# directory at the root of the repository and any of its
# subdirectories.
/build/logs/ @doctocat

# The \`docs/*\` pattern will match files like
# \`docs/getting-started.md\` but not further nested files like
# \`docs/build-app/troubleshooting.md\`.
docs/* docs@example.com

# In this example, @octocat owns any file in an apps directory
# anywhere in your repository.
apps/ @octocat

# In this example, @doctocat owns any file in the \`/docs\`
# directory in the root of your repository and any of its
# subdirectories.
/docs/ @doctocat

# In this example, any change inside the \`/scripts\` directory
# will require approval from @doctocat or @octocat.
/scripts/ @doctocat @octocat

# In this example, @octocat owns any file in a \`/logs\` directory such as
# \`/build/logs\`, \`/scripts/logs\`, and \`/deeply/nested/logs\`. Any changes
# in a \`/logs\` directory will require approval from @octocat.
**/logs @octocat

# In this example, @octocat owns any file in the \`/apps\`
# directory in the root of your repository except for the \`/apps/github\`
# subdirectory, as its owners are left empty. Without an owner, changes
# to \`apps/github\` can be made with the approval of any user who has
# write access to the repository.
/apps/ @octocat
/apps/github
`;

/**
 * Run git without inheriting the caller's git environment.
 *
 * Hook runners (pre-commit) export GIT_INDEX_FILE, GIT_DIR, and friends. A
 * nested `git init` / `git worktree add` inherits them and fails with
 * "index file open failed", so these tests must start from a clean slate.
 */
function git(args: string[]): void {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("GIT_")) delete env[key];
  }
  execFileSync("git", args, { env, stdio: ["ignore", "ignore", "pipe"] });
}

/** Resolve one path against a CODEOWNERS body. */
function ownersOf(body: string, path: string): string[] {
  const rules = parseCodeowners(body);
  return resolveOwners(rules, [path], "/repo")[0].owners;
}

/** Temp dirs created by tests, cleaned up at the end. */
const tempDirs: string[] = [];
function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  // On macOS, /var is a symlink to /private/var. git reports the resolved path,
  // so resolve here too or every root comparison fails on a technicality.
  return realpathSync(dir);
}
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe("GitHub documented example file", () => {
  it("matches every ownership claim in the docs comments", () => {
    const cases: Array<[string, string[]]> = [
      // Default owners for everything not matched later.
      ["README.md", ["@global-owner1", "@global-owner2"]],
      // *.js overrides the global default; inline comment must not become an owner.
      ["app.js", ["@js-owner"]],
      ["deep/nested/app.js", ["@js-owner"]],
      // Email-style owners.
      ["main.go", ["docs@example.com"]],
      // Team owners.
      ["notes.txt", ["@octo-org/octocats"]],
      // Root-anchored directory owns its whole subtree, but **/logs comes later
      // in the file and also matches, so it wins for build/logs paths.
      ["build/logs/deploy.log", ["@octocat"]],
      // docs/* matches one level only. Later /docs/ rule owns the subtree.
      ["docs/getting-started.md", ["@doctocat"]],
      // Multiple owners on one line.
      ["scripts/deploy.sh", ["@doctocat", "@octocat"]],
      // **/logs matches a logs directory at any depth, including deeply nested.
      ["deeply/nested/logs/output.log", ["@octocat"]],
      ["scripts/logs/run.log", ["@octocat"]],
      // Ownerless rule carves an exception out of /apps/.
      ["apps/github/workflow.yml", []],
      ["apps/other/index.js", ["@octocat"]],
    ];

    for (const [path, expected] of cases) {
      assert.deepEqual(ownersOf(GITHUB_DOCS_EXAMPLE, path), expected, `path: ${path}`);
    }
  });

  it("keeps the inline comment out of the owner list", () => {
    const rules = parseCodeowners(GITHUB_DOCS_EXAMPLE);
    const jsRule = rules.find((r) => r.pattern === "*.js");
    assert.deepEqual(jsRule?.owners, ["@js-owner"]);
  });

  it("treats the ownerless /apps/github line as a real rule", () => {
    const rules = parseCodeowners(GITHUB_DOCS_EXAMPLE);
    const appsGithub = rules.filter((r) => r.pattern === "/apps/github");
    assert.equal(appsGithub.length, 1);
    assert.deepEqual(appsGithub[0].owners, []);
  });
});

describe("docs/* does not match deeper descendants", () => {
  it("matches one level only", () => {
    const body = "docs/* docs@example.com\n";
    assert.deepEqual(ownersOf(body, "docs/getting-started.md"), ["docs@example.com"]);
    assert.deepEqual(ownersOf(body, "docs/build-app/troubleshooting.md"), []);
  });

  it("still owns subtrees for explicit directory patterns", () => {
    assert.deepEqual(ownersOf("/docs/ @doctocat\n", "docs/build-app/troubleshooting.md"), [
      "@doctocat",
    ]);
    assert.deepEqual(ownersOf("apps/ @octocat\n", "deep/apps/a/b/c.js"), ["@octocat"]);
  });

  it("keeps single-star matching inside one segment", () => {
    assert.ok(patternToRegex("docs/*").test("docs/a.md"));
    assert.ok(!patternToRegex("docs/*").test("docs/a/b.md"));
    assert.ok(patternToRegex("**/logs").test("a/b/logs/c.log"));
  });
});

describe("last match wins", () => {
  it("prefers the later rule", () => {
    const body = "* @a\n*.js @b\n";
    assert.deepEqual(ownersOf(body, "x.js"), ["@b"]);
  });

  it("lets a later ownerless rule clear a previous owner", () => {
    const body = "/apps/ @octocat\n/apps/github\n";
    assert.deepEqual(ownersOf(body, "apps/github/workflow.yml"), []);
    assert.deepEqual(ownersOf(body, "apps/main/index.js"), ["@octocat"]);
  });

  it("lets a later owned rule override an earlier one", () => {
    const body = "/apps/ @octocat\n/apps/github @doctocat\n";
    assert.deepEqual(ownersOf(body, "apps/github/workflow.yml"), ["@doctocat"]);
  });

  it("reports a cleared rule as the winner, not as unmatched", () => {
    const rules = parseCodeowners("/apps/ @octocat\n/apps/github\n");
    const result = resolveOwners(rules, ["apps/github/x.yml"], "/repo")[0];
    assert.equal(result.rule?.pattern, "/apps/github");
    assert.deepEqual(result.owners, []);
    assert.equal(result.matchCount, 2);
  });
});

describe("anchoring", () => {
  it("anchors patterns containing a mid-string slash to the root", () => {
    assert.deepEqual(ownersOf("build/logs/ @a\n", "build/logs/x.log"), ["@a"]);
    assert.deepEqual(ownersOf("build/logs/ @a\n", "nested/build/logs/x.log"), []);
  });

  it("matches bare names at any depth", () => {
    assert.deepEqual(ownersOf("logs/ @a\n", "deep/nested/logs/x.log"), ["@a"]);
    assert.deepEqual(ownersOf("*.js @a\n", "deep/nested/x.js"), ["@a"]);
  });

  it("anchors leading-slash patterns to the root", () => {
    assert.deepEqual(ownersOf("/README.md @a\n", "README.md"), ["@a"]);
    assert.deepEqual(ownersOf("/README.md @a\n", "docs/README.md"), []);
  });

  it("supports ? as a single non-separator character", () => {
    assert.ok(patternToRegex("file?.js").test("file1.js"));
    assert.ok(!patternToRegex("file?.js").test("file12.js"));
    assert.ok(!patternToRegex("a?b").test("a/b"));
  });
});

describe("invalid syntax is skipped", () => {
  it("skips negation, character ranges, and escaped hashes", () => {
    const rules = parseCodeowners("!*.js @a\nsrc/[abc].js @b\n\\#weird @c\n*.md @d\n");
    assert.deepEqual(
      rules.map((r) => r.pattern),
      ["*.md"],
    );
  });

  it("ignores comments and blank lines", () => {
    const rules = parseCodeowners("# comment\n\n   \n*.md @a\n");
    assert.equal(rules.length, 1);
  });
});

describe("file location precedence", () => {
  it("declares GitHub's documented search order", () => {
    assert.deepEqual([...CODEOWNERS_LOCATIONS], [
      ".github/CODEOWNERS",
      "CODEOWNERS",
      "docs/CODEOWNERS",
    ]);
  });

  it("prefers .github/CODEOWNERS when several exist", () => {
    const root = makeTempDir("co-precedence-");
    git(["init", "-q", root]);
    mkdirSync(join(root, ".github"));
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, ".github", "CODEOWNERS"), "* @from-github-dir\n");
    writeFileSync(join(root, "CODEOWNERS"), "* @from-root\n");
    writeFileSync(join(root, "docs", "CODEOWNERS"), "* @from-docs\n");

    const located = locateCodeowners(root);
    assert.equal(located?.file, join(root, ".github", "CODEOWNERS"));
    assert.deepEqual(report(root, ["x.md"]).results[0].owners, ["@from-github-dir"]);
  });

  it("falls back to root, then docs/", () => {
    const rootOnly = makeTempDir("co-root-");
    git(["init", "-q", rootOnly]);
    writeFileSync(join(rootOnly, "CODEOWNERS"), "* @from-root\n");
    assert.equal(locateCodeowners(rootOnly)?.file, join(rootOnly, "CODEOWNERS"));

    const docsOnly = makeTempDir("co-docs-");
    git(["init", "-q", docsOnly]);
    mkdirSync(join(docsOnly, "docs"));
    writeFileSync(join(docsOnly, "docs", "CODEOWNERS"), "* @from-docs\n");
    assert.equal(locateCodeowners(docsOnly)?.file, join(docsOnly, "docs", "CODEOWNERS"));
  });

  it("ignores CODEOWNERS files outside the three supported locations", () => {
    const root = makeTempDir("co-nested-");
    git(["init", "-q", root]);
    const nested = join(root, "packages", "widget");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, "CODEOWNERS"), "* @nested-owner\n");

    // A nested file is not a GitHub location, so nothing is found even when the
    // query starts inside that directory.
    assert.equal(locateCodeowners(nested), undefined);
    assert.throws(() => report(nested, ["packages/widget/index.js"]), /No CODEOWNERS file found/);
  });

  it("does not escape into a parent repository", () => {
    const outer = makeTempDir("co-outer-");
    git(["init", "-q", outer]);
    writeFileSync(join(outer, "CODEOWNERS"), "* @outer-owner\n");

    const inner = join(outer, "inner");
    mkdirSync(inner);
    git(["init", "-q", inner]);

    // The inner repository has no CODEOWNERS; the outer file must not be used.
    assert.equal(findRepoRoot(inner), inner);
    assert.equal(locateCodeowners(inner), undefined);
  });
});

describe("repository root detection", () => {
  it("finds the root from a nested directory", () => {
    const root = makeTempDir("co-nested-root-");
    git(["init", "-q", root]);
    const deep = join(root, "a", "b", "c");
    mkdirSync(deep, { recursive: true });
    assert.equal(findRepoRoot(deep), root);
  });

  it("resolves linked worktrees where .git is a file", () => {
    const root = makeTempDir("co-worktree-");
    git(["init", "-q", "-b", "main", root]);
    git(["-C", root, "config", "user.email", "t@example.com"]);
    git(["-C", root, "config", "user.name", "T"]);
    mkdirSync(join(root, ".github"));
    writeFileSync(join(root, ".github", "CODEOWNERS"), "* @main-owner\n");
    git(["-C", root, "add", "-A"]);
    git(["-C", root, "commit", "-q", "-m", "init"]);

    const wt = join(root, "wt");
    git(["-C", root, "worktree", "add", "-q", wt, "-b", "side"]);

    // In a linked worktree, `.git` is a file. Root detection must still work and
    // must resolve to the worktree, where the checked-out CODEOWNERS lives.
    const located = locateCodeowners(wt);
    assert.equal(located?.root, wt);
    assert.deepEqual(report(wt, ["src/x.ts"]).results[0].owners, ["@main-owner"]);
  });
});

describe("path normalization", () => {
  it("accepts absolute paths, ./ prefixes, and @ prefixes", () => {
    const root = makeTempDir("co-normalize-");
    git(["init", "-q", root]);
    writeFileSync(join(root, "CODEOWNERS"), "docs/ @a\n");

    const r = report(root, [join(root, "docs", "x.md"), "./docs/x.md", "@docs/x.md"]);
    for (const result of r.results) {
      assert.deepEqual(result.owners, ["@a"], `input: ${result.input}`);
    }
  });
});

describe("large real-world CODEOWNERS corpus", () => {
  // Any big local CODEOWNERS works; override with CODEOWNERS_CORPUS. The
  // test skips when no corpus is present, so fresh machines stay green.
  const coreFile =
    process.env.CODEOWNERS_CORPUS ??
    join(process.env.HOME ?? "", "src/core/.github/CODEOWNERS");

  it("parses all active rules including ownerless ones", (t) => {
    let contents: string;
    try {
      contents = readFileSync(coreFile, "utf8");
    } catch {
      t.skip(`${coreFile} not available`);
      return;
    }

    const rules = parseCodeowners(contents);

    // Independent count: non-blank, non-comment lines.
    const activeLines = contents
      .split(/\r?\n/)
      .map((l) => l.replace(/#.*$/, "").trim())
      .filter((l) => l.length > 0);
    const ownerless = activeLines.filter((l) => l.split(/\s+/).length === 1);

    // Assert the invariant, not a snapshot count: this file is a live external
    // dependency that gains rules whenever someone lands a PR in core. The
    // 2026-08-25 review measured 896 active / 26 ownerless; drift in the totals
    // is expected, a mismatch against the independent count is the real bug.
    assert.equal(rules.length, activeLines.length, "every active line becomes a rule");
    assert.equal(
      rules.filter((r) => r.owners.length === 0).length,
      ownerless.length,
      "ownerless rules are retained",
    );
    // Sanity floor: the old parser silently dropped ownerless rules, so a
    // regression would show up as zero of them in a file that has many.
    assert.ok(ownerless.length > 0, "core has ownerless rules to exercise the clearing path");
    assert.ok(rules.length > 800, `expected a large ruleset, got ${rules.length}`);
  });
});
