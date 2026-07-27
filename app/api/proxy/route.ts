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
  headers['user-agent'] = 'Mozilla/5.0 (compatible; Web-Proxy/1.0)';

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

    // Fetch the target website with proper error handling
    let response;
    try {
      response = await axios.get(targetUrl, {
        headers: getProxiedHeaders(request.headers, parsedUrl.origin),
        timeout: 15000,
        maxRedirects: 10,
        validateStatus: () => true,
      });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to reach website' },
        { status: 503 }
      );
    }

    const contentTypeHeader = response.headers['content-type'];
    const contentType = typeof contentTypeHeader === 'string' 
      ? contentTypeHeader 
      : 'text/html; charset=utf-8';

    // Return response with proper headers
    const responseHeaders: Record<string, string> = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
      'x-content-type-options': 'nosniff',
    };

    if (contentType.includes('text/html')) {
      responseHeaders['content-type'] = 'text/html; charset=utf-8';
      responseHeaders['cache-control'] = 'no-cache, no-store, must-revalidate';
      responseHeaders['x-frame-options'] = 'ALLOWALL';
    } else {
      responseHeaders['content-type'] = contentType;
      responseHeaders['cache-control'] = 'public, max-age=3600';
    }

    return new NextResponse(response.data, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal proxy error' },
      { status: 500 }
    );
  }
}
