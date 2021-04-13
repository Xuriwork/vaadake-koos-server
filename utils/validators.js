const { getRoomByRoomId } = require('../actions/roomActions');

const isEmpty = (string) => {
    console.log(string);
    if (string.trim() === '') return true;
    else return false;
};

const validatePasscode = (passcode) => {
    let error = null;
        
    passcode = passcode.trim();

    if (isEmpty(passcode)) {
        error = 'Cannot update with an empty field';
    } else if (!/^[a-zA-Z0-9_-]*$/.test(passcode)) {
        error = 'Only alphanumeric characters';
    } else if (passcode.length < 1) {
        error = 'The minimum character length is 1';
    } else if (passcode.length > 50) {
        error = 'The maximum character length is 50';
    };

    const valid = error === null ? true : false;
    return { error, valid };
};

const validateMaxRoomSize = (maxRoomSize, currentNumberOfUsers) => {
    let error = null;
        
    if (!maxRoomSize) {
        error = 'Cannot update with an empty field';
    } else if (!/^[0-9]*$/.test(maxRoomSize)) {
        error = 'Only numeric characters';
    } else if (maxRoomSize < currentNumberOfUsers) {
        error = `The amount of current users (${currentNumberOfUsers}) is higher than the amount you are trying to change to`;
    } else if (maxRoomSize < 1) {
        error = 'Minimum room size is 1';
    } else if (maxRoomSize > 20) {
        error = 'Max room size is 20 users';
    };

    const valid = error === null ? true : false;
    return { error, valid };
};

const validateRoomId = (roomId) => {
    let error = null;

    const checkIfIdExists = getRoomByRoomId(roomId) ? true : false;

    if (isEmpty(roomId)) {
        error = 'Cannot update with an empty field';
    } else if (!/^[a-zA-Z0-9_-]*$/.test(roomId)) {
        error = 'Only alphanumeric characters';
    } else if (roomId.length < 5) {
        error = 'The minimum character length is 5';
    } else if (roomId.length > 50) {
        error = 'The maximum character length is 50';
    } else if (checkIfIdExists) {
        error = 'Room Id already exists';
    };

    const valid = error === null ? true : false;
    return { error, valid };
};

module.exports = { isEmpty, validatePasscode, validateMaxRoomSize, validateRoomId };