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

# git reads $XDG_CONFIG_HOME/git/ignore when that var is set, else
# ~/.config/git/ignore. The fragment link and the generator must resolve
# identically or a set XDG_CONFIG_HOME orphans our own fragment.
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"

# Allowlist: "repo-relative-source:absolute-target".
# Adding a file to the repo means adding it here too, then rerunning install.
LINKS=(
  "userspace/AGENTS.md:$HOME/.pi/agent/AGENTS.md"
  "pi/refresh-netskope-ca.sh:$HOME/.pi/refresh-netskope-ca.sh"
  "pi/agent/settings.json:$HOME/.pi/agent/settings.json"
  "pi/agent/models.json:$HOME/.pi/agent/models.json"
  "pi/agent/mcp.json:$HOME/.pi/agent/mcp.json"
  "pi/agent/keybindings.json:$HOME/.pi/agent/keybindings.json"
  "pi/agent/npm/package.json:$HOME/.pi/agent/npm/package.json"
  "pi/agent/npm/package-lock.json:$HOME/.pi/agent/npm/package-lock.json"
  "pi/agent/extensions/codeowners/index.ts:$HOME/.pi/agent/extensions/codeowners/index.ts"
  "pi/agent/extensions/codeowners/resolve.ts:$HOME/.pi/agent/extensions/codeowners/resolve.ts"
  "pi/agent/extensions/attention-notify.ts:$HOME/.pi/agent/extensions/attention-notify.ts"
  "skills:$HOME/.agents/skills"
  "herdr/config.toml:$HOME/.config/herdr/config.toml"
  "zsh/agents.zsh:$HOME/.oh-my-zsh/custom/agents.zsh"
  "shell/gitignore.d/50-agents:$CONFIG_HOME/git/ignore.d/50-agents"
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
        # Never clobber an earlier backup: that is the only copy of the
        # pre-dotfiles original, and a second forced run would erase it.
        backup="$dst.pre-dotfiles"
        if [[ -e "$backup" ]]; then
          backup="$dst.pre-dotfiles.$(date +%Y%m%d%H%M%S)"
        fi
        if [[ -e "$backup" ]]; then
          echo "REFUSING to overwrite existing backup: $backup" >&2
          findings=$((findings + 1))
          continue
        fi
        mv "$dst" "$backup"
        ln -sfn "$src" "$dst"
        echo "backed up + linked: $dst (original: $backup)"
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

# --- Global gitignore assembly ---------------------------------------------
# ~/.config/git/ignore (git's default global excludes path, read when
# core.excludesFile is unset) is GENERATED from ~/.config/git/ignore.d/*
# fragments so multiple repos can contribute patterns without fighting over
# one file. This repo contributes 50-agents; numbered prefixes control
# concatenation order, which matters because gitignore is last-pattern-wins.
IGNORE_DIR="$CONFIG_HOME/git/ignore.d"
IGNORE_FILE="$CONFIG_HOME/git/ignore"

generate_ignore() {
  echo "# GENERATED from ${IGNORE_DIR}/* by install.sh (any contributing repo)."
  echo "# Edit the fragments, not this file; regeneration overwrites it."
  local frag
  for frag in "$IGNORE_DIR"/*; do
    [[ -f "$frag" ]] || continue
    echo ""
    echo "# --- ${frag##*/}"
    cat "$frag"
  done
}

if [[ -d "$IGNORE_DIR" ]]; then
  want="$(generate_ignore)"
  have="$(cat "$IGNORE_FILE" 2>/dev/null || true)"
  if [[ "$want" != "$have" ]]; then
    if [[ "$MODE" == "check" ]]; then
      echo "STALE OR MISSING GENERATED FILE: $IGNORE_FILE (rerun install)"
      findings=$((findings + 1))
    else
      printf '%s\n' "$want" > "$IGNORE_FILE"
      echo "generated: $IGNORE_FILE"
    fi
  elif [[ "$MODE" == "check" ]]; then
    echo "ok: $IGNORE_FILE (generated)"
  fi
fi

# core.excludesFile REPLACES the default path git reads, so a set value in
# ANY scope silently shadows the generated file and every fragment in it.
for scope in --system --global; do
  if excl="$(git config "$scope" core.excludesFile 2>/dev/null)"; then
    echo "WARNING: core.excludesFile ('$excl', $scope) shadows $IGNORE_FILE; unset it"
    if [[ "$MODE" == "check" ]]; then
      findings=$((findings + 1))
    fi
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
  # CA refresh must come first: npm install fails behind Netskope
  # TLS interception without the bundle.
  read -r -p "Refresh Netskope CA bundle? (skip on non-Netskope machines) [y/N] " a
  if [[ "$a" == "y" ]]; then "$HOME/.pi/refresh-netskope-ca.sh"; fi
  read -r -p "Run npm install in ~/.pi/agent/npm? [y/N] " a
  if [[ "$a" == "y" ]]; then
    (
      cd "$HOME/.pi/agent/npm"
      # New shells get this from zsh/agents.zsh; this one may not have it yet.
      if [[ -f "$HOME/.pi/netskope-ca.pem" ]]; then
        export NODE_EXTRA_CA_CERTS="$HOME/.pi/netskope-ca.pem"
      fi
      npm install
    )
  fi
else
  echo "Non-interactive: skipped post-steps (npm install, netskope CA refresh)."
fi
echo "install: done"
