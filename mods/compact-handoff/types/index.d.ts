export type Mode = 'resume' | 'plan'

/** Where a run is, for the spinner line and the band above the prompt. */
export type Progress = { percent: number; step: string; detail?: string }

/** One /compact-handoff run, from the command until the continue-prompt is sent. */
export type Run = {
  mode: Mode
  /** `handoff`: the skill's turn is running. `compacting`: waiting for the compaction. */
  stage: 'handoff' | 'compacting'
  startedAt: number
  /** The context size when the run started: picks the handoff's line floor. */
  contextTokens?: number
  window?: number
  /** Set once the mod has asked for the rest of a handoff that came in under its floor. */
  retried?: boolean
  /** Handoff/plan files written during the run, as the tools reported them. */
  files: string[]
  /** Set once the turn ended with verified files. */
  handoff?: string
  plan?: string
  pastePrompt?: string
}

declare module 'claude-code' {
  interface PluginState {
    /** `roomWarned`: the highest room warning shown since the last compaction (0-3, logic.ts roomLevel). */
    'compact-handoff': { run: Run | null; roomWarned: number; askedForHandoff: boolean; progress: Progress | null }
  }
}
