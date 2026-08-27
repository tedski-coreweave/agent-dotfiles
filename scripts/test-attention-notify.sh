#!/usr/bin/env bash
# Version-aware attention-notify test runner. Node >= 23 strips TypeScript
# types natively; older versions need the experimental flag.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 23 ? 0 : 1)'; then
  exec node --test --test-concurrency=1 pi/agent/extensions/attention-notify.test.ts
fi
exec node --experimental-strip-types --test --test-concurrency=1 pi/agent/extensions/attention-notify.test.ts
