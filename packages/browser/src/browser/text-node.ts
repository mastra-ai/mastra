export function isTextNode(node: Node) {
  return node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim());
}
