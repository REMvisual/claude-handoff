#!/bin/bash
# claude-handoff installer
# Usage: curl -fsSL https://raw.githubusercontent.com/REMvisual/claude-handoff/main/install.sh | bash
# Pin a version: curl -fsSL ... | bash -s v1.2.0

set -euo pipefail

REPO="REMvisual/claude-handoff"
BRANCH="${1:-main}"
BASE_URL="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

SKILLS_DIR="${HOME}/.claude/skills"
HOOKS_DIR="${HOME}/.claude/hooks"

echo "Installing claude-handoff..."
echo ""

# Skills
mkdir -p "${SKILLS_DIR}/handoff" "${SKILLS_DIR}/handoffplan"
curl -fsSL "${BASE_URL}/skills/handoff/skill.md" -o "${SKILLS_DIR}/handoff/skill.md"
curl -fsSL "${BASE_URL}/skills/handoffplan/skill.md" -o "${SKILLS_DIR}/handoffplan/skill.md"

# Hook (optional — user registers it manually)
mkdir -p "${HOOKS_DIR}"
curl -fsSL "${BASE_URL}/hooks/precompact-handoff.sh" -o "${HOOKS_DIR}/precompact-handoff.sh"
chmod +x "${HOOKS_DIR}/precompact-handoff.sh"

echo "Installed:"
echo "  ${SKILLS_DIR}/handoff/skill.md"
echo "  ${SKILLS_DIR}/handoffplan/skill.md"
echo "  ${HOOKS_DIR}/precompact-handoff.sh"
echo ""
echo "Usage:"
echo "  Type /handoff in Claude Code to create a session handoff"
echo "  Type /handoffplan to create a handoff + implementation plan"
echo ""
echo "Optional: To enable auto-handoff before context compaction,"
echo "add to your Claude Code settings (hooks section):"
echo '  "PreCompact": [{ "command": "bash ~/.claude/hooks/precompact-handoff.sh" }]'
echo ""
echo "Done!"
