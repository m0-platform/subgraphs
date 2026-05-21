import { Address, BigInt, Timestamp } from '@graphprotocol/graph-ts';
import {
    EarningPrincipalSnapshot,
    Holder,
    IsEarningSnapshot,
    LatestIndexSnapshot,
    LatestRateSnapshot,
    LatestUpdateTimestampSnapshot,
    MToken,
    NonEarningBalanceSnapshot,
    PrincipalOfTotalEarningSupplySnapshot,
    RateModelSnapshot,
    ReceivedSnapshot,
    SentSnapshot,
    TotalBurnedSnapshot,
    TotalMintedSnapshot,
    TotalNonEarningSupplySnapshot,
    Transfer,
} from '../generated/schema';
import {
    IndexUpdated as IndexUpdatedEvent,
    StartedEarning as StartedEarningEvent,
    StoppedEarning as StoppedEarningEvent,
    Transfer as TransferEvent,
} from '../generated/MToken/MToken';
import { KeySet as KeySetEvent } from '../generated/Registrar/Registrar';

const ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000');
const M_TOKEN_ADDRESS = '0x866A2BF4E572CbcF37D5071A7a58503Bfb36be1b';

const EARNER_RATE_MODEL_KEY = 'earner_rate_model';

const EXP_SCALED_ONE = BigInt.fromI32(10).pow(12);
const BPS_SCALED_ONE = BigInt.fromI32(10).pow(4);
const SECONDS_PER_YEAR = BigInt.fromI32(31_536_000);

const TIMESERIES_ID = 1;

/* ============ Handlers ============ */

export function handleKeySet(event: KeySetEvent): void {
    const mToken = getMToken();
    const key = event.params.key.toString();
    const timestamp = event.block.timestamp.toI32();

    if (key == EARNER_RATE_MODEL_KEY) {
        const value = `0x${event.params.value.toHexString().slice(26)}`;
        updateRateModelSnapshot(timestamp, value);
        mToken.rateModel = value;
    } else {
        return;
    }

    mToken.lastUpdate = timestamp;

    mToken.save();
}

export function handleTransfer(event: TransferEvent): void {
    const mToken = getMToken();
    const sender = getHolder(event.params.sender);
    const recipient = getHolder(event.params.recipient);
    const timestamp = event.block.timestamp.toI32();
    const amount = event.params.amount;

    if (event.params.sender.equals(ZERO_ADDRESS)) {
        _mint(mToken, recipient, amount, timestamp);
    } else if (event.params.recipient.equals(ZERO_ADDRESS)) {
        _burn(mToken, sender, amount, timestamp);
    } else {
        _transfer(mToken, sender, recipient, amount, timestamp);
    }

    mToken.lastUpdate = timestamp;
    mToken.save();

    sender.lastUpdate = timestamp;
    sender.save();

    recipient.lastUpdate = timestamp;
    recipient.save();

    const transfer = new Transfer(
        `transfer-${event.transaction.hash.toHexString()}-${event.logIndex.toI32().toString()}`
    );

    transfer.sender = sender.id;
    transfer.recipient = recipient.id;
    transfer.amount = amount;
    transfer.timestamp = timestamp;
    transfer.logIndex = event.logIndex;
    transfer.transactionHash = event.transaction.hash.toHexString();

    transfer.save();
}

export function handleStartedEarning(event: StartedEarningEvent): void {
    const mToken = getMToken();
    const account = getHolder(event.params.account);
    const timestamp = event.block.timestamp.toI32();

    _startEarning(mToken, account, timestamp);

    mToken.lastUpdate = timestamp;
    mToken.save();

    account.lastUpdate = timestamp;
    account.save();
}

export function handleStoppedEarning(event: StoppedEarningEvent): void {
    const mToken = getMToken();
    const account = getHolder(event.params.account);
    const timestamp = event.block.timestamp.toI32();

    _stopEarning(mToken, account, timestamp);

    mToken.lastUpdate = timestamp;
    mToken.save();

    account.lastUpdate = timestamp;
    account.save();
}

export function handleIndexUpdated(event: IndexUpdatedEvent): void {
    const mToken = getMToken();
    const timestamp = event.block.timestamp.toI32();

    _updateIndex(mToken, timestamp, event.params.index, event.params.rate);

    mToken.lastUpdate = timestamp;
    mToken.save();
}

/* ============ Entity Helpers ============ */

