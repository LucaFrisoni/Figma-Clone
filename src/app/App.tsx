"use client";

import { fabric } from "fabric";
import { useEffect, useRef, useState } from "react";

import {
  useBatch,
  useHistory,
  useMutation,
  useRedo,
  useStorage,
  useUndo,
} from "../../liveblocks.config";
import {
  applyToolMode,
  getElementAttributes,
  handleCanvaseMouseMove,
  handleCanvasMouseDown,
  handleCanvasMouseUp,
  handleCanvasObjectModified,
  handleCanvasObjectMoving,
  handleCanvasObjectScaling,
  handleCanvasSelectionChanged,
  handleCanvasZoom,
  handlePathCreated,
  handleResize,
  initializeFabric,
  renderCanvas,
  sortShapeEntries,
} from "@/lib/canvas";
import { handleDelete, handleKeyDown } from "@/lib/key-events";
import  LeftSidebar  from "../components/LeftSidebar";
import { handleImageUpload } from "@/lib/shapes";
import { defaultNavElement } from "@/constants";
import { ActiveElement, Attributes, DragPoint, RenderState } from "@/types/type";
import Navbar from "@/components/Navbar";
import RightSidebar from "@/components/RightSidebar";
import Live from "@/components/Live";
import ConnectionStatus from "@/components/ConnectionStatus";

