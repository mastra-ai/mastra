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
  studio: 'bg-product-studio text-product-studio-foreground',
  server: 'bg-product-server text-product-server-foreground',
  observability: 'bg-product-observability text-product-observability-foreground',
  factory: 'bg-product-factory text-product-factory-foreground',
  workers: 'bg-product-workers text-product-workers-foreground',
  'persistent-server': 'bg-product-persistent-server text-product-persistent-server-foreground',
};