function getMToken(): MToken {
    const id = `mToken-${M_TOKEN_ADDRESS}`;

    let mToken = MToken.load(id);

    if (mToken) return mToken;

    mToken = new MToken(id);

    mToken.totalNonEarningSupply = BigInt.fromI32(0);
    mToken.principalOfTotalEarningSupply = BigInt.fromI32(0);
    mToken.latestIndex = BigInt.fromI32(0);
    mToken.latestRate = BigInt.fromI32(0);
    mToken.latestUpdateTimestamp = 0;
    mToken.totalMinted = BigInt.fromI32(0);
    mToken.totalBurned = BigInt.fromI32(0);
    mToken.rateModel = ZERO_ADDRESS.toHexString();
    mToken.lastUpdate = 0;

    return mToken;
}

function getHolder(address: Address): Holder {
    const id = `holder-${address.toHexString()}`;

    let holder = Holder.load(id);

    if (holder) return holder;

    holder = new Holder(id);

    holder.address = address.toHexString();
    holder.earningPrincipal = BigInt.fromI32(0);
    holder.nonEarningBalance = BigInt.fromI32(0);
    holder.isEarning = false;
    holder.received = BigInt.fromI32(0);
    holder.sent = BigInt.fromI32(0);
    holder.lastUpdate = 0;

    return holder;
}

function updateEarningPrincipalSnapshot(holder: Holder, timestamp: Timestamp, value: BigInt): void {
    const id = `earningPrincipal-${holder.address}-${timestamp.toString()}`;

    let snapshot = EarningPrincipalSnapshot.load(id);

    if (!snapshot) {
        snapshot = new EarningPrincipalSnapshot(id);

        snapshot.account = holder.id;
        snapshot.timestamp = timestamp;
    }

    snapshot.value = value;

    snapshot.save();
}

function updateNonEarningBalanceSnapshot(holder: Holder, timestamp: Timestamp, value: BigInt): void {
    const id = `nonEarningBalance-${holder.address}-${timestamp.toString()}`;

    let snapshot = NonEarningBalanceSnapshot.load(id);

    if (!snapshot) {
        snapshot = new NonEarningBalanceSnapshot(id);

        snapshot.account = holder.id;
        snapshot.timestamp = timestamp;
    }

    snapshot.value = value;

    snapshot.save();
}

function updateIsEarningSnapshot(holder: Holder, timestamp: Timestamp, value: boolean): void {
    const id = `isEarning-${holder.address}-${timestamp.toString()}`;

    let snapshot = IsEarningSnapshot.load(id);

    if (!snapshot) {
        snapshot = new IsEarningSnapshot(id);

        snapshot.account = holder.id;
        snapshot.timestamp = timestamp;
    }

    snapshot.value = value;

    snapshot.save();
}

function updateReceivedSnapshot(holder: Holder, timestamp: Timestamp, value: BigInt): void {
    const id = `received-${holder.address}-${timestamp.toString()}`;

    let snapshot = ReceivedSnapshot.load(id);

    if (!snapshot) {
        snapshot = new ReceivedSnapshot(id);

        snapshot.account = holder.id;
        snapshot.timestamp = timestamp;
    }

    snapshot.value = value;

    snapshot.save();
}

function updateSentSnapshot(holder: Holder, timestamp: Timestamp, value: BigInt): void {
    const id = `sent-${holder.address}-${timestamp.toString()}`;

    let snapshot = SentSnapshot.load(id);

    if (!snapshot) {
        snapshot = new SentSnapshot(id);

        snapshot.account = holder.id;
        snapshot.timestamp = timestamp;
    }

    snapshot.value = value;

    snapshot.save();
}

function updateTotalNonEarningSupplySnapshot(timestamp: Timestamp, value: BigInt): void {
    const id = `totalNonEarningSupply-${timestamp.toString()}`;

    let snapshot = TotalNonEarningSupplySnapshot.load(id);

    if (!snapshot) {
        snapshot = new TotalNonEarningSupplySnapshot(id);

        snapshot.timestamp = timestamp;
    }

    snapshot.value = value;

    snapshot.save();
}

function updatePrincipalOfTotalEarningSupplySnapshot(timestamp: Timestamp, value: BigInt): void {
    const id = `principalOfTotalEarningSupply-${timestamp.toString()}`;

    let snapshot = PrincipalOfTotalEarningSupplySnapshot.load(id);

    if (!snapshot) {
        snapshot = new PrincipalOfTotalEarningSupplySnapshot(id);

        snapshot.timestamp = timestamp;
    }

    snapshot.value = value;

    snapshot.save();
}

function updateLatestIndexSnapshot(timestamp: Timestamp, value: BigInt): void {
    let snapshot = new LatestIndexSnapshot(TIMESERIES_ID);

    snapshot.timestamp = timestamp;
    snapshot.value = value;

    snapshot.save();
}

