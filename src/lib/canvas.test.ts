// Regression tests for how the canvas draws, selects, renders and saves shapes.
import { fabric } from "fabric";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyToolMode,
  getDragBounds,
  getDragCircle,
  getElementAttributes,
  handleCanvasObjectModified,
  handleCanvasObjectMoving,
  handleCanvasZoom,
  isCanvasBusy,
  renderCanvas,
  sortShapeEntries,
} from "./canvas";
import { RenderState } from "@/types/type";

let canvas: fabric.Canvas;

const rect = (objectId: string, left = 0, top = 0) =>
  new fabric.Rect({ left, top, width: 50, height: 50, strokeWidth: 0, objectId } as any);

const shapeEntry = (objectId: string, extra = {}): [string, any] => [
  objectId,
  { ...rect(objectId).toObject(), objectId, ...extra },
];

// renders storage objects into the test canvas and waits for fabric to finish
const render = (
  objects: [string, any][],
  { isDrawing = false, selectedIds = [] as string[] } = {},
  renderState: RenderState = { version: 0, isSwapping: false, isPending: false }
) =>
  new Promise<RenderState>((resolve) => {
    const props = {
      canvas,
      canvasObjects: new Map(objects),
      isDrawing: { current: isDrawing },
      renderStateRef: { current: renderState },
      selectedIdsRef: { current: selectedIds },
      onRendered: () => resolve(renderState),
    };

    renderCanvas(props);
    if (renderState.isPending) resolve(renderState);
  });

beforeEach(() => {
  canvas = new fabric.Canvas(document.createElement("canvas"), {
    width: 800,
    height: 600,
  });
});

afterEach(() => {
  canvas.dispose();
});

describe("drawing by dragging", () => {
  // Dragging up and left used to give negative sizes, leaving shapes that could not be clicked.
  it("gives a positive box when the drag goes up and left", () => {
    expect(getDragBounds({ x: 300, y: 200 }, { x: 100, y: 50 })).toEqual({
      left: 100,
      top: 50,
      width: 200,
      height: 150,
    });
  });

  // A circle dragged backwards must end where the pointer went, not where the drag began.
  it("grows the circle towards the pointer in reverse drags", () => {
    expect(getDragCircle({ x: 300, y: 200 }, { x: 200, y: 150 })).toEqual({
      left: 200,
      top: 100,
      radius: 50,
    });
  });
});

describe("applyToolMode", () => {
  // Freeform must be on before the press: otherwise the first stroke was lost.
  it("enables drawing as soon as the freeform tool is picked", () => {
    applyToolMode(canvas, "freeform");

    expect(canvas.isDrawingMode).toBe(true);
  });

  // Leaving freeform must not draw a stray path with the next tool.
  it("disables drawing when the tool changes", () => {
    applyToolMode(canvas, "freeform");
    applyToolMode(canvas, "select");

    expect(canvas.isDrawingMode).toBe(false);
  });

  // With a shape tool, pressing on an object must draw on top of it, not drag it.
  it("ignores existing objects while a shape tool is armed and restores them after", () => {
    applyToolMode(canvas, "rectangle");
    expect(canvas.skipTargetFind).toBe(true);

    applyToolMode(canvas, null);
    expect(canvas.skipTargetFind).toBe(false);
  });
});

describe("getElementAttributes", () => {
  // The panel must show the real size of a resized object, not its original one.
  it("reports the scaled size", () => {
    const attributes = getElementAttributes(rect("a").set({ scaleX: 2, scaleY: 3 }));

    expect([attributes.width, attributes.height]).toEqual(["100", "150"]);
  });

  // The stroke field used to show the fill, and only strings match the font selects.
  it("keeps stroke apart from fill and gives the font size as a string", () => {
    const text = new fabric.IText("hi", {
      fontSize: 36,
      fill: "#ff0000",
      stroke: "#00ff00",
    });

    expect(getElementAttributes(text)).toMatchObject({
      fill: "#ff0000",
      stroke: "#00ff00",
      fontSize: "36",
    });
  });

  // Color inputs reject rgb() values, which is what freehand paths used to save.
  it("converts rgb colors to the format of the color input", () => {
    const attributes = getElementAttributes(rect("a").set({ fill: "rgb(255,0,0)" }));

    expect(attributes.fill).toBe("#ff0000");
  });

  // Deselecting must clear the panel so that it doesn't describe an old object.
  it("gives an empty panel without an element", () => {
    expect(getElementAttributes()).toMatchObject({ width: "", height: "", fontSize: "" });
  });
});

describe("sortShapeEntries", () => {
  // Layer order has to come from the saved data; shapes without it stay in their place.
  it("orders by zIndex and keeps older shapes in insertion order", () => {
    const sorted = sortShapeEntries(
      new Map([
        ["top", { zIndex: 5 }],
        ["old-1", {}],
        ["back", { zIndex: -1 }],
        ["old-2", {}],
      ])
    );

    expect(sorted.map(([id]) => id)).toEqual(["back", "old-1", "old-2", "top"]);
  });
});

