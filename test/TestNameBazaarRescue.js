const NameBazaarRescue = artifacts.require('./NameBazaarRescue.sol');
const Offering = artifacts.require('./Offering.sol');
const OfferingRegistry = artifacts.require('./OfferingRegistry.sol');
const OfferingFactory = artifacts.require('./OfferingFactory.sol');
const Root = artifacts.require('@ensdomains/root/contracts/Root.sol');
const HashRegistrar = artifacts.require("@ensdomains/ens/contracts/HashRegistrar.sol");
const ENS = artifacts.require("@ensdomains/ens/contracts/ENSRegistry.sol");
const Deed = artifacts.require("@ensdomains/ens/contracts/Deed.sol");
const BaseRegistrar = artifacts.require("@ensdomains/ethregistrar/contracts/BaseRegistrarImplementation.sol");
const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');
var Promise = require('bluebird');

const namehash = require('eth-ens-namehash');
const sha3 = require('web3-utils').sha3;
const toBN = require('web3-utils').toBN;

const DAYS = 24 * 60 * 60;
const SALT = sha3('foo');

const advanceTime = Promise.promisify(function(delay, done) {
	web3.currentProvider.send({
		jsonrpc: "2.0",
		"method": "evm_increaseTime",
		params: [delay]}, done)
	}
);

async function expectFailure(call) {
	let tx;
	try {
		tx = await call;
	} catch (error) {
		// Assert ganache revert exception
		assert.equal(
			error.message,
			'Returned error: VM Exception while processing transaction: revert reclaimOwnership transaction couldn\'t be executed -- Reason given: reclaimOwnership transaction couldn\'t be executed.'
		);
	}
	if(tx !== undefined) {
		assert.equal(parseInt(tx.receipt.status), 0);
	}
}

