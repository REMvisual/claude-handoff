#!/bin/bash
# PreCompact Auto-Handoff — runs automatically before context compaction
# Captures raw project state as a safety net so the next session has orientation.
# Project-agnostic: uses beads/git/plans when available, skips gracefully when not.
# Works standalone. Optional task tracker integration (beads) if available.

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

# --- Gather state (each section fails gracefully, capped for brevity) ---

TASKS_ACTIVE=$(command -v bd >/dev/null 2>&1 && bd list --status=in_progress 2>/dev/null | head -15 || echo "_No task tracker available_")
GIT_LOG=$(git log --oneline -8 2>/dev/null || echo "_No git available_")
GIT_DIFF=$(git diff --stat 2>/dev/null | head -10 || echo "")
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

# --- Write handoff file (target: under 50 lines) ---
cat > "$HANDOFF_FILE" << HEREDOC
# Auto-Handoff (Pre-Compaction Safety Net)

**Date:** ${DATE}
**Branch:** ${GIT_BRANCH}
**Trigger:** Context auto-compaction

---

## Active Work

${TASKS_ACTIVE}

## Recent Commits

\`\`\`
${GIT_LOG}
\`\`\`

## Uncommitted Changes

\`\`\`
${GIT_DIFF}
\`\`\`
HEREDOC

# --- Persist to beads memory if available ---
command -v bd >/dev/null 2>&1 && bd remember "Auto-handoff written to ${HANDOFF_FILE} before context compaction on ${DATE}" 2>/dev/null || true

echo "Auto-handoff saved to ${HANDOFF_FILE}"
