# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm install
pnpm dev                              # Vite dev server
pnpm test                             # all unit tests (vitest, node environment)
pnpm vitest run src/sankeyGraph.test.ts   # single test file
pnpm typecheck                        # vue-tsc -b
pnpm build                            # typecheck + production build to dist/ (base path /finanzen/)
```

Deployment to GitHub Pages happens automatically on push to `main` via `.github/workflows/deploy.yml`.

## Architecture

Single-page Vue 3 + TypeScript + Tailwind 4 app, no router, no backend. The UI language is German.

**Source of truth is the YAML text, not a parsed model.** `src/store/document.ts` holds the editor text and persists it to localStorage (`finanzen.yaml`). Import replaces the text, export downloads it verbatim, so comments and formatting survive round-trips. Everything else is derived on every keystroke:

1. `src/yamlFormat.ts` — `parseDocument(text)` validates the YAML and builds a `Category` tree (`src/model.ts`). Keys starting with `_` are reserved metadata (`_settings`, `_data`, per-category `_settings.displayname` and `_settings.value`) and never become categories. `_settings.value` is the amount of a category without subcategories and is ignored once subcategories exist. Errors carry German user-facing messages with the offending path. `App.vue` keeps rendering the last valid document while the text is mid-edit and shows the parse error next to the editor.
2. `src/sankeyGraph.ts` — `buildGraph(doc)` turns the tree into nodes/links with an explicit `column` per node, independent of d3. Rule: every node sits one column from its parent; positive totals go one column left and link *towards* the parent, negative totals go one column right and are *fed by* the parent. Top-level categories hang off a synthetic center node (`_center`); a synthetic `_balance` node (surplus on the right, deficit on the left) makes both sides sum up. Node ids are the key path joined with ` › `.
3. `src/sankeyLayout.ts` — `layoutGraph(graph, options)` runs d3-sankey only for the y-layout, then overrides `x0/x1` from the precomputed `column` (d3 derives its column count from the longest path, which can be shorter than the real column range). `nodeSort(null)` keeps YAML order top-to-bottom. `src/components/SankeyDiagram.vue` renders the result as SVG (ResizeObserver for width, hover highlighting, labels pointing outwards on the outermost columns).

**Editor ↔ diagram linking.** The parser walks the `yaml` AST (not `toJS`) so every `Category` carries source offsets: `range` (key through last child), `keyRange`, and `valueRange` (the amount literal, also for `_settings.value`). `categoryAt(doc, offset)` maps the editor cursor to the deepest category, which `App.vue` passes to the diagram as `highlighted`; clicking a node or its flow emits `select` with the category path, and `App.vue` selects its `valueRange` (or `keyRange`) in the textarea via the editor's exposed `select()`. Each `GraphLink` carries `node`, the child endpoint it belongs to, so flows hover and click like their category.

**Colors** (`src/colors.ts`): top-level categories take the fixed eight-color categorical palette in YAML order; subcategories are derived with CSS relative color syntax (`oklch(from …)`), getting lighter per depth and fanning out in hue among siblings. Colors are therefore CSS strings, not hex, and are applied via `style` bindings.

## Conventions

- Pure logic (`yamlFormat`, `sankeyGraph`, `sankeyLayout`, `model`, `colors`, `format`) stays free of Vue/DOM so it is testable under vitest's `node` environment; tests live next to the source as `*.test.ts`.
- `tsconfig.app.json` uses `erasableSyntaxOnly`: no enums, no parameter properties.
