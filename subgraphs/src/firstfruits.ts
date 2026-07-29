import {
	BankWithdrawn as BankWithdrawnEvent,
	BankWithdrawnReth as BankWithdrawnRethEvent,
	CauseActiveSet as CauseActiveSetEvent,
	CauseCreated as CauseCreatedEvent,
	CauseOwnershipTransferStarted as CauseOwnershipTransferStartedEvent,
	CauseOwnershipTransferred as CauseOwnershipTransferredEvent,
	CauseRecipientSet as CauseRecipientSetEvent,
	ClaimedEther as ClaimedEtherEvent,
	ClaimedReth as ClaimedRethEvent,
	Deposited as DepositedEvent,
	Designated as DesignatedEvent,
	Firstfruits,
	Harvested as HarvestedEvent,
	OwnershipHandoverCanceled as OwnershipHandoverCanceledEvent,
	OwnershipHandoverRequested as OwnershipHandoverRequestedEvent,
	OwnershipTransferred as OwnershipTransferredEvent,
	SurplusSwept as SurplusSweptEvent,
	Withdrawn as WithdrawnEvent,
	WithdrawnReth as WithdrawnRethEvent,
	YieldAllocated as YieldAllocatedEvent,
	YieldBanked as YieldBankedEvent
} from '../generated/Firstfruits/Firstfruits';
import {
	BankWithdrawn,
	BankWithdrawnReth,
	CauseActiveSet,
	CauseCreated,
	CauseOwnershipTransferStarted,
	CauseOwnershipTransferred,
	CauseRecipientSet,
	ClaimedEther,
	ClaimedReth,
	DailySnapshot,
	Deposited,
	Designated,
	Harvested,
	OwnershipHandoverCanceled,
	OwnershipHandoverRequested,
	OwnershipTransferred,
	Patron,
	Protocol,
	SurplusSwept,
	Withdrawn,
	WithdrawnReth,
	YieldAllocated,
	YieldBanked
} from '../generated/schema';
import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';

const PROTOCOL_ID = Bytes.fromUTF8('protocol');
const SECONDS_PER_DAY = 86400;

function getProtocol(): Protocol {
	let protocol = Protocol.load(PROTOCOL_ID);
	if (protocol == null) {
		protocol = new Protocol(PROTOCOL_ID);
		protocol.totalPrincipalEther = BigInt.zero();
		protocol.totalYieldDonatedReth = BigInt.zero();
		protocol.causeCount = BigInt.zero();
		protocol.patronCount = BigInt.zero();
	}
	return protocol as Protocol;
}

// Creates a Patron row the first time this address deposits (or reactivates
// one that had fully withdrawn before), bumping Protocol.patronCount exactly
// once for the transition into "active". No-op if already active.
function recordPatron(protocol: Protocol, patronAddress: Bytes, timestamp: BigInt): void {
	let patron = Patron.load(patronAddress);
	if (patron == null) {
		patron = new Patron(patronAddress);
		patron.firstDepositTimestamp = timestamp;
		patron.active = true;
		patron.save();
		protocol.patronCount = protocol.patronCount.plus(BigInt.fromI32(1));
	} else if (!patron.active) {
		patron.active = true;
		patron.save();
		protocol.patronCount = protocol.patronCount.plus(BigInt.fromI32(1));
	}
}

// After a withdrawal, checks whether this patron's rethBalance is now zero
// (a full exit) and flips them to inactive if so — decrementing
// Protocol.patronCount. A partial withdrawal leaves rethBalance > 0, so this
// is a no-op for them. Reads live from the contract rather than trying to
// infer "fully withdrawn" from the event's own fields, since Withdrawn only
// reports Ether received, not the resulting balance.
function refreshPatronActiveStatus(
	protocol: Protocol,
	patronAddress: Address,
	contractAddress: Address
): void {
	let patron = Patron.load(patronAddress);
	if (patron == null || !patron.active) return;

	let contract = Firstfruits.bind(contractAddress);
	let result = contract.try_patrons(patronAddress);
	if (result.reverted) return;

	if (result.value.getRethBalance().isZero()) {
		patron.active = false;
		patron.save();
		protocol.patronCount = protocol.patronCount.minus(BigInt.fromI32(1));
	}
}

// Reads totalPrincipalEther() straight from the contract rather than
// reconstructing it from event deltas — see the schema.graphql comment on
// Protocol for why that matters.
function refreshTotalPrincipalEther(protocol: Protocol, contractAddress: Address): void {
	let contract = Firstfruits.bind(contractAddress);
	let result = contract.try_totalPrincipalEther();
	if (!result.reverted) {
		protocol.totalPrincipalEther = result.value;
	}
}

// Upserts today's snapshot row with the Protocol's current totals. Safe to
// call many times per day — later calls just overwrite with the latest
// totals-as-of-now.
function snapshotDay(event: ethereum.Event, protocol: Protocol): void {
	let dayId = event.block.timestamp.toI32() / SECONDS_PER_DAY;
	let snapshotId = Bytes.fromI32(dayId);
	let snapshot = DailySnapshot.load(snapshotId);
	if (snapshot == null) {
		snapshot = new DailySnapshot(snapshotId);
		snapshot.dayId = dayId;
		snapshot.dayStartTimestamp = BigInt.fromI32(dayId * SECONDS_PER_DAY);
	}
	snapshot.totalPrincipalEther = protocol.totalPrincipalEther;
	snapshot.totalYieldDonatedReth = protocol.totalYieldDonatedReth;
	snapshot.save();
}

