export const productNames = {
  studio: 'Studio',
  server: 'Server',
  observability: 'Observability',
  factory: 'Factory',
  workers: 'Workers',
  'persistent-server': 'Persistent Server',
};

export type Product = keyof typeof productNames;

export const productColors: Record<Product, string> = {
  studio: 'bg-product-studio-bg text-product-studio-fg',
  server: 'bg-product-server-bg text-product-server-fg',
  observability: 'bg-product-observability-bg text-product-observability-fg',
  factory: 'bg-product-factory-bg text-product-factory-fg',
  workers: 'bg-product-workers-bg text-product-workers-fg',
  'persistent-server': 'bg-product-persistent-server-bg text-product-persistent-server-fg',
};
