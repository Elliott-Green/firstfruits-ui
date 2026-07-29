import { assert, describe, test, clearStore, beforeAll, afterAll } from 'matchstick-as/assembly/index';
import { Address, BigInt } from '@graphprotocol/graph-ts';
import { BankWithdrawn } from '../generated/schema';
import { BankWithdrawn as BankWithdrawnEvent } from '../generated/Firstfruits/Firstfruits';
import { handleBankWithdrawn } from '../src/firstfruits';
import { createBankWithdrawnEvent } from './firstfruits-utils';

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe('Describe entity assertions', () => {
	beforeAll(() => {
		let patron = Address.fromString('0x0000000000000000000000000000000000000001');
		let rethAmount = BigInt.fromI32(234);
		let etherAmount = BigInt.fromI32(234);
		let newBankWithdrawnEvent = createBankWithdrawnEvent(patron, rethAmount, etherAmount);
		handleBankWithdrawn(newBankWithdrawnEvent);
	});

	afterAll(() => {
		clearStore();
	});

	// For more test scenarios, see:
	// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

	test('BankWithdrawn created and stored', () => {
		assert.entityCount('BankWithdrawn', 1);

		// 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
		assert.fieldEquals(
			'BankWithdrawn',
			'0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1',
			'patron',
			'0x0000000000000000000000000000000000000001'
		);
		assert.fieldEquals('BankWithdrawn', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1', 'rethAmount', '234');
		assert.fieldEquals('BankWithdrawn', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1', 'etherAmount', '234');

		// More assert options:
		// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
	});
});
