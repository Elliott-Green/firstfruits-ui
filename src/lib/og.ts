/** Builds the URL for the dynamically-generated OG/Twitter card image (see src/routes/og/+server.ts). */
export function ogImageUrl(origin: string, title: string, description: string): string {
	const params = new URLSearchParams({ title, description });
	return `${origin}/og?${params.toString()}`;
}
