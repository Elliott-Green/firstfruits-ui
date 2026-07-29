import type { MetaTagsProps } from 'svelte-meta-tags';
import { ogImageUrl } from '$lib/og';
import type { LayoutLoad } from './$types';

const TITLE = 'Firstfruits — Charitable Giving on Ethereum';
const DESCRIPTION =
	'Charitable giving on Ethereum. Stake ETH or rETH into the vault — your principal stays withdrawable, and the Rocket Pool staking yield it earns is routed to causes you choose.';

export const load: LayoutLoad = ({ url }) => {
	const canonical = `${url.origin}${url.pathname}`;
	const image = ogImageUrl(url.origin, TITLE, DESCRIPTION);

	const baseMetaTags: MetaTagsProps = {
		title: TITLE,
		titleTemplate: '%s · Firstfruits',
		description: DESCRIPTION,
		canonical,
		openGraph: {
			type: 'website',
			url: canonical,
			locale: 'en_US',
			siteName: 'Firstfruits',
			title: TITLE,
			description: DESCRIPTION,
			images: [{ url: image, width: 1200, height: 630, alt: TITLE }]
		},
		twitter: {
			cardType: 'summary_large_image',
			title: 'Firstfruits',
			description: DESCRIPTION,
			image
		}
	};

	return { baseMetaTags };
};
