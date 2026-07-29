import { newMockEvent } from 'matchstick-as';
import { ethereum, Address, BigInt } from '@graphprotocol/graph-ts';
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
	Deposited,
	Designated,
	Harvested,
	OwnershipHandoverCanceled,
	OwnershipHandoverRequested,
	OwnershipTransferred,
	SurplusSwept,
	Withdrawn,
	WithdrawnReth,
	YieldAllocated,
	YieldBanked
} from '../generated/Firstfruits/Firstfruits';

export function createBankWithdrawnEvent(patron: Address, rethAmount: BigInt, etherAmount: BigInt): BankWithdrawn {
	let bankWithdrawnEvent = changetype<BankWithdrawn>(newMockEvent());

	bankWithdrawnEvent.parameters = new Array();

	bankWithdrawnEvent.parameters.push(new ethereum.EventParam('patron', ethereum.Value.fromAddress(patron)));
	bankWithdrawnEvent.parameters.push(new ethereum.EventParam('rethAmount', ethereum.Value.fromUnsignedBigInt(rethAmount)));
	bankWithdrawnEvent.parameters.push(new ethereum.EventParam('etherAmount', ethereum.Value.fromUnsignedBigInt(etherAmount)));

	return bankWithdrawnEvent;
}

export function createBankWithdrawnRethEvent(patron: Address, rethAmount: BigInt): BankWithdrawnReth {
	let bankWithdrawnRethEvent = changetype<BankWithdrawnReth>(newMockEvent());

	bankWithdrawnRethEvent.parameters = new Array();

	bankWithdrawnRethEvent.parameters.push(new ethereum.EventParam('patron', ethereum.Value.fromAddress(patron)));
	bankWithdrawnRethEvent.parameters.push(new ethereum.EventParam('rethAmount', ethereum.Value.fromUnsignedBigInt(rethAmount)));

	return bankWithdrawnRethEvent;
}

export function createCauseActiveSetEvent(causeId: BigInt, active: boolean): CauseActiveSet {
	let causeActiveSetEvent = changetype<CauseActiveSet>(newMockEvent());

	causeActiveSetEvent.parameters = new Array();

	causeActiveSetEvent.parameters.push(new ethereum.EventParam('causeId', ethereum.Value.fromUnsignedBigInt(causeId)));
	causeActiveSetEvent.parameters.push(new ethereum.EventParam('active', ethereum.Value.fromBoolean(active)));

	return causeActiveSetEvent;
}

export function createCauseCreatedEvent(causeId: BigInt, owner: Address, recipient: Address, name: string): CauseCreated {
	let causeCreatedEvent = changetype<CauseCreated>(newMockEvent());

	causeCreatedEvent.parameters = new Array();

	causeCreatedEvent.parameters.push(new ethereum.EventParam('causeId', ethereum.Value.fromUnsignedBigInt(causeId)));
	causeCreatedEvent.parameters.push(new ethereum.EventParam('owner', ethereum.Value.fromAddress(owner)));
	causeCreatedEvent.parameters.push(new ethereum.EventParam('recipient', ethereum.Value.fromAddress(recipient)));
	causeCreatedEvent.parameters.push(new ethereum.EventParam('name', ethereum.Value.fromString(name)));

	return causeCreatedEvent;
}

export function createCauseOwnershipTransferStartedEvent(
	causeId: BigInt,
	owner: Address,
	pendingOwner: Address
): CauseOwnershipTransferStarted {
	let causeOwnershipTransferStartedEvent = changetype<CauseOwnershipTransferStarted>(newMockEvent());

	causeOwnershipTransferStartedEvent.parameters = new Array();

	causeOwnershipTransferStartedEvent.parameters.push(new ethereum.EventParam('causeId', ethereum.Value.fromUnsignedBigInt(causeId)));
	causeOwnershipTransferStartedEvent.parameters.push(new ethereum.EventParam('owner', ethereum.Value.fromAddress(owner)));
	causeOwnershipTransferStartedEvent.parameters.push(new ethereum.EventParam('pendingOwner', ethereum.Value.fromAddress(pendingOwner)));

	return causeOwnershipTransferStartedEvent;
}

export function createCauseOwnershipTransferredEvent(
	causeId: BigInt,
	previousOwner: Address,
	newOwner: Address
): CauseOwnershipTransferred {
	let causeOwnershipTransferredEvent = changetype<CauseOwnershipTransferred>(newMockEvent());

	causeOwnershipTransferredEvent.parameters = new Array();

	causeOwnershipTransferredEvent.parameters.push(new ethereum.EventParam('causeId', ethereum.Value.fromUnsignedBigInt(causeId)));
	causeOwnershipTransferredEvent.parameters.push(new ethereum.EventParam('previousOwner', ethereum.Value.fromAddress(previousOwner)));
	causeOwnershipTransferredEvent.parameters.push(new ethereum.EventParam('newOwner', ethereum.Value.fromAddress(newOwner)));

	return causeOwnershipTransferredEvent;
}

