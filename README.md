# Firstfruits

> The first of the first fruits of thy land thou shalt bring into the house of the Lord

Charitable giving on Ethereum. Patrons stake ETH or rETH into a vault, which
holds it in [Rocket Pool](https://rocketpool.net/) rETH. Principal always
stays the patron's own and is withdrawable at any time — only the staking
_yield_ it earns is routed to causes, split in whatever percentages the
patron chooses.

Contracts are deployed on mainnet:

- Firstfruits vault: [`0xff0000000674ffb069f73038b0a54c7937552088`](https://etherscan.io/address/0xff0000000674ffb069f73038b0a54c7937552088#code)
- rETH: [`0xae78736Cd615f374D3085123A210448E74Fc6393`](https://etherscan.io/token/0xae78736cd615f374d3085123a210448e74fc6393#code)

See the [contracts repo](https://github.com/unattended-backpack/firstfruits) for the Solidity source.

## Features

- **Deposit ETH or rETH** — ETH is staked into Rocket Pool on deposit; rETH can be staked directly.
- **Split yield across causes** — allocate yield to one or more causes by basis points, and rebalance the split at any time.
- **Permissionless cause creation** — anyone can create a cause, naming an owner and a recipient address.
- **Harvest** — permissionless; anyone can harvest accrued yield for any patron, routing it to that patron's chosen causes.
- **Withdraw** — principal (as ETH or rETH) is always withdrawable.
- **Dashboard** — a patron's own position: withdrawable principal, rETH held, pending yield, lifetime donated, deposit/withdraw/harvest, and a getting-started wizard.
- **Causes directory** — every cause, how much yield it's received, how many patrons support it, and (paginated, 25/page) cached client-side.
- **Cause owner controls** — an owner sees a "Manage Your Causes" panel to toggle a cause active/inactive and update its recipient address, inline.
- **Claimable-causes banner** — shown on every page when the connected wallet is a cause's recipient with a nonzero claimable balance: names the cause, the ETH value (converted from rETH via the live redemption rate) and its USD price, and claims it in one click.
- **Patron leaderboard** — every patron, ranked by lifetime yield donated, with claimable-yield harvesting (single or bulk), paginated (25/page).
- **Live USD pricing** — ETH amounts price directly off a live feed; rETH amounts convert through rETH's on-chain redemption rate first, then to USD, rather than relying on a separately-quoted rETH price.
- **Dynamic OG images** — each page gets its own generated `og:image`/`twitter:image` (title, description, and brand styling baked in server-side), rather than one static image site-wide.

## Limitations

Deliberate gaps against the full contract surface — the contract supports more than this UI exposes, by choice rather than oversight:

- **Banked yield is minimized, not eliminated.** The UI requires a patron's designation to sum to exactly 100% before it will let them deposit or save splits at all (`totalBps !== bpsDenominator` disables both buttons) — specifically so yield is never left undesignated. That avoids the _common_ way `bankedReth` fills up, but not all of it: `_allocate`'s bps-based split still floors each cause's share, so a few wei of rounding dust lands in the bank on every harvest regardless. There's currently no UI for `withdrawBank`/`withdrawBankReth` to reclaim that dust.
- **Cause ownership transfer is contract-only.** `transferCauseOwnership`/`acceptCauseOwnership` (the two-step handover) aren't wired to anything — an owner can change a cause's _recipient_ and _active_ status from the Causes page, but handing off _ownership_ itself has to be done by calling the contract directly (Etherscan, cast, etc.).
- **Claiming is ETH-only.** The claimable-causes banner only calls `claimEther`, never `claimReth` — a deliberate choice (recipients are shown one ETH amount, not asked to pick a form), not a missing feature. `claimReth` is otherwise unused.
- **No sweep-surplus UI.** `sweepSurplus` (crediting stray/direct rETH transfers to a cause) is a protocol-owner maintenance action, not a patron- or cause-owner-facing one — it's unused here and would belong in a separate admin tool, not this app.
- **No bare `deposit`/`depositReth`.** The UI always calls the combined `depositAndDesignate`/`depositRethAndDesignate` (even to top up with an unchanged split), so the plain, designation-less variants are never called from here.

## Tech stack

- [SvelteKit](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/) (runes)
- [Tailwind CSS v4](https://tailwindcss.com/) + [Skeleton UI](https://www.skeleton.dev/)
- [Reown AppKit](https://reown.com/appkit) + [ethers.js v6](https://docs.ethers.org/v6/) for wallet connection and contract calls
- [The Graph](https://thegraph.com/) (see `./subgraphs`) for historical/aggregate data — leaderboards, TVL history, cause totals
- [svelte-meta-tags](https://github.com/oekazuma/svelte-meta-tags) + [@vercel/og](https://github.com/vercel/satori) (Satori) for per-page metadata and server-generated OG images (`/og`)

## Development

```bash
pnpm install
cp .env.example .env   # then fill in the values below
pnpm dev
```

### Environment variables

| Variable                   | Description                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `VITE_PROJECT_ID`          | Reown (WalletConnect) project ID                                                                                  |
| `VITE_FIRSTFRUITS_ADDRESS` | Deployed Firstfruits vault address                                                                                |
| `VITE_RETH_ADDRESS`        | rETH token address                                                                                                |
| `VITE_RPC_URL`             | Public RPC for read-only calls when there's no injected wallet                                                    |
| `VITE_SUBGRAPH_URL`        | Query URL for the `./subgraphs` deployment — powers the Causes and Patrons pages, TVL history, and homepage stats |

Other useful scripts:

```bash
pnpm check    # svelte-check, type errors
pnpm lint     # prettier --check + eslint
pnpm format   # prettier --write
pnpm build    # production build
```

## Subgraph

`./subgraphs` holds the indexer that backs historical and aggregate data (TVL
over time, per-cause and per-patron totals, protocol-wide stats) — anything
that isn't cheap to read directly off the contract. See
`subgraphs/package.json` for the `graph codegen` / `graph build` / `graph deploy`
scripts.

## License

[Source Seppuku License](./LICENCE.md).
