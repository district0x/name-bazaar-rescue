pragma solidity ^0.5.0;

import "@ensdomains/root/contracts/Ownable.sol";

/**
 * @title UsedByFactories
 * @dev Provides modifiers to allow only offering factory contracts to execute method
 */

contract UsedByFactories is Ownable {

    mapping(address => bool) public isFactory;

    modifier onlyFactory() {
        require(isFactory[msg.sender]);
        _;
    }

    function setFactories(address[] memory factories, bool _isFactory)
    public
    onlyOwner
    {
        for(uint i = 0; i < factories.length; i++) {
            isFactory[factories[i]] = _isFactory;
        }
    }
}