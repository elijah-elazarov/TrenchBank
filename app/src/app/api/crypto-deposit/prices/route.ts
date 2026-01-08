import { NextResponse } from 'next/server';

// In production, fetch from CoinGecko, CoinMarketCap, or similar API
// For now, using reasonable estimates that can be updated

interface PriceData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  lastUpdated: string;
}

// Cache prices for 5 minutes
let priceCache: { data: Record<string, PriceData>; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchPrices(): Promise<Record<string, PriceData>> {
  // Check cache first
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
    return priceCache.data;
  }

  try {
    // Try to fetch from CoinGecko (free API)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum,tether&vs_currencies=usd&include_24hr_change=true',
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (response.ok) {
      const data = await response.json();
      
      const prices: Record<string, PriceData> = {
        SOL: {
          symbol: 'SOL',
          name: 'Solana',
          price: data.solana?.usd || 185,
          change24h: data.solana?.usd_24h_change || 0,
          lastUpdated: new Date().toISOString(),
        },
        ETH: {
          symbol: 'ETH',
          name: 'Ethereum',
          price: data.ethereum?.usd || 3200,
          change24h: data.ethereum?.usd_24h_change || 0,
          lastUpdated: new Date().toISOString(),
        },
        USDT: {
          symbol: 'USDT',
          name: 'Tether',
          price: data.tether?.usd || 1,
          change24h: data.tether?.usd_24h_change || 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      // Update cache
      priceCache = { data: prices, timestamp: Date.now() };
      return prices;
    }
  } catch (error) {
    console.error('Failed to fetch prices from CoinGecko:', error);
  }

  // Fallback to default prices if API fails
  const fallbackPrices: Record<string, PriceData> = {
    SOL: {
      symbol: 'SOL',
      name: 'Solana',
      price: 185,
      change24h: 0,
      lastUpdated: new Date().toISOString(),
    },
    ETH: {
      symbol: 'ETH',
      name: 'Ethereum',
      price: 3200,
      change24h: 0,
      lastUpdated: new Date().toISOString(),
    },
    USDT: {
      symbol: 'USDT',
      name: 'Tether',
      price: 1,
      change24h: 0,
      lastUpdated: new Date().toISOString(),
    },
  };

  return fallbackPrices;
}

export async function GET() {
  try {
    const prices = await fetchPrices();
    
    return NextResponse.json({
      success: true,
      data: prices,
    });
  } catch (error) {
    console.error('Get prices error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}