describe("renderCanvas", () => {
  // Storage is the source of truth, in paint order.
  it("shows the stored objects in layer order", async () => {
    await render([shapeEntry("front", { zIndex: 2 }), shapeEntry("back", { zIndex: 1 })]);

    expect(canvas.getObjects().map((object) => object.objectId)).toEqual(["back", "front"]);
  });

  // Moving or editing re-renders the canvas: the selection used to vanish with it.
  it("keeps the selected object selected", async () => {
    await render([shapeEntry("a"), shapeEntry("b")], { selectedIds: ["b"] });

    expect(canvas.getActiveObject()?.objectId).toBe("b");
  });

  // Same as above for multiple selections.
  it("keeps a multiple selection", async () => {
    await render([shapeEntry("a"), shapeEntry("b")], { selectedIds: ["a", "b"] });

    expect(canvas.getActiveObjects()).toHaveLength(2);
  });

  // A remote change must not rebuild the canvas in the middle of the user's drawing.
  it("postpones the render while the user is busy", async () => {
    const state = await render([shapeEntry("a")], { isDrawing: true });

    expect(canvas.getObjects()).toHaveLength(0);
    expect(state.isPending).toBe(true);
  });

  // Two quick changes with slow images used to add every object twice.
  it("ignores an older render that finishes late", async () => {
    const state: RenderState = { version: 0, isSwapping: false, isPending: false };
    const objects = [shapeEntry("a")];
    const enliven = vi.spyOn(fabric.util, "enlivenObjects");

    const first = render(objects, {}, state);
    const firstFinish = enliven.mock.calls[0][1];
    await render(objects, {}, state);
    firstFinish([rect("stale")]);
    enliven.mockRestore();
    void first;

    expect(canvas.getObjects().map((object) => object.objectId)).toEqual(["a"]);
  });
});

describe("isCanvasBusy", () => {
  // Rebuilding the canvas during text editing is what threw typed text away.
  it("is busy while a text is being edited", () => {
    const text = new fabric.IText("hi");
    canvas.add(text);
    canvas.setActiveObject(text);
    text.isEditing = true;

    expect(isCanvasBusy(canvas, { current: false })).toBe(true);
    text.isEditing = false;
  });
});

describe("handleCanvasObjectModified", () => {
  // Moving a multiple selection was never saved, so objects returned after a reload.
  it("saves multiple selections with their real canvas coordinates", () => {
    const objects = [rect("a", 100, 100), rect("b", 300, 100)];
    canvas.add(...objects);
    const selection = new fabric.ActiveSelection(objects, { canvas });
    canvas.setActiveObject(selection);
    selection.set({ left: (selection.left || 0) + 50, top: (selection.top || 0) + 200 });

    let saved: number[][] = [];
    handleCanvasObjectModified({
      options: { target: selection } as any,
      canvas,
      syncShapeInStorage: vi.fn(),
      syncShapesInStorage: (shapes) => {
        saved = shapes.map((shape) => [shape.left as number, shape.top as number]);
      },
    });

    expect(saved).toEqual([
      [150, 300],
      [350, 300],
    ]);
    expect(canvas.getActiveObjects()).toHaveLength(2);
  });
});

describe("handleCanvasObjectMoving", () => {
  // Objects must stay inside the canvas, including against the 0 edge.
  it("keeps objects inside the canvas", () => {
    const object = rect("a", 790, -30);
    canvas.add(object);

    handleCanvasObjectMoving({ options: { target: object } as any });

    expect(object.left).toBe(750);
    expect(object.top).toBeCloseTo(0);
  });

  // Zoomed out there is more visible space, which used to be out of reach.
  it("allows the whole visible area when zoomed out", () => {
    const object = rect("a", 1500, 0);
    canvas.add(object);
    canvas.setZoom(0.5);

    handleCanvasObjectMoving({ options: { target: object } as any });

    expect(object.left).toBe(1500);
  });
});

describe("handleCanvasZoom", () => {
  const wheel = (deltaY: number) =>
    handleCanvasZoom({
      options: {
        e: { deltaY, offsetX: 200, offsetY: 100, preventDefault() {}, stopPropagation() {} },
      } as any,
      canvas,
    });

  // Scrolling down is the usual gesture for zooming out.
  it("zooms out when scrolling down", () => {
    wheel(200);

    expect(canvas.getZoom()).toBeCloseTo(0.8);
  });

  // There is no panning, so returning to 100% must not leave the canvas displaced.
  it("restores the original position when back at 100%", () => {
    wheel(500);
    wheel(-500);

    expect(canvas.viewportTransform).toEqual([1, 0, 0, 1, 0, 0]);
  });
});
