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
2. `src/sankeyGraph.ts` — `buildGraph(doc)` turns the tree into nodes/links with an explicit `column` per node. Rule: positive totals sit left of their parent and link *towards* it, negative totals sit right of it and are *fed by* it. A node's opposite-signed subtrees are laid out *between* the node and its parent (`extentOf` computes the columns they need), so a negative subsection of an income category never crosses the center and the parent link simply spans several columns. `buildGraph` also decides each node's vertical `align` (`center`, or `top`/`bottom` when it has opposite-signed descendants to route around: a centered parent splits its own-side children in halves, an edge-aligned parent passes its alignment down, and a parent whose only own child is edge-aligned follows it). Exception to the column rule (`shares`): if a node's lane is the outermost on an edge-aligned parent's bar (last own-side child for `top`, first for `bottom`), its opposite-signed subtree moves one column towards the parent so its deepest level shares the parent's column; the subtree sits beside the node's lane, which is the only region of the parent's column that is vertically clear of the parent's bar. A centered parent (including the center node) never shares. Top-level categories hang off a synthetic center node (`_center`); a synthetic `_balance` node (surplus on the right, deficit on the left) makes both sides sum up. Node ids are the key path joined with ` › `.
3. `src/sankeyLayout.ts` — `layoutGraph(graph, options)` is a custom tree band layout, no d3. x comes from `column`. Vertically, every node owns a band reserved for its whole subtree: same-signed children are stacked beside it (bar and stack centered in the band), opposite-signed children are stacked beside the lane to the parent, on the side facing away from the parent's bar, as dictated by the node's `align` from `buildGraph` (`bottom`: lane at the bottom of the band, opposite children above; `top`: lane on top). Sibling bands never overlap, YAML order is top-to-bottom. The value scale `ky` is found by bisection so the center's band fills the available height; `leafRows` sizes that height beforehand. Lanes attach to bars in child order with the parent lane first or last per `laneLast`. A lane spanning several columns runs straight at its band height and bends only in the gap next to the parent (`bend`), where no subtree can be. `linkPath` renders lanes as filled shapes between two bezier edges (not stroked center lines), so neighbouring lanes tile exactly even at steep bends. `src/components/SankeyDiagram.vue` renders the result as SVG (ResizeObserver for width, hover highlighting, income labels right of the bar, expense labels left of it).

**Amount normalization.** Non-YAML literals like `1.234,56` are parsed leniently via `coerceAmount` so the diagram stays live. `normalizeAmounts(text, cursor)` rewrites every amount literal to `formatYamlAmount` form (integers bare, other numbers with at least `_settings.currency.decimals` digits) except on the cursor's line, and returns the shifted caret; `App.vue` runs it on every cursor move, on blur, and after import.

**Editor ↔ diagram linking.** The parser walks the `yaml` AST (not `toJS`) so every `Category` carries source offsets: `range` (key through last child), `keyRange`, and `valueRange` (the amount literal, also for `_settings.value`). `categoryAt(doc, offset)` maps the editor cursor to the deepest category, which `App.vue` passes to the diagram as `highlighted`; clicking a node or its flow emits `select` with the category path, and `App.vue` selects its `valueRange` (or `keyRange`) in the textarea via the editor's exposed `select()`. Each `GraphLink` carries `node`, the child endpoint it belongs to, so flows hover and click like their category.

**Colors** (`src/colors.ts`): top-level categories take the fixed eight-color categorical palette in YAML order; subcategories are derived with CSS relative color syntax (`oklch(from …)`), getting lighter per depth and fanning out in hue among siblings. Colors are therefore CSS strings, not hex, and are applied via `style` bindings.

## Conventions

- Pure logic (`yamlFormat`, `sankeyGraph`, `sankeyLayout`, `model`, `colors`, `format`) stays free of Vue/DOM so it is testable under vitest's `node` environment; tests live next to the source as `*.test.ts`.
- `tsconfig.app.json` uses `erasableSyntaxOnly`: no enums, no parameter properties.
