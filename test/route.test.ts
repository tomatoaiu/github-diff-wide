import { describe, expect, it } from "vitest"
import { isPullRequestDiff } from "../src/github/route"

describe("PR diff route", () => {
  it.each([
    "https://github.com/owner/repo/pull/1/files",
    "https://github.com/owner/repo/pull/123/changes?diff=split#diff-addedR1",
    "https://github.com/owner/repo/pull/1/files/abcdef1",
    "https://github.com/owner/repo/pull/1/changes/abcdef1..abcdef2",
    "https://github.com/owner/repo/pull/1/files/?diff=unified",
  ])("accepts %s (the DOM determines split mode)", (url) => {
    expect(isPullRequestDiff(new URL(url))).toBe(true)
  })
  it.each([
    "https://github.com/owner/repo",
    "https://github.com/owner/repo/pull/1",
    "https://github.com/owner/repo/pull/1/commits",
    "https://github.com/owner/repo/commit/abcdef1",
    "https://github.com/owner/repo/compare/main...feature",
    "https://github.com/owner/repo/pull/1/files/anything",
    "https://github.example.com/owner/repo/pull/1/files",
    "https://github.com.evil.example/owner/repo/pull/1/files",
    "http://github.com/owner/repo/pull/1/files",
  ])("rejects %s", (url) => {
    expect(isPullRequestDiff(new URL(url))).toBe(false)
  })
})
