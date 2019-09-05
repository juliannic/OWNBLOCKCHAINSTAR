/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

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
    let $this = this;

    return new Promise(async (resolve, reject) => {
      // Get the newest block on the chain
      const previousBlock = await this.getBlockByHeight($this.chain.length - 1);

      // Assign properties to the new block
      if (!previousBlock) {
        block.height = 0;

        block.time = new Date()
          .getTime()
          .toString()
          .slice(0, -3);
        // block.height = previousBlock.height + 1;
        block.hash = SHA256(JSON.stringify(block)).toString();
      } else {
        block.height = previousBlock.height + 1;

        block.time = new Date()
          .getTime()
          .toString()
          .slice(0, -3);
        block.previousBlockHash = previousBlock.hash;
        block.hash = SHA256(JSON.stringify(block)).toString();
      }

      // Assign properties to the Blockchain
      try {
        $this.height = (await $this.getChainHeight()) + 1;
        $this.chain.push(block);
        resolve(block);
      } catch (error) {
        reject();
      }
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
    return new Promise(resolve => {
      resolve({
        message: `${address}:${new Date()
          .getTime()
          .toString()
          .slice(0, -3)}:starRegistry`
      });
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
    let $this = this;
    const msgTime = parseInt(message.split(':')[1]);
    const currentTime = parseInt(
      new Date()
        .getTime()
        .toString()
        .slice(0, -3)
    );

    return new Promise(async (resolve, reject) => {
      if (currentTime - msgTime < 300) {
        const verified = bitcoinMessage.verify(message, address, signature);

        if (verified) {
          let block = new BlockClass.Block({ owner: address, data: star });
          const result = await this._addBlock(block);
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Error'));
          }
        }
        reject(new Error('Error'));
      }

      reject(new Error('Error'));
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block
   *  with the hash passed as a parameter.
   * Search on the chain array for the block that has the hash.
   * @param {*} hash
   */
  getBlockByHash(hash) {
    let $this = this;

    return new Promise(async resolve => {
      resolve(await $this.chain.filter(block => block.hash == hash));
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block object
   * with the height equal to the parameter `height`
   * @param {*} height
   */
  getBlockByHeight(height) {
    let self = this;
    return new Promise((resolve, reject) => {
      let block = self.chain.filter(p => p.height === height)[0];
      resolve(block);
    });
  }

  /**
   * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
   * and are belongs to the owner with the wallet address passed as parameter.
   * Remember the star should be returned decoded.
   * @param {*} address
   */
  getStarsByWalletAddress(address) {
    let $this = this;
    let stars = [];
    return new Promise(async (resolve, reject) => {
      $this.chain.forEach(async block => {
        const body = await block.getBData();
        if (body && body.owner && body.owner === address) {
          stars.push(body);
        }
      });

      const valid = $this.validateChain();

      if (valid) {
        resolve(stars);
      }
      reject(null);
    });
  }

  /**
   * This method will return a Promise that will resolve with the list of errors when validating the chain.
   * Steps to validate:
   * 1. You should validate each block using `validateBlock`
   * 2. Each Block should check the with the previousBlockHash
   */
  validateChain() {
    let $this = this;
    let errorLog = [];

    return new Promise(async (resolve, reject) => {
      if ($this.chain.length < 1) {
        errorLog.push({
          type: 'Application',
          message: `Something went wrong with the program.  The blockchain is empty`,
          block: null
        });
      }
      // Validate that chain height and length are in sync
      if ($this.height !== $this.chain.length - 1) {
        errorLog.push({
          type: 'Blockchain Validation',
          message: `This blockchain is corrupt.  Chain length and chain height are incongruent.`,
          block: null
        });
      }

      for (let i = $this.chain.length - 1; i >= 0; i--) {
        const block = $this.chain[i];
        const previous_block = $this.chain[i - 1];

        if (!block) {
          errorLog.push({
            type: 'Application',
            message: `Something went wrong with the program.`,
            block: null
          });
        }

        if (block && !previous_block) {
          if (block.height !== 0) {
            errorLog.push({
              type: 'Blockchain Validation',
              message: `Something went wrong with the Genesis Block.`,
              block: null
            });
          }
        }

        if (block && previous_block) {
          if (block.height !== previous_block.height + 1) {
            errorLog.push({
              type: 'Blockchain Validation',
              message: `Block ${
                block.height
              } is out of sequence with its neighboring previous block Block ${
                previous_block.height
              }.`,
              block: block.height
            });
          }

          if (block.previousBlockHash !== previous_block.hash) {
            errorLog.push({
              type: 'Block Validation',
              message: `Block ${
                block.height
              } PreviousBlockHash does not match previous block Block ${
                previous_block.height
              } Hash.`,
              block: block.height
            });
          }

          const block_is_valid = await block.validate();

          if (!block_is_valid) {
            errorLog.push({
              type: 'Block Validation',
              message: `Block ${
                block.height
              } does not pass validation.  The hash check doesn't match.`,
              block: block.height
            });
          }
        }
      }

      if (errorLog.length > 0) {
        resolve(errorLog);
      }
      resolve('The Blockchain is healthy.');
    });
  }

  // Utility functions
  tamperBlock(height) {
    this.chain[height].body = 'induced error';
  }

  transferBlock(height1, height2) {
    this.chain[height1] = this.chain[height2];
  }
}

module.exports.Blockchain = Blockchain;