function updateLatestRateSnapshot(timestamp: Timestamp, value: BigInt): void {
    let snapshot = new LatestRateSnapshot(TIMESERIES_ID);

    snapshot.timestamp = timestamp;
    snapshot.value = value;

    snapshot.save();
}

function updateLatestUpdateTimestampSnapshot(timestamp: Timestamp, value: Timestamp): void {
    let snapshot = new LatestUpdateTimestampSnapshot(TIMESERIES_ID);

    snapshot.timestamp = timestamp;
    snapshot.value = i32(value);

    snapshot.save();
}

function updateTotalMintedSnapshot(timestamp: Timestamp, value: BigInt): void {
    const id = `totalMinted-${timestamp.toString()}`;

    let snapshot = TotalMintedSnapshot.load(id);

    if (!snapshot) {
        snapshot = new TotalMintedSnapshot(id);

        snapshot.timestamp = timestamp;
    }

    snapshot.value = value;

    snapshot.save();
}

function updateTotalBurnedSnapshot(timestamp: Timestamp, value: BigInt): void {
    const id = `totalBurned-${timestamp.toString()}`;

    let snapshot = TotalBurnedSnapshot.load(id);

    if (!snapshot) {
        snapshot = new TotalBurnedSnapshot(id);

        snapshot.timestamp = timestamp;
    }

    snapshot.value = value;

    snapshot.save();
}

function updateRateModelSnapshot(timestamp: Timestamp, value: string): void {
    const id = `rateModel-${timestamp.toString()}`;

    let snapshot = RateModelSnapshot.load(id);

    if (!snapshot) {
        snapshot = new RateModelSnapshot(id);

        snapshot.timestamp = timestamp;
    }

    snapshot.value = value;

    snapshot.save();
}

/* ============ Contract Stateful Tracking ============ */

function _burn(mToken: MToken, account: Holder, amount: BigInt, timestamp: Timestamp): void {
    if (amount.equals(BigInt.fromI32(0))) return;

    let sent: BigInt;

    if (account.isEarning) {
        const index = _getCurrentIndex(mToken, timestamp);
        const startingBalance = _getPresentAmountRoundedDown(account.earningPrincipal, index);

        _subtractEarningAmount(mToken, account, _getPrincipalAmountRoundedUp(amount, index), timestamp);

        sent = _getPresentAmountRoundedDown(account.earningPrincipal, index).minus(startingBalance);
    } else {
        _subtractNonEarningAmount(mToken, account, amount, timestamp);

        sent = amount;
    }

    mToken.totalBurned = mToken.totalBurned.plus(amount);

    updateTotalBurnedSnapshot(timestamp, mToken.totalBurned);

    if (sent.equals(BigInt.fromI32(0))) return;

    account.sent = account.sent.plus(amount);

    updateSentSnapshot(account, timestamp, account.sent);
}

function _mint(mToken: MToken, recipient: Holder, amount: BigInt, timestamp: Timestamp): void {
    if (amount.equals(BigInt.fromI32(0))) return;

    let received: BigInt;

    if (recipient.isEarning) {
        const index = _getCurrentIndex(mToken, timestamp);
        const startingBalance = _getPresentAmountRoundedDown(recipient.earningPrincipal, index);

        _addEarningAmount(mToken, recipient, _getPrincipalAmountRoundedDown(amount, index), timestamp);

        received = _getPresentAmountRoundedDown(recipient.earningPrincipal, index).minus(startingBalance);
    } else {
        _addNonEarningAmount(mToken, recipient, amount, timestamp);

        received = amount;
    }

    mToken.totalMinted = mToken.totalMinted.plus(amount);

    updateTotalMintedSnapshot(timestamp, mToken.totalMinted);

    if (received.equals(BigInt.fromI32(0))) return;

    recipient.received = recipient.received.plus(amount);

    updateReceivedSnapshot(recipient, timestamp, recipient.received);
}

function _startEarning(mToken: MToken, account: Holder, timestamp: Timestamp): void {
    account.isEarning = true;

    updateIsEarningSnapshot(account, timestamp, account.isEarning);

    const balance = account.nonEarningBalance;

    _subtractNonEarningAmount(mToken, account, balance, timestamp);

    const index = _getCurrentIndex(mToken, timestamp);
    const principal = _getPrincipalAmountRoundedDown(balance, index);

    _addEarningAmount(mToken, account, principal, timestamp);
}