export function handleBankWithdrawn(event: BankWithdrawnEvent): void {
	let entity = new BankWithdrawn(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.patron = event.params.patron;
	entity.rethAmount = event.params.rethAmount;
	entity.etherAmount = event.params.etherAmount;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleBankWithdrawnReth(event: BankWithdrawnRethEvent): void {
	let entity = new BankWithdrawnReth(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.patron = event.params.patron;
	entity.rethAmount = event.params.rethAmount;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleCauseActiveSet(event: CauseActiveSetEvent): void {
	let entity = new CauseActiveSet(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.causeId = event.params.causeId;
	entity.active = event.params.active;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleCauseCreated(event: CauseCreatedEvent): void {
	let entity = new CauseCreated(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.causeId = event.params.causeId;
	entity.owner = event.params.owner;
	entity.recipient = event.params.recipient;
	entity.name = event.params.name;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();

	let protocol = getProtocol();
	protocol.causeCount = protocol.causeCount.plus(BigInt.fromI32(1));
	protocol.save();
}

export function handleCauseOwnershipTransferStarted(event: CauseOwnershipTransferStartedEvent): void {
	let entity = new CauseOwnershipTransferStarted(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.causeId = event.params.causeId;
	entity.owner = event.params.owner;
	entity.pendingOwner = event.params.pendingOwner;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleCauseOwnershipTransferred(event: CauseOwnershipTransferredEvent): void {
	let entity = new CauseOwnershipTransferred(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.causeId = event.params.causeId;
	entity.previousOwner = event.params.previousOwner;
	entity.newOwner = event.params.newOwner;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleCauseRecipientSet(event: CauseRecipientSetEvent): void {
	let entity = new CauseRecipientSet(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.causeId = event.params.causeId;
	entity.recipient = event.params.recipient;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleClaimedEther(event: ClaimedEtherEvent): void {
	let entity = new ClaimedEther(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.causeId = event.params.causeId;
	entity.recipient = event.params.recipient;
	entity.rethBurned = event.params.rethBurned;
	entity.etherAmount = event.params.etherAmount;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleClaimedReth(event: ClaimedRethEvent): void {
	let entity = new ClaimedReth(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.causeId = event.params.causeId;
	entity.recipient = event.params.recipient;
	entity.rethAmount = event.params.rethAmount;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleDeposited(event: DepositedEvent): void {
	let entity = new Deposited(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.patron = event.params.patron;
	entity.rethAmount = event.params.rethAmount;
	entity.principalAdded = event.params.principalAdded;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();

	let protocol = getProtocol();
	refreshTotalPrincipalEther(protocol, event.address);
	recordPatron(protocol, event.params.patron, event.block.timestamp);
	protocol.save();
	snapshotDay(event, protocol);
}

export function handleDesignated(event: DesignatedEvent): void {
	let entity = new Designated(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.patron = event.params.patron;
	entity.allocations = changetype<Bytes[]>(event.params.allocations);

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleHarvested(event: HarvestedEvent): void {
	let entity = new Harvested(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.patron = event.params.patron;
	entity.rethAmount = event.params.rethAmount;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleOwnershipHandoverCanceled(event: OwnershipHandoverCanceledEvent): void {
	let entity = new OwnershipHandoverCanceled(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.pendingOwner = event.params.pendingOwner;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleOwnershipHandoverRequested(event: OwnershipHandoverRequestedEvent): void {
	let entity = new OwnershipHandoverRequested(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.pendingOwner = event.params.pendingOwner;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleOwnershipTransferred(event: OwnershipTransferredEvent): void {
	let entity = new OwnershipTransferred(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.oldOwner = event.params.oldOwner;
	entity.newOwner = event.params.newOwner;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleSurplusSwept(event: SurplusSweptEvent): void {
	let entity = new SurplusSwept(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.causeId = event.params.causeId;
	entity.rethAmount = event.params.rethAmount;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}

export function handleWithdrawn(event: WithdrawnEvent): void {
	let entity = new Withdrawn(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.patron = event.params.patron;
	entity.etherAmount = event.params.etherAmount;
	entity.rethBurned = event.params.rethBurned;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();

	let protocol = getProtocol();
	refreshTotalPrincipalEther(protocol, event.address);
	refreshPatronActiveStatus(protocol, event.params.patron, event.address);
	protocol.save();
	snapshotDay(event, protocol);
}

export function handleWithdrawnReth(event: WithdrawnRethEvent): void {
	let entity = new WithdrawnReth(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.patron = event.params.patron;
	entity.rethAmount = event.params.rethAmount;
	entity.principalReduced = event.params.principalReduced;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();

	let protocol = getProtocol();
	refreshTotalPrincipalEther(protocol, event.address);
	refreshPatronActiveStatus(protocol, event.params.patron, event.address);
	protocol.save();
	snapshotDay(event, protocol);
}

export function handleYieldAllocated(event: YieldAllocatedEvent): void {
	let entity = new YieldAllocated(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.patron = event.params.patron;
	entity.causeId = event.params.causeId;
	entity.rethAmount = event.params.rethAmount;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();

	let protocol = getProtocol();
	protocol.totalYieldDonatedReth = protocol.totalYieldDonatedReth.plus(event.params.rethAmount);
	protocol.save();
	snapshotDay(event, protocol);
}

export function handleYieldBanked(event: YieldBankedEvent): void {
	let entity = new YieldBanked(event.transaction.hash.concatI32(event.logIndex.toI32()));
	entity.patron = event.params.patron;
	entity.rethAmount = event.params.rethAmount;

	entity.blockNumber = event.block.number;
	entity.blockTimestamp = event.block.timestamp;
	entity.transactionHash = event.transaction.hash;

	entity.save();
}
