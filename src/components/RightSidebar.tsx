import React, { useRef } from "react";
import Dimensions from "./settings/Dimensions";
import LayerOrder from "./settings/LayerOrder";
import Text from "./settings/Text";
import Color from "./settings/Color";
import Export from "./settings/Export";
import { RightSidebarProps } from "@/types/type";
import { bringElement, modifyShape } from "@/lib/shapes";
import { getElementAttributes } from "@/lib/canvas";

const RightSidebar = ({
  elementAttributes,
  setElementAttributes,
  fabricRef,
  isEditingRef,
  syncShapeInStorage,
}: RightSidebarProps) => {

  const handleInputChange = (property: string, value: string) => {
    // while a size is being typed, a render must not overwrite the field
    if (property === "width" || property === "height") isEditingRef.current = true;

    setElementAttributes((prev) => ({
      ...prev,
      [property]: value,
    }));

    modifyShape({
      canvas:fabricRef.current as fabric.Canvas,value,property,
      syncShapeInStorage
    })
  };

  // show the real size again in case the typed value was not valid
  const handleDimensionBlur = () => {
    isEditingRef.current = false;

    const selected = fabricRef.current?.getActiveObjects() || [];
    if (selected.length !== 1) return;

    const { width, height } = getElementAttributes(selected[0]);
    setElementAttributes((prev) => ({ ...prev, width, height }));
  };

  const handleLayerOrder = (direction: string) => {
    bringElement({
      canvas: fabricRef.current as fabric.Canvas,
      direction,
      syncShapeInStorage,
    });
  };

const colorInputRef = useRef(null)
const strokeInputRef = useRef(null)

  return (
    <section className="flex flex-col border-t border-primary-grey-200 bg-primary-black text-primary-grey-300 w-[263px] shrink-0 sticky right-0 h-full max-sm:hidden select-none overflow-y-auto">
      <h3 className="px-5 pt-4 text-xs uppercase">Design</h3>
      <span className="text-xs text-primary-grey-300 mt-3 px-5 border-b border-primary-grey-200 pb-4">
        Make changes to canvas as you like
      </span>
      <Dimensions
        handleDimensionBlur={handleDimensionBlur}
        handleInputChange={handleInputChange}
        height={elementAttributes.height}
        width={elementAttributes.width}
      />
      <LayerOrder handleLayerOrder={handleLayerOrder} />
      <Text
      fontFamily={elementAttributes.fontFamily}
      fontSize={elementAttributes.fontSize}
      fontWeight={elementAttributes.fontWeight}
      handleInputChange={handleInputChange}
      />
      <Color inputRef={colorInputRef}
      attribute={elementAttributes.fill}
      placeholder="fill"
      handleInputChange={handleInputChange}
      attributeType="fill"
      />
      <Color inputRef={strokeInputRef}
      attribute={elementAttributes.stroke}
      placeholder="stroke"
      handleInputChange={handleInputChange}
      attributeType="stroke"
      />

      <Export />
    </section>
  );
};

export default RightSidebar;