function _stopEarning(mToken: MToken, account: Holder, timestamp: Timestamp): void {
    account.isEarning = false;

    updateIsEarningSnapshot(account, timestamp, account.isEarning);

    const principal = account.earningPrincipal;

    _subtractEarningAmount(mToken, account, principal, timestamp);

    const index = _getCurrentIndex(mToken, timestamp);
    const balance = _getPresentAmountRoundedDown(principal, index);

    _addNonEarningAmount(mToken, account, balance, timestamp);
}

function _transfer(mToken: MToken, sender: Holder, recipient: Holder, amount: BigInt, timestamp: Timestamp): void {
    if (amount.equals(BigInt.fromI32(0))) return;

    const index = _getCurrentIndex(mToken, timestamp);

    const startingSenderBalance = sender.isEarning
        ? _getPresentAmountRoundedDown(sender.earningPrincipal, index)
        : sender.nonEarningBalance;

    const startingRecipientBalance = recipient.isEarning
        ? _getPresentAmountRoundedDown(recipient.earningPrincipal, index)
        : recipient.nonEarningBalance;

    if (sender.isEarning == recipient.isEarning) {
        _transferAmountInKind(sender, recipient, amount, index, timestamp);
    } else if (sender.isEarning) {
        _subtractEarningAmount(mToken, sender, _getPrincipalAmountRoundedUp(amount, index), timestamp);
        _addNonEarningAmount(mToken, recipient, amount, timestamp);
    } else {
        _subtractNonEarningAmount(mToken, sender, amount, timestamp);
        _addEarningAmount(mToken, recipient, _getPrincipalAmountRoundedDown(amount, index), timestamp);
    }

    const endingSenderBalance = sender.isEarning
        ? _getPresentAmountRoundedDown(sender.earningPrincipal, index)
        : sender.nonEarningBalance;

    const endingRecipientBalance = recipient.isEarning
        ? _getPresentAmountRoundedDown(recipient.earningPrincipal, index)
        : recipient.nonEarningBalance;

    const sent = startingSenderBalance.minus(endingSenderBalance);
    const received = endingRecipientBalance.minus(startingRecipientBalance);

    if (sent.notEqual(BigInt.fromI32(0))) {
        sender.sent = sender.sent.plus(sent);

        updateSentSnapshot(sender, timestamp, sender.sent);
    }

    if (received.notEqual(BigInt.fromI32(0))) {
        recipient.received = recipient.received.plus(received);

        updateReceivedSnapshot(recipient, timestamp, recipient.received);
    }
}

function _updateIndex(mToken: MToken, timestamp: Timestamp, index: BigInt, rate: BigInt): void {
    mToken.latestIndex = index;
    mToken.latestRate = rate;
    mToken.latestUpdateTimestamp = timestamp;

    updateLatestIndexSnapshot(timestamp, mToken.latestIndex);
    updateLatestRateSnapshot(timestamp, mToken.latestRate);
    updateLatestUpdateTimestampSnapshot(timestamp, mToken.latestUpdateTimestamp);
}

function _getCurrentIndex(mToken: MToken, timestamp: Timestamp): BigInt {
    return _multiplyIndicesDown(
        mToken.latestIndex,
        _getContinuousIndex(_convertFromBasisPoints(mToken.latestRate), timestamp - mToken.latestUpdateTimestamp)
    );
}

function _transferAmountInKind(
    sender: Holder,
    recipient: Holder,
    amount: BigInt,
    index: BigInt,
    timestamp: Timestamp
): void {
    if (sender.address == recipient.address) return;

    if (sender.isEarning) {
        const principal = _getPrincipalAmountRoundedUp(amount, index);

        if (principal.equals(BigInt.fromI32(0))) return;

        sender.earningPrincipal = sender.earningPrincipal.minus(principal);

        updateEarningPrincipalSnapshot(sender, timestamp, sender.earningPrincipal);

        recipient.earningPrincipal = recipient.earningPrincipal.plus(principal);

        updateEarningPrincipalSnapshot(recipient, timestamp, recipient.earningPrincipal);
    } else {
        if (amount.equals(BigInt.fromI32(0))) return;

        sender.nonEarningBalance = sender.nonEarningBalance.minus(amount);

        updateNonEarningBalanceSnapshot(sender, timestamp, sender.nonEarningBalance);

        recipient.nonEarningBalance = recipient.nonEarningBalance.plus(amount);

        updateNonEarningBalanceSnapshot(recipient, timestamp, recipient.nonEarningBalance);
    }
}

