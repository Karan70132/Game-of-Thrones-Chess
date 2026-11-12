"""Render the flat-board piece images from dist/pieces-hd.glb.

Needs: `python -m http.server 8767` running in the project folder, Playwright and Google Chrome.
Writes dist/img/pieces/{w,b}{K,Q,R,B,N,P}.webp (512 x 512).
"""
import asyncio
import base64
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome',
                                    args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = await b.new_page(viewport={'width': 1600, 'height': 1200})
        page.on('console', lambda m: print('console:', m.text))
        page.on('pageerror', lambda e: print('error:', e))
        await page.goto('http://127.0.0.1:8767/web/hd/sprites.html')
        await page.wait_for_function('window.__sprites', timeout=300000)
        sprites = await page.evaluate('window.__sprites')
        for name, url in sprites.items():
            out = ROOT / 'dist' / 'img' / 'pieces' / f'{name}.webp'
            out.write_bytes(base64.b64decode(url.split(',', 1)[1]))
            print(out.name, out.stat().st_size)
        await b.close()

asyncio.run(main())
