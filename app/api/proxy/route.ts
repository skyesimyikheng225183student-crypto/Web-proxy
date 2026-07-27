import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Security: Blocked domains/patterns to prevent abuse
const BLOCKED_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/,
  /192\.168\./,
  /10\.\d+\./,
  /172\.(1[6-9]|2\d|3[01])\./,
];

const isBlockedDomain = (hostname: string): boolean => {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(hostname));
};

const getProxiedHeaders = (
  originalHeaders: Headers,
  targetOrigin: string
): Record<string, string> => {
  const headers: Record<string, string> = {};

  // Copy safe headers
  const safeHeaders = [
    'user-agent',
    'accept',
    'accept-language',
    'accept-encoding',
    'cache-control',
  ];

  safeHeaders.forEach(header => {
    const value = originalHeaders.get(header);
    if (value) headers[header] = value;
  });

  headers['referer'] = targetOrigin;
  headers['origin'] = targetOrigin;

  return headers;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Security: Block local/private networks
    if (isBlockedDomain(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: 'Access to this domain is not allowed' },
        { status: 403 }
      );
    }

    // Fetch the target website
    const response = await axios.get(targetUrl, {
      headers: getProxiedHeaders(request.headers, parsedUrl.origin),
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: () => true, // Accept all status codes
    });

    const contentType = response.headers['content-type'] || 'text/html';

    // For HTML, inject CORS headers and modify content
    if (contentType.includes('text/html')) {
      let html = response.data;

      // Add meta tag for viewport (if not present)
      if (!html.includes('viewport')) {
        html = html.replace(
          /<head[^>]*>/i,
          `$&<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover">`
        );
      }

      return new NextResponse(html, {
        status: response.status,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache, no-store, must-revalidate',
          'access-control-allow-origin': '*',
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'ALLOWALL',
        },
      });
    }

    // For other content types, pass through
    return new NextResponse(response.data, {
      status: response.status,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=3600',
        'access-control-allow-origin': '*',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return NextResponse.json(
          { error: 'Website is unreachable' },
          { status: 503 }
        );
      }

      if (error.code === 'ECONNABORTED') {
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch website' },
      { status: 500 }
    );
  }
}
