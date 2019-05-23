var NameBazaarRescue = artifacts.require("NameBazaarRescue");
const fs = require('fs');
const offeringsFile = 'offerings.txt';
var gas = 6000000;
var gasPrice = 66000000000;
var timeoutBetweenTx = 3000;


function partition(arr, length) {
  var result = [];
  for(var i = 0; i < arr.length; i++) {
    if(i % length === 0) result.push([]);
    result[result.length - 1].push(arr[i]);
  }
  return result;
};


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


module.exports = async (deployer, network, accounts) => {

  var offeringPartitions = partition(fs.readFileSync(offeringsFile).toString().split("\n"), 40);
  var nameBazaarRescue = await NameBazaarRescue.deployed();
//  var nameBazaarRescue = await NameBazaarRescue.at("0x50cBA6C1bCB59210f99c612C70Bf4Bc41176A5Ef");

  for(i in offeringPartitions) {

    nameBazaarRescue
      .reclaimOwnerships(offeringPartitions[i], {from: accounts[0], gas: gas, gasPrice: gasPrice})
      .on("transactionHash", (transactionHash) => {
        console.log("Transaction:", transactionHash);
        console.log("Offerings:");
        console.log(offeringPartitions[i]);
        console.log("------------");
      })
      .on("error", (error) => {
        console.log("ERROR:", error);
        console.log("Offerings: ");
        console.log(offeringPartitions[i]);
        console.log("------------");
      });
    await sleep(timeoutBetweenTx);
  }
};
