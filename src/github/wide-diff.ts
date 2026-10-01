import { isPullRequestDiff } from "./route"

export const WIDE_ATTRIBUTE = "data-github-diff-wide"
const TABLE_SELECTOR = "table[data-diff-anchor]"

/** Read GitHub's file status, never infer "added" from an addition-only hunk. */
function addedAnchors(root: ParentNode): Set<string> {
  const anchors = new Set<string>()
  for (const icon of root.querySelectorAll(
    '[role="tree"] .octicon-file-added, [role="tree"] .octicon-diff-added',
  )) {
    const item = icon.closest('[role="treeitem"]')
    const link = item?.querySelector('a[href^="#diff-"]')
    if (link?.closest('[role="treeitem"]') !== item) continue
    const href = link?.getAttribute("href")
    if (href) anchors.add(href.slice(1))
  }
  return anchors
}

function hasEmptyLeftSide(table: HTMLTableElement): boolean {
  // Four physical columns distinguish Split from Unified, independent of URL settings.
  if (table.querySelectorAll(":scope > colgroup > col").length !== 4)
    return false
  if (table.parentElement?.closest("table")) return false

  let hasAddition = false
  for (const body of table.tBodies) {
    for (const row of body.rows) {
      const [leftNumber, leftCode, rightNumber, rightCode] = row.cells
      if (row.cells.length === 4) {
        const legacy =
          table.classList.contains("js-file-diff-split") &&
          leftNumber?.matches(".blob-num-empty") &&
          leftCode?.matches(".blob-code-empty") &&
          rightNumber?.matches(".blob-num-addition") &&
          rightCode?.matches('.blob-code-addition[data-split-side="right"]')
        const react =
          row.classList.contains("diff-line-row") &&
          leftNumber?.matches(".empty-diff-line") &&
          leftCode?.matches(".empty-diff-line") &&
          // Current PRs expose line metadata instead of the old number-cell class.
          rightNumber?.matches(
            '.diff-line-number, [data-diff-side="right"][data-line-number]',
          ) &&
          rightCode?.querySelector(":scope > code.diff-text.addition")
        if (
          !(legacy || react) ||
          leftNumber?.textContent?.trim() ||
          leftCode?.textContent?.trim()
        )
          return false
        hasAddition = true
      } else if (row.cells.length === 2 && leftNumber?.colSpan === 2) {
        // Split comments/annotations must not contain an old-side conversation.
        if (
          leftCode?.colSpan !== 2 ||
          leftNumber.textContent?.trim() ||
          leftNumber.querySelector("a, button, input, textarea, [tabindex]")
        )
          return false
      } else if (
        !(row.cells.length === 1 && leftNumber?.colSpan === 4) &&
        !(
          row.cells.length === 2 &&
          leftCode?.matches(".blob-code-hunk[colspan='3']")
        )
      ) {
        // Unknown layouts are left intact instead of hiding potentially useful content.
        return false
      }
    }
  }
  return hasAddition
}

export function reconcileWideDiff(root: ParentNode): void {
  const added = addedAnchors(root)
  for (const table of root.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR)) {
    const wide =
      added.has(table.getAttribute("data-diff-anchor") ?? "") &&
      hasEmptyLeftSide(table)
    if (wide) {
      if (!table.hasAttribute(WIDE_ATTRIBUTE))
        table.setAttribute(WIDE_ATTRIBUTE, "")
    } else {
      table.removeAttribute(WIDE_ATTRIBUTE)
    }
  }
}

/** Coalesce GitHub's streaming/virtualized DOM updates; keep all native nodes intact. */
export function watchWideDiff(doc: Document, initialUrl: URL) {
  const win = doc.defaultView!
  let frame: number | undefined
  let route = ""
  let active = false
  let stopped = false

  const observer = new MutationObserver(() => {
    if (!active || frame !== undefined) return
    frame = win.requestAnimationFrame(() => {
      frame = undefined
      if (active) reconcileWideDiff(doc)
    })
  })

  function clear() {
    active = false
    observer.disconnect()
    if (frame !== undefined) win.cancelAnimationFrame(frame)
    frame = undefined
    for (const table of doc.querySelectorAll(`[${WIDE_ATTRIBUTE}]`)) {
      table.removeAttribute(WIDE_ATTRIBUTE)
    }
  }

  function setUrl(url: URL) {
    const nextRoute = `${url.origin}${url.pathname}${url.search}`
    if (stopped || nextRoute === route) return
    route = nextRoute
    clear()
    if (!isPullRequestDiff(url)) return
    active = true
    observer.observe(doc.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      // Our own marker is deliberately absent, so reconciliation cannot loop.
      attributeFilter: [
        "class",
        "role",
        "href",
        "data-diff-anchor",
        "colspan",
        "data-diff-side",
        "data-line-number",
      ],
    })
    reconcileWideDiff(doc)
  }

  setUrl(initialUrl)
  return {
    setUrl,
    stop() {
      stopped = true
      clear()
    },
  }
}
