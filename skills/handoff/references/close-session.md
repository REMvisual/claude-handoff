# Close Session Flow

Used by Step 8 of the handoff skill, after the user answers Yes / No / "close without commit".

In compact mode (see SKILL.md) nobody is asked: run the **Yes** flow, skip its step 4, and end with the `COMPACT-HANDOFF-READY:` line.

## If the user says YES (or "yes"):

### 1. Append to the handoff file

Do this before committing, so the commit includes it and the tree ends clean.

If the user settled anything along with the close answer (a decision, a choice between options), record it first, then reread every section that asked for it: Where We're Going, Open Questions and the Quick Start `# Next action`. None of them may still ask for a decision that has been made. Update the bead note and `bd remember` the same way.

```
## Session Closed
**Closed at:** {timestamp}
**Commit:** the `session: {slug}` commit that includes this note
**Session status:** Handed off to next session
```

### 2. Commit all session work (default — don't ask again)

```bash
git status -s
git diff --stat
```

If uncommitted changes exist, stage all changed/new files relevant to this session's work (including the handoff file), then commit:

```
session: {slug} [{chain_tag}]

{One-line summary of what this session accomplished}

Handoff: {handoff_filename}
Bead(s): {bead_ids or "none"}

Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

Show the user the file list + commit hash.

**Be surgical:** only commit files related to this session's work. If `git status` shows unrelated changes from other sessions, mention them but don't commit. When in doubt, list the files and ask.

If working tree is clean: "Working tree clean — nothing to commit."

### 3. Output the paste prompt

```
-------------------------------------------------------
PASTE THIS INTO YOUR NEXT SESSION:
-------------------------------------------------------
Read `{path to file}` (seq {N}, {chain_tag}) and continue from "Where We're Going". Check `bd list --status=in_progress` for active work.

Before starting work, narrate your onboarding:
1. Read the handoff file and summarize what you understand (goal, current state, what was tried)
2. Show which bead(s) you're claiming and what phase/step you're starting
3. State what you'll verify first (run tests, check baselines, read key files)
4. Read the listed key files, then explore 2-3 adjacent files (configs, shared utils, related modules) not listed — the handoff captures what the previous session focused on, not everything that matters
5. Explain your planned first action and why
Then wait for my go-ahead before executing.
-------------------------------------------------------
```

### 4. Tell the user

"Session is closed. Paste the prompt above into a fresh session to continue."

## If the user says "close without commit":

Do steps 1, 3 and 4 above, skip the commit. Warn: "Changes are uncommitted — next session or other sessions may see dirty state."

## If the user says NO:

1. Tell the user: "Handoff saved. When you're ready to close, say 'close session' or run `/handoff` again."
2. Continue the conversation normally.
3. On any subsequent `/handoff` or "close session" or "done" or "wrap up", repeat this close flow.
