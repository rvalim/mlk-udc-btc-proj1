/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */


const cypher = require('../utils/cypher')
const BlockClass = require('./block.js');
const bitcoinMessage = require('../node_modules/bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.wallet = {}
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if (this.height === -1) {
            let block = new BlockClass.Block({ data: 'Genesis Block' });
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        return new Promise(async (resolve, reject) => {
            const pHash = this.height > -1 ? this.chain[this.height].hash : null

            block.time = new Date().getTime().toString().slice(0, -3);
            block.previousBlockHash = pHash
            block.height = ++this.height
            block.hash = cypher.toHash(block)

            this.chain.push(block)
            resolve(block)
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            const message = `${address}:${parseInt(new Date().getTime().toString().slice(0, -3))}:starRegistry`

            resolve(message)
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        return new Promise(async (resolve, reject) => {
            const valid = await bitcoinMessage.verify(message, address, signature)

            if (!valid) 
                reject('Invalid signature')
            
            const time = parseInt(message.split(':')[1])
            const currentTime = parseInt(new Date().getTime().toString().slice(0, -3))
            const milSeconds = currentTime - time
            
            //if (milSeconds > (5 * 60)) reject('Window expired')
            
            const block = await this._addBlock(new BlockClass.Block({ data: star }))

            this.wallet = {
                ...this.wallet,
                [address]: [...(this.wallet[address] || []), block.height]
            }

            resolve(this.getBlockByHeight(this.height))
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        return new Promise((resolve, reject) => {
            let block = this.chain.filter(p => p.hash == hash)[0]
            if (block) {
                resolve(this.getBlockByHeight(block.height));
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        return new Promise((resolve, reject) => {
            const block = this.chain[height]
            if (block) {
                resolve(
                    {
                        ...block,
                        "body": block.getBData()
                    }
                );
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress(address) {
        return new Promise((resolve, reject) => {
            let promises = (this.wallet[address] || []).map(p => this.getBlockByHeight(p))
            resolve(Promise.all(promises))
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        return new Promise(async (resolve, reject) => {
            let pHash = null
            let errorLog = []

            for (let i = 0; i <= this.height; i++) {
                if(pHash != this.chain[i].previousBlockHash) 
                    errorLog.push(`block ${this.chain[i].hash} invalid previous hash`)

                if (!(await this.chain[i].validate()))
                    errorLog.push(`block ${this.chain[i].hash} seems to have been violeted`)
                
                pHash = this.chain[i].hash
            }

            resolve(errorLog)
        });
    }

}

module.exports.Blockchain = Blockchain;   