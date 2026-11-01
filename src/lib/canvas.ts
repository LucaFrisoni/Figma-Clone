import { fabric } from "fabric";
import { v4 as uuid4 } from "uuid";


import {
  Attributes,
  CanvasMouseDown,
  CanvasMouseMove,
  CanvasMouseUp,
  CanvasObjectModified,
  CanvasObjectScaling,
  CanvasPathCreated,
  CanvasSelectionChanged,
  DragPoint,
  RenderCanvas,
  RenderState,
} from "@/types/type";
import { defaultNavElement } from "@/constants";
import { createSpecificShape, withAbsoluteSelection } from "./shapes";

// tools that create a new object instead of selecting existing ones
const DRAWING_TOOLS = ["rectangle", "circle", "triangle", "line", "text", "freeform"];

const DEFAULT_COLOR = "#aabbcc";
const BRUSH_WIDTH = 5;

// initialize fabric canvas
export const initializeFabric = ({
  fabricRef,
  canvasRef,
}: {
  fabricRef: React.MutableRefObject<fabric.Canvas | null>;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}) => {
  // get canvas element
  const canvasElement = document.getElementById("canvas");

  // create fabric canvas
  const canvas = new fabric.Canvas(canvasRef.current, {
    width: canvasElement?.clientWidth,
    height: canvasElement?.clientHeight,
  });

  // set canvas reference to fabricRef so we can use it later anywhere outside canvas listener
  fabricRef.current = canvas;

  return canvas;
};

// put the canvas in the mode the selected tool needs. It must run when the tool is picked:
// fabric decides how to treat a click before mouse:down fires, so that would be too late
export const applyToolMode = (canvas: fabric.Canvas, tool: string | null) => {
  const isDrawingTool = DRAWING_TOOLS.includes(tool || "");

  canvas.isDrawingMode = tool === "freeform";
  canvas.skipTargetFind = isDrawingTool;
  canvas.selection = !isDrawingTool;
  canvas.defaultCursor = isDrawingTool ? "crosshair" : "default";

  if (tool === "freeform") {
    canvas.freeDrawingBrush.width = BRUSH_WIDTH;
    canvas.freeDrawingBrush.color = DEFAULT_COLOR;
  }

  if (isDrawingTool) {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }
};

// instantiate creation of custom fabric object/shape and add it to canvas
export const handleCanvasMouseDown = ({
  options,
  canvas,
  selectedShapeRef,
  isDrawing,
  shapeRef,
  drawOriginRef,
  pauseHistory,
}: CanvasMouseDown) => {
  // get pointer coordinates
  const pointer = canvas.getPointer(options.e);

  // fabric draws the path by itself in freeform mode
  if (selectedShapeRef.current === "freeform") {
    isDrawing.current = true;
    return;
  }

  // create custom fabric object/shape and set it to shapeRef
  shapeRef.current = createSpecificShape(
    selectedShapeRef.current,
    pointer as any
  );

  // no shape means the select tool is active, so fabric handles the click
  if (!shapeRef.current) return;

  isDrawing.current = true;
  drawOriginRef.current = { x: pointer.x, y: pointer.y };

  // every intermediate size of the shape must count as a single undo step
  pauseHistory();

  // add: http://fabricjs.com/docs/fabric.Canvas.html#add
  canvas.add(shapeRef.current);
};

// box covered by a drag, whatever the direction the pointer moved in
export const getDragBounds = (origin: DragPoint, pointer: DragPoint) => ({
  left: Math.min(origin.x, pointer.x),
  top: Math.min(origin.y, pointer.y),
  width: Math.abs(pointer.x - origin.x),
  height: Math.abs(pointer.y - origin.y),
});

// circle that fits the horizontal drag and grows from the point where it started
export const getDragCircle = (origin: DragPoint, pointer: DragPoint) => {
  const { left, width } = getDragBounds(origin, pointer);

  return {
    left,
    top: pointer.y < origin.y ? origin.y - width : origin.y,
    radius: width / 2,
  };
};

// handle mouse move event on canvas to draw shapes with different dimensions
export const handleCanvaseMouseMove = ({
  options,
  canvas,
  isDrawing,
  selectedShapeRef,
  shapeRef,
  drawOriginRef,
  syncShapeInStorage,
}: CanvasMouseMove) => {
  // if selected shape is freeform, return
  if (!isDrawing.current) return;
  if (selectedShapeRef.current === "freeform") return;

  // get pointer coordinates
  const pointer = canvas.getPointer(options.e);
  const origin = drawOriginRef.current;

  if (!origin) return;

  // depending on the selected shape, set the dimensions of the shape stored in shapeRef in previous step of handelCanvasMouseDown
  // calculate shape dimensions based on pointer coordinates
  switch (selectedShapeRef?.current) {
    case "rectangle":
    case "triangle":
      shapeRef.current?.set(getDragBounds(origin, pointer));
      break;

    case "circle":
      shapeRef.current?.set(getDragCircle(origin, pointer));
      break;

    case "line":
      shapeRef.current?.set({
        x2: pointer.x,
        y2: pointer.y,
      });
      break;

    default:
      break;
  }

  // render objects on canvas
  // renderAll: http://fabricjs.com/docs/fabric.Canvas.html#renderAll
  canvas.renderAll();

  // sync shape in storage
  if (shapeRef.current?.objectId) {
    syncShapeInStorage(shapeRef.current);
  }
};

