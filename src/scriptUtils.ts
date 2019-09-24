const head = document.head;

export function loadScript(
  src: string,
  onLoad: () => void,
  onError: () => void
) {
  const script = document.createElement('script');

  script.crossOrigin = 'anonymous';

  script.onload = () => {
    onLoad();
    head.removeChild(script);
  };

  script.onerror = () => {
    onError();
    head.removeChild(script);
  };

  script.src = src;

  head.appendChild(script);
}