function _addEarningAmount(mToken: MToken, account: Holder, principal: BigInt, timestamp: Timestamp): void {
    if (principal.equals(BigInt.fromI32(0))) return;

    account.earningPrincipal = account.earningPrincipal.plus(principal);

    updateEarningPrincipalSnapshot(account, timestamp, account.earningPrincipal);

    mToken.principalOfTotalEarningSupply = mToken.principalOfTotalEarningSupply.plus(principal);

    updatePrincipalOfTotalEarningSupplySnapshot(timestamp, mToken.principalOfTotalEarningSupply);
}

function _subtractEarningAmount(mToken: MToken, account: Holder, principal: BigInt, timestamp: Timestamp): void {
    if (principal.equals(BigInt.fromI32(0))) return;

    account.earningPrincipal = account.earningPrincipal.minus(principal);

    updateEarningPrincipalSnapshot(account, timestamp, account.earningPrincipal);

    mToken.principalOfTotalEarningSupply = mToken.principalOfTotalEarningSupply.minus(principal);

    updatePrincipalOfTotalEarningSupplySnapshot(timestamp, mToken.principalOfTotalEarningSupply);
}

function _addNonEarningAmount(mToken: MToken, account: Holder, amount: BigInt, timestamp: Timestamp): void {
    if (amount.equals(BigInt.fromI32(0))) return;

    account.nonEarningBalance = account.nonEarningBalance.plus(amount);

    updateNonEarningBalanceSnapshot(account, timestamp, account.nonEarningBalance);

    mToken.totalNonEarningSupply = mToken.totalNonEarningSupply.plus(amount);

    updateTotalNonEarningSupplySnapshot(timestamp, mToken.totalNonEarningSupply);
}

function _subtractNonEarningAmount(mToken: MToken, account: Holder, amount: BigInt, timestamp: Timestamp): void {
    if (amount.equals(BigInt.fromI32(0))) return;

    account.nonEarningBalance = account.nonEarningBalance.minus(amount);

    updateNonEarningBalanceSnapshot(account, timestamp, account.nonEarningBalance);

    mToken.totalNonEarningSupply = mToken.totalNonEarningSupply.minus(amount);

    updateTotalNonEarningSupplySnapshot(timestamp, mToken.totalNonEarningSupply);
}

/* ============ Contract Helpers ============ */

function _getPresentAmountRoundedDown(principalAmount: BigInt, index: BigInt): BigInt {
    return _multiplyDown(principalAmount, index);
}

function _getPrincipalAmountRoundedUp(presentAmount: BigInt, index: BigInt): BigInt {
    return _divideUp(presentAmount, index);
}

function _getPrincipalAmountRoundedDown(presentAmount: BigInt, index: BigInt): BigInt {
    return _divideDown(presentAmount, index);
}

function _divideUp(x: BigInt, index: BigInt): BigInt {
    return x.times(EXP_SCALED_ONE).plus(index).minus(BigInt.fromI32(1)).div(index);
}

function _divideDown(x: BigInt, index: BigInt): BigInt {
    return x.times(EXP_SCALED_ONE).div(index);
}

function _multiplyDown(x: BigInt, index: BigInt): BigInt {
    return x.times(index).div(EXP_SCALED_ONE);
}

function _convertFromBasisPoints(rate: BigInt): BigInt {
    return EXP_SCALED_ONE.times(rate).div(BPS_SCALED_ONE);
}

function _getContinuousIndex(yearlyRate: BigInt, time: Timestamp): BigInt {
    return _exponent(yearlyRate.times(BigInt.fromI64(time)).div(SECONDS_PER_YEAR));
}

function _exponent(x: BigInt): BigInt {
    const x2 = x.times(x);

    const _84e27 = BigInt.fromI32(84).times(BigInt.fromI32(10).pow(27));
    const _9e3 = BigInt.fromI32(9).times(BigInt.fromI32(10).pow(3));
    const _2e11 = BigInt.fromI32(2).times(BigInt.fromI32(10).pow(11));
    const _1e11 = BigInt.fromI32(10).pow(11);
    const _42e15 = BigInt.fromI32(42).times(BigInt.fromI32(10).pow(15));
    const _1e9 = BigInt.fromI32(10).pow(9);
    const _1e12 = BigInt.fromI32(10).pow(12);

    const additiveTerms = _84e27.plus(x2.times(_9e3)).plus(x2.div(_2e11).times(x2.div(_1e11)));

    const differentTerms = x.times(_42e15.plus(x2.div(_1e9)));

    return additiveTerms.plus(differentTerms).times(_1e12).div(additiveTerms.minus(differentTerms));
}

function _multiplyIndicesDown(index: BigInt, deltaIndex: BigInt): BigInt {
    return index.times(deltaIndex).div(EXP_SCALED_ONE);
}
