// Regression tests for the changes the design panel makes to the selected shape.
import { fabric } from "fabric";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bringElement, modifyShape } from "./shapes";

let canvas: fabric.Canvas;
const syncShapeInStorage = vi.fn();

const select = (object: fabric.Object) => {
  canvas.add(object);
  canvas.setActiveObject(object);
  return object;
};

const modify = (property: string, value: string) =>
  modifyShape({ canvas, property, value, syncShapeInStorage });

// what other users and a reload get: the object rebuilt from its saved data
const reload = (object: fabric.Object) =>
  new Promise<fabric.Object>((resolve) => {
    fabric.util.enlivenObjects(
      [object.toJSON()],
      ([restored]: fabric.Object[]) => resolve(restored),
      "fabric"
    );
  });

beforeEach(() => {
  canvas = new fabric.Canvas(document.createElement("canvas"), { width: 800, height: 600 });
  syncShapeInStorage.mockClear();
});

afterEach(() => {
  canvas.dispose();
});

describe("modifyShape", () => {
  // A circle's width comes from its radius, so setting it directly was lost on the next render.
  it("keeps a new circle width after a reload", async () => {
    const circle = select(new fabric.Circle({ radius: 50 }));

    modify("width", "300");

    const { width = 0, scaleX = 1 } = await reload(circle);

    expect(width * scaleX).toBe(300);
  });

  // Same for lines, whose size comes from their points.
  it("keeps a new line width after a reload", async () => {
    const line = select(new fabric.Line([0, 0, 100, 100]));

    modify("width", "250");

    const { width = 0, scaleX = 1 } = await reload(line);

    expect(width * scaleX).toBe(250);
  });

  // An emptied or zero field would save a broken size and make the shape disappear.
  it.each(["", "0", "-5", "abc"])("ignores the invalid size %j", (value) => {
    const shape = select(new fabric.Rect({ width: 100, height: 100 }));

    modify("width", value);

    expect(shape.scaleX).toBe(1);
    expect(syncShapeInStorage).not.toHaveBeenCalled();
  });

  // The font select gives strings, and text layout needs numbers.
  it("saves the font size as a number", () => {
    const text = select(new fabric.IText("hi")) as fabric.IText;

    modify("fontSize", "24");

    expect(text.fontSize).toBe(24);
  });

  // Fonts mean nothing on a rectangle and must not pollute its saved data.
  it("does not apply text properties to other shapes", () => {
    select(new fabric.Rect({ width: 100, height: 100 }));

    modify("fontSize", "24");

    expect(syncShapeInStorage).not.toHaveBeenCalled();
  });
});

describe("bringElement", () => {
  const moveLayer = (direction: string) =>
    bringElement({ canvas, direction, syncShapeInStorage });

  // The order has to be in the saved data, because canvas order is rebuilt on every render.
  it("saves a zIndex above every other shape", () => {
    canvas.add(new fabric.Rect({ zIndex: 7 } as any));
    const shape = select(new fabric.Rect({ zIndex: 1 } as any));

    moveLayer("front");

    expect(shape.zIndex).toBe(8);
    expect(syncShapeInStorage).toHaveBeenCalledWith(shape);
  });

  // Sending back needs a value below all others, including shapes without a zIndex.
  it("saves a zIndex below every other shape", () => {
    canvas.add(new fabric.Rect());
    const shape = select(new fabric.Rect({ zIndex: 3 } as any));

    moveLayer("back");

    expect(shape.zIndex).toBe(-1);
  });
});
