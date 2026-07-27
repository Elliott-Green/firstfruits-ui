/**
 * Mock causes for local/demo use — the real vault only has one cause on
 * mainnet right now, which isn't enough to fill out a cycling marquee.
 * Shaped identically to the live-hydrated cause data so consumers don't
 * care which one they're rendering.
 */
export type MockCause = {
	causeId: string;
	name: string;
	recipient: string;
	owner: string;
	curated: boolean;
	active: boolean;
	totalHarvestedEther: string;
};

export const MOCK_CAUSES: MockCause[] = [
	{
		causeId: '1001',
		name: 'Ocean Cleanup',
		recipient: '0x1111111111111111111111111111111111111111',
		owner: '0x1111111111111111111111111111111111111111',
		curated: true,
		active: true,
		totalHarvestedEther: '0.842'
	},
	{
		causeId: '1002',
		name: 'Reforestation Fund',
		recipient: '0x2222222222222222222222222222222222222222',
		owner: '0x2222222222222222222222222222222222222222',
		curated: true,
		active: true,
		totalHarvestedEther: '0.317'
	},
	{
		causeId: '1003',
		name: 'Open Source Education',
		recipient: '0x3333333333333333333333333333333333333333',
		owner: '0x9999999999999999999999999999999999999999',
		curated: false,
		active: true,
		totalHarvestedEther: '0.104'
	},
	{
		causeId: '1004',
		name: 'Global Health Access',
		recipient: '0x4444444444444444444444444444444444444444',
		owner: '0x4444444444444444444444444444444444444444',
		curated: true,
		active: true,
		totalHarvestedEther: '1.203'
	},
	{
		causeId: '1005',
		name: 'Wildlife Sanctuary',
		recipient: '0x5555555555555555555555555555555555555555',
		owner: '0x5555555555555555555555555555555555555555',
		curated: false,
		active: false,
		totalHarvestedEther: '0.056'
	},
	{
		causeId: '1006',
		name: 'Clean Water Initiative',
		recipient: '0x6666666666666666666666666666666666666666',
		owner: '0x6666666666666666666666666666666666666666',
		curated: false,
		active: true,
		totalHarvestedEther: '0.021'
	}
];
