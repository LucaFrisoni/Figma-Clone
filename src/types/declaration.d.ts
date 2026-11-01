declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

// Custom properties kept on every fabric object
declare module "fabric/fabric-impl" {
  interface Object {
    objectId?: string;
    zIndex?: number;
  }
}

export {};
