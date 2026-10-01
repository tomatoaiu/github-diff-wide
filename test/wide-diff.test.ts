import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  reconcileWideDiff,
  watchWideDiff,
  WIDE_ATTRIBUTE,
} from "../src/github/wide-diff"

const fixtures = {
  react: readFileSync(resolve("test/fixtures/react-split.html"), "utf8"),
  "react-pr": readFileSync(
    resolve("test/fixtures/react-pr-split.html"),
    "utf8",
  ),
  legacy: readFileSync(resolve("test/fixtures/legacy-split.html"), "utf8"),
}
const url = new URL("https://github.com/owner/repo/pull/1/files?diff=split")
const mainTable = () =>
  document.querySelector<HTMLTableElement>("table[data-diff-anchor]")!
const isWide = () => mainTable().hasAttribute(WIDE_ATTRIBUTE)

async function flush() {
  await Promise.resolve()
  vi.advanceTimersByTime(30)
  await Promise.resolve()
}

for (const [renderer, fixture] of Object.entries(fixtures)) {
  describe(`${renderer}`, () => {
    beforeEach(() => {
      document.body.innerHTML = fixture
    })
    afterEach(() => {
      document.body.replaceChildren()
    })

    it("widens an explicitly added split file without replacing native nodes", () => {
      const table = mainTable()
      const rows = [...table.rows]
      const markup = table.innerHTML
      reconcileWideDiff(document)
      expect(isWide()).toBe(true)
      expect(mainTable()).toBe(table)
      expect([...table.rows]).toEqual(rows)
      expect(table.innerHTML).toBe(markup)
      expect(
        document.querySelector(".suggestion")!.hasAttribute(WIDE_ATTRIBUTE),
      ).toBe(false)
    })

    it.each(["file-diff", "file-removed", "file-moved", "file"])(
      "does not mistake %s / addition-only changes to an existing file for a new file",
      (icon) => {
        document
          .querySelector("svg")!
          .setAttribute("class", `octicon octicon-${icon}`)
        reconcileWideDiff(document)
        expect(isWide()).toBe(false)
      },
    )

    it("widens only the added file in a mixed PR", () => {
      const other = mainTable().cloneNode(true) as HTMLTableElement
      other.setAttribute("data-diff-anchor", "diff-modified")
      document.body.append(other)
      const item = document.createElement("li")
      item.setAttribute("role", "treeitem")
      item.innerHTML =
        '<svg class="octicon-file-diff"></svg><a href="#diff-modified">existing.ts</a>'
      document.querySelector('[role="tree"]')!.append(item)
      reconcileWideDiff(document)
      expect(isWide()).toBe(true)
      expect(other.hasAttribute(WIDE_ATTRIBUTE)).toBe(false)
    })

    it("fails closed when status is missing, even for a -0,0 hunk", () => {
      document.querySelector("nav")!.remove()
      reconcileWideDiff(document)
      expect(isWide()).toBe(false)
    })

    it("does not associate a nested directory's icon with its first file", () => {
      const tree = document.querySelector('[role="tree"]')!
      tree.innerHTML =
        '<li role="treeitem"><svg class="octicon-file-added"></svg><ul><li role="treeitem"><a href="#diff-added">modified.ts</a></li></ul></li>'
      reconcileWideDiff(document)
      expect(isWide()).toBe(false)
    })

    it("leaves Unified view unchanged and clears a previous marker", () => {
      reconcileWideDiff(document)
      mainTable().querySelector("col")!.remove()
      reconcileWideDiff(document)
      expect(isWide()).toBe(false)
    })

    it("preserves old-side content or review threads", () => {
      mainTable().querySelector(".review-thread td")!.textContent =
        "Old-side conversation"
      reconcileWideDiff(document)
      expect(isWide()).toBe(false)
    })

    it("does not expand an unknown four-cell layout", () => {
      mainTable().tBodies[0]!.insertRow().innerHTML =
        "<td>old</td><td>content</td><td>1</td><td>new</td>"
      reconcileWideDiff(document)
      expect(isWide()).toBe(false)
    })

    it("leaves empty/binary files without code rows alone", () => {
      mainTable().tBodies[0]!.replaceChildren()
      reconcileWideDiff(document)
      expect(isWide()).toBe(false)
    })

    it("reconciles idempotently without adding DOM mutations", () => {
      reconcileWideDiff(document)
      const observer = new MutationObserver(() => {})
      observer.observe(mainTable(), {
        attributes: true,
        childList: true,
        subtree: true,
      })
      reconcileWideDiff(document)
      expect(observer.takeRecords()).toEqual([])
      observer.disconnect()
    })
  })
}

