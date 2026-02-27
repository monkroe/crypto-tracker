# AI Start Here (Crypto Tracker)

Before proposing changes, read and follow:
- `monkroe/robert-os-hub/AI-PLAYBOOK.md` (canonical protocol)
- Hub integration notes: `docs/02-repo-map.md` (this repo is an attached module to the Vault layer)

## Role (what this repo is)
- Public-facing crypto portfolio tracker UI (GitHub Pages style).
- Intended to feed/align with Robert OS **Vault** layer (read/visualize holdings & performance).

## Non-negotiables
- One step at a time; stop and wait for user **"Done"**.
- No code/patch/SQL unless explicitly commanded.
- Keep diffs small and reversible.
- Do not invent data sources: inspect current code and existing data contracts first.

## Language policy
- UI text can be Lithuanian.
- Code/commit messages should be English.

## Default next step
Start with inspection (`rg` / `sed -n` / `nl -ba`), then propose ONE command/change.
