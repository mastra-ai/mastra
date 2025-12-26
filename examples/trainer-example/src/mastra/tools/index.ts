import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Simulated product database
const products: Record<string, { name: string; price: number; stock: number; category: string }> = {
  'PROD-001': { name: 'Wireless Headphones', price: 79.99, stock: 45, category: 'Electronics' },
  'PROD-002': { name: 'USB-C Charging Cable', price: 12.99, stock: 200, category: 'Electronics' },
  'PROD-003': { name: 'Laptop Stand', price: 49.99, stock: 30, category: 'Accessories' },
  'PROD-004': { name: 'Mechanical Keyboard', price: 129.99, stock: 15, category: 'Electronics' },
  'PROD-005': { name: 'Webcam HD 1080p', price: 59.99, stock: 60, category: 'Electronics' },
  'PROD-006': { name: 'Mouse Pad XL', price: 19.99, stock: 100, category: 'Accessories' },
  'PROD-007': { name: 'Monitor Light Bar', price: 39.99, stock: 25, category: 'Accessories' },
  'PROD-008': { name: 'Bluetooth Speaker', price: 34.99, stock: 80, category: 'Electronics' },
};

// Simulated order database
const orders: Record<string, { customerId: string; products: string[]; status: string; total: number; date: string }> =
  {
    'ORD-1001': {
      customerId: 'CUST-100',
      products: ['PROD-001', 'PROD-002'],
      status: 'delivered',
      total: 92.98,
      date: '2024-12-15',
    },
    'ORD-1002': {
      customerId: 'CUST-101',
      products: ['PROD-004'],
      status: 'shipped',
      total: 129.99,
      date: '2024-12-20',
    },
    'ORD-1003': {
      customerId: 'CUST-100',
      products: ['PROD-003', 'PROD-006'],
      status: 'processing',
      total: 69.98,
      date: '2024-12-24',
    },
    'ORD-1004': {
      customerId: 'CUST-102',
      products: ['PROD-005', 'PROD-007', 'PROD-008'],
      status: 'pending',
      total: 134.97,
      date: '2024-12-25',
    },
    'ORD-1005': {
      customerId: 'CUST-103',
      products: ['PROD-001'],
      status: 'cancelled',
      total: 79.99,
      date: '2024-12-22',
    },
  };

// Simulated customer database
const customers: Record<string, { name: string; email: string; tier: string; totalOrders: number }> = {
  'CUST-100': { name: 'Alice Johnson', email: 'alice@example.com', tier: 'gold', totalOrders: 15 },
  'CUST-101': { name: 'Bob Smith', email: 'bob@example.com', tier: 'silver', totalOrders: 8 },
  'CUST-102': { name: 'Carol Davis', email: 'carol@example.com', tier: 'bronze', totalOrders: 3 },
  'CUST-103': { name: 'David Wilson', email: 'david@example.com', tier: 'bronze', totalOrders: 2 },
};

/**
 * Tool to look up product information by ID
 */
export const lookupProductTool = createTool({
  id: 'lookup-product',
  description: 'Look up product information by product ID. Returns name, price, stock, and category.',
  inputSchema: z.object({
    productId: z.string().describe('The product ID (e.g., PROD-001)'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    product: z
      .object({
        id: z.string(),
        name: z.string(),
        price: z.number(),
        stock: z.number(),
        category: z.string(),
        inStock: z.boolean(),
      })
      .optional(),
  }),
  execute: async ({ productId }) => {
    const product = products[productId];
    if (!product) {
      return { found: false };
    }
    return {
      found: true,
      product: {
        id: productId,
        ...product,
        inStock: product.stock > 0,
      },
    };
  },
});

/**
 * Tool to look up order status and details
 */
export const lookupOrderTool = createTool({
  id: 'lookup-order',
  description: 'Look up order status and details by order ID. Returns order status, products, total, and date.',
  inputSchema: z.object({
    orderId: z.string().describe('The order ID (e.g., ORD-1001)'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    order: z
      .object({
        id: z.string(),
        status: z.string(),
        products: z.array(z.string()),
        total: z.number(),
        date: z.string(),
        customerId: z.string(),
      })
      .optional(),
  }),
  execute: async ({ orderId }) => {
    const order = orders[orderId];
    if (!order) {
      return { found: false };
    }
    return {
      found: true,
      order: {
        id: orderId,
        ...order,
      },
    };
  },
});

/**
 * Tool to look up customer information
 */
export const lookupCustomerTool = createTool({
  id: 'lookup-customer',
  description:
    'Look up customer information by customer ID. Returns name, email, membership tier, and order history count.',
  inputSchema: z.object({
    customerId: z.string().describe('The customer ID (e.g., CUST-100)'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    customer: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        tier: z.string(),
        totalOrders: z.number(),
      })
      .optional(),
  }),
  execute: async ({ customerId }) => {
    const customer = customers[customerId];
    if (!customer) {
      return { found: false };
    }
    return {
      found: true,
      customer: {
        id: customerId,
        ...customer,
      },
    };
  },
});

/**
 * Tool to initiate a refund request
 */
export const initiateRefundTool = createTool({
  id: 'initiate-refund',
  description: 'Initiate a refund request for an order. Only works for delivered or cancelled orders.',
  inputSchema: z.object({
    orderId: z.string().describe('The order ID to refund'),
    reason: z.string().describe('Reason for the refund'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    refundId: z.string().optional(),
    message: z.string(),
    amount: z.number().optional(),
  }),
  execute: async ({ orderId, reason }) => {
    const order = orders[orderId];
    if (!order) {
      return { success: false, message: 'Order not found' };
    }
    if (order.status === 'pending' || order.status === 'processing' || order.status === 'shipped') {
      return {
        success: false,
        message: `Cannot refund order in ${order.status} status. Please wait for delivery or cancel the order first.`,
      };
    }
    const refundId = `REF-${Date.now()}`;
    return {
      success: true,
      refundId,
      message: `Refund initiated successfully. Reason: ${reason}`,
      amount: order.total,
    };
  },
});

/**
 * Tool to check product availability and estimated delivery
 */
export const checkAvailabilityTool = createTool({
  id: 'check-availability',
  description: 'Check product availability and estimated delivery time for a specific location.',
  inputSchema: z.object({
    productId: z.string().describe('The product ID'),
    zipCode: z.string().describe('Delivery ZIP code'),
  }),
  outputSchema: z.object({
    available: z.boolean(),
    stockLevel: z.enum(['in_stock', 'low_stock', 'out_of_stock']),
    estimatedDelivery: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ productId, zipCode }) => {
    const product = products[productId];
    if (!product) {
      return { available: false, stockLevel: 'out_of_stock' as const, message: 'Product not found' };
    }

    const stockLevel = product.stock > 20 ? 'in_stock' : product.stock > 0 ? 'low_stock' : 'out_of_stock';
    const baseDeliveryDays = zipCode.startsWith('9') ? 2 : zipCode.startsWith('1') ? 3 : 5;

    if (stockLevel === 'out_of_stock') {
      return { available: false, stockLevel, message: 'This product is currently out of stock' };
    }

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + baseDeliveryDays);

    return {
      available: true,
      stockLevel,
      estimatedDelivery: deliveryDate.toISOString().split('T')[0],
      message:
        stockLevel === 'low_stock'
          ? `Only ${product.stock} units left! Estimated delivery: ${baseDeliveryDays} business days`
          : `In stock. Estimated delivery: ${baseDeliveryDays} business days`,
    };
  },
});
