pragma solidity ^0.5.0;

contract OfferingRegistry {

  address public emergencyMultisig;                           // Emergency Multisig wallet of Namebazaar

  function isOffering(address _offering) pure public returns (bool) {
    _offering;
    return true;
  }

  function setEmergencyMultisig(address _emergencyMultisig) public {
    emergencyMultisig = _emergencyMultisig;
  }


}