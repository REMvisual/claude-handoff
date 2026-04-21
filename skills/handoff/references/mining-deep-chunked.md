# Deep and Chunked Mining Protocols

Used for sessions with >100K context tokens. Research shows LLMs have a "lost in the middle" problem — 30%+ accuracy drop for information in the middle of long contexts. A single-pass extraction at 500K+ tokens WILL miss decisions, measurements, and failed approaches from the middle ~50% of the conversation.

## Deep Pass (100K-500K tokens)

Two passes:

1. **Structured extraction** — Full checklist pass (see main skill). Force yourself: "Scan the MIDDLE third of the conversation for decisions and measurements I might skip."
2. **Gap-filling sweep** — Review your extraction. Ask: "What from the FIRST HALF is missing? What user feedback from MID-SESSION did I skip?"

## Chunked Pass (500K+ tokens, or 1M context + 50+ tool calls)

Map-reduce — a single pass will miss information at this scale.

1. **Segment** the conversation into 3-4 chronological chunks. Use natural breakpoints (topic shifts, major decisions, "let's move on" transitions).
2. **Per-chunk extraction** — Run the FULL extraction checklist against EACH chunk independently. Tag findings by chunk: `(early/mid/late)`.
3. **Merge + deduplicate** — Later decisions override earlier ones. Build a chronological timeline.
4. **Validation pass** — Ask: "What is missing for a new agent to continue? What comparison tables, cost data, or iteration histories did I skip?"

## Evidence Density Requirements

Chunked pass requires richer Evidence & Data. Heavy sessions produce commit logs, cost tables, approach comparisons, iteration histories, status matrices, and raw data. ALL must be captured — they are the most expensive to re-derive.

If your Evidence section has fewer than 3 tables or comparison data sets, you haven't mined deep enough.

## Line Targets

- **Chunked target:** 800 lines (1M context). Minimum: 500.
- **Deep target:** 600 lines. Minimum: 300.

A 10+ hour session with 100+ tool calls cannot be captured in 400 lines. Phase 1 (initial Write) typically produces 350-450 lines. Phase 2 (gap research + Edit) should push to 500-800. The ceiling exists — USE IT.

## Anti-Skimming Rule

If you find yourself summarizing instead of extracting, STOP. Re-read the segment. The value of this skill lives in the specific details — numbers, file paths, function names, exact quotes from the user, error messages with line numbers. Abstract summaries ("improved performance", "fixed bugs") are worth nothing to the next session.