export function createCauseRecipientSetEvent(causeId: BigInt, recipient: Address): CauseRecipientSet {
	let causeRecipientSetEvent = changetype<CauseRecipientSet>(newMockEvent());

	causeRecipientSetEvent.parameters = new Array();

	causeRecipientSetEvent.parameters.push(new ethereum.EventParam('causeId', ethereum.Value.fromUnsignedBigInt(causeId)));
	causeRecipientSetEvent.parameters.push(new ethereum.EventParam('recipient', ethereum.Value.fromAddress(recipient)));

	return causeRecipientSetEvent;
}

export function createClaimedEtherEvent(causeId: BigInt, recipient: Address, rethBurned: BigInt, etherAmount: BigInt): ClaimedEther {
	let claimedEtherEvent = changetype<ClaimedEther>(newMockEvent());

	claimedEtherEvent.parameters = new Array();

	claimedEtherEvent.parameters.push(new ethereum.EventParam('causeId', ethereum.Value.fromUnsignedBigInt(causeId)));
	claimedEtherEvent.parameters.push(new ethereum.EventParam('recipient', ethereum.Value.fromAddress(recipient)));
	claimedEtherEvent.parameters.push(new ethereum.EventParam('rethBurned', ethereum.Value.fromUnsignedBigInt(rethBurned)));
	claimedEtherEvent.parameters.push(new ethereum.EventParam('etherAmount', ethereum.Value.fromUnsignedBigInt(etherAmount)));

	return claimedEtherEvent;
}

export function createClaimedRethEvent(causeId: BigInt, recipient: Address, rethAmount: BigInt): ClaimedReth {
	let claimedRethEvent = changetype<ClaimedReth>(newMockEvent());

	claimedRethEvent.parameters = new Array();

	claimedRethEvent.parameters.push(new ethereum.EventParam('causeId', ethereum.Value.fromUnsignedBigInt(causeId)));
	claimedRethEvent.parameters.push(new ethereum.EventParam('recipient', ethereum.Value.fromAddress(recipient)));
	claimedRethEvent.parameters.push(new ethereum.EventParam('rethAmount', ethereum.Value.fromUnsignedBigInt(rethAmount)));

	return claimedRethEvent;
}

export function createDepositedEvent(patron: Address, rethAmount: BigInt, principalAdded: BigInt): Deposited {
	let depositedEvent = changetype<Deposited>(newMockEvent());

	depositedEvent.parameters = new Array();

	depositedEvent.parameters.push(new ethereum.EventParam('patron', ethereum.Value.fromAddress(patron)));
	depositedEvent.parameters.push(new ethereum.EventParam('rethAmount', ethereum.Value.fromUnsignedBigInt(rethAmount)));
	depositedEvent.parameters.push(new ethereum.EventParam('principalAdded', ethereum.Value.fromUnsignedBigInt(principalAdded)));

	return depositedEvent;
}

export function createDesignatedEvent(patron: Address, allocations: Array<ethereum.Tuple>): Designated {
	let designatedEvent = changetype<Designated>(newMockEvent());

	designatedEvent.parameters = new Array();

	designatedEvent.parameters.push(new ethereum.EventParam('patron', ethereum.Value.fromAddress(patron)));
	designatedEvent.parameters.push(new ethereum.EventParam('allocations', ethereum.Value.fromTupleArray(allocations)));

	return designatedEvent;
}

export function createHarvestedEvent(patron: Address, rethAmount: BigInt): Harvested {
	let harvestedEvent = changetype<Harvested>(newMockEvent());

	harvestedEvent.parameters = new Array();

	harvestedEvent.parameters.push(new ethereum.EventParam('patron', ethereum.Value.fromAddress(patron)));
	harvestedEvent.parameters.push(new ethereum.EventParam('rethAmount', ethereum.Value.fromUnsignedBigInt(rethAmount)));

	return harvestedEvent;
}

export function createOwnershipHandoverCanceledEvent(pendingOwner: Address): OwnershipHandoverCanceled {
	let ownershipHandoverCanceledEvent = changetype<OwnershipHandoverCanceled>(newMockEvent());

	ownershipHandoverCanceledEvent.parameters = new Array();

	ownershipHandoverCanceledEvent.parameters.push(new ethereum.EventParam('pendingOwner', ethereum.Value.fromAddress(pendingOwner)));

	return ownershipHandoverCanceledEvent;
}

