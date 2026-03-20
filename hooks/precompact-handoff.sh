#!/bin/bash
# PreCompact Auto-Handoff — runs automatically before context compaction
# Captures raw project state as a safety net so the next session has orientation.
# Project-agnostic: uses beads/git/plans when available, skips gracefully when not.

set -euo pipefail

DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)

# --- Determine handoff directory ---
if [ -d "plans/handoffs" ]; then
    HANDOFF_DIR="plans/handoffs"
elif [ -d "plans" ]; then
    mkdir -p "plans/handoffs"
    HANDOFF_DIR="plans/handoffs"
elif [ -d ".claude" ]; then
    mkdir -p ".claude/handoffs"
    HANDOFF_DIR=".claude/handoffs"
else
    mkdir -p ".claude/handoffs"
    HANDOFF_DIR=".claude/handoffs"
fi

HANDOFF_FILE="${HANDOFF_DIR}/HANDOFF_auto-precompact_${DATE}_${TIMESTAMP##*_}.md"

# --- Gather state (each section fails gracefully) ---
# Extended limits: 1M context models can absorb bigger auto-handoffs (target: 80 lines vs 50)

BEADS_ACTIVE=$(bd list --status=in_progress 2>/dev/null | head -25 || echo "_No beads available_")
BEADS_OPEN=$(bd list --status=open --priority=0,1 2>/dev/null | head -15 || echo "")
GIT_LOG=$(git log --oneline -15 2>/dev/null || echo "_No git available_")
GIT_DIFF=$(git diff --stat 2>/dev/null | head -20 || echo "")
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
GIT_STATUS=$(git status -s 2>/dev/null | head -20 || echo "")

# --- Write handoff file (target: under 80 lines for 1M, under 50 for standard) ---
cat > "$HANDOFF_FILE" << HEREDOC
# Auto-Handoff (Pre-Compaction Safety Net)

**Date:** ${DATE}
**Branch:** ${GIT_BRANCH}
**Trigger:** Context auto-compaction

---

## Active Work (In Progress)

${BEADS_ACTIVE}

## High-Priority Open Work

${BEADS_OPEN}

## Recent Commits

\`\`\`
${GIT_LOG}
\`\`\`

## Working Tree Status

\`\`\`
${GIT_STATUS}
\`\`\`

## Uncommitted Changes

\`\`\`
${GIT_DIFF}
\`\`\`
HEREDOC

# --- Persist to beads memory if available ---
bd remember "Auto-handoff written to ${HANDOFF_FILE} before context compaction on ${DATE}" 2>/dev/null || true

echo "Auto-handoff saved to ${HANDOFF_FILE}"
