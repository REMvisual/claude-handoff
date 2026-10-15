export type Mode = 'resume' | 'plan'

/** One /compact-handoff run, from the command until the continue-prompt is sent. */
export type Run = {
  mode: Mode
  /** `handoff`: the skill's turn is running. `compacting`: waiting for the compaction. */
  stage: 'handoff' | 'compacting'
  startedAt: number
  /** Handoff/plan files written during the run, as the tools reported them. */
  files: string[]
  /** Set once the turn ended with verified files. */
  handoff?: string
  plan?: string
  pastePrompt?: string
}

declare module 'claude-code' {
  interface PluginState {
    'compact-handoff': { run: Run | null; nudged: boolean }
  }
}
