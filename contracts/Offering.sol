pragma solidity ^0.5.0;

contract Offering {

    bool public isReclaimed = false;

    function reclaimOwnership() public {
        isReclaimed = true;
    }
}
