/**
 * Address of the deployed Firstfruits vault. Unset until the contract is
 * deployed; reads/writes should guard on this being defined.
 */
export const FIRSTFRUITS_ADDRESS = import.meta.env.VITE_FIRSTFRUITS_ADDRESS as string | undefined;

/** Address of the Rocket Pool rETH token. */
export const RETH_ADDRESS = import.meta.env.VITE_RETH_ADDRESS as string | undefined;

export const BPS_DENOMINATOR = 10_000n;
export const MAX_ALLOCATIONS = 32;
export const WITHDRAW_ALL = (2n ** 256n - 1n) as bigint;

// Human-readable ABI (ethers.Interface/Contract accept this directly). The
// contract's `Allocation { causeId, bps }` struct is written as an inline
// tuple since ethers v6 doesn't support viem's reusable `struct` shorthand.
export const firstfruitsAbi = [
	// Reads
	'function patrons(address) view returns (uint256 rethBalance, uint256 principalEther, uint256 bankedReth)',
	'function causes(uint256) view returns (address owner, address pendingOwner, address recipient, bool active, string name, uint256 claimableReth, uint256 totalHarvestedReth)',
	'function nextCauseId() view returns (uint256)',
	'function withdrawableEther(address patron) view returns (uint256)',
	'function pendingYield(address patron) view returns (uint256 rethAmount, uint256 etherValue)',
	'function allocationsOf(address patron) view returns (tuple(uint256 causeId, uint256 bps)[] allocations)',
	'function surplusReth() view returns (uint256)',
	'function totalPatronReth() view returns (uint256)',
	'function totalPrincipalEther() view returns (uint256)',
	'function totalBankedReth() view returns (uint256)',
	'function totalClaimableReth() view returns (uint256)',

	// Patron actions
	'function deposit() payable',
	'function depositAndDesignate(tuple(uint256 causeId, uint256 bps)[] splits) payable',
	'function depositReth(uint256 rethAmount)',
	'function depositRethAndDesignate(uint256 rethAmount, tuple(uint256 causeId, uint256 bps)[] splits)',
	'function designate(tuple(uint256 causeId, uint256 bps)[] splits)',
	'function harvest(address patron) returns (uint256)',
	'function harvestMany(address[] patronList)',
	'function withdraw(uint256 etherAmount)',
	'function withdrawReth(uint256 rethAmount)',
	'function withdrawBank(uint256 rethAmount)',
	'function withdrawBankReth(uint256 rethAmount)',

	// Causes
	'function createCause(address causeOwner, address recipient, string name) returns (uint256)',
	'function setCauseRecipient(uint256 causeId, address recipient)',
	'function setCauseActive(uint256 causeId, bool active)',
	'function transferCauseOwnership(uint256 causeId, address newOwner)',
	'function acceptCauseOwnership(uint256 causeId)',
	'function claimReth(uint256 causeId)',
	'function claimEther(uint256 causeId)',
	'function sweepSurplus(uint256 causeId) returns (uint256)',

	// Events
	'event CauseCreated(uint256 indexed causeId, address indexed owner, address indexed recipient, string name)',
	'event CauseActiveSet(uint256 indexed causeId, bool active)',
	'event Deposited(address indexed patron, uint256 rethAmount, uint256 principalAdded)',
	'event Withdrawn(address indexed patron, uint256 etherAmount, uint256 rethBurned)',
	'event WithdrawnReth(address indexed patron, uint256 rethAmount, uint256 principalReduced)',
	'event Designated(address indexed patron, tuple(uint256 causeId, uint256 bps)[] allocations)',
	'event Harvested(address indexed patron, uint256 rethAmount)',
	'event YieldAllocated(address indexed patron, uint256 indexed causeId, uint256 rethAmount)',
	'event YieldBanked(address indexed patron, uint256 rethAmount)',
	'event ClaimedReth(uint256 indexed causeId, address indexed recipient, uint256 rethAmount)',
	'event ClaimedEther(uint256 indexed causeId, address indexed recipient, uint256 rethBurned, uint256 etherAmount)'
];