const Home = () => {
  /**
   * useUndo and useRedo are hooks provided by Liveblocks that allow you to
   * undo and redo mutations.
   *
   * useUndo: https://liveblocks.io/docs/api-reference/liveblocks-react#useUndo
   * useRedo: https://liveblocks.io/docs/api-reference/liveblocks-react#useRedo
   */
  const undo = useUndo();
  const redo = useRedo();

  /**
   * pause and resume merge everything between them into a single undo step.
   * useBatch does the same for mutations that run together.
   */
  const { pause: pauseHistory, resume: resumeHistory } = useHistory();
  const batch = useBatch<void>();

  /**
   * useStorage is a hook provided by Liveblocks that allows you to store
   * data in a key-value store and automatically sync it with other users
   * i.e., subscribes to updates to that selected data
   *
   * useStorage: https://liveblocks.io/docs/api-reference/liveblocks-react#useStorage
   *
   * Over here, we are storing the canvas objects in the key-value store.
   */
  const canvasObjects = useStorage((root) => root.canvasObjects);

  // always the latest objects, for the listeners that only get registered once
  const canvasObjectsRef = useRef(canvasObjects);
  canvasObjectsRef.current = canvasObjects;

  /**
   * canvasRef is a reference to the canvas element that we'll use to initialize
   * the fabric canvas.
   *
   * fabricRef is a reference to the fabric canvas that we use to perform
   * operations on the canvas. It's a copy of the created canvas so we can use
   * it outside the canvas event listeners.
   */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);

  /**
   * isDrawing is a boolean that tells us if the user is drawing on the canvas.
   * We use this to determine if the user is drawing or not
   * i.e., if the freeform drawing mode is on or not.
   */
  const isDrawing = useRef(false);

  /**
   * shapeRef is a reference to the shape that the user is currently drawing.
   * We use this to update the shape's properties when the user is
   * drawing/creating shape
   */
  const shapeRef = useRef<fabric.Object | null>(null);

  // drawOriginRef is the point where the user started dragging the new shape
  const drawOriginRef = useRef<DragPoint | null>(null);

  /**
   * selectedShapeRef is a reference to the shape that the user has selected.
   * For example, if the user has selected the rectangle shape, then this will
   * be set to "rectangle".
   *
   * We're using refs here because we want to access these variables inside the
   * event listeners. We don't want to lose the values of these variables when
   * the component re-renders. Refs help us with that.
   */
  const selectedShapeRef = useRef<string | null>(null);

  /**
   * selectedIdsRef holds the ids of the selected objects in the canvas
   *
   * Since we're using live storage to sync shapes across users in real-time,
   * we have to re-render the canvas when the shapes are updated.
   * Due to this re-render, the selected shapes are lost. We want to keep track
   * of them so that we can keep them selected when the canvas re-renders.
   */
  const selectedIdsRef = useRef<string[]>([]);

  // isEditingRef is true while the user types a size in the design panel
  const isEditingRef = useRef(false);

  // renderStateRef coordinates the renders of the canvas, see RenderState
  const renderStateRef = useRef<RenderState>({
    version: 0,
    isSwapping: false,
    isPending: false,
  });

  /**
   * imageInputRef is a reference to the input element that we use to upload
   * an image to the canvas.
   *
   * We want image upload to happen when clicked on the image item from the
   * dropdown menu. So we're using this ref to trigger the click event on the
   * input element when the user clicks on the image item from the dropdown.
   */
  const imageInputRef = useRef<HTMLInputElement>(null);

  /**
   * activeElement is an object that contains the name, value and icon of the
   * active element in the navbar.
   */
  const [activeElement, setActiveElement] =
    useState<ActiveElement>(defaultNavElement);

  /**
   * elementAttributes is an object that contains the attributes of the selected
   * element in the canvas.
   *
   * We use this to update the attributes of the selected element when the user
   * is editing the width, height, color etc properties/attributes of the
   * object.
   */
  const [elementAttributes, setElementAttributes] = useState<Attributes>(
    getElementAttributes()
  );

  /**
   * deleteShapeFromStorage is a mutation that deletes a shape from the
   * key-value store of liveblocks.
   * useMutation is a hook provided by Liveblocks that allows you to perform
   * mutations on liveblocks data.
   *
   * useMutation: https://liveblocks.io/docs/api-reference/liveblocks-react#useMutation
   * delete: https://liveblocks.io/docs/api-reference/liveblocks-client#LiveMap.delete
   * get: https://liveblocks.io/docs/api-reference/liveblocks-client#LiveMap.get
   *
   * We're using this mutation to delete a shape from the key-value store when
   * the user deletes a shape from the canvas.
   */
  const deleteShapeFromStorage = useMutation(({ storage }, shapeId) => {
    /**
     * canvasObjects is a Map that contains all the shapes in the key-value.
     * Like a store. We can create multiple stores in liveblocks.
     *
     * delete: https://liveblocks.io/docs/api-reference/liveblocks-client#LiveMap.delete
     */
    const canvasObjects = storage.get("canvasObjects");
    canvasObjects.delete(shapeId);
  }, []);

  /**
   * deleteAllShapes is a mutation that deletes all the shapes from the
   * key-value store of liveblocks.
   *
   * delete: https://liveblocks.io/docs/api-reference/liveblocks-client#LiveMap.delete
   * get: https://liveblocks.io/docs/api-reference/liveblocks-client#LiveMap.get
   *
   * We're using this mutation to delete all the shapes from the key-value store when the user clicks on the reset button.
   */
  const deleteAllShapes = useMutation(({ storage }) => {
    // get the canvasObjects store
    const canvasObjects = storage.get("canvasObjects");

    // if the store doesn't exist or is empty, return
    if (!canvasObjects || canvasObjects.size === 0) return true;

    // delete all the shapes from the store
    for (const [key, value] of canvasObjects.entries()) {
      canvasObjects.delete(key);
    }

    // return true if the store is empty
    return canvasObjects.size === 0;
  }, []);

  /**
   * syncShapeInStorage is a mutation that syncs the shape in the key-value
   * store of liveblocks.
   *
   * We're using this mutation to sync the shape in the key-value store
   * whenever user performs any action on the canvas such as drawing, moving
   * editing, deleting etc.
   */
  const syncShapeInStorage = useMutation(({ storage }, object) => {
    // if the passed object is null, return
    if (!object) return;
    const { objectId } = object;

    /**
     * Turn Fabric object (kclass) into JSON format so that we can store it in the
     * key-value store.
     */
    const shapeData = object.toJSON();
    shapeData.objectId = objectId;

    const canvasObjects = storage.get("canvasObjects");

    // new shapes go on top. Shapes saved before layers existed keep their place
    object.zIndex ??= canvasObjects.has(objectId)
      ? 0
      : Math.max(0, ...Array.from(canvasObjects.values(), (shape) => shape.zIndex ?? 0)) + 1;
    shapeData.zIndex = object.zIndex;

    /**
     * set is a method provided by Liveblocks that allows you to set a value
     *
     * set: https://liveblocks.io/docs/api-reference/liveblocks-client#LiveMap.set
     */
    canvasObjects.set(objectId, shapeData);
  }, []);

  // sync several shapes as a single undo step
  const syncShapesInStorage = (shapes: fabric.Object[]) =>
    batch(() => shapes.forEach((shape) => syncShapeInStorage(shape)));

  // delete the selected shapes as a single undo step
  const deleteSelection = () =>
    batch(() => handleDelete(fabricRef.current as any, deleteShapeFromStorage));

  // refresh the design panel with the selection restored by a render
  const refreshElementAttributes = () => {
    if (isEditingRef.current) return;

    const selected = fabricRef.current?.getActiveObjects() || [];
    setElementAttributes(
      getElementAttributes(selected.length === 1 ? selected[0] : undefined)
    );
  };

  const requestCanvasRender = () => {
    if (!fabricRef.current) return;

    renderCanvas({
      canvas: fabricRef.current,
      canvasObjects: canvasObjectsRef.current,
      isDrawing,
      renderStateRef,
      selectedIdsRef,
      onRendered: refreshElementAttributes,
    });
  };

  // run the render postponed by a drag or text editing once fabric has finished with it
  const flushPendingRender = () => {
    setTimeout(() => {
      if (renderStateRef.current.isPending) requestCanvasRender();
    }, 0);
  };

  // leave whatever tool was active and use the given one
  const activateTool = (tool: string | null) => {
    selectedShapeRef.current = tool;
    isDrawing.current = false;

    if (fabricRef.current) applyToolMode(fabricRef.current, tool);
  };

  /**
   * Set the active element in the navbar and perform the action based
   * on the selected element.
   *
   * @param elem
   */
  const handleActiveElement = (elem: ActiveElement) => {
    setActiveElement(elem);

    switch (elem?.value) {
      // delete all the shapes from the canvas, which affects everyone in the room
      case "reset":
        activateTool(null);
        if (window.confirm("Delete every shape for all the users in this room?")) {
          // clear the storage
          deleteAllShapes();
          // clear the canvas
          fabricRef.current?.clear();
        }
        // set "select" as the active element
        setActiveElement(defaultNavElement);
        break;

      // delete the selected shape from the canvas
      case "delete":
        activateTool(null);
        // delete it from the canvas
        deleteSelection();
        // set "select" as the active element
        setActiveElement(defaultNavElement);
        break;

      // upload an image to the canvas
      case "image":
        activateTool(null);
        // trigger the click event on the input element which opens the file dialog
        imageInputRef.current?.click();
        break;

      // for comments, there is no canvas tool
      case "comments":
        activateTool(null);
        break;

      default:
        // set the selected shape to the selected element
        activateTool(typeof elem?.value === "string" ? elem.value : null);
        break;
    }
  };

  // add the chosen image and leave the input ready to accept the same file again
  const handleImageInputChange = (e: any) => {
    // prevent the default behavior of the input element
    e.stopPropagation();

    const file = e.target.files[0];
    e.target.value = "";
    setActiveElement(defaultNavElement);

    if (!file) return;

    handleImageUpload({
      file,
      canvas: fabricRef as any,
      syncShapeInStorage,
    });
  };

  useEffect(() => {
    // initialize the fabric canvas
    const canvas = initializeFabric({
      canvasRef,
      fabricRef,
    });

    /**
     * listen to the mouse down event on the canvas which is fired when the
     * user clicks on the canvas
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on("mouse:down", (options) => {
      handleCanvasMouseDown({
        options,
        canvas,
        selectedShapeRef,
        isDrawing,
        shapeRef,
        drawOriginRef,
        pauseHistory,
      });
    });

    /**
     * listen to the mouse move event on the canvas which is fired when the
     * user moves the mouse on the canvas
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on("mouse:move", (options) => {
      handleCanvaseMouseMove({
        options,
        canvas,
        isDrawing,
        selectedShapeRef,
        shapeRef,
        drawOriginRef,
        syncShapeInStorage,
      });
    });

    /**
     * listen to the mouse up event on the canvas which is fired when the
     * user releases the mouse on the canvas
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on("mouse:up", () => {
      handleCanvasMouseUp({
        canvas,
        isDrawing,
        shapeRef,
        drawOriginRef,
        selectedShapeRef,
        syncShapeInStorage,
        setActiveElement,
        resumeHistory,
      });
      flushPendingRender();
    });

    // the text being edited is saved when the user leaves it
    canvas.on("text:editing:exited", flushPendingRender);

    /**
     * listen to the path created event on the canvas which is fired when
     * the user creates a path on the canvas using the freeform drawing
     * mode
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on("path:created", (options) => {
      handlePathCreated({
        options,
        syncShapeInStorage,
      });
    });

    /**
     * listen to the object modified event on the canvas which is fired
     * when the user modifies an object on the canvas. Basically, when the
     * user changes the width, height, color etc properties/attributes of
     * the object or moves the object on the canvas.
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on("object:modified", (options) => {
      handleCanvasObjectModified({
        options,
        canvas,
        syncShapeInStorage,
        syncShapesInStorage,
      });
    });

    /**
     * listen to the object moving event on the canvas which is fired
     * when the user moves an object on the canvas.
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas?.on("object:moving", (options) => {
      handleCanvasObjectMoving({
        options,
      });
    });

    /**
     * listen to the selection events on the canvas which are fired when the
     * user selects an object, changes the selection or deselects everything.
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    const onSelectionChanged = () => {
      handleCanvasSelectionChanged({
        canvas,
        renderStateRef,
        selectedIdsRef,
        setElementAttributes,
      });
    };

    canvas.on("selection:created", onSelectionChanged);
    canvas.on("selection:updated", onSelectionChanged);
    canvas.on("selection:cleared", onSelectionChanged);

    /**
     * listen to the scaling event on the canvas which is fired when the
     * user scales an object on the canvas.
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on("object:scaling", (options) => {
      handleCanvasObjectScaling({
        options,
        setElementAttributes,
      });
    });

    /**
     * listen to the mouse wheel event on the canvas which is fired when
     * the user scrolls the mouse wheel on the canvas.
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on("mouse:wheel", (options) => {
      handleCanvasZoom({
        options,
        canvas,
      });
    });

    /**
     * listen to the resize event on the window which is fired when the
     * user resizes the window.
     *
     * We're using this to resize the canvas when the user resizes the
     * window.
     */
    const onWindowResize = () => {
      handleResize({
        canvas: fabricRef.current,
      });
    };

    window.addEventListener("resize", onWindowResize);

    /**
     * listen to the key down event on the window which is fired when the
     * user presses a key on the keyboard.
     *
     * We're using this to perform some actions like delete, copy, paste, etc when the user presses the respective keys on the keyboard.
     */
    const onWindowKeyDown = (e: KeyboardEvent) =>
      handleKeyDown({
        e,
        canvas: fabricRef.current,
        undo,
        redo,
        syncShapesInStorage,
        deleteSelection,
      });

    window.addEventListener("keydown", onWindowKeyDown);

    // dispose the canvas and remove the event listeners when the component unmounts
    return () => {
      // discard any render still loading its images
      renderStateRef.current.version++;

      /**
       * dispose is a method provided by Fabric that allows you to dispose
       * the canvas. It clears the canvas and removes all the event
       * listeners
       *
       * dispose: http://fabricjs.com/docs/fabric.Canvas.html#dispose
       */
      canvas.dispose();

      // remove the event listeners
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [canvasRef]); // run this effect only once when the component mounts and the canvasRef changes

  // render the canvas when the canvasObjects from live storage changes
  useEffect(() => {
    requestCanvasRender();
  }, [canvasObjects]);

  return (
    <main className='flex h-screen flex-col overflow-hidden'>
      <Navbar
        imageInputRef={imageInputRef}
        activeElement={activeElement}
        handleImageUpload={handleImageInputChange}
        handleActiveElement={handleActiveElement}
      />

      <section className='flex min-h-0 flex-1 flex-row'>
        <LeftSidebar allShapes={sortShapeEntries(canvasObjects)} />

        <Live canvasRef={canvasRef} undo={undo} redo={redo} />

        <RightSidebar
          elementAttributes={elementAttributes}
          setElementAttributes={setElementAttributes}
          fabricRef={fabricRef}
          isEditingRef={isEditingRef}
          syncShapeInStorage={syncShapeInStorage}
        />
      </section>

      <ConnectionStatus />
    </main>
  );
};

export default Home;