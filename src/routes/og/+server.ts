import { ImageResponse } from '@vercel/og';
import type { RequestHandler } from './$types';

const WIDTH = 1200;
const HEIGHT = 630;

// Satori (which @vercel/og renders through) can't use system/CSS fonts by
// name — it needs the actual font bytes. Google's CSS endpoint normally
// serves woff2, which satori can't parse, but an old-Chrome user agent makes
// it fall back to ttf.
async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
	const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`;
	const css = await fetch(cssUrl, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
		}
	}).then((res) => res.text());
	const fontUrl = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype|woff)'\)/)?.[1];
	if (!fontUrl) throw new Error(`Could not resolve a font URL for ${family} ${weight}`);
	return fetch(fontUrl).then((res) => res.arrayBuffer());
}

// Not JSX (this is a plain .ts file, and the project has no React/JSX
// tooling) — satori only needs plain objects shaped like elements, so this
// small helper stands in for it.
function h(type: string, props: Record<string, unknown>, ...children: unknown[]) {
	return { type, props: { ...props, children: children.length === 1 ? children[0] : children } };
}

function badge(text: string) {
	return h(
		'div',
		{
			style: {
				display: 'flex',
				fontSize: 18,
				color: '#d1d5db',
				border: '1px solid #ffffff2a',
				borderRadius: 999,
				padding: '10px 20px'
			}
		},
		text
	);
}

export const GET: RequestHandler = async ({ url }) => {
	const title = url.searchParams.get('title') ?? 'Firstfruits';
	const description =
		url.searchParams.get('description') ??
		'Charitable giving on Ethereum. Stake ETH or rETH — your principal stays withdrawable, and the yield it earns is routed to causes you choose.';

	const logoUrl = `${url.origin}/og/logo-white.png`;

	const tree = h(
		'div',
		{
			style: {
				width: WIDTH,
				height: HEIGHT,
				display: 'flex',
				position: 'relative',
				flexDirection: 'column',
				justifyContent: 'space-between',
				padding: 64,
				backgroundColor: '#0a0a0d',
				backgroundImage: 'linear-gradient(135deg, #0a0a0d 0%, #0f1420 55%, #101b2e 100%)',
				fontFamily: 'Inter',
				overflow: 'hidden'
			}
		},
		// Thin brand-color accent across the top edge — simpler and more
		// reliable across satori's renderer than a radial glow, which kept
		// showing a hard rectangular clip instead of a soft fade.
		h('div', {
			style: {
				display: 'flex',
				position: 'absolute',
				top: 0,
				left: 0,
				width: WIDTH,
				height: 8,
				backgroundColor: '#3b82f6'
			}
		}),
		// Wordmark.
		h(
			'div',
			{ style: { display: 'flex', alignItems: 'center', gap: 16 } },
			h('img', { src: logoUrl, width: 56, height: 56 }),
			h('div', { style: { display: 'flex', fontSize: 32, fontWeight: 700, color: '#ffffff' } }, 'Firstfruits')
		),
		// Title + description.
		h(
			'div',
			{ style: { display: 'flex', flexDirection: 'column', maxWidth: 980 } },
			h(
				'div',
				{
					style: {
						display: 'flex',
						fontSize: 66,
						fontWeight: 700,
						color: '#ffffff',
						lineHeight: 1.15,
						letterSpacing: -1
					}
				},
				title
			),
			h(
				'div',
				{
					style: {
						display: 'flex',
						marginTop: 24,
						fontSize: 26,
						fontWeight: 400,
						color: '#9ca3af',
						lineHeight: 1.5
					}
				},
				description
			)
		),
		// Footer row.
		h(
			'div',
			{ style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
			h('div', { style: { display: 'flex', gap: 14 } }, badge('Non-custodial'), badge('rETH-powered'), badge('Open source')),
			h('div', { style: { display: 'flex', fontSize: 22, fontWeight: 600, color: '#60a5fa' } }, 'firstfruits')
		)
	);

	return new ImageResponse(tree as never, {
		width: WIDTH,
		height: HEIGHT,
		fonts: [
			{ name: 'Inter', data: await loadGoogleFont('Inter', 400), weight: 400, style: 'normal' },
			{ name: 'Inter', data: await loadGoogleFont('Inter', 700), weight: 700, style: 'normal' }
		]
	});
};