export function createOwnershipHandoverRequestedEvent(pendingOwner: Address): OwnershipHandoverRequested {
	let ownershipHandoverRequestedEvent = changetype<OwnershipHandoverRequested>(newMockEvent());

	ownershipHandoverRequestedEvent.parameters = new Array();

	ownershipHandoverRequestedEvent.parameters.push(new ethereum.EventParam('pendingOwner', ethereum.Value.fromAddress(pendingOwner)));

	return ownershipHandoverRequestedEvent;
}

export function createOwnershipTransferredEvent(oldOwner: Address, newOwner: Address): OwnershipTransferred {
	let ownershipTransferredEvent = changetype<OwnershipTransferred>(newMockEvent());

	ownershipTransferredEvent.parameters = new Array();

	ownershipTransferredEvent.parameters.push(new ethereum.EventParam('oldOwner', ethereum.Value.fromAddress(oldOwner)));
	ownershipTransferredEvent.parameters.push(new ethereum.EventParam('newOwner', ethereum.Value.fromAddress(newOwner)));

	return ownershipTransferredEvent;
}

export function createSurplusSweptEvent(causeId: BigInt, rethAmount: BigInt): SurplusSwept {
	let surplusSweptEvent = changetype<SurplusSwept>(newMockEvent());

	surplusSweptEvent.parameters = new Array();

	surplusSweptEvent.parameters.push(new ethereum.EventParam('causeId', ethereum.Value.fromUnsignedBigInt(causeId)));
	surplusSweptEvent.parameters.push(new ethereum.EventParam('rethAmount', ethereum.Value.fromUnsignedBigInt(rethAmount)));

	return surplusSweptEvent;
}

export function createWithdrawnEvent(patron: Address, etherAmount: BigInt, rethBurned: BigInt): Withdrawn {
	let withdrawnEvent = changetype<Withdrawn>(newMockEvent());

	withdrawnEvent.parameters = new Array();

	withdrawnEvent.parameters.push(new ethereum.EventParam('patron', ethereum.Value.fromAddress(patron)));
	withdrawnEvent.parameters.push(new ethereum.EventParam('etherAmount', ethereum.Value.fromUnsignedBigInt(etherAmount)));
	withdrawnEvent.parameters.push(new ethereum.EventParam('rethBurned', ethereum.Value.fromUnsignedBigInt(rethBurned)));

	return withdrawnEvent;
}

export function createWithdrawnRethEvent(patron: Address, rethAmount: BigInt, principalReduced: BigInt): WithdrawnReth {
	let withdrawnRethEvent = changetype<WithdrawnReth>(newMockEvent());

	withdrawnRethEvent.parameters = new Array();

	withdrawnRethEvent.parameters.push(new ethereum.EventParam('patron', ethereum.Value.fromAddress(patron)));
	withdrawnRethEvent.parameters.push(new ethereum.EventParam('rethAmount', ethereum.Value.fromUnsignedBigInt(rethAmount)));
	withdrawnRethEvent.parameters.push(new ethereum.EventParam('principalReduced', ethereum.Value.fromUnsignedBigInt(principalReduced)));

	return withdrawnRethEvent;
}

export function createYieldAllocatedEvent(patron: Address, causeId: BigInt, rethAmount: BigInt): YieldAllocated {
	let yieldAllocatedEvent = changetype<YieldAllocated>(newMockEvent());

	yieldAllocatedEvent.parameters = new Array();

	yieldAllocatedEvent.parameters.push(new ethereum.EventParam('patron', ethereum.Value.fromAddress(patron)));
	yieldAllocatedEvent.parameters.push(new ethereum.EventParam('causeId', ethereum.Value.fromUnsignedBigInt(causeId)));
	yieldAllocatedEvent.parameters.push(new ethereum.EventParam('rethAmount', ethereum.Value.fromUnsignedBigInt(rethAmount)));

	return yieldAllocatedEvent;
}

export function createYieldBankedEvent(patron: Address, rethAmount: BigInt): YieldBanked {
	let yieldBankedEvent = changetype<YieldBanked>(newMockEvent());

	yieldBankedEvent.parameters = new Array();

	yieldBankedEvent.parameters.push(new ethereum.EventParam('patron', ethereum.Value.fromAddress(patron)));
	yieldBankedEvent.parameters.push(new ethereum.EventParam('rethAmount', ethereum.Value.fromUnsignedBigInt(rethAmount)));

	return yieldBankedEvent;
}
