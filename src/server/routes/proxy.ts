import { Router } from 'express';

export const proxyRouter = Router();

// GET /proxy/image?url=... — proxy Bazaraki images with correct referer
proxyRouter.get('/image', async (req, res) => {
  const url = req.query.url as string;
  if (!url || !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid url' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://www.bazaraki.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) return res.status(response.status).end();

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
