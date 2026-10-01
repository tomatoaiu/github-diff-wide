import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { chromium, expect, test } from "@playwright/test"
import type { BrowserContext, Page } from "@playwright/test"

const extension = resolve(".output/chrome-mv3")
const marker = "data-github-diff-wide"
const tableSelector = "table[data-diff-anchor]"
let context: BrowserContext
let profile: string
let page: Page

// The fixtures use observed GitHub table structures. Review controls are simulated:
// these tests prove layout and node/handler preservation, not GitHub's server behavior.
function html(fixture: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 24px; font-family: sans-serif; }
    header { display: flex; align-items: center; gap: 16px; }
    table[data-diff-anchor] { width: 100%; table-layout: fixed; border-collapse: collapse; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
    td { padding: 4px; vertical-align: top; }
    .diff-line-number, .new-diff-line-number, .blob-num { min-width: 40px; }
    .blob-num::before { content: attr(data-line-number); }
    .empty-cell, .empty-diff-line { background: #eee; border-right: 1px solid #ccc; }
    .diff-text-cell, .blob-code-addition { background: #dafbe1; }
    .diff-text-inner { display: inline; }
    .comment { border: 1px solid #aaa; padding: 16px; }
    .add-comment { float: right; }
  </style></head><body>${fixture}<script>
    window.nativeTable = document.querySelector('table[data-diff-anchor]');
    document.querySelector('.add-comment').addEventListener('click', () => {
      const input = document.createElement('textarea'); input.setAttribute('aria-label', 'Comment');
      document.querySelector('.comment').append(input); input.focus();
    });
    document.querySelector('[aria-label="Collapse file"]').addEventListener('click', () => {
      window.nativeTable.hidden = !window.nativeTable.hidden;
    });
  </script></body></html>`
}

test.beforeAll(async () => {
  profile = await mkdtemp(resolve(tmpdir(), "github-diff-wide-test-"))
  context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1280, height: 900 },
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  })
})
test.afterAll(async () => {
  await context?.close()
  if (profile) await rm(profile, { recursive: true, force: true })
})
test.beforeEach(async () => {
  page = await context.newPage()
})
test.afterEach(async () => {
  await page.close()
})

async function mount(
  renderer: string,
  path = "/owner/repo/pull/1/changes?diff=split",
) {
  const fixture = await readFile(
    resolve(`test/fixtures/${renderer}-split.html`),
    "utf8",
  )
  await page.route("https://github.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: html(fixture) }),
  )
  await page.goto(`https://github.com${path}`)
}

async function geometry() {
  return page.locator(tableSelector).evaluate((table) => {
    const row = table.querySelectorAll(
      ":scope > tbody > tr",
    )[1] as HTMLTableRowElement
    return {
      table: table.getBoundingClientRect().width,
      cells: [...row.cells].map((cell) => cell.getBoundingClientRect().width),
      comment: table
        .querySelector(".review-thread > td:last-child")!
        .getBoundingClientRect().width,
    }
  })
}

for (const renderer of ["react", "react-pr", "legacy"]) {
  test(`${renderer}: real MV3 content script expands only the empty columns`, async () => {
    await mount(renderer)
    const table = page.locator(tableSelector)
    await expect(table).toHaveAttribute(marker, "")
    const sizes = await geometry()
    expect(sizes.cells[0]).toBeLessThanOrEqual(1)
    expect(sizes.cells[1]).toBeLessThanOrEqual(1)
    expect(sizes.cells[2]).toBeCloseTo(40, 0)
    expect(sizes.cells[3]).toBeGreaterThan(sizes.table * 0.9)
    expect(sizes.comment).toBeCloseTo(sizes.table, 0)
    expect(
      await page.evaluate(
        () =>
          (window as Window & { nativeTable?: Element }).nativeTable ===
          document.querySelector("table[data-diff-anchor]"),
      ),
    ).toBe(true)

    await page.getByRole("checkbox", { name: "Viewed" }).check()
    await expect(page.getByRole("checkbox", { name: "Viewed" })).toBeChecked()
    await page.getByRole("button", { name: "Add comment to line 1" }).click()
    await page
      .getByRole("textbox", { name: "Comment" })
      .fill("Draft remains editable")
    await expect(page.getByRole("textbox", { name: "Comment" })).toHaveValue(
      "Draft remains editable",
    )
    await expect(table).toHaveAttribute(marker, "")
    await page.getByRole("button", { name: "Collapse file" }).click()
    await expect(table).toBeHidden()
    await page.getByRole("button", { name: "Collapse file" }).click()
    await expect(table).toBeVisible()

    await page.setViewportSize({ width: 700, height: 800 })
    const narrow = await geometry()
    expect(narrow.cells[3]).toBeGreaterThan(narrow.table * 0.9)
  })

  test(`${renderer}: eligible empty cells need no extra presentation classes`, async () => {
    await mount(renderer)
    await expect(page.locator(tableSelector)).toHaveAttribute(marker, "")
    await page.locator(tableSelector).evaluate((table) => {
      for (const cell of table.querySelectorAll(".empty-cell")) {
        cell.classList.remove("empty-cell")
      }
      table
        .querySelector(".review-thread > td:first-child")!
        .removeAttribute("class")
    })
    await expect(page.locator(tableSelector)).toHaveAttribute(marker, "")
    const sizes = await geometry()
    expect(sizes.cells[0]).toBeLessThanOrEqual(1)
    expect(sizes.cells[1]).toBeLessThanOrEqual(1)
    expect(sizes.comment).toBeCloseTo(sizes.table, 0)
    const emptyCellPadding = await page
      .locator(tableSelector)
      .evaluate((table) => {
        const cells = [
          table.querySelector(":scope > tbody > tr:nth-child(2) > td"),
          table.querySelector(".review-thread > td:first-child"),
        ]
        return cells.map((cell) => getComputedStyle(cell!).paddingLeft)
      })
    expect(emptyCellPadding).toEqual(["0px", "0px"])
  })

  test(`${renderer}: untouched files and route changes restore normal split widths`, async () => {
    await mount(renderer)
    const table = page.locator(tableSelector)
    await expect(table).toHaveAttribute(marker, "")
    // Each mutation must settle before measuring the same live table again.
    /* oxlint-disable no-await-in-loop */
    for (const icon of ["file-diff", "file-removed", "file-moved"]) {
      await page
        .locator("svg")
        .evaluate(
          (svg, name) => svg.setAttribute("class", `octicon octicon-${name}`),
          icon,
        )
      await expect(table).not.toHaveAttribute(marker, "")
      const sizes = await geometry()
      expect(sizes.cells[1]).toBeGreaterThan(sizes.table * 0.4)
      expect(sizes.cells[3]).toBeLessThan(sizes.table * 0.55)
    }
    /* oxlint-enable no-await-in-loop */
    await page
      .locator("svg")
      .evaluate((svg) =>
        svg.setAttribute("class", "octicon octicon-file-added"),
      )
    await expect(table).toHaveAttribute(marker, "")
    await page.evaluate(() =>
      history.pushState({}, "", "/owner/repo/commit/abcdef1"),
    )
    await expect(table).not.toHaveAttribute(marker, "")
    await page.evaluate(() =>
      history.pushState({}, "", "/owner/repo/pull/2/changes"),
    )
    await expect(table).toHaveAttribute(marker, "")
  })

  test(`${renderer}: new document outside PR diffs is never changed`, async () => {
    await mount(renderer, "/owner/repo/compare/main...feature?diff=split")
    await expect(page.locator(tableSelector)).not.toHaveAttribute(marker, "")
    // Wait for WXT's location watcher, rather than passing before its first run.
    await page.evaluate(() =>
      history.pushState({}, "", "/owner/repo/pull/1/files"),
    )
    await expect(page.locator(tableSelector)).toHaveAttribute(marker, "")
  })
}
