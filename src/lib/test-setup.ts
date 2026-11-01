// Test setup: gives fabric a fake 2D context, since the simulated browser can't paint.
// The tests check shape data and geometry, which don't depend on actual painting.
const fakeContext = () =>
  new Proxy(
    {},
    {
      get: (target: Record<string | symbol, unknown>, property) =>
        property in target
          ? target[property]
          : () => ({ width: 0, data: new Uint8ClampedArray(4) }),
      set: (target, property, value) => {
        target[property] = value;
        return true;
      },
    }
  );

HTMLCanvasElement.prototype.getContext = (() => fakeContext()) as any;
