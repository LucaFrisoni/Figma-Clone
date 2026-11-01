// Shared actions for the browser tests, written the way a user drives the editor.
import { Page, expect } from "@playwright/test";

type Point = [number, number];

export const EMPTY_SPOT: Point = [1100, 780];

export const layers = (page: Page) => page.locator("section h3.text-sm");

export const openEditor = async (page: Page) => {
  await page.goto("/");
  await page.locator("canvas.upper-canvas").waitFor();
  await expect(page.getByRole("heading", { name: "Layers" })).toBeVisible();
  // the shapes arrive right after the canvas
  await page.waitForTimeout(800);
};

export const clearBoard = async (page: Page) => {
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('nav img[alt="Reset"]').click();
  await expect(layers(page)).toHaveCount(0);
};

export const pickShape = async (page: Page, name: string) => {
  await page.locator("nav li").nth(1).locator("button").first().click();
  await page.getByRole("menuitem", { name }).click();

  // the page takes a moment to accept input again once the menu closes, faster than a person can react
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.waitForTimeout(250);
};

export const drag = async (page: Page, from: Point, to: Point) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
};

export const clickAt = async (page: Page, point: Point) => {
  await page.mouse.click(...point);
  await page.waitForTimeout(200);
};

export const drawRectangle = async (page: Page, from: Point, to: Point) => {
  await pickShape(page, "Rectangle");
  await drag(page, from, to);
};
