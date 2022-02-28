import { TransactionRequest } from '@ethersproject/abstract-provider';
import { BN, expectEvent} from '@openzeppelin/test-helpers';
import { ethers, artifacts } from 'hardhat';
import { EndPoint, EndPointLockable, MadnetFactory, Proxy } from '../../../typechain-types';
import { expect } from '../../chai-setup';
import { CONTRACT_ADDR, DEPLOYED_PROXY, deployFactory, expectTxSuccess, getAccounts, getEventVar, getMetamorphicAddress, getSalt, MADNET_FACTORY } from '../Setup.test';


describe("PROXY", async () => {
    it("deploy proxy through factory", async () => {
        let factory = await deployFactory(MADNET_FACTORY);
        let salt = getSalt();
        let txResponse = await factory.deployProxy(salt);
        expectTxSuccess(txResponse);
    });

    it("deploy proxy raw and upgrades to endPointLockable logic", async () => {
        let accounts = await getAccounts();
        let proxyFactory = await ethers.getContractFactory("Proxy");
        let proxy = await proxyFactory.deploy();
        let endPointLockableFactory = await ethers.getContractFactory("EndPointLockable");
        let endPointLockable = await endPointLockableFactory.deploy(accounts[0]);
        expect(proxy.deployed());
        let abicoder = new ethers.utils.AbiCoder()
        let encodedAddress = abicoder.encode(["address"], [endPointLockable.address])
        let txReq:TransactionRequest = {
            data: "0xca11c0de" + encodedAddress.substring(2)
        }
        let txResponse = await proxy.fallback(txReq)
        let receipt = await txResponse.wait();
        expect(receipt.status).to.equal(1);
        let proxyImplAddr = await proxy.callStatic.getImplementationAddress();
        expect(proxyImplAddr).to.equal(endPointLockable.address);
    });

    it("locks the proxy upgradeability, prevents the proxy from being updated", async () => {
        let accounts = await getAccounts();
        let proxyFactory = await ethers.getContractFactory("Proxy");
        let proxy = await proxyFactory.deploy();
        let endPointLockableFactory = await ethers.getContractFactory("EndPointLockable");
        let endPointLockable = await endPointLockableFactory.deploy(accounts[0]);
        let endPointFactory = await ethers.getContractFactory("EndPoint");
        let endPoint = await endPointFactory.deploy(accounts[0]);
        expect(proxy.deployed());
        let abicoder = new ethers.utils.AbiCoder()
        let encodedAddress = abicoder.encode(["address"], [endPointLockable.address]);
        let txReq:TransactionRequest = {
            data: "0xca11c0de" + encodedAddress.substring(2)
        }
        let txResponse = await proxy.fallback(txReq);
        let receipt = await txResponse.wait();
        expect(receipt.status).to.equal(1);
        let proxyImplAddr = await proxy.callStatic.getImplementationAddress();
        expect(proxyImplAddr).to.equal(endPointLockable.address);
        //interface of logic connected to logic contract 
        let proxyContract = endPointLockableFactory.attach(proxy.address);
        //lock the implementation
        txResponse = await proxyContract.upgradeLock();
        receipt = await txResponse.wait();
        expect(receipt.status).to.equal(1);
        encodedAddress = abicoder.encode(["address"], [endPoint.address]);
        txReq = {
            data: "0xca11c0de" + encodedAddress.substring(2)
        }
        let response = proxy.fallback(txReq);
        await expect(response).to.be.revertedWith("reverted with an unrecognized custom error");
        txResponse = await proxyContract.upgradeUnlock();
        receipt = await txResponse.wait();
        expect(receipt.status).to.equal(1);
    });
});