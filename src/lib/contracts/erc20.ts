/**
 * Minimal ERC20 ABI — just what's needed to check and grant the vault an
 * rETH allowance before depositRethAndDesignate/depositReth, which both
 * pull funds via transferFrom rather than accepting a native-value transfer
 * (rETH isn't ETH, so there's no payable shortcut).
 */
export const erc20Abi = [
	'function balanceOf(address account) view returns (uint256)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function approve(address spender, uint256 amount) returns (bool)'
];
