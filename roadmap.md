# THE FINALS Loadout Analyzer: Development Roadmap (Refined)

## Short-Term (1–2 Sprints)

### UI/UX
- [x] Tooltips for radar chart categories with formula/context.
- [x] Granular loading/error states.
- [x] Responsive grid refinements for mobile (<600px).
- [x] Clear/Reset button for all selections.

### Core
- [x] Shareable Loadouts: generate unique URL with query params.
- [x] Local persistence via localStorage.
- [x] AI Persona prompt tuning (clearer distinctions in tone + depth).

## Mid-Term (Next Quarter)

### Analysis
- [x] Team Builder: 3-person loadout with synergy scoring + commentary.
- [ ] Map Context: map selection adjusts score weightings + analysis text. *(Note: UI is complete, but local score weighting is pending.)*
- [ ] Meta Tracking: timeline chart showing item tier/notes evolution from historical catalog.json snapshots.

### Catalog
- [ ] Catalog Viewer: searchable, filterable, read-only UI.
- [ ] Ingestion Pipeline UI: analyst tool → paste transcript → extract JSON delta → approve/merge.

## Long-Term (6+ Months)

### Accounts/Personalization
- [ ] User login + Saved Loadouts (CRUD).
- [ ] Personal Meta Insights: usage patterns → favored playstyle report.

### Community
- [ ] Community Builds: submit, upvote, featured builds.
- [ ] API Integration: pull real-time stats if available.

### Advanced AI
- [ ] Gameplay Clip Analysis: multimodal experiment for AI feedback.
- [ ] Counter-Play Generator: suggest optimal counters to given loadout.

## Key levers:
- **Dependencies:** Shareable Loadouts requires stable schema → plan before Team Builder.
- **Parallelization:** Catalog Viewer and local persistence can be built alongside UX polish.
- **Risk:** Gameplay Clip Analysis requires multimodal infra → flag as research, not committed.
