import { loadScript } from "./scriptUtils";

const createElementSpy = jest.spyOn(document, "createElement");
const appendChildSpy = jest.spyOn(document.head, "appendChild");
const removeChildSpy = jest.spyOn(document.head, "removeChild");

describe("loadScript()", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("when the script loads successfully, triggers onLoad and removes script", () => {
    const scriptStub = setupScriptStub();

    const src = "//dummy/src.js";

    const onLoad = jest.fn();
    const onError = jest.fn();

    loadScript(src, onLoad, onError);

    // fire script's onload
    scriptStub.onload();

    expect(scriptStub).toEqual({
      src,
      crossOrigin: "anonymous",
      onload: expect.any(Function),
      onerror: expect.any(Function),
    });

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(0);

    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(scriptStub);

    expect(removeChildSpy).toHaveBeenCalledTimes(1);
    expect(removeChildSpy).toHaveBeenCalledWith(scriptStub);
  });

  test("when the script fails to load, triggers onError and removes script", () => {
    const scriptStub = setupScriptStub();

    const src = "//dummy/src.js";

    const onLoad = jest.fn();
    const onError = jest.fn();

    loadScript(src, onLoad, onError);

    // fire script's onerror
    scriptStub.onerror();

    expect(scriptStub).toEqual({
      src,
      crossOrigin: "anonymous",
      onload: expect.any(Function),
      onerror: expect.any(Function),
    });

    expect(onLoad).toHaveBeenCalledTimes(0);
    expect(onError).toHaveBeenCalledTimes(1);

    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(scriptStub);

    expect(removeChildSpy).toHaveBeenCalledTimes(1);
    expect(removeChildSpy).toHaveBeenCalledWith(scriptStub);
  });
});

function setupScriptStub() {
  const scriptStub: any = {};

  createElementSpy.mockImplementationOnce(tagName => {
    if (tagName !== "script") {
      throw new Error("document.createElement was not called with 'script'");
    }

    return scriptStub as HTMLElement;
  });

  return scriptStub;
}
