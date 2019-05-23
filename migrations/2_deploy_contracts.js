var NameBazaarRescue = artifacts.require("NameBazaarRescue");

var rootAddress = "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead"; // replace when known
var offeringRegistryAddress = "0x34e400a8b4da8a23b5eaf81b46d3a887669a45b9";
var previousRegistrarAddress = "0x6090a6e47849629b7245dfa1ca21d94cd15878ef";

module.exports = async (deployer) => {
  await deployer.deploy(NameBazaarRescue, rootAddress, offeringRegistryAddress, previousRegistrarAddress);
  console.log ("@@@ NameBazaarRescue:", NameBazaarRescue.address);
};
