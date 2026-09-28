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
  studio: 'bg-product-studio text-product-studio-fg',
  server: 'bg-product-server text-product-server-fg',
  observability: 'bg-product-observability text-product-observability-fg',
  factory: 'bg-product-factory text-product-factory-fg',
  workers: 'bg-product-workers text-product-workers-fg',
  'persistent-server': 'bg-product-persistent-server text-product-persistent-server-fg',
};
