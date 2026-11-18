export const $ = (id) => document.getElementById(id);

/** Creates an element; text is set with textContent so content can never run as HTML. */
export function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}
