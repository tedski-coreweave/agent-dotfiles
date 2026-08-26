#!/usr/bin/env bash
# One-command verification for this repo. Run before committing.
#
# Deliberately a plain script, not a build framework: this is a ~30 file
# config repo and the checks are shell syntax, JSON validity, the codeowners
# tests, and the symlink/drift check.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
failures=0

step() {
  local label="$1"
  shift
  if "$@" >/tmp/verify-step.log 2>&1; then
    echo "ok    $label"
  else
    echo "FAIL  $label"
    sed 's/^/        /' /tmp/verify-step.log | tail -20
    failures=$((failures + 1))
  fi
}

step "shell syntax" bash -n install.sh pi/refresh-netskope-ca.sh verify.sh

json_files=(
  pi/agent/settings.json
  pi/agent/models.json
  pi/agent/mcp.json
  pi/agent/trust.json.example
  pi/agent/npm/package.json
  pi/agent/npm/package-lock.json
)
step "tracked json" jq empty "${json_files[@]}"

# node >= 23 strips TypeScript types natively; older versions need the flag.
if node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 23 ? 0 : 1)'; then
  step "codeowners tests" node --test pi/agent/extensions/codeowners/resolve.test.ts
else
  step "codeowners tests" node --experimental-strip-types --test \
    pi/agent/extensions/codeowners/resolve.test.ts
fi

step "install check" ./install.sh --check

if [[ "$failures" -gt 0 ]]; then
  echo "verify: $failures check(s) failed" >&2
  exit 1
fi
echo "verify: all checks passed"
