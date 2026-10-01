import { defineContentScript } from "wxt/utils/define-content-script"
import { watchWideDiff } from "../../github/wide-diff"
// oxlint-disable-next-line import/no-unassigned-import -- WXT extracts page CSS.
import "./style.css"

export default defineContentScript({
  // GitHub can navigate from a non-PR page without loading a new document.
  matches: ["https://github.com/*"],
  runAt: "document_idle",
  main(ctx) {
    const controller = watchWideDiff(document, new URL(location.href))
    ctx.addEventListener(window, "wxt:locationchange", ({ newUrl }) => {
      controller.setUrl(newUrl)
    })
    ctx.onInvalidated(() => controller.stop())
  },
})
