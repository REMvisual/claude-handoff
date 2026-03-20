#!/bin/bash
# claude-handoff uninstaller
# Usage: bash uninstall.sh
#   or:  curl -fsSL https://raw.githubusercontent.com/REMvisual/claude-handoff/main/uninstall.sh | bash

set -euo pipefail

SKILLS_DIR="${HOME}/.claude/skills"
HOOKS_DIR="${HOME}/.claude/hooks"

FILES=(
  "${SKILLS_DIR}/handoff/skill.md"
  "${SKILLS_DIR}/handoffplan/skill.md"
  "${HOOKS_DIR}/precompact-handoff.sh"
)

echo "Uninstalling claude-handoff..."
echo ""

removed=0
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    rm "$f"
    echo "  Removed: $f"
    ((removed++))
  else
    echo "  Not found (skipped): $f"
  fi
done

# Clean up empty skill directories
rmdir "${SKILLS_DIR}/handoff" 2>/dev/null || true
rmdir "${SKILLS_DIR}/handoffplan" 2>/dev/null || true

echo ""
echo "Removed ${removed} file(s)."
echo ""
echo "Note: If you added a PreCompact hook to your Claude Code settings,"
echo "remember to remove it manually from your hooks configuration."
echo ""
echo "Done!"
