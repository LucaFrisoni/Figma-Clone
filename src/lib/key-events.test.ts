// Regression tests for keyboard shortcuts and copy and paste.
import { fabric } from "fabric";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleCopy, handleKeyDown, handlePaste, isEditableTarget } from "./key-events";

let canvas: fabric.Canvas;

const rect = (left = 100, top = 100, fill = "#ff0000") =>
  new fabric.Rect({ left, top, width: 50, height: 50, fill, objectId: "a" } as any);

// presses a key with the shortcuts of the editor listening, and reports what they called
const press = (init: KeyboardEventInit & { keyCode: number }, target: Element = document.body) => {
  const actions = {
    undo: vi.fn(),
    redo: vi.fn(),
    syncShapesInStorage: vi.fn(),
    deleteSelection: vi.fn(),
  };
  const e = new KeyboardEvent("keydown", { ...init, bubbles: true });

  Object.defineProperty(e, "keyCode", { value: init.keyCode });
  target.addEventListener("keydown", () => handleKeyDown({ e, canvas, ...actions }), { once: true });
  target.dispatchEvent(e);

  return actions;
};

const pasteAndGetShapes = () =>
  new Promise<fabric.Object[]>((resolve) => handlePaste(canvas, resolve));

beforeEach(() => {
  localStorage.clear();
  canvas = new fabric.Canvas(document.createElement("canvas"), { width: 800, height: 600 });
});

afterEach(() => {
  canvas.dispose();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("isEditableTarget", () => {
  // Without this, typing "e" or "/" in a comment or a text triggered editor shortcuts.
  it.each(["input", "textarea", "select"])("recognizes %s elements", (tag) => {
    expect(isEditableTarget(document.createElement(tag))).toBe(true);
  });

  // Comments use a rich editor, and the key may land on a node inside it.
  it("recognizes elements inside a contenteditable", () => {
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    const child = editor.appendChild(document.createElement("span"));

    expect(isEditableTarget(child)).toBe(true);
  });

  // The shortcuts must keep working everywhere else.
  it("does not treat the page as editable", () => {
    expect(isEditableTarget(document.body)).toBe(false);
  });
});

describe("handleKeyDown", () => {
  // Backspace in a size field must edit the number, not delete the shape.
  it("leaves the keys alone inside a field", () => {
    const input = document.body.appendChild(document.createElement("input"));

    const { deleteSelection, undo } = press({ keyCode: 8 }, input);
    press({ keyCode: 90, ctrlKey: true }, input);

    expect(deleteSelection).not.toHaveBeenCalled();
    expect(undo).not.toHaveBeenCalled();
  });

  // Delete and Backspace are the expected way of removing a selection.
  it.each([8, 46])("deletes the selection with key %i", (keyCode) => {
    expect(press({ keyCode }).deleteSelection).toHaveBeenCalledOnce();
  });

  // Ctrl+Shift+Z used to undo, the opposite of what it means everywhere else.
  it("redoes with ctrl+shift+z and undoes with ctrl+z", () => {
    const shifted = press({ keyCode: 90, ctrlKey: true, shiftKey: true });
    const plain = press({ keyCode: 90, ctrlKey: true });

    expect(shifted.redo).toHaveBeenCalledOnce();
    expect(shifted.undo).not.toHaveBeenCalled();
    expect(plain.undo).toHaveBeenCalledOnce();
  });
});

describe("copy and paste", () => {
  // Operator precedence used to drop the offset, hiding the copy behind the original.
  it("pastes next to the original, keeping its color", async () => {
    const original = rect();
    canvas.add(original);
    canvas.setActiveObject(original);
    handleCopy(canvas);

    const [pasted] = await pasteAndGetShapes();

    expect([pasted.left, pasted.top, pasted.fill]).toEqual([120, 120, "#ff0000"]);
    expect(pasted.objectId).not.toBe("a");
  });

  // Each paste needs its own place, or they all stack in one spot.
  it("moves every new paste a bit further", async () => {
    const original = rect();
    canvas.add(original);
    canvas.setActiveObject(original);
    handleCopy(canvas);

    await pasteAndGetShapes();
    const [second] = await pasteAndGetShapes();

    expect(second.left).toBe(140);
  });

  // Paths have no fill: forcing one painted their inside.
  it("does not add a fill to shapes without one", async () => {
    const path = new fabric.Path("M 0 0 L 10 10", { fill: "", objectId: "p" } as any);
    canvas.add(path);
    canvas.setActiveObject(path);
    handleCopy(canvas);

    const [pasted] = await pasteAndGetShapes();

    expect(pasted.fill).toBe("");
  });

  // Inside a selection objects have relative coordinates, which pasted them in the wrong place.
  it("copies a multiple selection with real canvas coordinates", async () => {
    const objects = [rect(100, 100), rect(300, 200)];
    canvas.add(...objects);
    canvas.setActiveObject(new fabric.ActiveSelection(objects, { canvas }));
    handleCopy(canvas);

    const pasted = await pasteAndGetShapes();

    expect(pasted.map((shape) => [shape.left, shape.top])).toEqual([
      [120, 120],
      [320, 220],
    ]);
  });

  // Big images don't fit in localStorage: that used to throw and lose the copy.
  it("still pastes when the copy does not fit in localStorage", async () => {
    const original = rect();
    canvas.add(original);
    canvas.setActiveObject(original);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    handleCopy(canvas);

    const [pasted] = await pasteAndGetShapes();

    expect(pasted.left).toBe(120);
  });
});
