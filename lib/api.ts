import { supabase, supabaseUrl, supabaseAnonKey, getClerkToken } from './supabase';

export interface AIProductResult {
  title: string;
  description: string;
  category: string;
  tags: string[];
  suggestedPrice: number;
  condition: string;
  keyFeatures: string[];
}

// Resize + re-compress the image on the client before sending to the edge function.
// Reduces payload from ~500 KB to ~40-80 KB with no meaningful loss for AI analysis.
async function compressForAnalysis(base64: string): Promise<string> {
  if (typeof document === 'undefined') return base64; // native: skip
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
      resolve(compressed ?? base64);
    };
    img.onerror = () => resolve(base64);
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

export async function analyzeProductImage(
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<AIProductResult> {
  const compressed = await compressForAnalysis(imageBase64);
  const { data, error } = await supabase.functions.invoke('analyze-product', {
    body: { imageBase64: compressed, mimeType: 'image/jpeg' },
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.result as AIProductResult;
}

export async function uploadProductImage(
  base64: string,
  mimeType = 'image/jpeg'
): Promise<string> {
  const token = await getClerkToken();
  if (!token) throw new Error('Image upload failed: not authenticated');
  const resp = await fetch(`${supabaseUrl}/functions/v1/upload-product-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ base64, mimeType }),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(`Image upload failed: ${data.error ?? resp.statusText}`);
  return data.imageUrl as string;
}

export interface ShopifyPublishOptions {
  title: string;
  description: string;
  price: number;
  tags: string[];
  imageUrl?: string;
  status?: 'draft' | 'active';
}

export interface ShopifyPublishResult {
  productId: string;
  shopifyUrl: string;
  adminUrl: string;
}

export async function publishToShopify(
  opts: ShopifyPublishOptions
): Promise<ShopifyPublishResult> {
  const { data, error } = await supabase.functions.invoke('shopify-create-product', {
    body: opts,
  });
  if (error) throw new Error(error.message);
  if (data.error === 'shopify_not_configured') throw new Error('shopify_not_configured');
  if (data.error === 'shopify_error') {
    const detail = (data.details as Array<{ message: string }>)?.[0]?.message ?? 'Shopify error';
    throw new Error(detail);
  }
  if (data.error) throw new Error(data.error);
  return {
    productId: data.productId,
    shopifyUrl: data.shopifyUrl,
    adminUrl: data.adminUrl,
  };
}
