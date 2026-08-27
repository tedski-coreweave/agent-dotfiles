---
name: wandb-model-sync
description: Check or synchronize the configured WandB-Inference model catalog against live W&B availability and catalog metadata. Use when W&B adds, removes, retires, or changes models, or when asked to refresh W&B model metadata.
compatibility: Requires Python 3, 1Password CLI access to the existing W&B inference credential, and network access to W&B.
---

# W&B model sync

Check first. The check never changes configuration. Review its snapshot and
report before running an approved update.

## Check

From the repository root:

```bash
snapshot_dir=".pi_tmp/wandb-model-sync/${PI_SESSION_ID:-manual}"
python3 skills/wandb-model-sync/scripts/sync.py \
  --output "$snapshot_dir/catalog.json"
```

Before the first check, review the fetched OpenAPI schema and establish its
tracked hash explicitly with `--write-openapi-baseline`. Ordinary checks require
that baseline. Exit `0` means the configuration matches. Exit `1` means a
reviewed update is needed. Exit `2` means a managed model has missing or
conflicting metadata, the schema changed, or retrieval failed. Never treat exit
`2` as a model removal. An unmatched remote model outside the configured
provider is quarantined in the report and does not block the managed catalog.

The script uses the authenticated Inference API for account-visible IDs, W&B's
catalog for lifecycle and capabilities, and W&B's models.dev catalog for output
limits. It writes no credential to the snapshot.

## Approved update

Only after the check report is reviewed and no blocker remains:

```bash
python3 skills/wandb-model-sync/scripts/sync.py \
  --output "$snapshot_dir/catalog.json" \
  --snapshot "$snapshot_dir/catalog.json" --apply
```

This changes only `providers.WandB-Inference.models`. Review the diff, update
`SUITABLE_MODELS.md` when its claims changed, then run `jq empty
pi/agent/models.json`, `pi --list-models WandB-Inference`, `git diff --check`,
and `./verify.sh`.

## Safety

- Do not print, persist, or pass a raw credential as a command argument.
- Do not update when IDs cannot be joined across all three sources.
- Do not infer missing capabilities from model names.
- A scheduled check may report differences. It must not invoke `--apply`.
