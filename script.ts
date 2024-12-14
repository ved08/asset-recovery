// Program to recover cNFT
import {
    Connection,
    Keypair,
    Transaction,
    SystemProgram,
    TransactionInstruction,
    sendAndConfirmTransaction,
    clusterApiUrl,
} from '@solana/web3.js';
import base58 from "bs58"
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import {
    mplBubblegum,
} from "@metaplex-foundation/mpl-bubblegum";
import { transferV1 } from "@metaplex-foundation/mpl-core"
import {
    keypairIdentity,
    publicKey as UMIPublicKey,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";


import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters"

import dotenv from "dotenv"
dotenv.config();
(async () => {
    const compromisedSecret = process.env.COMPROMISED_WALLET_KEY || ""
    const secret = base58.decode(compromisedSecret)
    const safeSecret = process.env.SAFE_WALLET_KEY || ""
    const safe = base58.decode(safeSecret)
    const SAFE_WALLET = Keypair.fromSecretKey(safe); // Your safe wallet keypair
    const COMPROMISED_WALLET = Keypair.fromSecretKey(secret) // Compromised wallet keypair
    console.log(COMPROMISED_WALLET.publicKey.toBase58(), SAFE_WALLET.publicKey.toBase58())


    const solTransferInstruction = SystemProgram.transfer({
        fromPubkey: SAFE_WALLET.publicKey,
        toPubkey: COMPROMISED_WALLET.publicKey,
        lamports: 50000 + 1250000, // this is not optimised change it
    });

    const umi = createUmi(clusterApiUrl("mainnet-beta"))
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(COMPROMISED_WALLET.secretKey);
    umi.use(keypairIdentity(umiKeypair)).use(mplBubblegum()).use(dasApi());

    const assetId = UMIPublicKey("<cNft address>");

    const blockhash = (await umi.rpc.getLatestBlockhash()).blockhash
    let uintSig = await transferV1(umi, {
        asset: assetId,
        newOwner: UMIPublicKey("<new owner of cNft>"),
        collection: UMIPublicKey("<collection address>")
    })
    uintSig.setBlockhash(blockhash)

    const transferNftIx = uintSig.getInstructions()
    const web3JsIx: TransactionInstruction[] = transferNftIx.map(ix => toWeb3JsInstruction(ix))

    const connection = new Connection(clusterApiUrl("mainnet-beta"))

    const blockhash1 = (await connection.getLatestBlockhash()).blockhash
    const tx = new Transaction({
        recentBlockhash: blockhash
    }).add(solTransferInstruction, ...web3JsIx)
    tx.feePayer = SAFE_WALLET.publicKey
    tx.partialSign(SAFE_WALLET, COMPROMISED_WALLET)
    tx.recentBlockhash = blockhash1
    const sig = await sendAndConfirmTransaction(
        connection,
        tx,
        [SAFE_WALLET, COMPROMISED_WALLET]
    )
    console.log('Transaction successful with signature:', sig);

})()