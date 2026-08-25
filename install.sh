#!/usr/bin/env bash
# agent-dotfiles installer. Symlinks individual files into place.
#
# NEVER symlink a directory into ~/.pi/agent: runtime siblings
# (auth.json, sessions/, mcp-oauth/, models-store.json) live there and
# must stay untracked real files. ~/.agents/skills is the one allowed
# directory symlink; nothing else writes there.
#
# Usage:
#   ./install.sh           install (refuses to clobber real files)
#   ./install.sh --force   move real files aside (<name>.pre-dotfiles), then link
#   ./install.sh --check   report drift, write nothing, exit nonzero on findings
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Allowlist: "repo-relative-source:absolute-target".
# Adding a file to the repo means adding it here too, then rerunning install.
LINKS=(
  "userspace/AGENTS.md:$HOME/.pi/agent/AGENTS.md"
  "pi/refresh-netskope-ca.sh:$HOME/.pi/refresh-netskope-ca.sh"
  "pi/agent/settings.json:$HOME/.pi/agent/settings.json"
  "pi/agent/models.json:$HOME/.pi/agent/models.json"
  "pi/agent/mcp.json:$HOME/.pi/agent/mcp.json"
  "pi/agent/npm/package.json:$HOME/.pi/agent/npm/package.json"
  "pi/agent/npm/package-lock.json:$HOME/.pi/agent/npm/package-lock.json"
  "pi/agent/extensions/codeowners/index.ts:$HOME/.pi/agent/extensions/codeowners/index.ts"
  "pi/agent/extensions/codeowners/resolve.ts:$HOME/.pi/agent/extensions/codeowners/resolve.ts"
  "skills:$HOME/.agents/skills"
  "zsh/agents.zsh:$HOME/.oh-my-zsh/custom/agents.zsh"
  "shell/gitignore_global:$HOME/.gitignore"
)

MODE="install"
case "${1:-}" in
  --check) MODE="check" ;;
  --force) MODE="force" ;;
  "") ;;
  *) echo "usage: $0 [--check|--force]" >&2; exit 2 ;;
esac

findings=0

for entry in "${LINKS[@]}"; do
  src="$REPO/${entry%%:*}"
  dst="${entry#*:}"

  if [[ ! -e "$src" ]]; then
    echo "MISSING SOURCE: $src" >&2
    findings=$((findings + 1))
    continue
  fi

  if [[ -L "$dst" ]]; then
    if [[ "$(readlink "$dst")" == "$src" ]]; then
      [[ "$MODE" == "check" ]] && echo "ok: $dst"
      continue
    fi
    if [[ "$MODE" == "check" ]]; then
      echo "WRONG LINK: $dst -> $(readlink "$dst") (want $src)"
      findings=$((findings + 1))
    else
      ln -sfn "$src" "$dst"
      echo "relinked: $dst"
    fi
    continue
  fi

  if [[ -e "$dst" ]]; then
    case "$MODE" in
      check)
        echo "REAL FILE (expected symlink): $dst"
        findings=$((findings + 1))
        ;;
      force)
        mv "$dst" "$dst.pre-dotfiles"
        ln -sfn "$src" "$dst"
        echo "backed up + linked: $dst (original: $dst.pre-dotfiles)"
        ;;
      install)
        echo "REFUSING to clobber real file: $dst (rerun with --force)" >&2
        findings=$((findings + 1))
        ;;
    esac
    continue
  fi

  if [[ "$MODE" == "check" ]]; then
    echo "NOT INSTALLED: $dst"
    findings=$((findings + 1))
  else
    mkdir -p "$(dirname "$dst")"
    ln -sfn "$src" "$dst"
    echo "linked: $dst"
  fi
done

if [[ "$MODE" == "check" ]]; then
  drift="$(git -C "$REPO" status --porcelain)"
  if [[ -n "$drift" ]]; then
    echo "GIT DRIFT (review, commit with intent; push only with approval):"
    echo "$drift"
    findings=$((findings + 1))
  fi
  if [[ "$findings" -gt 0 ]]; then
    echo "check: $findings finding(s)" >&2
    exit 1
  fi
  echo "check: clean"
  exit 0
fi

if [[ "$findings" -gt 0 ]]; then
  echo "install: $findings unresolved finding(s)" >&2
  exit 1
fi

# Post-steps: prompted, never silent.
if [[ -t 0 ]]; then
  read -r -p "Run npm install in ~/.pi/agent/npm? [y/N] " a
  if [[ "$a" == "y" ]]; then (cd "$HOME/.pi/agent/npm" && npm install); fi
  read -r -p "Refresh Netskope CA bundle? [y/N] " a
  if [[ "$a" == "y" ]]; then "$HOME/.pi/refresh-netskope-ca.sh"; fi
else
  echo "Non-interactive: skipped post-steps (npm install, netskope CA refresh)."
fi
echo "install: done"
