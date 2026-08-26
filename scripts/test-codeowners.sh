#!/usr/bin/env bash
# Version-aware codeowners test runner, shared by verify.sh and pre-commit
# so the two invocation paths cannot drift. Node >= 23 strips TypeScript
# types natively; older versions need the experimental flag.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 23 ? 0 : 1)'; then
  exec node --test pi/agent/extensions/codeowners/resolve.test.ts
fi
exec node --experimental-strip-types --test pi/agent/extensions/codeowners/resolve.test.ts
