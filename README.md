# Firstfruits-UI

> The first of the first fruits of thy land thou shalt bring into the house of the Lord

Charitable giving on Ethereum. Patrons stake Ether, which the vault converts to
[Rocket Pool rETH](https://rocketpool.net/). Principal stays the patron's and
is withdrawable at any time; staking yield is directed to causes of the
patron's choosing, in percentages they choose.

Please see the [contracts repo](https://github.com/unattended-backpack/firstfruits) for more infomation about the contract code.

## Development

The UI is built with Sveltekit, Skeleton, Tailwind, Reown with Ethers [using a similar pattern to this slightly outdated beautiful repo](https://github.com/Elliott-Green/sveltekit-reown-ethers), but is using the latest packages (of Q2 '26), I would have used wagmi+viem but there's a bug with reowns account button displaying native balances, (which I didn't even end up using and rolled my own styled button after)...

There's also a `./subgraph` directory which contains a v0.0.1 iteration of some indexed subgraph stuff to fetch some stats over time (Vault TVL, Total Yield Donated, Transactions, ect ect), as we get more data over time, the more this can be nailed down.

As expected, the UI is a layer over the contracts read and write methods; so everything that can be done with the contracts, should be developed out in the UI, like the following functional workflows...

* Permissionlessly create a cause.
* Allow users to deposit ETH/rETH
* Allow users to delegate some of their yield bps to one or more causes.
* Allow user to rebalance their delegated yield bps after set.
* Allow users to harvest their own or others yield.
* Allow users to withdraw ETH

...And non functional flows...

* See all causes.
* See all donated yield
* See users donated yield
* See all total users
* Recent transactional activity
* Current rETH APY

ect ect, that was a non exhausted list for this first commit.