// End-to-end tests of the main user journeys, in a real browser against a production build.
import { expect, test } from "@playwright/test";

import {
  EMPTY_SPOT,
  clearBoard,
  clickAt,
  drag,
  drawRectangle,
  layers,
  openEditor,
  pickShape,
} from "./helpers";

const widthField = "#width";

test.beforeEach(async ({ page }) => {
  await openEditor(page);
  await clearBoard(page);
});

// The shapes menu used to stay open and swallow the first drag on the canvas.
test("draws a shape with the first drag after picking it", async ({ page }) => {
  await drawRectangle(page, [400, 200], [600, 400]);

  await expect(layers(page)).toHaveText(["Rectangle"]);
  await expect(page.getByRole("menu")).toHaveCount(0);
});

// Every mouse move used to be an undo step, so one shape needed many undos.
test("undoes a drawn shape in one step and redoes it", async ({ page }) => {
  await drawRectangle(page, [400, 200], [600, 400]);

  await page.keyboard.press("Control+z");
  await expect(layers(page)).toHaveCount(0);

  await page.keyboard.press("Control+Shift+z");
  await expect(layers(page)).toHaveCount(1);
});

// The drawing mode used to start too late for the first stroke.
test("draws the first freeform stroke", async ({ page }) => {
  await pickShape(page, "Free Drawing");
  await drag(page, [500, 300], [600, 400]);

  await expect(layers(page)).toHaveText(["Free Drawing"]);
});

// The design panel has to describe the selection at all times.
test("keeps the panel in sync with the selection", async ({ page }) => {
  await drawRectangle(page, [300, 150], [400, 250]);
  await pickShape(page, "Circle");
  await drag(page, [600, 150], [660, 150]);
  await expect(layers(page)).toHaveText(["Rectangle", "Circle"]);

  await clickAt(page, [350, 200]);
  await expect(page.locator(widthField)).toHaveValue("100");

  await clickAt(page, [630, 180]);
  await expect(page.locator(widthField)).toHaveValue("60");

  await clickAt(page, EMPTY_SPOT);
  await expect(page.locator(widthField)).toHaveValue("");
});

// Moving used to drop the selection, so the next edit from the panel did nothing.
test("edits a shape from the panel after moving it", async ({ page }) => {
  await drawRectangle(page, [300, 150], [400, 250]);
  await clickAt(page, [350, 200]);
  await drag(page, [350, 200], [380, 230]);

  await page.locator(widthField).fill("222");
  await clickAt(page, EMPTY_SPOT);
  await clickAt(page, [390, 240]);

  await expect(page.locator(widthField)).toHaveValue("222");
});

// "/" and "e" used to open the chat and the reactions, losing the text being typed.
test("types shortcut keys into a text", async ({ page }) => {
  await page.locator('nav img[alt="Text"]').click();
  await clickAt(page, [500, 300]);
  await page.mouse.dblclick(520, 315);
  await page.keyboard.press("Control+a");
  await page.keyboard.type("hey/e");

  await expect(page.getByPlaceholder("Type a message...")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "🔥" })).toHaveCount(0);
});

// Moving several shapes used to be left out of storage. This is the only test that
// needs a reload: it can lose a recent change in Liveblocks, hence the retries in CI.
test("keeps a multiple selection move after reloading", async ({ page }) => {
  await drawRectangle(page, [300, 150], [380, 230]);
  await drawRectangle(page, [450, 150], [530, 230]);
  await drag(page, [250, 100], [600, 300]);
  await drag(page, [340, 190], [340, 500]);
  await page.waitForTimeout(2000);

  await openEditor(page);

  await clickAt(page, [340, 500]);
  await expect(page.locator(widthField)).toHaveValue("80");
  await clickAt(page, EMPTY_SPOT);
  await clickAt(page, [340, 190]);
  await expect(page.locator(widthField)).toHaveValue("");
});

// The whole point of the app: what one user does reaches the others.
test("shows the changes of one user to another", async ({ page, browser }) => {
  const otherContext = await browser.newContext({ viewport: { width: 1400, height: 850 } });
  const otherPage = await otherContext.newPage();
  await openEditor(otherPage);

  await drawRectangle(page, [300, 150], [400, 250]);

  await expect(layers(otherPage)).toHaveText(["Rectangle"]);
  await otherContext.close();
});

// A slash used to be blocked in comments, and new threads could show up closed.
test("creates a comment with a slash and leaves it open", async ({ page }) => {
  await page.locator('nav img[alt="Comments"]').click();
  await clickAt(page, [700, 300]);
  const composer = page.locator(".lb-composer-editor").first();
  await composer.click();
  await page.keyboard.type("hello e/x");
  await expect(composer).toHaveText("hello e/x");

  await page.keyboard.press("Enter");

  await expect(page.locator("[id^=thread-] .lb-comment-body").last()).toHaveText("hello e/x");
});

// A missing break used to run undo after opening the reactions.
test("opens reactions from the context menu without undoing", async ({ page }) => {
  await drawRectangle(page, [300, 150], [380, 230]);

  await page.mouse.click(700, 500, { button: "right" });
  await page.getByRole("menuitem", { name: "Reactions" }).click();

  await expect(page.getByRole("button", { name: "🔥" })).toBeVisible();
  await expect(layers(page)).toHaveCount(1);
});

// Reset affects everyone in the room, so canceling it must keep the board.
test("keeps the shapes when canceling a reset", async ({ page }) => {
  await drawRectangle(page, [300, 150], [380, 230]);

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator('nav img[alt="Reset"]').click();

  await expect(layers(page)).toHaveCount(1);
});

// The final design has to reach the user as a file.
test("exports the canvas to a PDF", async ({ page }) => {
  await drawRectangle(page, [300, 150], [380, 230]);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export to PDF" }).click();

  expect((await download).suggestedFilename()).toBe("canvas.pdf");
});