// handle mouse up event on canvas to stop drawing shapes
export const handleCanvasMouseUp = ({
  canvas,
  isDrawing,
  shapeRef,
  drawOriginRef,
  selectedShapeRef,
  syncShapeInStorage,
  setActiveElement,
  resumeHistory,
}: CanvasMouseUp) => {
  isDrawing.current = false;
  if (selectedShapeRef.current === "freeform") return;

  if (shapeRef.current) {
    // sync shape in storage as drawing is stopped
    shapeRef.current.setCoords();
    syncShapeInStorage(shapeRef.current);
    resumeHistory();
  }

  // set everything to null
  shapeRef.current = null;
  drawOriginRef.current = null;
  selectedShapeRef.current = null;
  applyToolMode(canvas, null);

  // go back to the select tool now that the shape is finished
  setActiveElement(defaultNavElement);
};

// update shape in storage when object is modified
export const handleCanvasObjectModified = ({
  options,
  canvas,
  syncShapeInStorage,
  syncShapesInStorage,
}: CanvasObjectModified) => {
  const target = options.target;
  if (!target) return;

  if (target?.type == "activeSelection") {
    withAbsoluteSelection(canvas, syncShapesInStorage);
  } else {
    syncShapeInStorage(target);
  }
};

// update shape in storage when path is created when in freeform mode
export const handlePathCreated = ({
  options,
  syncShapeInStorage,
}: CanvasPathCreated) => {
  // get path object
  const path = options.path;
  if (!path) return;

  // set unique id to path object
  path.set({
    objectId: uuid4(),
  });

  // sync shape in storage
  syncShapeInStorage(path);
};

// check how object is moving on canvas and restrict it to canvas boundaries
export const handleCanvasObjectMoving = ({
  options,
}: {
  options: fabric.IEvent;
}) => {
  // get target object which is moving
  const target = options.target as fabric.Object;

  // target.canvas is the canvas on which the object is moving
  const canvas = target.canvas as fabric.Canvas;

  // set coordinates of target object
  target.setCoords();

  // visible area in canvas coordinates, which depends on the zoom and the viewport offset
  const [, , , , offsetX, offsetY] = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
  const zoom = canvas.getZoom();
  const minLeft = -offsetX / zoom;
  const minTop = -offsetY / zoom;
  const maxLeft = ((canvas.width || 0) - offsetX) / zoom;
  const maxTop = ((canvas.height || 0) - offsetY) / zoom;

  // restrict object to canvas boundaries (horizontal)
  target.left = Math.max(
    minLeft,
    Math.min(target.left || 0, maxLeft - target.getScaledWidth())
  );

  // restrict object to canvas boundaries (vertical)
  target.top = Math.max(
    minTop,
    Math.min(target.top || 0, maxTop - target.getScaledHeight())
  );
};

// the native color input only accepts #rrggbb, but fabric can hold values like rgb(0,0,0)
const toColorInputValue = (color?: unknown) =>
  typeof color === "string" && color
    ? `#${new fabric.Color(color).toHex().toLowerCase()}`
    : DEFAULT_COLOR;

// values the design panel must show for an element, or an empty panel without one
export const getElementAttributes = (element?: fabric.Object): Attributes => {
  const text = element as fabric.IText | undefined;
  const { width = 0, height = 0, scaleX = 1, scaleY = 1 } = element || {};

  return {
    // not getScaledWidth(): it adds the stroke, and these values are what the panel sets
    width: element ? (width * scaleX).toFixed(0) : "",
    height: element ? (height * scaleY).toFixed(0) : "",
    fill: toColorInputValue(element?.fill),
    stroke: toColorInputValue(element?.stroke),
    fontSize: text?.fontSize?.toString() || "",
    fontFamily: text?.fontFamily || "",
    fontWeight: text?.fontWeight?.toString() || "",
  };
};

// keep the selected ids and the design panel up to date with what the user selected
export const handleCanvasSelectionChanged = ({
  canvas,
  renderStateRef,
  selectedIdsRef,
  setElementAttributes,
}: CanvasSelectionChanged) => {
  // renderCanvas replaces the objects, so this is not the user changing the selection
  if (renderStateRef.current.isSwapping) return;

  const selected = canvas.getActiveObjects();
  selectedIdsRef.current = selected.map((object) => object.objectId as string);
  setElementAttributes(
    getElementAttributes(selected.length === 1 ? selected[0] : undefined)
  );
};

