#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat >"$tmp/models.txt" <<'EOF'
provider         model  context  max-out  thinking  images
anthropic        a      1M       1K       yes       no
anthropic        a-pin  1M       1K       yes       no
openai-codex     o      1M       1K       yes       no
WandB-Inference  org/model  1M       1K       yes       no
EOF

cat >"$tmp/guide.md" <<'EOF'
<!-- reviewer-routing:start -->
| Parent selector | Reviewer selector |
| --- | --- |
| `anthropic/a` | `openai-codex/o` |
| `anthropic/a-pin` | `openai-codex/o` |
| `openai-codex/o` | `anthropic/a` |
| `WandB-Inference/org/model` | `anthropic/a` |
<!-- reviewer-routing:end -->
<!-- model-catalog:start -->
| Selector | Status | Home |
| --- | --- | --- |
| `anthropic/a` | routed | complementary native review |
| `anthropic/a-pin` | alias | `anthropic/a` |
| `openai-codex/o` | routed | complementary native review |
| `WandB-Inference/org/model` | routed | model-paired review |
<!-- model-catalog:end -->
EOF

cat >"$tmp/settings.json" <<'EOF'
{
  "subagents": {
    "modelScope": {
      "enforce": true,
      "strict": true,
      "agents": { "reviewer": { "allow": ["anthropic/a", "anthropic/a-pin", "openai-codex/o", "WandB-Inference/org/model"] } }
    }
  }
}
EOF

run_check() {
  node scripts/check-model-matrix.mjs \
    --models-file "${2:-$tmp/models.txt}" --guide "$1" --settings "$tmp/settings.json"
}
expect_failure() {
  local output
  if output="$(run_check "$1" 2>&1)"; then
    echo "expected model matrix check to fail: $2" >&2
    exit 1
  fi
  if ! grep -Fq "$2" <<<"$output"; then
    echo "model matrix check failed for the wrong reason; wanted '$2':" >&2
    echo "$output" >&2
    exit 1
  fi
}

run_check "$tmp/guide.md" >/dev/null

cp "$tmp/guide.md" "$tmp/missing.md"
perl -0pi -e 's/^\| `anthropic\/a` \| routed \|.*\n//m' "$tmp/missing.md"
expect_failure "$tmp/missing.md" "missing matrix home: anthropic/a"

cp "$tmp/guide.md" "$tmp/duplicate.md"
perl -0pi -e 's/(<!-- model-catalog:end -->)/| `anthropic\/a` | routed | complementary native review |\n$1/' "$tmp/duplicate.md"
expect_failure "$tmp/duplicate.md" "duplicate matrix home: anthropic/a"

cp "$tmp/guide.md" "$tmp/missing-route.md"
perl -0pi -e 's/^\| `anthropic\/a-pin` \| `openai-codex\/o` \|\n//m' "$tmp/missing-route.md"
expect_failure "$tmp/missing-route.md" "missing reviewer route for parent model: anthropic/a-pin"

cp "$tmp/guide.md" "$tmp/stale.md"
perl -0pi -e 's/(<!-- model-catalog:end -->)/| `anthropic\/stale` | parked | available, not yet routed |\n$1/' "$tmp/stale.md"
expect_failure "$tmp/stale.md" "stale matrix selector: anthropic/stale"

cp "$tmp/guide.md" "$tmp/unrouted.md"
perl -0pi -e 's/`anthropic\/a` \| routed \| complementary native review/`anthropic\/a` | parked | available, not yet routed/' "$tmp/unrouted.md"
expect_failure "$tmp/unrouted.md" "allowed reviewer model is not routed to review in matrix: anthropic/a"

cp "$tmp/models.txt" "$tmp/alias-mismatch-models.txt"
perl -0pi -e 's/anthropic        a-pin  1M/anthropic        a-pin  2M/' "$tmp/alias-mismatch-models.txt"
alias_output="$(run_check "$tmp/guide.md" "$tmp/alias-mismatch-models.txt" 2>&1)" && {
  echo "expected model matrix check to fail for mismatched alias capabilities" >&2
  exit 1
}
grep -Fq "alias capabilities differ: anthropic/a-pin -> anthropic/a" <<<"$alias_output"

cp "$tmp/settings.json" "$tmp/static-settings.json"
perl -0pi -e 's/"subagents": \{/"subagents": { "defaultModel": "anthropic\/a",/' "$tmp/static-settings.json"
static_output="$(node scripts/check-model-matrix.mjs --models-file "$tmp/models.txt" --guide "$tmp/guide.md" --settings "$tmp/static-settings.json" 2>&1)" && {
  echo "expected static reviewer default to fail" >&2
  exit 1
}
grep -Fq "subagents.defaultModel bypasses exact model-to-model reviewer routing" <<<"$static_output"

cp "$tmp/settings.json" "$tmp/unenforced-settings.json"
perl -0pi -e 's/"enforce": true/"enforce": false/' "$tmp/unenforced-settings.json"
unforced_output="$(node scripts/check-model-matrix.mjs --models-file "$tmp/models.txt" --guide "$tmp/guide.md" --settings "$tmp/unenforced-settings.json" 2>&1)" && {
  echo "expected unenforced reviewer scope to fail" >&2
  exit 1
}
grep -Fq "reviewer model scope must set enforce and strict true" <<<"$unforced_output"

mkdir "$tmp/empty-path"
node_bin="$(command -v node)"
if PATH="$tmp/empty-path" "$node_bin" scripts/check-model-matrix.mjs \
  --guide "$tmp/guide.md" --settings "$tmp/settings.json" \
  >"$tmp/missing-pi.log" 2>&1; then
  echo "expected model matrix check to fail without pi" >&2
  exit 1
fi
grep -q '^ERROR pi --list-models failed:' "$tmp/missing-pi.log"

echo "model-matrix tests: passed"
