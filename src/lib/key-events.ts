import { fabric } from "fabric";
import { v4 as uuidv4 } from "uuid";

import { CustomFabricObject } from "@/types/type";
import { withAbsoluteSelection } from "./shapes";

const CLIPBOARD_KEY = "clipboard";
const PASTE_OFFSET = 20;

// copies too big for localStorage (like images) stay available in this tab
let memoryClipboard: string | null = null;

const writeClipboard = (objects: fabric.Object[]) => {
  const serializedObjects = JSON.stringify(objects.map((obj) => obj.toObject()));

  try {
    localStorage.setItem(CLIPBOARD_KEY, serializedObjects);
    memoryClipboard = null;
  } catch {
    localStorage.removeItem(CLIPBOARD_KEY);
    memoryClipboard = serializedObjects;
  }
};

const readClipboard = () => memoryClipboard ?? localStorage.getItem(CLIPBOARD_KEY);

// key presses in a text field, a comment or a text on the canvas belong to that field, not to the editor
export const isEditableTarget = (target: EventTarget | null) =>
  Boolean(
    (target as HTMLElement | null)?.closest?.(
      "input, textarea, select, [contenteditable='true']"
    )
  );

export const handleCopy = (canvas: fabric.Canvas) => {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length > 0) {
    // Serialize the selected objects and store them in the clipboard
    withAbsoluteSelection(canvas, writeClipboard);
  }

  return activeObjects;
};

export const handlePaste = (
  canvas: fabric.Canvas,
  syncShapesInStorage: (shapes: fabric.Object[]) => void
) => {
  if (!canvas || !(canvas instanceof fabric.Canvas)) {
    console.error("Invalid canvas object. Aborting paste operation.");
    return;
  }

  // Retrieve serialized objects from the clipboard
  const clipboardData = readClipboard();

  if (clipboardData) {
    try {
      // convert the plain javascript objects retrieved from the clipboard into fabricjs objects (deserialization)
      fabric.util.enlivenObjects(
        JSON.parse(clipboardData),
        (enlivenedObjects: fabric.Object[]) => {
          enlivenedObjects.forEach((enlivenedObj) => {
            // Offset the pasted objects to avoid overlap with existing objects
            enlivenedObj.set({
              left: (enlivenedObj.left || 0) + PASTE_OFFSET,
              top: (enlivenedObj.top || 0) + PASTE_OFFSET,
              objectId: uuidv4(),
            } as CustomFabricObject<any>);

            canvas.add(enlivenedObj);
          });

          syncShapesInStorage(enlivenedObjects);
          canvas.renderAll();

          // the next paste must land on top of this one, not in the same place
          writeClipboard(enlivenedObjects);
        },
        "fabric"
      );
    } catch (error) {
      console.error("Error parsing clipboard data:", error);
    }
  }
};

export const handleDelete = (
  canvas: fabric.Canvas,
  deleteShapeFromStorage: (id: string) => void
) => {
  const activeObjects = canvas.getActiveObjects();
  if (!activeObjects || activeObjects.length === 0) return;

  if (activeObjects.length > 0) {
    activeObjects.forEach((obj: CustomFabricObject<any>) => {
      if (!obj.objectId) return;
      canvas.remove(obj);
      deleteShapeFromStorage(obj.objectId);
    });
  }

  canvas.discardActiveObject();
  canvas.requestRenderAll();
};

// create a handleKeyDown function that listen to different keydown events
export const handleKeyDown = ({
  e,
  canvas,
  undo,
  redo,
  syncShapesInStorage,
  deleteSelection,
}: {
  e: KeyboardEvent;
  canvas: fabric.Canvas | any;
  undo: () => void;
  redo: () => void;
  syncShapesInStorage: (shapes: fabric.Object[]) => void;
  deleteSelection: () => void;
}) => {
  if (isEditableTarget(e.target)) return;

  const isModifierPressed = e?.ctrlKey || e?.metaKey;

  // Check if the key pressed is ctrl/cmd + c (copy)
  if (isModifierPressed && e.keyCode === 67) {
    handleCopy(canvas);
  }

  // Check if the key pressed is ctrl/cmd + v (paste)
  if (isModifierPressed && e.keyCode === 86) {
    handlePaste(canvas, syncShapesInStorage);
  }

  // Check if the key pressed is delete/backspace (delete)
  if (e.keyCode === 8 || e.keyCode === 46) {
    deleteSelection();
  }

  // check if the key pressed is ctrl/cmd + x (cut)
  if (isModifierPressed && e.keyCode === 88) {
    handleCopy(canvas);
    deleteSelection();
  }

  // check if the key pressed is ctrl/cmd + z (undo) or ctrl/cmd + shift + z (redo)
  if (isModifierPressed && e.keyCode === 90) {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  }

  // check if the key pressed is ctrl/cmd + y (redo)
  if (isModifierPressed && e.keyCode === 89) {
    e.preventDefault();
    redo();
  }

  if (e.keyCode === 191 && !e.shiftKey) {
    e.preventDefault();
  }
};