contract('NameBazaarRescue', function(accounts) {

  let ens, root, nameBazaarRescue, offeringRegistry, offeringFactory, emergencyMultisig, hashRegistrar, baseRegistrar;
  let ethNode = namehash.hash('eth');
  let ethLabel = sha3('eth');

  const secret = "0x0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";
  const ownerAccount = accounts[0]; // Account that owns the registrar
  const registrantAccount = accounts[1]; // Account that owns test names
  const baseRegistrarController = accounts[2];
  const buyerAccount = accounts[3];

  async function registerOldNames(names, registrantAccount) {
    var hashes = names.map(sha3);
    var value = toBN(10000000000000000);
    var bidHashes = await Promise.map(hashes, (hash) => hashRegistrar.shaBid(hash, registrantAccount, value, SALT));
    await hashRegistrar.startAuctions(hashes, {from: registrantAccount});
    await Promise.map(bidHashes, (h) => hashRegistrar.newBid(h, {value: value, from: registrantAccount}));
    await advanceTime(3 * DAYS + 1);
    await Promise.map(hashes, (hash) => hashRegistrar.unsealBid(hash, value, SALT, {from: registrantAccount}));
    await advanceTime(2 * DAYS + 1);
    await Promise.map(hashes, (hash) => hashRegistrar.finalizeAuction(hash, {from: registrantAccount}));
    for(var name of names) {
      assert.equal(await ens.owner(namehash.hash(name + '.eth')), registrantAccount);
    }
  }

  async function createOffering(name, creatorAccount) {
    await offeringFactory.createOffering(
      namehash.hash(name + '.eth'),
      name + ".eth",
      sha3(name),
      0,
      {from: creatorAccount});
  }

  async function deedOwner(name) {
    var entries = await hashRegistrar.entries(sha3(name));
    var deed = await Deed.at(entries[1]);
    return await deed.owner();
  }

  before(async function() {

    ens = await ENS.new();
    root = await Root.new(ens.address);
    emergencyMultisig = await MultiSigWallet.new([accounts[0]], 1);
    hashRegistrar = await HashRegistrar.new(ens.address, ethNode, 1493895600);

    offeringRegistry = await OfferingRegistry.new(emergencyMultisig.address);
    offeringFactory = await OfferingFactory.new(ens.address, offeringRegistry.address);
    await offeringRegistry.setFactories([offeringFactory.address], true);

    nameBazaarRescue = await NameBazaarRescue.new(root.address, offeringRegistry.address, hashRegistrar.address);

    await emergencyMultisig.submitTransaction(
      emergencyMultisig.address,
      0,
      emergencyMultisig.contract.methods.addOwner(nameBazaarRescue.address).encodeABI());

    await root.setController(nameBazaarRescue.address, true);
    await root.setController(accounts[0], true);
    await ens.setSubnodeOwner('0x0', ethLabel, hashRegistrar.address);
    await ens.setOwner('0x0', root.address);

    const now = (await web3.eth.getBlock('latest')).timestamp;
    baseRegistrar = await BaseRegistrar.new(ens.address, hashRegistrar.address, namehash.hash('eth'), now + 365 * DAYS);
    baseRegistrar.addController(baseRegistrarController);

  });

  describe('register with old registrar -> create offerings -> use new registrar -> reclaim ownerships -> trasfer registrars', async () => {

    let offering1, offering2, purchasedOffering, notTransferredOffering;

    it('should allow to register names with old registrar', async () => {
      await registerOldNames(['name', 'name2', 'purchased-offering', 'not-transferred-name'], registrantAccount);
    });

    it('should allow to create NameBazaar offerings', async () => {
      await createOffering("name", registrantAccount);
      await createOffering("name2", registrantAccount);
      await createOffering("purchased-offering", registrantAccount);
      await createOffering("not-transferred-name", registrantAccount);

      var events = await offeringRegistry.contract.getPastEvents("onOfferingAdded", {fromBlock: 0});

      assert.equal(events.length, 4);
      offering1 = await Offering.at(events[0].returnValues.offering);
      offering2 = await Offering.at(events[1].returnValues.offering);
      purchasedOffering = await Offering.at(events[2].returnValues.offering);
      notTransferredOffering = await Offering.at(events[3].returnValues.offering);
    });

    it('should allow to transfer ENS and deed ownerships into NameBazaar offerings', async () => {
      await hashRegistrar.transfer(sha3('name'), offering1.address, {from: registrantAccount});
      await hashRegistrar.transfer(sha3('name2'), offering2.address, {from: registrantAccount});
      await hashRegistrar.transfer(sha3('purchased-offering'), purchasedOffering.address, {from: registrantAccount});

      assert.equal(true, await offering1.isContractNodeOwner());
      assert.equal(true, await offering2.isContractNodeOwner());
      assert.equal(true, await purchasedOffering.isContractNodeOwner());

      assert.equal(await ens.owner(namehash.hash('name.eth')), offering1.address);
      assert.equal(await ens.owner(namehash.hash('name2.eth')), offering2.address);
      assert.equal(await ens.owner(namehash.hash('purchased-offering.eth')), purchasedOffering.address);
      
      assert.equal(await deedOwner('name'), offering1.address);
      assert.equal(await deedOwner('name2'), offering2.address);
      assert.equal(await deedOwner('purchased-offering'), purchasedOffering.address);
    });

    it('should allow to purchase NameBazaar Offering', async () => {
      await purchasedOffering.buy({from: buyerAccount});
      assert.equal(await ens.owner(namehash.hash('purchased-offering.eth')), buyerAccount);
      assert.equal(await deedOwner('purchased-offering'), buyerAccount);
    });

    it('should allow to transfer .eth ownership to new registrar', async () => {
      await root.setSubnodeOwner(ethLabel, baseRegistrar.address);
    });

    it('should allow to register a new name with new registrar', async () => {
      assert.equal(await baseRegistrar.available(sha3('name')), false);
      assert.equal(await baseRegistrar.available(sha3('name2')), false);
      assert.equal(await baseRegistrar.available(sha3('purchased-offering')), false);
      assert.equal(await baseRegistrar.available(sha3('not-transferred-name')), false);
      assert.equal(await baseRegistrar.available(sha3('name3')), true);

      baseRegistrar.register(sha3("name3"), registrantAccount, 86400, {from: baseRegistrarController});

      assert.equal(await ens.owner(namehash.hash('name3.eth')), registrantAccount);
    });

    it('should allow to reclaim ownership of names stuck in NameBazaar offerings', async () => {
      await nameBazaarRescue.reclaimOwnerships([offering1.address, offering2.address]);

      assert.equal(await ens.owner(namehash.hash('name.eth')), registrantAccount);
      assert.equal(await ens.owner(namehash.hash('name2.eth')), registrantAccount);
      assert.equal(await deedOwner('name'), registrantAccount);
      assert.equal(await deedOwner('name2'), registrantAccount);

      var events = await nameBazaarRescue.contract.getPastEvents("ReclaimSuccess");
      assert.equal(events.length, 2);
      assert.equal(events[0].returnValues.offering, offering1.address);
      assert.equal(events[1].returnValues.offering, offering2.address);
      assert.equal(await offering1.wasEmergencyCancelled(), true);
      assert.equal(await offering2.wasEmergencyCancelled(), true);
    });

    it('should fail to reclaim already reclaimed names', async () => {
      await expectFailure(nameBazaarRescue.reclaimOwnerships([offering1.address, offering2.address]));
    });

    it('should fail to reclaim from offering that has been already purchased', async () => {
      await expectFailure(nameBazaarRescue.reclaimOwnerships([purchasedOffering.address]));
    });

    it('should allow to run reclaim on offering that never had ENS name transferred into it', async () => {
      await nameBazaarRescue.reclaimOwnerships([notTransferredOffering.address]);
      var events = await nameBazaarRescue.contract.getPastEvents("ReclaimSuccess");
      assert.equal(events.length, 1);
      assert.equal(events[0].returnValues.offering, notTransferredOffering.address);
      assert.equal(await notTransferredOffering.wasEmergencyCancelled(), true);
    });

    it('should allow to transfer registrar of names rescued from NameBazaar offerings', async () => {
      await advanceTime(28 * DAYS); // Get out of Migration Lock Period
      await hashRegistrar.transferRegistrars(sha3("name"), {from: registrantAccount});
      await hashRegistrar.transferRegistrars(sha3("name2"), {from: registrantAccount});
      await hashRegistrar.transferRegistrars(sha3("purchased-offering"), {from: buyerAccount});
      await hashRegistrar.transferRegistrars(sha3("not-transferred-name"), {from: registrantAccount});

      assert.equal(await baseRegistrar.ownerOf(sha3('name')), registrantAccount);
      assert.equal(await baseRegistrar.ownerOf(sha3('name2')), registrantAccount);
      assert.equal(await baseRegistrar.ownerOf(sha3('purchased-offering')), buyerAccount);
      assert.equal(await baseRegistrar.ownerOf(sha3('not-transferred-name')), registrantAccount);
    });
  });
});