describe("current PR line metadata", () => {
  beforeEach(() => {
    document.body.innerHTML = fixtures["react-pr"]
  })
  afterEach(() => {
    document.body.replaceChildren()
  })

  it("identifies right line numbers without depending on their presentation class", () => {
    for (const cell of document.querySelectorAll("td.new-diff-line-number")) {
      cell.classList.remove("new-diff-line-number")
    }
    reconcileWideDiff(document)
    expect(isWide()).toBe(true)
  })

  it.each(["data-diff-side", "data-line-number"])(
    "requires %s for the new number-cell shape",
    (attribute) => {
      document
        .querySelector("td.new-diff-line-number")!
        .removeAttribute(attribute)
      reconcileWideDiff(document)
      expect(isWide()).toBe(false)
    },
  )
})

describe("lifecycle", () => {
  let controller: ReturnType<typeof watchWideDiff> | undefined
  beforeEach(() => {
    document.body.innerHTML = fixtures.react
    vi.useFakeTimers()
  })
  afterEach(() => {
    controller?.stop()
    controller = undefined
    vi.useRealTimers()
    document.body.replaceChildren()
  })
  it("handles entering and leaving a PR diff in one document", () => {
    controller = watchWideDiff(
      document,
      new URL("https://github.com/owner/repo"),
    )
    expect(isWide()).toBe(false)
    controller.setUrl(url)
    expect(isWide()).toBe(true)
    controller.setUrl(new URL("https://github.com/owner/repo/commit/abcdef1"))
    expect(isWide()).toBe(false)
  })

  it("handles lazy-loaded files and re-rendered split/unified tables", async () => {
    document.body.replaceChildren()
    controller = watchWideDiff(document, url)
    document.body.innerHTML = fixtures.react
    await flush()
    expect(isWide()).toBe(true)
    const col = mainTable().querySelector("col")!
    col.remove()
    await flush()
    expect(isWide()).toBe(false)
    mainTable().querySelector("colgroup")!.append(col)
    await flush()
    expect(isWide()).toBe(true)
  })

  it("clears eligibility when the file status changes in place", async () => {
    controller = watchWideDiff(document, url)
    document.querySelector("svg")!.setAttribute("class", "octicon-file-diff")
    await flush()
    expect(isWide()).toBe(false)
  })

  it.each(["data-diff-side", "data-line-number"])(
    "revalidates changed PR line metadata: %s",
    async (attribute) => {
      document.body.innerHTML = fixtures["react-pr"]
      controller = watchWideDiff(
        document,
        new URL("https://github.com/owner/repo/pull/1/changes"),
      )
      expect(isWide()).toBe(true)
      document
        .querySelector("td.new-diff-line-number")!
        .removeAttribute(attribute)
      await flush()
      expect(isWide()).toBe(false)
    },
  )

  it("revalidates status when a tree role changes without replacing nodes", async () => {
    controller = watchWideDiff(document, url)
    document.querySelector('[role="tree"]')!.removeAttribute("role")
    await flush()
    expect(isWide()).toBe(false)
  })

  it("revalidates an old-side comment updated through an existing text node", async () => {
    const text = document.createTextNode("")
    mainTable().querySelector(".review-thread td")!.append(text)
    controller = watchWideDiff(document, url)
    expect(isWide()).toBe(true)
    text.data = "Old-side conversation"
    await flush()
    expect(isWide()).toBe(false)
  })

  it("does not reuse added-file status after navigation", async () => {
    controller = watchWideDiff(document, url)
    controller.setUrl(new URL("https://github.com/owner/repo/pull/2/files"))
    document.querySelector("svg")!.setAttribute("class", "octicon-file-moved")
    await flush()
    expect(isWide()).toBe(false)
  })

  it("cancels queued work and restores presentation when invalidated", async () => {
    controller = watchWideDiff(document, url)
    document.body.append(document.createElement("p"))
    await Promise.resolve()
    controller.stop()
    await flush()
    expect(isWide()).toBe(false)
    controller.setUrl(new URL("https://github.com/owner/repo/pull/2/files"))
    expect(isWide()).toBe(false)
  })
})
