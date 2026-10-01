# Verification ledger

Version **0.1.1 fixes the reported new-PR failure**, verified on the authenticated `rename-ja` PR #1. The full review contract remains **NOT PASSED** because tree-entry availability and the unchecked scenarios below remain open. No comments or reviews were submitted. The temporary Viewed and layout changes were restored to their original states.

## Accepted scope

- Automatically expand only explicitly added text files in Split view on github.com PR Files changed/changes.
- Leave modified, deleted, renamed files, Unified view, commit pages, and Compare alone.
- Keep native code, line-number, comment, and Viewed controls intact.
- Local unpacked Chrome extension; no store publication, popup, preferences, API requests, or backend.

## DOM evidence

Initial signed-out inspection used `pnpm dlx agent-browser@0.38.1`. Authenticated inspection uses the already-installed 0.38.1 runtime directly, with an isolated profile:

1. [Added files in github-actions-explorer PR 14](https://github.com/tomatoaiu/github-actions-explorer/pull/14/files?diff=split): signed-out legacy PR renderer. Eight added text files. Status comes from `.octicon-diff-added` inside a file-tree item linked to `#diff-…`; tables have `data-diff-anchor`, four columns, and `.js-file-diff-split`.
2. [Modified files in github-review-kaomoji PR 1](https://github.com/tomatoaiu/github-review-kaomoji/pull/1/files?diff=split): five modified files, not eligible.
3. [React commit renderer](https://github.com/tomatoaiu/github-actions-explorer/commit/75c5da913216e61aae1ed21183c33cad178d6f2b?diff=split): observed `.octicon-file-added` file-tree entries, `table[data-diff-anchor]`, four-column `colgroup`, `.diff-line-row`, `.empty-diff-line`, `.diff-line-number`, and `code.diff-text.addition`.

4. [Authenticated rename-ja PR 1](https://github.com/tomatoaiu/rename-ja/pull/1/changes): the actual new PR renderer uses `.new-diff-line-number` with `data-diff-side="right"` and `data-line-number`; it does not use the older `.diff-line-number` class. `test/fixtures/react-pr-split.html` preserves this observed structure, with abbreviated anchors and synthetic review controls.

Initially, signed-out `/changes` requests redirected to the legacy `/files` view. The user subsequently signed in to the dedicated test profile, allowing direct inspection of the failing new PR page. The earlier React commit fixture did not reproduce this PR-specific structure and therefore missed the bug.

The reduced HTML fixtures preserve these observed selectors and table structures. Their review controls and comment rows are synthetic, explicitly marked in the fixture and browser tests. They do not reproduce GitHub's review state machine.

[Refined GitHub's related feature](https://github.com/refined-github/refined-github/blob/main/source/features/no-unnecessary-split-diff-view.tsx) also identifies the React four-column table and direct addition/deletion cells. This implementation is narrower: it requires an explicit added-file status instead of inferring status from visible hunks. Its layout rules were written independently to retain all four physical columns.

## Automated evidence

```bash
pnpm exec wxt prepare
pnpm test
pnpm build
CHROMIUM_PATH=/path/to/chrome pnpm test:browser
```

- `pnpm check` passed: formatting, lint, TypeScript, 65 unit tests, production build, and 12 loaded-extension browser tests.
- Unit tests cover routes, mixed file statuses, addition-only existing files, unknown structures, Unified mode, nested suggestions, old-side comments (including text-node-only updates), idempotence, lazy mounting, in-place status changes, navigation, and cleanup.
- Browser tests load the actual MV3 build, rather than manually injecting the implementation. All three fixture renderers reach zero-width left columns, preserve the right gutter, and give right-side comments the full table width.
- Browser tests exercise existing event handlers for synthetic comment drafts, Viewed checkboxes, collapse/reopen, responsive width, status changes, and same-document navigation.
- Production manifest has only the github.com content script; no additional permissions, service worker, or externally connectable resources.

## Live observations

With the unpacked production build loaded through `agent-browser --extension`:

| Check                                    | Observation                                                                                                                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Added PR files, Split                    | All 8 widened. At a 1440px viewport, code cells grew from 491px to 1003px; both left cells became 0px. Gutter remained visible.                                                                                                                                |
| Added PR files, Unified                  | 0 of 8 tables marked.                                                                                                                                                                                                                                          |
| Modified PR files, Split                 | 0 of 5 tables marked.                                                                                                                                                                                                                                          |
| Public React commit page                 | 0 of 8 tables marked, as required by route scope.                                                                                                                                                                                                              |
| Public React DOM with a simulated PR URL | A temporary `history.replaceState` enabled the PR-only controller on the existing public commit DOM. All 8 tables measured `[0, 0, 40, 1503]` column widths. This isolates compatibility with the renderer's real CSS; it is **not an authenticated PR test**. |

The public legacy PR's native line-number click set the correct `#diff-…R2` anchor while all 8 files remained expanded. Native collapse/reopen changed the first table's visibility `true → false → true` without removing its expansion marker.

Local, ignored artifacts: `artifacts/before.png`, `artifacts/after.png`, and `artifacts/{before,after,live-checks,native-controls}.log`.
The screenshots show the real public PR, not a mock.

## Authenticated new PR verification for 0.1.1

The reported page contains four added files and one modified `README.md`. Before the fix, none widened. Temporarily adding only the old `.diff-line-number` class made exactly the four added files widen; removing it returned the count to zero. This isolated the failing predicate without changing file status or layout settings.

The captured PR fixture failed both unit and loaded-extension browser regression tests on 0.1.0. Version 0.1.1 recognizes the new right-side line metadata while retaining the old renderer's class fallback. Changes to those metadata attributes are also observed.

After rebuilding and restarting the dedicated browser with the same signed-in profile:

| Native operation                                       | Observed result                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Split view on the actual `/changes` URL                | Four added files widened: column widths changed from `[40, 665, 40, 665]` to `[0, 0, 40, 1370]` in a 1410px table.                               |
| Modified `README.md`                                   | Kept `[40, 665, 40, 665]`; no expansion marker.                                                                                                  |
| Split → Unified → Split through GitHub's settings menu | Marker counts `4 → 0 → 4`, with column counts `4 → 3 → 4`.                                                                                       |
| Click native right-side line number 1                  | Set the correct `#diff-…R1` hash and retained all four expanded files.                                                                           |
| ArrowRight → ArrowDown → ArrowLeft                     | Focus moved from right number 1 to right code 1, right code 2, then right number 2, using GitHub's original grid cell IDs.                       |
| Hover code → Add comment                               | Opened GitHub's real empty comment editor on the selected line. The code table remained expanded. Cancel removed the editor; nothing was posted. |
| Collapse → reopen first file                           | Visibility changed `true → false → true`; expansion returned.                                                                                    |
| Viewed → Not Viewed                                    | Native `aria-pressed` changed to true and back to false; the original `0 / 5 viewed` state was restored.                                         |

Screenshots: `artifacts/new-pr-before.png`, `artifacts/new-pr-after.png`, and `artifacts/new-pr-comment-draft.png`. These are from the authenticated page, not a simulated URL or injected layout. The test profile is under `artifacts/new-pr-profile/`, which is excluded by `.gitignore`. The fixtures and verification records contain no authentication data.

## Verification browser connectivity

Launching an interactive browser through this environment's `pnpm dlx` inherited the package manager's temporary local proxy. Chrome retained the proxy address after its listener exited, causing the reported No Internet pages. Running the already-acquired agent-browser executable directly removed that runtime dependency without changing package-manager security policy, OS proxy settings, or the user's ordinary Chrome profile. A later navigation and a fresh browser fetch to GitHub's `robots.txt` succeeded with HTTP 200 after the launch command had exited.

## Independent review follow-up

- Reproduced a stale marker when a tree's `role` changed without replacing nodes. Added `role` to the observed attributes and a passing lifecycle regression test.
- Aligned zero-padding CSS with the exact accepted legacy cell classes and generic empty comment cells, rather than requiring the extra `.empty-cell` presentation class. Width-only tests already passed without that class; the strengthened tests also assert zero left-cell padding.
- Added mixed-file unit coverage and a regression for old-side text-node updates; the observer now watches `characterData` as well.
- The reported authenticated new-PR failure is now reproduced and fixed using both captured-DOM tests and the real page. Tree-entry availability and the remaining scenarios below are still open.

## Known limitation

Status is read from currently mounted file-tree entries. If a collapsed folder, hidden tree, or virtualization removes an entry from the DOM, its table stays unmodified (or returns to normal width). The prototype deliberately does not cache statuses across render/navigation changes, which could incorrectly classify a modified file under a different commit range. Show the tree and expand the containing folder to supply the status evidence.

## Remaining gate before PASSED

On an authenticated Chrome profile, load `.output/chrome-mv3` and verify a PR in the new Files changed UI:

- [x] The reported mixed PR expands only its four genuinely added text files.
- [x] Split → Unified → Split restores the expected widths through native controls.
- [x] A line-number link and basic arrow-key navigation retain the correct right-side anchors and cells.
- [x] A real empty inline comment editor opens and cancels while the code remains expanded.
- [x] Native Viewed and collapse/reopen controls remain usable; test changes were restored.
- [ ] Existing and resolved threads, suggestions, and side-by-side comment layouts need additional real-page coverage.
- [ ] Multi-line selection, commit-range changes, no-newline markers, and large virtualized diffs need additional real-page coverage.
- [ ] Tree entries removed by collapse/hiding/virtualization must not prevent expansion before the full unconditional behavior can be claimed.

If GitHub changes the markup, capture a reduced fixture and add a targeted regression test before changing selectors. Do not treat green synthetic tests as a substitute for these authenticated checks.
