export function isPullRequestDiff(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    url.hostname === "github.com" &&
    /^\/[^/]+\/[^/]+\/pull\/[1-9]\d*\/(?:files|changes)(?:\/[a-f0-9]{7,40}(?:\.\.[a-f0-9]{7,40})?)?\/?$/.test(
      url.pathname,
    )
  )
}
