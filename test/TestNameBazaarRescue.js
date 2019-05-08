const NameBazaarRescue = artifacts.require('./NameBazaarRescue.sol');
const Offering = artifacts.require('./Offering.sol');
const OfferingRegistry = artifacts.require('./OfferingRegistry.sol');
const Root = artifacts.require('@ensdomains/root/contracts/Root.sol');
const ENS = artifacts.require('./ENSRegistry.sol');
const MultiSigWallet = artifacts.require('./MultiSigWallet.sol');

const namehash = require('eth-ens-namehash');
const sha3 = require('js-sha3').keccak_256;

contract('NameBazaarRescue', function(accounts) {

  let ens, root, nameBazaarRescue, offeringRegistry, emergencyMultisig;
  let newRegistrar = "0xBEeFbeefbEefbeEFbeEfbEEfBEeFbeEfBeEfBeef";
  let previousRegistrar = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead";
  let ethNode = namehash.hash('eth');
  let ethLabel = '0x' + sha3('eth');

  beforeEach(async function() {

    ens = await ENS.new();
    root = await Root.new(ens.address);
    offeringRegistry = await OfferingRegistry.new();
    nameBazaarRescue = await NameBazaarRescue.new(root.address, offeringRegistry.address, previousRegistrar);
    emergencyMultisig = await MultiSigWallet.new([nameBazaarRescue.address], 1);
    await offeringRegistry.setEmergencyMultisig(emergencyMultisig.address);

    await root.setController(nameBazaarRescue.address, true);
    await ens.setSubnodeOwner('0x0', ethLabel, newRegistrar);
    await ens.setOwner('0x0', root.address);

  });

  describe('reclaimOwnerships', async () => {

    it('should allow to reclaim ownerships of offerings', async () => {

      var offering1 = await Offering.new();
      var offering2 = await Offering.new();

      assert.equal(false, await offering1.isReclaimed());
      assert.equal(false, await offering2.isReclaimed());

      assert.equal(newRegistrar, await ens.owner(ethNode));
      assert.equal(nameBazaarRescue.address, await emergencyMultisig.getOwners());

      await nameBazaarRescue.reclaimOwnerships([offering1.address, offering2.address]);

      assert.equal(true, await offering1.isReclaimed());
      assert.equal(true, await offering2.isReclaimed());

      assert.equal(newRegistrar, await ens.owner(ethNode));

    });
  });
});