// update element attributes when element is scaled
export const handleCanvasObjectScaling = ({
  options,
  setElementAttributes,
}: CanvasObjectScaling) => {
  const selectedElement = options.target;
  if (!selectedElement) return;

  const { width, height } = getElementAttributes(selectedElement);

  setElementAttributes((prev) => ({ ...prev, width, height }));
};

// storage entries in the order they must be painted, from the back to the front
export const sortShapeEntries = (canvasObjects: ReadonlyMap<string, any>) =>
  Array.from(canvasObjects).sort(
    ([, a], [, b]) => (a?.zIndex ?? 0) - (b?.zIndex ?? 0)
  );

// rebuilding the canvas now would drop the drag, the drawing or the text being edited
export const isCanvasBusy = (
  canvas: fabric.Canvas,
  isDrawing: React.MutableRefObject<boolean>
) =>
  isDrawing.current ||
  Boolean((canvas as any)._currentTransform) ||
  Boolean((canvas.getActiveObject() as fabric.IText | null)?.isEditing);

const restoreSelection = (
  canvas: fabric.Canvas,
  objects: fabric.Object[],
  selectedIds: string[]
) => {
  const selected = objects.filter((object) =>
    selectedIds.includes(object.objectId as string)
  );

  if (selected.length === 1) canvas.setActiveObject(selected[0]);
  if (selected.length > 1) {
    canvas.setActiveObject(new fabric.ActiveSelection(selected, { canvas }));
  }
};

// replace everything on the canvas at once, so that it never shows up empty
const swapCanvasObjects = (
  canvas: fabric.Canvas,
  objects: fabric.Object[],
  state: RenderState,
  selectedIds: string[]
) => {
  state.isSwapping = true;
  canvas.clear();
  canvas.add(...objects);
  restoreSelection(canvas, objects, selectedIds);
  state.isSwapping = false;

  canvas.requestRenderAll();
};

// render canvas objects coming from storage on canvas
export const renderCanvas = ({
  canvas,
  canvasObjects,
  isDrawing,
  renderStateRef,
  selectedIdsRef,
  onRendered,
}: RenderCanvas) => {
  const state = renderStateRef.current;

  if (isCanvasBusy(canvas, isDrawing)) {
    state.isPending = true;
    return;
  }

  state.isPending = false;
  const version = ++state.version;
  const shapes = sortShapeEntries(canvasObjects).map(([, shape]) => shape);

  /**
   * enlivenObjects() is asynchronous for images, so the canvas only changes once
   * every object is ready. Older renders are skipped to avoid duplicated objects.
   *
   * enlivenObjects: http://fabricjs.com/docs/fabric.util.html#.enlivenObjectEnlivables
   */
  fabric.util.enlivenObjects(
    shapes,
    (objects: fabric.Object[]) => {
      if (version !== state.version) return;

      if (isCanvasBusy(canvas, isDrawing)) {
        state.isPending = true;
        return;
      }

      swapCanvasObjects(canvas, objects, state, selectedIdsRef.current);
      onRendered();
    },
    "fabric"
  );
};

// resize canvas dimensions on window resize
export const handleResize = ({ canvas }: { canvas: fabric.Canvas | null }) => {
  const canvasElement = document.getElementById("canvas");
  if (!canvasElement) return;

  if (!canvas) return;

  canvas.setDimensions({
    width: canvasElement.clientWidth,
    height: canvasElement.clientHeight,
  });
};

// zoom canvas on mouse scroll
export const handleCanvasZoom = ({
  options,
  canvas,
}: {
  options: fabric.IEvent & { e: WheelEvent };
  canvas: fabric.Canvas;
}) => {
  const delta = options.e?.deltaY;
  let zoom = canvas.getZoom();

  // allow zooming to min 20% and max 100%
  const minZoom = 0.2;
  const maxZoom = 1;
  const zoomStep = 0.001;

  // calculate zoom based on mouse scroll wheel with min and max zoom
  // scrolling up zooms in and scrolling down zooms out
  zoom = Math.min(Math.max(minZoom, zoom - delta * zoomStep), maxZoom);

  // set zoom to canvas
  // zoomToPoint: http://fabricjs.com/docs/fabric.Canvas.html#zoomToPoint
  canvas.zoomToPoint({ x: options.e.offsetX, y: options.e.offsetY }, zoom);

  // there is no panning, so 100% must always show the canvas in its original position
  if (zoom === maxZoom) canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

  options.e.preventDefault();
  options.e.stopPropagation();
};
