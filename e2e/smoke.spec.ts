// Read-only check of a live deployment. It runs on the real canvas, so it must never change anything.
import { expect, test } from "@playwright/test";

import { openEditor } from "./helpers";

// A deployment can build fine and still crash in the browser or fail to reach Liveblocks.
test("loads the editor without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openEditor(page);

  await expect(page.getByRole("button", { name: "Export to PDF" })).toBeVisible();
  expect(errors).toEqual([]);
});
