// Buttons that move the selected element to the front or to the back of the canvas.
import Image from "next/image";

import { directionOptions } from "@/constants";

import { Button } from "../ui/button";

type Props = {
  handleLayerOrder: (direction: string) => void;
};

const LayerOrder = ({ handleLayerOrder }: Props) => (
  <div className='flex flex-col gap-3 border-b border-primary-grey-200 px-5 py-3'>
    <h3 className='text-[10px] uppercase'>Layer order</h3>
    <div className='flex gap-2'>
      {directionOptions.map((item) => (
        <Button
          key={item.value}
          variant='outline'
          title={item.label}
          aria-label={item.label}
          className='flex-1 border border-primary-grey-200 hover:bg-primary-grey-200'
          onClick={() => handleLayerOrder(item.value)}
        >
          <Image src={item.icon} alt='' width={16} height={16} />
        </Button>
      ))}
    </div>
  </div>
);

export default LayerOrder;
