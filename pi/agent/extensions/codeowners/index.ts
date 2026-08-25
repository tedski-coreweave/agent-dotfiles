/**
 * codeowners — resolve CODEOWNERS ownership for repository paths.
 *
 * pi wiring only. All resolution logic lives in ./resolve.ts so it can be tested
 * without pi or typebox present.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { resolve as resolvePath } from "node:path";
import { formatReport, report } from "./resolve.ts";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "codeowners",
    label: "CODEOWNERS",
    description:
      "Resolve which team(s) own repository paths according to CODEOWNERS, using correct " +
      "last-match-wins semantics. Returns the winning rule per path, and optionally the full " +
      "chain of matching rules so the result can be verified. Prefer this over grepping " +
      "CODEOWNERS, which silently misses later overriding rules.",
    promptSnippet: "Resolve CODEOWNERS ownership for repo paths (last-match-wins)",
    promptGuidelines: [
      "Use codeowners to determine path ownership instead of grepping a CODEOWNERS file; " +
        "CODEOWNERS is last-match-wins, so grep results are frequently wrong.",
    ],
    parameters: Type.Object({
      paths: Type.Array(Type.String({ description: "Repo-relative or absolute path" }), {
        description: "One or more paths to resolve ownership for",
        minItems: 1,
      }),
      repoRoot: Type.Optional(
        Type.String({
          description:
            "Repository root to resolve against. Defaults to searching upward from the " +
            "current working directory for a CODEOWNERS file.",
        }),
      ),
      showChain: Type.Optional(
        Type.Boolean({
          description:
            "Include every matching rule, not just the winner. Useful for verifying why a " +
            "path resolves the way it does. Defaults to false.",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (signal?.aborted) {
        return { content: [{ type: "text", text: "Cancelled" }], details: {} };
      }

      const startDir = params.repoRoot
        ? resolvePath(ctx.cwd, params.repoRoot.replace(/^@/, ""))
        : ctx.cwd;

      // Throws when no CODEOWNERS file exists, which marks the tool call as failed.
      const result = report(startDir, params.paths);

      return {
        content: [{ type: "text", text: formatReport(result, params.showChain === true) }],
        details: {
          codeownersFile: result.file,
          repoRoot: result.root,
          ruleCount: result.ruleCount,
          results: result.results,
        },
      };
    },
  });
}
