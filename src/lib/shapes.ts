import { fabric } from "fabric";
import { v4 as uuidv4 } from "uuid";

import {
  CustomFabricObject,
  ElementDirection,
  ImageUpload,
  ModifyShape,
} from "@/types/type";

export const createRectangle = (pointer: PointerEvent) => {
  const rect = new fabric.Rect({
    left: pointer.x,
    top: pointer.y,
    width: 100,
    height: 100,
    fill: "#aabbcc",
    objectId: uuidv4(),
  } as CustomFabricObject<fabric.Rect>);

  return rect;
};

export const createTriangle = (pointer: PointerEvent) => {
  return new fabric.Triangle({
    left: pointer.x,
    top: pointer.y,
    width: 100,
    height: 100,
    fill: "#aabbcc",
    objectId: uuidv4(),
  } as CustomFabricObject<fabric.Triangle>);
};

export const createCircle = (pointer: PointerEvent) => {
  return new fabric.Circle({
    left: pointer.x,
    top: pointer.y,
    radius: 100,
    fill: "#aabbcc",
    objectId: uuidv4(),
  } as any);
};

export const createLine = (pointer: PointerEvent) => {
  return new fabric.Line(
    [pointer.x, pointer.y, pointer.x + 100, pointer.y + 100],
    {
      stroke: "#aabbcc",
      strokeWidth: 2,
      objectId: uuidv4(),
    } as CustomFabricObject<fabric.Line>
  );
};

export const createText = (pointer: PointerEvent, text: string) => {
  return new fabric.IText(text, {
    left: pointer.x,
    top: pointer.y,
    fill: "#aabbcc",
    fontFamily: "Helvetica",
    fontSize: 36,
    fontWeight: "400",
    objectId: uuidv4()
  } as fabric.ITextOptions);
};

export const createSpecificShape = (
  shapeType: string,
  pointer: PointerEvent
) => {
  switch (shapeType) {
    case "rectangle":
      return createRectangle(pointer);

    case "triangle":
      return createTriangle(pointer);

    case "circle":
      return createCircle(pointer);

    case "line":
      return createLine(pointer);

    case "text":
      return createText(pointer, "Tap to Type");

    default:
      return null;
  }
};

export const handleImageUpload = ({
  file,
  canvas,
  syncShapeInStorage,
}: ImageUpload) => {
  const reader = new FileReader();

  reader.onload = () => {
    // @ts-ignore the types don't include the second argument of this callback
    fabric.Image.fromURL(reader.result as string, (img, hasFailed) => {
      if (hasFailed) {
        window.alert("That file could not be loaded as an image.");
        return;
      }

      img.scaleToWidth(200);
      img.scaleToHeight(200);

      // @ts-ignore
      img.objectId = uuidv4();

      canvas.current.add(img);

      syncShapeInStorage(img);
      canvas.current.requestRenderAll();
    });
  };

  reader.readAsDataURL(file);
};

// objects inside a multiple selection hold coordinates relative to it, so the selection
// is dissolved while reading them to get the position they really have on the canvas
export const withAbsoluteSelection = <T>(
  canvas: fabric.Canvas,
  callback: (objects: fabric.Object[]) => T
) => {
  const objects = canvas.getActiveObjects();

  if (canvas.getActiveObject()?.type !== "activeSelection") return callback(objects);

  canvas.discardActiveObject();
  const result = callback(objects);
  canvas.setActiveObject(new fabric.ActiveSelection(objects, { canvas }));
  canvas.requestRenderAll();

  return result;
};

export const createShape = (
  canvas: fabric.Canvas,
  pointer: PointerEvent,
  shapeType: string
) => {
  if (shapeType === "freeform") {
    canvas.isDrawingMode = true;
    return null;
  }

  return createSpecificShape(shapeType, pointer);
};

// the size goes through the scale because circles, lines, paths and images rebuild
// their width and height from their own data, so setting those directly would be lost
const setElementSize = (
  element: fabric.Object,
  property: "width" | "height",
  value: string
) => {
  const size = Number(value);
  const baseSize = element[property];

  if (!(size > 0) || !baseSize) return false;

  element.set(property === "width" ? "scaleX" : "scaleY", size / baseSize);
  return true;
};

const TEXT_PROPERTIES = ["fontFamily", "fontSize", "fontWeight"];

const setElementProperty = (
  element: fabric.Object,
  property: string,
  value: string
) => {
  if (TEXT_PROPERTIES.includes(property) && element.type !== "i-text") return false;

  const newValue = property === "fontSize" ? Number(value) : value;
  if (element[property as keyof object] === newValue) return false;

  element.set(property as keyof object, newValue as never);
  return true;
};

export const modifyShape = ({
  canvas,
  property,
  value,
  syncShapeInStorage,
}: ModifyShape) => {
  const selectedElement = canvas.getActiveObject();

  if (!selectedElement || selectedElement?.type === "activeSelection") return;

  const hasChanged =
    property === "width" || property === "height"
      ? setElementSize(selectedElement, property, value)
      : setElementProperty(selectedElement, property, value);

  if (!hasChanged) return;

  selectedElement.setCoords();
  syncShapeInStorage(selectedElement);
};

export const bringElement = ({
  canvas,
  direction,
  syncShapeInStorage,
}: ElementDirection) => {
  if (!canvas) return;

  // get the selected element. If there is no selected element or there are more than one selected element, return
  const selectedElement = canvas.getActiveObject();

  if (!selectedElement || selectedElement?.type === "activeSelection") return;

  const zIndexes = canvas.getObjects().map((object) => object.zIndex ?? 0);

  // the order lives in the shape data because it has to survive reloads and reach other users
  selectedElement.zIndex =
    direction === "front" ? Math.max(...zIndexes) + 1 : Math.min(...zIndexes) - 1;

  // storage update re-renders all objects on the canvas in the new order
  syncShapeInStorage(selectedElement);
};